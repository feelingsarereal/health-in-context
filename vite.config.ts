/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { sdohCoreAlias, sdohCrosswalk, xwalkOn } from './packages/sdoh-loops-core/vite.js';

/** SPA deep links: dist/404.html is a copy of index.html (DESIGN-SYSTEM §1). Harmless under delivery: local. */
function spaFallback(): Plugin {
  let dist = '';
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(c) {
      dist = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const index = path.join(dist, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dist, '404.html'));
    },
  };
}

/**
 * SL32: VITE_SDOH_XWALK — the ICD-10-CM crosswalk, on for local builds (the default) and off for the public Pages build
 * (`npm run build:pages`), where nothing in dist-pages/ may pair an ICD-11 code with an ICD-10-CM one.
 */
const CROSSWALK = xwalkOn(process.env.VITE_SDOH_XWALK);

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [sdohCrosswalk({ crosswalk: CROSSWALK }), react(), spaFallback()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), ...sdohCoreAlias } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
