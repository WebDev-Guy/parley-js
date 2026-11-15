[Home](../index.md) > [Security](./index.md) > Origin Validation

# Origin Validation in ParleyJS

Origin validation is the most critical security feature in cross-window
communication. This guide explains why it matters, how it works, and how to
implement it correctly.

## Table of Contents

1. [Why Origin Validation Matters](#why-origin-validation-matters)
2. [How Origin Validation Works](#how-origin-validation-works)
3. [Exact Matching Only](#exact-matching-only)
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
allowed origins list. Messages from origins that are not in the list are dropped
silently by the channel before any of your code runs (they are only logged, at
`warn` level, when `logLevel` allows it). This prevents attackers from reaching
your message handlers even if they discover your message types.

Since 1.1.0, each connection also checks `event.source`: a message is only
accepted if it comes from the exact window that connection was made with. A
second window that happens to share an allowed origin cannot talk to that
connection, and responses are only accepted from the target the request was sent
to.

The security model is simple: only messages from explicitly trusted origins and
the connected window are processed. All others are rejected.

## How Origin Validation Works

An origin consists of three parts: scheme (protocol), hostname, and port. For
example, `https://example.com:443` breaks down as:

- Scheme: `https`
- Hostname: `example.com`
- Port: `443` (default for HTTPS)

ParleyJS compares the browser-supplied `event.origin` of every incoming
postMessage event against your `allowedOrigins` configuration:

1. Each configured entry is normalized to its URL origin (scheme, host, port)
   and lowercased. `https://Example.com/some/path` becomes
   `https://example.com`.
2. The incoming origin is lowercased and must **exactly equal** one of the
   normalized entries.

So `https://example.com` is different from `http://example.com` (different
scheme) and from `https://example.com:8443` (different port), but
`https://Example.com` is treated the same as `https://example.com` (hostnames
are case-insensitive).

The opaque `'null'` origin (sandboxed iframes without `allow-same-origin`,
`data:` URLs, `file://` pages) is never accepted.

Inbound processing happens in this order:

1. **Channel**: origin allowlist check, then `event.source` check. Failures are
   dropped silently.
2. **Parley**: `securityLayer.validateOrigin()`, protocol structure and version,
   then `securityLayer.validateMessage()` for requests. Failures here emit
   `system:error`.
3. **Schema** validation (if the type was registered with a schema), then your
   handlers.

With the default security layer, step 2's origin check repeats the same exact
match, so in practice it only rejects anything when you supply a **custom**
`validateOrigin()`; such rejections emit `system:error` with code
`ERR_SECURITY_ORIGIN_MISMATCH`.

The origin passed to your handlers as `metadata.origin` is the browser-verified
`event.origin`, never a value reported by the sender.

## Exact Matching Only

ParleyJS supports exact origin matching only. There is no wildcard, pattern or
subdomain matching.

### Exact Matching

Exact matching requires the origin to match precisely:

```typescript
allowedOrigins: ['https://trusted.example.com'];
```

This configuration only accepts messages from `https://trusted.example.com`.
Messages from `https://evil.com`, `http://trusted.example.com` (wrong scheme),
or `https://trusted.example.com:8080` (different port) are rejected.

### Wildcards Are Rejected

```typescript
allowedOrigins: ['*']; // Parley.create() throws 'Configuration error: ...'
allowedOrigins: ['null']; // Parley.create() throws
allowedOrigins: ['']; // Parley.create() throws
allowedOrigins: []; // Parley.create() throws (list cannot be empty)

allowedOrigins: ['*.example.com']; // Parley.create() throws (no pattern matching)
```

There is no development-mode wildcard. For local development, list your local
origins explicitly (for example `'http://localhost:3000'`).

### Same-Origin Default

For same-origin communication (parent and iframe on the same origin) you can
omit `allowedOrigins`; it defaults to `[window.location.origin]`:

```typescript
const parley = Parley.create({ targetType: 'iframe' });
// equivalent to allowedOrigins: [window.location.origin]
```

### The First Entry Matters on the Connecting Side

The side that calls `connect(window.parent)` (iframe child) or
`connect(window.opener)` (popup) cannot read the other window's origin, so it
posts its handshake to the **first** entry of `allowedOrigins`. List the
parent's (or opener's) origin first in the child/popup configuration. After the
handshake, Parley uses the origin the browser reported for the peer.

## Correct Implementation

Follow these patterns for secure origin validation.

### Production Configuration

**Correct - Explicit Origins**:

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted-widget.example.com'],
});
```

This accepts messages only from the specified origin. The scheme (https),
hostname (trusted-widget.example.com), and default port (443) must match.

### Multiple Trusted Origins

**Correct - Multiple Specific Origins**:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
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
    targetType: 'iframe',
    allowedOrigins: isDevelopment
        ? ['http://localhost:3000', 'http://localhost:5000']
        : ['https://production.example.com'],
});
```

