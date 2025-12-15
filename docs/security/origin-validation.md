[Home](../../index.md) > [Security](./index.md) > Origin Validation

# Origin Validation in ParleyJS

Origin validation is the most critical security feature in cross-window
communication. This guide explains why it matters, how it works, and how to
implement it correctly.

## Table of Contents

1. [Why Origin Validation Matters](#why-origin-validation-matters)
2. [How Origin Validation Works](#how-origin-validation-works)
3. [Exact vs Wildcard Matching](#exact-vs-wildcard-matching)
4. [Correct Implementation](#correct-implementation)
5. [Common Mistakes](#common-mistakes)
6. [Real-World Examples](#real-world-examples)
7. [Testing Origin Validation](#testing-origin-validation)
8. [Related Security Topics](#related-security-topics)
9. [API Reference](#api-reference)

## Why Origin Validation Matters

Origin validation is your first and most important line of defense against
malicious actors. Without proper origin validation, any website can send
messages to your application and potentially exploit it.

Consider this scenario: Your banking application embeds a widget in an iframe to
display account balances. Without origin validation, a malicious website could
open your application in an iframe and send fake messages pretending to be your
legitimate widget. These messages could request sensitive data, trigger
unauthorized transactions, or manipulate the UI to phish for credentials.

ParleyJS validates the origin of every incoming message against your configured
allowed origins list. Messages from unauthorized origins are silently rejected
before any of your code runs. This prevents attackers from exploiting your
message handlers even if they discover your message types.

The security model is simple: only messages from explicitly trusted origins are
processed. All others are rejected. This zero-trust approach ensures that even
if an attacker controls the content of messages, they cannot bypass origin
validation.

## How Origin Validation Works

An origin consists of three parts: scheme (protocol), hostname, and port. For
example, `https://example.com:443` breaks down as:

- Scheme: `https`
- Hostname: `example.com`
- Port: `443` (default for HTTPS)

ParleyJS compares the origin of every incoming postMessage event against your
allowedOrigins configuration. The comparison is exact and case-sensitive.
`https://example.com` is different from `http://example.com` (different scheme)
and different from `https://Example.com` (different case).

When you create a Parley instance, you specify which origins are allowed to
communicate with your application. ParleyJS intercepts all postMessage events
and checks the event.origin property. Only messages from allowed origins are
processed by your handlers.

## Exact vs Wildcard Matching

ParleyJS supports both exact origin matching and wildcard matching. However,
wildcards should only be used in development, never in production.

### Exact Matching (Recommended)

Exact matching requires the origin to match precisely:

```typescript
allowedOrigins: ['https://trusted.example.com'];
```

This configuration only accepts messages from `https://trusted.example.com`.
Messages from `https://evil.com`, `http://trusted.example.com` (wrong scheme),
or `https://trusted.example.com:8080` (different port) are rejected.

### Wildcard Matching (Development Only)

The wildcard `*` accepts messages from any origin:

```typescript
allowedOrigins: ['*']; // DANGEROUS - accepts ANY origin
```

This disables origin validation entirely. Use only for local development and
never deploy to production with wildcard origins.

### Same-Origin Shortcut

For same-origin communication (parent and iframe on same domain):

```typescript
allowedOrigins: [window.location.origin];
```

This uses the current window's origin, which is safe for same-origin scenarios.

## Correct Implementation

Follow these patterns for secure origin validation.

### Production Configuration

**Correct - Explicit Origins**:

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: ['https://trusted-widget.example.com'],
});
```

This accepts messages only from the specified origin. The scheme (https),
hostname (trusted-widget.example.com), and default port (443) must match
exactly.

### Multiple Trusted Origins

**Correct - Multiple Specific Origins**:

```typescript
const parley = Parley.create({
    allowedOrigins: [
        'https://widget1.example.com',
        'https://widget2.example.com',
        'https://api.example.com',
    ],
});
```

You can specify multiple origins when you need to communicate with multiple
trusted domains. Each origin must be listed explicitly.

### Development vs Production

**Correct - Environment-Based Configuration**:

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const parley = Parley.create({
    allowedOrigins: isDevelopment
        ? ['http://localhost:3000', 'http://localhost:5000']
        : ['https://production.example.com'],
});
```

Use different origins for development and production. Never use wildcards or
localhost origins in production.

### Same-Origin Communication

**Correct - Same-Origin Setup**:

```typescript
// Parent window
const parley = Parley.create({
    allowedOrigins: [window.location.origin],
});

// Child iframe (same domain)
const childParley = Parley.create({
    allowedOrigins: [window.location.origin],
});
```

When both windows are on the same origin, use `window.location.origin` to allow
communication between them.

## Common Mistakes

These are the most common origin validation mistakes that create security
vulnerabilities.

### Mistake 1: Using Wildcard in Production

**WRONG - Accepts Any Origin**:

```typescript
// SECURITY RISK - DO NOT USE IN PRODUCTION
const parley = Parley.create({
    allowedOrigins: ['*'],
});
```

**Why this is wrong**: This accepts messages from any website. An attacker can
host a malicious page that sends messages to your application, potentially
triggering actions or exfiltrating data.

**CORRECT - Explicit Origins**:

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://trusted-domain.com'],
});
```

For troubleshooting wildcard origin errors, see
[Common Errors: Security Vulnerabilities](../troubleshooting/common-errors.md#security-vulnerabilities).

### Mistake 2: Mixing HTTP and HTTPS

**WRONG - Wrong Scheme**:

```typescript
// Parent on HTTPS, child on HTTP
const parley = Parley.create({
    allowedOrigins: ['http://child.example.com'], // Wrong scheme
});
```

**Why this is wrong**: If your parent is on HTTPS but you allow HTTP origins, an
attacker can perform a downgrade attack. Mixed content may also be blocked by
browsers.

**CORRECT - Consistent HTTPS**:

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://child.example.com'], // Correct scheme
});
```

Always use HTTPS in production for both parent and child windows. For
troubleshooting protocol mismatch errors, see
[Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 3: Forgetting Port Numbers

**WRONG - Missing Port**:

```typescript
// Child runs on https://widget.example.com:8443
const parley = Parley.create({
    allowedOrigins: ['https://widget.example.com'], // Missing :8443
});
```

**Why this is wrong**: The origin includes the port number. If your child iframe
runs on a non-standard port, you must include it in allowedOrigins.

**CORRECT - Include Port**:

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://widget.example.com:8443'],
});
```

Note: Default ports (80 for HTTP, 443 for HTTPS) are implicit and don't need to
be specified. For troubleshooting port-related origin errors, see
[Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 4: Using Subdomains Incorrectly

**WRONG - Assuming Subdomain Wildcard**:

```typescript
// Won't accept *.example.com
const parley = Parley.create({
    allowedOrigins: ['https://example.com'], // Only exact match
});
```

**Why this is wrong**: ParleyJS does not support subdomain wildcards.
`https://example.com` will not match `https://widget.example.com` or
`https://api.example.com`.

**CORRECT - List All Subdomains**:

```typescript
const parley = Parley.create({
    allowedOrigins: [
        'https://widget.example.com',
        'https://api.example.com',
        'https://dashboard.example.com',
    ],
});
```

For troubleshooting subdomain-related origin errors, see
[Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 5: Localhost in Production

**WRONG - Localhost in Production**:

```typescript
const parley = Parley.create({
    allowedOrigins: [
        'https://production.example.com',
        'http://localhost:3000', // Development origin in production
    ],
});
```

**Why this is wrong**: Localhost origins in production builds allow anyone
running a local server to send messages to your application.

**CORRECT - Environment-Specific**:

```typescript
const allowedOrigins =
    process.env.NODE_ENV === 'production'
        ? ['https://production.example.com']
        : ['http://localhost:3000'];

const parley = Parley.create({ allowedOrigins });
```

For troubleshooting localhost configuration issues, see
[Common Errors: Origin Mismatch](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 6: Empty Allowed Origins

**WRONG - No Origins Specified**:

```typescript
const parley = Parley.create({
    allowedOrigins: [], // No origins allowed
});
```

**Why this is wrong**: This rejects all messages, breaking communication. While
not a security risk, it prevents legitimate functionality.

**CORRECT - Specify Origins**:

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://trusted-domain.com'],
});
```

For troubleshooting connection issues caused by origin configuration, see
[Connection Errors](../troubleshooting/common-errors.md#connection-errors).

### Mistake 7: Relying Only on Origin Validation

**WRONG - No Additional Validation**:

```typescript
parley.on('executeAction', (payload) => {
    // Directly executing without validating payload
    eval(payload.code); // EXTREMELY DANGEROUS
});
```

**Why this is wrong**: Origin validation prevents unauthorized domains from
sending messages, but it does not validate the message content. A compromised
trusted origin or XSS attack on the trusted domain can still send malicious
payloads.

**CORRECT - Multiple Layers of Security**:

```typescript
parley.on('executeAction', (payload, respond) => {
    // Validate origin (done automatically by ParleyJS)
    // AND validate message content
    if (!payload.action || typeof payload.action !== 'string') {
        respond({ success: false, error: 'Invalid action' });
        return;
    }

    // Whitelist allowed actions
    const allowedActions = ['save', 'load', 'delete'];
    if (!allowedActions.includes(payload.action)) {
        respond({ success: false, error: 'Unauthorized action' });
        return;
    }

    // Execute only whitelisted actions
    performAction(payload.action);
    respond({ success: true });
});
```

Origin validation is necessary but not sufficient. Always validate message
content. For comprehensive message validation strategies, see
[Message Validation Guide](./message-validation.md).

## Real-World Examples

These examples show correct origin validation in common scenarios.

### iFrame Communication

**Parent Window**:

```typescript
import { Parley } from 'parley-js';

// Parent on https://myapp.example.com
const parley = Parley.create({
    allowedOrigins: ['https://widget.example.com'],
});

// Connect to iframe
const iframe = document.getElementById('widget-iframe');
iframe.addEventListener('load', async () => {
    await parley.connect(iframe, 'widget');

    // Send configuration
    await parley.send(
        'configure',
        {
            theme: 'dark',
            apiKey: 'abc123',
        },
        { targetId: 'widget' }
    );
});
```

**Child Iframe (widget.example.com)**:

```typescript
import { Parley } from 'parley-js';

// Child on https://widget.example.com
const parley = Parley.create({
    allowedOrigins: ['https://myapp.example.com'],
});

// Handle configuration
parley.on('configure', (payload, respond) => {
    applyConfiguration(payload);
    respond({ success: true });
});

// Connect to parent
await parley.connect(window.parent, 'parent');
```

Both sides validate the other's origin. Parent only accepts messages from
widget.example.com, and widget only accepts messages from myapp.example.com. For
complete iframe implementation guide, see
[iFrame Communication](../guides/iframe-communication.md).

### Popup Window Communication

**Main Window**:

```typescript
// Main window on https://myapp.example.com
const parley = Parley.create({
    allowedOrigins: ['https://auth.example.com'],
});

// Open OAuth popup
const popup = window.open('https://auth.example.com/oauth', 'oauth');

parley.on('auth:success', (payload) => {
    console.log('OAuth token:', payload.token);
    popup.close();
});

await parley.connect(popup, 'auth-popup');
```

**Popup Window (auth.example.com)**:

```typescript
// Popup on https://auth.example.com
const parley = Parley.create({
    allowedOrigins: ['https://myapp.example.com'],
});

// After OAuth success
await parley.send(
    'auth:success',
    {
        token: 'oauth-token-xyz',
    },
    {
        targetId: 'main',
        expectsResponse: false,
    }
);

await parley.connect(window.opener, 'main');
```

For complete popup communication and OAuth flow examples, see
[Popup Communication Guide](../guides/popup-communication.md).

### Multi-Window Dashboard

**Dashboard (Hub)**:

```typescript
// Dashboard on https://dashboard.example.com
const parley = Parley.create({
    allowedOrigins: [
        'https://analytics.example.com',
        'https://metrics.example.com',
        'https://reports.example.com',
    ],
});

// Connect to multiple widget iframes
await parley.connect(analyticsIframe, 'analytics');
await parley.connect(metricsIframe, 'metrics');
await parley.connect(reportsIframe, 'reports');

// Broadcast theme change to all widgets
await parley.broadcast('theme:change', {
    theme: 'dark',
});
```

**Widget Iframes**:

```typescript
// Each widget iframe
const parley = Parley.create({
    allowedOrigins: ['https://dashboard.example.com'],
});

parley.on('theme:change', (payload) => {
    applyTheme(payload.theme);
});

await parley.connect(window.parent, 'dashboard');
```

For managing multiple window connections and broadcasting, see
[Multi-Window Communication Guide](../guides/multi-window-communication.md).

### Cross-Origin Widget with Fallback

**Application**:

```typescript
const isDevelopment = window.location.hostname === 'localhost';

const parley = Parley.create({
    allowedOrigins: isDevelopment
        ? ['http://localhost:3000']
        : ['https://cdn.widgets.example.com'],
});

// Load widget from appropriate origin
const widgetUrl = isDevelopment
    ? 'http://localhost:3000/widget.html'
    : 'https://cdn.widgets.example.com/widget.html';

const iframe = document.createElement('iframe');
iframe.src = widgetUrl;
document.body.appendChild(iframe);

iframe.addEventListener('load', async () => {
    await parley.connect(iframe, 'widget');
});
```

## Testing Origin Validation

Test origin validation to ensure only trusted origins are accepted.

### Testing Rejection of Unauthorized Origins

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Parley } from 'parley-js';

describe('Origin Validation', () => {
    it('should reject messages from unauthorized origins', () => {
        const parley = Parley.create({
            allowedOrigins: ['https://trusted.com'],
        });

        const handler = vi.fn();
        parley.on('test-message', handler);

        // Simulate message from unauthorized origin
        const event = new MessageEvent('message', {
            data: {
                type: 'test-message',
                payload: {},
            },
            origin: 'https://evil.com', // Unauthorized origin
        });

        window.dispatchEvent(event);

        // Handler should not be called
        expect(handler).not.toHaveBeenCalled();
    });

    it('should accept messages from authorized origins', () => {
        const parley = Parley.create({
            allowedOrigins: ['https://trusted.com'],
        });

        const handler = vi.fn();
        parley.on('test-message', handler);

        // Simulate message from authorized origin
        const event = new MessageEvent('message', {
            data: {
                type: 'test-message',
                payload: { data: 'test' },
            },
            origin: 'https://trusted.com', // Authorized origin
        });

        window.dispatchEvent(event);

        // Handler should be called
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ data: 'test' }),
            expect.any(Function),
            expect.objectContaining({ origin: 'https://trusted.com' })
        );
    });

    it('should handle multiple allowed origins', () => {
        const parley = Parley.create({
            allowedOrigins: ['https://trusted1.com', 'https://trusted2.com'],
        });

        const handler = vi.fn();
        parley.on('test-message', handler);

        // Message from first trusted origin
        const event1 = new MessageEvent('message', {
            data: { type: 'test-message', payload: {} },
            origin: 'https://trusted1.com',
        });
        window.dispatchEvent(event1);

        // Message from second trusted origin
        const event2 = new MessageEvent('message', {
            data: { type: 'test-message', payload: {} },
            origin: 'https://trusted2.com',
        });
        window.dispatchEvent(event2);

        // Both should be accepted
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should reject origins with wrong scheme', () => {
        const parley = Parley.create({
            allowedOrigins: ['https://trusted.com'],
        });

        const handler = vi.fn();
        parley.on('test-message', handler);

        // HTTP instead of HTTPS
        const event = new MessageEvent('message', {
            data: { type: 'test-message', payload: {} },
            origin: 'http://trusted.com', // Wrong scheme
        });

        window.dispatchEvent(event);

        expect(handler).not.toHaveBeenCalled();
    });

    it('should reject origins with different port', () => {
        const parley = Parley.create({
            allowedOrigins: ['https://trusted.com'],
        });

        const handler = vi.fn();
        parley.on('test-message', handler);

        // Different port
        const event = new MessageEvent('message', {
            data: { type: 'test-message', payload: {} },
            origin: 'https://trusted.com:8080', // Different port
        });

        window.dispatchEvent(event);

        expect(handler).not.toHaveBeenCalled();
    });
});
```

### Integration Testing

```typescript
describe('Origin Validation - Integration', () => {
    it('should validate origin in real iframe scenario', async () => {
        // Setup parent
        const parentParley = Parley.create({
            allowedOrigins: ['https://child.example.com'],
        });

        // Setup child (would be in separate window/iframe)
        const childParley = Parley.create({
            allowedOrigins: ['https://parent.example.com'],
        });

        // Only messages with correct origins should work
        // Messages with wrong origins should be rejected
        // (Full integration test would require actual iframe setup)
    });
});
```

For comprehensive testing strategies, see
[Testing Patterns](../TESTING_PATTERNS.md).

## Related Security Topics

Origin validation is the first layer of security. Combine it with these
additional protections:

### Message Validation

After validating the origin, validate the message content:

- [Message Validation Guide](./message-validation.md) - Validate payload
  structure and content
- Use JSON Schema validation for type safety
- Sanitize user-provided data before display
- Whitelist allowed values for enumerated fields

### HTTPS Enforcement

Always use HTTPS in production:

- Prevents man-in-the-middle attacks
- Ensures origin integrity
- Required for secure cookies and storage APIs
- See [Security Best Practices](../SECURITY.md#https-enforcement)

### Content Security Policy

Use CSP headers to restrict iframe sources:

```html
<meta
    http-equiv="Content-Security-Policy"
    content="frame-src https://trusted-widget.example.com;"
/>
```

This provides defense-in-depth by restricting which origins can be embedded.

### Defense in Depth

Never rely on a single security mechanism:

1. Origin validation (ParleyJS automatic)
2. Message content validation (your code)
3. HTTPS enforcement (server configuration)
4. CSP headers (server configuration)
5. Input sanitization (your code)

For complete security guidance, see [Security Guide](../SECURITY.md).

## API Reference

### Parley.create() Configuration

```typescript
interface ParleyConfig {
    allowedOrigins: string[]; // Required
    // ... other config options
}

const parley = Parley.create({
    allowedOrigins: ['https://trusted-domain.com'],
});
```

**allowedOrigins** (required):

- Type: `string[]`
- Array of allowed origin strings
- Must be exact origins: `'https://example.com'`
- Use `'*'` for development only (accepts any origin)
- Scheme, hostname, and port must match exactly

For complete API documentation, see:

- [Parley.create() Reference](../api-reference/methods.md#parleycreate)
- [Configuration Options](../api-reference/README.md#configuration)
- [Security Configuration](../SECURITY.md#configuration)

## Security Checklist

Before deploying to production:

- [ ] No wildcard (`*`) in allowedOrigins
- [ ] All origins use HTTPS (not HTTP)
- [ ] Port numbers included if non-standard
- [ ] No localhost origins in production
- [ ] Environment-specific configuration
- [ ] Origin validation tests pass
- [ ] Combined with message content validation
- [ ] CSP headers configured (if applicable)

## Further Reading

**Security Documentation**:

- [Message Validation](./message-validation.md) - Validate message content
- [Security Best Practices](../SECURITY.md) - Complete security guide
- [Reporting Security Issues](../SECURITY.md#reporting-security-issues)

**Implementation Guides**:

- [iFrame Communication](../guides/iframe-communication.md) - Secure iframe
  setup
- [Popup Communication](../guides/popup-communication.md) - OAuth and popup
  security
- [Multi-Window Communication](../guides/multi-window-communication.md) -
  Multiple origin management

**Testing**:

- [Testing Patterns](../TESTING_PATTERNS.md) - Security testing strategies
- [Testing Guide](../TESTING.md) - Comprehensive testing documentation

---

**Previous**: [Security Guide](./index.md) **Next**:
[Message Validation](./message-validation.md) **Back to**:
[Security Guide](./index.md)
