/**
 * @file correctness-fixes.test.ts
 * @description Regression tests for the correctness fixes in #31
 *
 * Retries re-send, handshake INIT is re-sent until acknowledged, window close
 * and dead-target cleanup reach Parley, rate limiting is wired up, broadcast
 * survives a failing target, and register() works after on().
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';
import { TargetManager } from '../../src/core/TargetManager';
import { ConnectionManager } from '../../src/core/ConnectionManager';
import { MessageRegistry } from '../../src/core/MessageRegistry';
import { EventEmitter } from '../../src/events/EventEmitter';
import { HeartbeatManager } from '../../src/core/HeartbeatManager';
import { WindowChannel } from '../../src/communication/WindowChannel';
import { ParleyError } from '../../src/errors/ErrorTypes';
import { SYSTEM_EVENTS } from '../../src/events/SystemEvents';
import type { ResolvedConfig } from '../../src/types/ConfigTypes';
import { createMockLogger } from '../utils/mock-factory';

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

function protocolMessage(type: string, payload: unknown, expectsResponse = false) {
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

/** Messages of a given _type posted to a fake window */
function posted(win: FakeWindow, type: string): Array<{ _id: string; _type: string }> {
    return win.postMessage.mock.calls
        .map((call) => call[0] as { _id: string; _type?: string })
        .filter((m): m is { _id: string; _type: string } => m._type === type);
}

