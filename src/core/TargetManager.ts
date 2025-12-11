/**
 * @file TargetManager.ts
 * @description Manages target windows and iframes for Parley framework
 * @module parley-js/core
 *
 * Handles registration, lookup, and lifecycle of communication targets.
 */

import { generateUUID } from '../utils/Helpers';
import { Logger } from '../utils/Logger';
import { TargetNotFoundError } from '../errors/ErrorTypes';
import { TARGET_ERRORS } from '../errors/ErrorCodes';
import { ConnectionState } from '../types/ConnectionTypes';
import type { TargetInfo, RegisterTargetOptions, ChannelTargetType } from '../types/ChannelTypes';

/**
 * Manages communication targets (windows and iframes)
 *
 * Provides:
 * - Target registration and lookup
 * - Connection state tracking
 * - Automatic cleanup of closed/destroyed targets
 * - Broadcast target iteration
 *
 * @example
 * ```typescript
 * const manager = new TargetManager();
 *
 * // Register an iframe
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * const targetId = manager.register(iframe, { id: 'my-iframe' });
 *
 * // Get target info
 * const info = manager.get(targetId);
 *
 * // Iterate all connected targets
 * for (const target of manager.getConnected()) {
 *     // Send message to target
 * }
 * ```
 */
export class TargetManager {
    /**
     * Map of target ID to target info
     */
    private _targets: Map<string, TargetInfo> = new Map();

    /**
     * Logger instance
     */
    private _logger: Logger;

    /**
     * Cleanup interval handle
     */
    private _cleanupInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Default cleanup interval in milliseconds (used when <= 100 targets)
     */
    private readonly _defaultCleanupIntervalMs = 5000;

    /**
     * Aggressive cleanup interval in milliseconds (used when > 100 targets)
     */
    private readonly _aggressiveCleanupIntervalMs = 1000;

    /**
     * Creates a new TargetManager instance
     *
     * @param logger - Optional logger instance
     */
    constructor(logger?: Logger) {
        this._logger =
            logger?.child('TargetManager') ?? new Logger(undefined, '[Parley][TargetManager]');
    }

    /**
     * Register a new target
     *
     * @param target - Target element or window reference
     * @param options - Registration options
     * @returns Target ID
     * @throws Error if target already registered with same ID
     *
     * @example
     * ```typescript
     * // Register with auto-generated ID
     * const id1 = manager.register(iframe);
     *
     * // Register with custom ID
     * const id2 = manager.register(window, { id: 'popup-window' });
     * ```
     */
    public register(target: HTMLIFrameElement | Window, options?: RegisterTargetOptions): string {
        const id = options?.id ?? this._generateTargetId(target);

        // Check for duplicate
        if (this._targets.has(id)) {
            throw new TargetNotFoundError(
                `Target with ID "${id}" is already registered`,
                { targetId: id },
                TARGET_ERRORS.DUPLICATE_ID
            );
        }

        // Determine target type
        const type: ChannelTargetType = target instanceof HTMLIFrameElement ? 'iframe' : 'window';

        // Determine origin
        const origin = options?.origin ?? this._getTargetOrigin(target);

        const info: TargetInfo = {
            id,
            target,
            type,
            origin,
            connected: false,
            state: ConnectionState.DISCONNECTED,
            lastActivity: Date.now(),
            missedHeartbeats: 0,
            consecutiveFailures: 0,
        };

        this._targets.set(id, info);
        this._logger.debug('Target registered', { id, type });

        // Start cleanup if not already running
        this._startCleanup();

        return id;
    }

    /**
     * Unregister a target
     *
     * @param id - Target ID to unregister
     */
    public unregister(id: string): void {
        const info = this._targets.get(id);
        if (info) {
            this._targets.delete(id);
            this._logger.debug('Target unregistered', { id });
        }

        // Stop cleanup if no targets
        if (this._targets.size === 0) {
            this._stopCleanup();
        }
    }

    /**
     * Get target info by ID
     *
     * @param id - Target ID
     * @returns Target info or undefined
     */
    public get(id: string): TargetInfo | undefined {
        return this._targets.get(id);
    }

