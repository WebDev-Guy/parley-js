# Parley-js

<div align="center">

![Parley-js Logo](https://img.shields.io/badge/Parley--js-postMessage%20Made%20Simple-blue)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)
[![Bundle Size](https://img.shields.io/badge/Bundle-~40KB-green)](https://bundlephobia.com/package/parley-js)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success)](https://www.npmjs.com/package/parley-js)

**Type-safe, robust framework for window, tab, and iframe communication**

[Getting Started](#getting-started) • [API Reference](./docs/API.md) •
[Examples](./docs/EXAMPLES.md) • [Security](./docs/SECURITY.md)

</div>

---

## Features

- 🔒 **Security-First Design** - Origin validation, message integrity,
  configurable security policies
- 📦 **Zero Runtime Dependencies** - Lightweight and minimal footprint
- 🎯 **Type-Safe** - Full TypeScript support with strict typing and generics
- 🔄 **Request/Response Pattern** - Built-in timeout handling, retries, and
  response correlation
- 📊 **Analytics Ready** - Hooks for monitoring, debugging, and performance
  tracking
- 🎨 **Framework Agnostic** - Works with React, Vue, Angular, or vanilla JS
- 🛡️ **Schema Validation** - Optional JSON Schema validation for message
  payloads
- 📡 **Multiple Targets** - Communicate with iframes, popups, and other windows

## Installation

```bash
npm install parley-js
```

```bash
yarn add parley-js
```

```bash
pnpm add parley-js
```

### CDN Usage

```html
<script src="https://unpkg.com/parley-js/dist/index.global.js"></script>
<script>
    const parley = Parley.create({
        /* options */
    });
</script>
```

## Quick Start

### Parent Window

```typescript
import { Parley } from 'parley-js';

// Create instance
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
    timeout: 5000,
});

// Register message handlers
parley.register<{ user: string }, { greeting: string }>(
    'hello',
    async (payload, metadata) => {
        console.log(`Hello from ${payload.user}!`);
        return { greeting: `Welcome, ${payload.user}!` };
    }
);

// Connect to an iframe
const iframe = document.querySelector<HTMLIFrameElement>('#child-iframe');
await parley.connectIframe('child', iframe, {
    origin: 'https://child.example.com',
});

// Send a message and wait for response
const response = await parley.send<{ data: number[] }, { result: number }>(
    'child',
    'calculate',
    {
        data: [1, 2, 3, 4, 5],
    }
);

console.log('Sum:', response.result);
```

### Child Window (Iframe)

```typescript
import { Parley } from 'parley-js';

// Create instance
const parley = Parley.create({
    allowedOrigins: ['https://parent.example.com'],
});

// Register handlers
parley.register<{ data: number[] }, { result: number }>(
    'calculate',
    (payload) => {
        const sum = payload.data.reduce((a, b) => a + b, 0);
        return { result: sum };
    }
);

// Connect to parent
await parley.connectParent('parent', {
    origin: 'https://parent.example.com',
});

// Listen for connection events
parley.onSystem('target:connected', (event) => {
    console.log('Connected to:', event.targetId);
});
```

## Core Concepts

### Message Types

Register typed message handlers with optional schema validation:

```typescript
// Simple handler
parley.register<InputType, OutputType>(
    'message-type',
    async (payload, metadata) => {
        // Process message
        return result;
    }
);

// With JSON Schema validation
parley.register('validated-message', handler, {
    requestSchema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            age: { type: 'number', minimum: 0 },
        },
        required: ['name'],
    },
});
```

### Connection Types

```typescript
// Connect to iframe
await parley.connectIframe('iframe-id', iframeElement, {
    origin: 'https://...',
});

// Connect to popup/new window
await parley.connectWindow('popup-id', windowRef, { origin: 'https://...' });

// Connect to parent (from iframe)
await parley.connectParent('parent-id', { origin: 'https://...' });
```

### Fire-and-Forget vs Request/Response

```typescript
// Fire-and-forget (no response expected)
await parley.send(
    'target',
    'notification',
    { message: 'Hello!' },
    {
        expectsResponse: false,
    }
);

// Request/Response (default)
const response = await parley.send<Request, Response>(
    'target',
    'query',
    payload
);
```

### Broadcasting

```typescript
// Send to all connected targets
await parley.broadcast('update', { timestamp: Date.now() });
```

### System Events

```typescript
// Connection events
parley.onSystem('target:connected', (event) =>
    console.log('Connected:', event.targetId)
);
parley.onSystem('target:disconnected', (event) =>
    console.log('Disconnected:', event.targetId)
);

// Message events
parley.onSystem('message:sent', (event) => console.log('Sent:', event.type));
parley.onSystem('message:received', (event) =>
    console.log('Received:', event.type)
);

// Error events
parley.onSystem('error:timeout', (event) =>
    console.log('Timeout:', event.messageId)
);
parley.onSystem('error:validation', (event) =>
    console.log('Invalid:', event.error)
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
    await parley.send('target', 'message', payload);
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

## Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [Architecture](./docs/ARCHITECTURE.md) - System design and internals
- [Security Guide](./docs/SECURITY.md) - Security best practices
- [Examples](./docs/EXAMPLES.md) - Code examples and patterns
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines
- [Roadmap](./docs/FUTURE-ROADMAP.md) - Future plans

## License

MIT © Drew

---

<div align="center">

**Made with ❤️ for the JavaScript community**

[Report Bug](https://github.com/WebDev-Guy/parley-js/issues) •
[Request Feature](https://github.com/WebDev-Guy/parley-js/issues)

</div>
