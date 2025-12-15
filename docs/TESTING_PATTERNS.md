[Home](./index.md) > [Documentation](./index.md) > Testing Patterns

# ParleyJS Testing Patterns

Testing strategies for postMessage-based code and ParleyJS framework components.

## Overview

Testing postMessage communication requires special patterns because:

- Windows cannot be directly instantiated in tests
- Events are asynchronous
- Timing is critical
- Origin validation must be maintained

For general testing documentation, see [TESTING.md](./TESTING.md).

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
│   ├── parley.test.ts           # Core Parley functionality
│   ├── message-handler.test.ts  # Handler functionality
│   ├── origin-validation.test.ts # Security tests
│   └── error-handling.test.ts   # Error scenarios
├── integration/
│   ├── parent-child.test.ts     # iFrame communication
│   ├── popup.test.ts            # Popup window communication
│   └── multi-window.test.ts     # Multiple window coordination
└── fixtures/
    ├── mock-helpers.ts          # Test utilities
    └── sample-data.ts           # Test data
```

## Unit Testing Patterns

### Testing Message Handlers

```typescript
describe('message handlers', () => {
    let parley: Parley;
    let mockWindow: Window;

    beforeEach(() => {
        mockWindow = createMockWindow('https://example.com');
        parley = Parley.create({
            allowedOrigins: ['https://example.com'],
        });
    });

    afterEach(() => {
        parley.destroy();
    });

    it('should call handler for matching message type', async () => {
        const handler = vi.fn().mockResolvedValue({ success: true });
        parley.on('test-message', handler);

        await simulateIncomingMessage(parley, {
            type: 'test-message',
            data: { value: 42 },
        });

        expect(handler).toHaveBeenCalledWith(
            { value: 42 },
            expect.any(Function),
            expect.objectContaining({ type: 'test-message' })
        );
    });

    it('should not call handler for non-matching types', async () => {
        const handler = vi.fn();
        parley.on('type-a', handler);

        await simulateIncomingMessage(parley, {
            type: 'type-b',
            data: {},
        });

        expect(handler).not.toHaveBeenCalled();
    });
});
```

### Testing Origin Validation

```typescript
describe('origin validation', () => {
    it('should reject messages from wrong origin', async () => {
        const parley = Parley.create({
            allowedOrigins: ['https://trusted.com'],
        });

        const handler = vi.fn();
        parley.on('message', handler);

        // Try to send from wrong origin
        await simulateIncomingMessage(parley, {
            type: 'message',
            data: { evil: 'payload' },
            origin: 'https://evil.com',
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it('should validate exact origin match', async () => {
        const parley = Parley.create({
            allowedOrigins: ['https://example.com:443'],
        });

        const handler = vi.fn();
        parley.on('test', handler);

        // These should NOT match
        const wrongOrigins = [
            'https://example.com:8443', // Wrong port
            'https://example.com/', // Has trailing slash
            'http://example.com', // Wrong protocol
            'https://sub.example.com', // Subdomain
        ];

        for (const origin of wrongOrigins) {
            await simulateIncomingMessage(parley, {
                type: 'test',
                data: {},
                origin,
            });

            expect(handler).not.toHaveBeenCalled();
        }
    });
});
```

### Testing Request-Response

```typescript
describe('request-response', () => {
    let parley: Parley;

    beforeEach(() => {
        parley = Parley.create({
            allowedOrigins: ['https://example.com'],
        });
    });

    afterEach(() => {
        parley.destroy();
    });

    it('should match response to request', async () => {
        parley.on('calculate', (payload, respond) => {
            respond({ result: payload.x + payload.y });
        });

        const iframe = createMockIframe('https://example.com');
        await parley.connect(iframe, 'child');

        const response = await parley.send(
            'calculate',
            { x: 5, y: 3 },
            {
                targetId: 'child',
            }
        );

        expect(response.result).toBe(8);
    });

    it('should timeout if response not received', async () => {
        const iframe = createMockIframe('https://example.com');
        await parley.connect(iframe, 'child');

        await expect(
            parley.send(
                'slow-operation',
                {},
                {
                    targetId: 'child',
                    timeout: 100,
                }
            )
        ).rejects.toThrow(TimeoutError);
    });
});
```

## Integration Testing

### Testing iFrame Communication

```typescript
describe('iFrame communication', () => {
    let parentParley: Parley;
    let childParley: Parley;
    let iframe: HTMLIFrameElement;

    beforeEach(async () => {
        // Create mock iframe
        iframe = createMockIframe('https://child.example.com');

        // Create parent parley
        parentParley = Parley.create({
            allowedOrigins: ['https://child.example.com'],
        });

        // Create child parley
        childParley = Parley.create({
            allowedOrigins: ['https://parent.example.com'],
        });

        // Connect
        await parentParley.connect(iframe, 'child');
        await childParley.connect(window.parent, 'parent');
    });

    afterEach(() => {
        parentParley.destroy();
        childParley.destroy();
    });

    it('should establish bidirectional communication', async () => {
        childParley.on('greeting', (payload, respond) => {
            respond({ message: 'Hello from child!' });
        });

        const response = await parentParley.send(
            'greeting',
            {
                message: 'Hello from parent',
            },
            {
                targetId: 'child',
            }
        );

        expect(response.message).toBe('Hello from child!');
    });
});
```

### Testing Error Scenarios

```typescript
describe('error handling in integration', () => {
    it('should handle handler exceptions', async () => {
        parley.on('failing-operation', () => {
            throw new Error('Something went wrong');
        });

        const iframe = createMockIframe('https://example.com');
        await parley.connect(iframe, 'child');

        await expect(
            parley.send(
                'failing-operation',
                {},
                {
                    targetId: 'child',
                }
            )
        ).rejects.toThrow('Something went wrong');
    });
});
```

## Mocking Strategies

### Mock Window Helper

```typescript
// tests/fixtures/mock-helpers.ts
export function createMockWindow(origin = 'https://example.com'): Window {
    const listeners = new Map<string, Set<EventListener>>();

    return {
        postMessage: vi.fn((message, targetOrigin) => {
            // Simulate postMessage behavior
            setTimeout(() => {
                const messageEvent = new MessageEvent('message', {
                    data: message,
                    origin: origin,
                    source: mockWindow as any,
                });

                if (listeners.has('message')) {
                    listeners.get('message')!.forEach((listener) => {
                        listener(messageEvent);
                    });
                }
            }, 0);
        }),

        addEventListener: vi.fn((type: string, listener: EventListener) => {
            if (!listeners.has(type)) {
                listeners.set(type, new Set());
            }
            listeners.get(type)!.add(listener);
        }),

        removeEventListener: vi.fn((type: string, listener: EventListener) => {
            if (listeners.has(type)) {
                listeners.get(type)!.delete(listener);
            }
        }),

        location: { origin } as Location,
    } as unknown as Window;
}
```

### Simulation Helpers

```typescript
// tests/fixtures/mock-helpers.ts
export async function simulateIncomingMessage(
    parley: Parley,
    messageData: { type: string; data: any; origin?: string }
) {
    const messageEvent = new MessageEvent('message', {
        data: {
            _v: '1.0.0',
            _id: crypto.randomUUID(),
            _type: messageData.type,
            _timestamp: Date.now(),
            _origin: messageData.origin || parley.allowedOrigins[0],
            _expectsResponse: false,
            payload: messageData.data,
        },
        origin: messageData.origin || parley.allowedOrigins[0],
        source: window as any,
    });

    window.dispatchEvent(messageEvent);
    await new Promise((resolve) => setImmediate(resolve));
}
```

## Coverage Requirements

### Minimum Coverage Thresholds

- **Statements**: 85%
- **Branches**: 80%
- **Functions**: 85%
- **Lines**: 85%

### Critical Code (95%+ Coverage Required)

- Origin validation logic
- Message security checks
- Error handling paths
- Resource cleanup
- Connection lifecycle management

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

# Run specific test file
npm test -- tests/unit/parley.test.ts

# Run in watch mode
npm run test:watch

# Run tests matching pattern
npm test -- --testNamePattern="origin validation"
```

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Clean Up**: Always destroy parley instances in afterEach
3. **Meaningful Names**: Test names should describe what is being tested
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Mock External Dependencies**: Don't test external libraries
6. **Test Error Cases First**: Error handling is critical
7. **Use Realistic Data**: Test with production-like data

---

### Navigation

**Related Documentation**:

- [Testing Guide](./TESTING.md) - General testing documentation
- [Code Patterns](./CODE_PATTERNS.md) - Common coding patterns
- [API Reference](./API.md) - Complete API details

**Back to**: [Documentation Home](./index.md)
