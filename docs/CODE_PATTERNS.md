[Home](./index.md) > [Documentation](./index.md) > Code Patterns

# ParleyJS Code Patterns

Common, tested patterns for implementing ParleyJS in different scenarios.

## Table of Contents

1. [Basic Patterns](#basic-patterns)
2. [Request-Response Workflows](#request-response-workflows)
3. [Error Handling](#error-handling)
4. [Advanced Patterns](#advanced-patterns)
5. [Performance Patterns](#performance-patterns)

## Basic Patterns

For complete implementation examples, see [Examples](./EXAMPLES.md).

### Simple One-way Message

**Pattern**: Send a message and forget about it.

```javascript
// Sender
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
});

await parley.connect(childWindow, 'child');

await parley.send(
    'notify',
    {
        message: 'Hello from parent',
        timestamp: Date.now(),
    },
    {
        targetId: 'child',
        expectsResponse: false,
    }
);
```

**Receiver**:

```javascript
const parley = Parley.create({
    allowedOrigins: ['https://parent.example.com'],
});

parley.on('notify', (payload) => {
    console.log('Received:', payload.message);
});

await parley.connect(window.parent, 'parent');
```

**When to use**: Notifications, events, non-critical updates

### Request-Response Pattern

**Pattern**: Send a message and wait for a response.

```javascript
// Sender (requester)
try {
    const response = await parley.send(
        'get-user',
        { id: 123 },
        {
            targetId: 'child',
        }
    );
    console.log('User:', response);
} catch (error) {
    console.error('Request failed:', error.code);
}
```

**Receiver (responder)**:

```javascript
parley.on('get-user', async (payload, respond) => {
    const user = await fetchUser(payload.id);
    respond({
        success: true,
        user: user,
    });
});
```

**When to use**: Queries, function calls, bidirectional operations

## Request-Response Workflows

### Simple RPC-style Call

```javascript
// Define handler in child
childParley.on('calculate', (payload, respond) => {
    respond({
        result: payload.x + payload.y,
        timestamp: Date.now(),
    });
});

// Call from parent
const result = await parentParley.send(
    'calculate',
    { x: 5, y: 3 },
    {
        targetId: 'child',
    }
);
console.log(result.result); // 8
```

### Query with Validation

```javascript
// Handler with validation
parley.on('fetch-data', async (payload, respond) => {
  // Validate input
  if (!payload.id || typeof payload.id !== 'string') {
    respond({
      success: false,
      error: 'Invalid ID format'
    });
    return;
  }

  if (payload.id.length > 50) {
    respond({
      success: false,
      error: 'ID too long'
    });
    return;
  }

  // Process
  try {
    const result = await database.query(payload.id);
    respond({
      success: true,
      data: result
    });
  } catch (err) {
    respond({
      success: false,
      error: err.message
    });
  }
});

// Consumer
const response = await parley.send('fetch-data', { id: 'user-123 }, {
  targetId: 'child'
});
if (response.success) {
  useData(response.data);
} else {
  handleError(response.error);
}
```

### Pipeline Pattern

**Pattern**: Chain multiple request-response calls.

```javascript
// Process data through multiple steps
async function processData(data) {
    // Step 1: Validate
    const validated = await parley.send('validate', data, {
        targetId: 'validator',
    });
    if (!validated.success) throw new Error(validated.error);

    // Step 2: Transform
    const transformed = await parley.send('transform', validated.data, {
        targetId: 'transformer',
    });
    if (!transformed.success) throw new Error(transformed.error);

    // Step 3: Store
    const stored = await parley.send('store', transformed.data, {
        targetId: 'storage',
    });
    if (!stored.success) throw new Error(stored.error);

    return stored.data;
}

// Usage
try {
    const result = await processData(inputData);
} catch (error) {
    console.error('Pipeline failed:', error.message);
}
```

## Error Handling

For troubleshooting common errors, see
[Troubleshooting Guide](./TROUBLESHOOTING.md).

### Try-Catch Pattern

```javascript
async function safeRequest(type, data, timeoutMs = 5000) {
    try {
        return await parley.send(type, data, {
            targetId: 'child',
            timeout: timeoutMs,
        });
    } catch (error) {
        if (error instanceof TimeoutError) {
            console.error('Request timed out after', timeoutMs, 'ms');
        } else if (error instanceof SecurityError) {
            console.error('Origin validation failed');
        } else if (error instanceof ConnectionError) {
            console.error('Connection error');
        } else {
            console.error('Unexpected error:', error.message);
        }
        throw error;
    }
}
```

### Fallback Pattern

```javascript
async function requestWithFallback(type, data, fallback) {
    try {
        return await parley.send(type, data, { targetId: 'child' });
    } catch (error) {
        console.warn(`${type} failed, using fallback:`, error.message);
        return fallback;
    }
}

// Usage
const config = await requestWithFallback(
    'get-config',
    {},
    { theme: 'light', language: 'en' } // fallback
);
```

### Retry Pattern

```javascript
async function requestWithRetry(type, data, maxAttempts = 3, delayMs = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await parley.send(type, data, { targetId: 'child' });
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt} failed:`, error.message);

            if (attempt < maxAttempts) {
                await new Promise((resolve) =>
                    setTimeout(resolve, delayMs * attempt)
                );
            }
        }
    }

    throw lastError;
}

// Usage
try {
    const data = await requestWithRetry('fetch-data', { id: 'user-123' });
} catch (error) {
    console.error('Failed after all retries:', error);
}
```

### Error Handler in Receiver

```javascript
parley.on('risky-operation', async (payload, respond) => {
    try {
        const result = await performRiskyOperation(payload);
        respond({
            success: true,
            result: result,
        });
    } catch (error) {
        // Return structured error
        respond({
            success: false,
            error: {
                code: error.code || 'UNKNOWN',
                message: error.message,
                // Include helpful context
                context: {
                    operation: 'risky-operation',
                    input: payload,
                    timestamp: new Date().toISOString(),
                },
            },
        });
    }
});
```

## Advanced Patterns

### Event Emitter Pattern

```javascript
class EventBridge {
    constructor(parley) {
        this.parley = parley;
        this.listeners = new Map();
    }

    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);

            // Register one listener with parley for this event type
            this.parley.on(event, (payload) => {
                const handlers = this.listeners.get(event) || [];
                handlers.forEach((h) => h(payload));
            });
        }

        this.listeners.get(event).push(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.listeners.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        };
    }

    async emit(event, data) {
        return this.parley.broadcast(event, data);
    }
}

