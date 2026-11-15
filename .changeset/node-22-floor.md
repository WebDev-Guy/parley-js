---
'ignite-parleyjs': minor
---

Require Node.js 22.19 or later for development and tooling (`engines.node`
`>=22.19.0`, was `>=20.19.0`). Node 20 reached end-of-life in April 2026, and
the build and test tooling (Vitest 5, tsup 9, size-limit 14) already requires
Node 22.12–22.19 or later. CI now tests on Node 22 and 24. The library itself
still runs in any supported browser; this only affects the Node version used to
install, build and test.
