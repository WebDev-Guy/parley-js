[Home](./index.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > API Reference

# API Reference

Complete API documentation for Parley-js (npm package `ignite-parleyjs`, version
1.1.0).

## Table of Contents

- [Parley Class](#parley-class)
    - [Static Methods](#static-methods)
    - [Instance Methods](#instance-methods)
    - [Properties](#properties)
- [Connection Lifecycle](#connection-lifecycle)
- [Heartbeat Monitoring Example](#heartbeat-monitoring-example)
- [Types](#types)
    - [Configuration Types](#configuration-types)
    - [Message Types](#message-types)
    - [Event Types](#event-types)
- [Error Classes](#error-classes)
- [Utilities](#utilities)
- [TypeScript Support](#typescript-support)

---

## Parley Class

The main class for inter-window communication. Parley runs in the browser only
and talks to iframes (`targetType: 'iframe'`) or windows opened with
`window.open` (`targetType: 'window'`).

**Quick Links**:

- [Framework Reference](./FRAMEWORK_REFERENCE.md) - Quick start guide
- [Code Patterns](./CODE_PATTERNS.md) - Usage patterns
- [Examples](./EXAMPLES.md) - Complete examples
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

### Static Methods

#### `Parley.create(config: ParleyConfig): Parley`

Creates a new Parley instance. This is the only way to create one; the
constructor is private (no `new Parley()`).

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted.com'],
    timeout: 5000,
    logLevel: 'debug',
});
```

**Parameters:**

| Parameter | Type           | Required | Default | Description          |
| --------- | -------------- | -------- | ------- | -------------------- |
| `config`  | `ParleyConfig` | Yes      | -       | Configuration object |

**Returns:** `Parley` instance

**Throws:** a plain `Error` whose message starts with `'Configuration error: '`
when `targetType` is missing or not `'iframe'`/`'window'`, `timeout` is not a
positive number, `retries` is negative, or `allowedOrigins` is not an array, is
empty, or contains a non-string, an empty string, `'null'` or any entry
containing `'*'` (such as `'*'` or `'https://*.example.com'`). See
[ParleyConfig](#parleyconfig).

#### `Parley.VERSION: string`

The library version, `'1.1.0'`.

---

### Instance Methods

#### `register(type: string, options?: MessageRegistrationOptions): void`

Register a message type with options: schema validation, a timeout and retry
override, and an `onError` callback. `register()` does not take a handler; add
handlers with `on()`.

```typescript
// Register with schema validation
parley.register('validated-message', {
    schema: {
        type: 'object',
        properties: {
            // `format` is ignored by the validator; use `pattern`
            email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+$' },
        },
        required: ['email'],
    },
    timeout: 10000,
    onError: (error, metadata) => {
        // Inbound message failed validation, or a handler threw
        console.warn(error.code, 'from', metadata.senderId);
    },
});

// Simple registration (no schema)
parley.register('simple-message');
```

**Parameters:**

| Parameter | Type                         | Required | Description             |
| --------- | ---------------------------- | -------- | ----------------------- |
| `type`    | `string`                     | Yes      | Message type identifier |
| `options` | `MessageRegistrationOptions` | No       | Registration options    |

- The schema is checked on `send()`/`broadcast()` (locally) and on receive. Only
  the [supported keywords](#jsonschema) are enforced.
- `on()` registers unknown types automatically. Calling `register()` afterwards
  attaches the options and keeps the handlers.
- Registering the same type explicitly twice throws a plain
  `Error('Message type "x" is already registered')`. Type names starting with
  `__parley_` or `system:` are rejected.
- `onError(error, metadata)` (new in 1.1.0) is called when an inbound message of
  this type fails schema validation (`ValidationError`) or one of its handlers
  throws (wrapped in a `ParleyError` if needed).

---

#### `on<T>(type: string, handler: MessageHandler<T>): () => void`

Register a handler for incoming messages of a specific type. The handler
receives `(payload, respond, metadata)`. Reply by calling `respond(value)` once;
the handler's return value is ignored.

```typescript
// Basic handler
parley.on<{ name: string }>('greet', (payload, respond, metadata) => {
    respond({ greeting: `Hello, ${payload.name}!` });
});

// Async handler
parley.on('fetch-data', async (payload, respond, metadata) => {
    const data = await fetchFromAPI(payload.id);
    respond(data);
});

// Notification handler (no response needed)
const unsubscribe = parley.on<{ notification: string }>(
    'notify',
    (payload, respond, metadata) => {
        console.log('Notification:', payload.notification);
        console.log('From:', metadata.senderId, metadata.origin);
    }
);

// Later: unsubscribe
unsubscribe();
```

**Parameters:**

| Parameter | Type                | Required | Description             |
| --------- | ------------------- | -------- | ----------------------- |
| `type`    | `string`            | Yes      | Message type identifier |
| `handler` | `MessageHandler<T>` | Yes      | Handler function        |

**Returns:** Unsubscribe function

If a handler throws, the sender receives an `ERR_HANDLER_ERROR` error response
(message `'Handler error'` unless this side set `exposeHandlerErrors: true`),
`system:error` is emitted locally and the type's `onError` is called. If no
handler exists for an incoming type, the sender receives `ERR_NO_HANDLER`.

`on()` is only for application message types. System events use `onSystem()`
(below). To remove a handler, call the function returned by `on()` (there is no
`unregister()` method on `Parley`).

---

#### `send<T, R>(type: string, payload: T, options?: SendOptions): Promise<R | undefined>`

Send a message and, by default, wait for the response.

```typescript
// Basic send (to all connected targets; resolves with the first response)
const response = await parley.send<{ id: number }, { name: string }>(
    'get-user',
    { id: 123 }
);

// Send to specific target with custom timeout
const result = await parley.send('slow-operation', data, {
    targetId: 'child',
    timeout: 30000,
    retries: 3,
});

// Fire-and-forget (resolves with undefined)
await parley.send(
    'notification',
    { message: 'Hello' },
    {
        targetId: 'child',
        expectsResponse: false,
    }
);
```

**Parameters:**

| Parameter | Type          | Required | Description     |
| --------- | ------------- | -------- | --------------- |
| `type`    | `string`      | Yes      | Message type    |
| `payload` | `T`           | Yes      | Message payload |
| `options` | `SendOptions` | No       | Send options    |

**SendOptions:**

| Property          | Type      | Default                                        | Description                                                                                         |
| ----------------- | --------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `targetId`        | `string`  | -                                              | Target to send to. Without it the message goes to all connected targets and the first response wins |
| `timeout`         | `number`  | type `timeout`, else instance `timeout` (5000) | Timeout per attempt in milliseconds                                                                 |
| `retries`         | `number`  | type `retries`, else instance `retries` (0)    | Retries after a timeout; the same message is re-sent, with no backoff                               |
| `expectsResponse` | `boolean` | `true`                                         | Whether to wait for a response                                                                      |

**Returns:** `Promise<R | undefined>` - the response payload, or `undefined`
with `expectsResponse: false`

**Rejects with:**

- `TargetNotFoundError` (`ERR_TARGET_NOT_CONNECTED`) - no such target, or no
  connected target
- `ValidationError` (`ERR_VALIDATION_SCHEMA_MISMATCH`) - payload fails the local
  schema, or exceeds 10 MB serialized (fixed limit)
- `SerializationError` (`ERR_SERIALIZATION_CIRCULAR_REFERENCE` /
  `ERR_SERIALIZATION_SERIALIZE_FAILED`) - circular reference or `BigInt` in the
  payload (new in 1.1.0; earlier versions sent `{}`)
- `TimeoutError` (`ERR_TIMEOUT_NO_RESPONSE`) - no response after the timeout and
  all retries
- `ParleyError` with the remote code: `ERR_HANDLER_ERROR` (remote handler
  threw), `ERR_NO_HANDLER` (no handler on the other side) or
  `ERR_VALIDATION_SCHEMA_MISMATCH` (remote schema rejected the payload)
- `ConnectionError` (`ERR_CONNECTION_CLOSED`) - the target disconnected
  (`'Target disconnected'`) or the instance was destroyed
  (`'Parley instance destroyed'`) while waiting
- `ParleyError` (`ERR_SECURITY_RATE_LIMITED`) - `rateLimit` is enabled and
  exceeded

Consecutive timed-out requests sent with a `targetId` count toward
`heartbeat.maxFailures` (see [HeartbeatConfig](#heartbeatconfig)).

---

#### `broadcast<T>(type: string, payload: T): void`

Send a message to all connected targets without waiting for responses.

```typescript
parley.broadcast('update', { timestamp: Date.now() });
```

**Parameters:**

| Parameter | Type     | Required | Description     |
| --------- | -------- | -------- | --------------- |
| `type`    | `string` | Yes      | Message type    |
| `payload` | `T`      | Yes      | Message payload |

`broadcast()` returns `void` (do not `await` it), takes no options, never
expects or receives responses, and does not report per-target failures. It
throws synchronously for schema, size and serialization errors. Rate limiting
does not apply to it.

---

#### `onSystem(event: SystemEventName, handler: (data: unknown) => void): () => void`

Subscribe to system events. Use the `SYSTEM_EVENTS` constant.

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('New connection:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.log('Timeout:', event.messageId, event.messageType);
});
```

```html
<!-- IIFE/CDN build: SYSTEM_EVENTS is attached to the global Parley class -->
<script>
    const { SYSTEM_EVENTS } = window.Parley;
    parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
        console.log('Connection lost:', event.targetId, event.reason);
    });
</script>
```

**Returns:** Unsubscribe function

The handler receives `data: unknown`; in TypeScript cast it to the event's data
type (see [Event Types](#event-types)). `Parley.SYSTEM_EVENTS` only exists on
the IIFE global; with an ESM/CommonJS import, import `SYSTEM_EVENTS`.

---

### SYSTEM_EVENTS Constants

The `SYSTEM_EVENTS` object provides constants for all system event names:

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

// Or with the IIFE/browser build:
const { SYSTEM_EVENTS } = window.Parley;
```

| Constant                                 | Value                               | Description                                                             |
| ---------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `SYSTEM_EVENTS.CONNECTED`                | `'system:connected'`                | Target connection established                                           |
| `SYSTEM_EVENTS.DISCONNECTED`             | `'system:disconnected'`             | Target disconnected (any reason)                                        |
| `SYSTEM_EVENTS.CONNECTION_LOST`          | `'system:connection_lost'`          | Connection lost ungracefully (always followed by `system:disconnected`) |
| `SYSTEM_EVENTS.CONNECTION_STATE_CHANGED` | `'system:connection_state_changed'` | Connection state transition                                             |
| `SYSTEM_EVENTS.HEARTBEAT_MISSED`         | `'system:heartbeat_missed'`         | Heartbeat ping not answered in time                                     |
| `SYSTEM_EVENTS.ERROR`                    | `'system:error'`                    | Local handler threw, or an inbound message was rejected                 |
| `SYSTEM_EVENTS.TIMEOUT`                  | `'system:timeout'`                  | Request timed out after all retries                                     |
| `SYSTEM_EVENTS.MESSAGE_SENT`             | `'system:message_sent'`             | Message sent with `send()`                                              |
| `SYSTEM_EVENTS.MESSAGE_RECEIVED`         | `'system:message_received'`         | Message received                                                        |
| `SYSTEM_EVENTS.RESPONSE_SENT`            | `'system:response_sent'`            | Response sent                                                           |
| `SYSTEM_EVENTS.RESPONSE_RECEIVED`        | `'system:response_received'`        | Response received                                                       |
| `SYSTEM_EVENTS.HANDSHAKE_START`          | `'system:handshake_start'`          | Handshake initiated                                                     |
| `SYSTEM_EVENTS.HANDSHAKE_COMPLETE`       | `'system:handshake_complete'`       | Handshake successful                                                    |
| `SYSTEM_EVENTS.HANDSHAKE_FAILED`         | `'system:handshake_failed'`         | Handshake failed                                                        |

### System Event Payloads

Each system event includes a typed payload:

| Event                      | Payload Properties                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `CONNECTED`                | `{ targetId, targetType, origin, timestamp }`                                                                      |
| `DISCONNECTED`             | `{ targetId, reason: DisconnectReason, timestamp }`                                                                |
| `CONNECTION_LOST`          | `{ targetId, reason: 'heartbeat_timeout' \| 'max_failures_reached' \| 'connection_lost' \| 'cleanup', timestamp }` |
| `CONNECTION_STATE_CHANGED` | `{ targetId, previousState, currentState, reason?, timestamp }`                                                    |
| `HEARTBEAT_MISSED`         | `{ targetId, consecutiveMissed, timestamp }`                                                                       |
| `ERROR`                    | `{ code, message, targetId?, messageId?, details?, timestamp }`                                                    |
| `TIMEOUT`                  | `{ messageId, messageType, targetId?, timeoutMs, retriesAttempted, timestamp }`                                    |
| `MESSAGE_SENT`             | `{ messageId, messageType, targetId?, expectsResponse, timestamp }`                                                |
| `MESSAGE_RECEIVED`         | `{ messageId, messageType, origin, timestamp }`                                                                    |
| `RESPONSE_SENT`            | `{ responseId, requestId, success, timestamp }`                                                                    |
| `RESPONSE_RECEIVED`        | `{ responseId, requestId, success, duration, timestamp }`                                                          |
| `HANDSHAKE_START`          | `{ targetId, targetType, timestamp }`                                                                              |
| `HANDSHAKE_COMPLETE`       | `{ targetId, targetType, timestamp }`                                                                              |
| `HANDSHAKE_FAILED`         | `{ targetId, targetType, timestamp, error?: { code, message } }`                                                   |

`system:error` is emitted when a local handler throws (`ERR_HANDLER_ERROR`) and
when an inbound message is rejected by the security checks
(`ERR_SECURITY_ORIGIN_MISMATCH`, `ERR_VALIDATION_INVALID_PROTOCOL`,
`ERR_SECURITY_VERSION_MISMATCH`). Listeners for `system:message_sent` and
`system:message_received` are not awaited, so they never delay delivery. The
handshake events are emitted since 1.1.0. See
[System Events](./api-reference/system-events.md) for details.

---

#### `connect(target: HTMLIFrameElement | Window, targetId?: string): Promise<void>`

Connect to an iframe or window. Both sides must call `connect()`.

```typescript
// targetType: 'iframe' - parent page
const iframe = document.querySelector<HTMLIFrameElement>('#child')!;
await parley.connect(iframe, 'child');

// targetType: 'iframe' - page inside the iframe
await parley.connect(window.parent, 'parent');

// targetType: 'window' - opener
const popup = window.open('https://popup.example.com', '_blank');
await parley.connect(popup!, 'popup');

// targetType: 'window' - inside the popup
await parley.connect(window.opener, 'opener');
```

**Parameters:**

| Parameter  | Type                          | Required | Description                                                                                       |
| ---------- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `target`   | `HTMLIFrameElement \| Window` | Yes      | Iframe element (iframe instance, parent side), `window.parent`, a popup window or `window.opener` |
| `targetId` | `string`                      | No       | Identifier for this connection (default: the iframe's `id` attribute, otherwise generated)        |

The page inside the iframe (or the popup) re-sends the handshake until it is
acknowledged, so no `load` listener or delay is needed. Pass the iframe element,
not `iframe.contentWindow`, to an iframe instance.

**Throws:**

- `ConnectionError` (`ERR_CONNECTION_HANDSHAKE_FAILED`) - handshake not
  completed within `timeout`
- `ConnectionError` (`ERR_CONNECTION_FAILED`) - invalid target for this
  instance's `targetType`
- `TargetNotFoundError` (`ERR_TARGET_DUPLICATE_ID`) - `targetId` already in use

---

#### `disconnect(targetId: string): Promise<void>`

Disconnect from a specific target with a graceful notification.

1. The connection state changes to `DISCONNECTING` and the heartbeat stops
2. A disconnect notification is sent to the target
3. Parley waits up to 1 second for the acknowledgment
4. Local resources are cleaned up, pending requests to the target reject with
   `ConnectionError` (`ERR_CONNECTION_CLOSED`), and `system:disconnected` is
   emitted with reason `'manual_disconnect'`

The other side receives `system:disconnected` with reason `'manual_disconnect'`.

```typescript
// Basic disconnect
await parley.disconnect('child');

// Handle disconnection on the other side
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log(`Disconnected from ${event.targetId}: ${event.reason}`);
});
```

**Parameters:**

| Parameter  | Type     | Required | Description               |
| ---------- | -------- | -------- | ------------------------- |
| `targetId` | `string` | Yes      | Target to disconnect from |

An unknown `targetId` only logs a warning. A failed or unacknowledged
notification does not prevent cleanup.

---

#### `getConnectedTargets(): string[]`

IDs of all currently connected targets.

#### `isConnected(targetId: string): boolean`

Whether the target is connected.

#### `getConnectionState(targetId: string): ConnectionState | undefined`

The target's [ConnectionState](#connection-states), or `undefined` if the target
is unknown (targets are removed after they disconnect).

```typescript
import { ConnectionState } from 'ignite-parleyjs';

if (parley.getConnectionState('child') === ConnectionState.CONNECTED) {
    // ...
}
```

---

#### `destroy(): void`

Destroy the Parley instance and clean up all resources: stops heartbeats,
rejects pending requests with `ConnectionError` (`ERR_CONNECTION_CLOSED`,
`'Parley instance destroyed'`), emits `system:disconnected` with reason
`'destroyed'` for every target (1.1.0), then removes all listeners and handlers.
Peers are not notified. After `destroy()`, methods such as `send()`, `on()` and
`connect()` throw `Error('Parley instance has been destroyed')`.

```typescript
parley.destroy();
```

---

#### `onAnalyticsEvent(handler: (event: AnalyticsEvent) => void): () => void`

Register an analytics event handler. Handlers are only called when the instance
was created with `analyticsEnabled: true`.

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    analyticsEnabled: true,
});

const unsubscribe = parley.onAnalyticsEvent((event) => {
    console.log('Analytics:', event.type, event.messageType);
    if (event.type === 'response_received') {
        myAnalyticsService.timing(event.messageType, event.duration);
    }
});
```

**Returns:** Unsubscribe function

See [AnalyticsEvent](#analyticsevent) for the event fields.

---

### Properties

#### `instanceId: string`

Unique identifier for this Parley instance (`config.instanceId`, or a generated
`'parley_xxxxxxxx'`).

```typescript
console.log(parley.instanceId); // e.g. "parley_1a2b3c4d"
```

#### `targetType: 'iframe' | 'window'`

The configured target type.

---

## Connection Lifecycle

Parley-js manages connection state and monitors connection health. It detects
lost connections; it does **not** reconnect automatically.

### Connection States

Connections progress through defined states:

```typescript
enum ConnectionState {
    CONNECTING = 'connecting', // Handshake in progress
    CONNECTED = 'connected', // Connection active
    DISCONNECTING = 'disconnecting', // disconnect() in progress
    DISCONNECTED = 'disconnected', // Connection terminated
}
```

### Heartbeat Mechanism

Heartbeats are enabled by default:

1. **Ping**: Each side sends an internal heartbeat ping to each connected target
   every `interval`
2. **Pong**: The pong is the response to the ping (there is no separate pong
   message or event)
3. **Failure Detection**: A ping not answered within `heartbeat.timeout` is a
   miss and emits `system:heartbeat_missed`; any answered ping resets the count
4. **Auto-Disconnect**: After `maxMissed` consecutive misses,
   `system:connection_lost` (reason `'heartbeat_timeout'`) and
   `system:disconnected` are emitted and the target is removed

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    heartbeat: {
        enabled: true,
        interval: 5000, // Ping every 5 seconds
        timeout: 2000, // Wait 2 seconds for the response
        maxMissed: 3, // 3 consecutive misses = disconnect
    },
});

// Monitor heartbeat health
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.log(`Missed heartbeats: ${event.consecutiveMissed}/3`);
});
```

Besides heartbeats:

- **Request failures** (`heartbeat.maxFailures`, 1.1.0): after that many
  consecutive timed-out requests sent to a specific target (`send()` with
  `targetId`, expecting a response), the target is disconnected with reason
  `'max_failures_reached'`. Any response resets the count.
- **Closed windows**: a closed popup/window is detected by polling (about once
  per second) and reported with reason `'connection_lost'`, even without
  heartbeats.

### Disconnect Handshake

When `disconnect()` is called, Parley performs a graceful handshake:

1. **State Change**: Connection state → `DISCONNECTING`
2. **Notify Target**: Send an internal disconnect message
3. **Wait for Ack**: Wait up to 1 second for acknowledgment
4. **Cleanup**: Remove target, stop heartbeat, reject pending requests
5. **Emit Events**: `system:connection_state_changed` and `system:disconnected`
   (reason `'manual_disconnect'`) locally

```typescript
// Graceful disconnect
await parley.disconnect('child');

// Other side is notified
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log(`Disconnected from ${event.targetId}`);
    console.log(`Reason: ${event.reason}`); // 'manual_disconnect'
});
```

### Disconnect Reasons

`system:disconnected` carries one of these `DisconnectReason` values:

| Reason                 | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `manual_disconnect`    | `disconnect()` was called on this side, or by the other side |
| `connection_lost`      | The target window was closed                                 |
| `heartbeat_timeout`    | `maxMissed` consecutive heartbeats were missed               |
| `max_failures_reached` | `maxFailures` consecutive targeted requests timed out        |
| `cleanup`              | The target was found dead by periodic cleanup                |
| `destroyed`            | `destroy()` was called on this instance                      |

`system:connection_lost` is emitted first for `connection_lost`,
`heartbeat_timeout`, `max_failures_reached` and `cleanup`.

### State Change Events

Monitor connection state transitions:

```typescript
parley.onSystem(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, (event) => {
    console.log(`Target: ${event.targetId}`);
    console.log(`${event.previousState} → ${event.currentState}`);
    if (event.reason) {
        console.log(`Reason: ${event.reason}`);
    }
});
```

### Example: Full Lifecycle Monitoring

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    heartbeat: { enabled: true, interval: 5000 },
});

// Handshake
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_FAILED, (event) => {
    console.error(`Handshake with ${event.targetId} failed:`, event.error);
});

// Connection established
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log(`Connected to ${event.targetId}`);
});

// State transitions
parley.onSystem(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, (event) => {
    console.log(
        `${event.targetId}: ${event.previousState} → ${event.currentState}`
    );
});

// Heartbeat health
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.warn(`Heartbeat missed (${event.consecutiveMissed} in a row)`);
});

// Connection lost
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.error(`Lost connection to ${event.targetId}: ${event.reason}`);
    // Implement your own reconnection logic if needed
});

// Any disconnect
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log(`Disconnected from ${event.targetId}: ${event.reason}`);
});
```

---

## Heartbeat Monitoring Example

Connection health monitoring via heartbeats solves a common problem with
`postMessage`: detecting when an iframe or popup becomes unresponsive or is
closed.

### Why Heartbeat Monitoring?

The `postMessage` API provides no built-in way to know if:

- An iframe has crashed or become unresponsive
- A popup window was closed by the user
- The child frame navigated away

Parley's heartbeat detects these situations and notifies your application
through system events. Reconnecting is up to your application.

### Complete Example: Resilient Iframe Connection

A parent window connects to an iframe with heartbeat monitoring and reconnects
(in application code) when the connection is lost. Because both sides must call
`connect()`, the child also reconnects.

**parent.html**

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Parent - Heartbeat Monitoring Demo</title>
    </head>
    <body>
        <h1>Parent Window</h1>
        <div id="status">Status: Initializing...</div>
        <div id="heartbeat-status"></div>
        <button id="reconnect-btn" style="display: none;">Reconnect</button>

        <iframe
            id="child-frame"
            src="https://child.example.com/child.html"
        ></iframe>

        <script type="module">
            import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

            const statusEl = document.getElementById('status');
            const heartbeatEl = document.getElementById('heartbeat-status');
            const reconnectBtn = document.getElementById('reconnect-btn');
            const iframe = document.getElementById('child-frame');

            const MAX_MISSED = 3;

            // Create Parley instance with heartbeat enabled
            const parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 5000, // Ping every 5 seconds
                    timeout: 2000, // Wait 2s for the response
                    maxMissed: MAX_MISSED, // Disconnect after 3 misses
                },
            });

            // === Connection Events ===

            parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
                statusEl.textContent = `Status: Connected to ${event.targetId}`;
                statusEl.style.color = 'green';
                heartbeatEl.textContent = 'Heartbeat: Healthy';
                heartbeatEl.style.color = 'green';
                reconnectBtn.style.display = 'none';
            });

            parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
                statusEl.textContent = `Status: Disconnected (${event.reason})`;
                statusEl.style.color = 'gray';
                heartbeatEl.textContent = '';
            });

            // === Heartbeat Monitoring ===

            parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
                const { consecutiveMissed } = event;
                heartbeatEl.textContent = `Heartbeat: Warning - ${consecutiveMissed}/${MAX_MISSED} missed`;
                heartbeatEl.style.color =
                    consecutiveMissed >= 2 ? 'red' : 'orange';
            });

            parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
                statusEl.textContent = `Status: Connection Lost (${event.reason})`;
                statusEl.style.color = 'red';
                heartbeatEl.textContent = 'Heartbeat: Failed';
                heartbeatEl.style.color = 'red';
                reconnectBtn.style.display = 'block';

                // Application-level reconnect (Parley does not reconnect
                // automatically)
                if (event.reason === 'heartbeat_timeout') {
                    setTimeout(() => connectToChild(), 3000);
                }
            });

            // === Connection Function ===

            async function connectToChild() {
                try {
                    statusEl.textContent = 'Status: Connecting...';
                    statusEl.style.color = 'blue';
                    await parley.connect(iframe, 'child');
                } catch (error) {
                    statusEl.textContent = `Status: Connection failed - ${error.message}`;
                    statusEl.style.color = 'red';
                    reconnectBtn.style.display = 'block';
                }
            }

            reconnectBtn.addEventListener('click', connectToChild);

            // Initial connection
            connectToChild();
        </script>
    </body>
