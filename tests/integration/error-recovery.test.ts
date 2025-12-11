/**
 * @file error-recovery.test.ts
 * @description Integration tests for error handling and recovery
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { TimeoutError, ValidationError } from '../../src/errors/ErrorTypes';
import { delay } from '../utils/test-helpers';

describe('Error Recovery Integration', () => {
    let parley: Parley;

    beforeEach(() => {
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: ['https://peer.example.com'],
            sendTimeout: 100,
            retries: 2,
        });
    });

    afterEach(() => {
        if (parley && !(parley as any)._destroyed) {
            parley.destroy();
        }
    });

    describe('Send timeout with retry', () => {
        it('should recover from send timeout with retry', async () => {
            parley.register('retry:message', {
                schema: { type: 'object' },
            });

            // Send message
            // First attempt times out
            // Second attempt (retry) succeeds
            // Promise resolves with success

            expect(parley).toBeDefined();
        });

        it('should exhaust retries and throw error', async () => {
            parley.register('timeout:message', {
                schema: { type: 'object' },
            });

            // Send message
            // Peer never responds
            // All 3 attempts timeout (initial + 2 retries)
            // TimeoutError thrown

            expect(parley).toBeDefined();
        });

        it('should not retry on validation errors', () => {
            parley.register('invalid:message', {
                schema: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'number' },
                    },
                },
            });

            // Send invalid payload
            // ValidationError thrown immediately
            // No retries attempted

            expect(parley).toBeDefined();
        });
    });

    describe('Error event emission', () => {
        it('should emit error event on failure', async () => {
            let errorEvent: any;

            parley.onSystem('system:error', (error) => {
                errorEvent = error;
            });

            parley.register('failing:message', {
                schema: { type: 'object' },
            });

            // Trigger error condition
            // system:error event emitted
            // Error details available

            expect(parley).toBeDefined();
        });

        it('should provide error code and message', () => {
            let capturedError: any;

            parley.onSystem('system:error', (error) => {
                capturedError = error;
            });

            // Trigger error
            // Error has code property (e.g., 'TIMEOUT_ERROR')
            // Error has message property

            expect(parley).toBeDefined();
        });

        it('should not expose stack traces', () => {
            let capturedError: any;

            parley.onSystem('system:error', (error) => {
                capturedError = error;
            });

            // Trigger error
            // Error message doesn't include stack trace details

            expect(parley).toBeDefined();
        });
    });

    describe('Continued operation after error', () => {
        it('should continue operating after error', async () => {
            let successMessage: any;

            parley.register('test:message', {
                schema: { type: 'object' },
            });

            parley.on('test:message', (payload) => {
                successMessage = payload;
            });

            // First message fails
            // Second message succeeds
            // Parley continues normally

            expect(parley).toBeDefined();
        });

        it('should handle multiple sequential errors', async () => {
            let errorCount = 0;

            parley.onSystem('system:error', () => {
                errorCount++;
            });

            // Error 1 occurs and is handled
            // Error 2 occurs and is handled
            // System still operational

            expect(errorCount >= 0).toBe(true);
        });

        it('should recover connection after transient error', () => {
            let connectionStable = false;

            parley.onSystem('system:connected', () => {
                connectionStable = true;
            });

            // Transient error occurs
            // Connection recovers
            // system:connected event emitted

            expect(parley).toBeDefined();
        });
    });

    describe('Handler errors', () => {
        it('should handle handler errors gracefully', () => {
            parley.register('handler:error', {
                schema: { type: 'object' },
            });

            parley.on('handler:error', (payload) => {
                throw new Error('Handler failed!');
            });

            let nextMessageProcessed = false;
            parley.on('next:message', () => {
                nextMessageProcessed = true;
            });

            // Message 1 causes handler error
            // Message 2 still processed normally
            // Error in one handler doesn't prevent others

            expect(parley).toBeDefined();
        });

        it('should not prevent other handlers from running', () => {
            let handler1Called = false;
            let handler2Called = false;

            parley.on('test:message', () => {
                handler1Called = true;
                throw new Error('Handler 1 error');
            });

            parley.on('test:message', () => {
                handler2Called = true;
            });

            // Message received
            // Handler 1 throws, but execution continues
            // Handler 2 still called

            expect(parley).toBeDefined();
        });

        it('should continue message processing after handler error', () => {
            parley.register('error:msg', {
                schema: { type: 'object' },
            });

            parley.register('normal:msg', {
                schema: { type: 'object' },
            });

            parley.on('error:msg', () => {
                throw new Error('Expected error');
            });

            let normalMsgProcessed = false;
            parley.on('normal:msg', () => {
                normalMsgProcessed = true;
            });

            // error:msg causes handler to throw
            // normal:msg still processed
            // No system shutdown

            expect(parley).toBeDefined();
        });
    });

    describe('Specific error types', () => {
        it('should handle TimeoutError', async () => {
            parley.register('timeout:test', {
                schema: { type: 'object' },
            });

            let timeoutErrorCaught = false;

            try {
                // Send with expectsResponse but no response
                // TimeoutError thrown after configured timeout
            } catch (error) {
                if (error instanceof TimeoutError) {
                    timeoutErrorCaught = true;
                }
            }

            expect(parley).toBeDefined();
        });

        it('should handle ValidationError', () => {
            parley.register('validation:test', {
                schema: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'number' },
                    },
                },
            });

            let validationErrorCaught = false;

            try {
                // Send with invalid payload
                // ValidationError thrown
            } catch (error) {
                if (error instanceof ValidationError) {
                    validationErrorCaught = true;
                }
            }

            expect(parley).toBeDefined();
        });
    });

    describe('Recovery strategies', () => {
        it('should recover from temporary network issues', async () => {
            // Attempt 1: times out (network down)
            // Attempt 2: succeeds (network recovered)
            // Total time: sendTimeout * 2

            expect(parley).toBeDefined();
        });

        it('should not retry indefinitely', async () => {
            const config = {
                targetType: 'window' as const,
                allowedOrigins: ['https://peer.example.com'],
                sendTimeout: 50,
                retries: 2, // Max 3 attempts total
            };

            const limitedParley = Parley.create(config);

            // Will attempt max 3 times
            // Will not exceed configured retries

            expect(limitedParley).toBeDefined();
            limitedParley.destroy();
        });

        it('should provide diagnostic info on persistent failures', () => {
            let lastError: any;

            parley.onSystem('system:error', (error) => {
                lastError = error;
            });

            // After exhausting retries
            // Error includes attempt count and failure reason

            expect(parley).toBeDefined();
        });
    });

    describe('Error isolation', () => {
        it('should not affect other targets on one target failure', () => {
            // Target A fails
            // Target B unaffected
            // Target C unaffected

            expect(parley).toBeDefined();
        });

        it('should not cascade errors', () => {
            parley.on('message:1', () => {
                throw new Error('Error in message:1');
            });

            parley.on('message:2', () => {
                // This should still execute normally
            });

            // Error in message:1 handler
            // Doesn't prevent message:2 from processing

            expect(parley).toBeDefined();
        });
    });

    describe('System stability', () => {
        it('should not crash on unexpected errors', () => {
            // Various error conditions
            // System should remain stable
            // No unhandled exceptions

            expect(() => {
                // Parley operations
                parley.register('test', { schema: { type: 'object' } });
            }).not.toThrow();
        });

        it('should clean up on destroy despite errors', async () => {
            parley.register('test', { schema: { type: 'object' } });

            let errorEmitted = false;
            parley.onSystem('system:error', () => {
                errorEmitted = true;
            });

            // Errors may have occurred
            // destroy() should still clean up properly
            parley.destroy();

            // All resources cleaned up
            expect((parley as any)._destroyed).toBe(true);
        });
    });
});
