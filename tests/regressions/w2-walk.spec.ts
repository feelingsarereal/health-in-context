/** Found walking w2 on the K6 build (scrum 261102): the Leverage panel widened the page; Link to… lost track of the working circumstance. */
import { test, expect, type Page } from '@playwright/test';
import { addEdge, addNode, dismissFirstRun, newMap, panel } from '../helpers';

const LOWINC = 'Low income';
const STRESS = 'Stress, not elsewhere classified';
const UNEMP = 'Problem associated with unemployment';

async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addNode(page, { code: 'QE01', search: 'stress' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
}

test.describe('at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 860 } });
  test('the Leverage table scrolls inside the side panel; the page never scrolls sideways', async ({ page }) => {
    await start(page, 'Wide leverage');
    await addEdge(page, STRESS, UNEMP);
    await addEdge(page, UNEMP, LOWINC);
    await panel(page, 'leverage');
    await expect(page.getByTestId('leverage-panel').locator('table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    const aside = (await page.getByRole('complementary', { name: 'Map panels' }).boundingBox())!;
    expect(aside.x + aside.width).toBeLessThanOrEqual(1280);
  });
});

test('Link to… with a link selected starts From that link’s source, not the first circumstance', async ({ page }) => {
  await start(page, 'Link from');
  const outline = page.getByTestId('canvas-outline');
  // the new link is the selection once it is added
  await addEdge(page, STRESS, UNEMP);
  await expect(outline.locator('li[data-edge]')).toHaveCount(1);
  const stressId = await outline.locator('li[data-node]', { hasText: STRESS }).getAttribute('data-node');
  await page.getByTestId('add-edge').click();
  await expect(page.getByTestId('edge-dialog').getByTestId('edge-from')).toHaveValue(stressId!);
  await page.keyboard.press('Escape');
  // the E shortcut does the same
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('k'); // SL23: K is a new link (E is Read / Edit)
  await expect(page.getByTestId('edge-dialog').getByTestId('edge-from')).toHaveValue(stressId!);
});
