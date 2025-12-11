/**
 * @file Parley.ts
 * @description Main Parley class - the primary API for inter-window communication
 * @module parley-js/core
 *
 * Provides a type-safe, robust framework for window, tab, and iframe communication.
 */

import { EventEmitter } from '../events/EventEmitter';
import { Logger } from '../utils/Logger';
import { generateUUID, getTimestamp } from '../utils/Helpers';
import { IframeChannel } from '../communication/IframeChannel';
import { WindowChannel } from '../communication/WindowChannel';
import type { BaseChannel } from '../communication/BaseChannel';
import { MessageRegistry } from './MessageRegistry';
import { TargetManager } from './TargetManager';
import { HeartbeatManager } from './HeartbeatManager';
import {
    createMessage,
    createResponse,
    isResponseMessage,
    isInternalMessage,
    type MessageProtocol,
    type ResponseProtocol,
} from './MessageProtocol';
import { SYSTEM_EVENTS, type SystemEventName } from '../events/SystemEvents';
import { ConnectionState } from '../types/ConnectionTypes';
import type { DisconnectReason } from '../types/ConnectionTypes';
import {
    ParleyError,
    ValidationError,
    TimeoutError,
    TargetNotFoundError,
    ConnectionError,
} from '../errors/ErrorTypes';
import {
    TIMEOUT_ERRORS,
    TARGET_ERRORS,
    CONNECTION_ERRORS,
    VALIDATION_ERRORS,
} from '../errors/ErrorCodes';
import { DefaultSecurityLayer, type SecurityLayer } from '../security/SecurityLayer';
import {
    DEFAULT_HEARTBEAT_CONFIG,
    type ParleyConfig,
    type ResolvedConfig,
    type ResolvedHeartbeatConfig,
} from '../types/ConfigTypes';
import {
    SYSTEM_MESSAGE_TYPES,
    type MessageHandler,
    type MessageMetadata,
    type MessageRegistrationOptions,
    type SendOptions,
    type PendingRequest,
    type DisconnectPayload,
    type HeartbeatPingPayload,
    type HeartbeatPongPayload,
} from '../types/MessageTypes';
import type { TargetInfo, ChannelOptions } from '../types/ChannelTypes';
import type { AnalyticsEvent, AnalyticsEventHandler } from '../analytics/AnalyticsTypes';

/**
 * Global __VERSION__ declaration for build-time replacement
 */
declare const __VERSION__: string;

/**
 * Main Parley class for inter-window communication
 *
 * Provides a unified API for communicating with iframes and windows.
 *
 * @example
 * ```typescript
 * // Create a Parley instance for iframe communication
 * const parley = Parley.create({
 *     targetType: 'iframe',
 *     timeout: 5000,
 *     allowedOrigins: ['https://example.com']
 * });
 *
 * // Register a message type with schema
 * parley.register('user:update', {
 *     schema: {
 *         type: 'object',
 *         required: ['userId'],
 *         properties: { userId: { type: 'number' } }
 *     }
 * });
 *
 * // Connect to an iframe
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * await parley.connect(iframe, 'my-iframe');
 *
 * // Send a message and wait for response
 * const response = await parley.send('user:update', { userId: 123 });
 *
 * // Listen for incoming messages
 * parley.on('notification', (payload, respond, metadata) => {
 *     console.log('Received notification:', payload);
 *     respond({ received: true });
 * });
 * ```
 */
export class Parley {
    /**
     * Library version
     */
    public static readonly VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0';

    /**
     * Maximum payload size in bytes (10MB)
     * Prevents DoS attacks through extremely large payloads
     * that would cause browser freezes or memory exhaustion
     */
    private readonly MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

    /**
     * Resolved configuration
     */
    private _config: ResolvedConfig;

    /**
     * Internal event emitter for system events
     */
    private _emitter: EventEmitter;

    /**
     * Logger instance
     */
    private _logger: Logger;

    /**
     * Message registry
     */
    private _registry: MessageRegistry;

    /**
     * Target manager
     */
    private _targets: TargetManager;

    /**
     * Communication channels by target ID
     */
    private _channels: Map<string, BaseChannel> = new Map();

    /**
     * Pending requests awaiting responses
     */
    private _pendingRequests: Map<string, PendingRequest> = new Map();

    /**
     * Security layer
     */
    private _security: SecurityLayer;

