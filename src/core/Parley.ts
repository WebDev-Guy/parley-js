/**
 * @file Parley.ts
 * @description Main Parley class - the primary API for inter-window communication
 * @module parley-js/core
 *
 * Provides a type-safe, robust framework for window, tab, and iframe communication.
 * Acts as a facade over the internal ConnectionManager (connection lifecycle)
 * and SendPipeline (outbound message path) collaborators.
 */

import { EventEmitter } from '../events/EventEmitter';
import { Logger } from '../utils/Logger';
import { generateUUID, getTimestamp } from '../utils/Helpers';
import { MessageRegistry } from './MessageRegistry';
import { TargetManager } from './TargetManager';
import { HeartbeatManager } from './HeartbeatManager';
import { ConnectionManager } from './ConnectionManager';
import { SendPipeline } from './SendPipeline';
import {
    createResponse,
    isResponseMessage,
    isInternalMessage,
    type MessageProtocol,
    type ResponseProtocol,
} from './MessageProtocol';
import { SYSTEM_EVENTS, type SystemEventName } from '../events/SystemEvents';
import { ConnectionState } from '../types/ConnectionTypes';
import { ValidationError } from '../errors/ErrorTypes';
import { DefaultSecurityLayer, type SecurityLayer } from '../security/SecurityLayer';
import {
    DEFAULT_HEARTBEAT_CONFIG,
    type ParleyConfig,
    type ResolvedConfig,
    type ResolvedHeartbeatConfig,
} from '../types/ConfigTypes';
import type {
    MessageHandler,
    MessageMetadata,
    MessageRegistrationOptions,
    SendOptions,
} from '../types/MessageTypes';
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
     * Connection lifecycle manager (channels, connect/disconnect, state transitions)
     */
    private _connection: ConnectionManager;

    /**
     * Outbound message pipeline (send/broadcast, pending requests, timeouts)
     */
    private _sendPipeline: SendPipeline;

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

        // Set up the send pipeline (outbound message path)
        this._sendPipeline = new SendPipeline({
            config,
            logger: this._logger,
            emitter: this._emitter,
            registry: this._registry,
            security: this._security,
            targets: this._targets,
            getChannel: (targetId) => this._connection.getChannel(targetId),
            emitAnalyticsEvent: (event) => {
                this._emitAnalyticsEvent(event);
            },
        });

        // Set up the connection manager (connection lifecycle)
        this._connection = new ConnectionManager({
            config,
            logger: this._logger,
            emitter: this._emitter,
            registry: this._registry,
            targets: this._targets,
            getHeartbeatManager: () => this._heartbeatManager,
            onIncomingMessage: (message, source, sourceTargetId) => {
                this._handleIncomingMessage(message, source, sourceTargetId);
            },
            sendSystemMessage: (type, payload, targetId, timeout) =>
                this._sendPipeline.sendSystemMessage(type, payload, targetId, timeout),
            rejectPendingForTarget: (targetId, reason) => {
                this._sendPipeline.rejectPendingForTarget(targetId, reason);
            },
        });

        // Initialize heartbeat manager if enabled
        if (config.heartbeat.enabled) {
            this._heartbeatManager = new HeartbeatManager(
                config.heartbeat,
                this._logger,
                config.instanceId,
                (targetId, payload) => this._connection.sendHeartbeatPing(targetId, payload),
                (targetId, consecutiveMissed) => {
                    this._connection.handleHeartbeatFailure(targetId, consecutiveMissed);
                }
            );
        }

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
        return this._sendPipeline.send<T, R>(messageType, payload, options);
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
        this._sendPipeline.broadcast(messageType, payload);
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
        return this._connection.connect(target, targetId);
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
        return this._connection.disconnect(targetId);
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
        this._connection.destroy();

        // Reject all pending requests
        this._sendPipeline.destroy();

        // Clean up
        this._emitter.destroy();
        this._registry.clear();
        this._targets.destroy();
        this._analyticsHandlers.clear();

        this._logger.info('Parley destroyed');
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
            this._sendPipeline.handleResponse(message, sourceTargetId);
        } else {
            this._handleRequest(message, source, sourceTargetId).catch((error: unknown) => {
                this._logger.error('Error handling incoming message:', error);
            });
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
        const channel = this._connection.getChannel(targetId);

        if (!channel || !targetInfo) {
            this._logger.error('Cannot send response: no channel', { targetId });
            return;
        }

        if (!targetInfo.origin) {
            // BaseChannel.send() rejects wildcard origins, so don't fall back to '*'
            this._logger.error('Cannot send response: target origin not established', {
                targetId,
            });
            return;
        }

        channel.send(response, target, targetInfo.origin);

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
