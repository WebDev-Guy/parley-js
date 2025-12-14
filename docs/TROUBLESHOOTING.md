[Home](../README.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Troubleshooting

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
- `connect()` never resolves
- Connection timeout errors
- No handshake received

**Common Causes**:

1. **Window not ready yet**
```typescript
// Wrong - iframe might not be loaded
const parley = Parley.create({ allowedOrigins: ['https://child.com'] });
await parley.connect(iframe.contentWindow, 'child');

// Correct - wait for iframe to load
const iframe = document.querySelector('#child-iframe');
await new Promise(resolve => {
  if (iframe.contentDocument?.readyState === 'complete') {
    resolve();
  } else {
    iframe.addEventListener('load', resolve, { once: true });
  }
});

await parley.connect(iframe.contentWindow, 'child');
```

2. **Both sides not calling connect()**
```typescript
// Both parent and child must call connect()

// Parent
await parley.connect(iframe.contentWindow, 'child');

// Child (in iframe)
await parley.connect(window.parent, 'parent');
```

3. **Wrong origin configured**
```typescript
// Check that origins match exactly
// Parent expects: https://child.example.com
// Child is actually: http://child.example.com (wrong protocol!)
```

**Solution Checklist**:
- [ ] Both windows call `connect()`
- [ ] Wait for iframe/window to fully load before connecting
- [ ] Origins are configured correctly on both sides
- [ ] No CORS or security policy blocking communication

---

## Message Not Received

### Problem: Handler not called when message is sent

**Symptoms**:
- `send()` completes without error
- No handler is invoked
- Silent failure

**Common Causes**:

1. **Handler registered after message sent**
```typescript
// Wrong - race condition
await parley.send('hello', {}, { targetId: 'child' });
parley.on('hello', (payload) => console.log(payload)); // Registered too late!

// Correct - register handler first
parley.on('hello', (payload) => console.log(payload));
await parley.connect(iframe.contentWindow, 'child');
await parley.send('hello', {}, { targetId: 'child' });
```

2. **Wrong message type**
```typescript
// Sender
await parley.send('user-login', data, { targetId: 'child' });

// Receiver - typo!
parley.on('userLogin', (data) => { }); // Wrong type!

// Should be:
parley.on('user-login', (data) => { }); // Matches sender
```

3. **Origin mismatch (silently rejected)**
```typescript
// Parent configured origin
const parley = Parley.create({
  allowedOrigins: ['https://child.example.com']
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
```typescript
// Enable debug mode to see all messages
const parley = Parley.create({
  allowedOrigins: ['https://child.com'],
  debug: true // Logs all messages to console
});

// Listen for system events
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
  console.log('Received:', event);
});
```

---

## Origin Validation Errors

### Problem: SecurityError - Origin validation failed

**Symptoms**:
- `SecurityError: Origin mismatch` errors
- Messages silently dropped
- Connection fails

**Common Causes**:

1. **Port mismatch**
```typescript
// Parent expects
allowedOrigins: ['https://child.com:443']

// But browser normalizes to
'https://child.com' // Port 443 is default for HTTPS

// Solution: Don't specify default ports
allowedOrigins: ['https://child.com'] // Correct
```

2. **Protocol mismatch**
```typescript
// Wrong
allowedOrigins: ['http://child.com'] // HTTP

// Child is actually running on
'https://child.com' // HTTPS

// Solution: Match protocol exactly
allowedOrigins: ['https://child.com']
```

3. **Subdomain mismatch**
```typescript
// Parent expects
allowedOrigins: ['https://child.example.com']

// But child is on
'https://www.child.example.com' // Different subdomain!

// Solution: Add all subdomains
allowedOrigins: [
  'https://child.example.com',
  'https://www.child.example.com'
]
```

4. **Development vs Production**
```typescript
// Development
allowedOrigins: ['http://localhost:3000']

// Production
allowedOrigins: ['https://app.example.com']

// Solution: Use environment variables
allowedOrigins: [process.env.ALLOWED_ORIGIN]
```

**Solution**:
```typescript
// Log the actual origin to debug
window.addEventListener('message', (event) => {
  console.log('Message from origin:', event.origin);
});

// Then configure ParleyJS with the exact origin
const parley = Parley.create({
  allowedOrigins: ['https://exact-origin.com'] // Use exact origin from log
});
```

---

## Timeout Errors

### Problem: TimeoutError - Request timed out

**Symptoms**:
- `TimeoutError` thrown
- Requests never resolve
- Long wait before error

**Common Causes**:

1. **Handler never responds**
```typescript
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

