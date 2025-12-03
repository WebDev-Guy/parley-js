# Examples

Practical examples and patterns for using Parley-js.

## Table of Contents

- [Basic Communication](#basic-communication)
- [Iframe Communication](#iframe-communication)
- [Popup Communication](#popup-communication)
- [React Integration](#react-integration)
- [Vue Integration](#vue-integration)
- [Authentication Flow](#authentication-flow)
- [State Synchronization](#state-synchronization)
- [Connection Lifecycle Management](#connection-lifecycle-management)
- [Error Handling Patterns](#error-handling-patterns)
- [Analytics Integration](#analytics-integration)

---

## Basic Communication

### Simple Request/Response

**Parent Window:**

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
});

// Send a message and get response
async function fetchUserData(userId: string) {
    const response = await parley.send<
        { userId: string },
        { name: string; email: string }
    >('get-user', { userId }, { targetId: 'child' });

    console.log('User:', response.name, response.email);
    return response;
}
```

**Child Window:**

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://parent.example.com'],
});

// Register handler using on()
parley.on<{ userId: string }>('get-user', async (payload, respond) => {
    const user = await userService.getUser(payload.userId);
    respond({
        name: user.name,
        email: user.email,
    });
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

### Fire-and-Forget

```typescript
// Send notification without waiting for response
await parley.send('notify', {
    message: 'Operation completed',
    level: 'info',
}, {
    targetId: 'child',
    expectsResponse: false,
});
```

### Broadcasting

```typescript
// Send to all connected targets
await parley.broadcast('config-update', {
    theme: 'dark',
    language: 'en',
});
```

---

## Iframe Communication

### Embedding a Widget

**Host Page (parent.example.com):**

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Host Page</title>
    </head>
    <body>
        <div id="widget-container">
            <iframe id="widget" src="https://widget.example.com/embed"></iframe>
        </div>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                allowedOrigins: ['https://widget.example.com'],
            });

            // Connect to iframe
            const iframe = document.getElementById('widget');
            await parley.connect(iframe, 'widget');

            // Listen for events from widget
            parley.on('widget:selection', (payload, respond) => {
                console.log('User selected:', payload.item);
                document.getElementById('selected').textContent =
                    payload.item.name;
            });

            // Send configuration
            await parley.send('configure', {
                theme: 'dark',
                userId: currentUser.id,
            }, { targetId: 'widget' });
        </script>
    </body>
</html>
```

**Widget (widget.example.com):**

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://parent.example.com'],
});

// Handle configuration
parley.on<{ theme: string; userId: string }>('configure', (payload, respond) => {
    applyTheme(payload.theme);
    setUser(payload.userId);
});

// Connect to parent
await parley.connect(window.parent, 'parent');

// Notify parent of selection
function onItemSelect(item: Item) {
    parley.send('widget:selection', { item }, {
        targetId: 'parent',
        expectsResponse: false,
    });
}
```

---

## Popup Communication

### OAuth Popup Flow

**Main Window:**

```typescript
import { Parley, ConnectionError } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://auth.example.com'],
});

async function loginWithOAuth(provider: string): Promise<AuthToken> {
    // Open OAuth popup
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
        `https://auth.example.com/oauth/${provider}`,
        'oauth-popup',
        `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
        throw new Error('Popup blocked');
    }

    // Connect to popup
    await parley.connect(popup, 'oauth-popup');

    // Wait for token
    return new Promise((resolve, reject) => {
        parley.on<{ token: AuthToken }>('oauth:success', (payload, respond) => {
            resolve(payload.token);
            parley.disconnect('oauth-popup');
        });

        parley.on<{ error: string }>('oauth:error', (payload, respond) => {
            reject(new Error(payload.error));
            parley.disconnect('oauth-popup');
        });

        // Handle popup close
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                reject(new Error('Popup closed'));
            }
        }, 500);
    });
}
```

**OAuth Popup (auth.example.com):**

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://app.example.com'],
});

await parley.connect(window.opener, 'opener');

// After OAuth completes
function onOAuthComplete(token: AuthToken) {
    parley.send('oauth:success', { token }, {
        targetId: 'opener',
        expectsResponse: false,
    });
    window.close();
}

function onOAuthError(error: string) {
    parley.send('oauth:error', { error }, {
        targetId: 'opener',
        expectsResponse: false,
    });
    window.close();
}
```

---

## React Integration

### Custom Hook

```typescript
// hooks/useParley.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { Parley, SYSTEM_EVENTS, type ParleyConfig } from 'parley-js';

export function useParley(config: ParleyConfig) {
    const parleyRef = useRef<Parley | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const parley = Parley.create(config);
        parleyRef.current = parley;

        parley.onSystem(SYSTEM_EVENTS.CONNECTED, () => setIsConnected(true));
        parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, () => setIsConnected(false));

        return () => {
            parley.destroy();
        };
    }, []);

    const send = useCallback(
        async <T, R>(
            targetId: string,
            type: string,
            payload: T
        ): Promise<R> => {
            if (!parleyRef.current) {
                throw new Error('Parley not initialized');
            }
            return parleyRef.current.send<T, R>(targetId, type, payload);
        },
        []
    );

    return {
        parley: parleyRef.current,
        isConnected,
        send,
    };
}
```

### Widget Component

```tsx
// components/IframeWidget.tsx
import { useEffect, useRef, useState } from 'react';
import { useParley } from '../hooks/useParley';

