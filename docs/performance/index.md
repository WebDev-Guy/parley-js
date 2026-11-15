[Home](../index.md) > [Documentation](../FRAMEWORK_REFERENCE.md) > Performance

# Performance Guide

Optimize ParleyJS for high-performance applications.

## Overview

ParleyJS is designed for performance, but understanding performance
characteristics helps you build faster applications. This section covers
optimization techniques, profiling, and performance best practices.

## Contents

- **[Optimization Guide](./optimization.md)** - Performance optimization
  techniques
    - Message size optimization
    - Batching strategies
    - Debouncing and throttling
    - Memory management
    - Connection management

## Performance Characteristics

ParleyJS performance depends on:

- **Message size** - Smaller messages are faster
- **Message frequency** - Too many messages cause overhead
- **Number of connections** - More connections use more memory
- **Payload complexity** - Simple objects serialize faster

## Quick Performance Tips

**Do**:

- Keep messages small (< 1MB)
- Batch multiple updates
- Debounce frequent messages
- Clean up listeners when done
- Use fire-and-forget for notifications

**Don't**:

- Send large files through postMessage
- Send messages in tight loops
- Keep unused connections open
- Send complex nested objects unnecessarily
- Block the main thread in handlers

## Optimization Strategies

### Message Size

```javascript
// Slow - large payload (payloads over 10 MB serialized are rejected)
await parley.send('update', {
    data: hugeArray, // several MB
    metadata: {
        /* lots of data */
    },
});

// Fast - send reference
await parley.send('update', {
    dataId: 'ref-123', // Just ID
    timestamp: Date.now(),
});
```

### Message Batching

```javascript
// Slow - many small messages
for (let i = 0; i < 1000; i++) {
    await parley.send('update', { index: i });
}

// Fast - batch messages
await parley.send('batch-update', {
    items: Array.from({ length: 1000 }, (_, i) => ({ index: i })),
});
```

### Debouncing

```javascript
// Debounce frequent updates
const debouncedUpdate = debounce((data) => {
    parley.send('update', data, { targetId: 'child', expectsResponse: false });
}, 300);

window.addEventListener('scroll', () => {
    debouncedUpdate({ scrollY: window.scrollY });
});
```

For more patterns, see
[CODE_PATTERNS.md](../CODE_PATTERNS.md#performance-patterns).

## Profiling

### Measure Message Latency

For request-response messages, ParleyJS measures the round trip for you. The
`system:response_received` event carries a `duration` (milliseconds between
sending the request and receiving its response):

```javascript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.RESPONSE_RECEIVED, (event) => {
    // event: { responseId, requestId, success, duration, timestamp }
    console.log(`Request ${event.requestId} took ${event.duration}ms`);
});
```

`requestId` is the `messageId` reported by `system:message_sent` for the same
request. System event listeners are not awaited, so monitoring code never delays
message delivery.

### Monitor Connection Health

```javascript
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.warn('Connection health degraded:', event.targetId);
});
```

## Performance Benchmarks

The repository includes micro-benchmarks for the message hot path
(`tests/bench/hot-path.bench.ts`): fire-and-forget `send()` and inbound dispatch
to one or five targets. Run them with:

```bash
npm run bench
```

Measured for 1.1.0 with `npm run bench`:

- **`send()` with a 1 KB payload**: about 90,000 operations/second
- **`send()` with a 1 MB payload**: about 9 ms per call

The benchmarks run in a simulated DOM (happy-dom), not a real browser, so treat
them as relative numbers for comparing versions and payload sizes. Real-world
latency depends on the browser, payload complexity, and system load; profile
your own application with the events shown above.

## Memory Management

```javascript
// Clean up when done
function cleanup() {
    parley.destroy(); // Removes all listeners
}

// Or remove specific listeners
const unsubscribe = parley.on('chat:message', handler);
unsubscribe(); // Remove this listener only
```

`destroy()` also rejects pending requests with `ERR_CONNECTION_CLOSED` and emits
`system:disconnected` (reason `'destroyed'`) for each target.

For details, see [Optimization Guide](./optimization.md).

## Related Sections

- **[Optimization Guide](./optimization.md)** - Detailed optimization techniques
- **[CODE_PATTERNS.md](../CODE_PATTERNS.md)** - Performance patterns
- **[Architecture](../ARCHITECTURE.md)** - Performance architecture
- **[Testing](../TESTING.md)** - Performance testing

## Performance Checklist

Before deploying:

- [ ] Messages are small (< 1MB)
- [ ] Frequent updates are batched or debounced
- [ ] Unused connections are closed
- [ ] Listeners are cleaned up
- [ ] Performance has been profiled
- [ ] No memory leaks detected

---

## Navigation

**Topics**:

- [Optimization Guide](./optimization.md)

**Related**:

- [Advanced Patterns](../CODE_PATTERNS.md)
- [Architecture](../ARCHITECTURE.md)

**Back to**: [Documentation Home](../index.md) |
[Project Home](https://github.com/WebDev-Guy/parley-js/blob/main/README.md)
