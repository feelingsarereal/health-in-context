/** K7: numbered loop glyphs, ties listed by name (panel and report), and ⋯ / connector handles that avoid edge marks. */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, newMap, panel, selectNodeByName } from '../helpers';

const ABUSE = 'Personal history of physical abuse';
const UNEMP = 'Problem associated with unemployment';
const LOWINC = 'Low income';
const STRESS = 'Stress, not elsewhere classified';
const SRH = 'Self-rated health';
const SISTER = 'Support from sister';

/** The w2 map through step 5: R1 (QD80 → QD51 → QE01) and the sister loop R2 tie at strength 0.125. */
async function buildW2(page: Page) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'K7');
  await addNode(page, { code: 'QE82.0', search: 'physical abuse' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addNode(page, { code: 'QE01', search: 'stress' });
  await addNode(page, { status: 'other', type: 'outcome', label: SRH });
  await addEdge(page, ABUSE, UNEMP);
  await addEdge(page, UNEMP, LOWINC);
  await addEdge(page, LOWINC, STRESS, { override: 'Money worries' });
  await addEdge(page, STRESS, UNEMP);
  await addEdge(page, STRESS, SRH, { polarity: '−', override: 'Outcome node' });
  await addEdge(page, ABUSE, LOWINC, { override: 'Together here' });
  await addNode(page, { status: 'undetermined', label: SISTER });
  await addEdge(page, SISTER, STRESS, { polarity: '−', weight: -0.5, override: 'She helps' });
  await addEdge(page, STRESS, SISTER, { polarity: '−', weight: -0.25, override: 'She worries too' });
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);
}

test('K7.1 and K7.2: glyphs show the loop name; tied loops list R1 before R2, in the panel and the report', async ({ page }) => {
  await buildW2(page);
  // 1 — each glyph carries its name; the accessible name is unchanged
  const glyphs = page.getByTestId('loop-glyph');
  await expect(glyphs).toHaveCount(2);
  const r1 = page.getByRole('button', { name: 'Loop R1: Reinforcing', exact: true });
  const r2 = page.getByRole('button', { name: 'Loop R2: Reinforcing', exact: true });
  await expect(r1).toHaveText('↻R1');
  await expect(r2).toHaveText('↻R2');
  // a rename shows on the canvas (K14: up to about 20 characters over two lines, not K7's 8), full name in the tooltip
  const first = page.getByTestId('loop-item').filter({ hasText: UNEMP });
  await first.getByRole('button', { name: 'Rename' }).click();
  await first.getByRole('textbox', { name: 'Loop name' }).fill('Rent and work spiral');
  await first.getByRole('button', { name: 'Save' }).click();
  const renamed = page.getByRole('button', { name: 'Loop Rent and work spiral: Reinforcing', exact: true });
  await expect(renamed).toHaveText('↻Rent and work spiral');
  await expect(renamed).toHaveAttribute('title', 'Rent and work spiral');
  await page.keyboard.press('Control+z');
  await expect(r1).toHaveText('↻R1');

  // 2 — R1 and R2 tie at 0.125: R1 first (it is the longer loop, which used to put it second)
  await expect(page.getByTestId('loop-item').getByTestId('loop-name')).toHaveText(['R1', 'R2']);
  await panel(page, 'map');
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-md').click()]);
  const p = test.info().outputPath(d.suggestedFilename());
  await d.saveAs(p);
  const md = fs.readFileSync(p, 'utf8');
  expect(md.indexOf('| R1 |')).toBeGreaterThan(-1);
  expect(md.indexOf('| R1 |')).toBeLessThan(md.indexOf('| R2 |'));
});

test('K7.3: on the w2 map, no circumstance’s ⋯ or connector handle sits on a ⚑ or a polarity label', async ({ page }) => {
  await buildW2(page);
  const outline = page.getByTestId('canvas-outline');
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  const names = await outline.locator('li[data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-node')!));
  const hits: string[] = [];
  for (const id of names) {
    const name = (await outline.locator(`li[data-node="${id}"]`).textContent())!;
    await selectNodeByName(page, name.includes(SISTER) ? SISTER : name.includes(SRH) ? SRH : [ABUSE, UNEMP, LOWINC, STRESS].find((n) => name.includes(n))!);
    // the handles move to the new selection on the next frame: wait until two reads agree
    let prev = '';
    for (let i = 0; i < 20; i++) {
      const now = JSON.stringify([await page.getByTestId('node-more').boundingBox(), await page.getByTestId('connect-handle').boundingBox()]);
      if (now === prev) break;
      prev = now;
      await page.waitForTimeout(50);
    }
    const z = Number(await page.getByTestId('canvas-wrap').getAttribute('data-zoom'));
    const marks = await outline.locator('li[data-edge]').evaluateAll((els) =>
      els.map((e) => ({ ends: e.getAttribute('data-ends')!.split(',').map(Number), mid: e.getAttribute('data-mid')!.split(',').map(Number), basis: e.getAttribute('data-basis') })),
    );
    const circles = marks.flatMap(({ ends: [, , tx, ty], mid: [mx, my], basis }) => {
      const len = Math.hypot(mx - tx, my - ty) || 1;
      const off = Math.min(26 * z, len);
      const pol = { x: tx + ((mx - tx) / len) * off, y: ty + ((my - ty) / len) * off, r: 11 * z, what: 'polarity' };
      return basis === 'override' ? [{ x: mx, y: my, r: 18 * z, what: '⚑' }, pol] : [pol];
    });
    for (const t of ['node-more', 'connect-handle']) {
      const b = (await page.getByTestId(t).boundingBox())!;
      const x1 = b.x - canvas.x;
      const y1 = b.y - canvas.y;
      for (const c of circles) {
        const dx = Math.max(x1 - c.x, 0, c.x - (x1 + b.width));
        const dy = Math.max(y1 - c.y, 0, c.y - (y1 + b.height));
        if (Math.hypot(dx, dy) < c.r) hits.push(`${t} of ${name.slice(0, 30)} on a ${c.what} mark`);
      }
    }
  }
  expect(hits).toEqual([]);
});
