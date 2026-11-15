[Home](./index.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Architecture

# Architecture

This document describes the internal architecture of Parley-js.

## Overview

Parley-js is designed with a modular, layered architecture that separates
concerns and enables extensibility.

For implementation patterns based on this architecture, see
[Code Patterns](./CODE_PATTERNS.md). For API documentation, see
[API Reference](./API.md).

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                          │
├─────────────────────────────────────────────────────────────┤
│                      Parley API Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │   send()    │ │ register()  │ │    onSystem()           ││
│  │ broadcast() │ │    on()     │ │    onAnalyticsEvent()   ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    Core Components                          │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ │
│  │ MessageRegistry│ │  TargetManager │ │   EventEmitter   │ │
│  ├────────────────┤ ├────────────────┤ ├──────────────────┤ │
│  │  SendPipeline  │ │ConnectionManager││ HeartbeatManager │ │
│  └────────────────┘ └────────────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                  Communication Layer                        │
│  ┌────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │BaseChannel │ │ IframeChannel │ │    WindowChannel      │ │
│  └────────────┘ └───────────────┘ └───────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                 HandshakeController                      ││
│  └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    Security Layer                           │
│  ┌─────────────────┐ ┌─────────────────────────────────────┐│
│  │ OriginValidator │ │ SecurityLayer / DefaultSecurityLayer││
│  └─────────────────┘ └─────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    Validation Layer                         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                  SchemaValidator                         ││
│  └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                      Protocol Layer                         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                  MessageProtocol                         ││
│  │  (versioning, request/response ids, timestamps)          ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Parley Class (`core/Parley.ts`)

The main public API and orchestrator.

**Responsibilities:**

- Public API surface (`send`, `broadcast`, `register`, `on`, `connect`,
  `disconnect`, `onSystem`, `onAnalyticsEvent`, `destroy`)
- Configuration validation and defaults
- Lifecycle management (create, destroy)
- Inbound security checks and handler dispatch
- Coordinating between components

**Key Design Decisions:**

- Factory pattern (`Parley.create()`) for consistent initialization; the
  constructor is private
- Configuration validated up front (`create()` throws
  `'Configuration error: ...'` for invalid options)
- One instance handles one `targetType` (`'iframe'` or `'window'`)
- Automatic cleanup on destroy

Sending is delegated to `SendPipeline` (`core/SendPipeline.ts`) and
connect/disconnect flows to `ConnectionManager` (`core/ConnectionManager.ts`).

### 2. Message Protocol (`core/MessageProtocol.ts`)

Defines the wire format for messages.

**Message Structure:**

```typescript
interface MessageProtocol<T = unknown> {
    _parley: '__parley__'; // Identifies Parley messages
    _v: string; // Protocol version (e.g., "1.0.0")
    _id: string; // Unique message ID (UUID v4)
    _type: string; // Message type identifier
    _timestamp: number; // Unix timestamp (ms)
    _origin: string; // Sender-reported origin (informational, never trusted)
    _target?: string; // Optional target identifier
    _expectsResponse: boolean;
    payload: T; // Actual message data
}

interface ResponseProtocol<T = unknown> {
    _parley: '__parley__';
    _v: string;
    _id: string;
    _requestId: string; // Original message ID
    _timestamp: number;
    _origin: string;
    success: boolean;
    payload?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}
```

**Design Rationale:**

- Underscore prefix (`_`) for protocol fields to avoid collision with user data
- Version field enables protocol evolution; only the **major** version must
  match
- `_requestId` links a response to its request
- Separate response type for type safety
- Receivers never trust `_origin`; they use the browser's `event.origin`

### 3. Communication Channels

Abstract base class with concrete implementations for different target types.

#### BaseChannel (`communication/BaseChannel.ts`)

**Responsibilities:**

- Common channel functionality
- Event listener management
- Message sending (`postMessage` with an explicit target origin, never `'*'`)
- Inbound filtering: origin allowlist (exact match) and `event.source` binding
  to the channel's own target window
- Re-sending the handshake until it is acknowledged

**Lifecycle:**

```
Created → Connecting → Connected → Disconnected → Destroyed
```

There is no automatic reconnection. To reconnect, application code listens for
`system:connection_lost` / `system:disconnected` and calls `connect()` again.

#### IframeChannel (`communication/IframeChannel.ts`)

**Specializations:**

- Parent side: `connect(iframeElement)`; child side: `connect(window.parent)`
- Content window reference management
- Cross-origin iframe support (target origin taken from `allowedOrigins`, never
  from the iframe's `src`)

**Handshake Flow:**

Both sides call `connect()`. The connecting side (the iframe child, or the popup
for `WindowChannel`) sends `__parley_handshake_init__` and keeps re-sending it
(every 100-500 ms) until it receives `__parley_handshake_ack__` or the `timeout`
expires. Because of the re-sends, no `load` listener or delay is needed on
either side.

```
Parent                               Child (Iframe)
   │                                     │
   │  connect(iframe)                    │  connect(window.parent)
   │  [waiting for INIT]                 │
   │<──── __parley_handshake_init__ ─────│  (re-sent until ACK)
   │<──── __parley_handshake_init__ ─────│
   │                                     │
   │───── __parley_handshake_ack__ ─────>│
   │                                     │
   │      [Connection Ready]             │
```

On timeout, `connect()` rejects with `ConnectionError`
`ERR_CONNECTION_HANDSHAKE_FAILED`.

#### WindowChannel (`communication/WindowChannel.ts`)

**Specializations:**

- Popup/`window.open` support: opener calls `connect(popup)`, the popup calls
  `connect(window.opener)`
- Closed-window detection (polling about once per second), which triggers
  `system:connection_lost` with reason `'connection_lost'`

### 4. Target Manager (`core/TargetManager.ts`)

Manages registered communication targets.

**Responsibilities:**

- Target registration/unregistration
- Target lookup by ID
- Alive/health checking
- Connection state management
- Heartbeat tracking
- Cleanup on disconnect

**Data Structure:**

```typescript
interface TargetInfo {
    id: string;
    target: HTMLIFrameElement | Window;
    type: 'iframe' | 'window';
    origin: string;
    connected: boolean;
    state: ConnectionState; // 'connecting' | 'connected' | 'disconnecting' | 'disconnected'
    lastActivity: number;
    connectedAt?: number;
    lastHeartbeat?: number;
    missedHeartbeats: number;
    consecutiveFailures: number;
}
```

**State Management Methods:**

```typescript
// Update connection state
updateState(targetId: string, newState: ConnectionState): ConnectionState | undefined;

// Record successful heartbeat response
recordHeartbeat(targetId: string): void;

// Record missed heartbeat
recordMissedHeartbeat(targetId: string): number;  // Returns new count

// Track request success/failure for dead connection detection
recordSendSuccess(targetId: string): void;
recordSendFailure(targetId: string): number;  // Returns failure count
```

### 5. Heartbeat Manager (`core/HeartbeatManager.ts`)

Manages periodic heartbeat checks for connection health monitoring.

**Responsibilities:**

- Schedule heartbeat pings per target
- Invoke callbacks on heartbeat send
- Invoke callbacks on heartbeat failure (timeout)
- Cleanup on disconnect

**Lifecycle:**

```
Target Connected
       │
       ▼
start(targetId)
       │
       ▼
┌─────────────────────────┐
│   Heartbeat Interval    │◄────────────────┐
│   (default: 5000ms)     │                 │
└───────────┬─────────────┘                 │
            │                               │
            ▼                               │
    onSend(targetId)                        │
    (ping request)                          │
            │                               │
            ▼                               │
    Wait for ping response                  │
    (timeout: 2000ms)                       │
            │                               │
     ┌──────┴──────┐                        │
     │             │                        │
     ▼             ▼                        │
  Received     Timeout                      │
     │             │                        │
     │             ▼                        │
     │      onFailure(targetId)             │
     │             │                        │
     └──────┬──────┘                        │
            │                               │
            └───────────────────────────────┘

stop(targetId) - Called on disconnect
stopAll() - Called on destroy
```

### 6. Message Registry (`core/MessageRegistry.ts`)

Manages message type handlers and schemas.

**Responsibilities:**

- Type registration (`register(type, { schema, timeout, retries, onError })`)
- Handler registration (`on(type, handler)`, which auto-registers unknown types)
- Schema association and payload validation
- Handler lookup
- Rejecting reserved type names (`__parley_*`, `system:*`)

### 7. Security Layer

#### OriginValidator (`security/OriginValidator.ts`)

**Validation Strategy:**

- Origins normalized to their URL origin and lowercased
- Exact match only; no wildcard or subdomain patterns
- `'*'`, `'null'`, empty strings and empty lists are rejected by
  `Parley.create()`

```typescript
import { validateOrigin } from 'ignite-parleyjs';

// Returns { valid, normalizedOrigin, error? }
validateOrigin('https://app.example.com', ['https://app.example.com']).valid; // true
validateOrigin('https://app.example.com', ['*.example.com']).valid; // false
validateOrigin('http://evil.com', ['https://example.com']).valid; // false
```

#### SecurityLayer / DefaultSecurityLayer (`security/SecurityLayer.ts`)

`SecurityLayer` is an abstract class with three methods:
`validateOrigin(origin, allowedOrigins)`, `sanitizePayload(payload)` and
`validateMessage(message)`. `DefaultSecurityLayer` implements them as:

1. Origin validation: exact match after normalization
2. Payload sanitization: JSON round-trip clone of outgoing payloads and
   responses (drops functions/`undefined`; throws `SerializationError` for
   circular references or BigInt). It does not escape HTML.
3. Message validation: protocol structure and field types

There is **no** timestamp-freshness or replay protection.

#### Inbound Pipeline

Every inbound `message` event goes through these steps, in order:

```
1. Channel: event.origin in allowedOrigins?         ─ no → dropped silently
2. Channel: event.source === this channel's target? ─ no → dropped silently
3. Channel: Parley-shaped message?                  ─ no → ignored
4. Parley:  securityLayer.validateOrigin()          ─ no → system:error ERR_SECURITY_ORIGIN_MISMATCH
5. Parley:  protocol structure valid?               ─ no → system:error ERR_VALIDATION_INVALID_PROTOCOL
6. Parley:  protocol major version compatible?      ─ no → system:error ERR_SECURITY_VERSION_MISMATCH
7. Parley:  requests only: securityLayer.validateMessage() ─ no → system:error ERR_VALIDATION_INVALID_PROTOCOL
8. Response → matched to its pending request (only from the target it was sent to)
   Request  → schema validation (if registered) → handlers
```

### 8. Schema Validator (`validation/SchemaValidator.ts`)

Lightweight JSON Schema subset implementation.

**Supported Features:**

- Type validation (`string`, `number`, `integer`, `boolean`, `object`, `array`,
  `null`; a single type, not type arrays)
- `required`, `properties`, `additionalProperties`
- `items` for arrays
- `minLength` / `maxLength` (strings and arrays), `minimum` / `maximum`
- `pattern`, `enum`
- Nested object/array validation (depth limit 50)

Other keywords (`format`, `minItems`, `maxItems`, `oneOf`, `$ref`, ...) are
ignored.

**Design Rationale:**

- Zero dependencies
- Covers common payload-shape checks
- Small enough to ship in the core bundle

### 9. Event System

#### EventEmitter (`events/EventEmitter.ts`)

Type-safe, generic event emitter.

**Features:**

- Auto-cleanup with returned unsubscribe functions
- `once()` for single-fire handlers
- Listener limit per event (default 100)

#### SystemEvents (`events/SystemEvents.ts`)

Predefined system event names (`SYSTEM_EVENTS`) and payload types, used with
`parley.onSystem()`:

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

SYSTEM_EVENTS.CONNECTED; // 'system:connected' { targetId, targetType, origin, timestamp }
SYSTEM_EVENTS.DISCONNECTED; // 'system:disconnected' { targetId, reason, timestamp }
SYSTEM_EVENTS.CONNECTION_LOST; // 'system:connection_lost'
SYSTEM_EVENTS.CONNECTION_STATE_CHANGED; // 'system:connection_state_changed'
SYSTEM_EVENTS.HEARTBEAT_MISSED; // 'system:heartbeat_missed'
SYSTEM_EVENTS.ERROR; // 'system:error'
SYSTEM_EVENTS.TIMEOUT; // 'system:timeout'
SYSTEM_EVENTS.MESSAGE_SENT; // 'system:message_sent'
SYSTEM_EVENTS.MESSAGE_RECEIVED; // 'system:message_received'
SYSTEM_EVENTS.RESPONSE_SENT; // 'system:response_sent'
SYSTEM_EVENTS.RESPONSE_RECEIVED; // 'system:response_received'
SYSTEM_EVENTS.HANDSHAKE_START; // 'system:handshake_start' (also _COMPLETE, _FAILED)
```

### 10. Analytics (`analytics/AnalyticsHooks.ts`)

Pluggable analytics system, enabled with `analyticsEnabled: true`.

**Event Types:**

- `message_sent`, `message_received`
- `response_sent`, `response_received` (with `duration`)
- `error`, `timeout`

**Integration Pattern:**

```typescript
parley.onAnalyticsEvent((event) => {
    // Fields are top-level: type, messageType, messageId, targetId?, timestamp, ...
    myAnalytics.track(event.type, event);
});
```

## Data Flow

### Sending a Message

```
1. Application calls parley.send(type, payload, { targetId })
              │
              ▼
2. Rate limit check (if rateLimit.enabled)
              │
              ▼
3. securityLayer.sanitizePayload() (JSON clone) + 10 MB size check
              │
              ▼
4. Schema validation (if the type was registered with a schema)
              │
              ▼
5. Create MessageProtocol wrapper
              │
              ▼
6. Resolve connected target(s) (TargetManager); none → TargetNotFoundError
              │
              ▼
7. Emit analytics + system:message_sent
              │
              ▼
8. Channel.send() → window.postMessage(message, explicitOrigin)
              │
              ▼
9. Create pending request entry (with timeout and retries)
              │
              ▼
10. Return Promise (resolves on first response, rejects on error/timeout)
```

### Receiving a Message

```
1. window 'message' event (channel listener)
              │
              ▼
2. Channel: origin allowlist + event.source check
              │
              ▼
3. Parley: SecurityLayer.validateOrigin(), protocol structure/version,
           SecurityLayer.validateMessage() (requests)
              │
              ▼
4. Check if response or request
              │
              ▼
   ┌──────────┴──────────┐
   ▼                     ▼
Response             Request
   │                     │
   ▼                     ▼
5a. Find pending      5b. Schema validation
    request (from         (if registered)
    the same target)     │
   │                     ▼
   ▼                  6b. Execute handlers
6a. Clear timeout        │
   │                     ▼
   ▼                  7b. Handler calls respond()
7a. Resolve /            │
    reject promise       ▼
                      8b. Emit events
```

## Error Handling Strategy

### Error Taxonomy

```
ParleyError (base)
├── ValidationError
│   └── Schema validation failed / payload too large
├── TimeoutError
│   └── No response received (after all retries)
├── SecurityError
├── TargetNotFoundError
│   ├── Target not connected
│   └── Duplicate target ID
├── ConnectionError
│   ├── Handshake failed
│   ├── Invalid target
│   └── Connection closed (target disconnected / instance destroyed)
└── SerializationError
    └── Cannot serialize payload (circular reference, BigInt)
```

Errors from the remote side (`ERR_HANDLER_ERROR`, `ERR_NO_HANDLER`, remote
schema mismatch) arrive as plain `ParleyError` instances carrying the remote
code. Inbound security rejections are never thrown; they are reported through
`system:error`.

### Error Codes

All errors include a code for programmatic handling:

```typescript
// Error code format: ERR_CATEGORY_SPECIFIC
const TIMEOUT_ERRORS = {
    NO_RESPONSE: 'ERR_TIMEOUT_NO_RESPONSE',
    // ...
};
```

## Memory Management

### Cleanup Strategy

1. **Automatic cleanup on disconnect:**
    - Event listeners removed
    - Pending requests rejected
    - Timers cleared

2. **Manual cleanup via `destroy()`:**
    - All channels destroyed (`system:disconnected` with reason `'destroyed'`
      per target)
    - All handlers removed
    - All pending requests rejected

### Preventing Memory Leaks

```typescript
// All subscriptions return cleanup functions
const unsub = parley.on('message', handler);
// Later:
unsub();

// Or destroy everything
parley.destroy();
```

## Build Configuration

### Output Formats

| Format   | File                   | Use Case                               |
| -------- | ---------------------- | -------------------------------------- |
| ESM      | `dist/index.js`        | Modern bundlers, ESM projects          |
| CommonJS | `dist/index.cjs`       | Older bundlers, `require()`            |
| IIFE     | `dist/index.global.js` | Direct browser usage (`window.Parley`) |
| Types    | `dist/index.d.ts`      | TypeScript support                     |

### Build-Time Defines

```typescript
// Replaced at build time
declare const __DEV__: boolean;
declare const __VERSION__: string;

// Usage
if (__DEV__) {
    console.log('Debug info...');
}
```

### Property Mangling (Production)

Production builds shorten internal `_`-prefixed property names (about 10%
smaller). Names that must keep their spelling are reserved in
`build/mangle-props.ts`: the wire-protocol fields (`_parley`, `_v`, `_id`,
`_type`, `_timestamp`, `_origin`, `_target`, `_expectsResponse`, `_requestId`)
and `protected` members of exported classes (so subclasses such as custom
channels keep working). A unit test fails if a new wire field or protected
member is not listed.

## Extension Points

### Custom Security Layer

`SecurityLayer` is an abstract class. Extend `DefaultSecurityLayer` to override
one method, or extend `SecurityLayer` and implement all three:

```typescript
import {
    Parley,
    DefaultSecurityLayer,
    type MessageProtocol,
} from 'ignite-parleyjs';

class CustomSecurityLayer extends DefaultSecurityLayer {
    validateOrigin(origin: string, allowedOrigins: string[]): boolean {
        // Custom validation logic (can only narrow what the channel accepted)
        return (
            super.validateOrigin(origin, allowedOrigins) && !isBlocked(origin)
        );
    }

    validateMessage(message: MessageProtocol): boolean {
        // Custom message validation
        return super.validateMessage(message) && KNOWN_TYPES.has(message._type);
    }

    // sanitizePayload<T>(payload: T): T inherited
}

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted.example.com'],
    securityLayer: new CustomSecurityLayer(),
});
```

Since 1.1.0 all three methods are invoked: `validateOrigin()` on every inbound
message, `validateMessage()` on every inbound request, and `sanitizePayload()`
on every outgoing payload and response.

### Custom Channel Types

`BaseChannel`, `IframeChannel` and `WindowChannel` are exported, and their
`protected` members are preserved in production builds, so they can be
subclassed. However, `Parley.create()` only supports `targetType: 'iframe'` and
`'window'`; there is no public option to plug a custom channel into a Parley
instance. Web Workers, Service Workers and `MessageChannel` ports are not
supported.

## Performance Considerations

### Message Batching

For high-frequency messages, consider batching:

```typescript
// Not built-in, but pattern supported
const batcher = createBatcher(
    (messages) => {
        parley.send('batch', { messages }, { targetId: 'target' });
    },
    { maxSize: 10, maxWait: 100 }
);

