# Error Codes Reference

[Home](../index.md) > [Documentation](./index.md) >
[API Reference](./index.md) > Error Codes

## Overview

ParleyJS reports failures of your own calls (`send()`, `connect()`,
`broadcast()`, ...) by throwing or rejecting with an error class that extends
`ParleyError`. Each error has a machine-readable `code`. Problems with
_incoming_ messages (a local handler throwing, a message rejected by the
security checks) are reported through the `system:error` event and the
`register()` `onError` option instead, because there is no call to reject.

Configuration and usage mistakes (invalid `Parley.create()` options, a duplicate
`register()`, a reserved type name, calling methods after `destroy()`) throw a
plain `Error`, not a `ParleyError`.

## Table of Contents

1. [Error Class Hierarchy](#error-class-hierarchy)
2. [ParleyError](#parleyerror)
3. [Error Classes](#error-classes)
4. [Error Codes by Category](#error-codes-by-category)
5. [Remote Error Responses](#remote-error-responses)
6. [Reserved Codes](#reserved-codes)
7. [Plain Errors](#plain-errors)
8. [Handling Errors](#handling-errors)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## Error Class Hierarchy

```text
Error
└── ParleyError
    ├── ValidationError
    ├── TimeoutError
    ├── TargetNotFoundError
    ├── SecurityError
    ├── SerializationError
    └── ConnectionError
```

All classes, the type guards and the code constants are exported:

```typescript
import {
    ParleyError,
    ValidationError,
    TimeoutError,
    TargetNotFoundError,
    SecurityError,
    SerializationError,
    ConnectionError,
    isParleyError,
    isValidationError,
    isTimeoutError,
    isSecurityError,
    ERROR_CODES,
} from 'ignite-parleyjs';
```

There is no `ConfigurationError`, `TargetError` or `HandlerError` class.

---

## ParleyError

The base class. Errors created from a remote error response are plain
`ParleyError` instances carrying the remote code.

| Property    | Type        | Description                            |
| ----------- | ----------- | -------------------------------------- |
| `name`      | `string`    | Class name, e.g. `'TimeoutError'`      |
| `message`   | `string`    | Human-readable description             |
| `code`      | `ErrorCode` | Machine-readable code (`'ERR_...'`)    |
| `details`   | `unknown`   | Optional context, depends on the error |
| `timestamp` | `number`    | When the error was created (ms)        |
| `stack`     | `string`    | Stack trace                            |

`toJSON()` returns `{ name, message, code, details, timestamp, stack }`.

---

## Error Classes

### ValidationError

| Extra property     | Type                                   | Description                                                               |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------- |
| `validationErrors` | `ValidationErrorDetail[] \| undefined` | Set for schema failures: `{ path, message, expected?, received?, rule? }` |

Default code `ERR_VALIDATION_SCHEMA_MISMATCH`. Thrown by `send()` and
`broadcast()` when the payload fails the locally registered schema or its
serialized size exceeds 10 MB (in that case `details` is
`{ size, maxSize, rule: 'payloadSize' }` and `validationErrors` is unset).

### TimeoutError

| Extra property     | Type                  | Description                      |
| ------------------ | --------------------- | -------------------------------- |
| `messageId`        | `string \| undefined` | ID of the request that timed out |
| `timeoutMs`        | `number \| undefined` | Timeout per attempt, in ms       |
| `retriesAttempted` | `number \| undefined` | Number of retries made           |

Code `ERR_TIMEOUT_NO_RESPONSE`. `send()` rejects with it when no response
arrived after the timeout and all retries. A handshake timeout is **not** a
`TimeoutError`; it is a `ConnectionError` with
`ERR_CONNECTION_HANDSHAKE_FAILED`.

### TargetNotFoundError

| Extra property | Type                  | Description         |
| -------------- | --------------------- | ------------------- |
| `targetId`     | `string \| undefined` | The target involved |

Produced with `ERR_TARGET_NOT_CONNECTED` (by `send()`) and
`ERR_TARGET_DUPLICATE_ID` (by `connect()`).

### SecurityError

| Extra property   | Type                    | Description                   |
| ---------------- | ----------------------- | ----------------------------- |
| `receivedOrigin` | `string \| undefined`   | Origin that failed validation |
| `allowedOrigins` | `string[] \| undefined` | The allowed list              |

Only thrown by the exported `assertOrigin()` utility (code
`ERR_SECURITY_ORIGIN_MISMATCH`). The `Parley` instance never throws it: a
rate-limit rejection is a plain `ParleyError` with `ERR_SECURITY_RATE_LIMITED`,
and inbound security rejections are reported through `system:error`.

### SerializationError

No extra properties. Thrown by `send()` and `broadcast()` (and by `respond()`)
when the default security layer cannot JSON-clone the payload:
`ERR_SERIALIZATION_CIRCULAR_REFERENCE` for circular references,
`ERR_SERIALIZATION_SERIALIZE_FAILED` for other failures such as `BigInt` values.
Since 1.1.0; earlier versions silently sent `{}`.

### ConnectionError

| Extra property | Type                  | Description                     |
| -------------- | --------------------- | ------------------------------- |
| `targetId`     | `string \| undefined` | The target involved, when known |

Produced with `ERR_CONNECTION_HANDSHAKE_FAILED`, `ERR_CONNECTION_FAILED`,
`ERR_CONNECTION_CLOSED` and `ERR_CONNECTION_NOT_CONNECTED`. See below.

---

## Error Codes by Category

These are the codes ParleyJS actually produces. Use the `ERROR_CODES` constant
(or the category constants such as `TIMEOUT_ERRORS`) instead of string literals:
`ERROR_CODES.NO_RESPONSE === 'ERR_TIMEOUT_NO_RESPONSE'`.

### Validation

| Code                               | Class             | When                                                                                                                                                                                                             |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_VALIDATION_SCHEMA_MISMATCH`   | `ValidationError` | `send()`/`broadcast()` payload fails the local schema or exceeds 10 MB. Also the code of the error response when the receiver's schema rejects a payload (see [Remote Error Responses](#remote-error-responses)) |
| `ERR_VALIDATION_INVALID_PROTOCOL`  | (event)           | `system:error` when an inbound message is malformed or `SecurityLayer.validateMessage()` rejects it                                                                                                              |
| `ERR_VALIDATION_UNREGISTERED_TYPE` | `ValidationError` | Only from the low-level `MessageRegistry#getOrThrow()`. `send()` does not require registration                                                                                                                   |

### Timeout

| Code                      | Class          | When                                                                                     |
| ------------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| `ERR_TIMEOUT_NO_RESPONSE` | `TimeoutError` | `send()` got no response after the timeout and all retries (also emits `system:timeout`) |

### Target

| Code                       | Class                 | When                                                                                    |
| -------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `ERR_TARGET_NOT_CONNECTED` | `TargetNotFoundError` | `send()` with an unknown or unconnected `targetId`, or with no connected targets at all |
| `ERR_TARGET_DUPLICATE_ID`  | `TargetNotFoundError` | `connect()` with a `targetId` that is already in use                                    |
| `ERR_TARGET_NOT_FOUND`     | `TargetNotFoundError` | Only from the low-level `TargetManager#getOrThrow()`; not produced by `Parley` methods  |

### Security

| Code                            | Class                     | When                                                                                                                 |
| ------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ERR_SECURITY_RATE_LIMITED`     | `ParleyError`             | `send()` exceeded `rateLimit.messagesPerSecond` (only when `rateLimit.enabled`)                                      |
| `ERR_SECURITY_ORIGIN_MISMATCH`  | (event) / `SecurityError` | `system:error` when a custom `SecurityLayer.validateOrigin()` rejects an inbound message; thrown by `assertOrigin()` |
| `ERR_SECURITY_VERSION_MISMATCH` | (event)                   | `system:error` when an inbound message uses an incompatible protocol major version                                   |

Messages from origins not in `allowedOrigins`, and messages from a window other
than the connected target, are dropped silently before these checks.

### Serialization

| Code                                   | Class                | When                                                                        |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `ERR_SERIALIZATION_CIRCULAR_REFERENCE` | `SerializationError` | Payload or response contains a circular reference                           |
| `ERR_SERIALIZATION_SERIALIZE_FAILED`   | `SerializationError` | Payload or response cannot be serialized for another reason (e.g. `BigInt`) |

### Connection

| Code                              | Class             | When                                                                                                                                                                                                                 |
| --------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_CONNECTION_HANDSHAKE_FAILED` | `ConnectionError` | `connect()`: the handshake did not complete within `timeout`                                                                                                                                                         |
| `ERR_CONNECTION_FAILED`           | `ConnectionError` | `connect()`: invalid target for the instance's `targetType` (e.g. `iframe.contentWindow` passed to an iframe instance), or the iframe/window did not become ready in time                                            |
| `ERR_CONNECTION_CLOSED`           | `ConnectionError` | A pending `send()` was rejected because the target disconnected (`'Target disconnected'`) or the instance was destroyed (`'Parley instance destroyed'`); `connect()` to a popup that was closed while waiting for it |
| `ERR_CONNECTION_NOT_CONNECTED`    | `ConnectionError` | `send()` to a target whose origin has not been established yet; also used internally for heartbeat and disconnect messages                                                                                           |

### General

| Code          | Class         | When                                                                                                                                                                  |
| ------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_UNKNOWN` | `ParleyError` | A remote error response without a code; a non-`ParleyError` thrown by a handler, as passed to that type's `onError`; `system:handshake_failed` for a non-Parley error |

---

## Remote Error Responses

When the receiving side cannot handle a request that expects a response, it
sends back an error response. The sender's `send()` then rejects with a plain
`ParleyError` whose `code` is the remote code:

| Code                             | Meaning                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_HANDLER_ERROR`              | The remote handler threw or rejected. The message is `'Handler error'` unless the **receiver** was created with `exposeHandlerErrors: true`, in which case it is the original error message |
| `ERR_NO_HANDLER`                 | No handler is registered for the type on the remote side                                                                                                                                    |
| `ERR_VALIDATION_SCHEMA_MISMATCH` | The receiver's registered schema rejected the payload; `details` holds the validation error list                                                                                            |

`ERR_HANDLER_ERROR` and `ERR_NO_HANDLER` are wire-only codes: they are not in
`ERROR_CODES`. On the receiving side a throwing handler also emits
`system:error` (code `ERR_HANDLER_ERROR`, full message) and calls the type's
`onError` option.

```typescript
try {
    await parley.send('doc:save', doc, { targetId: 'editor' });
} catch (error) {
    if (isParleyError(error) && error.code === 'ERR_NO_HANDLER') {
        console.warn('The editor does not handle doc:save');
    }
}
```

---

## Reserved Codes

These codes are defined in `ERROR_CODES` but are not produced by ParleyJS 1.1.0.
Do not rely on receiving them.

- `ERR_TIMEOUT_HANDSHAKE` (handshake timeouts use
  `ERR_CONNECTION_HANDSHAKE_FAILED`), `ERR_TIMEOUT_RETRIES_EXHAUSTED`
- `ERR_SECURITY_UNTRUSTED_SOURCE`, `ERR_SECURITY_DANGEROUS_PAYLOAD`
- `ERR_TARGET_CLOSED`, `ERR_TARGET_INVALID_TYPE`
- `ERR_CONNECTION_NOT_OPEN`, `ERR_CONNECTION_ALREADY_CONNECTED`,
  `ERR_CONNECTION_NOT_READY`, `ERR_CONNECTION_LOST` (a lost connection is
  reported by `system:connection_lost`)
- `ERR_SERIALIZATION_DESERIALIZE_FAILED`
- `ERR_CONFIG_INVALID`, `ERR_CONFIG_MISSING_REQUIRED`, `ERR_CONFIG_OUT_OF_RANGE`
  (configuration errors are plain `Error`s)
- `ERR_VALIDATION_REQUIRED_FIELD_MISSING`, `ERR_VALIDATION_TYPE_MISMATCH` (used
  only internally while checking inbound protocol structure; reported to you as
  `ERR_VALIDATION_INVALID_PROTOCOL`)

---

## Plain Errors

These throw a plain `Error` (check `error.message`, there is no `code`):

| Situation                                                                                                                  | Message                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Invalid `Parley.create()` config                                                                                           | Starts with `'Configuration error: '`                                                                       |
| `register()` of a type already registered with `register()`                                                                | `'Message type "x" is already registered'`                                                                  |
| `register()`/`on()` with an empty type or a `__parley_`/`system:` prefix                                                   | Describes the reserved prefix                                                                               |
| Calling `register`, `on`, `onSystem`, `onAnalyticsEvent`, `send`, `broadcast`, `connect` or `disconnect` after `destroy()` | `'Parley instance has been destroyed'`                                                                      |
| Calling `respond()` twice for one message                                                                                  | `'Response already sent for message ...'` (thrown inside the handler, so it is reported as a handler error) |

---

## Handling Errors

### Calls: try/catch with instanceof or guards

```typescript
import {
    ConnectionError,
    SerializationError,
    TargetNotFoundError,
    isParleyError,
    isTimeoutError,
    isValidationError,
} from 'ignite-parleyjs';

try {
    const result = await parley.send(
        'user:get',
        { id: 1 },
        { targetId: 'child' }
    );
} catch (error) {
    if (isTimeoutError(error)) {
        console.warn(`No response after ${error.retriesAttempted} retries`);
    } else if (isValidationError(error)) {
        console.error('Invalid payload', error.validationErrors);
    } else if (error instanceof TargetNotFoundError) {
        console.error('Not connected to', error.targetId);
    } else if (error instanceof SerializationError) {
        console.error('Payload cannot be serialized', error.code);
    } else if (error instanceof ConnectionError) {
        console.error('Connection closed while waiting', error.message);
    } else if (isParleyError(error)) {
        // Remote error responses (ERR_HANDLER_ERROR, ERR_NO_HANDLER, ...) and
        // ERR_SECURITY_RATE_LIMITED
        console.error(error.code, error.message);
    } else {
        throw error; // Plain Error, e.g. instance destroyed
    }
}
```

### Connecting

```typescript
import { ConnectionError, ERROR_CODES } from 'ignite-parleyjs';

try {
    await parley.connect(iframe, 'child');
} catch (error) {
    if (
        error instanceof ConnectionError &&
        error.code === ERROR_CODES.HANDSHAKE_FAILED
    ) {
        // The page in the iframe never called connect(), or its
        // allowedOrigins does not include this origin
    }
}
```

### Error codes by switch

```typescript
import { ERROR_CODES, isParleyError } from 'ignite-parleyjs';

function describe(error: unknown): string {
    if (!isParleyError(error)) return 'Unexpected error';
    switch (error.code) {
        case ERROR_CODES.NO_RESPONSE:
            return 'The other window did not answer';
        case ERROR_CODES.NOT_CONNECTED: // ERR_TARGET_NOT_CONNECTED
            return 'Not connected';
        case ERROR_CODES.RATE_LIMITED:
            return 'Too many messages';
        default:
            return error.message;
    }
}
```

Note that `ERROR_CODES` merges the category objects, so where two categories use
the same key the later one wins: `ERROR_CODES.NOT_CONNECTED` is
`'ERR_CONNECTION_NOT_CONNECTED'` and `ERROR_CODES.CLOSED` is
`'ERR_CONNECTION_CLOSED'`. Use `TARGET_ERRORS.NOT_CONNECTED` for
`'ERR_TARGET_NOT_CONNECTED'`.

### Inbound problems: system:error and onError

```typescript
import { SYSTEM_EVENTS } from 'ignite-parleyjs';

// Local handler errors and rejected inbound messages
parley.onSystem(SYSTEM_EVENTS.ERROR, (data) => {
    const event = data as { code: string; message: string; targetId?: string };
    console.error(`[${event.code}] ${event.message}`, event.targetId);
});

// Per type: schema failures and handler errors for inbound messages
parley.register('order:submit', {
    schema: { type: 'object', required: ['orderId'] },
    onError: (error, metadata) => {
        console.warn(`order:submit from ${metadata.senderId}:`, error.code);
    },
});
```

There is no `parley.on('error', ...)` global handler; `on()` only registers
application message types.

---

## Troubleshooting Guide

### ERR_CONNECTION_HANDSHAKE_FAILED

`connect()` timed out. Check that both sides call `connect()`, that each side's
`allowedOrigins` lists the other side's exact origin, that both use the same
`targetType`, and that the pages are served over http(s) (`file://` pages have
the `'null'` origin and are not supported).

### ERR_TIMEOUT_NO_RESPONSE

The receiver did not call `respond()` (returning a value does not reply), its
handler is slow, or the timeout is too short. Increase `timeout` per call or per
type, or send with `expectsResponse: false` if no reply is needed.

### ERR_TARGET_NOT_CONNECTED

`send()` ran before `connect()` resolved, the `targetId` is wrong, or the target
was disconnected. Check `parley.getConnectedTargets()`.

### ERR_VALIDATION_SCHEMA_MISMATCH

Inspect `error.validationErrors` (local) or `error.details` (remote). Remember
that only the supported schema keywords are enforced.

### ERR_SERIALIZATION_CIRCULAR_REFERENCE / ERR_SERIALIZATION_SERIALIZE_FAILED

Remove circular references and `BigInt` values. Payloads are JSON-cloned, so
also expect functions and `undefined` to be dropped and `Date` to become a
string.

### ERR_HANDLER_ERROR with message 'Handler error'

The remote handler threw. Look at the receiver's `system:error` events or
`onError` callback for the real message, or enable `exposeHandlerErrors` on the
receiver when both sides are trusted.

---

## Navigation

**Previous**: [System Events](./system-events.md) **Next**:
[Types Reference](./types.md)

**Related**:

- [Error Handling Pattern](../patterns/error-handling.md)
- [Common Errors](../troubleshooting/common-errors.md)
- [Message Validation](../security/message-validation.md)

**Back to**: [API Reference](./index.md)
