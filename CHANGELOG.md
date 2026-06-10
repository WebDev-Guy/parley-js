# Changelog

## 1.1.0

### Minor Changes

- cfeac2b: Bug fixes, hardening, and tooling improvements:
    - Fixed the package `exports` map: `import` now resolves to the real ESM
      build and `require` to the real CommonJS build (previously `import`
      pointed at a file that was never published)
    - Fixed a timer leak in `createBatchingAdapter()`; adapters now expose
      `destroy()` and `AnalyticsManager` calls it on removal/clear
    - Fixed unhandled promise rejections from heartbeat pings and async message
      handlers
    - New explicit handshake state machine (`HandshakeController`) with a
      `handshakeState` getter on both channels; cleanup mid-handshake now
      rejects the pending `connect()` instead of hanging
    - New `EventEmitter.destroy()` and `onLimitExceeded` option
    - New `GENERAL_ERRORS.UNKNOWN` error code
    - Internal refactor: `Parley` is now a facade over `ConnectionManager` and
      `SendPipeline` (no public API change)
    - Tooling: ESLint flat config with type-checked rules, Playwright E2E suite
      for real cross-origin communication, per-format bundle budgets via
      size-limit, automated releases with changesets and npm provenance, and CI
      cleanup; added `SECURITY.md` and `CODE_OF_CONDUCT.md`

### Patch Changes

- 595cef7: Fixed disconnect notifications tearing down the wrong connection: the
  handler now disconnects the target that actually sent the notification
  (identified via message metadata) instead of the first connected target. With
  multiple connected targets, one peer disconnecting no longer kills an
  unrelated connection.

## [1.0.0] - 2025-12-11

### Added

- Initial release of Parley-js
- Core communication framework
    - `Parley` main class for managing connections
    - `IframeChannel` for iframe communication
    - `WindowChannel` for window.open() communication
    - `BaseChannel` abstract base for custom channels
- Event system with `EventEmitter`
- Message protocol with versioning and correlation
- Heartbeat monitoring for connection health
- Origin validation and security layer
- Schema validation with JSON Schema support
- Request/response pattern with timeout handling
- Analytics hooks for monitoring
- TypeScript support with full type definitions
- Zero runtime dependencies
- ~54KB bundle size (minified)

### Features

- **Security-First Design**
    - Origin whitelist enforcement
    - Message integrity validation
    - Configurable security policies
- **Robust Communication**
    - Automatic retries with exponential backoff
    - Connection state management
    - Multi-target support (broadcast)
- **Developer Experience**
    - Full TypeScript support
    - Comprehensive API documentation
    - Example code for common patterns
    - Debug logging with configurable levels
- **Framework Agnostic**
    - Works with React, Vue, Angular, or vanilla JS
    - Browser support: Chrome 80+, Firefox 80+, Safari 13.1+, Edge 80+

### Documentation

- API Reference (`docs/API.md`)
- Architecture Guide (`docs/ARCHITECTURE.md`)
- Security Guide (`docs/SECURITY.md`)
- Examples (`docs/EXAMPLES.md`)
- Future Roadmap (`docs/FUTURE-ROADMAP.md`)

## Release History

### Version Numbering

Parley-js follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR** version: Incompatible API changes
- **MINOR** version: New features, backward-compatible
- **PATCH** version: Bug fixes, backward-compatible

### Supported Versions

| Version | Supported | Notes                  |
| ------- | --------- | ---------------------- |
| 1.x.x   | Yes       | Current stable release |
| 0.x.x   | No        | Pre-release versions   |

### Upgrade Guide

When upgrading between major versions, consult the migration guide in the
release notes.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on proposing changes.

## Questions?

- [Open an issue](https://github.com/WebDev-Guy/parley-js/issues)
- [View documentation](./docs/API.md)
- [Security concerns](./docs/SECURITY.md#reporting-security-issues)
