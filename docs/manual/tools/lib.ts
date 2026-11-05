/** Shared helpers for the manual's screenshot scripts. */
import { expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const IMG = path.resolve(HERE, '../img');
export const INV = process.env.SDOH_MANUAL_INV ?? path.resolve(HERE, '../../../test-results/manual-inventory');
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(INV, { recursive: true });

/** A screenshot into docs/manual/img: the page (viewport), a locator, or a padded box around a locator. */
export async function shot(page: Page, name: string, target?: Locator | { around: Locator; pad?: number }, keepMouse = false) {
  const file = path.join(IMG, `${name}.png`);
  if (!keepMouse) await page.mouse.move(page.viewportSize()!.width - 3, page.viewportSize()!.height - 3);
  await page.waitForTimeout(300);
  if (!target) await page.screenshot({ path: file });
  else if ('around' in target) {
    const b = (await target.around.boundingBox())!;
    const pad = target.pad ?? 12;
    const vp = page.viewportSize()!;
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
    await page.screenshot({ path: file, clip: { x, y, width: Math.min(vp.width - x, b.width + 2 * pad), height: Math.min(vp.height - y, b.height + 2 * pad) } });
  } else await target.screenshot({ path: file });
  await inventory(page, name);
}

/** Every visible control on the page: its role, its name (aria-label or text), its tooltip and its test id. */
export async function inventory(page: Page, name: string) {
  const items = await page.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, summary, [role=tab], [role=switch], [role=menuitem], [role=checkbox], [role=radio], [role=option], [contenteditable=true]';
    const out: Record<string, string>[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      const input = el as HTMLInputElement;
      out.push({
        tag: el.tagName.toLowerCase() + (input.type && el.tagName === 'INPUT' ? `:${input.type}` : ''),
        role: el.getAttribute('role') ?? '',
        name: (el.getAttribute('aria-label') ?? (el.textContent ?? '').replace(/\s+/g, ' ').trim()).slice(0, 120),
        title: el.getAttribute('title') ?? '',
        testid: el.dataset.testid ?? '',
        label: el.id ? (document.querySelector(`label[for="${el.id}"]`)?.textContent ?? '').trim() : '',
      });
    }
    return out;
  });
  fs.writeFileSync(path.join(INV, `${name}.json`), JSON.stringify(items, null, 1));
}

/** Go to a route; hide the prototype banner and the first-run notice so the shot shows the page itself. */
export async function go(page: Page, route: string, keepBanner = false) {
  await page.goto(route);
  if (!keepBanner) {
    const d = page.getByTestId('prototype-banner-dismiss');
    if (await d.count()) await d.click();
  }
}

export async function typeRich(page: Page, scope: Locator, label: string, text: string) {
  const box = scope.getByRole('textbox', { name: label, exact: true });
  await box.click();
  await page.keyboard.type(text);
}

export async function editMode(page: Page) {
  const b = page.getByTestId('mode-edit');
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  await expect(b).toHaveAttribute('aria-pressed', 'true');
}
export async function readMode(page: Page) {
  const b = page.getByTestId('mode-read');
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
}

export async function menuItem(page: Page, testId: string) {
  const btn = page.getByTestId('map-menu');
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  await page.getByTestId(testId).click();
}

/** Numbered callouts over elements (removed with clearBadges), for the annotated overview shots. */
export async function badges(page: Page, items: [Locator, number | string][]) {
  for (const [loc, n] of items) {
    const b = await loc.first().boundingBox({ timeout: 2000 }).catch(() => null);
    if (!b) {
      console.log(`badge ${n}: no element`);
      continue;
    }
    await page.evaluate(({ x, y, n }) => {
      const d = document.createElement('div');
      d.className = 'manual-badge';
      d.textContent = String(n);
      Object.assign(d.style, { position: 'fixed', left: `${x - 9}px`, top: `${y - 9}px`, zIndex: '99999', width: '22px', height: '22px', borderRadius: '11px', background: '#c2410c', color: '#fff', font: '700 12px/22px system-ui, sans-serif', textAlign: 'center', boxShadow: '0 0 0 2px #fff', pointerEvents: 'none' });
      document.body.appendChild(d);
    }, { x: b.x, y: b.y, n });
  }
}
export async function clearBadges(page: Page) {
  await page.evaluate(() => document.querySelectorAll('.manual-badge').forEach((e) => e.remove()));
}

/** Open the manual's example map from its file, through My maps → Open a map file. */
export async function openExample(page: Page) {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('sdoh-loops:first-run', 'ok'));
  await go(page, './maps');
  await page.getByTestId('open-map-input').setInputFiles(path.resolve(HERE, '../household-f.sdohmap.json'));
  await expect(page.getByTestId('map-name')).toContainText('Household F');
  await page.waitForTimeout(800);
}

/** Screen position of a circumstance (by its label text) or of a link's midpoint, from the Cytoscape instance. */
export async function canvasPoint(page: Page, from: string, to?: string) {
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="canvas-outline"] li[data-node]')).map((li) => [li.getAttribute('data-node'), li.textContent ?? '']));
  const idOf = (t: string) => ids.find(([, txt]) => (txt as string).includes(t))?.[0];
  const a = idOf(from), b = to ? idOf(to) : null;
  if (!a || (to && !b)) throw new Error(`not on the canvas: ${from} ${to ?? ''}`);
  return page.evaluate(({ a, b }) => {
    const host = Array.from(document.querySelectorAll<HTMLElement>('*')).find((el) => (el as any)._cyreg?.cy);
    const cy = (host as any)._cyreg.cy;
    const r = host!.getBoundingClientRect();
    if (!b) {
      const p = cy.getElementById(a).renderedPosition();
      return { x: r.left + p.x, y: r.top + p.y };
    }
    const e = cy.edges().filter((x: any) => x.source().id() === a && x.target().id() === b)[0];
    const p = e.renderedMidpoint();
    return { x: r.left + p.x, y: r.top + p.y };
  }, { a, b });
}

/** Select a circumstance by clicking it on the canvas. */
export async function clickNode(page: Page, label: string, button: 'left' | 'right' = 'left') {
  const p = await canvasPoint(page, label);
  await page.mouse.click(p.x, p.y, { button });
}
export async function clickEdge(page: Page, from: string, to: string, button: 'left' | 'right' = 'left') {
  const p = await canvasPoint(page, from, to);
  await page.mouse.click(p.x, p.y, { button });
}

/** Run `fn` with a taller window (the workspace fits the window, so the side dock grows with it). */
export async function tall(page: Page, fn: () => Promise<void>, height = 1600) {
  await page.setViewportSize({ width: 1440, height });
  await page.waitForTimeout(500);
  try {
    await fn();
  } finally {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
  }
}
