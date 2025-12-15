[Home](../../index.md) > [Code Patterns](./index.md) > State Synchronization
Pattern

# State Synchronization Pattern

The state synchronization pattern enables multiple windows to maintain
consistent shared state by automatically propagating state changes between
windows.

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

When multiple windows need to share application state (user preferences, UI
state, data), manually keeping them in sync is error-prone. State can become
inconsistent if updates are lost, arrive out of order, or conflict with
concurrent changes.

The state synchronization pattern solves this by providing automatic state
propagation and consistency mechanisms. When state changes in one window, all
other windows receive the update and update their local state accordingly.

## When to Use It

Use state synchronization when:

- Multiple windows display the same data and need to stay in sync
- User actions in one window should reflect in all windows
- Sharing configuration or preferences across windows
- Building collaborative features where users see real-time updates
- State changes need to persist across window reloads or reconnections

This pattern is essential for multi-window applications, dashboard widgets, and
collaborative tools.

## When NOT to Use It

Avoid state synchronization when:

- State is local to one window and doesn't need sharing
- Windows are independent and don't need coordination
- State changes are too frequent (causes performance issues)
- State is too large to transmit efficiently
- Simple one-way data flow is sufficient

For simple parent-to-child configuration, use request-response instead of full
synchronization.

## Code Example

### Basic State Synchronization

**Shared State Class**:

```javascript
import { Parley } from 'parley-js';

class SyncedState {
    constructor(parley, initialState = {}) {
        this.parley = parley;
        this.state = initialState;
        this.listeners = new Set();

        // Listen for remote state updates
        this.parley.on('state:update', (payload) => {
            this.applyRemoteUpdate(payload.updates);
        });
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Update state locally and broadcast to other windows
     */
    async setState(updates) {
        // Apply locally first
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // Notify local listeners
        this.notifyListeners(this.state, oldState);

        // Broadcast to all connected windows
        await this.parley.broadcast('state:update', {
            updates,
            timestamp: Date.now(),
        });
    }

    /**
     * Apply update received from remote window
     */
    applyRemoteUpdate(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // Notify local listeners
        this.notifyListeners(this.state, oldState);
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener) {
        this.listeners.add(listener);

        // Return unsubscribe function
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of state change
     */
    notifyListeners(newState, oldState) {
        this.listeners.forEach((listener) => {
            try {
                listener(newState, oldState);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }
}

// Usage in parent window
const parley = Parley.create({
    allowedOrigins: [window.location.origin],
});

await parley.connect(iframe, 'child');

const appState = new SyncedState(parley, {
    theme: 'light',
    user: null,
    notifications: [],
});

// Subscribe to state changes
appState.subscribe((newState, oldState) => {
    console.log('State changed:', newState);

    // Update UI when theme changes
    if (newState.theme !== oldState.theme) {
        applyTheme(newState.theme);
    }
});

// Update state (broadcasts to all windows)
await appState.setState({
    theme: 'dark',
});

// Usage in child window
const childState = new SyncedState(childParley, {
    theme: 'light',
    user: null,
    notifications: [],
});

childState.subscribe((newState) => {
    // Child UI updates automatically when parent changes theme
    applyTheme(newState.theme);
});
```

### Redux-Style Store Synchronization

**Synchronized Redux Store**:

```javascript
class SyncedStore {
    constructor(parley, reducer, initialState = {}) {
        this.parley = parley;
        this.reducer = reducer;
        this.state = initialState;
        this.listeners = new Set();

        // Listen for remote actions
        this.parley.on('store:action', (payload) => {
            this.dispatchRemote(payload.action);
        });
    }

    getState() {
        return this.state;
    }

    async dispatch(action) {
        // Apply action locally
        const oldState = this.state;
        this.state = this.reducer(this.state, action);

        // Notify listeners
        this.listeners.forEach((listener) => listener(this.state, action));

        // Broadcast action to other windows
        await this.parley.broadcast('store:action', {
            action,
            timestamp: Date.now(),
        });

        return this.state;
    }

    dispatchRemote(action) {
        // Apply action received from remote window
        const oldState = this.state;
        this.state = this.reducer(this.state, action);

        // Notify listeners (don't broadcast - already received)
        this.listeners.forEach((listener) => listener(this.state, action));
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

// Reducer
function appReducer(state, action) {
    switch (action.type) {
        case 'SET_USER':
            return { ...state, user: action.payload };

        case 'SET_THEME':
            return { ...state, theme: action.payload };

        case 'ADD_NOTIFICATION':
            return {
                ...state,
                notifications: [...state.notifications, action.payload],
            };

        case 'CLEAR_NOTIFICATIONS':
            return { ...state, notifications: [] };

        default:
            return state;
    }
}

// Usage
const store = new SyncedStore(parley, appReducer, {
    user: null,
    theme: 'light',
    notifications: [],
});

store.subscribe((state, action) => {
    console.log('Action:', action.type, 'New state:', state);
    renderApp(state);
});

// Dispatch actions (synchronized across windows)
await store.dispatch({
    type: 'SET_USER',
    payload: { id: 123, name: 'John' },
});

await store.dispatch({
    type: 'SET_THEME',
    payload: 'dark',
});
```

