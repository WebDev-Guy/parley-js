[Home](../../README.md) > [Code Patterns](./README.md) > Request-Response Pattern

# Request-Response Pattern

The request-response pattern enables synchronous-style communication between windows where one side sends a request and waits for a response from the other side.

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

Many cross-window interactions require bidirectional communication where the sender needs confirmation or data from the receiver. Without request-response, you must manually correlate responses with requests using message IDs and manage timeouts yourself.

The request-response pattern solves this by providing async/await-style communication. You send a message and receive a Promise that resolves with the response, handling correlation and timeouts automatically.

## When to Use It

Use the request-response pattern when:
- You need data from the other window (queries, function calls)
- You need confirmation that an operation completed successfully
- The sender's next action depends on the receiver's response
- You want synchronous-style code flow with async operations
- You need to handle timeouts if the receiver doesn't respond

This pattern is ideal for RPC-style communication, data fetching, form validation, and any operation where you need feedback.

## When NOT to Use It

Avoid request-response when:
- Sending notifications that don't require acknowledgment (use fire-and-forget instead)
- Broadcasting events to multiple listeners (use broadcast() with expectsResponse: false)
- The response time might be very long (consider polling or event-based approaches)
- You don't care if the message was received (use expectsResponse: false)
- Real-time streaming data is needed (consider event-based patterns)

For one-way notifications, set expectsResponse: false to avoid unnecessary waiting.

## Code Example

### Basic Request-Response

**Requester Side (Parent Window)**:
```javascript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: [window.location.origin]
});

// Connect to iframe
const iframe = document.getElementById('child-iframe');
iframe.addEventListener('load', async () => {
    await parley.connect(iframe, 'child');

    // Send request and wait for response
    try {
        const response = await parley.send('getUserData', {
            userId: 123
        }, {
            targetId: 'child',
            timeout: 5000
        });

        console.log('User data:', response.user);
    } catch (error) {
        if (error.code === 'ERR_TIMEOUT_NO_RESPONSE') {
            console.error('Request timed out');
        } else {
            console.error('Request failed:', error.message);
        }
    }
});
```

**Responder Side (Child Iframe)**:
```javascript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: [window.location.origin]
});

// Register handler that responds
parley.on('getUserData', async (payload, respond, metadata) => {
    console.log('Received request from:', metadata.origin);

    try {
        // Fetch user data
        const user = await fetchUserFromDatabase(payload.userId);

        // Send successful response
        respond({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        // Send error response
        respond({
            success: false,
            error: error.message
        });
    }
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

### Request-Response with Validation

**Responder with Input Validation**:
```javascript
parley.on('createUser', async (payload, respond) => {
    // Validate required fields
    if (!payload.name || typeof payload.name !== 'string') {
        respond({
            success: false,
            error: 'Invalid name field'
        });
        return;
    }

    if (!payload.email || !isValidEmail(payload.email)) {
        respond({
            success: false,
            error: 'Invalid email address'
        });
        return;
    }

    // Perform operation
    try {
        const user = await createUserInDatabase(payload);
        respond({
            success: true,
            userId: user.id
        });
    } catch (error) {
        respond({
            success: false,
            error: 'Failed to create user'
        });
    }
});

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### Pipeline Pattern (Chained Requests)

**Multiple Sequential Requests**:
```javascript
async function processUserData(userId) {
    try {
        // Step 1: Fetch user
        const userResponse = await parley.send('getUser', {
            userId
        }, { targetId: 'database-iframe' });

        if (!userResponse.success) {
            throw new Error('Failed to fetch user');
        }

        // Step 2: Validate user data
        const validationResponse = await parley.send('validateUser', {
            user: userResponse.user
        }, { targetId: 'validator-iframe' });

        if (!validationResponse.valid) {
            throw new Error('User validation failed');
        }

        // Step 3: Process user
        const processResponse = await parley.send('processUser', {
            user: userResponse.user,
            validationResult: validationResponse
        }, { targetId: 'processor-iframe' });

        return processResponse;
    } catch (error) {
        console.error('Pipeline failed:', error.message);
        throw error;
    }
}

// Usage
try {
    const result = await processUserData(123);
    console.log('Processing complete:', result);
} catch (error) {
    console.error('Failed to process user:', error);
}
```

### Type-Safe Request-Response

