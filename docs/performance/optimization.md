# Performance Optimization

[Home](../index.md) > [Documentation](../FRAMEWORK_REFERENCE.md) >
[Performance](./index.md) > Optimization

## Overview

ParleyJS is designed for low-overhead communication between windows and iframes.
This guide covers techniques to maximize throughput, minimize latency, and
reduce memory usage in your applications.

The code samples in this guide that are not ParleyJS API calls (batchers,
debouncers, queues, wrappers) are application code you can adapt. Any
"slow"/"fast" comparisons describe the general direction of the effect, not
measured numbers; measure your own application before and after a change.

## Table of Contents

1. [What ParleyJS Already Does](#what-parleyjs-already-does)
2. [Message Batching](#message-batching)
3. [Payload Size Optimization](#payload-size-optimization)
4. [Instance and Connection Reuse](#instance-and-connection-reuse)
5. [Memory Management](#memory-management)
6. [Debouncing and Throttling](#debouncing-and-throttling)
7. [Binary Data and Large Payloads](#binary-data-and-large-payloads)
8. [Performance Profiling](#performance-profiling)
9. [Benchmarking](#benchmarking)
10. [Optimization Checklist](#optimization-checklist)

---

## What ParleyJS Already Does

Version 1.1.0 includes several hot-path improvements you get without any code
changes:

- **Single serialization pass**: each `send()` serializes the payload once
  (earlier versions serialized it three times). Measured with `npm run bench`,
  `send()` with a 1 KB payload went from about 43,000 to about 90,000
  operations/second, and a 1 MB payload from about 21 ms to about 9 ms.
- **Non-blocking system listeners**: listeners for `system:message_sent` and
  `system:message_received` are not awaited, so monitoring code never delays
  delivery or your handlers.
- **Optional payload cloning in low-level helpers**: `createMessage()` and
  `createResponse()` accept `clonePayload: false` to skip the defensive copy
  when you build protocol messages yourself from an already-sanitized payload.
  `send()` does not need this option.

---

## Message Batching

Batching multiple operations into a single message reduces per-message overhead
(serialization, validation, postMessage dispatch, and response tracking).

### Problem: High Message Frequency

```typescript
// SLOWER - 1000 individual round trips
for (let i = 0; i < 1000; i++) {
    await parley.send(
        'process-item',
        { id: i, data: items[i] },
        { targetId: 'child' }
    );
}
```

### Solution: Batch Processing

```typescript
// FASTER - Single batched message
await parley.send(
    'process-batch',
    { items: items.map((data, id) => ({ id, data })) },
    { targetId: 'child' }
);
```

### Implementation

```typescript
// Sender: Accumulate items and send in batches (application code)
class BatchProcessor {
    private batch: unknown[] = [];
    private batchSize = 100;
    private timer: ReturnType<typeof setTimeout> | null = null;

    async addItem(item: unknown) {
        this.batch.push(item);

        if (this.batch.length >= this.batchSize) {
            await this.flush();
        } else if (!this.timer) {
            // Auto-flush after 100ms of inactivity
            this.timer = setTimeout(() => this.flush(), 100);
        }
    }

    private async flush() {
        if (this.batch.length === 0) return;

        const items = this.batch.splice(0, this.batch.length);

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        await parley.send('process-batch', { items }, { targetId: 'child' });
    }
}

// Usage
const processor = new BatchProcessor();

for (const item of items) {
    await processor.addItem(item);
}
```

### Receiver: Process Batches Efficiently

```typescript
parley.on('process-batch', async (payload, respond) => {
    const results = await Promise.all(
        payload.items.map((item) => processItem(item))
    );

    respond({ results, count: results.length });
});
```

Keep each batch well under the 10 MB serialized payload limit.

---

## Payload Size Optimization

Smaller payloads reduce serialization and structured-clone cost on both sides.

### Technique 1: Send Only What's Needed

```typescript
// SLOWER - Sending the entire user object
await parley.send(
    'update-name',
    {
        user: {
            id: 123,
            username: 'alice',
            email: 'alice@example.com',
            profile: {
                /* large nested object */
            },
            settings: {
                /* large nested object */
            },
        },
        newName: 'Alice Smith',
    },
    { targetId: 'child' }
);

// FASTER - Send only required fields
await parley.send(
    'update-name',
    { userId: 123, newName: 'Alice Smith' },
    { targetId: 'child' }
);
```

### Technique 2: Compress Large Payloads

Payloads are JSON-cloned, so binary output (such as a `Uint8Array`) must be
converted to a JSON-friendly form before sending. A base64 string is more
compact than a number array.

```typescript
import pako from 'pako';

// Compress before sending
async function sendCompressed(type: string, data: unknown, targetId: string) {
    const compressed = pako.deflate(JSON.stringify(data));
    let binary = '';
    for (const byte of compressed) binary += String.fromCharCode(byte);

    await parley.send(
        type,
        { compressed: true, data: btoa(binary) },
        { targetId }
    );
}

// Decompress on receive
parley.on('data-channel', (payload, respond) => {
    if (payload.compressed) {
        const bytes = Uint8Array.from(atob(payload.data), (c) =>
            c.charCodeAt(0)
        );
        const data = JSON.parse(pako.inflate(bytes, { to: 'string' }));
        processData(data);
    } else {
        processData(payload.data);
    }

    respond({ received: true });
});
```

Compression costs CPU time; it pays off only for large, repetitive payloads.

### Technique 3: Use Compact Data Structures

```typescript
// Array of objects (keys repeated per row)
const data = [
    { id: 1, name: 'Alice', score: 95 },
    { id: 2, name: 'Bob', score: 87 },
    { id: 3, name: 'Carol', score: 92 },
];

// Columnar format (keys sent once) - smaller for large row counts
const optimized = {
    ids: [1, 2, 3],
    names: ['Alice', 'Bob', 'Carol'],
    scores: [95, 87, 92],
};
```

---

## Instance and Connection Reuse

Create one Parley instance per target type and keep connections open for as long
as you need them. Each `connect()` performs a handshake, and each connection
runs its own heartbeat.

### Anti-Pattern: Creating New Instances

```typescript
// SLOWER - New instance and handshake for every message
async function sendMessage(data: unknown) {
    const parley = Parley.create({ targetType: 'iframe' });
    await parley.connect(iframe, 'child');
    await parley.send('process', data, { targetId: 'child' });
    parley.destroy(); // Tears down the connection
}
```

The other side would also have to accept a new handshake for each instance, so
this pattern is fragile as well as slow.

### Best Practice: Reuse Instances

```typescript
import { Parley } from 'ignite-parleyjs';

// One instance, one connection
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});
await parley.connect(iframe, 'child');

async function sendMessage(data: unknown) {
    return parley.send('process', data, { targetId: 'child' });
}

// Cleanup on app shutdown
window.addEventListener('beforeunload', () => {
    parley.destroy();
});
```

### Distributing Work Across Several Iframes

One instance can connect to several iframes. To spread work across them, pick a
`targetId` per request. ParleyJS does not support Web Workers; use iframes (or
popups with a `targetType: 'window'` instance).

```typescript
// Round-robin over connected iframes (application code)
let next = 0;

async function sendToNextFrame(type: string, payload: unknown) {
    const targets = parley.getConnectedTargets();
    if (targets.length === 0) throw new Error('No connected frames');

    const targetId = targets[next % targets.length];
    next++;
    return parley.send(type, payload, { targetId });
}

await Promise.all([
    sendToNextFrame('task', data1),
    sendToNextFrame('task', data2),
    sendToNextFrame('task', data3),
]);
```

Note that `send()` without a `targetId` goes to every connected target and
resolves with the first response, which duplicates the work. Always pass a
`targetId` when you want exactly one target to handle a request.

---

## Memory Management

Prevent memory leaks and reduce garbage collection pressure.

### Technique 1: Unsubscribe from Handlers

```typescript
// BAD - Handler never cleaned up
parley.on('temporary-event', handler);

// GOOD - Unsubscribe when no longer needed
const unsubscribe = parley.on('temporary-event', handler);

// Later...
unsubscribe();
```

`onSystem()` and `onAnalyticsEvent()` also return unsubscribe functions.

### Technique 2: Disconnect and Destroy

```typescript
// Close a single connection (notifies the peer, stops its heartbeat)
await parley.disconnect('child');

// Tear down everything: rejects pending requests, removes listeners,
// emits system:disconnected (reason 'destroyed') per target
parley.destroy();
```

### Technique 3: Don't Hold on to Large Payloads

```typescript
parley.on('process-image', async (payload, respond) => {
    const result = await processImage(payload.imageData);
    respond({ success: true, width: result.width, height: result.height });
    // Avoid storing payload or result in long-lived structures
});
```

### Technique 4: Bound Your Caches

```typescript
// BAD - Grows forever
const cache = new Map<string, unknown>();

// BETTER - Simple size-bounded cache (application code)
const MAX_ENTRIES = 500;

parley.on('get-data', async (payload, respond) => {
    if (!cache.has(payload.key)) {
        if (cache.size >= MAX_ENTRIES) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
        }
        cache.set(payload.key, await fetchData(payload.key));
    }
    respond(cache.get(payload.key));
});
```

### Technique 5: Limit Concurrent Requests

ParleyJS has an opt-in outgoing rate limit
(`rateLimit: { enabled: true, messagesPerSecond }`). When it is exceeded,
`send()` rejects with `ERR_SECURITY_RATE_LIMITED` instead of queueing. If you
would rather queue, wrap `send()` yourself:

```typescript
// Concurrency-limited queue (application code)
class QueuedSender {
    private queue: Array<() => Promise<void>> = [];
    private maxQueue = 100;
    private processing = 0;
    private maxConcurrent = 10;

    send(type: string, payload: unknown, targetId: string) {
        if (this.queue.length >= this.maxQueue) {
            return Promise.reject(new Error('Queue full - message dropped'));
        }

        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    this.processing++;
                    resolve(await parley.send(type, payload, { targetId }));
                } catch (error) {
                    reject(error);
                } finally {
                    this.processing--;
                    this.processQueue();
                }
            });

            this.processQueue();
        });
    }

    private processQueue() {
        while (this.queue.length > 0 && this.processing < this.maxConcurrent) {
            const task = this.queue.shift();
            if (task) task();
        }
    }
}
```

---

## Debouncing and Throttling

Control message frequency for events that fire rapidly. For notifications that
need no reply, use `send()` with `expectsResponse: false` (one target or all
targets) or `broadcast()` (all targets, returns `void`).

### Debouncing: Send After Inactivity

```typescript
class DebouncedSender {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private delay = 300;

    send(type: string, payload: unknown) {
        if (this.timer) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(() => {
            parley.broadcast(type, payload);
            this.timer = null;
        }, this.delay);
    }
}

// Usage: User typing in search box
const debounced = new DebouncedSender();

searchInput.addEventListener('input', (e) => {
    debounced.send('search', { query: e.target.value });
});
```

### Throttling: Limit Send Frequency

```typescript
class ThrottledSender {
    private lastSent = 0;
    private interval = 100; // Max 10 messages per second

    send(type: string, payload: unknown) {
        const now = Date.now();

        if (now - this.lastSent >= this.interval) {
            parley.send(type, payload, {
                targetId: 'child',
                expectsResponse: false,
            });
            this.lastSent = now;
        }
    }
}

// Usage: Mouse movement tracking
const throttled = new ThrottledSender();

document.addEventListener('mousemove', (e) => {
    throttled.send('mouse-position', { x: e.clientX, y: e.clientY });
});
```

### Combined: Debounce + Throttle

```typescript
class SmartSender {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private lastSent = 0;
    private throttleMs = 100;
    private debounceMs = 300;

    send(type: string, payload: unknown) {
        const now = Date.now();

        if (this.timer) {
            clearTimeout(this.timer);
        }

        if (now - this.lastSent >= this.throttleMs) {
            // Throttle: send immediately if enough time has passed
            parley.broadcast(type, payload);
            this.lastSent = now;
        } else {
            // Debounce: make sure the last value is still delivered
            this.timer = setTimeout(() => {
                parley.broadcast(type, payload);
                this.lastSent = Date.now();
                this.timer = null;
            }, this.debounceMs);
        }
    }
}
```

ParleyJS also exports small `debounce` and `throttle` utilities you can use
instead of writing your own.

---

## Binary Data and Large Payloads

ParleyJS does not support Transferable objects or zero-copy transfer. Every
payload is sanitized with a JSON round-trip before it is posted, so:

- `ArrayBuffer`, typed arrays, `Blob`, `File`, `ImageBitmap`, `Map` and `Set`
  arrive as empty objects (`{}`)
- `Date` values arrive as strings
- functions, `undefined` and symbols are dropped
- circular references and `BigInt` values make `send()` reject with a
  `SerializationError`
- payloads larger than 10 MB serialized are rejected with a `ValidationError`
  (`ERR_VALIDATION_SCHEMA_MISMATCH`); the limit is fixed

### Converting Binary Data

Convert binary data to a JSON-friendly form before sending:

```typescript
// Sender: encode bytes as base64
function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

const bytes = new Uint8Array(await file.arrayBuffer());
await parley.send(
    'upload-chunk',
    { name: file.name, data: toBase64(bytes) },
    { targetId: 'uploader' }
);

// Receiver: decode back to bytes
parley.on('upload-chunk', (payload, respond) => {
    const bytes = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
    storeChunk(payload.name, bytes);
    respond({ received: bytes.length });
});
```

Base64 adds about 33% to the size. For large files, split the data into chunks
that stay well under the 10 MB limit, or upload the file to your server and send
only an ID or URL.

### Keep Payloads Small

Large payloads cost time on both sides (serialization, cloning, parsing). Where
possible, send references (IDs, URLs) and let the receiver fetch the data it
needs.

---

## Performance Profiling

Measure and identify bottlenecks in your ParleyJS usage.

### Built-in Timing Events

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    logLevel: 'debug', // development only
});

const latencies: number[] = [];

// Round-trip time for every request that received a response
parley.onSystem(SYSTEM_EVENTS.RESPONSE_RECEIVED, (event) => {
    latencies.push(event.duration);
});

// Count messages by type
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    performance.mark(`parley-send-${event.messageType}`);
});

parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.warn(
        `${event.messageType} timed out after ${event.timeoutMs}ms ` +
            `(${event.retriesAttempted} retries)`
    );
});

// Later
const avg = latencies.reduce((sum, d) => sum + d, 0) / latencies.length;
console.log('Average round-trip latency:', avg, 'ms');
```

With `analyticsEnabled: true`, `onAnalyticsEvent()` delivers the same
information as analytics events (`response_received` events include `duration`).

### Custom Performance Wrapper

```typescript
import { Parley } from 'ignite-parleyjs';

// Application code that wraps an existing instance
class PerformanceParley {
    private stats = {
        messagesSent: 0,
        messagesReceived: 0,
        totalLatency: 0,
        errors: 0,
    };

    constructor(private parley: Parley) {}

    async send(
        type: string,
        payload: unknown,
        options?: { targetId?: string; timeout?: number }
    ) {
        const start = performance.now();

        try {
            this.stats.messagesSent++;
            const result = await this.parley.send(type, payload, options);
            this.stats.messagesReceived++;
            this.stats.totalLatency += performance.now() - start;
            return result;
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    getStats() {
        return {
            ...this.stats,
            avgLatency: this.stats.totalLatency / this.stats.messagesReceived,
            errorRate: this.stats.errors / this.stats.messagesSent,
        };
    }
}

// Usage
const parley = Parley.create({ targetType: 'iframe' });
await parley.connect(iframe, 'child');

const monitored = new PerformanceParley(parley);
await monitored.send('task', data, { targetId: 'child' });
console.log(monitored.getStats());
```

---

## Benchmarking

### Library Benchmarks

The repository ships micro-benchmarks for the message hot path in
`tests/bench/hot-path.bench.ts` (fire-and-forget `send()` with 1 KB and 1 MB
payloads, and inbound dispatch to one and five targets):

```bash
npm run bench
```

Measured for 1.1.0: `send()` with a 1 KB payload runs at about 90,000
operations/second, and with a 1 MB payload takes about 9 ms. These run in
happy-dom rather than a real browser, so use them to compare versions and
payload sizes, not as absolute browser numbers.

### Benchmarking Your Own Message Paths

```typescript
async function benchmark(
    name: string,
    fn: () => Promise<void>,
    iterations = 10
) {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await fn();
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    console.log(
        `${name}: total ${duration.toFixed(2)}ms, ` +
            `average ${avgTime.toFixed(2)}ms, ` +
            `${(1000 / avgTime).toFixed(0)} ops/sec`
    );
}

// Compare batched vs individual sends
await benchmark('Individual sends', async () => {
    for (let i = 0; i < 100; i++) {
        await parley.send('process', { id: i }, { targetId: 'child' });
    }
});

await benchmark('Batched sends', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    await parley.send('process-batch', { items }, { targetId: 'child' });
});
```

Run benchmarks in the browsers you support, with realistic payloads, and compare
results rather than relying on absolute numbers.

---

## Optimization Checklist

Use this checklist to optimize your ParleyJS implementation:

### Message Optimization

- [ ] Batch high-frequency operations
- [ ] Send only required fields, not entire objects
- [ ] Use columnar or compressed formats for large payloads
- [ ] Implement debouncing for user input events
- [ ] Implement throttling for high-rate events (mouse, scroll)
- [ ] Use `expectsResponse: false` or `broadcast()` for notifications

### Connection Management

- [ ] Reuse Parley instances instead of creating new ones
- [ ] Pass a `targetId` when only one target should handle a request
- [ ] Disconnect or destroy connections when no longer needed
- [ ] Reconnect in your own code on `system:connection_lost` if needed (there is
      no automatic reconnection)

### Memory Management

- [ ] Unsubscribe from handlers and system listeners when done
- [ ] Avoid keeping large payloads in long-lived structures
- [ ] Bound caches and queues
- [ ] Monitor memory usage with browser DevTools

### Data Transfer

- [ ] Convert binary data (ArrayBuffer, Blob, File) to base64 or text first
- [ ] Keep serialized payloads well under the 10 MB limit
- [ ] Send references (IDs, URLs) instead of large data where possible

### Performance Monitoring

- [ ] Use `logLevel: 'debug'` during development only
- [ ] Track latency with `system:response_received` (`duration`)
- [ ] Track timeouts with `system:timeout`
- [ ] Benchmark critical message paths

### Configuration

- [ ] Set appropriate timeout values per operation
- [ ] Use the built-in `retries` option for timeouts (fixed interval, no
      backoff)
- [ ] Keep heartbeat monitoring enabled for long-lived connections
- [ ] Configure allowed origins for security
- [ ] Use schemas for validation to catch errors early

### Code Quality

- [ ] Use TypeScript for type safety
- [ ] Handle errors for every `send()`
- [ ] Follow single responsibility principle in handlers

---

## Navigation

**Previous**: [Performance README](./index.md)

**Related**:

- [Request-Response Pattern](../patterns/request-response.md)
- [Multi-Window Communication Guide](../guides/multi-window-communication.md)
- [Message Validation](../security/message-validation.md)

**Back to**: [Performance](./index.md)
