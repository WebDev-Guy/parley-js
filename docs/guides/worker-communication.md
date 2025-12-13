[Home](../../README.md) > [Guides](./README.md) > Web Worker Communication

# Web Worker Communication Guide

This guide explains ParleyJS's scope and provides guidance for Web Worker communication.

## Table of Contents

1. [Overview](#overview)
2. [ParleyJS and Web Workers](#parleyjs-and-web-workers)
3. [Native Web Worker Communication](#native-web-worker-communication)
4. [Alternative Solutions](#alternative-solutions)
5. [When to Use Workers vs Windows](#when-to-use-workers-vs-windows)
6. [Next Steps](#next-steps)
7. [Related Guides](#related-guides)

## Overview

Web Workers provide a way to run JavaScript in background threads, enabling true parallel execution. However, Web Workers use a different communication API than window-based communication.

ParleyJS is specifically designed for window, iframe, and popup communication using the postMessage API. Web Workers use a separate worker-specific messaging API that is fundamentally different.

## ParleyJS and Web Workers

ParleyJS does not support Web Worker communication. This is an intentional design decision.

### Why ParleyJS Doesn't Support Workers

ParleyJS is built for window-to-window communication which involves:
- Origin validation for security
- Window references (parent, opener, iframe.contentWindow)
- Cross-origin messaging with origin checks
- Window lifecycle management

Web Workers have a different communication model:
- Workers use their own postMessage API (not window.postMessage)
- No origin concept (workers are same-origin by definition)
- Different reference model (worker objects vs window references)
- Different lifecycle and termination semantics

Combining these two different communication patterns into one library would create complexity without providing meaningful benefits.

### Recommended Approach

For Web Worker communication, use the native Worker API directly. It is simple, well-supported, and designed specifically for worker communication.

## Native Web Worker Communication

Web Workers provide a straightforward communication API. Here's how to use it effectively.

### Basic Worker Setup

**Main Thread (main.js)**:
```javascript
// Create worker
const worker = new Worker('worker.js');

// Send message to worker
worker.postMessage({
    type: 'process-data',
    data: { items: [1, 2, 3, 4, 5] }
});

// Receive messages from worker
worker.addEventListener('message', (event) => {
    console.log('Received from worker:', event.data);

    if (event.data.type === 'result') {
        console.log('Result:', event.data.result);
    }
});

// Handle worker errors
worker.addEventListener('error', (error) => {
    console.error('Worker error:', error.message);
});
```

**Worker Thread (worker.js)**:
```javascript
// Receive messages from main thread
self.addEventListener('message', (event) => {
    const { type, data } = event.data;

    if (type === 'process-data') {
        const result = processData(data.items);

        // Send result back to main thread
        self.postMessage({
            type: 'result',
            result
        });
    }
});

function processData(items) {
    // Heavy computation here
    return items.reduce((sum, item) => sum + item, 0);
}
```

### Request-Response Pattern with Workers

Implement request-response pattern similar to ParleyJS:

```javascript
// Main thread: Request-response helper
class WorkerChannel {
    constructor(worker) {
        this.worker = worker;
        this.pendingRequests = new Map();
        this.messageId = 0;

        this.worker.addEventListener('message', (event) => {
            const { requestId, result, error } = event.data;

            const pending = this.pendingRequests.get(requestId);
            if (pending) {
                this.pendingRequests.delete(requestId);

                if (error) {
                    pending.reject(new Error(error));
                } else {
                    pending.resolve(result);
                }
            }
        });
    }

    async send(type, data, options = {}) {
        const requestId = ++this.messageId;
        const timeout = options.timeout || 5000;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Worker request timeout'));
            }, timeout);

            this.pendingRequests.set(requestId, {
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            this.worker.postMessage({ type, data, requestId });
        });
    }

    terminate() {
        this.worker.terminate();
        this.pendingRequests.clear();
    }
}

// Usage
const worker = new Worker('worker.js');
const channel = new WorkerChannel(worker);

try {
    const result = await channel.send('calculate', { numbers: [1, 2, 3] });
    console.log('Result:', result);
} catch (error) {
    console.error('Worker error:', error);
}
```

**Worker side**:
```javascript
self.addEventListener('message', async (event) => {
    const { type, data, requestId } = event.data;

    try {
        let result;

        if (type === 'calculate') {
            result = data.numbers.reduce((a, b) => a + b, 0);
        }

        self.postMessage({ requestId, result });
    } catch (error) {
        self.postMessage({ requestId, error: error.message });
    }
});
```

### Transferable Objects

For large data transfers, use Transferable Objects for better performance:

```javascript
// Main thread: Transfer ArrayBuffer to worker
const buffer = new ArrayBuffer(1024 * 1024); // 1MB
const array = new Uint8Array(buffer);

// Fill with data
for (let i = 0; i < array.length; i++) {
    array[i] = i % 256;
}

// Transfer ownership to worker (zero-copy)
worker.postMessage({
    type: 'process-buffer',
    buffer: buffer
}, [buffer]);

// Note: buffer is now unusable in main thread

// Worker: Receive and process buffer
self.addEventListener('message', (event) => {
    if (event.data.type === 'process-buffer') {
        const buffer = event.data.buffer;
        const array = new Uint8Array(buffer);

        // Process the data
        const result = processArray(array);

        // Transfer back to main thread
        self.postMessage({
            type: 'result',
            buffer: buffer
        }, [buffer]);
    }
});
```

### Shared Workers

For communication between multiple tabs, use Shared Workers:

```javascript
// Main thread (any tab)
const sharedWorker = new SharedWorker('shared-worker.js');

sharedWorker.port.start();

sharedWorker.port.postMessage({
    type: 'register',
    tabId: Math.random().toString(36)
});

sharedWorker.port.addEventListener('message', (event) => {
    console.log('Message from shared worker:', event.data);
});

// Shared worker (shared-worker.js)
const connections = [];

self.addEventListener('connect', (event) => {
    const port = event.ports[0];
    connections.push(port);

    port.addEventListener('message', (event) => {
        const { type, data } = event.data;

        if (type === 'broadcast') {
            // Broadcast to all connected tabs
            connections.forEach(connection => {
                connection.postMessage({
                    type: 'broadcast-message',
                    data
                });
            });
        }
    });

    port.start();
});
```

## Alternative Solutions

For complex worker communication needs, consider these libraries:

### Comlink

Comlink provides RPC-style communication for Web Workers:

```javascript
// Main thread
import * as Comlink from 'comlink';

const worker = new Worker('worker.js');
const WorkerAPI = Comlink.wrap(worker);

const result = await WorkerAPI.calculate(1, 2, 3);
console.log(result);

// Worker (worker.js)
import * as Comlink from 'comlink';

const api = {
    calculate(...numbers) {
        return numbers.reduce((a, b) => a + b, 0);
    }
};

Comlink.expose(api);
```

Install: `npm install comlink`
Documentation: https://github.com/GoogleChromeLabs/comlink

### Threads.js

Threads.js provides a complete threading solution:

```javascript
import { spawn, Thread } from 'threads';

const worker = await spawn(new Worker('./worker.js'));

const result = await worker.calculate([1, 2, 3, 4, 5]);
console.log(result);

await Thread.terminate(worker);
```

Install: `npm install threads`
Documentation: https://threads.js.org/

## When to Use Workers vs Windows

Choose the right tool for your use case.

### Use Web Workers When:
- Running CPU-intensive computations (image processing, data analysis, etc.)
- Processing large datasets without blocking the UI
- Performing background tasks (indexing, compression, etc.)
- Need true parallel execution on multi-core systems
- All code is in your control (same origin, no third-party content)

### Use Windows/iframes (ParleyJS) When:
- Embedding third-party content securely
- Isolating untrusted code in sandboxed iframes
- Cross-origin communication is required
- Implementing OAuth flows or payment processing
- Building widget systems or micro-frontends
- Need visual content in separate windows/iframes

### Use Both When:
You can combine ParleyJS and Web Workers for complex applications:

**Example**: Heavy computation in worker, results sent via ParleyJS to iframe

```javascript
// Main window
const worker = new Worker('compute-worker.js');
const parley = Parley.create({
    allowedOrigins: [window.location.origin]
});

// Get result from worker
worker.postMessage({ type: 'analyze', data: bigDataset });

worker.addEventListener('message', async (event) => {
    if (event.data.type === 'result') {
        // Send worker result to iframe via ParleyJS
        await parley.send('analysis:complete', {
            result: event.data.result
        }, { targetId: 'visualization-iframe' });
    }
});

// Iframe receives result from main window
parley.on('analysis:complete', (payload) => {
    visualizeData(payload.result);
});
```

## Next Steps

For Web Worker communication:

**Learn Native APIs**:
- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [MDN: Worker.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
- [MDN: Transferable Objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)

**Libraries for Worker Communication**:
- [Comlink](https://github.com/GoogleChromeLabs/comlink) - RPC-style worker communication
- [Threads.js](https://threads.js.org/) - Complete threading solution
- [Greenlet](https://github.com/developit/greenlet) - Move async functions to workers

For window communication with ParleyJS:

**Learn More ParleyJS Patterns**:
- [iFrame Communication](./iframe-communication.md) - Embed and communicate with iframes
- [Popup Communication](./popup-communication.md) - OAuth flows and dialogs
- [Multi-Window Communication](./multi-window-communication.md) - Coordinate multiple windows

**Core Concepts**:
- [API Reference](../api-reference/README.md) - Complete ParleyJS API
- [Code Patterns](../patterns/README.md) - Reusable ParleyJS patterns
- [Security Guide](../security/README.md) - Security best practices

## Related Guides

- **[iFrame Communication](./iframe-communication.md)** - Window-based communication
- **[Popup Communication](./popup-communication.md)** - Popup window patterns
- **[Multi-Window Communication](./multi-window-communication.md)** - Multiple window coordination

## See Also

**External Resources**:
- [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [Web Workers Specification](https://html.spec.whatwg.org/multipage/workers.html)
- [Shared Workers](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker)

**ParleyJS Documentation**:
- [Getting Started](../getting-started/README.md) - Introduction to ParleyJS
- [Core Concepts](../getting-started/concepts.md) - Understanding ParleyJS
- [Examples](../EXAMPLES.md) - Complete code examples

---

**Previous**: [Popup Window Communication](./popup-communication.md)
**Next**: [Multi-Window Communication](./multi-window-communication.md)
**Back to**: [Documentation Home](../README.md)
