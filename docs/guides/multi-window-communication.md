[Home](../index.md) > [Documentation](./index.md) > [Guides](./index.md) >
Multi-Window Communication

# Multi-Window Communication Guide

Coordinating communication between multiple windows using ParleyJS.

## Table of Contents

1. [Overview](#overview)
2. [Basic Setup](#basic-setup)
3. [Broadcasting to Multiple Windows](#broadcasting-to-multiple-windows)
4. [Hub-and-Spoke Pattern](#hub-and-spoke-pattern)
5. [Messaging Between Children](#messaging-between-children)
6. [Complete Example](#complete-example)

---

## Overview

Multi-window scenarios involve a main window coordinating with multiple child
windows (iframes, or popups/tabs it opened with `window.open()`). ParleyJS makes
this easy with target management and broadcasting capabilities.

Two rules shape every multi-window design:

- **One instance per target type.** An instance created with
  `targetType: 'iframe'` connects to iframes; one created with
  `targetType: 'window'` connects to popups. A hub that talks to both creates
  two instances.
- **Children cannot connect to each other directly.** Sibling iframes (or two
  popups) have no ParleyJS channel between them; the main window acts as a hub
  and routes messages.

**Use cases**:

- Dashboard with multiple widget iframes
- Application with multiple tool windows
- Collaborative editing across windows
- Multi-screen presentations

---

## Basic Setup

### Managing Multiple Connections

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [
        'https://widget1.example.com',
        'https://widget2.example.com',
        'https://widget3.example.com',
    ],
});

// Connect to multiple iframes (pass the iframe elements).
// Each widget page calls parley.connect(window.parent) on its side.
const iframe1 = document.querySelector('#widget-1');
const iframe2 = document.querySelector('#widget-2');
const iframe3 = document.querySelector('#widget-3');

await Promise.all([
    parley.connect(iframe1, 'widget-1'),
    parley.connect(iframe2, 'widget-2'),
    parley.connect(iframe3, 'widget-3'),
]);

// Now you can send to specific windows
await parley.send(
    'update',
    { data: 'value' },
    {
        targetId: 'widget-1',
    }
);

// Or broadcast to all (fire-and-forget; returns nothing)
parley.broadcast('global-update', { data: 'value' });
```

For individual iframe setup details, see
[iFrame Communication Guide](./iframe-communication.md). For broadcast() API
details, see
[broadcast() method reference](../api-reference/methods.md#broadcast).

---

## Broadcasting to Multiple Windows

### Broadcast Pattern

```typescript
// Broadcast configuration change to all windows
parley.broadcast('theme-change', {
    theme: 'dark',
    timestamp: Date.now(),
});

// All windows connected to this instance receive the message
```

`broadcast()` returns `void`: don't `await` it, and don't expect responses or
per-target failure reports. When you need replies, use `send()` per target as
shown in [Broadcast with Acknowledgment](#broadcast-with-acknowledgment).

For state synchronization across windows using broadcast, see
[State Synchronization Pattern](../patterns/state-synchronization.md).

### Selective Broadcasting

```typescript
// Send to specific subset of windows
const widgetIds = ['widget-1', 'widget-2']; // Not widget-3

for (const targetId of widgetIds) {
    await parley.send(
        'update',
        { data: 'value' },
        {
            targetId,
            expectsResponse: false,
        }
    );
}
```

### Broadcast with Acknowledgment

```typescript
// Send to all and collect responses
const results = [];

for (const targetId of ['widget-1', 'widget-2', 'widget-3']) {
    try {
        const response = await parley.send(
            'query',
            { type: 'status' },
            {
                targetId,
                timeout: 5000,
            }
        );
        results.push({ targetId, ...response });
    } catch (error) {
        console.error(`${targetId} failed:`, error);
    }
}

console.log('All responses:', results);
```

For error handling strategies when collecting responses, see
[Error Handling Pattern](../patterns/error-handling.md#timeout-errors).

---

## Hub-and-Spoke Pattern

Main window acts as central hub coordinating all child windows. For ParleyJS
architectural patterns, see [Architecture Guide](../ARCHITECTURE.md).

### Hub (Main Window)

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.example.com'],
});

// Track connected iframes
const connectedWindows = new Map();

// Connect an iframe element
async function connectWindow(iframe: HTMLIFrameElement, id: string) {
    await parley.connect(iframe, id);
    connectedWindows.set(id, { iframe, status: 'connected' });

    console.log(`Connected to ${id}. Total: ${connectedWindows.size}`);
}

// Handle messages from any child.
// metadata.senderId is the targetId this hub gave the sender in connect().
parley.on('child-message', (payload, respond, metadata) => {
    console.log(`Message from ${metadata.senderId}:`, payload);

    // Forward to the other children
    for (const targetId of connectedWindows.keys()) {
        if (targetId !== metadata.senderId) {
            parley.send(
                'forwarded-message',
                {
                    from: metadata.senderId,
                    data: payload,
                },
                {
                    targetId,
                    expectsResponse: false,
                }
            );
        }
    }

    respond({ received: true });
});

// Broadcast to all children
function broadcastToAll(type: string, data: unknown) {
    parley.broadcast(type, data);
}
```

### Spoke (Child Iframes)

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://main.example.com'],
});

// Register handlers before connecting
parley.on('forwarded-message', (payload) => {
    console.log(`Message from ${payload.from}:`, payload.data);
});

// Connect to hub
await parley.connect(window.parent, 'hub');

// Send message to hub
await parley.send(
    'child-message',
    {
        event: 'user-action',
        data: { action: 'click' },
    },
    {
        targetId: 'hub',
    }
);
```

For request-response messaging patterns in hub-and-spoke architecture, see
[Request-Response Pattern](../patterns/request-response.md).

---

## Messaging Between Children

Child windows cannot open a ParleyJS connection to each other (for example, two
sibling iframes). Instead, each child talks to the hub and the hub relays the
message to the intended recipient.

### Hub Routing Messages

```typescript
// Hub routes messages between children
parley.on('send-to-peer', async (payload, respond, metadata) => {
    const { targetPeer, message } = payload;

    try {
        const response = await parley.send(
            'peer-message',
            {
                from: metadata.senderId,
                message,
            },
            {
                targetId: targetPeer,
                timeout: 5000,
            }
        );

        respond({ success: true, response });
    } catch (error) {
        respond({ success: false, error: error.message });
    }
});
```

### Child Sends to Peer

```typescript
// Child A sends to Child B through hub
async function sendToPeer(peerId, message) {
    const response = await parley.send(
        'send-to-peer',
        {
            targetPeer: peerId,
            message,
        },
        {
            targetId: 'hub',
        }
    );

    if (response.success) {
        console.log('Peer response:', response.response);
    } else {
        console.error('Peer error:', response.error);
    }
}

// Usage
await sendToPeer('widget-2', { data: 'Hello from Widget 1' });
```

### Child Receives from Peer

```typescript
parley.on('peer-message', (payload, respond) => {
    console.log(`Message from ${payload.from}:`, payload.message);

    // Respond to peer
    respond({ received: true, timestamp: Date.now() });
});
```

---

## Complete Example

This hub talks to two iframes and a popup. Because an instance handles a single
target type, the hub creates one instance for iframes and one for popups, and
shares the routing logic between them.

### Main Window (Hub)

```javascript
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

const iframeParley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [window.location.origin],
});