interface WidgetProps {
    src: string;
    origin: string;
    onData?: (data: unknown) => void;
}

export function IframeWidget({ src, origin, onData }: WidgetProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const { parley, isConnected } = useParley({
        allowedOrigins: [origin],
    });

    useEffect(() => {
        if (!parley || !iframeRef.current) return;

        parley
            .connect(iframeRef.current, 'widget')
            .then(() => setIsReady(true))
            .catch(console.error);

        if (onData) {
            parley.on('widget:data', onData);
        }
    }, [parley, origin, onData]);

    return (
        <div className="widget-container">
            <iframe
                ref={iframeRef}
                src={src}
                style={{ opacity: isReady ? 1 : 0.5 }}
            />
            {!isReady && <div className="loading">Connecting...</div>}
        </div>
    );
}
```

---

## Vue Integration

### Composable

```typescript
// composables/useParley.ts
import { ref, onMounted, onUnmounted } from 'vue';
import { Parley, SYSTEM_EVENTS, type ParleyConfig } from 'parley-js';

export function useParley(config: ParleyConfig) {
    const parley = ref<Parley | null>(null);
    const isConnected = ref(false);

    onMounted(() => {
        parley.value = Parley.create(config);

        parley.value.onSystem(SYSTEM_EVENTS.CONNECTED, () => {
            isConnected.value = true;
        });

        parley.value.onSystem(SYSTEM_EVENTS.DISCONNECTED, () => {
            isConnected.value = false;
        });
    });

    onUnmounted(() => {
        parley.value?.destroy();
    });

    async function send<T, R>(
        type: string,
        payload: T,
        targetId?: string
    ): Promise<R> {
        if (!parley.value) {
            throw new Error('Parley not initialized');
        }
        return parley.value.send<T, R>(type, payload, { targetId });
    }

    return {
        parley,
        isConnected,
        send,
    };
}
```

### Component

```vue
<!-- components/IframeWidget.vue -->
<template>
    <div class="widget-container">
        <iframe
            ref="iframeEl"
            :src="src"
            :style="{ opacity: isReady ? 1 : 0.5 }"
        />
        <div v-if="!isReady" class="loading">Connecting...</div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useParley } from '../composables/useParley';

const props = defineProps<{
    src: string;
    origin: string;
}>();

const emit = defineEmits<{
    data: [payload: unknown];
}>();

const iframeEl = ref<HTMLIFrameElement>();
const isReady = ref(false);

const { parley, isConnected } = useParley({
    allowedOrigins: [props.origin],
});

onMounted(async () => {
    if (!parley.value || !iframeEl.value) return;

    await parley.value.connect(iframeEl.value, 'widget');

    isReady.value = true;

    parley.value.on('widget:data', (payload, respond) => {
        emit('data', payload);
    });
});
</script>
```

---

## Authentication Flow

### Session Sharing Between Windows

```typescript
// Parent: Share session with embedded widget
const parley = Parley.create({
    allowedOrigins: ['https://widget.example.com'],
});

parley.on('get-session', (payload, respond) => {
    respond({
        token: authService.getToken(),
        user: authService.getUser(),
        expiresAt: authService.getExpiration(),
    });
});

// Widget: Request session from parent
await parley.connect(window.parent, 'parent');

const session = await parley.send<void, SessionData>(
    'get-session',
    undefined,
    { targetId: 'parent' }
);
authService.setSession(session);
```

### Token Refresh

```typescript
// Widget: Listen for token refresh
parley.on<{ token: string }>('session:refresh', (payload, respond) => {
    authService.updateToken(payload.token);
});

// Parent: Broadcast token refresh
authService.onTokenRefresh((newToken) => {
    parley.broadcast('session:refresh', { token: newToken });
});
```

---

## State Synchronization

### Redux-like State Sync

```typescript
// Parent: State provider
interface AppState {
    theme: 'light' | 'dark';
    user: User | null;
    notifications: Notification[];
}

const store = createStore<AppState>();

// Broadcast state changes
store.subscribe(() => {
    parley.broadcast('state:update', store.getState());
});

