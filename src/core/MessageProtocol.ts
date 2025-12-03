/**
 * @file MessageProtocol.ts
 * @description Message protocol definitions and utilities for Parley framework
 * @module parley-js/core
 *
 * Defines the wire protocol for all messages exchanged between windows/iframes.
 * All messages must conform to the MessageProtocol interface.
 */

import { generateUUID, getTimestamp, getCurrentOrigin, deepClone } from '../utils/Helpers';
import { ValidationError } from '../errors/ErrorTypes';
import { VALIDATION_ERRORS } from '../errors/ErrorCodes';

/**
 * Current protocol version
 *
 * This version is checked during message validation to ensure compatibility.
 * Major version changes indicate breaking protocol changes.
 */
export const PROTOCOL_VERSION = '1.0.0';

/**
 * Magic string to identify Parley messages
 *
 * Used to quickly filter out non-Parley messages from the message event stream.
 */
export const PARLEY_MESSAGE_IDENTIFIER = '__parley__';

/**
 * Internal message types used by the protocol
 */
export const INTERNAL_MESSAGE_TYPES = {
    /** Handshake initiation */
    HANDSHAKE_INIT: '__parley_handshake_init__',
    /** Handshake acknowledgment */
    HANDSHAKE_ACK: '__parley_handshake_ack__',
    /** Ping for connection keep-alive */
    PING: '__parley_ping__',
    /** Pong response to ping */
    PONG: '__parley_pong__',
} as const;

/**
 * Message protocol interface
 *
 * All messages sent through Parley must conform to this structure.
 * The protocol includes metadata for routing, validation, and tracking.
 *
 * @typeParam T - Type of the message payload
 */
export interface MessageProtocol<T = unknown> {
    /**
     * Parley message identifier
     * Used to filter Parley messages from other postMessage traffic
     */
    _parley: typeof PARLEY_MESSAGE_IDENTIFIER;

    /**
     * Protocol version string (semver format)
     * Used for compatibility checking
     */
    _v: string;

    /**
     * Unique message ID (UUID v4)
     * Used for request-response correlation and deduplication
     */
    _id: string;

    /**
     * Registered message type
     * Determines how the message should be handled
     */
    _type: string;

    /**
     * Unix timestamp in milliseconds
     * When the message was created
     */
    _timestamp: number;

    /**
     * Sender origin
     * Used for security validation
     */
    _origin: string;

    /**
     * Optional target identifier
     * Used when sending to a specific iframe/window
     */
    _target?: string;

    /**
     * Whether sender expects a response
     * If true, a response message should be sent back
     */
    _expectsResponse: boolean;

    /**
     * Actual message payload
     * The data being transmitted
     */
    payload: T;
}

/**
 * Response protocol interface
 *
 * All responses to messages must conform to this structure.
 *
 * @typeParam T - Type of the response payload
 */
export interface ResponseProtocol<T = unknown> {
    /**
     * Parley message identifier
     */
    _parley: typeof PARLEY_MESSAGE_IDENTIFIER;

    /**
     * Protocol version string
     */
    _v: string;

    /**
     * Response ID (new UUID)
     */
    _id: string;

    /**
     * Original message ID being responded to
     */
    _requestId: string;

    /**
     * Unix timestamp in milliseconds
     */
    _timestamp: number;

    /**
     * Responder origin
     */
    _origin: string;

    /**
     * Whether the operation was successful
     */
    success: boolean;

    /**
     * Response payload (if success is true)
     */
    payload?: T;

    /**
     * Error details (if success is false)
     */
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * Options for creating a new message
 */
export interface CreateMessageOptions<T> {
    /** Message type */
    type: string;

    /** Message payload */
    payload: T;

    /** Whether a response is expected */
    expectsResponse?: boolean;

    /** Target identifier */
    target?: string;
}

/**
 * Options for creating a response
 */
export interface CreateResponseOptions<T> {
    /** Original request message ID */
    requestId: string;

    /** Whether the operation was successful */
    success: boolean;

    /** Response payload (for success responses) */
    payload?: T;

