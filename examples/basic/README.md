# Basic Example

A simple example demonstrating parent-child communication between a parent
window and an iframe.

## Files

- `parent.html` - The parent page that embeds the iframe (inline script using
  the browser build `dist/index.global.js`)
- `child.html` - The child page loaded in the iframe (same setup)

## Running Locally

1. Build the Parley-js library:

```bash
cd ../..
npm install
npm run build
```

2. Serve from the project root (CORS requires HTTP):

```bash
npx serve .
```

3. Open http://localhost:3000/examples/basic/parent.html in your browser.

## What This Example Demonstrates

1. **Connection Setup** - Parent connects to iframe using `connect()`
2. **Message Registration** - Both sides register handlers for message types
   with `on()`
3. **Request/Response** - Parent sends request, child responds
4. **Fire-and-Forget** - Child sends notifications without expecting response
5. **System Events** - Both sides listen for connection events using
   `onSystem()`
6. **Error Handling** - Proper error handling with try/catch

## Expected Output

### Parent Console:

```
[Parent] Parley instance created
[Parent] Connecting to iframe...
[Parent] Connected to child iframe
[Parent] Response from child: { greeting: "Hello, World!" }
```

### Child Console:

```
[Child] Parley instance created
[Child] Connected to parent
[Child] Received hello message: { name: "World" }
```
