/** @type {import('tailwindcss').Config} */
// MI DESIGN-SYSTEM §2 tokens, verbatim. The group palette (14 ICD-11 blocks) lives in src/lib/palette.ts.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', '"Book Antiqua"', 'Georgia', 'serif'],
        body: ['"Avenir Next"', 'Avenir', '"Segoe UI"', '"Gill Sans"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#1f1b16', muted: '#5d5750' },
        paper: { DEFAULT: '#faf8f4', 2: '#f1ede6' },
        night: { DEFAULT: '#15130f', 2: '#211d18', ink: '#efeae2', muted: '#b3aca1' },
        cat: { a: '#7a4a1f', b: '#2f7a3e', c: '#2a5aa6', d: '#7b2c5e', e: '#b8860b', f: '#4b6b7a' },
      },
    },
  },
  plugins: [],
};
