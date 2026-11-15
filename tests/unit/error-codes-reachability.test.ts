/**
 * @file error-codes-reachability.test.ts
 * @description ERROR_CODES must expose every code (#44)
 */

import { describe, it, expect } from 'vitest';
import {
    ERROR_CODES,
    VALIDATION_ERRORS,
    TIMEOUT_ERRORS,
    TARGET_ERRORS,
    SECURITY_ERRORS,
    SERIALIZATION_ERRORS,
    CONNECTION_ERRORS,
    CONFIG_ERRORS,
    GENERAL_ERRORS,
} from '../../src/errors/ErrorCodes';

const GROUPS: Record<string, Record<string, string>> = {
    VALIDATION_ERRORS,
    TIMEOUT_ERRORS,
    TARGET_ERRORS,
    SECURITY_ERRORS,
    SERIALIZATION_ERRORS,
    CONNECTION_ERRORS,
    CONFIG_ERRORS,
    GENERAL_ERRORS,
};

/** Key names that exist in more than one group (kept as deprecated aliases) */
const KNOWN_AMBIGUOUS_KEYS = ['NOT_CONNECTED', 'CLOSED'];

describe('ERROR_CODES', () => {
    it('makes every code from every group reachable', () => {
        const reachable = new Set<string>(Object.values(ERROR_CODES));
        const missing = Object.values(GROUPS)
            .flatMap((group) => Object.values(group))
            .filter((code) => !reachable.has(code));

        expect(missing).toEqual([]);
    });

    it('exposes unambiguous names for the colliding keys', () => {
        expect(ERROR_CODES.TARGET_NOT_CONNECTED).toBe('ERR_TARGET_NOT_CONNECTED');
        expect(ERROR_CODES.CONNECTION_NOT_CONNECTED).toBe('ERR_CONNECTION_NOT_CONNECTED');
        expect(ERROR_CODES.TARGET_CLOSED).toBe('ERR_TARGET_CLOSED');
        expect(ERROR_CODES.CONNECTION_CLOSED).toBe('ERR_CONNECTION_CLOSED');
    });

    it('keeps the deprecated ambiguous keys at their existing values', () => {
        // Backward compatibility: existing code comparing against these keeps working
        expect(ERROR_CODES.NOT_CONNECTED).toBe('ERR_CONNECTION_NOT_CONNECTED');
        expect(ERROR_CODES.CLOSED).toBe('ERR_CONNECTION_CLOSED');
    });

    it('fails if a new key collides across groups', () => {
        const owners = new Map<string, string[]>();
        for (const [groupName, group] of Object.entries(GROUPS)) {
            for (const key of Object.keys(group)) {
                owners.set(key, [...(owners.get(key) ?? []), groupName]);
            }
        }
        const collisions = [...owners]
            .filter(([, groups]) => groups.length > 1)
            .map(([key]) => key)
            .sort();

        // A new collision would silently hide a code: give it an unambiguous
        // ERROR_CODES name and add it here deliberately.
        expect(collisions).toEqual([...KNOWN_AMBIGUOUS_KEYS].sort());
    });
});
