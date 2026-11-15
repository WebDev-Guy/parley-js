[Home](../index.md) > [Documentation](./index.md) > API Reference

# API Reference

Complete API documentation for ParleyJS.

## Overview

This section provides detailed documentation for all ParleyJS classes, methods,
types, and error codes. Use this as a reference when implementing ParleyJS in
your application.

For quick examples and common patterns, see
[Framework Reference](../FRAMEWORK_REFERENCE.md).

## Contents

### Core Documentation

- **[Methods](./methods.md)** - All ParleyJS methods with parameters and return
  types
- **[System Events](./system-events.md)** - System event reference
- **[Types](./types.md)** - TypeScript interfaces, unions and enums
- **[Error Codes](./error-codes.md)** - Error classes and error codes
- **[Common Errors](../troubleshooting/common-errors.md)** - Error reference and
  solutions

### Complete API Documentation

- **[API.md](../API.md)** - Comprehensive API documentation with examples

## Quick Reference

### Essential Methods

**Creating an instance**:

```javascript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe', // or 'window' for popups
    allowedOrigins: ['https://example.com'],
});
```

**Connecting to a target**:

```javascript
// Parent page (targetType: 'iframe')
await parley.connect(iframeElement, 'target-id');

// Page inside the iframe (also targetType: 'iframe')
await parley.connect(window.parent, 'parent');
```

Both sides must call `connect()`.

**Sending messages**:

```javascript
const response = await parley.send('message-type', payload, {
    targetId: 'target-id',
});
```

**Receiving messages**:

```javascript
parley.on('message-type', (payload, respond, metadata) => {
    // Reply by calling respond(); a handler's return value is ignored
    respond({ result: 'success' });
});
```

For more details, see [Methods](./methods.md).

## Organization

The API documentation is organized by:

- **Methods** - Grouped by functionality (connection, messaging, events)
- **System Events** - Lifecycle and monitoring events
- **Types** - Configuration, handler, event and error types
- **Errors** - Error classes, codes and common errors with solutions

## Using This Reference

**If you want to**:

- Find a specific method: See [Methods](./methods.md)
- Understand system events: See [System Events](./system-events.md)
- Look up a type: See [Types](./types.md)
- Look up an error code: See [Error Codes](./error-codes.md)
- Debug an error: See [Common Errors](../troubleshooting/common-errors.md)
- See complete examples: See [API.md](../API.md)

**If you're looking for**:

- How-to guides: See [Guides](../guides/index.md)
- Code patterns: See [Patterns](../patterns/index.md)
- Troubleshooting: See [Troubleshooting](../troubleshooting/index.md)

## Related Sections

- **[Framework Reference](../FRAMEWORK_REFERENCE.md)** - Quick start guide
- **[Code Patterns](../CODE_PATTERNS.md)** - Common usage patterns
- **[Examples](../examples/index.md)** - Working code examples
- **[Guides](../guides/index.md)** - Use-case specific tutorials

## TypeScript Support

ParleyJS is written in TypeScript and provides complete type definitions. All
methods support generic types for request and response payloads.

For details on TypeScript usage, see
[Installation Guide](../getting-started/installation.md#typescript-support).

---

## Navigation

**Sections**:

- [Methods](./methods.md) - Method reference
- [System Events](./system-events.md) - Event reference
- [Types](./types.md) - Type reference
- [Error Codes](./error-codes.md) - Error code reference
- [Common Errors](../troubleshooting/common-errors.md) - Error reference

**Back to**: [Documentation Home](./index.md) | [Project Home](../index.md)
