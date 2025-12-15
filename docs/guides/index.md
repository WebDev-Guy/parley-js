[Home](../../index.md) > [Documentation](./index.md) > Use Case Guides

# Use Case Guides

Focused guides for specific communication scenarios with ParleyJS.

## Overview

These guides provide step-by-step instructions for implementing ParleyJS in
common use cases. Each guide includes complete code examples, security
considerations, and troubleshooting tips.

Choose the guide that matches your scenario, or start with
[iFrame Communication](./iframe-communication.md) for the most common use case.

## Available Guides

### Communication Types

- **[iFrame Communication](./iframe-communication.md)** - Embedding and
  communicating with iframes
    - Widget embedding
    - Configuration passing
    - Event forwarding
    - Dynamic resizing

- **[Popup Window Communication](./popup-communication.md)** - Parent and popup
  window communication
    - OAuth authentication flows
    - Payment processing
    - File selection dialogs
    - Settings windows

- **[Web Worker Communication](./worker-communication.md)** - Main thread and
  worker communication
    - Background processing
    - Data transfer
    - Progress reporting
    - Worker lifecycle

- **[Multi-Window Communication](./multi-window-communication.md)** -
  Coordinating multiple windows
    - Hub-and-spoke pattern
    - Peer-to-peer messaging
    - Broadcasting
    - Window coordination

### Integration Scenarios

- **React Integration** - Using ParleyJS in React applications (see
  [Examples](../EXAMPLES.md#react-integration))
- **Vue Integration** - Using ParleyJS in Vue applications (see
  [Examples](../EXAMPLES.md#vue-integration))
- **Authentication Flows** - OAuth and SSO patterns (see
  [Popup Communication](./popup-communication.md#oauth-flow))

## Choosing the Right Guide

**I want to**:

- Embed a third-party widget → [iFrame Communication](./iframe-communication.md)
- Build OAuth login → [Popup Communication](./popup-communication.md)
- Process data in background →
  [Web Worker Communication](./worker-communication.md)
- Coordinate multiple windows →
  [Multi-Window Communication](./multi-window-communication.md)

**My app uses**:

- React → See [Examples: React Integration](../EXAMPLES.md#react-integration)
- Vue → See [Examples: Vue Integration](../EXAMPLES.md#vue-integration)
- Vanilla JavaScript → Any guide applies

## Guide Structure

Each guide follows this format:

1. **Overview** - What the guide covers and common use cases
2. **Basic Setup** - Minimal working example
3. **Common Patterns** - Typical implementation patterns
4. **Security Considerations** - Security best practices
5. **Troubleshooting** - Common issues and solutions
6. **Complete Example** - Full working code

## Prerequisites

Before following these guides:

- Complete [Getting Started](../getting-started/index.md)
- Review [Core Concepts](../getting-started/concepts.md)
- Understand [Security Basics](../security/index.md)

## Related Sections

- **[Patterns](../patterns/index.md)** - Reusable code patterns
- **[Examples](../examples/index.md)** - Complete code examples
- **[API Reference](../api-reference/index.md)** - Method documentation
- **[Troubleshooting](../troubleshooting/index.md)** - Problem solving

## Need Help?

If you're stuck:

1. Check [Troubleshooting](../troubleshooting/index.md) for common issues
2. Review [Common Errors](../troubleshooting/common-errors.md) for error
   messages
3. See [Examples](../examples/index.md) for working code
4. Open an issue on [GitHub](https://github.com/WebDev-Guy/parley-js/issues)

---

## Navigation

**Guides**:

- [iFrame Communication](./iframe-communication.md)
- [Popup Communication](./popup-communication.md)
- [Worker Communication](./worker-communication.md)
- [Multi-Window Communication](./multi-window-communication.md)

**Back to**: [Documentation Home](./index.md) | [Project Home](../../index.md)
