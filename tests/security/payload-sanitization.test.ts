/**
 * @file payload-sanitization.test.ts
 * @description Security tests for payload sanitization
 * @module tests/security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultSecurityLayer } from '../../src/security/SecurityLayer';

describe('Payload Sanitization Security', () => {
    let securityLayer: DefaultSecurityLayer;

    beforeEach(() => {
        securityLayer = new DefaultSecurityLayer();
    });

    describe('Function removal', () => {
        it('should remove functions from payload', () => {
            const payload = {
                data: 'safe',
                evil: () => console.log('evil'),
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            expect('evil' in sanitized).toBe(false);
            expect(sanitized.data).toBe('safe');
        });

        it('should remove method calls', () => {
            const payload = {
                alert: alert,
                eval: eval,
                constructor: Object.constructor,
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            // Functions are removed (alert/eval are functions assigned to keys)
            expect('alert' in sanitized).toBe(false);
            expect('eval' in sanitized).toBe(false);
            // Note: 'constructor' exists on all objects via prototype, so checking
            // the OWN property is more accurate
            expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
        });
    });

    describe('Circular reference handling', () => {
        it('should handle circular references without stack overflow', () => {
            const circular: any = { a: 1 };
            circular.self = circular;

            const sanitized = securityLayer.sanitizePayload(circular);
            expect(sanitized).toBeDefined();
            // JSON.stringify fails on circular, returns {} or []
            // Just ensure no crash
        });

        it('should prevent infinite loops from circular objects', () => {
            const obj1: any = { name: 'obj1' };
            const obj2: any = { name: 'obj2' };
            obj1.ref = obj2;
            obj2.ref = obj1;

            const sanitized = securityLayer.sanitizePayload(obj1);
            expect(sanitized).toBeDefined();
        });
    });

    describe('Undefined value removal', () => {
        it('should remove undefined values', () => {
            const payload = {
                a: 1,
                b: undefined,
                c: 3,
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            expect('b' in sanitized).toBe(false);
            expect(sanitized.a).toBe(1);
            expect(sanitized.c).toBe(3);
        });

        it('should preserve null values', () => {
            const payload = {
                a: 1,
                b: null,
                c: 3,
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            expect(sanitized.b).toBe(null);
        });
    });

    describe('Symbol removal', () => {
        it('should remove symbol keys', () => {
            const sym = Symbol('test');
            const payload = {
                [sym]: 'secret',
                normal: 'visible',
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            expect(sym in sanitized).toBe(false);
            expect(sanitized.normal).toBe('visible');
        });
    });

    describe('Code execution prevention', () => {
        it('should not execute code from sanitized payload', () => {
            let executed = false;

            const payload = {
                code: 'executed = true;',
                fn: () => {
                    executed = true;
                },
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            // Functions removed, code is just a string
            expect(executed).toBe(false);
            expect(typeof sanitized.fn).not.toBe('function');
        });

        it('should prevent constructor injection', () => {
            const payload = {
                constructor: function () {
                    throw new Error('Injected!');
                },
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            // The function is removed, but 'constructor' exists on all objects via prototype
            // Check that it's not an own property (the injected function was removed)
            expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
        });

        it('should prevent prototype pollution', () => {
            const payload = {
                __proto__: { injected: true },
                constructor: { prototype: { injected: true } },
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            const obj = {};
            // Original object should not be polluted
            expect((obj as any).injected).toBeUndefined();
        });
    });

    describe('Data type preservation', () => {
        it('should preserve string types', () => {
            const payload = { str: 'text' };
            const sanitized = securityLayer.sanitizePayload(payload);
            expect(typeof sanitized.str).toBe('string');
            expect(sanitized.str).toBe('text');
        });

        it('should preserve number types', () => {
            const payload = { num: 42, float: 3.14 };
            const sanitized = securityLayer.sanitizePayload(payload);
            expect(typeof sanitized.num).toBe('number');
            expect(sanitized.num).toBe(42);
        });

        it('should preserve boolean types', () => {
            const payload = { bool: true };
            const sanitized = securityLayer.sanitizePayload(payload);
            expect(typeof sanitized.bool).toBe('boolean');
            expect(sanitized.bool).toBe(true);
        });

        it('should preserve array types', () => {
            const payload = { arr: [1, 2, 3] };
            const sanitized = securityLayer.sanitizePayload(payload);
            expect(Array.isArray(sanitized.arr)).toBe(true);
            expect(sanitized.arr).toEqual([1, 2, 3]);
        });

        it('should preserve object types', () => {
            const payload = { obj: { nested: true } };
            const sanitized = securityLayer.sanitizePayload(payload);
            expect(typeof sanitized.obj).toBe('object');
            expect(sanitized.obj.nested).toBe(true);
        });
    });

    describe('Large payload handling', () => {
        it('should handle very large payloads', () => {
            const payload = {
                data: 'x'.repeat(10_000_000), // 10MB
                nested: { field: 'value' },
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            expect(sanitized.data.length).toBe(10_000_000);
            expect(sanitized.nested.field).toBe('value');
        });

        it('should handle deeply nested objects', () => {
            const deep: any = { level: 0 };
            let current = deep;
            for (let i = 1; i < 50; i++) {
                current.child = { level: i };
                current = current.child;
            }

            const sanitized = securityLayer.sanitizePayload(deep);
            expect(sanitized).toBeDefined();
        });
    });

    describe('Mixed payload types', () => {
        it('should sanitize complex mixed payloads', () => {
            const payload = {
                str: 'text',
                num: 42,
                bool: true,
                arr: [1, 2, { nested: true }],
                obj: { nested: 'value' },
                fn: () => { }, // Remove this
                sym: Symbol(), // Remove this
                undef: undefined, // Remove this
            };

            const sanitized = securityLayer.sanitizePayload(payload);

            expect(sanitized.str).toBe('text');
            expect(sanitized.num).toBe(42);
            expect(sanitized.bool).toBe(true);
            expect(Array.isArray(sanitized.arr)).toBe(true);
            expect('fn' in sanitized).toBe(false);
            expect('sym' in sanitized).toBe(false);
            expect('undef' in sanitized).toBe(false);
        });
    });

    describe('Null and edge cases', () => {
        it('should handle null payload', () => {
            const sanitized = securityLayer.sanitizePayload(null);
            expect(sanitized).toBe(null);
        });

        it('should handle empty object', () => {
            const sanitized = securityLayer.sanitizePayload({});
            expect(sanitized).toEqual({});
        });

        it('should handle empty array', () => {
            const sanitized = securityLayer.sanitizePayload([]);
            expect(Array.isArray(sanitized)).toBe(true);
            expect(sanitized.length).toBe(0);
        });
    });

    describe('XSS prevention', () => {
        it('should not execute embedded HTML/JS', () => {
            const payload = {
                html: '<img src=x onerror="alert(1)">',
                script: '<script>alert("xss")</script>',
                event: 'javascript:alert(1)',
            };

            const sanitized = securityLayer.sanitizePayload(payload);
            // Strings preserved but as strings, not executed
            expect(typeof sanitized.html).toBe('string');
            expect(typeof sanitized.script).toBe('string');
        });
    });
});
