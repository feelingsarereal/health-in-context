/**
 * K2 defect D2 — the selected node's ⋯ button sat on its own outgoing edges and over the label. Regression: ⋯ and the
 * connector handle lie wholly outside the node's box, clear of every edge endpoint, and are ≥ 44 px touch targets.
 */
import { test, expect, type Page } from '@playwright/test';
import { addEdge, addNode, dismissFirstRun, newMap, selectNodeByName } from '../helpers';

/** Everything in the canvas's own frame (scroll-proof): node box and edge ends from the outline, buttons from their style. */
async function geometry(page: Page, name: string) {
  return page.evaluate((nm) => {
    const li = [...document.querySelectorAll('[data-testid="canvas-outline"] li[data-node]')].find((l) => l.textContent?.includes(nm))!;
    const [x1, y1, x2, y2] = li.getAttribute('data-bb')!.split(',').map(Number);
    const ends = [...document.querySelectorAll('[data-testid="canvas-outline"] li[data-edge]')].flatMap((e) => {
      const [a, b, c, d] = e.getAttribute('data-ends')!.split(',').map(Number);
      return [{ x: a, y: b }, { x: c, y: d }];
    });
    const btn = (id: string) => {
      const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
      const r = el.getBoundingClientRect();
      const cx = parseFloat(el.style.left);
      const cy = parseFloat(el.style.top);
      return { x: cx - r.width / 2, y: cy - r.height / 2, width: r.width, height: r.height };
    };
    return { box: { x1, y1, x2, y2 }, ends, more: btn('node-more'), handle: btn('connect-handle') };
  }, name);
}
const overlaps = (r: { x: number; y: number; width: number; height: number }, b: { x1: number; y1: number; x2: number; y2: number }) => r.x < b.x2 && r.x + r.width > b.x1 && r.y < b.y2 && r.y + r.height > b.y1;

for (const vp of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test(`D2 at ${vp.width} px: ⋯ and the connector handle sit outside the node, clear of its edges`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('/');
    await dismissFirstRun(page);
    await newMap(page, 'D2');
    await addNode(page, { code: 'QD71.1', search: 'inadequate housing', circumstance: 'Behind on rent; landlord filed for eviction' });
    await addNode(page, { code: 'QD80', search: 'unemployment' });
    await addNode(page, { code: 'QD82', search: 'job' });
    await addEdge(page, 'Inadequate housing', 'Problem associated with unemployment');
    await addEdge(page, 'Inadequate housing', 'Problem associated with threat of job loss', { override: 'Hours cut after the move' }); // outside L03's codes (K3)
    if (vp.width < 640) await page.getByTestId('toolbar-more').click(); // K4 D10: phone tools sit behind More
    await page.getByTestId('arrange').click();
    await page.waitForTimeout(900);
    await selectNodeByName(page, 'Inadequate housing');
    // K4 D10: fitted to a phone the nodes are small, so the buttons hide below the 44 px floor until you zoom in
    for (let i = 0; i < 6 && !(await page.getByTestId('node-more').isVisible()); i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('node-more')).toBeVisible();
    await expect(page.getByTestId('connect-handle')).toBeVisible();
    const g = await geometry(page, 'Inadequate housing');
    for (const [id, r] of [['node-more', g.more], ['connect-handle', g.handle]] as const) {
      expect(r.width, id).toBeGreaterThanOrEqual(44);
      expect(r.height, id).toBeGreaterThanOrEqual(44);
      expect(overlaps(r, g.box), `${id} overlaps the node: ${JSON.stringify(r)} vs ${JSON.stringify(g.box)}`).toBe(false);
      const c = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      for (const e of g.ends) expect(Math.hypot(e.x - c.x, e.y - c.y), `${id} sits on an edge endpoint`).toBeGreaterThan(22);
    }
    expect(overlaps(g.more, { x1: g.handle.x, y1: g.handle.y, x2: g.handle.x + g.handle.width, y2: g.handle.y + g.handle.height })).toBe(false);
  });
}