### Optimistic Updates with Conflict Resolution

**Handle Concurrent Updates**:

```javascript
class OptimisticSyncedState {
    constructor(parley, initialState = {}) {
        this.parley = parley;
        this.state = initialState;
        this.version = 0;
        this.listeners = new Set();

        // Listen for state updates with version
        this.parley.on('state:update', (payload) => {
            this.handleRemoteUpdate(payload);
        });
    }

    getState() {
        return { ...this.state };
    }

    async setState(updates, options = {}) {
        // Optimistic update - apply immediately
        const oldState = { ...this.state };
        const oldVersion = this.version;

        this.state = { ...this.state, ...updates };
        this.version++;

        // Notify listeners immediately (optimistic)
        this.notifyListeners(this.state, oldState);

        // Broadcast with version
        try {
            await this.parley.broadcast('state:update', {
                updates,
                version: this.version,
                timestamp: Date.now(),
            });
        } catch (error) {
            // Rollback on failure
            if (options.rollbackOnError) {
                this.state = oldState;
                this.version = oldVersion;
                this.notifyListeners(oldState, this.state);
            }
            throw error;
        }
    }

    handleRemoteUpdate(payload) {
        const { updates, version, timestamp } = payload;

        // Resolve conflicts using version number
        if (version > this.version) {
            // Remote version is newer - accept update
            const oldState = { ...this.state };
            this.state = { ...this.state, ...updates };
            this.version = version;
            this.notifyListeners(this.state, oldState);
        } else if (version < this.version) {
            // Remote version is older - ignore
            console.warn('Ignoring older state update');
        } else {
            // Same version - conflict!
            console.warn('Version conflict detected');
            this.resolveConflict(updates, timestamp);
        }
    }

    resolveConflict(updates, remoteTimestamp) {
        // Last-write-wins strategy
        const localTimestamp = Date.now();

        if (remoteTimestamp > localTimestamp) {
            // Remote is newer
            const oldState = { ...this.state };
            this.state = { ...this.state, ...updates };
            this.notifyListeners(this.state, oldState);
        }
        // Else: local wins, keep current state
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyListeners(newState, oldState) {
        this.listeners.forEach((listener) => {
            try {
                listener(newState, oldState);
            } catch (error) {
                console.error('Error in listener:', error);
            }
        });
    }
}

// Usage
const state = new OptimisticSyncedState(parley, {
    counter: 0,
    text: '',
});

state.subscribe((newState) => {
    document.getElementById('counter').textContent = newState.counter;
});

// Optimistic update with rollback on error
await state.setState(
    { counter: state.getState().counter + 1 },
    { rollbackOnError: true }
);
```

### Partial State Synchronization

**Sync Only Specific State Slices**:

