[Home](./index.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Troubleshooting

# Troubleshooting Guide

Common issues, debugging strategies, and solutions for ParleyJS.

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Message Not Received](#message-not-received)
3. [Origin Validation Errors](#origin-validation-errors)
4. [Timeout Errors](#timeout-errors)
5. [Type Errors](#type-errors)
6. [Performance Issues](#performance-issues)
7. [Debugging Strategies](#debugging-strategies)
8. [Common Mistakes](#common-mistakes)

---

## Connection Issues

### Problem: Unable to connect to iframe/window

**Symptoms**:

- `connect()` rejects with `ERR_CONNECTION_HANDSHAKE_FAILED` after the timeout
- `connect()` rejects with `ERR_CONNECTION_FAILED`
- No handshake received

You do NOT need to wait for the iframe's `load` event or add a delay before
`connect()`. The connecting side (the page inside the iframe, or the popup)
re-sends its handshake until the other side acknowledges it. A `load` listener
attached after the iframe already loaded never fires and would prevent
connecting.

**Common Causes**:

1. **Wrong target or targetType**

```javascript
// Wrong - an iframe instance needs the iframe ELEMENT
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.com'],
});
await parley.connect(iframe.contentWindow, 'child'); // ERR_CONNECTION_FAILED

// Correct
await parley.connect(iframe, 'child');

// Popups need a separate instance with targetType: 'window'
const popupParley = Parley.create({
    targetType: 'window',
    allowedOrigins: ['https://popup.com'],
});
await popupParley.connect(popupWindow, 'popup');
```

2. **Both sides not calling connect()**

```javascript
// Both parent and child must call connect()

// Parent
await parley.connect(iframe, 'child');

// Child (in iframe)
await parley.connect(window.parent, 'parent');
```

3. **Wrong origin configured**

```javascript
// Check that origins match exactly
// Parent expects: https://child.example.com
// Child is actually: http://child.example.com (wrong protocol!)
```

4. **Page opened from `file://`**

`file://` pages have the `'null'` origin, which ParleyJS does not support. Serve
both pages over http(s), for example with a local dev server.

**Solution Checklist**:

- [ ] Both windows call `connect()`
- [ ] `targetType` matches the target (`'iframe'` + iframe element, `'window'` +
      popup / `window.opener`)
- [ ] Origins are configured correctly on both sides
- [ ] Pages are served over http(s)
- [ ] No CSP or security policy blocking the frame

---

## Message Not Received

### Problem: Handler not called when message is sent

**Symptoms**:

- No handler is invoked
- `send()` rejects with `ERR_NO_HANDLER` (the receiver has no handler for that
  type)
- Fire-and-forget `send()` or `broadcast()` completes with no feedback

**Common Causes**:

1. **Handler registered (on the receiving side) after the message arrived**

```javascript
// Wrong - child registers its handler too late
// child:
await childParley.connect(window.parent, 'parent');
// ...parent sends 'hello' now: parent's send() rejects with ERR_NO_HANDLER
childParley.on('hello', (payload) => console.log(payload));

// Correct - register handlers before connecting
childParley.on('hello', (payload, respond) => {
    console.log(payload);
    respond({ ok: true });
});
await childParley.connect(window.parent, 'parent');
```

2. **Wrong message type**

```javascript
// Sender
await parley.send('user-login', data, { targetId: 'child' });

// Receiver - typo!
parley.on('userLogin', (data) => {}); // Wrong type!

// Should be:
parley.on('user-login', (data) => {}); // Matches sender
```

3. **Origin mismatch (silently rejected)**

```javascript
// Parent configured origin
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});

// But child is running on http://child.example.com
// Messages silently rejected due to origin mismatch
```

**Solution Checklist**:

- [ ] Handler registered before messages are sent
- [ ] Message type strings match exactly (case-sensitive)
- [ ] Origins configured correctly on both sides
- [ ] Both sides have called `connect()`

**Debugging**:

```javascript
// Enable debug logging to see messages and blocked origins
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.com'],
    logLevel: 'debug', // Logs messages, rejections and errors
});

// Listen for system events
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log('Received:', event);
});
```

---

## Origin Validation Errors

### Problem: Messages from the other window are rejected

**Symptoms**:

- Messages silently dropped (the channel drops messages from origins not in
  `allowedOrigins`; with `logLevel: 'warn'` or `'debug'` you see "Message from
  disallowed origin blocked")
- `connect()` rejects with `ERR_CONNECTION_HANDSHAKE_FAILED`
- `system:error` with `ERR_SECURITY_ORIGIN_MISMATCH` (only when a custom
  `SecurityLayer.validateOrigin()` rejects a message)

**Common Causes**:

1. **Port mismatch**

```javascript
// Parent expects
allowedOrigins: ['http://localhost'];

// But child is on
('http://localhost:3000'); // Non-default port is part of the origin

// Solution: include non-default ports (default ports 80/443 may be omitted)
allowedOrigins: ['http://localhost:3000']; // Correct
```

2. **Protocol mismatch**

```javascript
// Wrong
allowedOrigins: ['http://child.com']; // HTTP

// Child is actually running on
('https://child.com'); // HTTPS

// Solution: Match protocol exactly
allowedOrigins: ['https://child.com'];
```

3. **Subdomain mismatch**

```javascript
// Parent expects
allowedOrigins: ['https://child.example.com'];

// But child is on
('https://www.child.example.com'); // Different subdomain!

// Solution: List every origin (entries containing '*' are rejected)
allowedOrigins: ['https://child.example.com', 'https://www.child.example.com'];
```

4. **Development vs Production**

```javascript
// Development
allowedOrigins: ['http://localhost:3000'];

// Production
allowedOrigins: ['https://app.example.com'];

// Solution: Use environment variables
allowedOrigins: [process.env.ALLOWED_ORIGIN];
```

**Solution**:

```javascript
// Log the actual origin to debug
window.addEventListener('message', (event) => {
    console.log('Message from origin:', event.origin);
});

// Then configure ParleyJS with the exact origin
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://exact-origin.com'], // Use exact origin from log
});
```

---

## Timeout Errors

### Problem: TimeoutError - Request timed out

**Symptoms**:

- `TimeoutError` (`ERR_TIMEOUT_NO_RESPONSE`) thrown
- Long wait before error (the full `timeout` for every attempt, including
  `retries`)

**Common Causes**:

1. **Handler never responds**

```javascript
// Wrong - handler doesn't call respond()
parley.on('get-data', (payload, respond) => {
    const data = fetchData(payload.id);
    // Forgot to call respond()!
});

// Correct - always respond
parley.on('get-data', async (payload, respond) => {
    const data = await fetchData(payload.id);
    respond({ data }); // Always respond!
});
```

2. **Not a timeout: handler throws error**

```javascript
// If the handler throws, ParleyJS sends an error response automatically.
// The sender's send() rejects with ERR_HANDLER_ERROR and the generic
// message 'Handler error' (the real message only if the receiver was
// created with exposeHandlerErrors: true).
parley.on('get-data', async (payload, respond) => {
    throw new Error('Something went wrong'); // Sender gets ERR_HANDLER_ERROR
});

// To return a structured error instead, catch and respond
parley.on('get-data', async (payload, respond) => {
    try {
        const data = await fetchData(payload.id);
        respond({ success: true, data });
    } catch (error) {
        respond({ success: false, error: error.message });
    }
});
```

3. **Timeout too short**

```javascript
// Wrong - slow operation with short timeout
await parley.send(
    'slow-query',
    {},
    {
        targetId: 'child',
        timeout: 1000, // Only 1 second!
    }
);

// Correct - increase timeout for slow operations
await parley.send(
    'slow-query',
    {},
    {
        targetId: 'child',
        timeout: 30000, // 30 seconds
    }
);
```

**Solution Checklist**:

- [ ] Handler always calls `respond()` (return values are ignored)
- [ ] Timeout is long enough for operation (or use `retries`)
- [ ] The message reaches the receiver (origins, both sides connected)

A missing handler does not time out either: `send()` rejects with
`ERR_NO_HANDLER`.

---

## Type Errors

### Problem: TypeScript type errors or runtime type mismatches

**Common Causes**:

1. **Missing generic types**

```typescript
// Wrong - no type safety
const response = await parley.send('get-user', { id: 123 });
console.log(response.name); // No type checking!

// Correct - specify types
interface GetUserRequest {
    id: number;
}

interface GetUserResponse {
    name: string;
    email: string;
}

const response = await parley.send<GetUserRequest, GetUserResponse>(
    'get-user',
    { id: 123 },
    { targetId: 'child' }
);
console.log(response.name); // Type-safe!
```

2. **Handler type mismatch**

```typescript
// Wrong - handler expects different type
parley.on<{ userId: string }>('get-user', (payload) => {
    const id: number = payload.userId; // Type error!
});

// Correct - handler matches request type
parley.on<GetUserRequest>('get-user', (payload) => {
    const id: number = payload.id; // Type-safe!
});
```

**Solution**: Always specify generic types for type safety.

---

## Performance Issues

### Problem: Slow message delivery or high latency

**Common Causes**:

1. **Large payloads**

```javascript
// Wrong - sending huge object (over 10 MB serialized is rejected)
await parley.send('update', {
    data: hugeArray, // Several MB of data!
    timestamp: Date.now(),
});

// Correct - send smaller chunks or reference
await parley.send('update', {
    dataId: 'ref-123', // Just send reference
    timestamp: Date.now(),
});
```

2. **Too many messages**

```javascript
// Wrong - sending in tight loop
for (let i = 0; i < 1000; i++) {
    await parley.send('update', { index: i }); // Too many!
}

// Correct - batch messages
const batch = [];
for (let i = 0; i < 1000; i++) {
    batch.push({ index: i });
}
await parley.send('batch-update', { items: batch });
```

3. **Synchronous blocking operations**

```javascript
// Wrong - blocking operation in handler
parley.on('process', (payload, respond) => {
    const result = expensiveSyncOperation(); // Blocks!
    respond({ result });
});

// Correct - use async operations
parley.on('process', async (payload, respond) => {
    const result = await expensiveAsyncOperation();
    respond({ result });
});
```

**Solutions**:

- Keep payloads small (< 1MB)
- Batch messages when sending multiple items
- Use async/await for slow operations
- Consider debouncing frequent updates

For more details, see
[Performance Best Practices](./ARCHITECTURE.md#performance-considerations). For
batching messages in request-response pattern, see
[Batch Request-Response](./patterns/request-response.md#variation-3-batch-request-response).

---

## Debugging Strategies

### Enable Debug Logging

```javascript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.com'],
    logLevel: 'debug', // Logs messages, rejections and errors
});
```

### Monitor System Events

```javascript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

// Connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from:', event.targetId, event.reason);
});

// Message events
// (system events do not include payloads)
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.log('Sent message:', event.messageType, event.messageId);
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log('Received message:', event.messageType, 'from', event.origin);
});

// Error events
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.log('Timeout:', event.messageType, event.timeoutMs);
});

// Local handler errors and rejected inbound messages
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('Error:', event.code, event.message);
});

// Handshake progress (1.1.0)
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_FAILED, (event) => {
    console.error('Handshake failed:', event.targetId, event.error);
});
```

### Check Message Flow

```javascript
// Log all incoming postMessages (before ParleyJS processes them)
window.addEventListener('message', (event) => {
    console.log('Raw postMessage received:', {
        origin: event.origin,
        data: event.data,
        source: event.source,
    });
});
```

### Inspect ParleyJS State

```javascript
// Check if connected
console.log('Connected targets:', parley.getConnectedTargets());
console.log('Child connected:', parley.isConnected('child'));
console.log('Child state:', parley.getConnectionState('child'));
```

There is no API for listing registered handlers. A request whose type has no
handler on the receiving side rejects with `ERR_NO_HANDLER`.

---

## Common Mistakes

### Mistake: Using wildcard origin

```javascript
// REJECTED - throws Error('Configuration error: ...')
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['*'],
});
```

**Why it's wrong**: Accepting any origin would let any site send messages, so
`Parley.create()` rejects any entry containing `'*'` (including patterns such as
`'*.example.com'`), as well as `'null'`, empty strings, and an empty list.

**Correct approach**: Always specify exact origins

```javascript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted-domain.com'],
});
```

### Mistake: Not waiting for connection

```javascript
// Wrong - send before connected
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.com'],
});
parley.connect(iframe, 'child'); // No await!
await parley.send('hello', {}, { targetId: 'child' }); // ERR_TARGET_NOT_CONNECTED

// Correct - wait for connection
await parley.connect(iframe, 'child');
await parley.send('hello', {}, { targetId: 'child' });
```

### Mistake: Forgetting to call respond()

```javascript
// Wrong - handler doesn't respond
parley.on('get-data', (payload) => {
    const data = fetchData();
    // No respond() call - causes timeout!
});

// Correct
parley.on('get-data', (payload, respond) => {
    const data = fetchData();
    respond({ data });
});
```

### Mistake: Sending non-serializable data

```javascript
// Wrong - functions are silently dropped by the JSON clone
await parley.send('update', {
    callback: () => console.log('done'), // Arrives as missing
});

// Wrong - circular references make send() reject with a SerializationError
// (ERR_SERIALIZATION_CIRCULAR_REFERENCE)
const node = { name: 'a' };
node.self = node;
await parley.send('update', node);

// Wrong - File, Blob, ArrayBuffer, Map and Set arrive as {}

// Correct - only send plain data
await parley.send('update', {
    message: 'Update complete',
});
```

### Mistake: Not cleaning up

```javascript
// Wrong - memory leak
function setupParley() {
    const parley = Parley.create({
        targetType: 'iframe',
        allowedOrigins: ['https://child.com'],
    });
    parley.on('message', handleMessage);
    // Never cleaned up!
}

// Correct - clean up when done
function setupParley() {
    const parley = Parley.create({
        targetType: 'iframe',
        allowedOrigins: ['https://child.com'],
    });
    parley.on('message', handleMessage);

    // Cleanup function
    return () => {
        parley.destroy(); // Remove listeners and cleanup
    };
}

const cleanup = setupParley();
// Later...
cleanup();
```

---

## Still Having Issues?

If you're still experiencing problems:

1. **Check the examples**: See the `examples/` folder in the repository and
   [Examples](./EXAMPLES.md) for working code
2. **Review the API docs**: See [API Reference](./API.md) for complete
   documentation
3. **Search existing issues**: Check
   [GitHub Issues](https://github.com/WebDev-Guy/parley-js/issues)
4. **Ask for help**: Open a new issue with:
    - ParleyJS version
    - Browser and version
    - Minimal reproduction code
    - Error messages
    - Debug logs (with `logLevel: 'debug'`)

---

## Navigation

### Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Security Guide](./SECURITY.md) - Security best practices
- [Examples](./EXAMPLES.md) - Working code examples

### See Also

- [Code Patterns](./CODE_PATTERNS.md) - Recommended patterns
- [Testing Patterns](./TESTING_PATTERNS.md) - How to test
- [GitHub Issues](https://github.com/WebDev-Guy/parley-js/issues) - Report bugs

**Back to**: [Documentation Home](./index.md)
