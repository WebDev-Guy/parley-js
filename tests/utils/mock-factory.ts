/**
 * @file mock-factory.ts
 * @description Factory functions for creating mock objects in tests
 * @module tests/utils
 *
 * Provides reusable mock objects for testing Parley components.
 */

import type { MessageProtocol } from '../../src/core/MessageProtocol';
import type { ParleyConfig } from '../../src/types/ConfigTypes';

/**
 * Message listener callback type
 */
type MessageListener = (event: MessageEvent) => void;

/**
 * Mock window interface for testing
 */
export interface MockWindow {
    id: string;
    closed: boolean;
    postMessage: (data: unknown, targetOrigin: string) => void;
    addEventListener: (event: string, listener: MessageListener) => void;
    removeEventListener: (event: string, listener: MessageListener) => void;
    _triggerMessage: (data: unknown, origin?: string) => void;
    _getListeners: () => MessageListener[];
    _close: () => void;
}

/**
 * Create a mock window object for testing window-to-window communication.
 *
 * @param id - Unique identifier for the mock window
 * @returns Mock window object with postMessage capability
 *
 * @example
 * ```typescript
 * const mockWindow = createMockWindow('child-window');
 * mockWindow._triggerMessage({ type: 'test' }, 'https://example.com');
 * ```
 */
export function createMockWindow(id: string): MockWindow {
    const listeners: MessageListener[] = [];
    let closed = false;

    return {
        id,
        get closed() {
            return closed;
        },
        postMessage: vi.fn((data: unknown, targetOrigin: string) => {
            // Simulate postMessage behavior - does nothing by default
            // In tests, connect two mock windows to enable communication
        }),
        addEventListener: (event: string, listener: MessageListener) => {
            if (event === 'message') {
                listeners.push(listener);
            }
        },
        removeEventListener: (event: string, listener: MessageListener) => {
            if (event === 'message') {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        },
        _triggerMessage: (data: unknown, origin: string = 'https://example.com') => {
            const event = new MessageEvent('message', {
                data,
                origin,
                source: null,
            });
            listeners.forEach((listener) => listener(event));
        },
        _getListeners: () => [...listeners],
        _close: () => {
            closed = true;
        },
    };
}

/**
 * Create a pair of connected mock windows that can communicate with each other.
 *
 * @param idA - ID for the first window
 * @param idB - ID for the second window
 * @param originA - Origin for window A (default: 'https://parent.example.com')
 * @param originB - Origin for window B (default: 'https://child.example.com')
 * @returns Tuple of [windowA, windowB] that are wired together
 *
 * @example
 * ```typescript
 * const [parentWindow, childWindow] = createConnectedMockWindows('parent', 'child');
 * parentWindow.postMessage({ test: true }, '*'); // childWindow receives it
 * ```
 */
export function createConnectedMockWindows(
    idA: string = 'window-a',
    idB: string = 'window-b',
    originA: string = 'https://parent.example.com',
    originB: string = 'https://child.example.com'
): [MockWindow, MockWindow] {
    const windowA = createMockWindow(idA);
    const windowB = createMockWindow(idB);

    // Wire up postMessage to trigger message events on the other window
    windowA.postMessage = vi.fn((data: unknown, targetOrigin: string) => {
        if (!windowB.closed && (targetOrigin === '*' || targetOrigin === originB)) {
            setTimeout(() => {
                windowB._triggerMessage(data, originA);
            }, 0);
        }
    });

    windowB.postMessage = vi.fn((data: unknown, targetOrigin: string) => {
        if (!windowA.closed && (targetOrigin === '*' || targetOrigin === originA)) {
            setTimeout(() => {
                windowA._triggerMessage(data, originB);
            }, 0);
        }
    });

    return [windowA, windowB];
}

/**
 * Create a mock iframe element for testing.
 *
 * @param id - ID for the iframe
 * @param origin - Origin for the iframe content (default: 'https://iframe.example.com')
 * @returns Mock iframe element with contentWindow
 */
export function createMockIframe(
    id: string = 'mock-iframe',
    origin: string = 'https://iframe.example.com'
): HTMLIFrameElement {
    const mockWindow = createMockWindow(id);

    const iframe = {
        id,
        tagName: 'IFRAME',
        contentWindow: mockWindow as unknown as Window,
        src: origin,
        getAttribute: (attr: string) => {
            if (attr === 'id') return id;
            if (attr === 'src') return origin;
            return null;
        },
    } as unknown as HTMLIFrameElement;

    return iframe;
}

/**
 * Create a properly formatted Parley message for testing.
 *
 * @param type - Message type (e.g., 'DOCUMENT_REQUESTED')
 * @param payload - Message payload
 * @param options - Additional message options
 * @returns Formatted message object conforming to MessageProtocol
 *
 * @example
 * ```typescript
 * const message = createTestMessage('user:update', { userId: 123 });
 * ```
 */
export function createTestMessage<T = unknown>(
    type: string,
    payload: T,
    options: {
        id?: string;
        expectsResponse?: boolean;
        origin?: string;
        target?: string;
    } = {}
): MessageProtocol {
    return {
        _parley: '__parley__',
        _v: '1.0.0',
        _id: options.id ?? `msg-${Math.random().toString(36).substring(2, 11)}`,
        _type: type,
        _timestamp: Date.now(),
        _origin: options.origin ?? 'test-origin',
        _expectsResponse: options.expectsResponse ?? false,
        _target: options.target,
        payload,
    };
}

/**
 * Create test configuration with sensible defaults.
 *
 * @param overrides - Partial config to override defaults
 * @returns Complete ParleyConfig object
 */
export function createTestConfig(overrides: Partial<ParleyConfig> = {}): ParleyConfig {
    return {
        targetType: 'window',
        allowedOrigins: ['https://example.com', 'https://parent.example.com', 'https://child.example.com'],
        timeout: 5000,
        logLevel: 'silent',
        heartbeat: {
            enabled: false,
            interval: 30000,
            timeout: 5000,
        },
        ...overrides,
    };
}

/**
 * Create a mock Logger that captures log calls for testing.
 *
 * @returns Mock logger with captured logs
 */
export function createMockLogger() {
    const logs: Array<{ level: string; message: string; data?: unknown }> = [];

    return {
        logs,
        debug: vi.fn((message: string, data?: unknown) => {
            logs.push({ level: 'debug', message, data });
        }),
        info: vi.fn((message: string, data?: unknown) => {
            logs.push({ level: 'info', message, data });
        }),
        warn: vi.fn((message: string, data?: unknown) => {
            logs.push({ level: 'warn', message, data });
        }),
        error: vi.fn((message: string, data?: unknown) => {
            logs.push({ level: 'error', message, data });
        }),
        child: vi.fn(() => createMockLogger()),
        clear: () => {
            logs.length = 0;
        },
    };
}
