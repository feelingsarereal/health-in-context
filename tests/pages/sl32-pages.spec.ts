/**
 * SL32: the public Pages build (npm run build:pages → dist-pages, base /health-in-context/), locally or live
 * (playwright.pages.config.ts). The prototype banner on every page, WHO's citation in every footer and on About, and
 * no crosswalk or Topic on a code card (SL33).
 */
import { test, expect } from '@playwright/test';
import { addNode, dismissFirstRun, newMap } from '../helpers';

const CITATION =
  'International Classification of Diseases, Eleventh Revision (ICD-11), World Health Organization (WHO) 2019 https://icd.who.int/browse11. Licensed under CC BY-ND 3.0 IGO.';
const BANNER =
  "Prototype for testing. Commissioned research, not peer reviewed. It does not diagnose anyone. Don't enter real client information: anything you type stays in this browser, but this is a test site. Codes are shown as WHO publishes them; no mapping to other code sets is included. Report a problem";
const ROUTES = ['./', './map', './maps', './evidence', './references', './glossary', './concepts', './concepts/icd11-chapter24', './help', './methods', './about', './nope'];

test('the banner (above the header) and WHO\'s citation (in the footer) are on every page', async ({ page }) => {
  await page.goto('./');
  await dismissFirstRun(page);
  for (const r of ROUTES) {
    await page.goto(r);
    const banner = page.getByTestId('prototype-banner');
    await expect(banner, r).toBeVisible();
    await expect(banner.locator('p'), r).toHaveText(BANNER);
    // above the site header, in document order and on screen
    expect(await banner.evaluate((b) => !!(b.compareDocumentPosition(document.querySelector('header')!) & Node.DOCUMENT_POSITION_FOLLOWING)), r).toBe(true);
    const [bb, hb] = [await banner.boundingBox(), await page.locator('header').boundingBox()];
    expect(bb!.y, r).toBeLessThan(hb!.y);
    await expect(banner.locator('strong'), r).toHaveText(['Prototype for testing.', "Don't enter real client information"]);
    await expect(page.getByTestId('footer-who-citation'), r).toHaveText(CITATION);
  }
  await page.goto('./about');
  await expect(page.getByTestId('who-citation')).toHaveText(CITATION);
  // no WHO logo or emblem, no endorsement wording
  await expect(page.locator('img[src*="who" i], img[alt*="WHO"], svg[aria-label*="WHO"]')).toHaveCount(0);
  for (const r of ['./', './about', './methods', './help']) {
    await page.goto(r);
    await expect(page.locator('body'), r).not.toContainText(/endorsed|WHO's tool|approved by WHO/i);
  }
});

test('Report a problem is a plain link to the repo\'s Issues page; hiding the banner lasts the visit, not a reload', async ({ page }) => {
  await page.goto('./');
  await dismissFirstRun(page);
  await page.goto('./glossary');
  const link = page.getByTestId('report-problem');
  await expect(link).toHaveAttribute('href', 'https://github.com/feelingsarereal/health-in-context/issues');
  await expect(link).toHaveAttribute('rel', 'noreferrer');
  const before = await page.evaluate(() => [Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]);
  await page.getByTestId('prototype-banner-dismiss').click();
  await expect(page.getByTestId('prototype-banner')).toHaveCount(0);
  // moving around the site in the same visit keeps it hidden
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'References' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('prototype-banner')).toHaveCount(0);
  // nothing was stored for it
  expect(await page.evaluate(() => [Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()])).toEqual(before);
  await page.reload();
  await expect(page.getByTestId('prototype-banner')).toBeVisible();
});

test('a code card shows no crosswalk and no Topic, and the records say what is held', async ({ page }) => {
  await page.goto('./');
  await dismissFirstRun(page);
  await newMap(page, 'Crosswalk check');
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  const pop = page.getByTestId('inspector').getByTestId('code-popout');
  await expect(pop.getByTestId('code-title')).toBeVisible();
  await expect(pop.getByTestId('crosswalk')).toHaveCount(0);
  await expect(pop.getByTestId('xwalk-icd10cm')).toHaveCount(0);
  await expect(pop.getByTestId('xwalk-hp2030')).toHaveCount(0);
  await expect(pop.getByTestId('builder-topic')).toHaveCount(0);
  await expect(pop).not.toContainText('Healthy People 2030');
  await expect(page.locator('main')).not.toContainText(/ICD-10-CM|\bZ[0-9]{2}\b/);
  // the primer and /methods carry the hidden text no more
  await page.goto('./concepts/icd11-chapter24');
  await expect(page.locator('main')).not.toContainText('play the same role');
  await expect(page.locator('main')).not.toContainText('xwalk');
  await page.goto('./methods');
  await expect(page.getByTestId('todo-list')).toContainText('T-XWALK-02');
  await expect(page.getByTestId('topic-count')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Builder topic');
});
