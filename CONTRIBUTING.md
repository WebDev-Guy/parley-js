# Contributing to Parley-js

Thank you for your interest in contributing to Parley-js! This document provides
guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Formatting](#code-formatting)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to
uphold this code. Please report unacceptable behavior to the maintainers.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm, yarn, or pnpm
- Git

### Finding Issues

- Look for issues labeled `good first issue` for beginner-friendly tasks
- Check `help wanted` for issues where community help is needed
- Browse `feature request` for new features to implement

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/parley-js.git
cd parley-js

# Add upstream remote
git remote add upstream https://github.com/drew/parley-js.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build

```bash
# Development build
npm run build:dev

# Production build
npm run build:prod

# Watch mode
npm run dev
```

### 4. Type Check

```bash
npm run typecheck
```

## Code Formatting

Parley uses [Prettier](https://prettier.io/) for consistent code formatting
across all contributors.

### Formatting Rules

- **Line Length**: 100 characters (80 for markdown prose)
- **Indentation**: 4 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing Commas**: ES5 compatible

### Before Committing

Always format your code before committing:

```bash
npm run format
```

Or set up your editor to format on save (recommended).

### Editor Setup

#### VS Code

Install the
[Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
and add to your `.vscode/settings.json`:

```json
{
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll": true
    }
}
```

#### WebStorm/IntelliJ

1. Go to Preferences → Languages & Frameworks → JavaScript → Prettier
2. Enable "On save" and "On Reformat Code"

#### Other Editors

See [Prettier editor integration](https://prettier.io/docs/en/editors.html) for
your editor.

### CI Enforcement

Our CI pipeline checks code formatting. If your PR fails the format check:

```bash
npm run format
git add .
git commit -m "style: apply Prettier formatting"
git push
```

## Making Changes

### 1. Create a Branch

```bash
# Update main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/my-feature
# or
git checkout -b fix/issue-123
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### 2. Make Your Changes

- Write clear, concise code
- Follow the coding standards
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <description>

git commit -m "feat(security): add origin pattern matching"
git commit -m "fix(channel): handle reconnection timeout"
git commit -m "docs(api): add examples for broadcast method"
git commit -m "test(validation): add schema edge cases"
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style (formatting, semicolons, etc.)
- `refactor` - Code refactoring
- `test` - Tests
- `chore` - Build, tooling, etc.

### 4. Push and Create PR

```bash
git push origin feature/my-feature
```

Then create a Pull Request on GitHub.

## Coding Standards

### TypeScript

```typescript
// ✅ DO: Use explicit types
function processMessage(message: MessageProtocol): void {
    // ...
}

// ❌ DON'T: Use any
function processMessage(message: any): any {
    // ...
}

// ✅ DO: Use readonly for immutable data
interface Config {
    readonly timeout: number;
    readonly allowedOrigins: readonly string[];
}

// ✅ DO: Use type guards
function isValidMessage(data: unknown): data is MessageProtocol {
    return typeof data === 'object' && data !== null && '_v' in data;
}
```

### Formatting

- **Indentation:** 4 spaces
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Line length:** 100 characters max
- **Trailing commas:** Required in multiline

### Naming Conventions

```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_TIMEOUT = 30000;
const ERROR_CODES = { ... };

// Classes: PascalCase
class MessageHandler { }

// Functions/Variables: camelCase
function processMessage() { }
const messageCount = 0;

// Private members: _underscore prefix
class Example {
    private _internalState: State;
}

// Interfaces: PascalCase (no I prefix)
interface ChannelOptions { }  // ✅
interface IChannelOptions { } // ❌

// Types: PascalCase
type MessageHandler<T> = (payload: T) => void;

// Enums: PascalCase with UPPER_SNAKE members
enum ConnectionState {
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
}
```

### File Structure

```typescript
/**
 * @file FileName.ts
 * @description Brief description of the file
 * @module parley-js/path
 */

// 1. External imports
import { something } from 'external-package';

// 2. Internal imports (absolute)
import { Helper } from '../utils/Helper';

// 3. Type imports
import type { SomeType } from './types';

// 4. Constants
const SOME_CONSTANT = 'value';

// 5. Types/Interfaces
interface SomeInterface {
    // ...
}

// 6. Main exports
export class MainClass {
    // ...
}

// 7. Helper functions (if not exported)
function helperFunction() {
    // ...
}
```

### Documentation

````typescript
/**
 * Brief description of the function.
 *
 * Longer description if needed. Can span multiple lines.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws ErrorType - When this error is thrown
 *
 * @example
 * ```typescript
 * const result = myFunction('input');
 * ```
 */
export function myFunction(paramName: string): ReturnType {
    // ...
}
````

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- path/to/test.test.ts

# Run with coverage
npm run test:coverage
```

### Writing Tests

```typescript
// tests/core/Parley.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Parley } from '../../src/core/Parley';

describe('Parley', () => {
    let parley: Parley;

    beforeEach(() => {
        parley = Parley.create({
            allowedOrigins: ['https://test.com'],
        });
    });

    afterEach(() => {
        parley.destroy();
    });

    describe('send()', () => {
        it('should send message to target', async () => {
            // Arrange
            const mockTarget = createMockTarget();
            await parley.connectWindow('test', mockTarget.window, {
                origin: 'https://test.com',
            });

            // Act
            const result = await parley.send('test', 'message', { data: 1 });

            // Assert
            expect(result).toEqual({ response: true });
        });

        it('should throw TimeoutError when no response', async () => {
            // ...
        });
    });
});
```

### Test Categories

1. **Unit Tests** - Test individual functions/classes
2. **Integration Tests** - Test component interaction
3. **E2E Tests** - Test full communication flow

## Documentation

### Updating Docs

- Update relevant docs when adding/changing features
- Add JSDoc comments to all public APIs
- Include code examples
- Update README if needed

### Documentation Files

- `README.md` - Quick start and overview
- `docs/API.md` - Complete API reference
- `docs/ARCHITECTURE.md` - Internal architecture
- `docs/SECURITY.md` - Security guide
- `docs/EXAMPLES.md` - Usage examples
- `docs/FUTURE-ROADMAP.md` - Planned features

## Pull Request Process

### Before Submitting

- [ ] Code is formatted (`npm run format`)
- [ ] Tests pass (`npm test`)
- [ ] Types check (`npm run typecheck`)
- [ ] Code follows standards
- [ ] Documentation updated
- [ ] Commits follow convention

### PR Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues

Fixes #123

## Testing

Describe how to test the changes.

## Checklist

- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. Create PR with description
2. Automated checks run
3. Maintainer reviews code
4. Address feedback
5. Squash and merge when approved

### After Merge

- Delete your branch
- Pull latest main
- Celebrate! 🎉

## Questions?

- Open a GitHub Discussion for questions
- Join our Discord for community chat
- Check existing issues for similar problems

Thank you for contributing! 🙏
