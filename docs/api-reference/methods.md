[Home](../index.md) > [API Reference](./index.md) > Methods

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
- [getConnectionState()](#getconnectionstate) - Get the connection state of a
  target
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

| Name                       | Type                                                | Required | Description                                                                                                                                                                   |
| -------------------------- | --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| config                     | `ParleyConfig`                                      | Yes      | Configuration options for the instance                                                                                                                                        |
| config.targetType          | `'iframe' \| 'window'`                              | Yes      | Type of communication target. One instance handles one target type                                                                                                            |
| config.allowedOrigins      | `string[]`                                          | No       | Exact origins allowed to communicate (default: `[window.location.origin]`). No wildcards: any entry containing `'*'`, `'null'`, empty strings and an empty array are rejected |
| config.timeout             | `number`                                            | No       | Default handshake and request timeout in milliseconds (default: 5000)                                                                                                         |
| config.retries             | `number`                                            | No       | Default number of retries after a timeout; each retry re-sends the same message after another `timeout`, with no backoff (default: 0)                                         |
| config.logLevel            | `'none' \| 'error' \| 'warn' \| 'info' \| 'debug'`  | No       | Logging level (default: 'none')                                                                                                                                               |
| config.heartbeat           | `HeartbeatConfig`                                   | No       | Heartbeat and failure detection (default: `{ enabled: true, interval: 5000, timeout: 2000, maxMissed: 3, maxFailures: 3 }`)                                                   |
| config.instanceId          | `string`                                            | No       | Custom instance identifier (default: generated `'parley_xxxxxxxx'`)                                                                                                           |
| config.analyticsEnabled    | `boolean`                                           | No       | Emit analytics events to `onAnalyticsEvent()` handlers (default: false)                                                                                                       |
| config.securityLayer       | `SecurityLayer`                                     | No       | Custom security layer (default: `new DefaultSecurityLayer()`)                                                                                                                 |
| config.exposeHandlerErrors | `boolean`                                           | No       | Send the real handler error message to the remote sender instead of `'Handler error'` (default: false)                                                                        |
| config.rateLimit           | `{ enabled?: boolean; messagesPerSecond?: number }` | No       | Outgoing `send()` rate limit, fixed 1-second window per target (defaults: `enabled: false`, `messagesPerSecond: 100`)                                                         |

**Returns:**

- `Parley` - New Parley instance

**Throws:**

- `Error` (a plain `Error`, not a `ParleyError`) with a message starting with
  `'Configuration error: '` when:
    - `targetType` is missing or is not `'iframe'` or `'window'`
    - `timeout` is not a positive number
    - `retries` is negative
    - `allowedOrigins` is not an array, is empty, or contains a non-string, an
      empty string, `'null'` (any case), or any entry containing `'*'` (e.g.
      `'*'`, `'*.example.com'`, `'https://*.example.com'`)

**Example:**

```typescript
import { Parley } from 'ignite-parleyjs';

// Basic configuration
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
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
        maxMissed: 3,
        maxFailures: 3,
    },
});
```

**Common Mistakes:**

**Mistake:** Not specifying `allowedOrigins` for a cross-origin target

```typescript
// Wrong for cross-origin targets - allowedOrigins defaults to the current origin only
const parley = Parley.create({
    targetType: 'iframe',
});
```

**Correct:**

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
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
console.log('ParleyJS version:', Parley.VERSION); // "1.1.0"
```

---

### SYSTEM_EVENTS

Exported constant object containing all system event names for type-safe event
listening.

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
};
```

**Example:**

```typescript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('Error:', event.code, event.message);
});
```

`Parley.SYSTEM_EVENTS` is only available on the browser IIFE global
(`window.Parley`). With an ESM or CommonJS import, import `SYSTEM_EVENTS`
separately as shown above.

**See Also:**

- [onSystem()](#onsystem)
- [System Events Reference](./system-events.md)

---

## Instance Methods

### register()

Registers a message type with options: JSON Schema validation, a timeout and
retry override, and an `onError` callback. Registration is optional (`on()`
auto-registers unknown types) but is required for payload validation.
`register()` does not take a handler; add handlers with [on()](#on).

**Signature:**

```typescript
register(messageType: string, options?: MessageRegistrationOptions): void
```

**Parameters:**

| Name            | Type                                                      | Required | Description                                                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| messageType     | `string`                                                  | Yes      | Unique message type identifier. Names starting with `__parley_` or `system:` are reserved                                                                                                                                                                        |
| options         | `MessageRegistrationOptions`                              | No       | Registration options                                                                                                                                                                                                                                             |
| options.schema  | `JsonSchema`                                              | No       | Schema validated on send (locally) and on receive                                                                                                                                                                                                                |
| options.timeout | `number`                                                  | No       | Custom timeout for this message type                                                                                                                                                                                                                             |
| options.retries | `number`                                                  | No       | Custom retry count for this message type                                                                                                                                                                                                                         |
| options.onError | `(error: ParleyError, metadata: MessageMetadata) => void` | No       | Called when an inbound message of this type fails schema validation (`ValidationError`) or one of its handlers throws (the thrown error, wrapped in a `ParleyError` with code `ERR_UNKNOWN` if it is not one). Errors thrown by `onError` are logged and ignored |

**Returns:**

- `void`

**Throws:**

- `Error` (plain) - If the type was already registered explicitly with
  `register()` (`'Message type "x" is already registered'`)
- `Error` (plain) - If the type is empty or starts with `__parley_` or `system:`
- `Error` - If the instance has been destroyed

Calling `register()` for a type that so far only has handlers added with `on()`
does not throw: the options are attached to the existing type and the handlers
are kept.

Only these schema keywords are enforced: `type` (a single type name),
`required`, `properties`, `items`, `minimum`, `maximum`, `minLength`,
`maxLength`, `pattern`, `enum` and `additionalProperties`. Other keywords such
as `format`, `minItems`, `oneOf` or `$ref` are silently ignored. See
[JsonSchema](./types.md#jsonschema).

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
            // `format` is not supported; use `pattern` instead
            email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+$' },
        },
    },
    timeout: 10000, // 10 second timeout for user updates
    retries: 2, // Retry twice on failure
    onError: (error, metadata) => {
        // Inbound payload failed validation, or a handler threw
        console.warn(
            `user:update from ${metadata.senderId} failed:`,
            error.code
        );
    },
});

