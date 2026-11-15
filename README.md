# Parley-js

<div align="center">

![Parley-js Logo](https://img.shields.io/badge/Parley--js-postMessage%20Made%20Simple-blue)
[![Tests](https://github.com/WebDev-Guy/parley-js/actions/workflows/test.yml/badge.svg)](https://github.com/WebDev-Guy/parley-js/actions/workflows/test.yml)
<a href="https://www.typescriptlang.org/" target="_blank">![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)</a>
<a href="https://opensource.org/licenses/MIT" target="_blank">![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)</a>
<a href="https://prettier.io/" target="_blank">![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)</a>
<a href="https://bundlephobia.com/package/ignite-parleyjs" target="_blank">![Bundle Size](https://img.shields.io/badge/Bundle-~55KB%20min%20%2F%20~16KB%20gzip-green)</a>
<a href="https://www.npmjs.com/package/ignite-parleyjs" target="_blank">![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success)</a>

**Type-safe, robust framework for window, tab, and iframe communication**

[Quick Start](#quick-start) • [Documentation](https://www.parleyjs.com/docs/) •
[How-To Guides](https://www.parleyjs.com/docs/guides/) •
[API Reference](https://www.parleyjs.com/docs/api-reference/) •
[Examples](https://www.parleyjs.com/docs/examples/)

</div>

---

## Features

- **Thoroughly Tested** - 800+ unit, integration, and security tests with
  coverage thresholds enforced in CI
- **Security-First Design** - Origin validation, source-bound connections,
  payload size limits, opt-in rate limiting
- **Type-Safe** - Full TypeScript with JSDoc comments
- **Zero Dependencies** - Lightweight, portable, and minimal footprint
- **Heartbeat Monitoring** - Automatic connection health checks
- **Schema Validation** - JSON Schema support for message validation
- **Request/Response Pattern** - Built-in timeout handling and retries
- **Analytics Ready** - Hooks for monitoring and performance tracking
- **Framework Agnostic** - Works with React, Vue, Angular, or vanilla JS
- **Multiple Targets** - Communicate with iframes, popups, and other windows

## Installation

```bash
npm install ignite-parleyjs
```

Requires Node.js 20.19 or later for development and tooling. The library itself
runs in any modern browser (see Browser Support below).

### CDN Usage

```html
<script src="https://unpkg.com/ignite-parleyjs/dist/index.global.js"></script>
<script>
    const parley = Parley.create({
        targetType: 'iframe', // or 'window'
        /* other options */
    });
</script>
```

## Quick Start

### Parent Window

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

// Create instance
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    timeout: 5000,
});

// Register message handler using on()
parley.on<{ user: string }>('hello', (payload, respond, metadata) => {
    console.log(`Hello from ${payload.user}!`);
    respond({ greeting: `Welcome, ${payload.user}!` });
});

// Connect to an iframe
const iframe = document.querySelector<HTMLIFrameElement>('#child-iframe');
await parley.connect(iframe, 'child');

// Send a message and wait for response
const response = await parley.send<{ data: number[] }, { result: number }>(
    'calculate',
    { data: [1, 2, 3, 4, 5] },
    { targetId: 'child' }
);

console.log('Sum:', response?.result);
```

### Child Window (Iframe)

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

// Create instance
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://parent.example.com'],
});

// Register handler using on()
parley.on<{ data: number[] }>('calculate', (payload, respond) => {
    const sum = payload.data.reduce((a, b) => a + b, 0);
    respond({ result: sum });
});

// Connect to parent
await parley.connect(window.parent, 'parent');

// Listen for connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
});
```

## Core Concepts

### Message Types

Register message handlers with `on()`, optionally with schema validation via
`register()`:

```typescript
// Simple handler using on()
parley.on<InputType>('message-type', (payload, respond, metadata) => {
    // Process message
    respond(result);
});

// With JSON Schema validation (register type first, then add handler)
parley.register('validated-message', {
    schema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            age: { type: 'number', minimum: 0 },
        },
        required: ['name'],
    },
});
parley.on('validated-message', (payload, respond) => {
    // Handler for validated message
    respond({ success: true });
});
```

### Connection Types

Each Parley instance handles one `targetType`. Both sides call `connect()`; the
iframe or popup side re-sends the handshake until the other side answers, so no
`load` listeners or delays are needed. To talk to iframes and popups from the
same page, create one instance per target type.

```typescript
// targetType: 'iframe'
// Parent page: pass the iframe element (not iframe.contentWindow)
const iframeParley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});
const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
await iframeParley.connect(iframe, 'iframe-id');

// Inside the iframe (its own 'iframe' instance): connect to the parent
await parley.connect(window.parent, 'parent-id');

// targetType: 'window'
// Opener page: connect to the popup
const windowParley = Parley.create({
    targetType: 'window',
    allowedOrigins: ['https://example.com'],
});
const popup = window.open('https://example.com/popup', '_blank');
await windowParley.connect(popup!, 'popup-id');

// Inside the popup (its own 'window' instance): connect to the opener
await parley.connect(window.opener, 'opener-id');
```

### Fire-and-Forget vs Request/Response

```typescript
// Fire-and-forget (no response expected)
await parley.send(
    'notification',
    { message: 'Hello!' },
    {
        targetId: 'child',
        expectsResponse: false,
    }
);

// Request/Response (default)
const response = await parley.send<RequestType, ResponseType>(
    'query',
    payload,
    { targetId: 'child' }
);
```

### Broadcasting

```typescript
// Send to all connected targets (fire-and-forget: returns void, no responses)
parley.broadcast('update', { timestamp: Date.now() });
```

---

## Documentation

**[Complete Documentation Hub](https://www.parleyjs.com/docs/)** - Start here
for organized access to all documentation

### Quick Start

New to ParleyJS? Start here:

- **[Getting Started](https://www.parleyjs.com/docs/getting-started/)** -
  Installation, first example, and core concepts
- **[Framework Reference](https://www.parleyjs.com/docs/FRAMEWORK_REFERENCE)** -
  Quick reference guide with common patterns
- **[Examples](https://www.parleyjs.com/docs/examples/)** - Real-world code
  examples to learn from

### How-To Guides

Choose the guide that matches your scenario:

- **[iFrame Communication](https://www.parleyjs.com/docs/guides/iframe-communication)** -
  Embedding and communicating with iframes
- **[Popup Window Communication](https://www.parleyjs.com/docs/guides/popup-communication)** -
  Parent and popup window patterns
- **[Multi-Window Communication](https://www.parleyjs.com/docs/guides/multi-window-communication)** -
  Coordinating multiple windows
- **[All Guides](https://www.parleyjs.com/docs/guides/)** - Complete list of
  implementation guides

### Reference Documentation

- **[API Reference](https://www.parleyjs.com/docs/api-reference/)** - Complete
  API documentation with methods, types, and error codes
- **[Code Patterns](https://www.parleyjs.com/docs/patterns/)** - Reusable
  patterns for request-response, error handling, and state sync
- **[Security Guide](https://www.parleyjs.com/docs/security/)** - Security best
  practices and origin validation
- **[Performance](https://www.parleyjs.com/docs/performance/)** - Optimization
  techniques and profiling

### Advanced Topics

- **[Architecture](https://www.parleyjs.com/docs/ARCHITECTURE)** - Internal
  design and architecture
- **[Testing Guide](https://www.parleyjs.com/docs/TESTING)** - Comprehensive
  testing documentation
- **[Testing Patterns](https://www.parleyjs.com/docs/TESTING_PATTERNS)** -
  Testing strategies and patterns

### Help & Resources

- **[Troubleshooting](https://www.parleyjs.com/docs/troubleshooting/)** - Common
  issues and debugging strategies
- **[Contributing](./CONTRIBUTING.md)** - How to contribute to ParleyJS
- **[Changelog](./CHANGELOG.md)** - Version history and changes

---

### System Events

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

// Connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) =>
    console.log('Connected:', event.targetId)
);
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) =>
    console.log('Disconnected:', event.targetId)
);
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) =>
    // reason: 'heartbeat_timeout' | 'max_failures_reached' | 'connection_lost' | 'cleanup'
    console.log('Connection lost:', event.targetId, event.reason)
);

// Handshake events (emitted since 1.1.0)
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_START, (event) =>
    console.log('Handshake started:', event.targetId)
);
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_COMPLETE, (event) =>
    console.log('Handshake complete:', event.targetId)
);
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_FAILED, (event) =>
    console.log('Handshake failed:', event.targetId, event.error?.code)
);

// Message events
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) =>
    console.log('Sent:', event.messageType)
);
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) =>
    console.log('Received:', event.messageType)
);

// Error events
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) =>
    console.log('Timeout:', event.messageId)
);
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) =>
    console.log('Error:', event.code, event.message)
);
```

There is no automatic reconnection. To reconnect, listen for
`SYSTEM_EVENTS.CONNECTION_LOST` or `SYSTEM_EVENTS.DISCONNECTED` and call
`connect()` again in your application code.

## Configuration

```typescript
import { Parley, DefaultSecurityLayer } from 'ignite-parleyjs';

const parley = Parley.create({
    // Required: 'iframe' | 'window' (one target type per instance)
    targetType: 'iframe',

    // Security
    // Exact origins, no wildcards, '*' or 'null' (default: [window.location.origin])
    allowedOrigins: ['https://trusted.com'],
    // Custom SecurityLayer subclass (default: new DefaultSecurityLayer())
    securityLayer: new DefaultSecurityLayer(),
    // Send remote handler error messages to the sender (default: false, 1.1.0)
    exposeHandlerErrors: false,
    // Opt-in limit for outgoing send() calls, per target (1.1.0)
    rateLimit: { enabled: false, messagesPerSecond: 100 },

    // Timeouts & Retries
    timeout: 5000, // Handshake and request timeout in ms (default: 5000)
    retries: 2, // Re-sends after each timeout, no backoff (default: 0)

    // Heartbeat (connection-loss detection, enabled by default)
    heartbeat: {
        enabled: true,
        interval: 5000, // Ping interval in ms (default: 5000)
        timeout: 2000, // Ping response timeout in ms (default: 2000)
        maxMissed: 3, // Missed pings before connection loss (default: 3)
        maxFailures: 3, // Consecutive timed-out targeted requests (default: 3, 1.1.0)
    },

    // Logging & Analytics
    logLevel: 'debug', // 'debug' | 'info' | 'warn' | 'error' | 'none' (default: 'none')
    analyticsEnabled: false, // Emit onAnalyticsEvent() events (default: false)

    // Advanced
    instanceId: 'my-instance', // Custom instance ID (default: generated)
});
```

## Error Handling

```typescript
import {
    TimeoutError,
    ValidationError,
    SerializationError,
    isParleyError,
} from 'ignite-parleyjs';

try {
    await parley.send('message', payload, { targetId: 'child' });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.log('Request timed out');
    } else if (error instanceof ValidationError) {
        console.log('Invalid message:', error.validationErrors);
    } else if (error instanceof SerializationError) {
        // e.g. a circular reference in the payload
        console.log('Payload cannot be serialized:', error.message);
    } else if (isParleyError(error) && error.code === 'ERR_HANDLER_ERROR') {
        // The remote handler threw. The message is 'Handler error' unless
        // the receiver set exposeHandlerErrors: true.
        console.log('Remote handler failed:', error.message);
    } else if (isParleyError(error) && error.code === 'ERR_NO_HANDLER') {
        console.log('No handler for this message type on the other side');
    }
}
```

## Analytics & Debugging

```typescript
// Analytics events are only emitted when analyticsEnabled is true
const parley = Parley.create({ targetType: 'iframe', analyticsEnabled: true });

parley.onAnalyticsEvent((event) => {
    // Send to your analytics service
    analytics.track(event.type, {
        messageType: event.messageType,
        duration: event.duration, // response_received only
        targetId: event.targetId,
    });
});

// Event types:
// - message_sent
// - message_received
// - response_sent
// - response_received
// - error
// - timeout
```

## Browser Support

| Browser | Version |
| ------- | ------- |
| Chrome  | 80+     |
| Firefox | 80+     |
| Safari  | 13.1+   |
| Edge    | 80+     |

## Testing

Parley-js ships with 800+ tests across unit, integration, and security suites.
Coverage thresholds are enforced in CI.

### Run Tests

```bash
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Open Vitest UI
npm run test:watch       # Watch mode
npm run test:e2e         # Build, then run Playwright end-to-end tests
npm run bench            # Run performance benchmarks
```

### Test Structure

- **Unit Tests** (`tests/unit/`) - Test individual components in isolation
- **Integration Tests** (`tests/integration/`) - Test end-to-end communication
  flows
- **Security Tests** (`tests/security/`) - Validate security mechanisms and
  attack prevention

See [Testing Guide](https://www.parleyjs.com/docs/TESTING) for comprehensive
testing documentation.

### Coverage Requirements

Coverage thresholds are defined in `vitest.config.ts` and enforced by CI.
Contributions must not reduce coverage below those thresholds; raising them over
time is encouraged.

## Security

Parley-js implements **security-first design** for cross-window communication:

- **Origin Validation** - Exact-match origin allowlist (no wildcards);
  `metadata.origin` is the browser-verified origin of each message
- **Source-Bound Connections** - Each connection only accepts messages from its
  own target window
- **Payload Sanitization** - Payloads are JSON-cloned (functions and other
  non-JSON values are dropped); circular payloads are rejected with a
  `SerializationError`. This does not escape HTML, so render received strings
  with `textContent`, not `innerHTML`
- **Limits** - 10 MB serialized payload cap, schema depth limit of 50, opt-in
  rate limiting for outgoing `send()` calls
- **Message Validation** - Protocol structure and version checks, optional JSON
  Schema validation per message type
- **Error Safety** - Remote handler error details are hidden by default
  (`exposeHandlerErrors: false`)

See [Security Guide](https://www.parleyjs.com/docs/security/) for detailed
security guidelines and best practices.

## Development

### Setup

```bash
npm install
```

### Format Code

```bash
npm run format
```

### Type Check

```bash
npm run typecheck
```

### Build

```bash
npm run build        # Production build
npm run build:dev    # Development build with source maps
npm run dev          # Watch mode
```

## License

MIT © 2025 Ignite Works, LLC

---

<div align="center">

**Made with care for the JavaScript community**

<a href="https://github.com/WebDev-Guy/parley-js/issues" target="_blank">Report
Bug</a> •
<a href="https://github.com/WebDev-Guy/parley-js/issues" target="_blank">Request
Feature</a>

</div>
