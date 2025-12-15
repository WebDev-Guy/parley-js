[Home](./index.md) > [Documentation](./index.md) > Documentation Style Guide

# ParleyJS Documentation Style Guide

Official standards for all documentation, examples, and reference materials.
Follow these guidelines strictly to maintain professional quality and
consistency.

## Core Principles

Documentation must be:

- Informative: Provides complete, accurate information
- Clear: Easy to understand on first reading
- Non-repetitive: No duplicate explanations across files
- Navigable: Easy to find what you're looking for
- Scannable: Quick to identify relevant sections
- Professional: Suitable for commercial product

## Language Standards

### No Emojis - Ever

Never use emojis in any context:

- Code comments
- Documentation text
- Error messages
- Log output
- Commit messages
- Pull request descriptions
- Code examples

Use clear, descriptive text instead.

**Wrong**: "Configuration ✓ passed validation" **Correct**: "Configuration
passed validation"

**Wrong**: "Error 🚨: Origin mismatch" **Correct**: "Error: Origin mismatch"

### Write Naturally and Clearly

Write as you would explain to a colleague. Use conversational, human-readable
language.

**Wrong**: "The origin property must be set to the anticipated origin value for
the receiving window context prior to channel instantiation."

**Correct**: "Set the origin property to match the exact origin of the target
window before creating the channel."

### Use Active Voice

Prefer active voice (subject performs action) over passive voice (action
performed on subject).

**Wrong**: "Messages are validated by the framework before being processed."
**Correct**: "The framework validates messages before processing them."

**Wrong**: "The channel should be closed when communication is no longer
required." **Correct**: "Close the channel when you no longer need to
communicate."

### Avoid Jargon or Explain It

Either avoid technical jargon, or explain it clearly when necessary.

**Wrong**: "Leverage optimized deserialization algorithms to maximize throughput
in high-frequency postMessage scenarios."

**Correct**: "For high-frequency messaging, consider using MessageChannel for
direct communication instead of repeated postMessage calls."

**Acceptable with explanation**: "Origin validation uses a strict equality check
(the origin must match exactly including scheme, host, and port)."

### Proper Grammar and Spelling

All documentation must use correct grammar, spelling, and punctuation.

- Check spelling with a spell-checker
- Use standard English conventions
- Complete sentences in documentation (fragments are okay in lists)
- Consistent capitalization and terminology

**Wrong**: "dont forget to validate the origin or your app will be vunerable"
**Correct**: "You must validate the origin, or your application will be
vulnerable."

## Content Organization

### Single Source of Truth

Document each concept in exactly one canonical location. Reference it from
elsewhere.

**Canonical Locations** (examples):

- All API methods documented in: API Reference
- All error codes documented in: Error Reference
- All security guidance documented in: Security Guide
- All performance guidance documented in: Performance Guide
- All testing patterns documented in: Testing Patterns

When information belongs in multiple sections:

1. Document it in the canonical location
2. Reference it from other sections
3. Never repeat the full explanation

**Example of correct cross-referencing**:

In getting-started.md: "You must validate the origin of incoming messages. For
detailed security practices, see the Security section of the API Reference."

In api-reference.md: "When receiving messages, always validate that the origin
matches your expected origin exactly. This includes the scheme (https),
hostname, and port. See Security Guide for patterns."

In security.md: "Origin validation is your first line of defense. The origin
must match exactly—no wildcards, no partial matches. For integration examples,
see Code Patterns."

### No Duplication

Never repeat the same explanation in multiple places.

**Wrong**: Having the same error handling explanation in:

- Getting Started (for new developers)
- API Reference (for reference)
- Examples (in each example)
- Troubleshooting (for debugging)

**Correct**: Explain it once in Error Handling section with:

- Getting Started links to it
- API Reference links to it
- Examples reference it
- Troubleshooting links to it

### Cross-References

Use clear, descriptive cross-references that tell the reader what they'll find.

**Wrong**: "See the other document." **Wrong**: "See page 47 of the API
reference."

**Correct**: "For detailed information about origin validation, see Origin
Validation in the Security section." **Correct**: "The complete list of error
codes is in the Error Reference."

## Writing Style

### Paragraph Structure

Keep paragraphs short and focused on a single idea.

**Guideline**: Maximum 5 sentences per paragraph **Guideline**: Maximum 2-3
sentences for introductory paragraphs

