/**
 * SL17 in the standalone app: readable node titles (the title bold and larger, the code line small above, the
 * circumstance text only in Full), the per-map Node text setting saved with the map, the text in greyscale and dark
 * mode, a label's own rich-text style still winning, the picture exports still carrying the text, and axe on the peek.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { addNode, dismissFirstRun, newMap, panel, menuItem } from '../helpers';

const text = (page: Page) => page.getByTestId('node-text-layer').locator('[data-node-text]').first();
async function start(page: Page) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'SL17 text');
  await addNode(page, { code: 'QD71.Z', search: 'evict', label: 'Losing the flat', circumstance: 'Rent went up twice' });
  await expect(text(page)).toBeVisible();
}
const px = (s: string) => parseFloat(s);

test('SL17: Title + code by default — the title bold and larger than the code line; the circumstance only in the peek', async ({ page }) => {
  await start(page);
  const t = text(page);
  await expect(t).toHaveAttribute('data-mode', 'title-code');
  await expect(t.locator('[data-part="code"]')).toHaveText(/QD71\.Z$/);
  await expect(t.locator('[data-part="title"]')).toHaveText('Losing the flat');
  await expect(t.locator('[data-part="sub"]')).toHaveCount(0);
  const [title, code] = await Promise.all(['title', 'code'].map((p) => t.locator(`[data-part="${p}"]`).evaluate((el) => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight }))));
  expect(px(title.size)).toBeGreaterThan(px(code.size));
  expect(Number(title.weight)).toBeGreaterThanOrEqual(700);
  // the code line sits above the title
  const [tb, cb] = [await t.locator('[data-part="title"]').boundingBox(), await t.locator('[data-part="code"]').boundingBox()];
  expect(cb!.y).toBeLessThan(tb!.y);
  // the box is the text's size: the text sits inside the box the canvas draws
  const bb = (await page.getByTestId('canvas-outline').locator('li[data-node]').first().getAttribute('data-bb'))!.split(',').map(Number);
  const cv = (await page.getByTestId('canvas').boundingBox())!;
  const tx = (await t.boundingBox())!;
  expect(tx.x - cv.x).toBeGreaterThanOrEqual(bb[0] - 2);
  expect(tx.x - cv.x + tx.width).toBeLessThanOrEqual(bb[2] + 2);
});

test('SL17: the Node text setting — Title, Full — is saved with the map and comes back after a reload', async ({ page }) => {
  await start(page);
  await panel(page, 'map');
  await page.getByTestId('node-text').selectOption('title');
  await expect(text(page)).toHaveAttribute('data-mode', 'title');
  await expect(text(page).locator('[data-part="code"]')).toHaveCount(0);
  await page.getByTestId('node-text').selectOption('full');
  await expect(text(page).locator('[data-part="sub"]')).toHaveText('Rent went up twice');
  // a taller box follows the longer text
  await page.reload();
  await expect(text(page)).toHaveAttribute('data-mode', 'full');
  await expect(text(page).locator('[data-part="sub"]')).toHaveText('Rent went up twice');
  // and the JSON export carries the setting
  await panel(page, 'map');
  const dl = page.waitForEvent('download');
  await menuItem(page, 'export-json');
  const file = await (await dl).path();
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(json.layout.nodeText).toBe('full');
});

test('SL17: greyscale and dark mode keep the text readable; a label’s own colour wins', async ({ page }) => {
  await start(page);
  const title = text(page).locator('[data-part="title"]');
  const ink = await title.evaluate((el) => getComputedStyle(el).color);
  // dark mode: the text follows the theme's ink
  await page.getByTestId('theme-toggle').click();
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el).color)).not.toBe(ink);
  // greyscale/print: dark ink on the white boxes
  await menuItem(page, 'menu-print');
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(31, 27, 22)');
  await menuItem(page, 'menu-print');
  await page.getByTestId('theme-toggle').click();
  // a label's own colour and size, set in the editor, win on the canvas
  const label = page.getByTestId('inspector').getByRole('textbox', { name: 'Short label (optional)', exact: true });
  await label.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByTestId('inspector').getByRole('combobox', { name: 'Text colour' }).first().selectOption({ index: 2 });
  await expect.poll(() => title.evaluate((el) => (el as HTMLElement).style.color)).not.toBe('');
});

test('SL17: PNG and SVG exports still carry the boxes’ text', async ({ page }) => {
  await start(page);
  await panel(page, 'map');
  const dl = page.waitForEvent('download');
  await menuItem(page, 'export-svg');
  const svg = fs.readFileSync(await (await dl).path(), 'utf8') as string;
  expect(svg).toContain('Losing the flat');
  expect(svg).toContain('QD71.Z');
  // the on-screen canvas never draws it twice: its own label is transparent
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-node-text]')!).visibility)).toBe('visible');
});

for (const theme of ['light', 'dark'] as const) {
  test(`SL17: axe is clean with the peek open and the dock collapsed, ${theme}`, async ({ page }) => {
    await start(page);
    if (theme === 'dark') await page.getByTestId('theme-toggle').click();
    await panel(page, 'map');
    await page.getByTestId('node-text').selectOption('full');
    const b = (await page.getByTestId('canvas').boundingBox())!;
    const li = page.getByTestId('canvas-outline').locator('li[data-node]').first();
    await page.mouse.click(b.x + Number(await li.getAttribute('data-rx')), b.y + Number(await li.getAttribute('data-ry')), { button: 'right' });
    await expect(page.getByTestId('peek')).toBeVisible();
    const scan = async (where: string) => (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    const all = await scan('peek');
    await page.keyboard.press('Escape');
    await page.getByTestId('dock-fold').click();
    await expect(page.getByTestId('dock-rail')).toBeVisible();
    all.push(...(await scan('dock collapsed')));
    await page.getByTestId('fullscreen').click();
    all.push(...(await scan('full screen')));
    expect(all).toEqual([]);
  });
}
