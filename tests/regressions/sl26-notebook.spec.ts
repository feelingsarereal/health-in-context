/**
 * SL26 (S7.1 slice 1): the case manager notebook in the standalone app — both note kinds, autosave over a reload,
 * keyboard reorder, flag → label (the stored value is gone and the count drops), the export warning, Clear my data,
 * axe in light and dark, and 375 px.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { openTool, tool, addEdge, addNode, dismissFirstRun, menuItem, newMap } from '../helpers';

async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
}
async function openNotebook(page: Page) {
  await openTool(page, 'notebook-toggle');
  const t = page.getByTestId('notebook-toggle');
  if ((await t.getAttribute('aria-checked')) !== 'true') await t.click();
  else await page.keyboard.press('Escape');
  await expect(page.getByTestId('notebook')).toBeVisible();
}
async function newFree(page: Page, title: string, body: string) {
  await page.getByTestId('nb-new').click();
  await expect(page.getByTestId('nb-title')).toBeFocused();
  await page.getByTestId('nb-title').fill(title);
  await page.getByTestId('nb-body').click();
  await page.keyboard.type(body);
}
/** every map stored in this browser, as JSON text (what autosave wrote) */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((res) => {
        const r = indexedDB.open('sdoh-loops');
        r.onsuccess = () => {
          const g = r.result.transaction('maps').objectStore('maps').getAll();
          g.onsuccess = () => res(JSON.stringify(g.result));
        };
      }),
  );
const scan = async (page: Page, where: string) =>
  (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

test('both note kinds; autosave over a reload; reorder by keyboard; search and tags', async ({ page }) => {
  await start(page, 'SL26 notes');
  await expect(page.getByTestId('notebook')).toHaveCount(0);
  await openNotebook(page);
  await expect(page.getByTestId('nb-empty')).toBeVisible();
  // a free note, with a heading and a list
  await newFree(page, 'First visit', 'Behind on rent since the spring.');
  await page.getByRole('button', { name: 'Heading', exact: true }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Bulleted list' }).click();
  await page.keyboard.type('food bank on Tuesdays');
  await expect(page.getByTestId('nb-body').locator('h2')).toHaveText('Behind on rent since the spring.');
  await expect(page.getByTestId('nb-body').locator('ul li')).toHaveText('food bank on Tuesdays');
  await page.getByTestId('nb-tags').fill('housing, food');
  await page.getByTestId('nb-tags').press('Enter');
  // a structured note: the date field takes a year by default
  await page.getByTestId('nb-template').selectOption({ label: 'Contact note' });
  await expect(page.getByTestId('nb-fields')).toHaveAttribute('data-template', 'contact');
  await expect(page.getByTestId('nb-date')).toHaveValue(String(new Date().getFullYear()));
  await expect(page.getByTestId('nb-fields').locator('p.font-semibold')).toHaveText(['Contact type (call, visit, message)', 'What was discussed', 'What changed since last time', 'Follow-up']);
  await page.getByTestId('nb-field-discussed').click();
  await page.keyboard.type('Bus pass renewal.');
  await page.getByTestId('nb-new').click();
  await page.getByTestId('nb-title').fill('Third');
  await expect(page.getByTestId('nb-note')).toHaveCount(3);
  // search and the tag filter
  await page.getByTestId('nb-search').fill('bus pass');
  await expect(page.getByTestId('nb-note')).toHaveCount(1);
  await page.getByTestId('nb-search').fill('');
  await page.getByTestId('nb-tag-filter').selectOption('food');
  await expect(page.getByTestId('nb-note')).toHaveText([/First visit/]);
  await page.getByTestId('nb-tag-filter').selectOption('');

  // reorder by keyboard: Alt+↑ twice moves "Third" to the top, and focus stays on it
  const third = page.getByTestId('nb-note').filter({ hasText: 'Third' }).locator('button');
  await third.focus();
  await page.keyboard.press('Alt+ArrowUp');
  await page.keyboard.press('Alt+ArrowUp');
  await expect(page.getByTestId('nb-note')).toHaveText([/Third/, /First visit/, /Contact note/]);
  await expect(page.getByTestId('nb-note').first().locator('button')).toBeFocused();
  // Delete in the notebook list is not the map's Delete key; the undo toast puts a deleted note back
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('nb-note')).toHaveCount(3);
  await page.getByTestId('nb-note').filter({ hasText: 'First visit' }).locator('button').click();
  await page.getByTestId('nb-delete').click();
  await expect(page.getByTestId('nb-note')).toHaveCount(2);
  await page.getByTestId('nb-toast-undo').click();
  await expect(page.getByTestId('nb-note')).toHaveText([/Third/, /First visit/, /Contact note/]);

  // autosave: everything is there after a reload, in the same order, with the notebook still open
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByTestId('notebook')).toBeVisible();
  await expect(page.getByTestId('nb-note')).toHaveText([/Third/, /First visit/, /Contact note/]);
  // SL28 point 6: the note left open is open again after the reload (a click on its row would collapse it)
  await expect(page.getByTestId('nb-note').filter({ hasText: 'First visit' }).locator('button')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('nb-body').locator('ul li')).toHaveText('food bank on Tuesdays');
  await expect(page.getByTestId('nb-tags')).toHaveValue('housing, food');
  await page.getByTestId('nb-note').filter({ hasText: 'Contact note' }).locator('button').click();
  await expect(page.getByTestId('nb-field-discussed')).toHaveText('Bus pass renewal.');
  // the toolbar's Undo covers notebook edits
  await page.getByTestId('nb-title').fill('Contact note, renamed');
  await expect(page.getByTestId('nb-note')).toHaveText([/Third/, /First visit/, /renamed/]);
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('nb-list')).not.toContainText('renamed');
  await expect(page.getByTestId('nb-note')).toHaveCount(3);
});

