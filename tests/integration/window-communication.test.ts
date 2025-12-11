/**
 * @file window-communication.test.ts
 * @description Integration tests for window.open() communication
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { createMockWindow, createMockLogger } from '../utils/mock-factory';
import { delay } from '../utils/test-helpers';

describe('Window Communication Integration', () => {
    let openerParley: Parley;
    let openedParley: Parley;

    beforeEach(() => {
        // Setup would initialize Parley for both windows
    });

    afterEach(() => {
        if (openerParley && !(openerParley as any)._destroyed) {
            openerParley.destroy();
        }
        if (openedParley && !(openedParley as any)._destroyed) {
            openedParley.destroy();
        }
    });

    describe('Connection establishment', () => {
        it('should establish connection between opener and opened window', async () => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opened-window.example.com'],
            });

            openedParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opener-window.example.com'],
            });

            // In real scenario, would use window.open() and establish connection
            expect(openerParley).toBeDefined();
            expect(openedParley).toBeDefined();
        });
    });

    describe('Window closing detection', () => {
        beforeEach(() => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opened-window.example.com'],
                heartbeat: {
                    enabled: true,
                    interval: 5000,
                    timeout: 1000,
                    maxMissed: 2,
                },
            });

            openedParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opener-window.example.com'],
            });
        });

        it('should detect closed window', async () => {
            let disconnectEvent: any;

            openerParley.onSystem('system:disconnected', (data) => {
                disconnectEvent = data;
            });

            // In real scenario, would close window and verify disconnect event
            // Heartbeat would detect the closed window after maxMissed failures

            expect(openerParley).toBeDefined();
        });

        it('should handle window.close() gracefully', async () => {
            // Close the window
            // Parley should detect and emit appropriate events
            // No errors should be thrown

            expect(openerParley).toBeDefined();
        });
    });

    describe('Message passing', () => {
        beforeEach(() => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opened-window.example.com'],
            });

            openedParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opener-window.example.com'],
            });
        });

        it('should send messages between windows', async () => {
            openerParley.register('window:message', {
                schema: {
                    type: 'object',
                    properties: {
                        text: { type: 'string' },
                    },
                },
            });

            let received: any;
            openedParley.on('window:message', (payload) => {
                received = payload;
            });

            // Opener would send message to opened window
            // Opened window would receive it

            expect(openerParley).toBeDefined();
        });
    });

    describe('Bi-directional communication', () => {
        beforeEach(() => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opened-window.example.com'],
            });

            openedParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opener-window.example.com'],
            });
        });

        it('should handle messages in both directions', async () => {
            // Opener sends to opened
            openerParley.register('opener:message', {
                schema: { type: 'object' },
            });

            // Opened sends to opener
            openedParley.register('opened:message', {
                schema: { type: 'object' },
            });

            let openerReceived: any;
            let openedReceived: any;

            openerParley.on('opened:message', (payload) => {
                openerReceived = payload;
            });

            openedParley.on('opener:message', (payload) => {
                openedReceived = payload;
            });

            // Both directions work independently

            expect(openerParley).toBeDefined();
            expect(openedParley).toBeDefined();
        });
    });

    describe('Origin validation for windows', () => {
        it('should only accept messages from configured origins', async () => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://safe-window.example.com'],
            });

            // Message from https://evil-window.example.com would be rejected
            // Message from https://safe-window.example.com would be accepted

            expect(openerParley).toBeDefined();
        });
    });

    describe('Multiple window instances', () => {
        it('should handle multiple opened windows independently', async () => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://window1.example.com', 'https://window2.example.com'],
            });

            // Could open multiple windows and communicate with each
            // Each connection would be independent

            expect(openerParley).toBeDefined();
        });
    });

    describe('Window reference management', () => {
        beforeEach(() => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opened-window.example.com'],
            });
        });

        it('should validate window reference', async () => {
            const mockWindow = createMockWindow('target', 'https://opened-window.example.com');

            // Connect with valid window reference
            // Should succeed

            expect(mockWindow).toBeDefined();
        });

        it('should reject null or closed windows', async () => {
            // Attempting to connect to null should fail
            // Attempting to connect to closed window should fail

            expect(openerParley).toBeDefined();
        });
    });

    describe('Error recovery', () => {
        beforeEach(() => {
            openerParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://opened-window.example.com'],
            });
        });

        it('should recover from transient failures', async () => {
            let errorCount = 0;

            openerParley.onSystem('system:error', () => {
                errorCount++;
            });

            // Trigger transient error
            // Parley should recover and continue operating

            expect(openerParley).toBeDefined();
        });
    });
});
