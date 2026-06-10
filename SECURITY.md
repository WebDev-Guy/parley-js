# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Email **security@igniteworks.com** with:

- A description of the vulnerability and its impact
- Steps to reproduce or a proof of concept
- Affected versions
- Any suggested mitigation

You will receive an acknowledgment within 72 hours. We follow responsible
disclosure: please allow time for a fix to be released before any public
disclosure.

Low-severity hardening suggestions that do not require private disclosure can be
filed using the [security issue template](.github/ISSUE_TEMPLATE/security.md).

## Security Design

Parley-js is built security-first: strict origin validation (wildcard and
`file://` origins are rejected), payload size limits, schema validation with DoS
guards, and defensive error handling that avoids information disclosure. See the
[security documentation](docs/SECURITY.md) for details and configuration
guidance.
