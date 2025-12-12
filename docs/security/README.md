[Home](../../README.md) > [Documentation](../README.md) > Security

# Security Guide

Security best practices for cross-window communication with ParleyJS.

## Overview

Cross-window communication has inherent security risks. This section covers ParleyJS security features, best practices, and common security pitfalls.

ParleyJS implements security-first design with origin validation, payload sanitization, and DoS prevention built-in.

## Contents

### Security Topics

- **[Origin Validation](./origin-validation.md)** - Validating message sources
  - Why origin validation matters
  - Configuring allowed origins
  - Common mistakes
  - Testing origin validation

- **[Message Validation](./message-validation.md)** - Validating message content
  - Schema validation
  - Input sanitization
  - XSS prevention
  - Data type checking

### Complete Security Guide

- **[SECURITY.md](../SECURITY.md)** - Comprehensive security documentation
  - Threat model
  - Attack prevention
  - Security testing
  - Reporting security issues

## Critical Security Rules

**Always**:
1. Validate origins explicitly (never use `*`)
2. Validate message content before processing
3. Use HTTPS in production
4. Sanitize data before displaying
5. Never send sensitive data through postMessage

**Never**:
1. Use wildcard origins in production
2. Trust message content without validation
3. Send passwords or tokens
4. Execute code from messages
5. Disable origin checking

## Quick Security Checklist

Before deploying:
- [ ] Origins are explicitly configured (not `*`)
- [ ] HTTPS is used in production
- [ ] Message content is validated
- [ ] Error messages don't leak sensitive data
- [ ] Security tests pass
- [ ] Code reviewed for security issues

## Common Security Mistakes

**Mistake 1: Wildcard origins**
```typescript
// DANGEROUS
allowedOrigins: ['*']

// CORRECT
allowedOrigins: ['https://trusted-domain.com']
```

**Mistake 2: Not validating content**
```typescript
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
```typescript
// DANGEROUS
await parley.send('login', { password: 'secret123' });

// CORRECT
await parley.send('login', { sessionToken: token });
```

## Security Features

ParleyJS provides:
- **Automatic origin validation** - Messages from unauthorized origins are rejected
- **Payload sanitization** - Dangerous content is removed automatically
- **DoS prevention** - Size limits and rate limiting
- **Protocol validation** - Message structure is verified
- **Error safety** - No sensitive data in error messages

For details, see [SECURITY.md](../SECURITY.md).

## Testing Security

Security must be tested:
```typescript
// Test origin validation
it('should reject messages from wrong origin', async () => {
  const handler = vi.fn();
  parley.on('message', handler);

  await simulateMessageFrom('https://evil.com');

  expect(handler).not.toHaveBeenCalled();
});
```

For more testing patterns, see [Testing Patterns](../TESTING_PATTERNS.md).

## Related Sections

- **[Origin Validation](./origin-validation.md)** - Origin security details
- **[Message Validation](./message-validation.md)** - Content validation
- **[SECURITY.md](../SECURITY.md)** - Complete security guide
- **[Error Handling](../patterns/error-handling.md)** - Secure error handling
- **[Testing Patterns](../TESTING_PATTERNS.md)** - Security testing

## Reporting Security Issues

Found a security issue? See [Reporting Security Issues](../SECURITY.md#reporting-security-issues).

Do not open public issues for security vulnerabilities.

---

## Navigation

**Security Topics**:
- [Origin Validation](./origin-validation.md)
- [Message Validation](./message-validation.md)

**Related**:
- [Complete Security Guide](../SECURITY.md)
- [Testing Security](../TESTING_PATTERNS.md)

**Back to**: [Documentation Home](../README.md) | [Project Home](../../README.md)
