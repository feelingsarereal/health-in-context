/**
 * SL16 and SL17 (core 0.2.0) inside the consumer fixture, an app that embeds <SdohMap> as an SDOH Interrogator app
 * will: the host sets the selection and hides circumstances by a predicate (SL16); full screen, the peek with the
 * host's lines, and the stacked, collapsible side dock with the host's card (SL17).
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXAMPLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdoh-loops-core/fixtures/consumer/collinson2024.sdohmap.json'), 'utf8'));
const DOCK_KEY = 'sdoh-loops-consumer-fixture:view:dock';

const outline = (page: Page) => page.getByTestId('canvas-outline');
const node = (page: Page, id: string) => outline(page).locator(`li[data-node="${id}"]`);
/** a point on the canvas, in page px, from the outline's rendered geometry */
async function at(page: Page, attr: 'node' | 'edge', id: string) {
  const b = (await page.getByTestId('canvas').boundingBox())!;
  const li = outline(page).locator(`li[data-${attr}="${id}"]`);
  const [x, y] = attr === 'node' ? [Number(await li.getAttribute('data-rx')), Number(await li.getAttribute('data-ry'))] : (await li.getAttribute('data-mid'))!.split(',').map(Number);
  return { x: b.x + x, y: b.y + y };
}
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('map-name')).toHaveText(EXAMPLE.name);
  await expect(node(page, 'n3-eviction')).toHaveAttribute('data-rx', /\d/);
}
async function axe(page: Page, where: string) {
  const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('SL16', () => {
  test('a controlled selection: the host selects a circumstance, the map shows it; a click on the map reaches the host', async ({ page }) => {
    await open(page);
    await page.getByTestId('fixture-select').click();
    await expect(node(page, 'n6-credit')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('inspector')).toContainText('Debt up');
    await expect(page.getByTestId('fixture-card')).toHaveText('Selected here: n6-credit');
    // set from outside: not echoed back as a change
    await expect(page.getByTestId('fixture-events')).not.toContainText('select:');
    // map → host: a click on another circumstance
    const p = await at(page, 'node', 'n3-eviction');
    await page.mouse.click(p.x, p.y);
    await expect(page.getByTestId('fixture-selection')).toHaveText('n3-eviction|');
    await expect(node(page, 'n3-eviction')).toHaveAttribute('data-selected', 'true');
    await expect(node(page, 'n6-credit')).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('fixture-events').locator('li', { hasText: /^select:1:0$/ })).toHaveCount(1);
  });

  test('the node-hide predicate leaves circumstances and their links out of the canvas, the list and the analyses — and nothing is saved', async ({ page }) => {
    await open(page);
    await page.getByTestId('fixture-hide').click();
    for (const id of ['n5-hospital', 'n6-credit', 'n7-policy']) await expect(node(page, id)).toHaveCount(0);
    await expect(outline(page).locator('li[data-node]')).toHaveCount(4);
    await expect(outline(page).locator('li[data-edge]')).toHaveCount(6);
    await expect(page.getByTestId('link-counts')).toHaveText('6 links: 6 evidence · 0 override');
    await expect(page.getByTestId('loops-count')).toHaveText('3');
    await page.getByTestId('switch-view').click();
    await expect(page.getByTestId('nodes-table').locator('tbody tr')).toHaveCount(4);
    await page.getByTestId('switch-view').click();
    // a host selection of a hidden circumstance is ignored
    await page.getByTestId('fixture-select').click();
    await expect(page.getByTestId('inspector-empty')).toBeVisible();
    // shown again: all of it is still there, and the original was never copied
    await page.getByTestId('fixture-hide').click();
    await expect(outline(page).locator('li[data-node]')).toHaveCount(7);
    await expect(page.getByTestId('link-counts')).toHaveText('9 links: 6 evidence · 3 override');
    await expect(node(page, 'n6-credit')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('fixture-stored').locator('li')).toHaveCount(0);
    await expect(page.getByTestId('map-name')).toHaveText(EXAMPLE.name);
  });
});

