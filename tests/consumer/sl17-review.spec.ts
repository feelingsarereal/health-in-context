/**
 * SL17 review findings (Daniel, by clicking, 2026-11-04), in the consumer fixture at 1440×900:
 * 1. the fold control on the dock itself (») and « on the rail, focus following;
 * 2. the layout picker — a visible "Layout" label, Clustered / Evenly spaced, re-arranging at once, with Undo;
 * 3. the dock's core cards split into Edit and Analyse, each collapsible on its own;
 * 4. a resize handle on the dock's left edge, by pointer and keyboard, kept per viewer.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SLUG = 'sdoh-loops-consumer-fixture';
const DOCK_KEY = `${SLUG}:view:dock`;
const W = 1440;
const H = 900;

const outline = (page: Page) => page.getByTestId('canvas-outline');
async function open(page: Page) {
  await page.setViewportSize({ width: W, height: H });
  await page.goto('/');
  await expect(outline(page).locator('li[data-node="n3-eviction"]')).toHaveAttribute('data-rx', /\d/);
}
async function axe(page: Page, where: string) {
  const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}
const dockPref = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), DOCK_KEY);
/** the saved copy's positions, read from the fixture's own IndexedDB store (the slug's database, "maps") */
async function storedPositions(page: Page): Promise<Record<string, { x: number; y: number; pinned: boolean }> | null> {
  return page.evaluate(
    (slug) =>
      new Promise((resolve) => {
        const req = indexedDB.open(slug);
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('maps')) return resolve(null);
          const all = db.transaction('maps').objectStore('maps').getAll();
          all.onsuccess = () => {
            const docs = (all.result as unknown[]).map((d) => (typeof d === 'string' ? JSON.parse(d) : d)).filter((d) => d && Array.isArray(d.nodes));
            const m = docs[docs.length - 1];
            resolve(m ? Object.fromEntries(m.nodes.map((n: { id: string; x: number; y: number; pinned: boolean }) => [n.id, { x: Math.round(n.x), y: Math.round(n.y), pinned: n.pinned }])) : null);
          };
          all.onerror = () => resolve(null);
        };
      }),
    SLUG,
  );
}