    /** Error details (for error responses) */
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * Create a new message following the Parley protocol
 *
 * @param options - Message creation options
 * @returns A complete MessageProtocol object
 *
 * @example
 * ```typescript
 * const message = createMessage({
 *     type: 'user:update',
 *     payload: { userId: 123, name: 'John' },
 *     expectsResponse: true
 * });
 * ```
 */
export function createMessage<T>(options: CreateMessageOptions<T>): MessageProtocol<T> {
    const { type, payload, expectsResponse = true, target } = options;

    return {
        _parley: PARLEY_MESSAGE_IDENTIFIER,
        _v: PROTOCOL_VERSION,
        _id: generateUUID(),
        _type: type,
        _timestamp: getTimestamp(),
        _origin: getCurrentOrigin(),
        _target: target,
        _expectsResponse: expectsResponse,
        payload: deepClone(payload),
    };
}

/**
 * Create a response message following the Parley protocol
 *
 * @param options - Response creation options
 * @returns A complete ResponseProtocol object
 *
 * @example
 * ```typescript
 * // Success response
 * const successResponse = createResponse({
 *     requestId: 'abc-123',
 *     success: true,
 *     payload: { updated: true }
 * });
 *
 * // Error response
 * const errorResponse = createResponse({
 *     requestId: 'abc-123',
 *     success: false,
 *     error: {
 *         code: 'ERR_VALIDATION_SCHEMA_MISMATCH',
 *         message: 'Invalid payload'
 *     }
 * });
 * ```
 */
export function createResponse<T>(options: CreateResponseOptions<T>): ResponseProtocol<T> {
    const { requestId, success, payload, error } = options;

    const response: ResponseProtocol<T> = {
        _parley: PARLEY_MESSAGE_IDENTIFIER,
        _v: PROTOCOL_VERSION,
        _id: generateUUID(),
        _requestId: requestId,
        _timestamp: getTimestamp(),
        _origin: getCurrentOrigin(),
        success,
    };

    if (success && payload !== undefined) {
        response.payload = deepClone(payload);
    }

    if (!success && error) {
        response.error = error;
    }

    return response;
}

/**
 * Check if a message is a Parley message
 *
 * @param data - Data to check
 * @returns True if data is a Parley message
 */
export function isParleyMessage(data: unknown): data is MessageProtocol | ResponseProtocol {
    if (data === null || typeof data !== 'object') {
        return false;
    }

    const obj = data as Record<string, unknown>;
    return obj._parley === PARLEY_MESSAGE_IDENTIFIER;
}

/**
 * Check if a message is a request message (not a response)
 *
 * @param data - Data to check
 * @returns True if data is a request message
 */
export function isRequestMessage(data: unknown): data is MessageProtocol {
    if (!isParleyMessage(data)) {
        return false;
    }

    const obj = data as unknown as Record<string, unknown>;
    return '_type' in obj && !('_requestId' in obj);
}

/**
 * Check if a message is a response message
 *
 * @param data - Data to check
 * @returns True if data is a response message
 */
export function isResponseMessage(data: unknown): data is ResponseProtocol {
    if (!isParleyMessage(data)) {
        return false;
    }

    const obj = data as unknown as Record<string, unknown>;
    return '_requestId' in obj && 'success' in obj;
}

/**
 * Check if a message is an internal protocol message
 *
 * @param message - Message to check
 * @returns True if message is an internal protocol message
 */
export function isInternalMessage(message: MessageProtocol): boolean {
    return Object.values(INTERNAL_MESSAGE_TYPES).includes(
        message._type as (typeof INTERNAL_MESSAGE_TYPES)[keyof typeof INTERNAL_MESSAGE_TYPES]
    );
}

/**
 * Validate a message protocol structure
 *
 * @param message - Message to validate
 * @throws ValidationError if the message structure is invalid
 */
export function validateMessageProtocol(message: unknown): asserts message is MessageProtocol {
    if (!isParleyMessage(message)) {
        throw new ValidationError(
            'Message is not a valid Parley message',
            { received: typeof message },
            VALIDATION_ERRORS.INVALID_PROTOCOL
        );
    }

    const msg = message as unknown as Record<string, unknown>;

    // Check required fields
    const requiredFields = [
        '_v',
        '_id',
        '_type',
        '_timestamp',
        '_origin',
        '_expectsResponse',
        'payload',
    ];
    for (const field of requiredFields) {
        if (!(field in msg)) {
            throw new ValidationError(
                `Missing required field: ${field}`,
                { field },
                VALIDATION_ERRORS.REQUIRED_FIELD_MISSING
            );
        }
    }

    // Validate field types
    if (typeof msg._v !== 'string') {
        throw new ValidationError(
            'Protocol version must be a string',
            { field: '_v', received: typeof msg._v },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }

    if (typeof msg._id !== 'string') {
        throw new ValidationError(
            'Message ID must be a string',
            { field: '_id', received: typeof msg._id },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }

    if (typeof msg._type !== 'string') {
        throw new ValidationError(
            'Message type must be a string',
            { field: '_type', received: typeof msg._type },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }

    if (typeof msg._timestamp !== 'number') {
        throw new ValidationError(
            'Timestamp must be a number',
            { field: '_timestamp', received: typeof msg._timestamp },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }

    if (typeof msg._origin !== 'string') {
        throw new ValidationError(
            'Origin must be a string',
            { field: '_origin', received: typeof msg._origin },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }

    if (typeof msg._expectsResponse !== 'boolean') {
        throw new ValidationError(
            'expectsResponse must be a boolean',
            { field: '_expectsResponse', received: typeof msg._expectsResponse },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }
}

/**
 * Validate a response protocol structure
 *
 * @param response - Response to validate
 * @throws ValidationError if the response structure is invalid
 */
export function validateResponseProtocol(response: unknown): asserts response is ResponseProtocol {
    if (!isParleyMessage(response)) {
        throw new ValidationError(
            'Response is not a valid Parley message',
            { received: typeof response },
            VALIDATION_ERRORS.INVALID_PROTOCOL
        );
    }

    const resp = response as unknown as Record<string, unknown>;

    // Check required fields
    const requiredFields = ['_v', '_id', '_requestId', '_timestamp', '_origin', 'success'];
    for (const field of requiredFields) {
        if (!(field in resp)) {
            throw new ValidationError(
                `Missing required field: ${field}`,
                { field },
                VALIDATION_ERRORS.REQUIRED_FIELD_MISSING
            );
        }
    }

    // Validate field types
    if (typeof resp._v !== 'string') {
        throw new ValidationError(
            'Protocol version must be a string',
            { field: '_v', received: typeof resp._v },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }

    if (typeof resp._requestId !== 'string') {
        throw new ValidationError(
            'Request ID must be a string',
            { field: '_requestId', received: typeof resp._requestId },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }

    if (typeof resp.success !== 'boolean') {
        throw new ValidationError(
            'Success must be a boolean',
            { field: 'success', received: typeof resp.success },
            VALIDATION_ERRORS.TYPE_MISMATCH
        );
    }
}

/**
 * Check protocol version compatibility
 *
 * Currently requires exact major version match.
 *
 * @param version - Version string to check
 * @returns True if version is compatible
 */
export function isCompatibleVersion(version: string): boolean {
    const [major] = version.split('.');
    const [currentMajor] = PROTOCOL_VERSION.split('.');
    return major === currentMajor;
}
