/** UI-12 colour per selection (K2 decision 6): box/shift-select several circumstances and set one fill for all. */
import { test, expect } from '@playwright/test';
import { addNode, dismissFirstRun, newMap } from '../helpers';

test('one fill for a multi-selection, undoable', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Colours');
  await addNode(page, { status: 'undetermined', label: 'A' });
  await addNode(page, { status: 'undetermined', label: 'B' });
  await addNode(page, { status: 'undetermined', label: 'C' });
  const outline = page.getByTestId('canvas-outline');
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  for (const name of ['A', 'B']) {
    const li = outline.locator('li[data-node]', { hasText: `Circumstance: ${name}` });
    if (name === 'B') await page.keyboard.down('Shift');
    await page.mouse.click(canvas.x + Number(await li.getAttribute('data-rx')), canvas.y + Number(await li.getAttribute('data-ry')));
    if (name === 'B') await page.keyboard.up('Shift');
  }
  await expect(page.getByTestId('selection-fill')).toBeVisible();
  await page.getByTestId('selection-fill').selectOption('#117733');
  await expect(outline.locator('li[data-fill="#117733"]')).toHaveCount(2);
  await expect(outline.locator('li[data-node]', { hasText: 'Circumstance: C' })).toHaveAttribute('data-fill', '');
  await page.getByTestId('undo').click();
  await expect(outline.locator('li[data-fill="#117733"]')).toHaveCount(0);
});
