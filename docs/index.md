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
          Exact-match origin validation, source-window binding, protocol checks
          on every inbound message, and payload size limits. Opt-in rate
          limiting.

    - title: Type Safety
      details:
          Full TypeScript support with generic message types. Catch errors at
          compile time, not runtime.

    - title: Zero Dependencies
      details:
          Lightweight and fast. No runtime dependencies. About 16 KB gzipped
          (~55 KB minified).

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
          Support for iframes, popups, and multi-window communication. One API
          for parent-iframe and opener-popup messaging.

    - title: Monitoring Built-in
      details:
          System events for connection lifecycle, heartbeat monitoring, and
          message tracking.

    - title: Battle Tested
      details:
          Around 80% test coverage, with dedicated security and reliability
          tests.
---

## Quick Example

```javascript
import { Parley } from 'ignite-parleyjs';

// Parent window
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    timeout: 5000,
});

// Connect to the iframe element
const iframe = document.getElementById('myFrame');
await parley.connect(iframe, 'child');

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
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
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

- **Security**: Origin validation, source-window binding, inbound message
  validation, payload size limits, opt-in rate limiting (payloads are
  JSON-cloned, not HTML-escaped: render received text with `textContent`)
- **Reliability**: Timeout handling, retries, heartbeat monitoring, closed-popup
  detection
- **Type Safety**: Full TypeScript support with generics
- **Testing**: Around 80% test coverage
- **Documentation**: Comprehensive guides, API reference, and examples
- **Performance**: About 90k `send()` calls per second for 1 KB payloads
  (`npm run bench`)

## Use Cases

- **Micro-frontends**: Coordinate independent frontend modules
- **iFrame widgets**: Embed third-party widgets securely
- **OAuth flows**: Popup-based authentication
- **Multi-window apps**: Coordinate state across windows
- **Analytics**: Track events across embedded content

## Next Steps

- [Installation](/getting-started/installation) - Install ParleyJS in your
  project
- [Core Concepts](/getting-started/concepts) - Understand the fundamentals
- [First Example](/getting-started/first-example) - Build your first application
- [API Reference](/api-reference/) - Explore the complete API
- [Security Guide](/security/) - Learn security best practices
