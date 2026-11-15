[Home](../index.md) > [Troubleshooting](./index.md) > Common Errors

# Common ParleyJS Errors and Solutions

Quick solutions to frequently encountered ParleyJS errors and problems. This
guide uses an FAQ-style format to help you quickly diagnose and fix issues.

## Table of Contents

1. [Origin Mismatch Errors](#origin-mismatch-errors)
2. [Messages Not Being Received](#messages-not-being-received)
3. [Timeout Errors](#timeout-errors)
4. [Type Validation Errors](#type-validation-errors)
5. [Channel Closed Errors](#channel-closed-errors)
6. [Memory Leaks](#memory-leaks)
7. [Dead Window References](#dead-window-references)
8. [Serialization Errors](#serialization-errors)
9. [Cross-Origin Errors](#cross-origin-errors)
10. [Performance Issues](#performance-issues)
11. [Configuration Errors](#configuration-errors)
12. [Handler Errors](#handler-errors)
13. [Rate Limit Errors](#rate-limit-errors)

---

## Origin Mismatch Errors

### ERR_SECURITY_ORIGIN_MISMATCH

**Symptoms**:

```
Messages silently dropped with no error
connect() rejects with ERR_CONNECTION_HANDSHAKE_FAILED (handshake never arrives)
With logLevel 'debug' or 'warn': "Message from disallowed origin blocked"
system:error with ERR_SECURITY_ORIGIN_MISMATCH (only with a custom SecurityLayer)
```

**Root Cause**: The origin of the incoming message does not match any origin in
the `allowedOrigins` configuration. Origins must match exactly (after
normalization to the URL origin, lowercase) including protocol, hostname, and
port. Messages from origins that are not allowed are dropped silently by the
channel; `system:error` with `ERR_SECURITY_ORIGIN_MISMATCH` is emitted only when
a custom `SecurityLayer.validateOrigin()` rejects a message.

**Solution**:

**Step 1**: Check the exact origin in both windows.

```typescript
// Add this to both parent and child to debug
console.log('My origin is:', window.location.origin);

window.addEventListener('message', (event) => {
    console.log('Received message from:', event.origin);
});
```

**Step 2**: Verify protocol matches (http vs https).

```typescript
// WRONG - Protocol mismatch
// Parent expects: https://child.example.com
// Child is running on: http://child.example.com

// CORRECT - Protocols match
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'], // Match exactly
});
```

**Step 3**: Verify hostname matches exactly (case-sensitive).

```typescript
// WRONG - Different hostnames
allowedOrigins: ['https://app.example.com'];
// Child is on: https://dashboard.example.com

// CORRECT - Add all origins
allowedOrigins: ['https://app.example.com', 'https://dashboard.example.com'];
```

**Step 4**: Verify port if specified (or omit for defaults).

```typescript
// WRONG - Port missing for a non-default port
allowedOrigins: ['http://localhost'];
// Child is on: http://localhost:3000

// CORRECT - Include non-default ports (default ports 443/80 can be omitted)
allowedOrigins: ['http://localhost:3000'];
```

**Step 5**: Update configuration with exact origin.

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [
        'https://exact-origin.com', // Use exact origin from console log
    ],
});
```

**Prevention**:

- Use environment variables for origins in different environments
- Wildcards are not supported: `Parley.create()` rejects `'null'` and any entry
  containing `'*'` (including patterns like `'*.example.com'`)
- Serve pages over http(s); `file://` pages have the `'null'` origin and are not
  supported
- Log origins during development to verify exact values
- Remember that `localhost` and `127.0.0.1` are different origins

```typescript
// Use environment-based configuration
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [
        process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : 'https://app.production.com',
    ],
});
```

**Related**:

- [Origin Validation Guide](../security/origin-validation.md) - Complete origin
  validation documentation
- [Security Best Practices](../security/index.md) - Security configuration
- [Parley.create()](../api-reference/methods.md#parleycreate) - Configuration
  options

---

## Messages Not Being Received

### Handler Never Called

**Symptoms**:

```
Handler function never invoked
send() rejects with ERR_NO_HANDLER (receiver has no handler for that type)
send() with expectsResponse: false, or broadcast(), completes with no feedback
send() times out (message dropped by origin or source checks)
```

**Root Cause**: Message handlers are registered on the receiving side after
messages arrive, message type strings don't match exactly, or origin validation
is silently rejecting messages. When a request (the default
`expectsResponse: true`) reaches a window with no handler for its type, the
sender's `send()` rejects with `ERR_NO_HANDLER`. Fire-and-forget messages and
`broadcast()` give no such feedback.

**Solution**:

**Step 1**: Register handlers before sending messages.

```typescript
// WRONG - Race condition
await parley.connect(iframe, 'child');
await parley.send('hello', { text: 'Hi' }, { targetId: 'child' });
parley.on('hello', (payload) => {
    console.log(payload); // Never called - registered too late!
});

// CORRECT - Register handlers first
parley.on('hello', (payload) => {
    console.log(payload); // Called correctly
});
await parley.connect(iframe, 'child');
await parley.send('hello', { text: 'Hi' }, { targetId: 'child' });
```

**Step 2**: Verify message type strings match exactly (case-sensitive).

```typescript
// Sender
await parley.send('user-login', data, { targetId: 'child' });

// WRONG - Typo or different casing
parley.on('userLogin', (data) => {}); // Never called!

// CORRECT - Exact match
parley.on('user-login', (data) => {}); // Called correctly
```

**Step 3**: Check for origin validation issues.

```typescript
// Enable debug logging to see blocked and received messages
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    logLevel: 'debug', // Logs messages, rejections and errors
});

// Listen for system events
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('ParleyJS Error:', event);
});
```

**Step 4**: Verify both windows have called connect().

```typescript
// Parent must connect
await parley.connect(iframe, 'child');

// Child must also connect (in iframe)
await parley.connect(window.parent, 'parent');
```

**Step 5**: Check that message is sent to correct target.

```typescript
// WRONG - Wrong targetId
await parley.send('hello', {}, { targetId: 'wrongId' });

// CORRECT - Use correct targetId
await parley.send('hello', {}, { targetId: 'child' });

// Debug: Check connected targets
console.log('Connected targets:', parley.getConnectedTargets());
```

**Prevention**:

- Always register handlers during initialization, before connecting
- Use constants for message types to avoid typos
- Use `logLevel: 'debug'` during development
- Monitor system events for errors
- Use TypeScript for type safety on message types

```typescript
// Use constants to prevent typos
const MESSAGE_TYPES = {
    USER_LOGIN: 'user-login',
    USER_LOGOUT: 'user-logout',
    DATA_UPDATE: 'data-update',
} as const;

// Register handler
parley.on(MESSAGE_TYPES.USER_LOGIN, (payload) => {
    console.log('User logged in:', payload);
});

// Send message
await parley.send(MESSAGE_TYPES.USER_LOGIN, data, { targetId: 'child' });
```

**Related**:

- [Message Handlers](../api-reference/methods.md#on) - Handler registration
- [send() Method](../api-reference/methods.md#send) - Sending messages
- [System Events](../api-reference/system-events.md) - Monitoring events
- [Debugging Guide](../TROUBLESHOOTING.md#debugging-strategies) - Debugging
  strategies

---

## Timeout Errors

### ERR_TIMEOUT_NO_RESPONSE

**Symptoms**:

```
TimeoutError: ERR_TIMEOUT_NO_RESPONSE - No response received within timeout period
Long wait before error is thrown
Handler appears to run but timeout still occurs
```

**Root Cause**: The handler never calls `respond()` (a handler's return value is
ignored), the timeout value is too short for the operation, or the message never
reached the other side (wrong origin, target not connected on that side).

These are NOT timeouts: a handler that throws makes `send()` reject with
`ERR_HANDLER_ERROR` (message `'Handler error'` unless the receiver set
`exposeHandlerErrors: true`), and a missing handler makes it reject with
`ERR_NO_HANDLER`.

**Solution**:

**Step 1**: Ensure handler always calls respond().

```typescript
// WRONG - Handler doesn't call respond()
parley.on('get-data', async (payload, respond) => {
    const data = await fetchData(payload.id);
    console.log('Got data:', data);
    // Forgot to call respond() - causes timeout!
});

// CORRECT - Always call respond()
parley.on('get-data', async (payload, respond) => {
    const data = await fetchData(payload.id);
    respond({ success: true, data }); // Always respond!
});
```

**Step 2**: Decide how handler errors should reach the sender.

```typescript
// If the handler throws, ParleyJS responds with an error automatically:
// the sender's send() rejects with ERR_HANDLER_ERROR ('Handler error').
parley.on('get-data', async (payload, respond) => {
    const data = await fetchData(payload.id); // Throws error
    respond({ data }); // Not reached; sender gets ERR_HANDLER_ERROR
});

// To give the sender a structured result instead, catch and respond
parley.on('get-data', async (payload, respond) => {
    try {
        const data = await fetchData(payload.id);
        respond({ success: true, data });
    } catch (error) {
        respond({ success: false, error: error.message });
    }
});
```

**Step 3**: Increase timeout for slow operations.

```typescript
// WRONG - Short timeout for slow operation
await parley.send(
    'database-query',
    { sql: 'SELECT * FROM huge_table' },
    {
        targetId: 'child',
        timeout: 1000, // Only 1 second!
    }
);

// CORRECT - Appropriate timeout
await parley.send(
    'database-query',
    { sql: 'SELECT * FROM huge_table' },
    {
        targetId: 'child',
        timeout: 30000, // 30 seconds for database query
    }
);
```

**Step 4**: Verify the message reaches the other side.

```typescript
// Sender: is the target connected?
console.log('Connected targets:', parley.getConnectedTargets());
console.log('Child connected:', parley.isConnected('child'));

// Receiver: log every inbound message
childParley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log('Received', event.messageType, 'from', event.origin);
});
```

There is no API to list registered handlers. If the message arrives but no
handler exists for its type, `send()` rejects with `ERR_NO_HANDLER` rather than
timing out.

**Step 5**: Handle fire-and-forget vs request-response correctly.

```typescript
// Fire-and-forget - no response expected
await parley.send(
    'notification',
    { message: 'Hi' },
    {
        targetId: 'child',
        expectsResponse: false, // No timeout
    }
);

// Request-response - expects response
await parley.send(
    'get-user',
    { id: 123 },
    {
        targetId: 'child',
        expectsResponse: true, // Default - waits for response
        timeout: 5000,
    }
);
```

**Prevention**:

- Always call `respond()` in handlers that answer requests
- Wrap handler logic in try-catch if the sender should get a structured error
  instead of `ERR_HANDLER_ERROR`
- Set appropriate timeouts based on operation complexity, and use `retries` for
  flaky targets (each retry re-sends the same message after another `timeout`,
  with no backoff)
- Use `expectsResponse: false` for notifications
- Monitor system timeout events during development

```typescript
// Robust handler pattern
parley.on('operation', async (payload, respond) => {
    try {
        // Perform operation
        const result = await performOperation(payload);

        // Always respond with result
        respond({ success: true, result });
    } catch (error) {
        // Always respond even on error
        respond({
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR',
        });
    }
});

// Monitor timeouts
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.warn('Timeout occurred:', {
        messageType: event.messageType,
        messageId: event.messageId,
        timeoutMs: event.timeoutMs,
        retriesAttempted: event.retriesAttempted,
    });
});
```

**Related**:

- [Request-Response Pattern](../patterns/request-response.md) - Request-response
  workflows
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling
  strategies
- [send() Options](../api-reference/methods.md#send) - Timeout configuration
- [System Events](../api-reference/system-events.md#timeout) - Timeout events

---

## Type Validation Errors

### ERR_VALIDATION_SCHEMA_MISMATCH

**Symptoms**:

```
ValidationError: ERR_VALIDATION_SCHEMA_MISMATCH - Schema validation failed
send() rejects with ERR_VALIDATION_SCHEMA_MISMATCH from the remote side
Runtime errors about undefined properties
```

All schema failures (wrong type, missing required field, and so on) use the
single code `ERR_VALIDATION_SCHEMA_MISMATCH`. The details are in
`error.validationErrors` (an array of
`{ path, message, expected?, received?, rule? }`). The same code is used when a
serialized payload exceeds the fixed 10 MB limit.

**Root Cause**: Payload does not match the registered schema, required fields
are missing, field types don't match schema definition, or no schema is
registered for the message type.

**Solution**:

**Step 1**: Register message type with correct schema.

```typescript
// WRONG - No schema registered
parley.on('create-user', (payload, respond) => {
    const user = createUser(payload.name, payload.email);
    respond({ user });
});

// CORRECT - Register schema first
parley.register('create-user', {
    schema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
            name: { type: 'string' },
            email: { type: 'string' },
        },
    },
});

parley.on('create-user', (payload, respond) => {
    // Payload is validated before handler is called
    const user = createUser(payload.name, payload.email);
    respond({ user });
});
```

**Step 2**: Ensure payload includes all required fields.

```typescript
// WRONG - Missing required field
await parley.send(
    'create-user',
    {
        name: 'John Doe',
        // email is missing!
    },
    { targetId: 'child' }
);

// CORRECT - All required fields included
await parley.send(
    'create-user',
    {
        name: 'John Doe',
        email: 'john@example.com',
    },
    { targetId: 'child' }
);
```

**Step 3**: Match field types to schema.

```typescript
// WRONG - Type mismatch
await parley.send(
    'update-age',
    {
        userId: 123,
        age: '25', // String instead of number!
    },
    { targetId: 'child' }
);

// CORRECT - Types match schema
await parley.send(
    'update-age',
    {
        userId: 123,
        age: 25, // Number
    },
    { targetId: 'child' }
);
```

**Step 4**: Use TypeScript for compile-time type safety.

```typescript
// Define interfaces
interface CreateUserPayload {
    name: string;
    email: string;
}

interface CreateUserResponse {
    success: boolean;
    user?: {
        id: number;
        name: string;
        email: string;
    };
    error?: string;
}

// Register with schema (register() is not generic)
parley.register('create-user', {
    schema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
            name: { type: 'string' },
            email: { type: 'string' },
        },
    },
});

// Type-safe handler
parley.on<CreateUserPayload>('create-user', (payload, respond) => {
    // payload is typed as CreateUserPayload
    const user = createUser(payload.name, payload.email);

    // respond() is not generic; annotate the value instead
    const response: CreateUserResponse = { success: true, user };
    respond(response);
});

// Type-safe send
const response = await parley.send<CreateUserPayload, CreateUserResponse>(
    'create-user',
    { name: 'John', email: 'john@example.com' },
    { targetId: 'child' }
);
```

**Step 5**: Validate nested objects and arrays.

```typescript
// Register schema with nested validation
parley.register('create-post', {
    schema: {
        type: 'object',
        required: ['title', 'content', 'tags'],
        properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            tags: {
                type: 'array',
                items: { type: 'string' },
            },
            author: {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                },
            },
        },
    },
});
```

**Prevention**:

- Always register message types with schemas before use
- Use TypeScript for compile-time type checking
- Validate payload before sending on the sender side
- Use detailed schemas that match your data structures exactly
- Handle validation errors gracefully

```typescript
import { validateSchema } from 'ignite-parleyjs';

// Validation helper. validateSchema() returns { valid, errors }, not a boolean.
function validateBeforeSend(messageType, payload, schema) {
    const result = validateSchema(payload, schema);

    if (!result.valid) {
        console.error(result.errors); // [{ path, message, ... }]
        throw new Error(`Invalid payload for ${messageType}`);
    }
}

// Use before sending
const payload = { name: 'John', email: 'john@example.com' };
validateBeforeSend('create-user', payload, createUserSchema);

await parley.send('create-user', payload, { targetId: 'child' });
```

**Related**:

- [Message Validation](../security/message-validation.md) - Payload validation
- [register() Method](../api-reference/methods.md#register) - Schema
  registration
- [TypeScript Support](../api-reference/types.md) - Type-safe usage
- [Testing Validation](../patterns/error-handling.md#validation-errors) -
  Testing validation

---

## Channel Closed Errors

### ERR_CONNECTION_CLOSED / Connection Lost

**Symptoms**:

```
ConnectionError: ERR_CONNECTION_CLOSED - Target disconnected
ConnectionError: ERR_CONNECTION_CLOSED - Parley instance destroyed
TargetNotFoundError: ERR_TARGET_NOT_CONNECTED on later send() calls
system:connection_lost followed by system:disconnected
Messages fail after connection was working
```

**Root Cause**: Target window was closed (popup closed or iframe removed), the
peer called `disconnect()`, heartbeats stopped being answered, or the instance
was destroyed.

What ParleyJS does:

- A closed popup is detected automatically (polling about once per second):
  `system:connection_lost` fires with reason `'connection_lost'`, followed by
  `system:disconnected`. Pending `send()` calls to that target reject with a
  `ConnectionError` (`ERR_CONNECTION_CLOSED`, 'Target disconnected').
- Missed heartbeats produce reason `'heartbeat_timeout'`; repeated request
  timeouts to one target produce `'max_failures_reached'`.
- A peer's `disconnect()` arrives as `system:disconnected` with reason
  `'manual_disconnect'`.
- After the target is disconnected, `send()` with its `targetId` rejects with
  `ERR_TARGET_NOT_CONNECTED`.
- There is no automatic reconnection.

**Solution**:

**Step 1**: Check if target window is still open.

```typescript
// Check popup is still open
if (popup && !popup.closed) {
    await parley.send('message', { data: 'hello' }, { targetId: 'popup' });
} else {
    console.log('Popup was closed by user');
}
```

**Step 2**: React to a closed popup.

ParleyJS detects closed popups for you, so you do not need your own
`popup.closed` polling to clean up the connection:

```typescript
const popupParley = Parley.create({
    targetType: 'window',
    allowedOrigins: ['https://auth.example.com'],
});

const popup = window.open(
    'https://auth.example.com/login',
    'auth',
    'width=500,height=600'
);

if (popup) {
    popupParley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
        if (
            event.targetId === 'auth-popup' &&
            event.reason === 'connection_lost'
        ) {
            console.log('Popup was closed');
        }
    });

    await popupParley.connect(popup, 'auth-popup');
}
```

**Step 3**: Handle connection lost events.

```typescript
// Listen for disconnection
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from:', event.targetId, 'Reason:', event.reason);

    // Attempt reconnection if the connection dropped (not on purpose)
    if (
        event.reason === 'heartbeat_timeout' ||
        event.reason === 'max_failures_reached'
    ) {
        attemptReconnect(event.targetId);
    }
});

parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    // reason: 'heartbeat_timeout' | 'max_failures_reached' |
    //         'connection_lost' | 'cleanup'
    console.log('Connection lost to:', event.targetId, event.reason);

    // Update UI to show disconnected state
    updateConnectionStatus('disconnected');
});
```

**Step 4**: Implement reconnection logic (application code; the other side must
also call `connect()` again).

```typescript
async function attemptReconnect(targetId, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Reconnection attempt ${attempt}/${maxAttempts}`);

            // Get a fresh target: the iframe element for an 'iframe'
            // instance, the popup window for a 'window' instance
            const target = getTarget(targetId);

            if (!target || target.closed) {
                throw new Error('Target is gone');
            }

            await parley.connect(target, targetId);
            console.log('Reconnected successfully');
            return;
        } catch (error) {
            console.warn(`Reconnection attempt ${attempt} failed:`, error);

            if (attempt < maxAttempts) {
                await new Promise((resolve) =>
                    setTimeout(resolve, 1000 * attempt)
                );
            }
        }
    }

    console.error('Failed to reconnect after all attempts');
}
```

**Step 5**: Clean up on window unload.

```typescript
// Graceful cleanup on page unload
window.addEventListener('beforeunload', () => {
    // Notify other windows (broadcast() is fire-and-forget and returns void)
    parley.broadcast('window-closing', {
        windowId: 'main',
        timestamp: Date.now(),
    });

    // Clean up resources
    parley.destroy();
});
```

**Prevention**:

- Check `parley.isConnected(targetId)` before sending to targets that may go
  away
- Monitor connection status with system events
- Implement reconnection in your own code for critical connections
- Clean up resources when windows close
- Handle iframe removal gracefully

```typescript
// Robust popup pattern (parley is a targetType: 'window' instance)
class PopupManager {
    constructor(parley) {
        this.parley = parley;
        this.popup = null;
        this.targetId = null;

        // ParleyJS reports the popup closing; no polling needed
        this.parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
            if (event.targetId === this.targetId) {
                this.popup = null;
                this.targetId = null;
            }
        });
    }

    async open(url, targetId) {
        this.popup = window.open(url, targetId, 'width=500,height=600');

        if (!this.popup) {
            throw new Error('Popup blocked');
        }

        this.targetId = targetId;
        await this.parley.connect(this.popup, targetId);
    }

    async close() {
        if (this.targetId && this.parley.isConnected(this.targetId)) {
            await this.parley.disconnect(this.targetId);
        }
        if (this.popup && !this.popup.closed) {
            this.popup.close();
        }
    }
}
```

**Related**:

- [Popup Communication Guide](../guides/popup-communication.md) - Popup
  lifecycle management
- [Connection Management](../api-reference/methods.md#connect) - connect() and
  disconnect()
- [System Events](../api-reference/system-events.md#connection-events) -
  Connection events
- [Error Recovery](../patterns/error-handling.md#connection-errors) - Handling
  connection errors

---

## Memory Leaks

### Increasing Memory Usage / Event Listener Leaks

**Symptoms**:

```
Memory usage grows over time
Browser becomes slow or unresponsive
DevTools shows increasing listener count
Application crashes after extended use
```

**Root Cause**: Event listeners not removed when components unmount, Parley
instances not destroyed, multiple instances created without cleanup, or handlers
registered in loops.

**Solution**:

**Step 1**: Always call destroy() when done.

```typescript
// WRONG - Memory leak
function setupConnection() {
    const parley = Parley.create({
        targetType: 'iframe',
        allowedOrigins: ['https://child.com'],
    });

    parley.on('message', handleMessage);
    // Never cleaned up!
}

// CORRECT - Cleanup function
function setupConnection() {
    const parley = Parley.create({
        targetType: 'iframe',
        allowedOrigins: ['https://child.com'],
    });

    parley.on('message', handleMessage);

    // Return cleanup function
    return () => {
        parley.destroy(); // Removes all listeners
    };
}

const cleanup = setupConnection();
// Later when done...
cleanup();
```

**Step 2**: Remove event listeners in React/Vue/Angular components.

```typescript
// React example
function ChatComponent() {
    useEffect(() => {
        const parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: [window.location.origin]
        });

        parley.on('chat-message', handleChatMessage);

        // Cleanup on unmount
        return () => {
            parley.destroy();
        };
    }, []); // Empty deps - run once

    return <div>Chat</div>;
}

// Vue example
export default {
    mounted() {
        this.parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: [window.location.origin]
        });

        this.parley.on('message', this.handleMessage);
    },

    beforeUnmount() {
        // Cleanup before component is destroyed
        if (this.parley) {
            this.parley.destroy();
        }
    }
};
```

**Step 3**: Unsubscribe from individual handlers when needed.

```typescript
// Register handler and get unsubscribe function
const unsubscribe = parley.on('update', (payload) => {
    console.log('Update:', payload);
});

// Later, remove this specific handler
unsubscribe();
```

**Step 4**: Avoid creating multiple Parley instances.

```typescript
// WRONG - Creates instance on every render
function Component() {
    const parley = Parley.create({
        targetType: 'iframe',
        allowedOrigins: ['https://child.com'],
    });
    // New instance every render - memory leak!
}

// CORRECT - Create instance once
function Component() {
    const parleyRef = useRef(null);

    useEffect(() => {
        if (!parleyRef.current) {
            parleyRef.current = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.com'],
            });
        }

        return () => {
            if (parleyRef.current) {
                parleyRef.current.destroy();
                parleyRef.current = null;
            }
        };
    }, []);
}
```

**Step 5**: Monitor memory usage in development.

```typescript
// Development helper
if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
        if (performance.memory) {
            console.log('Memory usage:', {
                used:
                    (performance.memory.usedJSHeapSize / 1048576).toFixed(2) +
                    ' MB',
                total:
                    (performance.memory.totalJSHeapSize / 1048576).toFixed(2) +
                    ' MB',
            });
        }
    }, 10000); // Every 10 seconds
}
```

**Prevention**:

- Always call `destroy()` when Parley instance is no longer needed
- Use cleanup functions in component lifecycles
- Avoid creating instances in render loops
- Use singleton pattern for app-wide Parley instances
- Monitor memory usage during development

```typescript
// Singleton pattern
class ParleyManager {
    constructor() {
        if (ParleyManager.instance) {
            return ParleyManager.instance;
        }

        this.parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: [window.location.origin],
        });

        ParleyManager.instance = this;
    }

    getInstance() {
        return this.parley;
    }

    destroy() {
        if (this.parley) {
            this.parley.destroy();
            this.parley = null;
        }

        ParleyManager.instance = null;
    }
}

// Use throughout app
const manager = new ParleyManager();
const parley = manager.getInstance();

// Cleanup on app shutdown
window.addEventListener('beforeunload', () => {
    manager.destroy();
});
```

**Related**:

- [destroy() Method](../api-reference/methods.md#destroy) - Cleanup and resource
  management
- [React Integration](../EXAMPLES.md#react) - Framework-specific cleanup
- [Performance Best Practices](../ARCHITECTURE.md#performance-considerations) -
  Memory optimization

---

## Dead Window References

### Window Reference No Longer Valid

**Symptoms**:

```
Messages sent but never received
No errors thrown but communication fails
iframe.contentWindow is null
popup.closed returns true but code still tries to send
```

**Root Cause**: Iframe removed from DOM but code still holds reference, window
navigated away, the wrong kind of target was passed to `connect()`, or the
iframe is not in the document yet.

**Solution**:

**Step 1**: Pass the right target to `connect()`.

```typescript
// WRONG - an iframe instance expects the iframe ELEMENT;
// passing contentWindow fails with ERR_CONNECTION_FAILED
await parley.connect(iframe.contentWindow, 'child');

// CORRECT - pass the element (it must be attached to the document).
// No 'load' listener is needed: the child re-sends the handshake until the
// parent acknowledges it. A 'load' listener added after the iframe already
// loaded never fires and would prevent connecting.
const iframe = document.getElementById('my-iframe');
await parley.connect(iframe, 'child');
```

**Step 2**: Check window validity before sending.

```typescript
// Check if window reference is still valid
function isWindowValid(windowRef) {
    try {
        // Check if window exists and is not closed
        return windowRef && !windowRef.closed && windowRef.location;
    } catch (error) {
        // Cross-origin access throws error if window is invalid
        return false;
    }
}

// Use before sending
if (isWindowValid(popup)) {
    await parley.send('message', { data: 'hello' }, { targetId: 'popup' });
} else {
    console.log('Window is no longer valid');
}
```

**Step 3**: Handle iframe removal from DOM.

```typescript
// Monitor iframe removal
const iframe = document.getElementById('my-iframe');
await parley.connect(iframe, 'child');

// Use MutationObserver to detect removal
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
            if (node === iframe) {
                console.log('iframe was removed from DOM');
                parley.disconnect('child');
                observer.disconnect();
            }
        });
    });
});

