/** w1 · p-navigator · "Map a client's housing–work loop: one evidence link, two deliberate overrides" (scenarios.yaml, rewritten K2). */
import { test, expect, type Page } from '@playwright/test';
import { addNode, dismissFirstRun, fillLinkForm, fillNodeDialog, offOrigin, panel, recordRequests, selectNodeByName, typeRich } from '../helpers';
import { h1Violations } from '../lint';

const TYPED = ['Behind on rent; landlord filed for eviction', 'Missed shifts during the move; let go', 'No paycheck since March', "Lost wages; worker's own account", "Can't make rent", 'Client R.'];

/** Drag from the selected node's connector handle onto another node (UI-17). */
async function dragConnect(page: Page, toName: string) {
  const handle = page.getByTestId('connect-handle');
  const hb = (await handle.boundingBox())!;
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  const target = page.getByTestId('canvas-outline').locator('li[data-node]', { hasText: toName }).first();
  const x = canvas.x + Number(await target.getAttribute('data-rx'));
  const y = canvas.y + Number(await target.getAttribute('data-ry'));
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move((hb.x + x) / 2, (hb.y + y) / 2, { steps: 5 });
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.up();
}

test("w1: one evidence link, two deliberate overrides, and the evidence-only toggle", async ({ page, baseURL }) => {
  const reqs = recordRequests(page);
  await page.goto('/');
  await dismissFirstRun(page);

  // 1 — new map with subject 'R.'; the nudge beside the subject field
  await page.goto('/maps');
  await page.getByTestId('new-map-name').fill('Client R.');
  await page.getByTestId('new-map-subject').fill('R.');
  const nudgeId = await page.getByTestId('new-map-subject').getAttribute('aria-describedby');
  await expect(page.locator(`[id="${nudgeId}"]`)).toHaveText("Use initials or a label. Don't enter names, dates of birth, addresses or record numbers.");
  await page.getByTestId('create-map').click();
  await expect(page.getByTestId('map-name')).toHaveText('Client R.');

  // 2 — QD71.1, described; block colour + code; the pop-out (title, no definition + WHO link, interim note, crosswalk)
  await page.getByTestId('add-node').click();
  await fillNodeDialog(page, { code: 'QD71.1', search: 'inadequate housing', circumstance: TYPED[0] });
  const outline = page.getByTestId('canvas-outline');
  const housing = outline.locator('li[data-node]').first();
  await expect(housing).toContainText('code QD71.1');
  await expect(housing).toHaveAttribute('data-group', 'QD71');
  const pop = page.getByTestId('inspector').getByTestId('code-popout');
  await expect(pop.getByTestId('code-title')).toHaveText('Inadequate housing');
  await expect(pop.getByTestId('no-definition')).toHaveText('No definition in ICD-11 for this code.');
  await expect(pop.getByTestId('who-link')).toHaveAttribute('href', /icd\.who\.int\/browse\/2026-01\/mms\/en#/);
  await expect(pop.getByTestId('interim-note')).toBeVisible();
  await expect(pop.getByTestId('proposed-chip')).toHaveText('Proposed mapping');
  await expect(pop.getByTestId('xwalk-hp2030')).toHaveText(['Healthy People 2030: Neighborhood and Built Environment (nbe)', 'Healthy People 2030: Economic Stability (econ)']);
  await expect(pop.getByTestId('xwalk-icd10cm')).toHaveText(['ICD-10-CM Z58: Problems related to physical environment', 'ICD-10-CM Z59: Problems related to housing and economic circumstances']);

  // 3 — association menu by keyboard: Leads to / Comes from with polarity, grade, citation; L03; nothing withheld
  await selectNodeByName(page, 'Inadequate housing');
  await page.keyboard.press('a');
  const menu = page.getByTestId('assoc-menu');
  await expect(menu.getByTestId('leads-to')).toBeVisible();
  await expect(menu.getByTestId('comes-from')).toBeVisible();
  const l03 = menu.locator('[data-link="L03"]');
  await expect(l03).toContainText('Problems associated with employment or unemployment');
  await expect(l03.locator('[data-grade="M"]')).toBeVisible();
  await expect(l03.getByRole('button', { name: 'Reference 23' })).toBeVisible();
  for (const w of ['L01', 'L02', 'L05', 'L07', 'L08', 'L14', 'L16', 'L22', 'L23', 'L24', 'C01']) await expect(menu.locator(`[data-link="${w}"]`)).toHaveCount(0);

  // 4 — L03 → QD80: a + edge with L03's citation, basis evidence (no ⚑)
  await l03.getByTestId('assoc-follow').click();
  await fillNodeDialog(page, { code: 'QD80', circumstance: TYPED[1] });
  const edges = outline.locator('li[data-edge]');
  await expect(edges).toHaveCount(1);
  await expect(edges.first()).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.first()).toHaveAttribute('data-pol', '+');
  await expect(edges.first()).toContainText('evidence L03, cites [23]');

  // 5 — QD51; drag from the unemployment node's connector handle onto it: the form opens pre-filled and refuses to save
  await page.getByTestId('add-node').click();
  await fillNodeDialog(page, { code: 'QD51', search: 'low income', circumstance: TYPED[2] });
  await selectNodeByName(page, 'Problem associated with unemployment');
  await dragConnect(page, 'Low income');
  const form = page.getByTestId('edge-dialog');
  await expect(form).toBeVisible();
  const fromId = await outline.locator('li[data-node]', { hasText: 'Problem associated with unemployment' }).getAttribute('data-node');
  const toId = await outline.locator('li[data-node]', { hasText: 'Low income' }).getAttribute('data-node');
  await expect(form.getByTestId('edge-from')).toHaveValue(fromId!);
  await expect(form.locator(`[data-testid="link-target"][data-node="${toId}"]`)).toBeChecked();
  await expect(form.getByTestId('check-message')).toContainText('Evidence link L01 is withheld:');
  await expect(form.getByTestId('check-message')).toContainText('Withheld 2026-10-23 after independent check');
  await expect(form.getByTestId('edge-submit')).toBeDisabled();
  await expect(form.getByTestId('override-needed')).toBeVisible();

  // 6 — confirm the override with a reason, +: a ⚑ edge whose tooltip shows the reason; the header counts
  await fillLinkForm(page, null, { override: TYPED[3] });
  await expect(edges).toHaveCount(2);
  await expect(edges.nth(1)).toHaveAttribute('data-basis', 'override');
  await expect(edges.nth(1)).toHaveAttribute('data-check', 'withheld:L01');
  await expect(page.getByTestId('edge-tooltip')).toContainText(TYPED[3]);
  await expect(page.getByTestId('link-counts')).toHaveText('2 links: 1 evidence · 1 override');

  // 7 — select low income, its 'Link to…' button, the housing node, +, 0.75, override 'Can't make rent' (L02 is withheld)
  await selectNodeByName(page, 'Low income');
  await page.getByTestId('panel-inspect').click();
  await page.getByTestId('inspector-link-to').click();
  await fillLinkForm(page, 'Inadequate housing', { weight: 0.75, override: TYPED[4] });
  await expect(edges).toHaveCount(3);
  await expect(edges.nth(2)).toHaveAttribute('data-basis', 'override');
  await expect(edges.nth(2)).toHaveAttribute('data-check', 'withheld:L02');
  expect(Number(await edges.nth(2).getAttribute('data-width'))).toBeGreaterThan(Number(await edges.nth(1).getAttribute('data-width')));

  // 8 — Loops: exactly one, R1, reinforcing, 3 links, 2 overrides; clicking it highlights it and dims the rest
  await panel(page, 'loops');
  const items = page.getByTestId('loop-item');
  await expect(items).toHaveCount(1);
  await expect(items.first().getByTestId('loop-name')).toHaveText('R1');
  await expect(items.first()).toHaveAttribute('data-kind', 'R');
  await expect(items.first().getByTestId('loop-length')).toHaveText('3');
  await expect(items.first().getByTestId('loop-overrides')).toHaveText('2 overrides ⚑');
  await items.first().getByTestId('loop-pick').click();
  await expect(outline.locator('li[data-state="highlighted"]')).toHaveCount(6);
  await expect(page.getByTestId('live')).toContainText('Highlighting loop R1');

  // 9 — evidence-backed links only: the loop list empties and says why; off again restores R1
  await page.getByTestId('evidence-toggle').check();
  await expect(page.getByTestId('loop-item')).toHaveCount(0);
  await expect(page.getByTestId('loops-empty')).toContainText('No loop is closed by evidence alone');
  // K3 item 6: the shipped links' code graph has no cycle (links.json can_cycle, computed at build time), so it says none can be
  await expect(page.getByTestId('loops-empty')).toContainText('With the links in this app, none can be');
  await page.getByTestId('evidence-toggle').uncheck();
  await expect(page.getByTestId('loop-item')).toHaveCount(1);
  await expect(page.getByTestId('loop-name')).toHaveText('R1');

  expect(h1Violations(await page.locator('body').innerText(), 'w1 /map')).toEqual([]);
  for (const r of reqs) for (const t of TYPED) {
    expect(decodeURIComponent(r.url)).not.toContain(t);
    expect(r.body ?? '').not.toContain(t);
  }
  expect(offOrigin(reqs, baseURL!)).toEqual([]);
  void addNode;
  void typeRich;
});
