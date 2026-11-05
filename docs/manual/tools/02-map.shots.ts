/** Part 2: the map screen with Household F — overview, Map menu, selection card, peek, associations, the tabs. */
import { test, expect, type Page } from '@playwright/test';
import { shot, openExample, badges, clearBadges, editMode, readMode, clickNode, clickEdge, tall } from './lib';

const tb = (page: Page, name: string) => page.getByTestId('toolbar').getByRole('button', { name, exact: true });

test('part 2: the map screen', async ({ page }) => {
  await openExample(page);
  await page.keyboard.press('Escape');
  await shot(page, '20-map');

  await test.step('annotated overview', async () => {
    await badges(page, [
      [page.getByTestId('map-name'), 1], [page.getByTestId('map-menu'), 2], [page.getByTestId('link-counts'), 3], [page.getByTestId('add-node'), 4],
      [page.getByTestId('add-edge'), 5], [page.getByTestId('open-assoc'), 6], [tb(page, 'Add a canvas note'), 7], [page.getByTestId('layout-engine'), 8],
      [page.getByTestId('arrange'), 9], [tb(page, 'Re-arrange all (ignore pins)'), 10], [tb(page, 'Arrange selection'), 11], [page.getByTestId('undo'), 12],
      [tb(page, 'Redo'), 13], [tb(page, '1st-degree'), 14], [tb(page, '2nd-degree'), 15], [tb(page, 'Fit'), 16], [tb(page, 'Zoom in'), 17], [tb(page, 'Zoom out'), 18],
      [page.getByTestId('fullscreen'), 19], [page.getByTestId('switch-view'), 20], [page.getByTestId('notebook-toggle'), 21], [page.getByRole('button', { name: /^Keyboard/ }), 22],
      [page.getByTestId('canvas'), 23], [page.getByTestId('mode-read'), 24], [page.getByTestId('dock-fold'), 25], [page.getByTestId('evidence-toggle'), 26],
      [page.getByTestId('panel-loops'), 27],
    ]);
    await shot(page, '21-map-annotated');
    await clearBadges(page);
  });

  await test.step('Map menu', async () => {
    await page.getByTestId('map-menu').click();
    await shot(page, '22-map-menu', { around: page.getByTestId('map-menu-list'), pad: 6 });
    await page.keyboard.press('Escape');
  });

  await test.step('a circumstance: Read, quick edit, Edit, code card', async () => {
    await clickNode(page, 'Without a home');
    await readMode(page);
    await tall(page, () => shot(page, '23-read-node', page.getByTestId('side-dock')));
    const pen = page.getByTestId('selection-read').locator('[data-testid$="-edit"]').first();
    await pen.click();
    await tall(page, () => shot(page, '24-quick-edit', page.getByTestId('side-dock')));
    await page.keyboard.press('Escape');
    await editMode(page);
    await tall(page, () => shot(page, '25-edit-node', page.getByTestId('side-dock')));
    await page.getByTestId('selection-body').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await tall(page, async () => { await page.getByTestId('selection-body').evaluate((el) => (el.scrollTop = el.scrollHeight)); await shot(page, '25b-edit-node-end', page.getByTestId('side-dock')); });
  });

  await test.step('peek', async () => {
    await page.keyboard.press('Escape');
    await clickNode(page, 'Work lost after the fire', 'right');
    await expect(page.getByTestId('peek')).toBeVisible();
    await shot(page, '27-peek', { around: page.getByTestId('peek'), pad: 10 }, true);
    await page.keyboard.press('Escape');
  });

  await test.step('associations', async () => {
    await clickNode(page, 'Work lost after the fire');
    await page.getByTestId('open-assoc').click();
    const m = page.getByTestId('assoc-menu');
    await expect(m).toBeVisible();
    await shot(page, '28-assoc');
    await m.getByTestId('second-degree-toggle').click();
    await page.waitForTimeout(400);
    await shot(page, '29-assoc-2nd');
    await page.keyboard.press('Escape');
    if (await m.isVisible()) await page.keyboard.press('Escape');
  });

  await test.step('links: override and evidence', async () => {
    await page.keyboard.press('Escape');
    await clickEdge(page, 'Work lost after the fire', 'Without a home');
    await readMode(page);
    await tall(page, () => shot(page, '30-link-read', page.getByTestId('side-dock')));
    await editMode(page);
    await tall(page, () => shot(page, '31-link-edit', page.getByTestId('side-dock')));
    await page.getByTestId('selection-body').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await tall(page, async () => { await page.getByTestId('selection-body').evaluate((el) => (el.scrollTop = el.scrollHeight)); await shot(page, '31b-link-edit-end', page.getByTestId('side-dock')); });
    await page.keyboard.press('Escape');
    await clickEdge(page, 'Work lost after the fire', 'Low income');
    await readMode(page);
    await tall(page, () => shot(page, '32-link-evidence', page.getByTestId('side-dock')));
    await page.keyboard.press('Escape');
  });

  await test.step('neighbourhood', async () => {
    await clickNode(page, 'Without a home');
    await tb(page, '1st-degree').click();
    await page.waitForTimeout(400);
    await shot(page, '33-first-degree');
    await tb(page, '1st-degree').click();
    await page.keyboard.press('Escape');
  });

  await test.step('the Whole map tabs', async () => {
    const dock = page.getByTestId('side-dock');
    // fold the selection card so the tabs have the room
    await page.getByTestId('panel-loops').click();
    await page.getByTestId('loop-pick').first().click();
    await page.waitForTimeout(400);
    await shot(page, '34-loops');
    await page.getByRole('button', { name: 'Clear highlight' }).click();
    await tb(page, 'Fit').click();
    await page.waitForTimeout(500);
    for (const [id, name] of [['links', '35-links'], ['leverage', '37-leverage'], ['legend', '40-legend'], ['about', '41-about-map']] as const) {
      await page.getByTestId(`panel-${id}`).click();
      await page.waitForTimeout(300);
      await tall(page, () => shot(page, name, dock));
    }
    await page.getByTestId('panel-paths').click();
    await page.getByTestId('paths-from').selectOption({ label: 'Home lost in a wildfire' });
    await page.getByTestId('paths-to').selectOption({ label: 'Not enough food' });
    await page.getByTestId('paths-find').click();
    await page.waitForTimeout(400);
    await shot(page, '36-paths');
    await page.getByTestId('panel-pulse').click();
    await page.getByTestId('pulse-panel').getByRole('combobox').first().selectOption({ label: 'Work lost after the fire' });
    await page.getByRole('button', { name: 'Run pulse' }).click();
    await page.waitForTimeout(1500);
    await shot(page, '38-what-if');
    await tall(page, () => shot(page, '38b-what-if-results', dock));
    await page.getByTestId('panel-clusters').click();
    await page.getByLabel('Show clusters on the canvas').check();
    await page.waitForTimeout(500);
    await shot(page, '39-clusters');
    await page.getByLabel('Show clusters on the canvas').uncheck();
  });

  await test.step('evidence-backed links only', async () => {
    await page.getByTestId('panel-loops').click();
    await page.getByTestId('evidence-toggle').check();
    await page.waitForTimeout(500);
    await shot(page, '43-evidence-only');
    await page.getByTestId('evidence-toggle').uncheck();
  });

  await test.step('needs a code', async () => {
    await page.getByTestId('add-node').click();
    const d = page.getByTestId('node-dialog');
    await d.getByTestId('status-undetermined').check({ force: true });
    await d.getByRole('textbox', { name: 'Short label (optional)', exact: true }).click();
    await page.keyboard.type('Debts since the fire');
    await d.getByTestId('node-submit').click();
    await page.getByTestId('panel-needsCode').click();
    await tall(page, () => shot(page, '42-needs-code', page.getByTestId('side-dock')));
    await page.getByTestId('undo').click();
  });

  await test.step('list view, keys, canvas note', async () => {
    await page.getByTestId('switch-view').click();
    await expect(page.getByTestId('list-view')).toBeVisible();
    await shot(page, '44-list-view');
    await page.getByTestId('switch-view').click();
    await page.getByRole('button', { name: /^Keyboard/ }).click();
    const kd = page.getByRole('dialog');
    await shot(page, '45-keys', kd);
    await page.keyboard.press('Escape');
    await tb(page, 'Add a canvas note').click();
    await shot(page, '46-canvas-note', page.getByTestId('node-dialog'));
    await page.keyboard.press('Escape');
  });

  await test.step('full screen, folded dock, grayscale, node text', async () => {
    await page.getByTestId('fullscreen').click();
    await page.waitForTimeout(1200);
    await shot(page, '47-full-screen');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.getByTestId('dock-fold').click();
    await page.waitForTimeout(500);
    await shot(page, '48-dock-folded');
    await page.getByTestId('dock-unfold').click();
    await page.getByTestId('map-menu').click();
    await page.getByTestId('map-menu-list').getByText(/gray/i).first().click();
    await page.waitForTimeout(500);
    await shot(page, '49-grayscale');
    await page.getByTestId('map-menu').click();
    await page.getByTestId('map-menu-list').getByText(/gray/i).first().click();
  });
});
