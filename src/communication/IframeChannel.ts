/**
 * @file IframeChannel.ts
 * @description Iframe-specific communication channel for Parley framework
 * @module parley-js/communication
 *
 * Handles bidirectional communication between a parent window and iframes.
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
     * Pending handshake promise resolvers
     */
    private _handshakeResolve: (() => void) | null = null;
    private _handshakeReject: ((error: Error) => void) | null = null;
    private _handshakeTimeout: ReturnType<typeof setTimeout> | null = null;

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
     * Connect as parent window to an iframe
     *
     * @param iframe - Target iframe element
     */
    private async _connectAsParent(iframe: HTMLIFrameElement): Promise<void> {
        this._isParent = true;
        this._iframe = iframe;

        // Wait for iframe to load
        if (iframe.contentDocument?.readyState !== 'complete') {
            await this._waitForIframeLoad(iframe);
        }

        // Determine target origin
        try {
            // Try to get origin from same-origin iframe
            if (iframe.contentWindow?.location?.origin) {
                this._targetOrigin = iframe.contentWindow.location.origin;
            }
        } catch {
            // Cross-origin iframe - use origin from src attribute
            const src = iframe.src;
            if (src) {
                try {
                    const url = new URL(src);
                    this._targetOrigin = url.origin;
                } catch {
                    throw new ConnectionError(
                        'Cannot determine iframe origin',
                        undefined,
                        CONNECTION_ERRORS.FAILED
                    );
                }
            }
        }

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
        this._targetOrigin = this._options.allowedOrigins[0] ?? '*';

        // Send handshake init to parent
        const initMessage = createMessage({
            type: INTERNAL_MESSAGE_TYPES.HANDSHAKE_INIT,
            payload: { ready: true },
            expectsResponse: false,
        });

        this.send(initMessage, parent, this._targetOrigin);

        // Wait for handshake acknowledgment
        await this._waitForHandshake();
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
     * Clean up channel resources
     */
    private _cleanup(): void {
        this._clearHandshake();
        this._teardownMessageListener();
        this._iframe = null;
        this._parentWindow = null;
        this._targetOrigin = '';
    }
}
