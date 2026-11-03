/** w2 · p-student · "Close a link through evidence, build a two-loop model with overrides, read the analyses and export" (rewritten K2; K3 code-level evidence; K5: L01 ships; K6: L29 ships, and a step for L25's codes). */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, fillLinkForm, newMap, offOrigin, panel, recordRequests, selectNodeByName } from '../helpers';
import { h1Violations } from '../lint';

const UNEMP = 'Problem associated with unemployment';
const LOWINC = 'Low income';
const STRESS = 'Stress, not elsewhere classified';
const ABUSE = 'Personal history of physical abuse'; // QE82.0, one of the codes L20's evidence names

test('w2: evidence link between existing nodes, overrides, analyses, export and re-import', async ({ page, baseURL }) => {
  const reqs = recordRequests(page);
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Class model');
  const outline = page.getByTestId('canvas-outline');
  const edges = outline.locator('li[data-edge]');

  // 1 — QE82.0 and QD80, unlinked; the association menu on QE82.0 offers 'Link to' the existing QD80 under L20, beside 'Add new'
  await addNode(page, { code: 'QE82.0', search: 'physical abuse' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await selectNodeByName(page, ABUSE);
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

  // 4 — the four links: QD80 → QD51 (L01) and QE01 → QD80 (L29) are backed by evidence, no ⚑; two are overrides:
  //     QD51 → QE01 (L05 withheld) and QE01 → Self-rated health (uncoded end)
  await addEdge(page, UNEMP, LOWINC);
  await expect(edges.nth(1)).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.nth(1)).toHaveAttribute('data-check', 'match');
  await expect(edges.nth(1)).toContainText('evidence L01');
  await addEdge(page, LOWINC, STRESS, { override: 'Money worries' });
  await expect(edges.nth(2)).toHaveAttribute('data-check', 'withheld:L05');
  await page.getByTestId('add-edge').click();
  const form = page.getByTestId('edge-dialog');
  await form.getByTestId('edge-from').selectOption({ label: STRESS });
  await form.getByTestId('link-search').fill(UNEMP);
  await form.locator('label', { has: page.getByTestId('link-target') }).filter({ hasText: UNEMP }).first().getByTestId('link-target').check();
  await expect(form.getByTestId('check-note')).toHaveAttribute('data-check', 'match');
  await expect(form.getByTestId('check-note')).toContainText('L29');
  await expect(form.getByTestId('edge-submit')).toBeEnabled();
  await fillLinkForm(page, null);
  await expect(edges.nth(3)).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.nth(3)).toContainText('evidence L29');
  await addEdge(page, STRESS, 'Self-rated health', { polarity: '−', override: 'Outcome node for the class' });
  await expect(edges.nth(4)).toHaveAttribute('data-check', 'uncoded-end');
  for (const i of [2, 4]) await expect(edges.nth(i)).toHaveAttribute('data-basis', 'override');
  await expect(outline.locator('li[data-edge][data-basis="override"]')).toHaveCount(2);
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(1);
  await expect(page.getByTestId('loop-item').first()).toHaveAttribute('data-kind', 'R');
  await expect(page.getByTestId('loop-item').first().getByTestId('loop-length')).toHaveText('3');
  await expect(page.getByTestId('loop-item').first().getByTestId('loop-overrides')).toHaveText('1 override ⚑');
  await expect(page.getByTestId('loop-item').first().getByTestId('loop-name')).toHaveText('R1');
  await panel(page, 'links');
  await expect(page.getByTestId('link-summary')).toHaveText('4 + links, 1 − link.');

  // 4b — QE82.0 → QD51: outside L25's codes (QE82.x → QD50 only), and the form says so; with the override, ⚑, no new loop
  await page.getByTestId('add-edge').click();
  await form.getByTestId('edge-from').selectOption({ label: ABUSE });
  await form.getByTestId('link-search').fill(LOWINC);
  await form.locator('label', { has: page.getByTestId('link-target') }).filter({ hasText: LOWINC }).first().getByTestId('link-target').check();
  await expect(form.getByTestId('check-note')).toHaveAttribute('data-check', 'outside-codes:L25');
  await expect(form.getByTestId('check-message')).toHaveText('Evidence link L25 connects these blocks, but its evidence covers QE82 → QD50 only.');
  await fillLinkForm(page, null, { override: 'Abuse history and money trouble go together here' });
  await expect(edges.nth(5)).toHaveAttribute('data-basis', 'override');
  await expect(edges.nth(5)).toHaveAttribute('data-check', 'outside-codes:L25');
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(1);

  // 5 — 'Support from sister' (undetermined), − −0.5 into QE01 and − −0.25 back, overrides: a second loop, R; '?' and To code
  await addNode(page, { status: 'undetermined', label: 'Support from sister' });
  await addEdge(page, 'Support from sister', STRESS, { polarity: '−', weight: -0.5, override: 'She helps' });
  await addEdge(page, STRESS, 'Support from sister', { polarity: '−', weight: -0.25, override: 'She worries too' });
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);
  await expect(page.getByTestId('loop-item').filter({ hasText: 'Support from sister' })).toHaveAttribute('data-kind', 'R');
  // K6 D4: the first loop keeps R1 when the second appears; the new one takes R2
  await expect(page.getByTestId('loop-item').filter({ hasText: UNEMP }).getByTestId('loop-name')).toHaveText('R1');
  await expect(page.getByTestId('loop-item').filter({ hasText: 'Support from sister' }).getByTestId('loop-name')).toHaveText('R2');
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
  // K9: line 1 is the ICD-11 licence citation as a comment; the header follows
  expect(fs.readFileSync(csv, 'utf8').split('\n')[0]).toMatch(/^# International Classification of Diseases, Eleventh Revision \(ICD-11\)/);
  expect(fs.readFileSync(csv, 'utf8').split('\n')[1]).toContain('basis,link,check,override_reason,override_at');
  const report = fs.readFileSync(md, 'utf8');
  expect(report).toMatch(/\| R1 \| Reinforcing \| 3 \| 1 \|/);
  expect(report).toContain('⚑ withheld:L05 — Money worries');
  const before = JSON.parse(fs.readFileSync(json, 'utf8'));
  expect(before.schema_version).toBe(2);
  await page.getByTestId('import-file').setInputFiles(json);
  await expect(page.getByTestId('map-name')).toHaveText('Class model (imported)');
  await expect(outline.locator('li[data-node]')).toHaveCount(before.nodes.length);
  const after = await edges.evaluateAll((els) => els.map((e) => [e.getAttribute('data-pol'), e.getAttribute('data-basis'), e.getAttribute('data-check'), /weight (-?[\d.]+)/.exec(e.textContent ?? '')?.[1], /: ([^:]*)$/.exec(e.textContent ?? '')?.[1]]));
  expect(after.map((a) => a.slice(0, 4))).toEqual(before.edges.map((e: any) => [e.polarity, e.basis, e.check, String(e.weight)]));
  expect(after.filter((a) => a[1] === 'override').map((a) => a[4])).toEqual(['Money worries', 'Outcome node for the class', 'Abuse history and money trouble go together here', 'She helps', 'She worries too']);
  await expect(page.getByTestId('link-counts')).toHaveText('8 links: 3 evidence · 5 override');
  await panel(page, 'loops');
  await expect(page.getByTestId('loop-item')).toHaveCount(2);

  expect(h1Violations(await page.locator('body').innerText(), 'w2 /map')).toEqual([]);
  expect(offOrigin(reqs, baseURL!)).toEqual([]);
});
