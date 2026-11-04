/**
 * K6: the ten defects from the K5 walkthrough (D1–D10), and Lawes 2022 on /methods. One test per defect; the w2 changes
 * (L29, L25's codes, stable loop names) are in tests/walkthroughs/w2.spec.ts.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, newMap, panel, selectNodeByName, menuItem } from '../helpers';

const HOUSING = 'Problems associated with housing, unspecified';
const UNEMP = 'Problem associated with unemployment';
const LOWINC = 'Low income';

async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
}
const zoom = async (page: Page) => Number(await page.getByTestId('canvas-wrap').getAttribute('data-zoom'));
const boxes = async (page: Page) =>
  (await page.getByTestId('canvas-outline').locator('li[data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-bb')!))).map((b) => {
    const [x1, y1, x2, y2] = b.split(',').map(Number);
    return { x1, y1, x2, y2 };
  });
/** the eviction → unemployment → low income loop, all evidence (L03, L01, L02) */
async function w1Loop(page: Page) {
  await addNode(page, { code: 'QD71.Z', search: 'evict' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addEdge(page, HOUSING, UNEMP);
  await addEdge(page, UNEMP, LOWINC);
  await addEdge(page, LOWINC, HOUSING);
}

test('D1: after Fit on a 6-node map, a selected node still has its ⋯ and connector handle, at 44 px or more', async ({ page }) => {
  await start(page, 'D1');
  for (const [code, search] of [['QD71.Z', 'evict'], ['QD80', 'unemployment'], ['QD51', 'low income'], ['QE01', 'stress'], ['QD71.0', 'homeless'], ['QD82', 'job']]) await addNode(page, { code, search });
  await page.getByRole('button', { name: 'Fit' }).click();
  await selectNodeByName(page, UNEMP);
  for (const id of ['node-more', 'connect-handle']) {
    await expect(page.getByTestId(id)).toBeVisible();
    expect((await page.getByTestId(id).boundingBox())!.width).toBeGreaterThanOrEqual(44);
  }
});

test('D2: the toolbar ＋/－ change the zoom, and one wheel tick is a small step', async ({ page }) => {
  await start(page, 'D2');
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  const z0 = await zoom(page);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoom(page)).toBeCloseTo(z0 * 1.25, 2);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => zoom(page)).toBeCloseTo(z0, 2);
  const c = (await page.getByTestId('canvas').boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.wheel(0, -100);
  await expect.poll(() => zoom(page)).not.toBeCloseTo(z0, 3);
  const z1 = await zoom(page);
  expect(z1 / z0).toBeLessThan(1.5); // was about 2.5× per tick
  await page.mouse.wheel(0, 100);
  await expect.poll(() => zoom(page)).toBeLessThan(z1);
  expect((await zoom(page)) / z0).toBeGreaterThan(0.7);
});

test('D3: choosing a loop fits the whole loop with padding, never past the 1.2× cap', async ({ page }) => {
  await start(page, 'D3');
  await w1Loop(page);
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
  const c = (await page.getByTestId('canvas').boundingBox())!;
  const allIn = async () => (await boxes(page)).every((b) => b.x1 >= 0 && b.y1 >= 0 && b.x2 <= c.width && b.y2 <= c.height);
  expect(await allIn()).toBe(false);
  await panel(page, 'loops');
  await page.getByTestId('loop-pick').first().click();
  await expect.poll(allIn).toBe(true);
  expect(await zoom(page)).toBeLessThanOrEqual(1.2);
  // the same from the canvas glyph
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByTestId('loop-pick').first().click(); // clear
  await page.getByTestId('loop-glyph').first().click();
  await expect.poll(allIn).toBe(true);
  expect(await zoom(page)).toBeLessThanOrEqual(1.2);
});

test('D7: the loop glyph sits clear of every node box', async ({ page }) => {
  await start(page, 'D7');
  await w1Loop(page);
  // a two-node loop too, whose centre falls between its nodes
  await addEdge(page, HOUSING, LOWINC); // L27 (K5)
  const c = (await page.getByTestId('canvas').boundingBox())!;
  const bs = await boxes(page);
  const glyphs = page.getByTestId('loop-glyph');
  expect(await glyphs.count()).toBeGreaterThanOrEqual(2);
  for (const g of await glyphs.all()) {
    const r = (await g.boundingBox())!;
    const x1 = r.x - c.x;
    const y1 = r.y - c.y;
    for (const b of bs) expect(x1 < b.x2 && x1 + r.width > b.x1 && y1 < b.y2 && y1 + r.height > b.y1, `glyph ${JSON.stringify(r)} on ${JSON.stringify(b)}`).toBe(false);
  }
});

test('D5: a loop entry has one accessible name with its name, kind, links, overrides and strength', async ({ page }) => {
  await start(page, 'D5');
  await w1Loop(page);
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-pick').first()).toHaveAccessibleName(/^R1, Reinforcing, 3 links, no overrides, strength 0\.125: /);
});

test('D6: the variable hint sits under "Describe the circumstance", in the add dialog and in the side panel', async ({ page }) => {
  await start(page, 'D6');
  const HINT = "Describe it as something that can go up or down; read the box as 'how much of this is present'.";
  await page.getByTestId('add-node').click();
  const d = page.getByTestId('node-dialog');
  const box = d.getByRole('textbox', { name: 'Describe the circumstance', exact: true });
  await expect(box).toHaveAccessibleDescription(new RegExp(`^${HINT.replace(/[.?()']/g, '.')}`));
  await expect(d.locator('fieldset', { hasText: 'Code status' })).not.toContainText('how much of this is present');
  await d.getByTestId('code-search').fill('unemployment');
  await d.locator('[data-code="QD80"]').click();
  await d.getByTestId('node-submit').click();
  await selectNodeByName(page, UNEMP);
  await panel(page, 'inspect');
  await expect(page.getByTestId('inspector').getByRole('textbox', { name: 'Describe the circumstance', exact: true })).toHaveAccessibleDescription(new RegExp(`^${HINT.replace(/[.?()']/g, '.')}`));
});

test('D8: counts take the right number ("1 − link", "1 circumstance")', async ({ page }) => {
  await start(page, 'D8');
  await addNode(page, { code: 'QD71.Z', search: 'evict' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addEdge(page, HOUSING, UNEMP, { polarity: '−', override: 'x' });
  await panel(page, 'links');
  await expect(page.getByTestId('link-summary')).toHaveText('0 + links, 1 − link.');
  await page.goto('/maps');
  await expect(page.locator('li', { hasText: 'D8' }).first()).toContainText('2 circumstances · 1 link ·');
});

test('D9: deleting a map asks in the app\'s own dialog, not a browser confirm', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('a native browser dialog opened');
  });
  await start(page, 'Doomed map');
  await page.goto('/maps');
  const row = page.locator('li', { hasText: 'Doomed map' }).first();
  await row.getByTestId('delete-map').click();
  const dlg = page.getByTestId('delete-map-dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Delete this map from this browser? This cannot be undone.');
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('li', { hasText: 'Doomed map' })).toHaveCount(1);
  await row.getByTestId('delete-map').click();
  await page.getByTestId('delete-map-confirm').click();
  await expect(page.locator('li', { hasText: 'Doomed map' })).toHaveCount(0);
});

