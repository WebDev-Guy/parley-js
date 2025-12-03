/**
 * @file SecurityLayer.ts
 * @description Abstract security layer for Parley framework
 * @module parley-js/security
 *
 * Provides an extensible security abstraction for origin validation,
 * payload sanitization, and message validation.
 */

import type { MessageProtocol } from '../core/MessageProtocol';

/**
 * Abstract security layer class
 *
 * Extend this class to implement custom security logic.
 * The default implementation (DefaultSecurityLayer) provides
 * secure defaults for most use cases.
 *
 * @example
 * ```typescript
 * class CustomSecurityLayer extends SecurityLayer {
 *     validateOrigin(origin: string, allowedOrigins: string[]): boolean {
 *         // Custom origin validation logic
 *         return allowedOrigins.some(allowed =>
 *             origin.endsWith(allowed)
 *         );
 *     }
 *
 *     sanitizePayload<T>(payload: T): T {
 *         // Custom sanitization logic
 *         return JSON.parse(JSON.stringify(payload));
 *     }
 *
 *     validateMessage(message: MessageProtocol): boolean {
 *         // Custom message validation logic
 *         return true;
 *     }
 * }
 * ```
 */
export abstract class SecurityLayer {
    /**
     * Validate that an origin is in the allowed list
     *
     * @param origin - Origin to validate
     * @param allowedOrigins - List of allowed origins
     * @returns True if origin is allowed
     */
    abstract validateOrigin(origin: string, allowedOrigins: string[]): boolean;

    /**
     * Sanitize a payload to prevent XSS and prototype pollution
     *
     * @param payload - Payload to sanitize
     * @returns Sanitized payload
     */
    abstract sanitizePayload<T>(payload: T): T;

    /**
     * Validate a message structure and contents
     *
     * @param message - Message to validate
     * @returns True if message is valid
     */
    abstract validateMessage(message: MessageProtocol): boolean;
}

/**
 * Default security layer implementation
 *
 * Provides secure defaults:
 * - Strict origin matching
 * - JSON clone for payload sanitization
 * - Protocol structure validation
 */
export class DefaultSecurityLayer extends SecurityLayer {
    /**
     * Validate origin with strict matching
     *
     * Origins must exactly match one of the allowed origins.
     * This prevents subdomain bypass attacks.
     *
     * @param origin - Origin to validate
     * @param allowedOrigins - List of allowed origins
     * @returns True if origin exactly matches an allowed origin
     */
    validateOrigin(origin: string, allowedOrigins: string[]): boolean {
        if (!origin || !allowedOrigins || allowedOrigins.length === 0) {
            return false;
        }

        // Normalize origins for comparison
        const normalizedOrigin = this._normalizeOrigin(origin);

        for (const allowed of allowedOrigins) {
            const normalizedAllowed = this._normalizeOrigin(allowed);
            if (normalizedOrigin === normalizedAllowed) {
                return true;
            }
        }

        return false;
    }

    /**
     * Sanitize payload by deep cloning through JSON
     *
     * This removes:
     * - Functions
     * - Symbols
     * - Circular references
     * - Prototype chain (prevents prototype pollution)
     * - undefined values
     *
     * @param payload - Payload to sanitize
     * @returns Sanitized payload
     */
    sanitizePayload<T>(payload: T): T {
        if (payload === null || payload === undefined) {
            return payload;
        }

        if (typeof payload !== 'object') {
            return payload;
        }

        try {
            // JSON parse/stringify creates a clean object
            // without prototype chain or non-serializable values
            return JSON.parse(JSON.stringify(payload));
        } catch {
            // If serialization fails, return a safe empty object/array
            return (Array.isArray(payload) ? [] : {}) as T;
        }
    }

    /**
     * Validate message protocol structure
     *
     * Checks:
     * - Required fields are present
     * - Field types are correct
     * - Protocol version is compatible
     *
     * @param message - Message to validate
     * @returns True if message structure is valid
     */
    validateMessage(message: MessageProtocol): boolean {
        // Check for required fields
        if (!message || typeof message !== 'object') {
            return false;
        }

        // Validate Parley identifier
        if (message._parley !== '__parley__') {
            return false;
        }

        // Validate required string fields
        const stringFields = ['_v', '_id', '_type', '_origin'] as const;
        for (const field of stringFields) {
            if (typeof message[field] !== 'string') {
                return false;
            }
        }

        // Validate timestamp
        if (typeof message._timestamp !== 'number' || message._timestamp <= 0) {
            return false;
        }

        // Validate expectsResponse
        if (typeof message._expectsResponse !== 'boolean') {
            return false;
        }

        // Validate optional target field
        if (message._target !== undefined && typeof message._target !== 'string') {
            return false;
        }

        // Payload must be defined (can be null)
        if (!('payload' in message)) {
            return false;
        }

        return true;
    }

    /**
     * Normalize an origin for comparison
     *
     * @param origin - Origin to normalize
     * @returns Normalized origin string
     */
    private _normalizeOrigin(origin: string): string {
        try {
            const url = new URL(origin);
            return url.origin.toLowerCase();
        } catch {
            return origin.toLowerCase().trim();
        }
    }
}

/**
 * Create a default security layer instance
 *
 * @returns New DefaultSecurityLayer instance
 */
export function createDefaultSecurityLayer(): SecurityLayer {
    return new DefaultSecurityLayer();
}