</html>
```

**child.html**

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Child - Heartbeat Monitoring Demo</title>
    </head>
    <body>
        <h1>Child Frame</h1>
        <div id="status">Status: Waiting for parent...</div>

        <script type="module">
            import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

            const statusEl = document.getElementById('status');

            const parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://parent.example.com'],
                heartbeat: { enabled: true },
            });

            parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
                statusEl.textContent = `Status: Connected to ${event.targetId}`;
                statusEl.style.color = 'green';
            });

            parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
                statusEl.textContent = `Status: Lost connection (${event.reason})`;
                statusEl.style.color = 'red';
                // Connect again so the parent can re-establish the connection
                connectToParent();
            });

            function connectToParent() {
                parley.connect(window.parent, 'parent').catch((error) => {
                    statusEl.textContent = `Status: ${error.message}`;
                });
            }

            connectToParent();
        </script>
    </body>
</html>
```

### Popup Window Example

Closed popups are detected by polling (about once per second) and reported as
`system:connection_lost` with reason `'connection_lost'`, independently of the
heartbeat. The heartbeat additionally detects a popup that stays open but stops
responding:

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'window',
    allowedOrigins: ['https://popup.example.com'],
    heartbeat: {
        enabled: true,
        interval: 2000,
        timeout: 1000,
        maxMissed: 2,
    },
});