// Register without schema
parley.register('notification');

// Register with custom timeout only
parley.register('file:upload', {
    timeout: 60000, // 60 second timeout for uploads
});
```

**Common Mistakes:**

**Mistake:** Registering the same type twice

```typescript
// Wrong - throws Error('Message type "greeting" is already registered')
parley.register('greeting');
parley.register('greeting'); // Error!
```

Registering after `on()` is fine:

```typescript
parley.on('greeting', (payload, respond) => respond({ ok: true }));
parley.register('greeting', { schema: { type: 'object' } }); // Attaches options
```

**Mistake:** Schema doesn't match sent payload

```typescript
// Register with strict schema
parley.register('user:data', {
    schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'number' } },
    },
});

// Wrong - sends string instead of number
await parley.send('user:data', { id: '123' }); // ValidationError
```

**Correct:**

```typescript
await parley.send('user:data', { id: 123 }); // Works
```

**See Also:**

- [on()](#on)
- [send()](#send)
- [Schema Validation Guide](../EXAMPLES.md#schema-validation)
- [Message Validation](../security/message-validation.md) - Schema validation
  security
- [Type Validation Errors](../troubleshooting/common-errors.md#type-validation-errors) -
  Debug schema issues
- [JSON Schema Documentation](https://json-schema.org/)

---

### on()

Registers a message handler for a specific message type. Returns an unsubscribe
function to remove the handler.

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
) => void | Promise<void>;
```

**Parameters:**

| Name        | Type                | Required | Description                            |
| ----------- | ------------------- | -------- | -------------------------------------- |
| messageType | `string`            | Yes      | Message type to listen for             |
| handler     | `MessageHandler<T>` | Yes      | Handler function with three parameters |

**Handler Parameters:**

| Name     | Type                          | Description                                                                                                                                                     |
| -------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| payload  | `T`                           | The message payload data                                                                                                                                        |
| respond  | `(response: unknown) => void` | Sends the response back to the sender. Call it at most once; the handler's return value is ignored                                                              |
| metadata | `MessageMetadata`             | `{ messageId, senderId, origin, timestamp, expectsResponse }`. `senderId` is the local target ID of the sender; `origin` is the browser-verified `event.origin` |

