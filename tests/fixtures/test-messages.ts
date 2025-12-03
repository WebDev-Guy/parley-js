/**
 * @file test-messages.ts
 * @description Standard test messages and schemas for validation testing
 * @module tests/fixtures
 *
 * Provides reusable test data for message validation tests.
 */

import type { JsonSchema } from '../../src/types/MessageTypes';

/**
 * Test message type definition
 */
export interface TestMessageDefinition {
    type: string;
    schema: JsonSchema;
    validPayloads: unknown[];
    invalidPayloads: Array<{ payload: unknown; expectedError: string }>;
}

/**
 * Standard test messages and their JSON schemas for validation testing.
 */
export const TEST_MESSAGE_TYPES: Record<string, TestMessageDefinition> = {
    /**
     * Simple message with a single string field
     */
    SIMPLE: {
        type: 'test:simple',
        schema: {
            type: 'object',
            properties: {
                text: { type: 'string' },
            },
            required: ['text'],
        },
        validPayloads: [
            { text: 'Hello, Parley!' },
            { text: '' },
            { text: 'A very long message that spans multiple lines\nand has special characters: !@#$%^&*()' },
        ],
        invalidPayloads: [
            { payload: {}, expectedError: 'required' },
            { payload: { text: 123 }, expectedError: 'type' },
            { payload: null, expectedError: 'type' },
            { payload: 'not an object', expectedError: 'type' },
        ],
    },

    /**
     * User update message with required and optional fields
     */
    USER_UPDATE: {
        type: 'user:update',
        schema: {
            type: 'object',
            properties: {
                userId: { type: 'number' },
                name: { type: 'string', minLength: 1 },
                email: { type: 'string' },
                active: { type: 'boolean' },
            },
            required: ['userId'],
        },
        validPayloads: [
            { userId: 123 },
            { userId: 456, name: 'John Doe' },
            { userId: 789, name: 'Jane', email: 'jane@example.com', active: true },
        ],
        invalidPayloads: [
            { payload: {}, expectedError: 'required' },
            { payload: { userId: '123' }, expectedError: 'type' },
            { payload: { userId: 123, name: '' }, expectedError: 'minLength' },
        ],
    },

    /**
     * Document change message with nested arrays
     */
    DOCUMENT_CHANGE: {
        type: 'document:change',
        schema: {
            type: 'object',
            properties: {
                documentId: { type: 'string', minLength: 1 },
                version: { type: 'integer', minimum: 1 },
                changes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            field: { type: 'string' },
                            oldValue: {},
                            newValue: {},
                        },
                        required: ['field'],
                    },
                    minLength: 1,
                },
            },
            required: ['documentId', 'changes'],
        },
        validPayloads: [
            {
                documentId: 'doc-123',
                changes: [{ field: 'title', oldValue: 'Old', newValue: 'New' }],
            },
            {
                documentId: 'doc-456',
                version: 5,
                changes: [
                    { field: 'status', oldValue: 'draft', newValue: 'published' },
                    { field: 'updatedAt', oldValue: null, newValue: '2024-01-01' },
                ],
            },
        ],
        invalidPayloads: [
            { payload: { documentId: 'doc-1' }, expectedError: 'required' },
            { payload: { documentId: '', changes: [{ field: 'x' }] }, expectedError: 'minLength' },
            { payload: { documentId: 'doc-1', changes: [] }, expectedError: 'minLength' },
            { payload: { documentId: 'doc-1', version: 1.5, changes: [{ field: 'x' }] }, expectedError: 'integer' },
        ],
    },

    /**
     * Notification message with enum values
     */
    NOTIFICATION: {
        type: 'notification:send',
        schema: {
            type: 'object',
            properties: {
                level: { type: 'string', enum: ['info', 'warning', 'error'] },
                message: { type: 'string', minLength: 1, maxLength: 500 },
                timestamp: { type: 'number' },
            },
            required: ['level', 'message'],
        },
        validPayloads: [
            { level: 'info', message: 'Hello' },
            { level: 'warning', message: 'Be careful', timestamp: Date.now() },
            { level: 'error', message: 'Something went wrong' },
        ],
        invalidPayloads: [
            { payload: { level: 'debug', message: 'test' }, expectedError: 'enum' },
            { payload: { level: 'info', message: '' }, expectedError: 'minLength' },
            { payload: { level: 'info', message: 'x'.repeat(501) }, expectedError: 'maxLength' },
        ],
    },

    /**
     * Request message with pattern validation
     */
    API_REQUEST: {
        type: 'api:request',
        schema: {
            type: 'object',
            properties: {
                endpoint: { type: 'string', pattern: '^/api/v[0-9]+/' },
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
                headers: {
                    type: 'object',
                },
            },
            required: ['endpoint', 'method'],
        },
        validPayloads: [
            { endpoint: '/api/v1/users', method: 'GET' },
            { endpoint: '/api/v2/documents', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        ],
        invalidPayloads: [
            { payload: { endpoint: '/users', method: 'GET' }, expectedError: 'pattern' },
            { payload: { endpoint: '/api/v1/users', method: 'PATCH' }, expectedError: 'enum' },
        ],
    },
};

/**
 * Sample valid payloads for quick testing
 */
export const SAMPLE_PAYLOADS = {
    simple: { text: 'Hello, Parley!' },
    userUpdate: { userId: 123, name: 'Test User' },
    documentChange: {
        documentId: 'doc-123',
        changes: [{ field: 'verified', oldValue: false, newValue: true }],
    },
    notification: { level: 'info' as const, message: 'Test notification' },
};

/**
 * Invalid payloads for error testing
 */
export const INVALID_PAYLOADS = {
    nullValue: null,
    undefinedValue: undefined,
    emptyObject: {},
    wrongType: 'not an object',
    missingRequired: { optional: 'value' },
    wrongFieldType: { text: 12345 },
    circularReference: (() => {
        const obj: Record<string, unknown> = {};
        obj.self = obj;
        return obj;
    })(),
};

/**
 * Test origins for security testing
 */
export const TEST_ORIGINS = {
    valid: [
        'https://example.com',
        'https://app.example.com',
        'https://api.example.com:8443',
    ],
    invalid: [
        'http://example.com', // Wrong protocol
        'https://evil.com',
        'https://example.com.evil.com',
        'javascript:alert(1)',
        '',
        'null',
    ],
};

/**
 * Create a message type registration options object
 */
export function createRegistrationOptions(schema?: JsonSchema, timeout?: number) {
    return {
        ...(schema && { schema }),
        ...(timeout && { timeout }),
    };
}
