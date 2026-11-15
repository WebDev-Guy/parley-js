[Home](../index.md) > [Guides](./index.md) > iFrame Communication

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
- A way to resolve `import ... from 'ignite-parleyjs'` in the browser: a
  bundler/dev server such as Vite, or an import map as shown in
  [Your First ParleyJS Example](../getting-started/first-example.md)

If you need help with setup, see
[Installation](../getting-started/installation.md).

## Basic Setup

The simplest iframe communication setup requires two files: a parent page and a
child page embedded in an iframe.

### Minimal Parent Setup

```javascript
import { Parley } from 'ignite-parleyjs';

// Create Parley instance
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});

// Get iframe element
const iframe = document.getElementById('my-iframe');

// Connect to the iframe element (no need to wait for its load event)
await parley.connect(iframe, 'child');
console.log('Connected to iframe');
```

### Minimal Child Setup

```javascript
import { Parley } from 'ignite-parleyjs';

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
            import { Parley } from 'ignite-parleyjs';

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

            // Connect to the iframe element. connect() resolves once the
            // child page has loaded and answered the handshake.
            const iframe = document.getElementById('child-iframe');
            await parley.connect(iframe, 'child');

            // Send initial configuration
            await parley.send(
                'config:initialize',
                {
                    theme: 'dark',
                    locale: 'en-US',
                },
                { targetId: 'child' }
            );
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
            import { Parley } from 'ignite-parleyjs';

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
document.addEventListener('click', (event) => {
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

// Parent: Handle message timeouts and remote failures
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
    } else if (error.code === 'ERR_NO_HANDLER') {
        console.error('Iframe has no handler for data:request');
    } else if (error.code === 'ERR_HANDLER_ERROR') {
        // The iframe's handler threw. The message is 'Handler error' unless
        // the iframe's instance was created with exposeHandlerErrors: true.
        console.error('Iframe handler failed:', error.message);
    }
}

// Child: Handle disconnection
// (requires: import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';)
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from parent:', event.reason);
    // Show an offline state. ParleyJS does not reconnect automatically;
    // call parley.connect(window.parent, 'parent') again if you want to retry.
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
            import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

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
            parley.onSystem(SYSTEM_EVENTS.CONNECTED, () => {
                statusEl.textContent = 'Connected';
                initializeWidget();
            });

            parley.onSystem(SYSTEM_EVENTS.CONNECTION_LOST, () => {
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

            // Connect to the iframe element (no load listener needed)
            const iframe = document.getElementById('widget');
            try {
                await parley.connect(iframe, 'widget');
            } catch (error) {
                console.error('Connection failed:', error);
                statusEl.textContent = 'Connection Failed';
            }
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
            import { Parley } from 'ignite-parleyjs';

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
3. Parent calls connect() with the iframe element and a target ID.
4. Child calls connect() with the window.parent reference.
5. Handshake completes and both sides can send messages.

The handshake happens automatically when both sides call connect(), in either
order. The child re-sends its handshake until the parent answers, so neither
side needs to wait for a load event or add a delay. If no handshake completes
within `timeout`, connect() rejects with `ERR_CONNECTION_HANDSHAKE_FAILED`.

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
broadcast() to send a fire-and-forget message to all connected targets (it
returns nothing and receives no responses). Handlers receive metadata with
`messageId`, `senderId` (the ID of the connection the message arrived on),
`origin`, `timestamp`, and `expectsResponse`.

See [send() in API Reference](../api-reference/methods.md#send) for complete
send options.

### Heartbeat Monitoring

The heartbeat configuration monitors connection health. If the iframe stops
answering heartbeat pings (for example, it was removed from the page or
navigated away) for `maxMissed` consecutive intervals, ParleyJS emits
SYSTEM_EVENTS.CONNECTION_LOST followed by SYSTEM_EVENTS.DISCONNECTED. You can
then show an offline indicator. Reconnection is not automatic: call connect()
again from your application code if you want to retry.

See [System Events in API Reference](../api-reference/index.md#system-events)
for all available events.

## Common Mistakes

### Mistake 1: Waiting for the Load Event or Passing contentWindow

**Problem**: Wrapping connect() in an iframe `load` listener or a `setTimeout`,
or passing `iframe.contentWindow` instead of the iframe element. A `load`
listener attached after the iframe has already loaded never fires, so connect()
is never called. An iframe instance given `contentWindow` rejects with
`ERR_CONNECTION_FAILED`.

**Wrong**:

```javascript
const iframe = document.getElementById('my-iframe');
iframe.addEventListener('load', async () => {
    // May never run, and contentWindow is the wrong target
    await parley.connect(iframe.contentWindow, 'child');
});
```

**Correct**:

```javascript
const iframe = document.getElementById('my-iframe');
await parley.connect(iframe, 'child');
```

Both sides simply call connect(); the handshake is retried until the child page
is ready.

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

    // The page inside each iframe must call parley.connect(window.parent)
    await parley.connect(iframe, id);
    iframes.set(id, iframe);
}

await addIframe('iframe-1', '/widgets/one.html');
await addIframe('iframe-2', '/widgets/two.html');

// Broadcast to all iframes (fire-and-forget, returns nothing)
parley.broadcast('global:update', {
    timestamp: Date.now(),
});

// Send to specific iframe
await parley.send(
    'specific:update',
    { theme: 'light' },
    { targetId: 'iframe-2' }
);
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
