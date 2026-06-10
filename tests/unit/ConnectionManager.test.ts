/**
 * @file ConnectionManager.test.ts
 * @description Unit tests for ConnectionManager class
 * @module tests/unit
 *
 * Tests disconnect notification handling:
 * - Disconnecting exactly the target that sent the notification
 * - Leaving unrelated connected targets intact
 * - Ignoring notifications from unknown targets
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../../src/core/ConnectionManager';
import { MessageRegistry } from '../../src/core/MessageRegistry';
import { TargetManager } from '../../src/core/TargetManager';
import { EventEmitter } from '../../src/events/EventEmitter';
import { SYSTEM_EVENTS } from '../../src/events/SystemEvents';
import { SYSTEM_MESSAGE_TYPES } from '../../src/types/MessageTypes';
import type { MessageMetadata } from '../../src/types/MessageTypes';
import type { ResolvedConfig } from '../../src/types/ConfigTypes';
import { createMockLogger, createMockWindow } from '../utils/mock-factory';

describe('ConnectionManager', () => {
    let registry: MessageRegistry;
    let targets: TargetManager;
    let emitter: EventEmitter;
    let rejectPendingForTarget: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        const logger = createMockLogger();
        registry = new MessageRegistry(logger as any);
        targets = new TargetManager(logger as any);
        emitter = new EventEmitter();
        rejectPendingForTarget = vi.fn();

        new ConnectionManager({
            config: { instanceId: 'local-instance' } as ResolvedConfig,
            logger: logger as any,
            emitter,
            registry,
            targets,
            getHeartbeatManager: () => null,
            onIncomingMessage: () => {},
            sendSystemMessage: () => Promise.resolve(undefined),
            rejectPendingForTarget,
        });
    });

    describe('disconnect notification handling', () => {
        function connectTarget(id: string): void {
            targets.register(createMockWindow(id) as unknown as Window, {
                id,
                origin: `https://${id}.example.com`,
            });
            targets.markConnected(id);
        }

        function sendDisconnectFrom(senderTargetId: string): void {
            const handlers = registry.getHandlers(SYSTEM_MESSAGE_TYPES.DISCONNECT);
            expect(handlers).toHaveLength(1);

            const metadata: MessageMetadata = {
                messageId: 'msg-1',
                senderId: senderTargetId,
                origin: `https://${senderTargetId}.example.com`,
                timestamp: Date.now(),
                expectsResponse: true,
            };

            void handlers[0]!(
                {
                    senderId: 'remote-instance',
                    reason: 'manual_disconnect',
                    timestamp: Date.now(),
                },
                () => {},
                metadata
            );
        }

        it('should disconnect the target that sent the notification', () => {
            connectTarget('peer-a');

            sendDisconnectFrom('peer-a');

            expect(targets.has('peer-a')).toBe(false);
            expect(rejectPendingForTarget).toHaveBeenCalledWith('peer-a', 'Target disconnected');
        });

        it('should not disconnect unrelated targets when one peer disconnects', () => {
            connectTarget('peer-a');
            connectTarget('peer-b');

            sendDisconnectFrom('peer-b');

            expect(targets.has('peer-b')).toBe(false);
            expect(targets.has('peer-a')).toBe(true);
            expect(targets.get('peer-a')?.connected).toBe(true);
            expect(rejectPendingForTarget).not.toHaveBeenCalledWith('peer-a', expect.anything());
        });

        it('should emit disconnected event for the sender only', () => {
            connectTarget('peer-a');
            connectTarget('peer-b');

            const disconnectedIds: string[] = [];
            emitter.on(SYSTEM_EVENTS.DISCONNECTED, (data: { targetId: string }) => {
                disconnectedIds.push(data.targetId);
            });

            sendDisconnectFrom('peer-a');

            expect(disconnectedIds).toEqual(['peer-a']);
        });

        it('should ignore notifications from unknown targets', () => {
            connectTarget('peer-a');

            sendDisconnectFrom('unknown-peer');

            expect(targets.has('peer-a')).toBe(true);
            expect(targets.get('peer-a')?.connected).toBe(true);
            expect(rejectPendingForTarget).not.toHaveBeenCalled();
        });
    });
});