observer.observe(iframe.parentNode, { childList: true });
```

**Step 4**: Re-establish connection after navigation.

```typescript
// Child iframe navigates or reloads. Its page calls
// connect(window.parent, ...) again on load; the parent reconnects too.
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, async (event) => {
    if (event.targetId === 'child' && event.reason !== 'destroyed') {
        console.log('Child connection lost, attempting reconnect...');

        const iframe = document.getElementById('child-iframe');
        if (iframe) {
            try {
                await parley.connect(iframe, 'child');
                console.log('Reconnected to child');
            } catch (error) {
                console.error('Failed to reconnect:', error);
            }
        }
    }
});
```

**Step 5**: Store and refresh window references safely.

```typescript
class WindowManager {
    constructor(parley) {
        this.parley = parley;
        this.windows = new Map();
    }

    registerWindow(targetId, windowRef, options = {}) {
        this.windows.set(targetId, {
            window: windowRef,
            isIframe: options.isIframe || false,
            elementId: options.elementId,
        });
    }

    getWindow(targetId) {
        const entry = this.windows.get(targetId);
        if (!entry) return null;

        // Iframe instances connect to the iframe ELEMENT, so look it up again
        if (entry.isIframe && entry.elementId) {
            const iframe = document.getElementById(entry.elementId);
            if (!iframe) {
                this.windows.delete(targetId);
                return null;
            }
            entry.window = iframe;
            return iframe;
        }

        // Validate popup window is still open
        if (!entry.window || entry.window.closed) {
            this.windows.delete(targetId);
            return null;
        }

        return entry.window;
    }
}
```

**Prevention**:

- Pass the iframe element (not `contentWindow`) to an iframe instance's
  `connect()`; no load wait is needed
- Listen for `system:connection_lost` / `system:disconnected` instead of polling
  `popup.closed`
- Monitor iframe removal with MutationObserver
- Re-establish connections after navigation
- Use window manager pattern for complex multi-window apps

**Related**:

- [iFrame Communication](../guides/iframe-communication.md#common-mistakes) -
  iframe best practices
- [Popup Communication](../guides/popup-communication.md#lifecycle-management) -
  Popup lifecycle
- [Connection Events](../api-reference/system-events.md#connection-events) -
  Monitoring connections

---

## Serialization Errors

### ERR_SERIALIZATION_CIRCULAR_REFERENCE / SERIALIZE_FAILED

**Symptoms**:

```
SerializationError: ERR_SERIALIZATION_CIRCULAR_REFERENCE (send() rejects)
SerializationError: ERR_SERIALIZATION_SERIALIZE_FAILED (e.g. BigInt values)
Functions or undefined values missing on the receiving side
Dates arrive as strings; Map, Set, File, Blob, ArrayBuffer arrive as {}
```

**Root Cause**: Every payload is sanitized with a JSON round-trip before it is
sent. Circular references and `BigInt` values cannot be serialized, so `send()`
rejects with a `SerializationError` (since 1.1.0; earlier versions silently sent
`{}`). Values JSON cannot represent are not errors: functions, `undefined` and
symbols are silently dropped, `Date` becomes a string, and `Map`, `Set`, `File`,
`Blob`, `ArrayBuffer` and typed arrays become empty objects. Class instances
lose their prototype and methods.

```typescript
import { SerializationError } from 'ignite-parleyjs';