test.describe('SL17', () => {
  test('full screen: the button and F enter, the button and Esc leave; the dock and the host card come along; the canvas refits', async ({ page }) => {
    await open(page);
    const ws = page.getByTestId('map-workspace');
    const before = (await page.getByTestId('canvas').boundingBox())!;
    await page.getByTestId('fullscreen').click();
    await expect(ws).not.toHaveAttribute('data-fullscreen', 'off');
    await expect(page.getByTestId('fullscreen')).toHaveAttribute('aria-pressed', 'true');
    const box = (await ws.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(1);
    expect(box.y).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(1399);
    await expect(page.getByTestId('fixture-card')).toBeInViewport();
    await expect(page.getByTestId('evidence-toggle')).toBeInViewport();
    expect(box.height).toBeGreaterThanOrEqual(899);
    // only the workspace is on screen: what lies under the middle of the fixture's own section is the workspace
    expect(await page.evaluate(() => {
      const r = document.querySelector('[data-testid="fixture-events"]')!.getBoundingClientRect();
      const y = Math.min(innerHeight - 2, r.top + 2);
      return !!document.elementFromPoint(r.left + 4, y)?.closest('[data-testid="map-workspace"]');
    })).toBe(true);
    // refit: every circumstance inside the canvas at its new size
    const cv = (await page.getByTestId('canvas').boundingBox())!;
    expect(cv.y + cv.height).toBeLessThanOrEqual(901);
    await expect.poll(async () => {
      const bbs = await outline(page).locator('li[data-node]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-bb')!.split(',').map(Number)));
      return bbs.every(([x1, y1, x2, y2]) => x1 >= 0 && y1 >= 0 && x2 <= cv.width && y2 <= cv.height);
    }).toBe(true);
    await page.getByTestId('fullscreen').click();
    await expect(ws).toHaveAttribute('data-fullscreen', 'off');
    await expect.poll(async () => (await page.getByTestId('canvas').boundingBox())!.height).toBeCloseTo(before.height, 0);
    // the key, and Esc
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('f');
    await expect(ws).not.toHaveAttribute('data-fullscreen', 'off');
    await page.keyboard.press('Escape');
    await expect(ws).toHaveAttribute('data-fullscreen', 'off');
    // a view state: the map was never edited
    await expect(page.getByTestId('map-name')).toHaveText(EXAMPLE.name);
    await expect(page.getByTestId('fixture-stored').locator('li')).toHaveCount(0);
  });

  test('full screen where the Fullscreen API is refused: a fixed overlay over the page; Esc leaves it', async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('refused'));
    });
    await open(page);
    const ws = page.getByTestId('map-workspace');
    await page.getByTestId('fullscreen').click();
    await expect(ws).toHaveAttribute('data-fullscreen', 'overlay');
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    const box = (await ws.boundingBox())!;
    expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 1400, 900]);
    await expect(page.getByTestId('fixture-card')).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(ws).toHaveAttribute('data-fullscreen', 'off');
  });

  test('peek on a circumstance by right-click: its facts, the host’s line, Associations…; Esc and click-away close it', async ({ page }) => {
    await open(page);
    const p = await at(page, 'node', 'n3-eviction');
    await page.mouse.click(p.x, p.y, { button: 'right' });
    const peek = page.getByTestId('peek');
    await expect(peek).toHaveAttribute('data-kind', 'node');
    await expect(peek.getByTestId('peek-code')).toContainText('QD71.Z');
    await expect(peek.getByTestId('peek-title')).toHaveText('Eviction order');
    await expect(peek.getByTestId('peek-out')).toHaveText(/^5: /);
    await expect(peek.getByTestId('peek-in')).toHaveText(/^3: /);
    await expect(peek.getByTestId('peek-loops')).toContainText('R1');
    await expect(peek.getByTestId('fixture-peek')).toHaveText('From the host: n3-eviction');
    // read-only: nothing to type into
    await expect(peek.locator('input, textarea, select, [contenteditable="true"]')).toHaveCount(0);
    expect(await axe(page, 'peek')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(peek).toHaveCount(0);
    // click-away
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await expect(peek).toBeVisible();
    await page.getByTestId('map-name').click();
    await expect(peek).toHaveCount(0);
    // the association menu moved into the peek (the A key and the toolbar keep theirs)
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await peek.getByTestId('peek-assoc').click();
    await expect(page.getByTestId('assoc-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('assoc-menu')).toBeHidden();
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('a');
    await expect(page.getByTestId('assoc-menu')).toBeVisible();
  });

  test('peek on a link by Ctrl-click: from → to, polarity, weight, delay, basis with grade, mechanism with refs; Open in editor selects it', async ({ page }) => {
    await open(page);
    const edge = outline(page).locator('li[data-basis="evidence"]').first();
    const id = (await edge.getAttribute('data-edge'))!;
    const p = await at(page, 'edge', id);
    await page.mouse.move(p.x, p.y);
    await page.keyboard.down('Control');
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up('Control');
    const peek = page.getByTestId('peek');
    await expect(peek).toHaveAttribute('data-kind', 'edge');
    await expect(peek.getByTestId('peek-title')).toContainText('→');
    await expect(peek.getByTestId('peek-polarity')).not.toBeEmpty();
    await expect(peek.getByTestId('peek-facts')).toContainText('Weight');
    await expect(peek.getByTestId('peek-facts')).toContainText('Delay');
    await expect(peek.getByTestId('peek-basis')).toContainText(/evidence\s+L\d+/);
    await expect(peek.getByTestId('peek-basis').locator('[data-grade]')).toHaveCount(1);
    const cite = peek.getByTestId('peek-mechanism').getByRole('button', { name: /^Reference \d+$/ }).first();
    await cite.click();
    await expect(peek.getByTestId('cite-foldout')).toBeVisible();
    await expect(peek.getByTestId('fixture-peek')).toHaveText(`From the host: ${id}`);
    await peek.getByTestId('peek-open').click();
    await expect(peek).toHaveCount(0);
    await expect(page.getByTestId('edge-inspector')).toBeVisible();
    await expect(page.getByTestId('fixture-selection')).toHaveText(`|${id}`);
  });

  test('peek from the keyboard: Shift+F10 on a circumstance and the ContextMenu key on a link; Esc gives focus back', async ({ page }) => {
    await open(page);
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+F10');
    const peek = page.getByTestId('peek');
    await expect(peek).toHaveAttribute('data-kind', 'node');
    await expect(peek).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(peek).toHaveCount(0);
    await expect(page.getByTestId('canvas')).toBeFocused();
    // a link: chosen in the Links panel, then the ContextMenu key on the canvas
    await page.getByTestId('panel-links').click();
    await page.getByTestId('links-item').first().getByRole('button').first().click();
    await expect(page.getByTestId('edge-inspector')).toBeVisible();
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('ContextMenu');
    await expect(peek).toHaveAttribute('data-kind', 'edge');
    await expect(peek).toBeFocused();
  });

  test('the dock: Edit and Analyse on top, the host card below, all in view at 1440×900; cards and the whole dock collapse, and that is remembered', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const dock = page.getByTestId('side-dock');
    const editor = page.getByTestId('dock-card-edit');
    const analyse = page.getByTestId('dock-card-analyse');
    const host = page.getByTestId('dock-card-host:source');
    const eb = (await editor.boundingBox())!;
    const ab = (await analyse.boundingBox())!;
    const hb = (await host.boundingBox())!;
    expect(eb.y).toBeLessThan(ab.y);
    expect(ab.y).toBeLessThan(hb.y);
    for (const b of [eb, ab, hb]) expect(b.y + b.height).toBeLessThanOrEqual(900);
    await expect(page.getByTestId('fixture-card')).toBeInViewport();
    await expect(page.getByTestId('panel-inspect')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight && scrollY > 0)).toBe(false);
    // one card collapses by its header; the other takes the room
    const t = page.getByTestId('dock-card-edit-toggle');
    await expect(t).toHaveAttribute('aria-expanded', 'true');
    await t.click();
    await expect(t).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('dock-card-edit-body')).toBeHidden();
    expect((await host.boundingBox())!.height).toBeGreaterThan(hb.height);
    // the whole dock: ] collapses it to a rail; the canvas spans the workspace
    await page.getByTestId('canvas').focus();
    await page.keyboard.press(']');
    await expect(dock).toHaveAttribute('data-open', 'false');
    await expect(page.getByTestId('dock-rail')).toBeVisible();
    const ws = (await page.getByTestId('map-workspace').boundingBox())!;
    await expect.poll(async () => (await page.getByTestId('canvas').boundingBox())!.width).toBeGreaterThan(ws.width - 80);
    expect(await axe(page, 'dock collapsed')).toEqual([]);
    // remembered per viewer, under the host's slug, and never in the map
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), DOCK_KEY))!)).toEqual({ open: false, closed: ['edit'] });
    await page.reload();
    await expect(page.getByTestId('dock-rail')).toBeVisible();
    await expect(page.getByTestId('fixture-stored').locator('li')).toHaveCount(0);
    // the rail shows each card's title and reopens the dock at that card
    await expect(page.getByTestId('dock-rail')).toContainText('In the source');
    await page.getByTestId('dock-rail-edit').click();
    await expect(dock).toHaveAttribute('data-open', 'true');
    await expect(page.getByTestId('dock-card-edit-body')).toBeVisible();
    // blocked or empty storage: the defaults
    await page.evaluate((k) => localStorage.setItem(k, 'not json'), DOCK_KEY);
    await page.reload();
    await expect(dock).toHaveAttribute('data-open', 'true');
  });

  test('narrow screens keep the panels below the canvas (no rail)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await expect(page.getByTestId('dock-fold')).toHaveCount(0);
    await expect(page.getByTestId('dock-resize')).toHaveCount(0);
    const cv = (await page.getByTestId('canvas').boundingBox())!;
    const ed = (await page.getByTestId('dock-card-edit').boundingBox())!;
    expect(ed.y).toBeGreaterThan(cv.y + cv.height - 1);
    await expect(page.getByTestId('dock-card-host:source')).toBeAttached();
  });
});
