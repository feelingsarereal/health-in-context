/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { sdohCoreAlias } from './packages/sdoh-loops-core/vite.js';

/** SPA deep links: dist/404.html is a copy of index.html (DESIGN-SYSTEM §1). Harmless under delivery: local. */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(fileURLToPath(new URL('./dist', import.meta.url)));
      const index = path.join(dist, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), spaFallback()],
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
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
