[Home](../../index.md) > [Guides](./index.md) > Popup Window Communication

# Popup Window Communication Guide

This guide shows you how to implement secure communication between parent
windows and popup windows using ParleyJS for OAuth flows, payment processing,
and dialog windows.

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

Popup windows opened with window.open() enable scenarios like OAuth
authentication, payment processing, file selection dialogs, and settings
windows. ParleyJS handles the complexity of popup communication including window
references, lifecycle management, and message routing.

Common use cases include OAuth/SSO authentication flows, payment gateway
integrations, file selection dialogs, settings windows, and print preview
windows.

## Prerequisites

Before starting this guide:

- Complete [Your First ParleyJS Example](../getting-started/first-example.md)
- Understand [Core Concepts](../getting-started/concepts.md)
- Basic knowledge of window.open() and popup windows
- Local web server (ParleyJS requires HTTP/HTTPS, not file://)

If you need help with setup, see
[Installation](../getting-started/installation.md).

## Basic Setup

The simplest popup communication setup requires a main window that opens a popup
and establishes communication.

### Minimal Main Window Setup

```javascript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
    allowedOrigins: [window.location.origin],
});

// Open popup window
const popup = window.open(
    '/popup.html',
    'myPopup',
    'width=600,height=400,left=100,top=100'
);

if (!popup) {
    console.error('Popup blocked');
    return;
}

// Wait for popup to load, then connect
popup.addEventListener('load', async () => {
    await parley.connect(popup, 'popup');
    console.log('Connected to popup');
});
```

### Minimal Popup Window Setup

```javascript
import { Parley } from 'parley-js';

// Create Parley instance
const parley = Parley.create({
    allowedOrigins: [window.location.origin],
});

// Connect to opener window
if (window.opener) {
    await parley.connect(window.opener, 'opener');
    console.log('Connected to opener');
}
```

This basic setup establishes a secure communication channel between the main
window and popup.

## Step-by-Step Implementation

Follow these steps to implement complete popup communication for an OAuth flow.

### Step 1: Create the Main Window

Create `main.html` that opens the OAuth popup:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Main Window</title>
    </head>
    <body>
        <h1>OAuth Login Example</h1>
        <button id="login-btn">Login with OAuth</button>
        <div id="status">Not logged in</div>
        <div id="user-info"></div>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                allowedOrigins: [window.location.origin],
            });

            let oauthPopup = null;

            // Handle login button click
            document
                .getElementById('login-btn')
                .addEventListener('click', async () => {
                    document.getElementById('status').textContent =
                        'Opening login window...';

                    // Open OAuth popup
                    oauthPopup = window.open(
                        '/oauth.html',
                        'oauth-login',
                        'width=500,height=600,left=200,top=100'
                    );

                    if (!oauthPopup) {
                        alert(
                            'Popup blocked. Please allow popups for this site.'
                        );
                        document.getElementById('status').textContent =
                            'Login failed';
                        return;
                    }

                    // Wait for popup to load
                    await new Promise((resolve) => {
                        oauthPopup.addEventListener('load', resolve, {
                            once: true,
                        });
                    });

                    // Connect to popup
                    try {
                        await parley.connect(oauthPopup, 'oauth-popup');
                        document.getElementById('status').textContent =
                            'Waiting for authentication...';
                    } catch (error) {
                        console.error('Failed to connect to popup:', error);
                        document.getElementById('status').textContent =
                            'Connection failed';
                    }
                });

            // Handle authentication success
            parley.on('auth:success', (payload, respond) => {
                console.log('Authentication successful:', payload);

                document.getElementById('status').textContent = 'Logged in';
                document.getElementById('user-info').textContent =
                    `Welcome, ${payload.user.name}!`;

                // Close the popup
                if (oauthPopup && !oauthPopup.closed) {
                    oauthPopup.close();
                }

                respond({ received: true });
            });

            // Handle authentication failure
            parley.on('auth:failed', (payload, respond) => {
                console.error('Authentication failed:', payload.error);

                document.getElementById('status').textContent = 'Login failed';

                // Close the popup
                if (oauthPopup && !oauthPopup.closed) {
                    oauthPopup.close();
                }

                respond({ received: true });
            });

            // Monitor if user closes popup manually
            setInterval(() => {
                if (oauthPopup && oauthPopup.closed) {
                    const statusEl = document.getElementById('status');
                    if (
                        statusEl.textContent === 'Waiting for authentication...'
                    ) {
                        statusEl.textContent = 'Login cancelled';
                    }
                    oauthPopup = null;
                }
            }, 1000);
        </script>
    </body>
