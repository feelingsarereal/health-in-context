/** H3 de-identification nudges · H4 clear my data · H5 the notice · H6 help · G3 as_of visible · G4 heuristic labels. */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { addEdge, addNode, dismissFirstRun, newMap, panel, selectNodeByName } from '../helpers';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content-pack');
const safety = yaml.load(fs.readFileSync(path.join(PACK, 'safety.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA }) as any;
const NUDGE = safety.deidentify.nudge as string;

test('H3: the nudge renders on every field in safety.yaml → deidentify.fields', async ({ page }) => {
  expect(safety.deidentify.fields).toEqual(['subject', 'circumstance', 'label', 'description', 'notes']);
  await page.goto('/');
  await dismissFirstRun(page);
  // subject (new-map form)
  await page.goto('/maps');
  const subjNudge = await page.getByTestId('new-map-subject').getAttribute('aria-describedby');
  await expect(page.locator(`[id="${subjNudge}"]`)).toHaveText(NUDGE);
  await newMap(page, 'Nudges', 'X.');
  // label + circumstance (new node dialog)
  await page.getByTestId('add-node').click();
  const d = page.getByTestId('node-dialog');
  for (const name of ['Short label (optional)', 'Describe the circumstance']) {
    const id = await d.getByRole('textbox', { name, exact: true }).getAttribute('aria-describedby');
    await expect(page.locator(`[id="${id}"]`)).toHaveText(NUDGE);
  }
  await d.getByTestId('node-submit').click();
  await addNode(page, { status: 'undetermined', label: 'B' });
  // notes (inspector), description (edge), subject + map notes (map panel)
  await selectNodeByName(page, 'B');
  await panel(page, 'inspect');
  const notesId = await page.getByTestId('inspector').getByRole('textbox', { name: 'Notes', exact: true }).getAttribute('aria-describedby');
  await expect(page.locator(`[id="${notesId}"]`)).toHaveText(NUDGE);
  await page.getByTestId('add-edge').click();
  const descId = await page.getByTestId('edge-dialog').getByRole('textbox', { name: 'Describe how one leads to the other', exact: true }).getAttribute('aria-describedby');
  await expect(page.locator(`[id="${descId}"]`)).toHaveText(NUDGE);
  await page.keyboard.press('Escape');
  await panel(page, 'map');
  const sId = await page.getByTestId('map-subject').getAttribute('aria-describedby');
  await expect(page.locator(`[id="${sId}"]`)).toHaveText(NUDGE);
});

test('H4: clear my data empties storage on this device', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'To be cleared', 'Z.');
  await addNode(page, { status: 'undetermined', label: 'Something' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  const before = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(before).toContain('sdoh-loops');
  await page.getByTestId('clear-data').click();
  await expect(page.getByTestId('clear-dialog')).toContainText('Delete every map stored in this browser? This cannot be undone.');
  await page.getByTestId('clear-confirm').click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.reload();
  const after = await page.evaluate(async () => {
    const dbs = (await indexedDB.databases()).map((d) => d.name);
    let maps = 0;
    if (dbs.includes('sdoh-loops')) {
      maps = await new Promise<number>((res) => {
        const r = indexedDB.open('sdoh-loops');
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('maps')) return res(0);
          const c = db.transaction('maps').objectStore('maps').count();
          c.onsuccess = () => res(c.result);
        };
      });
    }
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('sdoh-loops') || k === 'bx-theme');
    return { maps, keys };
  });
  expect(after).toEqual({ maps: 0, keys: [] });
  await page.goto('/maps');
  await expect(page.getByTestId('no-maps')).toBeVisible();
});

test('H5: the not-advice notice on first run, on / and on /about', async ({ page }) => {
  await page.goto('/evidence');
  await expect(page.getByTestId('first-run')).toContainText(safety.notice);
  await page.getByTestId('first-run').getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByTestId('first-run')).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByTestId('notice')).toContainText(safety.notice);
  await page.goto('/about');
  await expect(page.getByTestId('notice')).toContainText(safety.notice);
});

test('H6: help lists every pack entry with source and date; no inputs, no branching', async ({ page }) => {
  await page.goto('/help');
  const entries = page.getByTestId('help-entry');
  await expect(entries).toHaveCount(safety.help.length);
  for (const h of safety.help) {
    const e = entries.filter({ has: page.getByRole('heading', { name: h.name, exact: true }) });
    await expect(e).toContainText(h.how);
    await expect(e).toContainText(`Source: ${h.source}`);
    await expect(e).toContainText(`Checked ${h.verified_on}`);
  }
  await expect(page.locator('main').locator('input, select, textarea')).toHaveCount(0);
});

test('G3: as_of is visible on /, /about and /methods; the interim source is named', async ({ page }) => {
  for (const r of ['/', '/about', '/methods']) {
    await page.goto(r);
    await expect(page.getByTestId('as-of')).toContainText('2026-10-23');
  }
  await expect(page.getByTestId('interim-source')).toContainText('findacode.com');
  await page.goto('/about');
  await expect(page.getByTestId('interim-source')).toContainText('findacode.com');
});

test('G4: every heuristic result carries its label where it renders', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Heuristics');
  await addNode(page, { status: 'undetermined', label: 'A' });
  await addNode(page, { status: 'undetermined', label: 'B' });
  await addEdge(page, 'A', 'B');
  await addEdge(page, 'B', 'A');
  await panel(page, 'loops');
  await expect(page.getByTestId('loops-panel').locator('[data-heuristic]')).toContainText('Loop strength — structural heuristic, not loop dominance');
  await panel(page, 'leverage');
  await expect(page.getByTestId('leverage-panel').locator('[data-heuristic]')).toContainText('Heuristic — hints for discussion');
  await panel(page, 'pulse');
  await expect(page.getByTestId('pulse-panel').locator('[data-heuristic]')).toContainText('What-if pulse — qualitative exploration, not prediction');
  await page.goto('/methods');
  await expect(page.getByTestId('heuristics')).toContainText('Loop strength — structural heuristic, not loop dominance');
});
