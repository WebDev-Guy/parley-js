/**
 * @file HeartbeatManager.test.ts
 * @description Unit tests for HeartbeatManager class
 * @module tests/unit
 *
 * Tests all public methods using fake timers:
 * - start() - Start heartbeat for a target
 * - stop() - Stop heartbeat for a target
 * - stopAll() - Stop all heartbeats
 * - isRunning() - Check if heartbeat is active
 * - activeCount - Get number of active heartbeats
 * - recordSuccess() - Record successful heartbeat
 * - updateConfig() - Update configuration
 * - destroy() - Clean up resources
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeartbeatManager } from '../../src/core/HeartbeatManager';
import type { ResolvedHeartbeatConfig } from '../../src/types/ConfigTypes';
import { createMockLogger } from '../utils/mock-factory';

describe('HeartbeatManager', () => {
    let manager: HeartbeatManager;
    let mockSendHeartbeat: ReturnType<typeof vi.fn>;
    let mockOnFailure: ReturnType<typeof vi.fn>;
    let mockLogger: ReturnType<typeof createMockLogger>;

    const defaultConfig: ResolvedHeartbeatConfig = {
        enabled: true,
        interval: 30000,
        timeout: 5000,
    };

    beforeEach(() => {
        vi.useFakeTimers();
        mockSendHeartbeat = vi.fn().mockResolvedValue(undefined);
        mockOnFailure = vi.fn();
        mockLogger = createMockLogger();

        manager = new HeartbeatManager(
            defaultConfig,
            mockLogger as any,
            'test-instance',
            mockSendHeartbeat,
            mockOnFailure
        );
    });

    afterEach(() => {
        manager.destroy();
        vi.useRealTimers();
    });

    // ========================================================================
    // Constructor / Properties
    // ========================================================================

    describe('constructor / properties', () => {
        it('should create instance with config', () => {
            expect(manager.enabled).toBe(true);
            expect(manager.interval).toBe(30000);
            expect(manager.timeout).toBe(5000);
        });

        it('should respect disabled config', () => {
            const disabledManager = new HeartbeatManager(
                { ...defaultConfig, enabled: false },
                mockLogger as any,
                'test-instance',
                mockSendHeartbeat,
                mockOnFailure
            );

            expect(disabledManager.enabled).toBe(false);
            disabledManager.destroy();
        });

        it('should start with zero active heartbeats', () => {
            expect(manager.activeCount).toBe(0);
        });
    });

    // ========================================================================
    // start()
    // ========================================================================

    describe('start()', () => {
        it('should start heartbeat for a target', () => {
            manager.start('target-1');

            expect(manager.isRunning('target-1')).toBe(true);
            expect(manager.activeCount).toBe(1);
        });

        it('should send initial heartbeat after 1 second', async () => {
            manager.start('target-1');

            expect(mockSendHeartbeat).not.toHaveBeenCalled();

            // Advance past initial delay
            await vi.advanceTimersByTimeAsync(1000);

            expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);
            expect(mockSendHeartbeat).toHaveBeenCalledWith('target-1', expect.objectContaining({
                senderId: 'test-instance',
                timestamp: expect.any(Number),
            }));
        });

        it('should send periodic heartbeats', async () => {
            manager.start('target-1');

            // Initial delay
            await vi.advanceTimersByTimeAsync(1000);
            expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);

            // Simulate successful response to avoid pending state blocking
            manager.recordSuccess('target-1');

            // First interval
            await vi.advanceTimersByTimeAsync(30000);
            expect(mockSendHeartbeat).toHaveBeenCalledTimes(2);

            manager.recordSuccess('target-1');

            // Second interval
            await vi.advanceTimersByTimeAsync(30000);
            expect(mockSendHeartbeat).toHaveBeenCalledTimes(3);
        });

        it('should not start if heartbeat disabled', () => {
            const disabledManager = new HeartbeatManager(
                { ...defaultConfig, enabled: false },
                mockLogger as any,
                'test-instance',
                mockSendHeartbeat,
                mockOnFailure
            );

            disabledManager.start('target-1');

            expect(disabledManager.isRunning('target-1')).toBe(false);
            disabledManager.destroy();
        });

        it('should not start duplicate heartbeat for same target', () => {
            manager.start('target-1');
            manager.start('target-1'); // Should warn and skip

            expect(manager.activeCount).toBe(1);
        });

        it('should allow multiple targets', () => {
            manager.start('target-1');
            manager.start('target-2');
            manager.start('target-3');

            expect(manager.activeCount).toBe(3);
            expect(manager.isRunning('target-1')).toBe(true);
            expect(manager.isRunning('target-2')).toBe(true);
            expect(manager.isRunning('target-3')).toBe(true);
        });
    });

    // ========================================================================
    // stop()
    // ========================================================================

    describe('stop()', () => {
        it('should stop heartbeat for specific target', () => {
            manager.start('target-1');
            manager.start('target-2');

            manager.stop('target-1');

            expect(manager.isRunning('target-1')).toBe(false);
            expect(manager.isRunning('target-2')).toBe(true);
            expect(manager.activeCount).toBe(1);
        });

        it('should do nothing for non-existent target', () => {
            expect(() => manager.stop('nonexistent')).not.toThrow();
        });

        it('should stop periodic heartbeats', async () => {
            manager.start('target-1');
            await vi.advanceTimersByTimeAsync(1000);

            manager.stop('target-1');
            mockSendHeartbeat.mockClear();

            // Advance time - no more heartbeats should be sent
            await vi.advanceTimersByTimeAsync(60000);

            expect(mockSendHeartbeat).not.toHaveBeenCalled();
        });

        it('should clear pending heartbeat state', async () => {
            manager.start('target-1');
            await vi.advanceTimersByTimeAsync(1000);

            // Heartbeat is pending (sent but not responded)
            manager.stop('target-1');

            // Should be fully cleaned up
            expect(manager.isRunning('target-1')).toBe(false);
        });
    });

    // ========================================================================
    // stopAll()
    // ========================================================================

    describe('stopAll()', () => {
        it('should stop all heartbeats', () => {
            manager.start('target-1');
            manager.start('target-2');
            manager.start('target-3');

            manager.stopAll();

            expect(manager.activeCount).toBe(0);
            expect(manager.isRunning('target-1')).toBe(false);
            expect(manager.isRunning('target-2')).toBe(false);
            expect(manager.isRunning('target-3')).toBe(false);
        });

        it('should do nothing when no heartbeats running', () => {
            expect(() => manager.stopAll()).not.toThrow();
            expect(manager.activeCount).toBe(0);
        });
    });

    // ========================================================================
    // isRunning()
    // ========================================================================

    describe('isRunning()', () => {
        it('should return false for unknown target', () => {
            expect(manager.isRunning('unknown')).toBe(false);
        });

        it('should return true for running target', () => {
            manager.start('target-1');
            expect(manager.isRunning('target-1')).toBe(true);
        });

        it('should return false after stop', () => {
            manager.start('target-1');
            manager.stop('target-1');
            expect(manager.isRunning('target-1')).toBe(false);
        });
    });

    // ========================================================================
    // recordSuccess()
    // ========================================================================

    describe('recordSuccess()', () => {
        it('should record successful heartbeat', async () => {
            manager.start('target-1');
            await vi.advanceTimersByTimeAsync(1000);

            // Simulate pong response
            manager.recordSuccess('target-1');

            // Should not call failure handler
            expect(mockOnFailure).not.toHaveBeenCalled();
        });

        it('should allow next heartbeat after success', async () => {
            manager.start('target-1');
            await vi.advanceTimersByTimeAsync(1000);

            // Simulate successful response
            manager.recordSuccess('target-1');

            // Next interval
            await vi.advanceTimersByTimeAsync(30000);

            // Should send another heartbeat
            expect(mockSendHeartbeat).toHaveBeenCalledTimes(2);
        });
    });

    // ========================================================================
    // Failure Detection
    // ========================================================================

    describe('failure detection', () => {
        it('should call failure handler when heartbeat is pending on next tick', async () => {
            manager.start('target-1');
            await vi.advanceTimersByTimeAsync(1000);

            // Don't call recordSuccess - heartbeat is still pending

            // Next interval - should detect pending heartbeat as missed
            await vi.advanceTimersByTimeAsync(30000);

            expect(mockOnFailure).toHaveBeenCalledWith('target-1', 1);
        });

        it('should call failure handler when send fails', async () => {
            mockSendHeartbeat.mockRejectedValueOnce(new Error('Send failed'));

            manager.start('target-1');
            await vi.advanceTimersByTimeAsync(1000);

            expect(mockOnFailure).toHaveBeenCalledWith('target-1', 1);
        });
    });

    // ========================================================================
    // updateConfig()
    // ========================================================================

    describe('updateConfig()', () => {
        it('should update configuration', () => {
            manager.updateConfig({ interval: 60000 });

            expect(manager.interval).toBe(60000);
        });

        it('should not affect running heartbeats', async () => {
            manager.start('target-1');
            await vi.advanceTimersByTimeAsync(1000);
            manager.recordSuccess('target-1'); // Allow next heartbeat

            // Update interval
            manager.updateConfig({ interval: 60000 });

            mockSendHeartbeat.mockClear();

            // Old interval still applies
            await vi.advanceTimersByTimeAsync(30000);
            expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);
        });

        it('should apply to new heartbeats', async () => {
            manager.updateConfig({ interval: 10000 });
            manager.start('target-1');

            await vi.advanceTimersByTimeAsync(1000);
            manager.recordSuccess('target-1'); // Allow next heartbeat
            mockSendHeartbeat.mockClear();

            // New interval should apply
            await vi.advanceTimersByTimeAsync(10000);
            expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);
        });
    });

    // ========================================================================
    // destroy()
    // ========================================================================

    describe('destroy()', () => {
        it('should stop all heartbeats', () => {
            manager.start('target-1');
            manager.start('target-2');

            manager.destroy();

            expect(manager.activeCount).toBe(0);
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
        it('should handle rapid start/stop', () => {
            for (let i = 0; i < 10; i++) {
                manager.start('target-1');
                manager.stop('target-1');
            }

            expect(manager.activeCount).toBe(0);
        });

        it('should handle many concurrent targets', () => {
            for (let i = 0; i < 50; i++) {
                manager.start(`target-${i}`);
            }

            expect(manager.activeCount).toBe(50);

            manager.stopAll();
            expect(manager.activeCount).toBe(0);
        });

        it('should handle stop during initial delay', async () => {
            manager.start('target-1');

            // Stop before initial heartbeat
            await vi.advanceTimersByTimeAsync(500);
            manager.stop('target-1');

            // Advance past initial delay
            await vi.advanceTimersByTimeAsync(1000);

            // Should not have sent any heartbeat
            expect(mockSendHeartbeat).not.toHaveBeenCalled();
        });
    });
});
