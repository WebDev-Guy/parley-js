[Home](./index.md) > [Documentation](./index.md) > Documentation Navigation
Strategy

# ParleyJS Documentation Navigation Strategy

Complete strategy for cross-linking and navigation within documentation to
ensure users never get lost and always have a clear way to return to their
original location.

## Problem Statement

Users navigating through documentation may:

- Click a reference and forget where they came from
- Get lost in deep documentation hierarchies
- Have to use browser back button repeatedly
- Lose context about their original task
- Struggle to return to the page they were reading

This strategy ensures navigation is always clear and users never feel lost.

## Navigation Approach: Hybrid Model

Rather than relying on a single approach, use a combination of techniques based
on context:

1. Breadcrumb trails for hierarchy awareness
2. Explicit "back" navigation for related content
3. New tabs for supplementary references
4. Clear section structure with table of contents
5. Related content links with context

## Implementation Strategy

### 1. Breadcrumb Navigation

Breadcrumbs show the user's location in the documentation hierarchy.

**When to use**: On every documentation page

**Format**: Text-based breadcrumbs at the top of each page

```
Home > Getting Started > Basic Concepts > Message Handlers
```

**Implementation in Markdown**:

Each markdown file starts with breadcrumb navigation:

```markdown
[Home](./index.md) > [Getting Started](./getting-started.md) > Basic Concepts

# Message Handlers
```

**HTML Rendering** (for websites):

```html
<nav class="breadcrumb">
    <a href="/">Home</a>
    <span>/</span>
    <a href="/getting-started">Getting Started</a>
    <span>/</span>
    <a href="/getting-started/concepts">Basic Concepts</a>
    <span>/</span>
    <span>Message Handlers</span>
</nav>
```

**Benefits**:

- Shows location in hierarchy
- Quick navigation to parent sections
- Clear context about where user is
- Works in any documentation system

**Limitations**:

- Doesn't show all available options
- Requires consistent file structure

### 2. Table of Contents (TOC)

Every major document has a table of contents at the top showing all sections.

**Location**: Immediately after breadcrumb, before introduction

**Format**:

```markdown
## Table of Contents

1. [Introduction](#introduction)
2. [Creating Channels](#creating-channels)
3. [Sending Messages](#sending-messages)
4. [Error Handling](#error-handling)
5. [Common Patterns](#common-patterns)
```

**Benefits**:

- Users know what's available in current document
- Can jump to relevant section immediately
- Searchable structure
- Shows document scope

**Implementation**:

- For long documents (5+ sections): Required
- For medium documents (3-4 sections): Optional but recommended
- For short documents (1-2 sections): Not necessary

### 3. Cross-Reference Links Strategy

Different types of references use different linking approaches:

#### Type A: References to Related Concepts (Same Mental Task)

When referring to related information that helps complete the current task:

**Pattern**: "For more details about X, see [Link Text](../path/to/doc.md)."