try {
    await parley.send('update', payload, { targetId: 'child' });
} catch (error) {
    if (error instanceof SerializationError) {
        console.error(error.code, error.message);
        // ERR_SERIALIZATION_CIRCULAR_REFERENCE or ERR_SERIALIZATION_SERIALIZE_FAILED
    }
}
```

**Solution**:

**Step 1**: Remove circular references before sending.

```typescript
// WRONG - Circular reference
const user = { name: 'John' };
user.self = user; // Circular!

await parley.send('update-user', { user }, { targetId: 'child' });
// Rejects: SerializationError (ERR_SERIALIZATION_CIRCULAR_REFERENCE)

// CORRECT - Remove circular references
const user = { name: 'John' };
user.self = user;

// Clone without circular refs
const safeUser = JSON.parse(JSON.stringify({ name: user.name }));
await parley.send('update-user', { user: safeUser }, { targetId: 'child' });
```

**Step 2**: Don't send functions or methods.

```typescript
// WRONG - Functions are silently dropped (no error is thrown)
await parley.send(
    'callback',
    {
        onComplete: () => console.log('Done'), // Arrives as missing
    },
    { targetId: 'child' }
);

// CORRECT - Use message-based callbacks
// Parent
parley.on('operation-complete', () => {
    console.log('Done');
});

