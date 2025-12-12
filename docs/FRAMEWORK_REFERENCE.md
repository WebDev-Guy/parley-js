[Home](../README.md) > [Documentation](./README.md) > Framework Reference

# ParleyJS Framework Reference

Quick reference guide for ParleyJS. For complete details, see [API.md](./API.md).

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
- Workers and main thread
- Multiple window contexts

It provides:
- Type-safe message handling
- Automatic origin validation
- Promise-based request-response patterns
- Error recovery and timeout handling
- Message routing

### Key Terminology

**Channel**: Bidirectional communication endpoint
**Message Handler**: Function that receives and processes messages
**Origin**: The scheme + host + port of a window (e.g., 'https://example.com')
**Request-Response**: Pattern where you send a message and wait for a reply

## Quick Start

### Creating a Connection

**Parent Window:**
```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
});

// Connect to iframe
const iframe = document.querySelector('#child-iframe');
await parley.connect(iframe, 'child');
```

**Child Window (Iframe):**
```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://parent.example.com'],
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

### Sending Messages

**Fire-and-forget:**
```typescript
await parley.send('notification', { message: 'Hello!' }, {
    targetId: 'child',
    expectsResponse: false
});
```

**Request-Response:**
```typescript
const response = await parley.send('get-data', { id: 123 }, {
    targetId: 'child'
});
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

## Common Patterns

### Pattern: Request-Response

```typescript
// Sender
const result = await parley.send('calculate', { a: 5, b: 3 }, {
    targetId: 'child'
});

// Receiver
parley.on('calculate', (payload, respond) => {
    respond({ result: payload.a + payload.b });
});
```

### Pattern: Event Notification

```typescript
// Sender
await parley.send('user-action', { action: 'click' }, {
    targetId: 'child',
    expectsResponse: false
});

// Receiver
parley.on('user-action', (payload) => {
    console.log('User action:', payload.action);
});
```

### Pattern: Broadcasting

```typescript
// Send to all connected targets
await parley.broadcast('config-update', {
    theme: 'dark',
    language: 'en'
});
```

## Error Handling

### Try-Catch Pattern

```typescript
try {
    const response = await parley.send('risky-operation', data, {
        targetId: 'child',
        timeout: 5000
    });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.log('Request timed out');
    } else if (error instanceof SecurityError) {
        console.log('Origin validation failed');
    } else if (error instanceof ValidationError) {
        console.log('Message validation failed');
    }
}
```

### Common Error Types

- **TimeoutError**: Request exceeded timeout period
- **SecurityError**: Origin validation failed
- **ValidationError**: Message schema validation failed
- **ConnectionError**: Unable to establish connection

## Security

### Origin Validation (CRITICAL)

Always specify exact origins. Never use wildcards in production.

**Correct:**
```typescript
const parley = Parley.create({
    allowedOrigins: ['https://trusted-domain.com'],
});
```

**Dangerous:**
```typescript
// WRONG - Don't do this!
const parley = Parley.create({
    allowedOrigins: ['*'],  // Accepts messages from ANY origin
});
```

### Message Validation

Always validate incoming data:

```typescript
parley.on('user-data', (payload, respond) => {
    // Validate structure
    if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('Invalid data structure');
    }

    // Validate content
    if (payload.id.length > 100) {
        throw new Error('ID too long');
    }

    // Safe to process
    processUser(payload);
});
```

### What NOT to Send

Never send through postMessage:
- Passwords or secrets
- API keys or tokens
- Personal identifying information (PII)
- Functions or code
- Circular references

## Configuration Options

```typescript
Parley.create({
    // Security (required)
    allowedOrigins: ['https://trusted.com'],

    // Timeouts
    timeout: 5000,              // Default timeout in ms
    retries: 2,                 // Number of retries

    // Debugging
    debug: true,                // Enable debug logging
    logLevel: 'debug',          // 'debug' | 'info' | 'warn' | 'error'

    // Advanced
    instanceId: 'my-instance',  // Custom instance ID
    validateMessages: true      // Enable schema validation
});
```

## System Events

Monitor connection and message events:

```typescript
import { SYSTEM_EVENTS } from 'parley-js';

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

**Back to**: [Documentation Home](../README.md)
