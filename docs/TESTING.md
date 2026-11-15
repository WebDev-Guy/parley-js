[Home](./index.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Testing Guide

# Testing Guide

Parley-js is tested with unit, integration, and security tests using
<a href="https://vitest.dev/" target="_blank">Vitest</a> (in a happy-dom
environment) and with end-to-end tests in a real browser using
<a href="https://playwright.dev/" target="_blank">Playwright</a>. Measured line
coverage is about 80%; CI enforces the thresholds in `vitest.config.ts` (see
[Coverage Requirements](#coverage-requirements)).

For testing patterns you can use in your own application, see
[Testing Patterns](./TESTING_PATTERNS.md).

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Commands](#test-commands)
3. [Test Structure](#test-structure)
4. [Test Categories](#test-categories)
5. [Coverage Requirements](#coverage-requirements)
6. [Writing Tests](#writing-tests)
7. [Test Utilities](#test-utilities)
8. [Test Fixtures](#test-fixtures)
9. [Best Practices](#best-practices)
10. [Debugging Tests](#debugging-tests)
11. [Common Patterns](#common-patterns)
12. [Continuous Integration](#continuous-integration)
13. [Contributing](#contributing)

---

## Quick Start

Install dependencies and run all tests:

```bash
npm install
npm test
```

For coverage reports:

```bash
npm run test:coverage
```

For the browser end-to-end suite (builds the library first):

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

---

## Test Commands

| Command                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm test`              | Run Vitest (watch mode in a terminal)                |
| `npm run test:run`      | Run all Vitest tests once and exit                   |
| `npm run test:watch`    | Run tests in watch mode                              |
| `npm run test:coverage` | Run tests once with a coverage report (enforced)     |
| `npm run test:ui`       | Open the Vitest UI in a browser                      |
| `npm run test:debug`    | Run Vitest with the Node inspector (`--inspect-brk`) |
| `npm run bench`         | Run the hot-path micro-benchmarks (`vitest bench`)   |
| `npm run test:e2e`      | Build, then run the Playwright E2E suite             |
| `npm run test:e2e:ui`   | Build, then open the Playwright UI                   |
| `npm run typecheck`     | Type-check the project with `tsc`                    |
| `npm run size`          | Check the bundle size budget (requires a build)      |

### Running Specific Tests

Run tests matching a pattern:

```bash
npx vitest run EventEmitter
```

Run a single test file:

```bash
npx vitest run tests/unit/EventEmitter.test.ts
```

Run one category:

```bash
npm test tests/security/
```

---

## Test Structure

### Directory Organization

```
tests/
├── unit/                    # Unit tests (one component at a time)
│   ├── AnalyticsHooks.test.ts
│   ├── BaseChannel.test.ts
│   ├── ConnectionManager.test.ts
│   ├── EventEmitter.test.ts
│   ├── HandshakeController.test.ts
│   ├── HeartbeatManager.test.ts
│   ├── Helpers.test.ts
│   ├── IframeChannel.test.ts
│   ├── Logger.test.ts
│   ├── MessageProtocol.test.ts
│   ├── MessageRegistry.test.ts
│   ├── OriginValidator.test.ts
│   ├── Parley.test.ts
│   ├── SchemaValidator.test.ts
│   ├── SecurityLayer.test.ts
│   ├── TargetManager.test.ts
│   ├── WindowChannel.test.ts
│   ├── hot-path.test.ts
│   └── mangle-props.test.ts
├── integration/             # Multi-component flows
│   ├── broadcast.test.ts
│   ├── correctness-fixes.test.ts
│   ├── error-recovery.test.ts
│   ├── full-lifecycle.test.ts
│   ├── heartbeat-monitoring.test.ts
│   ├── iframe-communication.test.ts
│   ├── lifecycle-events.test.ts
│   ├── schema-validation.test.ts
│   └── window-communication.test.ts
├── security/                # Security behavior
│   ├── error-info-disclosure.test.ts
│   ├── inbound-hardening.test.ts
│   ├── listener-limits.test.ts
│   ├── message-validation.test.ts
│   ├── origin-validation.test.ts
│   ├── payload-sanitization.test.ts
│   ├── payload-size-limits.test.ts
│   ├── postmessage-security.test.ts
│   └── schema-validation-dos.test.ts
├── bench/                   # Micro-benchmarks (npm run bench)
│   └── hot-path.bench.ts
├── e2e/                     # Playwright specs (real browser, two origins)
│   ├── fixtures/            # HTML pages loaded by the specs
│   ├── iframe-communication.spec.ts
│   ├── window-communication.spec.ts
│   └── server.mjs           # Static server used by playwright.config.ts
├── fixtures/                # Test data
│   └── test-messages.ts
└── utils/                   # Test utilities
    ├── mock-factory.ts
    └── test-helpers.ts
```

Vitest runs `tests/**/*.test.ts` and excludes `tests/e2e`; Playwright runs
`tests/e2e/*.spec.ts`.

### Source-to-Test Mapping

| Source File                                | Test File                                |
| ------------------------------------------ | ---------------------------------------- |
| `src/core/Parley.ts`                       | `tests/unit/Parley.test.ts`              |
| `src/core/ConnectionManager.ts`            | `tests/unit/ConnectionManager.test.ts`   |
| `src/core/HeartbeatManager.ts`             | `tests/unit/HeartbeatManager.test.ts`    |
| `src/core/MessageRegistry.ts`              | `tests/unit/MessageRegistry.test.ts`     |
| `src/core/TargetManager.ts`                | `tests/unit/TargetManager.test.ts`       |
| `src/core/MessageProtocol.ts`              | `tests/unit/MessageProtocol.test.ts`     |
| `src/events/EventEmitter.ts`               | `tests/unit/EventEmitter.test.ts`        |
| `src/security/OriginValidator.ts`          | `tests/unit/OriginValidator.test.ts`     |
| `src/security/SecurityLayer.ts`            | `tests/unit/SecurityLayer.test.ts`       |
| `src/validation/SchemaValidator.ts`        | `tests/unit/SchemaValidator.test.ts`     |
| `src/communication/BaseChannel.ts`         | `tests/unit/BaseChannel.test.ts`         |
| `src/communication/HandshakeController.ts` | `tests/unit/HandshakeController.test.ts` |
| `src/communication/IframeChannel.ts`       | `tests/unit/IframeChannel.test.ts`       |
| `src/communication/WindowChannel.ts`       | `tests/unit/WindowChannel.test.ts`, E2E  |
| `src/utils/Logger.ts`                      | `tests/unit/Logger.test.ts`              |
| `src/utils/Helpers.ts`                     | `tests/unit/Helpers.test.ts`             |

---

## Test Categories

### Unit Tests

Test individual components in isolation.

**Purpose:**

- Verify single function/class behavior
- Test edge cases and error conditions
- Ensure proper error handling

**Example:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../../src/events/EventEmitter';

describe('EventEmitter', () => {
    it('should register and trigger event listeners', () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();

        emitter.on('test', handler);
        emitter.emit('test', { data: 'value' });

        expect(handler).toHaveBeenCalledWith({ data: 'value' });
    });
});
```

### Integration and Security Tests (happy-dom)

These tests drive a real `Parley` instance through the browser messaging path
without real iframes. The pattern used in the repository (see
`tests/security/inbound-hardening.test.ts` and
`tests/integration/correctness-fixes.test.ts`):

1. Create a `Parley` with `targetType: 'window'` and heartbeats disabled.
2. Use a fake target window: an object with `closed`, `postMessage: vi.fn()` and
   similar fields.
3. Deliver inbound messages by dispatching a `MessageEvent` on `window` whose
   `data` is a full protocol message, whose `origin` is allowed, and whose
   `source` is the fake target window. `source` must be set with
   `Object.defineProperty`, because each connection only accepts messages from
   its own target window.
4. Inspect what Parley posted via the fake window's `postMessage` mock.

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
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

function deliver(data: unknown, source: unknown, origin = ORIGIN) {
    const event = new MessageEvent('message', { data, origin });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('handler errors', () => {
    let parley: Parley | undefined;
    afterEach(() => parley?.destroy());

    it('responds with ERR_HANDLER_ERROR when a handler throws', async () => {
        parley = Parley.create({
            targetType: 'window',
            allowedOrigins: [ORIGIN],
            heartbeat: { enabled: false },
        });
        const win = fakeWindow();

        // Complete the handshake as the "other side"
        const pending = parley.connect(win as unknown as Window, 'peer');
        await tick();
        deliver(request('__parley_handshake_init__', { ready: true }), win);
        await pending;

        parley.on('boom', () => {
            throw new Error('secret detail');
        });

        deliver(request('boom', {}, true), win);
        await tick();
        await tick();

        const sent = win.postMessage.mock.calls.map((c) => c[0]);
        const reply = sent.reverse().find((m) => '_requestId' in m);
        expect(reply.success).toBe(false);
        expect(reply.error.code).toBe('ERR_HANDLER_ERROR');
        expect(reply.error.message).toBe('Handler error');
    });
});
```

The `__parley_handshake_init__` type and the protocol field names are internal
details of the wire protocol; they are used here because these tests exercise
the library itself.

### End-to-End Tests (Playwright)

`tests/e2e` runs in Chromium against two static servers started by
`playwright.config.ts`: `http://127.0.0.1:4173` (parent origin) and
`http://localhost:4174` (child origin). Different host strings are different
origins, so the suite exercises real cross-origin `postMessage` without TLS. The
fixture pages in `tests/e2e/fixtures` load the built IIFE bundle, which is why
`npm run test:e2e` runs `npm run build` first.

The specs cover, among other things: handshake and request/response with a
cross-origin iframe, connecting after the iframe has already loaded, handshake
failure when the child never initializes or does not trust the parent origin,
reconnecting to a fresh iframe, and popup communication including popup-close
detection. `WindowChannel` (which needs `window.open`) is covered here rather
than by the coverage-measured Vitest suite.

---

## Coverage Requirements

Thresholds are defined in `vitest.config.ts` and enforced by
`npm run test:coverage` (CI fails below them):

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 66%       |
| Functions  | 67%       |
| Branches   | 62%       |
| Statements | 66%       |

The thresholds track current actuals and are ratcheted upward as coverage
improves. Measured line coverage is about 80%.

### How Coverage is Measured

Coverage uses the V8 provider and reports line, branch, function and statement
coverage.

### Viewing Coverage Reports

After running `npm run test:coverage`:

- The terminal shows a per-file summary
- `coverage/index.html` contains the HTML report
- `coverage/lcov.info` is used by CI (Codecov)
- `coverage/coverage-final.json` contains the JSON report

### Excluded from Coverage

- `node_modules/`, `dist/`, `tests/`
- `**/*.d.ts` - Type declaration files
- `**/*.config.ts` - Configuration files
- `**/index.ts` - Re-export barrel files
- `**/WindowChannel.ts` - Needs a real browser (`window.open`); covered by the
  Playwright E2E suite

---

## Writing Tests

### Test File Structure

Follow this structure for test files:

```typescript
/**
 * @file ComponentName.test.ts
 * @description Unit tests for ComponentName class
 * @module tests/unit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentName } from '../../src/path/ComponentName';

describe('ComponentName', () => {
    let instance: ComponentName;

    beforeEach(() => {
        instance = new ComponentName();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('methodA()', () => {
        it('should do expected behavior', () => {
            // Arrange
            const input = 'test';

            // Act
            const result = instance.methodA(input);

            // Assert
            expect(result).toBe('expected');
        });
    });
});
```

Vitest globals (`describe`, `it`, `expect`, `vi`) are enabled in the config, but
explicit imports are preferred for clarity.

### Test Naming Conventions

Use descriptive test names that explain the behavior being tested:

```typescript
// Good: Describes expected behavior
it('should return empty array when no listeners registered', () => {});
it('should drop messages whose origin is not allowed', () => {});
it('should emit system:connected after a successful handshake', () => {});

// Avoid: Too vague or implementation-focused
it('works', () => {});
it('test methodA', () => {});
```

### Testing Async Code

Use async/await for asynchronous tests. For timeouts, use fake timers:

```typescript
import { Parley } from '../../src/core/Parley';

it('rejects connect() when the handshake never completes', async () => {
    vi.useFakeTimers();

    const parley = Parley.create({
        targetType: 'window',
        allowedOrigins: ['https://example.com'],
        timeout: 1000,
        heartbeat: { enabled: false },
    });
    const win = { closed: false, postMessage: vi.fn() };

    const pending = parley.connect(win as unknown as Window, 'peer');
    const assertion = expect(pending).rejects.toMatchObject({
        code: 'ERR_CONNECTION_HANDSHAKE_FAILED',
    });

    await vi.advanceTimersByTimeAsync(1500);
    await assertion;

    parley.destroy();
    vi.useRealTimers();
});
```

### Testing Error Conditions

Always test error paths. Configuration errors are thrown synchronously by
`Parley.create()`:

```typescript
it('rejects a wildcard origin', () => {
    expect(() =>
        Parley.create({ targetType: 'iframe', allowedOrigins: ['*'] })
    ).toThrow(/Configuration error/);
});

it('rejects send() to an unknown target', async () => {
    const parley = Parley.create({
        targetType: 'iframe',
        allowedOrigins: ['https://example.com'],
    });

    await expect(
        parley.send('ping', {}, { targetId: 'nope' })
    ).rejects.toMatchObject({ code: 'ERR_TARGET_NOT_CONNECTED' });

    parley.destroy();
});
```

---

## Test Utilities

### Mock Factory (tests/utils/mock-factory.ts)

#### createMockWindow(id)

Creates a mock window object with message listeners, `postMessage` (a
`vi.fn()`), and helpers `_triggerMessage(data, origin?)`, `_getListeners()` and
`_close()`:

```typescript
import { createMockWindow } from '../utils/mock-factory';

const mockWindow = createMockWindow('child');

mockWindow._triggerMessage({ type: 'test:message' }, 'https://example.com');

expect(mockWindow.closed).toBe(false);
mockWindow._close();
expect(mockWindow.closed).toBe(true);
```

Note that `_triggerMessage` dispatches events with `source: null` to the mock
window's own listeners. Parley listens on the global `window` and checks
`event.source`, so to drive a real `Parley` instance use the `deliver()` pattern
shown in
[Integration and Security Tests](#integration-and-security-tests-happy-dom).

#### createConnectedMockWindows(idA?, idB?, originA?, originB?)

Creates two mock windows whose `postMessage` triggers a message event on the
other one (asynchronously), using the given origins:

```typescript
import { createConnectedMockWindows } from '../utils/mock-factory';

const [parent, child] = createConnectedMockWindows('parent', 'child');

parent.postMessage({ type: 'hello' }, 'https://child.example.com');
```

#### createMockIframe(id?, origin?)

Creates a real `<iframe>` element whose `contentWindow` getter returns a mock
window:

```typescript
import { createMockIframe } from '../utils/mock-factory';

const mockIframe = createMockIframe('widget', 'https://widget.example.com');
expect(mockIframe.contentWindow).toBeDefined();
```

#### createTestMessage(type, payload, options?)

Builds a protocol message (`_parley`, `_v`, `_id`, `_type`, `_timestamp`,
`_origin`, `_expectsResponse`, optional `_target`, `payload`):

```typescript
import { createTestMessage } from '../utils/mock-factory';

const message = createTestMessage(
    'user:update',
    { userId: 123 },
    {
        expectsResponse: true,
    }
);
```

#### createTestConfig(overrides?)

Returns a `ParleyConfig` with test defaults (`targetType: 'window'`, a set of
example origins, a 5000 ms timeout, heartbeats disabled), merged with
`overrides`.

#### createMockLogger()

Returns a logger whose `debug`/`info`/`warn`/`error` are `vi.fn()` spies that
also record calls in a `logs` array.

### Test Helpers (tests/utils/test-helpers.ts)

| Helper                                               | Purpose                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `waitForEvent(emitter, eventName, timeout?)`         | Resolve with the next event from a library `EventEmitter` (default 1 s) |
| `waitForEvents(emitter, eventName, count, timeout?)` | Resolve with an array of `count` events                                 |
| `createDeferred<T>()`                                | `{ promise, resolve, reject }` for controlling async flow               |
| `delay(ms)`                                          | Promise-based delay                                                     |
| `flushPromises()`                                    | Let pending promise callbacks run                                       |
| `advanceTimersAndFlush(ms)`                          | Advance fake timers, then flush promises                                |
| `createCallTracker()`                                | Record calls and arguments of a function                                |
| `expectError(fn, { message?, code?, name? })`        | Assert a synchronous throw                                              |
| `expectAsyncError(fn, { message?, code?, name? })`   | Assert an async rejection                                               |
| `simulateNetworkDelay(response, delayMs)`            | Resolve with `response` after a delay                                   |

```typescript
import { createDeferred, expectAsyncError } from '../utils/test-helpers';

const deferred = createDeferred<string>();
setTimeout(() => deferred.resolve('done'), 100);
expect(await deferred.promise).toBe('done');

await expectAsyncError(() => parley.send('ping', {}, { targetId: 'missing' }), {
    code: 'ERR_TARGET_NOT_CONNECTED',
});
```

`waitForEvent` and `waitForEvents` work with the library's `EventEmitter` (which
has `once()`), not with `Parley` instances. For `Parley`, subscribe with
`onSystem()` and resolve a deferred.

---

## Test Fixtures

### Test Messages (tests/fixtures/test-messages.ts)

`TEST_MESSAGE_TYPES` provides message definitions, each with a `type`, a
`schema`, `validPayloads`, and `invalidPayloads` (`{ payload, expectedError }`):

```typescript
import { TEST_MESSAGE_TYPES } from '../fixtures/test-messages';
import { validateSchema } from '../../src/validation/SchemaValidator';

describe('message validation', () => {
    const { schema, validPayloads, invalidPayloads } =
        TEST_MESSAGE_TYPES.USER_UPDATE;

    it.each(validPayloads)('should accept valid payload: %j', (payload) => {
        expect(validateSchema(payload, schema).valid).toBe(true);
    });

    it.each(invalidPayloads)('should reject invalid payload', ({ payload }) => {
        expect(validateSchema(payload, schema).valid).toBe(false);
    });
});
```

Available test message types:

| Key               | Description                                 |
| ----------------- | ------------------------------------------- |
| `SIMPLE`          | Single required string field (`text`)       |
| `USER_UPDATE`     | User data with required and optional fields |
| `DOCUMENT_CHANGE` | Nested objects and arrays                   |
| `NOTIFICATION`    | Notification with level and message         |
| `API_REQUEST`     | API-style request payload                   |

Other exports:

- `SAMPLE_PAYLOADS` - one valid payload per message type
- `INVALID_PAYLOADS` - `null`, `undefined`, empty object, wrong types, missing
  fields, and a circular reference
- `TEST_ORIGINS` - `valid` and `invalid` origin lists for security tests
- `createRegistrationOptions(schema?, timeout?)` - builds options for
  `register()`

---

## Best Practices

### 1. Test One Behavior Per Test

```typescript
// Good: One behavior per test
it('should increment count on successful operation', () => {
    instance.performOperation();
    expect(instance.count).toBe(1);
});

// Avoid: Multiple unrelated assertions
it('should work correctly', () => {
    instance.performOperation();
    expect(instance.count).toBe(1);
    expect(instance.status).toBe('complete');
    expect(instance.errors).toHaveLength(0);
});
```

### 2. Use Descriptive Section Headers

```typescript
// ========================================================================
// methodName() - Brief description
// ========================================================================

describe('methodName()', () => {
    // Tests here
});
```

### 3. Clean Up After Tests

Always destroy Parley instances: they register a `message` listener on `window`,
and pending timers can leak between tests.

```typescript
afterEach(() => {
    parley?.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
});
```

### 4. Avoid Test Interdependence

```typescript
// Good: Fresh instance for each test
beforeEach(() => {
    parley = Parley.create({
        targetType: 'window',
        allowedOrigins: ['https://example.com'],
        heartbeat: { enabled: false },
    });
});

// Avoid: Shared mutable state between tests
const sharedParley = Parley.create({ targetType: 'window' });
```

### 5. Disable Heartbeats Unless You Test Them

Heartbeats ping every target every 5 seconds by default. Unless the test is
about heartbeats, pass `heartbeat: { enabled: false }` so pings do not interfere
with assertions on `postMessage` calls.

### 6. Test Edge Cases

```typescript
describe('edge cases', () => {
    it('should handle empty payloads', () => {});
    it('should reject circular payloads with SerializationError', () => {});
    it('should reject payloads over 10 MB', () => {});
    it('should handle concurrent requests', () => {});
});
```

---

## Debugging Tests

### Using the Debugger

```bash
npm run test:debug
```

This starts Vitest with `--inspect-brk`; attach VS Code or Chrome DevTools.

### Adding Breakpoints

```typescript
it('should process data correctly', () => {
    const data = prepareTestData();
    debugger; // Execution pauses here when a debugger is attached
    const result = instance.process(data);
    expect(result).toBeDefined();
});
```

### Library Logging

Create the instance under test with `logLevel: 'debug'` to see its internal logs
(blocked origins, handshake steps, heartbeats) in the test output.

### Isolating Failing Tests

```typescript
describe.only('failing test group', () => {
    it.only('this specific test', () => {
        // Only this test will run
    });
});
```

Remember to remove `.only` before committing (CI uses `forbidOnly` for
Playwright).

### Skipping Tests

```typescript
it.skip('test that needs fixing', () => {
    // This test will not run
});
```

### Debugging E2E Tests

```bash
npm run test:e2e:ui
```

Playwright keeps traces for failed tests (`trace: 'retain-on-failure'`), and CI
uploads the HTML report as an artifact when the E2E job fails.

---

## Common Patterns

### Testing System Events

```typescript
import { SYSTEM_EVENTS } from '../../src/events/SystemEvents';

it('emits system:disconnected with reason destroyed', async () => {
    // ...connect parley to a fake window as shown above...
    const handler = vi.fn();
    parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, handler);

    parley.destroy();

    expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: 'peer', reason: 'destroyed' })
    );
});
```

### Testing with Spies

```typescript
it('posts a message to the target window', async () => {
    // ...connect parley to fake window `win`...
    await parley.send(
        'notify',
        { a: 1 },
        {
            targetId: 'peer',
            expectsResponse: false,
        }
    );

    expect(win.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'notify', payload: { a: 1 } }),
        expect.any(String)
    );
});
```

### Testing Abstract Classes

Create a concrete test implementation that exposes protected members (see
`tests/unit/BaseChannel.test.ts` for the real one).

### Testing Promise Rejection

```typescript
it('should reject with error code', async () => {
    await expect(failingOperation()).rejects.toMatchObject({
        code: 'ERR_TIMEOUT_NO_RESPONSE',
    });
});
```

---

## Continuous Integration

`.github/workflows/test.yml` runs on pushes and pull requests to `main` and
`development`, and daily at 02:00 UTC. All actions are pinned to commit SHAs and
the workflow has read-only permissions.

| Job                  | What it runs                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `test` (Node 20, 22) | `npm ci`, `format:check`, `typecheck`, `lint:eslint`, `test:coverage` (thresholds enforced), Codecov upload |
| `security`           | `npm audit --omit=dev --audit-level=high`, the security test suite, a security coverage report              |
| `integration`        | The integration test suite                                                                                  |
| `e2e`                | Installs Chromium, runs `npm run test:e2e`, uploads the Playwright report on failure                        |
| `build`              | `npm run build` and `npm run size` (bundle size budget)                                                     |

### Coverage Enforcement

The `test` job fails if coverage drops below the thresholds in
`vitest.config.ts` (lines 66, functions 67, branches 62, statements 66). New
code should come with tests so the thresholds can keep moving up.

---

## Contributing

When contributing code:

1. Write tests for all new features and bug fixes
2. Keep coverage at or above the enforced thresholds
3. Follow existing test patterns (see the files referenced above)
4. Run `npm run test:run`, `npm run typecheck` and, for messaging changes,
   `npm run test:e2e` before submitting a PR

See
[CONTRIBUTING.md](https://github.com/WebDev-Guy/parley-js/blob/main/CONTRIBUTING.md)
for detailed guidelines.

---

## Additional Resources

- <a href="https://vitest.dev/" target="_blank">Vitest Documentation</a>
- <a href="https://playwright.dev/" target="_blank">Playwright Documentation</a>
- <a href="https://github.com/capricorn86/happy-dom" target="_blank">happy-dom
  Documentation</a>

For questions about testing patterns or to report issues with the test suite,
please open an issue in the repository.

---

## Navigation

### Related Documentation

- [Testing Patterns](./TESTING_PATTERNS.md) - Testing patterns and strategies
- [API Reference](./API.md) - Methods to test
- [Code Patterns](./CODE_PATTERNS.md) - Patterns to test

### See Also

- [Security Guide](./SECURITY.md) - Security testing
- [Examples](./EXAMPLES.md) - Examples to test
- [Contributing](https://github.com/WebDev-Guy/parley-js/blob/main/CONTRIBUTING.md) -
  Contributing tests

**Back to**: [Documentation Home](./index.md)