</html>
```

### Step 2: Create the Popup Window

Create `oauth.html` for the OAuth flow:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>OAuth Login</title>
    </head>
    <body>
        <h2>OAuth Login</h2>
        <div id="status">Connecting...</div>
        <button id="simulate-success">Simulate Successful Login</button>
        <button id="simulate-failure">Simulate Failed Login</button>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                allowedOrigins: [window.location.origin],
            });

            // Connect to opener window
            if (!window.opener) {
                document.getElementById('status').textContent =
                    'Error: No opener window';
            } else {
                try {
                    await parley.connect(window.opener, 'main');
                    document.getElementById('status').textContent =
                        'Connected to main window';
                } catch (error) {
                    console.error('Failed to connect:', error);
                    document.getElementById('status').textContent =
                        'Connection failed';
                }
            }

            // Simulate successful OAuth login
            document
                .getElementById('simulate-success')
                .addEventListener('click', async () => {
                    const userData = {
                        user: {
                            id: '12345',
                            name: 'John Doe',
                            email: 'john@example.com',
                        },
                        token: 'fake-oauth-token-abc123',
                    };

                    await parley.send('auth:success', userData, {
                        targetId: 'main',
                        expectsResponse: false,
                    });

                    document.getElementById('status').textContent =
                        'Success sent. Closing...';
                    setTimeout(() => window.close(), 1000);
                });

            // Simulate failed OAuth login
            document
                .getElementById('simulate-failure')
                .addEventListener('click', async () => {
                    await parley.send(
                        'auth:failed',
                        {
                            error: 'User denied authorization',
                        },
                        {
                            targetId: 'main',
                            expectsResponse: false,
                        }
                    );

                    document.getElementById('status').textContent =
                        'Failure sent. Closing...';
                    setTimeout(() => window.close(), 1000);
                });

            // In real OAuth flow, handle OAuth callback
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');

            if (code) {
                // Exchange authorization code for token
                exchangeCodeForToken(code);
            }

            async function exchangeCodeForToken(code) {
                try {
                    const response = await fetch('/api/oauth/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code }),
                    });

                    const data = await response.json();

                    await parley.send('auth:success', data, {
                        targetId: 'main',
                        expectsResponse: false,
                    });

                    window.close();
                } catch (error) {
                    await parley.send(
                        'auth:failed',
                        {
                            error: error.message,
                        },
                        {
                            targetId: 'main',
                            expectsResponse: false,
                        }
                    );

                    window.close();
                }
            }
        </script>
    </body>
</html>
```

### Step 3: Add Error Handling

Implement robust error handling for popup flows:

```javascript
// Main window: Handle popup blocking
const popup = window.open('/popup.html', 'popup', 'width=500,height=600');

if (!popup) {
    // Popup was blocked
    showNotification('Please allow popups for this site');
    // Provide fallback: show inline modal instead
    showInlineAuthModal();
    return;
}

// Main window: Handle connection timeout
try {
    await Promise.race([
        parley.connect(popup, 'popup'),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
    ]);
} catch (error) {
    console.error('Connection failed:', error.message);
    popup.close();
}

// Popup: Handle disconnection
parley.onSystem(Parley.SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from main window');
    // Main window may have closed or navigated
    window.close();
});
```

### Step 4: Monitor Popup Lifecycle

Track popup state and handle unexpected closure:

```javascript
let flowCompleted = false;

parley.on('auth:success', (payload) => {
    flowCompleted = true;
    // Handle success
});

parley.on('auth:failed', (payload) => {
    flowCompleted = true;
    // Handle failure
});

// Check if user closed popup before completing flow
const checkInterval = setInterval(() => {
    if (popup.closed) {
        clearInterval(checkInterval);

        if (!flowCompleted) {
            console.log('Popup closed before completion');
            document.getElementById('status').textContent = 'Login cancelled';
        }
    }
}, 500);
```

## Complete Code Example

This example demonstrates a complete payment processing flow using popup
communication.

