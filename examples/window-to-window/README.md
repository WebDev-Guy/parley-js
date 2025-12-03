# Window-to-Window Example

A comprehensive example demonstrating communication between two separate browser windows using `window.open()` and `window.opener`.

## Files

- `main.html` - The main window that opens the popup
- `popup.html` - The popup window opened by the main window

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

3. Open http://localhost:3000/examples/window-to-window/main.html in your browser.

## What This Example Demonstrates

1. **Window Opening** - Main window opens a popup using `window.open()`
2. **Bidirectional Connection** - Both windows establish a connection to each other
3. **Request/Response** - Send messages and receive responses across windows
4. **Fire-and-Forget** - Send notifications without expecting a response
5. **Window State Detection** - Detect when the popup is closed
6. **Heartbeat Monitoring** - Monitor connection health between windows
7. **System Events** - Listen for connection lifecycle events

## Key Differences from Iframe Communication

| Aspect | Iframe | Window-to-Window |
|--------|--------|------------------|
| Target | `iframe.contentWindow` | `window.open()` result |
| Parent Reference | `window.parent` | `window.opener` |
| Target Type | `'iframe'` | `'window'` |
| Lifecycle | Controlled by parent DOM | Independent window |
| Visibility | Embedded in parent | Separate window/tab |

## Expected Behavior

### Main Window:
1. Click "Open Popup" to open the popup window
2. Connection is automatically established
3. Use buttons to send messages to the popup
4. Click "Close Popup" to close the popup window

### Popup Window:
1. Automatically connects to the opener (main window)
2. Receives and responds to messages
3. Can send notifications back to the main window
4. Closing the popup triggers disconnection events

## Browser Compatibility Notes

- Modern browsers may block popups by default
- The popup must be triggered by a user action (click)
- Some browsers restrict `window.opener` access for security
- Same-origin policy applies unless origins are explicitly allowed

## Security Considerations

- Always configure `allowedOrigins` with specific trusted origins
- Never use `'*'` wildcard in production for `allowedOrigins`
- The example uses `'null'` to support local file:// protocol testing
- When served via HTTP (recommended), the same-origin is used automatically
- In production, specify the exact popup origin