test('flag, then label: the stored value is gone, the count drops, and Undo cannot bring it back', async ({ page }) => {
  await start(page, 'SL26 flags');
  await openNotebook(page);
  await newFree(page, 'Call', 'Mr. Jones called from (256) 555-0134. Jones lives at 1420 Oak Street.');
  await expect(page.getByTestId('nb-flag-count')).toHaveText(/3 possible identifiers/);
  await expect(page.getByTestId('nb-body').locator('.nb-flag')).toHaveCount(3);
  await expect(page.getByTestId('view-menu')).toContainText('3'); // SL35: the count stays visible on the closed menu
  await page.waitForTimeout(300);
  expect(await stored(page)).toContain('Mr. Jones');
  await page.getByTestId('nb-flag-count').click();
  await expect(page.getByTestId('nb-heuristic')).toContainText('heuristic');
  await page.getByTestId('nb-flag').filter({ has: page.locator('mark', { hasText: 'Mr. Jones' }) }).getByTestId('nb-flag-label').click();
  await expect(page.getByTestId('nb-body')).toHaveText('[Person A] called from (256) 555-0134. [Person A] lives at 1420 Oak Street.');
  await expect(page.getByTestId('nb-flag-count')).toHaveText(/2 possible identifiers/);
  await expect(page.getByTestId('nb-toast')).toContainText('[Person A]');
  // "Not an identifier" is remembered
  await page.getByTestId('nb-flag').filter({ has: page.locator('mark', { hasText: '1420 Oak Street' }) }).getByTestId('nb-flag-dismiss').click();
  await expect(page.getByTestId('nb-flag-count')).toHaveText(/1 possible identifier$/);
  await expect(page.getByTestId('nb-body').locator('.nb-flag')).toHaveCount(1);
  await page.waitForTimeout(300);
  const s = await stored(page);
  expect(s).not.toContain('Jones');
  expect(s).toContain('"replaced":{"person":1}');
  expect(s).toContain('address:1420 oak street');
  // Undo (toolbar and ⌘Z in the field) never restores the replaced name
  for (let i = 0; i < 5; i++) if (await page.getByTestId('undo').isEnabled()) await page.getByTestId('undo').click();
  await page.waitForTimeout(300);
  expect(await stored(page)).not.toContain('Jones');
  await page.reload();
  await openNotebook(page);
  await expect(page.getByTestId('notebook')).not.toContainText('Jones');
});