### Main Window (payment-page.html)

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Payment Page</title>
    </head>
    <body>
        <h1>Checkout</h1>
        <div id="cart">
            <h2>Your Cart</h2>
            <p>Total: $99.99</p>
            <button id="checkout-btn">Proceed to Payment</button>
        </div>
        <div id="status"></div>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                allowedOrigins: [window.location.origin],
            });

            let paymentPopup = null;

            document
                .getElementById('checkout-btn')
                .addEventListener('click', async () => {
                    const amount = 9999; // cents
                    const currency = 'USD';

                    document.getElementById('status').textContent =
                        'Opening payment window...';

                    // Open payment popup
                    paymentPopup = window.open(
                        '/payment.html',
                        'payment',
                        'width=500,height=600,left=200,top=100'
                    );

                    if (!paymentPopup) {
                        alert('Popup blocked. Please allow popups.');
                        document.getElementById('status').textContent = '';
                        return;
                    }

                    // Wait for popup to load
                    await new Promise((resolve) => {
                        paymentPopup.addEventListener('load', resolve, {
                            once: true,
                        });
                    });

                    // Connect to popup
                    try {
                        await parley.connect(paymentPopup, 'payment-popup');

                        // Send payment details
                        await parley.send(
                            'payment:init',
                            {
                                amount,
                                currency,
                                orderID: 'ORDER-12345',
                            },
                            {
                                targetId: 'payment-popup',
                                expectsResponse: false,
                            }
                        );

                        document.getElementById('status').textContent =
                            'Processing payment...';
                    } catch (error) {
                        console.error('Connection failed:', error);
                        document.getElementById('status').textContent =
                            'Payment failed';
                        paymentPopup.close();
                    }
                });

            // Handle payment success
            parley.on('payment:success', (payload, respond) => {
                console.log('Payment successful:', payload);

                document.getElementById('status').textContent =
                    'Payment successful!';
                document.getElementById('cart').innerHTML =
                    `<h2>Order Confirmed</h2><p>Transaction ID: ${payload.transactionID}</p>`;

                if (paymentPopup && !paymentPopup.closed) {
                    paymentPopup.close();
                }

                respond({ received: true });
            });

            // Handle payment failure
            parley.on('payment:failed', (payload, respond) => {
                console.error('Payment failed:', payload);

                document.getElementById('status').textContent =
                    `Payment failed: ${payload.error}`;

                if (paymentPopup && !paymentPopup.closed) {
                    paymentPopup.close();
                }

                respond({ received: true });
            });

            // Handle payment cancellation
            parley.on('payment:cancelled', (payload, respond) => {
                document.getElementById('status').textContent =
                    'Payment cancelled';

                if (paymentPopup && !paymentPopup.closed) {
                    paymentPopup.close();
                }

                respond({ received: true });
            });
        </script>
    </body>
</html>
```

### Popup Window (payment.html)

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Payment</title>
    </head>
    <body>
        <h2>Secure Payment</h2>
        <div id="payment-details"></div>
        <button id="pay-btn">Pay Now</button>
        <button id="cancel-btn">Cancel</button>

        <script type="module">
            import { Parley } from 'parley-js';

            const parley = Parley.create({
                allowedOrigins: [window.location.origin],
            });

            let paymentInfo = {};

            // Connect to opener
            if (window.opener) {
                await parley.connect(window.opener, 'main');

                // Handle payment initialization
                parley.on('payment:init', (payload, respond) => {
                    paymentInfo = payload;

                    document.getElementById('payment-details').innerHTML =
                        `<p>Amount: $${(payload.amount / 100).toFixed(2)} ${payload.currency}</p>
                     <p>Order: ${payload.orderID}</p>`;

                    respond({ ready: true });
                });
            }

            // Handle payment submission
            document
                .getElementById('pay-btn')
                .addEventListener('click', async () => {
                    try {
                        // Simulate payment processing
                        const result = await processPayment(paymentInfo);

                        await parley.send(
                            'payment:success',
                            {
                                transactionID: result.transactionID,
                                amount: paymentInfo.amount,
                                currency: paymentInfo.currency,
                            },
                            {
                                targetId: 'main',
                                expectsResponse: false,
                            }
                        );

                        setTimeout(() => window.close(), 1500);
                    } catch (error) {
                        await parley.send(
                            'payment:failed',
                            {
                                error: error.message,
                            },
                            {
                                targetId: 'main',
                                expectsResponse: false,
                            }
                        );

                        setTimeout(() => window.close(), 1500);
                    }
                });

            // Handle cancellation
            document
                .getElementById('cancel-btn')
                .addEventListener('click', async () => {
                    await parley.send(
                        'payment:cancelled',
                        {},
                        {
                            targetId: 'main',
                            expectsResponse: false,
                        }
                    );

                    window.close();
                });

            async function processPayment(info) {
                // Simulate payment API call
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve({
                            transactionID:
                                'TXN-' +
                                Math.random().toString(36).substring(7),
                        });
                    }, 2000);
                });
            }
        </script>
    </body>
</html>
```

## Explanation

### Connection Flow

1. Main window opens popup using window.open() with dimensions and position.
2. Both windows create Parley instances with matching allowed origins.
3. Main window waits for popup load event.
4. Main window calls connect() with popup window reference and target ID.
5. Popup window calls connect() with window.opener reference.
6. Handshake completes and both sides can exchange messages.

