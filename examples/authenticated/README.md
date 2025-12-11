# Authenticated Communication Example

This example demonstrates secure authenticated communication between parent and child windows using token-based authentication.

## Features

- **Token-based Authentication** - Secure login with token generation
- **Token Validation** - All requests validated against active tokens
- **Authenticated Data Fetching** - Protected data access with valid tokens
- **Authenticated Form Submission** - Secure form handling
- **Logout** - Token invalidation and session cleanup

## Files

- `parent-authenticated.html` - Parent window that initiates authentication
- `child-authenticated.html` - Child iframe that handles authentication

## How It Works

### 1. Authentication Flow

```
Parent                          Child
  |                              |
  |---auth:request-------------->|
  |   (username, password)       |
  |                              | Validates credentials
  |                              | Generates token
  |<--auth:response--------------|
  |   (token, sessionId)         |
  |                              |
```

### 2. Authenticated Request Flow

```
Parent                          Child
  |                              |
  |---data:request-------------->|
  |   (token, query)             |
  |                              | Validates token
  |                              | Fetches data
  |<--data:response--------------|
  |   (data)                     |
  |                              |
```

### 3. Logout Flow

```
Parent                          Child
  |                              |
  |---logout:request------------>|
  |   (token, sessionId)         |
  |                              | Invalidates token
  |<--logout:response------------|
  |   (confirmation)             |
  |                              |
```

## Running the Example

1. Build Parley-js:
   ```bash
   npm run build
   ```

2. Start a local server:
   ```bash
   npx http-server -p 8080
   ```

3. Open in browser:
   ```
   http://localhost:8080/examples/authenticated/parent-authenticated.html
   ```

## Usage

1. Click **"Authenticate"** to login
   - Uses demo credentials: `demo_user` / `demo_pass`
   - Receives authentication token

2. Click **"Fetch User Data"** to request protected data
   - Token validated in child
   - User profile data returned

3. Click **"Submit Form"** to send authenticated form data
   - Token validated in child
   - Form processed and confirmed

4. Click **"Logout"** to invalidate session
   - Token removed from valid tokens
   - Session cleaned up

## Security Features

### Token Generation
```typescript
// Generate secure token
currentToken = 'token_' + Math.random().toString(36).substring(2, 15);
currentSession = 'session_' + Date.now();
validTokens.add(currentToken);
```

### Token Validation
```typescript
// Validate token on every request
if (!payload.token || !validTokens.has(payload.token)) {
    throw new Error('Unauthorized: Invalid token');
}
```

### Token Invalidation
```typescript
// Remove token on logout
validTokens.delete(payload.token);
currentToken = null;
```

## Message Types

### Authentication Messages

**`auth:request`** - Parent → Child
```typescript
{
    username: string;
    password: string;
}
```

**`auth:response`** - Child → Parent
```typescript
{
    token: string;
    sessionId: string;
    expiresIn: number;
}
```

### Data Request Messages

**`data:request`** - Parent → Child
```typescript
{
    token: string;
    query: string;
}
```

**`data:response`** - Child → Parent
```typescript
{
    data: {
        userId: string;
        username: string;
        email: string;
        profile: object;
    }
}
```

### Form Submission Messages

**`form:submit`** - Parent → Child
```typescript
{
    token: string;
    formData: {
        name: string;
        email: string;
        message: string;
    }
}
```

**`form:response`** - Child → Parent
```typescript
{
    message: string;
    formId: string;
}
```

### Logout Messages

**`logout:request`** - Parent → Child
```typescript
{
    token: string;
    sessionId: string;
}
```

**`logout:response`** - Child → Parent
```typescript
{
    message: string;
}
```

## Best Practices

1. **Never Store Tokens in localStorage/sessionStorage** in production
   - Use secure, httpOnly cookies
   - Implement proper token expiration

2. **Use HTTPS** in production
   - Prevents token interception
   - Required for secure cookies

3. **Implement Token Refresh**
   - Short-lived access tokens
   - Long-lived refresh tokens

4. **Add Rate Limiting**
   - Prevent brute force attacks
   - Limit authentication attempts

5. **Implement CSRF Protection**
   - Use CSRF tokens for state-changing operations
   - Validate origin properly

## Production Considerations

For production use:

1. **Use Real Authentication Service**
   ```typescript
   // Call actual auth API
   const response = await fetch('/api/auth/login', {
       method: 'POST',
       body: JSON.stringify({ username, password })
   });
   ```

2. **Implement Token Expiration**
   ```typescript
   const tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
   validTokens.set(token, { expires: tokenExpiry });
   ```

3. **Add Token Refresh Logic**
   ```typescript
   if (tokenExpiring(token)) {
       await refreshToken(token);
   }
   ```

4. **Use Schema Validation**
   ```typescript
   parley.register('auth:request', handler, {
       requestSchema: {
           type: 'object',
           properties: {
               username: { type: 'string', minLength: 3 },
               password: { type: 'string', minLength: 8 }
           },
           required: ['username', 'password']
       }
   });
   ```

## Error Handling

The example demonstrates proper error handling:

```typescript
try {
    await parley.send('data:request', { token }, { targetId: 'child' });
} catch (error) {
    if (error.message.includes('Unauthorized')) {
        // Token invalid - redirect to login
        authenticate();
    } else {
        // Other error - show message
        showError(error.message);
    }
}
```

## See Also

- [Basic Example](../basic/README.md) - Simple parent-child communication
- [Window-to-Window Example](../window-to-window/README.md) - Popup window communication
- [Security Guide](../../docs/SECURITY.md) - Security best practices
- [API Documentation](../../docs/API.md) - Complete API reference
