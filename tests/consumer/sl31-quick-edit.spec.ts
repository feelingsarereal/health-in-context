/** SL31: a read-only original (the consumer fixture's built map) shows no ✎ and no switches in the selection card. */
import { test, expect } from '@playwright/test';

test('the read-only original: no quick edit anywhere', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('canvas-outline').locator('li[data-node="n3-eviction"]')).toHaveAttribute('data-rx', /\d/);
  await page.getByTestId('fixture-select').click();
  await expect(page.getByTestId('selection-read')).toHaveAttribute('data-kind', 'node');
  await expect(page.getByTestId('inspector')).toHaveAttribute('data-quick-edit', 'off');
  await expect(page.locator('[data-testid^="qe-"]')).toHaveCount(0);
  await expect(page.locator('.ax-qe-pen')).toHaveCount(0);
  await expect(page.getByTestId('read-pinned')).not.toHaveAttribute('role', 'switch');
});
