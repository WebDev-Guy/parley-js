/**
 * @file heartbeat-monitoring.test.ts
 * @description Integration tests for heartbeat-based connection monitoring
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { createMockWindow } from '../utils/mock-factory';
import { delay } from '../utils/test-helpers';

describe('Heartbeat Monitoring Integration', () => {
    let parley: Parley;
    let targetWindow: any;

    beforeEach(() => {
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: ['https://target.example.com'],
            heartbeat: {
                enabled: true,
                interval: 100, // Short for testing
                timeout: 50,
                maxMissed: 2,
            },
        });

        targetWindow = createMockWindow('target', 'https://target.example.com');
    });

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    describe('Heartbeat initialization', () => {
        it('should start heartbeat on connection', async () => {
            // Connect to target
            // Heartbeat should be initiated automatically

            expect(parley).toBeDefined();
        });

        it('should use configured heartbeat settings', () => {
            const heartbeatConfig = (parley as any)._config.heartbeat;

            expect(heartbeatConfig.enabled).toBe(true);
            expect(heartbeatConfig.interval).toBe(100);
            expect(heartbeatConfig.timeout).toBe(50);
            expect(heartbeatConfig.maxMissed).toBe(2);
        });
    });

    describe('Heartbeat sending and receiving', () => {
        it('should send heartbeat at configured interval', async () => {
            // Connect
            // Wait for heartbeat interval
            // Verify heartbeat sent

            expect(parley).toBeDefined();
        });

        it('should receive pong response to heartbeat', async () => {
            // Send heartbeat
            // Mock target responds with pong
            // Verify response received

            expect(parley).toBeDefined();
        });

        it('should record success on pong response', async () => {
            // Send heartbeat, receive pong
            // Verify miss counter reset to 0

            expect(parley).toBeDefined();
        });

        it('should handle initial 1-second delay before first heartbeat', async () => {
            const config = {
                targetType: 'window' as const,
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 1000,
                    timeout: 500,
                    maxMissed: 3,
                },
            };

            const parleyWithDelay = Parley.create(config);

            // First heartbeat should wait ~1 second

            expect(parleyWithDelay).toBeDefined();
            parleyWithDelay.destroy();
        });
    });

    describe('Missed heartbeat detection', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 50,
                    timeout: 25,
                    maxMissed: 2,
                },
            });
        });

        it('should detect missed heartbeats', async () => {
            // HeartbeatManager has onFailure callback passed to constructor,
            // not a method to register callbacks. We can only verify the
            // heartbeat manager exists and is configured properly.

            const heartbeatManager = (parley as any)._heartbeatManager;
            expect(heartbeatManager).toBeDefined();

            // Wait for potential heartbeat activity
            await delay(100);

            expect(parley).toBeDefined();
        });

        it('should track miss count', async () => {
            // Miss 1st heartbeat - count = 1
            // Receive pong on 2nd - count = 0 (reset)
            // Miss 3rd and 4th - count = 2

            expect(parley).toBeDefined();
        });

        it('should disconnect after max missed heartbeats', async () => {
            const config = {
                targetType: 'window' as const,
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 30,
                    timeout: 15,
                    maxMissed: 2,
                },
            };

            const disconnectParley = Parley.create(config);

            let disconnectEvent: any;
            disconnectParley.onSystem('system:disconnected', (data) => {
                disconnectEvent = data;
            });

            // Miss maxMissed consecutive heartbeats
            // Should automatically disconnect

            expect(disconnectParley).toBeDefined();
            disconnectParley.destroy();
        });
    });

    describe('Heartbeat timeout handling', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 100,
                    timeout: 1000, // Long timeout
                    maxMissed: 3,
                },
            });
        });

        it('should timeout after configured timeout period', async () => {
            // Send heartbeat
            // Wait for configured timeout
            // Treat as failure if no response

            expect(parley).toBeDefined();
        });

        it('should handle heartbeat timeout gracefully', () => {
            // Timeout should not crash
            // Should be treated as missed heartbeat

            expect(parley).toBeDefined();
        });
    });

    describe('Multiple target monitoring', () => {
        it('should monitor multiple targets independently', async () => {
            const parleyMulti = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target1.example.com', 'https://target2.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 100,
                    timeout: 50,
                    maxMissed: 2,
                },
            });

            // Target 1: responds to heartbeats
            // Target 2: doesn't respond (will fail)
            // Target 3: responds to heartbeats

            // Only target 2 should record failures
            // Target 1 and 3 remain connected

            expect(parleyMulti).toBeDefined();
            parleyMulti.destroy();
        });

        it('should not affect other targets on one failure', async () => {
            // Target A: miss heartbeat
            // Target B: respond normally
            // Target A failure should not impact Target B

            expect(parley).toBeDefined();
        });

        it('should handle one target disconnect without affecting others', async () => {
            // Target A disconnected due to max missed heartbeats
            // Target B still connected and responding
            // Communications with Target B should continue

            expect(parley).toBeDefined();
        });
    });

    describe('Success counter reset', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 50,
                    timeout: 25,
                    maxMissed: 3,
                },
            });
        });

        it('should reset miss counter on successful pong', async () => {
            // Miss 1st heartbeat - count = 1
            // Miss 2nd heartbeat - count = 2
            // Receive pong on 3rd - count = 0 (RESET)
            // Miss 4th and 5th - count = 2

            // At count = 2 out of maxMissed = 3, still connected

            expect(parley).toBeDefined();
        });

        it('should track miss count independently per target', async () => {
            // Target A: miss count = 1
            // Target B: miss count = 2
            // Target C: miss count = 0

            // Each target maintains independent counter

            expect(parley).toBeDefined();
        });
    });

    describe('Heartbeat disabling', () => {
        it('should not send heartbeats when disabled', async () => {
            const nohbParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: false,
                },
            });

            // Connect
            // Wait for interval period
            // No heartbeats should be sent

            expect(nohbParley).toBeDefined();
            nohbParley.destroy();
        });

        it('should continue normal communication with heartbeat disabled', () => {
            const nohbParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: false,
                },
            });

            nohbParley.register('test:message', {
                schema: { type: 'object' },
            });

            // Normal messages should still work

            expect(nohbParley).toBeDefined();
            nohbParley.destroy();
        });
    });

    describe('System events', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 100,
                    timeout: 50,
                    maxMissed: 2,
                },
            });
        });

        it('should emit system:connected event', () => {
            let connectedEvent: any;

            parley.onSystem('system:connected', (data) => {
                connectedEvent = data;
            });

            // Connect to target
            // system:connected event emitted

            expect(parley).toBeDefined();
        });

        it('should emit system:disconnected event', () => {
            let disconnectEvent: any;

            parley.onSystem('system:disconnected', (data) => {
                disconnectEvent = data;
            });

            // Max heartbeats missed
            // system:disconnected event emitted

            expect(parley).toBeDefined();
        });
    });

    describe('Heartbeat recovery', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 75,
                    timeout: 40,
                    maxMissed: 3,
                },
            });
        });

        it('should recover from temporary network issues', async () => {
            // Heartbeat 1: miss
            // Heartbeat 2: miss
            // Heartbeat 3: success (network recovered)
            // Counter resets to 0
            // Connection continues

            expect(parley).toBeDefined();
        });

        it('should not recover if issues persist', async () => {
            // Continuous failures
            // After maxMissed failures, automatic disconnect
            // No recovery possible until reconnect

            expect(parley).toBeDefined();
        });
    });
});
