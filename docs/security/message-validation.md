[Home](../index.md) > [Documentation](./index.md) > [Security](./index.md) >
Message Validation

# Message Validation

Complete guide to validating message payloads in ParleyJS for secure
cross-window communication.

## Table of Contents

1. [Overview](#overview)
2. [Why Validate Messages](#why-validate-messages)
3. [JSON Schema Validation](#json-schema-validation)
4. [Type Validation](#type-validation)
5. [Content Sanitization](#content-sanitization)
6. [Validation Libraries](#validation-libraries)
7. [Error Handling](#error-handling)
8. [Security Best Practices](#security-best-practices)
9. [Complete Examples](#complete-examples)

---

## Overview

Message validation ensures that incoming payloads match expected structures and
types before processing. ParleyJS provides built-in validation for a subset of
JSON Schema, and you can add your own validators (or libraries such as Zod)
inside handlers.

Validation prevents:

- Type errors from malformed data
- Security vulnerabilities from unexpected content
- Application crashes from invalid payloads
- Data corruption from incorrect types

What ParleyJS validates automatically:

- **Protocol structure** of every inbound message (not your payload)
- **Your payload**, only for message types registered with a `schema`

What it does **not** do: escape HTML, strip dangerous keys, or enforce business
rules. That is your handler's job.

---

## Why Validate Messages

Cross-window communication involves untrusted data sources. Always validate
messages to protect your application, even when they come from an allowed
origin.

### Security Risks Without Validation

**XSS via Messages** (Parley does not escape HTML):

```typescript
// DANGEROUS - No validation
parley.on('display-message', (payload, respond) => {
    document.getElementById('output').innerHTML = payload.html; // XSS!
});
```

**Type Confusion**:

```typescript
// DANGEROUS - Assumes number
parley.on('set-quantity', (payload, respond) => {
    const total = payload.quantity * price; // What if quantity is a string?
});
```

**Prototype Pollution**:

```typescript
// DANGEROUS - No validation
parley.on('update-settings', (payload, respond) => {
    Object.assign(settings, payload); // Copies any key, including unexpected ones
});
```

### Benefits of Validation

- Catches errors early before data processing
- Provides clear error messages for debugging
- Documents expected message structure
- Prevents security vulnerabilities
- Enables type-safe communication

---

## JSON Schema Validation

ParleyJS supports a subset of JSON Schema for declarative validation. Attach a
schema with `register(type, { schema })`, then add the handler with `on()`.
(`on()` itself does not take options; a schema passed to it is not used.)

### Basic Schema Validation

```typescript
import { Parley } from 'ignite-parleyjs';

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: [window.location.origin],
});

// Define JSON Schema for user data
const userSchema = {
    type: 'object',
    properties: {
        userId: { type: 'number' },
        username: { type: 'string', minLength: 3, maxLength: 20 },
        email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+$' },
        role: { type: 'string', enum: ['admin', 'user', 'guest'] },
    },
    required: ['userId', 'username', 'email'],
    additionalProperties: false,
} as const;

// Register the type with its schema
parley.register('create-user', {
    schema: userSchema,
    // Optional: observe rejected payloads and handler errors for this type
    onError: (error, metadata) => {
        console.warn('create-user rejected', error.code, metadata.origin);
    },
});

// Add the handler
parley.on('create-user', (payload, respond, metadata) => {
    // Only called if the payload passed the schema
    const { userId, username, email, role } = payload;

    const user = createUser({ userId, username, email, role });
    respond({ success: true, user });
});
```

How registered schemas are applied:

- **On send**: `send()` validates the payload against the local schema for that
  type and rejects with `ValidationError` (`ERR_VALIDATION_SCHEMA_MISMATCH`)
  before anything is posted.
- **On receive**: the receiver validates against its own registered schema. If
  validation fails, the handler is not called, the type's `onError` is invoked,
  and (if the sender expects a response) the sender's `send()` rejects with a
  `ParleyError` carrying `ERR_VALIDATION_SCHEMA_MISMATCH`.

### Supported Keywords

Only these keywords are enforced:

| Keyword                | Applies to         | Notes                                                                                |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `type`                 | all                | A single string: `string`, `number`, `integer`, `boolean`, `object`, `array`, `null` |
| `required`             | objects            | Own properties only                                                                  |
| `properties`           | objects            |                                                                                      |
| `additionalProperties` | objects            | `false` or a schema                                                                  |
| `items`                | arrays             | A single schema applied to every item                                                |
| `minLength/maxLength`  | strings and arrays | Use these for array length (there is no `minItems` / `maxItems`)                     |
| `minimum/maximum`      | numbers            |                                                                                      |
| `pattern`              | strings            | Regular expression source                                                            |
| `enum`                 | all                |                                                                                      |
| `description/default`  | all                | Annotations only; `default` is not applied to payloads                               |

Everything else is **silently ignored**, including `format`, `minItems`,
`maxItems`, `oneOf`, `anyOf`, `allOf`, `$ref`, `const` and type arrays such as
`type: ['string', 'null']`. Do not rely on them for security. For richer
validation, use a library inside the handler (see
[Validation Libraries](#validation-libraries)).

Validation stops at a schema nesting depth of 50 and collects at most 100 errors
per level.

### Schema Validation with SchemaValidator

You can also validate manually:

```typescript
import { SchemaValidator } from 'ignite-parleyjs';

const validator = new SchemaValidator();

// Define schema
const messageSchema = {
    type: 'object',
    properties: {
        action: { type: 'string' },
        payload: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                data: { type: 'string' },
            },
            required: ['id'],
        },
    },
    required: ['action', 'payload'],
};

// Validate manually
parley.on('process-action', (payload, respond) => {
    const result = validator.validate(payload, messageSchema); // { valid, errors }

    if (!result.valid) {
        respond({ success: false, errors: result.errors });
        return;
    }

    // Process validated payload
    handleAction(payload);
    respond({ success: true });
});
```

### Common JSON Schema Patterns

**Enum Values**:

```typescript
const schema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['pending', 'active', 'completed', 'cancelled'],
        },
    },
};
```

**Array Validation**:

```typescript
const schema = {
    type: 'object',
    properties: {
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                },
                required: ['id', 'name'],
            },
            minLength: 1, // array length: use minLength/maxLength
            maxLength: 100,
        },
    },
};
```

**Nested Objects**:

```typescript
const schema = {
    type: 'object',
    properties: {
        user: {
            type: 'object',
            properties: {
                profile: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        age: { type: 'number', minimum: 0, maximum: 150 },
                    },
                },
            },
        },
    },
};
```

---

## Type Validation

TypeScript provides compile-time type checking. Combine with runtime validation
for complete safety: the generic on `on<T>()` is only a type annotation and does
not validate anything at runtime.

### TypeScript Interface Validation

```typescript
import type { ResponseFunction } from 'ignite-parleyjs';

interface UpdateRequest {
    userId: number;
    updates: {
        email?: string;
        name?: string;
    };
}

interface UpdateResponse {
    success: boolean;
    user?: {
        userId: number;
        email: string;
        name: string;
    };
    error?: string;
}

// TypeScript types the payload; runtime checks still required
parley.on<UpdateRequest>(
    'update-user',
    async (payload, respond: ResponseFunction<UpdateResponse>) => {
        // Runtime validation
        if (typeof payload.userId !== 'number') {
            respond({ success: false, error: 'Invalid userId type' });
            return;
        }

        if (payload.userId <= 0) {
            respond({ success: false, error: 'userId must be positive' });
            return;
        }

        // Process validated payload
        const user = await updateUser(payload.userId, payload.updates);
        respond({ success: true, user });
    }
);
```

### Custom Type Guards

```typescript
interface UserPayload {
    userId: number;
    username: string;
}

function isUserPayload(payload: unknown): payload is UserPayload {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'userId' in payload &&
        'username' in payload &&
        typeof (payload as UserPayload).userId === 'number' &&
        typeof (payload as UserPayload).username === 'string' &&
        (payload as UserPayload).username.length > 0
    );
}

parley.on('process-user', (payload, respond) => {
    if (!isUserPayload(payload)) {
        respond({ success: false, error: 'Invalid user payload' });
        return;
    }

    // TypeScript knows payload is UserPayload here
    const { userId, username } = payload;
    processUser(userId, username);
    respond({ success: true });
});
```

---

## Content Sanitization

ParleyJS does not sanitize content for display. Sanitize HTML and dangerous
content yourself before processing or displaying messages. The simplest safe
option is to render text with `textContent` instead of `innerHTML`.

### HTML Sanitization

```typescript
import DOMPurify from 'dompurify'; // External library

parley.on('display-content', (payload, respond) => {
    // NEVER trust HTML from messages
    const sanitized = DOMPurify.sanitize(payload.html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p'],
        ALLOWED_ATTR: [],
    });

    document.getElementById('content').innerHTML = sanitized;
    respond({ success: true });
});
```

### String Sanitization

```typescript
function sanitizeString(input: unknown): string | null {
    if (typeof input !== 'string') {
        return null;
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Limit length
    if (sanitized.length > 1000) {
        sanitized = sanitized.substring(0, 1000);
    }

    // Remove control characters except newline/tab
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
}

parley.on('submit-comment', (payload, respond) => {
    const comment = sanitizeString(payload.text);
    if (comment === null) {
        respond({ success: false, error: 'text must be a string' });
        return;
    }
    saveComment(comment);
    respond({ success: true });
});
```

### URL Validation

```typescript
function isValidUrl(url: unknown): url is string {
    if (typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);
        // Only allow http/https protocols
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

parley.on('open-link', (payload, respond) => {
    if (!isValidUrl(payload.url)) {
        respond({ success: false, error: 'Invalid URL' });
        return;
    }

    window.open(payload.url, '_blank', 'noopener,noreferrer');
    respond({ success: true });
});
```

---

## Validation Libraries

Integrate popular validation libraries with ParleyJS for anything the built-in
schema subset cannot express (formats such as email/URI, unions, refinements).

### Zod

```typescript
import { z } from 'zod';

const userSchema = z.object({
    userId: z.number().int().positive(),
    email: z.string().email(),
    age: z.number().int().min(0).max(150).optional(),
    role: z.enum(['admin', 'user', 'guest']),
});

type User = z.infer<typeof userSchema>;

parley.on<unknown>('create-user', (payload, respond) => {
    const result = userSchema.safeParse(payload);

    if (!result.success) {
        respond({
            success: false,
            errors: result.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }

    // result.data is typed as User
    createUser(result.data);
    respond({ success: true, user: result.data });
});
```

### Yup

```typescript
import * as yup from 'yup';

const messageSchema = yup.object({
    type: yup.string().required().oneOf(['info', 'warning', 'error']),
    message: yup.string().required().min(1).max(500),
    timestamp: yup.number().required().positive(),
});

parley.on('log-message', async (payload, respond) => {
    try {
        const validated = await messageSchema.validate(payload, {
            abortEarly: false,
            stripUnknown: true,
        });

        logMessage(validated);
        respond({ success: true });
    } catch (error) {
        respond({
            success: false,
            errors:
                error instanceof yup.ValidationError
                    ? error.errors
                    : ['Invalid payload'],
        });
    }
});
```

### Joi

```typescript
import Joi from 'joi';

const configSchema = Joi.object({
    endpoint: Joi.string().uri().required(),
    timeout: Joi.number().integer().min(1000).max(30000).default(5000),
    retries: Joi.number().integer().min(0).max(5).default(3),
});

parley.on('update-config', (payload, respond) => {
    const { error, value } = configSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        respond({
            success: false,
            errors: error.details.map((d) => d.message),
        });
        return;
    }

    updateConfig(value);
    respond({ success: true, config: value });
});
```

---

## Error Handling

Handle validation errors gracefully and provide helpful feedback.

### What the Sender Sees

| Situation on the receiving side             | Sender's `send()` rejects with                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Payload fails the receiver's schema         | `ParleyError`, code `ERR_VALIDATION_SCHEMA_MISMATCH`                                                                                        |
| Handler throws                              | `ParleyError`, code `ERR_HANDLER_ERROR`, message `'Handler error'` (the real message only if the receiver sets `exposeHandlerErrors: true`) |
| No handler for the type                     | `ParleyError`, code `ERR_NO_HANDLER`                                                                                                        |
| Handler calls `respond({ success: false })` | Resolves normally with that object                                                                                                          |

Prefer responding with a structured error object for expected validation
failures; reserve thrown errors for unexpected failures. A thrown error is
reported locally via `system:error` (with the full message) and the type's
`onError`, but the sender only sees the generic `'Handler error'`.

### Observing Validation Failures with onError

```typescript
import { Parley, isValidationError } from 'ignite-parleyjs';

parley.register('submit-form', {
    schema: formSchema,
    onError: (error, metadata) => {
        if (isValidationError(error)) {
            // error.validationErrors: Array<{ path, message, expected?, received?, rule? }>
            securityLog.warn('Invalid submit-form payload', {
                senderId: metadata.senderId,
                origin: metadata.origin,
                errors: error.validationErrors,
            });
        } else {
            errorLog.error('submit-form handler failed', error);
        }
    },
});
```

### Handling ValidationError on the Sending Side

```typescript
import { ValidationError, isParleyError } from 'ignite-parleyjs';

try {
    await parley.send('process-data', data, { targetId: 'child' });
} catch (error) {
    if (error instanceof ValidationError) {
        // Rejected locally by this side's schema (or payload > 10 MB)
        console.error('Invalid payload', error.validationErrors);
    } else if (
        isParleyError(error) &&
        error.code === 'ERR_VALIDATION_SCHEMA_MISMATCH'
    ) {
        // Rejected by the receiver's schema
        console.error('Receiver rejected payload', error.details);
    } else {
        throw error;
    }
}
```

### Detailed Error Reporting

```typescript
import type { ResponseFunction } from 'ignite-parleyjs';

function validateAndRespond(
    payload: unknown,
    schema: JsonSchema,
    respond: ResponseFunction
) {
    const result = validator.validate(payload, schema);

    if (!result.valid) {
        const errors = result.errors.map((err) => ({
            path: err.path,
            message: err.message,
            expected: err.expected,
            received: err.received,
        }));

        respond({
            success: false,
            validationErrors: errors,
        });
        return false;
    }

    return true;
}

parley.on('submit-form', (payload, respond) => {
    if (!validateAndRespond(payload, formSchema, respond)) {
        return; // Validation failed, error already sent
    }

    // Process validated payload
    submitForm(payload);
    respond({ success: true });
});
```

---

## Security Best Practices

### Validate Everything

```typescript
parley.register('update-settings', { schema: settingsSchema });

// ALWAYS validate before processing
parley.on('update-settings', (payload, respond) => {
    // 1-2. Type and schema validation already done by the registered schema

    // 3. Business logic validation
    if (payload.maxUsers < payload.currentUsers) {
        respond({
            success: false,
            error: 'maxUsers cannot be less than currentUsers',
        });
        return;
    }

    // 4. Sanitization / copying known fields only
    const sanitized = sanitizeSettings(payload);

    // 5. Process
    updateSettings(sanitized);
    respond({ success: true });
});
```

### Allowlist, Not Blocklist

```typescript
// GOOD - Allowlist fields
function extractAllowedFields(payload: any): Settings | null {
    if (typeof payload !== 'object' || payload === null) {
        return null;
    }

    return {
        theme: isValidTheme(payload.theme) ? payload.theme : 'light',
        language: isValidLanguage(payload.language) ? payload.language : 'en',
        notifications:
            typeof payload.notifications === 'boolean'
                ? payload.notifications
                : true,
    };
}

// BAD - Trying to blocklist dangerous fields (incomplete)
function removeProtoFields(payload: any) {
    delete payload.__proto__;
    delete payload.constructor;
    return payload; // Still vulnerable!
}
```

### Size Limits

ParleyJS rejects **outgoing** payloads larger than 10 MB (fixed), but does not
limit what a peer sends you. Constrain inbound sizes with `maxLength` in your
schema, or check explicitly:

```typescript
const MAX_PAYLOAD_SIZE = 1024 * 100; // 100 KB

parley.on('upload-data', (payload, respond) => {
    const payloadSize = JSON.stringify(payload).length;

    if (payloadSize > MAX_PAYLOAD_SIZE) {
        respond({
            success: false,
            error: `Payload too large: ${payloadSize} bytes (max: ${MAX_PAYLOAD_SIZE})`,
        });
        return;
    }

    processData(payload);
    respond({ success: true });
});
```

### Reject Unknown Properties

```typescript
const strictSchema = {
    type: 'object',
    properties: {
        action: { type: 'string' },
        data: { type: 'object' },
    },
    required: ['action'],
    additionalProperties: false, // Reject unknown properties
};
```

---

## Complete Examples

### Secure User Registration

```typescript
import { Parley } from 'ignite-parleyjs';
import { z } from 'zod';

const registerSchema = z.object({
    username: z
        .string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/),
    email: z.string().email(),
    password: z.string().min(8).max(100),
    agreeToTerms: z.boolean().refine((val) => val === true, {
        message: 'Must agree to terms',
    }),
});

const parley = Parley.create({
    targetType: 'iframe',
    allowedOrigins: ['https://app.example.com'],
});

parley.on('register-user', async (payload, respond) => {
    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
        respond({
            success: false,
            validationErrors: parsed.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    const validated = parsed.data;

    try {
        // Additional business logic validation
        const userExists = await checkUserExists(validated.username);
        if (userExists) {
            respond({ success: false, error: 'Username already taken' });
            return;
        }

        // Hash password before storing
        const hashedPassword = await hashPassword(validated.password);

        // Create user
        const user = await createUser({
            username: validated.username,
            email: validated.email,
            password: hashedPassword,
        });

        respond({ success: true, userId: user.id });
    } catch {
        respond({ success: false, error: 'Registration failed' });
    }
});
```

### Safe Data Processing

```typescript
parley.register('process-batch', {
    schema: {
        type: 'object',
        properties: {
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' },
                        value: { type: 'number', minimum: 0 },
                        label: { type: 'string', maxLength: 100 },
                    },
                    required: ['id', 'value'],
                    additionalProperties: false,
                },
                maxLength: 1000, // array length limit
            },
        },
        required: ['items'],
        additionalProperties: false,
    },
});

parley.on('process-batch', (payload, respond) => {
    // Schema already validated by ParleyJS

    // Additional validation
    const uniqueIds = new Set(payload.items.map((item) => item.id));
    if (uniqueIds.size !== payload.items.length) {
        respond({
            success: false,
            error: 'Duplicate IDs found',
        });
        return;
    }

    // Process validated data
    const results = payload.items.map((item) => processItem(item));
    respond({ success: true, results });
});
```

---

## Related Documentation

- **[Origin Validation](./origin-validation.md)** - Validate message origins
- **[Error Handling Pattern](../patterns/error-handling.md)** - Handle
  validation errors
- **[API Reference: Methods](../api-reference/methods.md)** - `register()` and
  schema options
- **[Security Guide](./index.md)** - Complete security overview

---

## Navigation

**Previous**: [Origin Validation](./origin-validation.md) **Next**:
[Security Best Practices](./index.md) **Related**:
[Error Handling](../patterns/error-handling.md)

**Back to**: [Security](./index.md) | [Documentation Home](./index.md)
