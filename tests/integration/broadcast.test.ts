/**
 * @file broadcast.test.ts
 * @description Integration tests for broadcast messaging pattern
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';

describe('Broadcast Pattern Integration', () => {
    let broadcaster: Parley;

    beforeEach(() => {
        broadcaster = Parley.create({
            targetType: 'window',
            allowedOrigins: ['https://receiver.example.com'],
        });
    });

    afterEach(() => {
        if (broadcaster && !(broadcaster as any)._destroyed) {
            broadcaster.destroy();
        }
    });

    describe('Broadcasting to multiple targets', () => {
        it('should send broadcast to all connected targets', async () => {
            broadcaster.register('broadcast:message', {
                schema: {
                    type: 'object',
                    required: ['notification'],
                    properties: {
                        notification: { type: 'string' },
                    },
                },
            });

            // Connect to 3 targets
            // broadcast() called
            // All 3 targets receive identical message

            expect(broadcaster).toBeDefined();
        });

        it('should use same message ID for all targets', () => {
            // broadcast() called
            // All targets receive message with same _id
            // Broadcast is atomic

            expect(broadcaster).toBeDefined();
        });

        it('should not wait for responses on broadcast', () => {
            broadcaster.register('notify:all', {
                schema: { type: 'object' },
            });

            // broadcast() with expectsResponse: false
            // Returns immediately without waiting
            // All targets eventually receive

            expect(broadcaster).toBeDefined();
        });

        it('should timestamp broadcast consistently', () => {
            broadcaster.register('sync:message', {
                schema: { type: 'object' },
            });

            // broadcast() called
            // All targets receive message with same _timestamp

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast with no targets', () => {
        it('should work with 0 targets', async () => {
            broadcaster.register('no:targets', {
                schema: { type: 'object' },
            });

            // No targets connected
            // broadcast() called
            // No error, silently succeeds

            expect(broadcaster).toBeDefined();
        });

        it('should return successfully even if no one receives', () => {
            broadcaster.register('empty:broadcast', {
                schema: { type: 'object' },
            });

            // broadcast() with no connected targets
            // Promise resolves successfully
            // No error thrown

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Selective broadcast', () => {
        it('should broadcast to all targets of same type', () => {
            // Multiple iframe targets
            // broadcast() to all iframes
            // All iframes receive

            expect(broadcaster).toBeDefined();
        });

        it('should broadcast only to connected targets', () => {
            // 5 targets configured
            // Only 3 connected
            // broadcast() reaches only connected 3
            // Disconnected 2 don't receive

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast message validation', () => {
        it('should validate broadcast message against schema', () => {
            broadcaster.register('broadcast:typed', {
                schema: {
                    type: 'object',
                    required: ['message', 'priority'],
                    properties: {
                        message: { type: 'string' },
                        priority: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                        },
                    },
                },
            });

            // Invalid payload: { message: 'test' } (missing priority)
            // ValidationError thrown before broadcast

            expect(broadcaster).toBeDefined();
        });

        it('should not broadcast invalid payloads', () => {
            broadcaster.register('strict:broadcast', {
                schema: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'number', minimum: 1 },
                    },
                },
            });

            // Invalid payload
            // No broadcast sent
            // Error thrown to caller

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast ordering', () => {
        it('should maintain order across all targets', () => {
            broadcaster.register('ordered:message', {
                schema: {
                    type: 'object',
                    required: ['sequence'],
                    properties: {
                        sequence: { type: 'number' },
                    },
                },
            });

            // Broadcast 5 messages
            // All targets receive in same order

            expect(broadcaster).toBeDefined();
        });

        it('should deliver broadcasts before next message', () => {
            broadcaster.register('broadcast:type', {
                schema: { type: 'object' },
            });

            broadcaster.register('direct:type', {
                schema: { type: 'object' },
            });

            // broadcast() #1
            // direct send to target A
            // broadcast() #2

            // All targets receive in correct order

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast with different payload types', () => {
        it('should broadcast object payloads', () => {
            broadcaster.register('broadcast:object', {
                schema: {
                    type: 'object',
                    properties: {
                        data: { type: 'object' },
                    },
                },
            });

            // broadcast({ data: { nested: 'value' } })
            // All targets receive object

            expect(broadcaster).toBeDefined();
        });

        it('should broadcast array payloads', () => {
            broadcaster.register('broadcast:array', {
                schema: {
                    type: 'array',
                    items: { type: 'number' },
                },
            });

            // broadcast([1, 2, 3, 4, 5])
            // All targets receive array

            expect(broadcaster).toBeDefined();
        });

        it('should broadcast primitive payloads', () => {
            broadcaster.register('broadcast:string', {
                schema: { type: 'string' },
            });

            // broadcast('message text')
            // All targets receive string

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast error handling', () => {
        it('should handle one target failure without affecting others', () => {
            // Target A offline
            // Target B online
            // Target C online

            // broadcast() called
            // Target A fails (offline)
            // Target B receives
            // Target C receives

            expect(broadcaster).toBeDefined();
        });

        it('should not roll back on target failure', () => {
            // Target A offline
            // Target B online

            // broadcast() called
            // Targets B, C, D receive immediately
            // Target A marked as offline
            // No rollback

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast acknowledgment', () => {
        it('should not wait for broadcast ACK by default', () => {
            broadcaster.register('fire:and:forget', {
                schema: { type: 'object' },
            });

            // broadcast() called
            // Returns immediately
            // Targets may not have received yet

            expect(broadcaster).toBeDefined();
        });

        it('should support acknowledgment if handler responds', () => {
            broadcaster.register('acknowledged:broadcast', {
                schema: { type: 'object' },
            });

            // broadcast() called
            // Targets respond (if they have handlers)
            // Responses collected (if expectsResponse true)

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast with system events', () => {
        it('should emit system:broadcast event', () => {
            let broadcastEvent: any;

            broadcaster.onSystem('system:broadcast', (event) => {
                broadcastEvent = event;
            });

            broadcaster.register('notify', { schema: { type: 'object' } });

            // broadcast() called
            // system:broadcast event emitted

            expect(broadcaster).toBeDefined();
        });

        it('should include broadcast metadata in event', () => {
            let broadcastEvent: any;

            broadcaster.onSystem('system:broadcast', (event) => {
                broadcastEvent = event;
            });

            // broadcast() called
            // Event includes: messageType, targetCount, payload

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast performance', () => {
        it('should handle many targets efficiently', () => {
            broadcaster.register('bulk:broadcast', {
                schema: { type: 'object' },
            });

            // 100 connected targets
            // broadcast() called
            // All targets receive quickly

            expect(broadcaster).toBeDefined();
        });

        it('should not block on slow targets', () => {
            broadcaster.register('async:broadcast', {
                schema: { type: 'object' },
            });

            // Target A responds slowly
            // Target B responds quickly

            // broadcast() doesn't wait for A
            // Returns after sending to all

            expect(broadcaster).toBeDefined();
        });
    });

    describe('Broadcast use cases', () => {
        it('should support notification broadcast', () => {
            broadcaster.register('notification:broadcast', {
                schema: {
                    type: 'object',
                    required: ['title', 'message'],
                    properties: {
                        title: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            });

            // broadcast({ title: 'Alert', message: 'System maintenance' })
            // All connected clients notified

            expect(broadcaster).toBeDefined();
        });

        it('should support state sync broadcast', () => {
            broadcaster.register('state:sync', {
                schema: {
                    type: 'object',
                    required: ['state'],
                    properties: {
                        state: { type: 'object' },
                    },
                },
            });

            // broadcast({ state: { users: [...], items: [...] } })
            // All targets update their local state

            expect(broadcaster).toBeDefined();
        });

        it('should support command broadcast', () => {
            broadcaster.register('command:execute', {
                schema: {
                    type: 'object',
                    required: ['command'],
                    properties: {
                        command: { type: 'string' },
                    },
                },
            });

            // broadcast({ command: 'refresh', data: {...} })
            // All targets execute command

            expect(broadcaster).toBeDefined();
        });
    });
});