    /**
     * Analytics event handlers
     */
    private _analyticsHandlers: Set<AnalyticsEventHandler> = new Set();

    /**
     * Heartbeat manager for connection health monitoring
     */
    private _heartbeatManager: HeartbeatManager | null = null;

    /**
     * Rate limit trackers per target/global
     */
    private _rateLimitTrackers: Map<string, { windowStart: number; count: number }> | null = null;

    /**
     * Whether the instance has been destroyed
     */
    private _destroyed: boolean = false;

    /**
     * Private constructor - use Parley.create() instead
     *
     * @param config - Resolved configuration
     */
    private constructor(config: ResolvedConfig) {
        this._config = config;
        this._security = config.securityLayer;
        this._logger = new Logger(config.logLevel, '[Parley]');
        this._emitter = new EventEmitter();
        this._registry = new MessageRegistry(this._logger);
        this._targets = new TargetManager(this._logger);

        // Initialize heartbeat manager if enabled
        if (config.heartbeat.enabled) {
            this._heartbeatManager = new HeartbeatManager(
                config.heartbeat,
                this._logger,
                config.instanceId,
                this._sendHeartbeatPing.bind(this),
                this._handleHeartbeatFailure.bind(this)
            );
        }

        // Register internal system message handlers
        this._registerSystemMessageHandlers();

        this._logger.info('Parley initialized', {
            version: Parley.VERSION,
            instanceId: config.instanceId,
            targetType: config.targetType,
            heartbeatEnabled: config.heartbeat.enabled,
        });
    }

    /**
     * Factory method to create a Parley instance
     *
     * @param config - Configuration options
     * @returns New Parley instance
     *
     * @example
     * ```typescript
     * const parley = Parley.create({
     *     targetType: 'iframe',
     *     timeout: 10000,
     *     allowedOrigins: ['https://example.com']
     * });
     * ```
     */
    public static create(config: ParleyConfig): Parley {
        // Resolve heartbeat configuration
        const heartbeatConfig: ResolvedHeartbeatConfig = {
            enabled: config.heartbeat?.enabled ?? DEFAULT_HEARTBEAT_CONFIG.enabled,
            interval: config.heartbeat?.interval ?? DEFAULT_HEARTBEAT_CONFIG.interval,
            timeout: config.heartbeat?.timeout ?? DEFAULT_HEARTBEAT_CONFIG.timeout,
            maxMissed: config.heartbeat?.maxMissed ?? DEFAULT_HEARTBEAT_CONFIG.maxMissed,
            maxFailures: config.heartbeat?.maxFailures ?? DEFAULT_HEARTBEAT_CONFIG.maxFailures,
        };

        // Resolve configuration with defaults
        const resolvedConfig: ResolvedConfig = {
            targetType: config.targetType,
            timeout: config.timeout ?? 5000,
            retries: config.retries ?? 0,
            allowedOrigins: config.allowedOrigins ?? [
                typeof window !== 'undefined' ? window.location.origin : '',
            ],
            logLevel: config.logLevel ?? 'none',
            analyticsEnabled: config.analyticsEnabled ?? false,
            securityLayer: config.securityLayer ?? new DefaultSecurityLayer(),
            instanceId: config.instanceId ?? `parley_${generateUUID().slice(0, 8)}`,
            heartbeat: heartbeatConfig,
        };

        return new Parley(resolvedConfig);
    }

    /**
     * Get the instance ID
     */
    public get instanceId(): string {
        return this._config.instanceId;
    }

    /**
     * Get the target type
     */
    public get targetType(): 'iframe' | 'window' {
        return this._config.targetType;
    }

    /**
     * Register a message type with optional validation schema
     *
     * @param messageType - Unique message type identifier
     * @param options - Registration options including schema
     *
     * @example
     * ```typescript
     * parley.register('document:save', {
     *     schema: {
     *         type: 'object',
     *         required: ['documentId', 'content'],
     *         properties: {
     *             documentId: { type: 'string' },
     *             content: { type: 'string' }
     *         }
     *     },
     *     timeout: 30000 // 30 second timeout for save operations
     * });
     * ```
     */
    public register(messageType: string, options: MessageRegistrationOptions = {}): void {
        this._assertNotDestroyed();
        this._registry.register(messageType, options);
    }

