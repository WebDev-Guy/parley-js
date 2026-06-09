/**
 * @file HandshakeController.test.ts
 * @description Unit tests for the HandshakeController state machine
 * @module tests/unit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HandshakeController } from '../../src/communication/HandshakeController';
import { ConnectionError } from '../../src/errors/ErrorTypes';
import { CONNECTION_ERRORS } from '../../src/errors/ErrorCodes';

describe('HandshakeController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts in the idle state', () => {
        const controller = new HandshakeController();
        expect(controller.state).toBe('idle');
    });

    it('resolves and reaches completed when acknowledged before timeout', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);
        expect(controller.state).toBe('awaiting-ack');

        controller.acknowledge();

        await expect(promise).resolves.toBeUndefined();
        expect(controller.state).toBe('completed');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('rejects with HANDSHAKE_FAILED on timeout', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);
        const assertion = expect(promise).rejects.toMatchObject({
            code: CONNECTION_ERRORS.HANDSHAKE_FAILED,
            message: 'Handshake timeout',
        });

        vi.advanceTimersByTime(5000);

        await assertion;
        expect(controller.state).toBe('timed-out');
    });

    it('ignores a late acknowledgment after timeout', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);
        promise.catch(() => {
            // Rejection handled; this test is about the late ACK
        });

        vi.advanceTimersByTime(5000);
        await vi.runAllTimersAsync();

        // Late ACK must not throw or change state
        expect(() => controller.acknowledge()).not.toThrow();
        expect(controller.state).toBe('timed-out');
    });

    it('ignores a duplicate acknowledgment', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);

        controller.acknowledge();
        controller.acknowledge();

        await expect(promise).resolves.toBeUndefined();
        expect(controller.state).toBe('completed');
    });

    it('rejects with the given error on fail()', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);

        controller.fail(
            new ConnectionError('Target closed', undefined, CONNECTION_ERRORS.CLOSED)
        );

        await expect(promise).rejects.toMatchObject({ code: CONNECTION_ERRORS.CLOSED });
        expect(controller.state).toBe('failed');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('ignores fail() after completion', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);

        controller.acknowledge();
        controller.fail(new Error('too late'));

        await expect(promise).resolves.toBeUndefined();
        expect(controller.state).toBe('completed');
    });

    it('rejects an in-flight handshake on reset() and returns to idle', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);

        const assertion = expect(promise).rejects.toMatchObject({
            code: CONNECTION_ERRORS.HANDSHAKE_FAILED,
            message: 'Handshake cancelled',
        });
        controller.reset();

        await assertion;
        expect(controller.state).toBe('idle');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('allows a fresh handshake after reset()', async () => {
        const controller = new HandshakeController();
        const first = controller.start(5000);
        first.catch(() => {
            // Cancelled by reset below
        });
        controller.reset();

        const second = controller.start(5000);
        controller.acknowledge();

        await expect(second).resolves.toBeUndefined();
        expect(controller.state).toBe('completed');
    });

    it('cancels the previous handshake when start() is called twice', async () => {
        const controller = new HandshakeController();
        const first = controller.start(5000);
        const firstAssertion = expect(first).rejects.toMatchObject({
            message: 'Handshake cancelled',
        });

        const second = controller.start(5000);
        controller.acknowledge();

        await firstAssertion;
        await expect(second).resolves.toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not fire the timeout after acknowledgment', async () => {
        const controller = new HandshakeController();
        const promise = controller.start(5000);

        controller.acknowledge();
        vi.advanceTimersByTime(10000);

        await expect(promise).resolves.toBeUndefined();
        expect(controller.state).toBe('completed');
    });
});
