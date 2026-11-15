[Home](../index.md) > [Guides](./index.md) > Popup Window Communication

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
- A way to resolve `import ... from 'ignite-parleyjs'` in the browser: a
  bundler/dev server such as Vite, or an import map as shown in
  [Your First ParleyJS Example](../getting-started/first-example.md)

If you need help with setup, see
[Installation](../getting-started/installation.md).

## Basic Setup

The simplest popup communication setup requires a main window that opens a popup
and establishes communication.

### Minimal Main Window Setup

```javascript
import { Parley } from 'ignite-parleyjs';

// Create Parley instance for popups/new windows
const parley = Parley.create({
    targetType: 'window',
    allowedOrigins: [window.location.origin],
});

// Open the popup from a click handler so it is not blocked
document.getElementById('open-btn').addEventListener('click', async () => {
    const popup = window.open(
        '/popup.html',
        'myPopup',
        'width=600,height=400,left=100,top=100'
    );

    if (!popup) {
        console.error('Popup blocked');
        return;
    }

    // Connect right away; no need to wait for the popup to load
    await parley.connect(popup, 'popup');
    console.log('Connected to popup');
});
```

### Minimal Popup Window Setup

```javascript
import { Parley } from 'ignite-parleyjs';

// Create Parley instance
const parley = Parley.create({
    targetType: 'window',
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
            import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

            const parley = Parley.create({
                targetType: 'window',
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

                    // Connect to popup (no need to wait for it to load)
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

            // Detect the user closing the popup manually. ParleyJS notices a
            // closed window within about a second and emits
            // system:disconnected with reason 'connection_lost'.
            parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
                if (event.targetId !== 'oauth-popup') return;

                const statusEl = document.getElementById('status');
                if (statusEl.textContent === 'Waiting for authentication...') {
                    statusEl.textContent = 'Login cancelled';
                }
                oauthPopup = null;
            });
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
            import { Parley } from 'ignite-parleyjs';

            const parley = Parley.create({
                targetType: 'window',
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
import { Parley, SYSTEM_EVENTS } from 'ignite-parleyjs';

// Main window: call this from a click handler
async function openPopup() {
    const popup = window.open('/popup.html', 'popup', 'width=500,height=600');

    if (!popup) {
        // Popup was blocked
        showNotification('Please allow popups for this site');
        // Provide fallback: show inline modal instead
        showInlineAuthModal();
        return;
    }

    // connect() rejects if the handshake does not complete within the
    // instance's `timeout` (default 5000 ms), e.g. ERR_CONNECTION_HANDSHAKE_FAILED
    try {
        await parley.connect(popup, 'popup');
    } catch (error) {
        console.error('Connection failed:', error.code, error.message);
        popup.close();
    }
}

// Popup: Handle disconnection
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Disconnected from main window:', event.reason);
    // Main window may have closed, navigated, or called disconnect()
    window.close();
});
```

### Step 4: Monitor Popup Lifecycle

Track popup state and handle unexpected closure. You do not need to poll
`popup.closed` yourself: ParleyJS checks connected windows about once a second.
When a popup is closed it emits `system:connection_lost` and then
`system:disconnected`, both with reason `'connection_lost'`.

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