// Register listeners first, then open the popup and connect
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    if (event.targetId !== 'popup') return;
    if (event.reason === 'connection_lost') {
        console.log('Popup was closed by the user');
    } else if (event.reason === 'heartbeat_timeout') {
        console.log('Popup stopped responding');
    }
});

const popup = window.open('https://popup.example.com/popup.html', '_blank');
await parley.connect(popup!, 'popup');
```

### Tuning Heartbeat Settings

A dead target is detected after roughly `maxMissed × interval + timeout` in the
worst case (approximate):

| Use Case                   | Interval | Timeout | Max Missed | Approx. Detection Time |
| -------------------------- | -------- | ------- | ---------- | ---------------------- |
| Real-time app              | 2000ms   | 1000ms  | 2          | ~5 seconds             |
| Standard iframe (defaults) | 5000ms   | 2000ms  | 3          | ~17 seconds            |
| Low-priority embed         | 10000ms  | 3000ms  | 5          | ~53 seconds            |

```typescript
// Real-time application (fast detection)
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    heartbeat: {
        enabled: true,
        interval: 2000,
        timeout: 1000,
        maxMissed: 2,
    },
});

// Battery-conscious mobile app (slower, fewer checks)
const lowPower = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    heartbeat: {
        enabled: true,
        interval: 15000,
        timeout: 5000,
        maxMissed: 3,
    },
});
```

---

## Types

See [Types Reference](./api-reference/types.md) for every exported type.

### Configuration Types

#### `ParleyConfig`

```typescript
interface ParleyConfig {
    /** 'iframe' or 'window' (required) */
    targetType: 'iframe' | 'window';

