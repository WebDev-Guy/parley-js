/**
 * @file mangle-props.ts
 * @description Property-mangling rules for the production bundle
 *
 * The bundle minifier (esbuild via tsup) renames `_`-prefixed properties,
 * e.g. `this._pendingRequests` -> `this.a`, which removes ~10% of the
 * bundle. Mangling is name-based and global, so any `_` name that must keep
 * its exact spelling outside this bundle is reserved here:
 *
 * - Wire protocol fields: read by other Parley builds/versions over
 *   postMessage (MessageProtocol / ResponseProtocol)
 * - `protected` members of exported classes: user subclasses (e.g. of
 *   BaseChannel) override or call them by name
 *
 * tests/unit/mangle-props.test.ts fails if a new wire field or protected
 * member is added without being listed here.
 */

/** Properties eligible for mangling */
export const MANGLE_PROPS = /^_/;

/** Wire protocol fields (MessageProtocol / ResponseProtocol) */
export const RESERVED_WIRE_FIELDS = [
    '_parley',
    '_v',
    '_id',
    '_type',
    '_timestamp',
    '_origin',
    '_target',
    '_expectsResponse',
    '_requestId',
] as const;

/** `protected` members of exported classes (subclass API) */
export const RESERVED_PROTECTED_MEMBERS = [
    '_boundMessageHandler',
    '_configuredTargetOrigin',
    '_emitter',
    '_getTargetWindow',
    '_handleMessageEvent',
    '_handshakeRetryInterval',
    '_isAllowedOrigin',
    '_isExpectedSource',
    '_isParleyMessage',
    '_logger',
    '_messageHandler',
    '_options',
    '_repeatUntilSettled',
    '_setState',
    '_setupMessageListener',
    '_state',
    '_teardownMessageListener',
] as const;

/** Properties that must never be mangled */
export const RESERVED_PROPS = new RegExp(
    `^(${[...RESERVED_WIRE_FIELDS, ...RESERVED_PROTECTED_MEMBERS].join('|')})$`
);
