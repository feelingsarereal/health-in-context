/**
 * SL30: the review fixes from the 0.5.0 walkthrough — no British spelling in visible text or aria-labels (the rich-text
 * toolbars included); a numeric date before a period is flagged and labelled [date], and still flagged after a reload;
 * the workspace fills the viewport at 1440×900, so working in the notebook never scrolls the page; the dock folds once
 * when the notebook first opens under 1600 px; the code line carries WHO's title, on one line with an ellipsis.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addNode, dismissFirstRun, editMode, newMap } from '../helpers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACK_CODES = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdoh-loops-pack/data/situations.json'), 'utf8')).codes as { code: string; title: string }[];
const whoTitle = (c: string) => PACK_CODES.find((x) => x.code === c)!.title;
const DOCK_KEY = 'sdoh-loops:view:dock';
const BRITISH = /colour|analyse|grey(?!scale)/i;

async function start(page: Page, name: string, dock?: object) {
  await page.goto('/');
  await dismissFirstRun(page);
  if (dock) await page.evaluate(([k, v]) => localStorage.setItem(k, v), [DOCK_KEY, JSON.stringify(dock)] as const);
  await newMap(page, name);
}
async function openNotebook(page: Page) {
  const t = page.getByTestId('notebook-toggle');
  if ((await t.getAttribute('aria-pressed')) !== 'true') await t.click();
  await expect(page.getByTestId('notebook')).toBeVisible();
}
/** every visible text, aria-label and option text on the page that matches the denylist */
const british = (page: Page) =>
  page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const out: string[] = [];
    if (re.test(document.body.innerText)) out.push(...document.body.innerText.split('\n').filter((l) => re.test(l)));
    for (const el of document.querySelectorAll('[aria-label], [title], [placeholder]'))
      for (const a of ['aria-label', 'title', 'placeholder']) {
        const v = el.getAttribute(a);
        if (v && re.test(v)) out.push(`${a}: ${v}`);
      }
    for (const o of document.querySelectorAll('option')) if (re.test(o.textContent ?? '')) out.push(`option: ${o.textContent}`);
    return out;
  }, BRITISH.source);
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
/** one line, cut with an ellipsis */
async function oneLineEllipsis(l: Locator) {
  const m = await l.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { ov: cs.textOverflow, ws: cs.whiteSpace, h: el.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight), sw: el.scrollWidth, cw: el.clientWidth };
  });
  expect(m.ov).toBe('ellipsis');
  expect(m.ws).toBe('nowrap');
  expect(m.h).toBeLessThan(m.lh * 1.5);
  expect(m.sw).toBeGreaterThan(m.cw); // the space ran out
}

test('point 1: no "colour", "analyse" or "grey" in visible text or aria-labels — map page, notebook, Add circumstance and Link to…', async ({ page }) => {
  await start(page, 'SL30 spelling');
  await editMode(page);
  await addNode(page, { code: 'QD80', search: 'unemployment', label: 'Lost the job' });
  await addNode(page, { code: 'QD71.Z', search: 'housing' });
  const hits = [...(await british(page))];
  await openNotebook(page);
  await page.getByTestId('nb-template').selectOption({ label: 'Contact note' });
  await page.getByTestId('nb-new').click();
  hits.push(...(await british(page)));
  // the rich-text toolbars: Add circumstance (Short label, Describe the circumstance) and Link to…
  await page.getByTestId('add-node').click();
  const d = page.getByTestId('node-dialog');
  await expect(d).toBeVisible();
  await expect(d.getByRole('combobox', { name: 'Text color' }).first()).toBeVisible();
  await expect(d.getByRole('combobox', { name: 'Text color' }).first().locator('option').first()).toHaveText('Color');
  await expect(d.getByLabel('Custom text color').first()).toBeAttached();
  hits.push(...(await british(page)));
  await page.keyboard.press('Escape');
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('k');
  await expect(page.getByTestId('edge-dialog')).toBeVisible();
  hits.push(...(await british(page)));
  expect(hits).toEqual([]);
});

test('point 2: "on 03/14/2026." is flagged with the rest, labelled [date], and gone from storage; a reload checks the notebook again', async ({ page }) => {
  await start(page, 'SL30 dates');
  await openNotebook(page);
  await page.getByTestId('nb-new').click();
  await page.getByTestId('nb-title').fill('Visit');
  await page.getByTestId('nb-body').click();
  await page.keyboard.type('Spoke with Mrs. Jane Doe on 03/14/2026. Call (256) 555-0142 or jane.doe@example.com at 1420 Oak Street, MRN 00482913. Next visit March 20.');
  const cats = () => page.getByTestId('nb-body').locator('.nb-flag').evaluateAll((els) => els.map((e) => e.getAttribute('data-flag')));
  await expect.poll(cats).toEqual(['person', 'date', 'phone', 'email', 'address', 'record', 'date']);
  // after a reload the stored notebook is checked again (once autosave has the whole text)
  await expect.poll(async () => (await stored(page)).includes('Next visit March 20.')).toBe(true);
  await page.reload();
  await openNotebook(page);
  await expect(page.getByTestId('nb-flag-count')).toHaveText(/7 possible identifiers/);
  await page.getByTestId('nb-flag-count').click();
  await expect(page.getByTestId('nb-flag').filter({ has: page.locator('mark', { hasText: '03/14/2026' }) })).toHaveAttribute('data-category', 'date');
  await page.getByRole('button', { name: 'Label them all' }).click();
  await expect(page.getByTestId('nb-flag-count')).toHaveText('No possible identifiers');
  await expect(page.getByTestId('nb-body')).toContainText('on [date]. Call [phone]');
  await expect.poll(async () => (await stored(page)).includes('03/14/2026')).toBe(false);
  expect(await stored(page)).not.toContain('March 20');
});

