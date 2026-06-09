/**
 * @file ConnectionManager.ts
 * @description Manages connection lifecycle for the Parley framework
 * @module parley-js/core
 *
 * Internal collaborator of Parley that owns the communication channels and
 * handles connect/disconnect flows, channel creation, connection state
 * transitions, and related system-event emission.
 */

import { EventEmitter } from '../events/EventEmitter';
import { Logger } from '../utils/Logger';
import { getTimestamp } from '../utils/Helpers';
import { IframeChannel } from '../communication/IframeChannel';
import { WindowChannel } from '../communication/WindowChannel';
import type { BaseChannel } from '../communication/BaseChannel';
import { MessageRegistry } from './MessageRegistry';
import { TargetManager } from './TargetManager';
import { HeartbeatManager } from './HeartbeatManager';
import type { MessageProtocol, ResponseProtocol } from './MessageProtocol';
import { SYSTEM_EVENTS } from '../events/SystemEvents';
import { ConnectionState } from '../types/ConnectionTypes';
import type { DisconnectReason } from '../types/ConnectionTypes';
import type { ResolvedConfig } from '../types/ConfigTypes';
import {
    SYSTEM_MESSAGE_TYPES,
    type MessageMetadata,
    type DisconnectPayload,
    type HeartbeatPingPayload,
    type HeartbeatPongPayload,
} from '../types/MessageTypes';
import type { ChannelOptions } from '../types/ChannelTypes';

/**
 * Dependencies required by the ConnectionManager
 *
 * Narrow callbacks are used instead of a reference back to Parley to keep
 * the coupling between the collaborators minimal.
 */
export interface ConnectionManagerDependencies {
    /** Resolved Parley configuration */
    config: ResolvedConfig;

    /** Logger instance */
    logger: Logger;

    /** Internal event emitter for system events */
    emitter: EventEmitter;

    /** Message registry for registering internal system message handlers */
    registry: MessageRegistry;

    /** Target manager for target registration and state tracking */
    targets: TargetManager;

    /** Accessor for the heartbeat manager (may be null when disabled or destroyed) */
    getHeartbeatManager: () => HeartbeatManager | null;

    /** Callback invoked for every message received on a channel */
    onIncomingMessage: (
        message: MessageProtocol | ResponseProtocol,
        source: Window,
        sourceTargetId: string
    ) => void;

    /** Callback to send a system message and await its response */
    sendSystemMessage: (
        type: string,
        payload: unknown,
        targetId: string,
        timeout?: number
    ) => Promise<unknown>;

    /** Callback to reject pending requests for a disconnecting target */
    rejectPendingForTarget: (targetId: string, reason: string) => void;
}

/**
 * Manages connection lifecycle for Parley
 *
 * Provides:
 * - Channel creation (IframeChannel/WindowChannel selection)
 * - Connect and graceful disconnect flows
 * - Local disconnect cleanup
 * - Connection state transitions and system-event emission
 * - Internal system message handling (disconnect, heartbeat ping/pong)
 * - Heartbeat failure handling (connection-lost detection)
 *
 * This class is internal to the framework and is not exported from the
 * package entry point.
 */
export class ConnectionManager {
    /**
     * Resolved configuration
     */
    private _config: ResolvedConfig;

    /**
     * Logger instance
     */
    private _logger: Logger;

    /**
     * Internal event emitter for system events
     */
    private _emitter: EventEmitter;

    /**
     * Message registry
     */
    private _registry: MessageRegistry;

    /**
     * Target manager
     */
    private _targets: TargetManager;

    /**
     * Accessor for the heartbeat manager
     */
    private _getHeartbeatManager: () => HeartbeatManager | null;

    /**
     * Callback for incoming channel messages
     */
    private _onIncomingMessage: (
        message: MessageProtocol | ResponseProtocol,
        source: Window,
        sourceTargetId: string
    ) => void;

