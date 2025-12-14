[Home](../../README.md) > [API Reference](./README.md) > System Events

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

System events provide visibility into ParleyJS internal operations. They are emitted for connection lifecycle, message flow, errors, and heartbeat monitoring.

All system events use the `system:` prefix to avoid conflicts with user-defined message types. You listen to system events using `parley.onSystem()`.

```typescript
import { SYSTEM_EVENTS } from 'parley-js';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to:', event.targetId);
});
```

System events are useful for logging, analytics, debugging, and monitoring application health.

---

## Event Lifecycle

System events are emitted at key points in the communication lifecycle:

1. **Connection Phase**: `HANDSHAKE_START`, `HANDSHAKE_COMPLETE`, `CONNECTED`
2. **Communication Phase**: `MESSAGE_SENT`, `MESSAGE_RECEIVED`, `RESPONSE_SENT`, `RESPONSE_RECEIVED`
3. **Monitoring Phase**: `HEARTBEAT_MISSED`, `CONNECTION_STATE_CHANGED`
4. **Error Phase**: `ERROR`, `TIMEOUT`, `HANDSHAKE_FAILED`
5. **Disconnection Phase**: `CONNECTION_LOST`, `DISCONNECTED`

Understanding this lifecycle helps you implement robust monitoring and error handling.

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
    targetId: string;        // Target identifier
    targetType: 'iframe' | 'window';  // Target type
    origin: string;          // Target origin
    timestamp: number;       // Connection timestamp
}
```

**Example**:
```typescript
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log(`Connected to ${event.targetId} at ${event.origin}`);
    analytics.track('connection_established', {
        targetId: event.targetId,
        targetType: event.targetType
    });
});
```

**Use Cases**:
- Track active connections
- Initialize module-specific logic after connection
- Update UI to show connection status

---

### DISCONNECTED

Emitted when a target disconnects gracefully.

**Event Name**: `system:disconnected`

**When Fired**: When `disconnect()` is called or target explicitly closes

**Event Data**:
```typescript
interface DisconnectedEventData {
    targetId: string;        // Target identifier
    reason: DisconnectReason;  // Disconnection reason
    timestamp: number;       // Disconnection timestamp
}

type DisconnectReason =
    | 'manual'              // disconnect() was called
    | 'target_closed'       // Target window closed
    | 'cleanup';            // Cleanup during shutdown
