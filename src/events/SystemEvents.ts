/**
 * @file SystemEvents.ts
 * @description System event type definitions for Parley framework
 * @module parley-js/events
 *
 * System events use the 'system:' prefix to avoid conflicts with user-defined messages.
 * These events are used for lifecycle management and analytics hooks.
 */

import type { ConnectionState, DisconnectReason } from '../types/ConnectionTypes';

/**
 * System event names
 *
 * These events are emitted by the Parley framework for connection lifecycle
 * and analytics purposes. All system events are prefixed with 'system:'.
 */
export const SYSTEM_EVENTS = {
    /** Emitted when a target establishes a connection */
    CONNECTED: 'system:connected',

    /** Emitted when a target disconnects gracefully */
    DISCONNECTED: 'system:disconnected',

    /** Emitted when a connection is lost (ungraceful disconnect detected) */
    CONNECTION_LOST: 'system:connection_lost',

    /** Emitted when connection state changes */
    CONNECTION_STATE_CHANGED: 'system:connection_state_changed',

    /** Emitted when a heartbeat is missed */
    HEARTBEAT_MISSED: 'system:heartbeat_missed',

    /** Emitted when an error occurs */
    ERROR: 'system:error',

    /** Emitted when a message times out */
    TIMEOUT: 'system:timeout',

    /** Emitted when a message is sent (for analytics) */
    MESSAGE_SENT: 'system:message_sent',

    /** Emitted when a message is received (for analytics) */
    MESSAGE_RECEIVED: 'system:message_received',

    /** Emitted when a response is sent (for analytics) */
    RESPONSE_SENT: 'system:response_sent',

    /** Emitted when a response is received (for analytics) */
    RESPONSE_RECEIVED: 'system:response_received',

    /** Emitted when handshake starts */
    HANDSHAKE_START: 'system:handshake_start',

    /** Emitted when handshake completes successfully */
    HANDSHAKE_COMPLETE: 'system:handshake_complete',

    /** Emitted when handshake fails */
    HANDSHAKE_FAILED: 'system:handshake_failed',
} as const;

/**
 * Union type of all system event names
 */
export type SystemEventName = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS];

/**
 * Data payload for system:connected event
 */
export interface ConnectedEventData {
    /** Target identifier */
    targetId: string;

    /** Target type (iframe or window) */
    targetType: 'iframe' | 'window';

    /** Origin of the connected target */
    origin: string;

    /** Timestamp of the connection */
    timestamp: number;
}

/**
 * Data payload for system:disconnected event
 */
export interface DisconnectedEventData {
    /** Target identifier */
    targetId: string;

    /** Reason for disconnection */
    reason: DisconnectReason;

    /** Timestamp of the disconnection */
    timestamp: number;
}

/**
 * Data payload for system:error event
 */
export interface ErrorEventData {
    /** Error code */
    code: string;

    /** Error message */
    message: string;

    /** Associated target ID (if applicable) */
    targetId?: string;

    /** Associated message ID (if applicable) */
    messageId?: string;

    /** Additional error details */
    details?: unknown;

    /** Timestamp of the error */
    timestamp: number;
}

/**
 * Data payload for system:timeout event
 */
export interface TimeoutEventData {
    /** Message ID that timed out */
    messageId: string;

    /** Message type */
    messageType: string;

    /** Target ID */
    targetId?: string;

    /** Timeout duration in milliseconds */
    timeoutMs: number;

    /** Number of retries attempted */
    retriesAttempted: number;

    /** Timestamp of the timeout */
    timestamp: number;
}

/**
 * Data payload for system:message_sent event
 */
export interface MessageSentEventData {
    /** Message ID */
    messageId: string;

    /** Message type */
    messageType: string;

    /** Target ID */
    targetId?: string;

    /** Whether a response is expected */
    expectsResponse: boolean;

    /** Timestamp when message was sent */
    timestamp: number;
}

/**
 * Data payload for system:message_received event
 */
export interface MessageReceivedEventData {
    /** Message ID */
    messageId: string;

    /** Message type */
    messageType: string;

    /** Origin of the sender */
    origin: string;

    /** Timestamp when message was received */
    timestamp: number;
}

/**
 * Data payload for system:response_sent event
 */
export interface ResponseSentEventData {
    /** Response ID */
    responseId: string;

    /** Original request message ID */
    requestId: string;

    /** Whether the response indicates success */
    success: boolean;

    /** Timestamp when response was sent */
    timestamp: number;
}

/**
 * Data payload for system:response_received event
 */
export interface ResponseReceivedEventData {
    /** Response ID */
    responseId: string;

    /** Original request message ID */
    requestId: string;

    /** Whether the response indicates success */
    success: boolean;

    /** Round-trip duration in milliseconds */
    duration: number;

    /** Timestamp when response was received */
    timestamp: number;
}

/**
 * Data payload for handshake events
 */
export interface HandshakeEventData {
    /** Target identifier */
    targetId: string;

    /** Target type */
    targetType: 'iframe' | 'window';

    /** Timestamp */
    timestamp: number;

    /** Error details (for failed handshake) */
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Data payload for system:connection_lost event
 */
export interface ConnectionLostEventData {
    /** Target identifier */
    targetId: string;

    /** Reason for connection loss */
    reason: 'heartbeat_timeout' | 'max_failures_reached';

    /** Timestamp when connection was determined lost */
    timestamp: number;
}

/**
 * Data payload for system:connection_state_changed event
 */
export interface ConnectionStateChangedEventData {
    /** Target identifier */
    targetId: string;

    /** Previous connection state */
    previousState: ConnectionState;

    /** Current connection state */
    currentState: ConnectionState;

    /** Reason for the state change */
    reason?: string;

    /** Timestamp of the state change */
    timestamp: number;
}

/**
 * Data payload for system:heartbeat_missed event
 */
export interface HeartbeatMissedEventData {
    /** Target identifier */
    targetId: string;

    /** Number of consecutive missed heartbeats */
    consecutiveMissed: number;

    /** Timestamp when heartbeat was missed */
    timestamp: number;
}

/**
 * Union type of all system event data payloads
 */
export type SystemEventData =
    | ConnectedEventData
    | DisconnectedEventData
    | ConnectionLostEventData
    | ConnectionStateChangedEventData
    | HeartbeatMissedEventData
    | ErrorEventData
    | TimeoutEventData
    | MessageSentEventData
    | MessageReceivedEventData
    | ResponseSentEventData
    | ResponseReceivedEventData
    | HandshakeEventData;

/**
 * System event handler function type
 */
export type SystemEventHandler<T extends SystemEventData = SystemEventData> = (
    data: T
) => void | Promise<void>;
