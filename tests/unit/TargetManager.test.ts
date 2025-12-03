/**
 * @file TargetManager.test.ts
 * @description Unit tests for TargetManager class
 * @module tests/unit
 *
 * Tests all public methods:
 * - register() / unregister() - Target registration
 * - get() / getOrThrow() - Target retrieval
 * - getAll() / getConnected() / getByType() - Bulk retrieval
 * - has() / isAlive() - Target checks
 * - markConnected() / markDisconnected() - Connection state
 * - updateState() - State transitions
 * - recordHeartbeat() / recordMissedHeartbeat() - Heartbeat tracking
 * - recordSendSuccess() / recordSendFailure() - Send tracking
 * - updateActivity() - Activity tracking
 * - count / clear() / destroy() - Management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TargetManager } from '../../src/core/TargetManager';
import { ConnectionState } from '../../src/types/ConnectionTypes';
import { TargetNotFoundError } from '../../src/errors/ErrorTypes';
import { createMockWindow, createMockIframe, createMockLogger } from '../utils/mock-factory';

describe('TargetManager', () => {
    let manager: TargetManager;
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
        manager = new TargetManager(mockLogger as any);
    });

    afterEach(() => {
        manager.destroy();
    });

    // ========================================================================
    // register()
    // ========================================================================

    describe('register()', () => {
        it('should register a window target', () => {
            const mockWindow = createMockWindow('child');
            const id = manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            expect(id).toBe('child-window');
            expect(manager.has('child-window')).toBe(true);
        });

        it('should register an iframe target', () => {
            const mockIframe = createMockIframe('my-iframe');
            const id = manager.register(mockIframe, { id: 'my-iframe' });

            expect(id).toBe('my-iframe');
            expect(manager.has('my-iframe')).toBe(true);
        });

        it('should auto-generate ID if not provided', () => {
            const mockWindow = createMockWindow('child');
            const id = manager.register(mockWindow as unknown as Window);

            expect(id).toBeDefined();
            expect(typeof id).toBe('string');
            expect(manager.has(id)).toBe(true);
        });

        it('should throw for duplicate ID', () => {
            const mockWindow1 = createMockWindow('child1');
            const mockWindow2 = createMockWindow('child2');

            manager.register(mockWindow1 as unknown as Window, { id: 'same-id' });

            expect(() =>
                manager.register(mockWindow2 as unknown as Window, { id: 'same-id' })
            ).toThrow();
        });

        it('should register with custom origin', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, {
                id: 'child-window',
                origin: 'https://custom.example.com',
            });

            const info = manager.get('child-window');
            expect(info?.origin).toBe('https://custom.example.com');
        });

        it('should set initial state to DISCONNECTED', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            const info = manager.get('child-window');
            expect(info?.state).toBe(ConnectionState.DISCONNECTED);
            expect(info?.connected).toBe(false);
        });

        it('should record registration timestamp', () => {
            const before = Date.now();
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });
            const after = Date.now();

            const info = manager.get('child-window');
            expect(info?.lastActivity).toBeGreaterThanOrEqual(before);
            expect(info?.lastActivity).toBeLessThanOrEqual(after);
        });
    });

    // ========================================================================
    // unregister()
    // ========================================================================

    describe('unregister()', () => {
        it('should unregister a target', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            manager.unregister('child-window');

            expect(manager.has('child-window')).toBe(false);
        });

        it('should do nothing for non-existent target', () => {
            expect(() => manager.unregister('nonexistent')).not.toThrow();
        });

        it('should decrease target count', () => {
            const mockWindow1 = createMockWindow('child1');
            const mockWindow2 = createMockWindow('child2');

            manager.register(mockWindow1 as unknown as Window, { id: 'child-1' });
            manager.register(mockWindow2 as unknown as Window, { id: 'child-2' });
            expect(manager.count).toBe(2);

            manager.unregister('child-1');
            expect(manager.count).toBe(1);
        });
    });

    // ========================================================================
    // get() / getOrThrow()
    // ========================================================================

    describe('get()', () => {
        it('should return target info', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            const info = manager.get('child-window');

            expect(info).toBeDefined();
            expect(info?.id).toBe('child-window');
            expect(info?.type).toBe('window');
        });

        it('should return undefined for non-existent target', () => {
            expect(manager.get('nonexistent')).toBeUndefined();
        });
    });

    describe('getOrThrow()', () => {
        it('should return target info', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            const info = manager.getOrThrow('child-window');

            expect(info.id).toBe('child-window');
        });

        it('should throw TargetNotFoundError for non-existent target', () => {
            expect(() => manager.getOrThrow('nonexistent')).toThrow(TargetNotFoundError);
        });

        it('should include target ID in error message', () => {
            try {
                manager.getOrThrow('my-target');
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('my-target');
            }
        });
    });

    // ========================================================================
    // getAll() / getConnected() / getByType()
    // ========================================================================

    describe('getAll()', () => {
        it('should return empty array when no targets', () => {
            expect(manager.getAll()).toEqual([]);
        });

        it('should return all registered targets', () => {
            const mockWindow1 = createMockWindow('child1');
            const mockWindow2 = createMockWindow('child2');
            const mockIframe = createMockIframe('iframe');

            manager.register(mockWindow1 as unknown as Window, { id: 'child-1' });
            manager.register(mockWindow2 as unknown as Window, { id: 'child-2' });
            manager.register(mockIframe, { id: 'iframe' });

            const all = manager.getAll();
            expect(all).toHaveLength(3);
        });
    });

    describe('getConnected()', () => {
        it('should return empty array when no connected targets', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            expect(manager.getConnected()).toEqual([]);
        });

        it('should return only connected targets', () => {
            const mockWindow1 = createMockWindow('child1');
            const mockWindow2 = createMockWindow('child2');
            const mockWindow3 = createMockWindow('child3');

            manager.register(mockWindow1 as unknown as Window, { id: 'child-1' });
            manager.register(mockWindow2 as unknown as Window, { id: 'child-2' });
            manager.register(mockWindow3 as unknown as Window, { id: 'child-3' });

            manager.markConnected('child-1');
            manager.markConnected('child-3');

            const connected = manager.getConnected();
            expect(connected).toHaveLength(2);
            expect(connected.map((t) => t.id)).toContain('child-1');
            expect(connected.map((t) => t.id)).toContain('child-3');
        });
    });

    describe('getByType()', () => {
        it('should return targets of specified type', () => {
            manager.clear(); // Ensure clean state
            const mockWindow = createMockWindow('child');

            // Create real DOM iframe for instanceof check to work
            const realIframe = document.createElement('iframe');
            realIframe.id = 'my-iframe';
            document.body.appendChild(realIframe);

            manager.register(mockWindow as unknown as Window, { id: 'child-window' });
            manager.register(realIframe, { id: 'my-iframe' });

            const windows = manager.getByType('window');
            expect(windows).toHaveLength(1);
            expect(windows[0].id).toBe('child-window');

            const iframes = manager.getByType('iframe');
            expect(iframes).toHaveLength(1);
            expect(iframes[0].id).toBe('my-iframe');

            // Cleanup
            document.body.removeChild(realIframe);
        });
    });

    // ========================================================================
    // has() / isAlive()
    // ========================================================================

    describe('has()', () => {
        it('should return true for registered target', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            expect(manager.has('child-window')).toBe(true);
        });

        it('should return false for non-existent target', () => {
            expect(manager.has('nonexistent')).toBe(false);
        });
    });

    describe('isAlive()', () => {
        it('should return false for non-existent target', () => {
            expect(manager.isAlive('nonexistent')).toBe(false);
        });

        it('should return true for registered window', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            expect(manager.isAlive('child-window')).toBe(true);
        });

        it('should return false for closed window', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            mockWindow._close();

            expect(manager.isAlive('child-window')).toBe(false);
        });
    });

    // ========================================================================
    // markConnected() / markDisconnected()
    // ========================================================================

    describe('markConnected()', () => {
        it('should mark target as connected', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            manager.markConnected('child-window');

            const info = manager.get('child-window');
            expect(info?.connected).toBe(true);
            expect(info?.state).toBe(ConnectionState.CONNECTED);
        });

        it('should set connectedAt timestamp', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            const before = Date.now();
            manager.markConnected('child-window');
            const after = Date.now();

            const info = manager.get('child-window');
            expect(info?.connectedAt).toBeGreaterThanOrEqual(before);
            expect(info?.connectedAt).toBeLessThanOrEqual(after);
        });

        it('should reset failure counters', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            // Simulate some failures
            manager.recordMissedHeartbeat('child-window');
            manager.recordSendFailure('child-window');

            manager.markConnected('child-window');

            const info = manager.get('child-window');
            expect(info?.missedHeartbeats).toBe(0);
            expect(info?.consecutiveFailures).toBe(0);
        });

        it('should do nothing for non-existent target', () => {
            expect(() => manager.markConnected('nonexistent')).not.toThrow();
        });
    });

    describe('markDisconnected()', () => {
        it('should mark target as disconnected', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });
            manager.markConnected('child-window');

            manager.markDisconnected('child-window');

            const info = manager.get('child-window');
            expect(info?.connected).toBe(false);
            expect(info?.state).toBe(ConnectionState.DISCONNECTED);
        });

        it('should do nothing for non-existent target', () => {
            expect(() => manager.markDisconnected('nonexistent')).not.toThrow();
        });
    });

    // ========================================================================
    // updateState()
    // ========================================================================

    describe('updateState()', () => {
        it('should update state and return previous state', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            const previous = manager.updateState('child-window', ConnectionState.CONNECTING);

            expect(previous).toBe(ConnectionState.DISCONNECTED);
            expect(manager.get('child-window')?.state).toBe(ConnectionState.CONNECTING);
        });

        it('should update connected flag based on state', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            manager.updateState('child-window', ConnectionState.CONNECTED);
            expect(manager.get('child-window')?.connected).toBe(true);

            manager.updateState('child-window', ConnectionState.DISCONNECTING);
            expect(manager.get('child-window')?.connected).toBe(false);
        });

        it('should return undefined for non-existent target', () => {
            expect(manager.updateState('nonexistent', ConnectionState.CONNECTED)).toBeUndefined();
        });
    });

    // ========================================================================
    // Heartbeat Tracking
    // ========================================================================

    describe('recordHeartbeat()', () => {
        it('should record heartbeat and reset missed count', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            // Simulate some missed heartbeats
            manager.recordMissedHeartbeat('child-window');
            manager.recordMissedHeartbeat('child-window');

            manager.recordHeartbeat('child-window');

            const info = manager.get('child-window');
            expect(info?.missedHeartbeats).toBe(0);
            expect(info?.lastHeartbeat).toBeDefined();
        });

        it('should do nothing for non-existent target', () => {
            expect(() => manager.recordHeartbeat('nonexistent')).not.toThrow();
        });
    });

    describe('recordMissedHeartbeat()', () => {
        it('should increment missed heartbeat count', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            expect(manager.recordMissedHeartbeat('child-window')).toBe(1);
            expect(manager.recordMissedHeartbeat('child-window')).toBe(2);
            expect(manager.recordMissedHeartbeat('child-window')).toBe(3);

            const info = manager.get('child-window');
            expect(info?.missedHeartbeats).toBe(3);
        });

        it('should return 0 for non-existent target', () => {
            expect(manager.recordMissedHeartbeat('nonexistent')).toBe(0);
        });
    });

    // ========================================================================
    // Send Tracking
    // ========================================================================

    describe('recordSendSuccess()', () => {
        it('should reset failure counter', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            manager.recordSendFailure('child-window');
            manager.recordSendFailure('child-window');

            manager.recordSendSuccess('child-window');

            const info = manager.get('child-window');
            expect(info?.consecutiveFailures).toBe(0);
        });

        it('should update activity timestamp', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            const before = Date.now();
            manager.recordSendSuccess('child-window');
            const after = Date.now();

            const info = manager.get('child-window');
            expect(info?.lastActivity).toBeGreaterThanOrEqual(before);
            expect(info?.lastActivity).toBeLessThanOrEqual(after);
        });
    });

    describe('recordSendFailure()', () => {
        it('should increment failure counter', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            expect(manager.recordSendFailure('child-window')).toBe(1);
            expect(manager.recordSendFailure('child-window')).toBe(2);
        });

        it('should return 0 for non-existent target', () => {
            expect(manager.recordSendFailure('nonexistent')).toBe(0);
        });
    });

    // ========================================================================
    // updateActivity()
    // ========================================================================

    describe('updateActivity()', () => {
        it('should update activity timestamp', async () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            const initialActivity = manager.get('child-window')?.lastActivity;

            // Small delay to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10));

            manager.updateActivity('child-window');

            const newActivity = manager.get('child-window')?.lastActivity;
            expect(newActivity).toBeGreaterThanOrEqual(initialActivity!);
        });

        it('should do nothing for non-existent target', () => {
            expect(() => manager.updateActivity('nonexistent')).not.toThrow();
        });
    });

    // ========================================================================
    // count / clear() / destroy()
    // ========================================================================

    describe('count', () => {
        it('should return 0 when no targets', () => {
            expect(manager.count).toBe(0);
        });

        it('should return correct count', () => {
            const mockWindow1 = createMockWindow('child1');
            const mockWindow2 = createMockWindow('child2');

            manager.register(mockWindow1 as unknown as Window, { id: 'child-1' });
            expect(manager.count).toBe(1);

            manager.register(mockWindow2 as unknown as Window, { id: 'child-2' });
            expect(manager.count).toBe(2);
        });
    });

    describe('clear()', () => {
        it('should remove all targets', () => {
            const mockWindow1 = createMockWindow('child1');
            const mockWindow2 = createMockWindow('child2');

            manager.register(mockWindow1 as unknown as Window, { id: 'child-1' });
            manager.register(mockWindow2 as unknown as Window, { id: 'child-2' });

            manager.clear();

            expect(manager.count).toBe(0);
            expect(manager.getAll()).toEqual([]);
        });
    });

    describe('destroy()', () => {
        it('should clear all targets', () => {
            const mockWindow = createMockWindow('child');
            manager.register(mockWindow as unknown as Window, { id: 'child-window' });

            manager.destroy();

            expect(manager.count).toBe(0);
        });

        it('should be idempotent', () => {
            manager.destroy();
            expect(() => manager.destroy()).not.toThrow();
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle special characters in ID', () => {
            const mockWindow = createMockWindow('child');
            const id = manager.register(mockWindow as unknown as Window, {
                id: 'child:window-1.test',
            });

            expect(manager.has('child:window-1.test')).toBe(true);
        });

        it('should handle many targets', () => {
            for (let i = 0; i < 100; i++) {
                const mockWindow = createMockWindow(`child-${i}`);
                manager.register(mockWindow as unknown as Window, { id: `target-${i}` });
            }

            expect(manager.count).toBe(100);

            manager.clear();
            expect(manager.count).toBe(0);
        });
    });
});
