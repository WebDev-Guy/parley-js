# Types Reference

[Home](../../index.md) > [Documentation](./index.md) >
[API Reference](./index.md) > Types

## Overview

ParleyJS is written in TypeScript and provides comprehensive type definitions
for all configuration options, message payloads, event handlers, and error
types. This reference documents all exported types and interfaces.

## Table of Contents

1. [Core Types](#core-types)
2. [Configuration Types](#configuration-types)
3. [Message Types](#message-types)
4. [Handler Types](#handler-types)
5. [Event Types](#event-types)
6. [Error Types](#error-types)
7. [Utility Types](#utility-types)
8. [Type Guards](#type-guards)
9. [Generic Usage](#generic-usage)

---

## Core Types

### Parley

The main ParleyJS class for establishing communication channels.

```typescript
class Parley {
    constructor(config?: ParleyConfig);

    on<T = any, R = any>(
        channel: string,
        handler: MessageHandler<T, R>,
        options?: HandlerOptions
    ): () => void;

    send<T = any, R = any>(
        channel: string,
        payload: T,
        options?: SendOptions
    ): Promise<R>;

    emit<T = any>(channel: string, payload: T): void;

    off(channel: string, handler?: MessageHandler): void;

    destroy(): void;
}
```

**Type Parameters**:

- `T`: Type of message payload
- `R`: Type of response data

**Example**:

```typescript
import { Parley } from 'parleyjs';

interface UserData {
    userId: number;
    username: string;
}

interface UserResponse {
    success: boolean;
    user?: UserData;
}

const parley = new Parley();

// Typed message handler
parley.on<UserData, UserResponse>('create-user', (payload, respond) => {
    // payload is typed as UserData
    const user = createUser(payload);

    // respond accepts UserResponse
    respond({ success: true, user });
});

// Typed send
const response = await parley.send<UserData, UserResponse>('create-user', {
    userId: 123,
    username: 'alice',
});
// response is typed as UserResponse
```

---

## Configuration Types

### ParleyConfig

Main configuration object for Parley instances.

```typescript
interface ParleyConfig {
    /**
     * Target for communication (window, worker, iframe)
     * @default self (current context)
     */
    target?: Window | Worker | MessagePort;

    /**
     * Type of target being communicated with
     */
    targetType?: TargetType;

    /**
     * Default timeout for request-response operations (ms)
     * @default 30000
     */
    timeout?: number;

    /**
     * Allowed origins for security validation
     * @default ['*'] (allow all - not recommended for production)
     */
    allowedOrigins?: string[];

    /**
     * Heartbeat monitoring configuration
     */
    heartbeat?: HeartbeatConfig;

    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean;

    /**
     * Custom serializer for message payloads
     */
    serializer?: MessageSerializer;

    /**
     * Namespace prefix for message channels
     */
    namespace?: string;
}
```

**Example**:

```typescript
const config: ParleyConfig = {
    target: workerInstance,
    targetType: 'worker',
    timeout: 10000,
    allowedOrigins: ['https://app.example.com'],
    heartbeat: {
        enabled: true,
        interval: 5000,
        timeout: 15000,
    },
    debug: process.env.NODE_ENV === 'development',
    namespace: 'myapp',
};

const parley = new Parley(config);
```

### HeartbeatConfig

Configuration for heartbeat monitoring to detect connection issues.

```typescript
interface HeartbeatConfig {
    /**
     * Enable heartbeat monitoring
     * @default false
     */
    enabled: boolean;

    /**
     * Interval between heartbeat pings (ms)
     * @default 5000
     */
    interval?: number;

    /**
     * Timeout before considering target unresponsive (ms)
     * @default 15000
     */
    timeout?: number;

    /**
     * Maximum missed heartbeats before triggering timeout
     * @default 3
     */
    maxMissed?: number;
}
```

**Example**:

```typescript
const heartbeat: HeartbeatConfig = {
    enabled: true,
    interval: 3000, // Send ping every 3 seconds
    timeout: 10000, // Fail if no pong within 10 seconds
    maxMissed: 2, // Fail after 2 consecutive missed heartbeats
};

const parley = new Parley({ heartbeat });
```

### TargetType

Enum-like type for different communication targets.

```typescript
type TargetType = 'window' | 'worker' | 'iframe' | 'port';
```

**Usage**:

```typescript
import { Parley, TargetType } from 'parleyjs';

const workerParley = new Parley({
    target: myWorker,
    targetType: 'worker' as TargetType,
});

const iframeParley = new Parley({
    target: iframeWindow,
    targetType: 'iframe' as TargetType,
});
```

---

## Message Types

### SendOptions

Options for `send()` operations.

```typescript
interface SendOptions {
    /**
     * Override default timeout for this message (ms)
     */
    timeout?: number;

    /**
     * Message priority (higher number = higher priority)
     * @default 0
     */
    priority?: number;

    /**
     * Transfer ownership of Transferable objects
     */
    transfer?: Transferable[];

    /**
     * Metadata to attach to message
     */
    metadata?: Record<string, any>;
}
```

**Example**:

```typescript
// Send with custom timeout
const response = await parley.send('slow-operation', data, {
    timeout: 60000, // 60 second timeout
});

// Send with transferable objects (e.g., ArrayBuffer)
const buffer = new ArrayBuffer(1024);
await parley.send(
    'process-buffer',
    { buffer },
    {
        transfer: [buffer], // Transfer ownership to worker
    }
);

// Send with priority
await parley.send('urgent-task', data, {
    priority: 10, // Higher priority than default
    metadata: { userId: 123, requestId: 'req-456' },
});
```

### MessageMetadata

Metadata attached to every message.

```typescript
interface MessageMetadata {
    /**
     * Unique message identifier
     */
    messageId: string;

    /**
     * Message channel name
     */
    channel: string;

    /**
     * Timestamp when message was sent
     */
    timestamp: number;

    /**
     * Origin of the message sender
     */
    origin?: string;

    /**
     * Custom metadata provided in SendOptions
     */
    custom?: Record<string, any>;

    /**
     * Whether this message expects a response
     */
    expectsResponse: boolean;
}
```

**Example**:

```typescript
parley.on('process', (payload, respond, metadata) => {
    console.log('Message ID:', metadata.messageId);
    console.log('Sent at:', new Date(metadata.timestamp));
    console.log('From origin:', metadata.origin);
    console.log('Custom data:', metadata.custom);

    respond({ processed: true });
});
```

### MessageSerializer

Interface for custom message serialization.

```typescript
interface MessageSerializer {
    /**
     * Serialize payload before sending
     */
    serialize(payload: any): any;

    /**
     * Deserialize payload after receiving
     */
    deserialize(data: any): any;
}
```

**Example**:

```typescript
import { ParleyConfig, MessageSerializer } from 'parleyjs';

// Custom serializer using MessagePack
const msgpackSerializer: MessageSerializer = {
    serialize(payload) {
        return msgpack.encode(payload);
    },
    deserialize(data) {
        return msgpack.decode(data);
    },
};

const config: ParleyConfig = {
    serializer: msgpackSerializer,
};
```

---

## Handler Types

### MessageHandler

Type for message event handlers.

```typescript
type MessageHandler<T = any, R = any> = (
    payload: T,
    respond: ResponseFunction<R>,
    metadata: MessageMetadata
) => void | Promise<void>;
```

**Type Parameters**:

- `T`: Type of incoming payload
- `R`: Type of response data

**Example**:

```typescript
import { MessageHandler } from 'parleyjs';

interface CalculateRequest {
    operation: 'add' | 'subtract';
    a: number;
    b: number;
}

interface CalculateResponse {
    result: number;
}

const calculateHandler: MessageHandler<CalculateRequest, CalculateResponse> = (
    payload,
    respond,
    metadata
) => {
    const result =
        payload.operation === 'add'
            ? payload.a + payload.b
            : payload.a - payload.b;

    respond({ result });
};

parley.on('calculate', calculateHandler);
```

### ResponseFunction

Function signature for responding to messages.

```typescript
type ResponseFunction<R = any> = (response: R) => void;
```

**Example**:

```typescript
parley.on<UserQuery, UserData>('get-user', async (payload, respond) => {
    const user = await fetchUser(payload.userId);

    // respond is typed as ResponseFunction<UserData>
    respond({ userId: user.id, username: user.name });
});
```

### HandlerOptions

Options for registering message handlers.

```typescript
interface HandlerOptions {
    /**
     * JSON schema for payload validation
     */
    schema?: object;

    /**
     * Validate payload before calling handler
     * @default true if schema provided
     */
    validate?: boolean;

    /**
     * Handler priority (higher = called earlier)
     * @default 0
     */
    priority?: number;

    /**
     * Call handler only once, then auto-unregister
     * @default false
     */
    once?: boolean;
}
```

**Example**:

```typescript
const userSchema = {
    type: 'object',
    properties: {
        userId: { type: 'number' },
        email: { type: 'string', format: 'email' },
    },
    required: ['userId', 'email'],
};

parley.on('create-user', handler, {
    schema: userSchema, // Auto-validate against schema
    validate: true, // Enable validation
    priority: 10, // High priority handler
    once: false, // Can be called multiple times
});
```

---

## Event Types

### System Events

ParleyJS emits various system events for monitoring.

```typescript
type SystemEvent =
    | 'ready'
    | 'error'
    | 'message:sent'
    | 'message:received'
    | 'connection:established'
    | 'connection:lost'
    | 'heartbeat:sent'
    | 'heartbeat:received'
    | 'heartbeat:timeout';
```

**Example**:

```typescript
import { Parley, SystemEvent } from 'parleyjs';

const parley = new Parley();

parley.on('ready', () => {
    console.log('Parley is ready');
});

parley.on('error', (error) => {
    console.error('Error occurred:', error);
});

parley.on('connection:lost', () => {
    console.warn('Connection lost - attempting reconnect');
});

parley.on('heartbeat:timeout', () => {
    console.error('Target is unresponsive');
});
```

### EventCallback

Generic callback type for system events.

```typescript
type EventCallback<T = any> = (data: T) => void | Promise<void>;
```

---

## Error Types

All error types extend the base `ParleyError` class. See
[Error Codes Reference](./error-codes.md) for detailed documentation.

### ParleyError

```typescript
class ParleyError extends Error {
    code: string;
    details?: any;
    timestamp: number;
}
```

### ValidationError

```typescript
class ValidationError extends ParleyError {
    validationErrors: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
    schema?: object;
    payload?: any;
}
```

### TimeoutError

```typescript
class TimeoutError extends ParleyError {
    messageId: string;
    timeout: number;
    channel: string;
}
```

### TargetNotFoundError

```typescript
class TargetNotFoundError extends ParleyError {
    targetId?: string;
    targetType?: string;
}
```

### SecurityError

```typescript
class SecurityError extends ParleyError {
    origin?: string;
    expectedOrigin?: string;
    violationType?: string;
}
```

### SerializationError

```typescript
class SerializationError extends ParleyError {
    payload?: any;
    serializationType?: string;
}
```

### ConnectionError

```typescript
class ConnectionError extends ParleyError {
    targetType?: string;
    reconnectable?: boolean;
}
```

### ConfigurationError

```typescript
class ConfigurationError extends ParleyError {
    configKey?: string;
    providedValue?: any;
    expectedType?: string;
}
```

---

## Utility Types

### UnsubscribeFunction

Return type from `parley.on()` for unsubscribing handlers.

```typescript
type UnsubscribeFunction = () => void;
```

**Example**:

```typescript
const unsubscribe = parley.on('message', handler);

// Later, unsubscribe from this specific handler
unsubscribe();
```

### ResolvedConfig

Internal type representing fully resolved configuration with defaults applied.

```typescript
interface ResolvedConfig extends Required<ParleyConfig> {
    // All optional ParleyConfig fields become required
}
```

---

## Type Guards

### isParleyError

Check if an error is a ParleyError instance.

```typescript
function isParleyError(error: any): error is ParleyError {
    return error instanceof ParleyError;
}
```

**Example**:

```typescript
import { isParleyError, ParleyError } from 'parleyjs';

try {
    await parley.send('operation', data);
} catch (error) {
    if (isParleyError(error)) {
        console.error('ParleyJS error:', error.code);
        console.error('Details:', error.details);
    } else {
        console.error('Unknown error:', error);
    }
}
```

### isValidationError

```typescript
function isValidationError(error: any): error is ValidationError {
    return error instanceof ValidationError;
}
```

### isTimeoutError

```typescript
function isTimeoutError(error: any): error is TimeoutError {
    return error instanceof TimeoutError;
}
```

### isSecurityError

```typescript
function isSecurityError(error: any): error is SecurityError {
    return error instanceof SecurityError;
}
```

**Example**:

```typescript
import { isValidationError, isTimeoutError, isSecurityError } from 'parleyjs';

try {
    await parley.send('process', data);
} catch (error) {
    if (isValidationError(error)) {
        handleValidationErrors(error.validationErrors);
    } else if (isTimeoutError(error)) {
        retryWithLongerTimeout(error.channel);
    } else if (isSecurityError(error)) {
        logSecurityIncident(error.origin);
    }
}
```

---

## Generic Usage

### Strongly Typed Handlers

Define interfaces for your message contracts and use generics for type safety.

```typescript
// Define message contracts
interface UserCreateRequest {
    username: string;
    email: string;
    password: string;
}

interface UserCreateResponse {
    success: boolean;
    userId?: number;
    errors?: string[];
}

// Typed handler
const createUserHandler: MessageHandler<
    UserCreateRequest,
    UserCreateResponse
> = (payload, respond) => {
    // payload is fully typed
    const user = createUser(payload.username, payload.email, payload.password);

    // respond accepts only UserCreateResponse
    respond({
        success: true,
        userId: user.id,
    });
};

// Register with types
parley.on<UserCreateRequest, UserCreateResponse>(
    'user:create',
    createUserHandler
);

// Send with types
const result = await parley.send<UserCreateRequest, UserCreateResponse>(
    'user:create',
    { username: 'alice', email: 'alice@example.com', password: 'secret' }
);

// result is typed as UserCreateResponse
if (result.success) {
    console.log('User created:', result.userId);
}
```

### Union Types for Channels

```typescript
type AppChannel =
    | 'user:create'
    | 'user:update'
    | 'user:delete'
    | 'post:create'
    | 'post:publish';

type ChannelPayload<T extends AppChannel> = T extends 'user:create'
    ? UserCreateRequest
    : T extends 'user:update'
      ? UserUpdateRequest
      : T extends 'user:delete'
        ? { userId: number }
        : T extends 'post:create'
          ? PostCreateRequest
          : T extends 'post:publish'
            ? { postId: number }
            : never;

// Type-safe channel messaging
async function typedSend<T extends AppChannel>(
    channel: T,
    payload: ChannelPayload<T>
) {
    return parley.send(channel, payload);
}

// Usage - TypeScript ensures correct payload type
await typedSend('user:create', {
    username: 'alice',
    email: '...',
    password: '...',
});
await typedSend('post:publish', { postId: 123 });
```

### Discriminated Unions for Responses

```typescript
type ApiResponse<T> =
    | { success: true; data: T }
    | { success: false; error: string; code: string };

interface User {
    id: number;
    username: string;
}

const response = await parley.send<{ userId: number }, ApiResponse<User>>(
    'get-user',
    { userId: 123 }
);

// TypeScript narrows type based on success field
if (response.success) {
    console.log('User:', response.data.username); // data is available
} else {
    console.error('Error:', response.error); // error is available
}
```

### Custom Type Validators

```typescript
import { MessageHandler } from 'parleyjs';

function createTypedHandler<T, R>(
    validator: (payload: any) => payload is T,
    handler: (payload: T, respond: (r: R) => void) => void | Promise<void>
): MessageHandler<any, R> {
    return (payload, respond, metadata) => {
        if (!validator(payload)) {
            throw new ValidationError('Invalid payload type');
        }
        return handler(payload, respond);
    };
}

// Type guard
function isUserRequest(payload: any): payload is UserCreateRequest {
    return (
        typeof payload === 'object' &&
        typeof payload.username === 'string' &&
        typeof payload.email === 'string'
    );
}

// Usage
const handler = createTypedHandler<UserCreateRequest, UserCreateResponse>(
    isUserRequest,
    (payload, respond) => {
        // payload is guaranteed to be UserCreateRequest
        respond({ success: true, userId: createUser(payload) });
    }
);

parley.on('user:create', handler);
```

---

## Navigation

**Previous**: [Error Codes](./error-codes.md) **Next**:
[Guides](../guides/index.md)

**Related**:

- [Methods Reference](./methods.md)
- [Getting Started with TypeScript](../getting-started/typescript.md)
- [Message Validation](../security/message-validation.md)

**Back to**: [API Reference](./index.md)
