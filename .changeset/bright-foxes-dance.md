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
