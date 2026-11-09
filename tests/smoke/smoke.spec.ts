/** Smoke: every route renders its h1; dark mode persists; 375 px; keyboard-only main surface; list-view CRUD; axe. */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { doTool, tool, addEdge, addNode, dismissFirstRun, newMap, panel, selectNodeByName } from '../helpers';

const ROUTES = ['/', '/maps', '/map', '/evidence', '/references', '/glossary', '/concepts', '/concepts/reading-clds', '/help', '/methods', '/about'];
const NAV = ['Map', 'My maps', 'Evidence', 'References', 'Glossary', 'Primers', 'Help', 'Methods', 'About'];

test('every route renders its h1, and every shell route is in the nav', async ({ page }) => {
  for (const r of ROUTES) {
    await page.goto(r);
    await expect(page.locator('h1').first()).toBeAttached();
    expect((await page.locator('h1').first().textContent())?.trim().length).toBeGreaterThan(0);
  }
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const n of NAV) await expect(nav.getByRole('link', { name: n, exact: true })).toBeVisible();
});

test('dark mode persists across reloads and routes', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.goto('/methods');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test.describe('375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('no horizontal page scroll on any route', async ({ page }) => {
    for (const r of ROUTES) {
      await page.goto(r);
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), r).toBeLessThanOrEqual(376);
    }
  });
  // K4 D11: the tables scroll inside their own wrappers; the page itself never does
  test('no horizontal page scroll on /map/list with two circumstances and one link', async ({ page }) => {
    await page.goto('/');
    await dismissFirstRun(page);
    await newMap(page, 'Phone list');
    await addNode(page, { code: 'QD71.Z', search: 'evict', circumstance: 'Behind on rent; landlord filed for eviction' });
    await addNode(page, { code: 'QD80', search: 'unemployment' });
    await addEdge(page, 'Problems associated with housing, unspecified', 'Problem associated with unemployment');
    await tool(page, 'switch-view');
    await expect(page.getByTestId('edges-table').locator('tbody tr')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
    await expect(page.getByTestId('list-view').locator('p').first()).toBeInViewport({ ratio: 1 });
  });
});

