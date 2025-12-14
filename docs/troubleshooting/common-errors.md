[Home](../../README.md) > [Troubleshooting](./README.md) > Common Errors

# Common ParleyJS Errors and Solutions

Quick solutions to frequently encountered ParleyJS errors and problems. This guide uses an FAQ-style format to help you quickly diagnose and fix issues.

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

---

## Origin Mismatch Errors

### ERR_SECURITY_ORIGIN_MISMATCH

**Symptoms**:
```
Error: ERR_SECURITY_ORIGIN_MISMATCH - Message from unexpected origin
SecurityError: Origin validation failed
Messages silently dropped with no error
```

**Root Cause**:
The origin of the incoming message does not match any origin in the `allowedOrigins` configuration. Origins must match exactly including protocol, hostname, and port.

**Solution**:

**Step 1**: Check the exact origin in both windows.
```javascript
// Add this to both parent and child to debug
console.log('My origin is:', window.location.origin);

window.addEventListener('message', (event) => {
    console.log('Received message from:', event.origin);
});
```

**Step 2**: Verify protocol matches (http vs https).
```javascript
// WRONG - Protocol mismatch
// Parent expects: https://child.example.com
// Child is running on: http://child.example.com

// CORRECT - Protocols match
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'] // Match exactly
});
```

**Step 3**: Verify hostname matches exactly (case-sensitive).
```javascript
// WRONG - Different hostnames
allowedOrigins: ['https://app.example.com']
// Child is on: https://dashboard.example.com

// CORRECT - Add all origins
allowedOrigins: [
    'https://app.example.com',
    'https://dashboard.example.com'
]
```

**Step 4**: Verify port if specified (or omit for defaults).
```javascript
// WRONG - Explicit default ports
allowedOrigins: ['https://example.com:443']

// CORRECT - Omit default ports (443 for https, 80 for http)
allowedOrigins: ['https://example.com']
```

**Step 5**: Update configuration with exact origin.
```javascript
const parley = Parley.create({
    allowedOrigins: [
        'https://exact-origin.com' // Use exact origin from console log
    ]
});
```

**Prevention**:
- Use environment variables for origins in different environments
- Never use wildcard `'*'` in production (security risk)
- Log origins during development to verify exact values
- Remember that `localhost` and `127.0.0.1` are different origins

```javascript
// Use environment-based configuration
const parley = Parley.create({
    allowedOrigins: [
        process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : 'https://app.production.com'
    ]
});
```

