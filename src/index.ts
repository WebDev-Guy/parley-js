/**
 * @file index.ts
 * @description Main entry point for Parley framework
 * @module parley-js
 *
 * Parley is a type-safe, robust framework for window, tab, and iframe communication.
 *
 * @example
 * ```typescript
 * import { Parley } from 'parley-js';
 *
 * const parley = Parley.create({
 *     targetType: 'iframe',
 *     allowedOrigins: ['https://example.com']
 * });
 *
 * // Connect to an iframe
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * await parley.connect(iframe);
 *
 * // Send a message
 * const response = await parley.send('getData', { id: 123 });
 * ```
 */

// Main class
export { Parley } from './core/Parley';

// Core exports
export {
    createMessage,
    createResponse,
    isParleyMessage,
    isRequestMessage,
    isResponseMessage,
    PROTOCOL_VERSION,
    type MessageProtocol,
    type ResponseProtocol,
} from './core/MessageProtocol';

export { MessageRegistry } from './core/MessageRegistry';
export { TargetManager } from './core/TargetManager';
export { HeartbeatManager } from './core/HeartbeatManager';
export type { HeartbeatSendFunction, HeartbeatFailureHandler } from './core/HeartbeatManager';

// Communication channels
export { BaseChannel } from './communication/BaseChannel';
export { IframeChannel } from './communication/IframeChannel';
export { WindowChannel } from './communication/WindowChannel';

// Validation
export { SchemaValidator, validateSchema } from './validation/SchemaValidator';
export type { ValidationResult, ValidationErrorDetail } from './validation/ValidationError';
export {
    validResult,
    invalidResult,
    createValidationError,
    formatValidationErrors,
} from './validation/ValidationError';

// Security
export {
    SecurityLayer,
    DefaultSecurityLayer,
    createDefaultSecurityLayer,
} from './security/SecurityLayer';
export {
    validateOrigin,
    assertOrigin,
    hasAllowedOrigins,
    getCurrentWindowOrigin,
    getOriginFromUrl,
    isSameOrigin,
    isSameOriginTarget,
} from './security/OriginValidator';

// Errors
export {
    ParleyError,
    ValidationError,
    TimeoutError,
    TargetNotFoundError,
    SecurityError,
    SerializationError,
    ConnectionError,
    isParleyError,
    isValidationError,
    isTimeoutError,
    isSecurityError,
} from './errors/ErrorTypes';

export {
    ERROR_CODES,
    VALIDATION_ERRORS,
    TIMEOUT_ERRORS,
    TARGET_ERRORS,
    SECURITY_ERRORS,
    SERIALIZATION_ERRORS,
    CONNECTION_ERRORS,
    CONFIG_ERRORS,
    type ErrorCode,
} from './errors/ErrorCodes';

// Events
export { EventEmitter, type EventHandler } from './events/EventEmitter';
export {
    SYSTEM_EVENTS,
    type SystemEventName,
    type SystemEventData,
    type SystemEventHandler,
    type ConnectedEventData,
    type DisconnectedEventData,
    type ConnectionLostEventData,
    type ConnectionStateChangedEventData,
    type HeartbeatMissedEventData,
    type ErrorEventData,
    type TimeoutEventData,
    type MessageSentEventData,
    type MessageReceivedEventData,
    type ResponseSentEventData,
    type ResponseReceivedEventData,
    type HandshakeEventData,
} from './events/SystemEvents';

// Analytics
export {
    AnalyticsManager,
    createConsoleAdapter,
    createBatchingAdapter,
    filterByType,
    filterByMessageType,
} from './analytics/AnalyticsHooks';

export type {
    AnalyticsEvent,
    AnalyticsEventType,
    AnalyticsEventHandler,
    AnalyticsAdapter,
    AnalyticsOptions,
    BaseAnalyticsEvent,
    MessageSentAnalyticsEvent,
    MessageReceivedAnalyticsEvent,
    ResponseSentAnalyticsEvent,
    ResponseReceivedAnalyticsEvent,
    ErrorAnalyticsEvent,
    TimeoutAnalyticsEvent,
} from './analytics/AnalyticsTypes';

// Types
export type {
    MessageMetadata,
    MessageHandler,
    ResponseFunction,
    MessageRegistrationOptions,
    SendOptions,
    JsonSchema,
} from './types/MessageTypes';

export type { ParleyConfig, TargetType, HeartbeatConfig } from './types/ConfigTypes';
export { DEFAULT_HEARTBEAT_CONFIG } from './types/ConfigTypes';

export type { TargetInfo, ChannelState, ChannelOptions } from './types/ChannelTypes';

// Connection types
export { ConnectionState } from './types/ConnectionTypes';
export type { ConnectionStateChange, DisconnectReason } from './types/ConnectionTypes';

// Message system types
export { SYSTEM_MESSAGE_TYPES } from './types/MessageTypes';
export type {
    DisconnectPayload,
    HeartbeatPingPayload,
    HeartbeatPongPayload,
} from './types/MessageTypes';

// Utils
export { Logger, type LogLevel } from './utils/Logger';
export {
    generateUUID,
    deepClone,
    isPlainObject,
    isSerializable,
    debounce,
    throttle,
    delay,
    withTimeout,
    normalizeOrigin,
    getCurrentOrigin,
    isInIframe,
} from './utils/Helpers';
