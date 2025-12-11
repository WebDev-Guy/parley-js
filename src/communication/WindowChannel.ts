/**
 * @file WindowChannel.ts
 * @description Window-specific communication channel for Parley framework
 * @module parley-js/communication
 *
 * Handles bidirectional communication between windows opened via window.open.
 */

import { BaseChannel } from './BaseChannel';
import { Logger } from '../utils/Logger';
import { ConnectionError } from '../errors/ErrorTypes';
import { CONNECTION_ERRORS } from '../errors/ErrorCodes';
import {
    createMessage,
    INTERNAL_MESSAGE_TYPES,
    isResponseMessage,
    type MessageProtocol,
} from '../core/MessageProtocol';
import type { ChannelOptions } from '../types/ChannelTypes';

/**
 * Window communication channel
 *
 * Manages communication between windows opened via window.open().
 * Supports both the opener window and the opened (child) window.
 *
 * @example
 * ```typescript
 * // Opener window
 * const channel = new WindowChannel({
 *     allowedOrigins: ['https://example.com'],
 *     handshakeTimeout: 5000
 * });
 *
 * const popup = window.open('https://example.com/popup', '_blank');
 * await channel.connect(popup);
 * ```
 */
export class WindowChannel extends BaseChannel {
    /**
     * Reference to the target window
     */
    private _targetWindow: Window | null = null;

    /**
     * Whether this is the opener or opened window
     * Reserved for future use in distinguishing opener vs opened behavior
     */
    private _isOpener: boolean = true;

    /**
     * Target origin for messages
     */
    private _targetOrigin: string = '';

    /**
     * Polling interval for checking window state
     */
    private _pollInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Pending handshake promise resolvers
     */
    private _handshakeResolve: (() => void) | null = null;
    private _handshakeReject: ((error: Error) => void) | null = null;
    private _handshakeTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Memoized connection promise to prevent race conditions
     * If connect() is called multiple times, all calls return the same promise
     */
    private _connectPromise: Promise<void> | null = null;

    /**
     * Creates a new WindowChannel instance
     *
     * @param options - Channel configuration options
     * @param logger - Optional logger instance
     */
    constructor(options: ChannelOptions, logger?: Logger) {
        super(options, logger);
        this._logger =
            logger?.child('WindowChannel') ?? new Logger(undefined, '[Parley][WindowChannel]');
    }

    /**
     * Connect to a window
     *
     * @param target - Target window (opened window or window.opener)
     * @returns Promise that resolves when connected
     * @throws ConnectionError if connection fails
     */
    public async connect(target: HTMLIFrameElement | Window): Promise<void> {
        if (target instanceof HTMLIFrameElement) {
            throw new ConnectionError(
                'WindowChannel does not support iframe targets. Use IframeChannel instead.',
                undefined,
                CONNECTION_ERRORS.FAILED
            );
        }

        // Race condition prevention: if already connecting, return the existing promise
        // This ensures that multiple rapid connect() calls all wait for the same connection
        if (this._connectPromise) {
            return this._connectPromise;
        }

        // Create and memoize the connection promise
        this._connectPromise = this._doConnect(target);

        try {
            await this._connectPromise;
        } finally {
            // Clear the memoized promise when complete (success or failure)
            this._connectPromise = null;
        }
    }

    /**
     * Internal connection logic (separated from public connect for memoization)
     *
     * @param target - Target window (opened window or window.opener)
     * @returns Promise that resolves when connected
     * @throws ConnectionError if connection fails
     */
    private async _doConnect(target: Window): Promise<void> {
        if (this._state === 'connected') {
            this._logger.warn('Already connected');
            return;
        }

        this._setState('connecting');
        this._setupMessageListener();

        try {
            // Determine if we're the opener or the opened window
            if (target === window.opener) {
                await this._connectToOpener(target);
            } else {
                await this._connectToOpened(target);
            }

            this._setState('connected');
            this._startWindowPolling();
            this._logger.info('Connected successfully');
        } catch (error) {
            this._setState('error');
            this._cleanup();
            throw error;
        }
    }

