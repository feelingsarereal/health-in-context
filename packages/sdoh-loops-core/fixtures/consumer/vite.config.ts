/// <reference types="vitest" />
// K13 consumer fixture: built on its own (npm run build:consumer), resolving sdoh-loops-core and the pack only by
// package name, with its own Tailwind config made from the core's preset — as an SDOH Interrogator app would.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath, URL } from 'node:url';
import preset from '@feelingsarereal/sdoh-loops-core/tailwind-preset';
import { sdohCoreAlias, sdohCoreContent } from '@feelingsarereal/sdoh-loops-core/vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  base: '/',
  plugins: [react()],
  resolve: { alias: { ...sdohCoreAlias } },
  css: { postcss: { plugins: [tailwind({ presets: [preset], content: [here('./index.html'), here('./main.tsx'), ...sdohCoreContent] }), autoprefixer()] } },
  build: { outDir: here('./dist'), emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 1600 },
});
