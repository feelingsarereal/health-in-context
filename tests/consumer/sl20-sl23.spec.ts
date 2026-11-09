/**
 * SL20–SL23 (core 0.4.0) in the consumer fixture, which embeds <SdohMap> with a read-only original as an SDOH
 * Interrogator app does: loop glyph hit targets (SL20), the light /theme entry's first chunk (SL21), the host's own
 * notice (SL22), and the dock's selection and Whole map cards with the Map menu (SL23). The Read / Edit toggle on an
 * editable map is checked in the standalone app (tests/regressions/sl23-dock.spec.ts).
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tool, menuItem } from '../helpers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = path.join(ROOT, 'packages/sdoh-loops-core/fixtures/consumer');
const PACK = path.join(ROOT, 'packages/sdoh-loops-pack/data');
const outline = (page: Page) => page.getByTestId('canvas-outline');

async function open(page: Page, w = 1440, h = 900) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/');
  await expect(outline(page).locator('li[data-node="n3-eviction"]')).toHaveAttribute('data-rx', /\d/);
}
async function axe(page: Page, where: string, rules?: string[]) {
  const b = new AxeBuilder({ page: page as never });
  const res = await (rules ? b.withRules(rules) : b.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])).analyze();
  return res.violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('SL20', () => {
  test('on a phone, zoomed out, every loop glyph keeps a 24 × 24 px hit target while its face shrinks; axe target-size is clean', async ({ page }) => {
    await open(page, 390, 844);
    for (let i = 0; i < 4; i++) await tool(page, 'zoom-out');
    const glyphs = page.getByTestId('loop-glyph');
    await expect(glyphs).toHaveCount(3);
    await expect.poll(async () => Number(await glyphs.first().getAttribute('data-scale'))).toBeLessThan(0.8);
    for (const g of await glyphs.all()) {
      const hit = (await g.boundingBox())!;
      const face = (await g.getByTestId('loop-glyph-face').boundingBox())!;
      expect(hit.width).toBeGreaterThanOrEqual(24);
      expect(hit.height).toBeGreaterThanOrEqual(24);
      expect(face.height).toBeLessThan(30);
    }
    // the WCAG 2.2 target-size rule (what Lighthouse's target-size audit runs)
    expect(await axe(page, 'phone, zoomed out', ['target-size'])).toEqual([]);
  });
});

test.describe('SL21', () => {
  test('the first chunk imports only the light /theme entry: no situations or references data; the map chunk carries them', () => {
    const html = fs.readFileSync(path.join(FIXTURE, 'dist/index.html'), 'utf8');
    const entry = /<script type="module"[^>]*src="\/?([^"]+)"/.exec(html)![1];
    const first = fs.readFileSync(path.join(FIXTURE, 'dist', entry), 'utf8');
    // markers of each heavy pack file: a reference key and a code's WHO link
    const refKey = JSON.parse(fs.readFileSync(path.join(PACK, 'references.json'), 'utf8'))[0].key as string;
    const schemeId = JSON.parse(fs.readFileSync(path.join(PACK, 'situations.json'), 'utf8')).codes[0].who_browser as string; // a code's WHO link
    expect(first).not.toContain(refKey);
    expect(first).not.toContain(schemeId);
    expect(first).toContain('bx-theme'); // the ThemeProvider is in it
    expect(first.length).toBeLessThan(250_000);
    // the modulepreload list of the first page names no chunk with the pack in it
    const preloads = [...html.matchAll(/rel="modulepreload"[^>]*href="\/?([^"]+)"/g)].map((m) => fs.readFileSync(path.join(FIXTURE, 'dist', m[1]), 'utf8'));
    for (const p of preloads) expect(p).not.toContain(refKey);
    const chunks = fs.readdirSync(path.join(FIXTURE, 'dist/assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(FIXTURE, 'dist/assets', f), 'utf8'));
    expect(chunks.some((c) => c.includes(refKey) && c.includes(schemeId))).toBe(true);
  });
});

test.describe('SL22', () => {
  test('H5 in the consumer: the host’s own notice shows through <Notice text>, not the pack’s wording', async ({ page }) => {
    await open(page);
    const n = page.getByTestId('notice');
    await expect(n).toHaveAttribute('role', 'note');
    await expect(n.getByTestId('notice-text')).toHaveText(/^Consumer fixture notice: .*not advice about anyone\.$/);
  });
});

test.describe('SL23', () => {
  test('a read-only original: no Read / Edit toggle, the selection card stays in Read with no edit control in the DOM; titles follow the selection', async ({ page }) => {
    await open(page);
    const title = page.getByTestId('dock-card-selection-toggle');
    await expect(title).toHaveText(/Nothing selected$/);
    await expect(page.getByTestId('inspector-empty')).toBeAttached(); // SL35: inside the collapsed Selected card
    await expect(page.getByTestId('mode-toggle')).toHaveCount(0);
    await page.getByTestId('fixture-select').click();
    await expect(title).toHaveText(/Selected circumstance$/);
    const body = page.getByTestId('selection-body');
    await expect(body.getByTestId('selection-read')).toHaveAttribute('data-kind', 'node');
    await expect(body.getByTestId('read-title')).toHaveText('Debt up, credit score down');
    await expect(body.getByTestId('read-status')).not.toBeEmpty();
    await expect(body.getByTestId('read-pinned')).toHaveText('No');
    for (const id of ['delete-node', 'inspector-assoc', 'inspector-link-to', 'status-sdoh', 'choose-code', 'change-code', 'delete-edge']) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(body.locator('input, select, textarea, [contenteditable="true"]')).toHaveCount(0);
    // E does nothing on a read-only original
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('e');
    await expect(page.getByTestId('mode-toggle')).toHaveCount(0);
    await expect(page.getByTestId('fixture-stored').locator('li')).toHaveCount(0);
    // a link
    await page.getByTestId('panel-links').click();
    await page.getByTestId('links-item').first().getByRole('button').first().click();
    await expect(title).toHaveText(/Selected link$/);
    await expect(body.getByTestId('read-basis')).toContainText(/evidence|override|review/);
    // several
    await page.getByTestId('panel-clusters').click();
    await page.getByTestId('clusters-panel').getByRole('button').first().click();
    await expect(title).toHaveText(/Selected: \d+ circumstances$/);
    expect(await axe(page, 'read-only, Read')).toEqual([]);
  });

  test('at 1440×900 with both cards open, a typical circumstance reads in the selection card without scrolling', async ({ page }) => {
    await open(page);
    await page.getByTestId('fixture-select').click(); // n6-credit: a code, a label, links in and out
    const body = page.getByTestId('selection-body');
    await expect(body.getByTestId('read-title')).toBeVisible();
    await expect(page.getByTestId('dock-card-whole-body')).toBeVisible();
    const [sh, ch] = await body.evaluate((el) => [el.scrollHeight, el.clientHeight]);
    // the facts (above the WHO code text) are all in view; the code's own text may scroll below
    const facts = await body.locator('dl').first().boundingBox();
    const bb = (await body.boundingBox())!;
    expect(facts!.y + facts!.height).toBeLessThanOrEqual(bb.y + bb.height + 1);
    expect(sh).toBeGreaterThan(0);
    expect(ch).toBeGreaterThan(150);
    await expect(page.getByTestId('panel-loops')).toBeInViewport();
  });

  test('the Whole map card: the evidence toggle on top, nine tabs; Map & export, Selected and To code are gone from the dock', async ({ page }) => {
    await open(page);
    const whole = page.getByTestId('dock-card-whole');
    await expect(whole.getByRole('heading', { level: 2, name: 'Whole map', exact: true })).toBeVisible();
    await expect(whole.getByTestId('evidence-toggle')).toBeVisible();
    await expect(whole.getByRole('group', { name: 'Panels' }).getByRole('button')).toHaveText([/^Loops\s*3$/, 'Links', 'Paths', 'Leverage', 'What-if', 'Clusters', 'Legend', /^Needs a code/, 'About this map']);
    for (const id of ['panel-map', 'panel-inspect', 'panel-tocode']) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByTestId('side-dock')).not.toContainText(/Map & export|To code|Analy[sz]e\b/);
    // About this map on a read-only original: text only
    await page.getByTestId('panel-about').click();
    await expect(page.getByTestId('about-map')).toHaveAttribute('data-mode', 'read');
    await expect(page.getByTestId('about-map').locator('input, select, textarea, [contenteditable="true"]')).toHaveCount(0);
  });

  test('Needs a code at zero: visible, greyed out (aria-disabled) with its tooltip; axe clean', async ({ page }) => {
    await open(page);
    const tab = page.getByTestId('panel-needsCode');
    await expect(tab).toBeVisible();
    // the fixture has needs-review links? then the tab lists them; else it is greyed out
    const disabled = await tab.getAttribute('aria-disabled');
    if (disabled === 'true') {
      await expect(tab).toHaveAttribute('title', 'Every circumstance has a code status');
      await tab.click({ force: true }); // greyed out: a click does nothing
      await expect(page.getByTestId('panel-body-needsCode')).toHaveCount(0);
    } else {
      await tab.click();
      await expect(page.getByTestId('needs-code-lead')).toBeVisible();
    }
    expect(await axe(page, 'needs a code')).toEqual([]);
  });

  test('the Map menu: beside the title; by click and by keyboard; "Open a map file…" first; save, import round-trip, ⌘O, ⌘S, the host item; axe clean', async ({ page }) => {
    await open(page);
    const btn = page.getByTestId('map-menu');
    await expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    const nb = (await page.getByTestId('map-name').boundingBox())!;
    const bb = (await btn.boundingBox())!;
    expect(bb.x).toBeGreaterThan(nb.x + nb.width - 1);
    expect(Math.abs(bb.y + bb.height / 2 - (nb.y + nb.height / 2))).toBeLessThan(20);
    // click
    await btn.click();
    const menu = page.getByRole('menu', { name: 'Map file' });
    await expect(menu).toBeVisible();
    const items = menu.getByRole('menuitem');
    await expect(items.first()).toHaveText(/^Open a map file…/);
    await expect(items.first()).toBeFocused();
    await expect(items.first()).toHaveAccessibleDescription('A map exported from Health in Context or an SDOH Interrogator app');
    await expect(menu.getByRole('menuitemcheckbox', { name: /Print \/ grayscale/ })).toHaveAttribute('aria-checked', 'false');
    await expect(menu.getByTestId('menu-host-fixture-reset')).toHaveText(/Fixture: log a host action/);
    expect(await axe(page, 'map menu open')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(btn).toBeFocused();
    // keyboard: ArrowDown opens on the first item, ArrowUp on the last; arrows move; Enter runs the host's item
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByTestId('menu-host-fixture-reset')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('fixture-events')).toContainText('host-menu');
    await btn.focus();
    await page.keyboard.press('ArrowDown');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByTestId('export-json')).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu.getByTestId('menu-host-fixture-reset')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('Escape');
    // save a copy, then open it again: a new map in the host's store, opened through onOpenMap
    const [d] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-json')]);
    const file = test.info().outputPath(d.suggestedFilename());
    await d.saveAs(file);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).nodes).toHaveLength(7);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), menuItem(page, 'menu-open')]);
    await chooser.setFiles(file);
    await expect(page.getByTestId('import-msg')).toHaveText(/Imported/);
    await expect(page.getByTestId('fixture-events')).toContainText(/open:map-/);
    await expect(page.getByTestId('fixture-stored')).toContainText('(imported) · 9 links');
    // ⌘O / Ctrl+O and ⌘S / Ctrl+S, from the canvas
    await page.getByTestId('canvas').focus();
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('ControlOrMeta+o')]);
    expect(fc.isMultiple()).toBe(false);
    const [d2] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('ControlOrMeta+s')]);
    expect(d2.suggestedFilename()).toMatch(/\.sdohmap\.json$/);
  });
});