    /**
     * Get target info by ID, throwing if not found
     *
     * @param id - Target ID
     * @returns Target info
     * @throws TargetNotFoundError if target not found
     */
    public getOrThrow(id: string): TargetInfo {
        const info = this._targets.get(id);
        if (!info) {
            throw new TargetNotFoundError(`Target "${id}" not found`, { targetId: id });
        }
        return info;
    }

    /**
     * Get all registered targets
     *
     * @returns Array of all target info objects
     */
    public getAll(): TargetInfo[] {
        return Array.from(this._targets.values());
    }

    /**
     * Get all connected targets
     *
     * @returns Array of connected target info objects
     */
    public getConnected(): TargetInfo[] {
        return this.getAll().filter((info) => info.connected);
    }

    /**
     * Get targets by type
     *
     * @param type - Target type to filter by
     * @returns Array of matching target info objects
     */
    public getByType(type: ChannelTargetType): TargetInfo[] {
        return this.getAll().filter((info) => info.type === type);
    }

    /**
     * Check if a target is registered
     *
     * @param id - Target ID
     * @returns True if registered
     */
    public has(id: string): boolean {
        return this._targets.has(id);
    }

    /**
     * Check if a target is alive (not closed/destroyed)
     *
     * @param id - Target ID
     * @returns True if alive
     */
    public isAlive(id: string): boolean {
        const info = this._targets.get(id);
        if (!info) {
            return false;
        }

        return this._checkTargetAlive(info);
    }

    /**
     * Mark a target as connected
     *
     * @param id - Target ID
     */
    public markConnected(id: string): void {
        const info = this._targets.get(id);
        if (info) {
            info.connected = true;
            info.state = ConnectionState.CONNECTED;
            info.connectedAt = Date.now();
            info.lastActivity = Date.now();
            info.missedHeartbeats = 0;
            info.consecutiveFailures = 0;
            this._logger.debug('Target marked connected', { id });
        }
    }

    /**
     * Update a target's origin
     *
     * This is called after connection is established to update the origin
     * that was initially unknown (e.g., for newly opened windows).
     *
     * @param id - Target ID
     * @param origin - New origin value
     */
    public updateOrigin(id: string, origin: string): void {
        const info = this._targets.get(id);
        if (info && origin) {
            info.origin = origin;
            this._logger.debug('Target origin updated', { id, origin });
        }
    }

    /**
     * Mark a target as disconnected
     *
     * @param id - Target ID
     */
    public markDisconnected(id: string): void {
        const info = this._targets.get(id);
        if (info) {
            info.connected = false;
            info.state = ConnectionState.DISCONNECTED;
            info.lastActivity = Date.now();
            this._logger.debug('Target marked disconnected', { id });
        }
    }

    /**
     * Update connection state for a target
     *
     * @param id - Target ID
     * @param state - New connection state
     * @returns Previous state, or undefined if target not found
     */
    public updateState(id: string, state: ConnectionState): ConnectionState | undefined {
        const info = this._targets.get(id);
        if (info) {
            const previousState = info.state;
            info.state = state;
            info.connected = state === ConnectionState.CONNECTED;
            info.lastActivity = Date.now();
            this._logger.debug('Target state updated', { id, from: previousState, to: state });
            return previousState;
        }
        return undefined;
    }

    /**
     * Record a successful heartbeat
     *
     * @param id - Target ID
     */
    public recordHeartbeat(id: string): void {
        const info = this._targets.get(id);
        if (info) {
            info.lastHeartbeat = Date.now();
            info.lastActivity = Date.now();
            info.missedHeartbeats = 0;
        }
    }

    /**
     * Record a missed heartbeat
     *
     * @param id - Target ID
     * @returns Number of consecutive missed heartbeats
     */
    public recordMissedHeartbeat(id: string): number {
        const info = this._targets.get(id);
        if (info) {
            info.missedHeartbeats++;
            return info.missedHeartbeats;
        }
        return 0;
    }