```javascript
class SlicedSyncedState {
    constructor(parley, config = {}) {
        this.parley = parley;
        this.state = config.initialState || {};
        this.syncedKeys = new Set(config.syncedKeys || []);
        this.listeners = new Map();

        // Listen for updates to synced keys
        this.syncedKeys.forEach((key) => {
            this.parley.on(`state:${key}`, (payload) => {
                this.updateSlice(key, payload.value);
            });
        });
    }

    getState() {
        return { ...this.state };
    }

    getValue(key) {
        return this.state[key];
    }

    async setValue(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;

        // Notify listeners for this key
        const keyListeners = this.listeners.get(key) || new Set();
        keyListeners.forEach((listener) => listener(value, oldValue));

        // Broadcast if key is synced
        if (this.syncedKeys.has(key)) {
            await this.parley.broadcast(`state:${key}`, {
                value,
                timestamp: Date.now(),
            });
        }
    }

    updateSlice(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;

        // Notify listeners
        const keyListeners = this.listeners.get(key) || new Set();
        keyListeners.forEach((listener) => listener(value, oldValue));
    }

    subscribe(key, listener) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }

        this.listeners.get(key).add(listener);

        return () => {
            const keyListeners = this.listeners.get(key);
            if (keyListeners) {
                keyListeners.delete(listener);
            }
        };
    }
}

// Usage
const state = new SlicedSyncedState(parley, {
    initialState: {
        theme: 'light', // synced
        user: null, // synced
        localCache: {}, // not synced
    },
    syncedKeys: ['theme', 'user'], // Only these keys sync
});

// Subscribe to specific state slices
state.subscribe('theme', (newTheme, oldTheme) => {
    console.log('Theme changed:', newTheme);
    applyTheme(newTheme);
});

state.subscribe('user', (newUser, oldUser) => {
    console.log('User changed:', newUser);
    updateUserUI(newUser);
});

// Update synced state (broadcasts to all windows)
await state.setValue('theme', 'dark');

// Update local state (doesn't broadcast)
await state.setValue('localCache', { data: '...' });
```

## Explanation

### How State Synchronization Works

1. **Local Update**: When setState() is called, the state is updated locally
   first for immediate UI response.

2. **Broadcast**: The state change is broadcast to all connected windows via
   ParleyJS.

3. **Remote Receive**: Other windows receive the state update message.

4. **Remote Apply**: Each window applies the update to its local state.

5. **Notify Listeners**: Listeners in each window are notified of the state
   change.

This ensures all windows maintain consistent state while providing immediate
feedback for the user who initiated the change.

### Why This Pattern Works

State synchronization provides:

- **Consistency**: All windows see the same state at any given time
- **Reactivity**: UI updates automatically when state changes
- **Optimistic updates**: Changes appear instant to the user
- **Decoupling**: Components subscribe to state without knowing about messaging

This creates a seamless multi-window experience where changes in one window
instantly reflect everywhere.

### Conflict Resolution Strategies

When multiple windows update state simultaneously, conflicts can occur. Common
resolution strategies:

1. **Last-Write-Wins**: Most recent update wins (use timestamps)
2. **Version Numbers**: Higher version number wins
3. **Operational Transformation**: Merge concurrent changes intelligently
4. **Manual Resolution**: Prompt user to resolve conflicts

Choose the strategy based on your application's needs and the nature of the
state being synchronized.

## Common Variations

### Variation 1: Debounced Synchronization

**Reduce Update Frequency**:

```javascript
class DebouncedSyncedState {
    constructor(parley, initialState = {}, debounceMs = 300) {
        this.parley = parley;
        this.state = initialState;
        this.listeners = new Set();
        this.debounceMs = debounceMs;
        this.pendingUpdates = {};
        this.debounceTimer = null;

        this.parley.on('state:update', (payload) => {
            this.applyRemoteUpdate(payload.updates);
        });
    }

    getState() {
        return { ...this.state };
    }

    setState(updates) {
        // Apply locally immediately
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        this.notifyListeners(this.state, oldState);

        // Queue update for broadcast
        this.pendingUpdates = { ...this.pendingUpdates, ...updates };

        // Debounce broadcast
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.flushUpdates();
        }, this.debounceMs);
    }

    async flushUpdates() {
        if (Object.keys(this.pendingUpdates).length === 0) return;

        const updates = { ...this.pendingUpdates };
        this.pendingUpdates = {};

        await this.parley.broadcast('state:update', {
            updates,
            timestamp: Date.now(),
        });
    }

    applyRemoteUpdate(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        this.notifyListeners(this.state, oldState);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyListeners(newState, oldState) {
        this.listeners.forEach((listener) => listener(newState, oldState));
    }
}

// Usage - high-frequency updates are batched
const state = new DebouncedSyncedState(
    parley,
    {
        scrollY: 0,
    },
    300
);

window.addEventListener('scroll', () => {
    // Updates every frame but only broadcasts every 300ms
    state.setState({ scrollY: window.scrollY });
});
```