    /**
     * Callback to send a system message
     */
    private _sendSystemMessage: (
        type: string,
        payload: unknown,
        targetId: string,
        timeout?: number
    ) => Promise<unknown>;

    /**
     * Callback to reject pending requests for a target
     */
    private _rejectPendingForTarget: (targetId: string, reason: string) => void;

    /**
     * Communication channels by target ID
     */
    private _channels: Map<string, BaseChannel> = new Map();

    /**
     * Creates a new ConnectionManager instance
     *
     * @param deps - Dependencies (config, logger, emitter, targets, and callbacks)
     */
    constructor(deps: ConnectionManagerDependencies) {
        this._config = deps.config;
        this._logger = deps.logger;
        this._emitter = deps.emitter;
        this._registry = deps.registry;
        this._targets = deps.targets;
        this._getHeartbeatManager = deps.getHeartbeatManager;
        this._onIncomingMessage = deps.onIncomingMessage;
        this._sendSystemMessage = deps.sendSystemMessage;
        this._rejectPendingForTarget = deps.rejectPendingForTarget;

        // Register internal system message handlers
        this._registerSystemMessageHandlers();
    }

    /**
     * Get the communication channel for a target
     *
     * @param targetId - Target ID
     * @returns Channel or undefined if not found
     */
    public getChannel(targetId: string): BaseChannel | undefined {
        return this._channels.get(targetId);
    }

    /**
     * Connect to a target (iframe or window)
     *
     * @param target - HTMLIFrameElement or Window to connect to
     * @param targetId - Optional custom identifier for the target
     * @returns Promise that resolves when connected
     */
    public async connect(target: HTMLIFrameElement | Window, targetId?: string): Promise<void> {
        // Register target
        const id = this._targets.register(target, { id: targetId });

        // Update state to CONNECTING
        this._targets.updateState(id, ConnectionState.CONNECTING);

        // Create channel options
        const channelOptions: ChannelOptions = {
            allowedOrigins: this._config.allowedOrigins,
            handshakeTimeout: this._config.timeout,
            autoReconnect: false,
            reconnectDelay: 1000,
            maxReconnectAttempts: 0,
        };

        // Create appropriate channel
        const channel =
            this._config.targetType === 'iframe'
                ? new IframeChannel(channelOptions, this._logger)
                : new WindowChannel(channelOptions, this._logger);

        // Set up message handler
        channel.setMessageHandler((message, source) => {
            this._onIncomingMessage(message, source, id);
        });

        // Store channel
        this._channels.set(id, channel);

        try {
            // Connect
            await channel.connect(target);

            // Update target origin from channel (now known after handshake)
            const channelOrigin = channel.getTargetOrigin();
            if (channelOrigin) {
                this._targets.updateOrigin(id, channelOrigin);
            }

            // Mark target as connected
            this._targets.markConnected(id);

            // Emit connection state changed event
            this._emitter.emitSync(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, {
                targetId: id,
                previousState: ConnectionState.CONNECTING,
                currentState: ConnectionState.CONNECTED,
                reason: 'handshake_complete',
                timestamp: getTimestamp(),
            });

            // Emit connected event
            const targetInfo = this._targets.get(id)!;
            await this._emitter.emit(SYSTEM_EVENTS.CONNECTED, {
                targetId: id,
                targetType: targetInfo.type,
                origin: targetInfo.origin,
                timestamp: getTimestamp(),
            });

            // Start heartbeat for this target
            const heartbeatManager = this._getHeartbeatManager();
            if (heartbeatManager) {
                heartbeatManager.start(id);
            }

            this._logger.info('Connected to target', { targetId: id });
        } catch (error) {
            // Clean up on failure
            this._channels.delete(id);
            this._targets.unregister(id);
            throw error;
        }
    }