    /**
     * Send a message to a target
     *
     * @param messageType - Registered message type
     * @param payload - Message payload
     * @param options - Send options
     * @returns Promise that resolves with response if expectsResponse is true,
     *          or undefined if expectsResponse is false
     *
     * @example
     * ```typescript
     * // Send and wait for response
     * const response = await parley.send('user:get', { userId: 123 });
     *
     * // Send to specific target
     * await parley.send('notification', { text: 'Hello' }, {
     *     targetId: 'popup-window',
     *     timeout: 3000
     * });
     *
     * // Fire and forget (no response expected) - returns undefined
     * await parley.send('analytics:track', { event: 'click' }, {
     *     expectsResponse: false
     * });
     * ```
     */
    public async send<T, R = unknown>(
        messageType: string,
        payload: T,
        options?: SendOptions
    ): Promise<R | undefined> {
        this._assertNotDestroyed();

        // Check rate limit before processing
        this._checkRateLimit(options?.targetId);

        const expectsResponse = options?.expectsResponse ?? true;
        const targetId = options?.targetId;

        // Security: Sanitize payload FIRST before validation
        // This ensures that any prototype pollution or injection attempts are removed
        // before we validate against the schema. The sanitized payload is what gets sent.
        const sanitizedPayload = this._security.sanitizePayload(payload);

        // DoS prevention: Validate payload size before further processing
        this._validatePayloadSize(sanitizedPayload);

        // Validate sanitized payload against schema
        this._registry.validatePayload(messageType, sanitizedPayload);

        // Create message
        const message = createMessage({
            type: messageType,
            payload: sanitizedPayload,
            expectsResponse,
            target: targetId,
        });

        // Get target(s) to send to
        const targets = this._getTargetsForSend(targetId);

        if (targets.length === 0) {
            throw new TargetNotFoundError(
                targetId
                    ? `Target "${targetId}" not found or not connected`
                    : 'No connected targets available',
                { targetId },
                TARGET_ERRORS.NOT_CONNECTED
            );
        }

        // Emit analytics event
        this._emitAnalyticsEvent({
            type: 'message_sent',
            messageType,
            messageId: message._id,
            targetId,
            timestamp: message._timestamp,
        });

        // Emit system event
        await this._emitter.emit(SYSTEM_EVENTS.MESSAGE_SENT, {
            messageId: message._id,
            messageType,
            targetId,
            expectsResponse,
            timestamp: message._timestamp,
        });

        // Send message to target(s)
        for (const target of targets) {
            this._sendToTarget(message, target);
        }

        if (!expectsResponse) {
            // Fire and forget: return undefined when no response is expected
            return undefined;
        }

        // Wait for response with timeout and retry
        const timeout =
            options?.timeout ?? this._registry.getTimeout(messageType, this._config.timeout);
        const retries =
            options?.retries ?? this._registry.getRetries(messageType, this._config.retries);

        return this._waitForResponse<R>(message, timeout, retries, targetId);
    }

    /**
     * Broadcast a message to all connected targets
     *
     * @param messageType - Registered message type
     * @param payload - Message payload
     *
     * @example
     * ```typescript
     * // Notify all connected windows/iframes
     * parley.broadcast('state:changed', { version: 42 });
     * ```
     */
    public broadcast<T>(messageType: string, payload: T): void {
        this._assertNotDestroyed();

        // Security: Sanitize payload FIRST before validation
        // This ensures that any prototype pollution or injection attempts are removed
        // before we validate against the schema. The sanitized payload is what gets sent.
        const sanitizedPayload = this._security.sanitizePayload(payload);

        // DoS prevention: Validate payload size before further processing
        this._validatePayloadSize(sanitizedPayload);

        // Validate sanitized payload against schema
        this._registry.validatePayload(messageType, sanitizedPayload);

        // Create message (no response expected for broadcasts)
        const message = createMessage({
            type: messageType,
            payload: sanitizedPayload,
            expectsResponse: false,
        });

        // Send to all connected targets
        const targets = this._targets.getConnected();

        this._logger.debug('Broadcasting message', {
            type: messageType,
            targetCount: targets.length,
        });

        for (const target of targets) {
            this._sendToTarget(message, target);
        }
    }

    /**
     * Listen for incoming messages of a specific type
     *
     * @param messageType - Message type to listen for
     * @param handler - Handler function
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * const unsubscribe = parley.on('user:update', (payload, respond, metadata) => {
     *     console.log('User update:', payload);
     *     console.log('From:', metadata.origin);
     *
     *     // Send response
     *     respond({ success: true, timestamp: Date.now() });
     * });
     *
     * // Later: stop listening
     * unsubscribe();
     * ```
     */
    public on<T>(messageType: string, handler: MessageHandler<T>): () => void {
        this._assertNotDestroyed();
        return this._registry.addHandler(messageType, handler);
    }