test('D10: a link whose straight line would cross another circumstance bends around it', async ({ page }) => {
  await start(page, 'D10 route');
  for (const label of ['Alpha', 'Beta', 'Gamma']) await addNode(page, { status: 'other', type: 'outcome', label });
  await addEdge(page, 'Alpha', 'Beta', { override: 'x' });
  // export, put the three in a row, re-import, then link Alpha → Gamma straight through Beta
  await panel(page, 'map');
  const [dl] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-json')]);
  const p = test.info().outputPath('row.json');
  await dl.saveAs(p);
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  const xs: Record<string, number> = { Alpha: 0, Beta: 320, Gamma: 640 };
  for (const n of m.nodes) {
    const label = JSON.stringify(n.label).match(/Alpha|Beta|Gamma/)![0];
    Object.assign(n, { x: xs[label], y: 0, pinned: true });
  }
  fs.writeFileSync(p, JSON.stringify(m));
  await page.getByTestId('import-file').setInputFiles(p);
  await expect(page.getByTestId('map-name')).toHaveText('D10 route (imported)');
  await addEdge(page, 'Alpha', 'Gamma', { override: 'y' });
  const outline = page.getByTestId('canvas-outline');
  const beta = await outline.locator('li[data-node]', { hasText: 'Beta' }).getAttribute('data-bb');
  const [bx1, by1, bx2, by2] = beta!.split(',').map(Number);
  await expect(outline.locator('li[data-edge]:not([data-mid])')).toHaveCount(0); // set on the next frame
  const edgesMid = await outline.locator('li[data-edge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mid')!.split(',').map(Number)));
  const [ab, ag] = edgesMid; // Alpha → Beta, then Alpha → Gamma
  expect(ab[2]).toBe(0); // nothing in its way: not bent
  expect(ag[2]).not.toBe(0);
  const [mx, my] = ag;
  expect(mx > bx1 && mx < bx2 && my > by1 && my < by2, `Alpha → Gamma's midpoint ${mx},${my} is inside Beta ${beta}`).toBe(false);
  // a link back, Gamma → Alpha, makes a pair: both bend, side by side, and both clear Beta
  await addEdge(page, 'Gamma', 'Alpha', { override: 'z' });
  await expect(outline.locator('li[data-edge]')).toHaveCount(3);
  await expect(outline.locator('li[data-edge]:not([data-mid])')).toHaveCount(0);
  const mids = await outline.locator('li[data-edge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mid')!.split(',').map(Number)));
  const [, ag2, ga] = mids;
  for (const [x, y, bend] of [ag2, ga]) {
    expect(bend).not.toBe(0);
    expect(x > bx1 && x < bx2 && y > by1 && y < by2, `midpoint ${x},${y} is inside Beta ${beta}`).toBe(false);
  }
  expect(Math.abs(ag2[1] - ga[1])).toBeGreaterThan(15); // apart, not on top of each other
  // the loop glyph (Alpha ⇄ Gamma is a loop) keeps off the links' ⚑ marks
  const g = (await page.getByTestId('loop-glyph').first().boundingBox())!;
  const c = (await page.getByTestId('canvas').boundingBox())!;
  for (const [x, y] of [ag2, ga]) expect(Math.hypot(g.x - c.x + g.width / 2 - x, g.y - c.y + g.height / 2 - y), 'glyph on a ⚑').toBeGreaterThan(25);
  // nothing else moved: the three still sit in a row
  const ys = await outline.locator('li[data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ry')));
  expect(new Set(ys).size).toBe(1);
});

test('Lawes 2022 is recorded on /methods beside L22, a shipped link since K9, and backs no link', async ({ page }) => {
  await page.goto('/methods');
  await expect(page.locator('[data-withheld="L22"]')).toHaveCount(0);
  const l22 = page.locator('[data-shipped="L22"]');
  await expect(l22).toContainText('Shipped');
  await expect(l22).toContainText('refs 26');
  const rec = l22.getByTestId('recorded-ref');
  await expect(rec).toHaveAttribute('data-ref', '49');
  await expect(rec).toContainText('prior result; backs no link');
  await expect(rec).toContainText('Mixed, context-dependent evidence on L22 (unemployment → stress), which rests on Paul & Moser 2009');
  await rec.getByRole('button', { name: 'Reference 49' }).click();
  await expect(rec.getByTestId('cite-foldout')).toContainText('Lawes');
  await expect(page.getByTestId('recorded-ref')).toHaveCount(1);
});
