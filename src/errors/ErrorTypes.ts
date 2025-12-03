/**
 * @file ErrorTypes.ts
 * @description Custom error classes for Parley framework
 * @module parley-js/errors
 *
 * All Parley errors extend ParleyError for consistent error handling.
 * Each error class includes a specific error code for programmatic handling.
 */

import {
    ErrorCode,
    VALIDATION_ERRORS,
    TIMEOUT_ERRORS,
    TARGET_ERRORS,
    SECURITY_ERRORS,
    SERIALIZATION_ERRORS,
    CONNECTION_ERRORS,
} from './ErrorCodes';

/**
 * Base error class for all Parley errors
 *
 * @example
 * ```typescript
 * try {
 *     await parley.send('message', payload);
 * } catch (error) {
 *     if (error instanceof ParleyError) {
 *         console.error(`Error ${error.code}: ${error.message}`);
 *         console.error('Details:', error.details);
 *     }
 * }
 * ```
 */
export class ParleyError extends Error {
    /** Error code for programmatic error handling */
    public readonly code: ErrorCode;

    /** Additional error details */
    public readonly details?: unknown;

    /** Timestamp when the error occurred */
    public readonly timestamp: number;

    /**
     * Creates a new ParleyError
     *
     * @param message - Human-readable error message
     * @param code - Error code from ErrorCodes
     * @param details - Optional additional details about the error
     */
    constructor(message: string, code: ErrorCode, details?: unknown) {
        super(message);
        this.name = 'ParleyError';
        this.code = code;
        this.details = details;
        this.timestamp = Date.now();

        // Maintains proper stack trace for where error was thrown (V8 engines)
        const ErrorWithCapture = Error as typeof Error & {
            captureStackTrace?: (target: object, constructor: Function) => void;
        };
        if (ErrorWithCapture.captureStackTrace) {
            ErrorWithCapture.captureStackTrace(this, this.constructor);
        }

        // Set prototype explicitly for instanceof checks in ES5 environments
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * Returns a JSON-serializable representation of the error
     */
    public toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }
}

/**
 * Error thrown when schema validation fails
 *
 * @example
 * ```typescript
 * throw new ValidationError(
 *     'Payload does not match schema',
 *     { field: 'username', expected: 'string', received: 'number' }
 * );
 * ```
 */
export class ValidationError extends ParleyError {
    /** Validation errors array for detailed feedback */
    public readonly validationErrors?: Array<{
        field: string;
        message: string;
        expected?: string;
        received?: string;
    }>;

    /**
     * Creates a new ValidationError
     *
     * @param message - Human-readable error message
     * @param details - Validation error details
     * @param code - Specific validation error code
     */
    constructor(
        message: string,
        details?: unknown,
        code: (typeof VALIDATION_ERRORS)[keyof typeof VALIDATION_ERRORS] = VALIDATION_ERRORS.SCHEMA_MISMATCH
    ) {
        super(message, code, details);
        this.name = 'ValidationError';

        if (Array.isArray(details)) {
            this.validationErrors = details;
        }
    }
}

/**
 * Error thrown when a message times out waiting for a response
 *
 * @example
 * ```typescript
 * throw new TimeoutError(
 *     'No response received within 5000ms',
 *     { messageId: 'abc-123', timeout: 5000 }
 * );
 * ```
 */
export class TimeoutError extends ParleyError {
    /** The message ID that timed out */
    public readonly messageId?: string;

    /** The timeout duration in milliseconds */
    public readonly timeoutMs?: number;

    /** Number of retries attempted */
    public readonly retriesAttempted?: number;

    /**
     * Creates a new TimeoutError
     *
     * @param message - Human-readable error message
     * @param details - Timeout details including messageId and timeout duration
     * @param code - Specific timeout error code
     */
    constructor(
        message: string,
        details?: {
            messageId?: string;
            timeout?: number;
            retriesAttempted?: number;
        },
        code: (typeof TIMEOUT_ERRORS)[keyof typeof TIMEOUT_ERRORS] = TIMEOUT_ERRORS.NO_RESPONSE
    ) {
        super(message, code, details);
        this.name = 'TimeoutError';
        this.messageId = details?.messageId;
        this.timeoutMs = details?.timeout;
        this.retriesAttempted = details?.retriesAttempted;
    }
}

