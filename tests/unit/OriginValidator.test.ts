/**
 * @file OriginValidator.test.ts
 * @description Unit tests for OriginValidator functions
 * @module tests/unit
 *
 * Tests:
 * - validateOrigin() - Origin validation function
 * - assertOrigin() - Throws on invalid origin
 */

import { describe, it, expect } from 'vitest';
import { validateOrigin, assertOrigin } from '../../src/security/OriginValidator';
import { SecurityError } from '../../src/errors/ErrorTypes';
import { TEST_ORIGINS } from '../fixtures/test-messages';

describe('OriginValidator', () => {
    const allowedOrigins = TEST_ORIGINS.valid;

    // ========================================================================
    // validateOrigin()
    // ========================================================================

    describe('validateOrigin()', () => {
        it('should return valid=true for allowed origin', () => {
            const result = validateOrigin('https://example.com', allowedOrigins);

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return normalized origin', () => {
            const result = validateOrigin('HTTPS://EXAMPLE.COM', allowedOrigins);

            expect(result.valid).toBe(true);
            expect(result.normalizedOrigin).toBe('https://example.com');
        });

        it('should return valid=false for non-allowed origin', () => {
            const result = validateOrigin('https://evil.com', allowedOrigins);

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('not in the allowed list');
        });

        it('should return valid=false for empty origin', () => {
            const result = validateOrigin('', allowedOrigins);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('should return valid=false for empty allowed origins array', () => {
            const result = validateOrigin('https://example.com', []);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('No allowed origins');
        });

        it('should return valid=false for null allowed origins', () => {
            const result = validateOrigin('https://example.com', null as unknown as string[]);

            expect(result.valid).toBe(false);
        });

        it('should handle origins with ports', () => {
            const resultWithPort = validateOrigin('https://api.example.com:8443', allowedOrigins);
            expect(resultWithPort.valid).toBe(true);

            const resultWrongPort = validateOrigin(
                'https://example.com:9999',
                ['https://example.com:8443']
            );
            expect(resultWrongPort.valid).toBe(false);
        });

        it('should reject protocol mismatch', () => {
            const result = validateOrigin('http://example.com', ['https://example.com']);

            expect(result.valid).toBe(false);
        });

        it('should include origin in error message', () => {
            const result = validateOrigin('https://evil.com', allowedOrigins);

            expect(result.error).toContain('evil.com');
        });

        it('should validate all test origins correctly', () => {
            for (const origin of TEST_ORIGINS.valid) {
                const result = validateOrigin(origin, allowedOrigins);
                expect(result.valid).toBe(true);
            }

            for (const origin of TEST_ORIGINS.invalid) {
                // Skip empty string and special cases
                if (origin && !origin.startsWith('javascript:')) {
                    const result = validateOrigin(origin, allowedOrigins);
                    expect(result.valid).toBe(false);
                }
            }
        });
    });

    // ========================================================================
    // assertOrigin()
    // ========================================================================

    describe('assertOrigin()', () => {
        it('should not throw for valid origin', () => {
            expect(() => assertOrigin('https://example.com', allowedOrigins)).not.toThrow();
        });

        it('should throw SecurityError for invalid origin', () => {
            expect(() => assertOrigin('https://evil.com', allowedOrigins)).toThrow(SecurityError);
        });

        it('should throw SecurityError for empty origin', () => {
            expect(() => assertOrigin('', allowedOrigins)).toThrow(SecurityError);
        });

        it('should throw SecurityError for empty allowed origins', () => {
            expect(() => assertOrigin('https://example.com', [])).toThrow(SecurityError);
        });

        it('should include origin in error message', () => {
            try {
                assertOrigin('https://evil.com', allowedOrigins);
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('evil.com');
            }
        });

        it('should include SecurityError details', () => {
            try {
                assertOrigin('https://evil.com', allowedOrigins);
                expect.fail('Should have thrown');
            } catch (error) {
                if (error instanceof SecurityError) {
                    expect(error.name).toBe('SecurityError');
                } else {
                    expect.fail('Expected SecurityError');
                }
            }
        });

        it('should handle multiple allowed origins', () => {
            const origins = [
                'https://one.example.com',
                'https://two.example.com',
                'https://three.example.com',
            ];

            expect(() => assertOrigin('https://one.example.com', origins)).not.toThrow();
            expect(() => assertOrigin('https://two.example.com', origins)).not.toThrow();
            expect(() => assertOrigin('https://three.example.com', origins)).not.toThrow();
            expect(() => assertOrigin('https://four.example.com', origins)).toThrow(SecurityError);
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle localhost origins', () => {
            const localhostOrigins = [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
            ];

            const result1 = validateOrigin('http://localhost:3000', localhostOrigins);
            expect(result1.valid).toBe(true);

            const result2 = validateOrigin('http://127.0.0.1:3000', localhostOrigins);
            expect(result2.valid).toBe(true);
        });

        it('should handle IPv6 origins', () => {
            const ipv6Origins = ['http://[::1]:3000'];

            const result = validateOrigin('http://[::1]:3000', ipv6Origins);
            expect(result.valid).toBe(true);
        });

        it('should handle file:// origins', () => {
            // file:// origins are special and should typically be rejected
            const result = validateOrigin('file:///path/to/file.html', ['https://example.com']);
            expect(result.valid).toBe(false);
        });

        it('should handle very long origins', () => {
            const longSubdomain = 'a'.repeat(100);
            const longOrigin = `https://${longSubdomain}.example.com`;
            const result = validateOrigin(longOrigin, [longOrigin]);

            expect(result.valid).toBe(true);
        });

        it('should handle origins with special characters in subdomain', () => {
            // Punycode domains
            const punycodeOrigin = 'https://xn--nxasmq5b.com'; // Greek domain
            const result = validateOrigin(punycodeOrigin, [punycodeOrigin]);

            expect(result.valid).toBe(true);
        });

        it('should handle query strings in origin (should be stripped)', () => {
            // Origins shouldn't have query strings, but URL parsing should handle it
            const result = validateOrigin('https://example.com?param=value', ['https://example.com']);

            // The URL constructor will strip query params from origin
            expect(result.valid).toBe(true);
        });
    });
});
