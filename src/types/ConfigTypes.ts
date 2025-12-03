/**
 * @file ConfigTypes.ts
 * @description Configuration type definitions for Parley framework
 * @module parley-js/types
 */

import type { LogLevel } from '../utils/Logger';
import type { SecurityLayer } from '../security/SecurityLayer';

/**
 * Heartbeat configuration for connection health monitoring
 */
export interface HeartbeatConfig {
    /**
     * Enable heartbeat/keepalive mechanism
     * @default true
     */
    enabled?: boolean;

    /**
     * Interval between heartbeat pings (milliseconds)
     * @default 5000 (5 seconds)
     */
    interval?: number;

    /**
     * Timeout waiting for heartbeat response (milliseconds)
     * @default 2000 (2 seconds)
     */
    timeout?: number;

    /**
     * Number of consecutive missed heartbeats before considering connection dead
     * @default 3
     */
    maxMissed?: number;

    /**
     * Number of consecutive send failures before considering connection dead
     * Only applies to messages with expectsResponse: true
     * @default 3
     */
    maxFailures?: number;
}

/**
 * Resolved heartbeat configuration with all defaults applied
 */
export interface ResolvedHeartbeatConfig {
    enabled: boolean;
    interval: number;
    timeout: number;
    maxMissed: number;
    maxFailures: number;
}

/**
 * Default heartbeat configuration values
 */
export const DEFAULT_HEARTBEAT_CONFIG: ResolvedHeartbeatConfig = {
    enabled: true,
    interval: 5000,
    timeout: 2000,
    maxMissed: 3,
    maxFailures: 3,
};

/**
 * Target type for communication
 *
 * - 'iframe': Communication with iframes
 * - 'window': Communication with windows opened via window.open
 */
export type TargetType = 'iframe' | 'window';

/**
 * Main configuration interface for Parley
 *
 * @example
 * ```typescript
 * const config: ParleyConfig = {
 *     targetType: 'iframe',
 *     timeout: 10000,
 *     allowedOrigins: ['https://example.com'],
 *     logLevel: 'debug'
 * };
 * ```
 */
export interface ParleyConfig {
    /**
     * Communication strategy
     *
     * Determines how Parley manages connections:
     * - 'iframe': Manages communication with embedded iframes
     * - 'window': Manages communication with popup/new windows
     */
    targetType: TargetType;

    /**
     * Default timeout in milliseconds
     *
     * Time to wait for a response before timing out.
     * Can be overridden per message type or per send call.
     *
     * @default 5000
     */
    timeout?: number;

    /**
     * Default retry count
     *
     * Number of times to retry a failed message before giving up.
     * Retries use exponential backoff.
     *
     * @default 0
     */
    retries?: number;

    /**
     * List of allowed origins
     *
     * Messages from origins not in this list will be rejected.
     * Uses exact matching.
     *
     * @default [window.location.origin]
     */
    allowedOrigins?: string[];

    /**
     * Log level for internal logging
     *
     * In production builds, defaults to 'none'.
     * In development builds, defaults to 'debug'.
     *
     * @default 'none' (production) / 'debug' (development)
     */
    logLevel?: LogLevel;

    /**
     * Enable analytics hooks
     *
     * When enabled, analytics events will be emitted for
     * message sending, receiving, and errors.
     *
     * @default false
     */
    analyticsEnabled?: boolean;

    /**
     * Custom security layer
     *
     * Allows providing a custom security implementation.
     * If not provided, the default security layer is used.
     */
    securityLayer?: SecurityLayer;

    /**
     * Instance identifier
     *
     * Optional unique identifier for this Parley instance.
     * Useful for debugging with multiple instances.
     */
    instanceId?: string;

    /**
     * Heartbeat configuration for connection health monitoring
     *
     * Enables active keepalive mechanism to detect dead connections.
     * When enabled, periodic pings are sent to all connected targets.
     *
     * @default { enabled: true, interval: 5000, timeout: 2000, maxMissed: 3, maxFailures: 3 }
     */
    heartbeat?: HeartbeatConfig;
}

/**
 * Required configuration with defaults applied
 */
export interface ResolvedConfig {
    /** Target type (required) */
    targetType: TargetType;

    /** Timeout with default applied */
    timeout: number;

    /** Retries with default applied */
    retries: number;

    /** Allowed origins with default applied */
    allowedOrigins: string[];

    /** Log level with default applied */
    logLevel: LogLevel;

    /** Analytics enabled flag with default applied */
    analyticsEnabled: boolean;

    /** Security layer (always present) */
    securityLayer: SecurityLayer;

    /** Instance ID with generated default if not provided */
    instanceId: string;

    /** Heartbeat configuration with defaults applied */
    heartbeat: ResolvedHeartbeatConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
    timeout: 5000,
    retries: 0,
    logLevel: 'none' as LogLevel,
    analyticsEnabled: false,
} as const;

/**
 * Validate configuration object
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: ParleyConfig): void {
    if (!config.targetType) {
        throw new Error('Configuration error: targetType is required');
    }

    if (config.targetType !== 'iframe' && config.targetType !== 'window') {
        throw new Error(
            `Configuration error: targetType must be 'iframe' or 'window', received: ${config.targetType}`
        );
    }

    if (
        config.timeout !== undefined &&
        (typeof config.timeout !== 'number' || config.timeout <= 0)
    ) {
        throw new Error('Configuration error: timeout must be a positive number');
    }

    if (
        config.retries !== undefined &&
        (typeof config.retries !== 'number' || config.retries < 0)
    ) {
        throw new Error('Configuration error: retries must be a non-negative number');
    }

    if (config.allowedOrigins !== undefined) {
        if (!Array.isArray(config.allowedOrigins)) {
            throw new Error('Configuration error: allowedOrigins must be an array');
        }

        for (const origin of config.allowedOrigins) {
            if (typeof origin !== 'string') {
                throw new Error('Configuration error: allowedOrigins must contain only strings');
            }
        }
    }
}
