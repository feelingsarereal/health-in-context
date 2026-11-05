/** Part 1: home, My maps, and building Household F step by step; the finished map is saved for the other parts. */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { go, shot, typeRich, editMode, menuItem, HERE } from './lib';
import { NODES, EDGES, type N, type E } from './example';

const label = (k: string) => NODES.find((n) => n.key === k)!.label;

async function openAdd(page: Page) {
  await page.getByTestId('add-node').click();
  const d = page.getByTestId('node-dialog');
  await expect(d).toBeVisible();
  return d;
}
async function fillNode(page: Page, n: N, shots?: { search?: string; filled?: string }) {
  const d = page.getByTestId('node-dialog');
  if (n.status === 'other') await d.getByTestId('status-other').check({ force: true });
  if (n.code) {
    await d.getByTestId('code-search').fill(n.search ?? n.code);
    if (shots?.search) await shot(page, shots.search, d);
    await d.locator(`[data-code="${n.code}"]`).first().click();
    await expect(d.getByTestId('chosen-code')).toContainText(n.code);
  }
  if (n.type) await d.getByTestId('other-type').selectOption(n.type);
  await typeRich(page, d, 'Short label (optional)', n.label);
  await typeRich(page, d, 'Describe the circumstance', n.circumstance);
  if (shots?.filled) await shot(page, shots.filled, d);
  await d.getByTestId('node-submit').click();
  await expect(d).toBeHidden();
}
async function fillEdge(page: Page, e: E, shots?: { check?: string; override?: string }) {
  const d = page.getByTestId('edge-dialog');
  await expect(d).toBeVisible();
  await d.getByTestId('edge-from').selectOption({ label: label(e.from) });
  await d.getByTestId('link-search').fill(label(e.to));
  await d.locator('label', { has: page.getByTestId('link-target') }).filter({ hasText: label(e.to) }).first().getByTestId('link-target').check();
  if (e.polarity === '−') await d.getByTestId('polarity-minus').check({ force: true });
  const step = d.locator(`[data-weight="${e.weight}"]`);
  if (await step.count()) await step.first().click();
  else await d.getByTestId('weight-free').fill(String(e.weight));
  if (e.delay) await d.getByTestId('edge-delay').check();
  await typeRich(page, d, 'Describe how one leads to the other', e.description);
  if (shots?.check) await shot(page, shots.check, d);
  if (e.override) {
    await expect(d.getByTestId('edge-submit')).toBeDisabled();
    await d.getByTestId('override-checkbox').check();
    await typeRich(page, d, 'Why keep this link?', e.override);
    if (shots?.override) await shot(page, shots.override, d);
  }
  await d.getByTestId('edge-submit').click();
  await expect(d).toBeHidden();
}

test('part 1: start, build Household F, save it', async ({ page }) => {
  // the banner and the first-run notice, as a first visit sees them
  await go(page, './', true);
  await shot(page, '01-home');
  await shot(page, '02-banner', page.getByTestId('prototype-banner'));
  await page.goto('./evidence');
  await expect(page.getByTestId('first-run')).toBeVisible();
  await shot(page, '03-first-run', { around: page.getByTestId('first-run'), pad: 8 });
  await page.getByTestId('first-run').getByRole('button').click();
  await page.getByTestId('prototype-banner-dismiss').click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My maps' }).click();
  await shot(page, '04-my-maps-empty');
  await page.getByTestId('new-map-name').fill('Household F, after the fire');
  await page.getByTestId('new-map-subject').fill('Household F');
  await shot(page, '05-new-map', { around: page.getByTestId('new-map-name').locator('xpath=ancestor::section[1]'), pad: 4 });
  await page.getByTestId('create-map').click();
  await expect(page.getByTestId('map-name')).toHaveText('Household F, after the fire');
  await shot(page, '06-empty-map');
  await editMode(page);

  // the first circumstance, with the add dialog shown at each stage
  const d = await openAdd(page);
  await shot(page, '07-add-dialog', d);
  await fillNode(page, NODES[0], { search: '08-code-search', filled: '09-add-filled' });
  await shot(page, '10-first-node');
  for (const n of NODES.slice(1)) {
    await openAdd(page);
    await fillNode(page, n, n.key === 'facilities' ? { filled: '12-add-other' } : undefined);
  }
  await page.getByTestId('arrange').click();
  await page.waitForTimeout(1200);
  await shot(page, '13-all-circumstances');

  // links: one backed by evidence, one not (override), then the rest
  for (const e of EDGES) {
    await page.getByTestId('add-edge').click();
    const shots = e.from === 'work' && e.to === 'income' ? { check: '14-link-backed' } : e.from === 'work' && e.to === 'home' ? { check: '15-link-not-backed', override: '16-link-override' } : undefined;
    await fillEdge(page, e, shots);
  }
  await page.getByTestId('arrange').click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Fit' }).click();
  await page.waitForTimeout(600);
  await page.mouse.move(5, 895);
  await shot(page, '17-full-map');

  // save the map as the manual's example file
  const [dl] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-json')]);
  const file = path.resolve(HERE, '../household-f.sdohmap.json');
  await dl.saveAs(file);
  // the manual's layout: each circumstance where the story reads best (the app keeps x and y from the file)
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const text = (n: any) => n.label.content[0].content[0].text as string;
  for (const n of doc.nodes) {
    const spec = NODES.find((s) => s.label === text(n))!;
    n.x = spec.x;
    n.y = spec.y;
  }
  fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
});
