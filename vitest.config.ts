import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        // Environment: happy-dom is lightweight for postMessage testing
        environment: 'happy-dom',

        // Timeouts
        testTimeout: 10000,
        hookTimeout: 10000,

        // Test file patterns (E2E specs in tests/e2e run via Playwright, not vitest)
        include: ['tests/**/*.test.ts'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/e2e'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'tests/',
                'dist/',
                '**/*.d.ts',
                '**/*.config.ts',
                '**/index.ts',
                // WindowChannel needs a real browser (window.open); it is covered
                // by the Playwright E2E suite in tests/e2e instead
                '**/WindowChannel.ts',
            ],
            // Thresholds track current actuals (ratchet upward as coverage improves).
            // Ratcheted 2026-11 (#33) to actuals under vitest 4.1.12 (#37):
            // lines 66.69 / functions 67.3 / branches 62.82 / statements 66.66.
            thresholds: {
                lines: 66,
                functions: 67,
                branches: 62,
                statements: 66,
            },
        },

        // Global test API (describe, it, expect, beforeEach, etc.)
        globals: true,

        // Reporter style
        reporters: ['verbose'],
    },
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, './src'),
        },
    },
});
