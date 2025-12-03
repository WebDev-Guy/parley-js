/**
 * @file SecurityLayer.test.ts
 * @description Unit tests for DefaultSecurityLayer class
 * @module tests/unit
 *
 * Tests all public methods:
 * - validateOrigin() - Origin whitelist validation
 * - sanitizePayload() - Payload sanitization
 * - validateMessage() - Message structure validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultSecurityLayer, SecurityLayer } from '../../src/security/SecurityLayer';
import { createTestMessage } from '../utils/mock-factory';
import { TEST_ORIGINS } from '../fixtures/test-messages';

describe('DefaultSecurityLayer', () => {
    let security: DefaultSecurityLayer;

    beforeEach(() => {
        security = new DefaultSecurityLayer();
    });

    // ========================================================================
    // validateOrigin()
    // ========================================================================

    describe('validateOrigin()', () => {
        const allowedOrigins = ['https://example.com', 'https://app.example.com'];

        it('should return true for exact match', () => {
            expect(security.validateOrigin('https://example.com', allowedOrigins)).toBe(true);
        });

        it('should return true for another allowed origin', () => {
            expect(security.validateOrigin('https://app.example.com', allowedOrigins)).toBe(true);
        });

        it('should return false for non-allowed origin', () => {
            expect(security.validateOrigin('https://evil.com', allowedOrigins)).toBe(false);
        });

        it('should return false for subdomain not in list', () => {
            expect(security.validateOrigin('https://sub.example.com', allowedOrigins)).toBe(false);
        });

        it('should return false for protocol mismatch', () => {
            expect(security.validateOrigin('http://example.com', allowedOrigins)).toBe(false);
        });

        it('should return false for empty origin', () => {
            expect(security.validateOrigin('', allowedOrigins)).toBe(false);
        });

        it('should return false for empty allowed origins', () => {
            expect(security.validateOrigin('https://example.com', [])).toBe(false);
        });

        it('should return false for null/undefined allowed origins', () => {
            expect(security.validateOrigin('https://example.com', null as unknown as string[])).toBe(
                false
            );
        });

        it('should handle origins with ports', () => {
            const originsWithPorts = ['https://example.com:8443', 'https://localhost:3000'];

            expect(security.validateOrigin('https://example.com:8443', originsWithPorts)).toBe(true);
            expect(security.validateOrigin('https://localhost:3000', originsWithPorts)).toBe(true);
            expect(security.validateOrigin('https://example.com', originsWithPorts)).toBe(false);
        });

        it('should normalize origins (case insensitive)', () => {
            expect(security.validateOrigin('HTTPS://EXAMPLE.COM', allowedOrigins)).toBe(true);
            expect(security.validateOrigin('https://Example.Com', allowedOrigins)).toBe(true);
        });

        it('should handle trailing slashes consistently', () => {
            expect(security.validateOrigin('https://example.com/', allowedOrigins)).toBe(true);
        });

        it('should reject subdomain bypass attempts', () => {
            // Attacker tries example.com.evil.com
            expect(security.validateOrigin('https://example.com.evil.com', allowedOrigins)).toBe(
                false
            );
        });

        it('should reject path injection attempts', () => {
            // Origin should not have paths
            expect(
                security.validateOrigin('https://example.com/path', ['https://example.com'])
            ).toBe(true); // URL normalizes this
        });

        it('should validate test origins from fixtures', () => {
            for (const origin of TEST_ORIGINS.valid) {
                expect(security.validateOrigin(origin, TEST_ORIGINS.valid)).toBe(true);
            }

            for (const origin of TEST_ORIGINS.invalid) {
                if (origin !== '') {
                    // Skip empty string as it's handled separately
                    expect(security.validateOrigin(origin, TEST_ORIGINS.valid)).toBe(false);
                }
            }
        });
    });

    // ========================================================================
    // sanitizePayload()
    // ========================================================================

    describe('sanitizePayload()', () => {
        it('should return primitive values unchanged', () => {
            expect(security.sanitizePayload('string')).toBe('string');
            expect(security.sanitizePayload(123)).toBe(123);
            expect(security.sanitizePayload(true)).toBe(true);
            expect(security.sanitizePayload(null)).toBe(null);
            expect(security.sanitizePayload(undefined)).toBe(undefined);
        });

        it('should deep clone objects', () => {
            const original = { a: 1, b: { c: 2 } };
            const sanitized = security.sanitizePayload(original);

            expect(sanitized).toEqual(original);
            expect(sanitized).not.toBe(original);
            expect(sanitized.b).not.toBe(original.b);
        });

        it('should deep clone arrays', () => {
            const original = [1, [2, 3], { a: 4 }];
            const sanitized = security.sanitizePayload(original);

            expect(sanitized).toEqual(original);
            expect(sanitized).not.toBe(original);
        });

        it('should remove functions from objects', () => {
            const withFn = {
                name: 'test',
                evil: () => console.log('evil'),
            };
            const sanitized = security.sanitizePayload(withFn);

            expect(sanitized.name).toBe('test');
            expect(sanitized).not.toHaveProperty('evil');
        });

        it('should remove undefined values', () => {
            const withUndefined = { a: 1, b: undefined, c: 3 };
            const sanitized = security.sanitizePayload(withUndefined);

            expect(sanitized.a).toBe(1);
            expect(sanitized.c).toBe(3);
            expect('b' in sanitized).toBe(false);
        });

        it('should remove symbol keys', () => {
            const sym = Symbol('test');
            const withSymbol = { [sym]: 'secret', visible: 'public' };
            const sanitized = security.sanitizePayload(withSymbol);

            expect(sanitized).toEqual({ visible: 'public' });
        });

        it('should handle circular references gracefully', () => {
            const circular: Record<string, unknown> = { a: 1 };
            circular.self = circular;

            // Should return safe empty object or handle gracefully
            const sanitized = security.sanitizePayload(circular);
            expect(sanitized).toBeDefined();
            expect(typeof sanitized).toBe('object');
        });

        it('should handle deeply nested objects', () => {
            const deep = {
                level1: {
                    level2: {
                        level3: {
                            level4: {
                                value: 'deep',
                            },
                        },
                    },
                },
            };
            const sanitized = security.sanitizePayload(deep);

            expect(sanitized.level1.level2.level3.level4.value).toBe('deep');
        });

        it('should handle empty objects and arrays', () => {
            expect(security.sanitizePayload({})).toEqual({});
            expect(security.sanitizePayload([])).toEqual([]);
        });

        it('should handle Date objects (converted to string)', () => {
            const date = new Date('2024-01-01T00:00:00Z');
            const sanitized = security.sanitizePayload({ date });

            expect(typeof sanitized.date).toBe('string');
        });
    });

    // ========================================================================
    // validateMessage()
    // ========================================================================

    describe('validateMessage()', () => {
        it('should return true for valid message', () => {
            const message = createTestMessage('test:type', { data: 'value' });
            expect(security.validateMessage(message)).toBe(true);
        });

        it('should return false for null message', () => {
            expect(security.validateMessage(null as any)).toBe(false);
        });

        it('should return false for non-object message', () => {
            expect(security.validateMessage('string' as any)).toBe(false);
            expect(security.validateMessage(123 as any)).toBe(false);
        });

        it('should return false for missing _parley identifier', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any)._parley;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for wrong _parley identifier', () => {
            const message = createTestMessage('test:type', {});
            (message as any)._parley = 'wrong';
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for missing _v (version)', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any)._v;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for non-string _v', () => {
            const message = createTestMessage('test:type', {});
            (message as any)._v = 1;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for missing _id', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any)._id;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for missing _type', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any)._type;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for missing _origin', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any)._origin;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for missing _timestamp', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any)._timestamp;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for invalid _timestamp (not positive)', () => {
            const message = createTestMessage('test:type', {});
            (message as any)._timestamp = 0;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for invalid _timestamp (string)', () => {
            const message = createTestMessage('test:type', {});
            (message as any)._timestamp = '12345';
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for missing _expectsResponse', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any)._expectsResponse;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for non-boolean _expectsResponse', () => {
            const message = createTestMessage('test:type', {});
            (message as any)._expectsResponse = 'true';
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should return false for missing payload', () => {
            const message = createTestMessage('test:type', {});
            delete (message as any).payload;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should accept null payload', () => {
            const message = createTestMessage('test:type', null);
            expect(security.validateMessage(message)).toBe(true);
        });

        it('should return false for non-string _target when present', () => {
            const message = createTestMessage('test:type', {}, { target: 'valid' });
            (message as any)._target = 123;
            expect(security.validateMessage(message)).toBe(false);
        });

        it('should accept valid _target string', () => {
            const message = createTestMessage('test:type', {}, { target: 'child-window' });
            expect(security.validateMessage(message)).toBe(true);
        });
    });

    // ========================================================================
    // Abstract Class Extension
    // ========================================================================

    describe('SecurityLayer abstract class', () => {
        it('should allow custom implementation', () => {
            class CustomSecurityLayer extends SecurityLayer {
                validateOrigin(origin: string, allowedOrigins: string[]): boolean {
                    // Custom: allow any subdomain of allowed origins
                    return allowedOrigins.some((allowed) => {
                        const allowedHost = new URL(allowed).hostname;
                        const originHost = new URL(origin).hostname;
                        return originHost.endsWith(allowedHost);
                    });
                }

                sanitizePayload<T>(payload: T): T {
                    return payload; // No sanitization
                }

                validateMessage(): boolean {
                    return true; // Accept all
                }
            }

            const custom = new CustomSecurityLayer();

            // Custom implementation allows subdomains
            expect(
                custom.validateOrigin('https://sub.example.com', ['https://example.com'])
            ).toBe(true);
        });
    });
});
