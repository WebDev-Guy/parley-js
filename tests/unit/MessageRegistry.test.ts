/**
 * @file MessageRegistry.test.ts
 * @description Unit tests for MessageRegistry class
 * @module tests/unit
 *
 * Tests all public methods:
 * - register() - Register message types
 * - unregister() - Remove message types
 * - has() - Check if type exists
 * - get() / getOrThrow() - Retrieve registration
 * - addHandler() / removeHandler() - Handler management
 * - getHandlers() - Get all handlers
 * - validatePayload() - Schema validation
 * - getTimeout() / getRetries() / getSchema() - Get options
 * - getTypeNames() - List all types
 * - count / clear() - Registry management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRegistry } from '../../src/core/MessageRegistry';
import { ValidationError } from '../../src/errors/ErrorTypes';
import type { JsonSchema } from '../../src/types/MessageTypes';
import { TEST_MESSAGE_TYPES } from '../fixtures/test-messages';

describe('MessageRegistry', () => {
    let registry: MessageRegistry;

    beforeEach(() => {
        registry = new MessageRegistry();
    });

    // ========================================================================
    // register()
    // ========================================================================

    describe('register()', () => {
        it('should register a message type', () => {
            registry.register('test:message');
            expect(registry.has('test:message')).toBe(true);
        });

        it('should register with schema', () => {
            const schema: JsonSchema = { type: 'object' };
            registry.register('test:message', { schema });

            expect(registry.getSchema('test:message')).toEqual(schema);
        });

        it('should register with timeout', () => {
            registry.register('test:message', { timeout: 10000 });

            expect(registry.getTimeout('test:message', 5000)).toBe(10000);
        });

        it('should register with retries', () => {
            registry.register('test:message', { retries: 3 });

            expect(registry.getRetries('test:message', 0)).toBe(3);
        });

        it('should throw when registering duplicate type', () => {
            registry.register('test:message');

            expect(() => registry.register('test:message')).toThrow('already registered');
        });

        it('should reject reserved __parley_ prefix', () => {
            expect(() => registry.register('__parley_internal')).toThrow('reserved');
        });

        it('should reject reserved system: prefix', () => {
            expect(() => registry.register('system:custom')).toThrow('reserved');
        });

        it('should reject empty string type', () => {
            expect(() => registry.register('')).toThrow('non-empty string');
        });
    });

    // ========================================================================
    // unregister()
    // ========================================================================

    describe('unregister()', () => {
        it('should unregister a message type', () => {
            registry.register('test:message');
            registry.unregister('test:message');

            expect(registry.has('test:message')).toBe(false);
        });

        it('should do nothing for non-existent type', () => {
            expect(() => registry.unregister('nonexistent')).not.toThrow();
        });

        it('should allow re-registration after unregister', () => {
            registry.register('test:message', { timeout: 5000 });
            registry.unregister('test:message');
            registry.register('test:message', { timeout: 10000 });

            expect(registry.getTimeout('test:message', 0)).toBe(10000);
        });
    });

    // ========================================================================
    // has()
    // ========================================================================

    describe('has()', () => {
        it('should return true for registered type', () => {
            registry.register('test:message');
            expect(registry.has('test:message')).toBe(true);
        });

        it('should return false for unregistered type', () => {
            expect(registry.has('nonexistent')).toBe(false);
        });

        it('should return false after unregister', () => {
            registry.register('test:message');
            registry.unregister('test:message');
            expect(registry.has('test:message')).toBe(false);
        });
    });

    // ========================================================================
    // get() / getOrThrow()
    // ========================================================================

    describe('get()', () => {
        it('should return registration for registered type', () => {
            registry.register('test:message', { timeout: 5000 });

            const registration = registry.get('test:message');

            expect(registration).toBeDefined();
            expect(registration?.type).toBe('test:message');
            expect(registration?.options.timeout).toBe(5000);
        });

        it('should return undefined for unregistered type', () => {
            expect(registry.get('nonexistent')).toBeUndefined();
        });
    });

    describe('getOrThrow()', () => {
        it('should return registration for registered type', () => {
            registry.register('test:message');

            const registration = registry.getOrThrow('test:message');

            expect(registration.type).toBe('test:message');
        });

        it('should throw ValidationError for unregistered type', () => {
            expect(() => registry.getOrThrow('nonexistent')).toThrow(ValidationError);
        });

        it('should include type name in error message', () => {
            try {
                registry.getOrThrow('my:type');
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('my:type');
            }
        });
    });

    // ========================================================================
    // addHandler() / removeHandler()
    // ========================================================================

    describe('addHandler()', () => {
        it('should add handler to registered type', () => {
            registry.register('test:message');
            const handler = vi.fn();

            registry.addHandler('test:message', handler);

            expect(registry.getHandlers('test:message')).toContain(handler);
        });

        it('should auto-register type if not registered', () => {
            const handler = vi.fn();

            registry.addHandler('new:message', handler);

            expect(registry.has('new:message')).toBe(true);
            expect(registry.getHandlers('new:message')).toContain(handler);
        });

        it('should return unsubscribe function', () => {
            registry.register('test:message');
            const handler = vi.fn();

            const unsubscribe = registry.addHandler('test:message', handler);
            expect(registry.getHandlers('test:message')).toContain(handler);

            unsubscribe();
            expect(registry.getHandlers('test:message')).not.toContain(handler);
        });

        it('should allow multiple handlers for same type', () => {
            registry.register('test:message');
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            registry.addHandler('test:message', handler1);
            registry.addHandler('test:message', handler2);

            const handlers = registry.getHandlers('test:message');
            expect(handlers).toContain(handler1);
            expect(handlers).toContain(handler2);
            expect(handlers).toHaveLength(2);
        });
    });

    describe('removeHandler()', () => {
        it('should remove specific handler', () => {
            registry.register('test:message');
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            registry.addHandler('test:message', handler1);
            registry.addHandler('test:message', handler2);
            registry.removeHandler('test:message', handler1);

            const handlers = registry.getHandlers('test:message');
            expect(handlers).not.toContain(handler1);
            expect(handlers).toContain(handler2);
        });

        it('should do nothing for non-existent type', () => {
            const handler = vi.fn();
            expect(() => registry.removeHandler('nonexistent', handler)).not.toThrow();
        });

        it('should do nothing for non-existent handler', () => {
            registry.register('test:message');
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            registry.addHandler('test:message', handler1);
            expect(() => registry.removeHandler('test:message', handler2)).not.toThrow();
            expect(registry.getHandlers('test:message')).toContain(handler1);
        });
    });

    // ========================================================================
    // getHandlers()
    // ========================================================================

    describe('getHandlers()', () => {
        it('should return empty array for type with no handlers', () => {
            registry.register('test:message');
            expect(registry.getHandlers('test:message')).toEqual([]);
        });

        it('should return empty array for unregistered type', () => {
            expect(registry.getHandlers('nonexistent')).toEqual([]);
        });

        it('should return all handlers in order', () => {
            registry.register('test:message');
            const handlers = [vi.fn(), vi.fn(), vi.fn()];

            handlers.forEach((h) => registry.addHandler('test:message', h));

            const result = registry.getHandlers('test:message');
            expect(result).toHaveLength(3);
        });
    });

    // ========================================================================
    // validatePayload()
    // ========================================================================

    describe('validatePayload()', () => {
        it('should pass for valid payload matching schema', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' } },
            };
            registry.register('test:message', { schema });

            expect(() => registry.validatePayload('test:message', { name: 'John' })).not.toThrow();
        });

        it('should throw ValidationError for invalid payload', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' } },
            };
            registry.register('test:message', { schema });

            expect(() => registry.validatePayload('test:message', {})).toThrow(ValidationError);
        });

        it('should not validate when no schema registered', () => {
            registry.register('test:message');

            expect(() => registry.validatePayload('test:message', { any: 'data' })).not.toThrow();
        });

        it('should not validate for unregistered type', () => {
            expect(() => registry.validatePayload('nonexistent', { any: 'data' })).not.toThrow();
        });

        it('should include type name in error message', () => {
            const schema: JsonSchema = { type: 'string' };
            registry.register('my:type', { schema });

            try {
                registry.validatePayload('my:type', 123);
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('my:type');
            }
        });

        it('should validate against complex schemas', () => {
            const { schema, validPayloads, invalidPayloads } = TEST_MESSAGE_TYPES.USER_UPDATE;
            registry.register('user:update', { schema });

            for (const payload of validPayloads) {
                expect(() => registry.validatePayload('user:update', payload)).not.toThrow();
            }

            for (const { payload } of invalidPayloads) {
                expect(() => registry.validatePayload('user:update', payload)).toThrow(
                    ValidationError
                );
            }
        });
    });

    // ========================================================================
    // getTimeout() / getRetries() / getSchema()
    // ========================================================================

    describe('getTimeout()', () => {
        it('should return registered timeout', () => {
            registry.register('test:message', { timeout: 10000 });
            expect(registry.getTimeout('test:message', 5000)).toBe(10000);
        });

        it('should return default timeout when not specified', () => {
            registry.register('test:message');
            expect(registry.getTimeout('test:message', 5000)).toBe(5000);
        });

        it('should return default timeout for unregistered type', () => {
            expect(registry.getTimeout('nonexistent', 5000)).toBe(5000);
        });
    });

    describe('getRetries()', () => {
        it('should return registered retries', () => {
            registry.register('test:message', { retries: 3 });
            expect(registry.getRetries('test:message', 0)).toBe(3);
        });

        it('should return default retries when not specified', () => {
            registry.register('test:message');
            expect(registry.getRetries('test:message', 2)).toBe(2);
        });
    });

    describe('getSchema()', () => {
        it('should return registered schema', () => {
            const schema: JsonSchema = { type: 'object' };
            registry.register('test:message', { schema });
            expect(registry.getSchema('test:message')).toEqual(schema);
        });

        it('should return undefined when no schema', () => {
            registry.register('test:message');
            expect(registry.getSchema('test:message')).toBeUndefined();
        });

        it('should return undefined for unregistered type', () => {
            expect(registry.getSchema('nonexistent')).toBeUndefined();
        });
    });

    // ========================================================================
    // getTypeNames() / count / clear()
    // ========================================================================

    describe('getTypeNames()', () => {
        it('should return empty array when no types registered', () => {
            expect(registry.getTypeNames()).toEqual([]);
        });

        it('should return all registered type names', () => {
            registry.register('type:one');
            registry.register('type:two');
            registry.register('type:three');

            const names = registry.getTypeNames();
            expect(names).toHaveLength(3);
            expect(names).toContain('type:one');
            expect(names).toContain('type:two');
            expect(names).toContain('type:three');
        });
    });

    describe('count', () => {
        it('should return 0 when no types registered', () => {
            expect(registry.count).toBe(0);
        });

        it('should return correct count', () => {
            registry.register('type:one');
            registry.register('type:two');
            expect(registry.count).toBe(2);
        });

        it('should decrease after unregister', () => {
            registry.register('type:one');
            registry.register('type:two');
            registry.unregister('type:one');
            expect(registry.count).toBe(1);
        });
    });

    describe('clear()', () => {
        it('should remove all registrations', () => {
            registry.register('type:one');
            registry.register('type:two');
            registry.register('type:three');

            registry.clear();

            expect(registry.count).toBe(0);
            expect(registry.getTypeNames()).toEqual([]);
        });

        it('should allow re-registration after clear', () => {
            registry.register('test:message');
            registry.clear();
            registry.register('test:message');

            expect(registry.has('test:message')).toBe(true);
        });
    });

    // ========================================================================
    // registerInternal()
    // ========================================================================

    describe('registerInternal()', () => {
        it('should register internal type without validation', () => {
            registry.registerInternal('__parley_internal');
            expect(registry.has('__parley_internal')).toBe(true);
        });

        it('should skip if already registered', () => {
            registry.register('test:message', { timeout: 5000 });
            registry.registerInternal('test:message'); // Should not throw or change

            expect(registry.getTimeout('test:message', 0)).toBe(5000);
        });
    });
});
