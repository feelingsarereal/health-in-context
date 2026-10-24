/** w2 · p-student · "Build a two-loop model, weight it, read the analyses and export" (scenarios.yaml). */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, newMap, offOrigin, panel, recordRequests, selectNodeByName } from '../helpers';
import { h1Violations } from '../lint';

const UNEMP = 'Problem associated with unemployment';
const LOWINC = 'Low income';
const STRESS = 'Stress, not elsewhere classified';

test('w2: two-loop model, weights, analyses, export and re-import', async ({ page, baseURL }) => {
  const reqs = recordRequests(page);
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Class model');
  const outline = page.getByTestId('canvas-outline');

  // 1 — QD80, QD51, QE01 and an 'other' outcome node 'Self-rated health': neutral fill, dashed; no association menu
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addNode(page, { code: 'QE01', search: 'stress' });
  await addNode(page, { status: 'other', type: 'outcome', label: 'Self-rated health' });
  const srh = outline.locator('li[data-node]', { hasText: 'Self-rated health' });
  await expect(srh).toHaveAttribute('data-status', 'other');
  await expect(srh).toHaveAttribute('data-dashed', 'true');
  await expect(srh).toHaveAttribute('data-group', '');
  await selectNodeByName(page, 'Self-rated health');
  await page.keyboard.press('a');
  await expect(page.getByTestId('assoc-needs-code')).toHaveText('Assign an SDOH code to see associations.');
  await expect(page.getByTestId('assoc-menu').locator('[data-testid="assoc-entry"]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // 2 — the three + links close R1; QE01 → Self-rated health (−); inventory 3 + and 1 −
  await addEdge(page, UNEMP, LOWINC);
  await addEdge(page, LOWINC, STRESS);
  await addEdge(page, STRESS, UNEMP);
  await addEdge(page, STRESS, 'Self-rated health', { polarity: '−' });
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(1);
  await expect(page.getByTestId('loop-item').first()).toHaveAttribute('data-kind', 'R');
  await expect(page.getByTestId('loop-item').first().getByTestId('loop-length')).toHaveText('3');
  await panel(page, 'links');
  await expect(page.getByTestId('link-summary')).toHaveText('3 + links, 1 − links.');
  await expect(page.getByTestId('links-plus').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('links-minus').locator('li')).toHaveCount(1);

  // 3 — undetermined 'Support from sister', − −0.5 into QE01 and − −0.25 back: a second loop, R; '?' badge; listed under To code
  await addNode(page, { status: 'undetermined', label: 'Support from sister' });
  await addEdge(page, 'Support from sister', STRESS, { polarity: '−', weight: -0.5 });
  await addEdge(page, STRESS, 'Support from sister', { polarity: '−', weight: -0.25 });
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);
  await expect(page.getByTestId('loop-item').filter({ hasText: 'Support from sister' })).toHaveAttribute('data-kind', 'R');
  await expect(page.getByTestId('loop-summary')).toHaveText('2 loops: 2 reinforcing, 0 balancing.');
  await expect(page.getByTestId('live')).toContainText('2 loops found: 2 reinforcing, 0 balancing.');
  const sister = outline.locator('li[data-node]', { hasText: 'Support from sister' });
  await expect(sister).toHaveAttribute('data-status', 'undetermined');
  await expect(sister).toContainText('Not sure yet');
  await panel(page, 'tocode');
  await expect(page.getByTestId('tocode-list')).toContainText('? Support from sister');

  // 4 — Paths: how does QD80 affect Self-rated health? net sign − and the weight product
  await panel(page, 'paths');
  await page.getByTestId('paths-from').selectOption({ label: UNEMP });
  await page.getByTestId('paths-to').selectOption({ label: 'Self-rated health' });
  await page.getByTestId('paths-find').click();
  await expect(page.getByTestId('path-item').first()).toBeVisible();
  await expect(page.getByTestId('path-sign').first()).toHaveText('−');
  await expect(page.getByTestId('path-weight').first()).toHaveText('-0.125');
  await expect(page.getByTestId('paths-summary')).toHaveText('all −');

  // 5 — Leverage hints, labelled 'heuristic — hints for discussion'
  await panel(page, 'leverage');
  await expect(page.getByTestId('leverage-table')).toBeVisible();
  await expect(page.getByTestId('leverage-panel').locator('[data-heuristic]')).toContainText(/heuristic.*Heuristic — hints for discussion/);
  // loop strength carries its label too (must_not)
  await panel(page, 'loops');
  await expect(page.getByTestId('loops-panel').locator('[data-heuristic]')).toContainText('Loop strength — structural heuristic, not loop dominance');

  // 6 — a reference card behind an association citation: tier, summary, verbatim abstract labelled as such
  await selectNodeByName(page, UNEMP);
  await page.keyboard.press('a');
  const entry = page.getByTestId('assoc-menu').locator('[data-link="L03"]');
  await entry.getByRole('button', { name: 'Reference 23' }).click();
  const card = entry.getByTestId('cite-foldout').getByTestId('ref-card');
  await expect(card).toContainText('Current');
  await expect(card).toContainText('Summary:');
  await card.getByText('Abstract, verbatim').click();
  await expect(card.getByTestId('abstract-verbatim')).toBeVisible();
  await page.keyboard.press('Escape');

  // 7 — export JSON, CSV and Markdown; import the JSON into a new map; same nodes, edges, weights, polarities, loops
  await panel(page, 'map');
  const dl = async (id: string) => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
    const p = test.info().outputPath(d.suggestedFilename());
    await d.saveAs(p);
    return p;
  };
  const json = await dl('export-json');
  const csv = await dl('export-csv');
  const md = await dl('export-md');
  expect(json).toMatch(/\.sdohmap\.json$/);
  expect(fs.readFileSync(csv, 'utf8').split('\n')[0]).toContain('from_code_status,from_type');
  const report = fs.readFileSync(md, 'utf8');
  expect(report).toMatch(/\| R\d \| Reinforcing \| 3 \|/);
  expect(report).toMatch(/\| R\d \| Reinforcing \| 2 \|/);
  expect(report).toContain('structural heuristic');
  const before = JSON.parse(fs.readFileSync(json, 'utf8'));
  const loopNamesBefore = await page.getByTestId('loop-name').allTextContents().catch(() => []);
  await page.getByTestId('import-file').setInputFiles(json);
  await expect(page.getByTestId('map-name')).toHaveText('Class model (imported)');
  await expect(outline.locator('li[data-node]')).toHaveCount(before.nodes.length);
  const edgesAfter = await outline.locator('li[data-edge]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-pol'), e.textContent]));
  expect(edgesAfter.map((e) => e[0])).toEqual(before.edges.map((e: { polarity: string }) => e.polarity));
  expect(edgesAfter.map((e) => /weight (-?[\d.]+)/.exec(e[1] ?? '')?.[1])).toEqual(before.edges.map((e: { weight: number }) => String(e.weight)));
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);
  const loopNamesAfter = await page.getByTestId('loop-name').allTextContents();
  if (loopNamesBefore.length) expect(loopNamesAfter).toEqual(loopNamesBefore);

  expect(h1Violations(await page.locator('body').innerText(), 'w2 /map')).toEqual([]);
  expect(offOrigin(reqs, baseURL!)).toEqual([]);
});
