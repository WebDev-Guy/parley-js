/**
 * @file OriginValidator.ts
 * @description Origin validation utilities for Parley framework
 * @module parley-js/security
 *
 * Provides origin validation functions for message security.
 */

import { SecurityError } from '../errors/ErrorTypes';
import { SECURITY_ERRORS } from '../errors/ErrorCodes';
import { normalizeOrigin } from '../utils/Helpers';

/**
 * Origin validation result
 */
export interface OriginValidationResult {
    /** Whether the origin is valid */
    valid: boolean;

    /** Normalized origin string */
    normalizedOrigin: string;

    /** Error message if invalid */
    error?: string;
}

/**
 * Validate an origin against a list of allowed origins
 *
 * Uses strict matching - the origin must exactly match one
 * of the allowed origins after normalization.
 *
 * @param origin - Origin to validate
 * @param allowedOrigins - List of allowed origins
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateOrigin(
 *     'https://example.com',
 *     ['https://example.com', 'https://app.example.com']
 * );
 *
 * if (!result.valid) {
 *     console.error(result.error);
 * }
 * ```
 */
export function validateOrigin(origin: string, allowedOrigins: string[]): OriginValidationResult {
    if (!origin) {
        return {
            valid: false,
            normalizedOrigin: '',
            error: 'Origin is empty or undefined',
        };
    }

    if (!allowedOrigins || allowedOrigins.length === 0) {
        return {
            valid: false,
            normalizedOrigin: normalizeOrigin(origin),
            error: 'No allowed origins configured',
        };
    }

    const normalizedOriginValue = normalizeOrigin(origin);
    const normalizedAllowed = allowedOrigins.map(normalizeOrigin);

    if (normalizedAllowed.includes(normalizedOriginValue)) {
        return {
            valid: true,
            normalizedOrigin: normalizedOriginValue,
        };
    }

    return {
        valid: false,
        normalizedOrigin: normalizedOriginValue,
        error: `Origin "${normalizedOriginValue}" is not in the allowed list`,
    };
}

/**
 * Assert that an origin is valid
 *
 * Throws SecurityError if the origin is not in the allowed list.
 *
 * @param origin - Origin to validate
 * @param allowedOrigins - List of allowed origins
 * @throws SecurityError if origin is not allowed
 *
 * @example
 * ```typescript
 * try {
 *     assertOrigin(event.origin, config.allowedOrigins);
 *     // Origin is valid, proceed with message handling
 * } catch (error) {
 *     if (error instanceof SecurityError) {
 *         console.warn('Blocked message from:', error.receivedOrigin);
 *     }
 * }
 * ```
 */
export function assertOrigin(origin: string, allowedOrigins: string[]): void {
    const result = validateOrigin(origin, allowedOrigins);

    if (!result.valid) {
        throw new SecurityError(
            result.error ?? 'Origin validation failed',
            {
                receivedOrigin: origin,
                allowedOrigins,
            },
            SECURITY_ERRORS.ORIGIN_MISMATCH
        );
    }
}

/**
 * Check if origin validation is configured
 *
 * @param allowedOrigins - List of allowed origins
 * @returns True if at least one origin is configured
 */
export function hasAllowedOrigins(allowedOrigins: string[] | undefined): boolean {
    return Array.isArray(allowedOrigins) && allowedOrigins.length > 0;
}

/**
 * Get the current window's origin
 *
 * @returns Current origin or empty string if not available
 */
export function getCurrentWindowOrigin(): string {
    try {
        return window.location.origin;
    } catch {
        return '';
    }
}

/**
 * Get the origin from a URL string
 *
 * @param url - URL to extract origin from
 * @returns Origin string or null if invalid
 *
 * @example
 * ```typescript
 * const origin = getOriginFromUrl('https://example.com/path?query=1');
 * // Returns: 'https://example.com'
 * ```
 */
export function getOriginFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.origin;
    } catch {
        return null;
    }
}

/**
 * Check if two origins are the same
 *
 * Performs case-insensitive comparison after normalization.
 *
 * @param origin1 - First origin
 * @param origin2 - Second origin
 * @returns True if origins match
 */
export function isSameOrigin(origin1: string, origin2: string): boolean {
    return normalizeOrigin(origin1) === normalizeOrigin(origin2);
}

/**
 * Check if the current window is same-origin with a target
 *
 * @param target - Target window or iframe
 * @returns True if same origin, false if cross-origin or cannot determine
 */
export function isSameOriginTarget(target: Window | HTMLIFrameElement): boolean {
    try {
        const targetWindow = target instanceof HTMLIFrameElement ? target.contentWindow : target;

        if (!targetWindow) {
            return false;
        }

        // Accessing the location of a cross-origin window throws an error
        const targetOrigin = targetWindow.location.origin;
        return targetOrigin === window.location.origin;
    } catch {
        // SecurityError means cross-origin
        return false;
    }
}
