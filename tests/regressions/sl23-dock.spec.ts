/**
 * SL23 in the standalone app (an editable map): the selection card's Read / Edit toggle — Read by default with no edit
 * control in the DOM, Edit adds them, the mode is kept per viewer and E toggles it; K is a new link; the peek's
 * "Open in editor" opens Edit; About this map edits only in Edit; Needs a code with its count; axe in both modes, light
 * and dark.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, menuItem } from '../helpers';

const DOCK_KEY = 'sdoh-loops:view:dock';
async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await page.goto('/maps');
  await page.getByTestId('new-map-name').fill(name);
  await page.getByTestId('create-map').click();
  await expect(page.getByTestId('map-name')).toHaveText(name);
}
const scan = async (page: Page, where: string) =>
  (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
async function click(page: Page, label: string) {
  const b = (await page.getByTestId('canvas').boundingBox())!;
  const li = page.getByTestId('canvas-outline').locator('li[data-node]', { hasText: label }).first();
  await page.mouse.click(b.x + Number(await li.getAttribute('data-rx')), b.y + Number(await li.getAttribute('data-ry')));
}

test('Read by default, with no edit control in the DOM; Edit adds them; the mode persists over a reload; E toggles it', async ({ page }) => {
  await start(page, 'SL23 modes');
  const title = page.getByTestId('dock-card-selection-toggle');
  await expect(title).toHaveText(/Nothing selected$/);
  await expect(page.getByTestId('mode-read')).toHaveAttribute('aria-pressed', 'true');
  await addNode(page, { code: 'QD80', search: 'unemployment', label: 'Lost the job' });
  await expect(title).toHaveText(/Selected circumstance$/);
  const body = page.getByTestId('selection-body');
  await expect(body.getByTestId('selection-read')).toHaveAttribute('data-kind', 'node');
  await expect(body.getByTestId('read-title')).toHaveText('Lost the job');
  await expect(body.getByTestId('read-code')).toContainText('QD80');
  await expect(body.getByTestId('read-status')).toContainText('QD80');
  await expect(body.getByTestId('read-pinned')).toHaveText('No');
  await expect(body.getByTestId('code-title')).toBeVisible(); // the WHO title, as text
  for (const id of ['delete-node', 'inspector-assoc', 'inspector-link-to', 'status-sdoh', 'change-code']) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(body.locator('input, select, textarea, [contenteditable="true"]')).toHaveCount(0);
  await expect(body.getByRole('button', { name: /^(Pin|Unpin|Delete)$/ })).toHaveCount(0);
  // Edit
  await page.getByTestId('mode-edit').click();
  await expect(page.getByTestId('mode-edit')).toHaveAttribute('aria-pressed', 'true');
  for (const id of ['delete-node', 'inspector-assoc', 'inspector-link-to', 'status-sdoh', 'change-code']) await expect(page.getByTestId(id)).toHaveCount(1);
  await expect(body.getByRole('button', { name: 'Pin' })).toBeVisible();
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), DOCK_KEY))!)).toMatchObject({ mode: 'edit' });
  // persists per viewer
  await page.reload();
  await click(page, 'Lost the job');
  await expect(page.getByTestId('delete-node')).toBeVisible();
  // E toggles it, from the canvas
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('e');
  await expect(page.getByTestId('mode-read')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('delete-node')).toHaveCount(0);
  await page.keyboard.press('e');
  await expect(page.getByTestId('delete-node')).toBeVisible();
  // never in the map: the saved map file has no mode
  const [d] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-json')]);
  const p = test.info().outputPath('m.json');
  await d.saveAs(p);
  expect(fs.readFileSync(p, 'utf8')).not.toMatch(/"mode"/);
});

test('titles: Selected link, Selected: 2 circumstances; K opens Link to…; the peek’s Open in editor opens Edit', async ({ page }) => {
  await start(page, 'SL23 titles');
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addNode(page, { code: 'QD71.Z', search: 'evict' });
  const title = page.getByTestId('dock-card-selection-toggle');
  // K is a new link now (E is Read / Edit)
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('k');
  await expect(page.getByTestId('edge-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await addEdge(page, 'Problems associated with housing, unspecified', 'Problem associated with unemployment');
  await expect(title).toHaveText(/Selected link$/);
  await expect(page.getByTestId('selection-read')).toHaveAttribute('data-kind', 'edge');
  await expect(page.getByTestId('read-basis')).toContainText(/evidence\s+L\d+/);
  // two circumstances
  const b = (await page.getByTestId('canvas').boundingBox())!;
  const lis = page.getByTestId('canvas-outline').locator('li[data-node]');
  await page.mouse.click(b.x + Number(await lis.nth(0).getAttribute('data-rx')), b.y + Number(await lis.nth(0).getAttribute('data-ry')));
  await page.keyboard.down('Shift');
  await page.mouse.click(b.x + Number(await lis.nth(1).getAttribute('data-rx')), b.y + Number(await lis.nth(1).getAttribute('data-ry')));
  await page.keyboard.up('Shift');
  await expect(title).toHaveText(/Selected: 2 circumstances$/);
  // the peek's Open in editor: the selection card in Edit
  await page.mouse.click(b.x + Number(await lis.nth(0).getAttribute('data-rx')), b.y + Number(await lis.nth(0).getAttribute('data-ry')), { button: 'right' });
  await page.getByTestId('peek-open').click();
  await expect(page.getByTestId('mode-edit')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('delete-node')).toBeVisible();
});

test('Needs a code: the badge counts "Not sure yet" circumstances and the panel lists them; at zero greyed out with its tooltip', async ({ page }) => {
  await start(page, 'SL23 needs a code');
  const tab = page.getByTestId('panel-needsCode');
  await expect(tab).toHaveAttribute('aria-disabled', 'true');
  await expect(tab).toHaveAttribute('title', 'Every circumstance has a code status');
  await expect(tab).toHaveText('Needs a code');
  expect(await scan(page, 'needs a code, none')).toEqual([]);
  await addNode(page, { status: 'undetermined', label: 'Unsure' });
  await expect(tab).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('needs-code-count')).toHaveText('1');
  await tab.click();
  await expect(page.getByTestId('needs-code-lead')).toHaveText("Circumstances marked 'Not sure yet'. The evidence check can only vouch for links between coded circumstances.");
  await expect(page.getByTestId('tocode-list')).toContainText('Unsure');
});

test('About this map edits only in Edit mode', async ({ page }) => {
  await start(page, 'SL23 about');
  await page.getByTestId('panel-about').click();
  const about = page.getByTestId('about-map');
  await expect(about).toHaveAttribute('data-mode', 'read');
  await expect(about.getByTestId('about-name')).toHaveText('SL23 about');
  await expect(about.locator('input, select, textarea, [contenteditable="true"]')).toHaveCount(0);
  await page.getByTestId('mode-edit').click();
  await expect(about).toHaveAttribute('data-mode', 'edit');
  await about.getByTestId('map-subject').fill('JD');
  await expect(about.getByTestId('deidentify-nudge').first()).toBeVisible();
  await page.getByTestId('mode-read').click();
  await expect(about.getByTestId('about-subject')).toHaveText('JD');
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe is clean in Read and in Edit, ${theme}`, async ({ page }) => {
    await start(page, `SL23 axe ${theme}`);
    if (theme === 'dark') await page.getByTestId('theme-toggle').click();
    await addNode(page, { code: 'QD80', search: 'unemployment', label: 'Lost the job' });
    const all = await scan(page, 'Read');
    await page.getByTestId('mode-edit').click();
    await expect(page.getByTestId('delete-node')).toBeVisible();
    all.push(...(await scan(page, 'Edit')));
    expect(all).toEqual([]);
  });
}
