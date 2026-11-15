[Home](../index.md) > [Code Patterns](./index.md) > Error Handling Pattern

# Error Handling Pattern

The error handling pattern provides strategies for gracefully handling failures
in cross-window communication including timeouts, connection errors, validation
errors, and application errors.

## Table of Contents

1. [Problem This Solves](#problem-this-solves)
2. [When to Use It](#when-to-use-it)
3. [When NOT to Use It](#when-not-to-use-it)
4. [Code Example](#code-example)
5. [Explanation](#explanation)
6. [Common Variations](#common-variations)
7. [Testing](#testing)
8. [Related Patterns](#related-patterns)
9. [See Also](#see-also)

## Problem This Solves

Cross-window communication can fail in many ways: network timeouts, disconnected
targets, validation errors, or application errors. Without proper error
handling, these failures crash your application, leave users confused, or create
inconsistent state.

The error handling pattern solves this by providing structured approaches to
detect, handle, and recover from errors. This ensures your application remains
stable and provides helpful feedback when communication fails.

## When to Use It

Use error handling patterns when:

- Communicating with unreliable targets (popups, third-party iframes)
- User actions depend on successful communication
- You need to provide feedback about communication failures
- Operations can be retried or have fallback options
- Maintaining application state consistency is critical

Proper error handling is essential in production applications where
communication failures are expected.

## When NOT to Use It

You might skip extensive error handling when:

- Building quick prototypes or demos
- Communication is always reliable (same-origin, controlled environment)
- Failures are acceptable without recovery (optional features)
- Complexity outweighs benefits for simple use cases

However, even simple applications benefit from basic error handling to improve
user experience.

## Code Example

### Basic Try-Catch Pattern

**Simple Error Handling**:

```javascript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [window.location.origin],
});

await parley.connect(iframe, 'child');

async function fetchUserData(userId) {
    try {
        const response = await parley.send(
            'getUser',
            {
                userId,
            },
            {
                targetId: 'child',
                timeout: 5000,
            }
        );

        if (!response.success) {
            throw new Error(response.error || 'Unknown error');
        }

        return response.user;
    } catch (error) {
        // Handle specific error types
        if (error.code === 'ERR_TIMEOUT_NO_RESPONSE') {
            console.error(
                'Request timed out. Child iframe may be unresponsive.'
            );
            showNotification('Connection timeout. Please try again.');
        } else if (error.code === 'ERR_TARGET_NOT_CONNECTED') {
            console.error('Target not connected');
            showNotification('Connection lost. Reconnecting...');
            await reconnect();
        } else if (error.code === 'ERR_VALIDATION_SCHEMA_MISMATCH') {
            console.error('Invalid message format');
            showNotification('Invalid data format');
        } else if (error.code === 'ERR_HANDLER_ERROR') {
            // The child's handler threw. error.message is 'Handler error'
            // unless the child set exposeHandlerErrors: true.
            showNotification('The request failed. Please try again.');
        } else if (error.code === 'ERR_NO_HANDLER') {
            console.error('Child has no handler for getUser');
        } else {
            console.error('Unexpected error:', error.message);
            showNotification('An error occurred. Please try again.');
        }

        // Re-throw or return default value
        throw error;
    }
}
```

For common error solutions and error code details, see
[Common Errors Reference](../troubleshooting/common-errors.md).

```javascript
// Usage
try {
    const user = await fetchUserData(123);
    displayUser(user);
} catch (error) {
    displayErrorState('Unable to load user data');
}
```

### Retry Pattern

ParleyJS retries timed-out requests on its own when you set `retries` (in
`Parley.create()`, `register(type, { retries })`, or per `send()` call). Each
retry re-sends the same message (same message id) after another `timeout`
period. There is no backoff, and only timeouts are retried:

```javascript
// Up to 3 attempts, 5 seconds each, before ERR_TIMEOUT_NO_RESPONSE
await parley.send('processData', data, {
    targetId: 'worker-iframe',
    timeout: 5000,
    retries: 2,
});
```

**Optional: application-level retry with exponential backoff**:

If you need increasing delays between attempts, write a wrapper like the one
below. This is application code, not a ParleyJS feature:

```javascript
async function sendWithRetry(messageType, payload, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    const baseDelay = options.baseDelay || 1000;
    const targetId = options.targetId;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${maxAttempts}`);

            const response = await parley.send(messageType, payload, {
                targetId,
                timeout: options.timeout || 5000,
            });

            console.log('Request succeeded');
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt} failed:`, error.message);

            // Don't retry validation errors (they won't succeed)
            if (error.code === 'ERR_VALIDATION_SCHEMA_MISMATCH') {
                throw error;
            }

            // Don't retry if target is not connected or has no handler
            if (
                error.code === 'ERR_TARGET_NOT_CONNECTED' ||
                error.code === 'ERR_NO_HANDLER'
            ) {
                throw error;
            }

            // Retry timeout errors
            if (attempt < maxAttempts) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    // All attempts failed
    console.error(`All ${maxAttempts} attempts failed`);
    throw lastError;
}

// Usage
try {
    const result = await sendWithRetry(
        'processData',
        {
            data: largeDataset,
        },
        {
            targetId: 'worker-iframe',
            maxAttempts: 3,
            baseDelay: 1000,
            timeout: 10000,
        }
    );

    console.log('Processing complete:', result);
} catch (error) {
    console.error('Processing failed after retries:', error);
    showErrorDialog('Unable to process data. Please try again later.');
}
```

### Fallback Pattern

**Graceful Degradation with Fallback**:

```javascript
async function getConfiguration() {
    try {
        // Try to fetch config from iframe
        const response = await parley.send(
            'getConfig',
            {},
            {
                targetId: 'config-iframe',
                timeout: 3000,
            }
        );

        if (response.success) {
            console.log('Using configuration from iframe');
            return response.config;
        }
    } catch (error) {
        console.warn('Failed to fetch config from iframe:', error.message);
    }

    // Fallback to default configuration
    console.log('Using default configuration');
    return {
        theme: 'light',
        language: 'en',
        notifications: true,
        autoSave: true,
    };
}

async function getUserPreferences(userId) {
    let preferences;

    try {
        // Try remote first
        const response = await parley.send(
            'getPreferences',
            {
                userId,
            },
            {
                targetId: 'preferences-iframe',
                timeout: 2000,
            }
        );

        preferences = response.preferences;
        console.log('Loaded preferences from remote');
    } catch (error) {
        console.warn('Remote preferences failed, using cache');

        // Fallback to cached preferences
        preferences = loadFromCache(`preferences-${userId}`);

        if (!preferences) {
            // Final fallback to defaults
            console.log('No cache available, using defaults');
            preferences = getDefaultPreferences();
        }
    }

    return preferences;
}

// Usage
const config = await getConfiguration();
applyConfiguration(config);
```

### Structured Error Responses

**Handler with Structured Error Responses**:

```javascript
// Child iframe: Handler with detailed errors
parley.on('processOrder', async (payload, respond) => {
    try {
        // Validate input
        if (!payload.orderId) {
            respond({
                success: false,
                error: {
                    code: 'MISSING_ORDER_ID',
                    message: 'Order ID is required',
                    field: 'orderId',
                },
            });
            return;
        }

        if (!payload.items || payload.items.length === 0) {
            respond({
                success: false,
                error: {
                    code: 'EMPTY_ORDER',
                    message: 'Order must contain at least one item',
                    field: 'items',
                },
            });
            return;
        }

        // Process order
        const order = await processOrderInDatabase(payload);

        respond({
            success: true,
            orderId: order.id,
            total: order.total,
        });
    } catch (error) {
        // Unexpected errors. (If you let the error escape instead, the
        // parent's send() rejects with ERR_HANDLER_ERROR and the generic
        // message 'Handler error'.)
        respond({
            success: false,
            error: {
                code: 'PROCESSING_FAILED',
                message: 'Order processing failed',
            },
        });
    }
});

// Parent: Handle structured errors
async function submitOrder(orderData) {
    try {
        const response = await parley.send('processOrder', orderData, {
            targetId: 'order-processor',
        });

        if (!response.success) {
            const error = response.error;

            // Handle specific error codes
            if (error.code === 'MISSING_ORDER_ID') {
                showFieldError('orderId', error.message);
            } else if (error.code === 'EMPTY_ORDER') {
                showFieldError('items', error.message);
            } else {
                showErrorDialog(error.message);
            }

            return null;
        }

        return response;
    } catch (error) {
        // Communication errors (timeout, connection lost, etc.)
        showErrorDialog(
            'Unable to submit order. Please check your connection.'
        );
        return null;
    }
}
```

### Circuit Breaker Pattern

**Prevent Cascading Failures**:

```javascript
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000; // 1 minute
        this.failures = 0;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = null;
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failures++;

        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            console.warn(
                `Circuit breaker opened after ${this.failures} failures`
            );
        }
    }

    getState() {
        return this.state;
    }
}

// Usage
const breaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000,
});

async function sendToUnreliableTarget(data) {
    try {
        return await breaker.execute(async () => {
            return await parley.send('process', data, {
                targetId: 'unreliable-iframe',
                timeout: 3000,
            });
        });
    } catch (error) {
        if (error.message === 'Circuit breaker is OPEN') {
            console.error('Too many failures, circuit breaker is open');
            return getFallbackResult();
        }
        throw error;
    }
}

// Circuit breaker prevents hammering failed service
for (let i = 0; i < 10; i++) {
    try {
        await sendToUnreliableTarget({ id: i });
    } catch (error) {
        console.error(`Request ${i} failed:`, error.message);
    }
}
```

## Explanation

### Error Types in ParleyJS

ParleyJS provides specific error types for different failure scenarios:

1. **TimeoutError** (ERR_TIMEOUT_NO_RESPONSE): Request timed out waiting for
   response. The target may be unresponsive or the operation took too long.

2. **ValidationError** (ERR_VALIDATION_SCHEMA_MISMATCH): Payload doesn't match
   registered schema. This indicates a programming error in the sender.

3. **TargetNotFoundError** (ERR_TARGET_NOT_CONNECTED): Target is not connected.
   The target may have disconnected or never connected.

4. **ConnectionError** (ERR_CONNECTION_CLOSED, ERR_CONNECTION_HANDSHAKE_FAILED):
   Connection-level errors during handshake or while connected. A pending
   `send()` rejects with ERR_CONNECTION_CLOSED when the target disconnects or
   the instance is destroyed.

5. **SerializationError** (ERR_SERIALIZATION_CIRCULAR_REFERENCE,
   ERR_SERIALIZATION_SERIALIZE_FAILED): The payload could not be JSON-cloned
   (circular reference or BigInt).

6. **ParleyError with a remote code**: `ERR_HANDLER_ERROR` when the receiver's
   handler threw (message `'Handler error'` unless the receiver set
   `exposeHandlerErrors: true`), and `ERR_NO_HANDLER` when the receiver has no
   handler for the message type.

Each error type has a code property you can check to handle specific scenarios
appropriately. All of these are thrown to the caller of `send()`; they are not
emitted as `system:error` events.

### Observing Errors on the Receiving Side

On the side that handles messages, ParleyJS reports failures in two ways:

- `system:error` (via `onSystem`) fires when a local handler throws
  (`ERR_HANDLER_ERROR`, with the full error message) and when inbound messages
  are rejected by security checks (`ERR_SECURITY_ORIGIN_MISMATCH`,
  `ERR_VALIDATION_INVALID_PROTOCOL`, `ERR_SECURITY_VERSION_MISMATCH`).
- `register(type, { onError })` observes failures for a single message type:
  inbound payloads that fail the registered schema (a ValidationError) and
  handler errors (wrapped in a ParleyError).

```javascript
parley.register('processOrder', {
    schema: orderSchema,
    onError: (error, metadata) => {
        logErrorToServer({
            type: 'processOrder',
            code: error.code,
            message: error.message,
            senderId: metadata.senderId,
            origin: metadata.origin,
        });
    },
});
```

### Why Structured Error Handling Matters

Proper error handling prevents:

- **User confusion**: Show helpful messages instead of cryptic errors
- **Data loss**: Retry or save state when operations fail
- **Cascading failures**: Circuit breakers prevent overwhelming failed services
- **Poor UX**: Loading spinners that never finish, buttons that don't respond

Good error handling improves reliability and user trust.

### Error Recovery Strategies

Different errors require different recovery strategies:

- **Timeout**: Use the built-in `retries` option, or your own backoff wrapper
- **Connection lost**: Attempt reconnection, use cached data
- **Validation error**: Fix the code, don't retry
- **Application error**: Show user-friendly message, log for debugging
- **Transient error**: Retry immediately or after delay

Choose the strategy based on the error type and user impact.

## Common Variations

### Variation 1: Global Error Handler

**Centralized Error Handling**:

`system:error` only carries local handler errors and rejected inbound messages.
Timeouts arrive as `system:timeout`, lost connections as
`system:connection_lost`, and `send()` failures are thrown to the caller, so a
global handler subscribes to each event it cares about:

```javascript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

class ParleyErrorHandler {
    constructor(parley) {
        this.parley = parley;
        this.errorListeners = new Set();

        // Local handler errors and rejected inbound messages
        parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
            // event: { code, message, targetId?, messageId?, details?, timestamp }
            this.handleError(event);
        });

        // Requests that timed out after all retries
        parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
            // event: { messageId, messageType, targetId?, timeoutMs, retriesAttempted, timestamp }
            showNotification('Connection timeout', 'warning');
        });

        // Connection lost (heartbeat timeout, repeated failures, closed window)
        parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
            showNotification(`Connection lost (${event.reason})`, 'error');
        });
    }

    handleError(error) {
        console.error('ParleyJS Error:', error);

        // Notify all listeners
        this.errorListeners.forEach((listener) => {
            try {
                listener(error);
            } catch (e) {
                console.error('Error in error listener:', e);
            }
        });

        if (error.code === 'ERR_SECURITY_ORIGIN_MISMATCH') {
            console.warn('Rejected a message from an untrusted origin');
        }
    }

    onError(listener) {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }
}

// Usage
const errorHandler = new ParleyErrorHandler(parley);

errorHandler.onError((error) => {
    logErrorToAnalytics(error);
});
```

### Variation 2: Timeout with Progress Indication

**Show Progress During Long Operations**:

```javascript
async function sendWithProgress(messageType, payload, options = {}) {
    const timeout = options.timeout || 10000;
    const progressCallback = options.onProgress;
    let progressInterval;

    try {
        // Start progress indicator
        if (progressCallback) {
            let elapsed = 0;
            progressInterval = setInterval(() => {
                elapsed += 100;
                const percent = Math.min((elapsed / timeout) * 100, 95);
                progressCallback(percent);
            }, 100);
        }

        const response = await parley.send(messageType, payload, {
            targetId: options.targetId,
            timeout,
        });

        if (progressCallback) {
            progressCallback(100);
        }

        return response;
    } catch (error) {
        throw error;
    } finally {
        if (progressInterval) {
            clearInterval(progressInterval);
        }
    }
}

// Usage. Payloads are JSON-cloned, so a File object would arrive as {}.
// Convert it to text, a base64 string, or plain data before sending.
await sendWithProgress(
    'processLargeFile',
    {
        file: { name: largeFile.name, content: await largeFile.text() },
    },
    {
        targetId: 'processor',
        timeout: 30000,
        onProgress: (percent) => {
            updateProgressBar(percent);
        },
    }
);
```

### Variation 3: Error Boundaries

**React-Style Error Boundaries**:

You do not need a wrapper just to avoid unhandled exceptions: if a handler
throws, ParleyJS already sends an error response (the sender's `send()` rejects
with `ERR_HANDLER_ERROR`), emits `system:error` locally, and calls the type's
`register(type, { onError })` callback. A wrapper is useful when you want the
sender to receive a structured, successful response instead of a rejection:

```javascript
class ParleyErrorBoundary {
    constructor(parley) {
        this.parley = parley;
        this.errorHandlers = new Map();
    }

    wrap(messageType, handler) {
        const wrappedHandler = async (payload, respond, metadata) => {
            try {
                await handler(payload, respond, metadata);
            } catch (error) {
                console.error(`Error in ${messageType} handler:`, error);

                respond({
                    success: false,
                    error: {
                        code: 'HANDLER_ERROR',
                        message: 'Internal error processing request',
                    },
                });

                // Notify error handlers
                const errorHandler = this.errorHandlers.get(messageType);
                if (errorHandler) {
                    errorHandler(error, payload, metadata);
                }
            }
        };

        this.parley.on(messageType, wrappedHandler);
    }

    onError(messageType, handler) {
        this.errorHandlers.set(messageType, handler);
    }
}

// Usage
const boundary = new ParleyErrorBoundary(parley);

boundary.wrap('processData', async (payload, respond) => {
    // Handler can throw errors
    const result = await riskyOperation(payload);
    respond({ success: true, result });
});

boundary.onError('processData', (error, payload, metadata) => {
    logErrorToServer({
        error: error.message,
        payload,
        origin: metadata.origin,
    });
});
```

### Variation 4: Graceful Degradation

**Fallback Chain**:

```javascript
async function fetchDataWithFallbacks(dataId) {
    const strategies = [
        // Strategy 1: Primary iframe
        async () => {
            const response = await parley.send(
                'getData',
                {
                    id: dataId,
                },
                {
                    targetId: 'primary-iframe',
                    timeout: 2000,
                }
            );
            return response.data;
        },

        // Strategy 2: Backup iframe
        async () => {
            console.log('Primary failed, trying backup');
            const response = await parley.send(
                'getData',
                {
                    id: dataId,
                },
                {
                    targetId: 'backup-iframe',
                    timeout: 3000,
                }
            );
            return response.data;
        },

        // Strategy 3: Local cache
        async () => {
            console.log('Backup failed, using cache');
            return loadFromCache(dataId);
        },

        // Strategy 4: Default data
        async () => {
            console.log('Cache empty, using defaults');
            return getDefaultData();
        },
    ];

    for (const strategy of strategies) {
        try {
            return await strategy();
        } catch (error) {
            console.warn('Strategy failed:', error.message);
            continue;
        }
    }

    throw new Error('All strategies failed');
}
```

## Testing

Test error handling by simulating various failure scenarios.

### Testing Timeout Handling

```javascript
import { describe, it, expect, vi } from 'vitest';
import { Parley } from 'ignite-parleyjs';

describe('Error Handling - Timeouts', () => {
    it('should handle timeout errors', async () => {
        const parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: [window.location.origin],
        });

        // Mock send to throw timeout error
        vi.spyOn(parley, 'send').mockRejectedValue({
            code: 'ERR_TIMEOUT_NO_RESPONSE',
            message: 'Request timed out',
        });

        await expect(
            parley.send('getData', {}, { targetId: 'child' })
        ).rejects.toMatchObject({
            code: 'ERR_TIMEOUT_NO_RESPONSE',
        });
    });

    it('should retry on timeout (application-level wrapper)', async () => {
        const parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: [window.location.origin],
        });

        const sendWithRetry = async (type, payload) => {
            for (let i = 0; i < 3; i++) {
                try {
                    return await parley.send(type, payload, {
                        targetId: 'child',
                    });
                } catch (error) {
                    if (i === 2) throw error;
                }
            }
        };

        // Test retry logic
        const mockSend = vi
            .spyOn(parley, 'send')
            .mockRejectedValueOnce({ code: 'ERR_TIMEOUT_NO_RESPONSE' })
            .mockRejectedValueOnce({ code: 'ERR_TIMEOUT_NO_RESPONSE' })
            .mockResolvedValueOnce({ success: true });

        const result = await sendWithRetry('getData', {});
        expect(result.success).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(3);
    });
});
```

### Testing Fallback Behavior

```javascript
describe('Error Handling - Fallbacks', () => {
    it('should use fallback on error', async () => {
        const parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: [window.location.origin],
        });

        const getDataWithFallback = async () => {
            try {
                return await parley.send(
                    'getData',
                    {},
                    {
                        targetId: 'child',
                    }
                );
            } catch (error) {
                return { data: 'fallback' };
            }
        };

        vi.spyOn(parley, 'send').mockRejectedValue(
            new Error('Connection failed')
        );

        const result = await getDataWithFallback();
        expect(result.data).toBe('fallback');
    });
});
```

For comprehensive testing strategies, see
[Testing Patterns](../TESTING_PATTERNS.md). For testing error scenarios, see
[Testing Error Scenarios](../TESTING_PATTERNS.md#testing-error-scenarios).

## Related Patterns

- **[Request-Response Pattern](./request-response.md)** - Base pattern for
  sending requests
- **[State Synchronization Pattern](./state-synchronization.md)** - Maintain
  consistency during errors
- **Retry Pattern** - Detailed retry strategies (see
  [CODE_PATTERNS.md](../CODE_PATTERNS.md#retry-pattern))

## See Also

**API Methods**:

- [send()](../api-reference/methods.md#send) - Send messages with timeout
  configuration
- [onSystem()](../api-reference/methods.md#onsystem) - Listen for system errors
- [System Events](../api-reference/system-events.md) - System event
  documentation

**Guides**:

- [Troubleshooting](../troubleshooting/index.md) - Common issues and solutions
- [Common Errors](../troubleshooting/common-errors.md) - Quick error solutions
- [Timeout Errors](../troubleshooting/common-errors.md#timeout-errors) -
  Diagnose and fix timeouts
- [Connection Errors](../troubleshooting/common-errors.md#channel-closed-errors) -
  Handle disconnections
- [Testing Guide](../TESTING.md) - Testing error scenarios
- [iFrame Communication](../guides/iframe-communication.md) - Error handling in
  iframes

**Security**:

- [Origin Validation](../security/origin-validation.md) - Security-related
  errors
- [Message Validation](../security/message-validation.md) - Validation error
  handling

---

**Previous**: [Request-Response Pattern](./request-response.md) **Next**:
[State Synchronization Pattern](./state-synchronization.md) **Back to**:
[Code Patterns](./index.md)