const popupParley = Parley.create({
    targetType: 'window',
    allowedOrigins: [window.location.origin],
});

// targetId -> the instance that owns that connection
const windows = new Map();

async function connectChild(instance, target, id) {
    await instance.connect(target, id);
    windows.set(id, instance);
    console.log(`Connected: ${id}`);
}

// Iframes: connect directly, no load listener needed
connectChild(iframeParley, document.querySelector('#iframe-1'), 'iframe-1');
connectChild(iframeParley, document.querySelector('#iframe-2'), 'iframe-2');

// Popup: open from a click handler, then connect right away
document.getElementById('open-popup').addEventListener('click', async () => {
    const popup = window.open('/popup.html', 'popup', 'width=400,height=300');
    if (!popup) {
        console.error('Popup blocked');
        return;
    }
    await connectChild(popupParley, popup, 'popup');
});

// Same handlers and monitoring on both instances
for (const instance of [iframeParley, popupParley]) {
    // A child asks the hub to relay a message to every other child
    instance.on('broadcast-request', (payload, respond, metadata) => {
        let relayed = 0;
        for (const [targetId, owner] of windows) {
            if (targetId !== metadata.senderId) {
                owner
                    .send(
                        'broadcast-message',
                        { from: metadata.senderId, ...payload },
                        { targetId, expectsResponse: false }
                    )
                    .catch((error) =>
                        console.error(`Relay to ${targetId} failed:`, error)
                    );
                relayed++;
            }
        }
        respond({ broadcasted: relayed });
    });

    instance.onSystem(SYSTEM_EVENTS.CONNECTED, () => {
        updateConnectionStatus();
    });

    instance.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
        // A closed popup arrives here with reason 'connection_lost'
        windows.delete(event.targetId);
        updateConnectionStatus();
    });
}

