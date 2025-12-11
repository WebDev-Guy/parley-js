# Architecture

This document describes the internal architecture of Parley-js.

## Overview

Parley-js is designed with a modular, layered architecture that separates
concerns and enables extensibility.

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                          │
├─────────────────────────────────────────────────────────────┤
│                      Parley API Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │   send()    │ │ register()  │ │    onSystem()           ││
│  │ broadcast() │ │ unregister()│ │    onAnalytics()        ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    Core Components                          │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ │
│  │ MessageRegistry│ │  TargetManager │ │   EventEmitter   │ │
│  └────────────────┘ └────────────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                  Communication Layer                        │
│  ┌────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │BaseChannel │ │ IframeChannel │ │    WindowChannel      │ │
│  └────────────┘ └───────────────┘ └───────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Security Layer                           │
│  ┌─────────────────┐ ┌─────────────────────────────────────┐│
│  │ OriginValidator │ │        DefaultSecurityLayer         ││
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
│  │  (versioning, correlation, timestamps, serialization)    ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Parley Class (`core/Parley.ts`)

The main public API and orchestrator.

**Responsibilities:**

- Public API surface (`send`, `register`, `connect*`)
- Configuration management
- Lifecycle management (create, destroy)
- Coordinating between components
- Analytics event emission

**Key Design Decisions:**

- Factory pattern (`Parley.create()`) for consistent initialization
- Fluent configuration with sensible defaults
- Automatic cleanup on destroy

### 2. Message Protocol (`core/MessageProtocol.ts`)

Defines the wire format for messages.

**Message Structure:**

```typescript
interface MessageProtocol<T = unknown> {
    _v: string; // Protocol version (e.g., "1.0.0")
    _id: string; // Unique message ID (UUID v4)
    _type: string; // Message type identifier
    _timestamp: number; // Unix timestamp (ms)
    _origin: string; // Sender origin
    _expectsResponse: boolean;
    _correlationId?: string; // For request tracking
    payload: T; // Actual message data
}

interface ResponseProtocol<T = unknown> {
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
- Version field enables protocol evolution
- Correlation ID enables distributed tracing
- Separate response type for type safety

### 3. Communication Channels

Abstract base class with concrete implementations for different target types.

#### BaseChannel (`communication/BaseChannel.ts`)

**Responsibilities:**

- Common channel functionality
- Event listener management
- Message sending/receiving
- Connection state

**Lifecycle:**

```
Created → Connecting → Connected → Active → Disconnected → Destroyed
                ↑                      │
                └──────────────────────┘
                     (reconnect)
```

#### IframeChannel (`communication/IframeChannel.ts`)

**Specializations:**

- Handshake protocol for iframe readiness
- Content window reference management
- Cross-origin iframe support

**Handshake Flow:**

```
Parent                          Child (Iframe)
   │                                │
   │──── PARLEY:READY ─────────────>│
   │                                │
   │<─── PARLEY:READY_ACK ─────────│
   │                                │
   │      [Connection Ready]        │
```

#### WindowChannel (`communication/WindowChannel.ts`)

**Specializations:**

- Popup/window.open support
- Opener window detection
- Parent window detection (from iframe)

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
    type: 'iframe' | 'window' | 'parent' | 'opener';
    origin: string;
    state: ConnectionState; // 'connecting' | 'connected' | 'disconnecting' | 'disconnected'
    channel: BaseChannel;
    metadata?: Record<string, unknown>;
    missedHeartbeats: number;
    consecutiveFailures: number;
    lastHeartbeat?: number;
}
```

**State Management Methods:**

