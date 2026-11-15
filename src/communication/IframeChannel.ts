/**
 * @file IframeChannel.ts
 * @description Iframe-specific communication channel for Parley framework
 * @module parley-js/communication
 *
 * Handles bidirectional communication between a parent window and iframes.
 */

import { BaseChannel } from './BaseChannel';
import { HandshakeController, type HandshakeState } from './HandshakeController';
import { Logger } from '../utils/Logger';
import { ConnectionError } from '../errors/ErrorTypes';
import { CONNECTION_ERRORS } from '../errors/ErrorCodes';
import { createMessage, INTERNAL_MESSAGE_TYPES, isResponseMessage } from '../core/MessageProtocol';
import type { ChannelOptions } from '../types/ChannelTypes';

/**
 * Iframe communication channel
 *
 * Manages communication with an iframe from the parent window,
 * or with the parent from within an iframe.
 *
 * Handles:
 * - Connection handshake
 * - Message sending/receiving
 * - Automatic reconnection (if configured)
 *
 * @example
 * ```typescript
 * // Parent window
 * const channel = new IframeChannel({
 *     allowedOrigins: ['https://child.example.com'],
 *     handshakeTimeout: 5000
 * });
 *
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * await channel.connect(iframe);
 * ```
 */
export class IframeChannel extends BaseChannel {
    /**
     * Reference to the target iframe element (when parent)
     */
    private _iframe: HTMLIFrameElement | null = null;

    /**
     * Reference to the parent window (when child)
     */
    private _parentWindow: Window | null = null;

    /**
     * Whether this channel is in the parent or child context
     */
    private _isParent: boolean = true;

    /**
     * Target origin for messages
     */
    private _targetOrigin: string = '';

    /**
     * Handshake state machine
     */
    private readonly _handshake: HandshakeController;

    /**
     * Memoized connection promise to prevent race conditions
     * If connect() is called multiple times, all calls return the same promise
     */
    private _connectPromise: Promise<void> | null = null;

    /**
     * Creates a new IframeChannel instance
     *
     * @param options - Channel configuration options
     * @param logger - Optional logger instance
     */
    constructor(options: ChannelOptions, logger?: Logger) {
        super(options, logger);
        this._logger =
            logger?.child('IframeChannel') ?? new Logger(undefined, '[Parley][IframeChannel]');
        this._handshake = new HandshakeController(this._logger);
    }

    /**
     * Current handshake state
     */
    public get handshakeState(): HandshakeState {
        return this._handshake.state;
    }

