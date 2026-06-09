# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Heartbeat pings and async message handling no longer create unhandled promise
  rejections (floating promises found by the new type-aware lint rules)
- `EventEmitter` now logs errors thrown by async event handlers instead of
  letting them surface as unhandled rejections
- `createBatchingAdapter()` no longer leaks its flush interval: the timer starts
  lazily on the first event and is cleared by the new `destroy()` method, which
  also flushes any buffered events
- Package `exports` map now points at files that actually exist: `import`
  resolves to `./dist/index.js` (ESM) and `require` to `./dist/index.cjs`
  (CommonJS). Previously `import` pointed at a missing `index.mjs` and `require`
  at the ESM build

### Added

- Optional `destroy()` method on the `AnalyticsAdapter` interface;
  `AnalyticsManager.removeAdapter()` and `clear()` call it automatically
- `npm run size` script with per-format bundle budgets via size-limit
- ESLint flat config with typescript-eslint type-checked rules
  (`no-floating-promises`, `no-misused-promises`, `require-await`), wired into
  `npm run lint` and CI
- Root `SECURITY.md` and `CODE_OF_CONDUCT.md`

### Changed

- CI: removed redundant workflow (wrong Node version), deduplicated coverage
  run, bundle size now checked per format
- Coverage thresholds in `vitest.config.ts` raised to current actuals;
  documentation now references the enforced thresholds instead of a fixed
  percentage claim

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
