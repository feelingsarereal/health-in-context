/**
 * K14 app fixes: loop glyphs scale with zoom on a phone; "Got it" dismisses the notice everywhere (home keeps it, /about
 * keeps the words as a plain section); the add-the-first-circumstance hint only on an empty map; longer loop names on
 * the glyphs, still clear of ⚑, delay and polarity marks.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEdge, addNode, dismissFirstRun, newMap, panel } from '../helpers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdoh-loops-pack/data/strings.json'), 'utf8'));
const NOTICE = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdoh-loops-pack/data/manifest.json'), 'utf8')).safety.notice as string;

/** Two circumstances in a loop (two overrides), plus a third hanging off it. */
async function smallLoop(page: Page, name = 'K14') {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
  await addNode(page, { status: 'undetermined', label: 'Alpha' });
  await addNode(page, { status: 'undetermined', label: 'Beta' });
  await addEdge(page, 'Alpha', 'Beta', { override: 'x' });
  await addEdge(page, 'Beta', 'Alpha', { override: 'y' });
  await expect(page.getByTestId('loop-glyph')).toHaveCount(1);
}
const scaleOf = async (page: Page) => Number(await page.getByTestId('loop-glyph').first().getAttribute('data-scale'));
const zoomOf = async (page: Page) => Number(await page.getByTestId('canvas-wrap').getAttribute('data-zoom'));

test.describe('phone (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('K14.1: loop glyphs scale with the canvas zoom, as the boxes do', async ({ page }) => {
    await smallLoop(page);
    const glyph = page.getByTestId('loop-glyph').first();
    // zoomed out: the glyph shrinks with the boxes (it kept its desktop 30 px before)
    await page.getByTestId('toolbar-more').click(); // on a phone the zoom buttons sit behind More (K4 D10)
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect.poll(async () => (await zoomOf(page)) < 0.9).toBe(true);
    await expect.poll(async () => Math.abs((await scaleOf(page)) - Math.max(0.3, await zoomOf(page)))).toBeLessThan(0.01);
    // the face shrinks; SL20: the button around it stays a 24 × 24 px hit target
    const h = (await glyph.getByTestId('loop-glyph-face').boundingBox())!.height;
    expect(h).toBeLessThan(30 * 0.9);
    const hit = (await glyph.boundingBox())!;
    expect(hit.width).toBeGreaterThanOrEqual(24);
    expect(hit.height).toBeGreaterThanOrEqual(24);
    // the glyph is never much taller than a circumstance's box at the same zoom
    const bb = (await page.getByTestId('canvas-outline').locator('li[data-node]').first().getAttribute('data-bb'))!.split(',').map(Number);
    expect(h).toBeLessThanOrEqual(bb[3] - bb[1] + 1);
  });
});

test('K14.1: on a desktop the glyphs keep their size (scale 1) at any zoom', async ({ page }) => {
  await smallLoop(page);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => scaleOf(page)).toBe(1);
});

test('K14.2: "Got it" dismisses the notice on every page; home keeps it; /about keeps the words, not the banner', async ({ page }) => {
  // first visit: the panel shows
  await page.goto('/evidence');
  await expect(page.getByTestId('first-run')).toContainText(NOTICE);
  await page.getByTestId('first-run').getByRole('button', { name: S.first_run.ok }).click();
  for (const r of ['/evidence', '/glossary', '/references', '/maps', '/help', '/methods', '/about']) {
    await page.goto(r);
    await expect(page.getByTestId('first-run'), r).toHaveCount(0);
    await expect(page.locator('main').getByText(S.first_run.title, { exact: true }), r).toHaveCount(0);
  }
  // SAFETY H5: /about still says what the tool is and is not, in the pack's words
  await expect(page.getByTestId('notice')).toContainText(NOTICE);
  // and the home page keeps its notice
  await page.goto('/');
  await expect(page.getByTestId('notice')).toContainText(S.first_run.title);
  // client-side navigation does not bring it back either
  await page.goto('/glossary');
  await page.locator('header nav').getByRole('link', { name: 'Evidence', exact: true }).first().click();
  await expect(page).toHaveURL(/\/evidence$/);
  await expect(page.getByTestId('first-run')).toHaveCount(0);
});

test('K14.3: the add-the-first-circumstance hint shows only on an empty map', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Empty');
  await expect(page.getByTestId('inspector-empty')).toHaveText(S.canvas?.empty ?? 'Double-click the canvas or press N to add the first circumstance.');
  await addNode(page, { status: 'undetermined', label: 'Alpha' });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inspector-empty')).toHaveText('Select a circumstance or a link to edit it.');
});

