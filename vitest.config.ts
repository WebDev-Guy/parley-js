import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        // Environment: happy-dom is lightweight for postMessage testing
        environment: 'happy-dom',

        // Timeouts
        testTimeout: 10000,
        hookTimeout: 10000,

        // Test file patterns
        include: ['tests/**/*.test.ts'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

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
                // Exclude files that require integration tests (actual iframe/window communication)
                '**/WindowChannel.ts',
            ],
            // Thresholds track current actuals (ratchet upward as coverage improves).
            // WindowChannel.ts is excluded above because it needs a real browser;
            // it is exercised by the integration suite instead.
            thresholds: {
                lines: 65,
                functions: 65,
                branches: 60,
                statements: 65,
            },
        },

        // Global test API (describe, it, expect, beforeEach, etc.)
        globals: true,

        // Reporter style
        reporters: ['verbose'],
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
});
