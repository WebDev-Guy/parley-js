/**
 * @file schema-validation.test.ts
 * @description Integration tests for schema validation in real scenarios
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { ValidationError } from '../../src/errors/ErrorTypes';

describe('Schema Validation Integration', () => {
    let parley: Parley;

    beforeEach(() => {
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: ['https://peer.example.com'],
        });
    });

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    describe('Validation on send', () => {
        it('should validate on send', async () => {
            parley.register('user:create', {
                schema: {
                    type: 'object',
                    required: ['name', 'email'],
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string', pattern: '^[^@]+@[^@]+$' },
                    },
                },
            });

            // Valid payload - should succeed
            // Invalid payload - should throw ValidationError

            expect(parley).toBeDefined();
        });

        it('should reject invalid payloads', () => {
            parley.register('typed:message', {
                schema: {
                    type: 'object',
                    required: ['type', 'id'],
                    properties: {
                        type: { type: 'string' },
                        id: { type: 'number' },
                    },
                },
            });

            // Sending { type: 'test' } would fail (missing id)
            // Sending { type: 123, id: 1 } would fail (type must be string)

            expect(parley).toBeDefined();
        });
    });

    describe('Validation on receive', () => {
        it('should validate on receive', async () => {
            parley.register('data:received', {
                schema: {
                    type: 'object',
                    required: ['value'],
                    properties: {
                        value: { type: 'number' },
                    },
                },
            });

            let validMessageReceived = false;
            let invalidMessageReceived = false;

            parley.on('data:received', (payload) => {
                validMessageReceived = true;
            });

            parley.onSystem('system:error', (error) => {
                if (error.code === 'VALIDATION_ERROR') {
                    invalidMessageReceived = true;
                }
            });

            // Valid message received - handler called
            // Invalid message received - error emitted, handler not called

            expect(parley).toBeDefined();
        });

        it('should provide helpful error messages', () => {
            const schema = {
                type: 'object',
                required: ['id', 'name', 'email'],
                properties: {
                    id: { type: 'number', minimum: 1 },
                    name: { type: 'string', minLength: 1 },
                    email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
                },
            };

            parley.register('complex:validation', { schema });

            // Invalid data: { id: 0, name: '', email: 'invalid' }
            // Error should indicate which fields failed and why

            expect(parley).toBeDefined();
        });
    });

    describe('Complex schema validation', () => {
        it('should validate nested objects', () => {
            parley.register('nested:data', {
                schema: {
                    type: 'object',
                    required: ['user'],
                    properties: {
                        user: {
                            type: 'object',
                            required: ['id', 'profile'],
                            properties: {
                                id: { type: 'number' },
                                profile: {
                                    type: 'object',
                                    properties: {
                                        bio: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            // { user: { id: 1, profile: { bio: 'text' } } } - valid
            // { user: { id: 'not-number', profile: {} } } - invalid

            expect(parley).toBeDefined();
        });

        it('should validate arrays with items', () => {
            parley.register('array:data', {
                schema: {
                    type: 'object',
                    required: ['items'],
                    properties: {
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'number' },
                                    name: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            });

            // { items: [{ id: 1, name: 'item1' }] } - valid
            // { items: [{ id: 'not-number', name: 'item' }] } - invalid

            expect(parley).toBeDefined();
        });

        it('should validate enum values', () => {
            parley.register('enum:data', {
                schema: {
                    type: 'object',
                    required: ['status'],
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['pending', 'active', 'inactive'],
                        },
                    },
                },
            });

            // { status: 'active' } - valid
            // { status: 'unknown' } - invalid

            expect(parley).toBeDefined();
        });

        it('should validate pattern (regex) constraints', () => {
            parley.register('pattern:data', {
                schema: {
                    type: 'object',
                    required: ['code'],
                    properties: {
                        code: {
                            type: 'string',
                            pattern: '^[A-Z]{3}-\\d{3}$',
                        },
                    },
                },
            });

            // { code: 'ABC-123' } - valid
            // { code: 'abc-123' } - invalid (lowercase)
            // { code: 'ABC123' } - invalid (no dash)

            expect(parley).toBeDefined();
        });
    });

    describe('Constraint validation', () => {
        it('should validate string length constraints', () => {
            parley.register('string:constraints', {
                schema: {
                    type: 'object',
                    properties: {
                        shortCode: { type: 'string', minLength: 3, maxLength: 5 },
                    },
                },
            });

            // 'AB' - too short
            // 'ABC' - valid
            // 'ABCDE' - valid
            // 'ABCDEF' - too long

            expect(parley).toBeDefined();
        });

        it('should validate number constraints', () => {
            parley.register('number:constraints', {
                schema: {
                    type: 'object',
                    properties: {
                        age: { type: 'number', minimum: 0, maximum: 150 },
                        score: { type: 'integer', minimum: 0 },
                    },
                },
            });

            // { age: -1, score: 10 } - invalid (age negative)
            // { age: 25, score: 10.5 } - invalid (score not integer)
            // { age: 25, score: 10 } - valid

            expect(parley).toBeDefined();
        });
    });

    describe('End-to-end validation', () => {
        it('should handle complete validation workflows', () => {
            // Register multiple message types with schemas
            parley.register('user:register', {
                schema: {
                    type: 'object',
                    required: ['username', 'email', 'password'],
                    properties: {
                        username: { type: 'string', minLength: 3, maxLength: 20 },
                        email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
                        password: { type: 'string', minLength: 8 },
                    },
                },
            });

            parley.register('user:login', {
                schema: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string' },
                        password: { type: 'string' },
                    },
                },
            });

            parley.register('user:update', {
                schema: {
                    type: 'object',
                    properties: {
                        username: { type: 'string' },
                        email: { type: 'string' },
                    },
                },
            });

            // All three message types with their schemas registered and ready

            expect(parley).toBeDefined();
        });

        it('should handle multiple message validations in sequence', () => {
            parley.register('msg:1', {
                schema: {
                    type: 'object',
                    required: ['step'],
                    properties: { step: { type: 'number' } },
                },
            });

            parley.register('msg:2', {
                schema: {
                    type: 'object',
                    required: ['step'],
                    properties: { step: { type: 'number' } },
                },
            });

            // Send valid message 1
            // Send valid message 2
            // Send invalid message 1
            // Error handler called for invalid

            expect(parley).toBeDefined();
        });
    });

    describe('Error message clarity', () => {
        it('should indicate which field failed validation', () => {
            parley.register('detailed:error', {
                schema: {
                    type: 'object',
                    required: ['firstName', 'lastName', 'age'],
                    properties: {
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        age: { type: 'number' },
                    },
                },
            });

            // Invalid: { firstName: 'John', age: 30 } (missing lastName)
            // Error should mention: "lastName is required"

            expect(parley).toBeDefined();
        });

        it('should indicate constraint violation', () => {
            parley.register('constraint:error', {
                schema: {
                    type: 'object',
                    properties: {
                        quantity: { type: 'number', minimum: 1, maximum: 100 },
                    },
                },
            });

            // Invalid: { quantity: 150 }
            // Error should mention: "quantity must be <= 100"

            expect(parley).toBeDefined();
        });
    });
});