test('K14.4: a renamed loop shows up to about 20 characters over two lines, and its glyph stays clear of ⚑, delay and polarity marks', async ({ page }) => {
  await smallLoop(page);
  await addNode(page, { status: 'undetermined', label: 'Gamma' });
  await addEdge(page, 'Beta', 'Gamma', { override: 'z' });
  await addEdge(page, 'Gamma', 'Beta', { polarity: '−', override: 'w' });
  // one link with a delay, so a ‖ mark is on the canvas too
  await panel(page, 'links');
  await page.getByTestId('links-item').filter({ hasText: 'Alpha → Beta' }).first().getByRole('button').click();
  await page.getByTestId('inspector').getByTestId('edge-delay').check();
  await expect(page.getByTestId('canvas-outline').locator('li[data-edge][data-mark*="‖"]')).toHaveCount(1);
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);
  // renaming re-sorts the list, so each loop is found by its kind, not its place
  const names: [string, string][] = [['R', 'R2 Work-eviction spiral'], ['B', 'A very long name for a balancing loop']];
  for (const [kind, name] of names) {
    const item = page.locator(`[data-testid="loop-item"][data-kind="${kind}"]`);
    await item.getByRole('button', { name: 'Rename' }).click();
    await item.getByRole('textbox', { name: 'Loop name' }).fill(name);
    await item.getByRole('button', { name: 'Save' }).click();
  }
  const work = page.getByRole('button', { name: /^Loop R2 Work-eviction spiral: / });
  await expect(work).toHaveText('↻R2 Work-eviction spiral');
  await expect(work).toHaveAttribute('data-label', 'R2 Work-eviction\nspiral');
  await expect(work).toHaveAttribute('title', 'R2 Work-eviction spiral');
  const long = page.getByRole('button', { name: /^Loop A very long name for a balancing loop: / });
  await expect(long).toHaveAttribute('title', 'A very long name for a balancing loop');
  // the overlay redraws on the next frame after a rename
  await expect(long).toHaveAttribute('data-label', /…$/);
  const label = (await long.getAttribute('data-label'))!;
  expect(label.replace('\n', ' ').length).toBeLessThanOrEqual(25);
  expect(label.split('\n')).toHaveLength(2);

  // the two-line glyphs avoid every ⚑ / delay badge and polarity label (K6, K7)
  await page.waitForTimeout(300);
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  const z = await zoomOf(page);
  const marks = await page.getByTestId('canvas-outline').locator('li[data-edge]').evaluateAll((els) =>
    els.map((e) => ({ ends: e.getAttribute('data-ends')!.split(',').map(Number), mid: e.getAttribute('data-mid')!.split(',').map(Number), basis: e.getAttribute('data-basis'), m: e.getAttribute('data-mark') ?? '' })),
  );
  const circles = marks.flatMap(({ ends: [, , tx, ty], mid: [mx, my], basis, m }) => {
    const len = Math.hypot(mx - tx, my - ty) || 1;
    const off = Math.min(26 * z, len);
    const pol = { x: tx + ((mx - tx) / len) * off, y: ty + ((my - ty) / len) * off, r: 11 * z, what: 'polarity' };
    return basis === 'override' || m ? [{ x: mx, y: my, r: 18 * z, what: '⚑/‖' }, pol] : [pol];
  });
  const hits: string[] = [];
  for (const g of await page.getByTestId('loop-glyph').all()) {
    const b = (await g.boundingBox())!;
    const x1 = b.x - canvas.x;
    const y1 = b.y - canvas.y;
    for (const c of circles) {
      const dx = Math.max(x1 - c.x, 0, c.x - (x1 + b.width));
      const dy = Math.max(y1 - c.y, 0, c.y - (y1 + b.height));
      if (Math.hypot(dx, dy) < c.r) hits.push(`${await g.getAttribute('title')} on a ${c.what} mark`);
    }
  }
  expect(hits).toEqual([]);
});

test('K14 pack 0.1.1: the new wording ships — the reinforcing-loop entry and the T-LINKS to-do', async ({ page }) => {
  await page.goto('/glossary');
  await dismissFirstRun(page);
  await page.goto('/glossary');
  await expect(page.locator('main')).toContainText('comes back pushing the same way');
  await page.goto('/methods');
  await expect(page.getByTestId('todo-list')).toContainText('Links withheld after evidence review');
  await expect(page.locator('main')).not.toContainText('Links blocked by unverified references');
});
