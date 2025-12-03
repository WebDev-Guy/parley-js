/**
 * @file MessageRegistry.ts
 * @description Message type registration and management for Parley framework
 * @module parley-js/core
 *
 * Manages registered message types, their schemas, and handlers.
 */

import { Logger } from '../utils/Logger';
import { ValidationError } from '../errors/ErrorTypes';
import { VALIDATION_ERRORS } from '../errors/ErrorCodes';
import { SchemaValidator } from '../validation/SchemaValidator';
import type {
    MessageHandler,
    MessageRegistrationOptions,
    RegisteredMessageType,
    JsonSchema,
} from '../types/MessageTypes';

/**
 * Message registry for managing message types and handlers
 *
 * Provides:
 * - Message type registration with optional schema
 * - Handler registration and management
 * - Payload validation against registered schemas
 *
 * @example
 * ```typescript
 * const registry = new MessageRegistry();
 *
 * // Register a message type with schema
 * registry.register('user:update', {
 *     schema: {
 *         type: 'object',
 *         required: ['userId'],
 *         properties: {
 *             userId: { type: 'number' },
 *             name: { type: 'string' }
 *         }
 *     }
 * });
 *
 * // Add a handler
 * registry.addHandler('user:update', (payload, respond) => {
 *     // Handle the message
 *     respond({ success: true });
 * });
 * ```
 */
export class MessageRegistry {
    /**
     * Map of message type to registration info
     */
    private _types: Map<string, RegisteredMessageType> = new Map();

    /**
     * Schema validator instance
     */
    private _validator: SchemaValidator;

    /**
     * Logger instance
     */
    private _logger: Logger;

    /**
     * Creates a new MessageRegistry instance
     *
     * @param logger - Optional logger instance
     */
    constructor(logger?: Logger) {
        this._validator = new SchemaValidator();
        this._logger =
            logger?.child('MessageRegistry') ?? new Logger(undefined, '[Parley][MessageRegistry]');
    }

    /**
     * Register a message type
     *
     * @param type - Message type name
     * @param options - Registration options
     * @throws Error if type is already registered
     *
     * @example
     * ```typescript
     * registry.register('document:save', {
     *     schema: {
     *         type: 'object',
     *         required: ['documentId', 'content'],
     *         properties: {
     *             documentId: { type: 'string' },
     *             content: { type: 'string' }
     *         }
     *     },
     *     timeout: 10000
     * });
     * ```
     */
    public register(type: string, options: MessageRegistrationOptions = {}): void {
        if (this._types.has(type)) {
            throw new Error(`Message type "${type}" is already registered`);
        }

        this._validateMessageType(type);

        const registration: RegisteredMessageType = {
            type,
            options,
            handlers: new Set(),
        };

        this._types.set(type, registration);
        this._logger.debug('Message type registered', { type });
    }

    /**
     * Unregister a message type
     *
     * @param type - Message type name to unregister
     */
    public unregister(type: string): void {
        if (this._types.delete(type)) {
            this._logger.debug('Message type unregistered', { type });
        }
    }

    /**
     * Check if a message type is registered
     *
     * @param type - Message type name
     * @returns True if registered
     */
    public has(type: string): boolean {
        return this._types.has(type);
    }

    /**
     * Get registration info for a message type
     *
     * @param type - Message type name
     * @returns Registration info or undefined
     */
    public get(type: string): RegisteredMessageType | undefined {
        return this._types.get(type);
    }

    /**
     * Get registration info, throwing if not found
     *
     * @param type - Message type name
     * @returns Registration info
     * @throws ValidationError if not registered
     */
    public getOrThrow(type: string): RegisteredMessageType {
        const registration = this._types.get(type);
        if (!registration) {
            throw new ValidationError(
                `Message type "${type}" is not registered`,
                { type },
                VALIDATION_ERRORS.UNREGISTERED_TYPE
            );
        }
        return registration;
    }

    /**
     * Register a system message type (internal use only)
     *
     * Bypasses validation for internal message types.
     *
     * @param type - Message type name
     * @param options - Registration options
     * @internal
     */
    public registerInternal(type: string, options: MessageRegistrationOptions = {}): void {
        if (this._types.has(type)) {
            // Already registered, skip
            return;
        }

        const registration: RegisteredMessageType = {
            type,
            options,
            handlers: new Set(),
        };

        this._types.set(type, registration);
        this._logger.debug('Internal message type registered', { type });
    }

