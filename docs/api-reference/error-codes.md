# Error Codes Reference

[Home](../../index.md) > [Documentation](./index.md) >
[API Reference](./index.md) > Error Codes

## Overview

ParleyJS provides a comprehensive error handling system with specific error
types and codes for different failure scenarios. Each error extends the base
`ParleyError` class and includes detailed information to help diagnose and
resolve issues.

This reference documents all error types, their properties, common causes, and
resolution strategies.

## Error Type Hierarchy

All ParleyJS errors extend the `ParleyError` base class:

```javascript
ParleyError
├── ValidationError
├── TimeoutError
├── TargetNotFoundError
├── SecurityError
├── SerializationError
├── ConnectionError
└── ConfigurationError
```

## Base Error: ParleyError

All ParleyJS errors inherit from `ParleyError`, which provides common
properties:

```javascript
class ParleyError extends Error {
    code: string;           // Error code constant
    details?: any;          // Additional error context
    timestamp: number;      // When the error occurred
}
```

**Common Properties**:

- `name`: Error class name (e.g., "ValidationError")
- `message`: Human-readable error description
- `code`: Machine-readable error code constant
- `stack`: Stack trace for debugging
- `timestamp`: Unix timestamp when error occurred
- `details`: Context-specific additional information

## ValidationError

Thrown when message validation fails against defined schemas or type
constraints.

### Error Codes

| Code                             | Constant          | Description                       |
| -------------------------------- | ----------------- | --------------------------------- |
| `ERR_VALIDATION_SCHEMA_MISMATCH` | `SCHEMA_MISMATCH` | Payload doesn't match JSON schema |
| `ERR_VALIDATION_TYPE_MISMATCH`   | `TYPE_MISMATCH`   | Payload type is incorrect         |
| `ERR_VALIDATION_REQUIRED_FIELD`  | `REQUIRED_FIELD`  | Required field is missing         |
| `ERR_VALIDATION_INVALID_VALUE`   | `INVALID_VALUE`   | Field value is invalid            |

### Properties

```javascript
class ValidationError extends ParleyError {
    validationErrors: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
    schema?: object;        // The schema that failed
    payload?: any;          // The payload that was rejected
}
```

### Example

```javascript
import { Parley, ValidationError } from 'parleyjs';

const parley = new Parley();

const userSchema = {
    type: 'object',
    properties: {
        userId: { type: 'number' },
        email: { type: 'string', format: 'email' },
    },
    required: ['userId', 'email'],
};

parley.on(
    'create-user',
    (payload, respond) => {
        // Handler logic
    },
    { schema: userSchema }
);

try {
    await parley.send('create-user', { userId: 'invalid' });
} catch (error) {
    if (error instanceof ValidationError) {
        console.error('Validation failed:', error.code);
        console.error('Field errors:', error.validationErrors);
        console.error('Invalid payload:', error.payload);
    }
}
```

### Common Causes

- Missing required fields in payload
- Incorrect data types (string instead of number)
- Values outside allowed ranges or patterns
- Additional properties when `additionalProperties: false`

### Resolution

1. Check the `validationErrors` array for specific field issues
2. Verify payload structure matches schema definition
3. Ensure all required fields are present
4. Validate data types match schema expectations
5. Review schema constraints (min/max, patterns, enums)

## TimeoutError

Thrown when a request-response operation exceeds the configured timeout period.

### Error Codes

| Code                     | Constant             | Description                    |
| ------------------------ | -------------------- | ------------------------------ |
| `ERR_TIMEOUT_RESPONSE`   | `RESPONSE_TIMEOUT`   | Response not received in time  |
| `ERR_TIMEOUT_CONNECTION` | `CONNECTION_TIMEOUT` | Connection attempt timed out   |
| `ERR_TIMEOUT_HEARTBEAT`  | `HEARTBEAT_TIMEOUT`  | Heartbeat not received in time |

### Properties

```javascript
class TimeoutError extends ParleyError {
    messageId: string;      // ID of message that timed out
    timeout: number;        // Timeout duration in ms
    channel: string;        // Channel where timeout occurred
}
```

### Example

