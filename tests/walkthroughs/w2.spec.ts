/** w2 · p-student · "Close a link through evidence, build a two-loop model with overrides, read the analyses and export" (rewritten K2). */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, newMap, offOrigin, panel, recordRequests, selectNodeByName } from '../helpers';
import { h1Violations } from '../lint';

const UNEMP = 'Problem associated with unemployment';
const LOWINC = 'Low income';
const STRESS = 'Stress, not elsewhere classified';
const UPBR = 'Inadequate parental supervision or control'; // QE90, in block QE90-QE9Z 'Problems associated with upbringing'

test('w2: evidence link between existing nodes, overrides, analyses, export and re-import', async ({ page, baseURL }) => {
  const reqs = recordRequests(page);
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Class model');
  const outline = page.getByTestId('canvas-outline');
  const edges = outline.locator('li[data-edge]');

  // 1 — QE90 and QD80, unlinked; the association menu on QE90 offers 'Link to' the existing QD80 under L20, beside 'Add new'
  await addNode(page, { code: 'QE90', search: 'QE90' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await selectNodeByName(page, UPBR);
  await page.keyboard.press('a');
  const l20 = page.getByTestId('assoc-menu').getByTestId('leads-to').locator('[data-link="L20"]');
  await expect(l20.getByTestId('assoc-link-existing')).toContainText(`Link to ${UNEMP}`);
  await expect(l20.getByTestId('assoc-follow')).toHaveText('Add new');

  // 2 — 'Link to': an evidence edge (no ⚑) with L20's citation joins the two; no new node
  await l20.getByTestId('assoc-link-existing').click();
  await expect(page.getByTestId('assoc-dialog')).toBeHidden();
  await expect(outline.locator('li[data-node]')).toHaveCount(2);
  await expect(edges).toHaveCount(1);
  await expect(edges.first()).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.first()).toContainText('evidence L20, cites [35]');

  // 3 — QD51, QE01 and an 'other' outcome 'Self-rated health': neutral, dashed, no association menu
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addNode(page, { code: 'QE01', search: 'stress' });
  await addNode(page, { status: 'other', type: 'outcome', label: 'Self-rated health' });
  const srh = outline.locator('li[data-node]', { hasText: 'Self-rated health' });
  await expect(srh).toHaveAttribute('data-status', 'other');
  await expect(srh).toHaveAttribute('data-dashed', 'true');
  await selectNodeByName(page, 'Self-rated health');
  await page.keyboard.press('a');
  await expect(page.getByTestId('assoc-needs-code')).toHaveText('Assign an SDOH code to see associations.');
  await page.keyboard.press('Escape');

  // 4 — the four links. QD80 → QD51 (L01 withheld), QD51 → QE01 (L05 withheld) and QE01 → Self-rated health (uncoded end)
  //     need overrides. QE01 → QD80: scenarios.yaml expects an override, but by the matching rule (code → parent → QD71 →
  //     group) QE01 sits in QE00-QE0Z and the shipped L12 (QE00-QE0Z → QD80-QD8Z, +) backs it. The spec asserts the rule;
  //     the mismatch is flagged to Cowork (K2 scrum note).
  await addEdge(page, UNEMP, LOWINC, { override: 'Income stops with the job' });
  await expect(edges.nth(1)).toHaveAttribute('data-check', 'withheld:L01');
  await addEdge(page, LOWINC, STRESS, { override: 'Money worries' });
  await expect(edges.nth(2)).toHaveAttribute('data-check', 'withheld:L05');
  await addEdge(page, STRESS, UNEMP);
  await expect(edges.nth(3)).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.nth(3)).toContainText('evidence L12');
  await addEdge(page, STRESS, 'Self-rated health', { polarity: '−', override: 'Outcome node for the class' });
  await expect(edges.nth(4)).toHaveAttribute('data-check', 'uncoded-end');
  for (const i of [1, 2, 4]) await expect(edges.nth(i)).toHaveAttribute('data-basis', 'override');
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(1);
  await expect(page.getByTestId('loop-item').first()).toHaveAttribute('data-kind', 'R');
  await expect(page.getByTestId('loop-item').first().getByTestId('loop-length')).toHaveText('3');
  await expect(page.getByTestId('loop-item').first().getByTestId('loop-overrides')).toHaveText('2 overrides ⚑');
  await panel(page, 'links');
  await expect(page.getByTestId('link-summary')).toHaveText('4 + links, 1 − links.');

  // 5 — 'Support from sister' (undetermined), − −0.5 into QE01 and − −0.25 back, overrides: a second loop, R; '?' and To code
  await addNode(page, { status: 'undetermined', label: 'Support from sister' });
  await addEdge(page, 'Support from sister', STRESS, { polarity: '−', weight: -0.5, override: 'She helps' });
  await addEdge(page, STRESS, 'Support from sister', { polarity: '−', weight: -0.25, override: 'She worries too' });
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);
  await expect(page.getByTestId('loop-item').filter({ hasText: 'Support from sister' })).toHaveAttribute('data-kind', 'R');
  await expect(page.getByTestId('live')).toContainText('2 loops found: 2 reinforcing, 0 balancing.');
  await expect(outline.locator('li[data-node]', { hasText: 'Support from sister' })).toHaveAttribute('data-status', 'undetermined');
  await panel(page, 'tocode');
  await expect(page.getByTestId('tocode-list')).toContainText('? Support from sister');

  // 6 — Paths: QD80 → Self-rated health, net sign −, weight product
  await panel(page, 'paths');
  await page.getByTestId('paths-from').selectOption({ label: UNEMP });
  await page.getByTestId('paths-to').selectOption({ label: 'Self-rated health' });
  await page.getByTestId('paths-find').click();
  await expect(page.getByTestId('path-sign').first()).toHaveText('−');
  await expect(page.getByTestId('path-weight').first()).toHaveText('-0.125');

  // 7 — Leverage, labelled
  await panel(page, 'leverage');
  await expect(page.getByTestId('leverage-panel').locator('[data-heuristic]')).toContainText('Heuristic — hints for discussion');
  await panel(page, 'loops');
  await expect(page.getByTestId('loops-panel').locator('[data-heuristic]')).toContainText('Loop strength — structural heuristic, not loop dominance');

  // 8 — a reference card behind an association citation
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

  // 9 — export JSON, CSV, Markdown; import the JSON into a new map: same nodes, edges, weights, polarities, bases, reasons, loops
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
  expect(fs.readFileSync(csv, 'utf8').split('\n')[0]).toContain('basis,link,check,override_reason,override_at');
  const report = fs.readFileSync(md, 'utf8');
  expect(report).toMatch(/\| R\d \| Reinforcing \| 3 \| 2 \|/);
  expect(report).toContain('⚑ withheld:L01 — Income stops with the job');
  const before = JSON.parse(fs.readFileSync(json, 'utf8'));
  expect(before.schema_version).toBe(2);
  await page.getByTestId('import-file').setInputFiles(json);
  await expect(page.getByTestId('map-name')).toHaveText('Class model (imported)');
  await expect(outline.locator('li[data-node]')).toHaveCount(before.nodes.length);
  const after = await edges.evaluateAll((els) => els.map((e) => [e.getAttribute('data-pol'), e.getAttribute('data-basis'), e.getAttribute('data-check'), /weight (-?[\d.]+)/.exec(e.textContent ?? '')?.[1], /: ([^:]*)$/.exec(e.textContent ?? '')?.[1]]));
  expect(after.map((a) => a.slice(0, 4))).toEqual(before.edges.map((e: any) => [e.polarity, e.basis, e.check, String(e.weight)]));
  expect(after.filter((a) => a[1] === 'override').map((a) => a[4])).toEqual(['Income stops with the job', 'Money worries', 'Outcome node for the class', 'She helps', 'She worries too']);
  await expect(page.getByTestId('link-counts')).toHaveText('7 links: 2 evidence · 5 override');
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);

  expect(h1Violations(await page.locator('body').innerText(), 'w2 /map')).toEqual([]);
  expect(offOrigin(reqs, baseURL!)).toEqual([]);
});