test('every export warns while flags remain; label them all first, continue anyway, or save without the notebook', async ({ page }) => {
  await start(page, 'SL26 export');
  await openNotebook(page);
  await newFree(page, 'Call', 'Write to ana.ruiz@example.org about the 3/14/2026 visit.');
  await expect(page.getByTestId('nb-flag-count')).toHaveText(/2 possible identifiers/);
  // the warning; Cancel exports nothing
  await menuItem(page, 'export-csv');
  await expect(page.getByTestId('nb-warn')).toBeVisible();
  await expect(page.getByTestId('nb-warn-count')).toContainText('2 possible identifiers');
  await page.getByTestId('nb-warn-cancel').click();
  await expect(page.getByTestId('nb-warn')).toBeHidden();
  // Print warns too
  await page.getByTestId('nb-print').click();
  await expect(page.getByTestId('nb-warn')).toBeVisible();
  await page.getByTestId('nb-warn-cancel').click();
  // continue anyway: the file carries the notebook as it is (schema 3)
  await menuItem(page, 'export-json');
  let [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('nb-warn-anyway').click()]);
  let p = test.info().outputPath('anyway.json');
  await d.saveAs(p);
  let file = JSON.parse(fs.readFileSync(p, 'utf8'));
  expect(file.schema_version).toBe(3);
  expect(JSON.stringify(file.notebook)).toContain('ana.ruiz@example.org');
  // the map without the notebook: schema 2, no warning
  [d] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-json-bare')]);
  p = test.info().outputPath('bare.json');
  await d.saveAs(p);
  file = JSON.parse(fs.readFileSync(p, 'utf8'));
  expect(file.schema_version).toBe(2);
  expect(file.notebook).toBeUndefined();
  // label them all, then the export goes ahead with the labels
  await menuItem(page, 'export-json');
  [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('nb-warn-label').click()]);
  p = test.info().outputPath('labelled.json');
  await d.saveAs(p);
  const text = fs.readFileSync(p, 'utf8');
  expect(text).not.toContain('ana.ruiz');
  expect(text).not.toContain('3/14/2026');
  expect(JSON.parse(text).notebook.notes[0].body.content[0].content[0].text).toBe('Write to [email] about the [date] visit.');
  await expect(page.getByTestId('nb-flag-count')).toHaveText('No possible identifiers');
  // no flags left: no warning
  [d] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-md')]);
  expect(d.suggestedFilename()).toMatch(/loops\.md$/);
});

test('Clear my data empties the notebook with everything else (H4)', async ({ page }) => {
  await start(page, 'SL26 clear');
  await openNotebook(page);
  await newFree(page, 'To be cleared', 'Some notes ZQX-NB-CLEAR');
  await page.waitForTimeout(300);
  expect(await stored(page)).toContain('ZQX-NB-CLEAR');
  await page.getByTestId('clear-data').click();
  await page.getByTestId('clear-confirm').click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.reload();
  const left = await page.evaluate(async () => {
    const dbs = (await indexedDB.databases()).map((d) => d.name);
    const ls = Object.entries(localStorage).filter(([k, v]) => k.startsWith('sdoh-loops') || v.includes('ZQX-NB-CLEAR'));
    if (!dbs.includes('sdoh-loops')) return { maps: '', ls };
    const maps = await new Promise<string>((res) => {
      const r = indexedDB.open('sdoh-loops');
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('maps')) return res('');
        const g = db.transaction('maps').objectStore('maps').getAll();
        g.onsuccess = () => res(JSON.stringify(g.result));
      };
    });
    return { maps, ls };
  });
  expect(left.maps).not.toContain('ZQX-NB-CLEAR');
  expect(left.ls).toEqual([]);
});

test('axe: the notebook in light and dark, with a flag list open', async ({ page }) => {
  await start(page, 'SL26 axe');
  await openNotebook(page);
  await newFree(page, 'Call', 'Mr. Jones, (256) 555-0134.');
  await page.getByTestId('nb-template').selectOption({ label: 'Intake' });
  await page.getByTestId('nb-flag-count').click();
  await expect(page.getByTestId('nb-flags')).toBeVisible();
  const all = [...(await scan(page, 'light'))];
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  all.push(...(await scan(page, 'dark')));
  expect(all).toEqual([]);
});

test.describe('375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('Map and Notebook are tabs; no horizontal page scroll; axe is clean', async ({ page }) => {
    await start(page, 'SL26 phone');
    await expect(page.getByTestId('notebook-toggle')).toHaveCount(0);
    const tabs = page.getByTestId('nb-tabs');
    await expect(tabs.getByRole('tab')).toHaveText(['Map', 'Notebook']);
    await expect(page.getByTestId('nb-tab-map')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('nb-tab-nb').click();
    await expect(page.getByTestId('nb-tab-nb')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('canvas')).toBeHidden();
    await newFree(page, 'Phone note', 'Met at 22 N Main St. about rent.');
    await page.getByTestId('nb-template').selectOption({ label: 'Case conference' });
    await expect(page.getByTestId('nb-flag-count')).toHaveText(/1 possible identifier/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
    expect(await scan(page, '375')).toEqual([]);
    // arrow keys move between the tabs
    await page.getByTestId('nb-tab-nb').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('nb-tab-map')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('nb-tab-map')).toBeFocused();
    await expect(page.getByTestId('canvas')).toBeVisible();
  });
});

