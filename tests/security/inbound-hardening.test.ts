/**
 * @file inbound-hardening.test.ts
 * @description Regression tests for inbound message hardening (#34)
 *
 * Covers: per-target source binding, browser-verified origins in handler
 * metadata, SecurityLayer enforcement on inbound messages, response-to-target
 * binding, config validation, handler error disclosure, schema validator
 * hardening, and loud serialization failures.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { DefaultSecurityLayer } from '../../src/security/SecurityLayer';
import { SchemaValidator } from '../../src/validation/SchemaValidator';
import { SYSTEM_MESSAGE_TYPES } from '../../src/types/MessageTypes';
import { SYSTEM_EVENTS } from '../../src/events/SystemEvents';
import type { MessageProtocol } from '../../src/core/MessageProtocol';

const ORIGIN = 'https://example.com';

interface FakeWindow {
    closed: boolean;
    document: { readyState: string };
    location: { origin: string };
    postMessage: ReturnType<typeof vi.fn>;
}

function fakeWindow(): FakeWindow {
    return {
        closed: false,
        document: { readyState: 'complete' },
        location: { origin: ORIGIN },
        postMessage: vi.fn(),
    };
}

function request(type: string, payload: unknown, expectsResponse = false, overrides = {}) {
    return {
        _parley: '__parley__',
        _v: '1.0.0',
        _id: crypto.randomUUID(),
        _type: type,
        _timestamp: Date.now(),
        _origin: 'https://spoofed.evil',
        _expectsResponse: expectsResponse,
        payload,
        ...overrides,
    };
}

function response(requestId: string, payload: unknown) {
    return {
        _parley: '__parley__',
        _v: '1.0.0',
        _id: crypto.randomUUID(),
        _requestId: requestId,
        _timestamp: Date.now(),
        _origin: ORIGIN,
        success: true,
        payload,
    };
}

function deliver(data: unknown, source: unknown, origin = ORIGIN): void {
    const event = new MessageEvent('message', { data, origin });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Connect a window-type Parley to a fake window by completing its handshake */
async function connect(parley: Parley, win: FakeWindow, id: string): Promise<void> {
    const pending = parley.connect(win as unknown as Window, id);
    await tick();
    deliver(request('__parley_handshake_init__', { ready: true }), win);
    await pending;
}

/** Find the last Parley response posted to a fake window */
function lastResponse(win: FakeWindow) {
    const calls = win.postMessage.mock.calls.map((c) => c[0] as Record<string, unknown>);
    return calls.reverse().find((m) => '_requestId' in m) as
        | { success: boolean; error?: { code: string; message: string } }
        | undefined;
}

let parley: Parley | undefined;

afterEach(() => {
    parley?.destroy();
    parley = undefined;
});

function create(extra: Record<string, unknown> = {}): Parley {
    parley = Parley.create({
        targetType: 'window',
        allowedOrigins: [ORIGIN],
        heartbeat: { enabled: false },
        ...extra,
    });
    return parley;
}

