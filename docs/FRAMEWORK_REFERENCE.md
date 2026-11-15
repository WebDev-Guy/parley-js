[Home](./index.md) > [Documentation](./index.md) > Framework Reference

# ParleyJS Framework Reference

Quick reference guide for ParleyJS. For complete details, see
[API.md](./API.md).

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick Start](#quick-start)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)
5. [Security](#security)

## Core Concepts

### What is ParleyJS?

ParleyJS simplifies `window.postMessage()` communication between:

- Parent and child windows (popups)
- Parent and iframes
- Multiple window contexts (one connection per iframe or popup)

Web Workers, Service Workers and `MessageChannel` ports are not supported.

It provides:

- Type-safe message handling
- Automatic origin validation
- Promise-based request-response patterns
- Error recovery and timeout handling
- Message routing

### Key Terminology

**Channel**: Bidirectional communication endpoint **Message Handler**: Function
that receives and processes messages **Origin**: The scheme + host + port of a
window (e.g., 'https://example.com') **Request-Response**: Pattern where you
send a message and wait for a reply

## Quick Start

### Creating a Connection

Both sides create an instance with the same `targetType` and call `connect()`.
No `load` listeners or delays are needed.

**Parent Window:**

```javascript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});

// Connect to iframe
const iframe = document.querySelector('#child-iframe');
await parley.connect(iframe, 'child');
```

**Child Window (Iframe):**

```javascript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://parent.example.com'],
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

### Sending Messages

**Fire-and-forget:**

```javascript
await parley.send(
    'notification',
    { message: 'Hello!' },
    {
        targetId: 'child',
        expectsResponse: false,
    }
);
```

**Request-Response:**

```javascript
const response = await parley.send(
    'get-data',
    { id: 123 },
    {
        targetId: 'child',
    }
);
console.log(response);
```

### Receiving Messages

**Register a handler:**

```typescript
parley.on<{ message: string }>('notification', (payload, respond) => {
    console.log(payload.message);
    // Optionally respond
    respond({ received: true });
});
```

Handlers reply by calling `respond(value)`; a handler's return value is ignored.
To validate payloads, register the type with a schema:
`parley.register('notification', { schema })`.

## Common Patterns

### Pattern: Request-Response

```javascript
// Sender
const result = await parley.send(
    'calculate',
    { a: 5, b: 3 },
    {
        targetId: 'child',
    }
);

// Receiver
parley.on('calculate', (payload, respond) => {
    respond({ result: payload.a + payload.b });
});
```

### Pattern: Event Notification

```javascript
// Sender
await parley.send(
    'user-action',
    { action: 'click' },
    {
        targetId: 'child',
        expectsResponse: false,
    }
);

// Receiver
parley.on('user-action', (payload) => {
    console.log('User action:', payload.action);
});
```

### Pattern: Broadcasting

```javascript
// Send to all connected targets (returns void, no responses)
parley.broadcast('config-update', {
    theme: 'dark',
    language: 'en',
});
```

## Error Handling

### Try-Catch Pattern

```javascript
import {
    TimeoutError,
    TargetNotFoundError,
    ValidationError,
    isParleyError,
} from 'ignite-parleyjs';

try {
    const response = await parley.send('risky-operation', data, {
        targetId: 'child',
        timeout: 5000,
    });
} catch (error) {
    if (error instanceof TimeoutError) {
        // No response in time (also what you see if the other side
        // silently dropped the message, e.g. origin not allowed)
        console.log('Request timed out');
    } else if (error instanceof TargetNotFoundError) {
        console.log('Target not connected');
    } else if (error instanceof ValidationError) {
        console.log('Payload failed local schema validation');
    } else if (isParleyError(error) && error.code === 'ERR_HANDLER_ERROR') {
        console.log('Remote handler threw');
    }
}
```

Origin rejections on the receiving side are never reported back to the sender:
messages from disallowed origins are dropped silently, so a `send()` to such a
peer times out (and in practice `connect()` already fails with
`ERR_CONNECTION_HANDSHAKE_FAILED`).

### Common Error Types

- **TimeoutError**: No response within the timeout (after all retries)
- **TargetNotFoundError**: Target not connected (`ERR_TARGET_NOT_CONNECTED`)
- **ValidationError**: Payload failed local schema validation or exceeds 10 MB
- **ConnectionError**: Handshake failed, or target disconnected while waiting
- **SerializationError**: Payload has circular references or BigInt values
- **ParleyError** with a remote code: `ERR_HANDLER_ERROR`, `ERR_NO_HANDLER`,
  `ERR_VALIDATION_SCHEMA_MISMATCH`

## Security

### Origin Validation (CRITICAL)

Always specify exact origins. Wildcards are not supported.

**Correct:**

```javascript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted-domain.com'],
});
```

**Rejected:**

```javascript
// Throws at create(): 'Configuration error: ...'
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['*'], // '*', 'null' and [] are rejected
});

