[Home](../../README.md) > [Documentation](../README.md) > [Guides](./README.md) > Multi-Window Communication

# Multi-Window Communication Guide

Coordinating communication between multiple windows using ParleyJS.

## Table of Contents

1. [Overview](#overview)
2. [Basic Setup](#basic-setup)
3. [Broadcasting to Multiple Windows](#broadcasting-to-multiple-windows)
4. [Hub-and-Spoke Pattern](#hub-and-spoke-pattern)
5. [Peer-to-Peer Communication](#peer-to-peer-communication)
6. [Complete Example](#complete-example)

---

## Overview

Multi-window scenarios involve a main window coordinating with multiple child windows (iframes, popups, or tabs). ParleyJS makes this easy with target management and broadcasting capabilities.

**Use cases**:
- Dashboard with multiple widget iframes
- Application with multiple tool windows
- Collaborative editing across windows
- Multi-screen presentations

---

## Basic Setup

### Managing Multiple Connections

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
  allowedOrigins: [
    'https://widget1.example.com',
    'https://widget2.example.com',
    'https://widget3.example.com'
  ]
});

// Connect to multiple iframes
const iframe1 = document.querySelector('#widget-1');
const iframe2 = document.querySelector('#widget-2');
const iframe3 = document.querySelector('#widget-3');

await parley.connect(iframe1.contentWindow, 'widget-1');
await parley.connect(iframe2.contentWindow, 'widget-2');
await parley.connect(iframe3.contentWindow, 'widget-3');

// Now you can send to specific windows
await parley.send('update', { data: 'value' }, {
  targetId: 'widget-1'
});

// Or broadcast to all
await parley.broadcast('global-update', { data: 'value' });
```

For individual iframe setup details, see [iFrame Communication Guide](./iframe-communication.md). For broadcast() API details, see [broadcast() method reference](../api-reference/methods.md#broadcast).

---

## Broadcasting to Multiple Windows

### Broadcast Pattern

```typescript
// Broadcast configuration change to all windows
await parley.broadcast('theme-change', {
  theme: 'dark',
  timestamp: Date.now()
});

// All connected windows receive the message
```

For state synchronization across windows using broadcast, see [State Synchronization Pattern](../patterns/state-synchronization.md).

### Selective Broadcasting

```typescript
// Send to specific subset of windows
const widgetIds = ['widget-1', 'widget-2']; // Not widget-3

for (const targetId of widgetIds) {
  await parley.send('update', { data: 'value' }, {
    targetId,
    expectsResponse: false
  });
}
```

### Broadcast with Acknowledgment

```typescript
// Send to all and collect responses
const results = [];

for (const targetId of ['widget-1', 'widget-2', 'widget-3']) {
  try {
    const response = await parley.send('query', { type: 'status' }, {
      targetId,
      timeout: 5000
    });
    results.push({ targetId, ...response });
  } catch (error) {
    console.error(`${targetId} failed:`, error);
  }
}

console.log('All responses:', results);
```

For error handling strategies when collecting responses, see [Error Handling Pattern](../patterns/error-handling.md#timeout-errors).

---

## Hub-and-Spoke Pattern

Main window acts as central hub coordinating all child windows. For ParleyJS architectural patterns, see [Architecture Guide](../ARCHITECTURE.md).

### Hub (Main Window)

```typescript
const parley = Parley.create({
  allowedOrigins: ['https://child.example.com']
});

// Track connected windows
const connectedWindows = new Map();

// Connect multiple windows
async function connectWindow(window, id) {
  await parley.connect(window, id);
  connectedWindows.set(id, { window, status: 'connected' });

  console.log(`Connected to ${id}. Total: ${connectedWindows.size}`);
}

// Handle messages from any child
parley.on('child-message', (payload, respond, metadata) => {
  console.log(`Message from ${metadata.targetId}:`, payload);

  // Forward to other children if needed
  for (const [targetId, info] of connectedWindows) {
    if (targetId !== metadata.targetId) {
      parley.send('forwarded-message', {
        from: metadata.targetId,
        data: payload
      }, {
        targetId,
        expectsResponse: false
      });
    }
  }

  respond({ received: true });
});

// Broadcast to all children
async function broadcastToAll(type, data) {
  const promises = [];

  for (const targetId of connectedWindows.keys()) {
    promises.push(
      parley.send(type, data, {
        targetId,
        expectsResponse: false
      })
    );
  }

  await Promise.all(promises);
}
```

### Spoke (Child Windows)

```typescript
const parley = Parley.create({
  allowedOrigins: ['https://main.example.com']
});

// Connect to hub
await parley.connect(window.parent, 'hub');

// Send message to hub
await parley.send('child-message', {
  event: 'user-action',
  data: { action: 'click' }
}, {
  targetId: 'hub'
});

// Receive broadcasts from hub
parley.on('forwarded-message', (payload) => {
  console.log(`Message from ${payload.from}:`, payload.data);
});
```

For request-response messaging patterns in hub-and-spoke architecture, see [Request-Response Pattern](../patterns/request-response.md).

---

## Peer-to-Peer Communication

Enable direct communication between child windows through hub.

### Hub Routing Messages

```typescript
// Hub routes messages between children
parley.on('send-to-peer', async (payload, respond, metadata) => {
  const { targetPeer, message } = payload;

  try {
    const response = await parley.send('peer-message', {
      from: metadata.targetId,
      message
    }, {
      targetId: targetPeer,
      timeout: 5000
    });

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
  const response = await parley.send('send-to-peer', {
    targetPeer: peerId,
    message
  }, {
    targetId: 'hub'
  });

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

### Main Window (Hub)

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

const parley = Parley.create({
  allowedOrigins: [window.location.origin]
});

// Track windows
const windows = new Map();

// Setup iframe 1
const iframe1 = document.querySelector('#iframe-1');
iframe1.addEventListener('load', async () => {
  await parley.connect(iframe1.contentWindow, 'iframe-1');
  windows.set('iframe-1', iframe1);
  console.log('Connected: iframe-1');
});

// Setup iframe 2
const iframe2 = document.querySelector('#iframe-2');
iframe2.addEventListener('load', async () => {
  await parley.connect(iframe2.contentWindow, 'iframe-2');
  windows.set('iframe-2', iframe2);
  console.log('Connected: iframe-2');
});

// Setup popup
document.getElementById('open-popup').addEventListener('click', async () => {
  const popup = window.open('/popup.html', 'popup', 'width=400,height=300');

  await new Promise(resolve => {
    popup.addEventListener('load', resolve, { once: true });
  });

  await parley.connect(popup, 'popup');
  windows.set('popup', popup);
  console.log('Connected: popup');
});

// Handle messages from children
parley.on('broadcast-request', async (payload, respond, metadata) => {
  // Child wants to broadcast to all others
  for (const [targetId, window] of windows) {
    if (targetId !== metadata.targetId) {
      await parley.send('broadcast-message', {
        from: metadata.targetId,
        ...payload
      }, {
        targetId,
        expectsResponse: false
      });
    }
  }

  respond({ broadcasted: windows.size - 1 });
});

// Broadcast button
document.getElementById('broadcast-all').addEventListener('click', async () => {
  await parley.broadcast('hub-broadcast', {
    message: 'Hello from hub!',
    timestamp: Date.now()
  });
});

// Monitor connections
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
  updateConnectionStatus();
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
  windows.delete(event.targetId);
  updateConnectionStatus();
});

function updateConnectionStatus() {
  document.getElementById('status').textContent =
    `Connected windows: ${windows.size}`;
}
```

### Child Window (Iframe/Popup)

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
  allowedOrigins: [window.location.origin]
});

// Connect to hub
const parent = window.opener || window.parent;
await parley.connect(parent, 'hub');

// Receive broadcasts from hub
parley.on('hub-broadcast', (payload) => {
  console.log('Hub broadcast:', payload.message);
  displayMessage(`Hub: ${payload.message}`);
});

// Receive broadcasts from peers
parley.on('broadcast-message', (payload) => {
  console.log(`Message from ${payload.from}:`, payload);
  displayMessage(`${payload.from}: ${payload.message || 'ping'}`);
});

// Broadcast to all button
document.getElementById('broadcast').addEventListener('click', async () => {
  const response = await parley.send('broadcast-request', {
    message: 'Hello from ' + window.name
  }, {
    targetId: 'hub'
  });

  console.log(`Broadcasted to ${response.broadcasted} windows`);
});

function displayMessage(text) {
  const div = document.createElement('div');
  div.textContent = text;
  document.getElementById('messages').appendChild(div);
}
```

For complete working examples, see [examples/](../../examples/). For system event monitoring in multi-window scenarios, see [System Events documentation](../api-reference/system-events.md).

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
- [Testing Patterns](../TESTING_PATTERNS.md) - Unit and integration testing strategies

**Back to**: [Use Case Guides](./README.md) | [Documentation Home](../../README.md)