    /** Handshake and default request timeout in ms (default: 5000) */
    timeout?: number;

    /** Retries after a timeout; same message re-sent, no backoff (default: 0) */
    retries?: number;

    /**
     * Allowed origins, exact match (default: [window.location.origin]).
     * Entries containing '*' (wildcards such as '*.example.com'), 'null',
     * empty strings and an empty array are rejected by
     * Parley.create(); list each trusted http(s) origin explicitly.
     */
    allowedOrigins?: string[];

    /** 'debug' | 'info' | 'warn' | 'error' | 'none' (default: 'none') */
    logLevel?: LogLevel;

    /** Deliver analytics events to onAnalyticsEvent() (default: false) */
    analyticsEnabled?: boolean;

    /** Custom security layer (default: new DefaultSecurityLayer()) */
    securityLayer?: SecurityLayer;

    /** Custom instance ID (default: generated 'parley_xxxxxxxx') */
    instanceId?: string;

    /** Heartbeat and failure detection */
    heartbeat?: HeartbeatConfig;

    /**
     * Send handler error messages to the remote window in ERR_HANDLER_ERROR
     * responses (default: false, which sends the generic 'Handler error').
     * New in 1.1.0. Enable only when both sides are trusted.
     */
    exposeHandlerErrors?: boolean;

