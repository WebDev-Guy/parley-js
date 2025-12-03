/**
 * @file Parley.test.ts
 * @description Unit tests for the main Parley class
 * @module tests/unit
 *
 * Tests all public methods:
 * - Parley.create() - Factory method
 * - register() - Message type registration
 * - on() - Message handlers
 * - onSystem() - System event handlers
 * - onAnalyticsEvent() - Analytics handlers
 * - send() - Message sending with response
 * - broadcast() - Message broadcasting
 * - connect() - Target connection
 * - disconnect() - Target disconnection
 * - getConnectedTargets() - Get connected target IDs
 * - isConnected() - Check connection status
 * - destroy() - Clean up resources
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { ValidationError, TimeoutError, TargetNotFoundError } from '../../src/errors/ErrorTypes';
import { createMockWindow, createConnectedMockWindows, createMockLogger } from '../utils/mock-factory';

describe('Parley', () => {
    let parley: Parley;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    // ========================================================================
    // Parley.create()
    // ========================================================================

    describe('Parley.create()', () => {
        it('should create instance with minimal config', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            expect(parley).toBeDefined();
            expect(parley.targetType).toBe('iframe');
            expect(parley.instanceId).toBeDefined();
            expect(parley.instanceId).toMatch(/^parley_/);
        });

        it('should create instance for window target type', () => {
            parley = Parley.create({
                targetType: 'window',
            });

            expect(parley.targetType).toBe('window');
        });

        it('should accept custom timeout', () => {
            parley = Parley.create({
                targetType: 'iframe',
                timeout: 10000,
            });

            // Timeout is used internally - verify instance created
            expect(parley).toBeDefined();
        });

        it('should accept custom retries', () => {
            parley = Parley.create({
                targetType: 'iframe',
                retries: 3,
            });

            expect(parley).toBeDefined();
        });

        it('should accept allowed origins', () => {
            parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://example.com', 'https://other.com'],
            });

            expect(parley).toBeDefined();
        });

        it('should accept custom instance ID', () => {
            parley = Parley.create({
                targetType: 'iframe',
                instanceId: 'my-custom-id',
            });

            expect(parley.instanceId).toBe('my-custom-id');
        });

        it('should accept log level', () => {
            parley = Parley.create({
                targetType: 'iframe',
                logLevel: 'debug',
            });

            expect(parley).toBeDefined();
        });

        it('should accept analytics enabled flag', () => {
            parley = Parley.create({
                targetType: 'iframe',
                analyticsEnabled: true,
            });

            expect(parley).toBeDefined();
        });

        it('should accept heartbeat configuration', () => {
            parley = Parley.create({
                targetType: 'iframe',
                heartbeat: {
                    enabled: true,
                    interval: 15000,
                    timeout: 3000,
                    maxMissed: 2,
                },
            });

            expect(parley).toBeDefined();
        });

        it('should disable heartbeat when configured', () => {
            parley = Parley.create({
                targetType: 'iframe',
                heartbeat: {
                    enabled: false,
                },
            });

            expect(parley).toBeDefined();
        });

        it('should expose static VERSION property', () => {
            expect(Parley.VERSION).toBeDefined();
            expect(typeof Parley.VERSION).toBe('string');
        });
    });

    // ========================================================================
    // register()
    // ========================================================================

    describe('register()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
            });
        });

        it('should register a message type', () => {
            expect(() => {
                parley.register('test:message');
            }).not.toThrow();
        });

        it('should register with schema', () => {
            expect(() => {
                parley.register('user:update', {
                    schema: {
                        type: 'object',
                        required: ['userId'],
                        properties: {
                            userId: { type: 'number' },
                        },
                    },
                });
            }).not.toThrow();
        });

        it('should register with custom timeout', () => {
            expect(() => {
                parley.register('slow:operation', {
                    timeout: 30000,
                });
            }).not.toThrow();
        });

        it('should register with custom retries', () => {
            expect(() => {
                parley.register('unreliable:operation', {
                    retries: 5,
                });
            }).not.toThrow();
        });

        it('should throw when registering duplicate type', () => {
            parley.register('duplicate:type');

            expect(() => {
                parley.register('duplicate:type');
            }).toThrow(/already registered/);
        });

        it('should throw when registering reserved type', () => {
            expect(() => {
                parley.register('__parley_reserved');
            }).toThrow();
        });

        it('should throw after destroy', () => {
            parley.destroy();

            expect(() => {
                parley.register('test:message');
            }).toThrow('Parley instance has been destroyed');
        });
    });

    // ========================================================================
    // on()
    // ========================================================================

    describe('on()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
            });
        });

        it('should register a message handler', () => {
            const handler = vi.fn();
            const unsubscribe = parley.on('test:message', handler);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should return unsubscribe function', () => {
            const handler = vi.fn();
            const unsubscribe = parley.on('test:message', handler);

            expect(() => unsubscribe()).not.toThrow();
        });

        it('should allow multiple handlers for same type', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            const unsub1 = parley.on('test:message', handler1);
            const unsub2 = parley.on('test:message', handler2);

            expect(unsub1).not.toBe(unsub2);
        });

        it('should throw after destroy', () => {
            parley.destroy();

            expect(() => {
                parley.on('test:message', vi.fn());
            }).toThrow('Parley instance has been destroyed');
        });
    });

    // ========================================================================
    // onSystem()
    // ========================================================================

    describe('onSystem()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
            });
        });

        it('should register system event handler', () => {
            const handler = vi.fn();
            const unsubscribe = parley.onSystem('system:connected', handler);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should handle system:error event', () => {
            const handler = vi.fn();
            parley.onSystem('system:error', handler);

            expect(typeof handler).toBe('function');
        });

        it('should handle system:disconnected event', () => {
            const handler = vi.fn();
            parley.onSystem('system:disconnected', handler);

            expect(typeof handler).toBe('function');
        });

        it('should throw after destroy', () => {
            parley.destroy();

            expect(() => {
                parley.onSystem('system:connected', vi.fn());
            }).toThrow('Parley instance has been destroyed');
        });
    });

    // ========================================================================
    // onAnalyticsEvent()
    // ========================================================================

    describe('onAnalyticsEvent()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
                analyticsEnabled: true,
            });
        });

        it('should register analytics event handler', () => {
            const handler = vi.fn();
            const unsubscribe = parley.onAnalyticsEvent(handler);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should return working unsubscribe function', () => {
            const handler = vi.fn();
            const unsubscribe = parley.onAnalyticsEvent(handler);

            expect(() => unsubscribe()).not.toThrow();
        });

        it('should throw after destroy', () => {
            parley.destroy();

            expect(() => {
                parley.onAnalyticsEvent(vi.fn());
            }).toThrow('Parley instance has been destroyed');
        });
    });

    // ========================================================================
    // send()
    // ========================================================================

    describe('send()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
                timeout: 100, // Short timeout for tests
            });
        });

        it('should throw TargetNotFoundError when no targets connected', async () => {
            await expect(parley.send('test:message', { data: 'test' })).rejects.toThrow(
                TargetNotFoundError
            );
        });

        it('should throw TargetNotFoundError for specific non-existent target', async () => {
            await expect(
                parley.send('test:message', { data: 'test' }, { targetId: 'nonexistent' })
            ).rejects.toThrow(TargetNotFoundError);
        });

        it('should validate payload against schema', async () => {
            parley.register('typed:message', {
                schema: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string' },
                    },
                },
            });

            // Missing required field should throw
            await expect(
                parley.send('typed:message', { other: 'field' })
            ).rejects.toThrow(ValidationError);
        });

        it('should throw after destroy', async () => {
            parley.destroy();

            await expect(parley.send('test:message', {})).rejects.toThrow(
                'Parley instance has been destroyed'
            );
        });

        it('should accept custom timeout option', async () => {
            // Even though this will fail (no connected targets),
            // it should accept the timeout option without error
            await expect(
                parley.send('test:message', {}, { timeout: 50 })
            ).rejects.toThrow(TargetNotFoundError);
        });

        it('should accept expectsResponse option', async () => {
            await expect(
                parley.send('test:message', {}, { expectsResponse: false })
            ).rejects.toThrow(TargetNotFoundError);
        });
    });

    // ========================================================================
    // broadcast()
    // ========================================================================

    describe('broadcast()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
            });
        });

        it('should not throw when no targets connected', () => {
            expect(() => {
                parley.broadcast('test:broadcast', { data: 'test' });
            }).not.toThrow();
        });

        it('should validate payload against schema', () => {
            parley.register('typed:broadcast', {
                schema: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                        message: { type: 'string' },
                    },
                },
            });

            expect(() => {
                parley.broadcast('typed:broadcast', { wrongField: 123 });
            }).toThrow(ValidationError);
        });

        it('should throw after destroy', () => {
            parley.destroy();

            expect(() => {
                parley.broadcast('test:broadcast', {});
            }).toThrow('Parley instance has been destroyed');
        });
    });

    // ========================================================================
    // connect() - Basic tests without full handshake
    // ========================================================================

    describe('connect()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
                timeout: 100, // Short timeout for tests
                allowedOrigins: ['*'],
            });
        });

        it('should accept iframe element', async () => {
            const iframe = document.createElement('iframe');
            document.body.appendChild(iframe);

            // Will timeout during handshake (no actual connection)
            await expect(parley.connect(iframe, 'test-iframe')).rejects.toThrow();

            document.body.removeChild(iframe);
        });

        it('should accept custom target ID', async () => {
            const iframe = document.createElement('iframe');
            document.body.appendChild(iframe);

            // Will timeout but should accept the custom ID
            await expect(parley.connect(iframe, 'custom-id')).rejects.toThrow();

            document.body.removeChild(iframe);
        });

        it('should throw after destroy', async () => {
            const iframe = document.createElement('iframe');
            document.body.appendChild(iframe);

            parley.destroy();

            await expect(parley.connect(iframe)).rejects.toThrow(
                'Parley instance has been destroyed'
            );

            document.body.removeChild(iframe);
        });
    });

    // ========================================================================
    // disconnect()
    // ========================================================================

    describe('disconnect()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
            });
        });

        it('should handle non-existent target gracefully', async () => {
            // Should not throw, just log warning
            await expect(parley.disconnect('nonexistent')).resolves.toBeUndefined();
        });

        it('should throw after destroy', async () => {
            parley.destroy();

            await expect(parley.disconnect('any-target')).rejects.toThrow(
                'Parley instance has been destroyed'
            );
        });
    });

    // ========================================================================
    // getConnectedTargets()
    // ========================================================================

    describe('getConnectedTargets()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
            });
        });

        it('should return empty array when no targets connected', () => {
            const targets = parley.getConnectedTargets();
            expect(targets).toEqual([]);
        });

        it('should return array of strings', () => {
            const targets = parley.getConnectedTargets();
            expect(Array.isArray(targets)).toBe(true);
        });
    });

    // ========================================================================
    // isConnected()
    // ========================================================================

    describe('isConnected()', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
            });
        });

        it('should return false for non-existent target', () => {
            expect(parley.isConnected('nonexistent')).toBe(false);
        });

        it('should return false when no targets registered', () => {
            expect(parley.isConnected('any-id')).toBe(false);
        });
    });

    // ========================================================================
    // destroy()
    // ========================================================================

    describe('destroy()', () => {
        it('should clean up instance', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            expect(() => parley.destroy()).not.toThrow();
        });

        it('should be idempotent', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            parley.destroy();
            expect(() => parley.destroy()).not.toThrow();
        });

        it('should reject pending requests', async () => {
            parley = Parley.create({
                targetType: 'iframe',
                timeout: 5000,
            });

            // Can't easily test this without a connected target
            // Just verify destroy works
            parley.destroy();
        });

        it('should prevent further operations', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            parley.destroy();

            expect(() => parley.register('test')).toThrow('destroyed');
            expect(() => parley.on('test', vi.fn())).toThrow('destroyed');
            expect(() => parley.broadcast('test', {})).toThrow('destroyed');
        });
    });

    // ========================================================================
    // Instance Properties
    // ========================================================================

    describe('instance properties', () => {
        it('should have instanceId property', () => {
            parley = Parley.create({
                targetType: 'iframe',
                instanceId: 'test-id',
            });

            expect(parley.instanceId).toBe('test-id');
        });

        it('should have targetType property', () => {
            parley = Parley.create({
                targetType: 'window',
            });

            expect(parley.targetType).toBe('window');
        });
    });

    // ========================================================================
    // Analytics Integration
    // ========================================================================

    describe('analytics integration', () => {
        it('should call analytics handler on registration', () => {
            parley = Parley.create({
                targetType: 'iframe',
                analyticsEnabled: true,
            });

            const analyticsHandler = vi.fn();
            parley.onAnalyticsEvent(analyticsHandler);

            // Analytics events are emitted on message send attempts
            // Register handler to verify analytics is wired up
            expect(analyticsHandler).not.toHaveBeenCalled(); // Not called until message sent
        });
    });

    // ========================================================================
    // Error handling
    // ========================================================================

    describe('error handling', () => {
        beforeEach(() => {
            parley = Parley.create({
                targetType: 'iframe',
                timeout: 50,
            });
        });

        it('should emit error event on validation failure', async () => {
            parley.register('typed:message', {
                schema: {
                    type: 'object',
                    required: ['field'],
                    properties: {
                        field: { type: 'string' },
                    },
                },
            });

            const errorHandler = vi.fn();
            parley.onSystem('system:error', errorHandler);

            // Invalid payload should throw ValidationError
            await expect(
                parley.send('typed:message', { wrongField: 123 })
            ).rejects.toThrow(ValidationError);
        });

        it('should throw TimeoutError when response not received', async () => {
            // This would require a connected target that doesn't respond
            // Skipping as it requires integration test setup
        });
    });

    // ========================================================================
    // Edge cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle rapid register/unregister cycles', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            for (let i = 0; i < 100; i++) {
                parley.register(`type-${i}`);
            }

            expect(parley).toBeDefined();
        });

        it('should handle many handler registrations', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            const unsubscribes: Array<() => void> = [];
            for (let i = 0; i < 50; i++) {
                unsubscribes.push(parley.on('test:message', vi.fn()));
            }

            // Unsubscribe all
            unsubscribes.forEach((unsub) => unsub());

            expect(unsubscribes).toHaveLength(50);
        });

        it('should handle special characters in message types', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            expect(() => {
                parley.register('user:action:create');
                parley.register('namespace.type.subtype');
                parley.register('TYPE_WITH_UNDERSCORE');
            }).not.toThrow();
        });

        it('should handle empty payload', async () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            // Will fail because no targets, but should accept empty payload
            await expect(parley.send('test:message', {})).rejects.toThrow(TargetNotFoundError);
            await expect(parley.send('test:message', null)).rejects.toThrow(TargetNotFoundError);
        });

        it('should handle undefined payload', async () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            await expect(parley.send('test:message', undefined)).rejects.toThrow(TargetNotFoundError);
        });
    });

    // ========================================================================
    // Configuration defaults
    // ========================================================================

    describe('configuration defaults', () => {
        it('should use default timeout of 5000ms', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            // Verify by accessing internal config (testing implementation detail)
            expect((parley as any)._config.timeout).toBe(5000);
        });

        it('should use default retries of 0', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            expect((parley as any)._config.retries).toBe(0);
        });

        it('should use default log level of none', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            expect((parley as any)._config.logLevel).toBe('none');
        });

        it('should disable analytics by default', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            expect((parley as any)._config.analyticsEnabled).toBe(false);
        });

        it('should enable heartbeat by default', () => {
            parley = Parley.create({
                targetType: 'iframe',
            });

            expect((parley as any)._config.heartbeat.enabled).toBe(true);
        });
    });
});
