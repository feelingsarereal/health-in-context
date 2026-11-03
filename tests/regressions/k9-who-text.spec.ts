/** K9: WHO's own ICD-11 text (no interim copy), the licence citation (§1.3) on About, /methods, the pop-out and every export. */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, newMap, panel } from '../helpers';

const CITATION =
  'International Classification of Diseases, Eleventh Revision (ICD-11), World Health Organization (WHO) 2019 https://icd.who.int/browse11. Licensed under Creative Commons Attribution-NoDerivatives 3.0 IGO licence (CC BY-ND 3.0 IGO).';
const BURNOUT = 'Burnout';
const LOWINC = 'Low income';

async function save(page: Page, testId: string) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
  const p = test.info().outputPath(d.suggestedFilename());
  await d.saveAs(p);
  return fs.readFileSync(p, 'utf8');
}

test('no "Interim copy" link anywhere; the text source names WHO, not the mirror; the citation is on About and at the foot of /methods', async ({ page }) => {
  for (const r of ['/', '/about', '/methods', '/references', '/help']) {
    await page.goto(r);
    // the todo status on /methods quotes the retired tag ("drop the 'Interim copy' tag"), so look for the link itself
    await expect(page.getByRole('link', { name: /interim copy/i }), r).toHaveCount(0);
  }
  // the pack's history (change ledger, scope, interview) still names the retired mirror; the text source does not
  await page.goto('/about');
  await expect(page.locator('main')).not.toContainText('findacode');
  await expect(page.getByTestId('text-source')).toContainText("WHO's own text");
  await expect(page.getByTestId('icd-citation')).toHaveText(CITATION);
  await expect(page.locator('dt', { hasText: 'ICD-11 text' })).toBeVisible();
  await expect(page.locator('dt', { hasText: 'Interim source' })).toHaveCount(0);
  await page.goto('/methods');
  await expect(page.getByRole('heading', { name: 'Sources of ICD-11 text' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Interim sources' })).toHaveCount(0);
  await expect(page.getByTestId('text-source')).not.toContainText('findacode');
  await expect(page.getByTestId('other-checks')).toHaveText("Definition text not from WHO's own release: none.");
  const foot = page.getByTestId('icd-citation');
  await expect(foot).toHaveText(CITATION);
  // at the foot: nothing on the page comes after it
  expect(await foot.evaluate((el) => el.nextElementSibling === null && el.parentElement!.nextElementSibling === null)).toBe(true);
});

test('the pop-out: WHO as the source, the citation in small print, no check note for WHO text, the builder crosswalk labelled', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'K9');
  await addNode(page, { code: 'QD85', search: 'burnout' });
  const pop = page.getByTestId('inspector').getByTestId('code-popout');
  await expect(pop.getByTestId('code-title')).toHaveText(BURNOUT);
  await expect(pop.getByTestId('code-definition')).toContainText('Burnout is a syndrome conceptualized as resulting from chronic workplace stress');
  await expect(pop.getByTestId('check-note')).toHaveCount(0); // definition_check: who_api
  await expect(pop.getByTestId('who-link')).toHaveText('Open in the WHO ICD-11 browser');
  await expect(pop.getByTestId('code-source')).toHaveText("WHO's own text, ICD-11 MMS release 2026-01.");
  await expect(pop.getByTestId('icd-citation')).toHaveText(CITATION);
  await expect(pop).not.toContainText('Interim copy');
  await addNode(page, { code: 'QD51', search: 'low income' });
  await expect(pop.getByTestId('proposed-chip')).toHaveText("Proposed mapping — builder's reading, not from WHO");
});

test('every export carries the citation: JSON meta, a CSV comment line, a Markdown footer', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'K9 exports');
  await addNode(page, { code: 'QD85', search: 'burnout' });
  await addNode(page, { code: 'QD51', search: 'low income' });
  await addEdge(page, BURNOUT, LOWINC, { override: 'Worker says so' });
  await panel(page, 'map');
  expect(JSON.parse(await save(page, 'export-json')).meta).toEqual({ icd11_citation: CITATION });
  const csv = (await save(page, 'export-csv')).split('\n');
  expect(csv[0]).toBe(`# ${CITATION}`);
  expect(csv[1]).toMatch(/^from_id,from_label,from_code,/);
  const md = (await save(page, 'export-md')).trimEnd();
  expect(md.endsWith(`---\n\n${CITATION}`)).toBe(true);
  // the CSV still imports: the comment line is skipped
  const p = test.info().outputPath('k9-edges.csv');
  fs.writeFileSync(p, csv.join('\n'));
  await page.getByTestId('import-file').setInputFiles(p);
  await expect(page.getByTestId('map-name')).toHaveText('k9-edges');
  await expect(page.getByTestId('canvas-outline').locator('li[data-edge]')).toHaveCount(1);
});
