---
name: Security Issue
about: Report a security vulnerability (DO NOT use for public disclosure)
title: '[SECURITY] '
labels: security
assignees: ''
---

## SECURITY NOTICE

**DO NOT report security vulnerabilities through public GitHub issues.**

For security issues, please email: **security@igniteworks.com**

This template is for tracking already-disclosed or low-severity security improvements.

---

## Security Improvement Description

Describe the security improvement or hardening you're proposing.

## Current Behavior

Describe how the system currently behaves.

## Risk Assessment

- **Severity:** [Low / Medium / High / Critical]
- **Attack Vector:** [Network / Local / Physical]
- **Complexity:** [Low / Medium / High]
- **Exploitability:** [Difficult / Moderate / Easy]

## Proposed Mitigation

Describe how to address this security concern.

## Impact

- Who is affected?
- What are the potential consequences?
- Are there any workarounds?

## References

- Link to CVEs, advisories, or security best practices
- Related security documentation

## Testing

How can this security improvement be tested?

```typescript
// Example test case
describe('security improvement', () => {
  it('should prevent XYZ attack', () => {
    // Test code
  });
});
```

## Checklist

- [ ] This is NOT a critical vulnerability requiring immediate attention
- [ ] I have reviewed the <a href="https://github.com/WebDev-Guy/parley-js/blob/main/docs/SECURITY.md" target="_blank">Security Guide</a>
- [ ] I have considered the impact on existing users
- [ ] I have proposed a backward-compatible solution if possible

---

## For Critical Vulnerabilities

**If you believe you've found a critical security vulnerability:**

1. **DO NOT** create a public issue
2. **Email details to:** security@igniteworks.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes
4. We will respond within 48 hours

We follow responsible disclosure practices and will credit security researchers who report vulnerabilities responsibly.
