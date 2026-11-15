/**
 * @file hot-path.bench.ts
 * @description Micro-benchmarks for the message hot path (#32)
 *
 * Run with: npm run bench
 *
 * Measures send() (sanitize + size check + schema + message creation +
 * postMessage) and inbound dispatch (channel filtering + validation +
 * handler) with 1 KB and 1 MB payloads, and inbound dispatch with several
 * connected targets (every channel sees every message event).
 */

import { describe, test, vi } from 'vitest';
import { Parley } from '../../src/core/Parley';

const ORIGIN = 'https://example.com';

function fakeWindow() {
    return {
        closed: false,
        document: { readyState: 'complete' },
        location: { origin: ORIGIN },
        postMessage: vi.fn(),
    };
}

function request(type: string, payload: unknown) {
    return {
        _parley: '__parley__',
        _v: '1.0.0',
        _id: 'bench-id',
        _type: type,
        _timestamp: Date.now(),
        _origin: ORIGIN,
        _expectsResponse: false,
        payload,
    };
}

function event(data: unknown, source: unknown): MessageEvent {
    const e = new MessageEvent('message', { data, origin: ORIGIN });
    Object.defineProperty(e, 'source', { value: source });
    return e;
}

function payloadOfSize(bytes: number) {
    const item = { id: 1, name: 'item-name', tags: ['a', 'b'], active: true };
    const itemBytes = JSON.stringify(item).length + 1;
    return { items: Array.from({ length: Math.ceil(bytes / itemBytes) }, () => item) };
}

async function connected(targetCount: number) {
    const parley = Parley.create({
        targetType: 'window',
        allowedOrigins: [ORIGIN, 'https://a.example.com', 'https://b.example.com'],
        heartbeat: { enabled: false },
    });
    const windows = Array.from({ length: targetCount }, fakeWindow);
    for (const [i, win] of windows.entries()) {
        const pending = parley.connect(win as unknown as Window, `t${i}`);
        await new Promise((r) => setTimeout(r, 0));
        window.dispatchEvent(event(request('__parley_handshake_init__', { ready: true }), win));
        await pending;
    }
    // Keep postMessage cheap and allocation-free for the measurement
    for (const win of windows) win.postMessage.mockImplementation(() => {});
    parley.on('bench', () => {});
    return { parley, windows };
}

const small = payloadOfSize(1024);
const large = payloadOfSize(1024 * 1024);
const one = await connected(1);
const five = await connected(5);

// Vitest 5: `bench` is a test-context fixture. Each benchmark is registered
// with bench(name, fn) and executed with .run(); results appear in the
// reporter output.
describe('send (fire-and-forget)', () => {
    test('1 KB payload', async ({ bench }) => {
        await bench('1 KB payload', async () => {
            await one.parley.send('bench', small, { targetId: 't0', expectsResponse: false });
        }).run();
    });

    test('1 MB payload', async ({ bench }) => {
        await bench('1 MB payload', async () => {
            await one.parley.send('bench', large, { targetId: 't0', expectsResponse: false });
        }).run({ iterations: 20 });
    });
});

describe('inbound dispatch', () => {
    const smallMsg = request('bench', small);

    test('1 KB payload: 1 target vs 5 targets', async ({ bench }) => {
        await bench.compare(
            bench('1 KB payload, 1 target', () => {
                window.dispatchEvent(event(smallMsg, one.windows[0]));
            }),
            bench('1 KB payload, 5 targets', () => {
                window.dispatchEvent(event(smallMsg, five.windows[4]));
            })
        );
    });
});