await parley.send(
    'start-operation',
    {
        // Send data only, no functions
        operationId: 'op-123',
    },
    { targetId: 'child' }
);

// Child
parley.on('start-operation', async (payload, respond) => {
    await performOperation(payload.operationId);

    // Notify completion
    await parley.send(
        'operation-complete',
        {
            operationId: payload.operationId,
        },
        { targetId: 'parent', expectsResponse: false }
    );

    respond({ success: true });
});
```

**Step 3**: Extract data from DOM nodes.

```typescript
// WRONG - DOM nodes do not survive the JSON clone
const element = document.getElementById('user-input');
await parley.send(
    'submit',
    {
        element: element, // Arrives as an empty or meaningless object
    },
    { targetId: 'child' }
);

// CORRECT - Extract data from DOM
const element = document.getElementById('user-input');
await parley.send(
    'submit',
    {
        value: element.value,
        id: element.id,
        className: element.className,
    },
    { targetId: 'child' }
);
```

**Step 4**: Send plain objects only.

```typescript
// WRONG - Class instances may not serialize correctly
class User {
    constructor(name, email) {
        this.name = name;
        this.email = email;
    }

    greet() {
        return `Hello, ${this.name}`;
    }
}

const user = new User('John', 'john@example.com');
await parley.send('update-user', { user }, { targetId: 'child' });
// Methods are lost!