    /**
     * Listen for system events
     *
     * @param event - System event name
     * @param handler - Event handler
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * parley.onSystem('system:connected', (data) => {
     *     console.log('Target connected:', data.targetId);
     * });
     *
     * parley.onSystem('system:error', (data) => {
     *     console.error('Error:', data.code, data.message);
     * });
     * ```
     */
    public onSystem(event: SystemEventName, handler: (data: unknown) => void): () => void {
        this._assertNotDestroyed();
        return this._emitter.on(event, handler);
    }

    /**
     * Register an analytics event handler
     *
     * @param handler - Handler function for analytics events
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * parley.onAnalyticsEvent((event) => {
     *     // Send to your analytics service
     *     analytics.track(event.type, {
     *         messageType: event.messageType,
     *         duration: event.duration,
     *         success: event.success
     *     });
     * });
     * ```
     */
    public onAnalyticsEvent(handler: AnalyticsEventHandler): () => void {
        this._assertNotDestroyed();
        this._analyticsHandlers.add(handler);
        return () => {
            this._analyticsHandlers.delete(handler);
        };
    }

    /**
     * Connect to a target (iframe or window)
     *
     * @param target - HTMLIFrameElement or Window to connect to
     * @param targetId - Optional custom identifier for the target
     * @returns Promise that resolves when connected
     *
     * @example
     * ```typescript
     * // Connect to iframe
     * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
     * await parley.connect(iframe, 'my-iframe');
     *
     * // Connect to popup window
     * const popup = window.open('https://example.com/popup', '_blank');
     * await parley.connect(popup, 'popup');
     *
     * // Connect to parent (from iframe)
     * await parley.connect(window.parent, 'parent');
     * ```
     */
    public async connect(target: HTMLIFrameElement | Window, targetId?: string): Promise<void> {
        this._assertNotDestroyed();

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
            this._handleIncomingMessage(message, source, id);
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
            if (this._heartbeatManager) {
                this._heartbeatManager.start(id);
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
     *
     * @example
     * ```typescript
     * await parley.disconnect('my-iframe');
     * ```
     */
    public async disconnect(targetId: string): Promise<void> {
        this._assertNotDestroyed();

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
        if (this._heartbeatManager) {
            this._heartbeatManager.stop(targetId);
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
        this._performLocalDisconnect(targetId, 'manual_disconnect');
    }

    /**
     * Perform local disconnect cleanup without notification
     *
     * @param targetId - Target ID to disconnect
     * @param reason - Reason for disconnection
     */
    private _performLocalDisconnect(targetId: string, reason: DisconnectReason): void {
        const channel = this._channels.get(targetId);
        if (channel) {
            channel.disconnect();
            channel.destroy();
            this._channels.delete(targetId);
        }

        // Stop heartbeat
        if (this._heartbeatManager) {
            this._heartbeatManager.stop(targetId);
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
     * Get all connected target IDs
     *
     * @returns Array of connected target IDs
     */
    public getConnectedTargets(): string[] {
        return this._targets.getConnected().map((t) => t.id);
    }

    /**
     * Check if a target is connected
     *
     * @param targetId - Target ID to check
     * @returns True if connected
     */
    public isConnected(targetId: string): boolean {
        const info = this._targets.get(targetId);
        return info?.connected ?? false;
    }

    /**
     * Destroy the Parley instance and clean up all resources
     *
     * @example
     * ```typescript
     * // Clean up when done
     * parley.destroy();
     * ```
     */
    public destroy(): void {
        if (this._destroyed) {
            return;
        }

        this._destroyed = true;

        // Stop all heartbeats first
        if (this._heartbeatManager) {
            this._heartbeatManager.destroy();
            this._heartbeatManager = null;
        }

        // Disconnect all targets
        for (const [id, channel] of this._channels) {
            channel.disconnect();
            channel.destroy();
            this._targets.unregister(id);
        }
        this._channels.clear();

        // Reject all pending requests
        for (const [_id, pending] of this._pendingRequests) {
            clearTimeout(pending.timeoutHandle);
            pending.reject(
                new ConnectionError(
                    'Parley instance destroyed',
                    undefined,
                    CONNECTION_ERRORS.CLOSED
                )
            );
        }
        this._pendingRequests.clear();

        // Clean up
        this._emitter.removeAllListeners();
        this._registry.clear();
        this._targets.destroy();
        this._analyticsHandlers.clear();

        this._logger.info('Parley destroyed');
    }

    /**
     * Get targets for sending a message
     */
    private _getTargetsForSend(targetId?: string): TargetInfo[] {
        if (targetId) {
            const target = this._targets.get(targetId);
            return target?.connected ? [target] : [];
        }
        return this._targets.getConnected();
    }

    /**
     * Send a message to a specific target
     */
    private _sendToTarget(message: MessageProtocol, target: TargetInfo): void {
        const channel = this._channels.get(target.id);
        if (!channel) {
            this._logger.error('No channel for target', { targetId: target.id });
            return;
        }

        const targetWindow =
            target.type === 'iframe'
                ? (target.target as HTMLIFrameElement).contentWindow
                : (target.target as Window);

        if (!targetWindow) {
            this._logger.error('Target window not available', { targetId: target.id });
            return;
        }

        channel.send(message, targetWindow, target.origin || '*');
        this._logger.debug('Message sent to target', {
            targetId: target.id,
            messageType: message._type,
            messageId: message._id,
        });
    }

    /**
     * Wait for a response to a message
     */
    private _waitForResponse<R>(
        message: MessageProtocol,
        timeout: number,
        retries: number,
        targetId?: string
    ): Promise<R> {
        return new Promise<R>((resolve, reject) => {
            try {
                const resolveUnknown = resolve as (value: unknown) => void;
                const timeoutHandle = setTimeout(() => {
                    this._handleTimeout(
                        message._id,
                        retries,
                        timeout,
                        targetId,
                        resolveUnknown,
                        reject
                    );
                }, timeout);

                const pendingRequest: PendingRequest<R> = {
                    resolve: resolve as (value: unknown) => void,
                    reject,
                    timeoutHandle,
                    timeout,
                    retriesRemaining: retries,
                    messageType: message._type,
                    targetId,
                    sentAt: message._timestamp,
                };

                this._pendingRequests.set(message._id, pendingRequest as PendingRequest);
            } catch (error) {
                // If anything goes wrong during setup, reject the promise
                reject(error);
            }
        });
    }

    /**
     * Handle message timeout
     */
    private _handleTimeout(
        messageId: string,
        retriesRemaining: number,
        timeout: number,
        targetId: string | undefined,
        resolve: (value: unknown) => void,
        reject: (error: Error) => void
    ): void {
        const pending = this._pendingRequests.get(messageId);
        if (!pending) {
            return;
        }

        if (retriesRemaining > 0) {
            // Retry
            this._logger.debug('Retrying message', {
                messageId,
                retriesRemaining: retriesRemaining - 1,
            });

            // Create new timeout
            const timeoutHandle = setTimeout(() => {
                this._handleTimeout(
                    messageId,
                    retriesRemaining - 1,
                    timeout,
                    targetId,
                    resolve,
                    reject
                );
            }, timeout);

            pending.timeoutHandle = timeoutHandle;
            pending.retriesRemaining = retriesRemaining - 1;
        } else {
            // No more retries
            this._pendingRequests.delete(messageId);

            const error = new TimeoutError(
                `Message "${pending.messageType}" timed out after ${timeout}ms`,
                {
                    messageId,
                    timeout,
                    retriesAttempted: pending.retriesRemaining,
                },
                TIMEOUT_ERRORS.NO_RESPONSE
            );

            // Emit events
            this._emitter.emitSync(SYSTEM_EVENTS.TIMEOUT, {
                messageId,
                messageType: pending.messageType,
                targetId,
                timeoutMs: timeout,
                retriesAttempted: pending.retriesRemaining,
                timestamp: getTimestamp(),
            });

            this._emitAnalyticsEvent({
                type: 'timeout',
                messageType: pending.messageType,
                messageId,
                targetId,
                timestamp: getTimestamp(),
                errorCode: TIMEOUT_ERRORS.NO_RESPONSE,
            });

            reject(error);
        }
    }

    /**
     * Handle incoming messages
     */
    private _handleIncomingMessage(
        message: MessageProtocol | ResponseProtocol,
        source: Window,
        sourceTargetId: string
    ): void {
        // Update activity
        this._targets.updateActivity(sourceTargetId);

        if (isResponseMessage(message)) {
            this._handleResponse(message, sourceTargetId);
        } else {
            this._handleRequest(message as MessageProtocol, source, sourceTargetId);
        }
    }

    /**
     * Handle incoming response
     */
    private _handleResponse(response: ResponseProtocol, sourceTargetId: string): void {
        const pending = this._pendingRequests.get(response._requestId);
        if (!pending) {
            this._logger.warn('Received response for unknown request', {
                requestId: response._requestId,
            });
            return;
        }

        // Clear timeout and remove pending request
        clearTimeout(pending.timeoutHandle);
        this._pendingRequests.delete(response._requestId);

        // Calculate duration
        const duration = getTimestamp() - pending.sentAt;

        // Emit events
        this._emitter.emitSync(SYSTEM_EVENTS.RESPONSE_RECEIVED, {
            responseId: response._id,
            requestId: response._requestId,
            success: response.success,
            duration,
            timestamp: getTimestamp(),
        });

        this._emitAnalyticsEvent({
            type: 'response_received',
            messageType: pending.messageType,
            messageId: response._requestId,
            targetId: sourceTargetId,
            timestamp: getTimestamp(),
            duration,
            success: response.success,
        });

        // Resolve or reject
        if (response.success) {
            pending.resolve(response.payload);
        } else {
            const error = new ParleyError(
                response.error?.message ?? 'Request failed',
                (response.error?.code as any) ?? 'ERR_UNKNOWN',
                response.error?.details
            );
            pending.reject(error);
        }
    }

    /**
     * Handle incoming request
     */
    private async _handleRequest(
        message: MessageProtocol,
        source: Window,
        sourceTargetId: string
    ): Promise<void> {
        const isInternal = isInternalMessage(message);

        // For non-internal messages, emit received event and analytics
        if (!isInternal) {
            await this._emitter.emit(SYSTEM_EVENTS.MESSAGE_RECEIVED, {
                messageId: message._id,
                messageType: message._type,
                origin: message._origin,
                timestamp: getTimestamp(),
            });

            this._emitAnalyticsEvent({
                type: 'message_received',
                messageType: message._type,
                messageId: message._id,
                targetId: sourceTargetId,
                timestamp: getTimestamp(),
            });
        }

        // Get handlers for this message type
        const handlers = this._registry.getHandlers(message._type);

        if (handlers.length === 0) {
            // Only warn for non-internal messages
            if (!isInternal) {
                this._logger.warn('No handler for message type', { type: message._type });
            }

            // Send error response if expected
            if (message._expectsResponse) {
                this._sendErrorResponse(message, source, sourceTargetId, {
                    code: 'ERR_NO_HANDLER',
                    message: `No handler registered for message type: ${message._type}`,
                });
            }
            return;
        }

        // Validate payload (skip for internal messages)
        if (!isInternal) {
            try {
                this._registry.validatePayload(message._type, message.payload);
            } catch (error) {
                if (error instanceof ValidationError) {
                    this._logger.warn('Payload validation failed', {
                        type: message._type,
                        errors: error.validationErrors,
                    });

                    if (message._expectsResponse) {
                        this._sendErrorResponse(message, source, sourceTargetId, {
                            code: error.code,
                            message: error.message,
                            details: error.validationErrors,
                        });
                    }
                    return;
                }
                throw error;
            }
        }

        // Create metadata
        const metadata: MessageMetadata = {
            messageId: message._id,
            senderId: sourceTargetId,
            origin: message._origin,
            timestamp: message._timestamp,
            expectsResponse: message._expectsResponse,
        };

        // Track if response was sent using shared object for atomicity
        const responseHandled = { sent: false };

        // Create respond function
        const respond = (responsePayload: unknown): void => {
            if (responseHandled.sent) {
                throw new Error(
                    `Response already sent for message ${message._id}. ` +
                        'Multiple handlers called respond() or respond() called after error.'
                );
            }
            responseHandled.sent = true;

            const response = createResponse({
                requestId: message._id,
                success: true,
                payload: this._security.sanitizePayload(responsePayload),
            });

            this._sendResponse(response, source, sourceTargetId);
        };

        // Call handlers
        for (const handler of handlers) {
            try {
                await handler(message.payload, respond, metadata);
            } catch (error) {
                this._logger.error('Handler error', { type: message._type, error });

                // Emit error event
                this._emitter.emitSync(SYSTEM_EVENTS.ERROR, {
                    code: 'ERR_HANDLER_ERROR',
                    message: error instanceof Error ? error.message : 'Handler error',
                    targetId: sourceTargetId,
                    messageId: message._id,
                    timestamp: getTimestamp(),
                });

                if (message._expectsResponse && !responseHandled.sent) {
                    responseHandled.sent = true;
                    this._sendErrorResponse(message, source, sourceTargetId, {
                        code: 'ERR_HANDLER_ERROR',
                        message: error instanceof Error ? error.message : 'Handler error',
                    });
                }
            }
        }
    }

    /**
     * Send a response
     */
    private _sendResponse(response: ResponseProtocol, target: Window, targetId: string): void {
        const targetInfo = this._targets.get(targetId);
        const channel = this._channels.get(targetId);

        if (!channel || !targetInfo) {
            this._logger.error('Cannot send response: no channel', { targetId });
            return;
        }

        channel.send(response, target, targetInfo.origin || '*');

        // Emit events
        this._emitter.emitSync(SYSTEM_EVENTS.RESPONSE_SENT, {
            responseId: response._id,
            requestId: response._requestId,
            success: response.success,
            timestamp: getTimestamp(),
        });

        this._emitAnalyticsEvent({
            type: 'response_sent',
            messageType: 'response',
            messageId: response._requestId,
            targetId,
            timestamp: getTimestamp(),
            success: response.success,
        });
    }

    /**
     * Send an error response
     */
    private _sendErrorResponse(
        originalMessage: MessageProtocol,
        target: Window,
        targetId: string,
        error: { code: string; message: string; details?: unknown }
    ): void {
        const response = createResponse({
            requestId: originalMessage._id,
            success: false,
            error,
        });

        this._sendResponse(response, target, targetId);
    }

    /**
     * Reject pending requests for a target
     */
    private _rejectPendingForTarget(targetId: string, reason: string): void {
        for (const [id, pending] of this._pendingRequests) {
            if (pending.targetId === targetId) {
                clearTimeout(pending.timeoutHandle);
                pending.reject(new ConnectionError(reason, { targetId }, CONNECTION_ERRORS.CLOSED));
                this._pendingRequests.delete(id);
            }
        }
    }

    /**
     * Emit analytics event
     */
    private _emitAnalyticsEvent(event: AnalyticsEvent): void {
        if (!this._config.analyticsEnabled) {
            return;
        }

        // Convert handlers to promises and run all in parallel
        const promises = Array.from(this._analyticsHandlers).map((handler) =>
            Promise.resolve()
                .then(() => handler(event))
                .catch((error) => {
                    this._logger.error('Analytics handler error:', error);
                    // Don't re-throw - let other handlers continue
                })
        );

        // Use allSettled to wait for all, even if some fail
        Promise.allSettled(promises).catch(() => {
            // Shouldn't happen, but handle just in case
            this._logger.error('Analytics event processing failed');
        });
    }

    /**
     * Assert that instance is not destroyed
     */
    private _assertNotDestroyed(): void {
        if (this._destroyed) {
            throw new Error('Parley instance has been destroyed');
        }
    }

    // ========================================================================
    // Payload Validation Methods
    // ========================================================================

    /**
     * Validate that payload does not exceed maximum size
     * Prevents DoS attacks through extremely large payloads
     *
     * @param payload - Payload to validate
     * @throws ValidationError if payload exceeds maximum size
     */
    private _validatePayloadSize(payload: unknown): void {
        try {
            const serialized = JSON.stringify(payload);
            // JSON.stringify returns undefined for undefined values, skip size check in that case
            if (serialized !== undefined && serialized.length > this.MAX_PAYLOAD_SIZE) {
                throw new ValidationError(
                    `Payload size ${serialized.length} bytes exceeds maximum of ${this.MAX_PAYLOAD_SIZE} bytes (10MB). ` +
                        `This prevents DoS attacks through memory exhaustion and browser freezes.`,
                    {
                        size: serialized.length,
                        maxSize: this.MAX_PAYLOAD_SIZE,
                        rule: 'payloadSize',
                    },
                    VALIDATION_ERRORS.SCHEMA_MISMATCH
                );
            }
        } catch (error) {
            // If it's already a ValidationError from size check, re-throw it
            if (error instanceof ValidationError) {
                throw error;
            }

            // For other errors (like undefined serialization), let them be caught
            // by the schema validator which will provide appropriate error handling
            // This allows the normal error propagation path to continue
        }
    }

    /**
     * Check rate limit for message sending
     *
     * @param targetId - Optional target ID for per-target rate limiting
     * @throws Error if rate limit is exceeded
     */
    private _checkRateLimit(targetId?: string): void {
        if (!this._config.rateLimit?.enabled) {
            return;
        }

        const now = Date.now();
        const window = 1000; // 1 second

        // Track messages per target (or globally if no targetId)
        const key = targetId || '__global__';

        if (!this._rateLimitTrackers) {
            this._rateLimitTrackers = new Map();
        }

        let tracker = this._rateLimitTrackers.get(key);

        if (!tracker || now - tracker.windowStart > window) {
            // New window
            tracker = { windowStart: now, count: 0 };
            this._rateLimitTrackers.set(key, tracker);
        }

        const limit = this._config.rateLimit.messagesPerSecond ?? 100;

        if (tracker.count >= limit) {
            throw new Error(`Rate limit exceeded for ${key}: ` + `${limit} messages/sec max`);
        }

        tracker.count++;
    }

    // ========================================================================
    // Connection Lifecycle & Heartbeat Methods
    // ========================================================================

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

                if (this._heartbeatManager?.isRunning(senderId)) {
                    this._heartbeatManager.recordSuccess(senderId);
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
            this._performLocalDisconnect(target.id, payload.reason);
            break; // Only disconnect one target per notification
        }
    }

    /**
     * Send a system message (internal protocol messages)
     *
     * @param type - System message type
     * @param payload - Message payload
     * @param targetId - Target to send to
     * @param timeout - Timeout in milliseconds
     */
    private async _sendSystemMessage(
        type: string,
        payload: unknown,
        targetId: string,
        timeout: number = 2000
    ): Promise<unknown> {
        const target = this._targets.get(targetId);
        if (!target || !target.connected) {
            throw new ConnectionError(
                `Cannot send system message: target ${targetId} not connected`,
                { targetId },
                CONNECTION_ERRORS.NOT_CONNECTED
            );
        }

        const channel = this._channels.get(targetId);
        if (!channel) {
            throw new ConnectionError(
                `Cannot send system message: no channel for ${targetId}`,
                { targetId },
                CONNECTION_ERRORS.NOT_CONNECTED
            );
        }

        const message = createMessage({
            type,
            payload,
            expectsResponse: true,
            target: targetId,
        });

        const targetWindow =
            target.type === 'iframe'
                ? (target.target as HTMLIFrameElement).contentWindow
                : (target.target as Window);

        if (!targetWindow) {
            throw new ConnectionError(
                `Target window not available for ${targetId}`,
                { targetId },
                CONNECTION_ERRORS.NOT_CONNECTED
            );
        }

        // Send message
        channel.send(message, targetWindow, target.origin || '*');

        // Wait for response with timeout
        return this._waitForResponse(message, timeout, 0, targetId);
    }

    /**
     * Send heartbeat ping to a target
     *
     * Called by HeartbeatManager
     */
    private async _sendHeartbeatPing(
        targetId: string,
        payload: HeartbeatPingPayload
    ): Promise<void> {
        try {
            await this._sendSystemMessage(
                SYSTEM_MESSAGE_TYPES.HEARTBEAT_PING,
                payload,
                targetId,
                this._config.heartbeat.timeout
            );

            // Success - record heartbeat
            this._targets.recordHeartbeat(targetId);
            if (this._heartbeatManager) {
                this._heartbeatManager.recordSuccess(targetId);
            }
        } catch (error) {
            // Let the failure be handled by the heartbeat manager's callback
            throw error;
        }
    }

    /**
     * Handle heartbeat failure for a target
     *
     * Called by HeartbeatManager when heartbeat fails
     */
    private _handleHeartbeatFailure(targetId: string, _consecutiveMissed: number): void {
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
            this._performLocalDisconnect(targetId, 'heartbeat_timeout');
        }
    }

    /**
     * Get connection state for a target
     *
     * @param targetId - Target ID
     * @returns Connection state or undefined if target not found
     */
    public getConnectionState(targetId: string): ConnectionState | undefined {
        const info = this._targets.get(targetId);
        return info?.state;
    }
}
