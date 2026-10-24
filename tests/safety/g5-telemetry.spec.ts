/** G5 no telemetry, and G2's static half: no analytics hosts in the bundle; no external <script>/<link> in dist/index.html. */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const HOSTS = ['google-analytics', 'googletagmanager', 'gtag(', 'segment.io', 'cdn.segment', 'sentry.io', 'browser.sentry', 'mixpanel', 'plausible.io', 'hotjar', 'amplitude.com', 'posthog', 'datadoghq', 'newrelic', 'fullstory', 'clarity.ms', 'fonts.googleapis', 'fonts.gstatic', 'navigator.sendBeacon'];

test('G5: no external script or stylesheet in dist/index.html', () => {
  for (const f of ['index.html', '404.html']) {
    const html = fs.readFileSync(path.join(DIST, f), 'utf8');
    const tags = [...html.matchAll(/<(script|link)\b[^>]*>/g)].map((m) => m[0]);
    for (const t of tags) {
      const src = /(?:src|href)="([^"]+)"/.exec(t)?.[1];
      if (!src) continue;
      expect(src.startsWith('/') || src.startsWith('./') || src.startsWith('data:'), `${f}: ${t}`).toBe(true);
    }
  }
});

test('G5: no known analytics, error-reporter or font hosts anywhere in the bundle', () => {
  const files = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /\.(js|css)$/.test(f));
  const hits: string[] = [];
  for (const f of files) {
    const txt = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8');
    for (const h of HOSTS) if (txt.includes(h)) hits.push(`${f}: ${h}`);
  }
  expect(hits).toEqual([]);
});

test('G5: fonts are system fonts or bundled (KaTeX), never fetched from a font service', () => {
  const css = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(DIST, 'assets', f), 'utf8')).join('\n');
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ''));
  expect(urls.filter((u) => /^https?:/.test(u))).toEqual([]);
});