Debouncing is essential for high-frequency updates like scroll events. For more
performance optimization strategies, see
[Performance Issues troubleshooting](../troubleshooting/common-errors.md#performance-issues).

### Variation 2: State Persistence

**Persist State to localStorage**:

```javascript
class PersistedSyncedState extends SyncedState {
    constructor(parley, initialState = {}, storageKey = 'appState') {
        // Load from localStorage
        const savedState = localStorage.getItem(storageKey);
        const persistedState = savedState
            ? JSON.parse(savedState)
            : initialState;

        super(parley, persistedState);

        this.storageKey = storageKey;

        // Save to localStorage on state change
        this.subscribe((newState) => {
            localStorage.setItem(this.storageKey, JSON.stringify(newState));
        });
    }

    clear() {
        localStorage.removeItem(this.storageKey);
        this.state = {};
        this.notifyListeners(this.state, {});
    }
}

// Usage - state persists across page reloads
const state = new PersistedSyncedState(
    parley,
    {
        theme: 'light',
        preferences: {},
    },
    'myApp:state'
);
```

### Variation 3: Selective Updates

**Only Sync Changed Values**:

```javascript
class DiffSyncedState extends SyncedState {
    async setState(updates) {
        // Calculate diff
        const changes = {};
        for (const [key, value] of Object.entries(updates)) {
            if (this.state[key] !== value) {
                changes[key] = value;
            }
        }

        // Only broadcast if there are actual changes
        if (Object.keys(changes).length === 0) {
            return;
        }

        // Apply locally
        const oldState = { ...this.state };
        this.state = { ...this.state, ...changes };
        this.notifyListeners(this.state, oldState);

        // Broadcast only changed values
        await this.parley.broadcast('state:update', {
            updates: changes,
            timestamp: Date.now(),
        });
    }
}
```

For broadcasting state updates to multiple windows, see
[Multi-Window Communication](../guides/multi-window-communication.md). For
broadcast() API details, see
[broadcast() method](../api-reference/methods.md#broadcast). For error handling
when state updates fail, see
[Error Handling: Rollback Pattern](./error-handling.md#fallback-pattern).

## Testing

Test state synchronization by verifying state changes propagate correctly.

### Testing State Updates

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('State Synchronization', () => {
    it('should update state locally', () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin],
        });

        const state = new SyncedState(parley, { count: 0 });

        state.setState({ count: 5 });

        expect(state.getState().count).toBe(5);
    });

    it('should notify listeners on state change', () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin],
        });

        const state = new SyncedState(parley, { count: 0 });

        const listener = vi.fn();
        state.subscribe(listener);

        state.setState({ count: 5 });

        expect(listener).toHaveBeenCalledWith({ count: 5 }, { count: 0 });
    });

    it('should broadcast state updates', async () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin],
        });

        const broadcastSpy = vi.spyOn(parley, 'broadcast');

        const state = new SyncedState(parley, { count: 0 });

        await state.setState({ count: 5 });

        expect(broadcastSpy).toHaveBeenCalledWith(
            'state:update',
            expect.objectContaining({
                updates: { count: 5 },
            })
        );
    });

    it('should handle remote updates', () => {
        const parley = Parley.create({
            allowedOrigins: [window.location.origin],
        });

        const state = new SyncedState(parley, { count: 0 });

        const listener = vi.fn();
        state.subscribe(listener);

        // Simulate remote update
        state.applyRemoteUpdate({ count: 10 });

        expect(state.getState().count).toBe(10);
        expect(listener).toHaveBeenCalled();
    });
});
```

For comprehensive testing strategies, see
[Testing Patterns](../TESTING_PATTERNS.md).

## Related Patterns

- **[Request-Response Pattern](./request-response.md)** - One-time state queries
- **[Error Handling Pattern](./error-handling.md)** - Handle sync failures
- **Event Emitter Pattern** - Event-based updates (see
  [CODE_PATTERNS.md](../CODE_PATTERNS.md#event-emitter-pattern))

## See Also

**API Methods**:

- [broadcast()](../api-reference/methods.md#broadcast) - Broadcast state updates
  to all windows
- [on()](../api-reference/methods.md#on) - Listen for state update messages
- [send()](../api-reference/methods.md#send) - Request initial state from other
  windows

**Guides**:

- [Multi-Window Communication](../guides/multi-window-communication.md) -
  Coordinate multiple windows
- [iFrame Communication](../guides/iframe-communication.md) - Sync state with
  iframes
- [Examples](../EXAMPLES.md) - State synchronization examples

**Advanced Topics**:

- [Performance](../performance/index.md) - Optimize state sync performance
- [Testing Guide](../TESTING.md) - Test synchronized state

---

**Previous**: [Error Handling Pattern](./error-handling.md) **Next**:
[Code Patterns Overview](./index.md) **Back to**: [Code Patterns](./index.md)
