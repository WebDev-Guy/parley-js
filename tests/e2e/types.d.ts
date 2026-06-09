/**
 * Window helpers exposed by the E2E fixture pages
 * (tests/e2e/fixtures/*.html) for use via page.evaluate().
 */

interface FixtureSetupOptions {
    allowedOrigin?: string;
    timeout?: number;
    heartbeat?: Record<string, unknown>;
    childPath?: string;
}

interface FixtureDisconnectEvent {
    event: 'connection_lost' | 'disconnected';
    targetId: string;
}

declare global {
    interface Window {
        // parent.html
        setupParley: (childOrigin: string, opts?: FixtureSetupOptions) => Promise<string>;
        sendEcho: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
        disconnectChild: () => Promise<void>;
        reconnectChild: (childOrigin: string) => Promise<Record<string, unknown>>;
        childFrame: HTMLIFrameElement | null;

        // main.html
        openPopupAndConnect: (popupOrigin: string) => Promise<string>;
        sendEchoToPopup: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
        closePopup: () => Promise<FixtureDisconnectEvent>;
        connectionLost: Promise<FixtureDisconnectEvent>;
        popupRef: Window | null;

        // child-wrong-origin.html
        receivedAnything: boolean;
    }
}

export {};
