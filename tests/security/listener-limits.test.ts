/**
 * @file listener-limits.test.ts
 * @description Security tests for listener count limits (memory safety)
 * @module tests/security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from '../../src/events/EventEmitter';

describe('Listener Limits (Memory Safety)', () => {
    let emitter: EventEmitter;

    beforeEach(() => {
        emitter = new EventEmitter(10); // maxListeners is a number, not object
    });

    describe('Listener count enforcement', () => {
        it('should reject excess listeners', () => {
            for (let i = 0; i < 10; i++) {
                emitter.on('test:event', () => { });
            }

            // 11th listener should throw
            expect(() => {
                emitter.on('test:event', () => { });
            }).toThrow();
        });

        it('should allow up to configured limit', () => {
            for (let i = 0; i < 10; i++) {
                expect(() => {
                    emitter.on('test:event', () => { });
                }).not.toThrow();
            }
        });

        it('should allow unlimited listeners when set to 0', () => {
            const unlimited = new EventEmitter({ maxListeners: 0 });

            for (let i = 0; i < 500; i++) {
                expect(() => {
                    unlimited.on('test:event', () => { });
                }).not.toThrow();
            }
        });
    });

    describe('Memory leak prevention', () => {
        it('should prevent memory leaks from listener accumulation', () => {
            for (let i = 0; i < 10; i++) {
                emitter.on('test:event', () => { });
            }

            expect(() => {
                emitter.on('test:event', () => { });
            }).toThrow();
        });

        it('should allow listener removal to free slots', () => {
            const handlers = [];
            for (let i = 0; i < 10; i++) {
                const handler = () => { };
                handlers.push(handler);
                emitter.on('test:event', handler);
            }

            // Remove one
            emitter.off('test:event', handlers[0]);

            // Add new one should succeed
            expect(() => {
                emitter.on('test:event', () => { });
            }).not.toThrow();
        });
    });

    describe('Per-event limits', () => {
        it('should enforce limits per event type', () => {
            // Fill event1
            for (let i = 0; i < 10; i++) {
                emitter.on('event1', () => { });
            }

            // event2 should still allow listeners
            expect(() => {
                emitter.on('event2', () => { });
            }).not.toThrow();
        });

        it('should track listeners independently', () => {
            // Each event type has independent count
            for (let i = 0; i < 5; i++) {
                emitter.on('event1', () => { });
                emitter.on('event2', () => { });
            }

            // Both still have room
            expect(() => {
                emitter.on('event1', () => { });
                emitter.on('event2', () => { });
            }).not.toThrow();
        });
    });

    describe('Configuration options', () => {
        it('should use configured maxListeners', () => {
            const custom = new EventEmitter(5); // maxListeners is a number

            for (let i = 0; i < 5; i++) {
                custom.on('test', () => { });
            }

            expect(() => {
                custom.on('test', () => { });
            }).toThrow();
        });

        it('should use default when not specified', () => {
            const defaultEmitter = new EventEmitter();
            // Should have reasonable default (100)
            expect(defaultEmitter).toBeDefined();
            expect(defaultEmitter.getMaxListeners()).toBe(100);
        });
    });

    describe('Error messages', () => {
        it('should provide clear error on limit exceeded', () => {
            for (let i = 0; i < 10; i++) {
                emitter.on('test', () => { });
            }

            try {
                emitter.on('test', () => { });
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.message).toContain('listener');
            }
        });
    });

    describe('Cleanup on removal', () => {
        it('should properly clean up removed listeners', () => {
            const handler = () => { };
            emitter.on('test', handler);
            emitter.off('test', handler);

            // Should be completely removed
            expect(() => {
                emitter.on('test', () => { });
            }).not.toThrow();
        });

        it('should reduce count after removeAll', () => {
            for (let i = 0; i < 10; i++) {
                emitter.on('test', () => { });
            }

            emitter.removeAllListeners('test');

            // Count should be reset
            for (let i = 0; i < 10; i++) {
                expect(() => {
                    emitter.on('test', () => { });
                }).not.toThrow();
            }
        });
    });
});
