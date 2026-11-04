/** SL26: an embedding app keeps the notebook off (no `notebook` prop) until SL28 — no toggle, no tabs, no notebook. */
import { test, expect } from '@playwright/test';

test('the consumer fixture shows no notebook, at desktop width and at 375 px', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-name')).toBeVisible();
  await expect(page.getByTestId('notebook-toggle')).toHaveCount(0);
  await expect(page.getByTestId('notebook')).toHaveCount(0);
  await page.getByTestId('map-menu').click();
  await expect(page.getByTestId('export-json-bare')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByTestId('nb-tabs')).toHaveCount(0);
});
