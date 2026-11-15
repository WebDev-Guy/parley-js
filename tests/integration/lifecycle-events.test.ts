/**
 * @file lifecycle-events.test.ts
 * @description Regression tests for previously unreachable behavior (#41)
 *
 * Handshake system events, heartbeat.maxFailures, disconnect events on
 * destroy(), and the removed HEARTBEAT_PONG request handler.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { SYSTEM_EVENTS } from '../../src/events/SystemEvents';

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

function request(type: string, payload: unknown, expectsResponse = false) {
    return {
        _parley: '__parley__',
        _v: '1.0.0',
        _id: crypto.randomUUID(),
        _type: type,
        _timestamp: Date.now(),
        _origin: ORIGIN,
        _expectsResponse: expectsResponse,
        payload,
    };
}

function deliver(data: unknown, source: unknown): void {
    const event = new MessageEvent('message', { data, origin: ORIGIN });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
}

/** Answer every request of a given type posted to a fake window */
function respondTo(win: FakeWindow, type: string): void {
    win.postMessage.mockImplementation((message: { _type?: string; _id: string }) => {
        if (message._type !== type) return;
        queueMicrotask(() =>
            deliver(
                {
                    _parley: '__parley__',
                    _v: '1.0.0',
                    _id: crypto.randomUUID(),
                    _requestId: message._id,
                    _timestamp: Date.now(),
                    _origin: ORIGIN,
                    success: true,
                    payload: { ok: true },
                },
                win
            )
        );
    });
}

let parley: Parley | undefined;

function create(extra: Record<string, unknown> = {}): Parley {
    parley = Parley.create({
        targetType: 'window',
        allowedOrigins: [ORIGIN],
        heartbeat: { enabled: false },
        ...extra,
    });
    return parley;
}

async function connect(p: Parley, win: FakeWindow, id: string): Promise<void> {
    const pending = p.connect(win as unknown as Window, id);
    await vi.advanceTimersByTimeAsync(0);
    deliver(request('__parley_handshake_init__', { ready: true }), win);
    await pending;
}

afterEach(() => {
    parley?.destroy();
    parley = undefined;
    vi.useRealTimers();
});

