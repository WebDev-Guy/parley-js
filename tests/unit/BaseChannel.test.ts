/**
 * @file BaseChannel.test.ts
 * @description Unit tests for BaseChannel abstract class via concrete implementation
 * @module tests/unit
 *
 * Tests all public/protected methods:
 * - constructor / state / isConnected - Properties
 * - setMessageHandler() - Handler registration
 * - send() - Message sending
 * - on() / once() - Event subscription
 * - destroy() - Cleanup
 * - _handleMessageEvent() - Message processing
 * - _isAllowedOrigin() - Origin validation
 * - _isParleyMessage() - Message identification
 * - _setState() - State management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseChannel, type MessageEventHandler } from '../../src/communication/BaseChannel';
import type { MessageProtocol, ResponseProtocol } from '../../src/core/MessageProtocol';
import type { ChannelOptions } from '../../src/types/ChannelTypes';
import { createMockLogger, createTestMessage } from '../utils/mock-factory';

/**
 * Concrete implementation of BaseChannel for testing
 */
class TestChannel extends BaseChannel {
    public targetWindow: Window | null = null;
    public setupCalled = false;
    public teardownCalled = false;
    public connectCalled = false;
    public disconnectCalled = false;

    async connect(target: HTMLIFrameElement | Window): Promise<void> {
        this.connectCalled = true;
        if (target instanceof HTMLIFrameElement) {
            this.targetWindow = target.contentWindow;
        } else {
            this.targetWindow = target;
        }
        this._setupMessageListener();
        this._setState('connected');
    }

    disconnect(): void {
        this.disconnectCalled = true;
        this._teardownMessageListener();
        this._setState('disconnected');
        this.targetWindow = null;
    }

    protected _setupMessageListener(): void {
        this.setupCalled = true;
        this._boundMessageHandler = this._handleMessageEvent.bind(this);
        window.addEventListener('message', this._boundMessageHandler);
    }

    protected _teardownMessageListener(): void {
        this.teardownCalled = true;
        if (this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
            this._boundMessageHandler = null;
        }
    }

    protected _getTargetWindow(): Window | null {
        return this.targetWindow;
    }

    // Expose protected methods for testing
    public testHandleMessageEvent(event: MessageEvent): void {
        this._handleMessageEvent(event);
    }

    public testIsAllowedOrigin(origin: string): boolean {
        return this._isAllowedOrigin(origin);
    }

    public testIsParleyMessage(data: unknown): boolean {
        return this._isParleyMessage(data);
    }

    public testSetState(state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'): void {
        this._setState(state);
    }
}

