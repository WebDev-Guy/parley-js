[Home](../../index.md) > [Guides](./index.md) > iFrame Communication

# iFrame Communication Guide

This guide shows you how to implement secure, bidirectional communication
between a parent page and embedded iframes using ParleyJS.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Basic Setup](#basic-setup)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Complete Code Example](#complete-code-example)
6. [Explanation](#explanation)
7. [Common Mistakes](#common-mistakes)
8. [Advanced Patterns](#advanced-patterns)
9. [Next Steps](#next-steps)
10. [Related Guides](#related-guides)

## Overview

iFrame communication enables you to embed third-party content, widgets, or
isolated components while maintaining secure communication between the parent
page and iframe. Common use cases include widget embedding, configuration
passing, event forwarding, and dynamic resizing.

ParleyJS simplifies iframe communication by handling origin validation,
connection management, and message routing automatically.

## Prerequisites

Before starting this guide:

- Complete [Your First ParleyJS Example](../getting-started/first-example.md)
- Understand [Core Concepts](../getting-started/concepts.md)
- Basic knowledge of iframes and postMessage API
- Local web server (ParleyJS requires HTTP/HTTPS, not file://)

If you need help with setup, see
[Installation](../getting-started/installation.md).

## Basic Setup

The simplest iframe communication setup requires two files: a parent page and a
child page embedded in an iframe.

### Minimal Parent Setup

```javascript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});

// Get iframe element
const iframe = document.getElementById('my-iframe');

// Wait for iframe to load, then connect
iframe.addEventListener('load', async () => {
    await parley.connect(iframe, 'child');
    console.log('Connected to iframe');
});
```

### Minimal Child Setup

```javascript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://parent.example.com'],
});

// Connect to parent window
await parley.connect(window.parent, 'parent');
console.log('Connected to parent');
```

This basic setup establishes a secure communication channel between parent and
child.

## Step-by-Step Implementation

Follow these steps to implement complete iframe communication.

### Step 1: Create the Parent Page

Create `parent.html` with ParleyJS initialization:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Parent Page</title>
    </head>
    <body>
        <h1>Parent Window</h1>
        <iframe
            id="child-iframe"
            src="child.html"
            width="800"
            height="600"
        ></iframe>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: [window.location.origin],
                timeout: 5000,
                heartbeat: {
                    enabled: true,
                    interval: 3000,
                    timeout: 2000,
                    maxMissed: 3,
                },
            });

            // Register message handler
            parley.on('widget:ready', (payload, respond, metadata) => {
                console.log('Widget is ready:', payload);
                respond({ status: 'acknowledged' });
            });

            // Connect when iframe loads
            const iframe = document.getElementById('child-iframe');
            iframe.addEventListener('load', async () => {
                await parley.connect(iframe, 'child');

                // Send initial configuration
                await parley.send(
                    'config:initialize',
                    {
                        theme: 'dark',
                        apiKey: 'abc123',
                    },
                    { targetId: 'child' }
                );
            });
        </script>
    </body>
</html>
```

### Step 2: Create the Child Page

Create `child.html` that runs inside the iframe:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Child Iframe</title>
    </head>
    <body>
        <h2>Child Widget</h2>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: [window.location.origin],
            });

            // Register configuration handler
            parley.on('config:initialize', (payload, respond, metadata) => {
                console.log('Received config:', payload);

                // Apply configuration
                document.body.style.backgroundColor =
                    payload.theme === 'dark' ? '#333' : '#fff';

                respond({ success: true });
            });

            // Connect to parent
            await parley.connect(window.parent, 'parent');

            // Notify parent we're ready
            await parley.send(
                'widget:ready',
                {
                    timestamp: Date.now(),
                },
                { targetId: 'parent' }
            );
        </script>
    </body>
</html>
```

### Step 3: Add Message Handlers

Register handlers for bidirectional communication:

```javascript
// Parent: Listen for events from child
parley.on('widget:event', (payload, respond, metadata) => {
    console.log('Widget event:', payload.eventType);

    if (payload.eventType === 'user-click') {
        // Handle user interaction
        respond({ received: true });
    }
});

// Child: Send events to parent
async function notifyParent(eventType, data) {
    await parley.send(
        'widget:event',
        {
            eventType,
            data,
            timestamp: Date.now(),
        },
        { targetId: 'parent' }
    );
}

// Example: Notify parent of user click
document.addEventListener('click', () => {
    notifyParent('user-click', { x: event.clientX, y: event.clientY });
});
```

### Step 4: Implement Error Handling

Add proper error handling for robust communication:

```javascript
// Parent: Handle connection errors
try {
    await parley.connect(iframe, 'child');
} catch (error) {
    console.error('Failed to connect to iframe:', error.message);
    // Show error UI to user
}

// Parent: Handle message timeouts
try {
    const response = await parley.send(
        'data:request',
        { id: 123 },
        {
            targetId: 'child',
            timeout: 3000,
        }
    );
} catch (error) {
    if (error.code === 'ERR_TIMEOUT_NO_RESPONSE') {
        console.error('Iframe did not respond in time');
    }
}

// Child: Handle disconnection
parley.onSystem(Parley.SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from parent:', event.reason);
    // Attempt reconnection or show offline state
});
```

## Complete Code Example

This example demonstrates a complete iframe integration with configuration,
event handling, and error recovery.

### Parent Page (parent.html)

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Widget Container</title>
    </head>
    <body>
        <h1>Widget Container</h1>
        <div id="status">Connecting...</div>
        <iframe id="widget" src="widget.html" width="800" height="600"></iframe>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: [window.location.origin],
                timeout: 5000,
                heartbeat: { enabled: true, interval: 3000 },
            });

            const statusEl = document.getElementById('status');

            // Listen for widget events
            parley.on('widget:resize', (payload, respond) => {
                const iframe = document.getElementById('widget');
                iframe.style.height = `${payload.height}px`;
                respond({ resized: true });
            });

            parley.on('widget:error', (payload) => {
                console.error('Widget error:', payload.message);
                statusEl.textContent = 'Widget Error';
            });

            // System event handlers
            parley.onSystem(Parley.SYSTEM_EVENTS.CONNECTED, () => {
                statusEl.textContent = 'Connected';
                initializeWidget();
            });

            parley.onSystem(Parley.SYSTEM_EVENTS.CONNECTION_LOST, () => {
                statusEl.textContent = 'Connection Lost';
            });

            // Initialize widget with configuration
            async function initializeWidget() {
                try {
                    const response = await parley.send(
                        'widget:init',
                        {
                            theme: 'dark',
                            locale: 'en-US',
                            features: ['analytics', 'notifications'],
                        },
                        { targetId: 'widget' }
                    );

                    console.log('Widget initialized:', response);
                } catch (error) {
                    console.error('Initialization failed:', error);
                    statusEl.textContent = 'Initialization Failed';
                }
            }

            // Connect when iframe loads
            const iframe = document.getElementById('widget');
            iframe.addEventListener('load', async () => {
                try {
                    await parley.connect(iframe, 'widget');
                } catch (error) {
                    console.error('Connection failed:', error);
                    statusEl.textContent = 'Connection Failed';
                }
            });
        </script>
    </body>
</html>
```

### Child Widget (widget.html)

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Widget</title>
    </head>
    <body>
        <h2>Widget Content</h2>
        <div id="content">Loading...</div>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                targetType: 'iframe',
                allowedOrigins: [window.location.origin],
            });

            let config = {};

            // Handle initialization
            parley.on('widget:init', (payload, respond) => {
                config = payload;

                // Apply theme
                document.body.style.backgroundColor =
                    payload.theme === 'dark' ? '#333' : '#fff';
                document.body.style.color =
                    payload.theme === 'dark' ? '#fff' : '#333';

                document.getElementById('content').textContent =
                    `Initialized with locale: ${payload.locale}`;

                respond({
                    success: true,
                    version: '1.0.0',
                });

                // Auto-resize based on content
                requestResize();
            });

            // Auto-resize function
            async function requestResize() {
                const height = document.body.scrollHeight;

                try {
                    await parley.send(
                        'widget:resize',
                        {
                            height,
                            timestamp: Date.now(),
                        },
                        { targetId: 'parent' }
                    );
                } catch (error) {
                    console.error('Resize request failed:', error);
                }
            }

            // Report errors to parent
            window.addEventListener('error', (event) => {
                parley.send(
                    'widget:error',
                    {
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                    },
                    {
                        targetId: 'parent',
                        expectsResponse: false,
                    }
                );
            });

            // Connect to parent
            await parley.connect(window.parent, 'parent');
        </script>
    </body>
</html>
```

## Explanation

### Connection Flow

1. Parent creates Parley instance with iframe target type and allowed origins.
2. Child creates Parley instance with matching origin configuration.
3. Parent waits for iframe load event to ensure child is ready.
4. Parent calls connect() with iframe element and target ID.
5. Child calls connect() with window.parent reference.
6. Handshake completes and both sides can send messages.

The handshake happens automatically when both sides call connect(). ParleyJS
handles the protocol internally.

### Origin Validation

ParleyJS validates every message against the allowedOrigins list. For
same-origin iframes, use window.location.origin. For cross-origin iframes,
specify the exact iframe origin including protocol, hostname, and port.

For complete origin validation guide, see
[Origin Validation](../security/origin-validation.md). For troubleshooting
origin errors, see
[Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Message Routing

Messages sent with targetId are routed to that specific connection. Use
broadcast() to send to all connected targets. Each message includes metadata
with origin, targetId, and messageId for tracking.

See [send() in API Reference](../api-reference/methods.md#send) for complete
send options.

### Heartbeat Monitoring

The heartbeat configuration monitors connection health. If the iframe becomes
unresponsive (browser tab suspended), ParleyJS detects it and emits
SYSTEM_EVENTS.CONNECTION_LOST. You can then show an offline indicator or attempt
reconnection.

See [System Events in API Reference](../api-reference/README.md#system-events)
for all available events.

## Common Mistakes

### Mistake 1: Connecting Before Iframe Loads

**Problem**: Calling parley.connect() before the iframe is fully loaded causes
connection failures.

**Wrong**:

```javascript
const iframe = document.getElementById('my-iframe');
await parley.connect(iframe, 'child'); // iframe might not be loaded yet
```

**Correct**:

```javascript
const iframe = document.getElementById('my-iframe');
iframe.addEventListener('load', async () => {
    await parley.connect(iframe, 'child');
});
```

Wait for the load event to ensure the iframe's window object is ready. For more
iframe timing issues, see
[Dead Window References](../troubleshooting/common-errors.md#dead-window-references).

### Mistake 2: Mismatched Origins

**Problem**: Parent and child have different origins configured, preventing
communication.

**Wrong**:

```javascript
// Parent
allowedOrigins: ['https://example.com'];

// Child (running on localhost)
allowedOrigins: ['http://localhost:3000'];
```

**Correct**:

```javascript
// Both parent and child for same-origin
allowedOrigins: [window.location.origin];

// Cross-origin: Each side allows the other's origin
// Parent
allowedOrigins: ['https://child.example.com'];

// Child
allowedOrigins: ['https://parent.example.com'];
```

Origins must match exactly including protocol (http/https), hostname, and port.
For complete origin validation guide, see
[Origin Validation](../security/origin-validation.md). For debugging origin
mismatches, see
[Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 3: Not Handling Connection Errors

**Problem**: Connection failures are not caught, leaving the UI in an undefined
state.

**Wrong**:

```javascript
await parley.connect(iframe, 'child');
// Assumes success, no error handling
```

**Correct**:

```javascript
try {
    await parley.connect(iframe, 'child');
    statusEl.textContent = 'Connected';
} catch (error) {
    console.error('Connection failed:', error.message);
    statusEl.textContent = 'Connection Failed - Retrying...';
    // Implement retry logic or show error UI
}
```

Always handle connection errors with try-catch blocks.

### Mistake 4: Forgetting to Respond

**Problem**: Child receives a message expecting a response but doesn't call
respond(), causing timeout in parent.

**Wrong**:

```javascript
parley.on('config:set', (payload) => {
    applyConfig(payload);
    // Forgot to call respond()
});
```

**Correct**:

```javascript
parley.on('config:set', (payload, respond) => {
    applyConfig(payload);
    respond({ success: true });
});
```

When the sender uses send() (default expects response), always call respond() in
your handler.

### Mistake 5: Using Same Target ID for Multiple Iframes

**Problem**: Multiple iframes are connected with the same targetId, causing
message routing errors.

**Wrong**:

```javascript
await parley.connect(iframe1, 'child');
await parley.connect(iframe2, 'child'); // Same ID - error!
```

**Correct**:

```javascript
await parley.connect(iframe1, 'child-1');
await parley.connect(iframe2, 'child-2');

// Send to specific iframe
await parley.send('message', data, { targetId: 'child-1' });
```

Each target must have a unique targetId.

## Advanced Patterns

### Dynamic Iframe Resizing

Automatically resize iframe based on content height:

```javascript
// Child (iframe): Send height updates
const observer = new ResizeObserver(() => {
    const height = document.body.scrollHeight;
    parley.send(
        'iframe:resize',
        { height },
        {
            targetId: 'parent',
            expectsResponse: false,
        }
    );
});
observer.observe(document.body);

// Parent: Apply height updates
parley.on('iframe:resize', (payload) => {
    iframe.style.height = `${payload.height}px`;
});
```

For fire-and-forget messaging pattern, see
[Request-Response: When NOT to Use It](../patterns/request-response.md#when-not-to-use-it).

### Configuration Updates

Update iframe configuration after initial load:

```javascript
// Parent: Send configuration update
async function updateTheme(theme) {
    await parley.send(
        'config:update',
        {
            theme,
            timestamp: Date.now(),
        },
        { targetId: 'widget' }
    );
}

// Child: Apply configuration update
parley.on('config:update', (payload, respond) => {
    applyTheme(payload.theme);
    respond({ applied: true });
});
```

For complete request-response pattern with variations, see
[Request-Response Pattern](../patterns/request-response.md).

### Multiple Iframe Management

Manage multiple iframes with a registry:

```javascript
const iframes = new Map();

async function addIframe(id, src) {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    document.body.appendChild(iframe);

    await new Promise((resolve) => {
        iframe.addEventListener('load', resolve);
    });

    await parley.connect(iframe, id);
    iframes.set(id, iframe);
}

// Broadcast to all iframes
await parley.broadcast('global:update', {
    timestamp: Date.now(),
});

// Send to specific iframe
await parley.send('specific:update', data, {
    targetId: 'iframe-2',
});
```

For state synchronization across multiple iframes, see
[State Synchronization Pattern](../patterns/state-synchronization.md). For
coordinating multiple targets, see
[Multi-Window Communication](./multi-window-communication.md).

## Next Steps

Now that you understand iframe communication:

**Learn More Patterns**:

- [Request-Response Pattern](../patterns/request-response.md) - Structured
  request-response communication
- [Error Handling Pattern](../patterns/error-handling.md) - Robust error
  handling strategies
- [State Synchronization](../patterns/state-synchronization.md) - Keep state in
  sync across windows

**Explore Other Communication Types**:

- [Popup Window Communication](./popup-communication.md) - OAuth flows and
  dialogs
- [Multi-Window Communication](./multi-window-communication.md) - Coordinate
  multiple windows

**Security**:

- [Origin Validation](../security/origin-validation.md) - Secure your iframe
  communication
- [Message Validation](../security/message-validation.md) - Validate message
  structure

**Testing**:

- [Testing Guide](../TESTING.md) - Test iframe communication
- [Testing Patterns](../TESTING_PATTERNS.md) - Unit and integration testing
  strategies

**Framework Integration**:

- [destroy() method](../api-reference/methods.md#destroy) - React/Vue/Angular
  cleanup examples
- [Testing Patterns: Framework Integration](../TESTING_PATTERNS.md#framework-integration) -
  Framework-specific patterns

**Troubleshooting**:

- [Common Errors](../troubleshooting/common-errors.md) - Quick solutions to
  frequent issues
- [Messages Not Received](../troubleshooting/common-errors.md#messages-not-being-received) -
  Debug silent failures
- [Dead Window References](../troubleshooting/common-errors.md#dead-window-references) -
  Fix iframe timing issues

## Related Guides

- **[Popup Window Communication](./popup-communication.md)** - Parent and popup
  patterns
- **[Multi-Window Communication](./multi-window-communication.md)** - Multiple
  window coordination
- **[Security Guide](../security/index.md)** - Security best practices

## See Also

**API Methods**:

- [connect()](../api-reference/methods.md#connect) - Establish iframe connection
- [send()](../api-reference/methods.md#send) - Send messages to iframe
- [on()](../api-reference/methods.md#on) - Register message handlers
- [broadcast()](../api-reference/methods.md#broadcast) - Send to all connected
  targets

**Code Patterns**:

- [Request-Response Pattern](../patterns/request-response.md)
- [Error Handling Pattern](../patterns/error-handling.md)

---

**Previous**: [Use Case Guides](./index.md) **Next**:
[Popup Window Communication](./popup-communication.md) **Back to**:
[Documentation Home](./index.md)