    /**
     * Disconnect from the current target
     */
    public disconnect(): void {
        if (this._state === 'disconnected') {
            return;
        }

        this._cleanup();
        this._setState('disconnected');
        this._emitter.emitSync('disconnected', { reason: 'manual' });
        this._logger.info('Disconnected');
    }

    /**
     * Get the target window for sending messages
     *
     * @returns Target window or null
     */
    protected _getTargetWindow(): Window | null {
        return this._targetWindow;
    }

    /**
     * Get the target origin for sending messages
     *
     * @returns Target origin string
     */
    public getTargetOrigin(): string {
        return this._targetOrigin;
    }

    /**
     * Check if this channel is the opener (vs opened window)
     *
     * @returns True if this is the opener window
     */
    public get isOpener(): boolean {
        return this._isOpener;
    }

    /**
     * Check if the target window is still open
     *
     * @returns True if window is open
     */
    public isTargetOpen(): boolean {
        if (!this._targetWindow) {
            return false;
        }

        try {
            return !this._targetWindow.closed;
        } catch {
            return false;
        }
    }

    /**
     * Set up the postMessage event listener
     */
    protected _setupMessageListener(): void {
        if (this._boundMessageHandler) {
            return;
        }

        this._boundMessageHandler = (event: MessageEvent) => {
            this._handleMessageEvent(event);
        };

        window.addEventListener('message', this._boundMessageHandler);
        this._logger.debug('Message listener set up');
    }

    /**
     * Remove the postMessage event listener
     */
    protected _teardownMessageListener(): void {
        if (this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
            this._boundMessageHandler = null;
            this._logger.debug('Message listener removed');
        }
    }

    /**
     * Handle incoming message events
     *
     * @param event - The MessageEvent
     */
    protected override _handleMessageEvent(event: MessageEvent): void {
        // Check if from allowed origin
        if (!this._isAllowedOrigin(event.origin)) {
            return;
        }

        const data = event.data;
        if (!this._isParleyMessage(data)) {
            return;
        }

        // Handle handshake messages
        if (!isResponseMessage(data)) {
            const message = data as MessageProtocol;

            if (message._type === INTERNAL_MESSAGE_TYPES.HANDSHAKE_INIT) {
                this._handleHandshakeInit(event);
                return;
            }

            if (message._type === INTERNAL_MESSAGE_TYPES.HANDSHAKE_ACK) {
                this._handleHandshakeAck();
                return;
            }
        }

        // Pass other messages to the base handler
        super._handleMessageEvent(event);
    }

    /**
     * Connect to the opener window (from opened window)
     *
     * @param opener - Opener window reference
     */
    private async _connectToOpener(opener: Window): Promise<void> {
        this._isOpener = false;
        this._targetWindow = opener;

        // Security: Use explicit allowed origin, never use wildcard
        // See: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_considerations
        if (!this._options.allowedOrigins || this._options.allowedOrigins.length === 0) {
            throw new ConnectionError(
                'Cannot establish window connection to opener: no allowedOrigins configured. ' +
                    'At least one explicit origin must be specified in allowedOrigins array.',
                undefined,
                CONNECTION_ERRORS.FAILED
            );
        }
        this._targetOrigin = this._options.allowedOrigins[0]!;

        // Send handshake init to opener
        const initMessage = createMessage({
            type: INTERNAL_MESSAGE_TYPES.HANDSHAKE_INIT,
            payload: { ready: true },
            expectsResponse: false,
        });

        this.send(initMessage, opener, this._targetOrigin);

        // Wait for handshake acknowledgment
        await this._waitForHandshake();
    }