// CORRECT - Convert to plain object
const user = new User('John', 'john@example.com');
await parley.send(
    'update-user',
    {
        user: {
            name: user.name,
            email: user.email,
        },
    },
    { targetId: 'child' }
);
```

**Step 5**: Use serialization helper for complex objects.

```typescript
// Helper to ensure object is serializable
function toSerializable(obj) {
    try {
        // Test serialization
        const serialized = JSON.stringify(obj);
        return JSON.parse(serialized);
    } catch (error) {
        throw new Error(`Object is not serializable: ${error.message}`);
    }
}

// Use before sending
const data = {
    user: complexUserObject,
    settings: appSettings,
};

const safeData = toSerializable(data);
await parley.send('update', safeData, { targetId: 'child' });
```

**Prevention**:

- Only send plain JavaScript objects (no class instances, functions, DOM nodes)
- Test payload with `JSON.stringify()` before sending
- Use serialization helper to validate payloads
- Convert class instances to plain objects before sending
- Avoid circular references in data structures

```typescript
// Safe data transfer pattern
function createPayload(data) {
    // Ensure data is plain object
    if (typeof data !== 'object' || data === null) {
        throw new Error('Payload must be an object');
    }

    // Test serializability
    try {
        JSON.stringify(data);
    } catch (error) {
        throw new Error(`Payload is not serializable: ${error.message}`);
    }

    return data;
}

