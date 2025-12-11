/**
 * @file BaseChannel.ts
 * @description Abstract base class for communication channels
 * @module parley-js/communication
 *
 * Provides the common interface and shared functionality for
 * iframe and window communication channels.
 */

import { EventEmitter } from '../events/EventEmitter';
import { Logger } from '../utils/Logger';
import { ConnectionError } from '../errors/ErrorTypes';
import { CONNECTION_ERRORS } from '../errors/ErrorCodes';
import type { MessageProtocol, ResponseProtocol } from '../core/MessageProtocol';
import type { ChannelState, ChannelOptions } from '../types/ChannelTypes';

/**
 * Message event handler type
 */
export type MessageEventHandler = (
    message: MessageProtocol | ResponseProtocol,
    source: Window
) => void;

/**
 * Abstract base class for communication channels
 *
 * Provides common functionality for message sending/receiving,
 * connection lifecycle, and event handling.
 *
 * Subclasses must implement:
 * - _setupMessageListener: Set up the postMessage listener
 * - _teardownMessageListener: Remove the postMessage listener
 * - _getTargetWindow: Get the target window for sending messages
 * - connect: Establish connection with target
 * - disconnect: Close connection with target
 */
export abstract class BaseChannel {
    /**
     * Internal event emitter for channel events
     */
    protected _emitter: EventEmitter;

    /**
     * Logger instance
     */
    protected _logger: Logger;

    /**
     * Current channel state
     */
    protected _state: ChannelState = 'disconnected';

    /**
     * Channel configuration options
     */
    protected _options: ChannelOptions;

    /**
     * Bound message handler for cleanup
     */
    protected _boundMessageHandler: ((event: MessageEvent) => void) | null = null;

    /**
     * Message handler callback
     */
    protected _messageHandler: MessageEventHandler | null = null;

    /**
     * Creates a new BaseChannel instance
     *
     * @param options - Channel configuration options
     * @param logger - Optional logger instance
     */
    constructor(options: ChannelOptions, logger?: Logger) {
        this._options = options;
        this._emitter = new EventEmitter();
        this._logger = logger ?? new Logger();
    }

    /**
     * Get current channel state
     */
    public get state(): ChannelState {
        return this._state;
    }

    /**
     * Check if channel is connected
     */
    public get isConnected(): boolean {
        return this._state === 'connected';
    }

    /**
     * Set the message handler callback
     *
     * @param handler - Handler function for incoming messages
     */
    public setMessageHandler(handler: MessageEventHandler): void {
        this._messageHandler = handler;
    }

    /**
     * Send a message through the channel
     *
     * @param message - Message to send
     * @param targetWindow - Target window to send to
     * @param targetOrigin - Target origin for postMessage
     */
    public send(
        message: MessageProtocol | ResponseProtocol,
        targetWindow: Window,
        targetOrigin: string
    ): void {
        if (!targetWindow) {
            this._logger.error('Cannot send message: target window is null');
            return;
        }

        // Security: Never use '*' as targetOrigin - always require explicit origin validation
        // The file:// protocol results in 'null' origin which is not supported in production.
        // See: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_considerations
        if (targetOrigin === 'null') {
            this._logger.error(
                'Cannot send message: origin is null (file:// protocol). ' +
                    'file:// protocol is not supported. Use a proper http/https server in production.'
            );
            throw new ConnectionError(
                'Cannot send message without explicit target origin. The file:// protocol is not supported. ' +
                    'Please use a proper http/https server for production use.',
                undefined,
                CONNECTION_ERRORS.FAILED
            );
        }

        // Validate that the origin is not a wildcard
        if (targetOrigin === '*') {
            this._logger.error('Cannot send message: targetOrigin cannot be a wildcard');
            throw new ConnectionError(
                'Target origin must be explicitly specified, not a wildcard. ' +
                    'Wildcard origins are a security risk and violate postMessage safety guidelines.',
                undefined,
                CONNECTION_ERRORS.FAILED
            );
        }

        try {
            targetWindow.postMessage(message, targetOrigin);
            this._logger.debug('Message sent', {
                type: '_type' in message ? message._type : 'response',
                id: message._id,
                targetOrigin: targetOrigin,
            });
        } catch (error) {
            this._logger.error('Failed to send message', error);
            throw error;
        }
    }