batcher.add(message1);
batcher.add(message2);
```

### Timeout Optimization

- Default timeout: 5000ms
- Configurable per message type (`register(type, { timeout, retries })`) and per
  call (`send(type, payload, { timeout, retries })`)
- Retries re-send the same message (same id) after each `timeout`, at a fixed
  interval (no backoff)

### Bundle Size

- ~55 KB minified (ESM/CJS), ~16 KB gzipped
- No runtime dependencies

## Testing Considerations

### Unit Testing

Each component is independently testable:

```typescript
import { createMessage, SchemaValidator } from 'ignite-parleyjs';

// Test MessageProtocol
const msg = createMessage({ type: 'test', payload: { data: 1 } });
expect(msg._type).toBe('test');

// Test SchemaValidator
const result = new SchemaValidator().validate(data, schema);
expect(result.valid).toBe(true);
```

### Integration Testing

```typescript
// Mock postMessage
const mockWindow = {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
};
```

Note that channels check `event.source`, so a simulated message is only accepted
if its `source` is the exact window object the channel was connected to.

### E2E Testing

Use actual iframe/window communication in browser tests (the project uses
Playwright: `npm run test:e2e`).

---

## Connection Lifecycle

### Connection States

Connections progress through defined states:

```
     ┌─────────────────────────────────────────────────────────┐
     │                    State Machine                        │
     └─────────────────────────────────────────────────────────┘

                      ┌───────────────┐
                      │  CONNECTING   │
                      │ (handshake)   │
                      └───────┬───────┘
                              │
                    Handshake Success
                              │
                              ▼
                      ┌───────────────┐
              ┌───────│   CONNECTED   │───────┐
              │       │  (healthy)    │       │
              │       └───────┬───────┘       │
              │               │               │
     Remote Disconnect   Local Disconnect   Heartbeat timeout /
     Received            Called             max failures /
              │               │             window closed
              │               ▼               │
              │       ┌───────────────┐       │
              │       │ DISCONNECTING │       │
              │       │ (notify peer) │       │
              │       └───────┬───────┘       │
              │               │               │
              │        Ack or Timeout         │
              │               │               │
              └───────────────┼───────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ DISCONNECTED  │
                      │   (final)     │
                      └───────────────┘
