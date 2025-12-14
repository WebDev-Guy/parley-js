[Home](../../README.md) > [Documentation](../README.md) > Troubleshooting

# Troubleshooting Guide

Solutions to common issues and debugging strategies for ParleyJS.

## Overview

This section helps you diagnose and fix common problems with ParleyJS. Start with [Common Errors](./common-errors.md) for quick solutions, or see the complete [Troubleshooting Guide](../TROUBLESHOOTING.md) for comprehensive debugging strategies.

## Contents

- **[Common Errors](./common-errors.md)** - Quick solutions to frequent errors
  - Connection issues
  - Origin validation errors
  - Timeout errors
  - Type errors

### Complete Troubleshooting Guide

- **[TROUBLESHOOTING.md](../TROUBLESHOOTING.md)** - Comprehensive troubleshooting
  - Debugging strategies
  - Common mistakes
  - Performance issues
  - Error reference

## Quick Fixes

### Connection Not Working

**Problem**: Unable to connect to iframe/window

**Quick fixes**:
1. Wait for iframe load event
2. Check both sides call `connect()`
3. Verify origins match exactly
4. Enable debug mode: `debug: true`

See [Connection Issues](./common-errors.md#connection-issues) for details.

### Messages Not Received

**Problem**: Handler not called when message sent

**Quick fixes**:
1. Register handlers before sending messages
2. Check message type strings match exactly
3. Verify origins are configured correctly
4. Check browser console for errors

See [Message Not Received](./common-errors.md#message-not-received) for details.

### Origin Validation Errors

**Problem**: SecurityError - Origin mismatch

**Quick fixes**:
1. Check protocol matches (http vs https)
2. Remove port numbers if using defaults
3. Check for subdomain mismatches
4. Use environment variables for origins

See [Origin Validation Errors](./common-errors.md#origin-validation-errors) for details.

### Timeout Errors

**Problem**: TimeoutError - Request timed out

**Quick fixes**:
1. Ensure handler calls `respond()`
2. Catch errors in handler and respond
3. Increase timeout value
4. Verify handler is registered

See [Timeout Errors](./common-errors.md#timeout-errors) for details.

## Debugging Tools

### Enable Debug Mode

```typescript
const parley = Parley.create({
  allowedOrigins: ['https://child.com'],
  debug: true // Logs all messages
});
```

### Monitor System Events

```typescript
import { SYSTEM_EVENTS } from 'parley-js';

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
  console.error('ParleyJS Error:', event);
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
  console.log('Sent:', event.messageType);
});
```

### Inspect Raw Messages

```typescript
window.addEventListener('message', (event) => {
  console.log('Raw postMessage:', {
    origin: event.origin,
    data: event.data
  });
});
```

## Common Mistakes

1. **Not waiting for connection** before sending
2. **Using wildcard origins** in production
3. **Forgetting to call respond()** in handlers
4. **Sending non-serializable data** (functions, circular refs)
5. **Not cleaning up** listeners and connections

See [Common Mistakes](../TROUBLESHOOTING.md#common-mistakes) for details.

## Error Reference

For complete error documentation, see:
- [Common Errors](./common-errors.md) - Frequent error solutions with fixes
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Complete debugging guide
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling strategies

## Still Having Issues?

If you're still stuck:

1. **Check examples**: See [Examples](../examples/README.md) for working code
2. **Review API docs**: See [API Reference](../api-reference/README.md)
3. **Search issues**: Check [GitHub Issues](https://github.com/WebDev-Guy/parley-js/issues)
4. **Ask for help**: Open a new issue with:
   - ParleyJS version
   - Browser and version
   - Minimal reproduction code
   - Error messages and debug logs

## Related Sections

- **[Common Errors](./common-errors.md)** - Quick error solutions
- **[TROUBLESHOOTING.md](../TROUBLESHOOTING.md)** - Complete guide
- **[Error Handling Pattern](../patterns/error-handling.md)** - Error patterns
- **[Examples](../examples/README.md)** - Working code
- **[Security](../security/README.md)** - Security issues

---

## Navigation

**Topics**:
- [Common Errors](./common-errors.md)

**Related**:
- [Complete Troubleshooting](../TROUBLESHOOTING.md)
- [Error Handling Pattern](../patterns/error-handling.md)

**Back to**: [Documentation Home](../README.md) | [Project Home](../../README.md)