    /**
     * Outgoing send() rate limit: fixed 1-second window per targetId (or
     * global). Exceeding it rejects with ERR_SECURITY_RATE_LIMITED.
     */
    rateLimit?: {
        enabled?: boolean; // default: false
        messagesPerSecond?: number; // default: 100
    };
}
```

There are no `debug` (use `logLevel: 'debug'`), `requireOriginMatch` or
`validateMessages` options.

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

    /** Consecutive missed heartbeats before the connection is considered lost (default: 3) */
    maxMissed?: number;

    /** Consecutive timed-out targeted requests before disconnection (default: 3) */
    maxFailures?: number;
}
```

**Default Values** (exported as `DEFAULT_HEARTBEAT_CONFIG`):

| Property      | Default | Description                                                                                                                                                                          |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`     | `true`  | Heartbeat monitoring enabled by default                                                                                                                                              |
| `interval`    | `5000`  | Send a heartbeat every 5 seconds                                                                                                                                                     |
| `timeout`     | `2000`  | Wait 2 seconds for the heartbeat response                                                                                                                                            |
| `maxMissed`   | `3`     | Disconnect after 3 consecutive missed heartbeats (reason `'heartbeat_timeout'`)                                                                                                      |
| `maxFailures` | `3`     | Disconnect after 3 consecutive timed-out requests to a specific target (reason `'max_failures_reached'`); any response resets the count; untargeted sends and heartbeats don't count |

#### `ChannelOptions`

Options of the low-level channel classes (`IframeChannel`, `WindowChannel`).
Parley fills them in from its own config.

```typescript
interface ChannelOptions {
    /** Allowed origins for message validation */
    allowedOrigins: string[];