// Broadcast button: broadcast() is per instance and returns void
document.getElementById('broadcast-all').addEventListener('click', () => {
    const message = { message: 'Hello from hub!', timestamp: Date.now() };
    iframeParley.broadcast('hub-broadcast', message);
    popupParley.broadcast('hub-broadcast', message);
});

function updateConnectionStatus() {
    document.getElementById('status').textContent =
        `Connected windows: ${windows.size}`;
}
```

### Child Window (Iframe/Popup)

The same child script works in both places: it picks its `targetType` and the
hub reference depending on how it was opened.

```javascript
import { Parley } from 'ignite-parleyjs';

const isPopup = window.opener !== null;

const parley = Parley.create({
    targetType: isPopup ? 'window' : 'iframe',
    allowedOrigins: [window.location.origin],
});

// Receive broadcasts from hub
parley.on('hub-broadcast', (payload) => {
    console.log('Hub broadcast:', payload.message);
    displayMessage(`Hub: ${payload.message}`);
});

// Receive messages relayed from other children
parley.on('broadcast-message', (payload) => {
    console.log(`Message from ${payload.from}:`, payload);
    displayMessage(`${payload.from}: ${payload.message || 'ping'}`);
});

// Connect to hub (register handlers first so nothing is missed)
await parley.connect(isPopup ? window.opener : window.parent, 'hub');

// Broadcast to all button
document.getElementById('broadcast').addEventListener('click', async () => {
    const response = await parley.send(
        'broadcast-request',
        {
            message: 'Hello from ' + (window.name || 'a child'),
        },
        {
            targetId: 'hub',
        }
    );

    console.log(`Broadcasted to ${response.broadcasted} windows`);
});

function displayMessage(text) {
    const div = document.createElement('div');
    div.textContent = text;
    document.getElementById('messages').appendChild(div);
}
```

For complete working examples, see
[examples/](https://github.com/WebDev-Guy/parley-js/tree/main/examples). For
system event monitoring in multi-window scenarios, see
[System Events documentation](../api-reference/system-events.md).

---

## Navigation

### Related Guides

- [iFrame Communication](./iframe-communication.md) - Single iframe
- [Popup Communication](./popup-communication.md) - Single popup
- [Micro-Frontends](./micro-frontends.md) - Micro-frontend architecture

### Related Documentation

- [API Reference](../API.md) - Complete API docs
- [Code Patterns](../CODE_PATTERNS.md) - Broadcasting patterns
- [Examples](../EXAMPLES.md) - Multi-window examples

### Testing

- [Testing Guide](../TESTING.md) - Testing multi-window scenarios
- [Testing Patterns](../TESTING_PATTERNS.md) - Unit and integration testing
  strategies

**Back to**: [Use Case Guides](./index.md) | [Documentation Home](../index.md)