// Detect the user closing the popup before completing the flow
parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    if (event.targetId === 'oauth-popup' && !flowCompleted) {
        console.log('Popup closed before completion:', event.reason);
        document.getElementById('status').textContent = 'Login cancelled';
    }
});
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
            import { Parley } from 'ignite-parleyjs';

            const parley = Parley.create({
                targetType: 'window',
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

                    // Connect to popup (no need to wait for it to load)
                    try {
                        await parley.connect(paymentPopup, 'payment-popup');

                        // Send payment details and wait for the popup to
                        // confirm it is ready
                        await parley.send(
                            'payment:init',
                            {
                                amount,
                                currency,
                                orderID: 'ORDER-12345',
                            },
                            { targetId: 'payment-popup' }
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

                // Render received data with textContent, never innerHTML
                const cart = document.getElementById('cart');
                const heading = document.createElement('h2');
                heading.textContent = 'Order Confirmed';
                const txn = document.createElement('p');
                txn.textContent = `Transaction ID: ${payload.transactionID}`;
                cart.replaceChildren(heading, txn);

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
            import { Parley } from 'ignite-parleyjs';

            const parley = Parley.create({
                targetType: 'window',
                allowedOrigins: [window.location.origin],
            });

            let paymentInfo = {};

            // Register handlers BEFORE connecting so no message is missed
            parley.on('payment:init', (payload, respond) => {
                paymentInfo = payload;

                // Render received data with textContent, never innerHTML
                document.getElementById('payment-details').textContent =
                    `Amount: $${(payload.amount / 100).toFixed(2)} ${payload.currency}, ` +
                    `Order: ${payload.orderID}`;

                respond({ ready: true });
            });

            // Connect to opener
            if (window.opener) {
                await parley.connect(window.opener, 'main');
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
3. Main window calls connect() with the popup window reference and a target ID
   right after window.open(); it does not wait for a load event.
4. Popup window calls connect() with the window.opener reference.
5. Handshake completes and both sides can exchange messages.

The popup keeps re-sending its handshake until the main window answers, so the
two sides can call connect() in any order. If the handshake does not complete
within `timeout`, connect() rejects.

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

Unlike iframes, popups can be closed by the user at any time. ParleyJS detects a
closed window automatically (within about a second) and emits
`system:connection_lost` followed by `system:disconnected` with reason
`'connection_lost'`; listen for these with `onSystem()` instead of polling
`popup.closed`. Always clean up your own resources when the popup closes.

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
button.addEventListener('click', async () => {
    const popup = window.open('/popup.html');

    if (!popup) {
        alert('Please allow popups for this site');
        return;
    }

    await parley.connect(popup, 'popup');
});
```

Always check if window.open() returned null (popup blocked).

### Mistake 3: Not Handling Popup Closure

**Problem**: User closes popup but the main window never reacts to it.

**Wrong**:

```javascript
const popup = window.open('/popup.html');
await parley.connect(popup, 'popup');
// Nothing listens for the popup going away
```

**Correct**:

```javascript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

let flowCompleted = false;

parley.on('flow:complete', () => {
    flowCompleted = true;
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    if (event.targetId === 'popup' && !flowCompleted) {
        // reason is 'connection_lost' when the user closed the popup
        console.log('User cancelled by closing popup');
        handleCancellation();
    }
});
```

ParleyJS detects closed popups for you; react to `system:disconnected` (or
`system:connection_lost`) rather than polling `popup.closed`.

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
} else {
    await parley.connect(window.opener, 'main');
}
```

Always check if window.opener exists before using it.

### Mistake 5: Not Handling Connection Failure

**Problem**: The popup fails to load (or never calls connect()), and the
rejected connect() promise is not handled.

**Wrong**:

```javascript
await parley.connect(popup, 'popup'); // Unhandled rejection if it fails
```

**Correct**:

```javascript
try {
    // Rejects after the instance's `timeout` (default 5000 ms) if the
    // handshake does not complete (ERR_CONNECTION_HANDSHAKE_FAILED)
    await parley.connect(popup, 'popup');
} catch (error) {
    console.error('Failed to connect:', error.code, error.message);
    popup.close();
}
```

connect() never hangs indefinitely; it rejects once `timeout` elapses. Increase
`timeout` in `Parley.create()` if the popup page is slow to load.

## Advanced Patterns

### OAuth Flow with Redirect

Handle OAuth provider redirect back to popup:

```javascript
// Main window: a dedicated instance whose timeout covers the time the user
// spends on the provider's login page
const oauthParley = Parley.create({
    targetType: 'window',
    allowedOrigins: [window.location.origin],
    timeout: 300000,
});

// Start the OAuth flow from a click handler
async function startOAuthFlow(provider) {
    const popup = window.open(
        `/oauth/authorize?provider=${provider}`,
        'oauth',
        'width=500,height=600'
    );

    if (!popup) return Promise.reject(new Error('Popup blocked'));

    const result = new Promise((resolve, reject) => {
        const cleanup = () => {
            offSuccess();
            offError();
            if (!popup.closed) popup.close();
        };

        // on() returns an unsubscribe function
        const offSuccess = oauthParley.on('oauth:success', (payload) => {
            cleanup();
            resolve(payload.token);
        });

        const offError = oauthParley.on('oauth:error', (payload) => {
            cleanup();
            reject(new Error(payload.error));
        });
    });

    // The popup only calls connect() once the provider has redirected back to
    // our callback page, so connect() waits up to `timeout` (5 minutes here)
    // for its handshake and rejects if the user never finishes logging in.
    try {
        await oauthParley.connect(popup, 'oauth-popup');
    } catch (error) {
        if (!popup.closed) popup.close();
        throw error;
    }
    return result;
}

// Popup callback page (after the provider redirects back to it).
// It has its own instance: Parley.create({ targetType: 'window', ... })
await parley.connect(window.opener, 'main');

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

    const result = new Promise((resolve, reject) => {
        const offSelected = parley.on('file:selected', (payload) => {
            offSelected();
            offCancelled();
            popup.close();
            resolve(payload.file);
        });

        const offCancelled = parley.on('file:cancelled', () => {
            offSelected();
            offCancelled();
            popup.close();
            reject(new Error('Selection cancelled'));
        });
    });

    await parley.connect(popup, 'file-selector');
    return result;
}

// Usage (from a click handler, so the popup is not blocked)
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
[Multi-Window Communication](./multi-window-communication.md) **Back to**:
[Documentation Home](./index.md)
