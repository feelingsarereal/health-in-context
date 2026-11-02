/** w3 · p-caregiver · "Sketch a relative's situation on a phone without knowing the codes" — 375×812, touch. */
import { test, expect } from '@playwright/test';
import { dismissFirstRun, fillNodeDialog, offOrigin, recordRequests } from '../helpers';
import { h1Violations } from '../lint';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test("w3: a relative's situation on a phone, no codes needed", async ({ page, baseURL }) => {
  const reqs = recordRequests(page);
  await page.goto('/');
  await dismissFirstRun(page);
  const noHScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // 1 — new map; one node left 'undetermined', described; no code forced; '?' badge
  await page.goto('/maps');
  await page.getByTestId('new-map-name').fill('Mom');
  await page.getByTestId('create-map').tap();
  await expect(page.getByTestId('map-name')).toHaveText('Mom');
  await noHScroll();
  await page.getByTestId('add-node').tap();
  await fillNodeDialog(page, { circumstance: 'Mom was laid off' });
  const outline = page.getByTestId('canvas-outline');
  const first = outline.locator('li[data-node]').first();
  await expect(first).toHaveAttribute('data-status', 'undetermined');
  await expect(first).toContainText('Not sure yet');

  // 2 — the picker's search for 'unemploy' on that node; choose QD80; the description stays
  const insp = page.getByTestId('inspector');
  await insp.getByTestId('choose-code').tap();
  await insp.getByTestId('code-search').fill('unemploy');
  await insp.locator('[data-code="QD80"]').tap();
  await expect(first).toContainText('code QD80');
  await expect(first).toHaveAttribute('data-status', 'sdoh');
  await expect(insp.getByRole('textbox', { name: 'Describe the circumstance', exact: true })).toHaveText('Mom was laid off');

  // 3 — the ⋯ button (the touch alternative to right-click / long-press) opens the association menu; under
  //     'Comes from' choose L03 and the code QD71.Z (eviction, K5): a linked node is added upstream, with L03's citation on the edge
  const more = page.getByTestId('node-more');
  await expect(more).toBeVisible();
  const box = (await more.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await more.tap();
  const menu = page.getByTestId('assoc-menu');
  await expect(menu).toBeVisible();
  const l03 = menu.getByTestId('comes-from').locator('[data-link="L03"]');
  await expect(l03).toBeVisible();
  await l03.getByTestId('assoc-follow').tap();
  await fillNodeDialog(page, { code: 'QD71.Z' });
  await expect(outline.locator('li[data-node]')).toHaveCount(2);
  const edge = outline.locator('li[data-edge]');
  await expect(edge).toHaveCount(1);
  await expect(edge).toContainText('Problems associated with housing, unspecified to Problem associated with unemployment');
  await expect(edge).toContainText('cites [23]');

  // 4 — list view: both nodes and the edge; edit the second node's description; saved
  await page.getByTestId('switch-view').tap();
  const list = page.getByTestId('list-view');
  await expect(list.getByTestId('nodes-table').locator('tbody tr')).toHaveCount(2);
  await expect(list.getByTestId('edges-table').locator('tbody tr')).toHaveCount(1);
  await list.getByTestId('list-edit-node').nth(1).tap();
  const dlg = page.getByTestId('list-node-dialog');
  const desc = dlg.getByRole('textbox', { name: 'Describe the circumstance', exact: true });
  await desc.tap();
  await page.keyboard.type('Rent is due Friday');
  await dlg.getByTestId('list-node-done').tap();
  await expect(list.getByTestId('nodes-table').locator('tbody tr').nth(1)).toContainText('Rent is due Friday');
  await page.reload();
  await expect(page.getByTestId('list-view').getByTestId('nodes-table').locator('tbody tr').nth(1)).toContainText('Rent is due Friday');
  await noHScroll();

  // 5 — Help lists 988, 211 and the National Domestic Violence Hotline, each with source and date checked
  await page.goto('/help');
  const entries = page.getByTestId('help-entry');
  for (const name of ['988 Suicide & Crisis Lifeline', '211', 'National Domestic Violence Hotline']) {
    const e = entries.filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(e).toHaveCount(1);
    await expect(e).toContainText('Source:');
    await expect(e).toContainText('Checked 2026-10-23');
  }
  expect(h1Violations(await page.locator('body').innerText(), 'w3 /help')).toEqual([]);

  // 6 — Clear my data, confirm, reload: no maps remain
  await page.getByTestId('clear-data').tap();
  await page.getByTestId('clear-confirm').tap();
  await page.waitForURL((u) => u.pathname === '/');
  await page.goto('/maps');
  await page.reload();
  await expect(page.getByTestId('no-maps')).toBeVisible();

  expect(offOrigin(reqs, baseURL!)).toEqual([]);
});

test('w3: long-press on a node opens the association menu (touch alternative to right-click)', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await page.goto('/maps');
  await page.getByTestId('new-map-name').fill('Touch');
  await page.getByTestId('create-map').tap();
  await page.getByTestId('add-node').tap();
  await fillNodeDialog(page, { code: 'QD82', search: 'job' });
  const canvas = page.getByTestId('canvas');
  const b = (await canvas.boundingBox())!;
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  // a long press: touchstart, hold > 600 ms, touchend (cytoscape's taphold)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('assoc-menu')).toBeVisible();
});