**Related**:
- [Origin Validation Guide](../security/origin-validation.md) - Complete origin validation documentation
- [Security Best Practices](../security/README.md) - Security configuration
- [Parley.create()](../api-reference/methods.md#create) - Configuration options

---

## Messages Not Being Received

### Handler Never Called

**Symptoms**:
```
send() completes without error
Handler function never invoked
No console errors or warnings
Silent failure with no feedback
```

**Root Cause**:
Message handlers are registered after messages are sent, message type strings don't match exactly, or origin validation is silently rejecting messages.

**Solution**:

**Step 1**: Register handlers before sending messages.
```javascript
// WRONG - Race condition
await parley.connect(iframe.contentWindow, 'child');
await parley.send('hello', { text: 'Hi' }, { targetId: 'child' });
parley.on('hello', (payload) => {
    console.log(payload); // Never called - registered too late!
});

// CORRECT - Register handlers first
parley.on('hello', (payload) => {
    console.log(payload); // Called correctly
});
await parley.connect(iframe.contentWindow, 'child');
await parley.send('hello', { text: 'Hi' }, { targetId: 'child' });
```

**Step 2**: Verify message type strings match exactly (case-sensitive).
```javascript
// Sender
await parley.send('user-login', data, { targetId: 'child' });

// WRONG - Typo or different casing
parley.on('userLogin', (data) => { }); // Never called!

// CORRECT - Exact match
parley.on('user-login', (data) => { }); // Called correctly
```

**Step 3**: Check for origin validation issues.
```javascript
// Enable debug mode to see rejected messages
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
    debug: true // Logs all messages and rejections
});

// Listen for system events
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('ParleyJS Error:', event);
});
```

**Step 4**: Verify both windows have called connect().
```javascript
// Parent must connect
await parley.connect(iframe.contentWindow, 'child');

// Child must also connect (in iframe)
await parley.connect(window.parent, 'parent');
```

**Step 5**: Check that message is sent to correct target.
```javascript
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
- Enable debug mode during development
- Monitor system events for errors
- Use TypeScript for type safety on message types

```javascript
// Use constants to prevent typos
const MESSAGE_TYPES = {
    USER_LOGIN: 'user-login',
    USER_LOGOUT: 'user-logout',
    DATA_UPDATE: 'data-update'
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
- [Debugging Guide](../TROUBLESHOOTING.md#debugging-strategies) - Debugging strategies

---

## Timeout Errors

### ERR_TIMEOUT_NO_RESPONSE

**Symptoms**:
```
TimeoutError: ERR_TIMEOUT_NO_RESPONSE - No response received within timeout period
Request never resolves or rejects
Long wait before error is thrown
Handler appears to run but timeout still occurs
```

**Root Cause**:
Handler never calls `respond()`, handler throws an error before responding, timeout value is too short for the operation, or handler is not registered at all.

**Solution**:

**Step 1**: Ensure handler always calls respond().
```javascript
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

**Step 2**: Catch errors in handler and respond with error.
```javascript
// WRONG - Handler throws error, no response sent
parley.on('get-data', async (payload, respond) => {
    const data = await fetchData(payload.id); // Throws error
    respond({ data }); // Never reached!
});

// CORRECT - Catch errors and respond
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
```javascript
// WRONG - Short timeout for slow operation
await parley.send('database-query', { sql: 'SELECT * FROM huge_table' }, {
    targetId: 'child',
    timeout: 1000 // Only 1 second!
});

// CORRECT - Appropriate timeout
await parley.send('database-query', { sql: 'SELECT * FROM huge_table' }, {
    targetId: 'child',
    timeout: 30000 // 30 seconds for database query
});
```

**Step 4**: Verify handler is registered.
```javascript
// Debug: Check registered handlers
console.log('Registered handlers:', parley.getRegisteredHandlers());

// Make sure handler exists
parley.on('get-data', async (payload, respond) => {
    // Handler implementation
    respond({ data: 'response' });
});
```

**Step 5**: Handle fire-and-forget vs request-response correctly.
```javascript
// Fire-and-forget - no response expected
await parley.send('notification', { message: 'Hi' }, {
    targetId: 'child',
    expectsResponse: false // No timeout
});

// Request-response - expects response
await parley.send('get-user', { id: 123 }, {
    targetId: 'child',
    expectsResponse: true, // Default - waits for response
    timeout: 5000
});
```

**Prevention**:
- Always call `respond()` in handlers, even for errors
- Wrap handler logic in try-catch and respond with error state
- Set appropriate timeouts based on operation complexity
- Use `expectsResponse: false` for notifications
- Monitor system timeout events during development

```javascript
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
            code: error.code || 'UNKNOWN_ERROR'
        });
    }
});

// Monitor timeouts
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.warn('Timeout occurred:', {
        messageType: event.messageType,
        messageId: event.messageId,
        timeout: event.timeout
    });
});
```

**Related**:
- [Request-Response Pattern](../patterns/request-response.md) - Request-response workflows
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling strategies
- [send() Options](../api-reference/methods.md#send) - Timeout configuration
- [System Events](../api-reference/system-events.md#timeout) - Timeout events

---

## Type Validation Errors

### ERR_VALIDATION_TYPE_MISMATCH

**Symptoms**:
```
ValidationError: ERR_VALIDATION_TYPE_MISMATCH - Field type does not match schema
ValidationError: ERR_VALIDATION_REQUIRED_FIELD_MISSING - Required field missing
ValidationError: ERR_VALIDATION_SCHEMA_MISMATCH - Schema validation failed
Runtime errors about undefined properties
```

**Root Cause**:
Payload does not match the registered schema, required fields are missing, field types don't match schema definition, or no schema is registered for the message type.

**Solution**:

**Step 1**: Register message type with correct schema.
```javascript
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
            email: { type: 'string' }
        }
    }
});

parley.on('create-user', (payload, respond) => {
    // Payload is validated before handler is called
    const user = createUser(payload.name, payload.email);
    respond({ user });
});
```

**Step 2**: Ensure payload includes all required fields.
```javascript
// WRONG - Missing required field
await parley.send('create-user', {
    name: 'John Doe'
    // email is missing!
}, { targetId: 'child' });

// CORRECT - All required fields included
await parley.send('create-user', {
    name: 'John Doe',
    email: 'john@example.com'
}, { targetId: 'child' });
```

**Step 3**: Match field types to schema.
```javascript
// WRONG - Type mismatch
await parley.send('update-age', {
    userId: 123,
    age: '25' // String instead of number!
}, { targetId: 'child' });

// CORRECT - Types match schema
await parley.send('update-age', {
    userId: 123,
    age: 25 // Number
}, { targetId: 'child' });
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

// Register with schema
parley.register<CreateUserPayload>('create-user', {
    schema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
            name: { type: 'string' },
            email: { type: 'string' }
        }
    }
});

// Type-safe handler
parley.on<CreateUserPayload>('create-user', (payload, respond) => {
    // payload is typed as CreateUserPayload
    const user = createUser(payload.name, payload.email);

    respond<CreateUserResponse>({
        success: true,
        user
    });
});

// Type-safe send
const response = await parley.send<CreateUserPayload, CreateUserResponse>(
    'create-user',
    { name: 'John', email: 'john@example.com' },
    { targetId: 'child' }
);
```

**Step 5**: Validate nested objects and arrays.
```javascript
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
                items: { type: 'string' }
            },
            author: {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' }
                }
            }
        }
    }
});
```

**Prevention**:
- Always register message types with schemas before use
- Use TypeScript for compile-time type checking
- Validate payload before sending on the sender side
- Use detailed schemas that match your data structures exactly
- Handle validation errors gracefully

```javascript
// Validation helper
function validateBeforeSend(messageType, payload, schema) {
    // Use JSON Schema validator library
    const valid = validateSchema(payload, schema);

    if (!valid) {
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
- [register() Method](../api-reference/methods.md#register) - Schema registration
- [TypeScript Support](../guides/typescript.md) - Type-safe usage
- [Testing Validation](../patterns/error-handling.md#validation-errors) - Testing validation

---

## Channel Closed Errors

### ERR_CONNECTION_CLOSED / ERR_TARGET_CLOSED

**Symptoms**:
```
ConnectionError: ERR_CONNECTION_CLOSED - Channel was closed unexpectedly
TargetError: ERR_TARGET_CLOSED - Target window is closed
Messages fail after connection was working
Cannot reconnect after disconnect
```

**Root Cause**:
Target window was closed (popup/iframe removed), connection was explicitly destroyed, or window reference became invalid.

**Solution**:

**Step 1**: Check if target window is still open.
```javascript
// Check popup is still open
if (popup && !popup.closed) {
    await parley.send('message', { data: 'hello' }, { targetId: 'popup' });
} else {
    console.log('Popup was closed by user');
}
```

**Step 2**: Listen for window close events.
```javascript
// Monitor popup close
const popup = window.open('/auth.html', 'auth', 'width=500,height=600');

if (popup) {
    await parley.connect(popup, 'auth-popup');

    // Check periodically if popup is closed
    const checkClosed = setInterval(() => {
        if (popup.closed) {
            clearInterval(checkClosed);
            console.log('Popup was closed');

            // Clean up connection
            parley.disconnect('auth-popup');
        }
    }, 1000);
}
```

**Step 3**: Handle connection lost events.
```javascript
// Listen for disconnection
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from:', event.targetId, 'Reason:', event.reason);

    // Attempt reconnection if appropriate
    if (event.reason === 'CONNECTION_LOST') {
        attemptReconnect(event.targetId);
    }
});

parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.log('Connection lost to:', event.targetId);

    // Update UI to show disconnected state
    updateConnectionStatus('disconnected');
});
```

**Step 4**: Implement reconnection logic.
```javascript
async function attemptReconnect(targetId, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Reconnection attempt ${attempt}/${maxAttempts}`);

            // Get fresh window reference
            const targetWindow = getTargetWindow(targetId);

            if (!targetWindow || targetWindow.closed) {
                throw new Error('Window is closed');
            }

            await parley.connect(targetWindow, targetId);
            console.log('Reconnected successfully');
            return;
        } catch (error) {
            console.warn(`Reconnection attempt ${attempt} failed:`, error);

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    console.error('Failed to reconnect after all attempts');
}
```

**Step 5**: Clean up on window unload.
```javascript
// Graceful cleanup on page unload
window.addEventListener('beforeunload', () => {
    // Notify other windows
    parley.broadcast('window-closing', {
        windowId: 'main',
        timestamp: Date.now()
    }, { expectsResponse: false });

    // Clean up resources
    parley.destroy();
});
```

**Prevention**:
- Always check `popup.closed` before sending messages to popups
- Monitor connection status with system events
- Implement automatic reconnection for critical connections
- Clean up resources when windows close
- Handle iframe removal gracefully

```javascript
// Robust popup pattern
class PopupManager {
    constructor(parley) {
        this.parley = parley;
        this.popup = null;
        this.checkInterval = null;
    }

    async open(url, targetId) {
        this.popup = window.open(url, targetId, 'width=500,height=600');

        if (!this.popup) {
            throw new Error('Popup blocked');
        }

        await this.parley.connect(this.popup, targetId);

        // Monitor popup status
        this.checkInterval = setInterval(() => {
            if (this.popup.closed) {
                this.cleanup();
            }
        }, 1000);
    }

    cleanup() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        if (this.popup && !this.popup.closed) {
            this.popup.close();
        }

        this.popup = null;
    }
}
```

**Related**:
- [Popup Communication Guide](../guides/popup-communication.md) - Popup lifecycle management
- [Connection Management](../api-reference/methods.md#connect) - connect() and disconnect()
- [System Events](../api-reference/system-events.md#connection-events) - Connection events
- [Error Recovery](../patterns/error-handling.md#connection-errors) - Handling connection errors

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

**Root Cause**:
Event listeners not removed when components unmount, Parley instances not destroyed, multiple instances created without cleanup, or handlers registered in loops.

**Solution**:

**Step 1**: Always call destroy() when done.
```javascript
// WRONG - Memory leak
function setupConnection() {
    const parley = Parley.create({
        allowedOrigins: ['https://child.com']
    });

    parley.on('message', handleMessage);
    // Never cleaned up!
}

// CORRECT - Cleanup function
function setupConnection() {
    const parley = Parley.create({
        allowedOrigins: ['https://child.com']
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
```javascript
// React example
function ChatComponent() {
    useEffect(() => {
        const parley = Parley.create({
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
```javascript
// Register handler and get unsubscribe function
const unsubscribe = parley.on('update', (payload) => {
    console.log('Update:', payload);
});

// Later, remove this specific handler
unsubscribe();
```

**Step 4**: Avoid creating multiple Parley instances.
```javascript
// WRONG - Creates instance on every render
function Component() {
    const parley = Parley.create({ allowedOrigins: ['https://child.com'] });
    // New instance every render - memory leak!
}

// CORRECT - Create instance once
function Component() {
    const parleyRef = useRef(null);

    useEffect(() => {
        if (!parleyRef.current) {
            parleyRef.current = Parley.create({
                allowedOrigins: ['https://child.com']
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
```javascript
// Development helper
if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
        if (performance.memory) {
            console.log('Memory usage:', {
                used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
                total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB'
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

```javascript
// Singleton pattern
class ParleyManager {
    constructor() {
        if (ParleyManager.instance) {
            return ParleyManager.instance;
        }

        this.parley = Parley.create({
            allowedOrigins: [window.location.origin]
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
- [destroy() Method](../api-reference/methods.md#destroy) - Cleanup and resource management
- [React Integration](../guides/framework-integration.md#react) - Framework-specific cleanup
- [Performance Best Practices](../ARCHITECTURE.md#performance-considerations) - Memory optimization

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

**Root Cause**:
Iframe removed from DOM but code still holds reference, popup closed but not detected, window navigated away, or contentWindow accessed before iframe loaded.

**Solution**:

**Step 1**: Wait for iframe to load before accessing contentWindow.
```javascript
// WRONG - contentWindow might be null
const iframe = document.getElementById('my-iframe');
await parley.connect(iframe.contentWindow, 'child'); // May fail!

// CORRECT - Wait for load event
const iframe = document.getElementById('my-iframe');

if (iframe.contentDocument?.readyState === 'complete') {
    await parley.connect(iframe.contentWindow, 'child');
} else {
    await new Promise(resolve => {
        iframe.addEventListener('load', resolve, { once: true });
    });
    await parley.connect(iframe.contentWindow, 'child');
}
```

**Step 2**: Check window validity before sending.
```javascript
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
```javascript
// Monitor iframe removal
const iframe = document.getElementById('my-iframe');
await parley.connect(iframe.contentWindow, 'child');

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
```javascript
// Child iframe navigates
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, async (event) => {
    if (event.targetId === 'child') {
        console.log('Child connection lost, attempting reconnect...');

        // Wait a bit for navigation to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        const iframe = document.getElementById('child-iframe');
        if (iframe && iframe.contentWindow) {
            try {
                await parley.connect(iframe.contentWindow, 'child');
                console.log('Reconnected to child');
            } catch (error) {
                console.error('Failed to reconnect:', error);
            }
        }
    }
});
```

**Step 5**: Store and refresh window references safely.
```javascript
class WindowManager {
    constructor(parley) {
        this.parley = parley;
        this.windows = new Map();
    }

    registerWindow(targetId, windowRef, options = {}) {
        this.windows.set(targetId, {
            window: windowRef,
            isIframe: options.isIframe || false,
            elementId: options.elementId
        });
    }

    getWindow(targetId) {
        const entry = this.windows.get(targetId);
        if (!entry) return null;

        // Refresh iframe reference if needed
        if (entry.isIframe && entry.elementId) {
            const iframe = document.getElementById(entry.elementId);
            if (iframe) {
                entry.window = iframe.contentWindow;
            }
        }

        // Validate window is still valid
        if (!isWindowValid(entry.window)) {
            this.windows.delete(targetId);
            return null;
        }

        return entry.window;
    }
}
```

**Prevention**:
- Always wait for iframe load before accessing contentWindow
- Check popup.closed before sending messages
- Monitor iframe removal with MutationObserver
- Re-establish connections after navigation
- Use window manager pattern for complex multi-window apps

**Related**:
- [iFrame Communication](../guides/iframe-communication.md#common-mistakes) - iframe best practices
- [Popup Communication](../guides/popup-communication.md#lifecycle-management) - Popup lifecycle
- [Connection Events](../api-reference/system-events.md#connection-events) - Monitoring connections

---

## Serialization Errors

### ERR_SERIALIZATION_CIRCULAR_REFERENCE / SERIALIZE_FAILED

**Symptoms**:
```
TypeError: Converting circular structure to JSON
DataCloneError: Failed to execute 'postMessage'
Messages with functions fail silently
DOM nodes cannot be sent
```

**Root Cause**:
Payload contains circular references, payload includes functions, DOM nodes or other non-serializable objects in payload, or complex objects with prototype chains.

**Solution**:

**Step 1**: Remove circular references before sending.
```javascript
// WRONG - Circular reference
const user = { name: 'John' };
user.self = user; // Circular!

await parley.send('update-user', { user }, { targetId: 'child' });
// Error: Converting circular structure to JSON

// CORRECT - Remove circular references
const user = { name: 'John' };
user.self = user;

// Clone without circular refs
const safeUser = JSON.parse(JSON.stringify({ name: user.name }));
await parley.send('update-user', { user: safeUser }, { targetId: 'child' });
```

**Step 2**: Don't send functions or methods.
```javascript
// WRONG - Functions are not serializable
await parley.send('callback', {
    onComplete: () => console.log('Done') // Error!
}, { targetId: 'child' });

// CORRECT - Use message-based callbacks
// Parent
parley.on('operation-complete', () => {
    console.log('Done');
});

await parley.send('start-operation', {
    // Send data only, no functions
    operationId: 'op-123'
}, { targetId: 'child' });

// Child
parley.on('start-operation', async (payload, respond) => {
    await performOperation(payload.operationId);

    // Notify completion
    await parley.send('operation-complete', {
        operationId: payload.operationId
    }, { targetId: 'parent', expectsResponse: false });

    respond({ success: true });
});
```

**Step 3**: Extract data from DOM nodes.
```javascript
// WRONG - Cannot send DOM nodes
const element = document.getElementById('user-input');
await parley.send('submit', {
    element: element // Error: DataCloneError
}, { targetId: 'child' });

// CORRECT - Extract data from DOM
const element = document.getElementById('user-input');
await parley.send('submit', {
    value: element.value,
    id: element.id,
    className: element.className
}, { targetId: 'child' });
```

**Step 4**: Send plain objects only.
```javascript
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
await parley.send('update-user', {
    user: {
        name: user.name,
        email: user.email
    }
}, { targetId: 'child' });
```

**Step 5**: Use serialization helper for complex objects.
```javascript
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
    settings: appSettings
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

```javascript
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
    settings: { theme: 'dark' }
});

await parley.send('update', payload, { targetId: 'child' });
```

**Related**:
- [Message Payloads](../api-reference/methods.md#send) - Payload requirements
- [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) - What can be cloned
- [Testing Patterns](../patterns/error-handling.md#serialization-errors) - Testing serialization

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

**Root Cause**:
Trying to access properties of cross-origin windows directly, browser security policies block operations, attempting to read from cross-origin iframes, or forgetting that postMessage is the only allowed cross-origin communication.

**Solution**:

**Step 1**: Use ParleyJS for all cross-origin communication.
```javascript
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
```javascript
// WRONG - Cannot read location of cross-origin window
if (popup.location.href === 'https://expected.com/callback') {
    // SecurityError!
}

// CORRECT - Have popup send message when ready
// In popup
if (window.location.href.includes('/callback')) {
    parley.send('auth-complete', {
        success: true,
        token: getTokenFromUrl()
    }, { targetId: 'parent', expectsResponse: false });
}

// In parent
parley.on('auth-complete', (payload) => {
    console.log('Auth complete:', payload);
});
```

**Step 3**: Configure CORS if serving cross-origin resources.
```javascript
// Server configuration (Node.js/Express example)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://trusted-domain.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
```

**Step 4**: Use same-origin for sensitive operations.
```javascript
// For highly sensitive operations, ensure same origin
if (window.location.origin === 'https://trusted.com') {
    // Safe to access directly
    const data = iframe.contentWindow.sensitiveData;
} else {
    // Use ParleyJS for cross-origin
    const response = await parley.send('get-sensitive-data', {}, {
        targetId: 'child'
    });
}
```

**Step 5**: Set appropriate CSP headers.
```html
<!-- Allow specific frame sources -->
<meta http-equiv="Content-Security-Policy"
      content="frame-src https://trusted-child.com; frame-ancestors https://trusted-parent.com;">
```

**Prevention**:
- Never try to directly access cross-origin window properties
- Use ParleyJS for all cross-origin communication
- Configure CORS headers for cross-origin resource requests
- Set Content Security Policy appropriately
- Understand that postMessage is the only allowed cross-origin window communication

```javascript
// Safe cross-origin communication pattern
class CrossOriginBridge {
    constructor(parley, targetId) {
        this.parley = parley;
        this.targetId = targetId;
    }

    // All operations go through ParleyJS
    async getProperty(propertyName) {
        const response = await this.parley.send('get-property', {
            property: propertyName
        }, { targetId: this.targetId });

        return response.value;
    }

    async setProperty(propertyName, value) {
        await this.parley.send('set-property', {
            property: propertyName,
            value: value
        }, { targetId: this.targetId });
    }

    // Generic method call
    async call(methodName, ...args) {
        const response = await this.parley.send('method-call', {
            method: methodName,
            args: args
        }, { targetId: this.targetId });

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
- [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) - Cross-origin resource sharing
- [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) - Content Security Policy
- [Same-Origin Policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) - Browser security

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

**Root Cause**:
Payloads are too large, too many messages sent in tight loops, synchronous blocking operations in handlers, or no message batching for high-frequency updates.

**Solution**:

**Step 1**: Keep payloads small (< 1MB recommended).
```javascript
// WRONG - Sending huge payload
await parley.send('update', {
    data: hugeArray, // 10MB of data!
    images: arrayOfBase64Images, // Another 5MB
    timestamp: Date.now()
}, { targetId: 'child' });

// CORRECT - Send reference or chunk data
await parley.send('update', {
    dataId: 'ref-123', // Just ID
    imageIds: ['img-1', 'img-2', 'img-3'], // References
    timestamp: Date.now()
}, { targetId: 'child' });

// Child fetches large data separately
const data = await fetchDataById(payload.dataId);
```

**Step 2**: Batch messages instead of sending many individual ones.
```javascript
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
```javascript
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
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    respond({ results });
});
```

**Step 4**: Debounce high-frequency updates.
```javascript
// WRONG - Send on every scroll event
window.addEventListener('scroll', () => {
    parley.send('scroll-update', {
        scrollY: window.scrollY
    }, { targetId: 'child', expectsResponse: false });
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
    parley.send('scroll-update', {
        scrollY: window.scrollY
    }, { targetId: 'child', expectsResponse: false });
}, 100); // Send at most once per 100ms

window.addEventListener('scroll', sendScrollUpdate);
```

**Step 5**: Use fire-and-forget for non-critical updates.
```javascript
// WRONG - Waiting for response unnecessarily
await parley.send('activity-ping', {
    userId: 123,
    timestamp: Date.now()
}, { targetId: 'child' }); // Blocks until response

// CORRECT - Fire-and-forget for non-critical updates
await parley.send('activity-ping', {
    userId: 123,
    timestamp: Date.now()
}, {
    targetId: 'child',
    expectsResponse: false // No waiting
});
```

**Prevention**:
- Keep payloads under 1MB
- Batch multiple messages when possible
- Use async/await for slow operations
- Debounce high-frequency events
- Use expectsResponse: false for notifications
- Monitor message frequency in production

```javascript
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
                perSecond: (count / elapsed).toFixed(2)
            };
        });

        return stats;
    }
}

// Use in development
const monitor = new PerformanceMonitor();

const originalSend = parley.send;
parley.send = function(type, ...args) {
    monitor.logMessage(type);
    return originalSend.call(this, type, ...args);
};

// Check stats periodically
setInterval(() => {
    console.log('Message stats:', monitor.getStats());
}, 10000);
```

**Related**:
- [Performance Patterns](../CODE_PATTERNS.md#performance-patterns) - Batching and debouncing
- [Best Practices](../ARCHITECTURE.md#performance-considerations) - Performance optimization
- [Batching Example](../patterns/request-response.md#batch-request-response) - Message batching

---

## Still Having Issues?

If you're still experiencing problems after trying these solutions:

1. **Enable debug mode** to see detailed logs:
```javascript
const parley = Parley.create({
    allowedOrigins: ['https://child.com'],
    debug: true
});
```

2. **Check the complete troubleshooting guide**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

3. **Review working examples**: [Examples Directory](../examples/README.md)

4. **Search existing issues**: [GitHub Issues](https://github.com/WebDev-Guy/parley-js/issues)

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
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling strategies

**Guides**:
- [iFrame Communication](../guides/iframe-communication.md#common-mistakes) - iframe mistakes
- [Popup Communication](../guides/popup-communication.md#common-mistakes) - Popup mistakes
- [Getting Started](../getting-started/first-example.md) - Basic setup

**Patterns**:
- [Error Handling](../patterns/error-handling.md) - Error handling strategies
- [Request-Response](../patterns/request-response.md) - Request-response patterns

**Security**:
- [Origin Validation](../security/origin-validation.md) - Origin validation guide
- [Message Validation](../security/message-validation.md) - Payload validation

---

**Previous**: [Troubleshooting Home](./README.md)
**Next**: [Complete Troubleshooting Guide](../TROUBLESHOOTING.md)
**Back to**: [Documentation Home](../README.md)
