import { defineConfig, devices } from '@playwright/test';

/**
 * The user manual's screenshots (docs/manual/img) and its control inventory, taken from the public Pages build
 * (npm run build:pages → dist-pages, served under /sdoh-loops/ as on GitHub Pages). Run from the app folder:
 *   npm run build:pages && npx playwright test --config docs/manual/tools/playwright.manual.config.ts
 */
const PORT = Number(process.env.SDOH_PW_MANUAL_PORT ?? 4190);
export default defineConfig({
  testDir: '.',
  testMatch: ['*.shots.ts'],
  timeout: 900_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, baseURL: `http://localhost:${PORT}/sdoh-loops/`, acceptDownloads: true, colorScheme: 'light', actionTimeout: 15_000 },
  webServer: {
    command: `BASE_PATH=/sdoh-loops/ npx vite preview --outDir dist-pages --port ${PORT} --strictPort`,
    cwd: '../../..',
    url: `http://localhost:${PORT}/sdoh-loops/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
