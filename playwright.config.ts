import { defineConfig, devices } from '@playwright/test';

// Playwright serves the built dist/ with `vite preview`. SDOH_PW_PORT overrides the port when 4173 is taken.
const PORT = Number(process.env.SDOH_PW_PORT ?? 4173);
// K13: the sdoh-loops-core consumer fixture (npm run build:consumer), served on its own port and origin
const CONSUMER_PORT = Number(process.env.SDOH_PW_CONSUMER_PORT ?? PORT + 2);
const APP_TESTS = ['walkthroughs/**/*.spec.ts', 'safety/**/*.spec.ts', 'smoke/**/*.spec.ts', 'regressions/**/*.spec.ts'];

export default defineConfig({
  testDir: './tests',
  testMatch: [...APP_TESTS, 'consumer/**/*.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { trace: 'retain-on-failure', acceptDownloads: true },
  projects: [
    { name: 'chromium', testMatch: APP_TESTS, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, baseURL: `http://localhost:${PORT}` } },
    { name: 'consumer', testMatch: ['consumer/**/*.spec.ts'], use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, baseURL: `http://localhost:${CONSUMER_PORT}` } },
  ],
  webServer: [
    {
      command: `npm run preview -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite preview --config packages/sdoh-loops-core/fixtures/consumer/vite.config.ts --port ${CONSUMER_PORT} --strictPort`,
      url: `http://localhost:${CONSUMER_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
