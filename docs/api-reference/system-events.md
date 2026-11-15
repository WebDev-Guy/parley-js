[Home](../index.md) > [API Reference](./index.md) > System Events

# System Events

Reference documentation for all system events emitted by ParleyJS.

## Table of Contents

1. [Overview](#overview)
2. [Event Lifecycle](#event-lifecycle)
3. [Connection Events](#connection-events)
4. [Message Events](#message-events)
5. [Error Events](#error-events)
6. [Handshake Events](#handshake-events)
7. [Heartbeat Events](#heartbeat-events)
8. [Listening to System Events](#listening-to-system-events)
9. [Common Patterns](#common-patterns)
10. [Best Practices](#best-practices)

---

## Overview

System events provide visibility into ParleyJS internal operations. They are
emitted for connection lifecycle, message flow, errors, and heartbeat
monitoring.

All system events use the `system:` prefix to avoid conflicts with user-defined
message types. You listen to system events using `parley.onSystem()`, which
returns an unsubscribe function. `parley.on()` is only for application message
types and cannot be used for system events.

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
});
```

System events are useful for logging, analytics, debugging, and monitoring
application health.

`SYSTEM_EVENTS` is a named export. `Parley.SYSTEM_EVENTS` only exists on the
browser IIFE global (`window.Parley`).

The examples on this page access fields on `event` directly for brevity. The
handler parameter is typed `unknown`; in TypeScript, cast it to the matching
event data type (see [Typed Listeners](#typed-listeners)).

---

## Event Lifecycle

System events are emitted at key points in the communication lifecycle:

1. **Connection Phase**: `HANDSHAKE_START`, `HANDSHAKE_COMPLETE`,
   `CONNECTION_STATE_CHANGED` (connecting to connected), `CONNECTED`
2. **Communication Phase**: `MESSAGE_SENT`, `MESSAGE_RECEIVED`, `RESPONSE_SENT`,
   `RESPONSE_RECEIVED`
3. **Monitoring Phase**: `HEARTBEAT_MISSED`, `CONNECTION_STATE_CHANGED`
4. **Error Phase**: `ERROR`, `TIMEOUT`, `HANDSHAKE_FAILED`
5. **Disconnection Phase**: `CONNECTION_LOST` (ungraceful loss only),
   `CONNECTION_STATE_CHANGED`, `DISCONNECTED`

Understanding this lifecycle helps you implement robust monitoring and error
handling.

---

## Connection Events

Events related to establishing and terminating connections.

### CONNECTED

Emitted when a target successfully establishes a connection.

**Event Name**: `system:connected`

**When Fired**: After successful handshake completes

**Event Data**:

```typescript
interface ConnectedEventData {
    targetId: string; // Target identifier
    targetType: 'iframe' | 'window'; // Target type
    origin: string; // Target origin
    timestamp: number; // Connection timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log(`Connected to ${event.targetId} at ${event.origin}`);
    analytics.track('connection_established', {
        targetId: event.targetId,
        targetType: event.targetType,
    });
});
```

**Use Cases**:

- Track active connections
- Initialize module-specific logic after connection
- Update UI to show connection status

---

### DISCONNECTED

Emitted whenever a target is disconnected, for any reason (graceful or not).

**Event Name**: `system:disconnected`

**When Fired**: After local cleanup of a target: when either side calls
`disconnect()`, after `system:connection_lost`, and for every target when
`destroy()` is called

**Event Data**:

```typescript
interface DisconnectedEventData {
    targetId: string; // Target identifier
    reason: DisconnectReason; // Disconnection reason
    timestamp: number; // Disconnection timestamp
}

type DisconnectReason =
    | 'manual_disconnect' // disconnect() was called on this side or by the peer
    | 'connection_lost' // Target window was closed (detected by polling)
    | 'heartbeat_timeout' // maxMissed consecutive heartbeats missed
    | 'max_failures_reached' // maxFailures consecutive targeted requests timed out
    | 'cleanup' // Target found dead by periodic cleanup
    | 'destroyed'; // destroy() was called on this instance
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log(`${event.targetId} disconnected: ${event.reason}`);

    if (event.reason === 'connection_lost') {
        // Remove UI elements for closed target
        removeTargetUI(event.targetId);
    }
});
```

**Use Cases**:

- Clean up resources when connections close
- Update connection status indicators
- Handle graceful shutdowns

---

### CONNECTION_LOST

Emitted when a connection is lost ungracefully.

**Event Name**: `system:connection_lost`

**When Fired**: When `heartbeat.maxMissed` consecutive heartbeats are missed,
when `heartbeat.maxFailures` consecutive targeted requests time out, when a
connected window is detected as closed (polled about once per second), or when
periodic cleanup finds a dead target. Always followed by `system:disconnected`
with the same reason.

**Event Data**:

```typescript
interface ConnectionLostEventData {
    targetId: string; // Target identifier
    reason:
        | 'heartbeat_timeout'
        | 'max_failures_reached'
        | 'connection_lost'
        | 'cleanup';
    timestamp: number; // When connection was determined lost
}
```

There is no automatic reconnection. To reconnect, call `connect()` again from
your own code (both sides must call it again).

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.error(`Lost connection to ${event.targetId}: ${event.reason}`);

    // Show reconnection UI
    showReconnectPrompt(event.targetId);

    // Your own reconnection logic (not part of Parley), e.g. calling
    // parley.connect(iframe, event.targetId) again
    attemptReconnect(event.targetId);
});
```

**Use Cases**:

- Detect unresponsive or closed targets
- Trigger your own reconnection logic
- Show offline indicators

---

### CONNECTION_STATE_CHANGED

Emitted when connection state transitions.

**Event Name**: `system:connection_state_changed`

**When Fired**: When a handshake completes (`connecting` to `connected`, reason
`'handshake_complete'`), when `disconnect()` starts (to `disconnecting`, reason
`'manual_disconnect'`), and when a target is disconnected (to `disconnected`,
reason is the `DisconnectReason`)

**Event Data**:

```typescript
interface ConnectionStateChangedEventData {
    targetId: string; // Target identifier
    previousState: ConnectionState; // Previous state
    currentState: ConnectionState; // Current state
    reason?: string; // Reason for change
    timestamp: number; // Change timestamp
}

enum ConnectionState {
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTING = 'disconnecting',
    DISCONNECTED = 'disconnected',
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, (event) => {
    console.log(
        `${event.targetId}: ${event.previousState} -> ${event.currentState}`
    );

    updateConnectionIndicator(event.targetId, event.currentState);
});
```

**Use Cases**:

- Track detailed connection lifecycle
- Update UI based on connection state
- Debug connection issues

---

## Message Events

Events tracking message flow between windows.

### MESSAGE_SENT

Emitted when a message is sent with `send()`.

**Event Name**: `system:message_sent`

**When Fired**: Once per `send()` call, just before the message is posted.
`broadcast()` does not emit this event. Listeners are not awaited, so they never
delay delivery.

**Event Data**:

```typescript
interface MessageSentEventData {
    messageId: string; // Unique message ID
    messageType: string; // Message type name
    targetId?: string; // Target ID (undefined when sent to all targets)
    expectsResponse: boolean; // Whether response expected
    timestamp: number; // Send timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.log(`Sent ${event.messageType} to ${event.targetId}`);

    analytics.track('message_sent', {
        type: event.messageType,
        target: event.targetId,
    });
});
```

**Use Cases**:

- Track outgoing message volume
- Measure message frequency
- Debug message flow

---

### MESSAGE_RECEIVED

Emitted when a message is received from a target.

**Event Name**: `system:message_received`

**When Fired**: After the message passes the security checks, before handlers
are called. Not emitted for internal (heartbeat, disconnect) messages. Listeners
are not awaited, so they never delay the handlers.

**Event Data**:

```typescript
interface MessageReceivedEventData {
    messageId: string; // Unique message ID
    messageType: string; // Message type name
    origin: string; // Browser-verified sender origin (event.origin)
    timestamp: number; // Receive timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log(`Received ${event.messageType} from ${event.origin}`);

    analytics.track('message_received', {
        type: event.messageType,
        origin: event.origin,
    });
});
```

**Use Cases**:

- Track incoming message volume
- Monitor message types received
- Audit message sources

---

### RESPONSE_SENT

Emitted when a response is sent to a request.

**Event Name**: `system:response_sent`

**When Fired**: When a response is posted: a handler called `respond()`
(`success: true`), or Parley sent an error response (`success: false`, for
example `ERR_HANDLER_ERROR`, `ERR_NO_HANDLER` or a schema failure). Also fires
for internal heartbeat and disconnect responses.

**Event Data**:

```typescript
interface ResponseSentEventData {
    responseId: string; // Response message ID
    requestId: string; // Original request message ID
    success: boolean; // Whether response indicates success
    timestamp: number; // Response send timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.RESPONSE_SENT, (event) => {
    console.log(`Sent response to ${event.requestId}: ${event.success}`);
});
```

**Use Cases**:

- Track response rates
- Monitor handler success/failure ratios
- Debug response issues

---

### RESPONSE_RECEIVED

Emitted when a response is received for a request.

**Event Name**: `system:response_received`

**When Fired**: When a response arrives for a pending request (success or
error). Also fires for internal heartbeat and disconnect responses.

**Event Data**:

```typescript
interface ResponseReceivedEventData {
    responseId: string; // Response message ID
    requestId: string; // Original request message ID
    success: boolean; // Whether response indicates success
    duration: number; // Round-trip time in milliseconds
    timestamp: number; // Response receive timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.RESPONSE_RECEIVED, (event) => {
    console.log(`Response received in ${event.duration}ms`);

    if (event.duration > 1000) {
        console.warn(`Slow response for ${event.requestId}`);
    }

    analytics.track('request_duration', {
        requestId: event.requestId,
        duration: event.duration,
    });
});
```

**Use Cases**:

- Measure request-response latency
- Track slow requests
- Monitor communication performance

---

## Error Events

Events related to errors and failures.

### ERROR

Emitted for errors that happen while processing inbound messages. Errors of your
own calls (`send()`, `connect()`, ...) are reported by rejecting those calls,
not through this event.

**Event Name**: `system:error`

**When Fired**:

- A local message handler throws or rejects: code `ERR_HANDLER_ERROR`, with the
  full error message, plus `targetId` and `messageId`
- An inbound message is rejected by the security checks (no `messageId`):
    - `ERR_SECURITY_ORIGIN_MISMATCH` - a custom `SecurityLayer.validateOrigin()`
      rejected it (messages from origins outside `allowedOrigins` are dropped
      silently by the channel before this point)
    - `ERR_VALIDATION_INVALID_PROTOCOL` - malformed message, or
      `SecurityLayer.validateMessage()` rejected it
    - `ERR_SECURITY_VERSION_MISMATCH` - incompatible protocol major version

Timeouts are reported by `system:timeout`, not `system:error`. An inbound
payload that fails schema validation does not emit `system:error`; it calls the
type's `onError` option and returns an error response to the sender.

**Event Data**:

```typescript
interface ErrorEventData {
    code: string; // Error code
    message: string; // Error message
    targetId?: string; // Associated target (if applicable)
    messageId?: string; // Associated message (if applicable)
    details?: unknown; // Additional error details
    timestamp: number; // Error timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error(`Error [${event.code}]: ${event.message}`);

    if (event.targetId) {
        console.error(`  Target: ${event.targetId}`);
    }

    // Send to error monitoring service
    errorMonitoring.captureError({
        code: event.code,
        message: event.message,
        metadata: {
            targetId: event.targetId,
            messageId: event.messageId,
            details: event.details,
        },
    });
});
```

**Use Cases**:

- Centralized error logging
- Error monitoring and alerting
- Debug production issues

---

### TIMEOUT

Emitted when a request times out without receiving a response.

**Event Name**: `system:timeout`

**When Fired**: When a `send()` request finally times out, after all retries
(the `send()` promise rejects with `TimeoutError` at the same time). Internal
requests time out through the same path, so an unanswered heartbeat ping also
emits `system:timeout` (with `messageType: '__parley_heartbeat_ping'`), as does
an unacknowledged disconnect notification.

**Event Data**:

```typescript
interface TimeoutEventData {
    messageId: string; // Message ID that timed out
    messageType: string; // Message type
    targetId?: string; // Target ID
    timeoutMs: number; // Timeout duration
    retriesAttempted: number; // Number of retries attempted
    timestamp: number; // Timeout timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.warn(
        `Timeout for ${event.messageType} after ${event.timeoutMs}ms ` +
            `(${event.retriesAttempted} retries)`
    );

    analytics.track('request_timeout', {
        messageType: event.messageType,
        targetId: event.targetId,
        timeoutMs: event.timeoutMs,
    });
});
```

**Use Cases**:

- Monitor timeout frequency
- Identify unreliable targets
- Adjust timeout settings based on actual latency

For timeout error handling patterns, see
[Error Handling Pattern](../patterns/error-handling.md#timeout-errors).

---

## Handshake Events

Events related to the connection handshake. All three share the
`HandshakeEventData` payload and are emitted by `connect()` (since 1.1.0).

### HANDSHAKE_START

Emitted when handshake begins with a target.

**Event Name**: `system:handshake_start`

**When Fired**: When `connect()` starts the handshake

**Event Data**:

```typescript
interface HandshakeEventData {
    targetId: string; // Target identifier
    targetType: 'iframe' | 'window'; // Target type
    timestamp: number; // Handshake start timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_START, (event) => {
    console.log(`Starting handshake with ${event.targetId}`);
    showConnectingIndicator(event.targetId);
});
```

---

### HANDSHAKE_COMPLETE

Emitted when handshake completes successfully.

**Event Name**: `system:handshake_complete`

**When Fired**: After a successful handshake exchange, before `system:connected`

**Event Data**:

```typescript
interface HandshakeEventData {
    targetId: string; // Target identifier
    targetType: 'iframe' | 'window'; // Target type
    timestamp: number; // Handshake completion timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_COMPLETE, (event) => {
    console.log(`Handshake complete with ${event.targetId}`);
    hideConnectingIndicator(event.targetId);
});
```

---

### HANDSHAKE_FAILED

Emitted when handshake fails.

**Event Name**: `system:handshake_failed`

**When Fired**: When the handshake times out (`error.code` is
`ERR_CONNECTION_HANDSHAKE_FAILED`) or fails for another reason (for example
`ERR_CONNECTION_FAILED` for an invalid target). `connect()` rejects with the
same error.

**Event Data**:

```typescript
interface HandshakeEventData {
    targetId: string; // Target identifier
    targetType: 'iframe' | 'window'; // Target type
    timestamp: number; // Failure timestamp
    error?: {
        code: string;
        message: string;
    };
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.HANDSHAKE_FAILED, (event) => {
    console.error(
        `Handshake failed with ${event.targetId}: ${event.error?.message}`
    );
    showConnectionError(event.targetId);
});
```

---

## Heartbeat Events

Events related to connection health monitoring.

### HEARTBEAT_MISSED

Emitted when a heartbeat is missed.

**Event Name**: `system:heartbeat_missed`

**When Fired**: When a heartbeat ping is not answered within `heartbeat.timeout`
(the pong is the response to the ping). After `heartbeat.maxMissed` consecutive
misses the target is disconnected (`system:connection_lost`, reason
`'heartbeat_timeout'`). Any answered ping resets the count.

**Event Data**:

```typescript
interface HeartbeatMissedEventData {
    targetId: string; // Target identifier
    consecutiveMissed: number; // Number of consecutive missed heartbeats
    timestamp: number; // Missed heartbeat timestamp
}
```

**Example**:

```typescript
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.warn(
        `Missed heartbeat from ${event.targetId} ` +
            `(${event.consecutiveMissed} consecutive)`
    );

    if (event.consecutiveMissed >= 2) {
        // With the default maxMissed of 3, one more miss disconnects
        showConnectionWarning(event.targetId);
    }
});
```

**Use Cases**:

- Detect connection degradation early
- Warn users before the connection is dropped
- Monitor connection health

For heartbeat configuration, see
[Heartbeat Monitoring](../guides/iframe-communication.md#heartbeat-monitoring).

---

## Listening to System Events

Use `parley.onSystem()` to register system event listeners.

### Basic Listener

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connection established:', event.targetId);
});
```

### Typed Listeners

The handler receives `data: unknown`. Cast it to the exported event data type:

```typescript
import { SYSTEM_EVENTS, type ConnectedEventData } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (data) => {
    const event = data as ConnectedEventData;
    const { targetId, origin, targetType } = event;
});
```

Exported event data types: `ConnectedEventData`, `DisconnectedEventData`,
`ConnectionLostEventData`, `ConnectionStateChangedEventData`,
`HeartbeatMissedEventData`, `ErrorEventData`, `TimeoutEventData`,
`MessageSentEventData`, `MessageReceivedEventData`, `ResponseSentEventData`,
`ResponseReceivedEventData` and `HandshakeEventData`. See
[Types](./types.md#system-event-data).

### Multiple Listeners

You can register multiple listeners for the same event:

```typescript
// Logger
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    logger.error(event.message, event.details);
});

// Analytics
parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    analytics.track('error_occurred', {
        code: event.code,
        targetId: event.targetId,
    });
});
```

### Removing Listeners

`onSystem()` returns an unsubscribe function. Call it to remove that listener.
`destroy()` removes all listeners.

```typescript
const unsubscribe = parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error(event);
});

