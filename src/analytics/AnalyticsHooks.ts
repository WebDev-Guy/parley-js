/**
 * @file AnalyticsHooks.ts
 * @description Analytics hooks and utilities for Parley framework
 * @module parley-js/analytics
 *
 * Provides utilities for integrating Parley with analytics services.
 */

import type {
    AnalyticsEvent,
    AnalyticsEventHandler,
    AnalyticsAdapter,
    AnalyticsOptions,
    AnalyticsEventType,
} from './AnalyticsTypes';

/**
 * Analytics manager for handling analytics events
 *
 * @example
 * ```typescript
 * const analytics = new AnalyticsManager({
 *     enabled: true,
 *     sampleRate: 0.5 // Only track 50% of events
 * });
 *
 * // Add a custom adapter
 * analytics.addAdapter({
 *     name: 'console',
 *     handleEvent: (event) => console.log(event)
 * });
 *
 * // Get handler to pass to Parley
 * parley.onAnalyticsEvent(analytics.getHandler());
 * ```
 */
export class AnalyticsManager {
    /**
     * Configuration options
     */
    private _options: Required<AnalyticsOptions>;

    /**
     * Registered adapters
     */
    private _adapters: AnalyticsAdapter[] = [];

    /**
     * Custom event handlers
     */
    private _handlers: Set<AnalyticsEventHandler> = new Set();

    /**
     * Event count for sampling
     */
    private _eventCount: number = 0;

    /**
     * Creates a new AnalyticsManager instance
     *
     * @param options - Analytics configuration
     */
    constructor(options: Partial<AnalyticsOptions> = {}) {
        this._options = {
            enabled: options.enabled ?? false,
            eventTypes: options.eventTypes ?? [],
            adapters: options.adapters ?? [],
            includeTiming: options.includeTiming ?? true,
            sampleRate: options.sampleRate ?? 1,
        };

        // Add provided adapters
        for (const adapter of this._options.adapters) {
            this._adapters.push(adapter);
        }
    }

    /**
     * Check if analytics is enabled
     */
    public get enabled(): boolean {
        return this._options.enabled;
    }

    /**
     * Enable analytics
     */
    public enable(): void {
        this._options.enabled = true;
    }

    /**
     * Disable analytics
     */
    public disable(): void {
        this._options.enabled = false;
    }

    /**
     * Set sample rate
     *
     * @param rate - Sample rate (0-1)
     */
    public setSampleRate(rate: number): void {
        this._options.sampleRate = Math.max(0, Math.min(1, rate));
    }

    /**
     * Add an analytics adapter
     *
     * @param adapter - Adapter to add
     */
    public addAdapter(adapter: AnalyticsAdapter): void {
        this._adapters.push(adapter);
    }

    /**
     * Remove an analytics adapter
     *
     * @param adapterName - Name of adapter to remove
     */
    public removeAdapter(adapterName: string): void {
        this._adapters = this._adapters.filter((a) => a.name !== adapterName);
    }

    /**
     * Add a custom event handler
     *
     * @param handler - Handler function
     * @returns Unsubscribe function
     */
    public addHandler(handler: AnalyticsEventHandler): () => void {
        this._handlers.add(handler);
        return () => {
            this._handlers.delete(handler);
        };
    }

    /**
     * Get the event handler to pass to Parley
     *
     * @returns Event handler function
     */
    public getHandler(): AnalyticsEventHandler {
        return (event: AnalyticsEvent) => {
            this.handleEvent(event);
        };
    }

    /**
     * Handle an analytics event
     *
     * @param event - Event to handle
     */
    public handleEvent(event: AnalyticsEvent): void {
        if (!this._options.enabled) {
            return;
        }

        // Check event type filter
        if (this._options.eventTypes.length > 0 && !this._options.eventTypes.includes(event.type)) {
            return;
        }

        // Apply sampling
        if (!this._shouldSample()) {
            return;
        }

        // Remove timing data if not wanted
        const processedEvent = this._options.includeTiming ? event : this._stripTiming(event);

        // Call adapters
        for (const adapter of this._adapters) {
            try {
                adapter.handleEvent(processedEvent);
            } catch (error) {
                console.error(`Analytics adapter "${adapter.name}" error:`, error);
            }
        }

        // Call custom handlers
        for (const handler of this._handlers) {
            try {
                handler(processedEvent);
            } catch (error) {
                console.error('Analytics handler error:', error);
            }
        }
    }

