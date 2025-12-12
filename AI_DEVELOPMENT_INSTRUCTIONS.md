# ParleyJS - AI Development Instructions

This file provides guidelines for Copilot, Claude, and other AI agents contributing to ParleyJS.

## Project Overview

ParleyJS is a JavaScript framework for inter-window communication that simplifies and extends the native `postMessage` API. The framework prioritizes:
- **Simplicity**: Easy developer experience
- **Security**: Built-in validation and origin checking
- **Reliability**: Comprehensive error handling
- **Type Safety**: Full TypeScript support

## Critical Language & Formatting Standards

**IMPORTANT**: All documentation and code comments must follow DOCUMENTATION_STYLE_GUIDE.md. Review this file before writing any documentation.

**IMPORTANT**: All documentation navigation must follow DOCUMENTATION_NAVIGATION_STRATEGY.md for cross-linking, breadcrumbs, and user navigation.

### No Emojis - Ever
Do not use emojis in any context:
- Code comments
- Documentation text
- Error messages
- Log output
- Commit messages
- Pull request descriptions

Use clear, descriptive text instead:

Wrong: "✓ Test passed"
Correct: "Test passed"

Wrong: "Error in origin validation"
Correct: "Origin validation failed"

### Language Quality Standards

1. **Natural and Human-Readable**
   - Write as you would explain to a colleague
   - Use active voice (prefer "ParleyJS validates origin" not "origin is validated")
   - Be direct and clear
   - Avoid jargon unless necessary, then explain it
   - Use proper grammar and spelling

2. **No Repetition**
   - Document each concept once in its canonical location
   - Reference other sections rather than repeating content
   - Use cross-references extensively
   - Example: "See Security Validation in API Reference" not re-explaining it

3. **Single Source of Truth**
   - If information exists elsewhere, reference it
   - Update the canonical location, not multiple places
   - Remove duplicate sections and consolidate
   - Maintain consistency across all references

4. **Easy to Navigate**
   - Clear table of contents
   - Descriptive section headers
   - Logical flow from simple to complex
   - Cross-references between related topics
   - No orphaned information

5. **Easy to Consume**
   - Short paragraphs (3-5 sentences max per paragraph)
   - Scannable sections with headers
   - Code examples for every concept introduced
   - Visual structure through spacing, not formatting
   - Searchable text without special characters

## Development Rules

### Code Generation
1. **No Markdown Files Unless Explicitly Asked**
   - Do not generate `.md` files during task execution
   - If you create temporary markdown files (checklists, plans), you MUST delete them before completing the task
   - Exception: Only create `.md` files when explicitly requested by the developer

2. **Always Run Tests After Changes**
   - After any code modification, run the full test suite
   - Command: `npm test` or `yarn test`
   - Do not commit changes if tests fail
   - Include test output in completion report

3. **Fix Tests to Align with Changes**
   - If existing tests fail due to your changes, fix them immediately
   - Update test assertions to match new behavior
   - Do not disable or skip tests as a workaround

4. **Add Tests for New Functionality**
   - Every new feature requires test coverage
   - Tests should cover:
     - Happy path (expected behavior)
     - Error cases (validation, security)
     - Edge cases (boundaries, timing)
   - Test files located in: `/tests`
   - Follow existing test patterns (see TESTING_PATTERNS.md)

### File Cleanup
- Delete all temporary files created during execution
- Clean up any test artifacts or build outputs
- Leave repository in production-ready state
- No dangling processes or cached files

### Code Quality Standards
1. **Linting**: All code must pass project linters
   - Run linter after changes: `npm run lint` or `yarn lint`
   - Fix any warnings or errors
   - Use project-configured rules (not personal preferences)

2. **Security**: Follow security best practices
   - Never log sensitive data
   - Validate all inputs
   - Check origin in postMessage handlers
   - Use HTTPS in examples

3. **Type Safety**
   - Maintain TypeScript strict mode
   - Provide complete type definitions
   - Document type interfaces
   - No `any` types without justification

4. **Documentation**
   - Update README.md if behavior changes
   - Update API documentation for new methods
   - Add JSDoc comments for functions
   - Include examples for complex features

## Testing Requirements

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/filename.test.js

# Watch mode during development
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Test Structure
- Use the existing test framework (Jest, Vitest, etc.)
- Follow naming convention: `<feature>.test.js` or `<feature>.spec.js`
- Group related tests with `describe()` blocks
- Use descriptive test names: `should validate origin before posting message`

### Test Coverage Expectations
- Minimum 80% code coverage
- 100% coverage for security-critical code
- All public APIs must have tests
- Error paths must be tested

## Framework Reference

### Core Methods
For complete API reference, see `FRAMEWORK_REFERENCE.md`

Key concepts:
- **Channels**: Bidirectional communication endpoints
- **Messages**: Typed, validated data packets
- **Origin Validation**: Security verification before processing
- **Error Handling**: Graceful failure modes

### Common Patterns

Refer to `CODE_PATTERNS.md` for:
- Basic message sending/receiving
- Error handling patterns
- Promise-based workflows
- Timeout handling
- Cleanup and memory management

## Workflow for Tasks

### When Making Changes
1. Create a new branch or work in current branch
2. Make code changes
3. Update tests to match new behavior
4. Add new tests for new functionality
5. Run full test suite: `npm test`
6. Run linter: `npm run lint`
7. Update documentation if needed
8. Delete any temporary files
9. Provide summary of changes

### When Generating Documentation
1. Only create `.md` files if explicitly requested
2. Follow existing documentation style
3. Include code examples from tests
4. Ensure examples are functional and tested
5. Update table of contents if modifying structure

### When Debugging
1. Check test output first for clues
2. Review error messages carefully
3. Check framework reference docs
4. Look at similar working code
5. Add temporary logging if needed, remove before completion

## Commit Message Guidelines

When applicable:
```
<type>: <brief description>

<detailed explanation if needed>

Tests: <which tests added/updated>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `security`

## Questions & Ambiguity

If you encounter ambiguity:
1. Check existing code patterns first
2. Review framework_reference.md
3. Look at test examples
4. Default to security and clarity
5. Add comments explaining non-obvious decisions

## Performance Considerations

- Minimize message payload size
- Avoid synchronous postMessage operations
- Clean up listeners to prevent memory leaks
- Use worker pools for heavy workloads
- Consider MessageChannel for direct port communication

## Security Checklist

For any postMessage-related code:
- [ ] Validate origin explicitly
- [ ] Validate message structure
- [ ] Validate message content
- [ ] Handle untrusted sources
- [ ] No sensitive data in messages
- [ ] Proper error handling
- [ ] Clear error messages to users

## Success Criteria

Task is complete when:
1. All tests pass
2. Linter passes
3. New features have tests
4. Documentation is updated
5. No temporary files remain
6. Code follows security guidelines
7. Performance is acceptable