2. **Handler throws error**
```typescript
// If handler throws, no response is sent
parley.on('get-data', async (payload, respond) => {
  throw new Error('Something went wrong'); // Causes timeout!
});

// Correct - catch errors and respond
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
```typescript
// Wrong - slow operation with short timeout
await parley.send('slow-query', {}, {
  targetId: 'child',
  timeout: 1000 // Only 1 second!
});

// Correct - increase timeout for slow operations
await parley.send('slow-query', {}, {
  targetId: 'child',
  timeout: 30000 // 30 seconds
});
```

**Solution Checklist**:
- [ ] Handler always calls `respond()`
- [ ] Handler catches errors and responds with error
- [ ] Timeout is long enough for operation
- [ ] Handler is actually registered

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
```typescript
// Wrong - sending huge object
await parley.send('update', {
  data: hugeArray, // 10MB of data!
  timestamp: Date.now()
});

// Correct - send smaller chunks or reference
await parley.send('update', {
  dataId: 'ref-123', // Just send reference
  timestamp: Date.now()
});
```

2. **Too many messages**
```typescript
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
```typescript
// Wrong - blocking operation in handler
parley.on('process', (payload, respond) => {
  const result = expensiveSync Operation(); // Blocks!
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

For more details, see [Performance Best Practices](./ARCHITECTURE.md#performance-considerations). For batching messages in request-response pattern, see [Batch Request-Response](./patterns/request-response.md#batch-request-response).

---

## Debugging Strategies

### Enable Debug Mode

```typescript
const parley = Parley.create({
  allowedOrigins: ['https://child.com'],
  debug: true // Enables detailed logging
});
```

### Monitor System Events

```typescript
import { SYSTEM_EVENTS } from 'parley-js';

// Connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
  console.log('Connected to:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
  console.log('Disconnected from:', event.targetId, event.reason);
});

// Message events
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
  console.log('Sent message:', event.messageType, event.payload);
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
  console.log('Received message:', event.messageType, event.payload);
});

// Error events
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
  console.log('Timeout:', event.messageId);
});

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
  console.error('Error:', event.error);
});
```

### Check Message Flow

```typescript
// Log all incoming postMessages (before ParleyJS processes them)
window.addEventListener('message', (event) => {
  console.log('Raw postMessage received:', {
    origin: event.origin,
    data: event.data,
    source: event.source
  });
});
```

### Inspect ParleyJS State

```typescript
// Check if connected
console.log('Connected targets:', parley.getConnectedTargets());

// Check registered handlers
console.log('Registered handlers:', parley.getRegisteredHandlers());
```

---

## Common Mistakes

### Mistake: Using wildcard origin

```typescript
// DANGEROUS - accepts messages from ANY origin
const parley = Parley.create({
  allowedOrigins: ['*']
});
```

**Why it's wrong**: Security vulnerability - malicious sites can send messages

**Correct approach**: Always specify exact origins
```typescript
const parley = Parley.create({
  allowedOrigins: ['https://trusted-domain.com']
});
```

### Mistake: Not waiting for connection

```typescript
// Wrong - send before connected
const parley = Parley.create({ allowedOrigins: ['https://child.com'] });
parley.connect(iframe.contentWindow, 'child'); // No await!
await parley.send('hello', {}); // Might fail!

// Correct - wait for connection
await parley.connect(iframe.contentWindow, 'child');
await parley.send('hello', {}, { targetId: 'child' });
```

### Mistake: Forgetting to call respond()

```typescript
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

```typescript
// Wrong - functions aren't serializable
await parley.send('update', {
  callback: () => console.log('done') // Error!
});

// Correct - only send plain data
await parley.send('update', {
  message: 'Update complete'
});
```

### Mistake: Not cleaning up

```typescript
// Wrong - memory leak
function setupParley() {
  const parley = Parley.create({ allowedOrigins: ['https://child.com'] });
  parley.on('message', handleMessage);
  // Never cleaned up!
}

// Correct - clean up when done
function setupParley() {
  const parley = Parley.create({ allowedOrigins: ['https://child.com'] });
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

1. **Check the examples**: See [examples/](../examples/) for working code
2. **Review the API docs**: See [API Reference](./API.md) for complete documentation
3. **Search existing issues**: Check [GitHub Issues](https://github.com/WebDev-Guy/parley-js/issues)
4. **Ask for help**: Open a new issue with:
   - ParleyJS version
   - Browser and version
   - Minimal reproduction code
   - Error messages
   - Debug logs (with `debug: true`)

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

**Back to**: [Documentation Home](../README.md)
