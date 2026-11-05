/** Part 4: My maps with maps in it, the research pages, Help, Methods, About, a phone, dark mode. */
import { test, expect } from '@playwright/test';
import { shot, openExample, go, tall, clickNode } from './lib';

test('part 4: pages, phone, dark', async ({ page }) => {
  await openExample(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My maps' }).click();
  await expect(page.getByTestId('map-row').first()).toBeVisible();
  await shot(page, '70-my-maps');
  for (const [route, name, h] of [
    ['./evidence', '71-evidence', 1800], ['./references', '72-references', 1500], ['./glossary', '73-glossary', 1300], ['./concepts', '74-primers', 1300],
    ['./concepts/reading-clds', '75-primer', 1500], ['./help', '76-help', 1500], ['./methods', '77-methods', 1600], ['./about', '78-about', 1500], ['./nope', '79-not-found', 900],
  ] as const) {
    await go(page, route);
    await expect(page.locator('h1').first()).toBeVisible();
    await tall(page, () => shot(page, name), h);
  }
  // a reference card opened from a citation number
  await go(page, './references');
  await page.locator('details').first().locator('summary').click().catch(() => {});
  await tall(page, () => shot(page, '72b-reference-open'), 1300);

  await test.step('dark mode', async () => {
    await go(page, './map');
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(600);
    await shot(page, '80-dark');
    await page.getByTestId('theme-toggle').click();
  });

  await test.step('phone', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, './map');
    await page.waitForTimeout(800);
    await shot(page, '81-phone-map');
    await page.getByTestId('toolbar-more').click();
    await page.waitForTimeout(300);
    await shot(page, '82-phone-more');
    await page.getByTestId('toolbar-more').click();
    await page.getByRole('button', { name: 'Menu' }).click();
    await shot(page, '83-phone-menu');
  });
});