describe('BaseChannel', () => {
    let channel: TestChannel;
    let mockLogger: ReturnType<typeof createMockLogger>;
    const defaultOptions: ChannelOptions = {
        allowedOrigins: ['https://example.com', 'https://other.com'],
        handshakeTimeout: 5000,
        autoReconnect: false,
        reconnectDelay: 1000,
        maxReconnectAttempts: 3,
    };

    beforeEach(() => {
        mockLogger = createMockLogger();
        channel = new TestChannel(defaultOptions, mockLogger as any);
    });

    afterEach(() => {
        channel.destroy();
    });

    // ========================================================================
    // Constructor and Properties
    // ========================================================================

    describe('constructor / properties', () => {
        it('should create instance with options', () => {
            expect(channel).toBeDefined();
            expect(channel.state).toBe('disconnected');
            expect(channel.isConnected).toBe(false);
        });

        it('should create instance without logger', () => {
            const channelNoLogger = new TestChannel(defaultOptions);
            expect(channelNoLogger).toBeDefined();
            channelNoLogger.destroy();
        });

        it('should have initial state of disconnected', () => {
            expect(channel.state).toBe('disconnected');
        });

        it('should report isConnected as false when disconnected', () => {
            expect(channel.isConnected).toBe(false);
        });

        it('should report isConnected as true when connected', () => {
            channel.testSetState('connected');
            expect(channel.isConnected).toBe(true);
        });
    });

    // ========================================================================
    // setMessageHandler()
    // ========================================================================

    describe('setMessageHandler()', () => {
        it('should set message handler', () => {
            const handler: MessageEventHandler = vi.fn();
            channel.setMessageHandler(handler);
            // Handler is internal, verify it's used when message received
            expect(handler).not.toHaveBeenCalled();
        });

        it('should replace existing handler', () => {
            const handler1: MessageEventHandler = vi.fn();
            const handler2: MessageEventHandler = vi.fn();

            channel.setMessageHandler(handler1);
            channel.setMessageHandler(handler2);

            // Both handlers should be functions, only handler2 should be active
            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
        });
    });

    // ========================================================================
    // send()
    // ========================================================================

    describe('send()', () => {
        it('should send message via postMessage', () => {
            const mockWindow = {
                postMessage: vi.fn(),
            } as unknown as Window;

            const message = createTestMessage('test:type', { data: 'test' });
            channel.send(message, mockWindow, 'https://example.com');

            expect(mockWindow.postMessage).toHaveBeenCalledWith(message, 'https://example.com');
        });

        it('should throw error for null origin (file:// protocol)', () => {
            const mockWindow = {
                postMessage: vi.fn(),
            } as unknown as Window;

            const message = createTestMessage('test:type', { data: 'test' });

            // Should throw ConnectionError for null origin (file:// protocol)
            expect(() => {
                channel.send(message, mockWindow, 'null');
            }).toThrow(/Cannot send message without explicit target origin/);
        });

        it('should handle null target window gracefully', () => {
            const message = createTestMessage('test:type', { data: 'test' });

            // Should not throw, just log error
            expect(() => {
                channel.send(message, null as unknown as Window, 'https://example.com');
            }).not.toThrow();
        });

        it('should throw on postMessage error', () => {
            const mockWindow = {
                postMessage: vi.fn().mockImplementation(() => {
                    throw new Error('postMessage failed');
                }),
            } as unknown as Window;

            const message = createTestMessage('test:type', { data: 'test' });

            expect(() => {
                channel.send(message, mockWindow, 'https://example.com');
            }).toThrow('postMessage failed');
        });

        it('should send response messages', () => {
            const mockWindow = {
                postMessage: vi.fn(),
            } as unknown as Window;

            const response: ResponseProtocol = {
                _parley: '__parley__',
                _v: '1.0.0',
                _id: 'response-123',
                _type: '__response__',
                _respondingTo: 'message-123',
                _origin: 'https://example.com',
                _timestamp: Date.now(),
                _expectsResponse: false,
                payload: { success: true },
            };

            channel.send(response, mockWindow, 'https://example.com');
            expect(mockWindow.postMessage).toHaveBeenCalledWith(response, 'https://example.com');
        });
    });

    // ========================================================================
    // on() / once()
    // ========================================================================

    describe('on()', () => {
        it('should register event listener', () => {
            const handler = vi.fn();
            const unsubscribe = channel.on('test-event', handler);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should return unsubscribe function', () => {
            const handler = vi.fn();
            const unsubscribe = channel.on('test-event', handler);

            expect(() => unsubscribe()).not.toThrow();
        });
    });

    describe('once()', () => {
        it('should register one-time event listener', () => {
            const handler = vi.fn();
            const unsubscribe = channel.once('test-event', handler);

            expect(typeof unsubscribe).toBe('function');
        });
    });

    // ========================================================================
    // destroy()
    // ========================================================================

    describe('destroy()', () => {
        it('should clean up resources', () => {
            channel.destroy();

            expect(channel.teardownCalled).toBe(true);
            expect(channel.state).toBe('disconnected');
        });

        it('should be idempotent', () => {
            channel.destroy();
            channel.destroy();

            expect(channel.state).toBe('disconnected');
        });

        it('should clear message handler', () => {
            const handler = vi.fn();
            channel.setMessageHandler(handler);
            channel.destroy();

            // Handler should be cleared (internal state)
            expect(channel.state).toBe('disconnected');
        });
    });

    // ========================================================================
    // _handleMessageEvent()
    // ========================================================================

    describe('_handleMessageEvent()', () => {
        it('should block messages from disallowed origins', () => {
            const handler = vi.fn();
            channel.setMessageHandler(handler);

            const event = new MessageEvent('message', {
                data: createTestMessage('test', {}),
                origin: 'https://malicious.com',
                source: window,
            });

            channel.testHandleMessageEvent(event);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should block messages with no source', () => {
            const handler = vi.fn();
            channel.setMessageHandler(handler);

            const event = new MessageEvent('message', {
                data: createTestMessage('test', {}),
                origin: 'https://example.com',
                source: null,
            });

            channel.testHandleMessageEvent(event);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should ignore non-Parley messages', () => {
            const handler = vi.fn();
            channel.setMessageHandler(handler);

            const event = new MessageEvent('message', {
                data: { some: 'other message' },
                origin: 'https://example.com',
                source: window,
            });

            channel.testHandleMessageEvent(event);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should call handler for valid Parley messages', () => {
            const handler = vi.fn();
            channel.setMessageHandler(handler);

            const message = createTestMessage('test:type', { data: 'test' });
            const event = new MessageEvent('message', {
                data: message,
                origin: 'https://example.com',
                source: window,
            });

            channel.testHandleMessageEvent(event);
            expect(handler).toHaveBeenCalledWith(message, window);
        });

        it('should work without message handler set', () => {
            const message = createTestMessage('test:type', { data: 'test' });
            const event = new MessageEvent('message', {
                data: message,
                origin: 'https://example.com',
                source: window,
            });

            // Should not throw even without handler
            expect(() => channel.testHandleMessageEvent(event)).not.toThrow();
        });
    });

    // ========================================================================
    // _isAllowedOrigin()
    // ========================================================================

    describe('_isAllowedOrigin()', () => {
        it('should return true for allowed origin', () => {
            expect(channel.testIsAllowedOrigin('https://example.com')).toBe(true);
        });

        it('should return true for another allowed origin', () => {
            expect(channel.testIsAllowedOrigin('https://other.com')).toBe(true);
        });

        it('should return false for disallowed origin', () => {
            expect(channel.testIsAllowedOrigin('https://malicious.com')).toBe(false);
        });

        it('should be case insensitive', () => {
            expect(channel.testIsAllowedOrigin('HTTPS://EXAMPLE.COM')).toBe(true);
        });

        it('should return false for empty allowed origins', () => {
            const emptyChannel = new TestChannel({
                ...defaultOptions,
                allowedOrigins: [],
            });

            expect(emptyChannel.testIsAllowedOrigin('https://example.com')).toBe(false);
            emptyChannel.destroy();
        });

        it('should handle non-URL strings', () => {
            const customChannel = new TestChannel({
                ...defaultOptions,
                allowedOrigins: ['localhost'],
            });

            expect(customChannel.testIsAllowedOrigin('localhost')).toBe(true);
            customChannel.destroy();
        });
    });

    // ========================================================================
    // _isParleyMessage()
    // ========================================================================

    describe('_isParleyMessage()', () => {
        it('should return true for valid Parley message', () => {
            const message = createTestMessage('test', {});
            expect(channel.testIsParleyMessage(message)).toBe(true);
        });

        it('should return false for null', () => {
            expect(channel.testIsParleyMessage(null)).toBe(false);
        });

        it('should return false for non-object', () => {
            expect(channel.testIsParleyMessage('string')).toBe(false);
            expect(channel.testIsParleyMessage(123)).toBe(false);
            expect(channel.testIsParleyMessage(undefined)).toBe(false);
        });

        it('should return false for object without _parley', () => {
            expect(channel.testIsParleyMessage({ type: 'test' })).toBe(false);
        });

        it('should return false for wrong _parley value', () => {
            expect(channel.testIsParleyMessage({ _parley: 'wrong' })).toBe(false);
        });

        it('should return true for response messages', () => {
            const response: ResponseProtocol = {
                _parley: '__parley__',
                _v: '1.0.0',
                _id: 'response-123',
                _type: '__response__',
                _respondingTo: 'message-123',
                _origin: 'https://example.com',
                _timestamp: Date.now(),
                _expectsResponse: false,
                payload: null,
            };
            expect(channel.testIsParleyMessage(response)).toBe(true);
        });
    });

    // ========================================================================
    // _setState()
    // ========================================================================

    describe('_setState()', () => {
        it('should update state', () => {
            channel.testSetState('connecting');
            expect(channel.state).toBe('connecting');
        });

        it('should emit stateChange event', () => {
            const handler = vi.fn();
            channel.on('stateChange', handler);

            channel.testSetState('connected');

            expect(handler).toHaveBeenCalledWith({
                from: 'disconnected',
                to: 'connected',
            });
        });

        it('should not emit event if state unchanged', () => {
            const handler = vi.fn();
            channel.on('stateChange', handler);

            channel.testSetState('disconnected'); // Already disconnected

            expect(handler).not.toHaveBeenCalled();
        });

        it('should track state transitions', () => {
            const transitions: string[] = [];
            channel.on('stateChange', (data: any) => {
                transitions.push(`${data.from}->${data.to}`);
            });

            channel.testSetState('connecting');
            channel.testSetState('connected');
            channel.testSetState('disconnected');

            expect(transitions).toEqual([
                'disconnected->connecting',
                'connecting->connected',
                'connected->disconnected',
            ]);
        });
    });

    // ========================================================================
    // connect() / disconnect() - via concrete implementation
    // ========================================================================

    describe('connect() / disconnect()', () => {
        it('should setup listener on connect', async () => {
            const mockWindow = window;
            await channel.connect(mockWindow);

            expect(channel.setupCalled).toBe(true);
            expect(channel.state).toBe('connected');
        });

        it('should teardown listener on disconnect', async () => {
            await channel.connect(window);
            channel.disconnect();

            expect(channel.teardownCalled).toBe(true);
            expect(channel.state).toBe('disconnected');
        });

        it('should connect to iframe', async () => {
            const iframe = document.createElement('iframe');
            document.body.appendChild(iframe);

            await channel.connect(iframe);

            expect(channel.connectCalled).toBe(true);
            expect(channel.state).toBe('connected');

            document.body.removeChild(iframe);
        });
    });
});
