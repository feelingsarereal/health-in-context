/** w1 · p-navigator · "Map a client's housing–work loop and find it" (scenarios.yaml). Keyboard-first where the step allows. */
import { test, expect } from '@playwright/test';
import { addEdge, addNode, dismissFirstRun, fillNodeDialog, offOrigin, panel, recordRequests, selectNodeByName } from '../helpers';
import { h1Violations } from '../lint';

const TYPED = ['Behind on rent; landlord filed for eviction', 'Missed shifts during the move; let go', 'No paycheck since March', "Can't make rent", 'Client R.'];

test('w1: map a client\'s housing–work loop and find it', async ({ page, baseURL }) => {
  const reqs = recordRequests(page);
  await page.goto('/');
  await dismissFirstRun(page);

  // 1 — new map 'Client R.' with subject 'R.'; the de-identification nudge shows beside the subject field
  await page.goto('/maps');
  await page.getByTestId('new-map-name').fill('Client R.');
  await page.getByTestId('new-map-subject').fill('R.');
  const subj = page.getByTestId('new-map-subject');
  const nudgeId = await subj.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${nudgeId}"]`)).toHaveText("Use initials or a label. Don't enter names, dates of birth, addresses or record numbers.");
  await page.getByTestId('create-map').click();
  await expect(page.getByTestId('map-name')).toHaveText('Client R.');

  // 2 — node QD71.1 from the picker, described; block colour + code; pop-out shows title, no-definition + WHO link, interim note
  await addNode(page, { code: 'QD71.1', search: 'inadequate housing', circumstance: TYPED[0] });
  const housing = page.getByTestId('canvas-outline').locator('li[data-node]').first();
  await expect(housing).toContainText('code QD71.1');
  await expect(housing).toHaveAttribute('data-group', 'QD71');
  const pop = page.getByTestId('inspector').getByTestId('code-popout');
  await expect(pop.getByTestId('code-title')).toHaveText('Inadequate housing');
  await expect(pop.getByTestId('no-definition')).toHaveText('No definition in ICD-11 for this code.');
  await expect(pop.getByTestId('who-link')).toHaveAttribute('href', /icd\.who\.int\/browse\/2026-01\/mms\/en#/);
  await expect(pop.getByTestId('interim-note')).toBeVisible();
  // crosswalk (pack update, K2): titles, the proposed-mapping chip and the source citations
  await expect(pop.getByTestId('proposed-chip')).toHaveText('Proposed mapping');
  await expect(pop.getByTestId('xwalk-hp2030')).toHaveText(['Healthy People 2030: Neighborhood and Built Environment (nbe)', 'Healthy People 2030: Economic Stability (econ)']);
  await expect(pop.getByTestId('xwalk-icd10cm')).toHaveText(['ICD-10-CM Z58: Problems related to physical environment', 'ICD-10-CM Z59: Problems related to housing and economic circumstances']);
  await expect(pop.getByTestId('crosswalk').getByRole('button', { name: 'Reference 57' })).toBeVisible();
  await expect(pop.getByTestId('crosswalk').getByRole('button', { name: 'Reference 58' })).toBeVisible();

  // 3 — association menu by keyboard (select, press A): Leads to / Comes from with polarity, grade, citation; L03; nothing withheld
  await selectNodeByName(page, 'Inadequate housing');
  await page.keyboard.press('a');
  const menu = page.getByTestId('assoc-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId('leads-to')).toBeVisible();
  await expect(menu.getByTestId('comes-from')).toBeVisible();
  const l03 = menu.locator('[data-link="L03"]');
  await expect(l03).toContainText('Problems associated with employment or unemployment');
  await expect(l03.locator('[data-polarity]')).toBeVisible();
  await expect(l03.locator('[data-grade="M"]')).toBeVisible();
  await expect(l03.getByRole('button', { name: 'Reference 23' })).toBeVisible();
  for (const w of ['L01', 'L02', 'L05', 'L07', 'L08', 'L14', 'L16', 'L22', 'L23', 'L24', 'C01']) await expect(menu.locator(`[data-link="${w}"]`)).toHaveCount(0);

  // 4 — follow L03, pick QD80, describe: a new node linked from housing with a + edge carrying [23]
  await l03.getByTestId('assoc-follow').click();
  await fillNodeDialog(page, { code: 'QD80', circumstance: TYPED[1] });
  await expect(page.getByTestId('assoc-dialog')).toBeHidden();
  const edges = page.getByTestId('canvas-outline').locator('li[data-edge]');
  await expect(edges).toHaveCount(1);
  await expect(edges.first()).toHaveAttribute('data-pol', '+');
  await expect(edges.first()).toContainText('Inadequate housing to Problem associated with unemployment');
  await expect(edges.first()).toContainText('cites [23]');

  // 5 — QD51 node, user-drawn + edge from unemployment: no citation
  await addNode(page, { code: 'QD51', search: 'low income', circumstance: TYPED[2] });
  await addEdge(page, 'Problem associated with unemployment', 'Low income', { polarity: '+' });
  await expect(edges).toHaveCount(2);
  await expect(edges.nth(1)).toContainText('user-drawn');
  await expect(page.getByTestId('edge-no-evidence')).toHaveText('No citation — you drew this link.');

  // 6 — low income → housing, +, weight 0.75, described: + glyph, thicker than the 0.5 default
  await addEdge(page, 'Low income', 'Inadequate housing', { polarity: '+', weight: 0.75, description: TYPED[3] });
  await expect(edges.nth(2)).toHaveAttribute('data-pol', '+');
  const w75 = Number(await edges.nth(2).getAttribute('data-width'));
  const w50 = Number(await edges.nth(1).getAttribute('data-width'));
  expect(w75).toBeGreaterThan(w50);

  // 7 — Loops panel: exactly one loop, R1, reinforcing, 3 nodes; clicking it highlights those and dims the rest
  await panel(page, 'loops');
  const items = page.getByTestId('loop-item');
  await expect(items).toHaveCount(1);
  await expect(items.first().getByTestId('loop-name')).toHaveText('R1');
  await expect(items.first()).toHaveAttribute('data-kind', 'R');
  await expect(items.first()).toContainText('Reinforcing');
  await expect(items.first().getByTestId('loop-length')).toHaveText('3');
  await items.first().getByTestId('loop-pick').click();
  await expect(page.getByTestId('canvas-outline').locator('li[data-state="highlighted"]')).toHaveCount(6);
  await expect(page.getByTestId('canvas-outline').locator('li[data-state="dimmed"]')).toHaveCount(0);
  await expect(page.getByTestId('live')).toContainText('Highlighting loop R1');
  await expect(page.getByTestId('loop-glyph')).toHaveCount(1);

  // must_not — no diagnosing wording; no request carrying typed text; nothing off-origin
  expect(h1Violations(await page.locator('body').innerText(), 'w1 /map')).toEqual([]);
  for (const r of reqs) for (const t of TYPED) {
    expect(decodeURIComponent(r.url)).not.toContain(t);
    expect(r.body ?? '').not.toContain(t);
  }
  expect(offOrigin(reqs, baseURL!)).toEqual([]);
});