    /** Timeout for handshake in milliseconds */
    handshakeTimeout: number;
}
```

#### `SendOptions`

```typescript
interface SendOptions {
    /** Target to send to (default: all connected targets, first response wins) */
    targetId?: string;

    /** Custom timeout for this message */
    timeout?: number;

    /** Number of retries */
    retries?: number;

    /** Whether to expect a response (default: true) */
    expectsResponse?: boolean;
}
```

### Message Types

#### `MessageHandler<T>`

```typescript
type MessageHandler<T = unknown> = (
    payload: T,
    respond: ResponseFunction,
    metadata: MessageMetadata
) => void | Promise<void>;

type ResponseFunction<R = unknown> = (response: R) => void;
```

The return value is ignored; reply with `respond()` (at most once).

#### `MessageMetadata`

```typescript
interface MessageMetadata {
    /** Message ID */
    messageId: string;

    /** Local target ID of the sender (the ID used in connect()) */
    senderId: string;

    /** Sender origin, verified by the browser (event.origin) since 1.1.0 */
    origin: string;

    /** Timestamp when the sender created the message */
    timestamp: number;

    /** Whether the sender expects a response */
    expectsResponse: boolean;
}
```

#### `MessageRegistrationOptions`

```typescript
interface MessageRegistrationOptions {
    /** JSON Schema for payload validation (on send and on receive) */
    schema?: JsonSchema;

