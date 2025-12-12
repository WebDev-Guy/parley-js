[Home](../README.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Testing Guide

# Testing Guide

Parley-js maintains **85%+ test coverage** with comprehensive unit, integration,
and security tests using
<a href="https://vitest.dev/" target="_blank">Vitest</a>.

For testing patterns and strategies, see [Testing Patterns](./TESTING_PATTERNS.md).

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

---

## Test Commands

| Command                 | Description                       |
| ----------------------- | --------------------------------- |
| `npm test`              | Run tests in watch mode (default) |
| `npm run test:run`      | Run all tests once and exit       |
| `npm run test:watch`    | Run tests in watch mode           |
| `npm run test:coverage` | Run tests with coverage report    |
| `npm run test:ui`       | Open Vitest UI in browser         |

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

## Test Structure

### Directory Organization

```
tests/
├── unit/                    # Unit tests (isolated component testing)
│   ├── BaseChannel.test.ts
│   ├── EventEmitter.test.ts
│   ├── Helpers.test.ts
│   ├── IframeChannel.test.ts
│   ├── Logger.test.ts
│   ├── MessageProtocol.test.ts
│   └── WindowChannel.test.ts
├── integration/             # Integration tests (end-to-end flows)
│   ├── broadcast.test.ts
│   ├── error-recovery.test.ts
│   ├── full-lifecycle.test.ts
│   ├── heartbeat-monitoring.test.ts
│   ├── iframe-communication.test.ts
│   ├── schema-validation.test.ts
│   └── window-communication.test.ts
├── security/                # Security tests (attack prevention)
│   ├── error-info-disclosure.test.ts
│   ├── listener-limits.test.ts
│   ├── message-validation.test.ts
│   ├── origin-validation.test.ts
│   ├── payload-sanitization.test.ts
│   ├── payload-size-limits.test.ts
│   ├── postmessage-security.test.ts
│   └── schema-validation-dos.test.ts
├── fixtures/                # Test data and helpers
│   └── test-messages.ts
└── utils/                   # Test utilities
    ├── mock-factory.ts
    └── test-helpers.ts
```

### Source-to-Test Mapping

Each source file has a corresponding test file:

| Source File                          | Test File                             |
| ------------------------------------ | ------------------------------------- |
| `src/core/Parley.ts`                 | `tests/unit/Parley.test.ts`           |
| `src/events/EventEmitter.ts`         | `tests/unit/EventEmitter.test.ts`     |
| `src/core/HeartbeatManager.ts`       | `tests/unit/HeartbeatManager.test.ts` |
| `src/core/MessageRegistry.ts`        | `tests/unit/MessageRegistry.test.ts`  |
| `src/core/TargetManager.ts`          | `tests/unit/TargetManager.test.ts`    |
| `src/security/OriginValidator.ts`    | `tests/unit/OriginValidator.test.ts`  |
| `src/security/SecurityLayer.ts`      | `tests/unit/SecurityLayer.test.ts`    |
| `src/validation/SchemaValidator.ts`  | `tests/unit/SchemaValidator.test.ts`  |
| `src/communication/BaseChannel.ts`   | `tests/unit/BaseChannel.test.ts`      |
| `src/communication/IframeChannel.ts` | `tests/unit/IframeChannel.test.ts`    |
| `src/communication/WindowChannel.ts` | `tests/unit/WindowChannel.test.ts`    |
| `src/core/MessageProtocol.ts`        | `tests/unit/MessageProtocol.test.ts`  |
| `src/utils/Logger.ts`                | `tests/unit/Logger.test.ts`           |
| `src/utils/Helpers.ts`               | `tests/unit/Helpers.test.ts`          |

---

## Test Categories

### Unit Tests

Test individual components in isolation with mocked dependencies.

**Purpose:**

- Verify single function/class behavior
- Test edge cases and error conditions
- Ensure proper error handling
- Validate TypeScript type safety

**Example:**

```typescript
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

**Coverage Target:** 90%+

### Integration Tests

Test complete workflows with multiple components working together.

**Purpose:**

- Verify end-to-end communication flows
- Test real-world usage scenarios
- Validate component interactions
- Ensure system reliability

**Example:**

```typescript
describe('Iframe Communication', () => {
    it('should establish connection between parent and child', async () => {
        const parent = new Parley({
            allowedOrigins: ['http://localhost:3000'],
            role: 'parent',
        });

        const child = new Parley({
            allowedOrigins: ['http://localhost:3000'],
            role: 'child',
        });

        // Simulate iframe setup and communication
        await parent.connect('child', mockIframe.contentWindow);
        await child.connect('parent', window.parent);

        const response = await parent.send('ping', {}, { targetId: 'child' });
        expect(response).toBeDefined();
    });
});
```

**Coverage Target:** 85%+

### Security Tests

Test security mechanisms and validate protection against attacks.

**Purpose:**

- Verify origin validation enforcement
- Test payload sanitization
- Validate DoS prevention
- Ensure error message safety

**Example:**

```typescript
describe('Origin Validation', () => {
    it('should reject messages from unauthorized origins', async () => {
        const parley = new Parley({
            allowedOrigins: ['https://trusted.com'],
        });

        const maliciousMessage = createMessage(
            'test',
            {},
            {
                origin: 'https://evil.com',
            }
        );

        await expect(parley.handleMessage(maliciousMessage)).rejects.toThrow(
            SecurityError
        );
    });
});
```

**Coverage Target:** 95%+

---

## Coverage Requirements

### Overall Coverage Targets

| Component      | Target | Description                            |
| -------------- | ------ | -------------------------------------- |
| Overall        | 85%+   | Minimum across entire codebase         |
| Core Modules   | 90%+   | Parley, MessageProtocol, TargetManager |
| Security Layer | 95%+   | OriginValidator, SecurityLayer         |
| Communication  | 90%+   | All Channel implementations            |
| Utilities      | 85%+   | Helpers, Logger                        |

### How Coverage is Measured

Coverage reports include:

- **Line Coverage** - Percentage of executed lines
- **Branch Coverage** - Percentage of executed conditional branches
- **Function Coverage** - Percentage of called functions
- **Statement Coverage** - Percentage of executed statements

### Viewing Coverage Reports

After running `npm run test:coverage`:

```bash
# View HTML report in browser
open coverage/index.html

# Terminal will show summary like:
# ----------------------------|---------|----------|---------|---------|
# File                        | % Stmts | % Branch | % Funcs | % Lines |
# ----------------------------|---------|----------|---------|---------|
# All files                   |   87.5  |    85.3  |   89.1  |   87.8  |
#  src/core                   |   92.1  |    89.7  |   94.2  |   92.5  |
#  src/security               |   96.3  |    95.1  |   97.8  |   96.7  |
# ----------------------------|---------|----------|---------|---------|
```

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

### Best Practices

1. **Descriptive Test Names**

    ```typescript
    // Good
    it('should reject messages from unauthorized origins', () => {});

    // Bad
    it('test origin', () => {});
    ```

2. **Arrange-Act-Assert Pattern**

    ```typescript
    it('should emit events to registered listeners', () => {
        // Arrange
        const emitter = new EventEmitter();
        const handler = vi.fn();
        emitter.on('test', handler);

        // Act
        emitter.emit('test', { data: 'value' });

        // Assert
        expect(handler).toHaveBeenCalledWith({ data: 'value' });
    });
    ```

3. **Test Edge Cases**

    ```typescript
    describe('generateUUID', () => {
        it('should generate valid UUID format', () => {
            const uuid = generateUUID();
            expect(uuid).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
            );
        });

        it('should generate unique UUIDs', () => {
            const uuid1 = generateUUID();
            const uuid2 = generateUUID();
            expect(uuid1).not.toBe(uuid2);
        });
    });
    ```

4. **Use Mocks Appropriately**

    ```typescript
    // Mock external dependencies
    vi.mock('external-library', () => ({
        externalFunction: vi.fn(() => 'mocked'),
    }));

    // Spy on internal methods
    const spy = vi.spyOn(instance, 'methodName');
    ```

5. **Clean Up After Tests**
    ```typescript
    afterEach(() => {
        vi.clearAllMocks();
        vi.clearAllTimers();
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

## Continuous Integration

Tests run automatically on:

- Every pull request
- Every commit to main branch
- Scheduled daily runs

### GitHub Actions Workflow

See `.github/workflows/test.yml` for the full CI configuration:

```yaml
name: Tests

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: '20'
            - run: npm ci
            - run: npm test
            - run: npm run test:coverage
```

### Coverage Enforcement

Pull requests must maintain or improve coverage:

- Overall coverage: 85%+ required
- No decrease in coverage allowed without justification
- New code should have 90%+ coverage

---

## Contributing

When contributing code:

1. Write tests for all new features
2. Maintain or improve coverage
3. Follow existing test patterns
4. Run full test suite before submitting PR
5. Add tests for bug fixes

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

---

## Additional Resources

- <a href="https://vitest.dev/" target="_blank">Vitest Documentation</a>
- <a href="https://github.com/capricorn86/happy-dom" target="_blank">happy-dom
  Documentation</a>
- <a href="https://github.com/goldbergyoni/javascript-testing-best-practices" target="_blank">Testing
  Best Practices</a>
- <a href="https://martinfowler.com/bliki/TestCoverage.html" target="_blank">Test
  Coverage Best Practices</a>

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
- [Contributing](../CONTRIBUTING.md) - Contributing tests

**Back to**: [Documentation Home](../README.md)
