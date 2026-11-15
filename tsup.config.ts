/**
 * @file tsup.config.ts
 * @description Build configuration for Parley using tsup
 * @module parley-js
 */

import { defineConfig, type Options } from 'tsup';
import pkg from './package.json';
import { MANGLE_PROPS, RESERVED_PROPS } from './build/mangle-props';

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

    // Production: shorten internal '_' property names (~10% smaller bundle).
    // Wire-protocol fields and protected subclass API are reserved - see
    // build/mangle-props.ts. Dev builds keep real names for debugging.
    const esbuildOptions: Options['esbuildOptions'] = isDev
        ? undefined
        : (esbuild) => {
              esbuild.mangleProps = MANGLE_PROPS;
              esbuild.reserveProps = RESERVED_PROPS;
          };

    return [
        // CJS and ESM builds (no footer)
        {
            ...sharedConfig,
            format: ['cjs', 'esm'] as const,
            dts: true, // Generate types only once
            clean: true, // Clean only on first build
            sourcemap: isDev,
            minify: !isDev,
            esbuildOptions,
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
            esbuildOptions,
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
