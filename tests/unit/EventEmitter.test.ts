/**
 * @file EventEmitter.test.ts
 * @description Unit tests for EventEmitter class
 * @module tests/unit
 *
 * Tests all public methods of the EventEmitter class:
 * - on() - Subscribe to events
 * - once() - One-time subscription
 * - off() - Unsubscribe
 * - emit() - Async event emission
 * - emitSync() - Sync event emission
 * - removeAllListeners() - Clear listeners
 * - listenerCount() - Get listener count
 * - eventNames() - Get all event names
 * - setMaxListeners() - Set max listener limit
 * - getMaxListeners() - Get max listener limit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from '../../src/events/EventEmitter';

describe('EventEmitter', () => {
    let emitter: EventEmitter;

    beforeEach(() => {
        emitter = new EventEmitter();
    });

    afterEach(() => {
        emitter.removeAllListeners();
    });

    // ========================================================================
    // Constructor
    // ========================================================================

    describe('constructor', () => {
        it('should create instance with default max listeners (100)', () => {
            const em = new EventEmitter();
            expect(em.getMaxListeners()).toBe(100);
        });

        it('should create instance with custom max listeners', () => {
            const em = new EventEmitter(50);
            expect(em.getMaxListeners()).toBe(50);
        });

        it('should create instance with zero max listeners (unlimited)', () => {
            const em = new EventEmitter(0);
            expect(em.getMaxListeners()).toBe(0);
        });
    });

    // ========================================================================
    // on() - Subscribe to events
    // ========================================================================

    describe('on()', () => {
        it('should register listener and call it on emit', async () => {
            const handler = vi.fn();
            emitter.on('test', handler);

            await emitter.emit('test', { value: 42 });

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith({ value: 42 });
        });

        it('should call multiple listeners in registration order', async () => {
            const order: number[] = [];
            emitter.on('test', () => order.push(1));
            emitter.on('test', () => order.push(2));
            emitter.on('test', () => order.push(3));

            await emitter.emit('test', null);

            expect(order).toEqual([1, 2, 3]);
        });

        it('should allow same handler to be registered multiple times', async () => {
            const handler = vi.fn();
            emitter.on('test', handler);
            emitter.on('test', handler);

            await emitter.emit('test', 'data');

            expect(handler).toHaveBeenCalledTimes(2);
        });

        it('should return unsubscribe function', async () => {
            const handler = vi.fn();
            const unsubscribe = emitter.on('test', handler);

            await emitter.emit('test', 'first');
            unsubscribe();
            await emitter.emit('test', 'second');

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('first');
        });

        it('should handle events with different names independently', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on('event1', handler1);
            emitter.on('event2', handler2);

            await emitter.emit('event1', 'data1');

            expect(handler1).toHaveBeenCalledWith('data1');
            expect(handler2).not.toHaveBeenCalled();
        });

        it('should handle async handlers', async () => {
            const results: string[] = [];
            emitter.on('test', async (data: string) => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                results.push(data);
            });

            await emitter.emit('test', 'async-data');

            expect(results).toContain('async-data');
        });
    });

    // ========================================================================
    // once() - One-time subscription
    // ========================================================================

    describe('once()', () => {
        it('should only fire listener once', async () => {
            const handler = vi.fn();
            emitter.once('test', handler);

            await emitter.emit('test', 'first');
            await emitter.emit('test', 'second');
            await emitter.emit('test', 'third');

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('first');
        });

        it('should return unsubscribe function that works before first emit', async () => {
            const handler = vi.fn();
            const unsubscribe = emitter.once('test', handler);

            unsubscribe();
            await emitter.emit('test', 'data');

            expect(handler).not.toHaveBeenCalled();
        });

        it('should work alongside regular on() listeners', async () => {
            const onceHandler = vi.fn();
            const onHandler = vi.fn();

            emitter.once('test', onceHandler);
            emitter.on('test', onHandler);

            await emitter.emit('test', 'first');
            await emitter.emit('test', 'second');

            expect(onceHandler).toHaveBeenCalledTimes(1);
            expect(onHandler).toHaveBeenCalledTimes(2);
        });

        it('should handle async once handler', async () => {
            let result = '';
            emitter.once('test', async (data: string) => {
                await new Promise((resolve) => setTimeout(resolve, 5));
                result = data;
            });

            await emitter.emit('test', 'async-once');

            expect(result).toBe('async-once');
        });
    });

    // ========================================================================
    // off() - Unsubscribe
    // ========================================================================

    describe('off()', () => {
        it('should unsubscribe a specific listener', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on('test', handler1);
            emitter.on('test', handler2);

            emitter.off('test', handler1);
            await emitter.emit('test', 'data');

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalledWith('data');
        });

        it('should do nothing when removing non-existent handler', () => {
            const handler = vi.fn();
            expect(() => emitter.off('test', handler)).not.toThrow();
        });

        it('should do nothing when removing from non-existent event', () => {
            const handler = vi.fn();
            expect(() => emitter.off('nonexistent', handler)).not.toThrow();
        });

        it('should only remove first occurrence if handler registered multiple times', async () => {
            const handler = vi.fn();
            emitter.on('test', handler);
            emitter.on('test', handler);

            emitter.off('test', handler);
            await emitter.emit('test', 'data');

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should clean up empty listener arrays', () => {
            const handler = vi.fn();
            emitter.on('test', handler);
            emitter.off('test', handler);

            expect(emitter.eventNames()).not.toContain('test');
        });
    });

    // ========================================================================
    // emit() - Async event emission
    // ========================================================================

    describe('emit()', () => {
        it('should call all listeners with provided data', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on('test', handler1);
            emitter.on('test', handler2);

            await emitter.emit('test', { key: 'value' });

            expect(handler1).toHaveBeenCalledWith({ key: 'value' });
            expect(handler2).toHaveBeenCalledWith({ key: 'value' });
        });

        it('should do nothing when no listeners exist', async () => {
            await expect(emitter.emit('nonexistent', 'data')).resolves.toBeUndefined();
        });

        it('should wait for all async handlers to complete', async () => {
            const results: number[] = [];

            emitter.on('test', async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                results.push(1);
            });
            emitter.on('test', async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                results.push(2);
            });

            await emitter.emit('test', null);

            expect(results).toHaveLength(2);
            expect(results).toContain(1);
            expect(results).toContain(2);
        });

        it('should continue calling other handlers if one throws', async () => {
            const handler1 = vi.fn(() => {
                throw new Error('Handler error');
            });
            const handler2 = vi.fn();

            emitter.on('test', handler1);
            emitter.on('test', handler2);

            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await emitter.emit('test', 'data');

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should pass correct data types', async () => {
            const handler = vi.fn();
            emitter.on('test', handler);

            // Test various data types
            await emitter.emit('test', null);
            await emitter.emit('test', undefined);
            await emitter.emit('test', 42);
            await emitter.emit('test', 'string');
            await emitter.emit('test', [1, 2, 3]);
            await emitter.emit('test', { nested: { value: true } });

            expect(handler).toHaveBeenNthCalledWith(1, null);
            expect(handler).toHaveBeenNthCalledWith(2, undefined);
            expect(handler).toHaveBeenNthCalledWith(3, 42);
            expect(handler).toHaveBeenNthCalledWith(4, 'string');
            expect(handler).toHaveBeenNthCalledWith(5, [1, 2, 3]);
            expect(handler).toHaveBeenNthCalledWith(6, { nested: { value: true } });
        });
    });

    // ========================================================================
    // emitSync() - Synchronous event emission
    // ========================================================================

    describe('emitSync()', () => {
        it('should call all listeners synchronously', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on('test', handler1);
            emitter.on('test', handler2);

            emitter.emitSync('test', 'data');

            expect(handler1).toHaveBeenCalledWith('data');
            expect(handler2).toHaveBeenCalledWith('data');
        });

        it('should not wait for async handlers', () => {
            let asyncCompleted = false;
            emitter.on('test', async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                asyncCompleted = true;
            });

            emitter.emitSync('test', 'data');

            // Async handler should not have completed yet
            expect(asyncCompleted).toBe(false);
        });

        it('should do nothing when no listeners exist', () => {
            expect(() => emitter.emitSync('nonexistent', 'data')).not.toThrow();
        });

        it('should continue calling other handlers if one throws', () => {
            const handler1 = vi.fn(() => {
                throw new Error('Handler error');
            });
            const handler2 = vi.fn();

            emitter.on('test', handler1);
            emitter.on('test', handler2);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            emitter.emitSync('test', 'data');

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should remove once listeners after sync emit', () => {
            const handler = vi.fn();
            emitter.once('test', handler);

            emitter.emitSync('test', 'first');
            emitter.emitSync('test', 'second');

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    // ========================================================================
    // removeAllListeners() - Clear listeners
    // ========================================================================

    describe('removeAllListeners()', () => {
        it('should remove all listeners for a specific event', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            const handler3 = vi.fn();

            emitter.on('event1', handler1);
            emitter.on('event1', handler2);
            emitter.on('event2', handler3);

            emitter.removeAllListeners('event1');

            await emitter.emit('event1', 'data');
            await emitter.emit('event2', 'data');

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
            expect(handler3).toHaveBeenCalledWith('data');
        });

        it('should remove all listeners for all events when no event specified', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on('event1', handler1);
            emitter.on('event2', handler2);

            emitter.removeAllListeners();

            await emitter.emit('event1', 'data');
            await emitter.emit('event2', 'data');

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
        });

        it('should do nothing when removing from non-existent event', () => {
            expect(() => emitter.removeAllListeners('nonexistent')).not.toThrow();
        });

        it('should clear eventNames after removing all listeners', () => {
            emitter.on('event1', vi.fn());
            emitter.on('event2', vi.fn());

            emitter.removeAllListeners();

            expect(emitter.eventNames()).toEqual([]);
        });
    });

    // ========================================================================
    // listenerCount() - Get listener count
    // ========================================================================

    describe('listenerCount()', () => {
        it('should return 0 for events with no listeners', () => {
            expect(emitter.listenerCount('test')).toBe(0);
        });

        it('should return correct count for registered listeners', () => {
            emitter.on('test', vi.fn());
            emitter.on('test', vi.fn());
            emitter.on('test', vi.fn());

            expect(emitter.listenerCount('test')).toBe(3);
        });

        it('should update count when listeners are removed', () => {
            const handler = vi.fn();
            emitter.on('test', handler);
            emitter.on('test', vi.fn());

            expect(emitter.listenerCount('test')).toBe(2);

            emitter.off('test', handler);

            expect(emitter.listenerCount('test')).toBe(1);
        });

        it('should count once listeners', () => {
            emitter.once('test', vi.fn());
            emitter.on('test', vi.fn());

            expect(emitter.listenerCount('test')).toBe(2);
        });

        it('should decrease count after once listener is triggered', async () => {
            emitter.once('test', vi.fn());

            expect(emitter.listenerCount('test')).toBe(1);

            await emitter.emit('test', null);

            expect(emitter.listenerCount('test')).toBe(0);
        });
    });

    // ========================================================================
    // eventNames() - Get all event names
    // ========================================================================

    describe('eventNames()', () => {
        it('should return empty array when no listeners', () => {
            expect(emitter.eventNames()).toEqual([]);
        });

        it('should return all event names with listeners', () => {
            emitter.on('event1', vi.fn());
            emitter.on('event2', vi.fn());
            emitter.on('event3', vi.fn());

            const names = emitter.eventNames();

            expect(names).toHaveLength(3);
            expect(names).toContain('event1');
            expect(names).toContain('event2');
            expect(names).toContain('event3');
        });

        it('should not include events with removed listeners', () => {
            const handler = vi.fn();
            emitter.on('test', handler);

            expect(emitter.eventNames()).toContain('test');

            emitter.off('test', handler);

            expect(emitter.eventNames()).not.toContain('test');
        });

        it('should return unique event names', () => {
            emitter.on('test', vi.fn());
            emitter.on('test', vi.fn());
            emitter.on('test', vi.fn());

            expect(emitter.eventNames()).toEqual(['test']);
        });
    });

    // ========================================================================
    // setMaxListeners() / getMaxListeners() - Max listener limits
    // ========================================================================

    describe('setMaxListeners() / getMaxListeners()', () => {
        it('should set and get max listeners', () => {
            emitter.setMaxListeners(25);
            expect(emitter.getMaxListeners()).toBe(25);
        });

        it('should allow setting to 0 (unlimited)', () => {
            emitter.setMaxListeners(0);
            expect(emitter.getMaxListeners()).toBe(0);
        });

        it('should throw error when exceeding max listeners', () => {
            emitter.setMaxListeners(2);

            emitter.on('test', vi.fn());
            emitter.on('test', vi.fn());

            // Third listener should exceed limit and throw
            expect(() => {
                emitter.on('test', vi.fn());
            }).toThrow(/Max listeners \(2\) exceeded for event "test"/);
        });

        it('should not warn when max listeners is 0 (unlimited)', () => {
            emitter.setMaxListeners(0);

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            // Add many listeners
            for (let i = 0; i < 200; i++) {
                emitter.on('test', vi.fn());
            }

            expect(consoleSpy).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle empty string event names', async () => {
            const handler = vi.fn();
            emitter.on('', handler);

            await emitter.emit('', 'data');

            expect(handler).toHaveBeenCalledWith('data');
        });

        it('should handle special characters in event names', async () => {
            const handler = vi.fn();
            emitter.on('event:with:colons', handler);
            emitter.on('event.with.dots', handler);
            emitter.on('event-with-dashes', handler);

            await emitter.emit('event:with:colons', 1);
            await emitter.emit('event.with.dots', 2);
            await emitter.emit('event-with-dashes', 3);

            expect(handler).toHaveBeenCalledTimes(3);
        });

        it('should handle removing handler during emit', async () => {
            const handler1 = vi.fn();
            let unsubscribe: () => void;
            const handler2 = vi.fn(() => {
                unsubscribe();
            });
            const handler3 = vi.fn();

            unsubscribe = emitter.on('test', handler1);
            emitter.on('test', handler2);
            emitter.on('test', handler3);

            await emitter.emit('test', 'data');

            // All handlers should have been called for this emit
            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
            expect(handler3).toHaveBeenCalled();

            // But handler1 should not be called on next emit
            await emitter.emit('test', 'data2');
            expect(handler1).toHaveBeenCalledTimes(1);
        });

        it('should handle adding handler during emit', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on('test', () => {
                emitter.on('test', handler2);
            });
            emitter.on('test', handler1);

            await emitter.emit('test', 'first');

            // handler2 should NOT be called in the first emit
            // (because we copy listeners before iterating)
            expect(handler2).not.toHaveBeenCalled();

            await emitter.emit('test', 'second');

            // Now handler2 should be called
            expect(handler2).toHaveBeenCalledWith('second');
        });
    });
});