    /** Custom timeout for this message type */
    timeout?: number;

    /** Custom retry count for this message type */
    retries?: number;

    /** Called on inbound schema failures and handler errors (1.1.0) */
    onError?: (error: ParleyError, metadata: MessageMetadata) => void;
}
```

#### `JsonSchema`

Supported keywords: `type` (a single type name: `'string'`, `'number'`,
`'integer'`, `'boolean'`, `'object'`, `'array'` or `'null'`), `required`,
`properties`, `items`, `minimum`, `maximum`, `minLength`, `maxLength` (strings
and arrays), `pattern`, `enum` and `additionalProperties` (`false` or a schema).
`description` and `default` are annotations only. Other keywords (`format`,
`minItems`, `oneOf`, `$ref`, ...) are silently ignored.

### Event Types

#### `SystemEventName`

```typescript
type SystemEventName =
    | 'system:connected'
    | 'system:disconnected'
    | 'system:connection_lost'
    | 'system:connection_state_changed'
    | 'system:heartbeat_missed'
    | 'system:error'
    | 'system:timeout'
    | 'system:message_sent'
    | 'system:message_received'
    | 'system:response_sent'
    | 'system:response_received'
    | 'system:handshake_start'
    | 'system:handshake_complete'
    | 'system:handshake_failed';
```

Each event has an exported data interface (`ConnectedEventData`,
`DisconnectedEventData`, `ConnectionLostEventData`,
`ConnectionStateChangedEventData`, `HeartbeatMissedEventData`, `ErrorEventData`,
`TimeoutEventData`, `MessageSentEventData`, `MessageReceivedEventData`,
`ResponseSentEventData`, `ResponseReceivedEventData`, `HandshakeEventData`).

#### `DisconnectReason`

```typescript
type DisconnectReason =
    | 'manual_disconnect'
    | 'connection_lost'
    | 'heartbeat_timeout'
    | 'max_failures_reached'
    | 'cleanup'
    | 'destroyed';
```

#### `AnalyticsEvent`

Fields are top-level (there is no `event.data`):

```typescript
interface BaseAnalyticsEvent {
    type:
        | 'message_sent'
        | 'message_received'
        | 'response_sent'
        | 'response_received'
        | 'error'
        | 'timeout';
    messageType: string;
    messageId: string;
    targetId?: string;
    timestamp: number;
}