test('Help has a notebook section: what it is for, that it stays on this device, what the check can and cannot catch', async ({ page }) => {
  await page.goto('/help');
  const h = page.getByTestId('notebook-help');
  await expect(h.getByRole('heading', { name: 'The notebook' })).toBeVisible();
  await expect(h).toContainText('Nothing is sent anywhere');
  await expect(h).toContainText('Clear my data');
  await expect(h).toContainText('heuristic, not a guarantee');
});

/** SL26 point 5: the case summary at the foot of the notebook */
const rowsOf = (page: Page, testId: string) =>
  page.getByTestId(testId).locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [tr.getAttribute('data-node'), ...['name', 'code', 'status', 'description', 'links'].map((c) => (tr.querySelector(`[data-cell="${c}"]`) as HTMLElement | null)?.innerText.trim() ?? null)]),
  );

test('case summary: matches the list view row for row; updates live; a row click selects on the canvas', async ({ page }) => {
  await start(page, 'SL26 summary');
  await addNode(page, { code: 'QD71.Z', search: 'evict', circumstance: 'Behind on rent; landlord filed for eviction' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addNode(page, { status: 'undetermined', label: 'Support from sister' });
  await addEdge(page, 'Problems associated with housing, unspecified', 'Problem associated with unemployment');
  await openNotebook(page);
  const sum = page.getByTestId('case-summary');
  // always last, below the notes, even with none
  await expect(page.getByTestId('nb-empty')).toBeVisible();
  await newFree(page, 'Call', 'Notes above the summary.');
  expect(await page.getByTestId('nb-scroll').evaluate((el) => (el.lastElementChild as HTMLElement).dataset.testid)).toBe('case-summary');
  await expect(sum.getByTestId('tile-circumstances')).toContainText('3');
  await expect(sum.getByTestId('tile-links')).toContainText('1');
  await expect(sum.getByTestId('tile-needs-code')).toContainText('1');
  await expect(sum.getByTestId('tile-flags')).toContainText('0');
  await expect(sum.getByRole('button', { name: /Edit|Delete/ })).toHaveCount(0);
  // live: a circumstance added on the map appears at once
  await addNode(page, { code: 'QD51', search: 'low income' });
  await expect(sum.getByTestId('summary-table').locator('tbody tr')).toHaveCount(4);
  await expect(sum.getByTestId('tile-circumstances')).toContainText('4');
  // row for row: the same as the list view's table (both on the page: the notebook stays open in list view)
  await tool(page, 'switch-view');
  await expect(page.getByTestId('list-view')).toBeVisible();
  const list = await rowsOf(page, 'nodes-table');
  expect(list).toHaveLength(4);
  expect(await rowsOf(page, 'summary-table')).toEqual(list);
  await tool(page, 'switch-view');
  // filter by status and sort
  await sum.getByTestId('summary-filter').selectOption({ label: 'Not sure yet' });
  await expect(sum.getByTestId('summary-table').locator('tbody tr')).toHaveText([/Support from sister/]);
  await sum.getByTestId('summary-filter').selectOption('');
  await sum.getByTestId('summary-sort').selectOption('links');
  await expect(sum.getByTestId('summary-table').locator('tbody tr').nth(2)).toContainText(/Support from sister|Low income/);
  // a row click selects it on the canvas
  await sum.getByTestId('summary-table').getByRole('button', { name: 'Problem associated with unemployment' }).click();
  const id = await sum.getByTestId('summary-table').locator('tbody tr').filter({ has: page.locator('[data-cell=name]', { hasText: /^Problem associated with unemployment$/ }) }).getAttribute('data-node');
  await expect(page.getByTestId('canvas-outline').locator(`li[data-node="${id}"]`)).toHaveAttribute('data-selected', 'true');
  // SL30 point 4: at 1400 px the notebook's first opening folded the dock to its rail; unfolded, it shows the selection
  await page.getByTestId('dock-unfold').click();
  await expect(page.getByTestId('dock-card-selection')).toContainText('Selected circumstance');
  expect(await scan(page, 'summary')).toEqual([]);
});
