import { test, expect } from '@playwright/test';

const OPENER_ORIGIN = 'http://127.0.0.1:4173';
const POPUP_ORIGIN = 'http://localhost:4174';
const OPENER_PAGE = `${OPENER_ORIGIN}/tests/e2e/fixtures/main.html`;

test.describe('cross-origin window.open communication', () => {
    test('connects to a popup, exchanges messages, and detects popup close', async ({ page }) => {
        await page.goto(OPENER_PAGE);

        const popupPromise = page.waitForEvent('popup');
        const connectResult = await page.evaluate(
            (popupOrigin) => window.openPopupAndConnect(popupOrigin),
            POPUP_ORIGIN
        );
        expect(connectResult).toBe('connected');

        const popup = await popupPromise;
        expect(popup.url()).toContain('popup.html');

        const response = await page.evaluate(() => window.sendEchoToPopup({ ping: 'pong' }));
        expect(response).toEqual({
            echoed: true,
            popupOrigin: POPUP_ORIGIN,
            ping: 'pong',
        });

        // Closing the popup must surface as a lost/disconnected connection
        const lost = await page.evaluate(() => window.closePopup());
        expect(['connection_lost', 'disconnected']).toContain(lost.event);
        expect(lost.targetId).toBe('popup');
    });
});
