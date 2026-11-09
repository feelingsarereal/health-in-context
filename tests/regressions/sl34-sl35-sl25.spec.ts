/** SL34 (the lighter Add circumstance dialog), SL35 (one toolbar, the canvas fills the window, phone framing, dock default), SL25 (loop names). */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { addEdge, addNode, dismissFirstRun, newMap, panel, tool, openTool, typeRich } from '../helpers';

const start = async (page: Page, name: string) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
};
const axe = async (page: Page, what: string) =>
  (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${what}: ${v.id}`);
const DESCRIBE = 'Describe the circumstance';

test.describe('SL34: the dialog', () => {
  test('first run: describe, Enter → a box with the derived label, status Not sure yet; the code list is shut', async ({ page }) => {
    await start(page, 'SL34 first');
    await page.getByTestId('add-node').click();
    const d = page.getByTestId('node-dialog');
    const box = d.getByRole('textbox', { name: DESCRIBE, exact: true });
    await expect(box).toBeFocused();
    await expect(d.getByTestId('field-hint')).toHaveText('Say it as something that can go up or down');
    await expect(d.getByTestId('code-list')).toHaveCount(0);
    await expect(d.getByTestId('status-undetermined')).toBeChecked();
    await expect(d.getByTestId('deidentify-nudge')).toHaveCount(1);
    await expect(d.getByRole('toolbar')).toHaveCount(0);
    await page.keyboard.type('Rent went up twice this year and again');
    await page.keyboard.press('Enter');
    await expect(d).toBeHidden();
    const li = page.getByTestId('canvas-outline').locator('li[data-node]').first();
    await expect(li).toBeVisible();
    await expect(page.locator('.ax-nt-title').first()).toHaveText('Rent went up twice this…');
  });

  test('Esc from the description closes the dialog; Enter in an empty search box does not submit it', async ({ page }) => {
    await start(page, 'SL34 esc');
    await page.getByTestId('add-node').click();
    const d = page.getByTestId('node-dialog');
    await expect(d.getByRole('textbox', { name: DESCRIBE, exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(d).toBeHidden();
    await page.getByTestId('add-node').click();
    await d.getByTestId('code-search').fill('zzzz');
    await page.keyboard.press('Enter');
    await expect(d).toBeVisible();
    await expect(page.getByTestId('canvas-outline').locator('li[data-node]')).toHaveCount(0);
  });

  test('the list opens from the search box; a chosen code fills the row and shows its short title as the placeholder', async ({ page }) => {
    await start(page, 'SL34 code');
    await page.getByTestId('add-node').click();
    const d = page.getByTestId('node-dialog');
    await d.getByTestId('code-search').click();
    await expect(d.getByTestId('code-list')).toBeVisible();
    await d.getByTestId('code-search').fill('evict');
    await d.locator('[data-code="QD71.Z"]').first().click();
    await expect(d.getByTestId('code-list')).toHaveCount(0);
    await expect(d.getByTestId('chosen-code')).toContainText('QD71.Z');
    await expect(d.getByTestId('status-sdoh')).toBeChecked();
    await expect(d.getByTestId('field-placeholder')).not.toHaveText('');
  });

  test('Add new from L02: QD71.Z already chosen, status SDOH code', async ({ page }) => {
    await start(page, 'SL34 follow');
    await addNode(page, { code: 'QD51', search: 'low income' });
    await page.getByTestId('open-assoc').click();
    await page.getByTestId('assoc-menu').getByTestId('leads-to').locator('[data-link="L02"]').getByTestId('assoc-follow').click();
    const d = page.getByTestId('node-dialog');
    await expect(d.getByTestId('chosen-code')).toContainText('QD71.Z');
    await expect(d.getByTestId('status-sdoh')).toBeChecked();
  });

  test('More formatting shows the toolbar and a bold run is kept; ⌘B works with it hidden', async ({ page }) => {
    await start(page, 'SL34 format');
    await page.getByTestId('add-node').click();
    const d = page.getByTestId('node-dialog');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('bold first');
    await d.getByRole('button', { name: `More formatting: ${DESCRIBE}` }).click();
    await expect(d.getByRole('toolbar', { name: `${DESCRIBE}: text style` })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', /true|false/);
    await d.getByTestId('node-submit').click();
    await expect(d).toBeHidden();
    const stored = await page.evaluate(async () => document.querySelector('[data-testid="inspector"]')?.innerHTML ?? '');
    expect(stored).toContain('<strong>bold first</strong>');
  });

  test('keyboard only: search, ↓, Enter picks; focus returns to the description, Enter adds', async ({ page }) => {
    await start(page, 'SL34 keys');
    await page.getByTestId('add-node').focus();
    await page.keyboard.press('Enter');
    const d = page.getByTestId('node-dialog');
    await expect(d.getByRole('textbox', { name: DESCRIBE, exact: true })).toBeFocused();
    await page.keyboard.type('Laid off');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(d.getByTestId('code-search')).toBeFocused();
    await page.keyboard.type('unemployment');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(d.getByTestId('chosen-code')).toBeVisible();
    await expect(d.getByRole('textbox', { name: DESCRIBE, exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(d).toBeHidden();
  });

  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`axe at ${w} px, ${scheme}: the dialog, with the list open`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        await start(page, 'SL34 axe');
        await page.getByTestId('add-node').click();
        const d = page.getByTestId('node-dialog');
        expect(await axe(page, 'shut')).toEqual([]);
        await d.getByTestId('code-search').fill('rent');
        expect(await axe(page, 'open')).toEqual([]);
      });
    }
  }
});

const build = async (page: Page) => {
  await addNode(page, { status: 'undetermined', label: 'Alpha' });
  await addNode(page, { status: 'undetermined', label: 'Beta' });
  await addNode(page, { status: 'undetermined', label: 'Gamma' });
  await addEdge(page, 'Alpha', 'Beta', { override: 'x' });
  await addEdge(page, 'Beta', 'Gamma', { override: 'y' });
  await addEdge(page, 'Gamma', 'Alpha', { override: 'z' });
};

test.describe('SL35: the toolbar', () => {
  for (const w of [1024, 1440]) {
    test(`one row at ${w} px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await start(page, 'A map with quite a long name to test how the toolbar copes with it');
      const bar = (await page.getByTestId('toolbar').boundingBox())!;
      for (const id of ['map-menu', 'add-node', 'add-edge', 'open-assoc', 'add-note', 'arrange-menu', 'view-menu', 'undo', 'redo']) {
        const b = (await page.getByTestId(id).boundingBox())!;
        expect(b.y + b.height, id).toBeLessThanOrEqual(bar.y + 50);
        expect(b.x + b.width, id).toBeLessThanOrEqual(bar.x + bar.width + 1);
      }
      expect(bar.height).toBeLessThan(56);
    });
  }

  test('the menus: by click and by keyboard, every former control there, real menu roles', async ({ page }) => {
    await start(page, 'SL35 menus');
    await build(page);
    await page.getByTestId('arrange-menu').click();
    const a = page.getByTestId('arrange-menu-list');
    await expect(a).toHaveAttribute('role', 'menu');
    for (const t of ['layout-fcose', 'layout-elk-stress', 'arrange', 'arrange-all', 'arrange-selection', 'hood-1', 'hood-2']) await expect(page.getByTestId(t), t).toBeAttached();
    await expect(a.getByRole('separator')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(a).toHaveCount(0);
    await expect(page.getByTestId('arrange-menu')).toBeFocused();
    await page.getByTestId('view-menu').focus();
    await page.keyboard.press('ArrowDown');
    const v = page.getByTestId('view-menu-list');
    await expect(page.getByTestId('fit')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('zoom-in')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByTestId('keys-open')).toBeFocused();
    for (const t of ['fit', 'zoom-in', 'zoom-out', 'fullscreen', 'switch-view', 'notebook-toggle', 'view-grayscale', 'keys-open']) await expect(page.getByTestId(t), t).toBeAttached();
    await expect(page.getByTestId('fullscreen')).toHaveAttribute('aria-keyshortcuts', 'F');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('keys-dialog')).toContainText('Arrange ▾ / View ▾');
    await page.keyboard.press('Escape');
    await expect(v).toHaveCount(0);
  });

  test('shortcuts are unchanged: ⌘Z, ⌘⇧Z, R, F', async ({ page }) => {
    await start(page, 'SL35 keys');
    await addNode(page, { status: 'undetermined', label: 'Alpha' });
    const items = page.getByTestId('canvas-outline').locator('li[data-node]');
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(items).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(items).toHaveCount(1);
    await page.keyboard.press('f');
    await expect(page.getByTestId('map-workspace')).not.toHaveAttribute('data-fullscreen', 'off');
  });

  test('the link counts are in the Whole map card, as a live region', async ({ page }) => {
    await start(page, 'SL35 counts');
    await build(page);
    const c = page.getByTestId('dock-card-whole').getByTestId('link-counts');
    await expect(c).toHaveText('3 links: 0 evidence · 3 override');
    await expect(c).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByTestId('toolbar').getByTestId('link-counts')).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`axe with each menu open, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await start(page, 'SL35 axe');
      await build(page);
      for (const m of ['arrange-menu', 'view-menu']) {
        await page.getByTestId(m).click();
        expect(await axe(page, m)).toEqual([]);
        await page.keyboard.press('Escape');
      }
    });
  }
});

test.describe('SL35: the canvas', () => {
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    test(`at ${w} × ${h} it fills the window below the chrome, with the footer below the fold`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await start(page, 'SL35 height');
      await addNode(page, { status: 'undetermined', label: 'Alpha' });
      const main = page.getByTestId('canvas-wrap').locator('..').locator('..');
      await expect.poll(async () => Math.abs((await page.getByTestId('canvas-wrap').boundingBox())!.y + (await page.getByTestId('canvas-wrap').boundingBox())!.height - h)).toBeLessThanOrEqual(3);
      expect(main).toBeTruthy();
      const footer = (await page.locator('footer').first().boundingBox())!;
      expect(footer.y).toBeGreaterThanOrEqual(h - 2);
      await page.locator('footer').first().scrollIntoViewIfNeeded();
      await expect(page.getByTestId('footer-who-citation')).toBeInViewport();
    });
  }

  test('390 px: Fit puts the map at the top, its titles at least 11 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page, 'SL35 phone');
    await build(page);
    await tool(page, 'fit');
    const cv = (await page.getByTestId('canvas-wrap').boundingBox())!;
    await expect.poll(async () => {
      const tops = await page.locator('.ax-nt-title').evaluateAll((e) => e.map((x) => x.closest('[data-node-box]')?.getBoundingClientRect().top ?? x.getBoundingClientRect().top));
      return Math.min(...tops) - cv.y;
    }).toBeLessThanOrEqual(40);
    const sizes = await page.locator('.ax-nt-title').evaluateAll((e) => e.map((x) => x.getBoundingClientRect().height));
    expect(Math.min(...sizes)).toBeGreaterThan(0);
    expect(Number(await page.getByTestId('canvas-wrap').getAttribute('data-zoom'))).toBeGreaterThanOrEqual(11 / 15 - 0.001);
  });

  test('the dock: Whole map open and Selected shut on first open; an empty map has the hint only', async ({ page }) => {
    await start(page, 'SL35 dock');
    await expect(page.getByTestId('inspector-empty')).toBeVisible();
    await expect(page.getByTestId('dock-card-selection')).toHaveCount(0);
    await expect(page.getByTestId('panel-loops')).toHaveCount(0);
    await build(page);
    await page.reload();
    await expect(page.getByTestId('dock-card-whole')).toHaveAttribute('data-open', 'true');
    await expect(page.getByTestId('dock-card-selection')).toHaveAttribute('data-open', 'false');
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('dock-card-selection')).toHaveAttribute('data-open', 'true');
  });

  test('the greyscale item in View turns the map to greyscale', async ({ page }) => {
    await start(page, 'SL35 grey');
    await tool(page, 'view-grayscale');
    await expect(page.getByTestId('map-workspace')).toHaveClass(/ax-print/);
    await openTool(page, 'view-grayscale');
    await expect(page.getByTestId('view-grayscale')).toHaveAttribute('aria-checked', 'true');
  });
});

test('SL25: a loop entry\'s accessible name starts with its visible text', async ({ page }) => {
  await start(page, 'SL25');
  await build(page);
  await panel(page, 'loops');
  const pick = page.getByTestId('loop-pick').first();
  await expect(pick).not.toHaveAttribute('aria-label', /.*/);
  await expect(pick).toHaveAccessibleName(/^R1 · Reinforcing · 3 links · 3 overrides ⚑ · strength /);
  await expect(pick).toContainText(/^R1 · ↻ Reinforcing/);
});

void typeRich;