// Handle state requests
parley.on('state:get', (payload, respond) => {
    respond(store.getState());
});

// Widget: State consumer
await parley.connect(window.parent, 'parent');

// Get initial state
const initialState = await parley.send<void, AppState>(
    'state:get',
    undefined,
    { targetId: 'parent' }
);
localStore.setState(initialState);

// Listen for updates
parley.on<AppState>('state:update', (state, respond) => {
    localStore.setState(state);
});
```

---

## Connection Lifecycle Management

Parley provides robust connection lifecycle management with automatic heartbeat monitoring and graceful disconnect handling.

### Basic Lifecycle Monitoring

**Parent Window:**

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'],
    heartbeat: {
        enabled: true,
        interval: 5000,    // Check every 5 seconds
        timeout: 2000,     // Wait 2 seconds for response
        maxMissed: 3,      // Allow 3 missed heartbeats
    },
});

// Connection established
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log(`Connected to ${event.targetId}`);
    updateUI('connected');
});

// Connection state changed
parley.onSystem(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, (event) => {
    console.log(`${event.targetId}: ${event.previousState} → ${event.currentState}`);
    if (event.reason) {
        console.log(`Reason: ${event.reason}`);
    }
});

// Heartbeat missed - early warning
parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    console.warn(`Heartbeat missed from ${event.targetId} (${event.consecutiveMissed} missed)`);
    showWarning('Connection unstable');
});

// Connection lost - other side disconnected or heartbeat failed
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.error(`Lost connection to ${event.targetId}`);
    console.log(`Reason: ${event.reason}`); // 'heartbeat_timeout', 'max_failures_reached'
    updateUI('disconnected');
    showReconnectButton();
});

// Normal disconnect (local side initiated)
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log(`Disconnected from ${event.targetId}`);
});

// Connect to iframe
const iframe = document.getElementById('child');
await parley.connect(iframe, 'child');

// Later: graceful disconnect
async function disconnectFromChild() {
    try {
        await parley.disconnect('child');
        console.log('Disconnected gracefully');
    } catch (error) {
        console.log('Disconnect completed');
    }
}
```

**Child Window:**

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://parent.example.com'],
    heartbeat: {
        enabled: true,
        interval: 5000,
    },
});

// Monitor connection lifecycle
parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    console.log(`Lost connection to ${event.targetId}: ${event.reason}`);
    
    if (event.reason === 'heartbeat_timeout') {
        // Parent became unresponsive
        showMessage('Lost contact with parent window');
    }
    
    // Clean up local state
    handleDisconnection();
});

await parley.connect(window.parent, 'parent');
```

### Reconnection Logic

```typescript
import { Parley, SYSTEM_EVENTS, ConnectionError, type ParleyConfig } from 'parley-js';

class ReconnectingParley {
    private parley: Parley;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;

    constructor(config: ParleyConfig) {
        this.parley = Parley.create(config);
        this.setupLifecycleHandlers();
    }

    private setupLifecycleHandlers() {
        this.parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, async (event) => {
            console.log(`Connection lost: ${event.reason}`);
            await this.attemptReconnect(event.targetId);
        });

        this.parley.onSystem(SYSTEM_EVENTS.CONNECTED, () => {
            this.reconnectAttempts = 0;
        });
    }

    private async attemptReconnect(targetId: string) {
        while (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            await this.sleep(delay);

            try {
                // Reconnect logic depends on target type
                await this.reconnectToTarget(targetId);
                console.log('Reconnected successfully');
                return;
            } catch (error) {
                console.warn('Reconnect failed:', error);
            }
        }

        console.error('Max reconnect attempts reached');
        this.onPermanentDisconnect(targetId);
    }

    private async reconnectToTarget(targetId: string) {
        // Implementation depends on how you store target info
        // This is a simplified example
        const iframe = document.getElementById(targetId) as HTMLIFrameElement;
        if (iframe) {
            await this.parley.connect(iframe, targetId);
        }
    }

    private onPermanentDisconnect(targetId: string) {
        // Handle permanent disconnection
        showErrorMessage(`Unable to reconnect to ${targetId}`);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### Connection Health Dashboard

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

// Track connection health metrics
interface ConnectionHealth {
    targetId: string;
    state: string;
    missedHeartbeats: number;
    lastHeartbeat: Date | null;
    connectionTime: Date;
}

const connections = new Map<string, ConnectionHealth>();

parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    connections.set(event.targetId, {
        targetId: event.targetId,
        state: 'connected',
        missedHeartbeats: 0,
        lastHeartbeat: new Date(),
        connectionTime: new Date(),
    });
    updateDashboard();
});

parley.onSystem(SYSTEM_EVENTS.CONNECTION_STATE_CHANGED, (event) => {
    const health = connections.get(event.targetId);
    if (health) {
        health.state = event.currentState;
        updateDashboard();
    }
});