```javascript
import { Parley, TimeoutError } from 'parleyjs';

const parley = new Parley({
    timeout: 5000, // 5 second default timeout
});

try {
    const response = await parley.send('slow-operation', { data: 'test' });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.error('Operation timed out after', error.timeout, 'ms');
        console.error('Message ID:', error.messageId);
        console.error('Channel:', error.channel);

        // Retry with longer timeout
        const response = await parley.send(
            'slow-operation',
            { data: 'test' },
            { timeout: 15000 }
        );
    }
}
```

### Common Causes

- Handler processing takes longer than timeout
- Network latency in cross-window/worker communication
- Handler not calling `respond()` function
- Timeout set too low for operation complexity
- Target window/worker is frozen or unresponsive

### Resolution

1. Increase timeout for specific operations using `SendOptions`
2. Optimize handler to respond faster
3. Ensure handler always calls `respond()`, even on errors
4. Use heartbeat monitoring to detect frozen targets
5. Implement progress updates for long-running operations

## TargetNotFoundError

Thrown when attempting to send a message to a target that doesn't exist or is no
longer available.

### Error Codes

| Code                      | Constant              | Description                    |
| ------------------------- | --------------------- | ------------------------------ |
| `ERR_TARGET_NOT_FOUND`    | `TARGET_NOT_FOUND`    | Target window/worker not found |
| `ERR_TARGET_CLOSED`       | `TARGET_CLOSED`       | Target has been closed         |
| `ERR_TARGET_DISCONNECTED` | `TARGET_DISCONNECTED` | Target connection lost         |

### Properties

```javascript
class TargetNotFoundError extends ParleyError {
    targetId?: string;      // ID of missing target
    targetType?: string;    // Type: 'window', 'worker', 'iframe'
}
```

### Example

```javascript
import { Parley, TargetNotFoundError } from 'parleyjs';

const parley = new Parley();

try {
    await parley.send('process-data', { data: 'test' });
} catch (error) {
    if (error instanceof TargetNotFoundError) {
        console.error('Target not available:', error.targetType);
        console.error('Error code:', error.code);

        // Wait and retry, or fail gracefully
        if (error.code === 'ERR_TARGET_CLOSED') {
            console.log('Target was closed, cannot retry');
        } else {
            // Attempt reconnection
            await reconnectTarget();
        }
    }
}
```

### Common Causes

- Window was closed by user
- Worker was terminated
- Iframe was removed from DOM
- Target never established connection
- Premature cleanup of target reference

### Resolution

1. Add connection state monitoring before sending
2. Implement reconnection logic for workers
3. Handle window close events to clean up references
4. Use heartbeat monitoring to detect disconnections early
5. Implement graceful degradation when targets unavailable

## SecurityError

Thrown when security constraints are violated, such as origin mismatches or
blocked content.

### Error Codes

| Code                           | Constant          | Description                      |
| ------------------------------ | ----------------- | -------------------------------- |
| `ERR_SECURITY_ORIGIN_MISMATCH` | `ORIGIN_MISMATCH` | Message from unauthorized origin |
| `ERR_SECURITY_CONTENT_BLOCKED` | `CONTENT_BLOCKED` | Content failed security checks   |
| `ERR_SECURITY_UNAUTHORIZED`    | `UNAUTHORIZED`    | Sender not authorized            |

### Properties

```javascript
class SecurityError extends ParleyError {
    origin?: string;        // Origin that caused violation
    expectedOrigin?: string; // Origin that was expected
    violationType?: string;  // Type of security violation
}
```

### Example

```javascript
import { Parley, SecurityError } from 'parleyjs';

const parley = new Parley({
    allowedOrigins: ['https://trusted-domain.com'],
});

parley.on('message', (payload, respond) => {
    respond({ received: true });
});

// In message handler or global error handler
parley.on('error', (error) => {
    if (error instanceof SecurityError) {
        console.error('Security violation detected');
        console.error('From origin:', error.origin);
        console.error('Expected:', error.expectedOrigin);
        console.error('Violation type:', error.violationType);

        // Log security incident
        logSecurityEvent(error);
    }
});
```

### Common Causes

- Message received from non-whitelisted origin
- Attempting to communicate with blocked domain
- XSS payload detected in message content
- Missing or invalid security token
- Origin header spoofing attempt

### Resolution

1. Verify `allowedOrigins` configuration includes legitimate sources
2. Ensure both sides use HTTPS in production
3. Implement content sanitization for user-generated data
4. Use message validation schemas to block malicious content
5. Monitor security error logs for attack patterns