// Use in send
const payload = createPayload({
    userId: 123,
    name: 'John',
    settings: { theme: 'dark' },
});

await parley.send('update', payload, { targetId: 'child' });
```

**Related**:

- [Message Payloads](../api-reference/methods.md#send) - Payload requirements
- [JSON.stringify()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) -
  What survives the JSON round-trip ParleyJS applies to payloads
- [Testing Patterns](../patterns/error-handling.md#serialization-errors) -
  Testing serialization

---

## Cross-Origin Errors

### CORS and Security Policy Errors

**Symptoms**:

```
SecurityError: Blocked a frame with origin from accessing a cross-origin frame
DOMException: Failed to read properties from window
Cannot access window.location of cross-origin window
Messages work but certain operations fail
```

**Root Cause**: Trying to access properties of cross-origin windows directly,
browser security policies block operations, attempting to read from cross-origin
iframes, or forgetting that postMessage is the only allowed cross-origin
communication.

**Solution**:

**Step 1**: Use ParleyJS for all cross-origin communication.

```typescript
// WRONG - Direct access to cross-origin window
const childIframe = document.getElementById('child');
const childTitle = childIframe.contentWindow.document.title; // SecurityError!

// CORRECT - Request data via ParleyJS
parley.on('get-title', (payload, respond) => {
    respond({ title: document.title });
});

const response = await parley.send('get-title', {}, { targetId: 'child' });
console.log('Child title:', response.title);
```

**Step 2**: Don't try to read cross-origin window properties.

```typescript
// WRONG - Cannot read location of cross-origin window
if (popup.location.href === 'https://expected.com/callback') {
    // SecurityError!
}

