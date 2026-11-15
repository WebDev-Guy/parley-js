[Home](../index.md) > [Documentation](./index.md) > Security

# Security Guide

Security best practices for cross-window communication with ParleyJS.

## Overview

Cross-window communication has inherent security risks. This section covers
ParleyJS security features, best practices, and common security pitfalls.

ParleyJS implements security-first design with exact-match origin validation,
source-bound connections, protocol and schema validation, and size limits built
in. It does not escape HTML or protect against replayed messages; those remain
your application's responsibility.

## Contents

### Security Topics

- **[Origin Validation](./origin-validation.md)** - Validating message sources
    - Why origin validation matters
    - Configuring allowed origins
    - Common mistakes
    - Testing origin validation

- **[Message Validation](./message-validation.md)** - Validating message content
    - Schema validation
    - Supported JSON Schema keywords
    - Input sanitization and safe rendering (your responsibility)
    - Data type checking

### Complete Security Guide

- **[SECURITY.md](../SECURITY.md)** - Comprehensive security documentation
    - Threat model
    - Attack prevention
    - Security testing
    - Reporting security issues

## Critical Security Rules

**Always**:

1. List every allowed origin explicitly (`*` and patterns are not supported)
2. Validate message content before processing
3. Use HTTPS in production
4. Render received strings with `textContent` (or sanitize HTML) before
   displaying
5. Never send sensitive data through postMessage

**Never**:

1. Use wildcard patterns such as `'*.example.com'` (rejected: list each origin)
2. Trust message content without validation
3. Send passwords or tokens
4. Execute code from messages
5. Write a custom `validateOrigin()` that accepts more than you intend

## Quick Security Checklist

Before deploying:

- [ ] Origins are explicitly configured (every origin listed exactly)
- [ ] HTTPS is used in production
- [ ] Message content is validated
- [ ] `exposeHandlerErrors` is off in production (the default)
- [ ] Security tests pass
- [ ] Code reviewed for security issues

## Common Security Mistakes

**Mistake 1: Wildcard origins**

```javascript
// REJECTED: Parley.create() throws 'Configuration error: ...'
allowedOrigins: ['*'];
allowedOrigins: ['*.trusted-domain.com']; // any entry containing '*' is rejected

// CORRECT
allowedOrigins: ['https://trusted-domain.com'];
```

**Mistake 2: Not validating content**

```javascript
// DANGEROUS
parley.on('update', (data) => {
    element.innerHTML = data.html; // XSS risk!
});

// CORRECT
parley.on('update', (data) => {
    element.textContent = data.text; // Safe
});
```

**Mistake 3: Sending sensitive data**

```javascript
// DANGEROUS
await parley.send('login', { password: 'secret123' });

// CORRECT
await parley.send('login', { sessionToken: token });
```

## Security Features

ParleyJS provides:

- **Automatic origin validation** - Exact-match allowlist; messages from other
  origins are dropped. `'*'`, `'null'` and empty lists are rejected at
  `create()` (1.1.0)
- **Source binding** - Each connection only accepts messages from its own target
  window, and responses only from the target that was asked (1.1.0)
- **Verified origin** - `metadata.origin` is the browser-supplied `event.origin`
  (1.1.0)
- **Protocol validation** - Structure and version of every inbound message are
  verified, and your `SecurityLayer` is invoked on every inbound message (1.1.0)
- **Schema validation** - Optional, per message type via `register()`
- **Payload cloning** - Outgoing payloads are JSON-cloned (functions and
  `undefined` dropped; circular references throw). This is **not** XSS
  protection: strings are delivered unchanged
- **Size limit** - Outgoing payloads over 10 MB are rejected
- **Rate limiting (opt-in)** - `rateLimit: { enabled: true }` limits your own
  outgoing `send()` calls; inbound messages are not rate-limited
- **Error safety** - Handler error messages are replaced with `'Handler error'`
  unless `exposeHandlerErrors: true` (1.1.0)

For details, see [SECURITY.md](../SECURITY.md).

## Testing Security

Security must be tested:

```javascript
import { DefaultSecurityLayer } from 'ignite-parleyjs';

// Test the origin rules directly
it('should reject messages from wrong origin', () => {
    const security = new DefaultSecurityLayer();
    const allowed = ['https://trusted-domain.com'];

    expect(security.validateOrigin('https://trusted-domain.com', allowed)).toBe(
        true
    );
    expect(security.validateOrigin('https://evil.com', allowed)).toBe(false);
});
```

Hand-dispatched `MessageEvent`s are not a meaningful test: they are dropped for
not coming from the connected window regardless of origin. Use end-to-end tests
with real cross-origin pages for the full flow.

For more testing patterns, see [Testing Patterns](../TESTING_PATTERNS.md).

## Related Sections

- **[Origin Validation](./origin-validation.md)** - Origin security details
- **[Message Validation](./message-validation.md)** - Content validation
- **[SECURITY.md](../SECURITY.md)** - Complete security guide
- **[Error Handling](../patterns/error-handling.md)** - Secure error handling
- **[Testing Patterns](../TESTING_PATTERNS.md)** - Security testing

## Reporting Security Issues

Found a security issue? See
[Reporting Security Issues](../SECURITY.md#reporting-security-issues).

Do not open public issues for security vulnerabilities.

---

## Navigation

**Security Topics**:

- [Origin Validation](./origin-validation.md)
- [Message Validation](./message-validation.md)

**Related**:

- [Complete Security Guide](../SECURITY.md)
- [Testing Security](../TESTING_PATTERNS.md)

**Back to**: [Documentation Home](./index.md) | [Project Home](../index.md)
