import { test, expect } from '@playwright/test';

const PARENT_ORIGIN = 'http://127.0.0.1:4173';
const CHILD_ORIGIN = 'http://localhost:4174';
const PARENT_PAGE = `${PARENT_ORIGIN}/tests/e2e/fixtures/parent.html`;

test.describe('cross-origin iframe communication', () => {
    test('completes handshake and round-trips a request/response', async ({ page }) => {
        await page.goto(PARENT_PAGE);

        const connectResult = await page.evaluate(
            (childOrigin) => window.setupParley(childOrigin),
            CHILD_ORIGIN
        );
        expect(connectResult).toBe('connected');

        const response = await page.evaluate(() => window.sendEcho({ value: 42, text: 'hello' }));
        expect(response).toEqual({
            echoed: true,
            childOrigin: CHILD_ORIGIN,
            value: 42,
            text: 'hello',
        });
    });

    test('rejects with HANDSHAKE_FAILED when the child never initializes Parley', async ({
        page,
    }) => {
        await page.goto(PARENT_PAGE);

        const failure = await page.evaluate(
            (childOrigin) =>
                window
                    .setupParley(childOrigin, {
                        childPath: '/tests/e2e/fixtures/child-noinit.html',
                        timeout: 2000,
                    })
                    .then(
                        () => ({ connected: true }),
                        (error) => ({
                            connected: false,
                            name: error.name,
                            code: error.code,
                            message: error.message,
                        })
                    ),
            CHILD_ORIGIN
        );

        expect(failure.connected).toBe(false);
        expect(failure.code).toBe('ERR_CONNECTION_HANDSHAKE_FAILED');
    });

    test('blocks the handshake when the child does not trust the parent origin', async ({
        page,
    }) => {
        await page.goto(PARENT_PAGE);

        const failure = await page.evaluate(
            (childOrigin) =>
                window
                    .setupParley(childOrigin, {
                        childPath: '/tests/e2e/fixtures/child-wrong-origin.html',
                        timeout: 2000,
                    })
                    .then(
                        () => ({ connected: true }),
                        (error) => ({ connected: false, code: error.code })
                    ),
            CHILD_ORIGIN
        );

        expect(failure.connected).toBe(false);
        expect(failure.code).toBe('ERR_CONNECTION_HANDSHAKE_FAILED');

        // Now prove the block is receive-side origin validation, not a
        // transport failure: post a forged Parley handshake straight into
        // the child frame from the untrusted parent origin
        const childFrame = page.frames().find((f) => f.url().includes('child-wrong-origin'));
        expect(childFrame).toBeDefined();

        await page.evaluate(() => window.injectForgedHandshake());
        await expect
            .poll(() => childFrame!.evaluate(() => window.rawMessageCount))
            .toBeGreaterThan(0);

        // The forged message arrived at the window but Parley dropped it
        const parleyConnected = await childFrame!.evaluate(() => window.parleyConnected);
        expect(parleyConnected).toBe(false);
    });

    test('reconnects to a fresh iframe after disconnecting', async ({ page }) => {
        await page.goto(PARENT_PAGE);

        await page.evaluate((childOrigin) => window.setupParley(childOrigin), CHILD_ORIGIN);
        await page.evaluate(() => window.disconnectChild());

        const response = await page.evaluate(
            (childOrigin) => window.reconnectChild(childOrigin),
            CHILD_ORIGIN
        );
        expect(response).toMatchObject({ echoed: true, round: 2 });
    });
});
