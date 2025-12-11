/**
 * @file EventEmitter.ts
 * @description Internal event emitter for Parley framework
 * @module parley-js/events
 *
 * A lightweight, type-safe event emitter implementation.
 * No external dependencies - implements pub/sub pattern from scratch.
 */

/**
 * Generic event handler function type
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Internal listener entry with handler and options
 */
interface ListenerEntry<T = unknown> {
    handler: EventHandler<T>;
    once: boolean;
}

/**
 * Internal event emitter class for Parley
 *
 * Provides a type-safe pub/sub implementation with support for:
 * - Multiple listeners per event
 * - One-time listeners
 * - Async event handlers
 * - Listener removal via returned unsubscribe function
 *
 * @example
 * ```typescript
 * const emitter = new EventEmitter();
 *
 * // Subscribe to an event
 * const unsubscribe = emitter.on('message', (data) => {
 *     console.log('Received:', data);
 * });
 *
 * // Emit an event
 * emitter.emit('message', { text: 'Hello' });
 *
 * // Unsubscribe
 * unsubscribe();
 * ```
 */
export class EventEmitter {
    /**
     * Map of event names to their listener arrays
     */
    private _listeners: Map<string, ListenerEntry[]> = new Map();

    /**
     * Maximum number of listeners per event (prevents memory leaks)
     */
    private _maxListeners: number = 100;

    /**
     * Creates a new EventEmitter instance
     *
     * @param maxListeners - Maximum listeners per event (default: 100)
     */
    constructor(maxListeners: number = 100) {
        this._maxListeners = maxListeners;
    }

    /**
     * Subscribe to an event
     *
     * @param event - Event name to subscribe to
     * @param handler - Handler function to call when event is emitted
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * const unsubscribe = emitter.on('connected', (data) => {
     *     console.log('Connected:', data);
     * });
     * ```
     */
    public on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
        return this._addListener(event, handler, false);
    }

    /**
     * Subscribe to an event for a single emission only
     *
     * @param event - Event name to subscribe to
     * @param handler - Handler function to call once when event is emitted
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * emitter.once('ready', () => {
     *     console.log('Ready! (will only log once)');
     * });
     * ```
     */
    public once<T = unknown>(event: string, handler: EventHandler<T>): () => void {
        return this._addListener(event, handler, true);
    }

    /**
     * Remove a specific handler from an event
     *
     * @param event - Event name
     * @param handler - Handler function to remove
     */
    public off<T = unknown>(event: string, handler: EventHandler<T>): void {
        const listeners = this._listeners.get(event);
        if (!listeners) {
            return;
        }

        const index = listeners.findIndex((entry) => entry.handler === handler);
        if (index !== -1) {
            listeners.splice(index, 1);
        }

        // Clean up empty listener arrays
        if (listeners.length === 0) {
            this._listeners.delete(event);
        }
    }

    /**
     * Emit an event to all subscribed handlers
     *
     * @param event - Event name to emit
     * @param data - Data to pass to handlers
     * @returns Promise that resolves when all handlers have completed
     *
     * @example
     * ```typescript
     * await emitter.emit('message', { text: 'Hello' });
     * ```
     */
    public async emit<T = unknown>(event: string, data: T): Promise<void> {
        const listeners = this._listeners.get(event);
        if (!listeners || listeners.length === 0) {
            return;
        }

        // Create a copy to avoid issues if handlers modify the array
        const listenersToCall = [...listeners];

        // Collect one-time listeners to remove after calling
        const onceListeners: EventHandler[] = [];

        // Execute all handlers
        const promises: Promise<void>[] = [];

        for (const entry of listenersToCall) {
            if (entry.once) {
                onceListeners.push(entry.handler);
            }

            try {
                const result = entry.handler(data);
                if (result instanceof Promise) {
                    promises.push(result);
                }
            } catch (error) {
                // Log error but don't break other handlers
                console.error(`Error in event handler for "${event}":`, error);
            }
        }

        // Remove one-time listeners
        for (const handler of onceListeners) {
            this.off(event, handler);
        }

        // Wait for all async handlers to complete
        if (promises.length > 0) {
            await Promise.allSettled(promises);
        }
    }

    /**
     * Emit an event synchronously (does not wait for async handlers)
     *
     * @param event - Event name to emit
     * @param data - Data to pass to handlers
     */
    public emitSync<T = unknown>(event: string, data: T): void {
        const listeners = this._listeners.get(event);
        if (!listeners || listeners.length === 0) {
            return;
        }

        // Create a copy to avoid issues if handlers modify the array
        const listenersToCall = [...listeners];

        // Collect one-time listeners to remove after calling
        const onceListeners: EventHandler[] = [];

        for (const entry of listenersToCall) {
            if (entry.once) {
                onceListeners.push(entry.handler);
            }

            try {
                entry.handler(data);
            } catch (error) {
                // Log error but don't break other handlers
                console.error(`Error in event handler for "${event}":`, error);
            }
        }

        // Remove one-time listeners
        for (const handler of onceListeners) {
            this.off(event, handler);
        }
    }

    /**
     * Remove all listeners for a specific event or all events
     *
     * @param event - Optional event name. If not provided, removes all listeners.
     */
    public removeAllListeners(event?: string): void {
        if (event !== undefined) {
            this._listeners.delete(event);
        } else {
            this._listeners.clear();
        }
    }

    /**
     * Get the count of listeners for a specific event
     *
     * @param event - Event name
     * @returns Number of listeners
     */
    public listenerCount(event: string): number {
        const listeners = this._listeners.get(event);
        return listeners ? listeners.length : 0;
    }

    /**
     * Get all event names that have listeners
     *
     * @returns Array of event names
     */
    public eventNames(): string[] {
        return Array.from(this._listeners.keys());
    }

    /**
     * Set the maximum number of listeners per event
     *
     * @param maxListeners - Maximum listeners (0 = unlimited)
     */
    public setMaxListeners(maxListeners: number): void {
        this._maxListeners = maxListeners;
    }

    /**
     * Get the maximum number of listeners per event
     *
     * @returns Maximum listeners setting
     */
    public getMaxListeners(): number {
        return this._maxListeners;
    }

    /**
     * Internal method to add a listener
     *
     * @param event - Event name
     * @param handler - Handler function
     * @param once - Whether to remove after first call
     * @returns Unsubscribe function
     */
    private _addListener<T = unknown>(
        event: string,
        handler: EventHandler<T>,
        once: boolean
    ): () => void {
        let listeners = this._listeners.get(event);

        if (!listeners) {
            listeners = [];
            this._listeners.set(event, listeners);
        }

        // Prevent memory leaks by enforcing max listener limit
        // Follows Node.js EventEmitter pattern of throwing on limit exceeded
        if (this._maxListeners > 0 && listeners.length >= this._maxListeners) {
            throw new Error(
                `Max listeners (${this._maxListeners}) exceeded for event "${event}". ` +
                    'This likely indicates a memory leak. ' +
                    `Use emitter.setMaxListeners(n) to increase the limit if this is intentional.`
            );
        }

        const entry: ListenerEntry = {
            handler: handler as EventHandler,
            once,
        };

        listeners.push(entry);

        // Return unsubscribe function
        return () => {
            this.off(event, handler);
        };
    }
}
