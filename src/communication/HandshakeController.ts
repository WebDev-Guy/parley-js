/**
 * @file HandshakeController.ts
 * @description Explicit state machine for the connection handshake
 * @module parley-js/communication
 *
 * Owns the handshake promise, its timeout, and the state transitions, so
 * channels no longer juggle nullable resolve/reject/timeout triples. Late
 * or duplicate events (e.g. an ACK arriving after the timeout already
 * fired) are ignored explicitly instead of relying on null checks.
 */

import { ConnectionError } from '../errors/ErrorTypes';
import { CONNECTION_ERRORS } from '../errors/ErrorCodes';
import type { Logger } from '../utils/Logger';

/**
 * Handshake lifecycle states
 *
 * - 'idle': no handshake in progress (also the state after reset(),
 *   which rejects any in-flight handshake as cancelled)
 * - 'awaiting-ack': handshake started, waiting for acknowledgment
 * - 'completed': acknowledgment received, handshake succeeded
 * - 'timed-out': no acknowledgment within the timeout window
 * - 'failed': fail() was called while awaiting acknowledgment
 */
export type HandshakeState = 'idle' | 'awaiting-ack' | 'completed' | 'timed-out' | 'failed';

/**
 * Controls a single connection handshake
 *
 * @example
 * ```typescript
 * const handshake = new HandshakeController(logger);
 *
 * // Initiator side
 * const done = handshake.start(5000);
 * sendHandshakeInit();
 * await done; // resolves on acknowledge(), rejects on timeout/fail()
 *
 * // When the ACK message arrives
 * handshake.acknowledge();
 * ```
 */
export class HandshakeController {
    private _state: HandshakeState = 'idle';
    private _resolve: (() => void) | null = null;
    private _reject: ((error: Error) => void) | null = null;
    private _timeout: ReturnType<typeof setTimeout> | null = null;
    private readonly _logger?: Logger;

    constructor(logger?: Logger) {
        this._logger = logger;
    }

    /**
     * Current handshake state
     */
    public get state(): HandshakeState {
        return this._state;
    }

    /**
     * Begin waiting for a handshake acknowledgment
     *
     * @param timeoutMs - Milliseconds to wait before rejecting
     * @returns Promise that resolves on acknowledge() and rejects on
     *          timeout, fail(), or reset()
     */
    public start(timeoutMs: number): Promise<void> {
        if (this._state === 'awaiting-ack') {
            // A handshake is already in flight; cancel it before starting over
            this._logger?.warn('Handshake restarted while one was in progress');
            this.reset();
        }

        this._state = 'awaiting-ack';

        return new Promise<void>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;

            this._timeout = setTimeout(() => {
                if (this._state !== 'awaiting-ack') {
                    return;
                }
                this._state = 'timed-out';
                const rejectHandshake = this._reject;
                this._clear();
                rejectHandshake?.(
                    new ConnectionError(
                        'Handshake timeout',
                        undefined,
                        CONNECTION_ERRORS.HANDSHAKE_FAILED
                    )
                );
            }, timeoutMs);
        });
    }

    /**
     * Complete the handshake successfully
     *
     * Ignored (with a debug log) unless a handshake is awaiting
     * acknowledgment - this makes late or duplicate ACKs explicit no-ops.
     */
    public acknowledge(): void {
        if (this._state !== 'awaiting-ack') {
            this._logger?.debug(`Handshake ack ignored (state: ${this._state})`);
            return;
        }

        this._state = 'completed';
        const resolveHandshake = this._resolve;
        this._clear();
        resolveHandshake?.();
    }

    /**
     * Fail the handshake with a specific error
     *
     * Ignored unless a handshake is awaiting acknowledgment.
     *
     * @param error - Error to reject the handshake promise with
     */
    public fail(error: Error): void {
        if (this._state !== 'awaiting-ack') {
            this._logger?.debug(`Handshake failure ignored (state: ${this._state})`);
            return;
        }

        this._state = 'failed';
        const rejectHandshake = this._reject;
        this._clear();
        rejectHandshake?.(error);
    }

    /**
     * Reset to idle, cancelling any in-flight handshake
     *
     * If a handshake is awaiting acknowledgment its promise is rejected so
     * callers of start() are never left hanging.
     */
    public reset(): void {
        if (this._state === 'awaiting-ack' && this._reject) {
            const rejectHandshake = this._reject;
            this._clear();
            rejectHandshake(
                new ConnectionError(
                    'Handshake cancelled',
                    undefined,
                    CONNECTION_ERRORS.HANDSHAKE_FAILED
                )
            );
        } else {
            this._clear();
        }

        this._state = 'idle';
    }

    /**
     * Clear the timeout and promise callbacks
     */
    private _clear(): void {
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
        this._resolve = null;
        this._reject = null;
    }
}
