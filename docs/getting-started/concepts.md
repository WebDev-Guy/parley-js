[Home](../../index.md) > [Getting Started](./index.md) > Core Concepts

# Core Concepts

Understand the fundamental concepts behind ParleyJS and cross-window
communication.

## Table of Contents

1. [What is postMessage?](#what-is-postmessage)
2. [What ParleyJS Adds](#what-parleyjs-adds)
3. [Channels](#channels)
4. [Messages](#messages)
5. [Origin Validation](#origin-validation)
6. [Request-Response Pattern](#request-response-pattern)
7. [System Events](#system-events)
8. [Key Terminology](#key-terminology)

---

## What is postMessage?

The `postMessage` API is the browser's built-in method for secure cross-window
communication. It allows different browsing contexts (windows, iframes, tabs) to
exchange messages even across different origins.

```javascript
// Native postMessage usage
iframe.contentWindow.postMessage(
    { type: 'hello', data: 'world' },
    'https://target-origin.com'
);
```

While powerful, the native API requires manual handling of message IDs, origin
validation, timeout management, and error handling. This leads to repetitive
boilerplate code in every project.

---

## What ParleyJS Adds

ParleyJS wraps `postMessage` with a robust framework that handles common
challenges automatically:

- **Automatic origin validation** - Messages from unauthorized origins are
  rejected
- **Request-response pattern** - Built-in support for awaiting responses with
  timeouts
- **Type safety** - Full TypeScript support with generic message types
- **Message handlers** - Register named handlers instead of parsing raw messages
- **Schema validation** - Optional JSON Schema validation for message payloads
- **Connection management** - Track connection state and handle disconnections
- **Heartbeat monitoring** - Detect when connections are lost
- **Broadcasting** - Send messages to multiple targets simultaneously

You focus on your application logic while ParleyJS handles the communication
infrastructure.

---

## Channels

A channel represents a bidirectional communication link between two windows.

### Creating a Channel

```javascript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://trusted-domain.com'],
    timeout: 5000,
});
```

### Connecting to a Target

```javascript
// Connect to an iframe
const iframe = document.querySelector('#my-iframe');
await parley.connect(iframe.contentWindow, 'child-frame');

// Connect to a popup
const popup = window.open('/popup.html');
await parley.connect(popup, 'popup-window');

// Connect to parent (from within iframe)
await parley.connect(window.parent, 'parent-window');
```

Each connection is identified by a unique `targetId` that you provide. Use this
ID when sending messages to specific targets.

For detailed connection examples, see
[iFrame Communication Guide](../guides/iframe-communication.md) and
[Popup Communication Guide](../guides/popup-communication.md).

---

## Messages

Messages are the data you send between windows. ParleyJS uses named message
types with typed payloads.

### Registering Message Handlers

```javascript
parley.on <
    PayloadType >
    ('message-type',
    (payload, respond, metadata) => {
        // Process the message
        console.log('Received:', payload);

        // Optionally send a response
        respond({ success: true });
    });
```

### Sending Messages

```javascript
// Request-response (waits for reply)
const response = await parley.send<RequestType, ResponseType>(
    'get-data',
    { id: 123 },
    { targetId: 'child-frame' }
);

// Fire-and-forget (no response expected)
await parley.send(
    'notification',
    { message: 'Update available' },
    { targetId: 'child-frame', expectsResponse: false }
);
```

The message type name (like `'get-data'`) is arbitrary. Choose names that
clearly describe the message purpose.

For message patterns and best practices, see
[Request-Response Pattern](../patterns/request-response.md).

---

## Origin Validation

Origin validation is your first line of defense against malicious messages.
ParleyJS validates that every message comes from an allowed origin.

### Configuring Allowed Origins

```javascript
const parley = Parley.create({
    allowedOrigins: ['https://trusted-domain.com', 'https://api.example.com'],
});
```

### Why Origin Validation Matters

Without origin validation, any website could send messages to your application
and potentially:

- Steal sensitive data by impersonating trusted sources
- Trigger unauthorized actions in your application
- Inject malicious content through message payloads

ParleyJS rejects messages from origins not in your `allowedOrigins` list. This
happens automatically before any of your handlers are called.

**Important**: Never use wildcard origins (`['*']`) in production. Always
specify exact origins including protocol and port.

For comprehensive security guidelines, see
[Origin Validation Guide](../security/origin-validation.md).

---

## Request-Response Pattern

ParleyJS supports bidirectional request-response communication, similar to HTTP
but for windows.

### How It Works

When you send a message with `send()`, ParleyJS:

1. Generates a unique message ID
2. Sends the message via postMessage
3. Creates a Promise that waits for the response
4. Times out if no response is received
5. Resolves the Promise when the response arrives

```javascript
// Sender
try {
    const response = await parley.send(
        'calculate',
        { numbers: [1, 2, 3] },
        { targetId: 'worker', timeout: 3000 }
    );
    console.log('Result:', response.sum);
} catch (error) {
    console.error('Request failed:', error);
}
```

```javascript
// Receiver
parley.on('calculate', (payload, respond) => {
    const sum = payload.numbers.reduce((a, b) => a + b, 0);
    respond({ sum });
});
```

The `respond()` function sends the response back to the original sender.
ParleyJS handles all the message ID tracking automatically.

For advanced patterns including retry logic and timeout handling, see
[Request-Response Pattern](../patterns/request-response.md).

---

## System Events

System events notify you about connection lifecycle and internal operations. Use
them for monitoring, logging, and analytics.

### Available System Events

```javascript
import { SYSTEM_EVENTS } from 'parley-js';

// Connection lifecycle
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected:', event.targetId, event.reason);
});

parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.log('Connection lost:', event.targetId);
});

// Message events
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.log('Sent message:', event.messageType);
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log('Received message:', event.messageType);
});

// Error events
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.log('Message timed out:', event.messageId);
});

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('Error:', event.message);
});
```

System events are prefixed with `system:` to avoid conflicts with your custom
message types.

For complete system event documentation, see
[System Events Reference](../api-reference/system-events.md).

---

## Key Terminology

Understanding these terms will help you work effectively with ParleyJS:

### Channel

A bidirectional communication link between two windows. Created with
`Parley.create()`.

### Target

The window, iframe, or popup you want to communicate with. Identified by a
unique `targetId`.

### Origin

The protocol, host, and port of a window's URL (e.g.,
`https://example.com:443`). Used for security validation.

### Message Type

A string identifier for a category of messages (e.g., `'get-user'`,
`'update-data'`). You define these names.

### Payload

The data object sent with a message. Must be JSON-serializable.

### Handler

A function that processes incoming messages of a specific type. Registered with
`parley.on()`.

### Request-Response

A messaging pattern where the sender waits for a reply from the receiver.

### Fire-and-Forget

A messaging pattern where the sender doesn't expect or wait for a response.

### Heartbeat

Periodic ping messages sent to verify a connection is still alive.

### Schema

A JSON Schema definition that validates message payload structure.

### System Event

Internal events emitted by ParleyJS for monitoring lifecycle and operations.

---

## Next Steps

Now that you understand the core concepts:

1. **[First Example](./first-example.md)** - Build a working example
2. **[API Reference](../api-reference/index.md)** - Explore all available
   methods
3. **[Code Patterns](../patterns/index.md)** - Learn proven messaging patterns
4. **[Security Guide](../security/index.md)** - Understand security best
   practices

For real-world examples, see [Code Examples](../EXAMPLES.md).

---

**Previous**: [Installation](./installation.md) **Next**:
[First Example](./first-example.md) **Back to**: [Getting Started](./index.md)
