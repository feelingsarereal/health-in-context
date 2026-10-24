/**
 * K2 defect D1 — popovers opened inside a modal <dialog> rendered under its backdrop. Regression: the ⓘ code-info
 * popover in the node dialog, and a [n] citation inside the association menu, are inside the open dialog, visible, and
 * their links take a real click (not intercepted). At 1280 px and 375 px.
 */
import { test, expect, type Page } from '@playwright/test';
import { addNode, dismissFirstRun, newMap, selectNodeByName } from '../helpers';

async function stubExternal(page: Page) {
  // the links open external pages in a new tab; answer them locally so the test makes no network request
  await page.context().route(/^https?:\/\/(?!localhost)/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
}

for (const vp of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`D1 at ${vp.width} px`, () => {
    test.use({ viewport: vp });

    test('the ⓘ code-info popover in the node dialog is inside the dialog and clickable', async ({ page }) => {
      await stubExternal(page);
      await page.goto('/');
      await dismissFirstRun(page);
      await newMap(page, 'D1');
      await page.getByTestId('add-node').click();
      const dialog = page.locator('dialog[open][data-testid="node-dialog"]');
      await expect(dialog).toBeVisible();
      await dialog.getByTestId('code-search').fill('inadequate housing');
      await dialog.getByRole('button', { name: 'About QD71.1' }).click();
      const pop = dialog.getByTestId('popover');
      await expect(pop).toBeVisible();
      expect(await pop.evaluate((el) => !!el.closest('dialog[open]'))).toBe(true);
      const who = pop.getByTestId('who-link');
      await expect(who).toBeVisible();
      // a real click (Playwright fails it if another element would receive the click)
      const [popup] = await Promise.all([page.waitForEvent('popup'), who.click()]);
      expect(popup.url()).toContain('icd.who.int/browse/2026-01/mms/en#');
      await popup.close();
    });

    test('a [n] citation inside the association menu opens inside the dialog and its link is clickable', async ({ page }) => {
      await stubExternal(page);
      await page.goto('/');
      await dismissFirstRun(page);
      await newMap(page, 'D1 cite');
      await addNode(page, { code: 'QD71.1', search: 'inadequate housing' });
      await selectNodeByName(page, 'Inadequate housing');
      await page.keyboard.press('a');
      const dialog = page.locator('dialog[open][data-testid="assoc-dialog"]');
      await expect(dialog).toBeVisible();
      const l03 = dialog.locator('[data-link="L03"]');
      await l03.getByRole('button', { name: 'Reference 23' }).click();
      const card = l03.getByTestId('ref-card');
      await expect(card).toBeVisible();
      expect(await card.evaluate((el) => !!el.closest('dialog[open]'))).toBe(true);
      const link = card.getByRole('link', { name: /Open the source/ });
      await link.scrollIntoViewIfNeeded();
      const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
      expect(popup.url()).toContain('doi.org');
      await popup.close();
    });
  });
}
