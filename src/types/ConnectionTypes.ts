/**
 * @file ConnectionTypes.ts
 * @description Connection state and lifecycle types for Parley framework
 * @module parley-js/types
 */

/**
 * Represents the current state of a connection to a target
 */
export enum ConnectionState {
    /**
     * Initial connection handshake in progress
     */
    CONNECTING = 'connecting',

    /**
     * Connection established and healthy
     */
    CONNECTED = 'connected',

    /**
     * Graceful disconnect in progress (handshake initiated)
     */
    DISCONNECTING = 'disconnecting',

    /**
     * Connection closed or lost
     */
    DISCONNECTED = 'disconnected',
}

/**
 * Connection state change event data
 */
export interface ConnectionStateChange {
    /** Target ID whose state changed */
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
 * Reason for disconnection
 */
export type DisconnectReason =
    | 'manual_disconnect'
    | 'connection_lost'
    | 'heartbeat_timeout'
    | 'max_failures_reached'
    | 'timeout'
    | 'error'
    | 'cleanup'
    | 'destroyed';
