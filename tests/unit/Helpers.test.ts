/**
 * @file Helpers.test.ts
 * @description Unit tests for utility helper functions
 * @module tests/unit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    generateUUID,
    getTimestamp,
    getCurrentOrigin,
    deepClone,
} from '../../src/utils/Helpers';

describe('Helpers', () => {
    describe('generateUUID()', () => {
        it('should generate valid UUID v4', () => {
            const uuid = generateUUID();
            const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuid).toMatch(uuidRegex);
        });

        it('should generate unique UUIDs', () => {
            const uuid1 = generateUUID();
            const uuid2 = generateUUID();
            const uuid3 = generateUUID();

            const unique = new Set([uuid1, uuid2, uuid3]);
            expect(unique.size).toBe(3);
        });

        it('should generate proper length UUID', () => {
            const uuid = generateUUID();
            expect(uuid.length).toBe(36); // Standard UUID length with hyphens
        });

        it('should include hyphens in correct positions', () => {
            const uuid = generateUUID();
            const parts = uuid.split('-');
            expect(parts.length).toBe(5);
            expect(parts[0].length).toBe(8);
            expect(parts[1].length).toBe(4);
            expect(parts[2].length).toBe(4);
            expect(parts[3].length).toBe(4);
            expect(parts[4].length).toBe(12);
        });
    });

    describe('getTimestamp()', () => {
        it('should return current timestamp in milliseconds', () => {
            const before = Date.now();
            const timestamp = getTimestamp();
            const after = Date.now();

            expect(timestamp).toBeGreaterThanOrEqual(before);
            expect(timestamp).toBeLessThanOrEqual(after);
        });

        it('should return number type', () => {
            const timestamp = getTimestamp();
            expect(typeof timestamp).toBe('number');
        });

        it('should return positive number', () => {
            const timestamp = getTimestamp();
            expect(timestamp).toBeGreaterThan(0);
        });

        it('should be consistent with Date.now()', () => {
            const dateNow = Date.now();
            const timestamp = getTimestamp();

            // Should be very close (within 10ms)
            expect(Math.abs(timestamp - dateNow)).toBeLessThan(10);
        });

        it('should increase with time', async () => {
            const time1 = getTimestamp();
            // Sleep 10ms to ensure time difference
            await new Promise(resolve => setTimeout(resolve, 10));
            const time2 = getTimestamp();

            expect(time2).toBeGreaterThanOrEqual(time1);
        });
    });

    describe('getCurrentOrigin()', () => {
        it('should return string type', () => {
            const origin = getCurrentOrigin();
            expect(typeof origin).toBe('string');
        });

        it('should include protocol', () => {
            const origin = getCurrentOrigin();
            expect(origin).toMatch(/^https?:\/\//);
        });

        it('should include hostname', () => {
            const origin = getCurrentOrigin();
            const parts = origin.split('://');
            expect(parts[1]).toBeTruthy();
        });

        it('should handle port in origin', () => {
            const origin = getCurrentOrigin();
            // Should be in format protocol://hostname or protocol://hostname:port
            const urlRegex = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/;
            expect(origin).toMatch(urlRegex);
        });

        it('should be lowercase', () => {
            const origin = getCurrentOrigin();
            expect(origin).toBe(origin.toLowerCase());
        });
    });

    describe('deepClone()', () => {
        it('should clone primitive values', () => {
            expect(deepClone(42)).toBe(42);
            expect(deepClone('string')).toBe('string');
            expect(deepClone(true)).toBe(true);
            expect(deepClone(null)).toBe(null);
            expect(deepClone(undefined)).toBe(undefined);
        });

        it('should clone objects', () => {
            const obj = { a: 1, b: 2, c: 3 };
            const cloned = deepClone(obj);

            expect(cloned).toEqual(obj);
            expect(cloned).not.toBe(obj);
        });

        it('should clone arrays', () => {
            const arr = [1, 2, 3, 4, 5];
            const cloned = deepClone(arr);

            expect(cloned).toEqual(arr);
            expect(cloned).not.toBe(arr);
        });

        it('should clone nested objects', () => {
            const nested = {
                user: {
                    name: 'John',
                    age: 30,
                },
                tags: ['admin', 'user'],
            };

            const cloned = deepClone(nested);

            expect(cloned).toEqual(nested);
            expect(cloned).not.toBe(nested);
            expect(cloned.user).not.toBe(nested.user);
            expect(cloned.tags).not.toBe(nested.tags);
        });

        it('should clone deeply nested structures', () => {
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

            const cloned = deepClone(deep);

            expect(cloned).toEqual(deep);
            expect((cloned as any).level1.level2.level3.level4).not.toBe(
                (deep as any).level1.level2.level3.level4
            );
        });

        it('should clone arrays within objects', () => {
            const obj = {
                items: [1, 2, { nested: true }],
            };

            const cloned = deepClone(obj);

            expect(cloned).toEqual(obj);
            expect(cloned.items).not.toBe(obj.items);
            expect((cloned.items[2] as any).nested).toBe(true);
        });

        it('should not clone functions', () => {
            const obj = {
                name: 'test',
                fn: () => 'test',
            };

            const cloned = deepClone(obj);

            // Function should be removed or undefined
            expect((cloned as any).fn).toBeUndefined();
        });

        it('should not clone symbols', () => {
            const sym = Symbol('test');
            const obj = {
                [sym]: 'value',
                name: 'test',
            };

            const cloned = deepClone(obj);

            expect(sym in cloned).toBe(false);
            expect(cloned.name).toBe('test');
        });

        it('should handle circular references without stack overflow', () => {
            const circular: any = { a: 1 };
            circular.self = circular;

            // deepClone uses JSON, so circular references throw
            // but should throw a clean error, not stack overflow
            expect(() => deepClone(circular)).toThrow('Object cannot be serialized to JSON');
        });

        it('should remove undefined values', () => {
            const obj = {
                a: 1,
                b: undefined,
                c: 3,
            };

            const cloned = deepClone(obj);

            expect('b' in cloned).toBe(false);
            expect(cloned.a).toBe(1);
            expect(cloned.c).toBe(3);
        });

        it('should preserve null values', () => {
            const obj = {
                a: 1,
                b: null,
                c: 3,
            };

            const cloned = deepClone(obj);

            expect(cloned.b).toBe(null);
        });

        it('should handle empty objects and arrays', () => {
            const empty = { obj: {}, arr: [] };
            const cloned = deepClone(empty);

            expect(cloned).toEqual(empty);
            expect(cloned.obj).not.toBe(empty.obj);
            expect(cloned.arr).not.toBe(empty.arr);
        });

        it('should handle mixed types in arrays', () => {
            const mixed = [1, 'string', true, null, { obj: true }, [1, 2]];
            const cloned = deepClone(mixed);

            expect(cloned).toEqual(mixed);
            expect(cloned).not.toBe(mixed);
            expect((cloned[4] as any).obj).toBe(true);
        });
    });
});