## SerializationError

Thrown when message payload cannot be serialized or deserialized.

### Error Codes

| Code                         | Constant                 | Description                 |
| ---------------------------- | ------------------------ | --------------------------- |
| `ERR_SERIALIZATION_FAILED`   | `SERIALIZATION_FAILED`   | Cannot serialize payload    |
| `ERR_DESERIALIZATION_FAILED` | `DESERIALIZATION_FAILED` | Cannot deserialize payload  |
| `ERR_SERIALIZATION_CIRCULAR` | `CIRCULAR_REFERENCE`     | Circular reference detected |

### Properties

```javascript
class SerializationError extends ParleyError {
    payload?: any;          // Payload that failed
    serializationType?: string; // 'JSON' or custom serializer name
}
```

### Example

```javascript
import { Parley, SerializationError } from 'parleyjs';

const parley = new Parley();

// This will fail due to circular reference
const circular = { name: 'test' };
circular.self = circular;

try {
    await parley.send('process', circular);
} catch (error) {
    if (error instanceof SerializationError) {
        console.error('Serialization failed:', error.code);
        console.error('Serialization type:', error.serializationType);

        // Remove circular references
        const safe = JSON.parse(
            JSON.stringify(circular, (key, value) => {
                return key === 'self' ? undefined : value;
            })
        );

        await parley.send('process', safe);
    }
}
```

### Common Causes

- Circular references in object graph
- Non-serializable values (functions, symbols, undefined)
- Corrupted JSON in received message
- Very large payloads exceeding limits
- Binary data without proper encoding

### Resolution

1. Remove circular references before sending
2. Use `JSON.stringify()` test before sending
3. Implement custom serializer for complex types
4. Encode binary data as base64 or use Transferable objects
5. Validate payload structure before sending

## ConnectionError

Thrown when communication channel establishment or maintenance fails.

### Error Codes

| Code                     | Constant             | Description                    |
| ------------------------ | -------------------- | ------------------------------ |
| `ERR_CONNECTION_FAILED`  | `CONNECTION_FAILED`  | Failed to establish connection |
| `ERR_CONNECTION_LOST`    | `CONNECTION_LOST`    | Connection was lost            |
| `ERR_CONNECTION_REFUSED` | `CONNECTION_REFUSED` | Target refused connection      |

### Properties

```javascript
class ConnectionError extends ParleyError {
    targetType?: string;    // 'window', 'worker', 'iframe'
    reconnectable?: boolean; // Whether reconnection is possible
}
```

### Example

```javascript
import { Parley, ConnectionError } from 'parleyjs';

const parley = new Parley({
    heartbeat: {
        enabled: true,
        interval: 3000,
        timeout: 10000,
    },
});

parley.on('connection:lost', (error) => {
    if (error instanceof ConnectionError) {
        console.error('Connection lost:', error.code);

        if (error.reconnectable) {
            console.log('Attempting reconnection...');
            // Implement reconnection logic
        } else {
            console.error('Connection cannot be re-established');
            // Notify user, clean up resources
        }
    }
});
```

### Common Causes

- Network connectivity issues
- Target window/worker crashed
- Browser tab suspended by OS
- Heartbeat timeout exceeded
- MessageChannel port closed prematurely

### Resolution

1. Enable heartbeat monitoring to detect issues early
2. Implement automatic reconnection with backoff
3. Handle `beforeunload` events to gracefully disconnect
4. Use Service Workers for offline resilience
5. Provide user feedback during connection issues

## ConfigurationError

Thrown when ParleyJS configuration is invalid or incomplete.

### Error Codes

| Code                 | Constant         | Description                |
| -------------------- | ---------------- | -------------------------- |
| `ERR_CONFIG_INVALID` | `INVALID_CONFIG` | Configuration is invalid   |
| `ERR_CONFIG_MISSING` | `MISSING_CONFIG` | Required config is missing |

### Properties

```javascript
class ConfigurationError extends ParleyError {
    configKey?: string;     // Configuration key that's invalid
    providedValue?: any;    // Value that was provided
    expectedType?: string;  // Expected value type
}
```

### Example

