/** @type {import('tailwindcss').Config} */
// MI DESIGN-SYSTEM §2 tokens come from sdoh-loops-core's preset (K13); the group palette lives in its src/lib/palette.ts.
import preset from './packages/sdoh-loops-core/tailwind.preset.js';
import { sdohCoreContent } from './packages/sdoh-loops-core/vite.js';

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', ...sdohCoreContent],
};