    /**
     * Disconnect from a target with graceful notification
     *
     * Sends a disconnect notification to the other side before disconnecting.
     * This allows the other side to clean up and update its UI.
     *
     * @param targetId - ID of target to disconnect
     */
    public async disconnect(targetId: string): Promise<void> {
        const targetInfo = this._targets.get(targetId);
        if (!targetInfo) {
            this._logger.warn('Target not found for disconnect', { targetId });
            return;
        }

        const previousState = targetInfo.state;

        // Update state to DISCONNECTING
        this._targets.updateState(targetId, ConnectionState.DISCONNECTING);

        // Emit state change
        this._emitter.emitSync(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, {
            targetId,
            previousState,
            currentState: ConnectionState.DISCONNECTING,
            reason: 'manual_disconnect',
            timestamp: getTimestamp(),
        });

        // Stop heartbeat immediately
        const heartbeatManager = this._getHeartbeatManager();
        if (heartbeatManager) {
            heartbeatManager.stop(targetId);
        }

        // Try to send disconnect notification (with short timeout)
        try {
            const disconnectPayload: DisconnectPayload = {
                senderId: this._config.instanceId,
                reason: 'manual_disconnect',
                timestamp: getTimestamp(),
            };

            // Send disconnect notification - don't wait too long
            await this._sendSystemMessage(
                SYSTEM_MESSAGE_TYPES.DISCONNECT,
                disconnectPayload,
                targetId,
                1000 // 1 second timeout for disconnect
            );

            this._logger.debug('Disconnect notification sent', { targetId });
        } catch (error) {
            // Timeout or error - other side might be dead, continue anyway
            this._logger.warn('Disconnect notification failed', { targetId, error });
        }

        // Perform local disconnect cleanup
        this.performLocalDisconnect(targetId, 'manual_disconnect');
    }

    /**
     * Perform local disconnect cleanup without notification
     *
     * @param targetId - Target ID to disconnect
     * @param reason - Reason for disconnection
     */
    public performLocalDisconnect(targetId: string, reason: DisconnectReason): void {
        const channel = this._channels.get(targetId);
        if (channel) {
            channel.disconnect();
            channel.destroy();
            this._channels.delete(targetId);
        }

        // Stop heartbeat
        const heartbeatManager = this._getHeartbeatManager();
        if (heartbeatManager) {
            heartbeatManager.stop(targetId);
        }

        const previousState = this._targets.get(targetId)?.state ?? ConnectionState.CONNECTED;

        // Mark as disconnected
        this._targets.markDisconnected(targetId);
        this._targets.unregister(targetId);

        // Reject any pending requests for this target
        this._rejectPendingForTarget(targetId, 'Target disconnected');

        // Emit state change
        this._emitter.emitSync(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, {
            targetId,
            previousState,
            currentState: ConnectionState.DISCONNECTED,
            reason,
            timestamp: getTimestamp(),
        });

        // Emit disconnected event
        this._emitter.emitSync(SYSTEM_EVENTS.DISCONNECTED, {
            targetId,
            reason,
            timestamp: getTimestamp(),
        });

        this._logger.info('Disconnected from target', { targetId, reason });
    }

    /**
     * Handle heartbeat failure for a target
     *
     * Called when a heartbeat ping fails or times out. Marks the connection
     * as dead and performs a local disconnect once the configured number of
     * missed heartbeats is reached.
     *
     * @param targetId - Target ID whose heartbeat failed
     */
    public handleHeartbeatFailure(targetId: string, _consecutiveMissed: number): void {
        const consecutiveMissed = this._targets.recordMissedHeartbeat(targetId);

        // Emit heartbeat missed event
        this._emitter.emitSync(SYSTEM_EVENTS.HEARTBEAT_MISSED, {
            targetId,
            consecutiveMissed,
            timestamp: getTimestamp(),
        });

        this._logger.warn('Heartbeat missed', {
            targetId,
            consecutiveMissed,
            maxMissed: this._config.heartbeat.maxMissed,
        });

        // Check if max missed heartbeats reached
        if (consecutiveMissed >= this._config.heartbeat.maxMissed) {
            this._logger.error('Max missed heartbeats reached, marking connection as dead', {
                targetId,
                consecutiveMissed,
            });

            // Emit connection lost event
            this._emitter.emitSync(SYSTEM_EVENTS.CONNECTION_LOST, {
                targetId,
                reason: 'heartbeat_timeout',
                timestamp: getTimestamp(),
            });

            // Perform local disconnect
            this.performLocalDisconnect(targetId, 'heartbeat_timeout');
        }
    }