describe('Previously unreachable behavior (#41)', () => {
    describe('handshake system events', () => {
        it('emits handshake_start then handshake_complete on success', async () => {
            vi.useFakeTimers();
            const p = create();
            const events: Array<{ name: string; data: Record<string, unknown> }> = [];
            for (const name of [
                SYSTEM_EVENTS.HANDSHAKE_START,
                SYSTEM_EVENTS.HANDSHAKE_COMPLETE,
                SYSTEM_EVENTS.HANDSHAKE_FAILED,
            ]) {
                p.onSystem(name, (data) =>
                    events.push({ name, data: data as Record<string, unknown> })
                );
            }

            await connect(p, fakeWindow(), 'A');

            expect(events.map((e) => e.name)).toEqual([
                'system:handshake_start',
                'system:handshake_complete',
            ]);
            expect(events[0]!.data).toMatchObject({ targetId: 'A', targetType: 'window' });
        });

        it('emits handshake_start then handshake_failed with the error on timeout', async () => {
            vi.useFakeTimers();
            const p = create({ timeout: 100 });
            const events: Array<{ name: string; data: Record<string, unknown> }> = [];
            for (const name of [SYSTEM_EVENTS.HANDSHAKE_START, SYSTEM_EVENTS.HANDSHAKE_FAILED]) {
                p.onSystem(name, (data) =>
                    events.push({ name, data: data as Record<string, unknown> })
                );
            }

            const connecting = p.connect(fakeWindow() as unknown as Window, 'A');
            const assertion = expect(connecting).rejects.toThrow(/handshake/i);
            await vi.advanceTimersByTimeAsync(150);
            await assertion;

            expect(events.map((e) => e.name)).toEqual([
                'system:handshake_start',
                'system:handshake_failed',
            ]);
            expect(events[1]!.data).toMatchObject({
                targetId: 'A',
                error: { code: 'ERR_CONNECTION_HANDSHAKE_FAILED' },
            });
        });
    });

    describe('heartbeat.maxFailures', () => {
        it('disconnects after maxFailures consecutive request timeouts', async () => {
            vi.useFakeTimers();
            const p = create({ heartbeat: { enabled: false, maxFailures: 2 } });
            await connect(p, fakeWindow(), 'A');
            const lost: unknown[] = [];
            p.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (data) => lost.push(data));

            for (let i = 0; i < 2; i++) {
                const request = p.send('work', {}, { targetId: 'A', timeout: 50 });
                const assertion = expect(request).rejects.toThrow(/timed out/);
                await vi.advanceTimersByTimeAsync(60);
                await assertion;
            }

            expect(p.getConnectedTargets()).toEqual([]);
            expect(lost).toEqual([
                expect.objectContaining({ targetId: 'A', reason: 'max_failures_reached' }),
            ]);
        });

        it('resets the count when a response arrives', async () => {
            vi.useFakeTimers();
            const p = create({ heartbeat: { enabled: false, maxFailures: 2 } });
            const win = fakeWindow();
            await connect(p, win, 'A');

            const timeOut = async () => {
                const r = p.send('work', {}, { targetId: 'A', timeout: 50 });
                const assertion = expect(r).rejects.toThrow(/timed out/);
                await vi.advanceTimersByTimeAsync(60);
                await assertion;
            };

            await timeOut();
            respondTo(win, 'work');
            await expect(p.send('work', {}, { targetId: 'A', timeout: 50 })).resolves.toEqual({
                ok: true,
            });
            win.postMessage.mockReset();
            await timeOut();

            expect(p.getConnectedTargets()).toEqual(['A']);
        });

        it('does not count untargeted requests', async () => {
            vi.useFakeTimers();
            const p = create({ heartbeat: { enabled: false, maxFailures: 1 } });
            await connect(p, fakeWindow(), 'A');

            const r = p.send('work', {}, { timeout: 50 });
            const assertion = expect(r).rejects.toThrow(/timed out/);
            await vi.advanceTimersByTimeAsync(60);
            await assertion;

            expect(p.getConnectedTargets()).toEqual(['A']);
        });
    });

    describe('destroy()', () => {
        it("emits system:disconnected with reason 'destroyed' for every target", async () => {
            vi.useFakeTimers();
            const p = create();
            await connect(p, fakeWindow(), 'A');
            await connect(p, fakeWindow(), 'B');

            const disconnected: unknown[] = [];
            p.onSystem(SYSTEM_EVENTS.DISCONNECTED, (data) => disconnected.push(data));
            const pending = p.send('work', {}, { targetId: 'A', timeout: 10_000 });

            p.destroy();
            parley = undefined;

            await expect(pending).rejects.toThrow('Parley instance destroyed');
            expect(disconnected).toEqual([
                expect.objectContaining({ targetId: 'A', reason: 'destroyed' }),
                expect.objectContaining({ targetId: 'B', reason: 'destroyed' }),
            ]);
        });
    });

    describe('heartbeat pong', () => {
        it('has no request handler, so a peer cannot fake liveness with one', async () => {
            vi.useFakeTimers();
            const p = create();
            const win = fakeWindow();
            await connect(p, win, 'A');
            win.postMessage.mockClear();

            deliver(request('__parley_heartbeat_pong', { senderId: 'x' }, true), win);
            await vi.advanceTimersByTimeAsync(0);

            const reply = win.postMessage.mock.calls
                .map((c) => c[0] as { success?: boolean; error?: { code: string } })
                .find((m) => 'success' in m);
            expect(reply).toMatchObject({ success: false, error: { code: 'ERR_NO_HANDLER' } });
        });
    });
});