```

### Heartbeat Protocol

The heartbeat mechanism ensures connection health. Each side pings each of its
targets; the pong is the **response** to the ping request, not a separate
message type.

```
Parent                                Child
   │                                     │
   │   ┌─── Heartbeat Interval ───┐      │
   │   │        (5000ms)          │      │
   │   └──────────────────────────┘      │
   │                                     │
   │──── __parley_heartbeat_ping ───────>│  (request)
   │                                     │
   │      ┌─── Timeout ───┐              │
   │      │   (2000ms)    │              │
   │      └───────────────┘              │
   │                                     │
   │<──── response (pong payload) ───────│
   │                                     │
   │   [missedHeartbeats = 0]            │
   │                                     │
   │   ... repeat ...                    │
   │                                     │
```

**Failure Detection:**

```
If no response within heartbeat.timeout:
   missedHeartbeats++
   Emit 'system:heartbeat_missed' { targetId, consecutiveMissed }

   if (missedHeartbeats >= maxMissed):
       Emit 'system:connection_lost' { reason: 'heartbeat_timeout' }
       Transition to DISCONNECTED ('system:disconnected')
       Clean up target
```

Separately, `heartbeat.maxFailures` consecutive timed-out targeted requests
(`send()` with a `targetId`) end the connection with reason
`'max_failures_reached'`, and a closed popup ends it with reason
`'connection_lost'`.

### Disconnect Handshake

Graceful disconnection with acknowledgment:

```
Initiator                            Remote
    │                                   │
    │  [State → DISCONNECTING]          │
    │                                   │
    │───── __parley_disconnect ────────>│
    │      { reason: 'manual_disconnect' }
    │                                   │
    │      ┌─── Timeout ───┐            │
    │      │   (1000ms)    │            │
    │      └───────────────┘            │
    │                                   │
    │<──── response { acknowledged } ───│
    │                                   │
    │  [State → DISCONNECTED]           │[State → DISCONNECTED]
    │  [Emit 'system:disconnected'      │[Emit 'system:disconnected'
    │   reason 'manual_disconnect']     │ reason 'manual_disconnect']
    │  [Clean up]                       │[Clean up]
