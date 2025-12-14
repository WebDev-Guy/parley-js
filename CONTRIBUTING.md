# Contributing to Parley-js

Thank you for your interest in contributing to Parley-js! This document provides
guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Formatting](#code-formatting)
- [Testing](#testing)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

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

- Node.js 18 or higher
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
git remote add upstream https://github.com/WebDev-Guy/parley-js.git
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
npm run build

# Watch mode
npm run dev
```

### 4. Type Check

```bash
npm run typecheck
```

### 5. Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test tests/unit/EventEmitter.test.ts
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

## Testing

Parley-js maintains **85%+ test coverage**. All contributions must include
tests.

### Test Requirements

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test end-to-end workflows (if applicable)
3. **Security Tests** - Test security features (if applicable)

### Writing Tests

```typescript
describe('ComponentName', () => {
    let instance: ComponentName;

    beforeEach(() => {
        instance = new ComponentName();
    });

    it('should do expected behavior', () => {
        // Arrange
        const input = 'test';

        // Act
        const result = instance.method(input);

        // Assert
        expect(result).toBe('expected');
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/EventEmitter.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Coverage Requirements

- Overall: **85%+**
- Core modules: **90%+**
- Security layer: **95%+**

See [TESTING.md](./docs/TESTING.md) for comprehensive testing guidelines.

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
- `security/` - Security improvements

### 2. Make Your Changes

- Write clear, concise code
- Follow the coding standards
- Add tests for new functionality
- Update documentation as needed
- Maintain or improve test coverage

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
- `security` - Security improvements

### 4. Push and Create PR

```bash
git push origin feature/my-feature
```

Then create a Pull Request on GitHub.

## Coding Standards

### TypeScript

```typescript
// DO: Use explicit types
function processMessage(message: MessageProtocol): void {
    // ...
}

// DON'T: Use any
function processMessage(message: any): any {
    // ...
}

// DO: Use readonly for immutable data
interface Config {
    readonly timeout: number;
    readonly allowedOrigins: readonly string[];
}

// DO: Use type guards
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
interface ChannelOptions { }  // Good
interface IChannelOptions { } // Bad

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

Parley-js maintains **85%+ test coverage**. All contributions must include
tests.

### Test Requirements

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test end-to-end workflows (if applicable)
3. **Security Tests** - Test security features (if applicable)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test tests/unit/EventEmitter.test.ts

# Run with coverage
npm run test:coverage

# Run security tests
npm test tests/security/
```

### Writing Tests

```typescript
// tests/unit/Parley.test.ts
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
            await parley.connect('test', mockTarget.window);

            // Act
            const result = await parley.send(
                'message',
                { data: 1 },
                { targetId: 'test' }
            );

            // Assert
            expect(result).toEqual({ response: true });
        });

        it('should throw TimeoutError when no response', async () => {
            await expect(
                parley.send('message', {}, { targetId: 'test', timeout: 100 })
            ).rejects.toThrow('Timeout');
        });
    });
});
```

### Coverage Requirements

- Overall: **85%+**
- Core modules: **90%+**
- Security layer: **95%+**

See [TESTING.md](./docs/TESTING.md) for comprehensive testing guidelines.

## Documentation

Documentation is as important as code. ParleyJS maintains comprehensive documentation that follows strict quality standards to ensure clarity, consistency, and professionalism.

### Documentation Standards

All documentation contributions must follow:

- **[DOCUMENTATION_STYLE_GUIDE.md](./docs/DOCUMENTATION_STYLE_GUIDE.md)** - Writing style, language standards, and quality requirements
- **[DOCUMENTATION_NAVIGATION_STRATEGY.md](./docs/DOCUMENTATION_NAVIGATION_STRATEGY.md)** - Cross-linking, breadcrumbs, and navigation patterns
- **[.cursorrules](./.cursorrules)** - AI assistant guidelines (also useful for human contributors)

### Key Documentation Principles

**No Emojis - Ever**
- Never use emojis in documentation, code comments, commit messages, or error messages
- Use clear, descriptive text instead

**Single Source of Truth**
- Document each concept once in its canonical location
- Reference that location from elsewhere rather than duplicating
- Maintain consistency through cross-references

**Active Voice & Clear Language**
- Write naturally: "ParleyJS validates the origin" not "the origin is validated"
- Keep paragraphs short (maximum 5 sentences)
- Use professional but friendly tone
- Explain technical terms when first introduced

**Complete Navigation**
- Include breadcrumb navigation at top of each file
- Add table of contents for files with 5+ sections
- Include footer navigation (Previous/Next/Related/Back to)
- Use descriptive link text, not "click here"

### JSDoc Comments

All public APIs must include JSDoc comments:

````typescript
/**
 * Sends a message to a connected target.
 *
 * @param messageType - The type of message to send
 * @param payload - The message payload
 * @param options - Optional configuration
 * @returns A promise resolving with the response
 * @throws {TimeoutError} If the request times out
 * @throws {SecurityError} If the target origin is not allowed
 * @example
 * ```typescript
 * const response = await parley.send('greeting', { name: 'World' });
 * console.log(response);
 * ```
 */
async send<T = unknown>(
    messageType: string,
    payload: unknown,
    options?: SendOptions
): Promise<T>
````

### Documentation Quality Checklist

Before submitting documentation changes, verify:

- [ ] No emojis used anywhere
- [ ] Active voice used (passive only when justified)
- [ ] Paragraphs are 5 sentences or less
- [ ] No duplicate content (use cross-references)
- [ ] Breadcrumb navigation at top
- [ ] Table of contents for long pages
- [ ] Footer navigation with Previous/Next/Related
- [ ] All cross-reference links use descriptive text
- [ ] All code examples are tested and working
- [ ] Grammar and spelling checked
- [ ] Links verified and working

### When to Update Documentation

Update documentation when you:

- Add or change public APIs
- Modify security behavior
- Change error codes or messages
- Add new features or patterns
- Fix bugs that affect documented behavior
- Improve performance in ways users should know about

### Documentation File Structure

```
docs/
├── README.md                          # Documentation hub
├── getting-started/                   # Installation and first steps
│   ├── README.md
│   ├── installation.md
│   ├── concepts.md
│   └── first-example.md
├── guides/                            # Use-case specific guides
│   ├── README.md
│   ├── iframe-communication.md
│   ├── popup-communication.md
│   ├── multi-window-communication.md
│   └── micro-frontends.md
├── patterns/                          # Common coding patterns
│   ├── README.md
│   ├── request-response.md
│   ├── error-handling.md
│   └── state-synchronization.md
├── api-reference/                     # Complete API docs
│   ├── README.md
│   ├── methods.md
│   └── system-events.md
├── security/                          # Security guidelines
│   ├── README.md
│   ├── origin-validation.md
│   └── message-validation.md
├── troubleshooting/                   # Common issues
│   ├── README.md
│   └── common-errors.md
├── DOCUMENTATION_STYLE_GUIDE.md       # Writing standards
├── DOCUMENTATION_NAVIGATION_STRATEGY.md # Navigation patterns
└── examples/                          # Code examples
    └── basic-example.md
```

### AI Assistant Support

If you use AI assistants (Cursor, GitHub Copilot, Claude):

- Review `.cursorrules` for ParleyJS-specific guidelines
- AI assistants should follow the same documentation standards
- Generated documentation must pass the quality checklist
- Always verify AI-generated content for accuracy

### Resources

- **Style Guide**: [DOCUMENTATION_STYLE_GUIDE.md](./docs/DOCUMENTATION_STYLE_GUIDE.md)
- **Navigation Guide**: [DOCUMENTATION_NAVIGATION_STRATEGY.md](./docs/DOCUMENTATION_NAVIGATION_STRATEGY.md)
- **AI Guidelines**: [.cursorrules](./.cursorrules)
- **Example**: [basic-example.md](./docs/examples/basic-example.md) - Shows all standards applied

For detailed documentation contribution guidelines, see [CONTRIBUTING_DOCUMENTATION.md](./docs/CONTRIBUTING_DOCUMENTATION.md).

## Pull Request Process

### Before Submitting

- [ ] Code is formatted (`npm run format`)
- [ ] Tests pass (`npm test`)
- [ ] Coverage maintained/improved (`npm run test:coverage`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (under Unreleased)
- [ ] PR template filled out completely

### PR Guidelines

1. **Title Format**

    ```
    feat(scope): add new feature
    fix(scope): resolve issue #123
    docs(scope): update API documentation
    test(scope): add security tests
    ```

2. **Description**
    - Clear description of changes
    - Link to related issues
    - Breaking changes clearly marked
    - Screenshots/examples if applicable

3. **Checklist**
    - [ ] Tests added/updated
    - [ ] Documentation updated
    - [ ] Code formatted
    - [ ] Type checking passes
    - [ ] All tests pass
    - [ ] Coverage maintained/improved (85%+)
    - [ ] CHANGELOG.md updated
    - [ ] No security vulnerabilities introduced

### Review Process

1. **Automated Checks** - CI must pass
2. **Code Review** - At least one maintainer approval required
3. **Testing** - Manual testing if needed
4. **Merge** - Maintainer will merge when approved

### After Merge

- Your branch will be deleted automatically
- Update your fork:
    ```bash
    git checkout main
    git pull upstream main
    git push origin main
    ```

## Release Process

Releases are handled by maintainers:

1. **Version Bump**

    ```bash
    npm version major|minor|patch
    ```

2. **Update CHANGELOG.md**
    - Move Unreleased changes to new version
    - Add release date
    - List breaking changes
    - Credit contributors

3. **Tag Release**

    ```bash
    git tag v1.x.x
    git push --tags
    ```

4. **Publish to npm**

    ```bash
    npm publish
    ```

5. **Create GitHub Release**
    - Add release notes
    - Highlight breaking changes
    - Credit contributors

---

## Questions?

- Open a [discussion](https://github.com/WebDev-Guy/parley-js/discussions)
- Check [existing issues](https://github.com/WebDev-Guy/parley-js/issues)
- Review [documentation](./docs/API.md)
- Email: hello@igniteworks.com

Thank you for contributing to Parley-js!

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
- Celebrate!

## Questions?

- Open a GitHub Discussion for questions
- Check existing issues for similar problems

Thank you for contributing!

---

## Related Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [Testing Guide](./docs/TESTING.md) - Testing documentation and best practices
- [Security Guide](./docs/SECURITY.md) - Security best practices
- [Architecture](./docs/ARCHITECTURE.md) - System design and internals
- [Examples](./docs/EXAMPLES.md) - Code examples and patterns
- [README](./README.md) - Project overview