    /**
     * Connect to an iframe (from parent) or parent (from iframe)
     *
     * When called with an iframe element, connects as parent.
     * When called with the parent window, connects as child.
     *
     * @param target - Iframe element or parent window
     * @returns Promise that resolves when connected
     * @throws ConnectionError if connection fails
     */
    public async connect(target: HTMLIFrameElement | Window): Promise<void> {
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
     * @param target - Iframe element or parent window
     * @returns Promise that resolves when connected
     * @throws ConnectionError if connection fails
     */
    private async _doConnect(target: HTMLIFrameElement | Window): Promise<void> {
        if (this._state === 'connected') {
            this._logger.warn('Already connected');
            return;
        }

        this._setState('connecting');
        this._setupMessageListener();

        try {
            if (target instanceof HTMLIFrameElement) {
                await this._connectAsParent(target);
            } else if (target === window.parent && target !== window) {
                await this._connectAsChild(target);
            } else {
                throw new ConnectionError(
                    'Invalid target: must be an iframe element or parent window',
                    undefined,
                    CONNECTION_ERRORS.FAILED
                );
            }

            this._setState('connected');
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
        if (this._isParent && this._iframe) {
            return this._iframe.contentWindow;
        }

        if (!this._isParent && this._parentWindow) {
            return this._parentWindow;
        }

        return null;
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
     * Overrides base implementation to handle handshake messages.
     *
     * @param event - The MessageEvent
     */
    protected override _handleMessageEvent(event: MessageEvent): void {
        // Check if from allowed origin
        if (!this._isAllowedOrigin(event.origin)) {
            return;
        }

        // Only our own target window may handshake or talk to this channel
        if (!this._isExpectedSource(event.source)) {
            return;
        }

        const data: unknown = event.data;
        if (!this._isParleyMessage(data)) {
            return;
        }

        // Handle handshake messages
        if (!isResponseMessage(data)) {
            const message = data;

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
     * Connect as parent window to an iframe
     *
     * @param iframe - Target iframe element
     */
    private async _connectAsParent(iframe: HTMLIFrameElement): Promise<void> {
        this._isParent = true;
        this._iframe = iframe;

        // Wait for a same-origin iframe that is still loading, so its origin
        // can be read below. Cross-origin iframes have no accessible
        // contentDocument; if one already finished loading its 'load' event
        // will never fire again, so don't wait - the child re-sends
        // HANDSHAKE_INIT until we acknowledge it.
        const sameOriginDocument = iframe.contentDocument;
        if (sameOriginDocument && sameOriginDocument.readyState !== 'complete') {
            await this._waitForIframeLoad(iframe);
        }

        // Determine target origin - Security: Must be explicitly determined, never use wildcard
        // See: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_considerations
        let origin = '';

        try {
            // Try to get origin from same-origin iframe
            if (iframe.contentWindow?.location?.origin) {
                origin = iframe.contentWindow.location.origin;
            }
        } catch {
            // Cross-origin - cannot directly access location
            // For security, we must require an explicit origin in allowedOrigins config
            // We do NOT trust the src attribute to determine origin
        }

        if (!origin) {
            // Cross-origin iframe: use the first explicitly configured origin,
            // never the (changeable) src attribute. The child's HANDSHAKE_INIT
            // then pins the real origin via event.origin.
            origin = this._configuredTargetOrigin();
            this._logger.debug('Cross-origin iframe: using configured origin', { origin });
        }

        this._targetOrigin = origin;

        // Initiate handshake
        await this._initiateHandshake();
    }

    /**
     * Connect as child iframe to parent window
     *
     * @param parent - Parent window reference
     */
    private async _connectAsChild(parent: Window): Promise<void> {
        this._isParent = false;
        this._parentWindow = parent;

        // Security: Use explicit allowed origin, never use wildcard
        // See: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_considerations
        this._targetOrigin = this._configuredTargetOrigin();

        // Send handshake init to parent
        const initMessage = createMessage({
            type: INTERNAL_MESSAGE_TYPES.HANDSHAKE_INIT,
            payload: { ready: true },
            expectsResponse: false,
        });

        // First send outside the retry loop so configuration errors surface
        // immediately; postMessage delivery is async, so no ACK can arrive
        // before the handshake starts below
        this.send(initMessage, parent, this._targetOrigin);

        const handshake = this._waitForHandshake();
        this._repeatUntilSettled(
            () => {
                this.send(initMessage, parent, this._targetOrigin);
            },
            handshake,
            this._handshakeRetryInterval
        );

        // Wait for handshake acknowledgment
        await handshake;
    }

    /**
     * Wait for iframe to finish loading
     *
     * @param iframe - Iframe element
     */
    private _waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new ConnectionError('Iframe load timeout', undefined, CONNECTION_ERRORS.FAILED)
                );
            }, this._options.handshakeTimeout);

            const onLoad = () => {
                clearTimeout(timeout);
                iframe.removeEventListener('load', onLoad);
                resolve();
            };

            iframe.addEventListener('load', onLoad);

            // Check if already loaded
            if (iframe.contentDocument?.readyState === 'complete') {
                clearTimeout(timeout);
                iframe.removeEventListener('load', onLoad);
                resolve();
            }
        });
    }

    /**
     * Initiate handshake with iframe (parent side)
     */
    private async _initiateHandshake(): Promise<void> {
        await this._waitForHandshake();
    }

    /**
     * Wait for handshake to complete
     */
    private _waitForHandshake(): Promise<void> {
        return this._handshake.start(this._options.handshakeTimeout);
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
        this._handshake.acknowledge();
    }

    /**
     * Handle incoming handshake acknowledgment
     */
    private _handleHandshakeAck(): void {
        this._logger.debug('Received handshake ack');
        this._handshake.acknowledge();
    }

    /**
     * Clean up channel resources
     */
    private _cleanup(): void {
        this._handshake.reset();
        this._teardownMessageListener();
        this._iframe = null;
        this._parentWindow = null;
        this._targetOrigin = '';
        this._connectPromise = null;
    }
}
