[Home](../../README.md) > [Documentation](../README.md) > [Examples](./README.md) > Basic Parent-Child Communication

# Basic Parent-Child Communication Example

A complete working example showing ParleyJS communication between a parent window and an iframe.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Parent Window Implementation](#parent-window-implementation)
5. [Child Window Implementation](#child-window-implementation)
6. [Understanding the Code](#understanding-the-code)
7. [Running the Example](#running-the-example)
8. [Common Issues](#common-issues)
9. [Next Steps](#next-steps)

---

## Overview

This example demonstrates the fundamental pattern for ParleyJS communication between a parent window and an iframe. The parent sends a request to the child, and the child responds with data.

**What you will learn:**
- Creating a ParleyJS instance with origin validation
- Connecting to an iframe
- Sending messages and receiving responses
- Handling errors and timeouts
- Using TypeScript for type safety

---

## Prerequisites

Before starting, ensure you have:

- ParleyJS installed in your project
- Basic understanding of iframes and the postMessage API
- A local development server (for HTTPS in production)

For installation instructions, see [Installation Guide](../getting-started/installation.md).

---

## Project Structure

Create the following files in your project:

```
project/
├── parent.html       # Parent window
├── child.html        # Child iframe
├── parent.ts         # Parent logic
└── child.ts          # Child logic
```

---

## Parent Window Implementation

### parent.html

```html
<!DOCTYPE html>
<html>
<head>
    <title>ParleyJS Parent Example</title>
</head>
<body>
    <h1>Parent Window</h1>
    <button id="send-message">Send Message to Child</button>
    <div id="response"></div>

    <iframe
        id="child-frame"
        src="child.html"
        width="600"
        height="400"
    ></iframe>

    <script type="module" src="parent.ts"></script>
</body>
</html>
```

### parent.ts

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';
import type { TimeoutError, ValidationError } from 'parley-js';

// Define message types for type safety
interface DataRequest {
    userId: number;
}

interface DataResponse {
    success: boolean;
    user: {
        id: number;
        name: string;
        email: string;
    };
}

// Create ParleyJS instance with origin validation
const parley = Parley.create({
    allowedOrigins: [window.location.origin],
    timeout: 5000,
    debug: true
});

// Get DOM elements
const iframe = document.getElementById('child-frame') as HTMLIFrameElement;
const sendButton = document.getElementById('send-message') as HTMLButtonElement;
const responseDiv = document.getElementById('response') as HTMLDivElement;

// Wait for iframe to load before connecting
iframe.addEventListener('load', async () => {
    try {
        // Connect to the iframe
        await parley.connect(iframe.contentWindow!, 'child-iframe');
        console.log('Connected to child iframe');

        // Enable the send button
        sendButton.disabled = false;
    } catch (error) {
        console.error('Failed to connect to iframe:', error);
        responseDiv.textContent = 'Connection failed';
    }
});

// Listen for connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Child connected:', event.targetId);
    responseDiv.textContent = 'Ready to send messages';
});

parley.onSystem(SYSTEM_EVENTS.DISCONNECTED, (event) => {
    console.log('Child disconnected:', event.targetId, event.reason);
    responseDiv.textContent = 'Child disconnected';
    sendButton.disabled = true;
});

// Handle send button click
sendButton.addEventListener('click', async () => {
    try {
        // Show loading state
        responseDiv.textContent = 'Sending request...';
        sendButton.disabled = true;

        // Send request to child and wait for response
        const response = await parley.send<DataRequest, DataResponse>(
            'get-user-data',
            { userId: 123 },
            {
                targetId: 'child-iframe',
                timeout: 5000
            }
        );

        // Handle successful response
        if (response.success) {
            responseDiv.innerHTML = `
                <h3>User Data Received:</h3>
                <p>ID: ${response.user.id}</p>
                <p>Name: ${response.user.name}</p>
                <p>Email: ${response.user.email}</p>
            `;
        } else {
            responseDiv.textContent = 'Failed to retrieve user data';
        }
    } catch (error) {
        // Handle different error types
        if (error instanceof TimeoutError) {
            responseDiv.textContent = 'Request timed out. Child may be unresponsive.';
            console.error('Timeout error:', error);
        } else if (error instanceof ValidationError) {
            responseDiv.textContent = 'Invalid response from child.';
            console.error('Validation error:', error);
        } else {
            responseDiv.textContent = 'Request failed. See console for details.';
            console.error('Request error:', error);
        }
    } finally {
        // Re-enable button
        sendButton.disabled = false;
    }
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    parley.disconnect('child-iframe');
});
```

---

## Child Window Implementation

### child.html

```html
<!DOCTYPE html>
<html>
<head>
    <title>ParleyJS Child Example</title>
</head>
<body>
    <h1>Child Iframe</h1>
    <p>Waiting for requests from parent...</p>
    <div id="status">Not connected</div>

    <script type="module" src="child.ts"></script>
</body>
</html>
```

### child.ts

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';
import type { MessageMetadata, ResponseFunction } from 'parley-js';

// Define message types
interface DataRequest {
    userId: number;
}

interface DataResponse {
    success: boolean;
    user: {
        id: number;
        name: string;
        email: string;
    };
}

// Create ParleyJS instance
const parley = Parley.create({
    allowedOrigins: [window.location.origin],
    debug: true
});

const statusDiv = document.getElementById('status') as HTMLDivElement;

// Register message handler for 'get-user-data' requests
parley.on<DataRequest>(
    'get-user-data',
    async (payload, respond: ResponseFunction<DataResponse>, metadata: MessageMetadata) => {
        console.log('Received request from parent:', payload);
        statusDiv.textContent = `Processing request for user ${payload.userId}...`;

        try {
            // Simulate data fetch (in real app, this would be an API call)
            const userData = await fetchUserData(payload.userId);

            // Send success response
            respond({
                success: true,
                user: userData
            });

            statusDiv.textContent = `Sent user data for ID ${payload.userId}`;
        } catch (error) {
            // Send error response
            respond({
                success: false,
                user: null as any
            });

            statusDiv.textContent = `Failed to fetch user ${payload.userId}`;
            console.error('Error fetching user data:', error);
        }
    }
);

// Simulate fetching user data
async function fetchUserData(userId: number) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock data
    return {
        id: userId,
        name: 'Alice Johnson',
        email: 'alice@example.com'
    };
}

// Connect to parent window
(async () => {
    try {
        await parley.connect(window.parent, 'parent-window');
        console.log('Connected to parent');
    } catch (error) {
        console.error('Failed to connect to parent:', error);
        statusDiv.textContent = 'Connection failed';
    }
})();

// Listen for connection events
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected to parent:', event.targetId);
    statusDiv.textContent = 'Connected to parent - Ready';
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_RECEIVED, (event) => {
    console.log('Message received:', event.messageType);
});
```

---

## Understanding the Code

### Origin Validation

Both parent and child use strict origin validation:

```typescript
allowedOrigins: [window.location.origin]
```

This ensures only messages from the same origin are accepted. In production, specify the exact origins you trust.

For more on origin validation, see [Origin Validation Guide](../security/origin-validation.md).

### Connection Establishment

The parent waits for the iframe to load before connecting:

```typescript
iframe.addEventListener('load', async () => {
    await parley.connect(iframe.contentWindow!, 'child-iframe');
});
```

The child connects to the parent immediately:

```typescript
await parley.connect(window.parent, 'parent-window');
```

For connection patterns, see [iFrame Communication Guide](../guides/iframe-communication.md).

### Type Safety

TypeScript generics provide type safety for messages:

```typescript
await parley.send<DataRequest, DataResponse>(
    'get-user-data',
    { userId: 123 },
    { targetId: 'child-iframe' }
);
```

The compiler ensures request and response types match your interfaces.

### Error Handling

The example handles three error types:

- **TimeoutError**: Request took too long
- **ValidationError**: Response failed schema validation
- **Generic errors**: Other communication failures

For comprehensive error handling patterns, see [Error Handling Pattern](../patterns/error-handling.md).

### System Events

System events provide visibility into the communication lifecycle:

```typescript
parley.onSystem(SYSTEM_EVENTS.CONNECTED, (event) => {
    console.log('Connected:', event.targetId);
});
```

For all available system events, see [System Events Reference](../api-reference/system-events.md).

---

## Running the Example

### Development Server

Start a local development server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server -p 8000

# Using VS Code Live Server
# Install Live Server extension and click "Go Live"
```

### Open in Browser

Navigate to `http://localhost:8000/parent.html`

### Expected Behavior

1. Parent page loads with iframe
2. Connection establishes automatically
3. Click "Send Message to Child"
4. User data appears in response div
5. Console shows all communication events

---

## Common Issues

### Issue: Connection Timeout

**Symptom**: "Failed to connect to iframe" error

**Solution**: Ensure the iframe has fully loaded before connecting. Use the `load` event listener as shown in the example.

For more timeout troubleshooting, see [Timeout Errors](../troubleshooting/common-errors.md#timeout-errors).

### Issue: Origin Mismatch

**Symptom**: Messages not received, console shows origin errors

**Solution**: Verify `allowedOrigins` matches the actual origin. Use `window.location.origin` for same-origin communication.

For origin troubleshooting, see [Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Issue: TypeScript Errors

**Symptom**: Type errors when using `send()` or `on()`

**Solution**: Define proper interfaces for request and response types. See TypeScript examples in this guide.

---

## Next Steps

Now that you understand the basics:

1. **Add Schema Validation** - Validate message payloads with JSON Schema
   - See [Message Validation Guide](../security/message-validation.md)

2. **Implement Error Recovery** - Add retry logic and fallback handling
   - See [Error Handling Pattern](../patterns/error-handling.md)

3. **Monitor Connection Health** - Use heartbeat monitoring
   - See [Heartbeat Monitoring](../guides/iframe-communication.md#heartbeat-monitoring)

4. **Scale to Multiple Windows** - Communicate with multiple iframes
   - See [Multi-Window Communication](../guides/multi-window-communication.md)

5. **Learn Advanced Patterns** - Request-response, state sync, broadcasting
   - See [Code Patterns](../patterns/README.md)

---

## Related Documentation

**API Reference**:
- [Parley.create()](../api-reference/methods.md#create) - Instance creation
- [connect()](../api-reference/methods.md#connect) - Establish connections
- [send()](../api-reference/methods.md#send) - Send messages
- [on()](../api-reference/methods.md#on) - Register handlers

**Guides**:
- [First Example](../getting-started/first-example.md) - Step-by-step tutorial
- [iFrame Communication](../guides/iframe-communication.md) - Complete iframe guide
- [Security Best Practices](../security/README.md) - Secure communication

**Patterns**:
- [Request-Response Pattern](../patterns/request-response.md) - Messaging patterns
- [Error Handling Pattern](../patterns/error-handling.md) - Error strategies

---

**Previous**: [Examples Overview](./README.md)
**Next**: [Advanced Examples](./README.md)
**Back to**: [Examples](./README.md)