// Later
unsubscribe();
```

---

## Common Patterns

Practical patterns for using system events.

### Connection Status Tracking

```typescript
const connectionStatus = new Map<string, ConnectionState>();

parley.onSystem(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, (event) => {
    connectionStatus.set(event.targetId, event.currentState);
    updateUI(connectionStatus);
});
```

### Performance Monitoring

```typescript
const requestMetrics = new Map<string, number>();

parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    if (event.expectsResponse) {
        requestMetrics.set(event.messageId, event.timestamp);
    }
});

parley.onSystem(SYSTEM_EVENTS.RESPONSE_RECEIVED, (event) => {
    const sentTime = requestMetrics.get(event.requestId);
    if (sentTime) {
        const duration = event.timestamp - sentTime;
        console.log(`Request took ${duration}ms`);
        requestMetrics.delete(event.requestId);
    }
});
```

### Error Rate Monitoring

```typescript
let failedResponses = 0;
let totalResponses = 0;

parley.onSystem(SYSTEM_EVENTS.RESPONSE_RECEIVED, (event) => {
    totalResponses++;
    if (!event.success) {
        failedResponses++;
    }
    const errorRate = (failedResponses / totalResponses) * 100;
    console.log(`Error response rate: ${errorRate.toFixed(2)}%`);
});
```

### Analytics Integration

```typescript
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    analytics.track('message_sent', {
        messageType: event.messageType,
        targetId: event.targetId,
    });
});

parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    analytics.track('request_timeout', {
        messageType: event.messageType,
        timeoutMs: event.timeoutMs,
    });
});
```

---

## Best Practices

Guidelines for effective system event usage.

### Use System Events for Monitoring, Not Business Logic

System events are for observability, not application flow control:

```typescript
// Bad: Business logic in system event
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    loadUserData(event.targetId); // Wrong place
});

// Good: Business logic in message handlers
parley.on('user:load', async (payload, respond) => {
    const userData = await loadUserData();
    respond({ userData });
});
```

### Avoid Heavy Processing in Listeners

Keep system event handlers lightweight. Most system events are emitted
synchronously, so a slow synchronous listener runs inline:

```typescript
// Bad: Heavy processing blocks event loop
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    processLargeDataset(event); // Slow operation
});

// Good: Offload to background
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    queueForProcessing(event);
});
```

### Aggregate Events for Analytics

Batch analytics events instead of sending each individually:

```typescript
const eventQueue: unknown[] = [];

parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    eventQueue.push({ type: 'message_sent', event });
});

// Flush every 10 seconds
setInterval(() => {
    if (eventQueue.length > 0) {
        analytics.sendBatch(eventQueue);
        eventQueue.length = 0;
    }
}, 10000);
```

### Use for Debugging in Development

Enable detailed logging in development:

```typescript
if (process.env.NODE_ENV === 'development') {
    // Log all system events
    Object.values(SYSTEM_EVENTS).forEach((eventName) => {
        parley.onSystem(eventName, (event) => {
            console.log(`[${eventName}]`, event);
        });
    });
}
```

---

## Navigation

### Related API Documentation

- [Methods](./methods.md) - All ParleyJS methods
- [API Reference](./index.md) - Complete API overview
- [Types](./types.md) - Event data types
- [Error Codes](./error-codes.md) - Error code reference
- [Common Errors](../troubleshooting/common-errors.md) - Error solutions

### Related Guides

- [iFrame Communication](../guides/iframe-communication.md) - Heartbeat
  monitoring
- [Multi-Window Communication](../guides/multi-window-communication.md) - System
  events in multi-window scenarios
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling with
  system events

### Related Documentation

- [Analytics Hooks](../FRAMEWORK_REFERENCE.md#analytics-hooks) - Analytics
  integration
- [Troubleshooting](../troubleshooting/index.md) - Debugging with system events

---

**Previous**: [Methods Reference](./methods.md) **Next**:
[API Reference Overview](./index.md) **Back to**: [API Reference](./index.md)
