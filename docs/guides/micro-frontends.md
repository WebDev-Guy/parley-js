[Home](../../index.md) > [Documentation](./index.md) > [Guides](./index.md) >
Micro-Frontend Architecture

# ParleyJS in Micro-Frontend Architectures

Learn how to use ParleyJS to enable communication in micro-frontend
architectures.

## Table of Contents

1. [What are Micro-Frontends?](#what-are-micro-frontends)
2. [ParleyJS Role in Micro-Frontends](#parleyjs-role-in-micro-frontends)
3. [Architecture Patterns](#architecture-patterns)
4. [Communication Strategy](#communication-strategy)
5. [Shell and Module Communication](#shell-and-module-communication)
6. [State Synchronization](#state-synchronization)
7. [Error Handling](#error-handling)
8. [Performance Considerations](#performance-considerations)
9. [Security in Micro-Frontends](#security-in-micro-frontends)

---

## What are Micro-Frontends?

Micro-frontends extend the microservices concept to frontend development. The
application is divided into smaller, independent modules that can be developed,
tested, and deployed separately.

### Key Characteristics

**Independent Development**: Each micro-frontend is owned by a separate team
with its own codebase.

**Technology Agnostic**: Different modules can use different frameworks (React,
Vue, Angular, etc.).

**Isolated Deployment**: Teams can deploy their modules independently without
coordinating releases.

**Runtime Integration**: Modules are composed at runtime, typically using
iframes or module federation.

### Common Use Cases

- Large enterprise applications with multiple teams
- Applications with distinct functional areas (dashboard, settings, reports)
- Gradual migration from monolith to modern architecture
- Multi-tenant platforms with customizable modules

---

## ParleyJS Role in Micro-Frontends

ParleyJS solves the communication challenges inherent in micro-frontend
architectures.

### Communication Challenges

When modules run in separate iframes or windows, they need secure communication
for:

- Sharing authentication state
- Coordinating navigation
- Broadcasting global events
- Requesting data from other modules
- Synchronizing UI state

### How ParleyJS Helps

ParleyJS provides the infrastructure for secure, type-safe inter-module
communication:

```typescript
// Shell application
const parley = Parley.create({
    allowedOrigins: [
        'https://auth.example.com',
        'https://dashboard.example.com',
        'https://reports.example.com',
    ],
});

// Connect to all micro-frontends
await parley.connect(authModule.contentWindow, 'auth-module');
await parley.connect(dashboardModule.contentWindow, 'dashboard-module');
await parley.connect(reportsModule.contentWindow, 'reports-module');
```

For multi-window communication patterns, see
[Multi-Window Communication Guide](./multi-window-communication.md).

---

## Architecture Patterns

Different micro-frontend architectures require different communication
strategies.

### Hub-and-Spoke Pattern

The shell application acts as a central hub, coordinating all module
communication.

```typescript
// Shell (Hub)
const parley = Parley.create({
    allowedOrigins: [
        'https://module-a.example.com',
        'https://module-b.example.com',
    ],
});

// Module requests data from another module via hub
parley.on('request-to-module', async (payload, respond) => {
    const { targetModule, request } = payload;

    try {
        const response = await parley.send(request.type, request.data, {
            targetId: targetModule,
        });
        respond({ success: true, data: response });
    } catch (error) {
        respond({ success: false, error: error.message });
    }
});
```

**Benefits**: Centralized coordination, easier debugging, clear data flow.
**Drawbacks**: Shell becomes a potential bottleneck, single point of failure.

For hub-and-spoke implementation details, see
[Hub-and-Spoke Pattern](./multi-window-communication.md#hub-and-spoke-pattern).

### Peer-to-Peer Pattern

Modules communicate directly with each other without routing through the shell.

```typescript
// Module A establishes direct connection to Module B
const moduleB = document.querySelector('#module-b-iframe');
await parley.connect(moduleB.contentWindow, 'module-b');

// Direct communication
const data = await parley.send(
    'get-user-data',
    { userId: 123 },
    {
        targetId: 'module-b',
    }
);
```

**Benefits**: Lower latency, less shell complexity, better scalability.
**Drawbacks**: More complex setup, harder to monitor, increased security
surface.

### Hybrid Pattern

Combines hub-and-spoke for coordination with peer-to-peer for high-frequency
data exchange.

```typescript
// Shell handles authentication and global state
parley.on('auth-state-changed', (payload) => {
    parley.broadcast('global-auth-update', payload);
});

// Modules communicate directly for data operations
// (established after shell coordinates initial connection)
```

---

## Communication Strategy

Define clear communication contracts between modules to prevent tight coupling.

### Message Contracts

Document all message types exchanged between modules:

```typescript
// contracts/auth-module.ts
export interface AuthStateMessage {
    type: 'auth-state-changed';
    payload: {
        isAuthenticated: boolean;
        user: {
            id: string;
            name: string;
            roles: string[];
        } | null;
        token?: string;
    };
}

export interface LogoutRequestMessage {
    type: 'logout-request';
    payload: {
        reason?: 'user-action' | 'session-expired' | 'security';
    };
}
```

### Schema Validation

Use JSON Schema to validate messages between modules:

```typescript
parley.register('auth-state-changed', {
    schema: {
        type: 'object',
        properties: {
            isAuthenticated: { type: 'boolean' },
            user: {
                type: ['object', 'null'],
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    roles: { type: 'array', items: { type: 'string' } },
                },
                required: ['id', 'name', 'roles'],
            },
        },
        required: ['isAuthenticated', 'user'],
    },
});
```

For message validation strategies, see
[Message Validation Guide](../security/message-validation.md).

---

## Shell and Module Communication

The shell application coordinates module lifecycle and shared services.

### Shell Responsibilities

**Module Loading**: The shell loads and initializes all micro-frontends.

```typescript
// Shell loads modules
async function loadModule(url: string, targetId: string) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    document.body.appendChild(iframe);

    await new Promise((resolve) => {
        iframe.addEventListener('load', resolve, { once: true });
    });

    await parley.connect(iframe.contentWindow, targetId);

    return iframe;
}

const authModule = await loadModule(
    'https://auth.example.com/module',
    'auth-module'
);
```

**Global State Management**: The shell manages application-wide state.

```typescript
// Shell manages global state
let globalState = {
    isAuthenticated: false,
    user: null,
    theme: 'light',
};

// Broadcast state changes
parley.on('update-global-state', (payload, respond) => {
    globalState = { ...globalState, ...payload };

    parley.broadcast('global-state-changed', globalState);
    respond({ success: true });
});
```

**Routing Coordination**: The shell coordinates navigation between modules.

```typescript
parley.on('navigate-to-module', (payload) => {
    const { moduleId, route } = payload;

    // Update shell router
    window.history.pushState({}, '', `/modules/${moduleId}${route}`);

    // Show target module
    showModule(moduleId);

    // Tell module to navigate
    parley.send(
        'navigate',
        { route },
        {
            targetId: moduleId,
            expectsResponse: false,
        }
    );
});
```

### Module Responsibilities

**Self-Contained Logic**: Each module manages its own internal state and UI.

**Event Emission**: Modules notify the shell of important events.

```typescript
// Module emits events to shell
async function handleUserAction(action: string) {
    await parley.send(
        'module-event',
        {
            module: 'dashboard',
            event: action,
            timestamp: Date.now(),
        },
        {
            targetId: 'shell',
            expectsResponse: false,
        }
    );
}
```

**Responding to Global State**: Modules react to shell-broadcasted state
changes.

```typescript
// Module responds to global state
parley.on('global-state-changed', (state) => {
    if (state.theme !== currentTheme) {
        applyTheme(state.theme);
    }

    if (state.isAuthenticated !== isAuthenticated) {
        handleAuthStateChange(state.isAuthenticated, state.user);
    }
});
```

---

## State Synchronization

Keep state synchronized across multiple micro-frontends.

### Shared State Pattern

```typescript
// Shell broadcasts state updates
let sharedState = { cart: [], selectedItems: [] };

parley.on('update-cart', (payload, respond) => {
    sharedState.cart = payload.cart;

    // Notify all modules
    parley.broadcast('cart-updated', { cart: sharedState.cart });

    respond({ success: true });
});

// Modules listen for updates
parley.on('cart-updated', (payload) => {
    localCartState = payload.cart;
    renderCart(localCartState);
});
```

### Event Sourcing Pattern

Track all state changes as events for debugging and replay:

```typescript
const stateEvents: StateEvent[] = [];

parley.on('state-change', (payload) => {
    stateEvents.push({
        timestamp: Date.now(),
        module: payload.module,
        change: payload.change,
    });

    // Replay capability
    if (payload.replay) {
        replayStateEvents(stateEvents);
    }
});
```

For advanced state synchronization patterns, see
[State Synchronization Pattern](../patterns/state-synchronization.md).

---

## Error Handling

Robust error handling is critical in distributed micro-frontend architectures.

### Module Failure Handling

```typescript
// Shell detects module failures
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.error(`Module ${event.targetId} lost connection`);

    // Show fallback UI
    showModuleError(event.targetId, 'Module unavailable');

    // Attempt reconnection
    attemptReconnect(event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.TIMEOUT, (event) => {
    console.warn(`Request to ${event.targetId} timed out`);

    // Show user-friendly error
    showTimeoutError(event.messageType);
});
```

### Graceful Degradation

When a module fails, maintain core functionality:

```typescript
try {
    const data = await parley.send(
        'get-user-preferences',
        {},
        {
            targetId: 'preferences-module',
            timeout: 3000,
        }
    );
    applyPreferences(data);
} catch (error) {
    // Use default preferences if module unavailable
    console.warn('Preferences module unavailable, using defaults');
    applyPreferences(DEFAULT_PREFERENCES);
}
```

For comprehensive error handling strategies, see
[Error Handling Pattern](../patterns/error-handling.md).

---

## Performance Considerations

Optimize communication performance in micro-frontend architectures.

### Minimize Cross-Module Communication

Reduce the number of messages exchanged:

```typescript
// Bad: Frequent small messages
for (const item of items) {
    await parley.send('update-item', item, { targetId: 'module' });
}

// Good: Batch updates
await parley.send('update-items-batch', { items }, { targetId: 'module' });
```

### Use Fire-and-Forget for Non-Critical Updates

Avoid waiting for responses when not needed:

```typescript
// Fire-and-forget for analytics
parley.send(
    'track-event',
    {
        event: 'button-clicked',
        timestamp: Date.now(),
    },
    {
        targetId: 'analytics-module',
        expectsResponse: false,
    }
);
```

### Cache Shared Data

Cache data in the shell to avoid redundant requests:

```typescript
const dataCache = new Map();

parley.on('get-config', async (payload, respond) => {
    const cacheKey = payload.configKey;

    if (dataCache.has(cacheKey)) {
        respond({ data: dataCache.get(cacheKey), cached: true });
        return;
    }

    const data = await fetchConfig(cacheKey);
    dataCache.set(cacheKey, data);
    respond({ data, cached: false });
});
```

For performance optimization techniques, see
[Performance Guide](../performance/index.md).

---

## Security in Micro-Frontends

Security is paramount when modules run in separate iframes with different
origins.

### Origin Validation

Always validate origins for each micro-frontend:

```typescript
const parley = Parley.create({
    allowedOrigins: [
        'https://auth.example.com', // Auth module
        'https://dashboard.example.com', // Dashboard module
        'https://reports.example.com', // Reports module
    ],
});
```

Never use wildcard origins in production micro-frontends. Each module origin
must be explicitly allowed.

### Content Security Policy

Configure CSP headers to restrict iframe sources:

```html
<meta
    http-equiv="Content-Security-Policy"
    content="frame-src https://auth.example.com https://dashboard.example.com;"
/>
```

### Message Content Validation

Validate all message payloads, even from trusted modules:

```typescript
parley.on('update-user', (payload, respond) => {
    if (!isValidUserId(payload.userId)) {
        respond({ success: false, error: 'Invalid user ID' });
        return;
    }

    if (!isValidEmail(payload.email)) {
        respond({ success: false, error: 'Invalid email' });
        return;
    }

    updateUser(payload);
    respond({ success: true });
});
```

### Token-Based Authentication

Share authentication tokens securely between modules:

```typescript
// Shell shares token (one-time only)
parley.on('request-auth-token', (payload, respond, metadata) => {
    // Verify requesting module
    if (metadata.origin !== 'https://auth.example.com') {
        respond({ success: false, error: 'Unauthorized' });
        return;
    }

    respond({ success: true, token: currentAuthToken });
});
```

For complete security guidelines, see [Security Guide](../security/index.md) and
[Origin Validation](../security/origin-validation.md).

---

## Navigation

### Related Guides

- [Multi-Window Communication](./multi-window-communication.md) - Managing
  multiple windows
- [iFrame Communication](./iframe-communication.md) - Single iframe patterns
- [Popup Communication](./popup-communication.md) - Popup window patterns

### Related Patterns

- [State Synchronization](../patterns/state-synchronization.md) - State sync
  patterns
- [Error Handling](../patterns/error-handling.md) - Error handling strategies
- [Request-Response](../patterns/request-response.md) - Request-response
  patterns

### Related Documentation

- [Security Guide](../security/index.md) - Security best practices
- [Performance Guide](../performance/index.md) - Performance optimization
- [API Reference](../api-reference/index.md) - Complete API documentation

---

**Previous**: [Multi-Window Communication](./multi-window-communication.md)
**Next**: [Guides Overview](./index.md) **Back to**:
[Documentation Home](./index.md)
