/**
 * @file ErrorCodes.ts
 * @description Error code constants for Parley framework
 * @module parley-js/errors
 *
 * Error codes follow the pattern: ERR_CATEGORY_SPECIFIC
 * This provides consistent, machine-readable error identification.
 */

/**
 * Validation error codes
 * Used when message payload validation fails
 */
export const VALIDATION_ERRORS = {
    /** Schema validation failed for message payload */
    SCHEMA_MISMATCH: 'ERR_VALIDATION_SCHEMA_MISMATCH',
    /** Required field is missing from payload */
    REQUIRED_FIELD_MISSING: 'ERR_VALIDATION_REQUIRED_FIELD_MISSING',
    /** Field type does not match schema definition */
    TYPE_MISMATCH: 'ERR_VALIDATION_TYPE_MISMATCH',
    /** Message type is not registered */
    UNREGISTERED_TYPE: 'ERR_VALIDATION_UNREGISTERED_TYPE',
    /** Protocol structure is invalid */
    INVALID_PROTOCOL: 'ERR_VALIDATION_INVALID_PROTOCOL',
} as const;

/**
 * Timeout error codes
 * Used when operations exceed time limits
 */
export const TIMEOUT_ERRORS = {
    /** No response received within timeout period */
    NO_RESPONSE: 'ERR_TIMEOUT_NO_RESPONSE',
    /** Connection handshake timed out */
    HANDSHAKE: 'ERR_TIMEOUT_HANDSHAKE',
    /** All retry attempts exhausted */
    RETRIES_EXHAUSTED: 'ERR_TIMEOUT_RETRIES_EXHAUSTED',
} as const;

/**
 * Target error codes
 * Used when target window/iframe issues occur
 */
export const TARGET_ERRORS = {
    /** Target window or iframe not found */
    NOT_FOUND: 'ERR_TARGET_NOT_FOUND',
    /** Target window is closed */
    CLOSED: 'ERR_TARGET_CLOSED',
    /** Target is not connected */
    NOT_CONNECTED: 'ERR_TARGET_NOT_CONNECTED',
    /** Invalid target type provided */
    INVALID_TYPE: 'ERR_TARGET_INVALID_TYPE',
    /** Target already registered with this ID */
    DUPLICATE_ID: 'ERR_TARGET_DUPLICATE_ID',
} as const;

/**
 * Security error codes
 * Used when security checks fail
 */
export const SECURITY_ERRORS = {
    /** Origin does not match allowed origins */
    ORIGIN_MISMATCH: 'ERR_SECURITY_ORIGIN_MISMATCH',
    /** Message source is not trusted */
    UNTRUSTED_SOURCE: 'ERR_SECURITY_UNTRUSTED_SOURCE',
    /** Payload contains potentially dangerous content */
    DANGEROUS_PAYLOAD: 'ERR_SECURITY_DANGEROUS_PAYLOAD',
    /** Protocol version mismatch */
    VERSION_MISMATCH: 'ERR_SECURITY_VERSION_MISMATCH',
} as const;

/**
 * Serialization error codes
 * Used when message serialization/deserialization fails
 */
export const SERIALIZATION_ERRORS = {
    /** Payload cannot be serialized to JSON */
    SERIALIZE_FAILED: 'ERR_SERIALIZATION_SERIALIZE_FAILED',
    /** Message cannot be deserialized from JSON */
    DESERIALIZE_FAILED: 'ERR_SERIALIZATION_DESERIALIZE_FAILED',
    /** Circular reference detected in payload */
    CIRCULAR_REFERENCE: 'ERR_SERIALIZATION_CIRCULAR_REFERENCE',
} as const;

/**
 * Connection error codes
 * Used when communication channel issues occur
 */
export const CONNECTION_ERRORS = {
    /** Channel is not open */
    NOT_OPEN: 'ERR_CONNECTION_NOT_OPEN',
    /** Channel was closed unexpectedly */
    CLOSED: 'ERR_CONNECTION_CLOSED',
    /** Failed to establish connection */
    FAILED: 'ERR_CONNECTION_FAILED',
    /** Connection already exists */
    ALREADY_CONNECTED: 'ERR_CONNECTION_ALREADY_CONNECTED',
    /** Handshake failed */
    HANDSHAKE_FAILED: 'ERR_CONNECTION_HANDSHAKE_FAILED',
    /** Target is not connected */
    NOT_CONNECTED: 'ERR_CONNECTION_NOT_CONNECTED',
    /** Connection is not ready for operations */
    NOT_READY: 'ERR_CONNECTION_NOT_READY',
    /** Connection was lost (detected via heartbeat or failures) */
    LOST: 'ERR_CONNECTION_LOST',
} as const;

/**
 * Configuration error codes
 * Used when configuration issues occur
 */
export const CONFIG_ERRORS = {
    /** Invalid configuration provided */
    INVALID: 'ERR_CONFIG_INVALID',
    /** Required configuration option missing */
    MISSING_REQUIRED: 'ERR_CONFIG_MISSING_REQUIRED',
    /** Configuration value out of range */
    OUT_OF_RANGE: 'ERR_CONFIG_OUT_OF_RANGE',
} as const;

/**
 * Union type of all error codes
 */
export type ErrorCode =
    | (typeof VALIDATION_ERRORS)[keyof typeof VALIDATION_ERRORS]
    | (typeof TIMEOUT_ERRORS)[keyof typeof TIMEOUT_ERRORS]
    | (typeof TARGET_ERRORS)[keyof typeof TARGET_ERRORS]
    | (typeof SECURITY_ERRORS)[keyof typeof SECURITY_ERRORS]
    | (typeof SERIALIZATION_ERRORS)[keyof typeof SERIALIZATION_ERRORS]
    | (typeof CONNECTION_ERRORS)[keyof typeof CONNECTION_ERRORS]
    | (typeof CONFIG_ERRORS)[keyof typeof CONFIG_ERRORS];

/**
 * All error codes consolidated for easy access
 */
export const ERROR_CODES = {
    ...VALIDATION_ERRORS,
    ...TIMEOUT_ERRORS,
    ...TARGET_ERRORS,
    ...SECURITY_ERRORS,
    ...SERIALIZATION_ERRORS,
    ...CONNECTION_ERRORS,
    ...CONFIG_ERRORS,
} as const;