// Usage
const bridge = new EventBridge(parley);
bridge.on('user-logged-in', (data) => {
    console.log('User', data.username, 'logged in');
});
bridge.on('user-logged-in', (data) => {
    updateUI(data);
});
```

### State Synchronization Pattern

```javascript
class SyncedState {
    constructor(parley, initialState = {}) {
        this.parley = parley;
        this.state = initialState;
        this.listeners = new Set();

        // Listen for state updates from remote
        this.parley.on('state-update', (updates) => {
            this.setState(updates);
        });
    }

    setState(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // Notify local listeners
        this.listeners.forEach((listener) => {
            listener(this.state, oldState);
        });
    }

    getState() {
        return { ...this.state };
    }

    async updateRemote(updates) {
        this.setState(updates); // Update locally first
        await this.parley.broadcast('state-update', updates); // Sync to remote
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

// Usage
const appState = new SyncedState(parley, { theme: 'light' });

appState.subscribe((newState, oldState) => {
    console.log('State changed:', newState);
});

await appState.updateRemote({ theme: 'dark' });
```

## Performance Patterns

### Debounced Messages

```javascript
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounce frequent updates
const debouncedUpdate = debounce((data) => {
    parley.send('update', data, {
        targetId: 'child',
        expectsResponse: false,
    });
}, 300);

// Usage
window.addEventListener('scroll', () => {
    debouncedUpdate({ scrollY: window.scrollY });
});
```

### Batching Pattern

```javascript
class MessageBatcher {
    constructor(parley, targetId, flushInterval = 100) {
        this.parley = parley;
        this.targetId = targetId;
        this.flushInterval = flushInterval;
        this.queue = [];
        this.timer = null;
    }

    add(type, data) {
        this.queue.push({ type, data, timestamp: Date.now() });

        if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushInterval);
        }
    }

    async flush() {
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0);
        this.timer = null;

        await this.parley.send(
            'batch',
            { messages: batch },
            {
                targetId: this.targetId,
                expectsResponse: false,
            }
        );
    }
}

// Usage
const batcher = new MessageBatcher(parley, 'child');
batcher.add('event1', { value: 1 });
batcher.add('event2', { value: 2 });
// Messages sent together after 100ms
```

## Testing Patterns

See [TESTING_PATTERNS.md](./TESTING_PATTERNS.md) for:

- Unit testing message handlers
- Integration testing channel communication
- Mocking parley behavior
- Testing error scenarios
- Testing timeout behavior

---

### Navigation

**Related Documentation**:

- [API Reference](./API.md) - Complete API details
- [Testing Patterns](./TESTING_PATTERNS.md) - Testing strategies
- [Security Guide](./SECURITY.md) - Security best practices
- [Examples](./EXAMPLES.md) - Real-world examples

**Back to**: [Documentation Home](./index.md)
