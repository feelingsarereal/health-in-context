/**
 * SL31: quick field edit in the selection card's Read mode — a label edited in place (the canvas box and the case
 * summary follow; one Undo restores it), Esc discards, the description keeps its formatting, no ✎ on the code, code
 * status or links rows, the keyboard-only path with focus back on the ✎, a link's description and delay, axe light and dark.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { tool, addEdge, addNode, dismissFirstRun, newMap } from '../helpers';

const scan = async (page: Page, where: string) =>
  (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
  await addNode(page, { code: 'QD80', search: 'unemployment', label: 'Lost the job', circumstance: 'Laid off in May' });
  await page.getByTestId('mode-read').click();
  await expect(page.getByTestId('inspector')).toHaveAttribute('data-quick-edit', 'on');
}
const body = (page: Page) => page.getByTestId('selection-body');

test('a label edited from Read mode: the card stays in Read, the box and the case summary follow, "Label saved.", one Undo restores it', async ({ page }) => {
  await start(page, 'SL31 label');
  await tool(page, 'notebook-toggle');
  await page.getByTestId('dock-unfold').click();
  const row = body(page).getByTestId('qe-label-row');
  await row.hover();
  const pen = body(page).getByTestId('qe-label-edit');
  await expect(pen).toHaveAccessibleName('Edit Label');
  await expect(pen).toHaveCSS('opacity', '1');
  await pen.click();
  const ed = body(page).getByRole('textbox', { name: 'Label' });
  await expect(ed).toBeFocused();
  await expect(page.getByTestId('mode-read')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Lost work');
  await page.keyboard.press('Enter');
  await expect(ed).toHaveCount(0);
  await expect(pen).toBeFocused();
  await expect(page.getByTestId('live')).toHaveText(/^Label saved\./);
  await expect(page.getByTestId('read-title')).toHaveText('Lost work');
  await expect(page.getByTestId('canvas-outline').locator('li[data-node]', { hasText: 'Lost work' })).toHaveCount(1);
  await expect(page.getByTestId('case-summary').getByTestId('summary-table')).toContainText('Lost work');
  // one Undo step
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('read-title')).toHaveText('Lost the job');
  await expect(page.getByTestId('case-summary').getByTestId('summary-table')).toContainText('Lost the job');
});

test('Esc discards; a click away saves', async ({ page }) => {
  await start(page, 'SL31 esc');
  await body(page).getByTestId('qe-label-edit').click();
  await expect(body(page).getByRole('textbox', { name: 'Label' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Not this');
  await page.keyboard.press('Escape');
  await expect(body(page).getByTestId('qe-label-edit')).toBeFocused();
  await expect(page.getByTestId('read-title')).toHaveText('Lost the job');
  await expect(page.getByTestId('undo')).toBeEnabled(); // the node itself was added
  // a click away saves
  await body(page).getByTestId('qe-label-edit').click();
  await expect(body(page).getByRole('textbox', { name: 'Label' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Clicked away');
  await page.getByTestId('read-title').click();
  await expect(page.getByTestId('read-title')).toHaveText('Clicked away');
});

test('the description keeps its formatting: bold from the compact toolbar, and a color set in Edit mode survives a quick edit', async ({ page }) => {
  await start(page, 'SL31 description');
  // a color in Edit mode, with the full toolbar
  await page.getByTestId('mode-edit').click();
  const full = page.getByTestId('inspector').getByRole('textbox', { name: 'Describe the circumstance' });
  await full.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByTestId('inspector').getByRole('toolbar', { name: 'Describe the circumstance: text style' }).getByRole('combobox', { name: 'Text color' }).selectOption({ index: 3 });
  await page.getByTestId('mode-read').click();
  const view = body(page).getByTestId('qe-circumstance-row');
  await expect(view.locator('span[style*="color"]')).toHaveCount(1);
  // quick edit: only B, I, U and "More formatting"
  await body(page).getByTestId('qe-circumstance-edit').click();
  await expect(body(page).getByRole('textbox', { name: 'Circumstance' })).toBeFocused();
  const tb = body(page).getByRole('toolbar', { name: 'Circumstance: text style' });
  await expect(tb.getByRole('button')).toHaveText(['B', 'I', 'U', 'More formatting']);
  await expect(tb.getByRole('combobox')).toHaveCount(0);
  await page.keyboard.press('End');
  await page.keyboard.type(' and ');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('rehired');
  await page.keyboard.press('Enter');
  await expect(view.locator('span[style*="font-weight: 700"]')).toHaveText('rehired');
  await expect(view.locator('span[style*="color"]').first()).toContainText('Laid off in May');
  await expect(view).toContainText('Laid off in May and rehired');
  // More formatting: Edit mode, saved
  await body(page).getByTestId('qe-circumstance-edit').click();
  await expect(body(page).getByRole('textbox', { name: 'Circumstance' })).toBeFocused();
  await page.keyboard.type('!');
  await body(page).getByTestId('qe-circumstance-more').click();
  await expect(page.getByTestId('mode-edit')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('inspector').getByRole('textbox', { name: 'Describe the circumstance' })).toContainText('rehired!');
});

test('no ✎ on the code, code status or links rows; three on a circumstance (label, circumstance, notes) and Pinned is a switch', async ({ page }) => {
  await start(page, 'SL31 rows');
  await addNode(page, { code: 'QD71.Z', search: 'housing' });
  await page.getByTestId('mode-read').click();
  await addEdge(page, 'Problems associated with housing, unspecified', 'Lost the job');
  // the circumstance
  const b = (await page.getByTestId('canvas').boundingBox())!;
  const li = page.getByTestId('canvas-outline').locator('li[data-node]', { hasText: 'Lost the job' }).first();
  await page.mouse.click(b.x + Number(await li.getAttribute('data-rx')), b.y + Number(await li.getAttribute('data-ry')));
  await expect(page.getByTestId('read-title')).toHaveText('Lost the job');
  await expect(body(page).locator('[data-testid^="qe-"][data-testid$="-edit"]')).toHaveCount(3);
  for (const id of ['read-code', 'read-status', 'read-out', 'read-in']) await expect(body(page).getByTestId(id).locator('button[data-testid$="-edit"]')).toHaveCount(0);
  for (const id of ['change-code', 'status-sdoh', 'delete-node']) await expect(page.getByTestId(id)).toHaveCount(0);
  const pin = body(page).getByTestId('read-pinned');
  await expect(pin).toHaveAttribute('role', 'switch');
  await expect(pin).toHaveAttribute('aria-checked', 'false');
  await pin.click();
  await expect(pin).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('live')).toHaveText(/^Pinned in place saved\./);
  await page.getByTestId('undo').click();
  await expect(pin).toHaveAttribute('aria-checked', 'false');
});

test('a link: description edited in place, delay as a switch', async ({ page }) => {
  await start(page, 'SL31 link');
  await addNode(page, { code: 'QD71.Z', search: 'housing' });
  await addEdge(page, 'Problems associated with housing, unspecified', 'Lost the job');
  await page.getByTestId('mode-read').click();
  await expect(page.getByTestId('selection-read')).toHaveAttribute('data-kind', 'edge');
  await expect(body(page).locator('[data-testid^="qe-"][data-testid$="-edit"]')).toHaveCount(1);
  await body(page).getByTestId('qe-description-edit').click();
  await expect(body(page).getByRole('textbox', { name: 'Description' })).toBeFocused();
  await page.keyboard.type('After the eviction notice');
  await page.keyboard.press('Enter');
  await expect(body(page).getByTestId('qe-description-row')).toContainText('After the eviction notice');
  await expect(page.getByTestId('live')).toHaveText(/^Description saved\./);
  const delay = body(page).getByTestId('qe-delay');
  await expect(delay).toHaveAttribute('aria-checked', 'false');
  await delay.click();
  await expect(delay).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('read-basis').locator('button[data-testid$="-edit"]')).toHaveCount(0);
});

test('keyboard only: Tab reaches each ✎, Enter opens, Enter saves, focus returns; Tab on to the next', async ({ page }) => {
  await start(page, 'SL31 keys');
  await body(page).focus();
  const focusedId = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  for (let i = 0; i < 12 && (await focusedId()) !== 'qe-label-edit'; i++) await page.keyboard.press('Tab');
  expect(await focusedId()).toBe('qe-label-edit');
  await expect(body(page).getByTestId('qe-label-edit')).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(body(page).getByRole('textbox', { name: 'Label' })).toBeFocused();
  await page.keyboard.type(' (May)');
  await page.keyboard.press('Enter');
  expect(await focusedId()).toBe('qe-label-edit');
  await expect(page.getByTestId('read-title')).toHaveText('Lost the job (May)');
  await page.keyboard.press('Tab');
  expect(await focusedId()).toBe('qe-circumstance-edit');
  await page.keyboard.press('Enter');
  await expect(body(page).getByRole('textbox', { name: 'Circumstance' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(body(page).getByTestId('qe-circumstance-edit')).toBeFocused();
  expect(await focusedId()).toBe('qe-circumstance-edit');
});

for (const theme of ['light', 'dark'] as const)
  test(`axe is clean with quick edit closed and open, ${theme}`, async ({ page }) => {
    await start(page, `SL31 axe ${theme}`);
    if (theme === 'dark') await page.getByTestId('theme-toggle').click();
    const all = await scan(page, 'closed');
    await body(page).getByTestId('qe-circumstance-edit').click();
    await expect(body(page).getByTestId('qe-circumstance-editor')).toBeVisible();
    all.push(...(await scan(page, 'open')));
    expect(all).toEqual([]);
  });
