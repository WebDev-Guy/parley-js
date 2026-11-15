[Home](../index.md) > [Documentation](../FRAMEWORK_REFERENCE.md) >
Troubleshooting

# Troubleshooting Guide

Solutions to common issues and debugging strategies for ParleyJS.

## Overview

This section helps you diagnose and fix common problems with ParleyJS. Start
with [Common Errors](./common-errors.md) for quick solutions, or see the
complete [Troubleshooting Guide](../TROUBLESHOOTING.md) for comprehensive
debugging strategies.

## Contents

- **[Common Errors](./common-errors.md)** - Quick solutions to frequent errors
    - Connection issues
    - Origin validation errors
    - Timeout errors
    - Type errors

### Complete Troubleshooting Guide

- **[TROUBLESHOOTING.md](../TROUBLESHOOTING.md)** - Comprehensive
  troubleshooting
    - Debugging strategies
    - Common mistakes
    - Performance issues
    - Error reference

## Quick Fixes

### Connection Not Working

**Problem**: Unable to connect to iframe/window

**Quick fixes**:

1. Check both sides call `connect()` (no `load` listener or delay is needed; the
   child or popup re-sends the handshake until it is acknowledged)
2. Check `targetType` matches the target: `'iframe'` with the iframe element
   (not `iframe.contentWindow`), `'window'` for popups
3. Verify origins match exactly and pages are served over http(s), not `file://`
4. Enable debug logging: `logLevel: 'debug'`

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

**Problem**: Messages from the other window are silently dropped (origin not in
`allowedOrigins`)

**Quick fixes**:

1. Check protocol matches (http vs https)
2. Check non-default port numbers are included
3. Check for subdomain mismatches (entries containing `*`, such as
   `*.example.com`, are rejected; list every origin)
4. Use environment variables for origins

See [Origin Validation Errors](./common-errors.md#origin-validation-errors) for
details.

### Configuration Errors

**Problem**: `Parley.create()` throws `Error('Configuration error: ...')`

**Quick fixes**:

1. Pass `targetType: 'iframe'` or `targetType: 'window'`
2. Use a positive `timeout` and a non-negative `retries`
3. Pass a non-empty `allowedOrigins` array of real origins (entries containing
   `'*'`, `'null'` and empty strings are rejected)

### Timeout Errors

**Problem**: TimeoutError - Request timed out

**Quick fixes**:

1. Ensure the handler calls `respond()` (its return value is ignored)
2. Increase the timeout value or set `retries`
3. Check the other side is connected and not blocked by a long-running task

A handler that throws does not cause a timeout: `send()` rejects with
`ERR_HANDLER_ERROR`. A missing handler rejects with `ERR_NO_HANDLER`.

See [Timeout Errors](./common-errors.md#timeout-errors) for details.

## Debugging Tools

### Enable Debug Logging

```javascript
const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://child.com'],
    logLevel: 'debug', // Logs messages, rejections and errors
});
```

### Monitor System Events

```javascript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

parley.onSystem(SYSTEM_EVENTS.ERROR, (event) => {
    console.error('ParleyJS Error:', event);
});

parley.onSystem(SYSTEM_EVENTS.MESSAGE_SENT, (event) => {
    console.log('Sent:', event.messageType);
});
```

### Inspect Raw Messages

```javascript
window.addEventListener('message', (event) => {
    console.log('Raw postMessage:', {
        origin: event.origin,
        data: event.data,
    });
});
```

## Common Mistakes

1. **Not awaiting `connect()`** before sending
2. **Using wildcard origins** (`'*'` is rejected by `Parley.create()`)
3. **Forgetting to call respond()** in handlers
4. **Sending non-serializable data** (functions are silently dropped; circular
   references make `send()` reject with a `SerializationError`)
5. **Not cleaning up** listeners and connections

See [Common Mistakes](../TROUBLESHOOTING.md#common-mistakes) for details.

## Error Reference

For complete error documentation, see:

- [Common Errors](./common-errors.md) - Frequent error solutions with fixes
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Complete debugging guide
- [Error Handling Pattern](../patterns/error-handling.md) - Error handling
  strategies

## Still Having Issues?

If you're still stuck:

1. **Check examples**: See [Examples](../examples/index.md) for working code
2. **Review API docs**: See [API Reference](../api-reference/index.md)
3. **Search issues**: Check
   [GitHub Issues](https://github.com/WebDev-Guy/parley-js/issues)
4. **Ask for help**: Open a new issue with:
    - ParleyJS version
    - Browser and version
    - Minimal reproduction code
    - Error messages and debug logs

## Related Sections

- **[Common Errors](./common-errors.md)** - Quick error solutions
- **[TROUBLESHOOTING.md](../TROUBLESHOOTING.md)** - Complete guide
- **[Error Handling Pattern](../patterns/error-handling.md)** - Error patterns
- **[Examples](../examples/index.md)** - Working code
- **[Security](../security/index.md)** - Security issues

---

## Navigation

**Topics**:

- [Common Errors](./common-errors.md)

**Related**:

- [Complete Troubleshooting](../TROUBLESHOOTING.md)
- [Error Handling Pattern](../patterns/error-handling.md)

**Back to**: [Documentation Home](../index.md) |
[Project Home](https://github.com/WebDev-Guy/parley-js/blob/main/README.md)
