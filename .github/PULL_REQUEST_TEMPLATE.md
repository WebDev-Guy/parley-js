## Description

<!-- Provide a clear and concise description of your changes -->

## Related Issue

<!-- Link to the issue this PR addresses -->
Fixes #(issue number)

## Type of Change

<!-- Mark the relevant option with an 'x' -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code style update (formatting, renaming)
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test update
- [ ] Build/config update

## Changes Made

<!-- List the specific changes made in this PR -->

- Change 1
- Change 2
- Change 3

## Testing

<!-- Describe how you tested your changes -->

### Test Coverage

- [ ] Added unit tests for new functionality
- [ ] Added integration tests for end-to-end flows
- [ ] Added security tests for security-related changes
- [ ] All tests pass locally (`npm test`)
- [ ] Coverage maintained or improved (`npm run test:coverage`)

### Manual Testing

<!-- Describe manual testing performed -->

**Environment:**
- Browser: [e.g., Chrome 120]
- OS: [e.g., Windows 11]
- Node: [e.g., 20.10.0]

**Test Scenarios:**
1. Scenario 1
2. Scenario 2
3. Scenario 3

## Code Quality

- [ ] Code follows the project's style guidelines (`npm run format`)
- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] No new linting errors (`npm run format:check`)
- [ ] Self-reviewed the code
- [ ] Added JSDoc comments for new public APIs
- [ ] Updated TypeScript types as needed

## Documentation

- [ ] Updated README.md if needed
- [ ] Updated API documentation in `docs/API.md`
- [ ] Updated examples in `docs/EXAMPLES.md` or `examples/`
- [ ] Updated CHANGELOG.md
- [ ] Added inline code comments for complex logic

## Security

<!-- For security-related changes -->

- [ ] Security implications reviewed
- [ ] No sensitive information in code or commit messages
- [ ] Security tests added/updated
- [ ] Followed [security guidelines](./docs/SECURITY.md)

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

**Impact:**
<!-- Who will be affected by this change? -->

**Migration Guide:**
<!-- How can users migrate from the old API to the new one? -->

```typescript
// Before
const old = oldAPI();

// After
const new = newAPI();
```

## Performance Impact

<!-- Describe any performance implications -->

- [ ] No performance impact
- [ ] Performance improved
- [ ] Performance benchmarks included

## Screenshots/Videos

<!-- If applicable, add screenshots or videos demonstrating the changes -->

## Checklist

<!-- Mark all items with an 'x' before submitting -->

- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] I have checked my code and corrected any misspellings
- [ ] I have updated the CHANGELOG.md

## Additional Notes

<!-- Any additional information that reviewers should know -->

---

## Reviewer Guidelines

### For Maintainers

- [ ] Code quality reviewed
- [ ] Tests cover new functionality
- [ ] Documentation is clear and complete
- [ ] No security concerns
- [ ] CHANGELOG.md updated appropriately
- [ ] Breaking changes properly documented
- [ ] Performance impact acceptable

### Testing Checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Security tests pass (if applicable)
- [ ] Coverage threshold maintained (85%+)
- [ ] Manual testing performed in multiple browsers

---

Thank you for contributing to Parley-js!