    /**
     * Send heartbeat ping to a target
     *
     * Called by HeartbeatManager
     *
     * @param targetId - Target ID to ping
     * @param payload - Heartbeat ping payload
     */
    public async sendHeartbeatPing(targetId: string, payload: HeartbeatPingPayload): Promise<void> {
        // Failures propagate to the heartbeat manager's callback
        await this._sendSystemMessage(
            SYSTEM_MESSAGE_TYPES.HEARTBEAT_PING,
            payload,
            targetId,
            this._config.heartbeat.timeout
        );

        // Success - record heartbeat
        this._targets.recordHeartbeat(targetId);
        const heartbeatManager = this._getHeartbeatManager();
        if (heartbeatManager) {
            heartbeatManager.recordSuccess(targetId);
        }
    }

    /**
     * Register handlers for system messages (disconnect, heartbeat)
     */
    private _registerSystemMessageHandlers(): void {
        // Handle disconnect notifications from other side
        this._registry.addHandler(
            SYSTEM_MESSAGE_TYPES.DISCONNECT,
            (payload: DisconnectPayload, respond: (response: unknown) => void) => {
                this._handleDisconnectNotification(payload);
                respond({ acknowledged: true, timestamp: getTimestamp() });
            },
            true // internal
        );

        // Handle heartbeat pings
        this._registry.addHandler(
            SYSTEM_MESSAGE_TYPES.HEARTBEAT_PING,
            (payload: HeartbeatPingPayload, respond: (response: unknown) => void) => {
                const pongPayload: HeartbeatPongPayload = {
                    senderId: this._config.instanceId,
                    timestamp: getTimestamp(),
                    receivedPingAt: payload.timestamp,
                };
                respond(pongPayload);
            },
            true // internal
        );

        // Handle heartbeat pongs (responses)
        this._registry.addHandler(
            SYSTEM_MESSAGE_TYPES.HEARTBEAT_PONG,
            (
                _payload: HeartbeatPongPayload,
                _respond: (response: unknown) => void,
                metadata: MessageMetadata
            ) => {
                // Security: Only record success for the target that actually sent this pong
                // Using metadata.senderId ensures we only reset the heartbeat timer for the sending target
                // This prevents a malicious target from sending pongs to keep all connections marked as "alive"
                const senderId = metadata.senderId;

                const heartbeatManager = this._getHeartbeatManager();
                if (heartbeatManager?.isRunning(senderId)) {
                    heartbeatManager.recordSuccess(senderId);
                    this._targets.recordHeartbeat(senderId);
                }
            },
            true // internal
        );
    }

    /**
     * Handle disconnect notification from other side
     */
    private _handleDisconnectNotification(payload: DisconnectPayload): void {
        this._logger.info('Received disconnect notification', {
            senderId: payload.senderId,
            reason: payload.reason,
        });

        // Find the target that sent this disconnect
        // For now, we look for any connected target (in most cases there's only one)
        for (const target of this._targets.getConnected()) {
            // Perform local disconnect without sending notification back
            this.performLocalDisconnect(target.id, payload.reason);
            break; // Only disconnect one target per notification
        }
    }

    /**
     * Destroy the manager and tear down all channels
     *
     * Disconnects and destroys every channel and unregisters the
     * corresponding targets.
     */
    public destroy(): void {
        // Disconnect all targets
        for (const [id, channel] of this._channels) {
            channel.disconnect();
            channel.destroy();
            this._targets.unregister(id);
        }
        this._channels.clear();
    }
}