Use different origins for development and production. Never ship localhost
origins in production builds.

### Same-Origin Communication

**Correct - Same-Origin Setup**:

```typescript
// Parent window
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [window.location.origin],
});

// Child iframe (same origin)
const childParley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [window.location.origin],
});
```

When both windows are on the same origin, use `window.location.origin` (or omit
`allowedOrigins`, which defaults to it).

## Common Mistakes

These are the most common origin validation mistakes.

### Mistake 1: Trying to Use a Wildcard

**WRONG - Wildcard Origin**:

```typescript
// Throws at create(): 'Configuration error: ...'
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['*'],
});
```

**Why this is wrong**: Accepting any origin would let any website send messages
to your application. ParleyJS refuses this configuration outright, and patterns
like `'*.example.com'` are rejected too: there is no pattern matching.

**CORRECT - Explicit Origins**:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted-domain.com'],
});
```

For troubleshooting configuration errors, see
[Common Errors: Security Vulnerabilities](../troubleshooting/common-errors.md#security-vulnerabilities).

### Mistake 2: Mixing HTTP and HTTPS

**WRONG - Wrong Scheme**:

```typescript
// Parent on HTTPS, child on HTTP
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['http://child.example.com'], // Wrong scheme
});
```

**Why this is wrong**: If your parent is on HTTPS but you allow HTTP origins, an
attacker can perform a downgrade attack. Mixed content may also be blocked by
browsers.

**CORRECT - Consistent HTTPS**:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
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
    targetType: 'iframe',
    allowedOrigins: ['https://widget.example.com'], // Missing :8443
});
```

**Why this is wrong**: The origin includes the port number. If your child iframe
runs on a non-standard port, you must include it in allowedOrigins.

**CORRECT - Include Port**:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://widget.example.com:8443'],
});
```

Note: Default ports (80 for HTTP, 443 for HTTPS) are implicit and don't need to
be specified. For troubleshooting port-related origin errors, see
[Origin Mismatch Errors](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 4: Using Subdomains Incorrectly

**WRONG - Assuming Subdomain Matching**:

```typescript
// Does NOT accept widget.example.com or api.example.com
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://example.com'], // Only exact match
});
```

**Why this is wrong**: ParleyJS does not support subdomain matching.
`https://example.com` will not match `https://widget.example.com` or
`https://api.example.com`, and `'https://*.example.com'` is rejected by
`Parley.create()`.

**CORRECT - List All Subdomains**:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
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
    targetType: 'iframe',
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

const parley = Parley.create({ targetType: 'iframe', allowedOrigins });
```

For troubleshooting localhost configuration issues, see
[Common Errors: Origin Mismatch](../troubleshooting/common-errors.md#origin-mismatch-errors).

### Mistake 6: Empty Allowed Origins

**WRONG - No Origins Specified**:

```typescript
// Throws at create(): allowedOrigins cannot be empty
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [],
});
```

**Why this is wrong**: An empty list could never accept a message, so
`Parley.create()` rejects it. Either list the origins you trust or omit the
option to default to `[window.location.origin]`.

**CORRECT - Specify Origins**:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
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
    // Origin was validated automatically by ParleyJS
    // AND validate message content
    if (!payload.action || typeof payload.action !== 'string') {
        respond({ success: false, error: 'Invalid action' });
        return;
    }

    // Allowlist actions
    const allowedActions = ['save', 'load', 'delete'];
    if (!allowedActions.includes(payload.action)) {
        respond({ success: false, error: 'Unauthorized action' });
        return;
    }

    // Execute only allowlisted actions
    performAction(payload.action);
    respond({ success: true });
});
```

