# Testing Guide

This document provides comprehensive guidance for running, writing, and
reviewing tests for parley-js. The test suite is built using Vitest with
happy-dom as the DOM environment.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Commands](#test-commands)
3. [Project Structure](#project-structure)
4. [Writing Tests](#writing-tests)
5. [Test Utilities](#test-utilities)
6. [Test Fixtures](#test-fixtures)
7. [Coverage Requirements](#coverage-requirements)
8. [Best Practices](#best-practices)
9. [Debugging Tests](#debugging-tests)
10. [Common Patterns](#common-patterns)

---

## Quick Start

Install dependencies and run all tests:

```bash
npm install
npm run test:run
```

For interactive development with watch mode:

```bash
npm test
```

---

## Test Commands

The following npm scripts are available for testing:

| Command                 | Description                       |
| ----------------------- | --------------------------------- |
| `npm test`              | Run tests in watch mode (default) |
| `npm run test:run`      | Run all tests once and exit       |
| `npm run test:watch`    | Run tests in watch mode           |
| `npm run test:coverage` | Run tests with coverage report    |
| `npm run test:ui`       | Open Vitest UI in browser         |
| `npm run test:debug`    | Run tests with debugger attached  |

### Running Specific Tests

Run tests matching a pattern:

```bash
npx vitest run EventEmitter
```

Run a single test file:

```bash
npx vitest run tests/unit/EventEmitter.test.ts
```

Run tests with verbose output:

```bash
npx vitest run --reporter=verbose
```

---

## Project Structure

```
tests/
├── fixtures/           # Shared test data and message definitions
│   └── test-messages.ts
├── unit/               # Unit tests for each module
│   ├── BaseChannel.test.ts
│   ├── EventEmitter.test.ts
│   ├── HeartbeatManager.test.ts
│   ├── MessageRegistry.test.ts
│   ├── OriginValidator.test.ts
│   ├── Parley.test.ts
│   ├── SchemaValidator.test.ts
│   ├── SecurityLayer.test.ts
│   └── TargetManager.test.ts
└── utils/              # Test helper functions and mock factories
    ├── mock-factory.ts
    └── test-helpers.ts
```

### Source-to-Test Mapping

Each source file has a corresponding test file:

| Source File                         | Test File                             |
| ----------------------------------- | ------------------------------------- |
| `src/core/Parley.ts`                | `tests/unit/Parley.test.ts`           |
| `src/events/EventEmitter.ts`        | `tests/unit/EventEmitter.test.ts`     |
| `src/core/HeartbeatManager.ts`      | `tests/unit/HeartbeatManager.test.ts` |
| `src/core/MessageRegistry.ts`       | `tests/unit/MessageRegistry.test.ts`  |
| `src/core/TargetManager.ts`         | `tests/unit/TargetManager.test.ts`    |
| `src/security/OriginValidator.ts`   | `tests/unit/OriginValidator.test.ts`  |
| `src/security/SecurityLayer.ts`     | `tests/unit/SecurityLayer.test.ts`    |
| `src/validation/SchemaValidator.ts` | `tests/unit/SchemaValidator.test.ts`  |
| `src/communication/BaseChannel.ts`  | `tests/unit/BaseChannel.test.ts`      |

---

## Writing Tests

### Test File Structure

Follow this standard structure for test files:

```typescript
/**
 * @file ComponentName.test.ts
 * @description Unit tests for ComponentName class
 * @module tests/unit
 *
 * Tests all public methods of the ComponentName class:
 * - methodA() - Brief description
 * - methodB() - Brief description
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentName } from '../../src/path/ComponentName';

describe('ComponentName', () => {
    let instance: ComponentName;

    beforeEach(() => {
        instance = new ComponentName();
    });

    afterEach(() => {
        // Cleanup
    });

    // ========================================================================
    // Constructor
    // ========================================================================

    describe('constructor', () => {
        it('should create instance with default values', () => {
            expect(instance).toBeDefined();
        });
    });

    // ========================================================================
    // methodA()
    // ========================================================================

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

### Test Naming Conventions

Use descriptive test names that explain what behavior is being tested:

```typescript
// Good: Describes expected behavior
it('should return empty array when no listeners registered', () => {});
it('should throw error when origin is not in allowed list', () => {});
it('should emit connected event after successful handshake', () => {});

// Avoid: Too vague or implementation-focused
it('works', () => {});
it('test methodA', () => {});
it('returns true', () => {});
```

### Testing Async Code

Use async/await for asynchronous tests:

```typescript
it('should resolve with response data', async () => {
    const result = await instance.sendAsync({ type: 'test', data: 'hello' });
    expect(result).toEqual({ success: true });
});
```

For testing timeouts and delays, use fake timers:

```typescript
it('should timeout after configured duration', async () => {
    vi.useFakeTimers();

    const promise = instance.waitForResponse();

    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow('Timeout');

    vi.useRealTimers();
});
```

### Testing Error Conditions

Always test error paths and edge cases:

```typescript
describe('error handling', () => {
    it('should throw ParleyError when target not found', () => {
        expect(() => instance.send('unknown', { type: 'test' })).toThrow(
            ParleyError
        );
    });

    it('should emit error event on validation failure', async () => {
        const errorHandler = vi.fn();
        instance.on('error', errorHandler);

        await instance.processMessage(invalidMessage);

        expect(errorHandler).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'VALIDATION_ERROR' })
        );
    });
});
```

---

## Test Utilities

### Mock Factory (tests/utils/mock-factory.ts)

The mock factory provides reusable mock objects:

#### createMockWindow(id)

Creates a mock window object for testing postMessage communication:

```typescript
import { createMockWindow } from '../utils/mock-factory';

const mockWindow = createMockWindow('child');

// Trigger a message event on the mock window
mockWindow._triggerMessage({ type: 'test:message' }, 'https://example.com');

// Check if window is closed
expect(mockWindow.closed).toBe(false);
mockWindow._close();
expect(mockWindow.closed).toBe(true);
```

#### createConnectedMockWindows(idA, idB)

Creates a pair of mock windows wired together for bidirectional communication:

```typescript
import { createConnectedMockWindows } from '../utils/mock-factory';

const [parent, child] = createConnectedMockWindows('parent', 'child');

// Messages sent from parent are received by child
parent.postMessage({ type: 'hello' }, '*');
```

#### createMockIframe(id)

Creates a mock iframe element with contentWindow:

```typescript
import { createMockIframe } from '../utils/mock-factory';

const mockIframe = createMockIframe('widget');
expect(mockIframe.contentWindow).toBeDefined();
```

#### createDefaultConfig()

Creates a complete ParleyConfig object with sensible defaults:

```typescript
import { createDefaultConfig } from '../utils/mock-factory';

const config = createDefaultConfig({
    allowedOrigins: ['https://custom.example.com'],
});
```

### Test Helpers (tests/utils/test-helpers.ts)

#### waitForEvent(emitter, eventName, timeout?)

Waits for a specific event to be emitted:

```typescript
import { waitForEvent } from '../utils/test-helpers';

const data = await waitForEvent(instance, 'connected', 1000);
expect(data.targetId).toBe('child');
```

#### waitForEvents(emitter, eventName, count, timeout?)

Waits for multiple occurrences of an event:

```typescript
import { waitForEvents } from '../utils/test-helpers';

const messages = await waitForEvents(instance, 'message', 3);
expect(messages).toHaveLength(3);
```

#### createDeferred()

Creates a deferred promise for controlling async flow in tests:

```typescript
import { createDeferred } from '../utils/test-helpers';

const deferred = createDeferred<string>();

// In test setup, resolve at the right time
setTimeout(() => deferred.resolve('done'), 100);

const result = await deferred.promise;
expect(result).toBe('done');
```

#### delay(ms)

Simple promise-based delay:

```typescript
import { delay } from '../utils/test-helpers';

await instance.startOperation();
await delay(50);
expect(instance.isComplete).toBe(true);
```

#### captureConsole(method)

Captures console output during a test:

```typescript
import { captureConsole } from '../utils/test-helpers';

const logs = captureConsole('warn');

instance.deprecatedMethod();

logs.restore();
expect(logs.calls).toContainEqual(['This method is deprecated']);
```

---

## Test Fixtures

### Test Messages (tests/fixtures/test-messages.ts)

Provides standardized test messages with schemas and validation cases:

```typescript
import { TEST_MESSAGE_TYPES } from '../fixtures/test-messages';

describe('message validation', () => {
    const { schema, validPayloads, invalidPayloads } =
        TEST_MESSAGE_TYPES.USER_UPDATE;

    it.each(validPayloads)('should accept valid payload: %j', (payload) => {
        expect(validator.validate(schema, payload).valid).toBe(true);
    });

    it.each(invalidPayloads)(
        'should reject invalid payload: %j',
        ({ payload, expectedError }) => {
            const result = validator.validate(schema, payload);
            expect(result.valid).toBe(false);
            expect(result.error).toContain(expectedError);
        }
    );
});
```

Available test message types:

| Type              | Description                                     |
| ----------------- | ----------------------------------------------- |
| `SIMPLE`          | Basic message with single string field          |
| `USER_UPDATE`     | User data with required and optional fields     |
| `DOCUMENT_CHANGE` | Nested objects and arrays                       |
| `COMPLEX`         | Multiple data types including nested structures |
| `ANALYTICS_EVENT` | Analytics tracking message                      |
| `ERROR_REPORT`    | Error reporting with stack traces               |
| `FEATURE_FLAG`    | Feature toggle configuration                    |

---

## Coverage Requirements

The project maintains the following coverage thresholds:

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 55%       |
| Functions  | 55%       |
| Branches   | 50%       |
| Statements | 55%       |

### Running Coverage

Generate a coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in multiple formats:

- `coverage/` - HTML report (open `index.html` in browser)
- Terminal output with summary
- `lcov.info` - For CI integration

### Excluded from Coverage

The following files are excluded from coverage requirements:

- `tests/` - Test files themselves
- `**/*.d.ts` - Type declaration files
- `**/*.config.ts` - Configuration files
- `**/index.ts` - Re-export barrel files
- `**/WindowChannel.ts` - Requires integration tests

---

## Best Practices

### 1. Test One Thing Per Test

Each test should verify a single behavior:

```typescript
// Good: One assertion per behavior
it('should increment count on successful operation', () => {
    instance.performOperation();
    expect(instance.count).toBe(1);
});

it('should emit success event on successful operation', async () => {
    const handler = vi.fn();
    instance.on('success', handler);

    await instance.performOperation();

    expect(handler).toHaveBeenCalled();
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

Organize tests with clear section comments:

```typescript
// ========================================================================
// methodName() - Brief description
// ========================================================================

describe('methodName()', () => {
    // Tests here
});
```

### 3. Clean Up After Tests

Always clean up resources in afterEach or afterAll:

```typescript
afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    instance.destroy();
});
```

### 4. Avoid Test Interdependence

Each test should be independent and not rely on state from other tests:

```typescript
// Good: Fresh instance for each test
beforeEach(() => {
    instance = new MyClass();
});

// Avoid: Shared mutable state between tests
let sharedInstance = new MyClass();
```

### 5. Use Factory Functions for Complex Setup

When setup is complex, use helper functions:

```typescript
function createConfiguredInstance(overrides = {}) {
    return new MyClass({
        timeout: 1000,
        retries: 3,
        ...overrides,
    });
}

it('should use custom timeout', () => {
    const instance = createConfiguredInstance({ timeout: 5000 });
    expect(instance.timeout).toBe(5000);
});
```

### 6. Test Edge Cases

Always consider and test boundary conditions:

```typescript
describe('edge cases', () => {
    it('should handle empty string', () => {});
    it('should handle null input', () => {});
    it('should handle maximum allowed value', () => {});
    it('should handle special characters', () => {});
    it('should handle concurrent calls', () => {});
});
```

---

## Debugging Tests

### Using the Debugger

Run tests with the Node.js debugger:

```bash
npm run test:debug
```

Then attach your debugger (VS Code or Chrome DevTools).

### Adding Breakpoints

Use the `debugger` statement in your test:

```typescript
it('should process data correctly', () => {
    const data = prepareTestData();
    debugger; // Execution will pause here
    const result = instance.process(data);
    expect(result).toBeDefined();
});
```

### Verbose Logging

Enable verbose output for specific tests:

```typescript
it('should handle complex scenario', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Your test code
    console.log('Current state:', instance.getState());
});
```

### Isolating Failing Tests

Run only specific tests using `.only`:

```typescript
describe.only('failing test group', () => {
    it.only('this specific test', () => {
        // Only this test will run
    });
});
```

Remember to remove `.only` before committing.

### Skipping Tests

Skip tests temporarily with `.skip`:

```typescript
it.skip('test that needs fixing', () => {
    // This test will not run
});
```

---

## Common Patterns

### Testing Event Emissions

```typescript
it('should emit event with correct payload', async () => {
    const handler = vi.fn();
    instance.on('myEvent', handler);

    await instance.triggerSomething();

    expect(handler).toHaveBeenCalledWith({
        type: 'expected',
        data: expect.any(Object),
    });
});
```

### Testing with Spies

```typescript
it('should call internal method', () => {
    const spy = vi.spyOn(instance, 'internalMethod');

    instance.publicMethod();

    expect(spy).toHaveBeenCalledWith('expected arg');
});
```

### Testing Callbacks

```typescript
it('should invoke callback on completion', () => {
    const callback = vi.fn();

    instance.doAsync(callback);

    expect(callback).toHaveBeenCalledWith(null, { success: true });
});
```

### Testing Abstract Classes

Create a concrete test implementation:

```typescript
class TestChannel extends BaseChannel {
    protected _postMessage(message: unknown): void {
        this.lastSentMessage = message;
    }

    // Expose protected methods for testing
    public testHandleMessage(event: MessageEvent): void {
        this._handleMessageEvent(event);
    }
}

describe('BaseChannel', () => {
    let channel: TestChannel;

    beforeEach(() => {
        channel = new TestChannel(config);
    });
});
```

### Testing Promise Rejection

```typescript
it('should reject with specific error', async () => {
    await expect(instance.failingOperation()).rejects.toThrow(
        'Expected error message'
    );
});

it('should reject with error code', async () => {
    await expect(instance.failingOperation()).rejects.toMatchObject({
        code: 'ERROR_CODE',
        message: expect.stringContaining('error'),
    });
});
```

### Testing State Transitions

```typescript
it('should transition through expected states', async () => {
    const states: string[] = [];
    instance.on('stateChange', (state) => states.push(state));

    await instance.connect();
    await instance.disconnect();

    expect(states).toEqual([
        'connecting',
        'connected',
        'disconnecting',
        'disconnected',
    ]);
});
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [happy-dom Documentation](https://github.com/capricorn86/happy-dom)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)

For questions about testing patterns or to report issues with the test suite,
please open an issue in the repository.
