[Home](../../README.md) > [Documentation](../FRAMEWORK_REFERENCE.md) > [Guides](./README.md) > Popup Window Communication

# Popup Window Communication Guide

Complete guide to parent and popup window communication using ParleyJS.

## Table of Contents

1. [Overview](#overview)
2. [Basic Setup](#basic-setup)
3. [Common Patterns](#common-patterns)
4. [Handling Popup Lifecycle](#handling-popup-lifecycle)
5. [Troubleshooting](#troubleshooting)
6. [Complete Example](#complete-example)

---

## Overview

Popup windows (opened with `window.open()`) enable scenarios like OAuth flows, payment gateways, and secondary views. ParleyJS handles the complexity of popup communication including window references and lifecycle management.

**Use cases**:
- OAuth/SSO authentication
- Payment processing
- File selection dialogs
- Settings/preferences windows
- Print preview windows

---

## Basic Setup

### Main Window (Opener)

```typescript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
  allowedOrigins: [window.location.origin] // Same origin for popup
});

// Open popup
const popup = window.open(
  '/popup.html',
  'myPopup',
  'width=600,height=400,left=100,top=100'
);

if (!popup) {
  console.error('Popup blocked!');
  return;
}

// Wait for popup to load, then connect
popup.addEventListener('load', async () => {
  await parley.connect(popup, 'popup');

  // Send message to popup
  const result = await parley.send('init', { userId: '123' }, {
    targetId: 'popup'
  });
});
```

### Popup Window

```typescript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
  allowedOrigins: [window.location.origin]
});

// Register handlers
parley.on('init', (payload, respond) => {
  console.log('Initialized with user:', payload.userId);
  respond({ status: 'ready' });
});

// Connect to opener
if (window.opener) {
  await parley.connect(window.opener, 'opener');

  // Signal ready
  await parley.send('popup-ready', {}, {
    targetId: 'opener',
    expectsResponse: false
  });
}
```

---

## Common Patterns

### Pattern: OAuth Flow

Complete OAuth authentication flow with popup.

**Main Window**:
```typescript
async function authenticateWithOAuth() {
  const parley = Parley.create({
    allowedOrigins: [window.location.origin]
  });

  // Open OAuth popup
  const popup = window.open(
    '/auth/oauth',
    'oauth',
    'width=500,height=600,left=100,top=100'
  );

  if (!popup) {
    throw new Error('Popup blocked');
  }

  // Wait for authentication result
  return new Promise((resolve, reject) => {
    parley.on('auth-success', (payload) => {
      resolve(payload.token);
      popup.close();
    });

    parley.on('auth-failed', (payload) => {
      reject(new Error(payload.error));
      popup.close();
    });

    // Connect when popup loads
    popup.addEventListener('load', async () => {
      await parley.connect(popup, 'oauth-popup');
    });
  });
}

// Usage
try {
  const token = await authenticateWithOAuth();
  console.log('Authenticated:', token);
} catch (error) {
  console.error('Auth failed:', error);
}
```

**OAuth Popup**:
```typescript
const parley = Parley.create({
  allowedOrigins: [window.location.origin]
});

// Connect to opener
await parley.connect(window.opener, 'main');

// Handle OAuth callback
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
  // Exchange code for token
  try {
    const token = await exchangeCodeForToken(code);

    // Send success to main window
    await parley.send('auth-success', { token }, {
      targetId: 'main',
      expectsResponse: false
    });
  } catch (error) {
    // Send failure to main window
    await parley.send('auth-failed', { error: error.message }, {
      targetId: 'main',
      expectsResponse: false
    });
  }
}
```

### Pattern: Payment Processing

Handle payment flow in popup.

**Main Window**:
```typescript
async function processPayment(amount: number, currency: string) {
  const parley = Parley.create({
    allowedOrigins: [window.location.origin]
  });

  const popup = window.open(
    '/payment',
    'payment',
    'width=400,height=500'
  );

  if (!popup) {
    throw new Error('Popup blocked');
  }

  return new Promise((resolve, reject) => {
    parley.on('payment-complete', (payload) => {
      resolve(payload.transaction);
      popup.close();
    });

    parley.on('payment-cancelled', () => {
      reject(new Error('Payment cancelled'));
      popup.close();
    });

    popup.addEventListener('load', async () => {
      await parley.connect(popup, 'payment-popup');

      // Send payment details
      await parley.send('init-payment', { amount, currency }, {
        targetId: 'payment-popup',
        expectsResponse: false
      });
    });
  });
}
```

### Pattern: File Selection

Use popup for file selection with preview.

**Main Window**:
```typescript
async function selectFile() {
  const parley = Parley.create({
    allowedOrigins: [window.location.origin]
  });

  const popup = window.open(
    '/file-selector',
    'files',
    'width=800,height=600'
  );

  if (!popup) {
    throw new Error('Popup blocked');
  }

  return new Promise((resolve, reject) => {
    parley.on('file-selected', (payload) => {
      resolve(payload.file);
      popup.close();
    });

    parley.on('selection-cancelled', () => {
      reject(new Error('Selection cancelled'));
      popup.close();
    });

    popup.addEventListener('load', async () => {
      await parley.connect(popup, 'file-popup');
    });
  });
}
```

---

## Handling Popup Lifecycle

### Detecting Popup Close

```typescript
// Check if popup was closed by user
const checkInterval = setInterval(() => {
  if (popup.closed) {
    clearInterval(checkInterval);
    console.log('Popup was closed');
    cleanup();
  }
}, 1000);

function cleanup() {
  parley.disconnect('popup');
}
```

### Preventing Popup Blockers

```typescript
// Open popup in response to user action
document.getElementById('open-popup')?.addEventListener('click', () => {
  // This will NOT be blocked
  const popup = window.open('/popup.html', '_blank');
});

// Opening popup programmatically might be blocked
setTimeout(() => {
  // This MAY be blocked
  const popup = window.open('/popup.html', '_blank');
}, 1000);
```

### Closing Popup from Main Window

```typescript
// Send close command to popup
await parley.send('close', {}, {
  targetId: 'popup',
  expectsResponse: false
});

// Or close directly
popup.close();
```

**Popup handles close**:
```typescript
parley.on('close', () => {
  // Cleanup before closing
  cleanup();
  window.close();
});
```

### Handling Popup Navigation

```typescript
// Main window detects when popup navigates
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
  if (event.targetId === 'popup') {
    console.log('Popup disconnected (navigated or closed)');

    // Reconnect if popup still open
    if (!popup.closed) {
      popup.addEventListener('load', async () => {
        await parley.connect(popup, 'popup');
      }, { once: true });
    }
  }
});
```

---

## Troubleshooting

### Popup Blocked

**Problem**: `window.open()` returns `null`

**Solutions**:
1. Only open popups in response to user action
2. Inform user to allow popups
3. Provide fallback UI

```typescript
const popup = window.open('/popup.html', '_blank');

if (!popup) {
  // Show message to user
  showNotification('Please allow popups for this site');

  // Provide alternative
  showInlineModal(); // Show content in modal instead
}
```

### Connection Timeout

**Problem**: Popup doesn't connect

**Solutions**:
1. Wait for popup load event
2. Add longer timeout
3. Retry connection

```typescript
// Wait for load
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error('Popup load timeout'));
  }, 10000);

  popup.addEventListener('load', () => {
    clearTimeout(timeout);
    resolve();
  }, { once: true });
});

await parley.connect(popup, 'popup');
```

### Popup Closed Unexpectedly

**Problem**: User closes popup before completing flow

**Solution**: Detect and handle closure

```typescript
let flowCompleted = false;

parley.on('flow-complete', () => {
  flowCompleted = true;
});

// Check for unexpected close
const interval = setInterval(() => {
  if (popup.closed) {
    clearInterval(interval);

    if (!flowCompleted) {
      console.log('Popup closed before completion');
      handleIncompleteFlow();
    }
  }
}, 500);
```

For more troubleshooting, see [Troubleshooting Guide](../TROUBLESHOOTING.md).

---

## Complete Example

### Main Window
```html
<!DOCTYPE html>
<html>
<head>
  <title>Main Window</title>
</head>
<body>
  <h1>Main Window</h1>
  <button id="open-popup">Open Popup</button>
  <div id="result"></div>

  <script type="module">
    import { Parley, SYSTEM_EVENTS } from 'parley-js';

    const parley = Parley.create({
      allowedOrigins: [window.location.origin]
    });

    let popup;

    document.getElementById('open-popup').addEventListener('click', async () => {
      popup = window.open(
        '/popup.html',
        'myPopup',
        'width=400,height=300,left=200,top=200'
      );

      if (!popup) {
        alert('Popup blocked! Please allow popups.');
        return;
      }

      // Wait for popup to load
      await new Promise(resolve => {
        popup.addEventListener('load', resolve, { once: true });
      });

      // Connect
      await parley.connect(popup, 'popup');

      // Listen for result
      parley.on('popup-result', (payload) => {
        document.getElementById('result').textContent =
          `Result: ${payload.value}`;
        popup.close();
      });

      // Send initial data
      await parley.send('init', { message: 'Hello from main!' }, {
        targetId: 'popup',
        expectsResponse: false
      });
    });
  </script>
</body>
</html>
```

### Popup Window
```html
<!DOCTYPE html>
<html>
<head>
  <title>Popup Window</title>
</head>
<body>
  <h1>Popup Window</h1>
  <button id="send-result">Send Result</button>

  <script type="module">
    import { Parley } from 'parley-js';

    const parley = Parley.create({
      allowedOrigins: [window.location.origin]
    });

    // Connect to opener
    if (window.opener) {
      await parley.connect(window.opener, 'main');

      // Handle init
      parley.on('init', (payload) => {
        console.log('Received:', payload.message);
      });

      // Send result button
      document.getElementById('send-result').addEventListener('click', async () => {
        await parley.send('popup-result', {
          value: 'Success!'
        }, {
          targetId: 'main',
          expectsResponse: false
        });

        // Close popup after sending
        setTimeout(() => window.close(), 500);
      });
    }
  </script>
</body>
</html>
```

For complete working examples, see [examples/window-to-window/](../../examples/window-to-window/).

---

## Navigation

### Related Guides

- [iFrame Communication](./iframe-communication.md) - iframes
- [Multi-Window Communication](./multi-window-communication.md) - Multiple windows
- [Authentication Flows](./authentication-flows.md) - OAuth/SSO

### Related Documentation

- [API Reference](../API.md) - Complete API docs
- [Code Patterns](../CODE_PATTERNS.md) - Common patterns
- [Troubleshooting](../TROUBLESHOOTING.md) - Common issues

**Back to**: [Use Case Guides](./README.md) | [Documentation Home](../../README.md)
