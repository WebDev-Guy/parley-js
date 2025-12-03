/**
 * @file tsup.config.ts
 * @description Build configuration for Parley using tsup
 * @module parley-js
 */

import { defineConfig } from 'tsup';
import pkg from './package.json';

export default defineConfig((options) => {
    const isDev = options.env?.NODE_ENV === 'development';

    return {
        entry: ['src/index.ts'],
        format: ['cjs', 'esm', 'iife'],
        dts: true,
        splitting: false,
        sourcemap: isDev,
        clean: true,
        minify: !isDev,
        target: 'es2020',
        outDir: 'dist',
        globalName: 'ParleyLib',
        define: {
            __DEV__: isDev ? 'true' : 'false',
            __VERSION__: `"${pkg.version}"`,
        },
        banner: {
            js: `/*! Parley v${pkg.version} | MIT License */`,
        },
        footer: {
            // Expose Parley class directly on window for convenient browser usage
            js: 'if(typeof window!=="undefined"){window.Parley=ParleyLib.Parley;Object.assign(window.Parley,ParleyLib);}',
        },
    };
});