Origin validation is necessary but not sufficient. Always validate message
content. For comprehensive message validation strategies, see
[Message Validation Guide](./message-validation.md).

## Real-World Examples

These examples show correct origin validation in common scenarios. Both sides
call `connect()`; the child/popup side keeps re-sending its handshake until the
other side answers, so no `load` listeners or delays are needed.

### iFrame Communication

**Parent Window**:

```typescript
import { Parley } from 'ignite-parleyjs';

// Parent on https://myapp.example.com
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://widget.example.com'],
});

// Connect to iframe
const iframe = document.getElementById('widget-iframe') as HTMLIFrameElement;
await parley.connect(iframe, 'widget');

// Send configuration
await parley.send('configure', { theme: 'dark' }, { targetId: 'widget' });
```

**Child Iframe (widget.example.com)**:

```typescript
import { Parley } from 'ignite-parleyjs';

// Child on https://widget.example.com
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://myapp.example.com'], // parent origin first
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
    targetType: 'window',
    allowedOrigins: ['https://auth.example.com'],
});

// Open OAuth popup
const popup = window.open('https://auth.example.com/oauth', 'oauth');

parley.on('auth:success', (payload) => {
    handleToken(payload.token);
    popup?.close();
});

await parley.connect(popup!, 'auth-popup');
```

**Popup Window (auth.example.com)**:

```typescript
// Popup on https://auth.example.com
const parley = Parley.create({
    targetType: 'window',
    allowedOrigins: ['https://myapp.example.com'], // opener origin first
});

// Connect to the opener first
await parley.connect(window.opener, 'main');

// After OAuth success
await parley.send(
    'auth:success',
    { token: 'oauth-token-xyz' },
    { targetId: 'main', expectsResponse: false }
);
```

For complete popup communication and OAuth flow examples, see
[Popup Communication Guide](../guides/popup-communication.md).

### Multi-Window Dashboard

**Dashboard (Hub)**:

```typescript
// Dashboard on https://dashboard.example.com
const parley = Parley.create({
    targetType: 'iframe',
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

// Broadcast theme change to all widgets (fire-and-forget, returns void)
parley.broadcast('theme:change', { theme: 'dark' });
```

**Widget Iframes**:

```typescript
// Each widget iframe
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://dashboard.example.com'],
});

parley.on('theme:change', (payload) => {
    applyTheme(payload.theme);
});

await parley.connect(window.parent, 'dashboard');
```

Because each connection is bound to its own iframe window, the analytics widget
cannot impersonate the metrics widget even though both origins are in the
dashboard's allowlist. For managing multiple window connections and
broadcasting, see
[Multi-Window Communication Guide](../guides/multi-window-communication.md).

### Cross-Origin Widget with Fallback

**Application**:

```typescript
const isDevelopment = window.location.hostname === 'localhost';

const parley = Parley.create({
    targetType: 'iframe',
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

await parley.connect(iframe, 'widget');
```

## Testing Origin Validation

Test origin validation to ensure only trusted origins are accepted.

Dispatching hand-made `MessageEvent`s at `window` is **not** a useful test: such
events do not have Parley's protocol shape and do not come from the connected
window (`event.source`), so they are dropped regardless of origin and a "handler
not called" assertion would pass for the wrong reason. Instead, unit-test the
origin rules directly and use end-to-end tests with real cross-origin pages for
the full flow.

### Unit Testing the Origin Rules

