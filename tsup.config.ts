/**
 * @file tsup.config.ts
 * @description Build configuration for Parley using tsup
 * @module parley-js
 */

import { defineConfig } from 'tsup';
import pkg from './package.json';

// Shared configuration
const sharedConfig = {
    entry: ['src/index.ts'],
    dts: false,
    splitting: false,
    clean: false,
    target: 'es2020' as const,
    outDir: 'dist',
    define: {
        __DEV__: 'false',
        __VERSION__: `"${pkg.version}"`,
    },
    banner: {
        js: `/*! Parley v${pkg.version} | MIT License */`,
    },
};

export default defineConfig((options) => {
    const isDev = options.env?.NODE_ENV === 'development';

    return [
        // CJS and ESM builds (no footer)
        {
            ...sharedConfig,
            format: ['cjs', 'esm'] as const,
            dts: true, // Generate types only once
            clean: true, // Clean only on first build
            sourcemap: isDev,
            minify: !isDev,
            define: {
                ...sharedConfig.define,
                __DEV__: isDev ? 'true' : 'false',
            },
        },
        // IIFE build (with footer for browser global)
        {
            ...sharedConfig,
            format: ['iife'] as const,
            globalName: 'ParleyLib',
            sourcemap: isDev,
            minify: !isDev,
            define: {
                ...sharedConfig.define,
                __DEV__: isDev ? 'true' : 'false',
            },
            footer: {
                // Expose Parley class directly on window for convenient browser usage
                js: 'if(typeof window!=="undefined"){window.Parley=ParleyLib.Parley;Object.assign(window.Parley,ParleyLib);}',
            },
        },
    ];
});
