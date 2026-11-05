/**
 * SL29 (S7.1 slice 2): import files into the notebook — by the header button, the Map menu and a drop; the review
 * step labels identifiers before anything is saved (the stored notes never hold the values); several files at once
 * (a PDF with page markers, a DOCX with headings, a CSV table); a refused type and a scanned PDF; Paste as a note;
 * Keep as is asks once and is recorded; no request leaves the origin (the PDF worker included); axe; 375 px.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissFirstRun, menuItem, newMap, offOrigin, recordRequests } from '../helpers';
import { makeDocx, makePdf } from '../fixtures/import-files';

const SECRET = 'Spoke with Mrs. Jane Doe on 03/14/2026. She lives in Huntsville, AL 35801 and her phone is (256) 555-0142.';
const buf = (b: ArrayBuffer) => Buffer.from(new Uint8Array(b));
const txt = (name: string, text: string) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });

async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
}
async function openNotebook(page: Page) {
  const t = page.getByTestId('notebook-toggle');
  if ((await t.getAttribute('aria-pressed')) !== 'true') await t.click();
  await expect(page.getByTestId('notebook')).toBeVisible();
}
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((res) => {
        const r = indexedDB.open('sdoh-loops');
        r.onsuccess = () => {
          const g = r.result.transaction('maps').objectStore('maps').getAll();
          g.onsuccess = () => res(JSON.stringify(g.result));
        };
      }),
  );
const scan = async (page: Page, where: string) =>
  (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
async function pick(page: Page, open: () => Promise<unknown>, files: Parameters<import('@playwright/test').FileChooser['setFiles']>[0]) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), open()]);
  await fc.setFiles(files);
}

test('by the header button: the review step shows the flags and a count; Label all saves only labels — the values never reach storage', async ({ page }) => {
  const reqs = recordRequests(page);
  await start(page, 'SL29 button');
  await openNotebook(page);
  await pick(page, () => page.getByTestId('nb-import').click(), txt('call-notes.txt', SECRET));
  const review = page.getByTestId('nb-review');
  await expect(review).toBeVisible();
  await expect(page.getByTestId('nb-import-original')).toContainText('The original file is not kept');
  await expect(page.getByTestId('nb-review-count')).toHaveText(/5 possible identifiers: 1 name, 1 full date, 1 city, 1 ZIP code, 1 phone number/);
  await expect(review.locator('.nb-flag')).toHaveCount(5);
  // nothing saved yet
  expect(await stored(page)).not.toContain('Huntsville');
  await page.getByTestId('nb-review-label-all').click();
  await expect(page.getByTestId('nb-import-summary')).toContainText('Saved to the notebook: call-notes');
  await page.getByTestId('nb-import-done').click();
  await expect(page.getByTestId('nb-imported')).toBeVisible();
  await expect(page.getByTestId('nb-body')).toContainText('Spoke with [Person A] on [date]. She lives in [city], AL [ZIP code]');
  await expect(page.getByTestId('nb-source')).toContainText('Imported from call-notes.txt · TXT');
  await expect(page.getByTestId('nb-source')).toContainText('identifiers labeled before saving');
  // the imported text is verbatim: no toolbar, not editable
  await expect(page.getByTestId('nb-body')).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByTestId('nb-flag-count')).toHaveText('No possible identifiers');
  await expect.poll(async () => (await stored(page)).includes('[Person A]')).toBe(true);
  const s = await stored(page);
  for (const v of ['Jane Doe', '03/14/2026', 'Huntsville', '35801', '555-0142']) expect(s).not.toContain(v);
  expect(s).toMatch(/"replaced":\{[^}]*"person":1/);
  expect(offOrigin(reqs, page.url())).toEqual([]);
});

test('several files at once from the Map menu: a two-page PDF (page markers), a DOCX (headings), a CSV (a table); a refused type and a scanned PDF are reported without blocking the rest', async ({ page }) => {
  const reqs = recordRequests(page);
  await start(page, 'SL29 several');
  await pick(page, () => menuItem(page, 'menu-host-nb-import'), [
    { name: 'letter.pdf', mimeType: 'application/pdf', buffer: buf(makePdf([['Behind on rent.', 'Landlord called.'], ['Food bank on Tuesdays.']])) },
    { name: 'intake.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: buf(await makeDocx()) },
    { name: 'contacts.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Need\nLee,food\nKim,rides\n') },
    { name: 'budget.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK') },
    { name: 'scan.pdf', mimeType: 'application/pdf', buffer: buf(makePdf([[]])) },
  ]);
  const files = page.getByTestId('nb-import-file');
  await expect(files).toHaveCount(5);
  await expect(page.getByTestId('nb-import-error').filter({ hasText: 'budget.xlsx' })).toHaveText("budget.xlsx can't be imported. The notebook imports .txt, .md, .html, .htm, .rtf, .csv, .docx and .pdf files.");
  await expect(page.getByTestId('nb-import-error').filter({ hasText: 'scan.pdf' })).toHaveText(/scan\.pdf: This PDF has no text layer \(it looks scanned\), so nothing could be read\. Reading scanned pages \(OCR\) may come later\./);
  // three reviews in turn, nothing flagged in any
  for (const name of ['letter', 'intake', 'contacts']) {
    await expect(page.getByTestId('nb-review-title')).toContainText(name);
    await expect(page.getByTestId('nb-review-count')).toHaveText('No possible identifiers found.');
    if (name === 'letter') await expect(page.getByTestId('nb-review-text').locator('.nb-page')).toHaveText(['p. 1', 'p. 2']);
    await page.getByTestId('nb-review-save').click();
  }
  await expect(page.getByTestId('nb-import-summary')).toContainText('Saved to the notebook: letter, intake, contacts');
  await page.getByTestId('nb-import-done').click();
  // the notebook opened at the last one: the CSV as a table
  await expect(page.getByTestId('notebook')).toBeVisible();
  await expect(page.getByTestId('nb-table').locator('th')).toHaveText(['Name', 'Need']);
  await expect(page.getByTestId('nb-table').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByTestId('nb-note')).toHaveCount(3);
  await page.getByTestId('nb-note').filter({ hasText: 'letter' }).getByRole('button').click();
  await expect(page.getByTestId('nb-body').locator('.nb-page')).toHaveText(['p. 1', 'p. 2']);
  await expect(page.getByTestId('nb-source')).toContainText('letter.pdf · PDF');
  await expect(page.getByTestId('nb-source')).toContainText('2 pages');
  await page.getByTestId('nb-note').filter({ hasText: 'intake' }).getByRole('button').click();
  await expect(page.getByTestId('nb-body').locator('h2')).toHaveText(['Intake summary', 'Housing', 'Income']);
  // metadata dropped
  expect(await stored(page)).not.toContain('Secret');
  // nothing left the origin: the PDF worker and the import worker are the app's own files
  expect(offOrigin(reqs, page.url())).toEqual([]);
  const own = reqs.filter((r) => /pdf\.worker|parse\.worker/.test(r.url)).map((r) => new URL(r.url).origin);
  expect(own.length).toBeGreaterThanOrEqual(2);
  for (const o of own) expect(o).toBe(new URL(page.url()).origin);
});

test('a dropped file shows the drop zone and imports; Review one by one, and Keep as is asks once and is recorded', async ({ page }) => {
  await start(page, 'SL29 drop');
  await openNotebook(page);
  const drop = (type: 'dragenter' | 'drop', name: string, text: string) =>
    page.getByTestId('notebook').evaluate(
      (el, [t, n, b]) => {
        const dt = new DataTransfer();
        dt.items.add(new File([b], n, { type: 'text/plain' }));
        el.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }));
      },
      [type, name, text] as const,
    );
  await drop('dragenter', 'visit.txt', SECRET);
  await expect(page.getByTestId('nb-drop-zone')).toHaveText('Drop files here to import them as notes');
  await drop('drop', 'visit.txt', SECRET);
  await expect(page.getByTestId('nb-drop-zone')).toHaveCount(0);
  await expect(page.getByTestId('nb-review')).toBeVisible();
  // one by one: label the name, dismiss the date, label the rest
  await page.getByTestId('nb-review-one').click();
  const flag = page.getByTestId('nb-review-flag');
  await expect(flag).toHaveAttribute('data-category', 'person');
  await page.getByTestId('nb-review-flag-label').click();
  await expect(flag).toHaveAttribute('data-category', 'date');
  await page.getByTestId('nb-review-flag-dismiss').click();
  // the city, the ZIP code and the phone number
  for (let i = 0; i < 3; i++) await page.getByTestId('nb-review-flag-label').click();
  await expect(page.getByTestId('nb-import-summary')).toContainText('Saved to the notebook: visit');
  await page.getByTestId('nb-import-done').click();
  await expect(page.getByTestId('nb-body')).toContainText('Spoke with [Person A] on 03/14/2026.');
  await expect(page.getByTestId('nb-source')).toContainText('identifiers reviewed one by one before saving');
  // Keep as is: a confirmation, once; recorded with the count kept
  await pick(page, () => page.getByTestId('nb-import').click(), txt('kept.txt', 'Call Mr. Lee at (256) 555-0199.'));
  await page.getByTestId('nb-review-keep').click();
  await expect(page.getByTestId('nb-review-keep-confirm')).toContainText('Keep these as they are?');
  await page.getByTestId('nb-review-keep-yes').click();
  await page.getByTestId('nb-import-done').click();
  await expect(page.getByTestId('nb-source')).toContainText('kept as is (2 possible identifiers)');
  await expect(page.getByTestId('nb-flag-count')).toHaveText(/2 possible identifiers/);
});

test('the size limit (20 MB by default) refuses a larger file with its size, and reads the rest', async ({ page }) => {
  await start(page, 'SL29 limit');
  await openNotebook(page);
  await pick(page, () => page.getByTestId('nb-import').click(), [
    { name: 'huge.txt', mimeType: 'text/plain', buffer: Buffer.alloc(21 * 1024 * 1024, 'a') },
    txt('small.txt', 'Rent is late.'),
  ]);
  await expect(page.getByTestId('nb-import-error')).toHaveText('huge.txt is 21.0 MB; the limit is 20 MB.');
  await expect(page.getByTestId('nb-import-error')).toHaveAttribute('data-reason', 'size');
  await page.getByTestId('nb-review-save').click();
  await expect(page.getByTestId('nb-import-summary')).toContainText('Saved to the notebook: small');
});

test('Paste as a note goes through the same review; Skip saves nothing', async ({ page }) => {
  await start(page, 'SL29 paste');
  await openNotebook(page);
  await page.getByTestId('nb-paste-open').click();
  await page.getByTestId('nb-paste-title').fill('Phone call');
  await page.getByTestId('nb-paste-text').fill('Ms. Ruiz said rent is due.');
  await page.getByTestId('nb-paste-go').click();
  await expect(page.getByTestId('nb-review-count')).toHaveText(/1 possible identifier: 1 name/);
  await page.getByTestId('nb-review-skip').click();
  await expect(page.getByTestId('nb-import-summary')).toContainText('Skipped: Phone call');
  await page.getByTestId('nb-import-done').click();
  await expect(page.getByTestId('nb-note')).toHaveCount(0);
  expect(await stored(page)).not.toContain('Ruiz');
});

for (const theme of ['light', 'dark'] as const)
  test(`axe: the import dialog in review and the imported note, ${theme}`, async ({ page }) => {
    await start(page, `SL29 axe ${theme}`);
    if (theme === 'dark') await page.getByTestId('theme-toggle').click();
    await openNotebook(page);
    await pick(page, () => page.getByTestId('nb-import').click(), [
      txt('a.txt', SECRET),
      { name: 'b.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Phone\nMr. Lee,(256) 555-0199\n') },
    ]);
    await expect(page.getByTestId('nb-review')).toBeVisible();
    const all = await scan(page, 'review');
    await page.getByTestId('nb-review-label-all').click();
    await expect(page.getByTestId('nb-review-title')).toContainText('b');
    all.push(...(await scan(page, 'review table')));
    await page.getByTestId('nb-review-label-all').click();
    await page.getByTestId('nb-import-done').click();
    await expect(page.getByTestId('nb-table')).toBeVisible();
    all.push(...(await scan(page, 'imported table')));
    await page.getByTestId('nb-note').first().getByRole('button').click();
    all.push(...(await scan(page, 'imported text')));
    expect(all).toEqual([]);
  });

test.describe('375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('import on a phone: the dialog fits, the review works, the note shows in the Notebook tab', async ({ page }) => {
    await start(page, 'SL29 phone');
    await page.getByTestId('nb-tab-nb').click();
    await pick(page, () => page.getByTestId('nb-import').click(), txt('phone.txt', SECRET));
    const d = page.getByTestId('nb-import-dialog');
    await expect(page.getByTestId('nb-review')).toBeVisible();
    const box = (await d.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.getByTestId('nb-review-label-all').click();
    await page.getByTestId('nb-import-done').click();
    await expect(page.getByTestId('nb-imported')).toBeVisible();
    expect(await scan(page, '375')).toEqual([]);
  });
});
