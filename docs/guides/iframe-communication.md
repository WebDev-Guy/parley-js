[Home](../../README.md) > [Documentation](../FRAMEWORK_REFERENCE.md) > [Guides](./README.md) > iFrame Communication

# iFrame Communication Guide

Complete guide to embedding and communicating with iframes using ParleyJS.

## Table of Contents

1. [Overview](#overview)
2. [Basic Setup](#basic-setup)
3. [Common Patterns](#common-patterns)
4. [Security Considerations](#security-considerations)
5. [Troubleshooting](#troubleshooting)
6. [Complete Example](#complete-example)

---

## Overview

iFrames are one of the most common use cases for postMessage communication. ParleyJS simplifies iframe communication by handling connection management, origin validation, and request-response patterns.

**Use cases**:
- Embedding third-party widgets
- Sandboxed components
- Cross-origin content
- Micro-frontend integration

---

## Basic Setup

### Parent Window (Host)

```typescript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
  allowedOrigins: ['https://child-iframe.example.com']
});

// Get iframe element
const iframe = document.querySelector<HTMLIFrameElement>('#my-iframe');

// Wait for iframe to load
iframe?.addEventListener('load', async () => {
  // Connect to iframe
  await parley.connect(iframe.contentWindow!, 'child');

  // Now you can send messages
  const response = await parley.send('hello', { name: 'Parent' }, {
    targetId: 'child'
  });

  console.log('Child responded:', response);
});
```

### Child Window (iFrame)

```typescript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
  allowedOrigins: ['https://parent.example.com']
});

// Register message handler
parley.on('hello', (payload, respond) => {
  console.log('Received from parent:', payload.name);
  respond({ message: 'Hello from child!' });
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

---

## Common Patterns

### Pattern: Configuration on Load

Send configuration to iframe when it loads.

**Parent**:
```typescript
iframe.addEventListener('load', async () => {
  await parley.connect(iframe.contentWindow!, 'child');

  // Send initial configuration
  await parley.send('configure', {
    theme: 'dark',
    apiKey: 'abc123',
    userId: 'user-456'
  }, {
    targetId: 'child',
    expectsResponse: false
  });
});
```

**Child**:
```typescript
parley.on('configure', (config) => {
  // Apply configuration
  setTheme(config.theme);
  initializeAPI(config.apiKey);
  loadUserData(config.userId);
});

await parley.connect(window.parent, 'parent');
```

### Pattern: Ready Signal

Child signals when fully initialized.

**Child**:
```typescript
// Connect to parent
await parley.connect(window.parent, 'parent');

// Do initialization
await initialize();

// Signal ready
await parley.send('ready', { version: '1.0.0' }, {
  targetId: 'parent',
  expectsResponse: false
});
```

**Parent**:
```typescript
parley.on('ready', (payload) => {
  console.log('Child is ready, version:', payload.version);
  // Now safe to send messages
});
```

### Pattern: Data Fetching

Parent fetches data through iframe.

**Parent**:
```typescript
async function getUserData(userId: string) {
  const response = await parley.send('get-user', { userId }, {
    targetId: 'child',
    timeout: 10000
  });

  if (response.success) {
    return response.user;
  } else {
    throw new Error(response.error);
  }
}
```

**Child**:
```typescript
parley.on('get-user', async (payload, respond) => {
  try {
    const user = await api.fetchUser(payload.userId);
    respond({ success: true, user });
  } catch (error) {
    respond({ success: false, error: error.message });
  }
});
```

### Pattern: Event Forwarding

Forward UI events from iframe to parent.

**Child**:
```typescript
// Forward button clicks to parent
document.querySelector('#my-button')?.addEventListener('click', () => {
  parley.send('button-clicked', {
    buttonId: 'my-button',
    timestamp: Date.now()
  }, {
    targetId: 'parent',
    expectsResponse: false
  });
});
```

**Parent**:
```typescript
parley.on('button-clicked', (payload) => {
  console.log('Button clicked in iframe:', payload.buttonId);
  trackEvent('iframe_button_click', payload);
});
```

### Pattern: Resizing iframe

Iframe reports height changes to parent.

**Child**:
```typescript
// Observe content height changes
const resizeObserver = new ResizeObserver((entries) => {
  const height = entries[0].contentRect.height;

  parley.send('resize', { height }, {
    targetId: 'parent',
    expectsResponse: false
  });
});

resizeObserver.observe(document.body);
```

**Parent**:
```typescript
parley.on('resize', (payload) => {
  iframe.style.height = `${payload.height}px`;
});
```

---

## Security Considerations

### Always Validate Origins

```typescript
// Wrong - accepts any origin
const parley = Parley.create({
  allowedOrigins: ['*'] // DANGEROUS!
});

// Correct - specific origin
const parley = Parley.create({
  allowedOrigins: ['https://trusted-iframe.example.com']
});
```

### Use HTTPS in Production

```typescript
// Development
const parley = Parley.create({
  allowedOrigins: ['http://localhost:3000']
});

// Production
const parley = Parley.create({
  allowedOrigins: ['https://iframe.example.com']
});
```

### Don't Send Sensitive Data

```typescript
// Wrong - sending sensitive data
await parley.send('auth', {
  password: 'secret123' // Don't send passwords!
}, { targetId: 'child' });

// Correct - send tokens or session IDs
await parley.send('auth', {
  sessionToken: 'token-abc-123' // OK
}, { targetId: 'child' });
```

### Validate iframe Content

```typescript
// Verify iframe loads expected content
iframe.addEventListener('load', () => {
  try {
    // Check iframe origin (same-origin only)
    const iframeOrigin = iframe.contentWindow?.location.origin;
    if (iframeOrigin !== expectedOrigin) {
      console.error('Unexpected iframe origin!');
      return;
    }
  } catch (e) {
    // Cross-origin iframe - this is expected
  }

  // Proceed with connection
  parley.connect(iframe.contentWindow!, 'child');
});
```

For more security guidance, see [Security Guide](../SECURITY.md).

---

## Troubleshooting

### iframe Not Connecting

**Problem**: Connection times out

**Solutions**:
1. Wait for iframe load event
2. Check that both parent and child call `connect()`
3. Verify origins match exactly
4. Check browser console for errors

```typescript
// Debugging
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
  console.log('Connected to:', event.targetId);
});

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
  console.error('Connection error:', event.error);
});
```

### Messages Not Received

**Problem**: Handler not called

**Solutions**:
1. Register handlers before sending messages
2. Verify message type strings match exactly
3. Enable debug mode to see message flow

```typescript
const parley = Parley.create({
  allowedOrigins: ['https://child.com'],
  debug: true // See all messages in console
});
```

### iframe Crashes or Reloads

**Problem**: Connection lost when iframe navigates

**Solution**: Detect disconnection and reconnect

```typescript
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, async (event) => {
  console.log('iframe disconnected:', event.targetId);

  // Wait for reload
  await new Promise(resolve => {
    iframe.addEventListener('load', resolve, { once: true });
  });

  // Reconnect
  await parley.connect(iframe.contentWindow!, 'child');
});
```

For more troubleshooting, see [Troubleshooting Guide](../TROUBLESHOOTING.md).

---

## Complete Example

### Parent HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>Parent Window</title>
</head>
<body>
  <h1>Parent Window</h1>
  <iframe
    id="child-iframe"
    src="https://child.example.com/iframe.html"
    width="600"
    height="400"
  ></iframe>

  <script type="module">
    import { Parley, SYSTEM_EVENTS } from 'parley-js';

    const parley = Parley.create({
      allowedOrigins: ['https://child.example.com']
    });

    const iframe = document.getElementById('child-iframe');

    iframe.addEventListener('load', async () => {
      // Connect to iframe
      await parley.connect(iframe.contentWindow, 'child');

      // Register handlers
      parley.on('iframe-ready', (payload) => {
        console.log('iframe ready:', payload);
      });

      // Send initial data
      await parley.send('config', {
        theme: 'dark',
        userId: 'user-123'
      }, {
        targetId: 'child',
        expectsResponse: false
      });

      // Request data
      const user = await parley.send('get-user', { id: '123' }, {
        targetId: 'child'
      });
      console.log('User data:', user);
    });
  </script>
</body>
</html>
```

### Child HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>Child iFrame</title>
</head>
<body>
  <h1>Child iFrame</h1>

  <script type="module">
    import { Parley } from 'parley-js';

    const parley = Parley.create({
      allowedOrigins: ['https://parent.example.com']
    });

    // Register handlers
    parley.on('config', (payload) => {
      console.log('Received config:', payload);
      applyTheme(payload.theme);
      loadUser(payload.userId);
    });

    parley.on('get-user', async (payload, respond) => {
      const user = await fetchUser(payload.id);
      respond(user);
    });

    // Connect to parent
    await parley.connect(window.parent, 'parent');

    // Signal ready
    await parley.send('iframe-ready', {
      version: '1.0.0'
    }, {
      targetId: 'parent',
      expectsResponse: false
    });

    // Helper functions
    function applyTheme(theme) {
      document.body.className = theme;
    }

    function loadUser(userId) {
      console.log('Loading user:', userId);
    }

    async function fetchUser(id) {
      // Simulate API call
      return {
        id,
        name: 'John Doe',
        email: 'john@example.com'
      };
    }
  </script>
</body>
</html>
```

For complete working examples, see [examples/basic/](../../examples/basic/).

---

## Navigation

### Related Guides

- [Popup Communication](./popup-communication.md) - Parent and popup windows
- [Web Worker Communication](./worker-communication.md) - Workers
- [Multi-Window Communication](./multi-window-communication.md) - Multiple windows

### Related Documentation

- [API Reference](../API.md) - Complete API docs
- [Code Patterns](../CODE_PATTERNS.md) - Common patterns
- [Security Guide](../SECURITY.md) - Security best practices

**Back to**: [Use Case Guides](./README.md) | [Documentation Home](../../README.md)
