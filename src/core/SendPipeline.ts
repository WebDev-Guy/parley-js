/**
 * @file SendPipeline.ts
 * @description Outbound message pipeline for the Parley framework
 * @module parley-js/core
 *
 * Internal collaborator of Parley that owns the send path: payload
 * sanitization and validation, rate limiting, dispatching messages to
 * targets, response correlation, and timeout/retry handling for pending
 * requests.
 */

import { EventEmitter } from '../events/EventEmitter';
import { Logger } from '../utils/Logger';
import { getTimestamp } from '../utils/Helpers';
import type { BaseChannel } from '../communication/BaseChannel';
import { MessageRegistry } from './MessageRegistry';
import { TargetManager } from './TargetManager';
import { createMessage, type MessageProtocol, type ResponseProtocol } from './MessageProtocol';
import { SYSTEM_EVENTS } from '../events/SystemEvents';
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
    type ErrorCode,
} from '../errors/ErrorCodes';
import type { SecurityLayer } from '../security/SecurityLayer';
import type { ResolvedConfig } from '../types/ConfigTypes';
import type { SendOptions, PendingRequest } from '../types/MessageTypes';
import type { TargetInfo } from '../types/ChannelTypes';
import type { AnalyticsEvent } from '../analytics/AnalyticsTypes';

/**
 * Dependencies required by the SendPipeline
 *
 * Narrow callbacks are used instead of a reference back to Parley to keep
 * the coupling between the collaborators minimal.
 */
export interface SendPipelineDependencies {
    /** Resolved Parley configuration */
    config: ResolvedConfig;

    /** Logger instance */
    logger: Logger;

    /** Internal event emitter for system events */
    emitter: EventEmitter;

    /** Message registry for payload validation, timeouts, and retries */
    registry: MessageRegistry;

    /** Security layer for payload sanitization */
    security: SecurityLayer;

    /** Target manager for target lookup */
    targets: TargetManager;

    /** Accessor for the communication channel of a target */
    getChannel: (targetId: string) => BaseChannel | undefined;

    /** Callback to emit analytics events */
    emitAnalyticsEvent: (event: AnalyticsEvent) => void;
}

/**
 * Outbound message pipeline for Parley
 *
 * Provides:
 * - send() and broadcast() message dispatch
 * - System message sending (internal protocol messages)
 * - Pending request tracking and response correlation
 * - Timeout and retry handling
 * - Rate limiting and payload size validation
 *
 * This class is internal to the framework and is not exported from the
 * package entry point.
 */
export class SendPipeline {
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
     * Security layer
     */
    private _security: SecurityLayer;

    /**
     * Target manager
     */
    private _targets: TargetManager;

    /**
     * Accessor for a target's communication channel
     */
    private _getChannel: (targetId: string) => BaseChannel | undefined;

    /**
     * Callback to emit analytics events
     */
    private _emitAnalyticsEvent: (event: AnalyticsEvent) => void;

    /**
     * Pending requests awaiting responses
     */
    private _pendingRequests: Map<string, PendingRequest> = new Map();

    /**
     * Rate limit trackers per target/global
     */
    private _rateLimitTrackers: Map<string, { windowStart: number; count: number }> | null = null;

    /**
     * Creates a new SendPipeline instance
     *
     * @param deps - Dependencies (config, logger, emitter, registry, security, targets, and callbacks)
     */
    constructor(deps: SendPipelineDependencies) {
        this._config = deps.config;
        this._logger = deps.logger;
        this._emitter = deps.emitter;
        this._registry = deps.registry;
        this._security = deps.security;
        this._targets = deps.targets;
        this._getChannel = deps.getChannel;
        this._emitAnalyticsEvent = deps.emitAnalyticsEvent;
    }

    /**
     * Send a message to a target
     *
     * @param messageType - Registered message type
     * @param payload - Message payload
     * @param options - Send options
     * @returns Promise that resolves with response if expectsResponse is true,
     *          or undefined if expectsResponse is false
     */
    public async send<T, R = unknown>(
        messageType: string,
        payload: T,
        options?: SendOptions
    ): Promise<R | undefined> {
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
     */
    public broadcast<T>(messageType: string, payload: T): void {
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
     * Send a system message (internal protocol messages)
     *
     * @param type - System message type
     * @param payload - Message payload
     * @param targetId - Target to send to
     * @param timeout - Timeout in milliseconds
     */
    public async sendSystemMessage(
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

        const channel = this._getChannel(targetId);
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
     * Handle an incoming response and correlate it with its pending request
     *
     * @param response - Response message received from a target
     * @param sourceTargetId - ID of the target that sent the response
     */
    public handleResponse(response: ResponseProtocol, sourceTargetId: string): void {
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
                (response.error?.code as ErrorCode | undefined) ?? 'ERR_UNKNOWN',
                response.error?.details
            );
            pending.reject(error);
        }
    }

    /**
     * Reject pending requests for a target
     *
     * @param targetId - Target ID whose pending requests should be rejected
     * @param reason - Reason for rejection
     */
    public rejectPendingForTarget(targetId: string, reason: string): void {
        for (const [id, pending] of this._pendingRequests) {
            if (pending.targetId === targetId) {
                clearTimeout(pending.timeoutHandle);
                pending.reject(new ConnectionError(reason, { targetId }, CONNECTION_ERRORS.CLOSED));
                this._pendingRequests.delete(id);
            }
        }
    }

    /**
     * Destroy the pipeline and reject all pending requests
     */
    public destroy(): void {
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
        const channel = this._getChannel(target.id);
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
                    resolve,
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
                reject(error instanceof Error ? error : new Error(String(error)));
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
}
