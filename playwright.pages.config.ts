import { defineConfig, devices } from '@playwright/test';

/**
 * SL32: the public Pages build. Locally it serves dist-pages/ (npm run build:pages) under /sdoh-loops/, as GitHub
 * Pages does; with SDOH_LIVE_URL set it runs against the live site instead, with no server. The safety specs run
 * unchanged: G2/H2 (no request carries typed text, nothing off-origin), H3–H6 (Clear my data, the notice, /help) and,
 * locally, the dist-file checks G5 and H1 over dist-pages/.
 */
const PORT = Number(process.env.SDOH_PW_PAGES_PORT ?? 4183);
const LIVE = process.env.SDOH_LIVE_URL;
const BASE = LIVE ? (LIVE.endsWith('/') ? LIVE : LIVE + '/') : `http://localhost:${PORT}/sdoh-loops/`;
process.env.SDOH_DIST = 'dist-pages';

export default defineConfig({
  testDir: './tests',
  testMatch: LIVE
    ? ['pages/**/*.spec.ts', 'safety/g2-h2-requests.spec.ts', 'safety/h3-h6.spec.ts']
    : ['pages/**/*.spec.ts', 'safety/**/*.spec.ts'],
  timeout: 120_000,
  expect: { timeout: LIVE ? 20_000 : 10_000 },
  fullyParallel: true,
  workers: LIVE ? 2 : 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/pages-results.json' }]],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, baseURL: BASE, trace: 'retain-on-failure', acceptDownloads: true },
  webServer: LIVE
    ? undefined
    : {
        command: `BASE_PATH=/sdoh-loops/ npx vite preview --outDir dist-pages --port ${PORT} --strictPort`,
        url: BASE,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
