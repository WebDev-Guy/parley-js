/**
 * @file SchemaValidator.ts
 * @description JSON Schema validator for Parley framework
 * @module parley-js/validation
 *
 * A simple, dependency-free JSON Schema validator.
 * Implements a subset of JSON Schema sufficient for message validation.
 *
 * Supported features:
 * - Type validation (string, number, integer, boolean, object, array, null)
 * - Required properties
 * - Property schemas
 * - Array item schemas
 * - Min/max for numbers
 * - MinLength/maxLength for strings and arrays
 * - Pattern matching for strings
 * - Enum values
 * - Nested object validation
 */

import type { JsonSchema } from '../types/MessageTypes';
import type { ValidationResult, ValidationErrorDetail } from './ValidationError';
import { validResult, invalidResult, createValidationError } from './ValidationError';

/**
 * JSON Schema validator class
 *
 * Validates data against JSON Schema definitions.
 *
 * @example
 * ```typescript
 * const validator = new SchemaValidator();
 *
 * const schema: JsonSchema = {
 *     type: 'object',
 *     required: ['name', 'age'],
 *     properties: {
 *         name: { type: 'string', minLength: 1 },
 *         age: { type: 'integer', minimum: 0 }
 *     }
 * };
 *
 * const result = validator.validate({ name: 'John', age: 30 }, schema);
 * if (!result.valid) {
 *     console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export class SchemaValidator {
    /**
     * Maximum depth for nested schema validation
     * Prevents stack overflow attacks via deeply nested schemas
     * @see https://owasp.org/www-community/attacks/xPath_Injection
     */
    private static readonly MAX_DEPTH = 50;

    /**
     * Validate data against a JSON Schema
     *
     * @param data - Data to validate
     * @param schema - JSON Schema to validate against
     * @returns Validation result
     */
    public validate(data: unknown, schema: JsonSchema): ValidationResult {
        return this._validateValue(data, schema, '');
    }

    /**
     * Validate data and throw if invalid
     *
     * @param data - Data to validate
     * @param schema - JSON Schema to validate against
     * @throws Error if validation fails
     */
    public assertValid(data: unknown, schema: JsonSchema): void {
        const result = this.validate(data, schema);
        if (!result.valid) {
            const errorMessages = result.errors
                .map((e) => `${e.path || 'root'}: ${e.message}`)
                .join('; ');
            throw new Error(`Validation failed: ${errorMessages}`);
        }
    }

    /**
     * Validate a value against a schema
     *
     * @param value - Value to validate
     * @param schema - Schema to validate against
     * @param path - Current path in the object (for error messages)
     * @returns Validation result
     */
    private _validateValue(
        value: unknown,
        schema: JsonSchema,
        path: string,
        depth: number = 0
    ): ValidationResult {
        // DoS prevention: check depth to prevent stack overflow from deeply nested schemas
        if (depth > SchemaValidator.MAX_DEPTH) {
            return invalidResult([
                createValidationError(
                    path,
                    `Schema nesting exceeds maximum depth of ${SchemaValidator.MAX_DEPTH}`,
                    {
                        rule: 'maxDepth',
                        expected: `<= ${SchemaValidator.MAX_DEPTH}`,
                        received: String(depth),
                    }
                ),
            ]);
        }

        const errors: ValidationErrorDetail[] = [];

        // Type validation
        if (schema.type !== undefined) {
            const typeErrors = this._validateType(value, schema.type, path);
            errors.push(...typeErrors);

            // If type is wrong, don't continue with other validations
            if (typeErrors.length > 0) {
                return invalidResult(errors);
            }
        }

        // Enum validation
        if (schema.enum !== undefined) {
            const enumErrors = this._validateEnum(value, schema.enum, path);
            errors.push(...enumErrors);
        }

        // Type-specific validations
        if (schema.type === 'string' && typeof value === 'string') {
            errors.push(...this._validateString(value, schema, path));
        }

        if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
            errors.push(...this._validateNumber(value, schema, path));
        }

        if (schema.type === 'array' && Array.isArray(value)) {
            errors.push(...this._validateArray(value, schema, path, depth));
        }

        if (schema.type === 'object' && value !== null && typeof value === 'object') {
            errors.push(
                ...this._validateObject(value as Record<string, unknown>, schema, path, depth)
            );
        }

        return errors.length === 0 ? validResult() : invalidResult(errors);
    }

    /**
     * Validate the type of a value
     *
     * @param value - Value to check
     * @param expectedType - Expected JSON Schema type
     * @param path - Current path
     * @returns Array of validation errors
     */
    private _validateType(
        value: unknown,
        expectedType: JsonSchema['type'],
        path: string
    ): ValidationErrorDetail[] {
        const actualType = this._getJsonType(value);

        // Handle integer as a special case of number
        if (expectedType === 'integer') {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                return [
                    createValidationError(path, `Expected integer but received ${actualType}`, {
                        expected: 'integer',
                        received: actualType,
                        rule: 'type',
                    }),
                ];
            }
            return [];
        }

        if (actualType !== expectedType) {
            return [
                createValidationError(path, `Expected ${expectedType} but received ${actualType}`, {
                    expected: expectedType,
                    received: actualType,
                    rule: 'type',
                }),
            ];
        }

        return [];
    }

    /**
     * Get the JSON Schema type of a value
     *
     * @param value - Value to get type for
     * @returns JSON Schema type string
     */
    private _getJsonType(value: unknown): string {
        if (value === null) {
            return 'null';
        }

        if (Array.isArray(value)) {
            return 'array';
        }

        const jsType = typeof value;

        if (jsType === 'object') {
            return 'object';
        }

        if (jsType === 'number') {
            return 'number';
        }

        return jsType;
    }

    /**
     * Validate a value against an enum
     *
     * @param value - Value to check
     * @param enumValues - Array of allowed values
     * @param path - Current path
     * @returns Array of validation errors
     */
    private _validateEnum(
        value: unknown,
        enumValues: unknown[],
        path: string
    ): ValidationErrorDetail[] {
        if (!enumValues.includes(value)) {
            return [
                createValidationError(
                    path,
                    `Value must be one of: ${enumValues.map(String).join(', ')}`,
                    {
                        expected: `enum[${enumValues.length}]`,
                        received: String(value),
                        rule: 'enum',
                    }
                ),
            ];
        }
        return [];
    }

    /**
     * Validate a string value
     *
     * @param value - String to validate
     * @param schema - Schema with string constraints
     * @param path - Current path
     * @returns Array of validation errors
     */
    private _validateString(
        value: string,
        schema: JsonSchema,
        path: string
    ): ValidationErrorDetail[] {
        const errors: ValidationErrorDetail[] = [];

        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(
                createValidationError(
                    path,
                    `String length ${value.length} is less than minimum ${schema.minLength}`,
                    {
                        expected: `>=${schema.minLength}`,
                        received: String(value.length),
                        rule: 'minLength',
                    }
                )
            );
        }

        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push(
                createValidationError(
                    path,
                    `String length ${value.length} is greater than maximum ${schema.maxLength}`,
                    {
                        expected: `<=${schema.maxLength}`,
                        received: String(value.length),
                        rule: 'maxLength',
                    }
                )
            );
        }

        if (schema.pattern !== undefined) {
            try {
                const regex = new RegExp(schema.pattern);
                if (!regex.test(value)) {
                    errors.push(
                        createValidationError(
                            path,
                            `String does not match pattern: ${schema.pattern}`,
                            { expected: schema.pattern, received: value, rule: 'pattern' }
                        )
                    );
                }
            } catch (error) {
                // Invalid regex - return validation error instead of throwing
                errors.push(
                    createValidationError(
                        path,
                        `Invalid regex pattern in schema: ${schema.pattern}`,
                        {
                            expected: 'valid-regex',
                            received: error instanceof Error ? error.message : 'unknown error',
                            rule: 'pattern',
                        }
                    )
                );
            }
        }

        return errors;
    }

    /**
     * Validate a number value
     *
     * @param value - Number to validate
     * @param schema - Schema with number constraints
     * @param path - Current path
     * @returns Array of validation errors
     */
    private _validateNumber(
        value: number,
        schema: JsonSchema,
        path: string
    ): ValidationErrorDetail[] {
        const errors: ValidationErrorDetail[] = [];

        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push(
                createValidationError(
                    path,
                    `Value ${value} is less than minimum ${schema.minimum}`,
                    { expected: `>=${schema.minimum}`, received: String(value), rule: 'minimum' }
                )
            );
        }

        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push(
                createValidationError(
                    path,
                    `Value ${value} is greater than maximum ${schema.maximum}`,
                    { expected: `<=${schema.maximum}`, received: String(value), rule: 'maximum' }
                )
            );
        }

        return errors;
    }

    /**
     * Validate an array value
     *
     * @param value - Array to validate
     * @param schema - Schema with array constraints
     * @param path - Current path
     * @param depth - Current nesting depth
     * @returns Array of validation errors
     */
    private _validateArray(
        value: unknown[],
        schema: JsonSchema,
        path: string,
        depth: number
    ): ValidationErrorDetail[] {
        const errors: ValidationErrorDetail[] = [];

        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(
                createValidationError(
                    path,
                    `Array length ${value.length} is less than minimum ${schema.minLength}`,
                    {
                        expected: `>=${schema.minLength}`,
                        received: String(value.length),
                        rule: 'minLength',
                    }
                )
            );
        }

        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push(
                createValidationError(
                    path,
                    `Array length ${value.length} is greater than maximum ${schema.maxLength}`,
                    {
                        expected: `<=${schema.maxLength}`,
                        received: String(value.length),
                        rule: 'maxLength',
                    }
                )
            );
        }

        // Validate each item against items schema
        if (schema.items !== undefined) {
            for (let i = 0; i < value.length; i++) {
                const itemPath = path ? `${path}[${i}]` : `[${i}]`;
                const itemResult = this._validateValue(value[i], schema.items, itemPath, depth + 1);
                errors.push(...itemResult.errors);
            }
        }

        return errors;
    }

    /**
     * Validate an object value
     *
     * @param value - Object to validate
     * @param schema - Schema with object constraints
     * @param path - Current path
     * @param depth - Current nesting depth
     * @returns Array of validation errors
     */
    private _validateObject(
        value: Record<string, unknown>,
        schema: JsonSchema,
        path: string,
        depth: number
    ): ValidationErrorDetail[] {
        const errors: ValidationErrorDetail[] = [];

        // Check required properties
        if (schema.required !== undefined) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in value)) {
                    const propPath = path ? `${path}.${requiredProp}` : requiredProp;
                    errors.push(
                        createValidationError(
                            propPath,
                            `Missing required property: ${requiredProp}`,
                            { rule: 'required' }
                        )
                    );
                }
            }
        }

        // Validate properties
        if (schema.properties !== undefined) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                if (propName in value) {
                    const propPath = path ? `${path}.${propName}` : propName;
                    const propResult = this._validateValue(
                        value[propName],
                        propSchema,
                        propPath,
                        depth + 1
                    );
                    errors.push(...propResult.errors);
                }
            }
        }

        // Check for additional properties
        if (schema.additionalProperties === false && schema.properties !== undefined) {
            const allowedProps = new Set(Object.keys(schema.properties));
            for (const propName of Object.keys(value)) {
                if (!allowedProps.has(propName)) {
                    const propPath = path ? `${path}.${propName}` : propName;
                    errors.push(
                        createValidationError(
                            propPath,
                            `Additional property not allowed: ${propName}`,
                            { rule: 'additionalProperties' }
                        )
                    );
                }
            }
        }

        return errors;
    }
}

/**
 * Default validator instance
 */
export const defaultValidator = new SchemaValidator();

/**
 * Convenience function for one-off validation
 *
 * @param data - Data to validate
 * @param schema - JSON Schema to validate against
 * @returns Validation result
 */
export function validateSchema(data: unknown, schema: JsonSchema): ValidationResult {
    return defaultValidator.validate(data, schema);
}