test.describe('SL17 review', () => {
  test('1: in full screen the fold control sits on the dock, top right; it folds, the canvas spans the workspace and refits; « reopens and focus returns', async ({ page }) => {
    await open(page);
    // one name for the action: the toolbar's old "Hide the side panels" is gone
    await expect(page.getByRole('button', { name: /side panels/i })).toHaveCount(0);
    await page.getByTestId('fullscreen').click();
    const ws = page.getByTestId('map-workspace');
    await expect(ws).not.toHaveAttribute('data-fullscreen', 'off');
    const dock = page.getByTestId('side-dock');
    const fold = page.getByRole('button', { name: 'Fold the side dock' });
    await expect(fold).toHaveAttribute('title', 'Fold the side dock (])');
    await expect(fold).toHaveAttribute('aria-keyshortcuts', ']');
    const db = (await dock.boundingBox())!;
    const fb = (await fold.boundingBox())!;
    expect(fb.y - db.y).toBeLessThan(48);
    expect(fb.y + fb.height - db.y).toBeLessThanOrEqual(48);
    expect(db.x + db.width - (fb.x + fb.width)).toBeLessThan(4); // flush right
    // beside the first card's header
    const hb = (await page.getByTestId('dock-card-selection-toggle').boundingBox())!;
    expect(Math.abs(hb.y - fb.y)).toBeLessThan(4);
    expect(hb.x + hb.width).toBeLessThanOrEqual(fb.x + 1);
    // one click folds it; the canvas spans the workspace; Fit refits every box inside the wider canvas
    const before = (await page.getByTestId('canvas').boundingBox())!;
    await fold.click();
    await expect(dock).toHaveAttribute('data-open', 'false');
    const wsb = (await ws.boundingBox())!;
    await expect.poll(async () => (await page.getByTestId('canvas').boundingBox())!.width).toBeGreaterThan(wsb.width - 100); // all but the rail
    const cv = (await page.getByTestId('canvas').boundingBox())!;
    expect(cv.width).toBeGreaterThan(before.width + 300);
    await expect.poll(async () => {
      const bbs = await outline(page).locator('li[data-node]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-bb')!.split(',').map(Number)));
      const xs = bbs.flatMap(([x1, , x2]) => [x1, x2]);
      // inside, and centred in the wider canvas (refit, not just resized)
      return bbs.every(([x1, y1, x2, y2]) => x1 >= 0 && y1 >= 0 && x2 <= cv.width && y2 <= cv.height) && Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - cv.width / 2) < 40;
    }).toBe(true);
    // focus went to « on the rail; it reopens the dock and focus moves back to the dock
    const unfold = page.getByRole('button', { name: 'Open the side dock' });
    await expect(unfold).toBeFocused();
    await expect(unfold).toHaveAttribute('title', 'Open the side dock (])');
    const rb = (await page.getByTestId('dock-rail').boundingBox())!;
    expect((await unfold.boundingBox())!.y - rb.y).toBeLessThan(48);
    await unfold.click();
    await expect(dock).toHaveAttribute('data-open', 'true');
    await expect(fold).toBeFocused();
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="side-dock"]'))).toBe(true);
    // ] from the dock folds it too, and focus follows to «
    await page.keyboard.press(']');
    await expect(dock).toHaveAttribute('data-open', 'false');
    await expect(unfold).toBeFocused();
    expect(await axe(page, 'full screen, dock folded')).toEqual([]);
    await page.keyboard.press(']');
    await expect(fold).toBeFocused();
  });

  test('2: the layout picker — a visible "Layout" label, Clustered and Evenly spaced with tooltips; picking one moves the unpinned boxes at once, pinned stay, Undo puts them back', async ({ page }) => {
    await open(page);
    const group = page.getByRole('group', { name: 'Arrange' });
    await expect(group.getByText('Layout', { exact: true })).toBeVisible();
    const pick = group.getByRole('combobox', { name: 'Layout' });
    await expect(pick).toHaveValue('fcose');
    await expect(pick.locator('option')).toHaveText(['Clustered', 'Evenly spaced']);
    await expect(pick.locator('option[value="fcose"]')).toHaveAttribute('title', /groups and loops stand out/);
    await expect(pick.locator('option[value="elk-stress"]')).toHaveAttribute('title', /distance in links/);
    // the picker is grouped with the three arrange buttons
    for (const name of ['Auto-arrange', 'Re-arrange all (ignore pins)', 'Arrange selection']) await expect(group.getByRole('button', { name })).toBeVisible();
    await expect(page.getByTestId('toolbar').getByText(/fCoSE|ELK/)).toHaveCount(0);
    // pin one circumstance (the first edit saves a copy)
    await page.getByTestId('fixture-select').click(); // n6-credit
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('p');
    await expect(outline(page).locator('li[data-node="n6-credit"]')).toHaveAttribute('data-pinned', 'true');
    await expect.poll(async () => (await storedPositions(page))?.['n6-credit']?.pinned).toBe(true);
    const start = (await storedPositions(page))!;
    await pick.selectOption('elk-stress');
    await expect(pick).toHaveValue('elk-stress');
    await expect(page.getByTestId('live')).toContainText('Layout: Evenly spaced');
    // the unpinned boxes moved, at once; the pinned one stayed
    await expect.poll(async () => {
      const now = await storedPositions(page);
      return now ? Object.keys(start).filter((id) => id !== 'n6-credit' && (now[id].x !== start[id].x || now[id].y !== start[id].y)).length : 0;
    }, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
    const moved = (await storedPositions(page))!;
    expect(moved['n6-credit']).toEqual(start['n6-credit']);
    // Undo puts the positions back
    await page.getByTestId('undo').click();
    await expect.poll(async () => {
      const now = await storedPositions(page);
      return now && Object.keys(start).every((id) => now[id].x === start[id].x && now[id].y === start[id].y);
    }).toBe(true);
    expect(await axe(page, 'layout picker')).toEqual([]);
  });

  test('3 (superseded by SL23): the dock\'s core cards collapse on their own and that is remembered', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('side-dock')).not.toContainText(/Editor|Analyse/);
    // collapsing the Whole map leaves the selection card usable
    await page.getByTestId('dock-card-whole-toggle').click();
    await expect(page.getByTestId('dock-card-whole-body')).toBeHidden();
    await page.getByTestId('fixture-select').click();
    await expect(page.getByTestId('inspector')).toContainText('Debt up');
    expect(await dockPref(page)).toEqual({ open: true, closed: ['whole'] });
    await page.reload();
    await expect(page.getByTestId('dock-card-whole-body')).toBeHidden();
    await expect(page.getByTestId('dock-card-selection-body')).toBeVisible();
    expect(await axe(page, 'Whole map collapsed')).toEqual([]);
  });

  test('4: the resize handle — drag and arrow keys within 280 px … half the workspace; kept over a reload and a fold; Home and double-click reset', async ({ page }) => {
    await open(page);
    const handle = page.getByRole('separator', { name: 'Resize the side dock' });
    const dock = page.getByTestId('side-dock');
    await expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    await expect(handle).toHaveAttribute('aria-valuenow', '400');
    const dw = async () => Math.round((await dock.boundingBox())!.width);
    expect(await dw()).toBe(400);
    const gridW = await page.evaluate(() => document.querySelector('[data-testid="side-dock"]')!.parentElement!.parentElement!.getBoundingClientRect().width);
    const max = Math.floor(gridW / 2);
    await expect(handle).toHaveAttribute('aria-valuemax', String(max));
    // on the dock's left edge
    const hb = (await handle.boundingBox())!;
    const db = (await dock.boundingBox())!;
    expect(Math.abs(hb.x + hb.width - db.x)).toBeLessThan(2);
    // pointer drag: wider, and the canvas refits as it goes
    const cv0 = (await page.getByTestId('canvas').boundingBox())!.width;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 - 100, hb.y + hb.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(dw).toBe(500);
    await expect(handle).toHaveAttribute('aria-valuenow', '500');
    await expect.poll(async () => (await page.getByTestId('canvas').boundingBox())!.width).toBeLessThan(cv0 - 90);
    // never past half the workspace, never under 280
    const h1 = (await handle.boundingBox())!;
    await page.mouse.move(h1.x + h1.width / 2, h1.y + h1.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, hb.y + hb.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect.poll(dw).toBe(max);
    const h2 = (await handle.boundingBox())!;
    await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
    await page.mouse.down();
    await page.mouse.move(W - 5, h2.y + h2.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect.poll(dw).toBe(280);
    // keyboard: Left widens by 16, Shift by 64; Right narrows; Home resets
    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '296');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '360');
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '344');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '280'); // the minimum holds
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '344');
    expect(await dw()).toBe(344);
    // kept per viewer: over a reload, and over a fold to the rail and back; never in the map
    expect((await dockPref(page)).width).toBe(344);
    await page.reload();
    await expect(handle).toHaveAttribute('aria-valuenow', '344');
    await page.getByTestId('dock-fold').click();
    await expect(handle).toHaveCount(0);
    await page.getByTestId('dock-unfold').click();
    await expect(handle).toHaveAttribute('aria-valuenow', '344');
    expect(await dw()).toBe(344);
    await expect(page.getByTestId('fixture-stored').locator('li')).toHaveCount(0);
    expect(await axe(page, 'resize handle')).toEqual([]);
    // Home resets; so does a double-click
    await handle.focus();
    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '400');
    expect((await dockPref(page)).width).toBeUndefined();
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '464');
    await handle.dblclick();
    await expect(handle).toHaveAttribute('aria-valuenow', '400');
  });
});