```javascript
import { Parley, ConfigurationError } from 'parleyjs';

try {
    const parley = new Parley({
        timeout: -5000, // Invalid negative timeout
    });
} catch (error) {
    if (error instanceof ConfigurationError) {
        console.error('Invalid configuration:', error.configKey);
        console.error('Provided:', error.providedValue);
        console.error('Expected:', error.expectedType);

        // Use valid configuration
        const parley = new Parley({ timeout: 5000 });
    }
}
```

### Common Causes

- Negative timeout values
- Invalid origin patterns
- Malformed schema definitions
- Conflicting configuration options

### Resolution

1. Review configuration against ParleyConfig type definition
2. Use TypeScript for compile-time config validation
3. Validate config before passing to Parley constructor
4. Check documentation for valid config ranges and patterns

## Error Handling Patterns

### Pattern 1: Specific Error Type Handling

```javascript
import { Parley, ValidationError, TimeoutError } from 'parleyjs';

const parley = new Parley();

try {
    const response = await parley.send('process-user', userData);
} catch (error) {
    if (error instanceof ValidationError) {
        // Handle validation errors
        showFieldErrors(error.validationErrors);
    } else if (error instanceof TimeoutError) {
        // Handle timeout
        showRetryOption(error.messageId);
    } else {
        // Handle unexpected errors
        logError(error);
    }
}
```

### Pattern 2: Error Code Switching

```javascript
import { ParleyError, ERROR_CODES } from 'parleyjs';

try {
    await parley.send('operation', data);
} catch (error) {
    if (error instanceof ParleyError) {
        switch (error.code) {
            case ERROR_CODES.SCHEMA_MISMATCH:
                console.error('Schema validation failed');
                break;
            case ERROR_CODES.RESPONSE_TIMEOUT:
                console.error('Operation timed out');
                break;
            case ERROR_CODES.TARGET_NOT_FOUND:
                console.error('Target unavailable');
                break;
            default:
                console.error('Unexpected error:', error.code);
        }
    }
}
```

### Pattern 3: Global Error Handler

```javascript
const parley = new Parley();

parley.on('error', (error) => {
    // Log all errors
    console.error('ParleyJS Error:', {
        type: error.name,
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
        details: error.details,
    });

    // Send to error tracking service
    errorTracker.captureException(error);
});
```

### Pattern 4: Retry with Backoff

```javascript
async function sendWithRetry(channel, payload, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            return await parley.send(channel, payload);
        } catch (error) {
            attempt++;

            if (error instanceof TimeoutError && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}
```

## Troubleshooting Guide

### "Schema validation failed" (ERR_VALIDATION_SCHEMA_MISMATCH)

**Check**:

1. Payload structure matches schema exactly
2. All required fields are present
3. Data types are correct (number vs string)
4. No extra fields when `additionalProperties: false`

**Solution**: Log `error.validationErrors` for specific field issues.

### "Response timeout" (ERR_TIMEOUT_RESPONSE)

**Check**:

1. Handler is calling `respond()` function
2. Handler processing time is reasonable
3. Target is still responsive (check heartbeat)
4. Timeout value is appropriate for operation

**Solution**: Increase timeout or optimize handler performance.

### "Target not found" (ERR_TARGET_NOT_FOUND)

**Check**:

1. Target window/worker still exists
2. Connection was properly established
3. Target didn't close/terminate
4. No race condition at startup

**Solution**: Verify target before sending, implement reconnection.

### "Origin mismatch" (ERR_SECURITY_ORIGIN_MISMATCH)

**Check**:

1. `allowedOrigins` includes the sender's origin
2. Both sides use same protocol (http/https)
3. Port numbers match expectations
4. No typos in origin configuration

**Solution**: Update `allowedOrigins` or ensure HTTPS usage.

### "Serialization failed" (ERR_SERIALIZATION_FAILED)

**Check**:

1. No circular references in payload
2. No functions or symbols in data
3. Payload size is reasonable
4. Binary data is properly encoded

**Solution**: Test with `JSON.stringify()`, remove non-serializable values.

---

## Navigation

**Previous**: [System Events](./system-events.md) **Next**:
[Types Reference](./types.md)

**Related**:

- [Error Handling Pattern](../patterns/error-handling.md)
- [Common Errors](../troubleshooting/common-errors.md)
- [Message Validation](../security/message-validation.md)

**Back to**: [API Reference](./index.md)
