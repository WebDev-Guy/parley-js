# Parley-js

<div align="center">

![Parley-js Logo](https://img.shields.io/badge/Parley--js-postMessage%20Made%20Simple-blue)
[![Tests](https://github.com/WebDev-Guy/parley-js/actions/workflows/test.yml/badge.svg)](https://github.com/WebDev-Guy/parley-js/actions/workflows/test.yml)
<a href="https://www.typescriptlang.org/" target="_blank">![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)</a>
<a href="https://opensource.org/licenses/MIT" target="_blank">![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)</a>
<a href="https://prettier.io/" target="_blank">![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)</a>
<a href="https://bundlephobia.com/package/parley-js" target="_blank">![Bundle Size](https://img.shields.io/badge/Bundle-~54KB-green)</a>
<a href="https://www.npmjs.com/package/ignite-parleyjs" target="_blank">![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success)</a>

**Type-safe, robust framework for window, tab, and iframe communication**

[Quick Start](#quick-start) • [Documentation](https://www.parleyjs.com/docs/) •
[How-To Guides](https://www.parleyjs.com/docs/guides/) •
[API Reference](https://www.parleyjs.com/docs/api-reference/) •
[Examples](https://www.parleyjs.com/docs/examples/)

</div>

---

## Features

- **85%+ Test Coverage** - Comprehensive unit, integration, and security tests
- **Security-First Design** - Origin validation, payload sanitization, DoS
  prevention
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

### CDN Usage

```html
<script src="https://unpkg.com/ignite-parleyjs/dist/index.global.js"></script>
<script>
    const parley = Parley.create({
        /* options */
    });
</script>
```

## Quick Start

### Parent Window

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

// Create instance
const parley = Parley.create({
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

console.log('Sum:', response.result);
```

### Child Window (Iframe)

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

// Create instance
const parley = Parley.create({
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

```typescript
// Connect to iframe
const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
await parley.connect(iframe, 'iframe-id');

// Connect to popup/new window
const popup = window.open('https://example.com/popup', '_blank');
await parley.connect(popup, 'popup-id');

// Connect to parent (from iframe)
await parley.connect(window.parent, 'parent-id');
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
// Send to all connected targets
await parley.broadcast('update', { timestamp: Date.now() });
```

---

## Documentation

**[Complete Documentation Hub](https://www.parleyjs.com/docs/)** - Start here
for organized access to all documentation

### Quick Start

New to ParleyJS? Start here:

- **[Getting Started](https://www.parleyjs.com/docs/getting-started/)** -
  Installation, first example, and core concepts
- **[Framework Reference](https://www.parleyjs.com/docs/framework-reference)** -
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

- **[Architecture](https://www.parleyjs.com/docs/architecture)** - Internal
  design and architecture
- **[Testing Guide](https://www.parleyjs.com/docs/testing)** - Comprehensive
  testing documentation
- **[Testing Patterns](https://www.parleyjs.com/docs/testing-patterns)** -
  Testing strategies and patterns

### Help & Resources

- **[Troubleshooting](https://www.parleyjs.com/docs/troubleshooting/)** - Common
  issues and debugging strategies
- **[Contributing](./CONTRIBUTING.md)** - How to contribute to ParleyJS
- **[Changelog](./CHANGELOG.md)** - Version history and changes

---

### System Events

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

// Connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) =>
    console.log('Connected:', event.targetId)
);
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) =>
    console.log('Disconnected:', event.targetId)
);
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) =>
    console.log('Connection lost:', event.targetId, event.reason)
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
    console.log('Error:', event.message)
);
```

## Configuration

```typescript
const parley = Parley.create({
    // Security
    allowedOrigins: ['https://trusted.com'], // Required: list of allowed origins
    requireOriginMatch: true, // Enforce origin validation (default: true)

    // Timeouts & Retries
    timeout: 5000, // Default timeout in ms (default: 5000)
    retries: 2, // Number of retries (default: 0)

    // Debugging
    debug: true, // Enable debug logging (default: false)
    logLevel: 'debug', // 'debug' | 'info' | 'warn' | 'error'

    // Advanced
    instanceId: 'my-instance', // Custom instance ID
    validateMessages: true, // Enable schema validation (default: true)
});
```

## Error Handling

```typescript
import { TimeoutError, ValidationError, SecurityError } from 'parley-js';

try {
    await parley.send('message', payload, { targetId: 'child' });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.log('Request timed out');
    } else if (error instanceof ValidationError) {
        console.log('Invalid message:', error.details);
    } else if (error instanceof SecurityError) {
        console.log('Security violation:', error.message);
    }
}
```

## Analytics & Debugging

```typescript
// Register analytics handler
parley.onAnalytics((event) => {
    // Send to your analytics service
    analytics.track(event.type, {
        messageType: event.data.messageType,
        duration: event.data.duration,
        targetId: event.data.targetId,
    });
});

// Built-in event types:
// - message:sent
// - message:received
// - message:timeout
// - connection:established
// - connection:lost
// - error:occurred
```

## Browser Support

| Browser | Version |
| ------- | ------- |
| Chrome  | 80+     |
| Firefox | 80+     |
| Safari  | 13.1+   |
| Edge    | 80+     |

## Testing

Parley-js maintains **85%+ test coverage** across unit, integration, and
security tests.

### Run Tests

```bash
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Open Vitest UI
npm run test:watch       # Watch mode
```

### Test Structure

- **Unit Tests** (`tests/unit/`) - Test individual components in isolation
- **Integration Tests** (`tests/integration/`) - Test end-to-end communication
  flows
- **Security Tests** (`tests/security/`) - Validate security mechanisms and
  attack prevention

See [Testing Guide](https://www.parleyjs.com/docs/testing) for comprehensive
testing documentation.

### Coverage Requirements

- Overall: **85%+** code coverage
- Core modules: **90%+** coverage
- Security layer: **95%+** coverage

## Security

Parley-js implements **security-first design** for cross-window communication:

- **Origin Validation** - Strict origin whitelist enforcement with protocol
  matching
- **Payload Sanitization** - XSS/injection prevention, circular reference
  handling
- **DoS Prevention** - Size limits, rate limiting, deep nesting protection
- **Message Validation** - Protocol structure validation, required field
  enforcement
- **Error Safety** - No sensitive information disclosure in error messages

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
