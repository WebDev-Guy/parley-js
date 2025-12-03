/**
 * @file index.ts
 * @description Type exports for Parley framework
 * @module parley-js/types
 *
 * Re-exports all public types for external consumption.
 */

// Connection types
export { ConnectionState } from './ConnectionTypes';
export type { ConnectionStateChange, DisconnectReason } from './ConnectionTypes';

// Message types
export type {
    MessageMetadata,
    MessageHandler,
    ResponseFunction,
    MessageRegistrationOptions,
    RegisteredMessageType,
    SendOptions,
    PendingRequest,
    JsonSchema,
    DisconnectPayload,
    HeartbeatPingPayload,
    HeartbeatPongPayload,
} from './MessageTypes';
export { SYSTEM_MESSAGE_TYPES } from './MessageTypes';

// Config types
export type {
    TargetType,
    ParleyConfig,
    ResolvedConfig,
    HeartbeatConfig,
    ResolvedHeartbeatConfig,
} from './ConfigTypes';
export { DEFAULT_CONFIG, DEFAULT_HEARTBEAT_CONFIG, validateConfig } from './ConfigTypes';

// Channel types
export type {
    ChannelTargetType,
    TargetInfo,
    RegisterTargetOptions,
    ChannelState,
    ChannelOptions,
    WindowReference,
    IframeContentWindow,
} from './ChannelTypes';
export { DEFAULT_CHANNEL_OPTIONS } from './ChannelTypes';