If the type has not been registered, `on()` registers it automatically. Several
handlers may be added for one type; they run in order and each is awaited.

**Returns:**

- `() => void` - Unsubscribe function to remove the handler

**Throws:**

- `Error` - If the type is empty or starts with `__parley_` or `system:`
- `Error` - If the instance has been destroyed

If a handler throws (or its promise rejects), Parley emits `system:error` with
code `ERR_HANDLER_ERROR`, calls the type's `onError` option, and, if the sender
expects a response and none was sent yet, replies with an `ERR_HANDLER_ERROR`
error response (message `'Handler error'` unless this side set
`exposeHandlerErrors: true`). If no handler exists for an incoming type, the
sender receives `ERR_NO_HANDLER`.

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
    respond(data); // Send response
});
```

**Mistake:** Calling `respond()` multiple times

```typescript
// Wrong - the second respond() throws, which is reported as a handler error
parley.on('getData', (payload, respond) => {
    respond({ status: 'processing' });
    respond({ status: 'complete' }); // Throws: response already sent
});
```

**Mistake:** Returning the response instead of calling `respond()`

```typescript
// Wrong - the return value is ignored; the sender times out
parley.on('getData', async () => {
    return await loadData();
});
```

**Correct:** Only call `respond()` once per message

```typescript
parley.on('getData', async (payload, respond) => {
    const result = await processData();
    respond(result); // Single response
});
```

**See Also:**

- [register()](#register)
- [send()](#send)
- [MessageMetadata type](./types.md#messagemetadata)
- [Request-Response Pattern](../patterns/request-response.md) - Request-response
  workflows
- [Message Handlers](../getting-started/first-example.md#step-3-set-up-message-handlers) -
  Handler basics
- [Error Handling in Handlers](../patterns/error-handling.md#handler-errors) -
  Robust handler patterns
- [Testing Handlers](../patterns/request-response.md#testing-the-responder) -
  How to test message handlers
- [Messages Not Received](../troubleshooting/common-errors.md#messages-not-being-received) -
  Debug handler issues

---

### send()

Sends a message to a target and optionally waits for a response. Supports
fire-and-forget and request-response patterns.

**Signature:**

```typescript
async send<T, R = unknown>(
    messageType: string,
    payload: T,
    options?: SendOptions
): Promise<R | undefined>
```

**Parameters:**

| Name                    | Type          | Required | Description                                                                                                               |
| ----------------------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| messageType             | `string`      | Yes      | Message type to send                                                                                                      |
| payload                 | `T`           | Yes      | Message payload data (JSON-cloned by the security layer)                                                                  |
| options                 | `SendOptions` | No       | Send options                                                                                                              |
| options.targetId        | `string`      | No       | Specific target ID. Without it the message goes to all connected targets and the promise resolves with the first response |
| options.expectsResponse | `boolean`     | No       | Whether to wait for a response (default: true)                                                                            |
| options.timeout         | `number`      | No       | Custom timeout in milliseconds (default: the type's `timeout`, then the instance `timeout`)                               |
| options.retries         | `number`      | No       | Custom retry count (default: the type's `retries`, then the instance `retries`)                                           |

**Returns:**

- `Promise<R | undefined>` - Response data if `expectsResponse` is true,
  undefined otherwise

**Rejects with:**

- `TargetNotFoundError` (`ERR_TARGET_NOT_CONNECTED`) - No such target, or no
  connected target
- `ValidationError` (`ERR_VALIDATION_SCHEMA_MISMATCH`) - Payload fails the
  locally registered schema, or its serialized size exceeds 10 MB (fixed limit)
- `SerializationError` (`ERR_SERIALIZATION_CIRCULAR_REFERENCE` or
  `ERR_SERIALIZATION_SERIALIZE_FAILED`) - Payload contains a circular reference
  or a `BigInt`
- `TimeoutError` (`ERR_TIMEOUT_NO_RESPONSE`) - No response after the timeout and
  all retries
- `ParleyError` with the remote error code:
    - `ERR_HANDLER_ERROR` - The remote handler threw. The message is
      `'Handler error'` unless the receiver set `exposeHandlerErrors: true`
    - `ERR_NO_HANDLER` - No handler for the type on the other side
    - `ERR_VALIDATION_SCHEMA_MISMATCH` - The receiver's schema rejected the
      payload
- `ConnectionError` (`ERR_CONNECTION_CLOSED`) - The target disconnected
  (`'Target disconnected'`) or the instance was destroyed
  (`'Parley instance destroyed'`) while waiting
- `ParleyError` (`ERR_SECURITY_RATE_LIMITED`) - `rateLimit` is enabled and the
  limit was exceeded
- `Error` - The instance has been destroyed

With a `targetId`, consecutive timed-out requests count toward
`heartbeat.maxFailures`; reaching it disconnects the target with reason
`'max_failures_reached'`.

**Example:**

```typescript
// Basic request-response
const response = await parley.send('getData', { id: 123 });
console.log('Response:', response);

