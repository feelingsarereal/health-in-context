/** @type {import('tailwindcss').Config} */
// MI DESIGN-SYSTEM §2 tokens come from sdoh-loops-core's preset (K13); the group palette lives in its src/lib/palette.ts.
import preset from './packages/sdoh-loops-core/tailwind.preset.js';
import { sdohCoreContent } from './packages/sdoh-loops-core/vite.js';

export default {
  presets: [preset],
  // SL39: the kit's type and neutrals; the host's to set, so the core's defaults stay for the Interrogator apps
  theme: {
    extend: {
      fontFamily: {
        // American Typewriter is proprietary: never bundled, it renders only where the visitor's system has it
        display: ['"American Typewriter"', '"Roboto Slab"', 'serif'],
        body: ['Roboto', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#333333', muted: '#636363' },
        paper: { DEFAULT: '#ffffff', 2: '#f3f3f3' },
        night: { DEFAULT: '#1b1d1f', 2: '#25282b', ink: '#e8e6e3', muted: '#b8b4ae' },
      },
    },
  },
  content: ['./index.html', './src/**/*.{ts,tsx}', ...sdohCoreContent],
};