**Approach**: External link in same tab (user's browser history captures it)

**Example**: "To understand origin validation requirements, see
[Security: Origin Validation](../security/origin-validation.md)."

**Why same tab**: User is pursuing the same goal (learning about the current
feature)

#### Type B: References to Detailed API Information

When referring to complete API documentation:

**Pattern**: "The complete method reference is available in
[API Reference: channel.send()](../api-reference.md#channelsend)"

**Approach**: External link in same tab with anchor to specific method

**Why same tab**: User expects to see full details then return

#### Type C: Supplementary or Optional References

When referring to advanced/optional information not required for current task:

**Pattern**:
"[Advanced: Performance Optimization for High-Frequency Messages](../advanced/performance.md)
{target='\_blank'}"

**Approach**: Link that opens in new tab (preserves original context)

**Why new tab**: User might be satisfied without this information and wants to
return immediately

#### Type D: Alternative Approaches

When showing different ways to accomplish the same thing:

**Pattern**: "Alternative approaches:

- [Pattern: Request-Response](../patterns/request-response.md)
- [Pattern: Event Emitter](../patterns/event-emitter.md)
- [Pattern: State Synchronization](../patterns/state-sync.md)"

**Approach**: Links in same tab, but within a clearly marked "alternatives"
section

**Why same tab**: User is choosing between options for same task

### 4. Return Navigation

Explicit "return" links help users get back to where they came from.

#### Approach A: Contextual Back Link

At the bottom of pages, provide context-aware back navigation:

```markdown
---

### Continue Reading

- **Previous**: [Request-Response Pattern](./request-response.md)
- **Next**: [Event Emitter Pattern](./event-emitter.md)
- **Back to**: [Code Patterns](./code-patterns.md)
```

**Benefits**:

- Clear navigation to related content
- Shows document position
- Multiple return paths

**Use in**: Pattern documents, how-to guides, sequential learning paths

#### Approach B: Section Navigation

For long documents, provide navigation between major sections:

```markdown
## Timeout Handling

[Back to Error Handling](#error-handling) |
[Next: Custom Error Codes](#custom-error-codes)
```

**Benefits**:

- Quick navigation within document
- Smaller visual footprint
- Good for reference documents

**Use in**: API reference, comprehensive guides

#### Approach C: Up to Parent

For nested documentation, provide "up" navigation:

```markdown
Back to: [Use Cases](../use-cases.md)
```

**Benefits**:

- Clear parent-child relationships
- One-click return to parent

**Use in**: All documents in nested structures

#### Approach D: Quick Return Button (HTML/Web)

For website implementations, include a subtle "return" button:

```html
<div class="breadcrumb-return">
    <a href="javascript:history.back()" class="return-button"
        >Return to Previous Page</a
    >
</div>
```

**Benefits**:

- Relies on user's browser history
- Non-intrusive
- Universal (works everywhere)

**Limitations**:

- Doesn't work if documentation accessed via direct link
- Doesn't work in PDF

### 5. New Tab Links

When to open links in new tabs:

**Use new tab (`target="_blank"`) for**:

- Supplementary examples in external repositories
- References to external libraries or standards
- Advanced/optional topics while reading basics
- Video tutorials or interactive content
- External tools or services

**Don't use new tab for**:

- Links between documentation pages
- Links to related concepts in same guide
- Sequential learning paths
- Hierarchical navigation

**Implementation in Markdown**:

```markdown
[Advanced Topic](../advanced/topic.md) (opens in new tab)
```

**Implementation in HTML**:

```html
<a href="/advanced/topic" target="_blank">Advanced Topic</a>
```

**Note**: Avoid making new-tab-opening automatic. Instead, explicitly note
"(opens in new tab)" when you intend this behavior.

## Documentation Structure for Navigation

Organize documentation in a clear hierarchy to support navigation:

### Recommended Structure

```
docs/
├── README.md (landing page with TOC)
├── getting-started/
│   ├── README.md (overview)
│   ├── installation.md
│   ├── first-example.md
│   └── concepts.md
├── api-reference/
│   ├── README.md (index of all methods)
│   ├── channel.md
│   ├── message-types.md
│   └── error-codes.md
├── guides/
│   ├── README.md (list of all guides)
│   ├── iframe-communication.md
│   ├── worker-communication.md
│   └── popup-communication.md
├── patterns/
│   ├── README.md (pattern overview)
│   ├── request-response.md
│   ├── event-emitter.md
│   ├── error-handling.md
│   └── state-synchronization.md
├── security/
│   ├── README.md (security overview)
│   ├── origin-validation.md
│   ├── message-validation.md
│   └── best-practices.md
├── performance/
│   ├── README.md (performance overview)
│   ├── optimization.md
│   └── profiling.md
├── troubleshooting/
│   ├── README.md (FAQ index)
│   ├── common-errors.md
│   ├── debugging.md
│   └── performance-issues.md
└── examples/
    ├── README.md (example index)
    ├── basic-setup/
    ├── advanced-patterns/
    └── integration-scenarios/
```

**Key principle**: Each directory has a README.md that indexes its contents

## Breadcrumb Examples by Page Type

### Getting Started Page

```
[Home](../../index.md) > [Getting Started](./index.md) > Installation
```

### API Reference Page

```
[Home](../../index.md) > [API Reference](./index.md) > Channel Methods > send()
```

### Pattern Page

```
[Home](../../index.md) > [Code Patterns](./index.md) > Error Handling
```

### Nested Example

```
[Home](../../index.md) > [Examples](./index.md) > [Basic Setup](./basic-setup/index.md) > Parent-Child Communication
```

## Footer Navigation Template

Every documentation page should include appropriate footer navigation:

### For Sequential Pages (tutorials, guides)

```markdown
---

### Navigation

**Previous Section**: [Basic Concepts](./concepts.md) **Next Section**:
[Creating Your First Channel](./first-channel.md) **Parent Guide**:
[Getting Started](./index.md) **API Reference**:
[See API Docs](../api-reference/channel.md)
```

### For Reference Pages (API docs)

```markdown
---

### Related References

- [Message Types](./message-types.md)
- [Error Codes](./error-codes.md)
- [Type Definitions](./types.md)

**Back to**: [API Reference](./index.md)
```

### For Pattern Pages

```markdown
---

### Similar Patterns

- [Request-Response Pattern](./request-response.md)
- [Event Emitter Pattern](./event-emitter.md)

### See Also

- [Testing Pattern](../../testing/patterns.md)
- [Error Handling Guide](../../guides/error-handling.md)

**Back to**: [Code Patterns](./index.md)
```

### For How-To Guides

```markdown
---

### Related Guides

- [iFrame Communication](./iframe-communication.md)
- [Worker Communication](./worker-communication.md)

### Related Patterns

- [Request-Response](../patterns/request-response.md)
- [Error Handling](../patterns/error-handling.md)

**Back to**: [All Guides](./index.md)
```

## Link Destination Standards

When creating a cross-reference link, ensure it points to:

1. **The most specific relevant section** (not generic parent)
    - Wrong: "See the API reference"
    - Correct: "See
      [channel.send() in API Reference](../api-reference/channel.md#send)"

2. **A section that answers the user's question** (not just "related")
    - Wrong: "For more information, see Security"
    - Correct: "To validate incoming messages, see
      [Message Validation](../security/message-validation.md)"

3. **Anchor to specific subsection** when possible
    - Wrong: `[Link](../api-reference.md)`
    - Correct: `[Link](../api-reference.md#error-codes)`

4. **With descriptive link text** that indicates where it goes
    - Wrong: "click here"
    - Wrong: "../security.md"
    - Correct:
      "[Origin Validation Best Practices](../security/origin-validation.md)"

## Navigation for Different Documentation Types

### Tutorial/Learning Path

Structure: Linear progression through topics

Navigation strategy:

- Breadcrumbs at top
- "Previous/Next" links at bottom
- Table of contents if longer than 5 sections
- Related optional resources in sidebar

### Reference Documentation

Structure: Organized by topic, not sequential

Navigation strategy:

- Breadcrumbs at top
- Table of contents with all entries
- Quick reference section
- "See also" links to related methods
- Anchor links to specific methods

### How-To Guides

Structure: Task-focused, can be read independently

Navigation strategy:

- Clear problem statement up front
- Breadcrumbs at top
- Prerequisites section
- Step-by-step with inline links to prerequisites
- "Related tasks" at bottom
- Alternative approaches section

### API Reference

Structure: Alphabetical or grouped by category

Navigation strategy:

- Breadcrumbs at top
- Alphabetical index or category grouping
- Each method has "See also" links
- Error codes reference
- Type definitions reference
- Search functionality

### Troubleshooting/FAQ

Structure: Problem-solution pairs

Navigation strategy:

- Table of contents listing all problems
- Related problems section for each answer
- Links to relevant documentation sections
- Prevention strategies section

## Handling Deep Navigation

When users navigate to a document 3+ levels deep, provide multiple return paths:

**Example - Deep Page**:

```
[Home](../../index.md) > [Security](./index.md) > [Best Practices](./index.md) > Origin Validation

# Origin Validation

... content ...

---

### Quick Navigation

- Back to: [Security Best Practices](./index.md)
- Up to: [Security Guide](./index.md)
- Related: [Message Validation](./message-validation.md)
- API: [channel.on() Origin Check](../../api-reference/channel.md#origin-check)
```

## Special Navigation Cases

### External References

When linking to external resources, be explicit:

```markdown
For more about the postMessage API, see
[MDN: window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
(external site - opens in new tab)
```

### Deprecated Content

When referencing deprecated features:

```markdown
**Note**: This approach is deprecated in ParleyJS 2.0+. For the current method,
see [Modern Approach](./modern-approach.md).
```

### Version-Specific Content

When content varies by version:

```markdown
This feature requires ParleyJS 1.5 or later. For version compatibility, see
[Version Guide](../../version-compatibility.md).
```

## Navigation in Code Examples

When documentation includes code examples, provide context navigation:

```markdown
### Example: Basic Message Sending

[View complete example in repository](https://github.com/WebDev-Guy/parley-js/tree/main/examples/basic-message-sending)
[View related example: Error Handling](./error-handling-example.md)

[See relevant API methods](#api-reference)

code example here...
```

## Testing Navigation Quality

Before publishing, verify navigation quality:

1. **Follow every cross-reference**
    - Does it point to relevant content?
    - Is the destination helpful?
    - Can you easily return?

2. **Check breadcrumbs**
    - Are they present on every page?
    - Do they accurately show location?
    - Do the links work?

3. **Verify anchor links**
    - Do they point to correct sections?
    - Do they land in the right place?
    - Are headings clearly marked?

4. **Test return navigation**
    - Are "Previous/Next" links present?
    - Do they make sense sequentially?
    - Are parent links available?

5. **Check for orphaned pages**
    - Is every page reachable from navigation?
    - Are there multiple ways to reach it?
    - Is there a way to return to home?

## Implementation Checklist

When creating new documentation:

- [ ] Add breadcrumb navigation at top
- [ ] Add table of contents if more than 4 sections
- [ ] All cross-references point to specific sections (not generic parents)
- [ ] Cross-reference text is descriptive
- [ ] External links marked as "opens in new tab" if they do
- [ ] Footer navigation present (previous/next, related, parent)
- [ ] Anchor links to key sections
- [ ] Related content clearly marked
- [ ] No orphaned pages (every page reachable from navigation)
- [ ] Return path available from every page
- [ ] Tested all links work correctly

## Navigation for Different Access Methods

### Markdown in Repository

Users reading raw markdown in GitHub:

- Use relative links: `[Link](../other/page.md)`
- Breadcrumbs shown as text (manual navigation)
- Rely on browser back button and relative links

### Static Documentation Site

Users reading on hosted documentation site:

- Use absolute paths: `/docs/path/page`
- Breadcrumbs rendered as HTML nav
- Footer navigation prominent
- Sidebar navigation available

### PDF Export

Users with PDF documentation:

- Include full table of contents
- Print breadcrumbs visually
- Print "See page X" references
- Include index at end

### IDE/Editor Integration

Users reading in code editor (Copilot, etc.):

- Use simple relative links
- Clear section headers for anchor navigation
- Short paragraphs for readability
- Code examples prominently displayed

## Common Navigation Mistakes to Avoid

### Wrong: Assuming Users Know Where They Are

- Don't skip breadcrumbs
- Don't assume users know the document structure
- Don't require memorizing file paths

### Wrong: Making All Links Open in New Tabs

- Overwhelms users with too many tabs
- Breaks browser history
- Makes navigation confusing

### Wrong: No Return Path from External Resources

- Don't link to external content without context
- Always provide way to return to current page
- Mark external links clearly

### Wrong: Inconsistent Navigation Across Pages

- Maintain consistent footer structure
- Use same breadcrumb format everywhere
- Same naming for "Previous/Next" sections

### Wrong: Unclear Link Text

- Never use "click here" or "more info"
- Link text should indicate destination
- Include context if needed

### Wrong: Circular Navigation

- Avoid A links to B links to A
- No dead-end pages
- Always provide upward navigation

### Wrong: Too Many Navigation Options

- 3-5 related links maximum per section
- Too many choices paralyzes users
- Group related links together

## Documentation Site Configuration

For documentation sites (Docusaurus, VitePress, etc.), configure:

1. **Breadcrumb Generation**: Automatic from file structure
2. **Sidebar Navigation**: Clear hierarchy with categories
3. **Footer Navigation**: Previous/Next auto-generated
4. **Search**: Full-text search with breadcrumb in results
5. **Version Switcher**: If maintaining multiple versions
6. **Edit Link**: For contributions (optional)

Example sidebar structure:

```
Getting Started
  - Installation
  - First Example
  - Core Concepts
API Reference
  - Channel
  - Message Types
  - Error Codes
Guides
  - iFrame Communication
  - Worker Communication
  - Popup Communication
Patterns
  - Request-Response
  - Event Emitter
  - Error Handling
Security
  - Origin Validation
  - Message Validation
  - Best Practices
Performance
  - Optimization
  - Profiling
Troubleshooting
  - Common Errors
  - Debugging
  - FAQ
```

## Summary: Navigation Approach

**Use this strategy for optimal navigation**:

1. **Breadcrumbs** on every page to show location
2. **Table of Contents** on long pages
3. **Descriptive cross-references** to specific sections (not generic)
4. **Footer navigation** with previous/next/parent/related
5. **Same-tab links** for related documentation
6. **New-tab links** for supplementary external content only
7. **Anchor links** to key sections for quick jumps
8. **Clear structure** with directories and README files
9. **No orphaned pages** - all pages reachable from navigation
10. **Tested links** - verify all cross-references work

This hybrid approach ensures users never get lost while maintaining clean,
professional documentation.

---

## Navigation

**Related Documentation**:

- [Documentation Style Guide](./DOCUMENTATION_STYLE_GUIDE.md) - Writing
  standards and style
- [Architecture](./ARCHITECTURE.md) - Documentation architecture
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute

**Back to**: [Documentation Home](./index.md)
