[Home](../../index.md) > [Documentation](./index.md) > [Security](./index.md) >
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
types before processing. ParleyJS provides built-in validation support through
JSON Schema and custom validators.

Validation prevents:

- Type errors from malformed data
- Security vulnerabilities from unexpected content
- Application crashes from invalid payloads
- Data corruption from incorrect types

---

## Why Validate Messages

Cross-window communication involves untrusted data sources. Always validate
messages to protect your application.

### Security Risks Without Validation

**XSS via Messages**:

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
    Object.assign(settings, payload); // Could pollute Object.prototype!
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

ParleyJS supports JSON Schema for declarative validation.

### Basic Schema Validation

```typescript
import { Parley } from 'parley-js';

const parley = Parley.create({
    allowedOrigins: [window.location.origin],
});

// Define JSON Schema for user data
const userSchema = {
    type: 'object',
    properties: {
        userId: { type: 'number' },
        username: { type: 'string', minLength: 3, maxLength: 20 },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['admin', 'user', 'guest'] },
    },
    required: ['userId', 'username', 'email'],
    additionalProperties: false,
};

// Register handler with schema validation
parley.on(
    'create-user',
    (payload, respond, metadata) => {
        // Schema validated automatically by ParleyJS
        const { userId, username, email, role } = payload;

        // Process validated data safely
        const user = createUser({ userId, username, email, role });
        respond({ success: true, user });
    },
    {
        schema: userSchema,
    }
);
```

### Schema Validation with SchemaValidator

```typescript
import { SchemaValidator } from 'parley-js';

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
    const result = validator.validate(payload, messageSchema);

    if (!result.valid) {
        throw new ValidationError('Invalid payload', result.errors);
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
            minItems: 1,
            maxItems: 100,
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
for complete safety.

### TypeScript Interface Validation

```typescript
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

// TypeScript ensures type safety
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
        throw new ValidationError('Invalid user payload');
    }

    // TypeScript knows payload is UserPayload here
    const { userId, username } = payload;
    processUser(userId, username);
    respond({ success: true });
});
```

---

## Content Sanitization

Sanitize HTML and dangerous content before processing or displaying messages.

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
function sanitizeString(input: unknown): string {
    if (typeof input !== 'string') {
        throw new ValidationError('Input must be a string');
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

Integrate popular validation libraries with ParleyJS.

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
    try {
        // Zod validates and transforms
        const user = userSchema.parse(payload);

        // user is now typed as User
        createUser(user);
        respond({ success: true, user });
    } catch (error) {
        if (error instanceof z.ZodError) {
            respond({
                success: false,
                errors: error.errors.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                })),
            });
        }
    }
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
        if (error instanceof yup.ValidationError) {
            respond({ success: false, errors: error.errors });
        }
    }
});
```

### Joi

```typescript
import Joi from 'joi';

const configSchema = Joi.object({
    apiKey: Joi.string().alphanum().length(32).required(),
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

### ValidationError Handling

```typescript
import { ValidationError } from 'parley-js';

parley.on('process-data', (payload, respond) => {
    try {
        validatePayload(payload);
        processData(payload);
        respond({ success: true });
    } catch (error) {
        if (error instanceof ValidationError) {
            // Validation error with details
            respond({
                success: false,
                error: 'Validation failed',
                details: error.validationErrors,
            });
        } else {
            // Unexpected error
            respond({
                success: false,
                error: 'Processing failed',
            });
        }
    }
});
```

### Detailed Error Reporting

```typescript
function validateAndRespond(
    payload: unknown,
    schema: object,
    respond: ResponseFunction
) {
    const result = validator.validate(payload, schema);

    if (!result.valid) {
        const errors = result.errors.map((err) => ({
            field: err.field,
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
// ALWAYS validate before processing
parley.on('update-settings', (payload, respond) => {
    // 1. Type validation
    if (typeof payload !== 'object' || payload === null) {
        throw new ValidationError('Payload must be an object');
    }

    // 2. Schema validation
    const result = validator.validate(payload, settingsSchema);
    if (!result.valid) {
        throw new ValidationError('Schema validation failed', result.errors);
    }

    // 3. Business logic validation
    if (payload.maxUsers < payload.currentUsers) {
        respond({
            success: false,
            error: 'maxUsers cannot be less than currentUsers',
        });
        return;
    }

    // 4. Sanitization
    const sanitized = sanitizeSettings(payload);

    // 5. Process
    updateSettings(sanitized);
    respond({ success: true });
});
```

### Whitelist, Not Blacklist

```typescript
// GOOD - Whitelist allowed fields
function extractAllowedFields(payload: unknown): Settings {
    if (typeof payload !== 'object' || payload === null) {
        throw new ValidationError('Invalid payload');
    }

    const allowed: Settings = {
        theme: isValidTheme(payload.theme) ? payload.theme : 'light',
        language: isValidLanguage(payload.language) ? payload.language : 'en',
        notifications:
            typeof payload.notifications === 'boolean'
                ? payload.notifications
                : true,
    };

    return allowed;
}

// BAD - Trying to blacklist dangerous fields (incomplete)
function removeProtoFields(payload: object) {
    delete payload.__proto__;
    delete payload.constructor;
    return payload; // Still vulnerable!
}
```

### Size Limits

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
import { Parley, ValidationError } from 'parley-js';
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
    allowedOrigins: ['https://app.example.com'],
});

parley.on('register-user', async (payload, respond) => {
    try {
        // Validate with Zod
        const validated = registerSchema.parse(payload);

        // Additional business logic validation
        const userExists = await checkUserExists(validated.username);
        if (userExists) {
            respond({
                success: false,
                error: 'Username already taken',
            });
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
    } catch (error) {
        if (error instanceof z.ZodError) {
            respond({
                success: false,
                validationErrors: error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                })),
            });
        } else {
            respond({
                success: false,
                error: 'Registration failed',
            });
        }
    }
});
```

### Safe Data Processing

```typescript
const dataSchema = {
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
            maxItems: 1000,
        },
    },
    required: ['items'],
    additionalProperties: false,
};

parley.on('process-batch', (payload, respond) => {
    // Schema validation
    const result = validator.validate(payload, dataSchema);
    if (!result.valid) {
        respond({
            success: false,
            errors: result.errors,
        });
        return;
    }

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
- **[API Reference: Methods](../api-reference/methods.md)** - Schema validation
  in handlers
- **[Security Guide](./index.md)** - Complete security overview

---

## Navigation

**Previous**: [Origin Validation](./origin-validation.md) **Next**:
[Security Best Practices](./index.md) **Related**:
[Error Handling](../patterns/error-handling.md)

**Back to**: [Security](./index.md) | [Documentation Home](./index.md)
