# Future Roadmap

This document outlines planned features and improvements for Parley-js.

## Version 1.x (Current)

### 1.0.0 - Initial Release ✅

- Core postMessage wrapper
- Type-safe message handling
- Request/response pattern
- Origin validation
- Schema validation (JSON Schema subset)
- Iframe and window support
- Analytics hooks
- Error handling
- Full TypeScript support

### 1.1.0 - Enhanced Validation (Planned)

- [ ] Full JSON Schema Draft 7 support
- [ ] Custom validator plugins
- [ ] Runtime type generation
- [ ] Validation caching for performance
- [ ] Better error messages with path information

### 1.2.0 - Developer Experience (Planned)

- [ ] DevTools browser extension
    - Visual message inspector
    - Connection graph
    - Performance metrics
    - Message replay
- [ ] Debug mode improvements
    - Structured logging
    - Message tracing
    - Timing breakdown
- [ ] VS Code extension
    - Message type autocompletion
    - Schema validation in editor

### 1.3.0 - Performance (Planned)

- [ ] Message batching
    - Automatic batching of rapid messages
    - Configurable batch window
    - Priority queue
- [ ] Compression for large payloads
- [ ] Binary message support (ArrayBuffer)
- [ ] Memory optimization
    - Weak references for targets
    - Message pooling

## Version 2.x (Future)

### 2.0.0 - Breaking Changes

- [ ] Remove deprecated APIs
- [ ] Simplified configuration
- [ ] Modern browser only (drop ES5 support)
- [ ] Strict mode by default

### 2.1.0 - Service Worker Support

- [ ] Service Worker as communication hub
- [ ] Shared state across tabs
- [ ] Offline message queue
- [ ] Background sync

### 2.2.0 - SharedWorker Support

- [ ] SharedWorker integration
- [ ] Cross-tab communication via SharedWorker
- [ ] Centralized message routing

### 2.3.0 - Advanced Patterns

- [ ] Pub/Sub channels
    - Named channels
    - Topic-based routing
    - Channel permissions
- [ ] RPC improvements
    - Streaming responses
    - Bidirectional streams
    - Cancellation tokens
- [ ] State synchronization
    - Automatic state sync
    - Conflict resolution
    - Optimistic updates

## Version 3.x (Vision)

### 3.0.0 - Multi-Protocol Support

- [ ] WebSocket bridge
- [ ] BroadcastChannel integration
- [ ] MessageChannel direct connections
- [ ] Protocol negotiation

### 3.1.0 - Security Enhancements

- [ ] Message encryption (E2E)
- [ ] Digital signatures
- [ ] Certificate pinning
- [ ] Audit logging

### 3.2.0 - Enterprise Features

- [ ] Multi-tenant support
- [ ] Connection pools
- [ ] Load balancing
- [ ] Circuit breakers
- [ ] Health checks

## Framework Integrations

### React

- [ ] `@parley-js/react` package
    - `useParley` hook
    - `<ParleyProvider>` context
    - `<IframeWidget>` component
    - Server Component support

### Vue

- [ ] `@parley-js/vue` package
    - Composition API support
    - Vue 2 compatibility
    - Nuxt module

### Angular

- [ ] `@parley-js/angular` package
    - Injectable service
    - RxJS integration
    - Zone.js integration

### Svelte

- [ ] `@parley-js/svelte` package
    - Svelte store integration
    - SvelteKit support

## Testing Utilities

### `@parley-js/testing`

- [ ] Mock Parley instance
- [ ] Test helpers
    - `mockTarget()` - Create mock target
    - `simulateMessage()` - Trigger message handlers
    - `expectMessage()` - Assert messages sent
- [ ] Jest matchers
- [ ] Vitest plugin
- [ ] Playwright helpers for E2E tests

## CLI Tools

### `@parley-js/cli`

- [ ] Project scaffolding
    - `parley init` - Initialize project
    - `parley add-target` - Add target configuration
- [ ] Code generation
    - Generate types from schemas
    - Generate handlers from API spec
- [ ] Validation
    - Validate message schemas
    - Check configuration

## Documentation

- [ ] Interactive playground
- [ ] Video tutorials
- [ ] Migration guides
- [ ] Cookbook with recipes
- [ ] API reference generator

## Community

- [ ] GitHub Discussions
- [ ] Discord server
- [ ] Stack Overflow tag
- [ ] Contributing guide improvements
- [ ] Good first issues program

---

## Contributing to the Roadmap

We welcome community input on the roadmap!

### Suggesting Features

1. Check existing issues and discussions
2. Open a GitHub Discussion with your proposal
3. Provide use cases and examples
4. Engage with community feedback

### Prioritization

Features are prioritized based on:

1. **Impact** - How many users benefit?
2. **Effort** - Implementation complexity
3. **Alignment** - Does it fit the project vision?
4. **Community** - Level of community interest

### Sponsorship

Sponsored features may be prioritized. Contact us for enterprise sponsorship
options.

---

_Last updated: January 2024_