test('point 3: at 1440×900 the workspace fills the viewport; typing in a note near the bottom and scrolling to the case summary never scrolls the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page, 'SL30 scroll');
  await openNotebook(page);
  await expect(page.getByTestId('map-workspace')).toHaveAttribute('data-fit', 'viewport');
  const ws = (await page.getByTestId('map-workspace').boundingBox())!;
  expect(ws.y + ws.height).toBeLessThanOrEqual(900);
  // a structured note: its last field sits near the bottom of the notebook
  await page.getByTestId('nb-template').selectOption({ label: 'Contact note' });
  const last = page.getByTestId('nb-field-followup');
  await last.scrollIntoViewIfNeeded();
  await last.click();
  for (let i = 0; i < 12; i++) await page.keyboard.type(`Line ${i}: called the landlord back about the deposit.\n`);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // scroll the notebook, by wheel past its end, to the case summary
  const sc = page.getByTestId('nb-scroll');
  const b = (await sc.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 900);
  await expect(page.getByTestId('case-summary')).toBeInViewport();
  expect(await sc.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByTestId('notebook-toggle')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('map-menu')).toBeInViewport({ ratio: 1 });
  // the canvas keeps the full workspace height, not half the screen
  const cv = (await page.getByTestId('canvas').boundingBox())!;
  expect(cv.height).toBeGreaterThan(900 * 0.6);
});

test('point 4: under 1600 px the notebook\'s first opening folds the dock to its rail, once; at 1700 px it does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page, 'SL30 fold');
  await expect(page.getByTestId('side-dock')).toBeVisible();
  await openNotebook(page);
  await expect(page.getByTestId('dock-rail')).toBeVisible();
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), DOCK_KEY))!)).toMatchObject({ open: false, nbAutoFolded: true, notebook: true });
  // unfolded again, it stays open: closing and reopening the notebook does not fold it a second time
  await page.getByTestId('dock-unfold').click();
  await page.getByTestId('notebook-toggle').click();
  await openNotebook(page);
  await expect(page.getByTestId('side-dock')).toBeVisible();
  await expect(page.getByTestId('dock-rail')).toHaveCount(0);
});
test('point 4: at 1700 px the dock stays open', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  await start(page, 'SL30 wide');
  await openNotebook(page);
  await expect(page.getByTestId('side-dock')).toBeVisible();
  await expect(page.getByTestId('dock-rail')).toHaveCount(0);
});

test('point 5: in a 280 px dock the code line reads "⚡ QE8Z · <WHO title>", one line with an ellipsis; hover and focus expose all of it; same in the peek', async ({ page }) => {
  await start(page, 'SL30 code line', { open: true, closed: [], width: 280 });
  await addNode(page, { code: 'QE8Z', search: 'traumatic', label: 'Hard year' });
  await page.getByTestId('mode-read').click();
  const line = page.getByTestId('selection-body').getByTestId('read-code');
  const full = `⚡ QE8Z · ${whoTitle('QE8Z')}`;
  await expect(line).toHaveText(full); // byte for byte
  expect(await line.textContent()).toBe(full);
  await expect(line).toHaveAttribute('title', full);
  await expect(line).toHaveAccessibleName(full);
  await oneLineEllipsis(line);
  // the label below keeps its weight
  await expect(page.getByTestId('read-title')).toHaveCSS('font-weight', '600');
  await expect(line).toHaveCSS('font-size', '12px');
  // focus: the whole title, wrapped
  await line.focus();
  await expect(line).toBeFocused();
  expect(await line.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  // the peek, with a longer title
  await addNode(page, { code: 'QD70.Z', search: 'natural environment', label: 'Flooded street' });
  const cb = (await page.getByTestId('canvas').boundingBox())!;
  const li = page.getByTestId('canvas-outline').locator('li[data-node]', { hasText: 'Flooded street' }).first();
  // the layout settles after the second box: right-click again until the peek opens
  await expect(async () => {
    await page.mouse.click(cb.x + Number(await li.getAttribute('data-rx')), cb.y + Number(await li.getAttribute('data-ry')), { button: 'right' });
    await expect(page.getByTestId('peek')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  const pl = page.getByTestId('peek').getByTestId('peek-code');
  const pf = `${await pl.evaluate((el) => el.textContent!.split(' ')[0])} QD70.Z · ${whoTitle('QD70.Z')}`;
  expect(await pl.textContent()).toBe(pf);
  await expect(pl).toHaveAttribute('title', pf);
  await oneLineEllipsis(pl);
  await pl.hover();
  await expect(pl).toHaveAttribute('title', pf);
  await pl.focus();
  expect(await pl.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('point 5: "Not sure yet" keeps its type on the code line', async ({ page }) => {
  await start(page, 'SL30 undetermined');
  await addNode(page, { status: 'undetermined', label: 'Unsure' });
  await page.getByTestId('mode-read').click();
  await expect(page.getByTestId('read-code')).toHaveText(/^\? /);
  await expect(page.getByTestId('read-code')).not.toContainText('·');
});
