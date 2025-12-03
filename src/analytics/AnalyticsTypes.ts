/**
 * @file AnalyticsTypes.ts
 * @description Type definitions for analytics events in Parley framework
 * @module parley-js/analytics
 *
 * Provides type definitions for analytics integration.
 * Parley emits structured analytics events that can be forwarded
 * to any analytics service.
 */

/**
 * Analytics event types
 */
export type AnalyticsEventType =
    | 'message_sent'
    | 'message_received'
    | 'response_sent'
    | 'response_received'
    | 'error'
    | 'timeout';

/**
 * Base analytics event properties
 */
export interface BaseAnalyticsEvent {
    /** Event type */
    type: AnalyticsEventType;

    /** Message type being sent/received */
    messageType: string;

    /** Unique message ID */
    messageId: string;

    /** Target ID (if applicable) */
    targetId?: string;

    /** Unix timestamp in milliseconds */
    timestamp: number;
}

/**
 * Analytics event for message sent
 */
export interface MessageSentAnalyticsEvent extends BaseAnalyticsEvent {
    type: 'message_sent';
}

/**
 * Analytics event for message received
 */
export interface MessageReceivedAnalyticsEvent extends BaseAnalyticsEvent {
    type: 'message_received';
}

/**
 * Analytics event for response sent
 */
export interface ResponseSentAnalyticsEvent extends BaseAnalyticsEvent {
    type: 'response_sent';
    /** Whether the response indicates success */
    success: boolean;
}

/**
 * Analytics event for response received
 */
export interface ResponseReceivedAnalyticsEvent extends BaseAnalyticsEvent {
    type: 'response_received';
    /** Round-trip duration in milliseconds */
    duration: number;
    /** Whether the response indicates success */
    success: boolean;
}

/**
 * Analytics event for errors
 */
export interface ErrorAnalyticsEvent extends BaseAnalyticsEvent {
    type: 'error';
    /** Error code */
    errorCode: string;
    /** Error message */
    errorMessage?: string;
}

/**
 * Analytics event for timeouts
 */
export interface TimeoutAnalyticsEvent extends BaseAnalyticsEvent {
    type: 'timeout';
    /** Error code */
    errorCode: string;
}

/**
 * Union type of all analytics events
 */
export type AnalyticsEvent =
    | MessageSentAnalyticsEvent
    | MessageReceivedAnalyticsEvent
    | ResponseSentAnalyticsEvent
    | ResponseReceivedAnalyticsEvent
    | ErrorAnalyticsEvent
    | TimeoutAnalyticsEvent;

/**
 * Analytics event handler function type
 */
export type AnalyticsEventHandler = (event: AnalyticsEvent) => void;

/**
 * Analytics adapter interface
 *
 * Implement this interface to create a custom analytics adapter
 * that forwards Parley events to your analytics service.
 *
 * @example
 * ```typescript
 * class GoogleAnalyticsAdapter implements AnalyticsAdapter {
 *     name = 'google-analytics';
 *
 *     handleEvent(event: AnalyticsEvent): void {
 *         gtag('event', event.type, {
 *             category: 'parley',
 *             label: event.messageType,
 *             value: event.duration
 *         });
 *     }
 * }
 * ```
 */
export interface AnalyticsAdapter {
    /** Adapter name (for debugging) */
    name: string;

    /**
     * Handle an analytics event
     *
     * @param event - Analytics event to handle
     */
    handleEvent(event: AnalyticsEvent): void;
}

/**
 * Analytics configuration options
 */
export interface AnalyticsOptions {
    /** Whether analytics is enabled */
    enabled: boolean;

    /** Event types to track (empty = all) */
    eventTypes?: AnalyticsEventType[];

    /** Custom adapters */
    adapters?: AnalyticsAdapter[];

    /** Whether to include timing data */
    includeTiming?: boolean;

    /** Sample rate (0-1, 1 = 100%) */
    sampleRate?: number;
}

/**
 * Default analytics options
 */
export const DEFAULT_ANALYTICS_OPTIONS: AnalyticsOptions = {
    enabled: false,
    includeTiming: true,
    sampleRate: 1,
};