// CORRECT - Have popup send message when ready
// In popup
if (window.location.href.includes('/callback')) {
    parley.send(
        'auth-complete',
        {
            success: true,
            token: getTokenFromUrl(),
        },
        { targetId: 'parent', expectsResponse: false }
    );
}

// In parent
parley.on('auth-complete', (payload) => {
    console.log('Auth complete:', payload);
});
```

**Step 3**: Configure CORS if serving cross-origin resources.

```typescript
// Server configuration (Node.js/Express example)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://trusted-domain.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
```

**Step 4**: Use same-origin for sensitive operations.

```typescript
// For highly sensitive operations, ensure same origin
if (window.location.origin === 'https://trusted.com') {
    // Safe to access directly
    const data = iframe.contentWindow.sensitiveData;
} else {
    // Use ParleyJS for cross-origin
    const response = await parley.send(
        'get-sensitive-data',
        {},
        {
            targetId: 'child',
        }
    );
}
```

**Step 5**: Set appropriate CSP headers.

```html
<!-- Allow specific frame sources -->
<meta
    http-equiv="Content-Security-Policy"
    content="frame-src https://trusted-child.com; frame-ancestors https://trusted-parent.com;"
/>
```

**Prevention**:

- Never try to directly access cross-origin window properties
- Use ParleyJS for all cross-origin communication
- Configure CORS headers for cross-origin resource requests
- Set Content Security Policy appropriately
- Understand that postMessage is the only allowed cross-origin window
  communication

```typescript
// Safe cross-origin communication pattern
class CrossOriginBridge {
    constructor(parley, targetId) {
        this.parley = parley;
        this.targetId = targetId;
    }

    // All operations go through ParleyJS
    async getProperty(propertyName) {
        const response = await this.parley.send(
            'get-property',
            {
                property: propertyName,
            },
            { targetId: this.targetId }
        );

        return response.value;
    }

    async setProperty(propertyName, value) {
        await this.parley.send(
            'set-property',
            {
                property: propertyName,
                value: value,
            },
            { targetId: this.targetId }
        );
    }

    // Generic method call
    async call(methodName, ...args) {
        const response = await this.parley.send(
            'method-call',
            {
                method: methodName,
                args: args,
            },
            { targetId: this.targetId }
        );

        return response.result;
    }
}

// Usage
const bridge = new CrossOriginBridge(parley, 'child');
const title = await bridge.getProperty('documentTitle');
await bridge.setProperty('theme', 'dark');
const result = await bridge.call('calculateTotal', 100, 50);
```

**Related**:

- [Origin Validation](../security/origin-validation.md) - Origin security
- [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) - Cross-origin
  resource sharing
- [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) - Content
  Security Policy
- [Same-Origin Policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) -
  Browser security

---

## Performance Issues

### Slow Message Delivery / High Latency

**Symptoms**:

```
Messages take seconds to arrive
UI freezes during message processing
High CPU usage
Browser becomes unresponsive
Slow performance with many messages
```

**Root Cause**: Payloads are too large, too many messages sent in tight loops,
synchronous blocking operations in handlers, or no message batching for
high-frequency updates.

**Solution**:

**Step 1**: Keep payloads small (< 1MB recommended; payloads over 10 MB
serialized are rejected).

```typescript
// WRONG - Sending huge payload
await parley.send(
    'update',
    {
        data: hugeArray, // 10MB of data!
        images: arrayOfBase64Images, // Another 5MB
        timestamp: Date.now(),
    },
    { targetId: 'child' }
);

// CORRECT - Send reference or chunk data
await parley.send(
    'update',
    {
        dataId: 'ref-123', // Just ID
        imageIds: ['img-1', 'img-2', 'img-3'], // References
        timestamp: Date.now(),
    },
    { targetId: 'child' }
);

// Child fetches large data separately
const data = await fetchDataById(payload.dataId);
```

**Step 2**: Batch messages instead of sending many individual ones.

```typescript
// WRONG - Sending in tight loop
for (let i = 0; i < 1000; i++) {
    await parley.send('item-update', { index: i }, { targetId: 'child' });
}

// CORRECT - Batch messages
const batch = [];
for (let i = 0; i < 1000; i++) {
    batch.push({ index: i });
}

await parley.send('batch-update', { items: batch }, { targetId: 'child' });
```

**Step 3**: Use async operations in handlers.

```typescript
// WRONG - Blocking synchronous operation
parley.on('process-data', (payload, respond) => {
    const result = expensiveSyncCalculation(payload.data); // Blocks!
    respond({ result });
});

// CORRECT - Async operation
parley.on('process-data', async (payload, respond) => {
    // Use async version or break into chunks
    const result = await expensiveAsyncCalculation(payload.data);
    respond({ result });
});

// Or process in chunks with yields
parley.on('process-data', async (payload, respond) => {
    const chunks = splitIntoChunks(payload.data);
    const results = [];

    for (const chunk of chunks) {
        const result = processChunk(chunk);
        results.push(result);

        // Yield to event loop
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    respond({ results });
});
```

**Step 4**: Debounce high-frequency updates.

```typescript
// WRONG - Send on every scroll event
window.addEventListener('scroll', () => {
    parley.send(
        'scroll-update',
        {
            scrollY: window.scrollY,
        },
        { targetId: 'child', expectsResponse: false }
    );
});

// CORRECT - Debounce updates
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

const sendScrollUpdate = debounce(() => {
    parley.send(
        'scroll-update',
        {
            scrollY: window.scrollY,
        },
        { targetId: 'child', expectsResponse: false }
    );
}, 100); // Send at most once per 100ms

window.addEventListener('scroll', sendScrollUpdate);
```

**Step 5**: Use fire-and-forget for non-critical updates.

```typescript
// WRONG - Waiting for response unnecessarily
await parley.send(
    'activity-ping',
    {
        userId: 123,
        timestamp: Date.now(),
    },
    { targetId: 'child' }
); // Blocks until response

// CORRECT - Fire-and-forget for non-critical updates
await parley.send(
    'activity-ping',
    {
        userId: 123,
        timestamp: Date.now(),
    },
    {
        targetId: 'child',
        expectsResponse: false, // No waiting
    }
);
```

**Prevention**:

- Keep payloads under 1MB
- Batch multiple messages when possible
- Use async/await for slow operations
- Debounce high-frequency events
- Use expectsResponse: false for notifications
- Monitor message frequency in production

```typescript
// Performance monitoring helper
class PerformanceMonitor {
    constructor() {
        this.messageCounts = new Map();
        this.startTime = Date.now();
    }

    logMessage(messageType) {
        const count = this.messageCounts.get(messageType) || 0;
        this.messageCounts.set(messageType, count + 1);
    }

    getStats() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const stats = {};

        this.messageCounts.forEach((count, type) => {
            stats[type] = {
                total: count,
                perSecond: (count / elapsed).toFixed(2),
            };
        });

        return stats;
    }
}