**Using TypeScript for Type Safety**:
```typescript
interface GetUserRequest {
    userId: number;
}

interface GetUserResponse {
    success: boolean;
    user?: {
        id: number;
        name: string;
        email: string;
    };
    error?: string;
}

// Requester with types
const response = await parley.send<GetUserRequest, GetUserResponse>(
    'getUserData',
    { userId: 123 },
    { targetId: 'child' }
);

if (response.success && response.user) {
    console.log('User name:', response.user.name);
} else {
    console.error('Error:', response.error);
}

// Responder with types
parley.on<GetUserRequest>('getUserData', async (payload, respond) => {
    const user = await fetchUser(payload.userId);

    respond<GetUserResponse>({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }
    });
});
```

## Explanation

### How It Works

1. **Requester calls send()**: The sender calls parley.send() with a message type and payload. ParleyJS generates a unique message ID and stores a Promise resolver.

2. **Message transmitted**: The message is sent via postMessage with the unique ID, payload, and metadata indicating a response is expected.

3. **Responder receives message**: The receiver's handler is called with the payload, a respond() callback, and metadata.

4. **Responder calls respond()**: When the receiver calls respond(), ParleyJS sends a response message with the same message ID.

5. **Promise resolves**: The original send() Promise resolves with the response data.

If the responder doesn't call respond() within the timeout period (default 5000ms), the Promise rejects with a TimeoutError.

### Why This Pattern Works

The request-response pattern simplifies cross-window RPC by:
- **Automatic correlation**: Message IDs are generated and matched automatically
- **Promise-based API**: Natural async/await syntax instead of callback hell
- **Timeout handling**: Built-in timeout detection prevents hanging requests
- **Type safety**: TypeScript generics provide compile-time type checking
- **Error propagation**: Errors in the handler can be caught and returned as responses

This eliminates the boilerplate of manually tracking pending requests, generating IDs, and managing timeouts.

### Response Structure Best Practice

Structure responses consistently with success/error fields:

```javascript
// Successful response
respond({
    success: true,
    data: actualData
});

// Error response
respond({
    success: false,
    error: 'Error message',
    code: 'ERROR_CODE' // optional
});
```

This allows the requester to handle both cases uniformly.

## Common Variations

### Variation 1: RPC-Style Function Calls

Treat messages as remote function calls:

```javascript
// Define "remote functions" in child
const remoteFunctions = {
    add: (a, b) => a + b,
    multiply: (a, b) => a * b,
    divide: (a, b) => {
        if (b === 0) throw new Error('Division by zero');
        return a / b;
    }
};

parley.on('rpc:call', async (payload, respond) => {
    const { method, args } = payload;

    if (!remoteFunctions[method]) {
        respond({ error: `Unknown method: ${method}` });
        return;
    }

    try {
        const result = await remoteFunctions[method](...args);
        respond({ result });
    } catch (error) {
        respond({ error: error.message });
    }
});

// Call remote function from parent
async function callRemote(method, ...args) {
    const response = await parley.send('rpc:call', {
        method,
        args
    }, { targetId: 'child' });

    if (response.error) {
        throw new Error(response.error);
    }

    return response.result;
}

// Usage
const sum = await callRemote('add', 5, 3); // 8
const product = await callRemote('multiply', 4, 7); // 28
```

### Variation 2: Request-Response with Progress Updates

Send progress updates during long operations:

```javascript
// Child: Process with progress
parley.on('processLargeFile', async (payload, respond) => {
    const file = payload.file;
    const chunks = splitIntoChunks(file);

    for (let i = 0; i < chunks.length; i++) {
        await processChunk(chunks[i]);

        // Send progress update (fire-and-forget)
        await parley.send('progress', {
            percent: ((i + 1) / chunks.length) * 100
        }, {
            targetId: 'parent',
            expectsResponse: false
        });
    }

    respond({ success: true });
});

// Parent: Handle progress updates
parley.on('progress', (payload) => {
    updateProgressBar(payload.percent);
});

// Parent: Start long operation
const result = await parley.send('processLargeFile', {
    file: largeFile
}, { targetId: 'child', timeout: 60000 });
```

### Variation 3: Batch Request-Response

Send multiple requests in parallel:

```javascript
async function fetchMultipleUsers(userIds) {
    // Send all requests in parallel
    const promises = userIds.map(userId =>
        parley.send('getUser', { userId }, {
            targetId: 'child'
        })
    );

    // Wait for all responses
    const responses = await Promise.all(promises);

    // Filter successful responses
    const users = responses
        .filter(r => r.success)
        .map(r => r.user);

    return users;
}

// Usage
const users = await fetchMultipleUsers([1, 2, 3, 4, 5]);
console.log('Fetched users:', users);
```