```

**Timeout Behavior:**

If acknowledgment not received within 1 second:

- Log warning but proceed with cleanup
- Other side may have already disconnected

### System Message Types

```typescript
const SYSTEM_MESSAGE_TYPES = {
    DISCONNECT: '__parley_disconnect',
    HEARTBEAT_PING: '__parley_heartbeat_ping',
};
// The pong is the response to HEARTBEAT_PING, not a separate message type.
// The handshake itself uses '__parley_handshake_init__' / '__parley_handshake_ack__'.
```

### Disconnect Reasons

```typescript
type DisconnectReason =
    | 'manual_disconnect' // disconnect() was called (on either side)
    | 'connection_lost' // e.g. popup window closed
    | 'heartbeat_timeout' // maxMissed heartbeats missed
    | 'max_failures_reached' // maxFailures consecutive request timeouts
    | 'cleanup' // stale target cleanup
    | 'destroyed'; // Parley instance destroyed
```

### Connection Events Timeline

```
Parent creates Parley
       │
       ▼
connect(iframe, 'child')
       │
       ▼
[State: CONNECTING]
Emit: 'system:handshake_start'
       │
       ▼
Handshake completes
       │
       ▼
[State: CONNECTED]
Emit: 'system:handshake_complete'
Emit: 'system:connection_state_changed' { 'connecting' → 'connected' }
Emit: 'system:connected' { targetId: 'child', targetType, origin }
       │
       ▼