    /**
     * Connect to an opened window (from opener)
     *
     * @param opened - Opened window reference
     */
    private async _connectToOpened(opened: Window): Promise<void> {
        this._isOpener = true;
        this._targetWindow = opened;

        // Wait for window to be ready
        await this._waitForWindowReady(opened);

        // Security: Determine origin explicitly, never use wildcard
        // See: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_considerations
        let origin = '';

        try {
            // For same-origin windows, we can access location
            origin = opened.location.origin;
        } catch {
            // Cross-origin - cannot directly access location, use allowedOrigins
        }

        if (!origin) {
            // For cross-origin windows, we must use an explicitly configured allowed origin
            if (!this._options.allowedOrigins || this._options.allowedOrigins.length === 0) {
                throw new ConnectionError(
                    'Cannot establish connection to cross-origin window: no allowedOrigins configured. ' +
                        'For cross-origin window.open communication, at least one explicit origin must be specified.',
                    undefined,
                    CONNECTION_ERRORS.FAILED
                );
            }
            origin = this._options.allowedOrigins[0]!;
        }

        this._targetOrigin = origin;

        // Wait for handshake from the opened window
        await this._waitForHandshake();
    }

    /**
     * Wait for opened window to be ready
     *
     * @param targetWindow - Window to wait for
     */
    private _waitForWindowReady(targetWindow: Window): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new ConnectionError('Window ready timeout', undefined, CONNECTION_ERRORS.FAILED)
                );
            }, this._options.handshakeTimeout);

            // Poll for window ready state
            const checkReady = () => {
                try {
                    if (targetWindow.closed) {
                        clearTimeout(timeout);
                        reject(
                            new ConnectionError(
                                'Target window was closed',
                                undefined,
                                CONNECTION_ERRORS.CLOSED
                            )
                        );
                        return;
                    }

                    // Try to access document (will throw if not ready or cross-origin)
                    if (targetWindow.document?.readyState === 'complete') {
                        clearTimeout(timeout);
                        resolve();
                        return;
                    }
                } catch {
                    // Cross-origin or not ready - resolve and let handshake handle it
                    clearTimeout(timeout);
                    resolve();
                    return;
                }

                // Check again
                setTimeout(checkReady, 100);
            };

            checkReady();
        });
    }

    /**
     * Wait for handshake to complete
     */
    private _waitForHandshake(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._handshakeResolve = resolve;
            this._handshakeReject = reject;

            this._handshakeTimeout = setTimeout(() => {
                this._handshakeReject?.(
                    new ConnectionError(
                        'Handshake timeout',
                        undefined,
                        CONNECTION_ERRORS.HANDSHAKE_FAILED
                    )
                );
                this._clearHandshake();
            }, this._options.handshakeTimeout);
        });
    }

    /**
     * Handle incoming handshake init message
     *
     * @param event - Message event containing handshake init
     */
    private _handleHandshakeInit(event: MessageEvent): void {
        this._logger.debug('Received handshake init');

        // Store origin from the handshake
        this._targetOrigin = event.origin;

        // Send acknowledgment
        const ackMessage = createMessage({
            type: INTERNAL_MESSAGE_TYPES.HANDSHAKE_ACK,
            payload: { acknowledged: true },
            expectsResponse: false,
        });

        const source = event.source as Window;
        this.send(ackMessage, source, event.origin);

        // Complete handshake
        this._handshakeResolve?.();
        this._clearHandshake();
    }

    /**
     * Handle incoming handshake acknowledgment
     */
    private _handleHandshakeAck(): void {
        this._logger.debug('Received handshake ack');
        this._handshakeResolve?.();
        this._clearHandshake();
    }

    /**
     * Clear handshake state
     */
    private _clearHandshake(): void {
        if (this._handshakeTimeout) {
            clearTimeout(this._handshakeTimeout);
            this._handshakeTimeout = null;
        }
        this._handshakeResolve = null;
        this._handshakeReject = null;
    }

    /**
     * Start polling for window close
     */
    private _startWindowPolling(): void {
        this._stopWindowPolling();

        this._pollInterval = setInterval(() => {
            if (!this.isTargetOpen()) {
                this._logger.info('Target window closed');
                this._stopWindowPolling();
                this._setState('disconnected');
                this._emitter.emitSync('disconnected', { reason: 'closed' });
            }
        }, 1000);
    }

    /**
     * Stop polling for window close
     */
    private _stopWindowPolling(): void {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    }

    /**
     * Clean up channel resources
     */
    private _cleanup(): void {
        this._clearHandshake();
        this._stopWindowPolling();
        this._teardownMessageListener();
        this._targetWindow = null;
        this._targetOrigin = '';
        this._connectPromise = null;
    }
}