async function connect(parley: Parley, win: FakeWindow, id: string): Promise<void> {
    const pending = parley.connect(win as unknown as Window, id);
    await vi.advanceTimersByTimeAsync(0);
    deliver(protocolMessage('__parley_handshake_init__', { ready: true }), win);
    await pending;
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

afterEach(() => {
    parley?.destroy();
    parley = undefined;
    vi.useRealTimers();
});

describe('Correctness fixes (#31)', () => {
    it('re-sends the message on every retry and resolves on a late response', async () => {
        vi.useFakeTimers();
        const p = create();
        const a = fakeWindow();
        await connect(p, a, 'A');

        const result = p.send('work', { n: 1 }, { targetId: 'A', timeout: 100, retries: 2 });
        await vi.advanceTimersByTimeAsync(0);
        expect(posted(a, 'work')).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(100);
        expect(posted(a, 'work')).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(100);
        expect(posted(a, 'work')).toHaveLength(3);

        // Same message id on every attempt, so any attempt's response resolves it
        const ids = new Set(posted(a, 'work').map((m) => m._id));
        expect(ids.size).toBe(1);

        deliver(
            {
                _parley: '__parley__',
                _v: '1.0.0',
                _id: crypto.randomUUID(),
                _requestId: [...ids][0],
                _timestamp: Date.now(),
                _origin: ORIGIN,
                success: true,
                payload: { ok: true },
            },
            a
        );
        await expect(result).resolves.toEqual({ ok: true });
    });

    it('re-sends HANDSHAKE_INIT to the opener until acknowledged', async () => {
        vi.useFakeTimers();
        const opener = fakeWindow();
        const original = Object.getOwnPropertyDescriptor(window, 'opener');
        Object.defineProperty(window, 'opener', { value: opener, configurable: true });

        const channel = new WindowChannel(
            { allowedOrigins: [ORIGIN], handshakeTimeout: 2000 } as never,
            createMockLogger() as never
        );

        try {
            const connecting = channel.connect(opener as unknown as Window);
            await vi.advanceTimersByTimeAsync(0);
            expect(posted(opener, '__parley_handshake_init__')).toHaveLength(1);

            // Retry interval is 10% of the handshake timeout (200ms here)
            await vi.advanceTimersByTimeAsync(450);
            const beforeAck = posted(opener, '__parley_handshake_init__').length;
            expect(beforeAck).toBeGreaterThanOrEqual(3);

            deliver(protocolMessage('__parley_handshake_ack__', { acknowledged: true }), opener);
            await connecting;

            // No more INITs after the handshake completed
            await vi.advanceTimersByTimeAsync(1000);
            expect(posted(opener, '__parley_handshake_init__')).toHaveLength(beforeAck);
        } finally {
            channel.destroy();
            if (original) {
                Object.defineProperty(window, 'opener', original);
            } else {
                delete (window as { opener?: unknown }).opener;
            }
        }
    });

    it('disconnects a window target when the window is closed', async () => {
        vi.useFakeTimers();
        const p = create();
        const a = fakeWindow();
        await connect(p, a, 'A');

        const events: string[] = [];
        p.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, () => events.push('lost'));
        p.onSystem(SYSTEM_EVENTS.DISCONNECTED, () => events.push('disconnected'));

        a.closed = true;
        await vi.advanceTimersByTimeAsync(1100); // WindowChannel polls every second

        expect(p.getConnectedTargets()).toEqual([]);
        expect(events).toEqual(['lost', 'disconnected']);
    });

    it('routes dead targets found by TargetManager.cleanup() to a handler', () => {
        const targets = new TargetManager(createMockLogger() as never);
        const win = fakeWindow();
        targets.register(win as unknown as Window, { id: 'gone' });
        const handler = vi.fn((id: string) => targets.unregister(id));
        targets.setDeadTargetHandler(handler);

        win.closed = true;
        expect(targets.cleanup()).toBe(1);
        expect(handler).toHaveBeenCalledWith('gone');
        expect(targets.has('gone')).toBe(false);
        targets.destroy();
    });

    it('stops the heartbeat for a target that no longer exists', () => {
        const logger = createMockLogger();
        const targets = new TargetManager(logger as never);
        const heartbeat = { stop: vi.fn() } as unknown as HeartbeatManager;
        const manager = new ConnectionManager({
            config: { instanceId: 'x', heartbeat: { maxMissed: 3 } } as ResolvedConfig,
            logger: logger as never,
            emitter: new EventEmitter(),
            registry: new MessageRegistry(logger as never),
            targets,
            getHeartbeatManager: () => heartbeat,
            onIncomingMessage: () => {},
            sendSystemMessage: () => Promise.resolve(undefined),
            rejectPendingForTarget: () => {},
        });

        manager.handleHeartbeatFailure('unknown-target', 1);
        expect(heartbeat.stop).toHaveBeenCalledWith('unknown-target');
        manager.destroy();
        targets.destroy();
    });

    it('enforces rateLimit from the public config', async () => {
        vi.useFakeTimers();
        const p = create({ rateLimit: { enabled: true, messagesPerSecond: 2 } });
        const a = fakeWindow();
        await connect(p, a, 'A');

        const opts = { targetId: 'A', expectsResponse: false };
        await p.send('work', {}, opts);
        await p.send('work', {}, opts);

        const third = p.send('work', {}, opts);
        await expect(third).rejects.toBeInstanceOf(ParleyError);
        await expect(p.send('work', {}, opts)).rejects.toMatchObject({
            code: 'ERR_SECURITY_RATE_LIMITED',
        });

        // New window, new budget
        await vi.advanceTimersByTimeAsync(1100);
        await expect(p.send('work', {}, opts)).resolves.toBeUndefined();
    });

    it('keeps broadcasting after one target fails', async () => {
        vi.useFakeTimers();
        const p = create();
        const a = fakeWindow();
        const b = fakeWindow();
        await connect(p, a, 'A');
        await connect(p, b, 'B');

        a.postMessage.mockImplementation(() => {
            throw new Error('detached');
        });

        expect(() => p.broadcast('news', { n: 1 })).not.toThrow();
        expect(posted(b, 'news')).toHaveLength(1);
    });

    it('rejects an empty allowedOrigins list at create()', () => {
        expect(() => Parley.create({ targetType: 'window', allowedOrigins: [] })).toThrow(
            /at least one origin/
        );
    });

    it('lets register() attach a schema after on() auto-registered the type', async () => {
        vi.useFakeTimers();
        const p = create();
        const handler = vi.fn();
        p.on('user:update', handler);

        expect(() =>
            p.register('user:update', {
                schema: { type: 'object', required: ['id'] },
            })
        ).not.toThrow();

        // Explicit duplicates still throw
        expect(() => p.register('user:update')).toThrow(/already registered/);

        // The schema is enforced on outgoing messages
        const a = fakeWindow();
        await connect(p, a, 'A');
        await expect(
            p.send('user:update', {}, { targetId: 'A', expectsResponse: false })
        ).rejects.toThrow(/id/);
    });
});
