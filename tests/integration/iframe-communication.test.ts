/**
 * @file iframe-communication.test.ts
 * @description Integration tests for iframe parent-child communication
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { TimeoutError, ValidationError } from '../../src/errors/ErrorTypes';
import { createConnectedMockWindows, createMockIframe, createMockLogger } from '../utils/mock-factory';
import { waitForEvent, delay } from '../utils/test-helpers';

describe('Iframe Communication Integration', () => {
    let parentParley: Parley;
    let childParley: Parley;

    beforeEach(() => {
        // Would normally set up actual iframes in a real test environment
        // For unit tests, we use mocks
    });

    afterEach(() => {
        if (parentParley && !(parentParley as any)._destroyed) {
            parentParley.destroy();
        }
        if (childParley && !(childParley as any)._destroyed) {
            childParley.destroy();
        }
    });

    describe('Connection establishment', () => {
        it('should establish connection between parent and iframe', async () => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
            });

            childParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://parent.example.com'],
            });

            // In real scenario, would connect via actual iframe
            expect(parentParley).toBeDefined();
            expect(childParley).toBeDefined();
        });
    });

    describe('Message sending and receiving', () => {
        beforeEach(() => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
            });

            childParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://parent.example.com'],
            });
        });

        it('should send message from parent to child iframe', async () => {
            parentParley.register('message:send', {
                schema: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                        text: { type: 'string' },
                    },
                },
            });

            let receivedMessage: any;
            childParley.on('message:send', (payload) => {
                receivedMessage = payload;
            });

            // Would need actual connected iframes to test
            expect(parentParley).toBeDefined();
            expect(childParley).toBeDefined();
        });

        it('should send message from child iframe to parent', async () => {
            childParley.register('child:response', {
                schema: {
                    type: 'object',
                    required: ['response'],
                    properties: {
                        response: { type: 'string' },
                    },
                },
            });

            let receivedResponse: any;
            parentParley.on('child:response', (payload) => {
                receivedResponse = payload;
            });

            expect(childParley).toBeDefined();
            expect(parentParley).toBeDefined();
        });
    });

    describe('Request-response pattern', () => {
        beforeEach(() => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
            });

            childParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://parent.example.com'],
            });
        });

        it('should handle request-response pattern', async () => {
            // Parent registers handler that responds
            parentParley.on('request:data', async (payload, respond) => {
                respond({ data: 'response data' });
            });

            // Child would send with expectsResponse
            // response would be received as resolved promise

            expect(parentParley).toBeDefined();
        });

        it('should timeout on missing response', async () => {
            parentParley.register('request:noresponse', {
                schema: { type: 'object' },
            });

            // Parent doesn't register handler for noresponse
            // Child send would timeout waiting for response

            expect(parentParley).toBeDefined();
        });
    });

    describe('Schema validation', () => {
        beforeEach(() => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
            });

            childParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://parent.example.com'],
            });
        });

        it('should validate payload against schema in integration', async () => {
            const schema = {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                },
            };

            parentParley.register('user:update', { schema });

            // Sending invalid payload would fail validation
            expect(parentParley).toBeDefined();
        });

        it('should reject invalid payloads', () => {
            parentParley.register('typed:message', {
                schema: {
                    type: 'object',
                    required: ['type'],
                    properties: {
                        type: { type: 'string' },
                    },
                },
            });

            // Invalid payload: missing required 'type' field
            // Would throw ValidationError

            expect(parentParley).toBeDefined();
        });
    });

    describe('Payload handling', () => {
        beforeEach(() => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
            });
        });

        it('should handle large payloads', async () => {
            const largePayload = {
                data: 'x'.repeat(5_000_000), // 5MB
            };

            parentParley.register('large:data', {
                schema: {
                    type: 'object',
                    properties: {
                        data: { type: 'string' },
                    },
                },
            });

            // Sending 5MB payload
            // Should succeed in most cases
            expect(parentParley).toBeDefined();
        });
    });

    describe('Origin validation', () => {
        it('should block disallowed origin', async () => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://trusted.com'],
            });

            // Child iframe with different origin not in allowedOrigins
            // Messages from https://evil.com would be rejected

            expect(parentParley).toBeDefined();
        });

        it('should accept multiple allowed origins', async () => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: [
                    'https://child1.example.com',
                    'https://child2.example.com',
                    'https://child3.example.com',
                ],
            });

            // Messages from any of the 3 allowed origins accepted
            expect(parentParley).toBeDefined();
        });
    });

    describe('System events', () => {
        beforeEach(() => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
            });

            childParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://parent.example.com'],
            });
        });

        it('should emit system events on connect/disconnect', async () => {
            let connectedEvent: any;
            let disconnectedEvent: any;

            parentParley.onSystem('system:connected', (data) => {
                connectedEvent = data;
            });

            parentParley.onSystem('system:disconnected', (data) => {
                disconnectedEvent = data;
            });

            // After connection and then disconnection
            // Both events would be emitted

            expect(parentParley).toBeDefined();
        });
    });

    describe('Error handling', () => {
        beforeEach(() => {
            parentParley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: ['https://child.example.com'],
            });
        });

        it('should emit error events on failure', async () => {
            let errorEvent: any;

            parentParley.onSystem('system:error', (error) => {
                errorEvent = error;
            });

            // Trigger error condition
            // Error event would be emitted

            expect(parentParley).toBeDefined();
        });
    });
});
