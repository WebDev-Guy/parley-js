[Home](../../README.md) > [Documentation](../README.md) > API Reference

# API Reference

Complete API documentation for ParleyJS.

## Overview

This section provides detailed documentation for all ParleyJS classes, methods, types, and error codes. Use this as a reference when implementing ParleyJS in your application.

For quick examples and common patterns, see [Framework Reference](../FRAMEWORK_REFERENCE.md).

## Contents

### Core Documentation
- **[Methods](./methods.md)** - All ParleyJS methods with parameters and return types
- **[System Events](./system-events.md)** - System event reference
- **[Common Errors](../troubleshooting/common-errors.md)** - Error reference and solutions

### Complete API Documentation
- **[API.md](../API.md)** - Comprehensive API documentation with examples

## Quick Reference

### Essential Methods

**Creating an instance**:
```typescript
const parley = Parley.create({
  allowedOrigins: ['https://example.com']
});
```

**Connecting to a window**:
```typescript
await parley.connect(targetWindow, 'target-id');
```

**Sending messages**:
```typescript
const response = await parley.send('message-type', payload, { targetId: 'target-id' });
```

**Receiving messages**:
```typescript
parley.on('message-type', (payload, respond) => {
  respond({ result: 'success' });
});
```

For more details, see [Methods](./methods.md).

## Organization

The API documentation is organized by:
- **Methods** - Grouped by functionality (connection, messaging, events)
- **System Events** - Lifecycle and monitoring events
- **Errors** - Common errors with solutions

## Using This Reference

**If you want to**:
- Find a specific method: See [Methods](./methods.md)
- Understand system events: See [System Events](./system-events.md)
- Debug an error: See [Common Errors](../troubleshooting/common-errors.md)
- See complete examples: See [API.md](../API.md)

**If you're looking for**:
- How-to guides: See [Guides](../guides/README.md)
- Code patterns: See [Patterns](../patterns/README.md)
- Troubleshooting: See [Troubleshooting](../troubleshooting/README.md)

## Related Sections

- **[Framework Reference](../FRAMEWORK_REFERENCE.md)** - Quick start guide
- **[Code Patterns](../CODE_PATTERNS.md)** - Common usage patterns
- **[Examples](../examples/README.md)** - Working code examples
- **[Guides](../guides/README.md)** - Use-case specific tutorials

## TypeScript Support

ParleyJS is written in TypeScript and provides complete type definitions. All methods support generic types for request and response payloads.

For details on TypeScript usage, see [Installation Guide](../getting-started/installation.md#typescript-support).

---

## Navigation

**Sections**:
- [Methods](./methods.md) - Method reference
- [System Events](./system-events.md) - Event reference
- [Common Errors](../troubleshooting/common-errors.md) - Error reference

**Back to**: [Documentation Home](../README.md) | [Project Home](../../README.md)
