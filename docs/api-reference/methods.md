[Home](../../README.md) > [API Reference](./README.md) > Methods

# ParleyJS API Methods

Complete reference for all ParleyJS public methods and APIs.

## Table of Contents

### Static Methods
- [Parley.create()](#parleycreate) - Create a new Parley instance
- [Parley.VERSION](#parleyversion) - Get library version
- [SYSTEM_EVENTS](#system_events) - System event constants

### Instance Methods
- [register()](#register) - Register a message type with optional schema
- [on()](#on) - Listen for incoming messages
- [send()](#send) - Send a message to a target
- [broadcast()](#broadcast) - Broadcast to all connected targets
- [connect()](#connect) - Connect to an iframe or window
- [disconnect()](#disconnect) - Disconnect from a target
- [onSystem()](#onsystem) - Listen for system events
- [onAnalyticsEvent()](#onanalyticsevent) - Register analytics handler
- [getConnectedTargets()](#getconnectedtargets) - Get all connected target IDs
- [isConnected()](#isconnected) - Check if a target is connected
- [destroy()](#destroy) - Destroy instance and clean up resources

### Instance Properties
- [instanceId](#instanceid) - Get the instance identifier
- [targetType](#targettype) - Get the configured target type

---

## Static Methods

### Parley.create()

Creates a new Parley instance with the specified configuration.

**Signature:**
```typescript
static create(config: ParleyConfig): Parley
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| config | `ParleyConfig` | Yes | Configuration options for the instance |
| config.targetType | `'iframe' \| 'window'` | Yes | Type of communication target |
| config.allowedOrigins | `string[]` | Yes | List of allowed origins for security validation |
| config.timeout | `number` | No | Default timeout in milliseconds (default: 5000) |
| config.retries | `number` | No | Default number of retries (default: 0) |
| config.logLevel | `'none' \| 'error' \| 'warn' \| 'info' \| 'debug'` | No | Logging level (default: 'none') |
| config.heartbeat | `HeartbeatConfig` | No | Heartbeat configuration for connection monitoring |
| config.instanceId | `string` | No | Custom instance identifier |

**Returns:**
- `Parley` - New Parley instance

**Throws:**
- None (configuration validation happens during usage)

**Example:**
```typescript
import { Parley } from 'parley-js';

// Basic configuration
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com']
});

// Advanced configuration with heartbeat
const parley = Parley.create({
    targetType: 'window',
    allowedOrigins: ['https://trusted.com', 'https://another.com'],
    timeout: 10000,
    retries: 2,
    logLevel: 'debug',
    heartbeat: {
        enabled: true,
        interval: 5000,
        timeout: 2000,
        maxMissed: 3
    }
});
```

**Common Mistakes:**

**Mistake:** Not specifying `allowedOrigins`
```typescript
// Wrong - allowedOrigins defaults to current origin only
const parley = Parley.create({
    targetType: 'iframe'
});
```

**Correct:**
```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com']
});
```

**See Also:**
- [ParleyConfig type](./types.md#parleyconfig)
- [HeartbeatConfig type](./types.md#heartbeatconfig)
- [Security: Origin Validation](../security/origin-validation.md)

---

### Parley.VERSION

Static property containing the current library version.

**Type:**
```typescript
static readonly VERSION: string
```

**Example:**
```typescript
console.log('ParleyJS version:', Parley.VERSION); // "1.0.0"
```

---

### SYSTEM_EVENTS

Exported constant object containing all system event names for type-safe event listening.

**Type:**
```typescript
const SYSTEM_EVENTS: {
    CONNECTED: 'system:connected';
    DISCONNECTED: 'system:disconnected';
    CONNECTION_LOST: 'system:connection_lost';
    CONNECTION_STATE_CHANGED: 'system:connection_state_changed';
    HEARTBEAT_MISSED: 'system:heartbeat_missed';
    ERROR: 'system:error';
    TIMEOUT: 'system:timeout';
    MESSAGE_SENT: 'system:message_sent';
    MESSAGE_RECEIVED: 'system:message_received';
    RESPONSE_SENT: 'system:response_sent';
    RESPONSE_RECEIVED: 'system:response_received';
    HANDSHAKE_START: 'system:handshake_start';
    HANDSHAKE_COMPLETE: 'system:handshake_complete';
    HANDSHAKE_FAILED: 'system:handshake_failed';
}
```

**Example:**
```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

const parley = Parley.create({ /* config */ });

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('Error:', event.code, event.message);
});
```

**See Also:**
- [onSystem()](#onsystem)
- [System Events Reference](./README.md#system-events)

---

## Instance Methods

### register()

Registers a message type with optional JSON Schema validation. Registration is optional but recommended for type safety and payload validation.

**Signature:**
```typescript
register(messageType: string, options?: MessageRegistrationOptions): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| messageType | `string` | Yes | Unique message type identifier |
| options | `MessageRegistrationOptions` | No | Registration options |
| options.schema | `JSONSchema` | No | JSON Schema for payload validation |
| options.timeout | `number` | No | Custom timeout for this message type |
| options.retries | `number` | No | Custom retry count for this message type |

**Returns:**
- `void`

**Throws:**
- `ValidationError` - If message type is already registered

**Example:**
```typescript
// Register with schema validation
parley.register('user:update', {
    schema: {
        type: 'object',
        required: ['userId', 'name'],
        properties: {
            userId: { type: 'number' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' }
        }
    },
    timeout: 10000,  // 10 second timeout for user updates
    retries: 2       // Retry twice on failure
});

// Register without schema
parley.register('notification');

// Register with custom timeout only
parley.register('file:upload', {
    timeout: 60000  // 60 second timeout for uploads
});
```

**Common Mistakes:**

**Mistake:** Registering the same type twice
```typescript
// Wrong - throws ValidationError
parley.register('greeting');
parley.register('greeting');  // Error!
```

**Mistake:** Schema doesn't match sent payload
```typescript
// Register with strict schema
parley.register('user:data', {
    schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'number' } }
    }
});

// Wrong - sends string instead of number
await parley.send('user:data', { id: '123' });  // ValidationError
```

**Correct:**
```typescript
await parley.send('user:data', { id: 123 });  // Works
```

**See Also:**
- [on()](#on)
- [send()](#send)
- [Schema Validation Guide](../EXAMPLES.md#schema-validation)
- [JSON Schema Documentation](https://json-schema.org/)

---

### on()

Registers a message handler for a specific message type. Returns an unsubscribe function to remove the handler.

**Signature:**
```typescript
on<T>(messageType: string, handler: MessageHandler<T>): () => void
```

**Handler Signature:**
```typescript
type MessageHandler<T> = (
    payload: T,
    respond: (response: unknown) => void,
    metadata: MessageMetadata
) => void | Promise<void>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| messageType | `string` | Yes | Message type to listen for |
| handler | `MessageHandler<T>` | Yes | Handler function with three parameters |

**Handler Parameters:**

| Name | Type | Description |
|------|------|-------------|
| payload | `T` | The message payload data |
| respond | `(response: unknown) => void` | Function to send response back to sender |
| metadata | `MessageMetadata` | Message metadata (origin, targetId, messageId, timestamp) |

**Returns:**
- `() => void` - Unsubscribe function to remove the handler

**Throws:**
- None

**Example:**
```typescript
// Basic handler
parley.on('greeting', (payload, respond, metadata) => {
    console.log('Received greeting:', payload);
    console.log('From origin:', metadata.origin);

    respond({ message: 'Hello back!' });
});

// Handler with type safety
interface UserData {
    userId: number;
    name: string;
}

parley.on<UserData>('user:update', async (payload, respond, metadata) => {
    // payload is typed as UserData
    console.log(`Updating user ${payload.userId}: ${payload.name}`);

    // Async processing
    await saveUserToDatabase(payload);

    respond({ success: true, timestamp: Date.now() });
});

// Unsubscribe when done
const unsubscribe = parley.on('notification', (payload) => {
    console.log('Notification:', payload);
});

// Later: stop listening
unsubscribe();

// Fire-and-forget (no response needed)
parley.on('analytics:event', (payload, respond, metadata) => {
    trackEvent(payload);
    // Don't call respond() - no response needed
});
```

**Common Mistakes:**

**Mistake:** Forgetting to call `respond()` when sender expects response
```typescript
// Wrong - sender will timeout waiting for response
parley.on('getData', (payload, respond) => {
    const data = fetchData();
    // Forgot to call respond(data)
});
```

**Correct:**
```typescript
parley.on('getData', (payload, respond) => {
    const data = fetchData();
    respond(data);  // Send response
});
```

**Mistake:** Calling `respond()` multiple times
```typescript
// Wrong - only first respond() is used
parley.on('getData', (payload, respond) => {
    respond({ status: 'processing' });
    respond({ status: 'complete' });  // Ignored
});
```

**Correct:** Only call `respond()` once per message
```typescript
parley.on('getData', async (payload, respond) => {
    const result = await processData();
    respond(result);  // Single response
});
```

**See Also:**
- [register()](#register)
- [send()](#send)
- [MessageMetadata type](./types.md#messagemetadata)
- [Request-Response Pattern](../patterns/request-response.md)

---

### send()

Sends a message to a target and optionally waits for a response. Supports fire-and-forget and request-response patterns.

**Signature:**
```typescript
async send<T, R = unknown>(
    messageType: string,
    payload: T,
    options?: SendOptions
): Promise<R | undefined>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| messageType | `string` | Yes | Message type to send |
| payload | `T` | Yes | Message payload data |
| options | `SendOptions` | No | Send options |
| options.targetId | `string` | No | Specific target ID (default: first connected target) |
| options.expectsResponse | `boolean` | No | Whether to wait for response (default: true) |
| options.timeout | `number` | No | Custom timeout in milliseconds |
| options.retries | `number` | No | Custom retry count |

**Returns:**
- `Promise<R | undefined>` - Response data if `expectsResponse` is true, undefined otherwise

**Throws:**
- `ValidationError` (ERR_VALIDATION_SCHEMA_MISMATCH) - Payload doesn't match registered schema
- `TargetNotFoundError` (ERR_TARGET_NOT_CONNECTED) - Target not found or not connected
- `TimeoutError` (ERR_TIMEOUT_NO_RESPONSE) - No response received within timeout
- `ConnectionError` (ERR_CONNECTION_CLOSED) - Connection closed during send

**Example:**
```typescript
// Basic request-response
const response = await parley.send('getData', { id: 123 });
console.log('Response:', response);

// Send to specific target
await parley.send('update', { value: 42 }, {
    targetId: 'child-iframe',
    timeout: 10000
});

// Fire-and-forget (no response needed)
await parley.send('notification', { message: 'Hello' }, {
    expectsResponse: false
});

// With type safety
interface Request {
    userId: number;
}

interface Response {
    user: { id: number; name: string };
}

const result = await parley.send<Request, Response>('user:get', {
    userId: 123
});

console.log('User name:', result.user.name);

// With retry
try {
    const data = await parley.send('critical:operation', payload, {
        timeout: 5000,
        retries: 3  // Retry up to 3 times
    });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.error('Operation timed out after retries');
    }
}
```

**Common Mistakes:**

**Mistake:** Not handling timeout errors
```typescript
// Wrong - unhandled timeout will crash
const response = await parley.send('getData', {});
```

**Correct:**
```typescript
import { TimeoutError } from 'parley-js';

try {
    const response = await parley.send('getData', {});
} catch (error) {
    if (error instanceof TimeoutError) {
        console.error('Request timed out');
    }
}
```

**Mistake:** Sending before target is connected
```typescript
// Wrong - target not connected yet
const iframe = document.getElementById('myframe');
await parley.send('message', {}, { targetId: 'myframe' });  // Fails
```

**Correct:**
```typescript
const iframe = document.getElementById('myframe');
await parley.connect(iframe, 'myframe');  // Connect first
await parley.send('message', {}, { targetId: 'myframe' });  // Works
```

**Mistake:** Using `expectsResponse: false` but awaiting result
```typescript
// Wrong - result will always be undefined
const response = await parley.send('notify', {}, {
    expectsResponse: false
});
console.log(response);  // undefined
```

**Correct:** Don't await fire-and-forget messages
```typescript
// Don't need await if not expecting response
parley.send('notify', {}, { expectsResponse: false });

// OR: Use await for consistency but ignore result
await parley.send('notify', {}, { expectsResponse: false });
```

**See Also:**
- [on()](#on)
- [broadcast()](#broadcast)
- [Error Codes Reference](./error-codes.md)
- [Request-Response Pattern](../patterns/request-response.md)
- [Error Handling Pattern](../patterns/error-handling.md)

---

### broadcast()

Broadcasts a message to all connected targets. This is a fire-and-forget operation that doesn't wait for responses.

**Signature:**
```typescript
broadcast<T>(messageType: string, payload: T): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| messageType | `string` | Yes | Message type to broadcast |
| payload | `T` | Yes | Message payload data |

**Returns:**
- `void`

**Throws:**
- `ValidationError` (ERR_VALIDATION_SCHEMA_MISMATCH) - Payload doesn't match schema

**Example:**
```typescript
// Notify all connected windows
parley.broadcast('state:changed', {
    version: 42,
    timestamp: Date.now()
});

// Broadcast configuration update
parley.broadcast('config:update', {
    theme: 'dark',
    language: 'en'
});

// With type safety
interface StateUpdate {
    key: string;
    value: unknown;
}

parley.broadcast<StateUpdate>('state:update', {
    key: 'user.preferences',
    value: { notifications: true }
});
```

**Common Mistakes:**

**Mistake:** Expecting responses from broadcast
```typescript
// Wrong - broadcast doesn't return responses
const responses = await parley.broadcast('update', {});  // No responses
```

**Correct:** Use individual `send()` calls if responses are needed
```typescript
const targets = parley.getConnectedTargets();
const responses = await Promise.all(
    targets.map(id => parley.send('update', {}, { targetId: id }))
);
```

**See Also:**
- [send()](#send)
- [getConnectedTargets()](#getconnectedtargets)
- [Multi-Window Communication Guide](../guides/multi-window-communication.md)

---

### connect()

Establishes a connection to an iframe or window target. This must be called before sending messages.

**Signature:**
```typescript
async connect(target: HTMLIFrameElement | Window, targetId?: string): Promise<void>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| target | `HTMLIFrameElement \| Window` | Yes | The iframe element or window object to connect to |
| targetId | `string` | No | Custom identifier for the target (auto-generated if not provided) |

**Returns:**
- `Promise<void>` - Resolves when connection is established

**Throws:**
- `ConnectionError` (ERR_CONNECTION_HANDSHAKE_FAILED) - Handshake failed or timed out
- `TargetError` (ERR_TARGET_DUPLICATE_ID) - Target ID already registered
- `ConnectionError` (ERR_CONNECTION_FAILED) - Connection failed

**Example:**
```typescript
// Connect to iframe
const iframe = document.getElementById('child') as HTMLIFrameElement;
await parley.connect(iframe, 'child-frame');

// Connect to popup window
const popup = window.open('https://example.com/popup', '_blank');
if (popup) {
    await parley.connect(popup, 'payment-popup');
}

// Connect to parent (from within iframe)
await parley.connect(window.parent, 'parent');

// Wait for iframe to load before connecting
iframe.addEventListener('load', async () => {
    await parley.connect(iframe, 'child');
    console.log('Connected to child');
});

// With error handling
try {
    await parley.connect(iframe, 'child');
} catch (error) {
    if (error instanceof ConnectionError) {
        console.error('Connection failed:', error.message);
    }
}
```

**Common Mistakes:**

**Mistake:** Connecting before iframe loads
```typescript
// Wrong - iframe not ready yet
const iframe = document.createElement('iframe');
iframe.src = 'child.html';
document.body.appendChild(iframe);
await parley.connect(iframe);  // Fails - iframe not loaded
```

**Correct:**
```typescript
const iframe = document.createElement('iframe');
iframe.src = 'child.html';
document.body.appendChild(iframe);

iframe.addEventListener('load', async () => {
    await parley.connect(iframe);  // Works - iframe loaded
});
```

**Mistake:** Not handling connection errors
```typescript
// Wrong - connection might fail
await parley.connect(iframe);
```

**Correct:**
```typescript
import { ConnectionError, TimeoutError } from 'parley-js';

try {
    await parley.connect(iframe);
} catch (error) {
    if (error instanceof TimeoutError) {
        console.error('Connection timed out');
    } else if (error instanceof ConnectionError) {
        console.error('Connection failed:', error.message);
    }
}
```

**See Also:**
- [disconnect()](#disconnect)
- [isConnected()](#isconnected)
- [onSystem()](#onsystem)
- [iFrame Communication Guide](../guides/iframe-communication.md)
- [Popup Communication Guide](../guides/popup-communication.md)

---

### disconnect()

Gracefully disconnects from a target with notification to the other side.

**Signature:**
```typescript
async disconnect(targetId: string): Promise<void>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| targetId | `string` | Yes | ID of target to disconnect from |

**Returns:**
- `Promise<void>` - Resolves when disconnection is complete

**Throws:**
- None (warnings logged if target not found)

**Example:**
```typescript
// Disconnect from specific target
await parley.disconnect('child-iframe');

// Disconnect with cleanup
await parley.disconnect('popup');
console.log('Disconnected from popup');

// Listen for disconnection events
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from:', event.targetId);
    console.log('Reason:', event.reason);
});
```

**Common Mistakes:**

**Mistake:** Assuming disconnect is instant
```typescript
// Wrong - might send message before disconnect completes
await parley.disconnect('child');
await parley.send('message', {}, { targetId: 'child' });  // Might fail
```

**Correct:** Wait for disconnect to complete
```typescript
await parley.disconnect('child');
// Now safe - target is disconnected
```

**See Also:**
- [connect()](#connect)
- [destroy()](#destroy)
- [SYSTEM_EVENTS.DISCONNECTED](#system_events)

---

### onSystem()

Registers a handler for system events emitted by ParleyJS for connection lifecycle and analytics.

**Signature:**
```typescript
onSystem(event: SystemEventName, handler: (data: unknown) => void): () => void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| event | `SystemEventName` | Yes | System event name (use SYSTEM_EVENTS constant) |
| handler | `(data: unknown) => void` | Yes | Event handler function |

**Returns:**
- `() => void` - Unsubscribe function

**Throws:**
- None

**Example:**
```typescript
import { SYSTEM_EVENTS } from 'parley-js';

// Connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
    console.log('Origin:', event.origin);
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected:', event.targetId);
    console.log('Reason:', event.reason);
});

// Error events
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('Error:', event.code, event.message);
});

parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.warn('Timeout:', event.messageType);
});

// Heartbeat events
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.warn('Heartbeat missed:', event.targetId);
    console.warn('Consecutive misses:', event.consecutiveMissed);
});

parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.error('Connection lost:', event.targetId);
});

// Message tracking
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.log('Sent:', event.messageType, 'to', event.targetId);
});

// Unsubscribe when done
const unsubscribe = parley.onSystem(SYSTEM_EVENTS.CONNECTED, handler);
unsubscribe();
```

**See Also:**
- [SYSTEM_EVENTS](#system_events)
- [System Events Reference](./README.md#system-events)
- [Heartbeat Monitoring Guide](../guides/multi-window-communication.md#heartbeat-monitoring)

---

### onAnalyticsEvent()

Registers a handler for analytics events. Useful for tracking message performance and usage metrics.

**Signature:**
```typescript
onAnalyticsEvent(handler: AnalyticsEventHandler): () => void
```

**Handler Signature:**
```typescript
type AnalyticsEventHandler = (event: AnalyticsEvent) => void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| handler | `AnalyticsEventHandler` | Yes | Analytics event handler |

**Returns:**
- `() => void` - Unsubscribe function

**Throws:**
- None

**Example:**
```typescript
// Track all message events
parley.onAnalyticsEvent((event) => {
    switch (event.type) {
        case 'message_sent':
            analytics.track('Message Sent', {
                messageType: event.messageType,
                messageId: event.messageId,
                targetId: event.targetId
            });
            break;

        case 'message_received':
            analytics.track('Message Received', {
                messageType: event.messageType,
                duration: event.duration
            });
            break;
    }
});

// Send to your analytics service
parley.onAnalyticsEvent((event) => {
    fetch('/analytics', {
        method: 'POST',
        body: JSON.stringify({
            event: event.type,
            data: event
        })
    });
});
```

**See Also:**
- [Analytics Integration Example](../EXAMPLES.md#analytics-integration)

---

### getConnectedTargets()

Returns an array of all currently connected target IDs.

**Signature:**
```typescript
getConnectedTargets(): string[]
```

**Parameters:**
- None

**Returns:**
- `string[]` - Array of connected target IDs

**Throws:**
- None

**Example:**
```typescript
const targets = parley.getConnectedTargets();
console.log('Connected targets:', targets);  // ['child-1', 'child-2', 'popup']

// Send to all connected targets
for (const targetId of parley.getConnectedTargets()) {
    await parley.send('update', data, { targetId });
}

// Check if any targets are connected
if (parley.getConnectedTargets().length === 0) {
    console.log('No targets connected');
}
```

**See Also:**
- [isConnected()](#isconnected)
- [broadcast()](#broadcast)

---

### isConnected()

Checks if a specific target is currently connected.

**Signature:**
```typescript
isConnected(targetId: string): boolean
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| targetId | `string` | Yes | Target ID to check |

**Returns:**
- `boolean` - True if target is connected, false otherwise

**Throws:**
- None

**Example:**
```typescript
if (parley.isConnected('child-iframe')) {
    await parley.send('message', data, { targetId: 'child-iframe' });
} else {
    console.log('Child not connected, skipping message');
}

// Wait for connection
while (!parley.isConnected('popup')) {
    await new Promise(resolve => setTimeout(resolve, 100));
}
console.log('Popup connected');
```

**See Also:**
- [getConnectedTargets()](#getconnectedtargets)
- [connect()](#connect)

---

### destroy()

Destroys the Parley instance and cleans up all resources. Disconnects all targets, clears all listeners, and rejects pending requests.

**Signature:**
```typescript
destroy(): void
```

**Parameters:**
- None

**Returns:**
- `void`

**Throws:**
- None

**Example:**
```typescript
// Clean up when component unmounts
const parley = Parley.create({ /* config */ });

// Use parley...

// Later: clean up
parley.destroy();

// React example
useEffect(() => {
    const parley = Parley.create({ /* config */ });

    // Use parley...

    return () => {
        parley.destroy();  // Clean up on unmount
    };
}, []);

// Vue example
export default {
    mounted() {
        this.parley = Parley.create({ /* config */ });
    },
    beforeUnmount() {
        this.parley.destroy();  // Clean up
    }
};
```

**Common Mistakes:**

**Mistake:** Using instance after destroy
```typescript
// Wrong - instance is destroyed
parley.destroy();
await parley.send('message', {});  // Throws error
```

**Correct:** Create new instance if needed
```typescript
parley.destroy();
const newParley = Parley.create({ /* config */ });
await newParley.send('message', {});
```

**See Also:**
- [disconnect()](#disconnect)
- [React Integration Example](../EXAMPLES.md#react-integration)

---

## Instance Properties

### instanceId

Read-only property containing the unique instance identifier.

**Type:**
```typescript
readonly instanceId: string
```

**Example:**
```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://example.com'],
    instanceId: 'my-custom-id'  // Optional custom ID
});

console.log(parley.instanceId);  // "my-custom-id"

// Auto-generated ID if not specified
const parley2 = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://example.com']
});

console.log(parley2.instanceId);  // "parley_a1b2c3d4"
```

---

### targetType

Read-only property containing the configured target type.

**Type:**
```typescript
readonly targetType: 'iframe' | 'window'
```

**Example:**
```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://example.com']
});

console.log(parley.targetType);  // "iframe"
```

---

## Navigation

**Previous**: [API Reference Overview](./README.md)
**Next**: [Types Reference](./types.md)
**Back to**: [API Reference](./README.md)

**Related**:
- [Error Codes Reference](./error-codes.md)
- [Types Reference](./types.md)
- [Code Patterns](../patterns/README.md)
- [Examples](../EXAMPLES.md)
