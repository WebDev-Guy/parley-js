# React Integration Example

This example demonstrates how to integrate Parley-js with React using custom hooks and modern React patterns.

## Features

- **React Hooks** - Custom `useParley` hook for easy integration
- **Lifecycle Management** - Automatic cleanup with useEffect
- **State Management** - React state synchronized with Parley events
- **Real-time Updates** - Live message logging and status updates
- **Modern UI** - Clean React component architecture

## Files

- `parent-react.html` - Parent React component
- `react-child.html` - Child React component in iframe

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
   http://localhost:8080/examples/react-integration/parent-react.html
   ```

## Custom Hook: `useParley`

The example includes a reusable `useParley` hook that encapsulates Parley functionality:

```typescript
function useParley(config) {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const parleyRef = useRef(null);

    useEffect(() => {
        // Initialize Parley
        parleyRef.current = Parley.create(config);

        // Listen for events
        parleyRef.current.on('connection:established', (data) => {
            setIsConnected(true);
        });

        // Cleanup on unmount
        return () => {
            if (parleyRef.current) {
                parleyRef.current.destroy();
            }
        };
    }, []);

    const sendMessage = useCallback(async (type, payload, targetId) => {
        // ... implementation
    }, []);

    const registerHandler = useCallback((type, handler) => {
        // ... implementation
    }, []);

    return {
        isConnected,
        messages,
        sendMessage,
        registerHandler,
        parley: parleyRef.current
    };
}
```

## Usage in Components

### Parent Component

```typescript
function ParentComponent() {
    const {
        isConnected,
        messages,
        sendMessage,
        registerHandler,
        connect
    } = useParley({
        allowedOrigins: [window.location.origin],
        debug: true
    });

    useEffect(() => {
        // Register handlers
        registerHandler('pong', (payload) => {
            console.log('Received pong:', payload);
            return { received: true };
        });

        // Connect to iframe
        const iframe = document.querySelector('iframe');
        iframe.onload = () => {
            connect('child', iframe.contentWindow, {
                origin: window.location.origin
            });
        };
    }, [registerHandler, connect]);

    const handlePing = async () => {
        await sendMessage('ping', { timestamp: Date.now() }, 'child');
    };

    return (
        <div>
            <button onClick={handlePing} disabled={!isConnected}>
                Send Ping
            </button>
        </div>
    );
}
```

### Child Component

```typescript
function ChildComponent() {
    const [counter, setCounter] = useState(0);
    const parleyRef = useRef(null);

    useEffect(() => {
        parleyRef.current = Parley.create({
            allowedOrigins: [window.location.origin]
        });

        // Register handler
        parleyRef.current.register('updateCounter', async (payload) => {
            setCounter(prev => prev + payload.increment);
            return { success: true };
        });

        // Connect to parent
        parleyRef.current.connect('parent', window.parent, {
            origin: window.location.origin
        });

        // Cleanup
        return () => parleyRef.current?.destroy();
    }, []);

    return <div>Counter: {counter}</div>;
}
```

## Key Features

### 1. Automatic Cleanup

The hook ensures Parley is properly cleaned up when components unmount:

```typescript
useEffect(() => {
    const parley = Parley.create(config);
    
    return () => {
        parley.destroy(); // Cleanup
    };
}, []);
```

### 2. State Synchronization

React state automatically updates with Parley events:

```typescript
parley.on('connection:established', () => {
    setIsConnected(true); // Update React state
});
```

### 3. Memoized Callbacks

Callbacks are memoized to prevent unnecessary re-renders:

```typescript
const sendMessage = useCallback(async (type, payload, targetId) => {
    await parleyRef.current.send(type, payload, { targetId });
}, []); // No dependencies - stable reference
```

### 4. Error Handling

Graceful error handling with user feedback:

```typescript
try {
    await sendMessage('ping', data, 'child');
} catch (error) {
    addMessage('error', `Failed: ${error.message}`);
}
```

## Integration with React Patterns

### Context API

Share Parley instance across components:

```typescript
const ParleyContext = React.createContext(null);

function ParleyProvider({ children, config }) {
    const parley = useParley(config);
    return (
        <ParleyContext.Provider value={parley}>
            {children}
        </ParleyContext.Provider>
    );
}

function useParleyContext() {
    const context = useContext(ParleyContext);
    if (!context) {
        throw new Error('useParleyContext must be used within ParleyProvider');
    }
    return context;
}
```

### Redux/Zustand

Integrate with state management:

```typescript
// Redux action
export const sendParleyMessage = (type, payload) => async (dispatch, getState) => {
    const { parley } = getState();
    try {
        const response = await parley.send(type, payload);
        dispatch({ type: 'MESSAGE_SENT', payload: response });
    } catch (error) {
        dispatch({ type: 'MESSAGE_ERROR', error });
    }
};
```

### React Query

Integrate with data fetching:

```typescript
function useParleyQuery(messageType, payload) {
    const { parley } = useParleyContext();
    
    return useQuery({
        queryKey: [messageType, payload],
        queryFn: async () => {
            return await parley.send(messageType, payload, { targetId: 'child' });
        }
    });
}
```

## TypeScript Support

For TypeScript projects:

```typescript
import { Parley, ParleyConfig, MessageHandler } from 'parley-js';

interface UseParleyReturn {
    isConnected: boolean;
    messages: Message[];
    sendMessage: (type: string, payload: unknown, targetId: string) => Promise<void>;
    registerHandler: (type: string, handler: MessageHandler) => void;
    connect: (targetId: string, target: Window, options?: ConnectOptions) => Promise<void>;
    parley: Parley | null;
}

function useParley(config: ParleyConfig): UseParleyReturn {
    // Implementation
}
```

## Best Practices

1. **Use Refs for Parley Instance**
   ```typescript
   const parleyRef = useRef<Parley | null>(null);
   // Don't store in state - no need to trigger re-renders
   ```

2. **Cleanup on Unmount**
   ```typescript
   useEffect(() => {
       // ... setup
       return () => {
           parleyRef.current?.destroy();
       };
   }, []);
   ```

3. **Memoize Callbacks**
   ```typescript
   const sendMessage = useCallback(() => {
       // Prevent re-renders when passing as props
   }, [dependencies]);
   ```

4. **Handle Loading States**
   ```typescript
   const [loading, setLoading] = useState(false);
   
   const sendMessage = async () => {
       setLoading(true);
       try {
           await parley.send(...);
       } finally {
           setLoading(false);
       }
   };
   ```

5. **Error Boundaries**
   ```typescript
   class ErrorBoundary extends React.Component {
       componentDidCatch(error) {
           if (error.name === 'ParleyError') {
               // Handle Parley errors
           }
       }
   }
   ```

## Production Considerations

1. **Environment-specific Config**
   ```typescript
   const config = {
       allowedOrigins: process.env.NODE_ENV === 'production'
           ? ['https://app.example.com']
           : ['http://localhost:3000'],
       debug: process.env.NODE_ENV !== 'production'
   };
   ```

2. **Lazy Loading**
   ```typescript
   const Parley = lazy(() => import('parley-js'));
   
   <Suspense fallback={<div>Loading...</div>}>
       <ParleyComponent />
   </Suspense>
   ```

3. **Performance Monitoring**
   ```typescript
   parley.onAnalytics((event) => {
       // Track with analytics service
       analytics.track('parley_event', event);
   });
   ```

## See Also

- [Basic Example](../basic/README.md)
- [Authenticated Example](../authenticated/README.md)
- [API Documentation](../../docs/API.md)
- [React Hooks Documentation](https://react.dev/reference/react)
