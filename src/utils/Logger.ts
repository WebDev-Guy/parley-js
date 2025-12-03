/**
 * @file Logger.ts
 * @description Internal logger for Parley framework
 * @module parley-js/utils
 *
 * The logger respects build mode (__DEV__) but allows runtime override.
 * In production builds, logging is disabled by default but can be enabled
 * by explicitly setting a log level.
 */

/**
 * Log level enumeration
 *
 * Log levels are ordered by verbosity:
 * none (0) < error (1) < warn (2) < info (3) < debug (4)
 */
export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Log level numeric values for comparison
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
    none: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

/**
 * ANSI color codes for console output (works in modern browsers)
 */
const LOG_COLORS = {
    debug: 'color: #7c7c7c',
    info: 'color: #0077cc',
    warn: 'color: #ff9900',
    error: 'color: #cc0000',
};

/**
 * Global __DEV__ declaration for build-time replacement
 */
declare const __DEV__: boolean;

/**
 * Internal logger class for Parley
 *
 * Provides filtered logging based on log level.
 * In production builds (__DEV__ = false), defaults to 'none'.
 * In development builds (__DEV__ = true), defaults to 'debug'.
 *
 * @example
 * ```typescript
 * const logger = new Logger('info');
 * logger.info('Connection established'); // Will log
 * logger.debug('Detailed state:', state); // Will not log (debug > info)
 * logger.error('Connection failed', error); // Will log
 * ```
 */
export class Logger {
    /**
     * Current log level
     */
    private _level: LogLevel;

    /**
     * Prefix for all log messages
     */
    private _prefix: string;

    /**
     * Whether timestamps should be included
     */
    private _includeTimestamp: boolean;

    /**
     * Creates a new Logger instance
     *
     * @param level - Log level (defaults based on __DEV__ flag)
     * @param prefix - Prefix for log messages (default: '[Parley]')
     * @param includeTimestamp - Whether to include timestamps (default: true)
     */
    constructor(level?: LogLevel, prefix: string = '[Parley]', includeTimestamp: boolean = true) {
        // Determine default level based on build mode
        const defaultLevel = typeof __DEV__ !== 'undefined' && __DEV__ ? 'debug' : 'none';
        this._level = level ?? defaultLevel;
        this._prefix = prefix;
        this._includeTimestamp = includeTimestamp;
    }

    /**
     * Set the log level
     *
     * @param level - New log level
     */
    public setLevel(level: LogLevel): void {
        this._level = level;
    }

    /**
     * Get the current log level
     *
     * @returns Current log level
     */
    public getLevel(): LogLevel {
        return this._level;
    }

    /**
     * Log a debug message
     *
     * Use for detailed debugging information that is typically only
     * needed during development or troubleshooting.
     *
     * @param message - Log message
     * @param args - Additional arguments to log
     */
    public debug(message: string, ...args: unknown[]): void {
        this._log('debug', message, args);
    }

    /**
     * Log an info message
     *
     * Use for general operational information about the system.
     *
     * @param message - Log message
     * @param args - Additional arguments to log
     */
    public info(message: string, ...args: unknown[]): void {
        this._log('info', message, args);
    }

    /**
     * Log a warning message
     *
     * Use for potentially problematic situations that don't prevent
     * operation but should be addressed.
     *
     * @param message - Log message
     * @param args - Additional arguments to log
     */
    public warn(message: string, ...args: unknown[]): void {
        this._log('warn', message, args);
    }

    /**
     * Log an error message
     *
     * Use for error conditions that prevent normal operation.
     *
     * @param message - Log message
     * @param args - Additional arguments to log
     */
    public error(message: string, ...args: unknown[]): void {
        this._log('error', message, args);
    }

    /**
     * Create a child logger with a different prefix
     *
     * @param subPrefix - Sub-prefix to append to the current prefix
     * @returns New Logger instance with combined prefix
     */
    public child(subPrefix: string): Logger {
        const combinedPrefix = `${this._prefix}[${subPrefix}]`;
        const childLogger = new Logger(this._level, combinedPrefix, this._includeTimestamp);
        return childLogger;
    }

    /**
     * Check if a specific level is enabled
     *
     * @param level - Level to check
     * @returns True if the level is enabled
     */
    public isEnabled(level: LogLevel): boolean {
        return LOG_LEVEL_VALUES[level] <= LOG_LEVEL_VALUES[this._level];
    }

    /**
     * Internal method to perform logging
     *
     * @param level - Log level
     * @param message - Log message
     * @param args - Additional arguments
     */
    private _log(level: Exclude<LogLevel, 'none'>, message: string, args: unknown[]): void {
        // Check if this level should be logged
        if (LOG_LEVEL_VALUES[level] > LOG_LEVEL_VALUES[this._level]) {
            return;
        }

        // Build the log message
        const timestamp = this._includeTimestamp ? `[${new Date().toISOString()}]` : '';
        const prefix = `${timestamp}${this._prefix}`;

        // Get the appropriate console method
        const consoleMethod = level === 'debug' ? 'log' : level;

        // Log with styling in browser environments
        if (typeof window !== 'undefined') {
            console[consoleMethod](`%c${prefix} ${message}`, LOG_COLORS[level], ...args);
        } else {
            // Node.js environment (for testing)
            console[consoleMethod](`${prefix} ${message}`, ...args);
        }
    }
}

/**
 * Create a default logger instance
 *
 * This can be used as a singleton logger across the application.
 */
export const defaultLogger = new Logger();
