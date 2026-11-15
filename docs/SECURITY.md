[Home](./index.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Security Guide

# Security Guide

Parley-js implements **security-first design** for cross-window communication.
This document describes what Parley protects against, what it does not, and what
your application still has to do itself.

## Overview

Cross-window communication via `postMessage` has inherent security risks.
Parley-js is designed with security as a primary concern and provides these
layers of protection:

- **Origin Validation** - Exact-match origin allowlist; `'*'` and `'null'` are
  rejected
- **Source Binding** - Each connection only accepts messages from its own target
  window
- **Message Validation** - Protocol structure and version checks, plus your JSON
  Schemas
- **Payload Cloning** - Outgoing payloads are JSON-cloned (functions and other
  non-JSON values are dropped; circular references throw)
- **Limits** - Fixed 10 MB outgoing payload limit, optional outgoing rate
  limiting, listener limits
- **Error Safety** - Handler error messages are not sent to the other window by
  default

Parley does **not** escape HTML, prevent XSS in your rendering code, sign or
encrypt messages, or protect against replayed messages. See
[What Your Application Must Do](#what-your-application-must-do).

## Table of Contents

1. [Threat Model](#threat-model)
2. [1.1.0 Security Hardening](#110-security-hardening)
3. [Core Security Features](#core-security-features)
4. [What Your Application Must Do](#what-your-application-must-do)
5. [Security Best Practices](#security-best-practices)
6. [Security Testing](#security-testing)
7. [Attack Prevention](#attack-prevention)
8. [Reporting Security Issues](#reporting-security-issues)

---

## Threat Model

### Potential Attack Vectors

1. **Origin Spoofing** - Malicious sites attempting to send messages
2. **Message Injection** - Injecting malicious payloads (XSS, code execution)
3. **Data Exfiltration** - Stealing sensitive data via cross-origin messages
4. **Clickjacking** - Embedding your app in a malicious iframe
5. **Replay Attacks** - Re-sending captured messages
6. **Denial of Service** - Flooding with messages, resource exhaustion
7. **Information Disclosure** - Leaking sensitive data through error messages

Parley addresses origin spoofing (origin allowlist + source binding),
information disclosure through handler errors, and some resource exhaustion
(outgoing size limit, optional outgoing rate limit). Message injection,
clickjacking and replay attacks must be handled by your application and your
HTTP headers (see below).

## 1.1.0 Security Hardening

Version 1.1.0 tightened several defaults. If you are upgrading, review these:

- **Source-bound connections** - Each connection only accepts messages
  (including the handshake) whose `event.source` is its own target window. A
  different window that happens to share an allowed origin can no longer talk to
  that connection.
- **Browser-verified origin** - `metadata.origin` (and the `origin` in
  `system:message_received`) is the browser-supplied `event.origin`, not a value
  reported by the sender.
- **SecurityLayer enforced on inbound messages** - Every inbound message is
  checked with `securityLayer.validateOrigin()`, protocol structure and major
  version, and (for requests) `securityLayer.validateMessage()`. Custom security
  layers are now actually invoked on every message.
- **Responses bound to the requested target** - A response is only accepted from
  the target the request was sent to.
- **Stricter configuration** - `Parley.create()` throws if `allowedOrigins` is
  empty or contains `'*'`, `'null'` or an empty string.
- **Handler errors hidden by default** - When a handler throws, the remote side
  receives `'Handler error'` unless the receiving instance sets
  `exposeHandlerErrors: true`.
- **No silent payload replacement** - Payloads that cannot be serialized
  (circular references, BigInt) now throw a `SerializationError` instead of
  being sent as `{}`.

## Core Security Features

For secure coding patterns, see [Code Patterns](./CODE_PATTERNS.md). For
security testing, see [Testing Patterns](./TESTING_PATTERNS.md).

### 1. Origin Validation

**Always configure allowed origins explicitly:**

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    // Good: Explicit allowlist
    allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
});
```

If you omit `allowedOrigins`, it defaults to `[window.location.origin]`
(same-origin only).

**Wildcards are not supported:**

```typescript
// Throws at Parley.create(): 'Configuration error: ...'
allowedOrigins: ['*'];
allowedOrigins: ['*.example.com']; // no pattern matching: any '*' is rejected
allowedOrigins: ['null'];
allowedOrigins: [];

// Correct: list every origin explicitly
allowedOrigins: ['https://a.example.com', 'https://b.example.com'];
```

**How origins are compared:**

- Each configured origin is normalized to its URL origin (scheme, host, port)
  and lowercased, then compared to `event.origin` with an **exact match**
- Protocol must match (`https://` vs `http://`)
- Port must match (`https://example.com` vs `https://example.com:8443`)
- No subdomain or suffix matching (`https://evil-example.com` does not match
  `https://example.com`)
- The opaque `'null'` origin (sandboxed iframes, `data:` URLs, `file://`) is
  never accepted

Messages from origins that are not allowed are dropped silently by the channel
(logged at `warn` level when `logLevel` allows it). See
[Origin Validation](./security/origin-validation.md) for details.

### 2. Source Binding

Origin checks alone cannot distinguish two windows from the same origin. Since
1.1.0, every connection also checks `event.source`: a message is only accepted
if it comes from the exact window object the connection was made with
(`connect(iframe)` / `connect(window.parent)` / `connect(popup)` /
`connect(window.opener)`). Responses are additionally only accepted from the
target the original request was sent to.

### 3. Payload Sanitization (JSON Cloning)

The default security layer (`DefaultSecurityLayer`) "sanitizes" every
**outgoing** payload and response with a JSON round-trip clone:

```typescript
await parley.send('save', {
    name: 'Ada',
    callback: () => {}, // dropped (functions are not JSON)
    missing: undefined, // dropped
    when: new Date(), // becomes an ISO string
    tags: new Set(['a']), // becomes {}
});

const obj: any = {};
obj.self = obj;
await parley.send('save', obj); // rejects with SerializationError
// (ERR_SERIALIZATION_CIRCULAR_REFERENCE); BigInt values also throw
```

What this does **not** do:

- It does **not** escape or strip HTML, `<script>` tags or `javascript:` URLs.
  Strings arrive exactly as they were sent.
- It does **not** remove `__proto__` or `constructor` keys. (After `JSON.parse`
  they are ordinary own properties and do not change any prototype, but your
  code must not copy them onto other objects blindly.)
- It does **not** limit nesting depth.
- Inbound payloads are delivered to handlers as received from `postMessage`
  (structured clone); they are not sanitized again.

### 4. Protocol Enforcement

Every inbound message must match Parley's protocol structure (enforced
internally):

```typescript
// Valid message structure
{
    _parley: '__parley__',
    _v: '1.0.0',
    _id: 'uuid-string',
    _type: 'message-type',
    _timestamp: 1234567890,
    _origin: 'https://trusted.com', // self-reported, never trusted
    _expectsResponse: true,
    payload: { /* user data */ }
}
```

Messages that are not Parley-shaped are ignored. Parley-shaped messages with an
invalid structure or an incompatible major protocol version are rejected and
reported via `system:error` (`ERR_VALIDATION_INVALID_PROTOCOL` /
`ERR_SECURITY_VERSION_MISMATCH`).

### 5. Resource Limits

**Payload size:** outgoing payloads larger than **10 MB** (serialized) are
rejected with a `ValidationError` before sending. This limit is fixed and not
configurable.

**Rate limiting (opt-in):**

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted.com'],
    rateLimit: { enabled: true, messagesPerSecond: 50 },
});

// send() rejects with ParleyError ERR_SECURITY_RATE_LIMITED when exceeded
```

The built-in rate limiter applies to **outgoing `send()` calls only** (not
`broadcast()`, not inbound messages), using a fixed one-second window per
`targetId`. It protects the other side from a runaway sender in your own code;
it does not protect you from a peer that floods you.

**Schema depth:** when a schema is registered, validation stops at a nesting
depth of 50 and reports an error.

**Listener limits:** the internal event emitter allows at most 100 listeners per
system event and throws when the limit is exceeded, which surfaces listener
leaks early.

### 6. Schema Validation

Validate payloads against a JSON Schema by registering the type, then handle it
with `on()`:

```typescript
parley.register('sensitive-action', {
    schema: {
        type: 'object',
        properties: {
            userId: { type: 'string', pattern: '^[a-z0-9]{24}$' },
            action: { type: 'string', enum: ['read', 'write', 'delete'] },
        },
        required: ['userId', 'action'],
        additionalProperties: false, // Reject unknown properties
    },
    onError: (error, metadata) => {
        securityLog.warn('Rejected sensitive-action', {
            code: error.code,
            origin: metadata.origin,
        });
    },
});

parley.on('sensitive-action', async (payload, respond, metadata) => {
    respond(await performAction(payload));
});
```

Schemas are checked on send (locally) and on receive (by the receiver's
registered schema). Only a subset of JSON Schema is supported; unsupported
keywords such as `format`, `minItems` and `maxItems` are silently ignored. See
[Message Validation](./security/message-validation.md).

### 7. Error Information Disclosure Prevention

When a handler throws, the sender receives a `ParleyError` with code
`ERR_HANDLER_ERROR` and the generic message `'Handler error'`. The real error
message is only sent if the **receiving** instance opts in:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted.com'],
    exposeHandlerErrors: false, // default; set true only for debugging
});
```

Locally, the full error is still available via `system:error` and the type's
`onError` callback, so you can log it without leaking it.

## What Your Application Must Do

Parley moves data safely between windows you trust. It cannot decide what that
data means. Your application is responsible for:

- **Rendering safely** - Display received strings with `textContent`, not
  `innerHTML`. If you must render HTML, sanitize it with a library such as
  DOMPurify.
- **Business validation and authorization** - Schemas check shape, not
  permission. Check that the sender is allowed to perform the action.
- **Never executing received data** - No `eval()`, `new Function()`, or dynamic
  `import()` with received strings.
- **Replay protection, if needed** - Parley does not check message age or
  uniqueness. For sensitive operations, include a nonce or one-time token in the
  payload and verify it in your handler.
- **Inbound rate limiting, if needed** - The built-in limiter only covers your
  own `send()` calls.
- **Sensitive data handling** - Messages are not encrypted or signed. Do not
  send secrets to a window you do not fully trust.
- **HTTP headers** - Configure CSP `frame-ancestors` / `X-Frame-Options` against
  clickjacking.

## Security Best Practices

### 1. Always Use HTTPS

```typescript
// Always use https:// in production
allowedOrigins: ['https://secure.example.com'];

// Never use http:// in production
allowedOrigins: ['http://insecure.example.com'];
```

### 2. Minimal Origin List

Only allow origins that absolutely need to communicate:

```typescript
// Good: Minimal, explicit list
allowedOrigins: ['https://app.mycompany.com', 'https://widget.mycompany.com'];

// Bad: Overly permissive
allowedOrigins: [
    'https://app.mycompany.com',
    'https://widget.mycompany.com',
    'https://dev.mycompany.com', // Should be separate config
    'https://staging.mycompany.com', // Should be separate config
    'https://partner1.com', // Are you sure?
    'https://partner2.com', // Are you sure?
];
```

### 3. Validate All Incoming Data

Never trust incoming payloads, even from allowed origins:

```typescript
parley.register('update-user', { schema: updateUserSchema });

parley.on('update-user', async (payload, respond, metadata) => {
    // Business rules the schema cannot express
    if (!isValidUserId(payload.userId)) {
        respond({ success: false, error: 'Invalid user ID' });
        return;
    }

    // Authorization (metadata.origin is browser-verified)
    if (!canUserUpdate(metadata.origin, payload.userId)) {
        respond({ success: false, error: 'Unauthorized' });
        return;
    }

    respond({
        success: true,
        user: await updateUser(payload.userId, payload.name),
    });
});
```

### 4. Limit Sensitive Operations

Don't expose dangerous operations via postMessage:

```typescript
// DANGEROUS: Direct database access
parley.on('execute-query', async (payload, respond) => {
    respond(await db.query(payload.sql)); // SQL injection risk!
});

// SAFE: Predefined operations only
parley.on('get-user', async (payload, respond) => {
    respond(await db.users.findById(payload.userId));
});
```

### 5. Rate Limiting

For your own outgoing traffic, enable the built-in limiter:

```typescript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted.com'],
    rateLimit: { enabled: true, messagesPerSecond: 100 },
});
```

Parley does not rate-limit **inbound** messages. If a peer could flood an
expensive handler, add your own limiter in the handler:

```typescript
const rateLimiter = new MyRateLimiter({ windowMs: 60000, maxRequests: 100 });

parley.on('api-call', async (payload, respond, metadata) => {
    if (!rateLimiter.allow(metadata.senderId)) {
        respond({ success: false, error: 'Rate limit exceeded' });
        return;
    }
    respond(await makeApiCall(payload));
});
```

### 6. Logging and Monitoring

Log security-relevant events:

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.ERROR, (data) => {
    const event = data as { code: string; message: string; targetId?: string };

    switch (event.code) {
        case 'ERR_SECURITY_ORIGIN_MISMATCH': // custom validateOrigin() rejected
        case 'ERR_VALIDATION_INVALID_PROTOCOL': // malformed / rejected message
        case 'ERR_SECURITY_VERSION_MISMATCH': // incompatible protocol version
            securityLog.warn('Inbound message rejected', event);
            break;
        case 'ERR_HANDLER_ERROR': // one of your handlers threw
            errorLog.error('Handler failed', event);
            break;
    }
});

// Requires analyticsEnabled: true
parley.onAnalyticsEvent((event) => {
    auditLog.info('Cross-origin message', event);
});
```

Note: messages from disallowed origins are dropped silently by the channel and
do **not** emit `system:error`; use `logLevel: 'warn'` (or lower) to see them in
the console.

## Security Checklist

Before deploying to production:

- [ ] **HTTPS only** - All allowed origins use HTTPS
- [ ] **Explicit origins** - Every origin listed exactly (no patterns)
- [ ] **Schema validation** - Sensitive types registered with a schema
- [ ] **Error handling** - `exposeHandlerErrors` left off in production
- [ ] **Safe rendering** - Received strings rendered with `textContent`
- [ ] **Rate limiting** - Implemented for expensive inbound operations
- [ ] **Logging** - `system:error` events are logged
- [ ] **Monitoring** - Alerts for suspicious activity
- [ ] **CSP headers** - Content Security Policy configured
- [ ] **X-Frame-Options** - Clickjacking protection
- [ ] **Testing** - Security tested with various attack payloads

---

## Security Testing

Parley-js includes security tests that validate its protection mechanisms. See
[TESTING.md](./TESTING.md) for complete testing documentation.

### Security Test Suite

Located in `tests/security/`, these tests verify:

1. **Origin Validation** (`origin-validation.test.ts`)
    - Unauthorized origin rejection
    - Protocol and port matching
    - Subdomain bypass prevention
    - Null origin handling

2. **Payload Sanitization** (`payload-sanitization.test.ts`)
    - JSON-clone behaviour (functions/symbols/undefined dropped)
    - Circular references and BigInt raise `SerializationError`

3. **PostMessage Security** (`postmessage-security.test.ts`)
    - Wildcard prevention in targetOrigin
    - Specific origin enforcement
    - Null origin handling

4. **Schema Validation DoS** (`schema-validation-dos.test.ts`)
    - Schema depth limit
    - Error collection limits
    - Resource exhaustion prevention

5. **Payload Size Limits** (`payload-size-limits.test.ts`)
    - 10 MB limit enforcement
    - Clear error messaging

6. **Listener Limits** (`listener-limits.test.ts`)
    - Memory leak prevention
    - Per-event listener limits
    - Cleanup on removal

7. **Message Validation** (`message-validation.test.ts`)
    - Required field validation
    - Field type validation

8. **Error Info Disclosure** (`error-info-disclosure.test.ts`)
    - Generic handler error messages by default
    - Error code usage

9. **Inbound Hardening** (`inbound-hardening.test.ts`)
    - Source binding and response binding
    - SecurityLayer enforcement on inbound messages

### Running Security Tests

```bash
# Run all security tests
npx vitest run tests/security/

# Run specific security test
npx vitest run tests/security/origin-validation.test.ts

# Run with coverage
npm run test:coverage -- tests/security/
```

---

## Attack Prevention

### What Parley Handles

1. **Origin Spoofing**

    ```typescript
    // The browser-supplied event.origin is checked against allowedOrigins,
    // and event.source must be the connected target window.
    // metadata.origin in handlers is that verified origin.
    ```

2. **Code Injection via Functions**

    ```typescript
    // Functions cannot cross postMessage; outgoing payloads are JSON-cloned
    // and functions are dropped.
    const payload = {
        callback: function () {
            maliciousCode();
        },
    }; // sent as {}
    ```

3. **DoS via Large Outgoing Payloads**

    ```typescript
    // Rejected before sending: exceeds the fixed 10 MB limit
    const payload = { data: 'x'.repeat(11_000_000) };
    ```

### What Your Application Handles

1. **XSS** - Strings such as `'<script>alert("XSS")</script>'` or
   `'javascript:void(0)'` are delivered unchanged. Never insert them with
   `innerHTML` or use them as URLs without validation.

2. **Prototype Pollution** - Payloads may contain keys like `__proto__` or
   `constructor`. Don't merge payloads into other objects with `Object.assign` /
   deep-merge helpers; copy only known keys.

3. **Deep Nesting / Large Inbound Payloads** - Parley does not limit the depth
   or size of inbound payloads. Use a schema with `additionalProperties: false`
   and `maxLength` to constrain what you accept.

4. **Replay** - Parley has no timestamp-freshness or nonce checks.

---

## Content Security Policy (CSP)

Configure CSP to restrict iframe sources:

```http
Content-Security-Policy: frame-ancestors 'self' https://trusted-parent.com
```

Note: `frame-ancestors` is ignored when delivered via a `<meta>` tag; send it as
an HTTP response header.

## Clickjacking Protection

If your app should not be embedded:

```http
X-Frame-Options: DENY
```

If only specific parents are allowed:

```http
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: frame-ancestors 'self'
```

## Custom Security Layer

For advanced use cases, provide a custom security layer. `SecurityLayer` is an
abstract **class** with three methods; the easiest approach is to extend
`DefaultSecurityLayer` and override only what you need:

```typescript
import {
    Parley,
    DefaultSecurityLayer,
    type MessageProtocol,
} from 'ignite-parleyjs';

class EnterpriseSecurityLayer extends DefaultSecurityLayer {
    constructor(private readonly blockedOrigins: Set<string>) {
        super();
    }

    validateOrigin(origin: string, allowedOrigins: string[]): boolean {
        if (this.blockedOrigins.has(origin)) {
            return false;
        }
        return super.validateOrigin(origin, allowedOrigins);
    }

    validateMessage(message: MessageProtocol): boolean {
        if (!super.validateMessage(message)) {
            return false;
        }
        // Custom checks, e.g. only allow known message types
        return ALLOWED_TYPES.has(message._type);
    }

    // sanitizePayload<T>(payload: T): T is inherited (JSON clone)
}

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://trusted.com'],
    securityLayer: new EnterpriseSecurityLayer(
        new Set(['https://known-bad.com'])
    ),
});
```

If you extend `SecurityLayer` directly, implement all three:
`validateOrigin(origin, allowedOrigins): boolean`,
`sanitizePayload<T>(payload: T): T` and
`validateMessage(message: MessageProtocol): boolean`.

How they are used (since 1.1.0):

- `validateOrigin()` runs on **every** inbound message (after the channel's own
  exact-match origin check, so it can only narrow, not widen, the allowed
  origins). A rejection emits `system:error` with
  `ERR_SECURITY_ORIGIN_MISMATCH`.
- `validateMessage()` runs on every inbound request (not responses). A rejection
  emits `system:error` with `ERR_VALIDATION_INVALID_PROTOCOL`.
- `sanitizePayload()` runs on every outgoing payload and response.

## Common Vulnerabilities and Mitigations

### 1. Prototype Pollution

```typescript
// Vulnerable: Copying arbitrary keys
function processPayload(payload: any) {
    for (const key in payload) {
        this.config[key] = payload[key]; // Prototype pollution!
    }
}

// Safe: Copy known keys only
function processPayload(payload: unknown) {
    if (!isPlainObject(payload)) return;

    const allowedKeys = ['name', 'value'];
    for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            this.config[key] = (payload as any)[key];
        }
    }
}
```

### 2. eval() and Function()

```typescript
// NEVER: Execute code from messages
parley.on('execute', (payload) => {
    eval(payload.code); // Remote code execution!
});