// Also rejected: there is no pattern matching
allowedOrigins: ['https://*.trusted-domain.com'];
```

### Message Validation

Always validate incoming data:

```javascript
parley.on('user-data', (payload, respond) => {
    // Validate structure
    if (!payload.id || typeof payload.id !== 'string') {
        respond({ success: false, error: 'Invalid data structure' });
        return;
    }

    // Validate content
    if (payload.id.length > 100) {
        respond({ success: false, error: 'ID too long' });
        return;
    }

    // Safe to process
    processUser(payload);
    respond({ success: true });
});
```

If a handler throws instead, the sender's `send()` rejects with a `ParleyError`
(`ERR_HANDLER_ERROR`) whose message is `'Handler error'` unless the receiving
instance sets `exposeHandlerErrors: true`; the full error is emitted locally as
`system:error`.

### What NOT to Send

Never send through postMessage:

- Passwords or secrets
- API keys or tokens
- Personal identifying information (PII)
- Functions or code
- Circular references

## Configuration Options

```javascript
Parley.create({
    // Required
    targetType: 'iframe', // 'iframe' | 'window'

    // Security
    allowedOrigins: ['https://trusted.com'], // default [window.location.origin]
    securityLayer: new DefaultSecurityLayer(), // custom SecurityLayer (optional)
    exposeHandlerErrors: false, // send real handler error messages to the sender
    rateLimit: { enabled: false, messagesPerSecond: 100 }, // outgoing send() only

    // Timeouts
    timeout: 5000, // Handshake and request timeout in ms
    retries: 0, // Number of retries (same message re-sent, no backoff)

    // Connection health
    heartbeat: {
        enabled: true,
        interval: 5000,
        timeout: 2000,
        maxMissed: 3,
        maxFailures: 3,
    },

    // Debugging / analytics
    logLevel: 'none', // 'debug' | 'info' | 'warn' | 'error' | 'none'
    analyticsEnabled: false, // required for onAnalyticsEvent()

    // Advanced
    instanceId: 'my-instance', // Custom instance ID
});
```

## System Events

Monitor connection and message events:

```javascript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

// Connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected:', event.targetId);
});

// Message events
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.log('Sent:', event.messageType);
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log('Received:', event.messageType);
});

// Error events
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.log('Timeout:', event.messageId);
});

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.log('Error:', event.code, event.message);
});
```

## Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Code Patterns](./CODE_PATTERNS.md) - Common coding patterns
- [Testing Patterns](./TESTING_PATTERNS.md) - Testing strategies
- [Security Guide](./SECURITY.md) - Security best practices
- [Examples](./EXAMPLES.md) - Usage examples

---

### Navigation

**See Also**:

- [Complete API Reference](./API.md)
- [Security Best Practices](./SECURITY.md)
- [Code Examples](./EXAMPLES.md)

**Back to**: [Documentation Home](./index.md)
