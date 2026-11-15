# Changelog

## 1.1.0

### Upgrade notes

Most apps upgrade without changes. Check these if they apply to you:

- **Configuration is validated.** `Parley.create()` now throws for an invalid
  `targetType`, a non-positive `timeout`, a negative `retries`, an empty
  `allowedOrigins`, or `'*'`, `'null'` or empty entries in `allowedOrigins`.
  Serve pages over http(s); `file://` pages have the opaque `'null'` origin and
  are not supported.
- **Handler errors are no longer sent to the other window.** When a handler
  throws, the sender receives `ERR_HANDLER_ERROR` with the generic message
  `'Handler error'`. Set `exposeHandlerErrors: true` to restore the old behavior
  between trusted windows.
- **Unserializable payloads fail loudly.** `send()` / `broadcast()` reject with
  a `SerializationError` for circular (or otherwise unserializable) payloads
  instead of silently sending `{}`.
- **Repeated timeouts disconnect a target.** `heartbeat.maxFailures` (default
  `3`) now works as documented: that many consecutive timed-out requests to one
  target close the connection with reason `max_failures_reached`.
- **`MessageMetadata.origin` is now trustworthy** (the browser-verified origin).
  If you worked around it being self-reported, you can rely on it now.
- **Removed types and options** (none of them ever had any runtime effect):
  `SYSTEM_MESSAGE_TYPES.HEARTBEAT_PONG`, `ChannelOptions.autoReconnect` /
  `reconnectDelay` / `maxReconnectAttempts`, `rateLimit.burstSize`, and the
  `'timeout'` / `'error'` values of `DisconnectReason`. TypeScript code that
  references them needs to drop those references.

### Security

Hardened inbound message handling. Upgrading is recommended for all users;
details will be published in a security advisory.

- Each connection, including its handshake, only accepts messages from its own
  target window
- `MessageMetadata.origin` and `system:message_received` carry the
  browser-verified origin instead of the sender's self-reported `_origin`
- Custom `SecurityLayer.validateOrigin()` / `validateMessage()` and protocol
  structure and version checks now run on every inbound message; rejected
  messages emit `system:error`
- Responses are only accepted from the target a request was sent to
- `'*'`, `'null'` and empty `allowedOrigins` entries are rejected
- Handler error details are no longer disclosed to the remote window by default
- Schema validator: own-property checks for `required` / `properties`, error
  collection capped at 100 entries, cached `pattern` regexes
- The default security layer throws instead of substituting `{}` for payloads it
  cannot serialize

### Added

- `exposeHandlerErrors` option (default `false`)
- `system:handshake_start`, `system:handshake_complete` and
  `system:handshake_failed` are now emitted (they were documented but never
  fired)
- `heartbeat.maxFailures` is implemented (see Upgrade notes)
- `destroy()` emits `system:disconnected` with reason `destroyed` for every
  target
- Schema validator supports `additionalProperties` given as a schema
- `createMessage()` / `createResponse()` accept `clonePayload: false` to skip
  the defensive copy of an already-sanitized payload
- Explicit handshake state machine (`HandshakeController`) with a
  `handshakeState` getter on both channels
- `EventEmitter.destroy()` and an `onLimitExceeded` option
- Error codes `GENERAL_ERRORS.UNKNOWN` and `SECURITY_ERRORS.RATE_LIMITED`
- `npm run bench` micro-benchmarks for the message hot path

### Fixed

- `retries` re-sends the message on each attempt (it previously only extended
  the timeout)
- The connecting side re-sends `HANDSHAKE_INIT` until acknowledged, so
  `setTimeout` delays around `connect()` are no longer needed
- `connect()` to a cross-origin iframe that has already loaded no longer fails
  with "Iframe load timeout"
- A closed popup/window is reported (`system:connection_lost` +
  `system:disconnected`) without relying on heartbeats
- Dead targets found by periodic cleanup are fully disconnected (channel,
  listener, heartbeat, pending requests) instead of leaking
- The `rateLimit` option is applied (it was silently dropped); exceeding it
  throws a `ParleyError` with code `ERR_SECURITY_RATE_LIMITED`
- `broadcast()` keeps going when one target fails
- `register()` after `on()` attaches the options instead of throwing
- `register()`'s `onError` option is called when an inbound message of that type
  fails schema validation or its handler throws (it was accepted but never
  invoked)
- Disconnect notifications tear down the connection that sent them, not the
  first connected target (595cef7)
- The package `exports` map: `import` resolves to the real ESM build and
  `require` to the real CommonJS build (cfeac2b)
- A timer leak in `createBatchingAdapter()`; adapters expose `destroy()` and
  `AnalyticsManager` calls it on removal/clear (cfeac2b)
- Unhandled promise rejections from heartbeat pings and async message handlers;
  cleanup mid-handshake rejects the pending `connect()` instead of hanging
  (cfeac2b)

### Removed

- `SYSTEM_MESSAGE_TYPES.HEARTBEAT_PONG` and its request handler (pongs are the
  response to a ping; the handler only let a peer fake liveness)
- `ChannelOptions.autoReconnect` / `reconnectDelay` / `maxReconnectAttempts`
  (automatic reconnection was never implemented)
- `rateLimit.burstSize`
- `DisconnectReason` values `'timeout'` and `'error'` (never produced)

### Performance

- `send()` is about 2x faster (1 KB payload: 43k to 90k ops/s; 1 MB: 21 ms to 9
  ms): payloads are serialized once per send instead of three times
- `system:message_sent` / `system:message_received` listeners no longer delay
  delivery or handlers
- Production bundles are about 10% smaller (56-58 KB minified): internal
  property names are mangled; wire-protocol fields and protected subclass API
  are preserved

### Internal and tooling

- `Parley` is a facade over `ConnectionManager` and `SendPipeline` (no public
  API change)
- Releases publish via npm trusted publishing (OIDC) with provenance; no npm
  token is stored
- CI: tests run on the `development` branch, workflows use least-privilege
  permissions, every action is pinned to a commit SHA, and production
  dependencies are audited on each run
- Dependabot version updates for npm and GitHub Actions; secret scanning and
  push protection enabled
- `.gitattributes` enforces LF line endings; `build:dev` / `build:prod` work on
  every platform
- Dev dependencies updated to clear 22 of 24 `npm audit` advisories (the
  published package has no runtime dependencies)
- ESLint flat config with type-checked rules, a Playwright E2E suite for real
  cross-origin communication, per-format bundle budgets via size-limit, and
  coverage thresholds; added `SECURITY.md` and `CODE_OF_CONDUCT.md`

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
