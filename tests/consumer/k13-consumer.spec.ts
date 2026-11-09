/**
 * K13: the sdoh-loops-core consumer fixture (packages/sdoh-loops-core/fixtures/consumer) — an app that embeds <SdohMap>
 * the way an SDOH Interrogator app will. It renders the Collinson et al. 2024 worked example as a read-only original;
 * the health-profile invariants hold inside it: no runtime fetches, no telemetry, heuristic labels intact.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openTool, tool, offOrigin, recordRequests, menuItem } from '../helpers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'packages/sdoh-loops-core/fixtures/consumer/dist');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdoh-loops-pack/data/strings.json'), 'utf8'));
const EXAMPLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdoh-loops-core/fixtures/consumer/collinson2024.sdohmap.json'), 'utf8'));

/** Count every network API the page could reach for, from before the first script runs. */
async function trapNetwork(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __net: string[] };
    w.__net = [];
    const note = (k: string) => w.__net.push(k);
    const f = window.fetch;
    window.fetch = (...a: Parameters<typeof fetch>) => (note(`fetch ${String(a[0])}`), f(...a));
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...a: unknown[]) {
      note(`xhr ${String(a[1])}`);
      return (open as (...x: unknown[]) => void).apply(this, a);
    } as typeof open;
    if (navigator.sendBeacon) navigator.sendBeacon = (u: string | URL) => (note(`beacon ${String(u)}`), false);
    const WS = window.WebSocket;
    window.WebSocket = function (u: string | URL) {
      note(`ws ${String(u)}`);
      return new WS(u);
    } as unknown as typeof WebSocket;
    const ES = window.EventSource;
    if (ES) window.EventSource = function (u: string | URL) {
      note(`sse ${String(u)}`);
      return new ES(u);
    } as unknown as typeof EventSource;
  });
}
const panel = (page: Page, p: string) => page.getByTestId(`panel-${p}`).click();

test('K13 consumer: renders the Collinson example — 6 evidence · 3 override, and its three loops', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-name')).toHaveText(EXAMPLE.name);
  await expect(page.getByTestId('link-counts')).toHaveText('9 links: 6 evidence · 3 override');
  await expect(page.getByTestId('loops-count')).toHaveText('3');
  await panel(page, 'loops');
  const loops = page.getByTestId('loop-item');
  await expect(loops).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(loops.nth(i)).toHaveAttribute('data-kind', 'R');
  // the tutorial's result: all three close on evidence alone (eviction-loop tutorial, K12 notes)
  await page.getByTestId('evidence-toggle').check();
  await expect(page.getByTestId('loop-item')).toHaveCount(3);
  await expect(page.getByTestId('fixture-events')).toContainText(`load:${EXAMPLE.id}`);
  // selection changed reaches the consumer (keyboard: step to the first circumstance)
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('fixture-events')).toContainText('select:1:0');
});

test('K13 consumer: no runtime fetches, no off-origin requests, no telemetry API calls', async ({ page }) => {
  await trapNetwork(page);
  const reqs = recordRequests(page);
  await page.goto('/');
  await expect(page.getByTestId('map-name')).toHaveText(EXAMPLE.name);
  for (const p of ['loops', 'links', 'paths', 'leverage', 'pulse', 'clusters', 'legend', 'about']) await panel(page, p); // Needs a code is greyed out at zero (SL23)
  await tool(page, 'switch-view');
  await openTool(page, 'switch-view');
  await expect(page.getByTestId('switch-view')).toHaveText(/canvas/i);
  await page.getByTestId('switch-view').click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __net: string[] }).__net)).toEqual([]);
  expect(offOrigin(reqs, page.url())).toEqual([]);
  const kinds = new Set(reqs.map((r) => r.type));
  for (const k of ['fetch', 'xhr', 'websocket', 'eventsource', 'ping']) expect(kinds.has(k), k).toBe(false);
  // and the trap is live: a fetch the test makes itself is counted
  expect(await page.evaluate(async () => (await fetch('/'), (window as unknown as { __net: string[] }).__net.length))).toBe(1);
});

test('K13 consumer: the heuristic labels render inside the consumer', async ({ page }) => {
  await page.goto('/');
  await panel(page, 'loops');
  await expect(page.getByTestId('loops-panel').locator('[data-heuristic]')).toContainText(S.loops.strength_label);
  await panel(page, 'leverage');
  await expect(page.getByTestId('leverage-panel').locator('[data-heuristic]')).toContainText(S.analyses.leverage_label);
  await panel(page, 'pulse');
  await expect(page.getByTestId('pulse-panel').locator('[data-heuristic]')).toContainText(S.analyses.pulse_label);
});

test('K13 consumer: the built map is a read-only original — the first edit saves a copy and the original never changes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-name')).toHaveText(EXAMPLE.name);
  // the fixture lists its own store (not the withOriginals view): the original is never written to it
  await expect(page.getByTestId('fixture-stored').locator('li')).toHaveCount(0);
  // an edit: greyscale on
  await menuItem(page, 'menu-print');
  await expect(page.getByTestId('map-name')).toHaveText(`${EXAMPLE.name} (copy)`);
  await expect(page.getByTestId('fixture-events')).toContainText(new RegExp(`copy:map-[^:]+:from:${EXAMPLE.id}`));
  await expect(page.getByTestId('fixture-stored')).toHaveText(`${EXAMPLE.name} (copy) · 9 links`);
  // undo stays on the copy: it never writes the original back
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('map-name')).toHaveText(`${EXAMPLE.name} (copy)`);
  await page.reload();
  await expect(page.getByTestId('map-name')).toHaveText(EXAMPLE.name);
  await expect(page.getByTestId('link-counts')).toHaveText('9 links: 6 evidence · 3 override');
  await expect(page.getByTestId('fixture-stored').locator('li')).toHaveCount(1);
});

test('K13 consumer: no analytics, error-reporter or font hosts and no external script in the consumer bundle', () => {
  const HOSTS = ['google-analytics', 'googletagmanager', 'gtag(', 'segment.io', 'sentry.io', 'mixpanel', 'plausible.io', 'hotjar', 'amplitude.com', 'posthog', 'datadoghq', 'newrelic', 'fullstory', 'clarity.ms', 'fonts.googleapis', 'fonts.gstatic', 'navigator.sendBeacon'];
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  for (const t of [...html.matchAll(/<(script|link)\b[^>]*>/g)].map((m) => m[0])) {
    const src = /(?:src|href)="([^"]+)"/.exec(t)?.[1];
    if (src) expect(src.startsWith('/') || src.startsWith('./'), t).toBe(true);
  }
  const hits: string[] = [];
  for (const f of fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /\.(js|css)$/.test(f))) {
    const txt = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8');
    for (const h of HOSTS) if (txt.includes(h)) hits.push(`${f}: ${h}`);
  }
  expect(hits).toEqual([]);
});
