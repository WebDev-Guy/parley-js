/**
 * @file internal-traffic-events.test.ts
 * @description Protocol traffic must not appear in app-level events or
 * analytics (#45)
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

function deliver(data: unknown, source: unknown): void {
    const event = new MessageEvent('message', { origin: ORIGIN, data });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
}

function request(type: string, payload: unknown, expectsResponse: boolean) {
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

/** A fake peer window; when `answers` is true it responds to every request */
function fakePeer(answers: boolean): FakeWindow {
    const win: FakeWindow = {
        closed: false,
        document: { readyState: 'complete' },
        location: { origin: ORIGIN },
        postMessage: vi.fn((m: { _type?: string; _id: string; _expectsResponse?: boolean }) => {
            if (answers && m._type && m._expectsResponse) {
                queueMicrotask(() =>
                    deliver(
                        {
                            _parley: '__parley__',
                            _v: '1.0.0',
                            _id: crypto.randomUUID(),
                            _requestId: m._id,
                            _timestamp: Date.now(),
                            _origin: ORIGIN,
                            success: true,
                            payload: { ok: true },
                        },
                        win
                    )
                );
            }
        }),
    };
    return win;
}

let parley: Parley | undefined;

async function connectWithHeartbeat(win: FakeWindow): Promise<Parley> {
    parley = Parley.create({
        targetType: 'window',
        allowedOrigins: [ORIGIN],
        analyticsEnabled: true,
    });
    const connecting = parley.connect(win as unknown as Window, 'A');
    await vi.advanceTimersByTimeAsync(0);
    deliver(request('__parley_handshake_init__', { ready: true }, false), win);
    await connecting;
    return parley;
}

/** Record every system event and analytics event by name */
function record(p: Parley): string[] {
    const seen: string[] = [];
    for (const name of Object.values(SYSTEM_EVENTS)) {
        p.onSystem(name, () => seen.push(name));
    }
    p.onAnalyticsEvent((e) => seen.push(`analytics:${e.type}`));
    return seen;
}

const APP_LEVEL = [
    'system:message_sent',
    'system:message_received',
    'system:response_sent',
    'system:response_received',
    'system:timeout',
];

afterEach(() => {
    parley?.destroy();
    parley = undefined;
    vi.useRealTimers();
});

describe('Protocol traffic and app-level events (#45)', () => {
    it('an idle healthy connection emits no app-level events or analytics', async () => {
        vi.useFakeTimers();
        const win = fakePeer(true);
        const p = await connectWithHeartbeat(win);
        const seen = record(p);

        // The peer pings us too, like a real Parley peer
        const peerPings = setInterval(
            () =>
                deliver(
                    request(
                        '__parley_heartbeat_ping',
                        { senderId: 'peer', timestamp: Date.now() },
                        true
                    ),
                    win
                ),
            5000
        );
        await vi.advanceTimersByTimeAsync(60_000);
        clearInterval(peerPings);

        expect(seen.filter((e) => APP_LEVEL.includes(e))).toEqual([]);
        expect(seen.filter((e) => e.startsWith('analytics:'))).toEqual([]);
        // Heartbeats really ran: the peer's pings were answered
        const pongs = win.postMessage.mock.calls.filter(
            (c) => (c[0] as { _requestId?: string })._requestId !== undefined
        );
        expect(pongs.length).toBeGreaterThanOrEqual(11);
    });

    it('an unresponsive peer reports health events but no timeout events', async () => {
        vi.useFakeTimers();
        const p = await connectWithHeartbeat(fakePeer(false));
        const seen = record(p);

        await vi.advanceTimersByTimeAsync(30_000);

        expect(seen.filter((e) => e === 'system:timeout' || e === 'analytics:timeout')).toEqual([]);
        expect(seen.filter((e) => e === 'system:heartbeat_missed')).toHaveLength(3);
        expect(seen).toContain('system:connection_lost');
        expect(p.getConnectedTargets()).toEqual([]);
    });

    it('app messages still emit their events and analytics', async () => {
        vi.useFakeTimers();
        const win = fakePeer(true);
        const p = await connectWithHeartbeat(win);
        p.on('greet', (_payload, respond) => respond({ hi: true }));
        const seen = record(p);

        // Outgoing request answered by the peer
        await p.send('work', { n: 1 }, { targetId: 'A' });
        // Incoming request we answer
        deliver(request('greet', {}, true), win);
        await vi.advanceTimersByTimeAsync(0);

        for (const event of [
            'system:message_sent',
            'system:response_received',
            'system:message_received',
            'system:response_sent',
            'analytics:message_sent',
            'analytics:response_received',
            'analytics:message_received',
            'analytics:response_sent',
        ]) {
            expect(seen).toContain(event);
        }
    });
});
