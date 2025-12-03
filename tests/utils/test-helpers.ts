/**
 * @file test-helpers.ts
 * @description Helper functions for testing Parley components
 * @module tests/utils
 *
 * Provides utility functions for common test scenarios.
 */

import { EventEmitter } from '../../src/events/EventEmitter';

/**
 * Wait for a specific event on an EventEmitter with timeout.
 *
 * @param emitter - EventEmitter to listen on
 * @param eventName - Event name to wait for
 * @param timeout - Max wait time in milliseconds (default: 1000)
 * @returns Promise resolving to the event data
 * @throws Error if timeout exceeded
 *
 * @example
 * ```typescript
 * const data = await waitForEvent(emitter, 'connected', 500);
 * expect(data.targetId).toBe('child');
 * ```
 */
export async function waitForEvent<T = unknown>(
    emitter: EventEmitter,
    eventName: string,
    timeout: number = 1000
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${eventName}`));
        }, timeout);

        emitter.once(eventName, (data: T) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Wait for multiple events on an EventEmitter.
 *
 * @param emitter - EventEmitter to listen on
 * @param eventName - Event name to wait for
 * @param count - Number of events to wait for
 * @param timeout - Max wait time in milliseconds (default: 1000)
 * @returns Promise resolving to array of event data
 *
 * @example
 * ```typescript
 * const events = await waitForEvents(emitter, 'message', 3);
 * expect(events).toHaveLength(3);
 * ```
 */
export async function waitForEvents<T = unknown>(
    emitter: EventEmitter,
    eventName: string,
    count: number,
    timeout: number = 1000
): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const events: T[] = [];
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for ${count} events: ${eventName} (got ${events.length})`));
        }, timeout);

        const handler = (data: T) => {
            events.push(data);
            if (events.length >= count) {
                clearTimeout(timer);
                emitter.off(eventName, handler);
                resolve(events);
            }
        };

        emitter.on(eventName, handler);
    });
}

/**
 * Create a deferred promise for testing async behavior.
 *
 * @returns Object with promise, resolve, and reject functions
 *
 * @example
 * ```typescript
 * const deferred = createDeferred<string>();
 * setTimeout(() => deferred.resolve('done'), 100);
 * const result = await deferred.promise;
 * expect(result).toBe('done');
 * ```
 */
export function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
} {
    let resolve: (value: T) => void;
    let reject: (error: Error) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Wait for a specified amount of time.
 *
 * @param ms - Time to wait in milliseconds
 * @returns Promise that resolves after the specified time
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush pending promises and timers.
 * Useful when using fake timers and need to advance time.
 *
 * @example
 * ```typescript
 * vi.useFakeTimers();
 * someAsyncOperation();
 * await flushPromises();
 * vi.advanceTimersByTime(1000);
 * await flushPromises();
 * ```
 */
export async function flushPromises(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Advance fake timers and flush promises.
 * Combines vi.advanceTimersByTime with flushPromises.
 *
 * @param ms - Time to advance in milliseconds
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
    vi.advanceTimersByTime(ms);
    await flushPromises();
}

/**
 * Create a spy that tracks all calls and can return values.
 *
 * @returns Spy function with tracking capabilities
 */
export function createCallTracker<T extends (...args: unknown[]) => unknown>() {
    const calls: Array<{ args: Parameters<T>; result?: ReturnType<T> }> = [];

    const tracker = vi.fn((...args: Parameters<T>) => {
        const call = { args, result: undefined as ReturnType<T> | undefined };
        calls.push(call);
        return call.result;
    });

    return {
        fn: tracker,
        calls,
        getCall: (index: number) => calls[index],
        getLastCall: () => calls[calls.length - 1],
        reset: () => {
            calls.length = 0;
            tracker.mockClear();
        },
    };
}

/**
 * Assert that a function throws an error with specific properties.
 *
 * @param fn - Function to test
 * @param expectedError - Expected error properties
 */
export function expectError(
    fn: () => unknown,
    expectedError: {
        message?: string | RegExp;
        code?: string;
        name?: string;
    }
): void {
    try {
        fn();
        throw new Error('Expected function to throw');
    } catch (error) {
        if (error instanceof Error) {
            if (expectedError.message) {
                if (typeof expectedError.message === 'string') {
                    expect(error.message).toContain(expectedError.message);
                } else {
                    expect(error.message).toMatch(expectedError.message);
                }
            }
            if (expectedError.name) {
                expect(error.name).toBe(expectedError.name);
            }
            if (expectedError.code && 'code' in error) {
                expect((error as { code: string }).code).toBe(expectedError.code);
            }
        } else {
            throw new Error('Expected Error instance');
        }
    }
}

/**
 * Assert that an async function throws an error.
 *
 * @param fn - Async function to test
 * @param expectedError - Expected error properties
 */
export async function expectAsyncError(
    fn: () => Promise<unknown>,
    expectedError: {
        message?: string | RegExp;
        code?: string;
        name?: string;
    }
): Promise<void> {
    try {
        await fn();
        throw new Error('Expected function to throw');
    } catch (error) {
        if (error instanceof Error && error.message === 'Expected function to throw') {
            throw error;
        }
        if (error instanceof Error) {
            if (expectedError.message) {
                if (typeof expectedError.message === 'string') {
                    expect(error.message).toContain(expectedError.message);
                } else {
                    expect(error.message).toMatch(expectedError.message);
                }
            }
            if (expectedError.name) {
                expect(error.name).toBe(expectedError.name);
            }
            if (expectedError.code && 'code' in error) {
                expect((error as { code: string }).code).toBe(expectedError.code);
            }
        }
    }
}

/**
 * Simulate a network delay for testing timeout scenarios.
 *
 * @param response - Response to return after delay
 * @param delayMs - Delay in milliseconds
 * @returns Promise that resolves with response after delay
 */
export function simulateNetworkDelay<T>(response: T, delayMs: number): Promise<T> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(response), delayMs);
    });
}
