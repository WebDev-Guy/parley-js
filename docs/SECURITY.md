# Security Guide

This document outlines security best practices when using Parley-js.

## Overview

Cross-window communication via `postMessage` has inherent security risks.
Parley-js is designed with security as a primary concern, but proper
configuration is essential.

## The Threat Model

### Potential Attack Vectors

1. **Origin Spoofing** - Malicious sites attempting to send messages
2. **Message Injection** - Injecting malicious payloads
3. **Data Exfiltration** - Stealing sensitive data via cross-origin messages
4. **Clickjacking** - Embedding your app in a malicious iframe
5. **Replay Attacks** - Re-sending captured messages
6. **Denial of Service** - Flooding with messages

## Core Security Features

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

### 2. Protocol Enforcement

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

### 3. Timestamp Validation

Parley can reject stale messages:

```typescript
const parley = Parley.create({
    allowedOrigins: ['https://trusted.com'],
    // Reject messages older than 30 seconds
    maxMessageAge: 30000,
});
```

### 4. Schema Validation

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

- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [OWASP: Cross-Origin Communication Security](https://owasp.org/www-community/controls/Cross_Origin_Communication)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
