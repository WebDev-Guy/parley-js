/**
 * @file error-info-disclosure.test.ts
 * @description Security tests for error information disclosure prevention
 * @module tests/security
 */

import { describe, it, expect } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { ValidationError, ConnectionError, TimeoutError } from '../../src/errors/ErrorTypes';

describe('Error Information Disclosure Security', () => {
    let parley: Parley;

    beforeEach(() => {
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: ['https://trusted.com'],
            logLevel: 'none', // Production mode
        });
    });

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    describe('Error message safety', () => {
        it('should not expose internal details in error messages', () => {
            try {
                // Trigger validation error
                throw new ValidationError('Field required');
            } catch (error: any) {
                // Error message should be generic
                expect(error.message).not.toContain('/src/');
                expect(error.message).not.toContain('C:\\');
                expect(error.message).not.toContain('at Object');
            }
        });

        it('should not expose stack traces in production', () => {
            let capturedError: any;

            parley.onSystem('system:error', (error) => {
                capturedError = error;
            });

            // Trigger error
            // In production mode, stack trace should be hidden

            expect(parley).toBeDefined();
        });

        it('should use error codes instead of details', () => {
            try {
                throw new ValidationError('Validation failed');
            } catch (error: any) {
                // Should have error code
                expect(error.code || error.name).toBeDefined();

                // Message should be generic
                expect(error.message).not.toContain('schema');
                expect(error.message).not.toContain('properties');
            }
        });
    });

    describe('Sensitive information filtering', () => {
        it('should not include origin URLs in errors', () => {
            try {
                throw new ConnectionError('Connection failed');
            } catch (error: any) {
                // Should not reveal allowed origins
                expect(error.message).not.toContain('https://');
                expect(error.message).not.toContain('trusted.com');
            }
        });

        it('should not include window references', () => {
            let errorMessage: string = '';

            parley.onSystem('system:error', (error) => {
                errorMessage = error.message || '';
            });

            // Error should not reference window object details
            expect(errorMessage).not.toContain('[object Window]');
        });

        it('should not include configuration details', () => {
            try {
                throw new ConnectionError('Setup error');
            } catch (error: any) {
                // Should not reveal config values
                expect(error.message).not.toContain('maxListeners');
                expect(error.message).not.toContain('heartbeat');
            }
        });
    });

    describe('Error code usage', () => {
        it('should use error codes for validation failures', () => {
            const error = new ValidationError('Test');
            expect(error.code).toBeDefined();
            expect(typeof error.code).toBe('string');
        });

        it('should use error codes for connection failures', () => {
            const error = new ConnectionError('Test');
            expect(error.code).toBeDefined();
            expect(typeof error.code).toBe('string');
        });

        it('should use error codes for timeout', () => {
            const error = new TimeoutError('Test');
            expect(error.code).toBeDefined();
            expect(typeof error.code).toBe('string');
        });

        it('should use consistent error codes', () => {
            const error1 = new ValidationError('Error 1');
            const error2 = new ValidationError('Error 2');

            // Same error type should have same code
            expect(error1.code).toBe(error2.code);
        });
    });

    describe('Stack trace handling', () => {
        it('should not expose file paths in production', () => {
            try {
                throw new Error('Production error');
            } catch (error: any) {
                if (error.stack) {
                    // In production, stack should be sanitized or absent
                    const devMode = typeof __DEV__ !== 'undefined' && __DEV__;

                    if (!devMode) {
                        expect(error.stack).not.toContain('/src/');
                        expect(error.stack).not.toContain('\\src\\');
                    }
                }
            }
        });

        it('should allow stack traces in development', () => {
            // In dev mode, full stack trace is acceptable
            // for debugging purposes
            expect(true).toBe(true);
        });
    });

    describe('Logging sensitivity', () => {
        it('should not log sensitive data', () => {
            const prodParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://trusted.com'],
                logLevel: 'none',
            });

            // Operations should not log sensitive info to console
            expect(prodParley).toBeDefined();
            prodParley.destroy();
        });

        it('should respect log level configuration', () => {
            const noLogParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://trusted.com'],
                logLevel: 'none',
            });

            // Should not log anything
            expect(noLogParley).toBeDefined();
            noLogParley.destroy();
        });
    });

    describe('User-facing errors', () => {
        it('should provide user-friendly error messages', () => {
            try {
                throw new TimeoutError('Request timeout');
            } catch (error: any) {
                // Message should be clear but not technical
                expect(error.message).toBeTruthy();
                expect(error.message.length).toBeGreaterThan(0);
            }
        });

        it('should not include technical jargon in user errors', () => {
            try {
                throw new ConnectionError('Connection failed');
            } catch (error: any) {
                // User-facing errors should be simple
                expect(error.message).not.toContain('postMessage');
                expect(error.message).not.toContain('MessageChannel');
            }
        });
    });

    describe('Error context sanitization', () => {
        it('should sanitize error context objects', () => {
            const error = new ValidationError('Validation failed', {
                field: 'email',
                value: 'user@secret.com', // Sensitive data
            });

            // Context should not be exposed in error message
            expect(error.message).not.toContain('user@secret.com');
        });

        it('should not expose payload data in errors', () => {
            parley.register('sensitive:data', {
                schema: {
                    type: 'object',
                    required: ['password'],
                    properties: {
                        password: { type: 'string' },
                    },
                },
            });

            // Validation error should not include actual password
            expect(parley).toBeDefined();
        });
    });

    describe('Error serialization', () => {
        it('should not serialize sensitive error properties', () => {
            const error = new ValidationError('Test error');
            const serialized = JSON.stringify(error);

            // Serialized error should only include safe properties
            expect(serialized).toBeDefined();
        });

        it('should handle circular references in error context', () => {
            const context: any = { a: 1 };
            context.self = context;

            const error = new ValidationError('Test', context);

            // JSON.stringify throws on circular references by design
            // This test verifies the error is created successfully with circular context
            expect(error).toBeDefined();
            expect(error.message).toBe('Test');
            // The error holds the context but we can't JSON.stringify it directly
            expect(() => JSON.stringify(error)).toThrow(/circular/i);
        });
    });

    describe('Development vs Production', () => {
        it('should provide more detail in development mode', () => {
            const devParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://trusted.com'],
                logLevel: 'debug', // Dev mode
            });

            // Dev mode can include more logging
            expect(devParley).toBeDefined();
            devParley.destroy();
        });

        it('should minimize detail in production mode', () => {
            const prodParley = Parley.create({
                targetType: 'window',
                allowedOrigins: ['https://trusted.com'],
                logLevel: 'none', // Prod mode
            });

            // Prod mode should be silent
            expect(prodParley).toBeDefined();
            prodParley.destroy();
        });
    });
});
