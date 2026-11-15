[Home](./index.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Testing
Patterns

# ParleyJS Testing Patterns

Testing strategies for application code that uses ParleyJS.

## Overview

Testing postMessage communication requires special patterns because:

- Real cross-origin windows cannot be created in a unit-test DOM
- Events are asynchronous
- ParleyJS only accepts messages that look exactly like real ones: a complete
  protocol message, an allowed `origin`, and a `source` equal to the connected
  target window

This page shows two approaches: testing handler logic directly (no messaging),
and driving a real `Parley` instance with a fake peer window in a DOM test
environment such as happy-dom or jsdom. For end-to-end coverage with real
windows, use a browser runner such as Playwright (the library's own E2E suite in
`tests/e2e` is an example).

For how the ParleyJS repository itself is tested, see
[TESTING.md](./TESTING.md).

## Table of Contents

1. [Test Structure](#test-structure)
2. [Unit Testing Patterns](#unit-testing-patterns)
3. [Integration Testing](#integration-testing)
4. [Mocking Strategies](#mocking-strategies)
5. [Coverage Requirements](#coverage-requirements)

## Test Structure

### Recommended Organization

```
tests/
├── unit/
│   ├── handlers.test.ts          # Handler logic called directly
│   └── origin-validation.test.ts # Messages from wrong origins are ignored
├── integration/
│   ├── request-response.test.ts  # Parley + fake peer window
│   └── lifecycle.test.ts         # Connect, disconnect, destroy
├── e2e/                          # Real browser, real windows (optional)
└── helpers/
    └── parley-test-helpers.ts    # fakeWindow, protocol messages, deliver()
```

## Unit Testing Patterns

### Testing Message Handlers Directly

The simplest and most robust unit test calls your handler function directly with
a mock `respond` and realistic metadata. Register the same function with
`parley.on()` in production code.

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { MessageMetadata } from 'ignite-parleyjs';

// Production code: parley.on('calculate', handleCalculate);
export function handleCalculate(
    payload: { x: number; y: number },
    respond: (response: unknown) => void,
    _metadata: MessageMetadata
) {
    respond({ result: payload.x + payload.y });
}

function metadata(overrides: Partial<MessageMetadata> = {}): MessageMetadata {
    return {
        messageId: 'msg-1',
        senderId: 'child', // local targetId of the sender
        origin: 'https://child.example.com', // browser-verified origin
        timestamp: Date.now(),
        expectsResponse: true,
        ...overrides,
    };
}

describe('handleCalculate', () => {
    it('responds with the sum', () => {
        const respond = vi.fn();
        handleCalculate({ x: 5, y: 3 }, respond, metadata());
        expect(respond).toHaveBeenCalledWith({ result: 8 });
    });
});
```

`MessageMetadata` has exactly these fields: `messageId`, `senderId`, `origin`,
`timestamp`, and `expectsResponse`. There is no `type` or `targetId` field.

## Integration Testing

These tests use the helpers from [Mocking Strategies](#mocking-strategies). They
create a real `Parley` instance, connect it to a fake peer window, deliver
protocol messages "from" that window, and inspect what Parley posted back.

### Testing Inbound Messages

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Parley } from 'ignite-parleyjs';
import {
    ORIGIN,
    fakeWindow,
    protocolMessage,
    deliver,
    connectToFakePeer,
    tick,
} from '../helpers/parley-test-helpers';

describe('message handlers', () => {
    let parley: Parley;
    let peer: ReturnType<typeof fakeWindow>;

    beforeEach(async () => {
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: [ORIGIN],
            heartbeat: { enabled: false },
        });
        peer = fakeWindow();
        await connectToFakePeer(parley, peer, 'peer');
    });

    afterEach(() => {
        parley.destroy();
    });

    it('calls the handler for a matching message type', async () => {
        const handler = vi.fn();
        parley.on('test-message', handler);

        deliver(protocolMessage('test-message', { value: 42 }), peer);
        await tick();

        expect(handler).toHaveBeenCalledWith(
            { value: 42 },
            expect.any(Function),
            expect.objectContaining({
                senderId: 'peer',
                origin: ORIGIN,
                expectsResponse: false,
            })
        );
    });

    it('does not call the handler for other types', async () => {
        const handler = vi.fn();
        parley.on('type-a', handler);

        deliver(protocolMessage('type-b', {}), peer);
        await tick();

        expect(handler).not.toHaveBeenCalled();
    });
});
```

### Testing Origin Validation

Messages whose origin is not in `allowedOrigins` are dropped silently, so the
assertion is that the handler is never called:

```typescript
it('ignores messages from origins that are not allowed', async () => {
    const handler = vi.fn();
    parley.on('test', handler);

    const wrongOrigins = [
        'https://example.com:8443', // Different port
        'http://example.com', // Different protocol
        'https://sub.example.com', // Subdomain
        'https://evil.com',
    ];

    for (const origin of wrongOrigins) {
        deliver(protocolMessage('test', {}), peer, origin);
    }
    await tick();

    expect(handler).not.toHaveBeenCalled();
});

it('ignores messages from a window that is not the connected target', async () => {
    const handler = vi.fn();
    parley.on('test', handler);

    deliver(protocolMessage('test', {}), fakeWindow()); // different source
    await tick();

    expect(handler).not.toHaveBeenCalled();
});

it('rejects wildcard origins at configuration time', () => {
    expect(() =>
        Parley.create({ targetType: 'window', allowedOrigins: ['*'] })
    ).toThrow(/Configuration error/);
});
```

### Testing Request-Response

When your code sends a request, the fake peer has to answer it. Read the request
from the peer's `postMessage` mock and deliver a response message:

```typescript
import { lastPosted, responseMessage } from '../helpers/parley-test-helpers';
import { TimeoutError } from 'ignite-parleyjs';

it('resolves send() with the response payload', async () => {
    const pending = parley.send(
        'calculate',
        { x: 5, y: 3 },
        { targetId: 'peer' }
    );
    await tick();

    const request = lastPosted(peer, 'calculate');
    deliver(responseMessage(request._id, { result: 8 }), peer);

    await expect(pending).resolves.toEqual({ result: 8 });
});

it('rejects with TimeoutError when no response arrives', async () => {
    await expect(
        parley.send('slow-operation', {}, { targetId: 'peer', timeout: 100 })
    ).rejects.toBeInstanceOf(TimeoutError);
});
```

### Testing Error Scenarios

When the other side's handler throws, its ParleyJS instance sends an error
response with code `ERR_HANDLER_ERROR` and the generic message `'Handler error'`
(unless it was created with `exposeHandlerErrors: true`). `send()` rejects with
a `ParleyError` carrying that code:

```typescript
it('rejects send() with ERR_HANDLER_ERROR when the remote handler throws', async () => {
    const pending = parley.send('failing-operation', {}, { targetId: 'peer' });
    await tick();

    const request = lastPosted(peer, 'failing-operation');
    deliver(
        responseMessage(request._id, undefined, {
            success: false,
            error: { code: 'ERR_HANDLER_ERROR', message: 'Handler error' },
        }),
        peer
    );

    await expect(pending).rejects.toMatchObject({
        code: 'ERR_HANDLER_ERROR',
        message: 'Handler error',
    });
});
```

The reverse direction (your handler throws) can be tested on the instance under
test: deliver a request with `_expectsResponse: true` and check that the
response posted to the peer has `success: false` and
`error.code === 'ERR_HANDLER_ERROR'`. The local instance also emits
`system:error` with the full error message.

## Mocking Strategies

### Test Helpers

These helpers build messages in the ParleyJS wire format. The field names
(`_parley`, `_v`, `_id`, `_type`, ...) and the handshake message type are
protocol details: use them only in tests, and expect to update them if the
protocol changes in a future major version.

```typescript
// tests/helpers/parley-test-helpers.ts
import { vi } from 'vitest';
import type { Parley } from 'ignite-parleyjs';

export const ORIGIN = 'https://example.com';

/** A minimal stand-in for another browser window */
export function fakeWindow() {
    return {
        closed: false,
        document: { readyState: 'complete' },
        location: { origin: ORIGIN },
        postMessage: vi.fn(),
    };
}

/** A complete ParleyJS request/notification message */
export function protocolMessage(
    type: string,
    payload: unknown,
    expectsResponse = false
) {
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

/** A ParleyJS response to the request with id `requestId` */
export function responseMessage(
    requestId: string,
    payload: unknown,
    overrides: Record<string, unknown> = {}
) {
    return {
        _parley: '__parley__',
        _v: '1.0.0',
        _id: crypto.randomUUID(),
        _requestId: requestId,
        _timestamp: Date.now(),
        _origin: ORIGIN,
        success: true,
        payload,
        ...overrides,
    };
}

/**
 * Dispatch a message on `window` as if `source` had posted it.
 * `source` must be the connected target window (Parley binds each
 * connection to its window) and `origin` must be allowed.
 */
export function deliver(data: unknown, source: unknown, origin = ORIGIN) {
    const event = new MessageEvent('message', { data, origin });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
}

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Connect a targetType: 'window' instance by playing the peer's handshake */
export async function connectToFakePeer(
    parley: Parley,
    peer: ReturnType<typeof fakeWindow>,
    targetId: string
) {
    const pending = parley.connect(peer as unknown as Window, targetId);
    await tick();
    deliver(
        protocolMessage('__parley_handshake_init__', { ready: true }),
        peer
    );
    await pending;
}

/** The last message of the given type that Parley posted to `peer` */
export function lastPosted(peer: ReturnType<typeof fakeWindow>, type: string) {
    const messages = peer.postMessage.mock.calls.map((call) => call[0]);
    return messages.reverse().find((m) => m._type === type);
}
```

Notes:

- Pass `heartbeat: { enabled: false }` when creating the instance, or heartbeat
  pings will appear among the posted messages.
- Always call `destroy()` in `afterEach`: each instance listens for `message`
  events on `window`.
- A message whose `source` is not the connected target, whose `origin` is not
  allowed, or that is missing protocol fields is dropped, so a test that skips
  any of them will see "nothing happens".
- These helpers use `targetType: 'window'` because a plain object can stand in
  for a window. Handler, response, and error behavior is the same for iframe
  instances; to test iframe-specific wiring, use a real browser (E2E).

### Mocking Parley Entirely

For components that only call `parley.send()`, it is often enough to stub it:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});
vi.spyOn(parley, 'send').mockResolvedValue({ success: true });
```

## Coverage Requirements

### Library Thresholds

The ParleyJS repository enforces these thresholds in `vitest.config.ts`: lines
66%, functions 67%, branches 62%, statements 66% (measured line coverage is
about 80%). Choose thresholds for your own project that match its needs.

### Code Worth Covering Thoroughly

- Origin configuration and handling of untrusted senders
- Handler error paths (`ERR_HANDLER_ERROR`, `ERR_NO_HANDLER`)
- Timeouts and retries
- Resource cleanup (`destroy()`, unsubscribe functions)
- Connection lifecycle (`system:connection_lost`, `system:disconnected`)

### Testing Checklist

For each feature:

- [ ] Happy path test
- [ ] Error path test
- [ ] Edge case test
- [ ] Security validation test
- [ ] Integration test
- [ ] Performance test (if performance-critical)

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run a specific test file
npx vitest run tests/unit/handlers.test.ts

# Run in watch mode
npm run test:watch

# Run tests whose name matches a pattern
npx vitest run -t "origin validation"
```

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Clean Up**: Always destroy Parley instances in afterEach
3. **Meaningful Names**: Test names should describe what is being tested
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Test Handlers Directly** where you can; use the fake-peer helpers for the
   messaging path
6. **Test Error Cases**: Error handling is critical
7. **Use Realistic Data**: Test with production-like payloads (remember they are
   JSON-cloned in real use)

---

### Navigation

**Related Documentation**:

- [Testing Guide](./TESTING.md) - How the library is tested
- [Code Patterns](./CODE_PATTERNS.md) - Common coding patterns
- [API Reference](./API.md) - Complete API details

**Back to**: [Documentation Home](./index.md)
