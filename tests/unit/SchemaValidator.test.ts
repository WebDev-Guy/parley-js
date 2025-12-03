/**
 * @file SchemaValidator.test.ts
 * @description Unit tests for SchemaValidator class
 * @module tests/unit
 *
 * Tests all public methods and validation capabilities:
 * - validate() - Core validation method
 * - assertValid() - Throws on invalid
 * - Type validation (string, number, integer, boolean, object, array, null)
 * - Required properties
 * - String constraints (minLength, maxLength, pattern)
 * - Number constraints (minimum, maximum)
 * - Array constraints (minLength, maxLength, items)
 * - Enum validation
 * - Nested object validation
 * - Additional properties validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator, validateSchema } from '../../src/validation/SchemaValidator';
import type { JsonSchema } from '../../src/types/MessageTypes';
import { TEST_MESSAGE_TYPES } from '../fixtures/test-messages';

describe('SchemaValidator', () => {
    let validator: SchemaValidator;

    beforeEach(() => {
        validator = new SchemaValidator();
    });

    // ========================================================================
    // validate() - Basic Type Validation
    // ========================================================================

    describe('validate() - type validation', () => {
        it('should validate string type', () => {
            const schema: JsonSchema = { type: 'string' };

            expect(validator.validate('hello', schema).valid).toBe(true);
            expect(validator.validate('', schema).valid).toBe(true);
            expect(validator.validate(123, schema).valid).toBe(false);
            expect(validator.validate(null, schema).valid).toBe(false);
        });

        it('should validate number type', () => {
            const schema: JsonSchema = { type: 'number' };

            expect(validator.validate(42, schema).valid).toBe(true);
            expect(validator.validate(3.14, schema).valid).toBe(true);
            expect(validator.validate(-100, schema).valid).toBe(true);
            expect(validator.validate(0, schema).valid).toBe(true);
            expect(validator.validate('42', schema).valid).toBe(false);
            expect(validator.validate(NaN, schema).valid).toBe(true); // NaN is typeof 'number'
        });

        it('should validate integer type', () => {
            const schema: JsonSchema = { type: 'integer' };

            expect(validator.validate(42, schema).valid).toBe(true);
            expect(validator.validate(-100, schema).valid).toBe(true);
            expect(validator.validate(0, schema).valid).toBe(true);
            expect(validator.validate(3.14, schema).valid).toBe(false);
            expect(validator.validate('42', schema).valid).toBe(false);
        });

        it('should validate boolean type', () => {
            const schema: JsonSchema = { type: 'boolean' };

            expect(validator.validate(true, schema).valid).toBe(true);
            expect(validator.validate(false, schema).valid).toBe(true);
            expect(validator.validate(1, schema).valid).toBe(false);
            expect(validator.validate('true', schema).valid).toBe(false);
            expect(validator.validate(null, schema).valid).toBe(false);
        });

        it('should validate object type', () => {
            const schema: JsonSchema = { type: 'object' };

            expect(validator.validate({}, schema).valid).toBe(true);
            expect(validator.validate({ key: 'value' }, schema).valid).toBe(true);
            expect(validator.validate([], schema).valid).toBe(false);
            expect(validator.validate(null, schema).valid).toBe(false);
            expect(validator.validate('{}', schema).valid).toBe(false);
        });

        it('should validate array type', () => {
            const schema: JsonSchema = { type: 'array' };

            expect(validator.validate([], schema).valid).toBe(true);
            expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
            expect(validator.validate({}, schema).valid).toBe(false);
            expect(validator.validate('[]', schema).valid).toBe(false);
        });

        it('should validate null type', () => {
            const schema: JsonSchema = { type: 'null' };

            expect(validator.validate(null, schema).valid).toBe(true);
            expect(validator.validate(undefined, schema).valid).toBe(false);
            expect(validator.validate(0, schema).valid).toBe(false);
            expect(validator.validate('', schema).valid).toBe(false);
        });

        it('should provide helpful error messages for type mismatch', () => {
            const schema: JsonSchema = { type: 'string' };
            const result = validator.validate(123, schema);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain('Expected string');
            expect(result.errors[0].message).toContain('number');
        });
    });

    // ========================================================================
    // validate() - Required Properties
    // ========================================================================

    describe('validate() - required properties', () => {
        it('should validate required properties are present', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['name', 'age'],
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            expect(validator.validate({ name: 'John', age: 30 }, schema).valid).toBe(true);
            expect(validator.validate({ name: 'John' }, schema).valid).toBe(false);
            expect(validator.validate({ age: 30 }, schema).valid).toBe(false);
            expect(validator.validate({}, schema).valid).toBe(false);
        });

        it('should allow optional properties to be missing', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    nickname: { type: 'string' },
                },
            };

            expect(validator.validate({ name: 'John' }, schema).valid).toBe(true);
            expect(validator.validate({ name: 'John', nickname: 'Johnny' }, schema).valid).toBe(true);
        });

        it('should report all missing required properties', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['a', 'b', 'c'],
            };

            const result = validator.validate({}, schema);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(3);
        });

        it('should provide path in error for missing required property', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['userId'],
            };

            const result = validator.validate({}, schema);

            expect(result.errors[0].path).toBe('userId');
            expect(result.errors[0].message).toContain('Missing required property');
        });
    });

    // ========================================================================
    // validate() - String Constraints
    // ========================================================================

    describe('validate() - string constraints', () => {
        it('should validate minLength', () => {
            const schema: JsonSchema = { type: 'string', minLength: 3 };

            expect(validator.validate('abc', schema).valid).toBe(true);
            expect(validator.validate('abcd', schema).valid).toBe(true);
            expect(validator.validate('ab', schema).valid).toBe(false);
            expect(validator.validate('', schema).valid).toBe(false);
        });

        it('should validate maxLength', () => {
            const schema: JsonSchema = { type: 'string', maxLength: 5 };

            expect(validator.validate('abc', schema).valid).toBe(true);
            expect(validator.validate('abcde', schema).valid).toBe(true);
            expect(validator.validate('abcdef', schema).valid).toBe(false);
        });

        it('should validate minLength and maxLength together', () => {
            const schema: JsonSchema = { type: 'string', minLength: 2, maxLength: 5 };

            expect(validator.validate('ab', schema).valid).toBe(true);
            expect(validator.validate('abcde', schema).valid).toBe(true);
            expect(validator.validate('a', schema).valid).toBe(false);
            expect(validator.validate('abcdef', schema).valid).toBe(false);
        });

        it('should validate pattern (regex)', () => {
            const schema: JsonSchema = { type: 'string', pattern: '^[a-z]+$' };

            expect(validator.validate('hello', schema).valid).toBe(true);
            expect(validator.validate('Hello', schema).valid).toBe(false);
            expect(validator.validate('hello123', schema).valid).toBe(false);
        });

        it('should validate email-like pattern', () => {
            const schema: JsonSchema = {
                type: 'string',
                pattern: '^[^@]+@[^@]+\\.[^@]+$',
            };

            expect(validator.validate('test@example.com', schema).valid).toBe(true);
            expect(validator.validate('invalid-email', schema).valid).toBe(false);
        });

        it('should provide helpful error for pattern mismatch', () => {
            const schema: JsonSchema = { type: 'string', pattern: '^\\d{3}$' };
            const result = validator.validate('12', schema);

            expect(result.valid).toBe(false);
            expect(result.errors[0].message).toContain('pattern');
        });
    });

    // ========================================================================
    // validate() - Number Constraints
    // ========================================================================

    describe('validate() - number constraints', () => {
        it('should validate minimum', () => {
            const schema: JsonSchema = { type: 'number', minimum: 10 };

            expect(validator.validate(10, schema).valid).toBe(true);
            expect(validator.validate(100, schema).valid).toBe(true);
            expect(validator.validate(9, schema).valid).toBe(false);
            expect(validator.validate(-5, schema).valid).toBe(false);
        });

        it('should validate maximum', () => {
            const schema: JsonSchema = { type: 'number', maximum: 100 };

            expect(validator.validate(100, schema).valid).toBe(true);
            expect(validator.validate(50, schema).valid).toBe(true);
            expect(validator.validate(101, schema).valid).toBe(false);
        });

        it('should validate minimum and maximum together (range)', () => {
            const schema: JsonSchema = { type: 'number', minimum: 0, maximum: 100 };

            expect(validator.validate(0, schema).valid).toBe(true);
            expect(validator.validate(50, schema).valid).toBe(true);
            expect(validator.validate(100, schema).valid).toBe(true);
            expect(validator.validate(-1, schema).valid).toBe(false);
            expect(validator.validate(101, schema).valid).toBe(false);
        });

        it('should validate integer with constraints', () => {
            const schema: JsonSchema = { type: 'integer', minimum: 1, maximum: 10 };

            expect(validator.validate(1, schema).valid).toBe(true);
            expect(validator.validate(5, schema).valid).toBe(true);
            expect(validator.validate(10, schema).valid).toBe(true);
            expect(validator.validate(0, schema).valid).toBe(false);
            expect(validator.validate(11, schema).valid).toBe(false);
            expect(validator.validate(5.5, schema).valid).toBe(false); // Not integer
        });

        it('should provide helpful error for range violation', () => {
            const schema: JsonSchema = { type: 'number', minimum: 10 };
            const result = validator.validate(5, schema);

            expect(result.valid).toBe(false);
            expect(result.errors[0].message).toContain('minimum');
            expect(result.errors[0].message).toContain('10');
        });
    });

    // ========================================================================
    // validate() - Enum Validation
    // ========================================================================

    describe('validate() - enum validation', () => {
        it('should validate string enum', () => {
            const schema: JsonSchema = {
                type: 'string',
                enum: ['red', 'green', 'blue'],
            };

            expect(validator.validate('red', schema).valid).toBe(true);
            expect(validator.validate('green', schema).valid).toBe(true);
            expect(validator.validate('blue', schema).valid).toBe(true);
            expect(validator.validate('yellow', schema).valid).toBe(false);
            expect(validator.validate('RED', schema).valid).toBe(false);
        });

        it('should validate number enum', () => {
            const schema: JsonSchema = {
                type: 'number',
                enum: [1, 2, 3, 5, 8, 13],
            };

            expect(validator.validate(1, schema).valid).toBe(true);
            expect(validator.validate(13, schema).valid).toBe(true);
            expect(validator.validate(4, schema).valid).toBe(false);
        });

        it('should validate mixed enum', () => {
            const schema: JsonSchema = {
                enum: ['auto', 0, 100, true],
            };

            expect(validator.validate('auto', schema).valid).toBe(true);
            expect(validator.validate(0, schema).valid).toBe(true);
            expect(validator.validate(100, schema).valid).toBe(true);
            expect(validator.validate(true, schema).valid).toBe(true);
            expect(validator.validate(false, schema).valid).toBe(false);
            expect(validator.validate(50, schema).valid).toBe(false);
        });

        it('should provide helpful error for enum violation', () => {
            const schema: JsonSchema = {
                type: 'string',
                enum: ['info', 'warning', 'error'],
            };
            const result = validator.validate('debug', schema);

            expect(result.valid).toBe(false);
            expect(result.errors[0].message).toContain('info');
            expect(result.errors[0].message).toContain('warning');
            expect(result.errors[0].message).toContain('error');
        });
    });

    // ========================================================================
    // validate() - Array Validation
    // ========================================================================

    describe('validate() - array validation', () => {
        it('should validate array minLength', () => {
            const schema: JsonSchema = { type: 'array', minLength: 2 };

            expect(validator.validate([1, 2], schema).valid).toBe(true);
            expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
            expect(validator.validate([1], schema).valid).toBe(false);
            expect(validator.validate([], schema).valid).toBe(false);
        });

        it('should validate array maxLength', () => {
            const schema: JsonSchema = { type: 'array', maxLength: 3 };

            expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
            expect(validator.validate([1], schema).valid).toBe(true);
            expect(validator.validate([], schema).valid).toBe(true);
            expect(validator.validate([1, 2, 3, 4], schema).valid).toBe(false);
        });

        it('should validate array items schema', () => {
            const schema: JsonSchema = {
                type: 'array',
                items: { type: 'number' },
            };

            expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
            expect(validator.validate([], schema).valid).toBe(true);
            expect(validator.validate([1, 'two', 3], schema).valid).toBe(false);
        });

        it('should validate array items with object schema', () => {
            const schema: JsonSchema = {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                    },
                },
            };

            expect(validator.validate([{ id: 1 }, { id: 2, name: 'test' }], schema).valid).toBe(true);
            expect(validator.validate([{ name: 'missing id' }], schema).valid).toBe(false);
        });

        it('should provide path in error for array item validation', () => {
            const schema: JsonSchema = {
                type: 'array',
                items: { type: 'number' },
            };

            const result = validator.validate([1, 'invalid', 3], schema);

            expect(result.valid).toBe(false);
            expect(result.errors[0].path).toBe('[1]');
        });
    });

    // ========================================================================
    // validate() - Nested Object Validation
    // ========================================================================

    describe('validate() - nested object validation', () => {
        it('should validate nested objects', () => {
            const schema: JsonSchema = {
                type: 'object',
                properties: {
                    user: {
                        type: 'object',
                        required: ['name'],
                        properties: {
                            name: { type: 'string' },
                            age: { type: 'number' },
                        },
                    },
                },
            };

            expect(
                validator.validate({ user: { name: 'John', age: 30 } }, schema).valid
            ).toBe(true);
            expect(
                validator.validate({ user: { name: 'John' } }, schema).valid
            ).toBe(true);
            expect(
                validator.validate({ user: { age: 30 } }, schema).valid
            ).toBe(false);
        });

        it('should provide nested path in error', () => {
            const schema: JsonSchema = {
                type: 'object',
                properties: {
                    config: {
                        type: 'object',
                        properties: {
                            timeout: { type: 'number' },
                        },
                    },
                },
            };

            const result = validator.validate({ config: { timeout: 'invalid' } }, schema);

            expect(result.valid).toBe(false);
            expect(result.errors[0].path).toBe('config.timeout');
        });

        it('should validate deeply nested structures', () => {
            const schema: JsonSchema = {
                type: 'object',
                properties: {
                    level1: {
                        type: 'object',
                        properties: {
                            level2: {
                                type: 'object',
                                properties: {
                                    level3: {
                                        type: 'object',
                                        required: ['value'],
                                        properties: {
                                            value: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const valid = { level1: { level2: { level3: { value: 'deep' } } } };
            const invalid = { level1: { level2: { level3: {} } } };

            expect(validator.validate(valid, schema).valid).toBe(true);
            expect(validator.validate(invalid, schema).valid).toBe(false);
        });
    });

    // ========================================================================
    // validate() - Additional Properties
    // ========================================================================

    describe('validate() - additional properties', () => {
        it('should reject additional properties when additionalProperties is false', () => {
            const schema: JsonSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                },
                additionalProperties: false,
            };

            expect(validator.validate({ name: 'John' }, schema).valid).toBe(true);
            expect(validator.validate({ name: 'John', extra: 'field' }, schema).valid).toBe(false);
        });

        it('should allow additional properties by default', () => {
            const schema: JsonSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                },
            };

            expect(validator.validate({ name: 'John', extra: 'field' }, schema).valid).toBe(true);
        });

        it('should report all additional properties in error', () => {
            const schema: JsonSchema = {
                type: 'object',
                properties: {
                    allowed: { type: 'string' },
                },
                additionalProperties: false,
            };

            const result = validator.validate({ allowed: 'ok', extra1: 1, extra2: 2 }, schema);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ========================================================================
    // assertValid() - Throws on Invalid
    // ========================================================================

    describe('assertValid()', () => {
        it('should not throw for valid data', () => {
            const schema: JsonSchema = { type: 'string' };

            expect(() => validator.assertValid('hello', schema)).not.toThrow();
        });

        it('should throw for invalid data', () => {
            const schema: JsonSchema = { type: 'string' };

            expect(() => validator.assertValid(123, schema)).toThrow();
        });

        it('should include error details in thrown error message', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['name', 'age'],
            };

            expect(() => validator.assertValid({}, schema)).toThrow(/Missing required property/);
        });

        it('should include multiple errors in message', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['a', 'b'],
            };

            try {
                validator.assertValid({}, schema);
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('a');
                expect((error as Error).message).toContain('b');
            }
        });
    });

    // ========================================================================
    // validateSchema() - Convenience Function
    // ========================================================================

    describe('validateSchema() convenience function', () => {
        it('should validate using default validator', () => {
            const schema: JsonSchema = { type: 'string' };

            expect(validateSchema('hello', schema).valid).toBe(true);
            expect(validateSchema(123, schema).valid).toBe(false);
        });

        it('should work with complex schemas', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'number', minimum: 1 },
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
            };

            expect(validateSchema({ id: 1 }, schema).valid).toBe(true);
            expect(validateSchema({ id: 1, tags: ['a', 'b'] }, schema).valid).toBe(true);
            expect(validateSchema({ id: 0 }, schema).valid).toBe(false);
            expect(validateSchema({ id: 1, tags: [1, 2] }, schema).valid).toBe(false);
        });
    });

    // ========================================================================
    // Test Fixtures Integration
    // ========================================================================

    describe('test fixtures integration', () => {
        it('should validate SIMPLE message type', () => {
            const { schema, validPayloads, invalidPayloads } = TEST_MESSAGE_TYPES.SIMPLE;

            for (const payload of validPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(true);
            }

            for (const { payload } of invalidPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(false);
            }
        });

        it('should validate USER_UPDATE message type', () => {
            const { schema, validPayloads, invalidPayloads } = TEST_MESSAGE_TYPES.USER_UPDATE;

            for (const payload of validPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(true);
            }

            for (const { payload } of invalidPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(false);
            }
        });

        it('should validate DOCUMENT_CHANGE message type', () => {
            const { schema, validPayloads, invalidPayloads } = TEST_MESSAGE_TYPES.DOCUMENT_CHANGE;

            for (const payload of validPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(true);
            }

            for (const { payload } of invalidPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(false);
            }
        });

        it('should validate NOTIFICATION message type', () => {
            const { schema, validPayloads, invalidPayloads } = TEST_MESSAGE_TYPES.NOTIFICATION;

            for (const payload of validPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(true);
            }

            for (const { payload } of invalidPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(false);
            }
        });

        it('should validate API_REQUEST message type', () => {
            const { schema, validPayloads, invalidPayloads } = TEST_MESSAGE_TYPES.API_REQUEST;

            for (const payload of validPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(true);
            }

            for (const { payload } of invalidPayloads) {
                expect(validator.validate(payload, schema).valid).toBe(false);
            }
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle empty schema (any value allowed)', () => {
            const schema: JsonSchema = {};

            expect(validator.validate('string', schema).valid).toBe(true);
            expect(validator.validate(123, schema).valid).toBe(true);
            expect(validator.validate(null, schema).valid).toBe(true);
            expect(validator.validate({}, schema).valid).toBe(true);
            expect(validator.validate([], schema).valid).toBe(true);
        });

        it('should handle undefined values', () => {
            const schema: JsonSchema = {
                type: 'object',
                properties: {
                    value: { type: 'string' },
                },
            };

            // Property not present is OK (not required)
            expect(validator.validate({}, schema).valid).toBe(true);

            // Property with undefined value - depends on type check
            expect(validator.validate({ value: undefined }, schema).valid).toBe(false);
        });

        it('should handle very long strings', () => {
            const schema: JsonSchema = { type: 'string', maxLength: 10 };
            const longString = 'a'.repeat(1000);

            expect(validator.validate(longString, schema).valid).toBe(false);
        });

        it('should handle very large arrays', () => {
            const schema: JsonSchema = { type: 'array', maxLength: 5 };
            const largeArray = new Array(100).fill(1);

            expect(validator.validate(largeArray, schema).valid).toBe(false);
        });

        it('should handle negative array lengths (should pass - no items)', () => {
            const schema: JsonSchema = { type: 'array', minLength: -1 };

            expect(validator.validate([], schema).valid).toBe(true);
        });

        it('should handle special number values', () => {
            const schema: JsonSchema = { type: 'number' };

            expect(validator.validate(Infinity, schema).valid).toBe(true);
            expect(validator.validate(-Infinity, schema).valid).toBe(true);
            // NaN is typeof 'number' so passes type check
            expect(validator.validate(NaN, schema).valid).toBe(true);
        });

        it('should handle property name with special characters', () => {
            const schema: JsonSchema = {
                type: 'object',
                required: ['my-property', 'another.property'],
                properties: {
                    'my-property': { type: 'string' },
                    'another.property': { type: 'number' },
                },
            };

            expect(
                validator.validate({ 'my-property': 'test', 'another.property': 42 }, schema).valid
            ).toBe(true);
        });
    });
});
