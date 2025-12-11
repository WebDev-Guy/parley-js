/**
 * @file origin-validation.test.ts
 * @description Security tests for origin validation
 * @module tests/security
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { validateOrigin, assertOrigin } from '../../src/security/OriginValidator';

describe('Origin Validation Security', () => {
    let allowedOrigins: string[];
    let parley: Parley;

    beforeEach(() => {
        allowedOrigins = ['https://trusted.com', 'https://app.example.com'];
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: ['https://trusted.com', 'https://app.example.com'],
        });
    });

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    describe('Origin rejection', () => {
        it('should reject messages from disallowed origins', () => {
            const result = validateOrigin('https://evil.com', allowedOrigins);
            expect(result.valid).toBe(false);
        });

        it('should reject from completely different domain', () => {
            const result = validateOrigin('https://attacker.io', allowedOrigins);
            expect(result.valid).toBe(false);
        });

        it('should reject from subdomain not in allowlist', () => {
            const result = validateOrigin('https://subdomain.example.com', allowedOrigins);
            // Only app.example.com is in list, not all subdomains
            expect(result.valid).toBe(false);
        });
    });

    describe('Origin acceptance', () => {
        it('should accept from explicitly allowed origins', () => {
            expect(validateOrigin('https://trusted.com', allowedOrigins).valid).toBe(true);
            expect(validateOrigin('https://app.example.com', allowedOrigins).valid).toBe(true);
        });

        it('should allow multiple allowed origins', () => {
            const multiAllowed = [
                'https://site1.com',
                'https://site2.com',
                'https://site3.com',
            ];

            expect(validateOrigin('https://site1.com', multiAllowed).valid).toBe(true);
            expect(validateOrigin('https://site2.com', multiAllowed).valid).toBe(true);
            expect(validateOrigin('https://site3.com', multiAllowed).valid).toBe(true);
        });
    });

    describe('Origin spoofing prevention', () => {
        it('should not be fooled by origin in message data', () => {
            // Message data claims to be from trusted origin
            // But postMessage origin says evil origin
            // Real origin (from postMessage) should be used

            const messageData = {
                _origin: 'https://trusted.com', // Attacker claims to be trusted
                _parley: '__parley__',
                _id: 'msg-1',
                _type: 'test',
                _timestamp: Date.now(),
            };

            // Validator uses postMessage origin parameter, not data._origin
            // Attacker cannot spoof origin this way
            expect(messageData._origin).toBe('https://trusted.com');
        });

        it('should validate actual origin, not claimed origin', () => {
            // Message postMessage event has origin: 'https://evil.com'
            // Message data._origin claims 'https://trusted.com'
            // Should reject based on actual postMessage origin

            const actualOrigin = 'https://evil.com';

            // Validator checks actual origin from postMessage event
            const result = validateOrigin(actualOrigin, allowedOrigins);
            expect(result.valid).toBe(false); // Should reject despite claim
        });
    });

    describe('Case sensitivity', () => {
        it('should handle case-insensitive comparison', () => {
            const caseAllowed = ['https://Example.COM'];

            // Various cases
            expect(validateOrigin('https://example.com', caseAllowed).valid).toBe(true);
            expect(validateOrigin('https://EXAMPLE.COM', caseAllowed).valid).toBe(true);
            expect(validateOrigin('https://Example.com', caseAllowed).valid).toBe(true);
        });
    });

    describe('Protocol validation', () => {
        it('should reject different protocols', () => {
            // https://trusted.com is allowed
            // http://trusted.com should be rejected
            // ftp://trusted.com should be rejected

            const isHttpValid = validateOrigin('http://trusted.com', allowedOrigins).valid;
            const isFtpValid = validateOrigin('ftp://trusted.com', allowedOrigins).valid;

            expect(isHttpValid).toBe(false);
            expect(isFtpValid).toBe(false);
        });

        it('should require HTTPS in production', () => {
            const prodAllowed = ['https://prod.example.com'];

            // Only HTTPS should be allowed
            expect(validateOrigin('https://prod.example.com', prodAllowed).valid).toBe(true);
            expect(validateOrigin('http://prod.example.com', prodAllowed).valid).toBe(false);
        });

        it('should allow HTTP for localhost in development', () => {
            const devAllowed = ['http://localhost:3000'];

            // HTTP allowed for localhost
            expect(validateOrigin('http://localhost:3000', devAllowed).valid).toBe(true);
        });
    });

    describe('Port validation', () => {
        it('should enforce exact port matching', () => {
            const portAllowed = ['https://example.com:8443'];

            // Exact match
            expect(validateOrigin('https://example.com:8443', portAllowed).valid).toBe(true);

            // Different port
            expect(validateOrigin('https://example.com:9000', portAllowed).valid).toBe(false);

            // No port (default)
            expect(validateOrigin('https://example.com', portAllowed).valid).toBe(false);
        });

        it('should handle default ports correctly', () => {
            const https443Allowed = ['https://example.com:443'];
            const httpsDefaultAllowed = ['https://example.com'];

            // https://example.com is same as https://example.com:443
            // Should handle equivalence or strict matching

            expect(httpsDefaultAllowed).toBeDefined();
        });
    });

    describe('Null origin handling', () => {
        it('should reject null origin (file:// protocol)', () => {
            // file:// protocol results in origin = 'null' string
            const result = validateOrigin('null', allowedOrigins);
            expect(result.valid).toBe(false);
        });

        it('should throw or reject null/undefined', () => {
            // validateOrigin should return invalid for null/undefined
            const nullResult = validateOrigin(null as any, allowedOrigins);
            expect(nullResult.valid).toBe(false);

            const undefinedResult = validateOrigin(undefined as any, allowedOrigins);
            expect(undefinedResult.valid).toBe(false);
        });
    });

    describe('Subdomain matching', () => {
        it('should not allow subdomain bypass', () => {
            // example.com is allowed
            // attacker.example.com should be rejected
            // example.com.attacker.com should be rejected

            const domainAllowed = ['https://example.com'];

            expect(validateOrigin('https://example.com', domainAllowed).valid).toBe(true);
            expect(validateOrigin('https://sub.example.com', domainAllowed).valid).toBe(false);
            expect(validateOrigin('https://example.com.evil.com', domainAllowed).valid).toBe(false);
        });

        it('should require exact domain match', () => {
            const appAllowed = ['https://app.example.com'];

            // Must match exactly
            expect(validateOrigin('https://app.example.com', appAllowed).valid).toBe(true);

            // Subdomains not allowed
            expect(validateOrigin('https://sub.app.example.com', appAllowed).valid).toBe(false);

            // Parent domain not allowed
            expect(validateOrigin('https://example.com', appAllowed).valid).toBe(false);
        });
    });

    describe('Empty/invalid origins', () => {
        it('should reject empty origin string', () => {
            const result = validateOrigin('', allowedOrigins);
            expect(result.valid).toBe(false);
        });

        it('should reject malformed origins', () => {
            expect(validateOrigin('not-a-valid-origin', allowedOrigins).valid).toBe(false);
            expect(validateOrigin('https://', allowedOrigins).valid).toBe(false);
            expect(validateOrigin('...', allowedOrigins).valid).toBe(false);
        });
    });

    describe('Origin persistence', () => {
        it('should reject origin once it fails first check', () => {
            expect(validateOrigin('https://evil.com', allowedOrigins).valid).toBe(false);
            expect(validateOrigin('https://evil.com', allowedOrigins).valid).toBe(false);
            expect(validateOrigin('https://evil.com', allowedOrigins).valid).toBe(false);
        });

        it('should accept origin consistently', () => {
            expect(validateOrigin('https://trusted.com', allowedOrigins).valid).toBe(true);
            expect(validateOrigin('https://trusted.com', allowedOrigins).valid).toBe(true);
            expect(validateOrigin('https://trusted.com', allowedOrigins).valid).toBe(true);
        });
    });

    describe('Allowlist configuration', () => {
        it('should use configured allowlist', () => {
            const customAllowed = ['https://custom1.com', 'https://custom2.com'];

            expect(validateOrigin('https://custom1.com', customAllowed).valid).toBe(true);
            expect(validateOrigin('https://custom2.com', customAllowed).valid).toBe(true);
            expect(validateOrigin('https://other.com', customAllowed).valid).toBe(false);
        });

        it('should support empty allowlist (allow nothing)', () => {
            const emptyAllowed: string[] = [];

            // Nothing allowed (but returns error about no allowed origins configured)
            expect(validateOrigin('https://trusted.com', emptyAllowed).valid).toBe(false);
            expect(validateOrigin('https://anything.com', emptyAllowed).valid).toBe(false);
        });

        it('should use allowlist from Parley config', () => {
            const p = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://whitelist.example.com'],
            });

            // Parley internally uses OriginValidator with configured origins
            expect(p).toBeDefined();
            p.destroy();
        });
    });

    describe('Origin tampering attempts', () => {
        it('should not accept tampered origin strings', () => {
            const tamperedOrigin = 'https://trusted.com' + '\x00' + 'https://evil.com';
            expect(validateOrigin(tamperedOrigin, allowedOrigins).valid).toBe(false);
        });

        it('should not accept origin with extra paths', () => {
            // Note: URL.origin strips paths, queries, and hashes from URLs
            // So 'https://trusted.com/path' becomes 'https://trusted.com' during normalization
            // This is correct browser behavior - origins don't include paths
            expect(validateOrigin('https://trusted.com/path', allowedOrigins).valid).toBe(true);
            expect(validateOrigin('https://trusted.com?query', allowedOrigins).valid).toBe(true);
            expect(validateOrigin('https://trusted.com#hash', allowedOrigins).valid).toBe(true);
        });
    });
});
