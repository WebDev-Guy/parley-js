# API Reference

Complete API documentation for Parley-js.

## Table of Contents

- [Parley Class](#parley-class)
    - [Static Methods](#static-methods)
    - [Instance Methods](#instance-methods)
    - [Properties](#properties)
- [Types](#types)
    - [Configuration](#configuration-types)
    - [Messages](#message-types)
    - [Events](#event-types)
- [Error Classes](#error-classes)
- [Utilities](#utilities)

---

## Parley Class

The main class for inter-window communication.

### Static Methods

#### `Parley.create(config: ParleyConfig): Parley`

Creates a new Parley instance.

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://trusted.com'],
    timeout: 5000,
    debug: true,
});
```

**Parameters:**

| Parameter | Type           | Required | Default | Description          |
| --------- | -------------- | -------- | ------- | -------------------- |
| `config`  | `ParleyConfig` | Yes      | -       | Configuration object |

**Returns:** `Parley` instance

---

### Instance Methods

#### `register<T, R>(type: string, handler: MessageHandler<T, R>, options?: MessageRegistrationOptions): void`

Register a handler for a message type.

```typescript
// Basic handler
parley.register<{ name: string }, { greeting: string }>('greet', (payload) => {
    return { greeting: `Hello, ${payload.name}!` };
});

// Async handler
parley.register('fetch-data', async (payload, metadata) => {
    const data = await fetchFromAPI(payload.id);
    return data;
});

// With schema validation
parley.register('validated', handler, {
    requestSchema: {
        type: 'object',
        properties: {
            email: { type: 'string', format: 'email' },
        },
        required: ['email'],
    },
    responseSchema: {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
        },
    },
});
```

**Parameters:**

| Parameter | Type                         | Required | Description             |
| --------- | ---------------------------- | -------- | ----------------------- |
| `type`    | `string`                     | Yes      | Message type identifier |
| `handler` | `MessageHandler<T, R>`       | Yes      | Handler function        |
| `options` | `MessageRegistrationOptions` | No       | Registration options    |

**Type Parameters:**

| Type | Description   |
| ---- | ------------- |
| `T`  | Payload type  |
| `R`  | Response type |

---

#### `unregister(type: string): boolean`

Unregister a message handler.

```typescript
const removed = parley.unregister('greet');
console.log(removed); // true if handler existed
```

**Returns:** `boolean` - `true` if handler was removed

---

#### `send<T, R>(targetId: string, type: string, payload: T, options?: SendOptions): Promise<R>`

Send a message to a specific target and wait for response.

```typescript
// Basic send
const response = await parley.send<{ id: number }, { name: string }>(
    'child-iframe',
    'get-user',
    { id: 123 }
);

// With custom timeout
const response = await parley.send('child', 'slow-operation', data, {
    timeout: 30000,
    retries: 3,
});

// Fire-and-forget
await parley.send(
    'child',
    'notification',
    { message: 'Hello' },
    {
        expectsResponse: false,
    }
);
```

**Parameters:**

| Parameter  | Type          | Required | Description       |
| ---------- | ------------- | -------- | ----------------- |
| `targetId` | `string`      | Yes      | Target identifier |
| `type`     | `string`      | Yes      | Message type      |
| `payload`  | `T`           | Yes      | Message payload   |
| `options`  | `SendOptions` | No       | Send options      |

**Returns:** `Promise<R>` - Response from target

**Throws:**

- `TimeoutError` - If response not received within timeout
- `TargetNotFoundError` - If target doesn't exist
- `ValidationError` - If payload fails schema validation

---

#### `broadcast<T>(type: string, payload: T, options?: SendOptions): Promise<void>`

Send a message to all connected targets.

```typescript
await parley.broadcast('update', { timestamp: Date.now() });
```

**Parameters:**

| Parameter | Type          | Required | Description     |
| --------- | ------------- | -------- | --------------- |
| `type`    | `string`      | Yes      | Message type    |
| `payload` | `T`           | Yes      | Message payload |
| `options` | `SendOptions` | No       | Send options    |

---

#### `on<T>(type: string, handler: (payload: T, metadata: MessageMetadata) => void): () => void`

Subscribe to incoming messages of a specific type.

```typescript
const unsubscribe = parley.on<{ notification: string }>(
    'notify',
    (payload, metadata) => {
        console.log('Notification:', payload.notification);
        console.log('From:', metadata.origin);
    }
);

// Later: unsubscribe
unsubscribe();
```

**Returns:** Unsubscribe function

---

#### `onSystem(event: SystemEventName, handler: SystemEventHandler): () => void`

Subscribe to system events. Use the `SYSTEM_EVENTS` constant for type safety.

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

// Using SYSTEM_EVENTS constants (recommended)
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('New connection:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.log('Timeout:', event.messageId, event.messageType);
});

// For IIFE/browser usage
const { SYSTEM_EVENTS } = Parley;
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.log('Connection lost:', event.targetId, event.reason);
});
```

**Returns:** Unsubscribe function

---

### SYSTEM_EVENTS Constants

The `SYSTEM_EVENTS` object provides type-safe constants for all system event names:

```typescript
import { SYSTEM_EVENTS } from 'parley-js';

// Or for IIFE/browser usage:
const { SYSTEM_EVENTS } = Parley;
```

| Constant | Value | Description |
| -------- | ----- | ----------- |
| `SYSTEM_EVENTS.CONNECTED` | `'system:connected'` | Target connection established |
| `SYSTEM_EVENTS.DISCONNECTED` | `'system:disconnected'` | Target disconnected gracefully |
| `SYSTEM_EVENTS.CONNECTION_LOST` | `'system:connection_lost'` | Connection lost (heartbeat failure) |
| `SYSTEM_EVENTS.CONNECTION_STATE_CHANGED` | `'system:connection_state_changed'` | Connection state transition |
| `SYSTEM_EVENTS.HEARTBEAT_MISSED` | `'system:heartbeat_missed'` | Heartbeat response not received |
| `SYSTEM_EVENTS.ERROR` | `'system:error'` | General error occurred |
| `SYSTEM_EVENTS.TIMEOUT` | `'system:timeout'` | Message timed out |
| `SYSTEM_EVENTS.MESSAGE_SENT` | `'system:message_sent'` | Message sent (analytics) |
| `SYSTEM_EVENTS.MESSAGE_RECEIVED` | `'system:message_received'` | Message received (analytics) |
| `SYSTEM_EVENTS.RESPONSE_SENT` | `'system:response_sent'` | Response sent (analytics) |
| `SYSTEM_EVENTS.RESPONSE_RECEIVED` | `'system:response_received'` | Response received (analytics) |
| `SYSTEM_EVENTS.HANDSHAKE_START` | `'system:handshake_start'` | Handshake initiated |
| `SYSTEM_EVENTS.HANDSHAKE_COMPLETE` | `'system:handshake_complete'` | Handshake successful |
| `SYSTEM_EVENTS.HANDSHAKE_FAILED` | `'system:handshake_failed'` | Handshake failed |

### System Event Payloads

Each system event includes a typed payload:

| Event | Payload Properties |
| ----- | ------------------ |
| `CONNECTED` | `{ targetId, targetType, origin, timestamp }` |
| `DISCONNECTED` | `{ targetId, reason, timestamp }` |
| `CONNECTION_LOST` | `{ targetId, reason, timestamp }` |
| `CONNECTION_STATE_CHANGED` | `{ targetId, previousState, currentState, reason?, timestamp }` |
| `HEARTBEAT_MISSED` | `{ targetId, consecutiveMissed, timestamp }` |
| `ERROR` | `{ code, message, targetId?, messageId?, details?, timestamp }` |
| `TIMEOUT` | `{ messageId, messageType, targetId?, timeoutMs, retriesAttempted, timestamp }` |
| `MESSAGE_SENT` | `{ messageId, messageType, targetId?, expectsResponse, timestamp }` |
| `MESSAGE_RECEIVED` | `{ messageId, messageType, origin, timestamp }` |
| `RESPONSE_SENT` | `{ responseId, requestId, success, timestamp }` |
| `RESPONSE_RECEIVED` | `{ responseId, requestId, success, duration, timestamp }` |
| `HANDSHAKE_START` | `{ targetId, targetType, timestamp }` |
| `HANDSHAKE_COMPLETE` | `{ targetId, targetType, timestamp }` |
| `HANDSHAKE_FAILED` | `{ targetId, targetType, timestamp, error: { code, message } }` |

---

#### `connectIframe(id: string, iframe: HTMLIFrameElement, options: ChannelOptions): Promise<void>`

Connect to an iframe.

```typescript
const iframe = document.querySelector<HTMLIFrameElement>('#child');

await parley.connectIframe('child', iframe, {
    origin: 'https://child.example.com',
    handshakeTimeout: 10000,
});
```

**Parameters:**

| Parameter | Type                | Required | Description                           |
| --------- | ------------------- | -------- | ------------------------------------- |
| `id`      | `string`            | Yes      | Unique identifier for this connection |
| `iframe`  | `HTMLIFrameElement` | Yes      | Iframe element                        |
| `options` | `ChannelOptions`    | Yes      | Connection options                    |

**Throws:** `ConnectionError` if handshake fails

---

#### `connectWindow(id: string, windowRef: Window, options: ChannelOptions): Promise<void>`

Connect to a popup or opened window.

```typescript
const popup = window.open('https://popup.example.com', '_blank');

await parley.connectWindow('popup', popup, {
    origin: 'https://popup.example.com',
});
```

---

#### `connectParent(id: string, options: ChannelOptions): Promise<void>`

Connect to parent window (from within an iframe).

```typescript
await parley.connectParent('parent', {
    origin: 'https://parent.example.com',
});
```

---

#### `connectOpener(id: string, options: ChannelOptions): Promise<void>`

Connect to opener window (from within a popup).

```typescript
await parley.connectOpener('opener', {
    origin: 'https://opener.example.com',
});
```

---

#### `disconnect(targetId: string): Promise<void>`

Disconnect from a specific target with graceful handshake.

The disconnect process follows a two-phase handshake:
1. Send disconnect notification to the target
2. Wait for acknowledgment or timeout (1 second)
3. Clean up local resources

This ensures both sides are notified of the disconnection.

```typescript
// Basic disconnect
await parley.disconnect('child');

// With error handling
try {
    await parley.disconnect('child');
    console.log('Disconnected gracefully');
} catch (error) {
    console.log('Disconnect completed with issues:', error);
}

// Handle disconnection on the other side
parley.onSystem('system:connection_lost', (event) => {
    console.log(`Lost connection to ${event.targetId}`);
    console.log(`Reason: ${event.reason}`);
});
```

**Parameters:**

| Parameter  | Type     | Required | Description                |
| ---------- | -------- | -------- | -------------------------- |
| `targetId` | `string` | Yes      | Target to disconnect from  |

**Throws:** May throw if target doesn't exist, but always completes cleanup

---

#### `destroy(): void`

Destroy the Parley instance and clean up all resources.

```typescript
parley.destroy();
```

---

#### `onAnalytics(handler: AnalyticsEventHandler): () => void`

Register an analytics event handler.

```typescript
const unsubscribe = parley.onAnalytics((event) => {
    console.log('Analytics:', event.type, event.data);
    myAnalyticsService.track(event);
});
```

---

### Properties

#### `instanceId: string`

Unique identifier for this Parley instance.

```typescript
console.log(parley.instanceId); // e.g., "parley-abc123"
```

#### `isDestroyed: boolean`

Whether the instance has been destroyed.

```typescript
if (!parley.isDestroyed) {
    await parley.send(/* ... */);
}
```

---

## Connection Lifecycle

Parley-js provides robust connection lifecycle management with automatic health monitoring.

### Connection States

Connections progress through defined states:

```typescript
enum ConnectionState {
    CONNECTING = 'connecting',     // Handshake in progress
    CONNECTED = 'connected',       // Connection active and healthy
    DISCONNECTING = 'disconnecting', // Disconnect handshake in progress
    DISCONNECTED = 'disconnected', // Connection terminated
}
```

### Heartbeat Mechanism

When enabled, Parley automatically monitors connection health:

1. **Ping/Pong**: Parent sends periodic `system:heartbeat_ping` messages
2. **Response Tracking**: Child responds with `system:heartbeat_pong`
3. **Failure Detection**: Missed responses increment a counter
4. **Auto-Disconnect**: After `maxMissed` failures, connection is terminated

```typescript
// Configure heartbeat
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
    heartbeat: {
        enabled: true,
        interval: 5000,    // Check every 5 seconds
        timeout: 2000,     // Wait 2 seconds for response
        maxMissed: 3,      // 3 misses = disconnect
    },
});

// Monitor heartbeat health
parley.onSystem('system:heartbeat_missed', (event) => {
    console.log(`Missed heartbeat ${event.missedCount}/${event.maxMissed}`);
});
```

### Disconnect Handshake

When `disconnect()` is called, Parley performs a graceful handshake:

1. **State Change**: Connection state → `DISCONNECTING`
2. **Notify Target**: Send `system:disconnect` message
3. **Wait for Ack**: Wait up to 1 second for acknowledgment
4. **Cleanup**: Remove target and stop heartbeat
5. **Emit Events**: Fire `target:disconnected` locally

```typescript
// Graceful disconnect
await parley.disconnect('child');

// Other side is notified
parley.onSystem('system:connection_lost', (event) => {
    console.log(`Connection to ${event.targetId} was lost`);
    console.log(`Reason: ${event.reason}`); // 'remote_disconnect', 'heartbeat_failure', etc.
    console.log(`Was clean: ${event.wasClean}`); // true if graceful
});
```

### Connection Loss Detection

Connections can be lost due to:

| Reason                 | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `remote_disconnect`    | Other side called `disconnect()`               |
| `heartbeat_failure`    | Too many missed heartbeats                     |
| `send_failure`         | Too many consecutive send failures             |
| `local_disconnect`     | Local side initiated disconnect                |
| `destroyed`            | Parley instance was destroyed                  |

### State Change Events

Monitor connection state transitions:

```typescript
parley.onSystem('system:connection_state_changed', (event) => {
    console.log(`Target: ${event.targetId}`);
    console.log(`${event.previousState} → ${event.newState}`);
    if (event.reason) {
        console.log(`Reason: ${event.reason}`);
    }
});
```

### Example: Full Lifecycle Monitoring

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
    heartbeat: { enabled: true, interval: 5000 },
});

// Connection established
parley.onSystem('target:connected', (event) => {
    console.log(`Connected to ${event.targetId}`);
});

// State transitions
parley.onSystem('system:connection_state_changed', (event) => {
    console.log(`${event.targetId}: ${event.previousState} → ${event.newState}`);
});

// Heartbeat health
parley.onSystem('system:heartbeat_missed', (event) => {
    console.warn(`Heartbeat missed (${event.missedCount}/${event.maxMissed})`);
});

// Connection lost
parley.onSystem('system:connection_lost', (event) => {
    console.error(`Lost connection to ${event.targetId}: ${event.reason}`);
    // Implement reconnection logic if needed
});

// Normal disconnect
parley.onSystem('target:disconnected', (event) => {
    console.log(`Disconnected from ${event.targetId}: ${event.reason}`);
});
```

---

## Types

### Configuration Types

#### `ParleyConfig`

```typescript
interface ParleyConfig {
    /** List of allowed origins */
    allowedOrigins: string[];

    /** Enforce origin validation (default: true) */
    requireOriginMatch?: boolean;

    /** Default timeout in ms (default: 5000) */
    timeout?: number;

    /** Number of retries on timeout (default: 0) */
    retries?: number;

    /** Enable debug logging (default: false) */
    debug?: boolean;

    /** Log level: 'debug' | 'info' | 'warn' | 'error' */
    logLevel?: LogLevel;

    /** Custom instance ID */
    instanceId?: string;

    /** Enable schema validation (default: true) */
    validateMessages?: boolean;

    /** Custom security layer */
    securityLayer?: SecurityLayer;

    /** Heartbeat configuration for connection health monitoring */
    heartbeat?: HeartbeatConfig;
}
```

#### `HeartbeatConfig`

Configuration for the heartbeat/keepalive mechanism.

```typescript
interface HeartbeatConfig {
    /** Whether heartbeat is enabled (default: true) */
    enabled?: boolean;

    /** Interval between heartbeats in ms (default: 5000) */
    interval?: number;

    /** Timeout for heartbeat response in ms (default: 2000) */
    timeout?: number;

    /** Number of missed heartbeats before connection is considered lost (default: 3) */
    maxMissed?: number;

    /** Maximum consecutive send failures before disconnection (default: 3) */
    maxFailures?: number;
}
```

**Default Values:**

| Property      | Default | Description                                  |
| ------------- | ------- | -------------------------------------------- |
| `enabled`     | `true`  | Heartbeat monitoring enabled by default      |
| `interval`    | `5000`  | Send heartbeat every 5 seconds               |
| `timeout`     | `2000`  | Wait 2 seconds for heartbeat response        |
| `maxMissed`   | `3`     | Allow 3 missed heartbeats before disconnect  |
| `maxFailures` | `3`     | Allow 3 send failures before disconnect      |

**Example:**

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
    heartbeat: {
        enabled: true,
        interval: 5000,  // Check every 5 seconds
        timeout: 2000,   // Wait 2 seconds for response
        maxMissed: 3,    // Allow 3 misses = 15s total tolerance
    },
});
```

#### `ChannelOptions`

```typescript
interface ChannelOptions {
    /** Target origin (required) */
    origin: string;

    /** Handshake timeout in ms (default: 10000) */
    handshakeTimeout?: number;

    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
```

#### `SendOptions`

```typescript
interface SendOptions {
    /** Custom timeout for this message */
    timeout?: number;

    /** Number of retries */
    retries?: number;

    /** Whether to expect a response (default: true) */
    expectsResponse?: boolean;

    /** Correlation ID for tracking */
    correlationId?: string;
}
```

### Message Types

#### `MessageHandler<T, R>`

```typescript
type MessageHandler<T = unknown, R = unknown> = (
    payload: T,
    metadata: MessageMetadata
) => R | Promise<R>;
```

#### `MessageMetadata`

```typescript
interface MessageMetadata {
    /** Message ID */
    messageId: string;

    /** Sender origin */
    origin: string;

    /** Message timestamp */
    timestamp: number;

    /** Target ID (if known) */
    targetId?: string;

    /** Protocol version */
    protocolVersion: string;
}
```

#### `MessageRegistrationOptions`

```typescript
interface MessageRegistrationOptions {
    /** JSON Schema for request validation */
    requestSchema?: JSONSchema;

    /** JSON Schema for response validation */
    responseSchema?: JSONSchema;

    /** Custom timeout for this message type */
    timeout?: number;

    /** Description for documentation */
    description?: string;
}
```

### Event Types

#### `SystemEventName`

```typescript
type SystemEventName =
    | 'target:connected'
    | 'target:disconnected'
    | 'target:ready'
    | 'message:sent'
    | 'message:received'
    | 'message:handled'
    | 'error:timeout'
    | 'error:validation'
    | 'error:handler'
    | 'error:security';
```

#### `AnalyticsEvent`

```typescript
interface AnalyticsEvent {
    type: string;
    timestamp: number;
    instanceId: string;
    data: Record<string, unknown>;
}
```

---

## Error Classes

### `ParleyError`

Base class for all Parley errors.

```typescript
class ParleyError extends Error {
    code: string;
    details?: Record<string, unknown>;
}
```

### `TimeoutError`

Thrown when a message times out.

```typescript
try {
    await parley.send('target', 'message', payload);
} catch (error) {
    if (error instanceof TimeoutError) {
        console.log('Timeout after', error.details?.timeout, 'ms');
    }
}
```

### `ValidationError`

Thrown when validation fails.

```typescript
catch (error) {
    if (error instanceof ValidationError) {
        console.log('Validation errors:', error.details?.errors);
    }
}
```

### `SecurityError`

Thrown on security violations.

```typescript
catch (error) {
    if (error instanceof SecurityError) {
        console.log('Security violation:', error.message);
        console.log('Origin:', error.details?.origin);
    }
}
```

### `TargetNotFoundError`

Thrown when target doesn't exist.

```typescript
catch (error) {
    if (error instanceof TargetNotFoundError) {
        console.log('Unknown target:', error.details?.targetId);
    }
}
```

### `ConnectionError`

Thrown on connection failures.

```typescript
catch (error) {
    if (error instanceof ConnectionError) {
        console.log('Connection failed:', error.message);
        console.log('Code:', error.code);
        // Possible codes: 'CONNECTION_FAILED', 'CONNECTION_LOST', 
        //                 'NOT_CONNECTED', 'HEARTBEAT_TIMEOUT'
    }
}
```

**Error Codes:**

| Code                | Description                              |
| ------------------- | ---------------------------------------- |
| `CONNECTION_FAILED` | Initial connection/handshake failed      |
| `CONNECTION_LOST`   | Connection lost due to heartbeat failure |
| `NOT_CONNECTED`     | Target is not in connected state         |
| `HEARTBEAT_TIMEOUT` | Heartbeat response timed out             |

### `SerializationError`

Thrown when message serialization fails.

```typescript
catch (error) {
    if (error instanceof SerializationError) {
        console.log('Cannot serialize:', error.details?.value);
    }
}
```

---

## Utilities

### `generateUUID(): string`

Generate a UUID v4 string.

```typescript
import { generateUUID } from 'parley-js';
const id = generateUUID();
```

### `isValidOrigin(origin: string, allowedOrigins: string[]): boolean`

Check if an origin is in the allowed list.

```typescript
import { isValidOrigin } from 'parley-js';
const valid = isValidOrigin('https://example.com', ['https://example.com']);
```

---

## TypeScript Support

Parley-js is written in TypeScript and provides full type definitions.

### Generic Message Types

```typescript
// Define your message types
interface GetUserRequest {
    userId: string;
}

interface GetUserResponse {
    user: {
        id: string;
        name: string;
        email: string;
    };
}

// Use with full type safety
parley.register<GetUserRequest, GetUserResponse>(
    'get-user',
    async (payload) => {
        // payload is typed as GetUserRequest
        const user = await db.getUser(payload.userId);
        // Return type is checked against GetUserResponse
        return { user };
    }
);

// Send with type safety
const response = await parley.send<GetUserRequest, GetUserResponse>(
    'backend',
    'get-user',
    { userId: '123' }
);
// response.user is fully typed
```

### Type-Safe Event Handlers

```typescript
import type { SystemEventPayload } from 'parley-js';

parley.onSystem(
    'target:connected',
    (event: SystemEventPayload<'target:connected'>) => {
        // event.targetId and event.origin are typed
    }
);
```