describe('Inbound message hardening', () => {
    describe('source binding (one channel per target window)', () => {
        it("does not let one window complete another target's handshake", async () => {
            const p = create({ timeout: 200 });
            const a = fakeWindow();
            const b = fakeWindow();

            const connectA = p.connect(a as unknown as Window, 'A');
            const connectB = p.connect(b as unknown as Window, 'B');
            await tick();

            // Only A says hello
            deliver(request('__parley_handshake_init__', { ready: true }), a);

            await expect(connectA).resolves.toBeUndefined();
            await expect(connectB).rejects.toThrow(/handshake/i);
            expect(p.getConnectedTargets()).toEqual(['A']);
        });

        it('dispatches a message once, attributed to the window that sent it', async () => {
            const p = create();
            const a = fakeWindow();
            const b = fakeWindow();
            await connect(p, a, 'A');
            await connect(p, b, 'B');

            const senders: string[] = [];
            p.on('ping', (_payload, _respond, metadata) => {
                senders.push(metadata.senderId);
            });

            deliver(request('ping', {}), a);
            await tick();
            await tick();

            expect(senders).toEqual(['A']);
        });

        it('only disconnects the target that sent the disconnect notification', async () => {
            const p = create();
            const a = fakeWindow();
            const b = fakeWindow();
            await connect(p, a, 'A');
            await connect(p, b, 'B');

            deliver(
                request(
                    SYSTEM_MESSAGE_TYPES.DISCONNECT,
                    { senderId: 'x', reason: 'manual_disconnect', timestamp: Date.now() },
                    true
                ),
                a
            );
            await tick();
            await tick();

            expect(p.getConnectedTargets()).toEqual(['B']);
        });

        it('ignores messages from an unknown window at an allowed origin', async () => {
            const p = create();
            const a = fakeWindow();
            await connect(p, a, 'A');

            const handler = vi.fn();
            p.on('ping', handler);

            deliver(request('ping', {}), fakeWindow());
            await tick();

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('origin in handler metadata', () => {
        it('uses the browser-verified origin, not the self-reported _origin field', async () => {
            const p = create();
            const a = fakeWindow();
            await connect(p, a, 'A');

            let seenOrigin: string | undefined;
            p.on('ping', (_payload, _respond, metadata) => {
                seenOrigin = metadata.origin;
            });

            deliver(request('ping', {}, false, { _origin: 'https://spoofed.evil' }), a);
            await tick();

            expect(seenOrigin).toBe(ORIGIN);
        });
    });

    describe('SecurityLayer is enforced on inbound messages', () => {
        it('drops messages rejected by a custom validateOrigin()', async () => {
            class DenyAllOrigins extends DefaultSecurityLayer {
                override validateOrigin(): boolean {
                    return false;
                }
            }
            const p = create({ securityLayer: new DenyAllOrigins() });
            const a = fakeWindow();
            // Handshake is channel-level, so it still completes
            await connect(p, a, 'A');

            const handler = vi.fn();
            p.on('ping', handler);
            deliver(request('ping', {}), a);
            await tick();

            expect(handler).not.toHaveBeenCalled();
        });

        it('drops requests rejected by a custom validateMessage()', async () => {
            class DenyPing extends DefaultSecurityLayer {
                override validateMessage(message: MessageProtocol): boolean {
                    return message._type !== 'ping' && super.validateMessage(message);
                }
            }
            const p = create({ securityLayer: new DenyPing() });
            const a = fakeWindow();
            await connect(p, a, 'A');

            const handler = vi.fn();
            const errors: unknown[] = [];
            p.on('ping', handler);
            p.onSystem(SYSTEM_EVENTS.ERROR, (e) => errors.push(e));

            deliver(request('ping', {}), a);
            await tick();

            expect(handler).not.toHaveBeenCalled();
            expect(errors).toHaveLength(1);
        });

        it('drops structurally invalid requests', async () => {
            const p = create();
            const a = fakeWindow();
            await connect(p, a, 'A');

            const handler = vi.fn();
            p.on('ping', handler);
            deliver(request('ping', {}, false, { _expectsResponse: 'yes' }), a);
            await tick();

            expect(handler).not.toHaveBeenCalled();
        });

        it('drops messages with an incompatible protocol major version', async () => {
            const p = create();
            const a = fakeWindow();
            await connect(p, a, 'A');

            const handler = vi.fn();
            p.on('ping', handler);
            deliver(request('ping', {}, false, { _v: '2.0.0' }), a);
            await tick();

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('responses are bound to the requested target', () => {
        it('ignores a response from a different target, accepts the right one', async () => {
            const p = create();
            const a = fakeWindow();
            const b = fakeWindow();
            await connect(p, a, 'A');
            await connect(p, b, 'B');

            const result = p.send('work', { x: 1 }, { targetId: 'A', timeout: 500 });
            await tick();
            await tick();

            const sent = a.postMessage.mock.calls
                .map((c) => c[0] as { _type?: string; _id: string })
                .find((m) => m._type === 'work');
            expect(sent).toBeDefined();

            // B answers A's request: must be ignored
            deliver(response(sent!._id, { from: 'B' }), b);
            await tick();
            // A answers: accepted
            deliver(response(sent!._id, { from: 'A' }), a);

            await expect(result).resolves.toEqual({ from: 'A' });
        });
    });

    describe('configuration validation', () => {
        it.each([['*'], ['null'], ['NULL'], ['']])('rejects allowedOrigins entry %j', (origin) => {
            expect(() => Parley.create({ targetType: 'window', allowedOrigins: [origin] })).toThrow(
                /Configuration error/
            );
        });

        it('rejects an invalid timeout', () => {
            expect(() => Parley.create({ targetType: 'window', timeout: -1 })).toThrow(
                /timeout must be a positive number/
            );
        });
    });

    describe('handler error disclosure', () => {
        it('sends a generic message by default', async () => {
            const p = create();
            const a = fakeWindow();
            await connect(p, a, 'A');
            p.on('boom', () => {
                throw new Error('db password is hunter2');
            });

            deliver(request('boom', {}, true), a);
            await tick();
            await tick();

            const res = lastResponse(a);
            expect(res?.success).toBe(false);
            expect(res?.error?.code).toBe('ERR_HANDLER_ERROR');
            expect(res?.error?.message).toBe('Handler error');
        });

        it('sends the real message when exposeHandlerErrors is enabled', async () => {
            const p = create({ exposeHandlerErrors: true });
            const a = fakeWindow();
            await connect(p, a, 'A');
            p.on('boom', () => {
                throw new Error('details for a trusted peer');
            });

            deliver(request('boom', {}, true), a);
            await tick();
            await tick();

            expect(lastResponse(a)?.error?.message).toBe('details for a trusted peer');
        });
    });

    describe('schema validator hardening', () => {
        const validator = new SchemaValidator();

        it('does not treat inherited members as present required properties', () => {
            const result = validator.validate({}, { type: 'object', required: ['constructor'] });
            expect(result.valid).toBe(false);
        });

        it('caps errors for huge invalid arrays without throwing', () => {
            const huge = new Array(300_000).fill('not-a-number');
            const result = validator.validate(huge, { type: 'array', items: { type: 'number' } });
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeLessThanOrEqual(100);
        });

        it('validates additionalProperties given as a schema', () => {
            const schema = {
                type: 'object' as const,
                properties: { id: { type: 'number' as const } },
                additionalProperties: { type: 'string' as const },
            };
            expect(validator.validate({ id: 1, note: 'ok' }, schema).valid).toBe(true);
            expect(validator.validate({ id: 1, note: 42 }, schema).valid).toBe(false);
        });

        it('still reports invalid regex patterns as validation errors', () => {
            const result = validator.validate('x', { type: 'string', pattern: '([' });
            expect(result.valid).toBe(false);
            expect(result.errors[0]?.message).toMatch(/Invalid regex pattern/);
        });
    });

    describe('serialization failures are loud', () => {
        it('rejects send() with a circular payload instead of sending {}', async () => {
            const p = create();
            const a = fakeWindow();
            await connect(p, a, 'A');
            a.postMessage.mockClear();

            const circular: Record<string, unknown> = { a: 1 };
            circular.self = circular;

            await expect(
                p.send('work', circular, { targetId: 'A', expectsResponse: false })
            ).rejects.toThrow(/cannot be serialized/i);
            expect(a.postMessage).not.toHaveBeenCalled();
        });
    });
});