```typescript
// Update connection state
updateState(targetId: string, newState: ConnectionState): void;

// Record successful heartbeat response
recordHeartbeat(targetId: string): void;

// Record missed heartbeat
recordMissedHeartbeat(targetId: string): number;  // Returns new count

// Track send success/failure for dead connection detection
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
            │                               │
            ▼                               │
    Wait for Pong                           │
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

### 5. Message Registry (`core/MessageRegistry.ts`)

Manages message type handlers and schemas.

**Responsibilities:**

- Handler registration
- Schema association
- Handler lookup
- Type checking

### 6. Security Layer

#### OriginValidator (`security/OriginValidator.ts`)

**Validation Strategy:**

- Exact match by default
- Wildcard support (`*.example.com`)
- Protocol enforcement (https only in production)

```typescript
// Validation examples
isValidOrigin('https://app.example.com', ['*.example.com']); // true
isValidOrigin('http://evil.com', ['https://example.com']); // false
```

#### DefaultSecurityLayer (`security/SecurityLayer.ts`)

**Security Checks:**

1. Origin validation
2. Message structure validation
3. Protocol version compatibility
4. Timestamp freshness (prevent replay)

### 7. Schema Validator (`validation/SchemaValidator.ts`)

Lightweight JSON Schema subset implementation.

**Supported Features:**

- Type validation (`string`, `number`, `boolean`, `object`, `array`, `null`)
- Required properties
- Property constraints (`minLength`, `maxLength`, `minimum`, `maximum`)
- Array constraints (`minItems`, `maxItems`)
- Nested object/array validation

**Design Rationale:**

- Zero dependencies
- Covers 90% of use cases
- ~2KB gzipped

### 8. Event System

#### EventEmitter (`events/EventEmitter.ts`)

Type-safe, generic event emitter.

**Features:**

- Generic type parameter for event map
- Auto-cleanup with returned unsubscribe functions
- `once()` for single-fire handlers

#### SystemEvents (`events/SystemEvents.ts`)

Predefined system event types.

```typescript
type SystemEventMap = {
    'target:connected': { targetId: string; origin: string };
    'target:disconnected': { targetId: string; reason?: string };
    'message:sent': { messageId: string; type: string };
    // ... etc
};
```

### 9. Analytics (`analytics/AnalyticsHooks.ts`)

Pluggable analytics system.

**Event Types:**

- Connection events
- Message events
- Error events
- Performance metrics

**Integration Pattern:**

```typescript
parley.onAnalytics((event) => {
    // Forward to any analytics service
    myAnalytics.track(event.type, event.data);
});
```

## Data Flow

### Sending a Message

```
1. Application calls parley.send(targetId, type, payload)
              │
              ▼
2. Parley validates target exists (TargetManager)
              │
              ▼
3. Schema validation (if configured)
              │
              ▼
4. Create MessageProtocol wrapper
              │
              ▼
5. Get channel from target
              │
              ▼
6. Channel.send() → window.postMessage()
              │
              ▼
7. Create pending request entry (with timeout)
              │
              ▼
8. Emit analytics event
              │
              ▼
9. Return Promise (resolves on response)
```

### Receiving a Message

```
1. window.addEventListener('message', handler)
              │
              ▼
2. Security layer validates origin
              │
              ▼
3. Parse and validate message structure
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
5a. Find pending      5b. Find handler
    request               in registry
   │                     │
   ▼                     ▼
6a. Clear timeout     6b. Execute handler
   │                     │
   ▼                     ▼
7a. Resolve           7b. Send response
    promise               │
                         ▼
                      8b. Emit events
```

## Error Handling Strategy

### Error Taxonomy

```
ParleyError (base)
├── ValidationError
│   ├── Schema validation failed
│   └── Protocol validation failed
├── TimeoutError
│   ├── No response received
│   └── Handshake timeout
├── SecurityError
│   ├── Origin not allowed
│   └── Message tampering detected
├── TargetNotFoundError
│   └── Unknown target ID
├── ConnectionError
│   ├── Handshake failed
│   └── Target not ready
└── SerializationError
    └── Cannot serialize payload
```

### Error Codes

All errors include a code for programmatic handling:

```typescript
// Error code format: ERR_CATEGORY_SPECIFIC
const TIMEOUT_ERRORS = {
    NO_RESPONSE: 'ERR_TIMEOUT_NO_RESPONSE',
    HANDSHAKE: 'ERR_TIMEOUT_HANDSHAKE',
};
```

## Memory Management

### Cleanup Strategy

1. **Automatic cleanup on disconnect:**
    - Event listeners removed
    - Pending requests rejected
    - Timers cleared

2. **Manual cleanup via `destroy()`:**
    - All channels destroyed
    - All handlers removed
    - All pending requests rejected

3. **Weak references where possible:**
    - Window references not strongly held
    - Allows GC of closed windows/iframes

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

| Format   | File                   | Use Case                      |
| -------- | ---------------------- | ----------------------------- |
| CommonJS | `dist/index.js`        | Node.js, older bundlers       |
| ESM      | `dist/index.mjs`       | Modern bundlers, ESM projects |
| IIFE     | `dist/index.global.js` | Direct browser usage          |
| Types    | `dist/index.d.ts`      | TypeScript support            |

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

## Extension Points

### Custom Security Layer

```typescript
import { SecurityLayer, Parley } from 'parley-js';

class CustomSecurityLayer implements SecurityLayer {
    validateOrigin(origin: string): boolean {
        // Custom validation logic
    }

    validateMessage(message: unknown): boolean {
        // Custom message validation
    }
}

const parley = Parley.create({
    securityLayer: new CustomSecurityLayer(),
});
```

### Custom Channel Types

Extend `BaseChannel` for custom communication patterns:

```typescript
class ServiceWorkerChannel extends BaseChannel {
    // Implement abstract methods
}
```

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
- Configurable per-message
- Exponential backoff on retries

### Bundle Size

- Core: ~15KB minified
- Full: ~40KB minified
- Gzipped: ~12KB

## Testing Considerations

### Unit Testing

Each component is independently testable:

```typescript
// Test MessageProtocol
const msg = createMessage('test', { data: 1 }, 'http://test.com');
expect(msg._type).toBe('test');