    /**
     * Subscribe to channel events
     *
     * @param event - Event name
     * @param handler - Event handler
     * @returns Unsubscribe function
     */
    public on(event: string, handler: (data: unknown) => void): () => void {
        return this._emitter.on(event, handler);
    }

    /**
     * Subscribe to a channel event once
     *
     * @param event - Event name
     * @param handler - Event handler
     * @returns Unsubscribe function
     */
    public once(event: string, handler: (data: unknown) => void): () => void {
        return this._emitter.once(event, handler);
    }

    /**
     * Destroy the channel and clean up resources
     */
    public destroy(): void {
        this._teardownMessageListener();
        this._emitter.removeAllListeners();
        this._messageHandler = null;
        this._state = 'disconnected';
        this._logger.debug('Channel destroyed');
    }

    /**
     * Connect to a target
     *
     * @param target - Target to connect to
     */
    public abstract connect(target: HTMLIFrameElement | Window): Promise<void>;

    /**
     * Disconnect from the current target
     */
    public abstract disconnect(): void;

    /**
     * Set up the message event listener
     * Must be implemented by subclasses
     */
    protected abstract _setupMessageListener(): void;

    /**
     * Remove the message event listener
     * Must be implemented by subclasses
     */
    protected abstract _teardownMessageListener(): void;

    /**
     * Get the target window for sending messages
     * Must be implemented by subclasses
     */
    protected abstract _getTargetWindow(): Window | null;

    /**
     * Get the target origin for sending messages
     * Must be implemented by subclasses
     *
     * @returns Target origin string
     */
    public abstract getTargetOrigin(): string;

    /**
     * Handle incoming message events
     *
     * @param event - The MessageEvent from postMessage
     */
    protected _handleMessageEvent(event: MessageEvent): void {
        // Validate origin
        if (!this._isAllowedOrigin(event.origin)) {
            this._logger.warn('Message from disallowed origin blocked', {
                origin: event.origin,
                allowed: this._options.allowedOrigins,
            });
            return;
        }

        // Validate source
        if (!event.source) {
            this._logger.warn('Message with no source blocked');
            return;
        }

        // Check if this is a Parley message
        const data = event.data;
        if (!this._isParleyMessage(data)) {
            // Not a Parley message, ignore silently
            return;
        }

        this._logger.debug('Message received', {
            type: '_type' in data ? data._type : 'response',
            id: data._id,
            origin: event.origin,
        });

        // Pass to message handler if set
        if (this._messageHandler) {
            this._messageHandler(data, event.source as Window);
        }
    }

    /**
     * Check if an origin is in the allowed list
     *
     * @param origin - Origin to check
     * @returns True if allowed
     */
    protected _isAllowedOrigin(origin: string): boolean {
        if (this._options.allowedOrigins.length === 0) {
            return false;
        }

        return this._options.allowedOrigins.some((allowed) => {
            try {
                const normalizedAllowed = new URL(allowed).origin.toLowerCase();
                const normalizedOrigin = origin.toLowerCase();
                return normalizedAllowed === normalizedOrigin;
            } catch {
                return allowed.toLowerCase() === origin.toLowerCase();
            }
        });
    }

    /**
     * Check if data is a Parley message
     *
     * @param data - Data to check
     * @returns True if data is a Parley message
     */
    protected _isParleyMessage(data: unknown): data is MessageProtocol | ResponseProtocol {
        if (data === null || typeof data !== 'object') {
            return false;
        }

        const obj = data as Record<string, unknown>;
        return obj._parley === '__parley__';
    }

    /**
     * Update channel state and emit event
     *
     * @param newState - New state
     */
    protected _setState(newState: ChannelState): void {
        const oldState = this._state;
        this._state = newState;

        if (oldState !== newState) {
            this._emitter.emitSync('stateChange', { from: oldState, to: newState });
            this._logger.debug('Channel state changed', { from: oldState, to: newState });
        }
    }
}