```typescript
import { describe, it, expect } from 'vitest';
import { Parley, DefaultSecurityLayer } from 'ignite-parleyjs';

describe('Origin Validation', () => {
    const security = new DefaultSecurityLayer();
    const allowed = ['https://trusted.com'];

    it('accepts an exact match', () => {
        expect(security.validateOrigin('https://trusted.com', allowed)).toBe(
            true
        );
    });

    it('normalizes case', () => {
        expect(security.validateOrigin('https://TRUSTED.com', allowed)).toBe(
            true
        );
    });

    it('rejects unauthorized origins', () => {
        expect(security.validateOrigin('https://evil.com', allowed)).toBe(
            false
        );
    });

    it('rejects a different scheme', () => {
        expect(security.validateOrigin('http://trusted.com', allowed)).toBe(
            false
        );
    });

    it('rejects a different port', () => {
        expect(
            security.validateOrigin('https://trusted.com:8080', allowed)
        ).toBe(false);
    });

    it('rejects lookalike and subdomain origins', () => {
        expect(
            security.validateOrigin('https://trusted.com.evil.com', allowed)
        ).toBe(false);
        expect(
            security.validateOrigin('https://sub.trusted.com', allowed)
        ).toBe(false);
    });

    it('handles multiple allowed origins', () => {
        const many = ['https://trusted1.com', 'https://trusted2.com'];
        expect(security.validateOrigin('https://trusted1.com', many)).toBe(
            true
        );
        expect(security.validateOrigin('https://trusted2.com', many)).toBe(
            true
        );
    });

    it('rejects wildcard and empty configurations at create()', () => {
        expect(() =>
            Parley.create({ targetType: 'iframe', allowedOrigins: ['*'] })
        ).toThrow(/Configuration error/);
        expect(() =>
            Parley.create({ targetType: 'iframe', allowedOrigins: ['null'] })
        ).toThrow(/Configuration error/);
        expect(() =>
            Parley.create({ targetType: 'iframe', allowedOrigins: [] })
        ).toThrow(/Configuration error/);
    });
});
```

### Integration / End-to-End Testing

Real origin checks depend on the browser setting `event.origin` and
`event.source`, so the full flow is best tested with an end-to-end tool (the
project itself uses Playwright, `npm run test:e2e`) serving the parent and child
from **different origins**:

- With matching `allowedOrigins` on both sides, `connect()` resolves and
  messages flow.
- With the child's origin missing from the parent's `allowedOrigins`, the parent
  drops the child's handshake and the parent's `connect()` rejects with
  `ConnectionError` `ERR_CONNECTION_HANDSHAKE_FAILED` after `timeout`.

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
- Render received strings with `textContent`; Parley does not escape HTML
- Allowlist values for enumerated fields

### HTTPS Enforcement

Always use HTTPS in production:

- Prevents man-in-the-middle attacks
- Ensures origin integrity
- Required for secure cookies and storage APIs
- See [Security Best Practices](../SECURITY.md#1-always-use-https)

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

1. Origin validation and source binding (ParleyJS automatic)
2. Message content validation (schemas + your code)
3. HTTPS enforcement (server configuration)
4. CSP headers (server configuration)
5. Safe rendering / output encoding (your code)

For complete security guidance, see [Security Guide](../SECURITY.md).

## API Reference

### Parley.create() Configuration

```typescript
interface ParleyConfig {
    targetType: 'iframe' | 'window'; // Required
    allowedOrigins?: string[]; // Default: [window.location.origin]
    securityLayer?: SecurityLayer; // Default: new DefaultSecurityLayer()
    // ... other config options
}

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted-domain.com'],
});
```

**allowedOrigins** (optional):

- Type: `string[]`
- Default: `[window.location.origin]`
- Must be explicit origins: `'https://example.com'`
- Normalized to URL origin and lowercased; compared by exact match
- Cannot be empty and cannot contain `'*'`, `'null'` or `''` (create() throws)
- No wildcard or subdomain patterns
- On the iframe child / popup side, the first entry is where the handshake is
  sent, so list the parent's / opener's origin first

**securityLayer** (optional): a custom `SecurityLayer` whose
`validateOrigin(origin, allowedOrigins)` runs on every inbound message after the
channel's own check. It can further restrict origins but cannot accept origins
the channel already dropped. See
[Security Guide: Custom Security Layer](../SECURITY.md#custom-security-layer).

For complete API documentation, see:

- [Parley.create() Reference](../api-reference/methods.md#parleycreate)
- [Configuration Options](../api-reference/index.md#configuration)
- [Security Guide](../SECURITY.md)

## Security Checklist

Before deploying to production:

- [ ] Every origin listed explicitly (no `*` or patterns)
- [ ] All origins use HTTPS (not HTTP)
- [ ] Port numbers included if non-standard
- [ ] No localhost origins in production
- [ ] Environment-specific configuration
- [ ] Parent / opener origin listed first on the child / popup side
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
