/**
 * @file MessageTypes.ts
 * @description Message-related type definitions for Parley framework
 * @module parley-js/types
 */

import type { ParleyError } from '../errors/ErrorTypes';
import type { DisconnectReason } from './ConnectionTypes';

/**
 * System message types for internal communication
 */
export const SYSTEM_MESSAGE_TYPES = {
    /** Initial handshake message */
    HANDSHAKE_INIT: '__parley_handshake_init',
    /** Handshake acknowledgment */
    HANDSHAKE_ACK: '__parley_handshake_ack',
    /** Disconnect notification */
    DISCONNECT: '__parley_disconnect',
    /** Heartbeat ping */
    HEARTBEAT_PING: '__parley_heartbeat_ping',
    /** Heartbeat pong (response) */
    HEARTBEAT_PONG: '__parley_heartbeat_pong',
} as const;

/**
 * Payload for disconnect notification
 */
export interface DisconnectPayload {
    /** ID of the sender initiating disconnect */
    senderId: string;
    /** Reason for disconnection */
    reason: DisconnectReason;
    /** Timestamp of disconnect initiation */
    timestamp: number;
}

/**
 * Payload for heartbeat ping messages
 */
export interface HeartbeatPingPayload {
    /** ID of the sender */
    senderId: string;
    /** Timestamp when ping was sent */
    timestamp: number;
}

/**
 * Payload for heartbeat pong (response) messages
 */
export interface HeartbeatPongPayload {
    /** ID of the sender */
    senderId: string;
    /** Timestamp when pong was sent */
    timestamp: number;
    /** Timestamp from the original ping */
    receivedPingAt: number;
}

/**
 * Metadata about an incoming message
 *
 * Provided to message handlers along with the payload.
 */
export interface MessageMetadata {
    /** Unique message ID */
    messageId: string;

    /** ID of the sender (target ID) */
    senderId: string;

    /** Origin of the sender */
    origin: string;

    /** Timestamp when message was sent */
    timestamp: number;

    /** Whether a response is expected */
    expectsResponse: boolean;
}

/**
 * Message handler function type
 *
 * Called when a registered message type is received.
 *
 * @typeParam T - Type of the payload
 */
export type MessageHandler<T = unknown> = (
    payload: T,
    respond: ResponseFunction,
    metadata: MessageMetadata
) => void | Promise<void>;

/**
 * Function to send a response to a message
 *
 * @typeParam R - Type of the response payload
 */
export type ResponseFunction<R = unknown> = (response: R) => void;

/**
 * Options for registering a message type
 */
export interface MessageRegistrationOptions {
    /**
     * JSON Schema for payload validation
     * If provided, incoming messages will be validated against this schema
     */
    schema?: JsonSchema;

    /**
     * Override default timeout for this message type
     * In milliseconds
     */
    timeout?: number;

    /**
     * Override default retry count for this message type
     */
    retries?: number;

    /**
     * Error handler for this message type
     * Called when an error occurs during message handling
     */
    onError?: (error: ParleyError, metadata: MessageMetadata) => void;
}

/**
 * Internal registered message type info
 */
export interface RegisteredMessageType<T = unknown> {
    /** Message type name */
    type: string;

    /** Registration options */
    options: MessageRegistrationOptions;

    /** Handlers for this message type */
    handlers: Set<MessageHandler<T>>;
}

/**
 * Options for sending a message
 */
export interface SendOptions {
    /**
     * Target ID to send to
     * If not specified, sends to all connected targets
     */
    targetId?: string;

    /**
     * Override default timeout for this message
     * In milliseconds
     */
    timeout?: number;

    /**
     * Override default retry count for this message
     */
    retries?: number;

    /**
     * Whether a response is expected
     * Default: true
     */
    expectsResponse?: boolean;
}

/**
 * Pending request tracker
 *
 * Used to correlate responses with their original requests.
 */
export interface PendingRequest<T = unknown> {
    /** Promise resolve function */
    resolve: (value: T) => void;

    /** Promise reject function */
    reject: (error: Error) => void;

    /** Timeout handle */
    timeoutHandle: ReturnType<typeof setTimeout>;

    /** Timeout duration */
    timeout: number;

    /** Number of retries remaining */
    retriesRemaining: number;

    /** Original message type */
    messageType: string;

    /** Target ID if specified */
    targetId?: string;

    /** Timestamp when request was sent */
    sentAt: number;
}

/**
 * JSON Schema type definition
 *
 * A simplified JSON Schema for payload validation.
 * Supports basic type checking, required fields, and nested objects.
 */
export interface JsonSchema {
    /** Data type */
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

    /** Required properties (for object types) */
    required?: string[];

    /** Property definitions (for object types) */
    properties?: Record<string, JsonSchema>;

    /** Array item schema (for array types) */
    items?: JsonSchema;

    /** Minimum value (for numbers) */
    minimum?: number;

    /** Maximum value (for numbers) */
    maximum?: number;

    /** Minimum length (for strings/arrays) */
    minLength?: number;

    /** Maximum length (for strings/arrays) */
    maxLength?: number;

    /** Pattern to match (for strings) */
    pattern?: string;

    /** Enum of allowed values */
    enum?: unknown[];

    /** Description (documentation only) */
    description?: string;

    /** Default value */
    default?: unknown;

    /** Allow additional properties (for objects) */
    additionalProperties?: boolean | JsonSchema;
}