// Use in development
const monitor = new PerformanceMonitor();

// system:message_sent fires for every outgoing message; listeners are not
// awaited, so they never delay delivery
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    monitor.logMessage(event.messageType);
});

// Check stats periodically
setInterval(() => {
    console.log('Message stats:', monitor.getStats());
}, 10000);
```

**Related**:

- [Performance Patterns](../CODE_PATTERNS.md#performance-patterns) - Batching
  and debouncing
- [Best Practices](../ARCHITECTURE.md#performance-considerations) - Performance
  optimization
- [Batching Example](../patterns/request-response.md#variation-3-batch-request-response) -
  Message batching

---

## Configuration Errors

### "Configuration error: ..." thrown by Parley.create()

**Symptoms**:

```
Error: Configuration error: ...
Parley.create() throws before any connection is attempted
```

**Root Cause**: `Parley.create()` validates its configuration and throws a plain
`Error` whose message starts with `Configuration error:` when:

- `targetType` is missing or not `'iframe'` / `'window'`
- `timeout` is not a positive number
- `retries` is negative
- `allowedOrigins` is not an array, is empty, or contains a non-string, an empty
  string, `'null'` (any case), or any entry containing `'*'` (such as `'*'` or
  `'*.example.com'`)

**Solution**:

```typescript
// WRONG
Parley.create({ allowedOrigins: ['*'] }); // no targetType, wildcard origin

// CORRECT
const parley = Parley.create({
    targetType: 'iframe', // or 'window' for popups
    allowedOrigins: ['https://child.example.com'],
    timeout: 5000,
    retries: 0,
});
```

If you load your pages from `file://`, serve them over http(s) instead (for
example with a local dev server). `file://` pages have the `'null'` origin,
which cannot be allowed.

---

## Handler Errors

### ERR_HANDLER_ERROR / ERR_NO_HANDLER

**Symptoms**:

```
ParleyError: ERR_HANDLER_ERROR - Handler error
ParleyError: ERR_NO_HANDLER
```

**Root Cause**: `ERR_HANDLER_ERROR` means the receiver's handler threw (or
returned a rejected Promise). The sender only sees the generic message
`'Handler error'` unless the RECEIVER was created with
`exposeHandlerErrors: true`. `ERR_NO_HANDLER` means the receiver has no handler
for that message type.

**Solution**:

```typescript
// Receiver: see the real error locally
childParley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    if (event.code === 'ERR_HANDLER_ERROR') {
        console.error('Handler failed:', event.message, event.messageId);
    }
});

// Or per message type
childParley.register('get-data', {
    onError: (error, metadata) => {
        console.error('get-data failed:', error.message, metadata.senderId);
    },
});

// Between trusted windows only: forward real messages to the sender
const childParley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://parent.example.com'],
    exposeHandlerErrors: true,
});
```

For `ERR_NO_HANDLER`, check that the receiver calls `on()` with exactly the same
type string before the message arrives.

---

## Rate Limit Errors

### ERR_SECURITY_RATE_LIMITED

**Symptoms**:

```
ParleyError: ERR_SECURITY_RATE_LIMITED
send() rejects during bursts of messages
```

**Root Cause**: Rate limiting is opt-in. With
`rateLimit: { enabled: true, messagesPerSecond: N }`, outgoing `send()` calls
beyond `N` per one-second window (per `targetId`, or global for untargeted
sends) are rejected. `broadcast()` and inbound messages are not rate limited.

**Solution**:

- Batch or debounce high-frequency messages (see
  [Performance Issues](#performance-issues))
- Raise `messagesPerSecond` if the limit is too strict for your use case
- Catch the error and retry after a short delay if the message must go through

```typescript
try {
    await parley.send('update', data, { targetId: 'child' });
} catch (error) {
    if (error.code === 'ERR_SECURITY_RATE_LIMITED') {
        queueForLater(data);
    } else {
        throw error;
    }
}
```

---

## Still Having Issues?

If you're still experiencing problems after trying these solutions:

1. **Enable debug logging** to see detailed logs:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.com'],
    logLevel: 'debug',
});
```

2. **Check the complete troubleshooting guide**:
   [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

3. **Review working examples**: [Examples Directory](../examples/index.md)

4. **Search existing issues**:
   [GitHub Issues](https://github.com/WebDev-Guy/parley-js/issues)

5. **Ask for help**: Open a new issue with:
    - ParleyJS version
    - Browser and version
    - Minimal reproduction code
    - Error messages
    - Debug logs

---

## Related Documentation

**Troubleshooting**:

- [Complete Troubleshooting Guide](../TROUBLESHOOTING.md) - Debugging strategies
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling
  strategies

**Guides**:

- [iFrame Communication](../guides/iframe-communication.md#common-mistakes) -
  iframe mistakes
- [Popup Communication](../guides/popup-communication.md#common-mistakes) -
  Popup mistakes
- [Getting Started](../getting-started/first-example.md) - Basic setup

**Patterns**:

- [Error Handling](../patterns/error-handling.md) - Error handling strategies
- [Request-Response](../patterns/request-response.md) - Request-response
  patterns

**Security**:

- [Origin Validation](../security/origin-validation.md) - Origin validation
  guide
- [Message Validation](../security/message-validation.md) - Payload validation

---

**Previous**: [Troubleshooting Home](./index.md) **Next**:
[Complete Troubleshooting Guide](../TROUBLESHOOTING.md) **Back to**:
[Documentation Home](../index.md)
