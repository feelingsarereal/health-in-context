/** UI-18: recoding re-checks links — an evidence link that loses its evidence becomes needs-review, is listed, and is never silently relabelled. */
import { test, expect } from '@playwright/test';
import { addEdge, addNode, dismissFirstRun, newMap, panel, selectNodeByName, typeRich } from '../helpers';

test('recode QD80 → QE01 on an L03 link: needs-review, listed, then confirmed as an override', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'Review');
  await addNode(page, { code: 'QD71.1', search: 'inadequate housing' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  await addEdge(page, 'Inadequate housing', 'Problem associated with unemployment');
  const edge = page.getByTestId('canvas-outline').locator('li[data-edge]').first();
  await expect(edge).toHaveAttribute('data-basis', 'evidence');
  await selectNodeByName(page, 'Problem associated with unemployment');
  await panel(page, 'inspect');
  const insp = page.getByTestId('inspector');
  await insp.getByTestId('change-code').click();
  await insp.getByTestId('code-search').fill('stress');
  await insp.locator('[data-code="QE01"]').click();
  // QE01 sits in QE00-QE0Z; QD71.1 → QE00-QE0Z has no shipped link
  await expect(edge).toHaveAttribute('data-basis', 'needs-review');
  await expect(edge).toHaveAttribute('data-check', 'no-link');
  await expect(page.getByTestId('link-counts')).toHaveText('1 link: 0 evidence · 1 override (1 to review)');
  await panel(page, 'tocode');
  await page.getByTestId('review-list').getByRole('button').first().click();
  const basis = page.getByTestId('basis-panel');
  await expect(basis).toHaveAttribute('data-basis', 'needs-review');
  await expect(basis.getByTestId('confirm-override')).toBeDisabled();
  await basis.getByTestId('override-checkbox').check();
  await typeRich(page, basis, 'Why keep this link?', 'Housing stress feeds worry');
  await basis.getByTestId('confirm-override').click();
  await expect(edge).toHaveAttribute('data-basis', 'override');
  await expect(page.getByTestId('link-counts')).toHaveText('1 link: 0 evidence · 1 override');
  await expect(page.getByTestId('edge-tooltip')).toContainText('Housing stress feeds worry');
});
