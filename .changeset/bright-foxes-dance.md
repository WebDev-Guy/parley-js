---
'ignite-parleyjs': minor
---

Bug fixes, hardening, and tooling improvements:

- Fixed the package `exports` map: `import` now resolves to the real ESM build
  and `require` to the real CommonJS build (previously `import` pointed at a
  file that was never published)
- Fixed a timer leak in `createBatchingAdapter()`; adapters now expose
  `destroy()` and `AnalyticsManager` calls it on removal/clear
- Fixed unhandled promise rejections from heartbeat pings and async message
  handlers
- New explicit handshake state machine (`HandshakeController`) with a
  `handshakeState` getter on both channels; cleanup mid-handshake now rejects
  the pending `connect()` instead of hanging
- New `EventEmitter.destroy()` and `onLimitExceeded` option
- New `GENERAL_ERRORS.UNKNOWN` error code
- Internal refactor: `Parley` is now a facade over `ConnectionManager` and
  `SendPipeline` (no public API change)
- Tooling: ESLint flat config with type-checked rules, Playwright E2E suite
  for real cross-origin communication, per-format bundle budgets via
  size-limit, automated releases with changesets and npm provenance, and
  CI cleanup; added `SECURITY.md` and `CODE_OF_CONDUCT.md`
