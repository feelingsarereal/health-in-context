/**
 * H1 no diagnosis, no treatment advice: the safety.yaml lint over dist/ — every route's rendered text (verbatim ICD-11
 * fields and verbatim abstracts stripped, as the pack's allowed_contexts declare for ICD-11) and the static dist files.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addNode, dismissFirstRun, newMap, panel, selectNodeByName } from '../helpers';
import { h1Violations, PHRASES } from '../lint';
import { lintText } from '../../scripts/lib/lint';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const concepts = JSON.parse(fs.readFileSync(path.resolve(DIST, '../src/data/concepts.json'), 'utf8')) as { id: string }[];
const ROUTES = ['/', '/maps', '/evidence', '/references', '/glossary', '/concepts', ...concepts.map((c) => `/concepts/${c.id}`), '/help', '/methods', '/about', '/nope'];

test('H1: rendered text of every route', async ({ page }) => {
  const all: unknown[] = [];
  for (const r of ROUTES) {
    await page.goto(r);
    await expect(page.locator('h1').first()).toBeVisible();
    // open every fold-out so abstracts and details are linted too
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
    all.push(...h1Violations(await page.locator('body').innerText(), r));
  }
  expect(all).toEqual([]);
});

test('H1: the map surface — pop-out, association menu (with 2nd degree), every panel, list view', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Lint');
  const all: unknown[] = [];
  for (const code of ['QD71.1', 'QE50.7', 'QE11.0', 'QE90']) {
    await addNode(page, { code, search: code });
    all.push(...h1Violations(await page.locator('body').innerText(), `/map ${code}`));
  }
  await selectNodeByName(page, 'Inadequate housing');
  await page.keyboard.press('a');
  await page.getByTestId('second-degree-toggle').click();
  all.push(...h1Violations(await page.locator('body').innerText(), '/map association menu'));
  await page.keyboard.press('Escape');
  for (const p of ['loops', 'links', 'paths', 'leverage', 'pulse', 'tocode', 'clusters', 'legend', 'map']) {
    await panel(page, p);
    all.push(...h1Violations(await page.locator('body').innerText(), `/map ${p}`));
  }
  await page.keyboard.press('?');
  all.push(...h1Violations(await page.locator('body').innerText(), '/map keys'));
  await page.keyboard.press('Escape');
  await page.getByTestId('switch-view').click();
  all.push(...h1Violations(await page.locator('body').innerText(), '/map/list'));
  expect(all).toEqual([]);
});

test('H1: static dist files (HTML, JSON)', () => {
  const files = fs.readdirSync(DIST).filter((f) => /\.(html|json)$/.test(f));
  const hits = files.flatMap((f) => lintText(f, fs.readFileSync(path.join(DIST, f), 'utf8').replace(/<[^>]+>/g, ' '), PHRASES)).filter((h) => !h.negated);
  expect(hits).toEqual([]);
});

test('H1: builder copy (src/lib/copy.ts) is clean', () => {
  const src = fs.readFileSync(path.resolve(DIST, '../src/lib/copy.ts'), 'utf8');
  expect(lintText('copy.ts', src.replace(/^\s*\/?\*.*$/gm, ''), PHRASES).filter((h) => !h.negated)).toEqual([]);
});
