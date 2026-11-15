/**
 * @file hot-path.test.ts
 * @description Behavior guarantees for the hot-path optimizations (#32)
 *
 * The single-pass sanitize/measure path must behave exactly like the old
 * sanitize-then-stringify path, custom security layers must still be used,
 * and system event listeners must not delay message delivery.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { DefaultSecurityLayer, sanitizeAndMeasure } from '../../src/security/SecurityLayer';
import { createMessage, createResponse, isInternalMessage } from '../../src/core/MessageProtocol';
import { SerializationError } from '../../src/errors/ErrorTypes';
import { Parley } from '../../src/core/Parley';
import { SYSTEM_EVENTS } from '../../src/events/SystemEvents';

const ORIGIN = 'https://example.com';

describe('sanitizeAndMeasure()', () => {
    const layer = new DefaultSecurityLayer();

    it.each([
        ['object', { a: 1, nested: { b: [1, 2, { c: 'x' }] } }],
        ['array', [1, 'two', { three: 3 }]],
        ['object with undefined/function', { keep: 1, drop: undefined, fn: () => 1 }],
        ['object with Date', { when: new Date(0) }],
    ])('matches sanitizePayload() + JSON length for %s', (_label, payload) => {
        const result = sanitizeAndMeasure(layer, payload);
        expect(result.payload).toEqual(layer.sanitizePayload(payload));
        expect(result.size).toBe(JSON.stringify(layer.sanitizePayload(payload)).length);
    });

    it('returns a fresh copy for object payloads', () => {
        const payload = { a: { b: 1 } };
        const { payload: sanitized } = sanitizeAndMeasure(layer, payload);
        expect(sanitized).not.toBe(payload);
        expect(sanitized.a).not.toBe(payload.a);
    });

    it.each([
        ['string', 'hello', 7],
        ['number', 42, 2],
        ['null', null, 4],
        ['undefined', undefined, 0],
    ])('passes %s primitives through with their JSON size', (_label, payload, size) => {
        expect(sanitizeAndMeasure(layer, payload)).toEqual({ payload, size });
    });

    it('throws SerializationError for circular payloads', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => sanitizeAndMeasure(layer, circular)).toThrow(SerializationError);
    });

    it("still calls a custom layer's sanitizePayload()", () => {
        class Redacting extends DefaultSecurityLayer {
            override sanitizePayload<T>(payload: T): T {
                return { ...(payload as object), secret: '[redacted]' } as T;
            }
        }
        const result = sanitizeAndMeasure(new Redacting(), { secret: 'hunter2', ok: true });
        expect(result.payload).toEqual({ secret: '[redacted]', ok: true });
        expect(result.size).toBe(JSON.stringify(result.payload).length);
    });
});

describe('createMessage/createResponse clonePayload', () => {
    it('clones by default (public API unchanged)', () => {
        const payload = { a: 1 };
        expect(createMessage({ type: 't', payload }).payload).not.toBe(payload);
        expect(createResponse({ requestId: 'r', success: true, payload }).payload).not.toBe(
            payload
        );
    });

    it('reuses the payload when clonePayload is false', () => {
        const payload = { a: 1 };
        expect(createMessage({ type: 't', payload, clonePayload: false }).payload).toBe(payload);
        expect(
            createResponse({ requestId: 'r', success: true, payload, clonePayload: false }).payload
        ).toBe(payload);
    });
});

describe('isInternalMessage()', () => {
    it('recognizes internal types only', () => {
        const msg = (type: string) => createMessage({ type, payload: null });
        expect(isInternalMessage(msg('__parley_handshake_init__'))).toBe(true);
        expect(isInternalMessage(msg('__parley_pong__'))).toBe(true);
        expect(isInternalMessage(msg('user:update'))).toBe(false);
    });
});

describe('system events do not block delivery', () => {
    let parley: Parley | undefined;

    afterEach(() => {
        parley?.destroy();
        vi.useRealTimers();
    });

    it('posts the message even while an async message_sent listener is pending', async () => {
        vi.useFakeTimers();
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: [ORIGIN],
            heartbeat: { enabled: false },
        });
        const win = {
            closed: false,
            document: { readyState: 'complete' },
            location: { origin: ORIGIN },
            postMessage: vi.fn(),
        };

        const connecting = parley.connect(win as unknown as Window, 'A');
        await vi.advanceTimersByTimeAsync(0);
        const init = {
            _parley: '__parley__',
            _v: '1.0.0',
            _id: 'init',
            _type: '__parley_handshake_init__',
            _timestamp: Date.now(),
            _origin: ORIGIN,
            _expectsResponse: false,
            payload: { ready: true },
        };
        const event = new MessageEvent('message', { data: init, origin: ORIGIN });
        Object.defineProperty(event, 'source', { value: win });
        window.dispatchEvent(event);
        await connecting;
        win.postMessage.mockClear();

        // A listener that never settles. Users can (and do) register async
        // listeners even though onSystem() is typed as returning void.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, () => new Promise<void>(() => {}));

        const sent = parley.send('work', { n: 1 }, { targetId: 'A', expectsResponse: false });
        await expect(sent).resolves.toBeUndefined();
        expect(win.postMessage).toHaveBeenCalledTimes(1);
    });
});
