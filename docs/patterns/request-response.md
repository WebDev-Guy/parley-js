[Home](../index.md) > [Code Patterns](./index.md) > Request-Response Pattern

# Request-Response Pattern

The request-response pattern enables synchronous-style communication between
windows where one side sends a request and waits for a response from the other
side.

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

Many cross-window interactions require bidirectional communication where the
sender needs confirmation or data from the receiver. Without request-response,
you must manually correlate responses with requests using message IDs and manage
timeouts yourself.

The request-response pattern solves this by providing async/await-style
communication. You send a message and receive a Promise that resolves with the
response, handling correlation and timeouts automatically.

## When to Use It

Use the request-response pattern when:

- You need data from the other window (queries, function calls)
- You need confirmation that an operation completed successfully
- The sender's next action depends on the receiver's response
- You want synchronous-style code flow with async operations
- You need to handle timeouts if the receiver doesn't respond

This pattern is ideal for RPC-style communication, data fetching, form
validation, and any operation where you need feedback.

For implementing request-response in iframes, see
[iFrame Communication Guide](../guides/iframe-communication.md). For
request-response in popups (OAuth flows), see
[Popup Communication Guide](../guides/popup-communication.md).

## When NOT to Use It

Avoid request-response when:

- Sending notifications that don't require acknowledgment (use fire-and-forget
  instead)
- Broadcasting events to every connected target (use broadcast(), which never
  waits for or receives responses)
- The response time might be very long (consider polling or event-based
  approaches)
- You don't care if the message was received (use expectsResponse: false)
- Real-time streaming data is needed (consider event-based patterns)

For one-way notifications, set expectsResponse: false to avoid unnecessary
waiting.

## Code Example

### Basic Request-Response

**Requester Side (Parent Window)**:

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [window.location.origin],
});

// Connect to iframe. No 'load' listener is needed: the child re-sends the
// handshake until the parent acknowledges it.
const iframe = document.getElementById('child-iframe');
await parley.connect(iframe, 'child');

// Send request and wait for response
try {
    const response = await parley.send(
        'getUserData',
        {
            userId: 123,
        },
        {
            targetId: 'child',
            timeout: 5000,
        }
    );

    console.log('User data:', response.user);
} catch (error) {
    if (error.code === 'ERR_TIMEOUT_NO_RESPONSE') {
        console.error('Request timed out');
    } else if (error.code === 'ERR_HANDLER_ERROR') {
        // The child's handler threw. The message is 'Handler error' unless
        // the child was created with exposeHandlerErrors: true.
        console.error('Remote handler failed:', error.message);
    } else if (error.code === 'ERR_NO_HANDLER') {
        console.error('Child has no handler for getUserData');
    } else {
        console.error('Request failed:', error.message);
    }
}
```

For complete send() options and error codes, see
[send() API reference](../api-reference/methods.md#send). For troubleshooting
timeout errors, see
[Timeout Errors](../troubleshooting/common-errors.md#timeout-errors).

**Responder Side (Child Iframe)**:

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [window.location.origin],
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
                email: user.email,
            },
        });
    } catch (error) {
        // Send error response
        respond({
            success: false,
            error: error.message,
        });
    }
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

### Request-Response with Validation

**Responder with Input Validation**:

```typescript
parley.on('createUser', async (payload, respond) => {
    // Validate required fields
    if (!payload.name || typeof payload.name !== 'string') {
        respond({
            success: false,
            error: 'Invalid name field',
        });
        return;
    }

    if (!payload.email || !isValidEmail(payload.email)) {
        respond({
            success: false,
            error: 'Invalid email address',
        });
        return;
    }

    // Perform operation
    try {
        const user = await createUserInDatabase(payload);
        respond({
            success: true,
            userId: user.id,
        });
    } catch (error) {
        respond({
            success: false,
            error: 'Failed to create user',
        });
    }
});

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### Pipeline Pattern (Chained Requests)

**Multiple Sequential Requests**:

```typescript
async function processUserData(userId) {
    try {
        // Step 1: Fetch user
        const userResponse = await parley.send(
            'getUser',
            {
                userId,
            },
            { targetId: 'database-iframe' }
        );

        if (!userResponse.success) {
            throw new Error('Failed to fetch user');
        }

        // Step 2: Validate user data
        const validationResponse = await parley.send(
            'validateUser',
            {
                user: userResponse.user,
            },
            { targetId: 'validator-iframe' }
        );

        if (!validationResponse.valid) {
            throw new Error('User validation failed');
        }

        // Step 3: Process user
        const processResponse = await parley.send(
            'processUser',
            {
                user: userResponse.user,
                validationResult: validationResponse,
            },
            { targetId: 'processor-iframe' }
        );

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

    // respond() is not generic; annotate the value instead
    const response: GetUserResponse = {
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
    };
    respond(response);
});
```