    /**
     * Get statistics about analytics events
     *
     * @returns Event statistics
     */
    public getStats(): { eventCount: number; adapterCount: number; handlerCount: number } {
        return {
            eventCount: this._eventCount,
            adapterCount: this._adapters.length,
            handlerCount: this._handlers.size,
        };
    }

    /**
     * Clear all handlers and adapters
     */
    public clear(): void {
        this._adapters = [];
        this._handlers.clear();
        this._eventCount = 0;
    }

    /**
     * Determine if this event should be sampled
     */
    private _shouldSample(): boolean {
        this._eventCount++;

        if (this._options.sampleRate >= 1) {
            return true;
        }

        if (this._options.sampleRate <= 0) {
            return false;
        }

        return Math.random() < this._options.sampleRate;
    }

    /**
     * Strip timing data from an event
     */
    private _stripTiming(event: AnalyticsEvent): AnalyticsEvent {
        const { ...rest } = event;
        if ('duration' in rest) {
            delete (rest as Record<string, unknown>).duration;
        }
        return rest as AnalyticsEvent;
    }
}

/**
 * Create a console logging adapter for debugging
 *
 * @param prefix - Log prefix
 * @returns Analytics adapter
 *
 * @example
 * ```typescript
 * const manager = new AnalyticsManager({ enabled: true });
 * manager.addAdapter(createConsoleAdapter('[Analytics]'));
 * ```
 */
export function createConsoleAdapter(prefix: string = '[Parley Analytics]'): AnalyticsAdapter {
    return {
        name: 'console',
        handleEvent: (event: AnalyticsEvent) => {
            console.log(`${prefix}`, event.type, {
                messageType: event.messageType,
                messageId: event.messageId,
                ...('duration' in event && { duration: event.duration }),
                ...('success' in event && { success: event.success }),
            });
        },
    };
}

/**
 * Create a batching adapter that collects events and sends them periodically
 *
 * @param flushCallback - Callback to handle batched events
 * @param options - Batching options
 * @returns Analytics adapter
 *
 * @example
 * ```typescript
 * const manager = new AnalyticsManager({ enabled: true });
 * manager.addAdapter(createBatchingAdapter(
 *     (events) => {
 *         fetch('/analytics', {
 *             method: 'POST',
 *             body: JSON.stringify(events)
 *         });
 *     },
 *     { batchSize: 10, flushInterval: 5000 }
 * ));
 * ```
 */
export function createBatchingAdapter(
    flushCallback: (events: AnalyticsEvent[]) => void,
    options: {
        batchSize?: number;
        flushInterval?: number;
    } = {}
): AnalyticsAdapter & { flush: () => void } {
    const batchSize = options.batchSize ?? 10;
    const flushInterval = options.flushInterval ?? 5000;

    let batch: AnalyticsEvent[] = [];

    const flush = (): void => {
        if (batch.length > 0) {
            const toFlush = batch;
            batch = [];
            flushCallback(toFlush);
        }
    };

    // Start interval for automatic flushing
    setInterval(flush, flushInterval);

    return {
        name: 'batching',
        handleEvent: (event: AnalyticsEvent) => {
            batch.push(event);
            if (batch.length >= batchSize) {
                flush();
            }
        },
        flush,
    };
}

/**
 * Filter events by type
 *
 * @param types - Event types to include
 * @returns Filter function
 */
export function filterByType(types: AnalyticsEventType[]): (event: AnalyticsEvent) => boolean {
    const typeSet = new Set(types);
    return (event: AnalyticsEvent) => typeSet.has(event.type);
}

/**
 * Filter events by message type pattern
 *
 * @param pattern - RegExp pattern to match message types
 * @returns Filter function
 */
export function filterByMessageType(pattern: RegExp): (event: AnalyticsEvent) => boolean {
    return (event: AnalyticsEvent) => pattern.test(event.messageType);
}
