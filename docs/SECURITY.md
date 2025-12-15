[Home](./index.md) > [Documentation](./FRAMEWORK_REFERENCE.md) > Security Guide

# Security Guide

Parley-js implements **security-first design** for cross-window communication.
This document outlines security features, best practices, and testing
strategies.

## Overview

Cross-window communication via `postMessage` has inherent security risks.
Parley-js is designed with security as a primary concern, implementing multiple
layers of protection:

- **Origin Validation** - Strict origin whitelist enforcement
- **Payload Sanitization** - XSS/injection prevention
- **DoS Prevention** - Size limits, rate limiting, deep nesting protection
- **Message Validation** - Protocol structure validation
- **Error Safety** - No sensitive information disclosure

## Table of Contents

1. [Threat Model](#threat-model)
2. [Core Security Features](#core-security-features)
3. [Security Best Practices](#security-best-practices)
4. [Security Testing](#security-testing)
5. [Attack Prevention](#attack-prevention)
6. [Reporting Security Issues](#reporting-security-issues)

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

## Core Security Features

For secure coding patterns, see [Code Patterns](./CODE_PATTERNS.md). For
security testing, see [Testing Patterns](./TESTING_PATTERNS.md).

### 1. Origin Validation

**Always configure allowed origins:**

```typescript
const parley = Parley.create({
    // Good: Explicit allowlist
    allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
});
```

**Never use wildcards in production:**

```typescript
// DANGEROUS: Allows any origin
allowedOrigins: ['*'];

// DANGEROUS: Too broad
allowedOrigins: ['*.com'];

// CAREFUL: Only if you trust all subdomains
allowedOrigins: ['*.example.com'];
```

**Origin validation features:**

- Protocol matching (https:// vs http://)
- Port number validation
- Subdomain bypass prevention
- Null origin rejection

### 2. Payload Sanitization

Parley automatically sanitizes all payloads:

```typescript
// Removes dangerous content:
// - Functions
// - Symbols
// - Circular references
// - __proto__ and constructor properties

const sanitized = sanitizePayload({
    data: 'safe',
    dangerous: function () {
        /* removed */
    },
    circular: obj, // handled safely
});
```

### 3. Protocol Enforcement

By default, Parley validates message structure:

```typescript
// Valid message structure (enforced internally)
{
    _v: '1.0.0',
    _id: 'uuid-string',
    _type: 'message-type',
    _timestamp: 1234567890,
    _origin: 'https://trusted.com',
    _expectsResponse: true,
    payload: { /* user data */ }
}
```

Any message not matching this structure is rejected.

### 4. DoS Prevention

**Size Limits:**

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://trusted.com'],
    maxPayloadSize: 1024 * 1024, // 1MB limit
});
```

**Deep Nesting Protection:**

```typescript
// Automatically rejects deeply nested objects
const rejected = {
    a: {
        b: {
            c: {
                d: {
                    e: {
                        f: {
                            /* too deep */
                        },
                    },
                },
            },
        },
    },
};
```

**Listener Limits:**

```typescript
// Prevents memory leaks from excessive listeners
const MAX_LISTENERS = 100;
emitter.setMaxListeners(MAX_LISTENERS);
```

### 5. Timestamp Validation

Parley can reject stale messages:

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://trusted.com'],
    // Reject messages older than 30 seconds
    maxMessageAge: 30000,
});
```

### 6. Schema Validation

Validate payloads against JSON Schema:

```typescript
parley.register('sensitive-action', handler, {
    requestSchema: {
        type: 'object',
        properties: {
            userId: { type: 'string', pattern: '^[a-z0-9]{24}$' },
            action: { type: 'string', enum: ['read', 'write', 'delete'] },
        },
        required: ['userId', 'action'],
        additionalProperties: false, // Reject unknown properties
    },
});
```

### 7. Error Information Disclosure Prevention

Parley sanitizes error messages to prevent information leakage:

```typescript
// Production mode: Generic error messages
try {
    await parley.send('action', data);
} catch (error) {
    // User sees: "Validation failed"
    // Logs contain: Full details for debugging
}
```

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

Never trust incoming payloads:

```typescript
parley.register('update-user', async (payload, metadata) => {
    // Always validate
    if (!isValidUserId(payload.userId)) {
        throw new ValidationError('Invalid user ID');
    }

    // Sanitize input
    const sanitizedName = sanitizeString(payload.name);

    // Check permissions
    if (!canUserUpdate(metadata.origin, payload.userId)) {
        throw new SecurityError('Unauthorized');
    }

    // Now safe to process
    return updateUser(payload.userId, sanitizedName);
});
```

### 4. Limit Sensitive Operations

Don't expose dangerous operations via postMessage:

```typescript
// DANGEROUS: Direct database access
parley.register('execute-query', (payload) => {
    return db.query(payload.sql); // SQL injection risk!
});

// SAFE: Predefined operations only
parley.register('get-user', (payload) => {
    return db.users.findById(payload.userId);
});
```

### 5. Rate Limiting

Implement rate limiting for sensitive operations:

```typescript
const rateLimiter = new RateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 100,
});

parley.register('api-call', async (payload, metadata) => {
    if (!rateLimiter.allow(metadata.origin)) {
        throw new Error('Rate limit exceeded');
    }
    return makeApiCall(payload);
});
```

### 6. Logging and Monitoring

Log security-relevant events:

```typescript
parley.onSystem('error:security', (event) => {
    securityLog.warn('Security violation', {
        origin: event.origin,
        reason: event.reason,
        timestamp: Date.now(),
    });

    // Alert on repeated violations
    if (getViolationCount(event.origin) > 10) {
        alertSecurityTeam(event);
    }
});

parley.onAnalytics((event) => {
    // Track all cross-origin communication
    auditLog.info('Cross-origin message', event);
});
```

## Security Checklist

Before deploying to production:

- [ ] **HTTPS only** - All allowed origins use HTTPS
- [ ] **Explicit origins** - No wildcards or `*`
- [ ] **Schema validation** - All handlers validate input
- [ ] **Error handling** - Errors don't leak sensitive info
- [ ] **Rate limiting** - Implemented for sensitive operations
- [ ] **Logging** - Security events are logged
- [ ] **Monitoring** - Alerts for suspicious activity
- [ ] **CSP headers** - Content Security Policy configured
- [ ] **X-Frame-Options** - Clickjacking protection
- [ ] **Testing** - Security tested with various attack payloads

---

## Security Testing

Parley-js includes **comprehensive security tests** to validate protection
mechanisms. See [TESTING.md](./TESTING.md) for complete testing documentation.

### Security Test Suite

Located in `tests/security/`, these tests verify:

1. **Origin Validation** (`origin-validation.test.ts`)
    - Unauthorized origin rejection
    - Protocol matching enforcement
    - Subdomain bypass prevention
    - Null origin handling

2. **Payload Sanitization** (`payload-sanitization.test.ts`)
    - XSS prevention
    - Code injection prevention
    - Circular reference handling
    - Function/symbol removal

3. **PostMessage Security** (`postmessage-security.test.ts`)
    - Wildcard prevention in targetOrigin
    - Specific origin enforcement
    - Null origin handling

4. **Schema Validation DoS** (`schema-validation-dos.test.ts`)
    - Deep nesting protection
    - Regex DoS prevention
    - Resource exhaustion prevention

5. **Payload Size Limits** (`payload-size-limits.test.ts`)
    - Size limit enforcement
    - Nested payload calculation
    - Clear error messaging

6. **Listener Limits** (`listener-limits.test.ts`)
    - Memory leak prevention
    - Per-event listener limits
    - Cleanup on removal

7. **Message Validation** (`message-validation.test.ts`)
    - Required field validation
    - Field type validation
    - Timestamp validation

8. **Error Info Disclosure** (`error-info-disclosure.test.ts`)
    - Stack trace sanitization
    - Error code usage
    - Sensitive information filtering

### Running Security Tests

```bash
# Run all security tests
npm test tests/security/

# Run specific security test
npm test tests/security/origin-validation.test.ts

# Run with coverage
npm run test:coverage -- tests/security/
```

### Coverage Requirements

Security layer tests maintain **95%+ coverage** to ensure comprehensive
protection.

---

## Attack Prevention

### Tested Attack Scenarios

Parley-js has been tested against:

1. **XSS Attacks**

    ```typescript
    // Automatically sanitized
    const payload = {
        xss: '<script>alert("XSS")</script>',
        dangerous: 'javascript:void(0)',
    };
    ```

2. **Code Injection**

    ```typescript
    // Functions are removed
    const payload = {
        callback: function () {
            maliciousCode();
        },
    };
    ```

3. **Prototype Pollution**

    ```typescript
    // __proto__ and constructor are blocked
    const payload = {
        __proto__: { admin: true },
        constructor: { prototype: { isAdmin: true } },
    };
    ```

4. **DoS via Deep Nesting**

    ```typescript
    // Rejected if exceeds max depth
    const payload = createDeeplyNested(1000);
    ```

5. **DoS via Large Payloads**

    ```typescript
    // Rejected if exceeds size limit
    const payload = { data: 'x'.repeat(10_000_000) };
    ```

6. **Origin Spoofing**
    ```typescript
    // Origin validation prevents spoofing
    event.origin; // validated against allowedOrigins
    ```

---

## Content Security Policy (CSP)

Configure CSP to restrict iframe sources:

```http
Content-Security-Policy: frame-ancestors 'self' https://trusted-parent.com
```

```html
<!-- Or via meta tag -->
<meta
    http-equiv="Content-Security-Policy"
    content="frame-ancestors 'self' https://trusted-parent.com"
/>
```

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

For advanced use cases, implement a custom security layer:

```typescript
import { SecurityLayer, Parley } from 'parley-js';

class EnterpriseSecurityLayer implements SecurityLayer {
    private allowedOrigins: Set<string>;
    private blockedOrigins: Set<string>;

    constructor(config: SecurityConfig) {
        this.allowedOrigins = new Set(config.allowedOrigins);
        this.blockedOrigins = new Set(config.blockedOrigins || []);
    }

    validateOrigin(origin: string): boolean {
        // Check blocklist first
        if (this.blockedOrigins.has(origin)) {
            this.logViolation('blocked_origin', origin);
            return false;
        }

        // Check allowlist
        if (!this.allowedOrigins.has(origin)) {
            this.logViolation('unknown_origin', origin);
            return false;
        }

        return true;
    }

    validateMessage(message: unknown, origin: string): boolean {
        // Custom validation logic
        if (!this.isValidStructure(message)) {
            return false;
        }

        // Check for suspicious patterns
        if (this.containsSuspiciousContent(message)) {
            this.logViolation('suspicious_content', origin);
            return false;
        }

        return true;
    }

    private logViolation(type: string, origin: string): void {
        // Log to security monitoring
    }
}

const parley = Parley.create({
    allowedOrigins: ['https://trusted.com'],
    securityLayer: new EnterpriseSecurityLayer({
        allowedOrigins: ['https://trusted.com'],
        blockedOrigins: ['https://known-bad.com'],
    }),
});
```

## Common Vulnerabilities and Mitigations

### 1. Prototype Pollution

```typescript
// Vulnerable: Direct property access
function processPayload(payload: any) {
    for (const key in payload) {
        this.config[key] = payload[key]; // Prototype pollution!
    }
}

// Safe: Validate properties
function processPayload(payload: unknown) {
    if (!isPlainObject(payload)) return;

    const allowedKeys = ['name', 'value'];
    for (const key of allowedKeys) {
        if (key in payload) {
            this.config[key] = (payload as any)[key];
        }
    }
}
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

## Security Checklist

Before deploying to production:

- [ ] **Origin validation** configured with explicit allowlist
- [ ] **HTTPS only** for all communication
- [ ] **Schema validation** for sensitive message types
- [ ] **Size limits** configured appropriately
- [ ] **Error handling** does not expose sensitive information
- [ ] **CSP headers** configured to restrict iframe sources
- [ ] **X-Frame-Options** set if embedding not allowed
- [ ] **Security tests** passing with 95%+ coverage
- [ ] **Logging/monitoring** configured for security events
- [ ] **Regular updates** to latest Parley-js version

---

## Resources

- <a href="https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#postmessage" target="_blank">OWASP
  postMessage Security</a>
- <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage" target="_blank">MDN:
  Window.postMessage()</a>
- <a href="https://content-security-policy.com/" target="_blank">Content
  Security Policy Reference</a>
- [Testing Guide](./TESTING.md) - Security testing documentation

---

**Questions?** Open an issue or contact us at security@igniteworks.com

### 2. eval() and Function()

```typescript
// NEVER: Execute code from messages
parley.register('execute', (payload) => {
    eval(payload.code); // Remote code execution!
});

// NEVER: Dynamic function creation
parley.register('run', (payload) => {
    new Function(payload.body)(); // Remote code execution!
});
```

### 3. innerHTML

```typescript
// Vulnerable: XSS
parley.register('update-ui', (payload) => {
    document.getElementById('output').innerHTML = payload.html;
});

// Safe: Use textContent or sanitize
parley.register('update-ui', (payload) => {
    document.getElementById('output').textContent = payload.text;
});

// Safe: Sanitize HTML
parley.register('update-ui', (payload) => {
    const sanitized = DOMPurify.sanitize(payload.html);
    document.getElementById('output').innerHTML = sanitized;
});
```

## Incident Response

If you detect a security incident:

1. **Log the details** - Capture origin, payload, timestamp
2. **Block the origin** - Add to blocklist immediately
3. **Alert the team** - Notify security team
4. **Investigate** - Determine the scope
5. **Remediate** - Fix vulnerabilities
6. **Review** - Update security policies

```typescript
class IncidentHandler {
    onSecurityViolation(event: SecurityEvent) {
        // 1. Log
        this.logger.error('Security violation', event);

        // 2. Block
        this.securityLayer.blockOrigin(event.origin);

        // 3. Alert
        this.alertService.notify('security-team', {
            type: 'cross-origin-attack',
            details: event,
        });

        // 4. Disconnect
        parley.disconnect(event.targetId);
    }
}
```

## Further Reading

- <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage" target="_blank">MDN:
  Window.postMessage()</a>
- <a href="https://owasp.org/www-community/controls/Cross_Origin_Communication" target="_blank">OWASP:
  Cross-Origin Communication Security</a>
- <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP" target="_blank">Content
  Security Policy</a>
- <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options" target="_blank">X-Frame-Options</a>

---

## Navigation

### Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Code Patterns](./CODE_PATTERNS.md) - Secure coding patterns
- [Testing Guide](./TESTING.md) - Security testing strategies
- [Examples](./EXAMPLES.md) - Secure implementation examples

### See Also

- [Troubleshooting](./TROUBLESHOOTING.md) - Common security issues
- [Architecture](./ARCHITECTURE.md) - Security layer design

**Back to**: [Documentation Home](./index.md)