test('keyboard-only path through the main surface (p-navigator)', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Keys');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  // N → dialog; type a search, Enter on a code, Tab to the submit
  await page.keyboard.press('n');
  await expect(page.getByTestId('node-dialog')).toBeVisible();
  // SL34: the dialog opens on the description; the search box is next, past More formatting
  await expect(page.getByTestId('node-dialog').getByRole('textbox', { name: 'Describe the circumstance', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('code-search')).toBeFocused();
  await page.keyboard.type('unemployment');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // the first code row
  await page.getByTestId('node-submit').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('node-dialog')).toBeHidden();
  await page.keyboard.press('n');
  await expect(page.getByTestId('node-dialog').getByRole('textbox', { name: 'Describe the circumstance', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('low income');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.getByTestId('node-submit').focus();
  await page.keyboard.press('Enter');
  // E → new link dialog; submit with the defaults (from the selection, QD51, to QD80: no shipped link, so an override)
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('k'); // SL23: K is a new link (E is Read / Edit)
  const ed = page.getByTestId('edge-dialog');
  await expect(ed).toBeVisible();
  await expect(ed.getByTestId('edge-submit')).toBeDisabled();
  await ed.getByTestId('override-checkbox').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab'); // bold
  await ed.getByRole('textbox', { name: 'Why keep this link?', exact: true }).focus();
  await page.keyboard.type('Keyboard reason');
  await ed.getByTestId('edge-submit').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('canvas-outline').locator('li[data-edge]')).toHaveCount(1);
  // arrows move the selection, Shift+arrow nudges and pins, P toggles the pin, 1/2 neighbourhood, A menu, L loops, ? keys
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('live')).toContainText('Selected');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByTestId('canvas-outline').locator('li[data-pinned="true"]')).toHaveCount(1);
  await page.keyboard.press('p');
  await expect(page.getByTestId('canvas-outline').locator('li[data-pinned="true"]')).toHaveCount(0);
  await page.keyboard.press('1');
  await expect(page.getByTestId('live')).toContainText('1st-degree');
  await page.keyboard.press('a');
  await expect(page.getByTestId('assoc-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('l');
  await expect(page.getByTestId('loops-panel')).toBeVisible();
  await page.keyboard.press('r');
  await page.keyboard.press('?');
  await expect(page.getByTestId('keys-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // undo / redo
  const n = await page.getByTestId('canvas-outline').locator('li[data-edge]').count();
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('canvas-outline').locator('li[data-node]')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('canvas-outline').locator('li[data-node]')).toHaveCount(2);
  await expect(page.getByTestId('canvas-outline').locator('li[data-edge]')).toHaveCount(n);
});

test('accessible view: create, edit and delete nodes and links by keyboard', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'List');
  await tool(page, 'switch-view');
  const lv = page.getByTestId('list-view');
  await lv.getByTestId('list-add-node').click();
  await page.getByTestId('node-dialog').getByTestId('code-search').fill('stress');
  await page.getByTestId('node-dialog').locator('[data-code="QE01"]').press('Enter');
  await page.getByTestId('node-submit').press('Enter');
  await lv.getByTestId('list-add-node').press('Enter');
  await page.getByTestId('node-dialog').getByTestId('status-other').check({ force: true });
  await page.getByTestId('node-submit').press('Enter');
  await expect(lv.getByTestId('nodes-table').locator('tbody tr')).toHaveCount(2);
  await lv.getByTestId('list-add-edge').press('Enter');
  await page.getByTestId('override-checkbox').press('Space');
  await page.getByTestId('edge-dialog').getByRole('textbox', { name: 'Why keep this link?', exact: true }).focus();
  await page.keyboard.type('List reason');
  await page.getByTestId('edge-submit').press('Enter');
  await expect(lv.getByTestId('edges-table').locator('tbody tr')).toHaveCount(1);
  // edit the link: polarity − flips the weight sign (locked to polarity)
  await lv.getByTestId('list-edit-edge').press('Enter');
  await page.getByTestId('list-edge-dialog').getByTestId('polarity-minus').check({ force: true });
  await page.keyboard.press('Escape');
  await expect(lv.getByTestId('edges-table')).toContainText('− -0.5');
  // edit a node (recode to undetermined keeps the link), then delete the link and a node
  await lv.getByTestId('list-edit-node').first().press('Enter');
  await page.getByTestId('list-node-dialog').getByTestId('status-undetermined').check({ force: true });
  await page.keyboard.press('Escape');
  await expect(lv.getByTestId('nodes-table').locator('tbody tr').first()).toContainText('Not sure yet');
  await expect(lv.getByTestId('edges-table').locator('tbody tr')).toHaveCount(1);
  await lv.getByTestId('list-delete-edge').press('Enter');
  await expect(lv.getByTestId('edges-table').locator('tbody tr')).toHaveCount(0);
  await lv.getByTestId('list-delete-node').first().press('Enter');
  await expect(lv.getByTestId('nodes-table').locator('tbody tr')).toHaveCount(1);
});

test.describe('axe (WCAG 2.1 AA)', () => {
  for (const theme of ['light', 'dark']) {
    test(`shell routes, ${theme}`, async ({ page }) => {
      await page.goto('/');
      if (theme === 'dark') await page.getByTestId('theme-toggle').click();
      for (const r of ROUTES.filter((x) => x !== '/map')) {
        await page.goto(r);
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
        const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(res.violations.map((v) => `${r}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      }
    });
    test(`main surface with content, ${theme}`, async ({ page }) => {
      await page.goto('/');
      await dismissFirstRun(page);
      if (theme === 'dark') await page.getByTestId('theme-toggle').click();
      await newMap(page, 'Axe', 'A.');
      await addNode(page, { code: 'QD71.Z', search: 'evict', circumstance: 'x' });
      await addNode(page, { code: 'QD80', search: 'unemployment' });
      await addNode(page, { status: 'undetermined', label: 'Q' });
      await addEdge(page, 'Problems associated with housing, unspecified', 'Problem associated with unemployment');
      await addEdge(page, 'Problem associated with unemployment', 'Problems associated with housing, unspecified', { polarity: '−', override: 'x' });
      // a needs-review link: recode the unemployment node so the L03 link loses its evidence
      await selectNodeByName(page, 'Problem associated with unemployment');
      await panel(page, 'inspect');
      await page.getByTestId('inspector').getByTestId('change-code').click();
      await page.getByTestId('inspector').getByTestId('code-search').fill('stress');
      await page.getByTestId('inspector').locator('[data-code="QE01"]').click();
      const scan = async (where: string) => {
        const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        return res.violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      };
      const all: string[] = [];
      for (const p of ['inspect', 'loops', 'links', 'paths', 'leverage', 'pulse', 'tocode', 'clusters', 'legend', 'map']) {
        await panel(page, p);
        all.push(...(await scan(`/map ${p}`)));
      }
      await page.getByTestId('add-node').click();
      all.push(...(await scan('/map node dialog')));
      await page.keyboard.press('Escape');
      await doTool(page, 'add-edge');
      // an unsupported pair, so the override block is on screen for the scan
      await page.getByTestId('edge-dialog').getByTestId('edge-from').selectOption({ label: 'Q' });
      await page.getByTestId('edge-dialog').getByTestId('override-checkbox').check();
      all.push(...(await scan('/map link form')));
      await page.keyboard.press('Escape');
      await tool(page, 'switch-view');
      all.push(...(await scan('/map/list')));
      await page.getByTestId('list-edit-edge').first().click();
      all.push(...(await scan('/map/list edge dialog')));
      await page.keyboard.press('Escape');
      expect(all).toEqual([]);
    });
  }
});