Start heartbeat interval
       │
       ▼
... normal operation ...
       │
       ▼
disconnect('child') called
       │
       ▼
[State: DISCONNECTING]
Emit: 'system:connection_state_changed' { 'connected' → 'disconnecting' }
Send: __parley_disconnect
       │
       ▼
Wait for ack (max 1s)
       │
       ▼
[State: DISCONNECTED]
Emit: 'system:connection_state_changed' { 'disconnecting' → 'disconnected' }
Emit: 'system:disconnected' { targetId: 'child', reason: 'manual_disconnect' }
Stop heartbeat
Clean up target
```

### Error Codes for Connection Issues

```typescript
// Connection-related error codes actually produced
'ERR_CONNECTION_HANDSHAKE_FAILED'; // Handshake timed out
'ERR_CONNECTION_FAILED'; // Invalid target passed to connect()
'ERR_CONNECTION_CLOSED'; // Pending request rejected: target disconnected / instance destroyed
'ERR_CONNECTION_NOT_CONNECTED'; // Target not in connected state
'ERR_TARGET_NOT_CONNECTED'; // send() to an unknown or disconnected target
'ERR_TARGET_DUPLICATE_ID'; // connect() with a targetId already in use
```

Connection loss itself is not thrown; it is reported through
`system:connection_lost` and `system:disconnected`.

---

## Navigation

### Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Framework Reference](./FRAMEWORK_REFERENCE.md) - Quick reference guide
- [Security Guide](./SECURITY.md) - Security layer design

### See Also

- [Testing Guide](./TESTING.md) - Testing the architecture
- [Examples](./EXAMPLES.md) - Implementation examples
- [Contributing](https://github.com/WebDev-Guy/parley-js/blob/main/CONTRIBUTING.md) -
  Contributing to the codebase

**Back to**: [Documentation Home](./index.md)