### Variation 4: Request-Response with Retry

Add automatic retry logic for failed requests:

```javascript
async function sendWithRetry(type, payload, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await parley.send(type, payload, {
                targetId: options.targetId,
                timeout: options.timeout
            });
        } catch (error) {
            console.warn(`Attempt ${attempt} failed:`, error.message);

            if (attempt < maxRetries) {
                // Wait before retry with exponential backoff
                await new Promise(resolve =>
                    setTimeout(resolve, retryDelay * attempt)
                );
            } else {
                throw error; // All retries failed
            }
        }
    }
}

// Usage
try {
    const response = await sendWithRetry('getData', { id: 123 }, {
        targetId: 'child',
        maxRetries: 3,
        retryDelay: 1000
    });
} catch (error) {
    console.error('Failed after all retries:', error);
}
```

## Testing

Test request-response patterns by verifying both sides of the communication.

### Testing the Requester

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('Request-Response Requester', () => {
    it('should send request and receive response', async () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin]
        });

        // Mock the connection and response
        const mockSend = vi.spyOn(parley, 'send').mockResolvedValue({
            success: true,
            user: { id: 123, name: 'John' }
        });

        const response = await parley.send('getUser', { userId: 123 }, {
            targetId: 'child'
        });

        expect(mockSend).toHaveBeenCalledWith(
            'getUser',
            { userId: 123 },
            { targetId: 'child' }
        );

        expect(response.success).toBe(true);
        expect(response.user.name).toBe('John');
    });

    it('should handle timeout errors', async () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin]
        });

        vi.spyOn(parley, 'send').mockRejectedValue(
            new Error('ERR_TIMEOUT_NO_RESPONSE')
        );

        await expect(
            parley.send('getUser', { userId: 123 }, { targetId: 'child' })
        ).rejects.toThrow('ERR_TIMEOUT_NO_RESPONSE');
    });
});
```

### Testing the Responder

```javascript
describe('Request-Response Responder', () => {
    it('should respond to requests', async () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin]
        });

        let respondCalled = false;
        let responseData = null;

        parley.on('getUser', async (payload, respond) => {
            const user = await fetchUser(payload.userId);
            responseData = { success: true, user };
            respond(responseData);
            respondCalled = true;
        });

        // Simulate receiving message
        // (In actual tests, you'd trigger this through the message handler)

        expect(respondCalled).toBe(true);
        expect(responseData.success).toBe(true);
    });

    it('should validate input and respond with error', async () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin]
        });

        let responseData = null;

        parley.on('createUser', (payload, respond) => {
            if (!payload.email) {
                responseData = { success: false, error: 'Email required' };
                respond(responseData);
                return;
            }

            responseData = { success: true };
            respond(responseData);
        });

        // Test with invalid input
        // responseData should contain error

        expect(responseData.success).toBe(false);
        expect(responseData.error).toBe('Email required');
    });
});
```

For comprehensive testing strategies, see [Testing Patterns](../TESTING_PATTERNS.md) and [Testing Guide](../TESTING.md).

## Related Patterns

- **[Error Handling Pattern](./error-handling.md)** - Handle errors in request-response flows
- **[State Synchronization Pattern](./state-synchronization.md)** - Keep state in sync across windows
- **Fire-and-Forget Pattern** - Send messages without waiting for response (see [CODE_PATTERNS.md](../CODE_PATTERNS.md#simple-one-way-message))

## See Also

**API Methods**:
- [send()](../api-reference/methods.md#send) - Send messages with response
- [on()](../api-reference/methods.md#on) - Register message handlers
- [register()](../api-reference/methods.md#register) - Register message types with schema

**Guides**:
- [iFrame Communication](../guides/iframe-communication.md) - Complete iframe integration
- [Popup Communication](../guides/popup-communication.md) - OAuth and payment flows
- [Getting Started](../getting-started/first-example.md) - Your first request-response example

**Security**:
- [Origin Validation](../security/origin-validation.md) - Secure your request-response flows
- [Message Validation](../security/message-validation.md) - Validate request payloads

---

**Previous**: [Code Patterns](./README.md)
**Next**: [Error Handling Pattern](./error-handling.md)
**Back to**: [Code Patterns](./README.md)