// Send to specific target
await parley.send(
    'update',
    { value: 42 },
    {
        targetId: 'child-iframe',
        timeout: 10000,
    }
);

// Fire-and-forget (no response needed)
await parley.send(
    'notification',
    { message: 'Hello' },
    {
        expectsResponse: false,
    }
);

// With type safety
interface Request {
    userId: number;
}

interface Response {
    user: { id: number; name: string };
}

const result = await parley.send<Request, Response>('user:get', {
    userId: 123,
});

console.log('User name:', result?.user.name);

// With retry
try {
    const data = await parley.send('critical:operation', payload, {
        timeout: 5000,
        retries: 3, // Retry up to 3 times
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
import { TimeoutError } from 'ignite-parleyjs';

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
await parley.send('message', {}, { targetId: 'myframe' }); // Fails
```

**Correct:**

```typescript
const iframe = document.getElementById('myframe');
await parley.connect(iframe, 'myframe'); // Connect first
await parley.send('message', {}, { targetId: 'myframe' }); // Works
```

**Mistake:** Using `expectsResponse: false` but awaiting result

```typescript
// Wrong - result will always be undefined
const response = await parley.send(
    'notify',
    {},
    {
        expectsResponse: false,
    }
);
console.log(response); // undefined
```

**Correct:** Ignore the result of fire-and-forget messages, but still handle
rejections (validation, serialization and no-target errors)

```typescript
await parley.send('notify', {}, { expectsResponse: false });

// Or without await, with a catch
parley.send('notify', {}, { expectsResponse: false }).catch(console.error);
```

**See Also:**

- [on()](#on)
- [broadcast()](#broadcast)
- [Common Errors](../troubleshooting/common-errors.md) - Error reference and
  solutions
- [Request-Response Pattern](../patterns/request-response.md) - Send/receive
  workflows
- [Error Handling Pattern](../patterns/error-handling.md#timeout-errors) -
  Handle send() failures
- [Timeout Errors](../troubleshooting/common-errors.md#timeout-errors) - Common
  send() issues
- [Performance: Message Batching](../patterns/request-response.md#batch-request-response) -
  Optimize multiple sends
- [iFrame Communication](../guides/iframe-communication.md) - Send to iframes
- [Popup Communication](../guides/popup-communication.md) - Send to popups

---

### broadcast()

Broadcasts a message to all connected targets. This is a fire-and-forget
operation: it returns `void` (do not `await` it), takes no options, never
expects or receives responses, and does not report per-target failures. With no
connected targets it does nothing. Rate limiting does not apply to
`broadcast()`.

**Signature:**

```typescript
broadcast<T>(messageType: string, payload: T): void
```

**Parameters:**

| Name        | Type     | Required | Description               |
| ----------- | -------- | -------- | ------------------------- |
| messageType | `string` | Yes      | Message type to broadcast |
| payload     | `T`      | Yes      | Message payload data      |

**Returns:**

- `void`

**Throws (synchronously):**

- `ValidationError` (`ERR_VALIDATION_SCHEMA_MISMATCH`) - Payload doesn't match
  the registered schema, or exceeds 10 MB serialized
- `SerializationError` (`ERR_SERIALIZATION_CIRCULAR_REFERENCE` or
  `ERR_SERIALIZATION_SERIALIZE_FAILED`) - Payload cannot be serialized
- `Error` - The instance has been destroyed

**Example:**

```typescript
// Notify all connected windows
parley.broadcast('state:changed', {
    version: 42,
    timestamp: Date.now(),
});

// Broadcast configuration update
parley.broadcast('config:update', {
    theme: 'dark',
    language: 'en',
});

// With type safety
interface StateUpdate {
    key: string;
    value: unknown;
}

parley.broadcast<StateUpdate>('state:update', {
    key: 'user.preferences',
    value: { notifications: true },
});
```

**Common Mistakes:**

**Mistake:** Expecting responses from broadcast

```typescript
// Wrong - broadcast doesn't return responses
const responses = await parley.broadcast('update', {}); // No responses
```

**Correct:** Use individual `send()` calls if responses are needed

```typescript
const targets = parley.getConnectedTargets();
const responses = await Promise.all(
    targets.map((id) => parley.send('update', {}, { targetId: id }))
);
```

**See Also:**

- [send()](#send)
- [getConnectedTargets()](#getconnectedtargets)
- [Multi-Window Communication Guide](../guides/multi-window-communication.md) -
  Broadcast to multiple windows
- [State Synchronization Pattern](../patterns/state-synchronization.md) - Sync
  state across windows
- [Performance: Batching](../troubleshooting/common-errors.md#performance-issues) -
  Optimize broadcasts

---

### connect()

Establishes a connection to an iframe or window target. This must be called
before sending messages, and **both sides must call it**:

- `targetType: 'iframe'`: the parent calls `connect(iframeElement, id?)`, the
  page inside the iframe calls `connect(window.parent, id?)`. Passing
  `iframe.contentWindow` to an iframe instance fails with
  `ERR_CONNECTION_FAILED`.
- `targetType: 'window'`: the opener calls `connect(popupWindow, id?)`, the
  popup calls `connect(window.opener, id?)`.

The connecting side (iframe page or popup) re-sends the handshake until it is
acknowledged, so no `load` listener or delay is needed.

**Signature:**

```typescript
async connect(target: HTMLIFrameElement | Window, targetId?: string): Promise<void>
```

**Parameters:**

| Name     | Type                          | Required | Description                                                                   |
| -------- | ----------------------------- | -------- | ----------------------------------------------------------------------------- |
| target   | `HTMLIFrameElement \| Window` | Yes      | The iframe element or window object to connect to                             |
| targetId | `string`                      | No       | Custom identifier (default: the iframe's `id` attribute, otherwise generated) |

**Returns:**

- `Promise<void>` - Resolves when connection is established

**Throws:**

- `ConnectionError` (`ERR_CONNECTION_HANDSHAKE_FAILED`) - Handshake not
  completed within `timeout`
- `ConnectionError` (`ERR_CONNECTION_FAILED`) - Invalid target for this
  instance's `targetType`
- `TargetNotFoundError` (`ERR_TARGET_DUPLICATE_ID`) - Target ID already in use
- `Error` - The instance has been destroyed

Emits `system:handshake_start`, then `system:handshake_complete` and
`system:connected` (or `system:handshake_failed`).

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

// Connect to opener (from within a popup; targetType: 'window')
await parley.connect(window.opener, 'opener');

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

**Mistake:** Waiting for the iframe `load` event before connecting

```typescript
// Wrong - if the iframe already finished loading, this listener never fires
iframe.addEventListener('load', async () => {
    await parley.connect(iframe);
});
```

**Correct:** Call `connect()` directly on both sides; the handshake is retried
until the other side answers (or `timeout` expires)

```typescript
await parley.connect(iframe, 'child');
```

**Mistake:** Passing `iframe.contentWindow` to an iframe instance

```typescript
// Wrong - fails with ERR_CONNECTION_FAILED
await parley.connect(iframe.contentWindow!, 'child');

// Correct - pass the element
await parley.connect(iframe, 'child');
```

**Mistake:** Not handling connection errors

```typescript
// Wrong - connection might fail
await parley.connect(iframe);
```

**Correct:**

```typescript
import { ConnectionError, ERROR_CODES } from 'ignite-parleyjs';

try {
    await parley.connect(iframe);
} catch (error) {
    if (
        error instanceof ConnectionError &&
        error.code === ERROR_CODES.HANDSHAKE_FAILED
    ) {
        console.error('Handshake timed out');
    } else if (error instanceof ConnectionError) {
        console.error('Connection failed:', error.message);
    }
}
```

**See Also:**

- [disconnect()](#disconnect)
- [isConnected()](#isconnected)
- [onSystem()](#onsystem)
- [iFrame Communication Guide](../guides/iframe-communication.md) - Connect to
  iframes
- [Popup Communication Guide](../guides/popup-communication.md) - Connect to
  popups
- [Connection Errors](../troubleshooting/common-errors.md#channel-closed-errors) -
  Troubleshoot connections
- [Dead Window References](../troubleshooting/common-errors.md#dead-window-references) -
  Handle invalid windows

---

### disconnect()

Gracefully disconnects from a target with notification to the other side. The
peer receives `system:disconnected` with reason `'manual_disconnect'`; this side
also emits `system:disconnected` (reason `'manual_disconnect'`). Pending
requests to the target reject with `ConnectionError` (`ERR_CONNECTION_CLOSED`,
`'Target disconnected'`). The notification waits at most 1 second for the peer;
cleanup happens either way.

**Signature:**

```typescript
async disconnect(targetId: string): Promise<void>
```

**Parameters:**

| Name     | Type     | Required | Description                     |
| -------- | -------- | -------- | ------------------------------- |
| targetId | `string` | Yes      | ID of target to disconnect from |

**Returns:**

- `Promise<void>` - Resolves when disconnection is complete

**Throws:**

- `Error` - If the instance has been destroyed. An unknown `targetId` only logs
  a warning.

**Example:**

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

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
await parley.send('message', {}, { targetId: 'child' }); // Might fail
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

Registers a handler for system events emitted by ParleyJS for connection
lifecycle and analytics.

**Signature:**

```typescript
onSystem(event: SystemEventName, handler: (data: unknown) => void): () => void
```

**Parameters:**

| Name    | Type                      | Required | Description                                    |
| ------- | ------------------------- | -------- | ---------------------------------------------- |
| event   | `SystemEventName`         | Yes      | System event name (use SYSTEM_EVENTS constant) |
| handler | `(data: unknown) => void` | Yes      | Event handler function                         |

**Returns:**

- `() => void` - Unsubscribe function

**Throws:**

- `Error` - If the instance has been destroyed

System events are only available through `onSystem()`; `on()` is for application
message types. See [System Events](./system-events.md) for every event and its
payload.

**Example:**

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

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
- [System Events Reference](./system-events.md)
- [Heartbeat Monitoring Guide](../guides/multi-window-communication.md#heartbeat-monitoring)

---

### onAnalyticsEvent()

Registers a handler for analytics events. Useful for tracking message
performance and usage metrics. Handlers are only called when the instance was
created with `analyticsEnabled: true`.

**Signature:**

```typescript
onAnalyticsEvent(handler: AnalyticsEventHandler): () => void
```

**Handler Signature:**

```typescript
type AnalyticsEventHandler = (event: AnalyticsEvent) => void;
```

`AnalyticsEvent` fields are top-level (there is no `event.data`):
`{ type, messageType, messageId, targetId?, timestamp }`, plus `success` on
`response_sent`/`response_received`, `duration` on `response_received`, and
`errorCode` (and `errorMessage?` on `error`) on `error`/`timeout`. `type` is one
of
`'message_sent' | 'message_received' | 'response_sent' | 'response_received' | 'error' | 'timeout'`.

**Parameters:**

| Name    | Type                    | Required | Description             |
| ------- | ----------------------- | -------- | ----------------------- |
| handler | `AnalyticsEventHandler` | Yes      | Analytics event handler |

**Returns:**

- `() => void` - Unsubscribe function

**Throws:**

- `Error` - If the instance has been destroyed

**Example:**

```typescript
// Requires Parley.create({ ..., analyticsEnabled: true })

// Track all message events
parley.onAnalyticsEvent((event) => {
    switch (event.type) {
        case 'message_sent':
            analytics.track('Message Sent', {
                messageType: event.messageType,
                messageId: event.messageId,
                targetId: event.targetId,
            });
            break;

        case 'response_received':
            analytics.track('Response Received', {
                messageType: event.messageType,
                duration: event.duration,
                success: event.success,
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
            data: event,
        }),
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
console.log('Connected targets:', targets); // ['child-1', 'child-2', 'popup']

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

| Name     | Type     | Required | Description        |
| -------- | -------- | -------- | ------------------ |
| targetId | `string` | Yes      | Target ID to check |

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
    await new Promise((resolve) => setTimeout(resolve, 100));
}
console.log('Popup connected');
```

**See Also:**

- [getConnectedTargets()](#getconnectedtargets)
- [connect()](#connect)
- [getConnectionState()](#getconnectionstate)

---

### getConnectionState()

Returns the current connection state of a target.

**Signature:**

```typescript
getConnectionState(targetId: string): ConnectionState | undefined
```

**Parameters:**

| Name     | Type     | Required | Description        |
| -------- | -------- | -------- | ------------------ |
| targetId | `string` | Yes      | Target ID to check |

**Returns:**

- `ConnectionState | undefined` - `'connecting'`, `'connected'`,
  `'disconnecting'` or `'disconnected'`, or `undefined` if the target is not
  known (targets are removed once they are disconnected)

**Throws:**

- None

**Example:**

```typescript
import { ConnectionState } from 'ignite-parleyjs';

if (parley.getConnectionState('child') === ConnectionState.CONNECTED) {
    await parley.send('ping', {}, { targetId: 'child' });
}
```

**See Also:**

- [isConnected()](#isconnected)
- [ConnectionState type](./types.md#connectionstate)
- [system:connection_state_changed](./system-events.md)

---

### destroy()

Destroys the Parley instance and cleans up all resources. Stops heartbeats,
rejects pending requests with `ConnectionError` (`ERR_CONNECTION_CLOSED`,
`'Parley instance destroyed'`), disconnects every target (emitting
`system:disconnected` with reason `'destroyed'` for each), then clears all
listeners and handlers. Peers are not notified; they detect the loss through
their heartbeat. Calling `destroy()` again does nothing; most other methods
throw `Error('Parley instance has been destroyed')` afterwards.

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
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});

// Use parley...

// Later: clean up
parley.destroy();

// React example
useEffect(() => {
    const parley = Parley.create({
        targetType: 'iframe',
        allowedOrigins: ['https://child.example.com'],
    });

    // Use parley...

    return () => {
        parley.destroy(); // Clean up on unmount
    };
}, []);

// Vue example
export default {
    mounted() {
        this.parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: ['https://child.example.com'],
        });
    },
    beforeUnmount() {
        this.parley.destroy(); // Clean up
    },
};

// Angular example
export class MyComponent implements OnDestroy {
    private parley: Parley;

    ngOnInit() {
        this.parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: ['https://child.example.com'],
        });
    }

    ngOnDestroy() {
        this.parley.destroy(); // Clean up
    }
}
```

Framework cleanup is critical to prevent memory leaks. For framework-specific
integration patterns, see
[Testing Patterns: Framework Integration](../TESTING_PATTERNS.md#framework-integration).

**Common Mistakes:**

**Mistake:** Using instance after destroy

```typescript
// Wrong - instance is destroyed
parley.destroy();
await parley.send('message', {}); // Throws Error('Parley instance has been destroyed')
```

**Correct:** Create a new instance (and connect it) if needed

```typescript
parley.destroy();
const newParley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});
await newParley.connect(iframe, 'child');
await newParley.send('message', {});
```

**See Also:**

- [disconnect()](#disconnect)
- [React Integration Example](../EXAMPLES.md#react-integration)
- [Memory Leaks Prevention](../troubleshooting/common-errors.md#memory-leaks) -
  Why cleanup matters
- [Popup Lifecycle](../guides/popup-communication.md#lifecycle-management) -
  Managing popup cleanup

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
    instanceId: 'my-custom-id', // Optional custom ID
});

console.log(parley.instanceId); // "my-custom-id"

// Auto-generated ID if not specified
const parley2 = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://example.com'],
});

console.log(parley2.instanceId); // "parley_a1b2c3d4"
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
    allowedOrigins: ['https://example.com'],
});

console.log(parley.targetType); // "iframe"
```

---

## Navigation

**Previous**: [API Reference Overview](./index.md) **Next**:
[System Events](./system-events.md) **Back to**: [API Reference](./index.md)

**Related**:

- [System Events](./system-events.md) - System event reference
- [Types](./types.md) - Type reference
- [Error Codes](./error-codes.md) - Error classes and codes
- [Common Errors](../troubleshooting/common-errors.md) - Error reference
- [Code Patterns](../patterns/index.md)
- [Examples](../EXAMPLES.md)
