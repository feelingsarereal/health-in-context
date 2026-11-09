/** K8: on a short override link the +/− label used to be drawn over the mid-edge ⚑ and hide it (UI-18). */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { tool, addEdge, addNode, dismissFirstRun, newMap, panel, menuItem } from '../helpers';

const LOWINC = 'Low income';
const STRESS = 'Stress, not elsewhere classified';
const SRH = 'Self-rated health';

/** QD51 → QE01 (override, L05 withheld) with the two boxes about 80 px apart; QE01 → Self-rated health (override) long. */
async function shortLinkMap(page: Page) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'K8');
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addNode(page, { code: 'QE01', search: 'stress' });
  await addNode(page, { status: 'other', type: 'outcome', label: SRH });
  await addEdge(page, LOWINC, STRESS, { override: 'Money worries' });
  await addEdge(page, STRESS, SRH, { override: 'Outcome node' });
  // export, place the circumstances exactly, pin them, and import the result (SL17: the boxes take their text's
  // measured size, so 230 apart keeps the link about 80 px long)
  await panel(page, 'map');
  const [d] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-json')]);
  const p = test.info().outputPath('k8.json');
  await d.saveAs(p);
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const n of m.nodes) Object.assign(n, n.code === 'QD51' ? { x: 0, y: 0 } : n.code === 'QE01' ? { x: 230, y: 0 } : { x: 230, y: 500 }, { pinned: true });
  fs.writeFileSync(p, JSON.stringify(m));
  await page.getByTestId('import-file').setInputFiles(p);
  await expect(page.getByTestId('map-name')).toHaveText('K8 (imported)');
}

const edgeLi = (page: Page, from: string) =>
  page.getByTestId('canvas-outline').locator('li[data-edge]').filter({ hasText: new RegExp(`^Link: ${from} to`) });

async function zoomTo(page: Page, target: number) {
  const wrap = page.getByTestId('canvas-wrap');
  await tool(page, 'fit');
  for (let i = 0; i < 8; i++) {
    const z = Number(await wrap.getAttribute('data-zoom'));
    if (Math.abs(z - target) < 0.12) return z;
    await tool(page, z > target ? 'zoom-out' : 'zoom-in');
    await page.waitForTimeout(150);
  }
  throw new Error(`could not reach zoom ${target}`);
}

test('the short override link paints one combined “+ ⚑” badge and no separate +; the long one keeps both marks', async ({ page }) => {
  await shortLinkMap(page);
  const short = edgeLi(page, LOWINC);
  const long = edgeLi(page, STRESS);
  for (const target of [1.0, 0.8]) {
    const z = await zoomTo(page, target);
    // the setup really is a short link: about 80 model px between the two boxes
    const [x1, y1, x2, y2] = (await short.getAttribute('data-ends'))!.split(',').map(Number);
    const len = Math.hypot(x2 - x1, y2 - y1) / z;
    expect(len, `zoom ${z}`).toBeGreaterThan(50);
    expect(len, `zoom ${z}`).toBeLessThan(110);
    await expect(short).toHaveAttribute('data-mark', '+ ⚑');
    await expect(short).toHaveAttribute('data-pol-label', '');
    // a long link keeps the + by the arrowhead, well clear of its ⚑
    await expect(long).toHaveAttribute('data-mark', '⚑');
    await expect(long).toHaveAttribute('data-pol-label', '+');
    const [, , tx, ty] = (await long.getAttribute('data-ends'))!.split(',').map(Number);
    const [mx, my] = (await long.getAttribute('data-mid'))!.split(',').map(Number);
    expect(Math.hypot(mx - tx, my - ty) - 26 * z).toBeGreaterThan(28 * z);
  }
});

test('the combined badge follows the link: a − override with a delay reads “− ‖ ⚑”', async ({ page }) => {
  await shortLinkMap(page);
  const short = edgeLi(page, LOWINC);
  await zoomTo(page, 1.0);
  // select the link from the Links panel (SL31: a click on so short a line can land on a box when the canvas is shorter)
  await panel(page, 'links');
  await page.getByTestId('links-item').filter({ hasText: LOWINC }).first().getByRole('button').first().click();
  const insp = page.getByTestId('edge-inspector');
  await insp.getByTestId('polarity-minus').check({ force: true });
  await insp.getByTestId('edge-delay').check();
  await expect(short).toHaveAttribute('data-mark', '− ‖ ⚑');
  await expect(short).toHaveAttribute('data-pol-label', '');
  await expect(short).toHaveAttribute('data-basis', 'override');
});
