---
layout: home

hero:
    name: ParleyJS
    text: Cross-Window Communication
    tagline:
        Type-safe, robust framework for window, tab, and iframe communication
    actions:
        - theme: brand
          text: Get Started
          link: /getting-started/
        - theme: alt
          text: View on GitHub
          link: https://github.com/WebDev-Guy/parley-js
        - theme: alt
          text: API Reference
          link: /api-reference/

features:
    - title: Security First
      details:
          Built-in origin validation, message sanitization, and DoS prevention.
          Production-ready security out of the box.

    - title: Type Safety
      details:
          Full TypeScript support with generic message types. Catch errors at
          compile time, not runtime.

    - title: Zero Dependencies
      details:
          Lightweight and fast. No external dependencies. Just 15KB minified and
          gzipped.

    - title: Simple API
      details:
          Intuitive API that feels natural. Connect, send, receive. Get
          productive in minutes.

    - title: Bidirectional Communication
      details:
          Request-response patterns with timeout handling. Send messages and
          wait for responses.

    - title: Multiple Patterns
      details:
          Support for iframes, popups, web workers, and multi-window
          communication. One API for all use cases.

    - title: Monitoring Built-in
      details:
          System events for connection lifecycle, heartbeat monitoring, and
          message tracking.

    - title: Battle Tested
      details:
          85% test coverage with comprehensive security and reliability
          testing.
---

## Quick Example

```javascript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

// Parent window
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
    timeout: 5000,
});

// Connect to iframe
const iframe = document.getElementById('myFrame');
await parley.connect(iframe.contentWindow, 'child');

// Send message and wait for response
const response = await parley.send(
    'getData',
    { id: 123 },
    {
        targetId: 'child',
    }
);

console.log('Response:', response);
```

```javascript
// Child iframe
const parley = Parley.create({
    allowedOrigins: ['https://parent.example.com'],
});

// Handle incoming messages
parley.on('getData', async (payload, respond) => {
    const data = await fetchData(payload.id);
    respond({ success: true, data });
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

## Why ParleyJS?

ParleyJS simplifies the `postMessage` API with a clean, type-safe interface. It
handles the complexity of cross-window communication so you can focus on
building features.

**Before ParleyJS:**

```javascript
// Complex origin validation
window.addEventListener('message', (event) => {
    if (event.origin !== 'https://trusted.com') return;

    // Manual message routing
    if (event.data.type === 'getData') {
        // Handle request
        const response = { id: event.data.id, data: result };

        // Send response back
        event.source.postMessage(response, event.origin);
    }
});
```

**With ParleyJS:**

```javascript
parley.on('getData', async (payload, respond) => {
    const result = await fetchData(payload.id);
    respond({ success: true, data: result });
});
```

## Enterprise Ready

- **Security**: Origin validation, message sanitization, DoS prevention
- **Reliability**: Timeout handling, connection monitoring, error recovery
- **Type Safety**: Full TypeScript support with generics
- **Testing**: 85%+ test coverage
- **Documentation**: Comprehensive guides, API reference, and examples
- **Performance**: Optimized for high-throughput scenarios

## Use Cases

- **Micro-frontends**: Coordinate independent frontend modules
- **iFrame widgets**: Embed third-party widgets securely
- **OAuth flows**: Popup-based authentication
- **Multi-window apps**: Coordinate state across windows
- **Web Workers**: Offload heavy computations
- **Analytics**: Track events across embedded content

## Next Steps

- [Installation](/getting-started/installation) - Install ParleyJS in your
  project
- [Core Concepts](/getting-started/concepts) - Understand the fundamentals
- [First Example](/getting-started/first-example) - Build your first application
- [API Reference](/api-reference/) - Explore the complete API
- [Security Guide](/security/) - Learn security best practices
