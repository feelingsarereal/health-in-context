/**
 * K4 polish found walking w2 and w3 on the K3 build (D3, D5–D10, D12). One test per defect; D4 and D11 have their
 * own specs (k4-control-names, and the 375 px smoke test).
 */
import { test, expect, type Page } from '@playwright/test';
import { addEdge, addNode, dismissFirstRun, newMap, panel, selectNodeByName } from '../helpers';

async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
}
/** Canvas-frame point → page point */
async function at(page: Page, x: number, y: number) {
  const c = (await page.getByTestId('canvas').boundingBox())!;
  return { x: c.x + x, y: c.y + y };
}

test('D5: the override tooltip closes once the pointer leaves the edge, even while the edge is selected', async ({ page }) => {
  await start(page, 'D5');
  // QD51 → QE01: L05 is withheld, so an override (K6: QE01 → QD80 is evidence now, L29)
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addNode(page, { code: 'QE01', search: 'stress' });
  await addEdge(page, 'Low income', 'Stress, not elsewhere classified', { override: 'Money worries' });
  // the new link is selected, so its reason shows without a hover
  const tip = page.getByTestId('edge-tooltip');
  await expect(tip).toContainText('Money worries');
  const [x1, y1, x2, y2] = (await page.getByTestId('canvas-outline').locator('li[data-edge]').first().getAttribute('data-ends'))!.split(',').map(Number);
  const mid = await at(page, (x1 + x2) / 2, (y1 + y2) / 2);
  await page.mouse.move(mid.x, mid.y, { steps: 4 });
  await expect(tip).toBeVisible();
  const [bx1, by1, bx2, by2] = (await page.getByTestId('canvas-outline').locator('li[data-node]').first().getAttribute('data-bb'))!.split(',').map(Number);
  const node = await at(page, (bx1 + bx2) / 2, (by1 + by2) / 2);
  await page.mouse.move(node.x, node.y, { steps: 6 });
  await expect(tip).toBeHidden();
  // hovering it again shows it; leaving the canvas altogether hides it
  await page.mouse.move(mid.x, mid.y, { steps: 6 });
  await expect(tip).toBeVisible();
  await page.mouse.move(mid.x, 5, { steps: 2 });
  await expect(tip).toBeHidden();
});

test('D6: an evidence link in the Links panel cites with the same reference fold-out as everywhere else', async ({ page }) => {
  await start(page, 'D6');
  await addNode(page, { code: 'QD71.Z', search: 'evict' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addEdge(page, 'Problems associated with housing, unspecified', 'Problem associated with unemployment');
  await panel(page, 'links');
  const item = page.getByTestId('links-item').first();
  await expect(item).toContainText('L03');
  const cite = item.locator('button.bx-cite').first();
  await expect(cite).toHaveAccessibleName(/^Reference \d+$/);
  await cite.click();
  await expect(page.getByTestId('links-panel').getByTestId('cite-foldout')).toBeVisible();
});

test('D7: the Paths summary pluralises', async ({ page }) => {
  await start(page, 'D7');
  await addNode(page, { code: 'QD71.Z', search: 'evict' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addEdge(page, 'Problems associated with housing, unspecified', 'Problem associated with unemployment');
  await panel(page, 'paths');
  await page.getByTestId('paths-find').click();
  await expect(page.getByTestId('paths-count')).toHaveText('1 path');
});

test('D8: the Leverage panel shows one heuristic label', async ({ page }) => {
  await start(page, 'D8');
  await panel(page, 'leverage');
  const label = page.getByTestId('leverage-panel').locator('[data-heuristic]');
  await expect(label).toHaveText('Heuristic — hints for discussion');
});

test('D3 and D12: the menu names the tier basis once, and an empty section says which way', async ({ page }) => {
  await start(page, 'D12');
  // QD71.0 has evidence links arriving (L15, L28) and none leaving (K5: QD80 now leads to L01 and L26)
  await addNode(page, { code: 'QD71.0', search: 'homeless' });
  await selectNodeByName(page, 'Homelessness');
  await page.getByTestId('open-assoc').click();
  const menu = page.getByTestId('assoc-menu');
  await expect(menu.getByTestId('comes-from').getByTestId('assoc-entry').first()).toBeVisible();
  await expect(menu.getByTestId('leads-to-none')).toHaveText('None start here.');
  expect((await menu.textContent())!.match(/builder's reading of the WHO framework/g)).toHaveLength(1);
  await expect(menu).not.toContainText('Ordered from structural to intermediary determinants');
});

test.describe('D10 on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('the empty canvas says to tap New circumstance, and the secondary tools sit behind More', async ({ page }) => {
    await start(page, 'D10');
    await expect(page.getByTestId('canvas-empty')).toHaveText('Tap New circumstance to add the first circumstance.');
    const bar = page.getByTestId('toolbar');
    const tall = (await bar.boundingBox())!.height;
    expect(tall).toBeLessThan(812 / 4);
    await expect(page.getByTestId('arrange')).toBeHidden();
    await expect(page.getByTestId('add-node')).toBeVisible();
    await page.getByTestId('toolbar-more').tap();
    await expect(page.getByTestId('toolbar-more')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('arrange')).toBeVisible();
    await page.getByTestId('toolbar-more').tap();
    await expect(page.getByTestId('arrange')).toBeHidden();
  });
});

test('D10: on a desktop the hint keeps the double-click and N, and every tool is on the toolbar', async ({ page }) => {
  await start(page, 'D10 desk');
  await expect(page.getByTestId('canvas-empty')).toHaveText('Double-click the canvas or press N to add the first circumstance.');
  await expect(page.getByTestId('arrange')).toBeVisible();
  await expect(page.getByTestId('toolbar-more')).toBeHidden();
});

// K6 D1 changed this: below the 44 px floor the buttons now stay at 44 px instead of hiding
test('D10: the ⋯ and link handles scale with zoom, and stay at the 44 px floor when zoomed out', async ({ page }) => {
  await start(page, 'D10 zoom');
  await addNode(page, { code: 'QD71.Z', search: 'evict' });
  await selectNodeByName(page, 'Problems associated with housing, unspecified');
  const more = page.getByTestId('node-more');
  const handle = page.getByTestId('connect-handle');
  await expect(more).toBeVisible();
  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  const w0 = (await more.boundingBox())!.width;
  expect(w0).toBeGreaterThanOrEqual(44);
  await zoomIn.click();
  await expect.poll(async () => (await more.boundingBox())?.width ?? 0).toBeGreaterThan(w0);
  for (let i = 0; i < 6; i++) await zoomOut.click();
  await expect(more).toBeVisible();
  await expect(handle).toBeVisible();
  for (const b of [more, handle]) expect(Math.round((await b.boundingBox())!.width)).toBe(44);
});
