[Home](../../index.md) > [Getting Started](./index.md) > Installation

# Installing ParleyJS

Learn how to install and set up ParleyJS in your project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [NPM Installation](#npm-installation)
3. [Yarn Installation](#yarn-installation)
4. [PNPM Installation](#pnpm-installation)
5. [CDN Installation](#cdn-installation)
6. [TypeScript Support](#typescript-support)
7. [Verify Installation](#verify-installation)
8. [Next Steps](#next-steps)

---

## Prerequisites

Before installing ParleyJS, ensure your environment meets these requirements:

- **Node.js**: Version 20 or higher
- **Package Manager**: npm, yarn, or pnpm
- **Browser Support**: Chrome 80+, Firefox 80+, Safari 13.1+, Edge 80+

ParleyJS has zero dependencies and works with any modern JavaScript framework or
vanilla JavaScript.

---

## NPM Installation

Install ParleyJS using npm:

```bash
npm install ignite-parleyjs
```

This downloads the latest stable version and adds it to your `package.json`
dependencies.

---

## CDN Installation

For quick prototyping or non-bundled projects, use the CDN version:

```html
<script src="https://unpkg.com/ignite-parleyjs/dist/index.global.js"></script>
<script>
    // ParleyJS is available as global "Parley"
    const parley = Parley.create({
        allowedOrigins: ['https://example.com'],
    });
</script>
```

The CDN version exposes `Parley` as a global variable. All exports are available
on the `Parley` object.

**Note**: For production applications, use a package manager installation for
better security and control over versions.

---

## TypeScript Support

ParleyJS includes complete TypeScript definitions. No additional type packages
are needed.

### Import Types

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';
import type { ParleyConfig, MessageHandler, SendOptions } from 'parley-js';
```

### Generic Types for Messages

ParleyJS supports generic types for type-safe messaging:

```typescript
// Define your message types
interface UserData {
    id: number;
    name: string;
}

interface UserResponse {
    success: boolean;
    user: UserData;
}

// Use generic types with send()
const response = await parley.send<UserData, UserResponse>(
    'get-user',
    { id: 123, name: 'Alice' },
    { targetId: 'child' }
);

// TypeScript knows response is UserResponse
console.log(response.user.name);
```

ParleyJS works seamlessly with TypeScript projects. All types are exported from
the main package, and generic message types provide full type safety for your
communication layer.

---

## Verify Installation

After installation, verify ParleyJS works correctly:

### Create a Test File

Create `test-parley.js` (or `.ts` for TypeScript):

```typescript
import { Parley, SYSTEM_EVENTS } from 'parley-js';

// Create a ParleyJS instance
const parley = Parley.create({
    allowedOrigins: [window.location.origin],
    debug: true,
});

console.log('ParleyJS installed successfully!');
console.log('Available system events:', Object.keys(SYSTEM_EVENTS));
```

### Run the Test

**In Node.js** (for testing import):

```bash
node test-parley.js
```

**In Browser** (for full functionality):

```html
<script type="module" src="test-parley.js"></script>
```

If you see "ParleyJS installed successfully!" without errors, the installation
is complete.

---

## Next Steps

Now that ParleyJS is installed, learn how to use it:

1. **[First Example](./first-example.md)** - Build your first cross-window
   communication
2. **[Core Concepts](./concepts.md)** - Understand ParleyJS fundamentals
3. **[API Reference](../api-reference/index.md)** - Explore available methods
   and options

For framework-specific integration guides, see
[Integration Guides](../guides/index.md).

---

**Previous**: [Getting Started](./index.md) **Next**:
[First Example](./first-example.md) **Back to**: [Getting Started](./index.md)
