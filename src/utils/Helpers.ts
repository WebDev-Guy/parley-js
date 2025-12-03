/**
 * @file Helpers.ts
 * @description Utility functions for Parley framework
 * @module parley-js/utils
 *
 * Contains helper functions used throughout the framework.
 * All utilities are pure functions with no side effects.
 */

/**
 * Generate a UUID v4 string
 *
 * Uses crypto.randomUUID if available (modern browsers),
 * falls back to a manual implementation for older environments.
 *
 * @returns A UUID v4 string
 *
 * @example
 * ```typescript
 * const id = generateUUID();
 * // Returns: '550e8400-e29b-41d4-a716-446655440000'
 * ```
 */
export function generateUUID(): string {
    // Use native implementation if available
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback implementation for older browsers
    // Uses crypto.getRandomValues for better randomness
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const buffer = new Uint8Array(16);
        crypto.getRandomValues(buffer);

        // Set version (4) and variant (2) bits
        buffer[6] = (buffer[6]! & 0x0f) | 0x40;
        buffer[8] = (buffer[8]! & 0x3f) | 0x80;

        const hex = Array.from(buffer)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20, 32),
        ].join('-');
    }

    // Final fallback using Math.random (less secure, but functional)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Deep clone an object using JSON serialization
 *
 * This method also sanitizes the object by removing any
 * non-JSON-serializable values and potential prototype pollution.
 *
 * @param obj - Object to clone
 * @returns Deep cloned object
 * @throws SerializationError if object cannot be serialized
 *
 * @example
 * ```typescript
 * const original = { nested: { value: 42 } };
 * const cloned = deepClone(original);
 * cloned.nested.value = 99;
 * console.log(original.nested.value); // 42
 * ```
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    try {
        return JSON.parse(JSON.stringify(obj));
    } catch {
        throw new Error('Object cannot be serialized to JSON');
    }
}

/**
 * Check if a value is a plain object
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 *
 * @example
 * ```typescript
 * isPlainObject({});              // true
 * isPlainObject({ a: 1 });        // true
 * isPlainObject([]);              // false
 * isPlainObject(null);            // false
 * isPlainObject(new Date());      // false
 * ```
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * Check if a value can be safely serialized to JSON
 *
 * @param value - Value to check
 * @returns True if value can be serialized
 *
 * @example
 * ```typescript
 * isSerializable({ a: 1 });                     // true
 * isSerializable({ fn: () => {} });             // false (function)
 * isSerializable({ circular: null });           // depends on actual value
 * ```
 */
export function isSerializable(value: unknown): boolean {
    if (value === null || value === undefined) {
        return true;
    }

    const type = typeof value;

    if (type === 'string' || type === 'number' || type === 'boolean') {
        return true;
    }

    if (type === 'function' || type === 'symbol' || type === 'bigint') {
        return false;
    }

    if (type === 'object') {
        // Check for circular references and non-serializable values
        try {
            JSON.stringify(value);
            return true;
        } catch {
            return false;
        }
    }

    return false;
}

/**
 * Create a debounced version of a function
 *
 * @param fn - Function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function with cancel method
 *
 * @example
 * ```typescript
 * const debouncedSave = debounce(save, 300);
 * debouncedSave(data);  // Waits 300ms before calling save
 * debouncedSave(data);  // Resets the timer
 * debouncedSave.cancel(); // Cancels pending call
 * ```
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delayMs: number
): T & { cancel: () => void } {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const debounced = ((...args: Parameters<T>) => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delayMs);
    }) as T & { cancel: () => void };

    debounced.cancel = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return debounced;
}

/**
 * Create a throttled version of a function
 *
 * @param fn - Function to throttle
 * @param limitMs - Minimum time between calls in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(onScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 * ```
 */
export function throttle<T extends (...args: unknown[]) => void>(fn: T, limitMs: number): T {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return ((...args: Parameters<T>) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= limitMs) {
            lastCall = now;
            fn(...args);
        } else if (timeoutId === null) {
            // Schedule a call for when the limit expires
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn(...args);
            }, limitMs - timeSinceLastCall);
        }
    }) as T;
}

/**
 * Get the current timestamp in milliseconds
 *
 * Uses performance.now() for higher precision if available.
 *
 * @returns Current timestamp in milliseconds
 */
export function getTimestamp(): number {
    return Date.now();
}

/**
 * Check if running in an iframe
 *
 * @returns True if the current window is inside an iframe
 */
export function isInIframe(): boolean {
    try {
        return window.self !== window.top;
    } catch {
        // If we can't access window.top, we're likely in a cross-origin iframe
        return true;
    }
}

/**
 * Get the current window's origin
 *
 * @returns Origin string or empty string if not available
 */
export function getCurrentOrigin(): string {
    try {
        return window.location.origin;
    } catch {
        return '';
    }
}

/**
 * Safe JSON parse with error handling
 *
 * @param json - JSON string to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed value or default
 *
 * @example
 * ```typescript
 * const data = safeJSONParse('{"valid": true}', {});
 * const fallback = safeJSONParse('invalid json', { default: true });
 * ```
 */
export function safeJSONParse<T>(json: string, defaultValue: T): T {
    try {
        return JSON.parse(json) as T;
    } catch {
        return defaultValue;
    }
}

/**
 * Safe JSON stringify with error handling
 *
 * @param value - Value to stringify
 * @param defaultValue - Default value if stringification fails
 * @returns JSON string or default
 */
export function safeJSONStringify(value: unknown, defaultValue: string = ''): string {
    try {
        return JSON.stringify(value);
    } catch {
        return defaultValue;
    }
}

/**
 * Wait for a specified number of milliseconds
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * await delay(1000); // Wait 1 second
 * ```
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after specified time
 *
 * @param ms - Timeout in milliseconds
 * @param message - Error message
 * @returns Promise that rejects after timeout
 */
export function createTimeout(ms: number, message: string = 'Operation timed out'): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
    });
}

/**
 * Race a promise against a timeout
 *
 * @param promise - Promise to race
 * @param timeoutMs - Timeout in milliseconds
 * @param message - Timeout error message
 * @returns Promise result or throws timeout error
 *
 * @example
 * ```typescript
 * try {
 *     const result = await withTimeout(fetchData(), 5000, 'Fetch timed out');
 * } catch (error) {
 *     // Handle timeout or fetch error
 * }
 * ```
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message?: string
): Promise<T> {
    return Promise.race([promise, createTimeout(timeoutMs, message)]);
}

/**
 * Normalize an origin string for comparison
 *
 * Ensures consistent format: protocol + hostname + port (if non-standard)
 *
 * @param origin - Origin to normalize
 * @returns Normalized origin string
 */
export function normalizeOrigin(origin: string): string {
    try {
        const url = new URL(origin);
        return url.origin;
    } catch {
        return origin.toLowerCase().trim();
    }
}