```

**Example**:
```typescript
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log(`${event.targetId} disconnected: ${event.reason}`);

    if (event.reason === 'target_closed') {
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

**When Fired**: After heartbeat timeout or max failures reached

**Event Data**:
```typescript
interface ConnectionLostEventData {
    targetId: string;        // Target identifier
    reason: 'heartbeat_timeout' | 'max_failures_reached';
    timestamp: number;       // When connection was determined lost
}
```

**Example**:
```typescript
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.error(`Lost connection to ${event.targetId}: ${event.reason}`);

    // Show reconnection UI
    showReconnectPrompt(event.targetId);

    // Attempt to reconnect
    attemptReconnect(event.targetId);
});
```

**Use Cases**:
- Detect network failures
- Trigger reconnection logic
- Show offline indicators

---

### CONNECTION_STATE_CHANGED

Emitted when connection state transitions.

**Event Name**: `system:connection_state_changed`

**When Fired**: On any state transition (connecting, connected, disconnected, etc.)

**Event Data**:
```typescript
interface ConnectionStateChangedEventData {
    targetId: string;           // Target identifier
    previousState: ConnectionState;  // Previous state
    currentState: ConnectionState;   // Current state
    reason?: string;            // Reason for change
    timestamp: number;          // Change timestamp
}

enum ConnectionState {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting'
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

Emitted when a message is sent to a target.

**Event Name**: `system:message_sent`

**When Fired**: Immediately after `send()` or `broadcast()` dispatches message

**Event Data**:
```typescript
interface MessageSentEventData {
    messageId: string;       // Unique message ID
    messageType: string;     // Message type name
    targetId?: string;       // Target ID (undefined for broadcast)
    expectsResponse: boolean;  // Whether response expected
    timestamp: number;       // Send timestamp
}
```

**Example**:
```typescript
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.log(`Sent ${event.messageType} to ${event.targetId}`);

    analytics.track('message_sent', {
        type: event.messageType,
        target: event.targetId
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

**When Fired**: After message passes origin validation, before handler called

**Event Data**:
```typescript
interface MessageReceivedEventData {
    messageId: string;       // Unique message ID
    messageType: string;     // Message type name
    origin: string;          // Sender origin
    timestamp: number;       // Receive timestamp
}
```

**Example**:
```typescript
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log(`Received ${event.messageType} from ${event.origin}`);

    analytics.track('message_received', {
        type: event.messageType,
        origin: event.origin
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

**When Fired**: When handler calls `respond()` function

**Event Data**:
```typescript
interface ResponseSentEventData {
    responseId: string;      // Response message ID
    requestId: string;       // Original request message ID
    success: boolean;        // Whether response indicates success
    timestamp: number;       // Response send timestamp
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

**When Fired**: When response arrives for a pending request

**Event Data**:
```typescript
interface ResponseReceivedEventData {
    responseId: string;      // Response message ID
    requestId: string;       // Original request message ID
    success: boolean;        // Whether response indicates success
    duration: number;        // Round-trip time in milliseconds
    timestamp: number;       // Response receive timestamp
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
        duration: event.duration
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

Emitted when any error occurs in ParleyJS operations.

**Event Name**: `system:error`

**When Fired**: On validation errors, security errors, serialization errors, etc.

**Event Data**:
```typescript
interface ErrorEventData {
    code: string;            // Error code
    message: string;         // Error message
    targetId?: string;       // Associated target (if applicable)
    messageId?: string;      // Associated message (if applicable)
    details?: unknown;       // Additional error details
    timestamp: number;       // Error timestamp
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
            details: event.details
        }
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

**When Fired**: After timeout duration expires without response

**Event Data**:
```typescript
interface TimeoutEventData {
    messageId: string;       // Message ID that timed out
    messageType: string;     // Message type
    targetId?: string;       // Target ID
    timeoutMs: number;       // Timeout duration
    retriesAttempted: number;  // Number of retries attempted
    timestamp: number;       // Timeout timestamp
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
        timeoutMs: event.timeoutMs
    });
});
```

**Use Cases**:
- Monitor timeout frequency
- Identify unreliable targets
- Adjust timeout settings based on actual latency

For timeout error handling patterns, see [Error Handling Pattern](../patterns/error-handling.md#timeout-errors).

---

## Handshake Events

Events related to connection handshake process.

### HANDSHAKE_START

Emitted when handshake begins with a target.

**Event Name**: `system:handshake_start`

**When Fired**: When `connect()` initiates handshake

**Event Data**:
```typescript
interface HandshakeEventData {
    targetId: string;        // Target identifier
    targetType: 'iframe' | 'window';  // Target type
    timestamp: number;       // Handshake start timestamp
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

**When Fired**: After successful handshake exchange

**Event Data**:
```typescript
interface HandshakeEventData {
    targetId: string;        // Target identifier
    targetType: 'iframe' | 'window';  // Target type
    timestamp: number;       // Handshake completion timestamp
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

**When Fired**: When handshake times out or encounters error

**Event Data**:
```typescript
interface HandshakeEventData {
    targetId: string;        // Target identifier
    targetType: 'iframe' | 'window';  // Target type
    timestamp: number;       // Failure timestamp
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

**When Fired**: When heartbeat response not received within interval

**Event Data**:
```typescript
interface HeartbeatMissedEventData {
    targetId: string;        // Target identifier
    consecutiveMissed: number;  // Number of consecutive missed heartbeats
    timestamp: number;       // Missed heartbeat timestamp
}
```

**Example**:
```typescript
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.warn(
        `Missed heartbeat from ${event.targetId} ` +
        `(${event.consecutiveMissed} consecutive)`
    );

    if (event.consecutiveMissed >= 3) {
        // Connection likely lost
        showConnectionWarning(event.targetId);
    }
});
```

**Use Cases**:
- Detect connection degradation early
- Trigger proactive reconnection
- Monitor connection health

For heartbeat configuration, see [Heartbeat Monitoring](../guides/iframe-communication.md#heartbeat-monitoring).

---

## Listening to System Events

Use `parley.onSystem()` to register system event listeners.

### Basic Listener

```typescript
import { SYSTEM_EVENTS } from 'parley-js';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connection established:', event.targetId);
});
```

### Typed Listeners

TypeScript provides type-safe event data:

```typescript
import type { ConnectedEventData } from 'parley-js';

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event: ConnectedEventData) => {
    // event is typed as ConnectedEventData
    const { targetId, origin, targetType } = event;
});
```

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
        targetId: event.targetId
    });
});
```

### Removing Listeners

System event listeners cannot currently be removed individually. To stop listening, create a new Parley instance or disconnect targets.

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
let errorCount = 0;
let totalRequests = 0;

parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, () => {
    totalRequests++;
});

parley.onSystem(SYSTEM_EVENTS.ERROR, () => {
    errorCount++;
    const errorRate = (errorCount / totalRequests) * 100;
    console.log(`Error rate: ${errorRate.toFixed(2)}%`);
});
```

### Analytics Integration

```typescript
parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    analytics.track('message_sent', {
        messageType: event.messageType,
        targetId: event.targetId
    });
});

parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    analytics.track('request_timeout', {
        messageType: event.messageType,
        timeoutMs: event.timeoutMs
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
    loadUserData(event.targetId);  // Wrong place
});

// Good: Business logic in message handlers
parley.on('ready', async (payload, respond) => {
    const userData = await loadUserData();
    respond({ userData });
});
```

### Avoid Heavy Processing in Listeners

Keep system event handlers lightweight:

```typescript
// Bad: Heavy processing blocks event loop
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    processLargeDataset(event);  // Slow operation
});

// Good: Offload to background
parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    queueForProcessing(event);
});
```

### Aggregate Events for Analytics

Batch analytics events instead of sending each individually:

```typescript
const eventQueue: AnalyticsEvent[] = [];

parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    eventQueue.push({ type: 'message_sent', data: event });
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
    Object.values(SYSTEM_EVENTS).forEach(eventName => {
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
- [API Reference](./README.md) - Complete API overview
- [Error Codes](../troubleshooting/common-errors.md) - Error code reference

### Related Guides

- [iFrame Communication](../guides/iframe-communication.md) - Heartbeat monitoring
- [Multi-Window Communication](../guides/multi-window-communication.md) - System events in multi-window scenarios
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling with system events

### Related Documentation

- [Analytics Hooks](../FRAMEWORK_REFERENCE.md#analytics-hooks) - Analytics integration
- [Troubleshooting](../troubleshooting/README.md) - Debugging with system events

---

**Previous**: [Methods Reference](./methods.md)
**Next**: [API Reference Overview](./README.md)
**Back to**: [API Reference](./README.md)
