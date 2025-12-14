[Home](../../README.md) > [Getting Started](./README.md) > First Example

# Your First ParleyJS Example

Build a working parent-child iframe communication in 5 minutes. This guide shows you the essential steps to get ParleyJS running.

## Table of Contents

1. [What We're Building](#what-were-building)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create the Parent Page](#step-1-create-the-parent-page)
4. [Step 2: Create the Child Page](#step-2-create-the-child-page)
5. [Step 3: Set Up Message Handlers](#step-3-set-up-message-handlers)
6. [Step 4: Test Your Communication](#step-4-test-your-communication)
7. [Expected Output](#expected-output)
8. [Common Beginner Mistakes](#common-beginner-mistakes)
9. [Next Steps](#next-steps)

## What We're Building

A simple parent page that embeds an iframe. The parent sends a greeting message to the child, and the child responds. This demonstrates the core ParleyJS request-response pattern.

You'll learn how to create instances, connect to targets, register handlers, and send messages.

## Prerequisites

Before starting, you need:
- ParleyJS installed (`npm install parley-js` or use CDN)
- Basic HTML and JavaScript knowledge
- A local web server (ParleyJS requires HTTP/HTTPS, not `file://`)

If you don't have a local server, use `npx serve .` in your project directory.

## Step 1: Create the Parent Page

Create a file called `parent.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ParleyJS Parent</title>
</head>
<body>
    <h1>Parent Window</h1>
    <iframe id="child-iframe" src="child.html" width="600" height="400"></iframe>

    <script type="module">
        import { Parley } from 'parley-js';

        // Create Parley instance for parent
        const parley = Parley.create({
            allowedOrigins: [window.location.origin]
        });

        // Register handler for child responses
        parley.on('greeting-response', (payload, respond, metadata) => {
            console.log('Child says:', payload.message);
        });

        // Wait for iframe to load, then connect
        const iframe = document.getElementById('child-iframe');
        iframe.addEventListener('load', async () => {
            // Connect to the iframe
            await parley.connect(iframe, 'child');
            console.log('Connected to child iframe');

            // Send greeting message to child
            const response = await parley.send('greeting', {
                name: 'Parent',
                timestamp: Date.now()
            }, { targetId: 'child' });

            console.log('Child responded:', response);
        });
    </script>
</body>
</html>
```

**What this code does:**
- `Parley.create()` initializes a ParleyJS instance with origin validation
- `parley.on()` registers a handler for incoming messages of type `greeting-response`
- `parley.connect()` establishes the communication channel with the iframe
- `parley.send()` sends a message and waits for a response

For complete configuration options, see [Parley.create() API reference](../api-reference/methods.md#parleycreate). For origin validation security, see [Origin Validation Guide](../security/origin-validation.md).

## Step 2: Create the Child Page

Create a file called `child.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ParleyJS Child</title>
</head>
<body>
    <h1>Child Window (Iframe)</h1>
    <p>Waiting for messages from parent...</p>

    <script type="module">
        import { Parley } from 'parley-js';

        // Create Parley instance for child
        const parley = Parley.create({
            allowedOrigins: [window.location.origin]
        });

        // Register handler for parent greetings
        parley.on('greeting', (payload, respond, metadata) => {
            console.log('Parent says hello! Received:', payload);

            // Respond to the parent
            respond({
                message: `Hello ${payload.name}! I'm the child iframe.`,
                receivedAt: Date.now()
            });
        });

        // Connect to parent window
        await parley.connect(window.parent, 'parent');
        console.log('Child connected to parent');
    </script>
</body>
</html>
```

**What this code does:**
- Creates a ParleyJS instance in the child window
- Registers a handler for `greeting` messages from the parent
- Calls `respond()` to send data back to the parent
- Connects to `window.parent` to establish the channel

## Step 3: Set Up Message Handlers

Message handlers in ParleyJS follow this pattern:

```typescript
parley.on('message-type', (payload, respond, metadata) => {
    // payload: The data sent with the message
    // respond: Function to send a response back
    // metadata: Information about the message (origin, targetId, etc.)

    // Process the message
    console.log('Received:', payload);

    // Send response (optional)
    respond({ status: 'success' });
});
```

The handler receives three parameters:
1. **payload** - The message data
2. **respond** - Callback to send a response (only needed for request-response pattern)
3. **metadata** - Message metadata including origin, targetId, and messageId

For fire-and-forget messages (no response needed), simply don't call `respond()`.

For detailed comparison of fire-and-forget vs request-response patterns, see [Request-Response Pattern](../patterns/request-response.md#when-to-use-it). For all send() options including timeout and retries, see [send() method reference](../api-reference/methods.md#send).

## Step 4: Test Your Communication

Start a local web server in your project directory:

```bash
npx serve .
```

Open `http://localhost:3000/parent.html` in your browser. Open the browser console (F12) to see the messages.

You should see output like:

```
Connected to child iframe
Child says: Hello Parent! I'm the child iframe.
Child responded: { message: "Hello Parent! I'm the child iframe.", receivedAt: 1234567890 }
```

The parent sends a greeting, the child receives it, responds, and the parent logs the response.

## Expected Output

**In Parent Console:**
```
Connected to child iframe
Child says: Hello Parent! I'm the child iframe.
Child responded: { message: "Hello Parent! I'm the child iframe.", receivedAt: 1234567890 }
```

**In Child Console (iframe):**
```
Parent says hello! Received: { name: "Parent", timestamp: 1234567890 }
Child connected to parent
```

If you see these messages, congratulations! Your ParleyJS communication is working.

## Common Beginner Mistakes

### Mistake 1: Using `file://` Protocol

**Problem:** ParleyJS requires HTTP or HTTPS origins. Opening files directly (`file://`) won't work.

**Solution:** Use a local web server like `npx serve .` or `python -m http.server`.

For troubleshooting origin errors in development, see [Common Errors: Origin Mismatch](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 2: Connecting Before Iframe Loads

**Problem:** Calling `parley.connect()` before the iframe is ready causes connection failures.

**Wrong:**
```javascript
const iframe = document.getElementById('child-iframe');
await parley.connect(iframe, 'child'); // Iframe might not be loaded yet
```

**Correct:**
```javascript
iframe.addEventListener('load', async () => {
    await parley.connect(iframe, 'child');
});
```

For more iframe timing issues, see [Dead Window References](../troubleshooting/common-errors.md#dead-window-references).

### Mistake 3: Mismatched Origins

**Problem:** Parent and child have different origins configured in `allowedOrigins`.

**Wrong:**
```javascript
// Parent
allowedOrigins: ['https://example.com']

// Child (running on localhost)
allowedOrigins: ['http://localhost:3000']
```

**Correct:** Both should allow the actual origin they're communicating with:
```javascript
// Both parent and child
allowedOrigins: [window.location.origin]
```

For complete origin validation guide, see [Origin Validation](../security/origin-validation.md). For debugging origin mismatches, see [Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 4: Not Calling `respond()`

**Problem:** Parent waits for a response, but child handler doesn't call `respond()`.

**Result:** TimeoutError after the configured timeout period (default 5000ms).

**Solution:** Always call `respond()` in handlers when the sender expects a response:
```javascript
parley.on('greeting', (payload, respond) => {
    // Process message
    respond({ status: 'received' }); // Don't forget this
});
```

For handling timeout errors when respond() is not called, see [Troubleshooting: Timeout Errors](../troubleshooting/common-errors.md#timeout-errors).

### Mistake 5: Wrong Message Type Names

**Problem:** Parent sends `greeting` but child listens for `greetings` (plural).

**Wrong:**
```javascript
// Parent sends
parley.send('greeting', data);

// Child listens for different type
parley.on('greetings', handler); // Types don't match
```

**Correct:** Message type strings must match exactly:
```javascript
parley.send('greeting', data);
parley.on('greeting', handler); // Matches
```

## Next Steps

Now that you have basic communication working, explore these topics:

**Learn Core Concepts:**
- [Core Concepts](./concepts.md) - Understanding channels, message types, and origins
- [API Methods Reference](../api-reference/methods.md) - Complete method documentation

**Add Features:**
- [Error Handling Pattern](../patterns/error-handling.md) - Handle timeouts and failures gracefully
- [Schema Validation](../EXAMPLES.md#schema-validation) - Validate message structure with JSON Schema
- [System Events](../api-reference/README.md#system-events) - Monitor connection state and heartbeats

**Explore Use Cases:**
- [iFrame Communication Guide](../guides/iframe-communication.md) - Advanced iframe patterns
- [Popup Communication Guide](../guides/popup-communication.md) - OAuth flows and payment processing
- [Multi-Window Communication](../guides/multi-window-communication.md) - Coordinate multiple windows

**Security:**
- [Origin Validation](../security/origin-validation.md) - Secure your communication channels
- [Security Best Practices](../security/README.md) - Complete security guide

**Testing:**
- [Testing Request-Response](../patterns/request-response.md#testing) - How to test message handlers
- [Common Test Patterns](../TESTING_PATTERNS.md) - Mocking and integration tests

**Troubleshooting:**
- [Common Errors](../troubleshooting/common-errors.md) - Quick solutions to frequent issues
- [Messages Not Received](../troubleshooting/common-errors.md#messages-not-being-received) - Debug silent failures

## Complete Working Example

For a full working example with UI and logging, see the [Basic Example](../../examples/basic/) in the repository.

To run it:
```bash
git clone https://github.com/WebDev-Guy/parley-js.git
cd parley-js
npm install
npm run build
npx serve .
# Open http://localhost:3000/examples/basic/parent.html
```

---

## Navigation

**Previous**: [Installation](./installation.md)
**Next**: [Core Concepts](./concepts.md)
**Back to**: [Getting Started](./README.md)

**Related**:
- [API Reference](../api-reference/README.md)
- [Code Examples](../EXAMPLES.md)
- [Troubleshooting](../troubleshooting/README.md)
