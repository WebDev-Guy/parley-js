/**
 * @file AnalyticsHooks.test.ts
 * @description Unit tests for the AnalyticsHooks module
 * @module tests/unit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    AnalyticsManager,
    createConsoleAdapter,
    createBatchingAdapter,
    filterByType,
} from '../../src/analytics/AnalyticsHooks';
import type { AnalyticsEvent } from '../../src/analytics/AnalyticsTypes';

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
    return {
        type: 'message_sent',
        messageType: 'test:message',
        messageId: 'test-id',
        timestamp: 0,
        ...overrides,
    } as AnalyticsEvent;
}

describe('createBatchingAdapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not schedule a timer until the first event arrives', () => {
        const flushCallback = vi.fn();
        createBatchingAdapter(flushCallback, { flushInterval: 1000 });

        expect(vi.getTimerCount()).toBe(0);
    });

    it('should flush batched events on the flush interval', () => {
        const flushCallback = vi.fn();
        const adapter = createBatchingAdapter(flushCallback, {
            batchSize: 100,
            flushInterval: 1000,
        });

        adapter.handleEvent(makeEvent());
        adapter.handleEvent(makeEvent());
        expect(flushCallback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(flushCallback).toHaveBeenCalledTimes(1);
        expect(flushCallback).toHaveBeenCalledWith([expect.anything(), expect.anything()]);
    });

    it('should flush immediately when batch size is reached', () => {
        const flushCallback = vi.fn();
        const adapter = createBatchingAdapter(flushCallback, {
            batchSize: 2,
            flushInterval: 60000,
        });

        adapter.handleEvent(makeEvent());
        expect(flushCallback).not.toHaveBeenCalled();

        adapter.handleEvent(makeEvent());
        expect(flushCallback).toHaveBeenCalledTimes(1);
    });

    it('should flush pending events exactly once on destroy', () => {
        const flushCallback = vi.fn();
        const adapter = createBatchingAdapter(flushCallback, {
            batchSize: 100,
            flushInterval: 1000,
        });

        adapter.handleEvent(makeEvent());
        adapter.destroy();

        expect(flushCallback).toHaveBeenCalledTimes(1);

        adapter.destroy();
        expect(flushCallback).toHaveBeenCalledTimes(1);
    });

    it('should leave no timers running after destroy', () => {
        const adapter = createBatchingAdapter(vi.fn(), { flushInterval: 1000 });

        adapter.handleEvent(makeEvent());
        expect(vi.getTimerCount()).toBe(1);

        adapter.destroy();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('should not invoke the flush callback after destroy', () => {
        const flushCallback = vi.fn();
        const adapter = createBatchingAdapter(flushCallback, { flushInterval: 1000 });

        adapter.handleEvent(makeEvent());
        adapter.destroy();
        flushCallback.mockClear();

        vi.advanceTimersByTime(10000);
        expect(flushCallback).not.toHaveBeenCalled();
    });

    it('should ignore events after destroy', () => {
        const flushCallback = vi.fn();
        const adapter = createBatchingAdapter(flushCallback, {
            batchSize: 1,
            flushInterval: 1000,
        });

        adapter.destroy();
        adapter.handleEvent(makeEvent());

        expect(flushCallback).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('AnalyticsManager adapter lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should destroy adapters when they are removed', () => {
        const manager = new AnalyticsManager({ enabled: true });
        const destroySpy = vi.fn();
        manager.addAdapter({ name: 'spy', handleEvent: vi.fn(), destroy: destroySpy });

        manager.removeAdapter('spy');

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(manager.getStats().adapterCount).toBe(0);
    });

    it('should destroy adapters on clear', () => {
        const manager = new AnalyticsManager({ enabled: true });
        const flushCallback = vi.fn();
        const adapter = createBatchingAdapter(flushCallback, { flushInterval: 1000 });
        manager.addAdapter(adapter);

        manager.handleEvent(makeEvent());
        expect(vi.getTimerCount()).toBe(1);

        manager.clear();

        expect(vi.getTimerCount()).toBe(0);
        expect(flushCallback).toHaveBeenCalledTimes(1);
    });

    it('should tolerate adapters without a destroy method', () => {
        const manager = new AnalyticsManager({ enabled: true });
        manager.addAdapter(createConsoleAdapter());

        expect(() => manager.clear()).not.toThrow();
    });

    it('should continue clearing when an adapter destroy throws', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const manager = new AnalyticsManager({ enabled: true });
        const goodDestroy = vi.fn();
        manager.addAdapter({
            name: 'bad',
            handleEvent: vi.fn(),
            destroy: () => {
                throw new Error('destroy failed');
            },
        });
        manager.addAdapter({ name: 'good', handleEvent: vi.fn(), destroy: goodDestroy });

        expect(() => manager.clear()).not.toThrow();
        expect(goodDestroy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });
});

describe('filterByType', () => {
    it('should match only the listed event types', () => {
        const filter = filterByType(['error', 'timeout']);

        expect(filter(makeEvent({ type: 'error', errorCode: 'X' }))).toBe(true);
        expect(filter(makeEvent())).toBe(false);
    });
});