**Wrong**: "ParleyJS provides a framework for postMessage communication that
simplifies origin validation, provides type-safe message handling, and enables
request-response patterns, which are features that many developers struggle to
implement correctly when using native postMessage, and this is because the
native API is low-level and requires developers to manually manage message IDs
for request-response pairing and they must also check origins manually to
prevent security issues, and ParleyJS handles all of this automatically so
developers can focus on their application logic instead of the plumbing."

**Correct**: "ParleyJS simplifies postMessage communication by handling three
common tasks automatically: origin validation, type-safe message handling, and
request-response pairing. Using native postMessage requires developers to
manually implement these features, which is error-prone. ParleyJS lets you focus
on your application logic instead of these low-level details."

### Headers and Section Names

Use clear, descriptive headers that indicate the content.

**Wrong**: "Basic Info", "Other Stuff", "Section 2" **Correct**: "Getting
Started", "Origin Validation", "Request-Response Pattern"

Headers should be:

- Specific about the content
- Searchable (use words people would search for)
- Consistent in style (parallel structure)

### Code Examples

Every new concept should have a code example.

**Guidelines**:

- Show the most common use case
- Include error handling if applicable
- Keep examples short (5-20 lines max)
- Use realistic data
- Include comments explaining non-obvious parts

**Wrong** (too long):

```javascript
// 50 lines of setup code before the example
const channel = ParleyJS.createChannel({...});
// 40 more lines of unrelated code
const response = await channel.request('get-data', {});
```

**Correct** (focused):

```javascript
// Send a request and wait for response
const response = await channel.request('get-user', { id: 123 });
console.log(response.user.name);
```

### Lists and Bullet Points

Use lists to make content scannable, but not excessively.

**When to use lists**:

- Multiple related items
- Steps in a process
- Options or alternatives
- Key points to remember

**When NOT to use lists**:

- Explaining a single concept
- Narrative or explanatory content
- Content that should flow naturally

**Format**: Each bullet point should be meaningful. Avoid single-word bullets.

**Wrong**:

- First
- Second
- Third

**Correct**:

- Validate origin before processing any messages
- Use request-response pattern for critical operations
- Clean up listeners when closing the channel

### Tables

Use tables for structured comparisons and references.

**Good uses**:

- Comparing native postMessage vs ParleyJS
- Parameter reference (name, type, description)
- Error codes and their meanings
- Integration options comparison

**Avoid**: Tables with more than 4 columns (gets hard to read)

## Tone and Voice

### Professional but Friendly

Write for professionals with varying experience levels.

**Wrong** (too casual): "Just toss this channel away when you're done, lol"
**Wrong** (too formal): "The channel must be disposed of via appropriate cleanup
procedures" **Correct**: "Close the channel when you're done using it"

### Assume Intelligence, Not Experience

The reader is intelligent but may not know ParleyJS yet.

**Wrong** (too basic): "A window is something you see on your computer"
**Wrong** (too advanced): "Implement a MessagePort-based protocol stack"
**Correct**: "A window object represents a browser window or iFrame context"

### Be Helpful and Constructive

Guide readers toward success, especially in error situations.

**Wrong**: "Invalid origin format" **Better**: "Origin must include the protocol
and host (e.g., 'https://example.com')" **Best**: "Origin must include the
protocol and host. You provided
'${provided}' but the current window is '${actual}'."

### Avoid Sales Language

Documentation is not marketing. Be factual, not promotional.

**Wrong**: "ParleyJS revolutionizes cross-window communication" **Correct**:
"ParleyJS simplifies cross-window communication by automating validation and
providing request-response patterns"

## Structure Patterns

### Introduction Section

Start major sections with 2-3 sentence introduction explaining what the section
covers.

**Example**: "Origin validation is the first line of defense against malicious
messages. ParleyJS validates the origin automatically, but you should understand
how it works to use it correctly."

### Step-by-Step Instructions

For procedural content, use clear steps.

**Format**:

1. Action (verb + object)
2. Action (verb + object)
3. Action (verb + object)

**Example**:

1. Create a channel in the parent window
2. Register a message handler in the child window
3. Send a message from the parent

### Common Mistakes Section

Include a "Common Mistakes" section when applicable.

**Format**:

- Mistake description
- Why it's wrong
- Correct approach

**Example**: **Mistake**: Using origin: '\*' Why it's wrong: This accepts
messages from any origin, including malicious sites Correct approach: Always
specify the exact expected origin

## Technical Accuracy

### Verify All Information

- Test all code examples
- Verify all API descriptions match the code
- Check all error codes exist
- Verify all configuration options work as described
- Test all cross-references point to correct locations

### Be Precise About Versions

Specify which version information applies to.

