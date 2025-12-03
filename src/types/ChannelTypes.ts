/**
 * @file ChannelTypes.ts
 * @description Channel-related type definitions for Parley framework
 * @module parley-js/types
 */

import { ConnectionState } from './ConnectionTypes';

/**
 * Target type for communication
 */
export type ChannelTargetType = 'iframe' | 'window';

/**
 * Target information stored in TargetManager
 */
export interface TargetInfo {
    /** Unique identifier for the target */
    id: string;

    /** The target element or window reference */
    target: HTMLIFrameElement | Window;

    /** Type of target */
    type: ChannelTargetType;

    /** Origin of the target */
    origin: string;

    /** Whether the target is connected (handshake complete) */
    connected: boolean;

    /** Current connection state */
    state: ConnectionState;

    /** Timestamp of last activity */
    lastActivity: number;

    /** Timestamp when connection was established */
    connectedAt?: number;

    /** Timestamp of last successful heartbeat */
    lastHeartbeat?: number;

    /** Number of consecutive missed heartbeats */
    missedHeartbeats: number;

    /** Number of consecutive send failures */
    consecutiveFailures: number;
}

/**
 * Options for registering a target
 */
export interface RegisterTargetOptions {
    /** Custom ID for the target (auto-generated if not provided) */
    id?: string;

    /** Origin of the target (required for security) */
    origin?: string;
}

/**
 * State of a communication channel
 */
export type ChannelState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Options for channel configuration
 */
export interface ChannelOptions {
    /** Allowed origins for message validation */
    allowedOrigins: string[];

    /** Timeout for handshake in milliseconds */
    handshakeTimeout: number;

    /** Whether to auto-reconnect on disconnect */
    autoReconnect: boolean;

    /** Delay between reconnect attempts in milliseconds */
    reconnectDelay: number;

    /** Maximum reconnect attempts (0 = unlimited) */
    maxReconnectAttempts: number;
}

/**
 * Default channel options
 */
export const DEFAULT_CHANNEL_OPTIONS: ChannelOptions = {
    allowedOrigins: [],
    handshakeTimeout: 5000,
    autoReconnect: false,
    reconnectDelay: 1000,
    maxReconnectAttempts: 3,
};

/**
 * Window reference type that accounts for cross-origin limitations
 */
export type WindowReference = Window | null;

/**
 * Iframe content window reference
 */
export type IframeContentWindow = Window | null;