    /**
     * Record a successful send (reset failure counter)
     *
     * @param id - Target ID
     */
    public recordSendSuccess(id: string): void {
        const info = this._targets.get(id);
        if (info) {
            info.consecutiveFailures = 0;
            info.lastActivity = Date.now();
        }
    }

    /**
     * Record a send failure
     *
     * @param id - Target ID
     * @returns Number of consecutive failures
     */
    public recordSendFailure(id: string): number {
        const info = this._targets.get(id);
        if (info) {
            info.consecutiveFailures++;
            return info.consecutiveFailures;
        }
        return 0;
    }

    /**
     * Update last activity timestamp for a target
     *
     * @param id - Target ID
     */
    public updateActivity(id: string): void {
        const info = this._targets.get(id);
        if (info) {
            info.lastActivity = Date.now();
        }
    }

    /**
     * Get the count of registered targets
     *
     * @returns Number of registered targets
     */
    public get count(): number {
        return this._targets.size;
    }

    /**
     * Get the count of connected targets
     *
     * @returns Number of connected targets
     */
    public get connectedCount(): number {
        return this.getConnected().length;
    }

    /**
     * Clean up dead targets
     *
     * Removes targets that are closed or destroyed.
     *
     * @returns Number of targets removed
     */
    public cleanup(): number {
        let removed = 0;

        for (const [id, info] of this._targets) {
            if (!this._checkTargetAlive(info)) {
                this._targets.delete(id);
                this._logger.debug('Dead target cleaned up', { id });
                removed++;
            }
        }

        if (removed > 0) {
            this._logger.info('Cleanup completed', { removed });
        }

        return removed;
    }

    /**
     * Clear all targets
     */
    public clear(): void {
        this._targets.clear();
        this._stopCleanup();
        this._logger.debug('All targets cleared');
    }

    /**
     * Destroy the manager
     */
    public destroy(): void {
        this.clear();
        this._stopCleanup();
    }

    /**
     * Generate a target ID
     *
     * For iframes, uses the element ID if available.
     * Otherwise generates a UUID.
     *
     * @param target - Target to generate ID for
     * @returns Generated ID
     */
    private _generateTargetId(target: HTMLIFrameElement | Window): string {
        if (target instanceof HTMLIFrameElement && target.id) {
            return target.id;
        }

        return `target_${generateUUID().slice(0, 8)}`;
    }

    /**
     * Get the origin for a target
     *
     * @param target - Target to get origin for
     * @returns Origin string
     */
    private _getTargetOrigin(target: HTMLIFrameElement | Window): string {
        try {
            if (target instanceof HTMLIFrameElement) {
                // Try to get from contentWindow
                if (target.contentWindow?.location?.origin) {
                    return target.contentWindow.location.origin;
                }

                // Fall back to src attribute
                if (target.src) {
                    const url = new URL(target.src);
                    return url.origin;
                }
            } else {
                // Window target
                return target.location.origin;
            }
        } catch {
            // Cross-origin access denied
        }

        return '';
    }

    /**
     * Check if a target is alive
     *
     * @param info - Target info to check
     * @returns True if alive
     */
    private _checkTargetAlive(info: TargetInfo): boolean {
        try {
            if (info.type === 'iframe') {
                const iframe = info.target as HTMLIFrameElement;
                // Check if iframe is still in DOM and has contentWindow
                return document.contains(iframe) && iframe.contentWindow !== null;
            } else {
                const win = info.target as Window;
                // Check if window is still open
                return !win.closed;
            }
        } catch {
            return false;
        }
    }

    /**
     * Start cleanup interval
     */
    private _startCleanup(): void {
        if (this._cleanupInterval) {
            return;
        }

        // Adaptive interval: more aggressive with more targets
        const interval =
            this._targets.size > 100
                ? this._aggressiveCleanupIntervalMs
                : this._defaultCleanupIntervalMs;

        this._cleanupInterval = setInterval(() => {
            this.cleanup();

            // Stop cleanup if no targets left
            if (this._targets.size === 0) {
                this._stopCleanup();
            }
        }, interval);
    }

    /**
     * Stop cleanup interval
     */
    private _stopCleanup(): void {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
    }
}