/**
 * Error thrown when a target window or iframe cannot be found
 *
 * @example
 * ```typescript
 * throw new TargetNotFoundError(
 *     'Target iframe not found',
 *     { targetId: 'my-iframe' }
 * );
 * ```
 */
export class TargetNotFoundError extends ParleyError {
    /** The target ID that was not found */
    public readonly targetId?: string;

    /**
     * Creates a new TargetNotFoundError
     *
     * @param message - Human-readable error message
     * @param details - Target details
     * @param code - Specific target error code
     */
    constructor(
        message: string,
        details?: { targetId?: string },
        code: (typeof TARGET_ERRORS)[keyof typeof TARGET_ERRORS] = TARGET_ERRORS.NOT_FOUND
    ) {
        super(message, code, details);
        this.name = 'TargetNotFoundError';
        this.targetId = details?.targetId;
    }
}

/**
 * Error thrown when a security check fails
 *
 * @example
 * ```typescript
 * throw new SecurityError(
 *     'Origin not in allowed list',
 *     {
 *         receivedOrigin: 'https://evil.com',
 *         allowedOrigins: ['https://example.com']
 *     }
 * );
 * ```
 */
export class SecurityError extends ParleyError {
    /** The origin that failed validation */
    public readonly receivedOrigin?: string;

    /** The list of allowed origins */
    public readonly allowedOrigins?: string[];

    /**
     * Creates a new SecurityError
     *
     * @param message - Human-readable error message
     * @param details - Security error details
     * @param code - Specific security error code
     */
    constructor(
        message: string,
        details?: {
            receivedOrigin?: string;
            allowedOrigins?: string[];
        },
        code: (typeof SECURITY_ERRORS)[keyof typeof SECURITY_ERRORS] = SECURITY_ERRORS.ORIGIN_MISMATCH
    ) {
        super(message, code, details);
        this.name = 'SecurityError';
        this.receivedOrigin = details?.receivedOrigin;
        this.allowedOrigins = details?.allowedOrigins;
    }
}

/**
 * Error thrown when message serialization or deserialization fails
 *
 * @example
 * ```typescript
 * throw new SerializationError(
 *     'Cannot serialize payload with circular reference',
 *     { payload: circularObject }
 * );
 * ```
 */
export class SerializationError extends ParleyError {
    /**
     * Creates a new SerializationError
     *
     * @param message - Human-readable error message
     * @param details - Serialization error details
     * @param code - Specific serialization error code
     */
    constructor(
        message: string,
        details?: unknown,
        code: (typeof SERIALIZATION_ERRORS)[keyof typeof SERIALIZATION_ERRORS] = SERIALIZATION_ERRORS.SERIALIZE_FAILED
    ) {
        super(message, code, details);
        this.name = 'SerializationError';
    }
}

/**
 * Error thrown when the communication channel encounters issues
 *
 * @example
 * ```typescript
 * throw new ConnectionError(
 *     'Channel closed unexpectedly',
 *     { targetId: 'window-1' }
 * );
 * ```
 */
export class ConnectionError extends ParleyError {
    /** The target ID associated with the connection error */
    public readonly targetId?: string;

    /**
     * Creates a new ConnectionError
     *
     * @param message - Human-readable error message
     * @param details - Connection error details
     * @param code - Specific connection error code
     */
    constructor(
        message: string,
        details?: { targetId?: string },
        code: (typeof CONNECTION_ERRORS)[keyof typeof CONNECTION_ERRORS] = CONNECTION_ERRORS.FAILED
    ) {
        super(message, code, details);
        this.name = 'ConnectionError';
        this.targetId = details?.targetId;
    }
}

/**
 * Type guard to check if an error is a ParleyError
 *
 * @param error - The error to check
 * @returns True if the error is a ParleyError
 */
export function isParleyError(error: unknown): error is ParleyError {
    return error instanceof ParleyError;
}

/**
 * Type guard to check if an error is a ValidationError
 *
 * @param error - The error to check
 * @returns True if the error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a TimeoutError
 *
 * @param error - The error to check
 * @returns True if the error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
    return error instanceof TimeoutError;
}

/**
 * Type guard to check if an error is a SecurityError
 *
 * @param error - The error to check
 * @returns True if the error is a SecurityError
 */
export function isSecurityError(error: unknown): error is SecurityError {
    return error instanceof SecurityError;
}
