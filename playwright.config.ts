import { defineConfig } from '@playwright/test';

/**
 * E2E configuration.
 *
 * Two static servers serve the same repository root on different hosts:
 * - http://127.0.0.1:4173 (parent origin)
 * - http://localhost:4174 (child origin)
 *
 * Different host strings are different origins to the browser, which lets
 * the suite exercise real cross-origin postMessage without TLS.
 *
 * The fixtures load the built IIFE bundle, so `npm run build` must run
 * before the suite (the e2e script handles this).
 */
export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
    webServer: [
        {
            command: 'node tests/e2e/server.mjs 4173',
            url: 'http://127.0.0.1:4173/package.json',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'node tests/e2e/server.mjs 4174',
            url: 'http://localhost:4174/package.json',
            reuseExistingServer: !process.env.CI,
        },
    ],
});