For type validation errors and solutions, see
[Type Validation Errors](../troubleshooting/common-errors.md#type-validation-errors).
For schema registration, see
[register() method](../api-reference/methods.md#register).

## Explanation

### How It Works

1. **Requester calls send()**: The sender calls parley.send() with a message
   type and payload. ParleyJS generates a unique message ID and stores a Promise
   resolver.

2. **Message transmitted**: The message is sent via postMessage with the unique
   ID, payload, and metadata indicating a response is expected.

3. **Responder receives message**: The receiver's handler is called with the
   payload, a respond() callback, and metadata.

4. **Responder calls respond()**: When the receiver calls respond(), ParleyJS
   sends a response message with the same message ID.

5. **Promise resolves**: The original send() Promise resolves with the response
   data.

If the responder doesn't call respond() within the timeout period (default
5000ms) and all configured `retries` are used up, the Promise rejects with a
TimeoutError (`ERR_TIMEOUT_NO_RESPONSE`).

If the responder's handler throws (or returns a rejected Promise), ParleyJS
sends an error response automatically and the requester's `send()` rejects with
a ParleyError whose code is `ERR_HANDLER_ERROR`. The message is the generic
`'Handler error'` unless the responder was created with
`exposeHandlerErrors: true`. If the responder has no handler for the type at
all, `send()` rejects with `ERR_NO_HANDLER`. A handler's return value is
ignored; only `respond()` sends data back.

### Why This Pattern Works

The request-response pattern simplifies cross-window RPC by:

- **Automatic correlation**: Message IDs are generated and matched automatically
- **Promise-based API**: Natural async/await syntax instead of callback hell
- **Timeout handling**: Built-in timeout detection prevents hanging requests
- **Type safety**: TypeScript generics provide compile-time type checking
- **Error propagation**: Errors thrown in the handler reject the requester's
  Promise with `ERR_HANDLER_ERROR`; errors you catch can be returned as
  structured responses

This eliminates the boilerplate of manually tracking pending requests,
generating IDs, and managing timeouts.

### Response Structure Best Practice

Structure responses consistently with success/error fields:

```typescript
// Successful response
respond({
    success: true,
    data: actualData,
});

// Error response
respond({
    success: false,
    error: 'Error message',
    code: 'ERROR_CODE', // optional
});
```

This allows the requester to handle both cases uniformly.

## Common Variations

### Variation 1: RPC-Style Function Calls

Treat messages as remote function calls:

```typescript
// Define "remote functions" in child
const remoteFunctions = {
    add: (a, b) => a + b,
    multiply: (a, b) => a * b,
    divide: (a, b) => {
        if (b === 0) throw new Error('Division by zero');
        return a / b;
    },
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
    const response = await parley.send(
        'rpc:call',
        {
            method,
            args,
        },
        { targetId: 'child' }
    );

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

```typescript
// Child: Process with progress
parley.on('processLargeFile', async (payload, respond) => {
    const file = payload.file;
    const chunks = splitIntoChunks(file);

    for (let i = 0; i < chunks.length; i++) {
        await processChunk(chunks[i]);

        // Send progress update (fire-and-forget)
        await parley.send(
            'progress',
            {
                percent: ((i + 1) / chunks.length) * 100,
            },
            {
                targetId: 'parent',
                expectsResponse: false,
            }
        );
    }

    respond({ success: true });
});

// Parent: Handle progress updates
parley.on('progress', (payload) => {
    updateProgressBar(payload.percent);
});

// Parent: Start long operation.
// Payloads are JSON-cloned, so a File or Blob would arrive as {}.
// Convert it to a serializable form (text, base64 string, plain array) first.
const fileText = await largeFile.text();
const result = await parley.send(
    'processLargeFile',
    {
        file: { name: largeFile.name, content: fileText },
    },
    { targetId: 'child', timeout: 60000 }
);
```

Keep the serialized payload under the fixed 10 MB limit; larger payloads are
rejected by `send()` with a ValidationError. Split very large data into several
messages.

### Variation 3: Batch Request-Response

Send multiple requests in parallel:

```typescript
async function fetchMultipleUsers(userIds) {
    // Send all requests in parallel
    const promises = userIds.map((userId) =>
        parley.send(
            'getUser',
            { userId },
            {
                targetId: 'child',
            }
        )
    );

    // Wait for all responses
    const responses = await Promise.all(promises);

    // Filter successful responses
    const users = responses.filter((r) => r.success).map((r) => r.user);

    return users;
}

// Usage
const users = await fetchMultipleUsers([1, 2, 3, 4, 5]);
console.log('Fetched users:', users);
```

For performance considerations when sending many messages, see
[Performance Issues troubleshooting](../troubleshooting/common-errors.md#performance-issues).

### Variation 4: Request-Response with Retry

ParleyJS has built-in retries for timeouts: set `retries` in `Parley.create()`,
in `register(type, { retries })`, or per call in `send()`. Each retry re-sends
the same message (same message id) after another `timeout` period. There is no
backoff, and only timeouts are retried:

```typescript
const response = await parley.send(
    'getData',
    { id: 123 },
    { targetId: 'child', timeout: 3000, retries: 2 } // up to 3 attempts
);
```

If you need a growing delay between attempts, or want to retry other failures,
wrap `send()` in your own helper. This is optional application code:

```typescript
async function sendWithRetry(type, payload, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await parley.send(type, payload, {
                targetId: options.targetId,
                timeout: options.timeout,
            });
        } catch (error) {
            console.warn(`Attempt ${attempt} failed:`, error.message);

            if (attempt < maxRetries) {
                // Wait before retry with a linearly growing delay
                await new Promise((resolve) =>
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
    const response = await sendWithRetry(
        'getData',
        { id: 123 },
        {
            targetId: 'child',
            maxRetries: 3,
            retryDelay: 1000,
        }
    );
} catch (error) {
    console.error('Failed after all retries:', error);
}
```

## Testing

Test request-response patterns by verifying both sides of the communication.

### Testing the Requester

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Request-Response Requester', () => {
    it('should send request and receive response', async () => {
        const parley = Parley.create({
            targetType: 'iframe',
            allowedOrigins: [window.location.origin],
        });

        // Mock the connection and response
        const mockSend = vi.spyOn(parley, 'send').mockResolvedValue({
            success: true,
            user: { id: 123, name: 'John' },
        });

        const response = await parley.send(
            'getUser',
            { userId: 123 },
            {
                targetId: 'child',
            }
        );

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
            targetType: 'iframe',
            allowedOrigins: [window.location.origin],
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

The simplest way to unit test a responder is to define the handler as a named
function and call it directly with a mock `respond`. Register the same function
with `parley.on()` in production code.

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { MessageMetadata } from 'ignite-parleyjs';

// Production code: parley.on('createUser', handleCreateUser);
export async function handleCreateUser(
    payload: { email?: string },
    respond: (response: unknown) => void,
    _metadata: MessageMetadata
) {
    if (!payload.email) {
        respond({ success: false, error: 'Email required' });
        return;
    }
    respond({ success: true });
}

const metadata: MessageMetadata = {
    messageId: 'msg-1',
    senderId: 'parent',
    origin: 'https://app.example.com',
    timestamp: Date.now(),
    expectsResponse: true,
};

describe('Request-Response Responder', () => {
    it('should respond to valid requests', async () => {
        const respond = vi.fn();
        await handleCreateUser({ email: 'a@example.com' }, respond, metadata);
        expect(respond).toHaveBeenCalledWith({ success: true });
    });

    it('should validate input and respond with error', async () => {
        const respond = vi.fn();
        await handleCreateUser({}, respond, metadata);
        expect(respond).toHaveBeenCalledWith({
            success: false,
            error: 'Email required',
        });
    });
});
```

To exercise the full message path (handshake, protocol messages, responses), see
the integration-test helpers described in
[Testing Patterns](../TESTING_PATTERNS.md).

For comprehensive testing strategies, see
[Testing Patterns](../TESTING_PATTERNS.md) and [Testing Guide](../TESTING.md).
For mocking request-response in tests, see
[Testing Request-Response](../TESTING_PATTERNS.md#testing-request-response).

## Related Patterns

- **[Error Handling Pattern](./error-handling.md)** - Handle errors in
  request-response flows
- **[State Synchronization Pattern](./state-synchronization.md)** - Keep state
  in sync across windows
- **Fire-and-Forget Pattern** - Send messages without waiting for response (see
  [CODE_PATTERNS.md](../CODE_PATTERNS.md#simple-one-way-message))

## See Also

**API Methods**:

- [send()](../api-reference/methods.md#send) - Send messages with response
- [on()](../api-reference/methods.md#on) - Register message handlers
- [register()](../api-reference/methods.md#register) - Register message types
  with schema

**Guides**:

- [iFrame Communication](../guides/iframe-communication.md) - Complete iframe
  integration
- [Popup Communication](../guides/popup-communication.md) - OAuth and payment
  flows
- [Getting Started](../getting-started/first-example.md) - Your first
  request-response example

**Security**:

- [Origin Validation](../security/origin-validation.md) - Secure your
  request-response flows
- [Message Validation](../security/message-validation.md) - Validate request
  payloads

---

**Previous**: [Code Patterns](./index.md) **Next**:
[Error Handling Pattern](./error-handling.md) **Back to**:
[Code Patterns](./index.md)