**Correct**: "In ParleyJS 2.0+, the request-response API is built-in"
**Correct**: "This feature requires ParleyJS 1.5 or later"

### Explain Why, Not Just How

Help readers understand the reasoning behind recommendations.

**Wrong**: "Always validate the origin" **Better**: "Always validate the origin
to prevent accepting messages from malicious sources"

## Format and Consistency

### Consistent Terminology

Use the same term consistently throughout all documentation.

**Right**: Use "channel" consistently (not "connection", "link", "pipe")
**Right**: Use "origin" consistently (not "source", "domain", "URL") **Right**:
Use "message handler" consistently (not "listener", "callback", "receiver")

Create a glossary if needed for clarity.

### Code Formatting

- Inline code for method names: `channel.send()`
- Inline code for variable names: `targetWindow`
- Code blocks for complete examples
- Use appropriate language highlighting (javascript, typescript, bash)

### Special Terms

Define or explain specialized terms on first use.

**Example**: "You must register a message handler (a function that receives
messages) in the target window."

### Links and References

- Use descriptive link text that explains where it goes
- Always explain what the reader will find at the link
- Keep links up-to-date
- Test links regularly

**Wrong**: "Click here for more info" **Correct**: "See Error Handling Patterns
for examples of handling timeouts"

## Quality Checklist

Before publishing any documentation:

- [ ] No emojis used anywhere
- [ ] All code examples tested and working
- [ ] No duplicate explanations across files
- [ ] All cross-references are accurate and complete
- [ ] Active voice used (or passive justified)
- [ ] Technical terms explained or assumed understood
- [ ] Examples are realistic and complete
- [ ] Spell-check passed
- [ ] Grammar reviewed
- [ ] Links verified and working
- [ ] Professional tone maintained
- [ ] Single source of truth respected
- [ ] Breadcrumb navigation included
- [ ] Table of contents included (if applicable)
- [ ] Cross-references have descriptive link text
- [ ] Footer navigation present (Previous/Next/Parent/Related)
- [ ] Anchor links to major sections
- [ ] No orphaned pages - page is reachable from navigation
- [ ] Navigation is scannable and clear

## Maintenance

### Regular Audits

Every quarter, review documentation for:

- Duplicate content
- Outdated examples
- Broken links
- Inconsistent terminology
- Language quality issues

### Change Management

When making changes:

1. Update the canonical location first
2. Update cross-references to point correctly
3. Remove any duplicate content
4. Test all examples
5. Verify all links still work

### Feedback Integration

When developers ask questions:

- Identify where documentation failed
- Update the relevant section
- Add example if missing
- Verify cross-references

## Examples by Section Type

### API Method Documentation

**Format**:

- Brief description (1 sentence)
- Signature with types
- Parameters table
- Return value description
- Throws/errors
- Real example
- Common mistakes (if any)
- See also links

### How-To Guide

**Format**:

- What problem does this solve?
- Prerequisites
- Steps (numbered)
- Common issues
- Next steps/related topics

### Conceptual Explanation

**Format**:

- What is this concept?
- Why does it matter?
- How does ParleyJS handle it?
- When would you use it?
- Example code
- Related concepts (links)

### Reference Section

**Format**:

- Overview paragraph
- Organized sub-sections
- Table for quick lookup
- Examples for complex items
- Common mistakes

## Questions for Self-Review

Before finalizing documentation, ask:

1. Would someone unfamiliar with the framework understand this?
2. Is every technical term clearly explained?
3. Is there a code example for every new concept?
4. Is this information explained anywhere else? (If yes, remove duplication)
5. Are all cross-references accurate?
6. Can someone reading just this section understand the topic?
7. Is the writing conversational but professional?
8. Are there any emojis? (If yes, remove them)
9. Is the tone helpful and constructive?
10. Is the information current and accurate?

If you answer "no" to any of these, revise before publishing.

## Summary of Key Rules

1. No emojis in any context, ever
2. Write naturally as you would explain to a colleague
3. Use active voice
4. Document each concept once, reference it elsewhere
5. Keep paragraphs to 5 sentences maximum
6. Include code examples for new concepts
7. Use clear, descriptive cross-references
8. Maintain consistent terminology throughout
9. Verify all information is accurate and tested
10. Make documentation easy to scan and navigate

---

## Navigation

**Related Documentation**:

- [Documentation Navigation Strategy](./DOCUMENTATION_NAVIGATION_STRATEGY.md) -
  How navigation is structured
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute documentation
- [Examples](./EXAMPLES.md) - Documentation examples

**Back to**: [Documentation Home](./index.md)