// Plus, depending on `type`:
//   response_sent:     success: boolean
//   response_received: success: boolean; duration: number
//   error:             errorCode: string; errorMessage?: string
//   timeout:           errorCode: string
```

---

## Error Classes

All classes extend `ParleyError`. Configuration and usage errors (invalid
config, duplicate `register()`, use after `destroy()`) are plain `Error`s. See
[Error Codes](./api-reference/error-codes.md) for every code.

### `ParleyError`

Base class for all Parley errors.

```typescript
class ParleyError extends Error {
    readonly code: ErrorCode;
    readonly details?: unknown;
    readonly timestamp: number;
    toJSON(): Record<string, unknown>;
}
```

Remote error responses reject `send()` with a plain `ParleyError` carrying the
remote code: `ERR_HANDLER_ERROR` (remote handler threw), `ERR_NO_HANDLER` (no
handler for the type) or `ERR_VALIDATION_SCHEMA_MISMATCH` (remote schema
rejected the payload). A rate-limited `send()` rejects with a `ParleyError`
coded `ERR_SECURITY_RATE_LIMITED`.

### `TimeoutError`

Thrown when a request gets no response after the timeout and all retries
(`ERR_TIMEOUT_NO_RESPONSE`).

```typescript
try {
    await parley.send('message', payload, { targetId: 'target' });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.log(
            `Timeout after ${error.timeoutMs} ms, ${error.retriesAttempted} retries`
        );
    }
}
```

Fields: `messageId`, `timeoutMs`, `retriesAttempted`.

### `ValidationError`

Thrown when a payload fails the local schema or exceeds 10 MB
(`ERR_VALIDATION_SCHEMA_MISMATCH`).

```typescript
catch (error) {
    if (error instanceof ValidationError) {
        // [{ path, message, expected?, received?, rule? }]
        console.log('Validation errors:', error.validationErrors);
    }
}
```

### `SecurityError`

Thrown by the `assertOrigin()` utility (`ERR_SECURITY_ORIGIN_MISMATCH`), with
`receivedOrigin` and `allowedOrigins` fields. `Parley` methods do not throw it;
inbound security rejections are reported through `system:error`.

```typescript
catch (error) {
    if (error instanceof SecurityError) {
        console.log('Origin rejected:', error.receivedOrigin);
    }
}
```

### `TargetNotFoundError`

Thrown by `send()` when the target is unknown or not connected
(`ERR_TARGET_NOT_CONNECTED`) and by `connect()` when the `targetId` is already
in use (`ERR_TARGET_DUPLICATE_ID`).

```typescript
catch (error) {
    if (error instanceof TargetNotFoundError) {
        console.log('Unknown target:', error.targetId);
    }
}
```

### `ConnectionError`

Thrown on connection failures. Has a `targetId` field when known.

```typescript
catch (error) {
    if (error instanceof ConnectionError) {
        console.log('Connection failed:', error.message);
        console.log('Code:', error.code);
    }
}
```

**Error Codes:**

| Code                              | Description                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ERR_CONNECTION_HANDSHAKE_FAILED` | `connect()`: handshake did not complete within `timeout`                                        |
| `ERR_CONNECTION_FAILED`           | `connect()`: invalid target for the instance's `targetType`, or the target did not become ready |
| `ERR_CONNECTION_CLOSED`           | A pending request was rejected because the target disconnected or the instance was destroyed    |
| `ERR_CONNECTION_NOT_CONNECTED`    | `send()` to a target whose origin has not been established                                      |

A lost connection is reported through `system:connection_lost`, not as an error.

### `SerializationError`

Thrown when a payload or response cannot be JSON-serialized (new in 1.1.0;
earlier versions sent `{}`).

```typescript
catch (error) {
    if (error instanceof SerializationError) {
        // ERR_SERIALIZATION_CIRCULAR_REFERENCE or ERR_SERIALIZATION_SERIALIZE_FAILED
        console.log('Cannot serialize:', error.code, error.message);
    }
}
```

### Type Guards

`isParleyError`, `isValidationError`, `isTimeoutError` and `isSecurityError` are
exported. Use `instanceof` for the other classes.

---

## Utilities

### `generateUUID(): string`

Generate a UUID v4 string.

```typescript
import { generateUUID } from 'ignite-parleyjs';
const id = generateUUID();
```

### `validateOrigin(origin: string, allowedOrigins: string[]): OriginValidationResult`

Check an origin against an allowed list (exact match after normalization).
Returns an object, not a boolean.

```typescript
import { validateOrigin } from 'ignite-parleyjs';

const result = validateOrigin('https://example.com', ['https://example.com']);
// { valid: boolean, normalizedOrigin: string, error?: string }
if (!result.valid) {
    console.error(result.error);
}
```

`assertOrigin(origin, allowedOrigins)` throws a `SecurityError` instead.

### `validateSchema(data: unknown, schema: JsonSchema): ValidationResult`

Validate data with the same validator `register()` uses. Returns
`{ valid: boolean, errors: ValidationErrorDetail[] }`.

```typescript
import { validateSchema } from 'ignite-parleyjs';

const { valid, errors } = validateSchema({ id: 1 }, { type: 'object' });
```

---

## TypeScript Support

Parley-js is written in TypeScript and provides full type definitions.

### Generic Message Types

```typescript
import { Parley } from 'ignite-parleyjs';

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

// Receiver: payload is typed as GetUserRequest
parley.on<GetUserRequest>('get-user', async (payload, respond) => {
    const user = await db.getUser(payload.userId);
    respond({ user } satisfies GetUserResponse);
});

// Sender: send<Payload, Response>(type, payload, options?)
const response = await parley.send<GetUserRequest, GetUserResponse>(
    'get-user',
    { userId: '123' },
    { targetId: 'backend' }
);
// response is GetUserResponse | undefined
console.log(response?.user.name);
```

### Type-Safe Event Handlers

`onSystem()` handlers receive `unknown`; cast to the exported event data type:

```typescript
import { SYSTEM_EVENTS, type ConnectedEventData } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (data) => {
    const event = data as ConnectedEventData;
    // event.targetId, event.targetType and event.origin are typed
});
```

---

## Navigation

### Related Documentation

- [API Reference (detailed)](./api-reference/index.md) - Methods, system events,
  types and error codes
- [Framework Reference](./FRAMEWORK_REFERENCE.md) - Quick reference guide
- [Code Patterns](./CODE_PATTERNS.md) - Common coding patterns
- [Testing Patterns](./TESTING_PATTERNS.md) - Testing strategies
- [Examples](./EXAMPLES.md) - Code examples and use cases
- [Security Guide](./SECURITY.md) - Security best practices
- [Architecture](./ARCHITECTURE.md) - System design and internals
- [Testing Guide](./TESTING.md) - Comprehensive testing documentation

### See Also

- [Troubleshooting](./TROUBLESHOOTING.md) - FAQ and debugging
- [Contributing](https://github.com/WebDev-Guy/parley-js/blob/main/CONTRIBUTING.md) -
  How to contribute

**Back to**: [Documentation Home](./index.md)
