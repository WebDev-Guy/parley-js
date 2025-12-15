# Performance Optimization

[Home](../../index.md) > [Documentation](./index.md) >
[Performance](./index.md) > Optimization

## Overview

ParleyJS is designed for high-performance inter-context communication. This
guide covers optimization techniques to maximize throughput, minimize latency,
and reduce memory usage in your applications.

## Table of Contents

1. [Message Batching](#message-batching)
2. [Payload Size Optimization](#payload-size-optimization)
3. [Connection Pooling](#connection-pooling)
4. [Memory Management](#memory-management)
5. [Debouncing and Throttling](#debouncing-and-throttling)
6. [Transferable Objects](#transferable-objects)
7. [Performance Profiling](#performance-profiling)
8. [Benchmarking](#benchmarking)
9. [Optimization Checklist](#optimization-checklist)

---

## Message Batching

Batching multiple operations into single messages reduces overhead and improves
throughput.

### Problem: High Message Frequency

```typescript
// SLOW - 1000 individual messages
for (let i = 0; i < 1000; i++) {
    await parley.send('process-item', { id: i, data: items[i] });
}
```

### Solution: Batch Processing

```typescript
// FAST - Single batched message
await parley.send('process-batch', {
    items: items.map((data, id) => ({ id, data })),
});
```

### Implementation

```typescript
// Sender: Accumulate items and send in batches
class BatchProcessor {
    private batch: any[] = [];
    private batchSize = 100;
    private timeout: NodeJS.Timeout | null = null;

    async addItem(item: any) {
        this.batch.push(item);

        if (this.batch.length >= this.batchSize) {
            await this.flush();
        } else if (!this.timeout) {
            // Auto-flush after 100ms of inactivity
            this.timeout = setTimeout(() => this.flush(), 100);
        }
    }

    private async flush() {
        if (this.batch.length === 0) return;

        const items = this.batch.splice(0, this.batch.length);

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        await parley.send('process-batch', { items });
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

**Performance Gain**: 10-50x throughput improvement for high-frequency
operations.

---

## Payload Size Optimization

Minimize payload size to reduce serialization overhead and network transfer
time.

### Technique 1: Send Only What's Needed

```typescript
// SLOW - Sending entire user object (5KB)
await parley.send('update-name', {
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
});

// FAST - Send only required fields (200 bytes)
await parley.send('update-name', {
    userId: 123,
    newName: 'Alice Smith',
});
```

### Technique 2: Compress Large Payloads

```typescript
import pako from 'pako';

// Compress before sending
async function sendCompressed(channel: string, data: any) {
    const json = JSON.stringify(data);
    const compressed = pako.deflate(json);

    await parley.send(channel, {
        compressed: true,
        data: Array.from(compressed), // Convert to regular array
    });
}

// Decompress on receive
parley.on('data-channel', (payload, respond) => {
    if (payload.compressed) {
        const decompressed = pako.inflate(new Uint8Array(payload.data), {
            to: 'string',
        });
        const data = JSON.parse(decompressed);
        processData(data);
    } else {
        processData(payload.data);
    }

    respond({ received: true });
});
```

### Technique 3: Use Efficient Data Structures

```typescript
// SLOW - Array of objects (verbose JSON)
const data = [
    { id: 1, name: 'Alice', score: 95 },
    { id: 2, name: 'Bob', score: 87 },
    { id: 3, name: 'Carol', score: 92 },
];

// FAST - Columnar format (50% smaller)
const optimized = {
    ids: [1, 2, 3],
    names: ['Alice', 'Bob', 'Carol'],
    scores: [95, 87, 92],
};
```

**Performance Gain**: 2-5x reduction in serialization time for large payloads.

---

## Connection Pooling

Reuse Parley instances and connections instead of creating new ones.

### Anti-Pattern: Creating New Instances

```typescript
// SLOW - Creates new connection every time
async function sendMessage(data: any) {
    const parley = new Parley({ target: worker });
    await parley.send('process', data);
    parley.destroy(); // Tears down connection
}
```

### Best Practice: Reuse Instances

```typescript
// FAST - Single reusable connection
const parley = new Parley({ target: worker });

async function sendMessage(data: any) {
    return parley.send('process', data);
}

// Cleanup on app shutdown
window.addEventListener('beforeunload', () => {
    parley.destroy();
});
```

### Worker Pool Pattern

```typescript
class WorkerPool {
    private workers: Parley[] = [];
    private currentIndex = 0;

    constructor(size: number = 4) {
        for (let i = 0; i < size; i++) {
            const worker = new Worker('/worker.js');
            this.workers.push(new Parley({ target: worker }));
        }
    }

    async send(channel: string, payload: any) {
        // Round-robin distribution
        const parley = this.workers[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.workers.length;

        return parley.send(channel, payload);
    }

    destroy() {
        this.workers.forEach((p) => p.destroy());
    }
}

// Usage
const pool = new WorkerPool(4); // 4 workers

await Promise.all([
    pool.send('task', data1), // Worker 0
    pool.send('task', data2), // Worker 1
    pool.send('task', data3), // Worker 2
    pool.send('task', data4), // Worker 3
    pool.send('task', data5), // Worker 0 (round-robin)
]);
```

**Performance Gain**: Eliminates connection setup overhead (10-100ms per
connection).

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

### Technique 2: Clear References to Large Objects

```typescript
parley.on('process-image', async (payload, respond) => {
    // Process large image data
    const processed = await processImage(payload.imageData);

    respond({ success: true });

    // Clear reference to allow garbage collection
    payload.imageData = null;
    processed = null;
});
```

### Technique 3: Use WeakMap for Caching

```typescript
// BAD - Prevents garbage collection
const cache = new Map<string, any>();

parley.on('get-data', (payload, respond) => {
    if (cache.has(payload.key)) {
        respond(cache.get(payload.key));
    } else {
        const data = fetchData(payload.key);
        cache.set(payload.key, data);
        respond(data);
    }
});

// GOOD - Allows garbage collection
const cache = new WeakMap<object, any>();

parley.on('get-data', (payload, respond) => {
    const keyObj = { key: payload.key };

    if (cache.has(keyObj)) {
        respond(cache.get(keyObj));
    } else {
        const data = fetchData(payload.key);
        cache.set(keyObj, data);
        respond(data);
    }
});
```

### Technique 4: Implement Message Queue Limits

```typescript
class RateLimitedParley {
    private queue: Array<() => Promise<void>> = [];
    private maxQueue = 100;
    private processing = 0;
    private maxConcurrent = 10;

    async send(channel: string, payload: any) {
        if (this.queue.length >= this.maxQueue) {
            throw new Error('Queue full - message dropped');
        }

        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    this.processing++;
                    const result = await parley.send(channel, payload);
                    resolve(result);
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

**Performance Gain**: Prevents memory leaks and reduces GC pauses.

---

## Debouncing and Throttling

Control message frequency for events that fire rapidly.

### Debouncing: Send After Inactivity

```typescript
class DebouncedSender {
    private timeout: NodeJS.Timeout | null = null;
    private delay = 300;

    send(channel: string, payload: any) {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            parley.emit(channel, payload);
            this.timeout = null;
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

    send(channel: string, payload: any) {
        const now = Date.now();

        if (now - this.lastSent >= this.interval) {
            parley.emit(channel, payload);
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
    private timeout: NodeJS.Timeout | null = null;
    private lastSent = 0;
    private throttleMs = 100;
    private debounceMs = 300;

    send(channel: string, payload: any) {
        const now = Date.now();

        // Clear existing debounce
        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        // Throttle: Send immediately if enough time has passed
        if (now - this.lastSent >= this.throttleMs) {
            parley.emit(channel, payload);
            this.lastSent = now;
        } else {
            // Debounce: Schedule send
            this.timeout = setTimeout(() => {
                parley.emit(channel, payload);
                this.lastSent = Date.now();
                this.timeout = null;
            }, this.debounceMs);
        }
    }
}
```

**Performance Gain**: 10-100x reduction in message frequency for high-rate
events.

---

## Transferable Objects

Transfer ownership of ArrayBuffers and other transferable objects for zero-copy
performance.

### Without Transfer (Copy)

```typescript
// SLOW - Copies 10MB of data
const buffer = new ArrayBuffer(10 * 1024 * 1024);
await parley.send('process-buffer', { buffer });

// Original buffer is still accessible (data was copied)
console.log(buffer.byteLength); // 10485760
```

### With Transfer (Zero-Copy)

```typescript
// FAST - Transfers ownership (zero-copy)
const buffer = new ArrayBuffer(10 * 1024 * 1024);
await parley.send(
    'process-buffer',
    { buffer },
    {
        transfer: [buffer],
    }
);

// Original buffer is now detached
console.log(buffer.byteLength); // 0 (neutered)
```

### Receiver Side

```typescript
parley.on('process-buffer', (payload, respond) => {
    // Received buffer without copying
    const { buffer } = payload;

    const view = new Uint8Array(buffer);
    // Process buffer...

    // Transfer back if needed
    respond({ result: 'done', buffer }, { transfer: [buffer] });
});
```

### Transferable Types

```typescript
// All transferable types
const transferables = [
    new ArrayBuffer(1024),
    new MessagePort(),
    new ImageBitmap(),
    new OffscreenCanvas(100, 100),
];

await parley.send(
    'process',
    { data: transferables },
    {
        transfer: transferables,
    }
);
```

**Performance Gain**: 100-1000x faster for large binary data (no copying
overhead).

---

## Performance Profiling

Measure and identify bottlenecks in your ParleyJS usage.

### Built-in Performance Monitoring

```typescript
const parley = new Parley({ debug: true });

// Enable performance marks
parley.on('message:sent', (event) => {
    performance.mark(`parley-send-${event.messageId}`);
});

parley.on('message:received', (event) => {
    performance.mark(`parley-receive-${event.messageId}`);
    performance.measure(
        `parley-roundtrip-${event.messageId}`,
        `parley-send-${event.messageId}`,
        `parley-receive-${event.messageId}`
    );
});

// Analyze measurements
const measures = performance.getEntriesByType('measure');
const avgLatency =
    measures.reduce((sum, m) => sum + m.duration, 0) / measures.length;
console.log('Average round-trip latency:', avgLatency, 'ms');
```

### Custom Performance Wrapper

```typescript
class PerformanceParley {
    private parley: Parley;
    private stats = {
        messagesSent: 0,
        messagesReceived: 0,
        totalLatency: 0,
        errors: 0,
    };

    constructor(config: ParleyConfig) {
        this.parley = new Parley(config);
    }

    async send(channel: string, payload: any, options?: SendOptions) {
        const start = performance.now();

        try {
            this.stats.messagesSent++;
            const result = await this.parley.send(channel, payload, options);
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

    resetStats() {
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            totalLatency: 0,
            errors: 0,
        };
    }
}

// Usage
const parley = new PerformanceParley({ target: worker });

await parley.send('task', data);
console.log(parley.getStats());
// { messagesSent: 1, messagesReceived: 1, avgLatency: 15.2, errorRate: 0 }
```

---

## Benchmarking

Compare different optimization strategies.

### Benchmark Framework

```typescript
async function benchmark(
    name: string,
    fn: () => Promise<void>,
    iterations = 1000
) {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await fn();
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;
    const opsPerSec = 1000 / avgTime;

    console.log(`${name}:
        Total: ${duration.toFixed(2)}ms
        Average: ${avgTime.toFixed(2)}ms
        Throughput: ${opsPerSec.toFixed(0)} ops/sec
    `);
}

// Compare batched vs individual sends
await benchmark(
    'Individual sends',
    async () => {
        for (let i = 0; i < 100; i++) {
            await parley.send('process', { id: i });
        }
    },
    10
);

await benchmark(
    'Batched sends',
    async () => {
        const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
        await parley.send('process-batch', { items });
    },
    10
);
```

### Output Example

```
Individual sends:
    Total: 1523.45ms
    Average: 152.35ms
    Throughput: 7 ops/sec

Batched sends:
    Total: 85.23ms
    Average: 8.52ms
    Throughput: 117 ops/sec
```

---

## Optimization Checklist

Use this checklist to optimize your ParleyJS implementation:

### Message Optimization

- [ ] Batch high-frequency operations (>10 messages/sec)
- [ ] Send only required fields, not entire objects
- [ ] Use columnar or compressed formats for large payloads
- [ ] Implement debouncing for user input events
- [ ] Implement throttling for high-rate events (mouse, scroll)

### Connection Management

- [ ] Reuse Parley instances instead of creating new ones
- [ ] Use worker pools for parallel processing
- [ ] Close/destroy connections when no longer needed
- [ ] Implement connection retry logic with exponential backoff

### Memory Management

- [ ] Unsubscribe from event handlers when done
- [ ] Clear references to large objects after processing
- [ ] Implement message queue limits to prevent overflow
- [ ] Use WeakMap for caches that should allow GC
- [ ] Monitor memory usage with Chrome DevTools

### Data Transfer

- [ ] Use transferable objects for ArrayBuffers >1MB
- [ ] Transfer ImageBitmap instead of canvas data
- [ ] Avoid transferring the same buffer multiple times

### Performance Monitoring

- [ ] Enable debug mode during development
- [ ] Use Performance API to measure latency
- [ ] Track error rates and timeout frequency
- [ ] Benchmark critical message paths
- [ ] Set up monitoring for production

### Configuration

- [ ] Set appropriate timeout values per operation
- [ ] Enable heartbeat monitoring for long-lived connections
- [ ] Configure allowed origins for security
- [ ] Use schemas for validation to catch errors early

### Code Quality

- [ ] Use TypeScript for type safety
- [ ] Implement error handling for all sends
- [ ] Add retry logic for transient failures
- [ ] Use async/await instead of promise chains
- [ ] Follow single responsibility principle in handlers

---

## Navigation

**Previous**: [Performance README](./index.md)

**Related**:

- [Request-Response Pattern](../patterns/request-response.md)
- [Worker Communication Guide](../guides/worker-communication.md)
- [Message Validation](../security/message-validation.md)

**Back to**: [Performance](./index.md)
