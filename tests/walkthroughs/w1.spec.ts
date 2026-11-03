/** w1 · p-navigator · "Map a client's housing–work–income loop that closes on evidence, plus one deliberate override" (scenarios.yaml, rewritten K5). */
import { test, expect, type Page } from '@playwright/test';
import { addNode, dismissFirstRun, fillLinkForm, fillNodeDialog, offOrigin, panel, recordRequests, selectNodeByName, typeRich } from '../helpers';
import { h1Violations } from '../lint';

const TYPED = ['Behind on rent; landlord filed for eviction', 'Missed shifts during the move; let go', 'No paycheck since March', 'Worried all the time', 'Client describes constant money worry', 'Client R.'];

/** Drag from the selected node's connector handle onto another node (UI-17). */
async function dragConnect(page: Page, toName: string) {
  const handle = page.getByTestId('connect-handle');
  // the handle moves to a newly selected node on the next frame: wait until two reads agree
  let hb = (await handle.boundingBox())!;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const next = (await handle.boundingBox())!;
    if (next.x === hb.x && next.y === hb.y) break;
    hb = next;
  }
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

test('w1: a loop built through the association menu closes on evidence, then one deliberate override', async ({ page, baseURL }) => {
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

  // 2 — 'evict' in the picker: QD71.Z at the top with the builder-alias note; choose it, describe; block colour + code;
  //     the pop-out (title, no definition + QD71.Z's own WHO browser entry (K9), WHO as the source and the licence citation; K9)
  await page.getByTestId('add-node').click();
  const nd = page.getByTestId('node-dialog');
  await nd.getByTestId('code-search').fill('evict');
  const alias = nd.getByTestId('alias-hit');
  await expect(alias).toHaveCount(1);
  await expect(alias.locator('[data-code]')).toHaveAttribute('data-code', 'QD71.Z');
  await expect(alias.getByTestId('alias-note')).toContainText('ICD-11 has no code for eviction');
  await expect(alias.getByTestId('alias-note')).toContainText('Builder alias — not an ICD-11 index term');
  await expect(nd.locator('[data-code]').first()).toHaveAttribute('data-code', 'QD71.Z');
  await alias.locator('[data-code="QD71.Z"]').click();
  await expect(nd.getByTestId('chosen-code')).toContainText('QD71.Z');
  await typeRich(page, nd, 'Describe the circumstance', TYPED[0]);
  await nd.getByTestId('node-submit').click();
  await expect(nd).toBeHidden();
  const outline = page.getByTestId('canvas-outline');
  const housing = outline.locator('li[data-node]').first();
  await expect(housing).toContainText('code QD71.Z');
  await expect(housing).toHaveAttribute('data-group', 'QD71');
  const pop = page.getByTestId('inspector').getByTestId('code-popout');
  await expect(pop.getByTestId('code-title')).toHaveText('Problems associated with housing, unspecified');
  await expect(pop.getByTestId('no-definition')).toHaveText('No definition in ICD-11 for this code.');
  await expect(pop.getByTestId('who-link')).toHaveAttribute('href', 'https://icd.who.int/browse/2026-01/mms/en#683601550/unspecified');
  await expect(pop.getByTestId('code-source')).toHaveText("WHO's own text, ICD-11 MMS release 2026-01.");
  await expect(pop.getByTestId('icd-citation')).toContainText('Licensed under Creative Commons Attribution-NoDerivatives 3.0 IGO');

  // 3 — association menu by keyboard: Leads to lists L03, L27 and L28 with polarity, grade and citation; nothing withheld
  const HOUSING = 'Problems associated with housing, unspecified';
  await selectNodeByName(page, HOUSING);
  await page.keyboard.press('a');
  const menu = page.getByTestId('assoc-menu');
  const leads = menu.getByTestId('leads-to').getByTestId('assoc-entry');
  await expect(leads).toHaveCount(3);
  expect((await leads.evaluateAll((els) => els.map((e) => e.getAttribute('data-link')))).sort()).toEqual(['L03', 'L27', 'L28']);
  for (const id of ['L03', 'L27', 'L28']) {
    const e = menu.getByTestId('leads-to').locator(`[data-link="${id}"]`);
    await expect(e.locator('[data-grade]')).toBeVisible();
    await expect(e.locator('button.bx-cite').first()).toBeVisible();
    await expect(e).toContainText('+');
  }
  await expect(menu.locator('[data-link="L03"]')).toContainText('Problems associated with employment or unemployment');
  await expect(menu.locator('[data-link="L03"]').getByRole('button', { name: 'Reference 23' })).toBeVisible();
  for (const w of ['L05', 'L06', 'L07', 'L08', 'L14', 'L16', 'L23', 'L24', 'C01']) await expect(menu.locator(`[data-link="${w}"]`)).toHaveCount(0);

  // 4 — L03 → QD80: a + edge with L03's citation and no ⚑
  await menu.locator('[data-link="L03"]').getByTestId('assoc-follow').click();
  await fillNodeDialog(page, { code: 'QD80', circumstance: TYPED[1] });
  const edges = outline.locator('li[data-edge]');
  await expect(edges).toHaveCount(1);
  await expect(edges.first()).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.first()).toHaveAttribute('data-pol', '+');
  await expect(edges.first()).toContainText('evidence L03, cites [23]');

  // 5 — the unemployment node's menu: L01 → Add new QD51 Low income; a + edge with L01's citation (grade F), no ⚑
  await selectNodeByName(page, 'Problem associated with unemployment');
  await page.keyboard.press('a');
  const l01 = menu.getByTestId('leads-to').locator('[data-link="L01"]');
  await expect(l01.locator('[data-grade="F"]')).toBeVisible();
  await l01.getByTestId('assoc-follow').click();
  await fillNodeDialog(page, { code: 'QD51', circumstance: TYPED[2] });
  await expect(edges).toHaveCount(2);
  await expect(edges.nth(1)).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.nth(1)).toHaveAttribute('data-check', 'match');
  await expect(edges.nth(1)).toContainText('evidence L01, cites [45]');

  // 6 — the low-income node's menu: L02 offers 'Link to' the housing node; an evidence edge joins them; 3 evidence · 0 override
  await selectNodeByName(page, 'Low income');
  await page.keyboard.press('a');
  const l02 = menu.getByTestId('leads-to').locator('[data-link="L02"]');
  await l02.getByTestId('assoc-link-existing').filter({ hasText: HOUSING }).click();
  await expect(edges).toHaveCount(3);
  await expect(edges.nth(2)).toHaveAttribute('data-basis', 'evidence');
  await expect(edges.nth(2)).toContainText('evidence L02');
  await expect(page.getByTestId('link-counts')).toHaveText('3 links: 3 evidence · 0 override');
  await expect(outline.locator('li[data-edge][data-basis="override"]')).toHaveCount(0);

  // 7 — Loops: exactly one, R1, reinforcing, 3 links, no overrides; clicking it highlights it and dims the rest
  if (await menu.isVisible()) await page.keyboard.press('Escape');
  await panel(page, 'loops');
  const items = page.getByTestId('loop-item');
  await expect(items).toHaveCount(1);
  await expect(items.first().getByTestId('loop-name')).toHaveText('R1');
  await expect(items.first()).toHaveAttribute('data-kind', 'R');
  await expect(items.first().getByTestId('loop-length')).toHaveText('3');
  await expect(items.first().getByTestId('loop-overrides')).toHaveText('no overrides');
  await items.first().getByTestId('loop-pick').click();
  await expect(outline.locator('li[data-state="highlighted"]')).toHaveCount(6);
  await expect(page.getByTestId('live')).toContainText('Highlighting loop R1');

  // 8 — evidence-backed links only: R1 is still listed (it closes on evidence alone); no 'none can be' message
  await page.getByTestId('evidence-toggle').check();
  await expect(page.getByTestId('loop-item')).toHaveCount(1);
  await expect(page.getByTestId('loop-name')).toHaveText('R1');
  await expect(page.getByTestId('loops-empty')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('none can be');
  await page.getByTestId('evidence-toggle').uncheck();

  // 9 — QE01 Stress; drag from the low-income node's connector handle onto it: L05 is withheld, and it cannot be saved yet
  await page.getByTestId('add-node').click();
  await fillNodeDialog(page, { code: 'QE01', search: 'stress', circumstance: TYPED[3] });
  await selectNodeByName(page, 'Low income');
  await dragConnect(page, 'Stress, not elsewhere classified');
  const form = page.getByTestId('edge-dialog');
  await expect(form).toBeVisible();
  const fromId = await outline.locator('li[data-node]', { hasText: 'Low income' }).getAttribute('data-node');
  const toId = await outline.locator('li[data-node]', { hasText: 'Stress, not elsewhere classified' }).getAttribute('data-node');
  await expect(form.getByTestId('edge-from')).toHaveValue(fromId!);
  await expect(form.locator(`[data-testid="link-target"][data-node="${toId}"]`)).toBeChecked();
  await expect(form.getByTestId('check-message')).toContainText('Evidence link L05 is withheld:');
  await expect(form.getByTestId('edge-submit')).toBeDisabled();
  await expect(form.getByTestId('override-needed')).toBeVisible();

  // 10 — confirm the override with a reason, +: a ⚑ edge whose tooltip shows the reason; 3 evidence · 1 override
  await fillLinkForm(page, null, { override: TYPED[4] });
  await expect(edges).toHaveCount(4);
  await expect(edges.nth(3)).toHaveAttribute('data-basis', 'override');
  await expect(edges.nth(3)).toHaveAttribute('data-check', 'withheld:L05');
  await expect(page.getByTestId('edge-tooltip')).toContainText(TYPED[4]);
  await expect(page.getByTestId('link-counts')).toHaveText('4 links: 3 evidence · 1 override');

  expect(h1Violations(await page.locator('body').innerText(), 'w1 /map')).toEqual([]);
  for (const r of reqs) for (const t of TYPED) {
    expect(decodeURIComponent(r.url)).not.toContain(t);
    expect(r.body ?? '').not.toContain(t);
  }
  expect(offOrigin(reqs, baseURL!)).toEqual([]);
  void addNode;
});
