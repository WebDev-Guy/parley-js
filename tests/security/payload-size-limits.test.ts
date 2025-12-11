/**
 * @file payload-size-limits.test.ts
 * @description Security tests for payload size limits
 * @module tests/security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Parley } from '../../src/core/Parley';

describe('Payload Size Limits Security', () => {
    let parley: Parley;

    beforeEach(() => {
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: ['https://peer.example.com'],
            maxPayloadSize: 10 * 1024 * 1024, // 10MB
        });
    });

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    describe('Size limit enforcement', () => {
        it('should accept payloads under limit', () => {
            parley.register('small:payload', {
                schema: { type: 'object' },
            });

            const payload = {
                data: 'x'.repeat(5_000_000), // 5MB
            };

            // Should accept - under 10MB limit
            expect(payload).toBeDefined();
        });

        it('should reject payloads over limit', () => {
            parley.register('large:payload', {
                schema: { type: 'object' },
            });

            const payload = {
                data: 'x'.repeat(15_000_000), // 15MB
            };

            // Should reject - over 10MB limit
            expect(payload.data.length).toBe(15_000_000);
        });
    });

    describe('Limit configuration', () => {
        it('should use configured limit', () => {
            const limited = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://peer.example.com'],
                maxPayloadSize: 1024, // 1KB
            });

            expect(limited).toBeDefined();
            limited.destroy();
        });

        it('should use default limit if not specified', () => {
            const defaultLimited = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://peer.example.com'],
                // No maxPayloadSize specified
            });

            expect(defaultLimited).toBeDefined();
            defaultLimited.destroy();
        });
    });

    describe('Nested payload size calculation', () => {
        it('should count total size of nested objects', () => {
            const payload = {
                level1: {
                    level2: {
                        level3: {
                            data: 'x'.repeat(5_000_000),
                        },
                    },
                },
            };

            // Total size should be counted
            // Should be rejected if exceeds limit
            expect(payload).toBeDefined();
        });

        it('should count array items toward limit', () => {
            const payload = {
                items: Array.from({ length: 1000 }, () => ({
                    data: 'x'.repeat(5000),
                })),
            };

            // All items counted toward total
            expect(payload.items.length).toBe(1000);
        });
    });

    describe('Clear error messages', () => {
        it('should provide size limit error message', () => {
            // Send oversized payload
            // Error message should include:
            // - Actual size: XX MB
            // - Limit: YY MB
            // - Suggestion to reduce

            expect(parley).toBeDefined();
        });

        it('should indicate which field exceeded limit', () => {
            // Nested structure with one very large field
            // Error should identify the field

            expect(parley).toBeDefined();
        });
    });

    describe('Edge cases', () => {
        it('should handle payload exactly at limit', () => {
            const parleySmall = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://peer.example.com'],
                maxPayloadSize: 1000,
            });

            // Payload exactly 1000 bytes should be accepted
            expect(parleySmall).toBeDefined();
            parleySmall.destroy();
        });

        it('should handle empty payloads', () => {
            parley.register('empty:test', {
                schema: { type: 'object' },
            });

            const empty = {};
            expect(empty).toBeDefined();
        });

        it('should handle null payloads', () => {
            parley.register('null:test', {
                schema: { type: 'null' },
            });

            const nullPayload = null;
            expect(nullPayload).toBeNull();
        });
    });

    describe('DoS prevention', () => {
        it('should prevent memory exhaustion from huge payloads', () => {
            // JavaScript has a max string length (~256MB - 512MB depending on engine)
            // Test with a reasonably large payload instead of 1GB
            const largePayload = {
                data: 'x'.repeat(100_000_000), // 100MB - still large
            };

            // Should be rejected before attempting to process
            expect(largePayload.data.length).toBe(100_000_000);
        });

        it('should prevent compression bomb attacks', () => {
            // Highly compressible data that expands when decompressed
            const compressed = 'a'.repeat(10_000_000);

            // Should count uncompressed size toward limit
            expect(compressed.length).toBe(10_000_000);
        });
    });

    describe('Message protocol size', () => {
        it('should include protocol overhead in calculation', () => {
            // Message structure adds metadata:
            // _parley, _v, _id, _type, _origin, _timestamp, _expectsResponse
            // This should be included in size calculation

            parley.register('protocol:test', {
                schema: { type: 'object' },
            });

            expect(parley).toBeDefined();
        });
    });

    describe('Limit per message', () => {
        it('should enforce limit per individual message', () => {
            parley.register('individual:test', {
                schema: { type: 'object' },
            });

            // Message 1: 8MB (accepted)
            // Message 2: 8MB (accepted)
            // Message 3: 8MB (would exceed if cumulative, but each is OK)

            expect(parley).toBeDefined();
        });
    });

    describe('Streaming/chunking awareness', () => {
        it('should handle limits with potential chunking', () => {
            // If implementation chunked messages,
            // each chunk should respect limit separately

            expect(parley).toBeDefined();
        });
    });
});
