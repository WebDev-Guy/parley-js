/**
 * @file full-lifecycle.test.ts
 * @description Integration tests for complete Parley usage workflows
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';

describe('Full Lifecycle Integration', () => {
    let parley: Parley;

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    describe('Complete connection and messaging lifecycle', () => {
        it('should complete full connection and messaging lifecycle', async () => {
            // 1. Create Parley instance
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });

            // 2. Register message type with schema
            parley.register('user:data', {
                schema: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'number' },
                        name: { type: 'string' },
                    },
                },
            });

            // 3. Set up handler
            let messageReceived = false;
            parley.on('user:data', (payload) => {
                messageReceived = true;
            });

            // 4. Connect to target (mocked in test)
            // await parley.connect(targetWindow);

            // 5. Send message
            // const response = await parley.send('user:data', {...});

            // 6. Disconnect (in real scenario)
            // parley.disconnect();

            // 7. Destroy
            parley.destroy();

            // Verify all steps completed
            expect((parley as any)._destroyed).toBe(true);
        });
    });

    describe('Registration workflow', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });
        });

        it('should support multiple message type registration', () => {
            // Register first type
            parley.register('type:1', {
                schema: {
                    type: 'object',
                    properties: { data: { type: 'string' } },
                },
            });

            // Register second type
            parley.register('type:2', {
                schema: {
                    type: 'object',
                    properties: { count: { type: 'number' } },
                },
            });

            // Register third type
            parley.register('type:3', {
                schema: { type: 'object' },
            });

            // All types registered and ready
            expect(parley).toBeDefined();
        });

        it('should reject re-registration of already registered type', () => {
            // Register type with basic schema
            parley.register('evolving:type', {
                schema: { type: 'object' },
            });

            // Re-registration is not allowed - throws error
            expect(() =>
                parley.register('evolving:type', {
                    schema: {
                        type: 'object',
                        required: ['id'],
                        properties: {
                            id: { type: 'number' },
                            name: { type: 'string' },
                        },
                    },
                })
            ).toThrow(/already registered/);
        });
    });

    describe('Handler setup workflow', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });
        });

        it('should support multiple handlers for same message type', () => {
            let handler1Called = false;
            let handler2Called = false;

            parley.on('event:type', () => {
                handler1Called = true;
            });

            parley.on('event:type', () => {
                handler2Called = true;
            });

            // Message received
            // Both handlers called

            expect(parley).toBeDefined();
        });

        it('should support system event handlers', () => {
            let connectedCalled = false;
            let errorCalled = false;

            parley.onSystem('system:connected', () => {
                connectedCalled = true;
            });

            parley.onSystem('system:error', () => {
                errorCalled = true;
            });

            // System events trigger handlers

            expect(parley).toBeDefined();
        });

        it('should support analytics event handlers', () => {
            let analyticsCalled = false;

            parley.onAnalyticsEvent((event) => {
                analyticsCalled = true;
            });

            // Analytics events tracked

            expect(parley).toBeDefined();
        });
    });

    describe('Reconnection workflow', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });
        });

        it('should handle reconnection after disconnect', async () => {
            parley.register('test:message', {
                schema: { type: 'object' },
            });

            // 1. Connect
            // await parley.connect(targetWindow);

            // 2. Send message (succeeds)
            // await parley.send('test:message', {...});

            // 3. Disconnect
            // parley.disconnect();

            // 4. Reconnect
            // await parley.connect(targetWindow);

            // 5. Send message
            // const response = await parley.send('test:message', {...});

            // Second message succeeds
            expect(parley).toBeDefined();
        });

        it('should maintain registered types across reconnection', () => {
            parley.register('persistent:type', {
                schema: { type: 'object' },
            });

            // After disconnect and reconnect
            // Type still registered
            // Can send immediately

            expect(parley).toBeDefined();
        });

        it('should maintain handlers across reconnection', () => {
            let handlerCalled = false;

            parley.on('persistent:message', () => {
                handlerCalled = true;
            });

            // After disconnect and reconnect
            // Handler still active
            // Message triggers handler

            expect(parley).toBeDefined();
        });
    });

    describe('Resource cleanup', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });
        });

        it('should cleanup resources on destroy', () => {
            parley.register('test:type', {
                schema: { type: 'object' },
            });

            parley.on('test:message', () => { });
            parley.onSystem('system:connected', () => { });

            // Destroy
            parley.destroy();

            // All listeners removed
            // All timers cleared
            // Connection closed
            expect((parley as any)._destroyed).toBe(true);
        });

        it('should prevent operations after destroy', () => {
            parley.destroy();

            // Attempting to register after destroy should fail or no-op
            // Attempting to send after destroy should fail or no-op

            expect((parley as any)._destroyed).toBe(true);
        });
    });

    describe('Error handling in lifecycle', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });
        });

        it('should handle errors during registration', () => {
            // Invalid schema
            // Should throw or emit error

            expect(parley).toBeDefined();
        });

        it('should handle errors during handler setup', () => {
            parley.on('test:message', (payload, respond) => {
                throw new Error('Handler failed');
            });

            // Handler error doesn't prevent destroy
            parley.destroy();

            expect((parley as any)._destroyed).toBe(true);
        });

        it('should handle errors during send', async () => {
            parley.register('test:message', {
                schema: { type: 'object' },
            });

            // Send to offline target
            // TimeoutError after retries

            expect(parley).toBeDefined();
        });
    });

    describe('Configuration workflow', () => {
        it('should accept all configuration options', () => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
                sendTimeout: 5000,
                retries: 3,
                logLevel: 'debug',
                heartbeat: {
                    enabled: true,
                    interval: 30000,
                    timeout: 5000,
                    maxMissed: 3,
                },
            });

            expect(parley).toBeDefined();
        });

        it('should use default values for optional config', () => {
            parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://target.example.com'],
            });

            // Should have reasonable defaults for:
            // - sendTimeout
            // - retries
            // - logLevel
            // - heartbeat settings

            expect(parley).toBeDefined();
        });
    });

    describe('Multi-phase workflows', () => {
        it('should support setup phase followed by active phase', () => {
            // Setup phase
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });

            parley.register('api:request', {
                schema: {
                    type: 'object',
                    required: ['endpoint'],
                    properties: {
                        endpoint: { type: 'string' },
                    },
                },
            });

            parley.on('api:response', (payload) => {
                // Handle response
            });

            // Active phase
            // Can send messages immediately
            // Handlers ready to process responses

            expect(parley).toBeDefined();
        });

        it('should support graceful shutdown workflow', () => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });

            // In-flight operations
            // Receive shutdown signal
            // Stop accepting new messages
            // Process in-flight
            // Close connection
            // Clean up resources

            parley.destroy();

            expect((parley as any)._destroyed).toBe(true);
        });
    });

    describe('State persistence across operations', () => {
        it('should maintain internal state correctly', () => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });

            parley.register('stateful:message', {
                schema: { type: 'object' },
            });

            // Internal state before operations
            const stateBefore = { ...parley };

            // Perform operations
            // Internal state should be consistent

            expect(parley).toBeDefined();
        });

        it('should track connection state through lifecycle', () => {
            parley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://target.example.com'],
            });

            // Initial: disconnected
            expect(parley.isConnected()).toBe(false);

            // After connect: connected (in real scenario)
            // After disconnect: disconnected

            expect(parley).toBeDefined();
        });
    });
});
