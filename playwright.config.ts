import { defineConfig, devices } from '@playwright/test';

// Playwright serves the built dist/ with `vite preview`. SDOH_PW_PORT overrides the port when 4173 is taken.
const PORT = Number(process.env.SDOH_PW_PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  testMatch: ['walkthroughs/**/*.spec.ts', 'safety/**/*.spec.ts', 'smoke/**/*.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', acceptDownloads: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