// Test SchemaValidator
const result = validator.validate(data, schema);
expect(result.valid).toBe(true);
```

### Integration Testing

```typescript
// Mock postMessage
const mockWindow = {
    postMessage: jest.fn(),
    addEventListener: jest.fn(),
};
```

### E2E Testing

Use actual iframe/window communication in browser tests.

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
     Remote Disconnect   Local Disconnect   Max Heartbeat
     Received            Called             Failures
              │               │               │
              │               ▼               │
              │       ┌───────────────┐       │
              │       │ DISCONNECTING │       │
              │       │ (handshake)   │       │
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

The heartbeat mechanism ensures connection health:

```
Parent                                Child
   │                                     │
   │   ┌─── Heartbeat Interval ───┐      │
   │   │        (5000ms)          │      │
   │   └──────────────────────────┘      │
   │                                     │
   │───── system:heartbeat_ping ────────>│
   │                                     │
   │      ┌─── Timeout ───┐              │
   │      │   (2000ms)    │              │
   │      └───────────────┘              │
   │                                     │
   │<──── system:heartbeat_pong ─────────│
   │                                     │
   │   [missedHeartbeats = 0]            │
   │                                     │
   │   ... repeat ...                    │
   │                                     │
```

**Failure Detection:**

```
If no pong received within timeout:
   missedHeartbeats++

   if (missedHeartbeats >= maxMissed):
       Emit 'system:connection_lost' { reason: 'heartbeat_failure' }
       Transition to DISCONNECTED
       Clean up target
```

### Disconnect Handshake

Graceful disconnection with acknowledgment:

```
Initiator                            Remote
    │                                   │
    │  [State → DISCONNECTING]          │
    │                                   │
    │───── system:disconnect ──────────>│
    │      { reason: 'local' }          │
    │                                   │
    │      ┌─── Timeout ───┐            │
    │      │   (1000ms)    │            │
    │      └───────────────┘            │
    │                                   │
    │<──── system:disconnect ──────────│ (Ack)
    │      { ack: true }                │
    │                                   │
    │  [State → DISCONNECTED]           │[State → DISCONNECTED]
    │  [Emit 'target:disconnected']     │[Emit 'system:connection_lost']
    │  [Clean up]                       │[Clean up]
```

**Timeout Behavior:**

If acknowledgment not received within 1 second:

- Log warning but proceed with cleanup
- Other side may have already disconnected

### System Message Types

```typescript
const SYSTEM_MESSAGE_TYPES = {
    DISCONNECT: 'system:disconnect',
    HEARTBEAT_PING: 'system:heartbeat_ping',
    HEARTBEAT_PONG: 'system:heartbeat_pong',
};
```

### Disconnect Reasons

```typescript
enum DisconnectReason {
    LOCAL_DISCONNECT = 'local_disconnect', // This side called disconnect()
    REMOTE_DISCONNECT = 'remote_disconnect', // Other side called disconnect()
    HEARTBEAT_FAILURE = 'heartbeat_failure', // Heartbeat timeout
    SEND_FAILURE = 'send_failure', // Too many send failures
    DESTROYED = 'destroyed', // Parley instance destroyed
}
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
       │
       ▼
Handshake completes
       │
       ▼
[State: CONNECTED]
Emit: 'target:connected' { targetId: 'child' }
Emit: 'system:connection_state_changed' { 'connecting' → 'connected' }
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
Send: system:disconnect
       │
       ▼
Wait for ack (max 1s)
       │
       ▼
[State: DISCONNECTED]
Emit: 'target:disconnected' { targetId: 'child', reason: 'local_disconnect' }
Emit: 'system:connection_state_changed' { 'disconnecting' → 'disconnected' }
Stop heartbeat
Clean up target
```

### Error Codes for Connection Issues

```typescript
// Connection-related error codes
const CONNECTION_ERRORS = {
    CONNECTION_FAILED: 'CONNECTION_FAILED', // Handshake failed
    CONNECTION_LOST: 'CONNECTION_LOST', // Lost due to heartbeat/send failure
    NOT_CONNECTED: 'NOT_CONNECTED', // Target not in connected state
    HEARTBEAT_TIMEOUT: 'HEARTBEAT_TIMEOUT', // Heartbeat response timeout
};
```

---

## Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Testing Guide](./TESTING.md) - Testing documentation and best practices
- [Security Guide](./SECURITY.md) - Security best practices
- [Examples](./EXAMPLES.md) - Code examples and patterns
- [Contributing](../CONTRIBUTING.md) - Contribution guidelines
- [README](../README.md) - Project overview