The popup window is referenced via the return value of window.open() in the main
window. The main window is referenced via window.opener in the popup.

### Origin Validation

For same-origin popups, use window.location.origin in both windows. For
cross-origin popups (rare), specify exact origins in allowedOrigins. Most popup
scenarios use same-origin communication.

For complete origin validation for popups, see
[Origin Validation](../security/origin-validation.md). For troubleshooting
origin errors, see
[Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Popup Lifecycle Management

Unlike iframes, popups can be closed by the user at any time. Monitor
popup.closed property to detect unexpected closure. Always clean up resources
when the popup closes.

The popup can close itself using window.close(). The main window can close the
popup using popup.close(). For detecting closed popups and cleanup strategies,
see
[Dead Window References](../troubleshooting/common-errors.md#dead-window-references).
For preventing memory leaks when closing popups, see
[Memory Leaks](../troubleshooting/common-errors.md#memory-leaks).

### Preventing Popup Blockers

Browsers block popups opened outside of user interaction. Always open popups in
direct response to user actions (button clicks, etc). Opening popups in
setTimeout or async callbacks may be blocked.

## Common Mistakes

### Mistake 1: Opening Popup Outside User Interaction

**Problem**: Popup is blocked because it wasn't opened in response to user
action.

**Wrong**:

```javascript
// Opening popup in async callback or timeout
setTimeout(() => {
    const popup = window.open('/popup.html'); // Blocked!
}, 1000);
```

**Correct**:

```javascript
// Open popup in direct response to user action
button.addEventListener('click', () => {
    const popup = window.open('/popup.html'); // Not blocked
});
```

Always open popups immediately in event handlers, not in asynchronous callbacks.
For complete popup troubleshooting, see
[Cross-Origin Errors](../troubleshooting/common-errors.md#cross-origin-errors).

### Mistake 2: Not Checking if Popup Was Blocked

**Problem**: Code assumes popup opened successfully but it was blocked.

**Wrong**:

```javascript
const popup = window.open('/popup.html');
await parley.connect(popup, 'popup'); // Error if popup is null!
```

**Correct**:

```javascript
const popup = window.open('/popup.html');

if (!popup) {
    alert('Please allow popups for this site');
    return;
}

await parley.connect(popup, 'popup');
```

Always check if window.open() returned null (popup blocked).

### Mistake 3: Not Monitoring Popup Closure

**Problem**: User closes popup but main window doesn't detect it.

**Wrong**:

```javascript
const popup = window.open('/popup.html');
// No monitoring - don't know if user closed it
```

**Correct**:

```javascript
const popup = window.open('/popup.html');
let flowCompleted = false;

parley.on('flow:complete', () => {
    flowCompleted = true;
});

const interval = setInterval(() => {
    if (popup.closed) {
        clearInterval(interval);
        if (!flowCompleted) {
            console.log('User cancelled by closing popup');
            handleCancellation();
        }
    }
}, 500);
```

Monitor popup.closed property to detect unexpected closure.

### Mistake 4: Missing window.opener Check

**Problem**: Popup assumes it has an opener window but it might be opened
directly.

**Wrong**:

```javascript
// In popup
await parley.connect(window.opener, 'main'); // Error if no opener!
```

**Correct**:

```javascript
// In popup
if (!window.opener) {
    console.error('This page must be opened as a popup');
    return;
}

await parley.connect(window.opener, 'main');
```

Always check if window.opener exists before using it.

### Mistake 5: Not Handling Connection Timeout

**Problem**: Popup fails to load but connection attempt waits indefinitely.

**Wrong**:

```javascript
await parley.connect(popup, 'popup'); // May hang if popup fails to load
```

**Correct**:

```javascript
try {
    await Promise.race([
        parley.connect(popup, 'popup'),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
    ]);
} catch (error) {
    console.error('Failed to connect:', error.message);
    popup.close();
}
```

Add a timeout to connection attempts.

## Advanced Patterns

### OAuth Flow with Redirect

Handle OAuth provider redirect back to popup:

```javascript
// Main window: Start OAuth flow
async function startOAuthFlow(provider) {
    const popup = window.open(
        `/oauth/authorize?provider=${provider}`,
        'oauth',
        'width=500,height=600'
    );

    if (!popup) return Promise.reject(new Error('Popup blocked'));

    return new Promise((resolve, reject) => {
        parley.on('oauth:success', (payload) => {
            resolve(payload.token);
            popup.close();
        });

        parley.on('oauth:error', (payload) => {
            reject(new Error(payload.error));
            popup.close();
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            if (!popup.closed) {
                popup.close();
                reject(new Error('OAuth timeout'));
            }
        }, 300000);
    });
}

// Popup: Handle OAuth callback
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const error = urlParams.get('error');

if (code) {
    const token = await exchangeCodeForToken(code);
    await parley.send(
        'oauth:success',
        { token },
        {
            targetId: 'main',
            expectsResponse: false,
        }
    );
} else if (error) {
    await parley.send(
        'oauth:error',
        { error },
        {
            targetId: 'main',
            expectsResponse: false,
        }
    );
}
```

### File Selection Dialog

Implement file selection with preview in popup:

```javascript
// Main window: Open file selector
async function selectFile(options = {}) {
    const popup = window.open(
        `/file-selector?type=${options.type || 'any'}`,
        'file-select',
        'width=800,height=600'
    );

    if (!popup) return Promise.reject(new Error('Popup blocked'));

    return new Promise((resolve, reject) => {
        parley.on('file:selected', (payload) => {
            resolve(payload.file);
            popup.close();
        });

        parley.on('file:cancelled', () => {
            reject(new Error('Selection cancelled'));
            popup.close();
        });
    });
}

// Usage
try {
    const file = await selectFile({ type: 'image' });
    console.log('Selected file:', file);
} catch (error) {
    console.log('No file selected');
}
```

### Multi-Step Wizard in Popup

Coordinate multi-step flows with progress updates:

```javascript
// Popup: Send progress updates
async function completeWizard() {
    await parley.send(
        'wizard:step',
        { step: 1, total: 3 },
        {
            targetId: 'main',
            expectsResponse: false,
        }
    );

    await step1();

    await parley.send(
        'wizard:step',
        { step: 2, total: 3 },
        {
            targetId: 'main',
            expectsResponse: false,
        }
    );

    await step2();

    await parley.send(
        'wizard:step',
        { step: 3, total: 3 },
        {
            targetId: 'main',
            expectsResponse: false,
        }
    );

    await step3();

    await parley.send(
        'wizard:complete',
        { result: 'success' },
        {
            targetId: 'main',
            expectsResponse: false,
        }
    );
}

// Main: Display progress
parley.on('wizard:step', (payload) => {
    statusEl.textContent = `Step ${payload.step} of ${payload.total}`;
});
```

See [Multi-Window Communication](./multi-window-communication.md) for complex
window coordination patterns.

## Next Steps

Now that you understand popup communication:

**Learn More Patterns**:

- [Request-Response Pattern](../patterns/request-response.md) - Structured
  messaging
- [Error Handling Pattern](../patterns/error-handling.md) - Robust error
  handling
- [State Synchronization](../patterns/state-synchronization.md) - Sync state
  across windows

**Explore Other Communication Types**:

- [iFrame Communication](./iframe-communication.md) - Embed and communicate with
  iframes
- [Multi-Window Communication](./multi-window-communication.md) - Coordinate
  multiple windows

**Security**:

- [Origin Validation](../security/origin-validation.md) - Secure your popup
  communication
- [Message Validation](../security/message-validation.md) - Validate message
  payloads

**Testing**:

- [Testing Guide](../TESTING.md) - Test popup flows
- [Testing Patterns](../TESTING_PATTERNS.md) - Unit and integration testing

**Troubleshooting**:

- [Common Errors](../troubleshooting/common-errors.md) - Quick solutions
- [Dead Window References](../troubleshooting/common-errors.md#dead-window-references) -
  Fix popup closure issues
- [Memory Leaks](../troubleshooting/common-errors.md#memory-leaks) - Prevent
  resource leaks

## Related Guides

- **[iFrame Communication](./iframe-communication.md)** - Parent and iframe
  patterns
- **[Multi-Window Communication](./multi-window-communication.md)** - Multiple
  window coordination
- **[Security Guide](../security/index.md)** - Security best practices

## See Also

**API Methods**:

- [connect()](../api-reference/methods.md#connect) - Establish popup connection
- [send()](../api-reference/methods.md#send) - Send messages to popup
- [on()](../api-reference/methods.md#on) - Register message handlers
- [onSystem()](../api-reference/methods.md#onsystem) - Monitor connection events

**Code Patterns**:

- [Request-Response Pattern](../patterns/request-response.md)
- [Error Handling Pattern](../patterns/error-handling.md)

---

**Previous**: [iFrame Communication](./iframe-communication.md) **Next**:
[Web Worker Communication](./worker-communication.md) **Back to**:
[Documentation Home](./index.md)