parley.onSystem(SYSTEM_EVENTS.HEARTBEAT_MISSED, (event) => {
    const health = connections.get(event.targetId);
    if (health) {
        health.missedHeartbeats = event.consecutiveMissed;
        updateDashboard();
    }
});

parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, (event) => {
    connections.delete(event.targetId);
    updateDashboard();
});

function updateDashboard() {
    const container = document.getElementById('connection-dashboard');
    container.innerHTML = Array.from(connections.values())
        .map(h => `
            <div class="connection ${h.state}">
                <strong>${h.targetId}</strong>
                <span>State: ${h.state}</span>
                <span>Missed: ${h.missedHeartbeats}</span>
                <span>Connected: ${h.connectionTime.toLocaleTimeString()}</span>
            </div>
        `)
        .join('');
}
```

### Disabling Heartbeat

For environments where heartbeat is not needed:

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://trusted.example.com'],
    heartbeat: {
        enabled: false,  // Disable heartbeat monitoring
    },
});
```

---

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
import {
    Parley,
    TimeoutError,
    ValidationError,
    SecurityError,
    TargetNotFoundError,
    ConnectionError,
} from 'parley-js';

async function safeSend<T, R>(
    parley: Parley,
    targetId: string,
    type: string,
    payload: T
): Promise<{ success: true; data: R } | { success: false; error: Error }> {
    try {
        const data = await parley.send<T, R>(type, payload, { targetId });
        return { success: true, data };
    } catch (error) {
        if (error instanceof TimeoutError) {
            // Handle timeout - maybe retry or notify user
            console.warn('Request timed out:', error.details);
            return { success: false, error };
        }

        if (error instanceof ValidationError) {
            // Handle validation - show form errors
            console.error('Validation failed:', error.details);
            return { success: false, error };
        }

        if (error instanceof SecurityError) {
            // Handle security - log and alert
            console.error('Security violation:', error.message);
            securityLogger.alert(error);
            return { success: false, error };
        }

        if (error instanceof TargetNotFoundError) {
            // Handle missing target - reconnect?
            console.warn('Target not found:', error.details?.targetId);
            return { success: false, error };
        }

        if (error instanceof ConnectionError) {
            // Handle connection issues
            console.error('Connection error:', error.message);
            return { success: false, error };
        }

        // Unknown error
        throw error;
    }
}
```

### Retry with Exponential Backoff

```typescript
async function sendWithRetry<T, R>(
    parley: Parley,
    targetId: string,
    type: string,
    payload: T,
    maxRetries = 3
): Promise<R> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await parley.send<T, R>(type, payload, {
                targetId,
                timeout: 5000 * (attempt + 1), // Increase timeout each retry
            });
        } catch (error) {
            lastError = error as Error;

            if (error instanceof TimeoutError) {
                // Wait before retry (exponential backoff)
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            // Don't retry other errors
            throw error;
        }
    }

    throw lastError;
}
```

---

## Analytics Integration

### Google Analytics

```typescript
parley.onAnalytics((event) => {
    gtag('event', event.type, {
        event_category: 'parley',
        event_label: event.data.messageType,
        value: event.data.duration,
        custom_map: {
            target_id: event.data.targetId,
            message_id: event.data.messageId,
        },
    });
});
```

### Custom Analytics Service

```typescript
class ParleyAnalytics {
    private events: AnalyticsEvent[] = [];
    private flushInterval: number;

    constructor(
        parley: Parley,
        config: { batchSize: number; flushMs: number }
    ) {
        parley.onAnalytics((event) => {
            this.events.push(event);

            if (this.events.length >= config.batchSize) {
                this.flush();
            }
        });

        this.flushInterval = window.setInterval(() => {
            if (this.events.length > 0) {
                this.flush();
            }
        }, config.flushMs);
    }

    private async flush() {
        const batch = this.events.splice(0);

        try {
            await fetch('/api/analytics', {
                method: 'POST',
                body: JSON.stringify(batch),
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            // Put events back on failure
            this.events.unshift(...batch);
        }
    }

    destroy() {
        clearInterval(this.flushInterval);
        this.flush();
    }
}

// Usage
const analytics = new ParleyAnalytics(parley, {
    batchSize: 10,
    flushMs: 30000,
});
```

---

## More Examples

For complete working examples, see the `/examples` directory:

- `examples/basic/` - Simple parent-child iframe communication
- `examples/window-to-window/` - Communication between separate browser windows
- `examples/react-widget/` - React integration
- `examples/vue-widget/` - Vue integration
- `examples/oauth-popup/` - OAuth flow
- `examples/multi-target/` - Multiple targets

Each example includes:

- Complete source code
- README with setup instructions
- Working demo
