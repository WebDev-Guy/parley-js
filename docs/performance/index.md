[Home](../../index.md) > [Documentation](./index.md) > Performance

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
    - Connection pooling

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
// Slow - large payload
await parley.send('update', {
    data: hugeArray, // 10MB
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

```javascript
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.time(`message-${event.messageId}`);
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.timeEnd(`message-${event.correlationId}`);
});
```

### Monitor Connection Health

```javascript
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.warn('Connection health degraded:', event.targetId);
});
```

## Performance Benchmarks

Typical performance characteristics:

- **Message latency**: < 5ms (same origin)
- **Message throughput**: 1000+ messages/sec
- **Memory per connection**: ~10KB
- **Serialization overhead**: ~1ms per MB

These numbers vary based on browser, payload complexity, and system load.

## Memory Management

```javascript
// Clean up when done
function cleanup() {
    parley.destroy(); // Removes all listeners
}

// Or remove specific listeners
const unsubscribe = parley.on('message', handler);
unsubscribe(); // Remove this listener only
```

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

**Back to**: [Documentation Home](./index.md) | [Project Home](../../index.md)
