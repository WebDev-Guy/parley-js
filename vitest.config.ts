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
            // Thresholds for unit tests - integration tests would cover remaining code
            thresholds: {
                lines: 55,
                functions: 55,
                branches: 50,
                statements: 55,
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
