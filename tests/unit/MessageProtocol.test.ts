/**
 * @file MessageProtocol.test.ts
 * @description Unit tests for the MessageProtocol module
 * @module tests/unit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    createMessage,
    validateMessageProtocol,
    PROTOCOL_VERSION,
    PARLEY_MESSAGE_IDENTIFIER,
    INTERNAL_MESSAGE_TYPES,
    type MessageProtocol,
} from '../../src/core/MessageProtocol';
import { ValidationError } from '../../src/errors/ErrorTypes';

describe('MessageProtocol', () => {
    describe('createMessage()', () => {
        it('should create message with all required fields', () => {
            const message = createMessage({ type: 'test:type', payload: { data: 'test' } });

            expect(message._parley).toBe(PARLEY_MESSAGE_IDENTIFIER);
            expect(message._v).toBe(PROTOCOL_VERSION);
            expect(message._type).toBe('test:type');
            expect(message._origin).toBeDefined();
            expect(message._timestamp).toBeDefined();
            expect(message._id).toBeDefined();
            expect(typeof message._id).toBe('string');
            expect(typeof message._timestamp).toBe('number');
        });

        it('should generate unique IDs for each message', () => {
            const msg1 = createMessage({ type: 'test:type', payload: {} });
            const msg2 = createMessage({ type: 'test:type', payload: {} });

            expect(msg1._id).not.toBe(msg2._id);
        });

        it('should include payload in message', () => {
            const payload = { name: 'John', age: 30 };
            const message = createMessage({ type: 'user:update', payload });

            expect(message.payload).toEqual(payload);
        });

        it('should set expectsResponse to true by default', () => {
            const message = createMessage({ type: 'test:type', payload: {} });

            expect(message._expectsResponse).toBe(true);
        });

        it('should set expectsResponse to false when specified', () => {
            const message = createMessage({
                type: 'test:type',
                payload: {},
                expectsResponse: false
            });

            expect(message._expectsResponse).toBe(false);
        });

        it('should include target ID when provided', () => {
            const message = createMessage({
                type: 'test:type',
                payload: {},
                expectsResponse: false,
                target: 'target-123'
            });

            expect(message._target).toBe('target-123');
        });

        it('should create timestamp close to current time', () => {
            const before = Date.now();
            const message = createMessage({ type: 'test:type', payload: {} });
            const after = Date.now();

            expect(message._timestamp).toBeGreaterThanOrEqual(before);
            expect(message._timestamp).toBeLessThanOrEqual(after);
        });

        it('should handle complex nested payloads', () => {
            const payload = {
                user: {
                    name: 'John',
                    roles: ['admin', 'user'],
                    metadata: {
                        lastLogin: '2025-12-10',
                    },
                },
            };

            const message = createMessage({ type: 'complex:message', payload });

            expect(message.payload).toEqual(payload);
        });

        it('should handle array payloads', () => {
            const payload = [1, 2, 3, 4, 5];
            const message = createMessage({ type: 'array:message', payload });

            expect(message.payload).toEqual(payload);
        });

        it('should handle null/empty payloads', () => {
            const message1 = createMessage({ type: 'test:type', payload: null });
            const message2 = createMessage({ type: 'test:type', payload: undefined });
            const message3 = createMessage({ type: 'test:type', payload: {} });

            expect(message1.payload).toBeNull();
            expect(message2.payload).toBeUndefined();
            expect(message3.payload).toEqual({});
        });
    });

    describe('validateMessageProtocol()', () => {
        let validMessage: MessageProtocol;

        beforeEach(() => {
            validMessage = createMessage({ type: 'test:type', payload: { data: 'test' } });
        });

        it('should validate correct message', () => {
            expect(() => validateMessageProtocol(validMessage)).not.toThrow();
        });

        it('should reject message missing _parley identifier', () => {
            const invalid = { ...validMessage, _parley: 'invalid' };
            expect(() => validateMessageProtocol(invalid)).toThrow(ValidationError);
        });

        it('should reject message with missing _id', () => {
            const invalid = { ...validMessage };
            delete (invalid as any)._id;
            expect(() => validateMessageProtocol(invalid)).toThrow(ValidationError);
        });

        it('should reject message with missing _type', () => {
            const invalid = { ...validMessage };
            delete (invalid as any)._type;
            expect(() => validateMessageProtocol(invalid)).toThrow(ValidationError);
        });

        it('should reject message with missing _origin', () => {
            const invalid = { ...validMessage };
            delete (invalid as any)._origin;
            expect(() => validateMessageProtocol(invalid)).toThrow(ValidationError);
        });

        it('should reject message with missing _timestamp', () => {
            const invalid = { ...validMessage };
            delete (invalid as any)._timestamp;
            expect(() => validateMessageProtocol(invalid)).toThrow(ValidationError);
        });

        it('should reject message with missing _v', () => {
            const invalid = { ...validMessage };
            delete (invalid as any)._v;
            expect(() => validateMessageProtocol(invalid)).toThrow(ValidationError);
        });

        it('should reject message with wrong type for _id', () => {
            const invalid = { ...validMessage, _id: 123 };
            expect(() => validateMessageProtocol(invalid as any)).toThrow(ValidationError);
        });

        it('should reject message with wrong type for _type', () => {
            const invalid = { ...validMessage, _type: 123 };
            expect(() => validateMessageProtocol(invalid as any)).toThrow(ValidationError);
        });

        it('should reject message with wrong type for _origin', () => {
            const invalid = { ...validMessage, _origin: 123 };
            expect(() => validateMessageProtocol(invalid as any)).toThrow(ValidationError);
        });

        it('should reject message with wrong type for _expectsResponse', () => {
            const invalid = { ...validMessage, _expectsResponse: 'yes' };
            expect(() => validateMessageProtocol(invalid as any)).toThrow(ValidationError);
        });

        it('should accept message with optional _target', () => {
            const valid = { ...validMessage, _target: 'target-123' };
            expect(() => validateMessageProtocol(valid)).not.toThrow();
        });

        it('should accept message with null payload', () => {
            const valid = { ...validMessage, payload: null };
            expect(() => validateMessageProtocol(valid)).not.toThrow();
        });
    });

    describe('INTERNAL_MESSAGE_TYPES', () => {
        it('should define handshake init type', () => {
            expect(INTERNAL_MESSAGE_TYPES.HANDSHAKE_INIT).toBeDefined();
            expect(typeof INTERNAL_MESSAGE_TYPES.HANDSHAKE_INIT).toBe('string');
        });

        it('should define handshake ack type', () => {
            expect(INTERNAL_MESSAGE_TYPES.HANDSHAKE_ACK).toBeDefined();
            expect(typeof INTERNAL_MESSAGE_TYPES.HANDSHAKE_ACK).toBe('string');
        });

        it('should define ping type', () => {
            expect(INTERNAL_MESSAGE_TYPES.PING).toBeDefined();
            expect(typeof INTERNAL_MESSAGE_TYPES.PING).toBe('string');
        });

        it('should define pong type', () => {
            expect(INTERNAL_MESSAGE_TYPES.PONG).toBeDefined();
            expect(typeof INTERNAL_MESSAGE_TYPES.PONG).toBe('string');
        });

        it('should have unique type values', () => {
            const types = Object.values(INTERNAL_MESSAGE_TYPES);
            const uniqueTypes = new Set(types);
            expect(uniqueTypes.size).toBe(types.length);
        });
    });

    describe('Protocol version', () => {
        it('should be valid semver', () => {
            const semverRegex = /^\d+\.\d+\.\d+$/;
            expect(PROTOCOL_VERSION).toMatch(semverRegex);
        });

        it('should be consistent across messages', () => {
            const msg1 = createMessage({ type: 'test:1', payload: {} });
            const msg2 = createMessage({ type: 'test:2', payload: {} });

            expect(msg1._v).toBe(msg2._v);
            expect(msg1._v).toBe(PROTOCOL_VERSION);
        });
    });

    describe('Message identifier', () => {
        it('should be consistent', () => {
            const msg1 = createMessage({ type: 'test:type', payload: {} });
            const msg2 = createMessage({ type: 'test:type', payload: {} });

            expect(msg1._parley).toBe(msg2._parley);
            expect(msg1._parley).toBe(PARLEY_MESSAGE_IDENTIFIER);
        });

        it('should be easily identifiable', () => {
            const message = createMessage({ type: 'test:type', payload: {} });
            expect(message._parley).toContain('parley');
        });
    });
});
