/**
 * @file HeartbeatManager.ts
 * @description Manages heartbeat/keepalive mechanism for active connections
 * @module parley-js/core
 *
 * Provides active health monitoring for connections by sending periodic
 * ping messages and tracking responses.
 */

import { Logger } from '../utils/Logger';
import type { ResolvedHeartbeatConfig } from '../types/ConfigTypes';
import type { HeartbeatPingPayload } from '../types/MessageTypes';

/**
 * Callback type for sending heartbeat pings
 */
export type HeartbeatSendFunction = (
    targetId: string,
    payload: HeartbeatPingPayload
) => Promise<void>;

/**
 * Callback type for handling heartbeat failures
 */
export type HeartbeatFailureHandler = (targetId: string, consecutiveMissed: number) => void;

/**
 * Manages heartbeat/keepalive for active connections
 *
 * Features:
 * - Periodic ping/pong health checks
 * - Configurable intervals and timeouts
 * - Automatic failure detection
 * - Per-target heartbeat tracking
 *
 * @example
 * ```typescript
 * const heartbeatManager = new HeartbeatManager(
 *     config.heartbeat,
 *     logger,
 *     instanceId,
 *     async (targetId, payload) => {
 *         await sendSystemMessage(targetId, 'heartbeat_ping', payload);
 *     },
 *     (targetId, missed) => {
 *         console.log(`Heartbeat missed for ${targetId}: ${missed} times`);
 *     }
 * );
 *
 * // Start heartbeat for a target
 * heartbeatManager.start('child-window');
 *
 * // Stop when disconnecting
 * heartbeatManager.stop('child-window');
 * ```
 */
export class HeartbeatManager {
    /**
     * Heartbeat configuration
     */
    private _config: ResolvedHeartbeatConfig;

    /**
     * Map of target ID to interval handle
     */
    private _intervals: Map<string, ReturnType<typeof setInterval>> = new Map();

    /**
     * Logger instance
     */
    private _logger: Logger;

    /**
     * Instance ID for identifying sender
     */
    private _instanceId: string;

    /**
     * Function to send heartbeat ping
     */
    private _sendHeartbeat: HeartbeatSendFunction;

    /**
     * Handler for heartbeat failures
     */
    private _onFailure: HeartbeatFailureHandler;

    /**
     * Track pending heartbeat for each target
     */
    private _pendingHeartbeats: Map<string, boolean> = new Map();

    /**
     * Creates a new HeartbeatManager instance
     *
     * @param config - Heartbeat configuration
     * @param logger - Logger instance
     * @param instanceId - Instance ID for sender identification
     * @param sendHeartbeat - Function to send heartbeat ping
     * @param onFailure - Handler for heartbeat failures
     */
    constructor(
        config: ResolvedHeartbeatConfig,
        logger: Logger,
        instanceId: string,
        sendHeartbeat: HeartbeatSendFunction,
        onFailure: HeartbeatFailureHandler
    ) {
        this._config = config;
        this._logger = logger.child('HeartbeatManager');
        this._instanceId = instanceId;
        this._sendHeartbeat = sendHeartbeat;
        this._onFailure = onFailure;
    }

    /**
     * Check if heartbeat is enabled
     */
    public get enabled(): boolean {
        return this._config.enabled;
    }

    /**
     * Get heartbeat interval in milliseconds
     */
    public get interval(): number {
        return this._config.interval;
    }

    /**
     * Get heartbeat timeout in milliseconds
     */
    public get timeout(): number {
        return this._config.timeout;
    }

    /**
     * Start heartbeat for a target
     *
     * @param targetId - Target ID to start heartbeat for
     */
    public start(targetId: string): void {
        if (!this._config.enabled) {
            this._logger.debug('Heartbeat disabled, not starting', { targetId });
            return;
        }

        if (this._intervals.has(targetId)) {
            this._logger.warn('Heartbeat already running for target', { targetId });
            return;
        }

        this._logger.debug('Starting heartbeat', { targetId, interval: this._config.interval });

        // Send initial heartbeat after a short delay
        setTimeout(() => {
            if (this._intervals.has(targetId)) {
                this._ping(targetId);
            }
        }, 1000);

        // Start periodic heartbeat
        const interval = setInterval(() => {
            this._ping(targetId);
        }, this._config.interval);

        this._intervals.set(targetId, interval);
    }

    /**
     * Stop heartbeat for a target
     *
     * @param targetId - Target ID to stop heartbeat for
     */
    public stop(targetId: string): void {
        const interval = this._intervals.get(targetId);
        if (interval) {
            clearInterval(interval);
            this._intervals.delete(targetId);
            this._pendingHeartbeats.delete(targetId);
            this._logger.debug('Stopped heartbeat', { targetId });
        }
    }

    /**
     * Stop all heartbeats
     */
    public stopAll(): void {
        for (const [targetId, interval] of this._intervals) {
            clearInterval(interval);
            this._logger.debug('Stopped heartbeat', { targetId });
        }
        this._intervals.clear();
        this._pendingHeartbeats.clear();
    }

    /**
     * Check if heartbeat is running for a target
     *
     * @param targetId - Target ID to check
     * @returns True if heartbeat is running
     */
    public isRunning(targetId: string): boolean {
        return this._intervals.has(targetId);
    }

    /**
     * Get number of active heartbeats
     */
    public get activeCount(): number {
        return this._intervals.size;
    }

    /**
     * Record a successful heartbeat response
     *
     * Called when a heartbeat pong is received.
     *
     * @param targetId - Target ID that responded
     */
    public recordSuccess(targetId: string): void {
        this._pendingHeartbeats.set(targetId, false);
        this._logger.debug('Heartbeat successful', { targetId });
    }

    /**
     * Send heartbeat ping to target
     *
     * @param targetId - Target ID to ping
     */
    private async _ping(targetId: string): Promise<void> {
        // Check if previous heartbeat is still pending
        if (this._pendingHeartbeats.get(targetId)) {
            // Previous heartbeat didn't get a response - count as missed
            this._logger.warn('Previous heartbeat still pending, counting as missed', { targetId });
            this._onFailure(targetId, 1);
            // Don't send another ping if one is already pending
            return;
        }

        const payload: HeartbeatPingPayload = {
            senderId: this._instanceId,
            timestamp: Date.now(),
        };

        this._pendingHeartbeats.set(targetId, true);

        try {
            await this._sendHeartbeat(targetId, payload);
            // Success is recorded via recordSuccess() when pong is received
        } catch (error) {
            this._logger.warn('Heartbeat ping failed', { targetId, error });
            this._pendingHeartbeats.set(targetId, false);
            this._onFailure(targetId, 1);
        }
    }

    /**
     * Update configuration
     *
     * Note: Does not affect already-running heartbeats.
     * Stop and restart heartbeats to apply new config.
     *
     * @param config - New configuration
     */
    public updateConfig(config: Partial<ResolvedHeartbeatConfig>): void {
        this._config = { ...this._config, ...config };
        this._logger.debug('Config updated', { config: this._config });
    }

    /**
     * Destroy the manager and stop all heartbeats
     */
    public destroy(): void {
        this.stopAll();
        this._logger.debug('HeartbeatManager destroyed');
    }
}