    /**
     * Add a handler for a message type
     *
     * If the message type is not registered, it will be auto-registered
     * with default options.
     *
     * @param type - Message type name
     * @param handler - Handler function
     * @param internal - If true, bypasses validation (for system handlers)
     * @returns Unsubscribe function
     */
    public addHandler<T>(type: string, handler: MessageHandler<T>, internal = false): () => void {
        let registration = this._types.get(type);

        // Auto-register if not already registered
        if (!registration) {
            if (internal) {
                this.registerInternal(type);
            } else {
                this.register(type);
            }
            registration = this._types.get(type)!;
        }

        registration.handlers.add(handler as MessageHandler);
        this._logger.debug('Handler added', { type, handlerCount: registration.handlers.size });

        // Return unsubscribe function
        return () => {
            this.removeHandler(type, handler);
        };
    }

    /**
     * Remove a handler for a message type
     *
     * @param type - Message type name
     * @param handler - Handler function to remove
     */
    public removeHandler<T>(type: string, handler: MessageHandler<T>): void {
        const registration = this._types.get(type);
        if (registration) {
            registration.handlers.delete(handler as MessageHandler);
            this._logger.debug('Handler removed', {
                type,
                handlerCount: registration.handlers.size,
            });
        }
    }

    /**
     * Get all handlers for a message type
     *
     * @param type - Message type name
     * @returns Array of handlers (empty if type not registered)
     */
    public getHandlers(type: string): MessageHandler[] {
        const registration = this._types.get(type);
        return registration ? Array.from(registration.handlers) : [];
    }

    /**
     * Validate a payload against the registered schema
     *
     * @param type - Message type name
     * @param payload - Payload to validate
     * @throws ValidationError if validation fails
     */
    public validatePayload(type: string, payload: unknown): void {
        const registration = this._types.get(type);

        if (!registration) {
            // No registration = no validation
            return;
        }

        if (!registration.options.schema) {
            // No schema = no validation
            return;
        }

        const result = this._validator.validate(payload, registration.options.schema);

        if (!result.valid) {
            const errorMessages = result.errors
                .map((e) => `${e.path || 'root'}: ${e.message}`)
                .join('; ');

            throw new ValidationError(
                `Payload validation failed for "${type}": ${errorMessages}`,
                result.errors,
                VALIDATION_ERRORS.SCHEMA_MISMATCH
            );
        }
    }

    /**
     * Get timeout for a message type
     *
     * @param type - Message type name
     * @param defaultTimeout - Default timeout to use if not specified
     * @returns Timeout in milliseconds
     */
    public getTimeout(type: string, defaultTimeout: number): number {
        const registration = this._types.get(type);
        return registration?.options.timeout ?? defaultTimeout;
    }

    /**
     * Get retry count for a message type
     *
     * @param type - Message type name
     * @param defaultRetries - Default retry count to use if not specified
     * @returns Retry count
     */
    public getRetries(type: string, defaultRetries: number): number {
        const registration = this._types.get(type);
        return registration?.options.retries ?? defaultRetries;
    }

    /**
     * Get schema for a message type
     *
     * @param type - Message type name
     * @returns Schema or undefined
     */
    public getSchema(type: string): JsonSchema | undefined {
        const registration = this._types.get(type);
        return registration?.options.schema;
    }

    /**
     * Get all registered message type names
     *
     * @returns Array of type names
     */
    public getTypeNames(): string[] {
        return Array.from(this._types.keys());
    }

    /**
     * Get count of registered types
     *
     * @returns Number of registered types
     */
    public get count(): number {
        return this._types.size;
    }

    /**
     * Clear all registrations
     */
    public clear(): void {
        this._types.clear();
        this._logger.debug('All registrations cleared');
    }

    /**
     * Validate a message type name
     *
     * @param type - Type name to validate
     * @throws Error if type name is invalid
     */
    private _validateMessageType(type: string): void {
        if (!type || typeof type !== 'string') {
            throw new Error('Message type must be a non-empty string');
        }

        // Disallow internal message type prefix
        if (type.startsWith('__parley_')) {
            throw new Error(
                'Message type cannot start with "__parley_" (reserved for internal use)'
            );
        }

        // Disallow system event prefix (reserved)
        if (type.startsWith('system:')) {
            throw new Error(
                'Message type cannot start with "system:" (reserved for system events)'
            );
        }
    }
}