// NEVER: Dynamic function creation
parley.on('run', (payload) => {
    new Function(payload.body)(); // Remote code execution!
});
```

### 3. innerHTML

```typescript
// Vulnerable: XSS (Parley does not escape HTML)
parley.on('update-ui', (payload) => {
    document.getElementById('output').innerHTML = payload.html;
});

// Safe: Use textContent
parley.on('update-ui', (payload) => {
    document.getElementById('output').textContent = payload.text;
});

// Safe: Sanitize HTML
parley.on('update-ui', (payload) => {
    const sanitized = DOMPurify.sanitize(payload.html);
    document.getElementById('output').innerHTML = sanitized;
});
```

---

## Reporting Security Issues

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please email security issues to: **security@igniteworks.com**

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

We will respond within 48 hours and work with you to address the issue.

---

## Incident Response

If you detect a security incident:

1. **Log the details** - Capture origin, payload, timestamp
2. **Block the origin** - Remove it from `allowedOrigins` or block it in a
   custom security layer
3. **Alert the team** - Notify security team
4. **Investigate** - Determine the scope
5. **Remediate** - Fix vulnerabilities
6. **Review** - Update security policies

```typescript
parley.onSystem(SYSTEM_EVENTS.ERROR, async (data) => {
    const event = data as { code: string; message: string; targetId?: string };
    if (!event.code.startsWith('ERR_SECURITY_')) return;

    // 1. Log
    logger.error('Security violation', event);

    // 2. Alert
    alertService.notify('security-team', {
        type: 'cross-origin-attack',
        details: event,
    });

    // 3. Disconnect
    if (event.targetId && parley.isConnected(event.targetId)) {
        await parley.disconnect(event.targetId);
    }
});
```

---

## Resources

- <a href="https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#postmessage" target="_blank">OWASP
  postMessage Security</a>
- <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage" target="_blank">MDN:
  Window.postMessage()</a>
- <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP" target="_blank">Content
  Security Policy</a>
- <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options" target="_blank">X-Frame-Options</a>
- [Testing Guide](./TESTING.md) - Security testing documentation

---

**Questions?** Open an issue or contact us at security@igniteworks.com

## Navigation

### Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Code Patterns](./CODE_PATTERNS.md) - Secure coding patterns
- [Testing Guide](./TESTING.md) - Security testing strategies
- [Examples](./EXAMPLES.md) - Secure implementation examples
- [Origin Validation](./security/origin-validation.md) - Origin rules in depth
- [Message Validation](./security/message-validation.md) - Schema validation

### See Also

- [Troubleshooting](./TROUBLESHOOTING.md) - Common security issues
- [Architecture](./ARCHITECTURE.md) - Security layer design

**Back to**: [Documentation Home](./index.md)
