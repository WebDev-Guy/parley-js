# Types Reference

[Home](../index.md) > [Documentation](./index.md) >
[API Reference](./index.md) > Types

## Overview

ParleyJS is written in TypeScript and ships type definitions for its
configuration, handlers, events and errors. This page documents the public types
exported from `ignite-parleyjs`, exactly as they are declared in the source.

```typescript
import type {
    ParleyConfig,
    MessageHandler,
    MessageMetadata,
    SendOptions,
    JsonSchema,
} from 'ignite-parleyjs';
```

## Table of Contents

1. [Configuration Types](#configuration-types)
2. [Handler Types](#handler-types)
3. [Message Types](#message-types)
4. [Schema Validation Types](#schema-validation-types)
5. [Connection Types](#connection-types)
6. [System Event Types](#system-event-types)
7. [Analytics Types](#analytics-types)
8. [Error Types](#error-types)
9. [Protocol Types](#protocol-types)
10. [Channel Types](#channel-types)
11. [Generic Usage](#generic-usage)

---

## Configuration Types

### ParleyConfig

Configuration passed to `Parley.create()`. `Parley.create()` is the only way to
create an instance; the constructor is private.

```typescript
interface ParleyConfig {
    targetType: TargetType; // Required
    timeout?: number; // Default: 5000
    retries?: number; // Default: 0
    allowedOrigins?: string[]; // Default: [window.location.origin]
    logLevel?: LogLevel; // Default: 'none'
    analyticsEnabled?: boolean; // Default: false
    securityLayer?: SecurityLayer; // Default: new DefaultSecurityLayer()
    instanceId?: string; // Default: generated 'parley_xxxxxxxx'
    heartbeat?: HeartbeatConfig; // Default: see HeartbeatConfig
    exposeHandlerErrors?: boolean; // Default: false
    rateLimit?: {
        enabled?: boolean; // Default: false
        messagesPerSecond?: number; // Default: 100
    };
}

type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';
```

| Property              | Description                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targetType`          | `'iframe'` or `'window'`. One instance handles one target type                                                                                                                                                                                      |
| `timeout`             | Handshake timeout and default request timeout, in milliseconds. Must be a positive number                                                                                                                                                           |
| `retries`             | Default retry count. Each retry re-sends the same message (same id) after another `timeout`, with no backoff. Must not be negative                                                                                                                  |
| `allowedOrigins`      | Origins allowed to communicate, matched exactly after normalization. No wildcard or subdomain patterns. Must be a non-empty array of non-empty strings and must not contain `'null'` or any entry containing `'*'` (e.g. `'https://*.example.com'`) |
| `logLevel`            | Internal logging level                                                                                                                                                                                                                              |
| `analyticsEnabled`    | Deliver analytics events to `onAnalyticsEvent()` handlers                                                                                                                                                                                           |
| `securityLayer`       | Custom [SecurityLayer](#securitylayer) subclass                                                                                                                                                                                                     |
| `instanceId`          | Identifier for this instance (sent as `senderId` in internal messages)                                                                                                                                                                              |
| `heartbeat`           | Connection health monitoring, see [HeartbeatConfig](#heartbeatconfig)                                                                                                                                                                               |
| `exposeHandlerErrors` | When this side's handler throws, send the real error message to the sender instead of `'Handler error'`                                                                                                                                             |
| `rateLimit`           | Limit outgoing `send()` calls per fixed 1-second window, per `targetId` (or globally for untargeted sends). `broadcast()` and inbound messages are not limited. Exceeding it rejects with `ERR_SECURITY_RATE_LIMITED`                               |

Options such as `debug`, `requireOriginMatch`, `validateMessages`, `target`,
`serializer`, `namespace` or any reconnect option do not exist.

`Parley.create()` throws a plain `Error('Configuration error: ...')` (there is
no `ConfigurationError` class) when `targetType` is missing or invalid,
`timeout` is not a positive number, `retries` is negative, or `allowedOrigins`
is invalid as described above.

```typescript
const config: ParleyConfig = {
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
    timeout: 10000,
    logLevel: 'debug',
};

const parley = Parley.create(config);
```

---

### HeartbeatConfig

```typescript
interface HeartbeatConfig {
    enabled?: boolean; // Default: true
    interval?: number; // Default: 5000 ms between pings
    timeout?: number; // Default: 2000 ms to wait for each pong
    maxMissed?: number; // Default: 3 consecutive missed pings
    maxFailures?: number; // Default: 3 consecutive timed-out requests
}

const DEFAULT_HEARTBEAT_CONFIG = {
    enabled: true,
    interval: 5000,
    timeout: 2000,
    maxMissed: 3,
    maxFailures: 3,
};
```

- Each side pings each connected target every `interval`. The pong is the
  response to the ping; a ping not answered within `timeout` is a miss
  (`system:heartbeat_missed`). After `maxMissed` consecutive misses the target
  is disconnected with reason `'heartbeat_timeout'`.
- `maxFailures`: after that many consecutive timed-out requests to a specific
  target (`send()` with a `targetId` that expects a response), the target is
  disconnected with reason `'max_failures_reached'`. Any response (success or
  error) resets the count. Untargeted sends and heartbeats do not count.
  `maxFailures` applies even when `enabled` is `false`.
- There is no automatic reconnection.

`DEFAULT_HEARTBEAT_CONFIG` is exported.

---

### TargetType

```typescript
type TargetType = 'iframe' | 'window';
```

- `'iframe'`: the parent calls `connect(iframeElement)`; the page inside the
  iframe calls `connect(window.parent)`.
- `'window'`: the opener calls `connect(popupWindow)`; the popup calls
  `connect(window.opener)`.

Web Workers, `MessageChannel` ports and Service Workers are not supported.

---

## Handler Types

### MessageHandler

Handler passed to `parley.on()`.

```typescript
type MessageHandler<T = unknown> = (
    payload: T,
    respond: ResponseFunction,
    metadata: MessageMetadata
) => void | Promise<void>;
```

The return value is ignored. Reply by calling `respond()` once. If the handler
throws or rejects, the sender receives an `ERR_HANDLER_ERROR` error response (if
it expects one and none was sent), `system:error` is emitted and the type's
`onError` option is called.

---

### ResponseFunction

```typescript
type ResponseFunction<R = unknown> = (response: R) => void;
```

The `respond` argument a handler receives is a `ResponseFunction` (non-generic,
`R = unknown`). Calling it a second time for the same message throws an `Error`.
The response is passed through the security layer's `sanitizePayload()` (a JSON
clone by default) before it is posted.

---

### MessageMetadata

Third argument of every handler.

```typescript
interface MessageMetadata {
    messageId: string; // Unique message ID
    senderId: string; // Local target ID of the sender (the id used in connect())
    origin: string; // Browser-verified origin (event.origin)
    timestamp: number; // When the sender created the message
    expectsResponse: boolean; // Whether the sender waits for a response
}
```

There is no `targetId`, `type` or `correlationId` on metadata. Since 1.1.0
`origin` is the origin reported by the browser, never the origin the sender
wrote into the message.

---

### MessageRegistrationOptions

Options for `parley.register(type, options)`.

```typescript
interface MessageRegistrationOptions {
    schema?: JsonSchema;
    timeout?: number;
    retries?: number;
    onError?: (error: ParleyError, metadata: MessageMetadata) => void;
}
```

| Property  | Description                                                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`  | Validated against outgoing payloads of this type (on `send()`/`broadcast()`) and incoming payloads of this type                                                                                                                                                                      |
| `timeout` | Default timeout for `send()` of this type                                                                                                                                                                                                                                            |
| `retries` | Default retry count for `send()` of this type                                                                                                                                                                                                                                        |
| `onError` | Called when an inbound message of this type fails schema validation (a `ValidationError`) or one of its handlers throws (the thrown `ParleyError`, or the error wrapped in a `ParleyError` with code `ERR_UNKNOWN`). Errors thrown by `onError` are logged and ignored. New in 1.1.0 |

Handlers are not part of the registration options; add them with `on()`.

---

## Message Types

### SendOptions

Options for `parley.send()`. `broadcast()` takes no options.

```typescript
interface SendOptions {
    targetId?: string; // Default: all connected targets, first response wins
    timeout?: number; // Default: type timeout, then instance timeout
    retries?: number; // Default: type retries, then instance retries
    expectsResponse?: boolean; // Default: true
}
```

With `expectsResponse: false`, `send()` resolves with `undefined` once the
message is posted.

---

### SYSTEM_MESSAGE_TYPES

Internal message type names used by the protocol. Application types must not
start with `__parley_` or `system:`.

```typescript
const SYSTEM_MESSAGE_TYPES = {
    DISCONNECT: '__parley_disconnect',
    HEARTBEAT_PING: '__parley_heartbeat_ping',
};
```

There is no pong message type; the pong is the response to a ping. Handshake
messages are internal to the channels and not listed here. The related payload
types `DisconnectPayload`, `HeartbeatPingPayload` and `HeartbeatPongPayload` are
also exported.

---

## Schema Validation Types

### JsonSchema

A simplified JSON Schema used by `register(type, { schema })`.

```typescript
interface JsonSchema {
    type?:
        | 'string'
        | 'number'
        | 'integer'
        | 'boolean'
        | 'object'
        | 'array'
        | 'null';
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    minimum?: number;
    maximum?: number;
    minLength?: number; // Strings and arrays
    maxLength?: number; // Strings and arrays
    pattern?: string;
    enum?: unknown[];
    additionalProperties?: boolean | JsonSchema;
    description?: string; // Annotation only
    default?: unknown; // Annotation only, never applied
}
```

- Only the keywords above are enforced. `type` takes a single type name (no
  arrays of types).
- Other JSON Schema keywords (`format`, `minItems`, `maxItems`, `oneOf`,
  `anyOf`, `allOf`, `$ref`, `const`, ...) are silently ignored. Use `pattern`
  instead of `format`.
- `required` and `properties` only consider own properties.
- Errors are collected up to 100 per level; schemas may nest up to 50 levels.

```typescript
parley.register('user:update', {
    schema: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
            id: { type: 'integer', minimum: 1 },
            email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+$' },
            role: { type: 'string', enum: ['admin', 'user'] },
        },
        additionalProperties: false,
    },
});
```

---

### ValidationResult and ValidationErrorDetail

Returned by the exported `validateSchema(data, schema)` helper (and
`SchemaValidator#validate`).

```typescript
interface ValidationResult {
    valid: boolean;
    errors: ValidationErrorDetail[]; // Empty when valid
}

interface ValidationErrorDetail {
    path: string; // e.g. 'user.email'
    message: string;
    expected?: string;
    received?: string;
    rule?: string; // The keyword that failed
}
```

A `ValidationError` raised by schema validation carries these details in
`validationErrors`.

---

## Connection Types

### ConnectionState

Returned by `parley.getConnectionState(targetId)` and used in
`system:connection_state_changed`.

```typescript
enum ConnectionState {
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTING = 'disconnecting',
    DISCONNECTED = 'disconnected',
}
```

There is no `RECONNECTING` state. `ConnectionState` is exported as a value.

---

### DisconnectReason

```typescript
type DisconnectReason =
    | 'manual_disconnect' // disconnect() on this side, or the peer called disconnect()
    | 'connection_lost' // The target window was closed
    | 'heartbeat_timeout' // heartbeat.maxMissed consecutive misses
    | 'max_failures_reached' // heartbeat.maxFailures consecutive request timeouts
    | 'cleanup' // Removed by periodic cleanup of dead targets
    | 'destroyed'; // destroy() was called on this instance
```

---

### ConnectionStateChange

```typescript
interface ConnectionStateChange {
    targetId: string;
    previousState: ConnectionState;
    currentState: ConnectionState;
    reason?: string;
    timestamp: number;
}
```

---

## System Event Types

### SystemEventName

```typescript
type SystemEventName = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS];
// 'system:connected' | 'system:disconnected' | 'system:connection_lost'
// | 'system:connection_state_changed' | 'system:heartbeat_missed'
// | 'system:error' | 'system:timeout' | 'system:message_sent'
// | 'system:message_received' | 'system:response_sent'
// | 'system:response_received' | 'system:handshake_start'
// | 'system:handshake_complete' | 'system:handshake_failed'
```

System events are listened to with `parley.onSystem(SYSTEM_EVENTS.X, handler)`,
never with `on()`. The handler receives `data: unknown`; cast it to the matching
data type below. See [System Events](./system-events.md) for when each event is
emitted.

### System Event Data

| Event                                              | Data type                         |
| -------------------------------------------------- | --------------------------------- |
| `system:connected`                                 | `ConnectedEventData`              |
| `system:disconnected`                              | `DisconnectedEventData`           |
| `system:connection_lost`                           | `ConnectionLostEventData`         |
| `system:connection_state_changed`                  | `ConnectionStateChangedEventData` |
| `system:heartbeat_missed`                          | `HeartbeatMissedEventData`        |
| `system:error`                                     | `ErrorEventData`                  |
| `system:timeout`                                   | `TimeoutEventData`                |
| `system:message_sent`                              | `MessageSentEventData`            |
| `system:message_received`                          | `MessageReceivedEventData`        |
| `system:response_sent`                             | `ResponseSentEventData`           |
| `system:response_received`                         | `ResponseReceivedEventData`       |
| `system:handshake_start` / `_complete` / `_failed` | `HandshakeEventData`              |

```typescript
interface ConnectedEventData {
    targetId: string;
    targetType: 'iframe' | 'window';
    origin: string;
    timestamp: number;
}

interface DisconnectedEventData {
    targetId: string;
    reason: DisconnectReason;
    timestamp: number;
}

interface ConnectionLostEventData {
    targetId: string;
    reason:
        | 'heartbeat_timeout'
        | 'max_failures_reached'
        | 'connection_lost'
        | 'cleanup';
    timestamp: number;
}

interface ConnectionStateChangedEventData {
    targetId: string;
    previousState: ConnectionState;
    currentState: ConnectionState;
    reason?: string;
    timestamp: number;
}

interface HeartbeatMissedEventData {
    targetId: string;
    consecutiveMissed: number;
    timestamp: number;
}

interface ErrorEventData {
    code: string;
    message: string;
    targetId?: string;
    messageId?: string;
    details?: unknown;
    timestamp: number;
}

interface TimeoutEventData {
    messageId: string;
    messageType: string;
    targetId?: string;
    timeoutMs: number;
    retriesAttempted: number;
    timestamp: number;
}

interface MessageSentEventData {
    messageId: string;
    messageType: string;
    targetId?: string;
    expectsResponse: boolean;
    timestamp: number;
}

interface MessageReceivedEventData {
    messageId: string;
    messageType: string;
    origin: string; // Browser-verified
    timestamp: number;
}

interface ResponseSentEventData {
    responseId: string;
    requestId: string;
    success: boolean;
    timestamp: number;
}

interface ResponseReceivedEventData {
    responseId: string;
    requestId: string;
    success: boolean;
    duration: number; // Round trip in ms
    timestamp: number;
}

interface HandshakeEventData {
    targetId: string;
    targetType: 'iframe' | 'window';
    timestamp: number;
    error?: { code: string; message: string }; // handshake_failed only
}
```

`SystemEventData` is the union of these interfaces, and `SystemEventHandler<T>`
is `(data: T) => void | Promise<void>`.

---

## Analytics Types

Delivered to `parley.onAnalyticsEvent(handler)` when the instance was created
with `analyticsEnabled: true`. All fields are top-level; there is no
`event.data`.

```typescript
type AnalyticsEventType =
    | 'message_sent'
    | 'message_received'
    | 'response_sent'
    | 'response_received'
    | 'error'
    | 'timeout';

interface BaseAnalyticsEvent {
    type: AnalyticsEventType;
    messageType: string;
    messageId: string;
    targetId?: string;
    timestamp: number;
}

type AnalyticsEvent =
    | (BaseAnalyticsEvent & { type: 'message_sent' })
    | (BaseAnalyticsEvent & { type: 'message_received' })
    | (BaseAnalyticsEvent & { type: 'response_sent'; success: boolean })
    | (BaseAnalyticsEvent & {
          type: 'response_received';
          duration: number;
          success: boolean;
      })
    | (BaseAnalyticsEvent & {
          type: 'error';
          errorCode: string;
          errorMessage?: string;
      })
    | (BaseAnalyticsEvent & { type: 'timeout'; errorCode: string });

type AnalyticsEventHandler = (event: AnalyticsEvent) => void;
```

The named member interfaces (`MessageSentAnalyticsEvent`,
`MessageReceivedAnalyticsEvent`, `ResponseSentAnalyticsEvent`,
`ResponseReceivedAnalyticsEvent`, `ErrorAnalyticsEvent`,
`TimeoutAnalyticsEvent`) are exported, along with `AnalyticsAdapter` and
`AnalyticsOptions` for use with the exported `AnalyticsManager`.

```typescript
parley.onAnalyticsEvent((event) => {
    if (event.type === 'response_received') {
        metrics.timing(event.messageType, event.duration);
    }
});
```

---

## Error Types

All errors thrown by ParleyJS operations (except configuration and usage errors,
which are plain `Error`s) extend `ParleyError`. See
[Error Codes](./error-codes.md) for when each code is produced.

```typescript
class ParleyError extends Error {
    readonly code: ErrorCode;
    readonly details?: unknown;
    readonly timestamp: number;
    toJSON(): Record<string, unknown>; // name, message, code, details, timestamp, stack
}

class ValidationError extends ParleyError {
    readonly validationErrors?: ValidationErrorDetail[];
}

class TimeoutError extends ParleyError {
    readonly messageId?: string;
    readonly timeoutMs?: number;
    readonly retriesAttempted?: number;
}

class TargetNotFoundError extends ParleyError {
    readonly targetId?: string;
}

class SecurityError extends ParleyError {
    readonly receivedOrigin?: string;
    readonly allowedOrigins?: string[];
}

class SerializationError extends ParleyError {}

class ConnectionError extends ParleyError {
    readonly targetId?: string;
}
```

`ValidationError.validationErrors` is set when the error comes from schema
validation; its entries have the shape of
[ValidationErrorDetail](#validationresult-and-validationerrordetail) (`path`,
not `field`).

There is no `ConfigurationError`, `TargetError` or `HandlerError` class.

### Type Guards

```typescript
function isParleyError(error: unknown): error is ParleyError;
function isValidationError(error: unknown): error is ValidationError;
function isTimeoutError(error: unknown): error is TimeoutError;
function isSecurityError(error: unknown): error is SecurityError;
```

For the other classes use `instanceof`.

### ErrorCode

`ErrorCode` is the union of every string in `ERROR_CODES` (`'ERR_...'`). Error
responses from the remote side can also carry the wire-only codes
`'ERR_HANDLER_ERROR'` and `'ERR_NO_HANDLER'`, which are not part of the union.

---

## Protocol Types

Low-level message shapes, exported for custom `SecurityLayer` implementations
and tooling. Most applications never use them directly.

```typescript
interface MessageProtocol<T = unknown> {
    _parley: '__parley__';
    _v: string; // Protocol version
    _id: string; // UUID
    _type: string;
    _timestamp: number;
    _origin: string; // Self-reported by the sender; not trusted
    _target?: string;
    _expectsResponse: boolean;
    payload: T;
}

interface ResponseProtocol<T = unknown> {
    _parley: '__parley__';
    _v: string;
    _id: string;
    _requestId: string;
    _timestamp: number;
    _origin: string;
    success: boolean;
    payload?: T;
    error?: { code: string; message: string; details?: unknown };
}
```

### SecurityLayer

An abstract class (not an interface). Extend `DefaultSecurityLayer` and override
what you need, or extend `SecurityLayer` and implement all three methods:

```typescript
abstract class SecurityLayer {
    abstract validateOrigin(origin: string, allowedOrigins: string[]): boolean;
    abstract sanitizePayload<T>(payload: T): T;
    abstract validateMessage(message: MessageProtocol): boolean;
}
```

The default `sanitizePayload()` is a JSON round-trip clone: functions,
`undefined` and symbols are dropped, `Date` becomes a string, and circular
references or `BigInt` values throw `SerializationError`. It does not escape
HTML.

---

## Channel Types

Exported for completeness; used by the low-level channel classes.

```typescript
interface ChannelOptions {
    allowedOrigins: string[];
    handshakeTimeout: number;
}

type ChannelState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface TargetInfo {
    id: string;
    target: HTMLIFrameElement | Window;
    type: 'iframe' | 'window';
    origin: string;
    connected: boolean;
    state: ConnectionState;
    lastActivity: number;
    connectedAt?: number;
    lastHeartbeat?: number;
    missedHeartbeats: number;
    consecutiveFailures: number;
}
```

---

## Generic Usage

### Typed Handlers and Requests

```typescript
import { Parley } from 'ignite-parleyjs';

interface GetUserRequest {
    userId: number;
}

interface GetUserResponse {
    id: number;
    name: string;
}

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://parent.example.com'],
});

// Receiver
parley.on<GetUserRequest>('user:get', async (payload, respond, metadata) => {
    const user = await loadUser(payload.userId);
    respond({ id: user.id, name: user.name } satisfies GetUserResponse);
});

// Sender: send<Payload, Response>, resolves to Response | undefined
const user = await parley.send<GetUserRequest, GetUserResponse>('user:get', {
    userId: 42,
});
console.log(user?.name);
```

The generic parameters are compile-time only. Use a `schema` to validate
payloads at runtime.

### Discriminated Unions for Responses

```typescript
type SaveResult = { ok: true; id: string } | { ok: false; reason: string };

parley.on('doc:save', async (payload, respond) => {
    try {
        const id = await save(payload);
        respond({ ok: true, id } satisfies SaveResult);
    } catch (error) {
        respond({ ok: false, reason: 'save failed' } satisfies SaveResult);
    }
});

const result = await parley.send<unknown, SaveResult>('doc:save', doc);
if (result?.ok) {
    console.log('Saved as', result.id);
}
```

---

## Navigation

**Previous**: [Error Codes](./error-codes.md) **Next**:
[Guides](../guides/index.md)

**Related**:

- [Methods Reference](./methods.md)
- [System Events](./system-events.md)
- [Installation: TypeScript Support](../getting-started/installation.md#typescript-support)
- [Message Validation](../security/message-validation.md)

**Back to**: [API Reference](./index.md)
