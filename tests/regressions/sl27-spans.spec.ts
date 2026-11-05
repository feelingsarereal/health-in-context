/**
 * SL27 (S7.1 slice 3): select text in a note, then — Create circumstance with a suggested code (sources and targets
 * agree, also after export and import), Add as evidence to… an existing circumstance (the reader's highlight class; a
 * click selects it and opens its card, which lists the passage), Link to… with the evidence check, Annotate (margin on a
 * wide notebook, inline on a narrow one); delete a circumstance and keep or remove its spans; orphaned selections;
 * overlapping spans; the proposal queue (local code matcher, labelled); grayscale; keyboard only; axe.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { addNode, dismissFirstRun, menuItem, newMap } from '../helpers';

const TEXT = "We've been staying at my sister's since the eviction. I lost my job in March.";
const QUOTE = "staying at my sister's since the eviction";

async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name);
  // newMap leaves the card in Edit; the passages show in Read
  await page.getByTestId('mode-read').click();
}
async function openNotebook(page: Page) {
  const t = page.getByTestId('notebook-toggle');
  if ((await t.getAttribute('aria-pressed')) !== 'true') await t.click();
  await expect(page.getByTestId('notebook')).toBeVisible();
  if (await page.getByTestId('dock-unfold').count()) await page.getByTestId('dock-unfold').click();
}
async function freeNote(page: Page, title: string, body: string) {
  await page.getByTestId('nb-new').click();
  await page.getByTestId('nb-title').fill(title);
  await page.getByTestId('nb-body').click();
  await page.keyboard.type(body);
}
/** select `text` inside the note body (a mouse-style selection), across highlight boundaries */
async function selectText(page: Page, text: string, nth = 0) {
  await page.getByTestId('nb-body').evaluate(
    (el, [t, k]) => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!(n.parentElement?.closest('.sx-approx, .nb-page'))) nodes.push(n as Text);
      const all = nodes.map((n) => n.textContent!).join('');
      let i = -1;
      for (let j = 0; j <= (k as number); j++) i = all.indexOf(t as string, i + 1);
      if (i < 0) throw new Error(`not found: ${t}`);
      const at = (off: number): [Text, number] => {
        for (const n of nodes) {
          if (off <= n.textContent!.length) return [n, off];
          off -= n.textContent!.length;
        }
        return [nodes[nodes.length - 1], nodes[nodes.length - 1].textContent!.length];
      };
      // as a mouse selection does, the editor has focus first
      (el as HTMLElement).focus();
      const r = document.createRange();
      r.setStart(...at(i));
      r.setEnd(...at(i + (t as string).length));
      const sel = getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
    },
    [text, nth] as const,
  );
  await expect(page.getByTestId('nb-action-bar')).toBeVisible();
  await expect(page.getByTestId('nb-action-quote')).toContainText(text.slice(0, 30));
}
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ nodes: { id: string; sources?: { note: string; span: string }[]; suggested_by?: { label: string } }[]; edges: { id: string; sources?: unknown[] }[]; notebook?: { spans?: { id: string; quote: string; orphaned?: boolean; by?: { inferred?: boolean } }[]; annotations?: { span: string; text?: string; targets: { kind: string; id: string }[] }[] } }>((res) => {
        const r = indexedDB.open('sdoh-loops');
        r.onsuccess = () => {
          const g = r.result.transaction('maps').objectStore('maps').getAll();
          g.onsuccess = () => res((g.result as never[]).map((x) => (typeof x === 'string' ? JSON.parse(x) : x)).sort((a: { updated: string }, b: { updated: string }) => b.updated.localeCompare(a.updated))[0]);
        };
      }),
  );
const scan = async (page: Page, where: string) =>
  (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

test('select → Create circumstance with a suggested code: nothing pre-chosen; sources and the span’s target agree, also after export and import', async ({ page }) => {
  await start(page, 'SL27 create');
  await openNotebook(page);
  await freeNote(page, 'Contact', TEXT);
  await selectText(page, QUOTE);
  await page.getByTestId('nb-act-create').click();
  const d = page.getByTestId('node-dialog');
  await expect(d.getByTestId('from-suggest-panel')).toBeVisible();
  const first = d.getByTestId('from-suggest').first();
  await expect(first).toHaveAttribute('data-code', /^QD71/);
  await expect(first).toContainText('suggested');
  await expect(first.locator('mark').first()).toHaveText(/evict/i);
  await expect(d.getByTestId('from-suggest')).toHaveCount(await d.getByTestId('from-suggest').count());
  expect(await d.getByTestId('from-suggest').count()).toBeLessThanOrEqual(5);
  await expect(d.getByTestId('from-notsure')).toBeVisible();
  await expect(d.getByTestId('from-other')).toBeVisible();
  // nothing chosen: Add is off until a pick
  await expect(d.getByTestId('node-submit')).toBeDisabled();
  await expect(d.locator('[aria-pressed="true"]')).toHaveCount(0);
  await first.click();
  await expect(d.getByTestId('node-submit')).toBeEnabled();
  await expect(d.getByRole('textbox', { name: 'Short label (optional)' })).toHaveText(QUOTE);
  await d.getByTestId('node-submit').click();
  await expect(d).toBeHidden();
  // the highlight, with the reader's class
  const hl = page.getByTestId('nb-body').locator('.sx-span');
  await expect(hl).toHaveText(QUOTE);
  await expect(hl).toHaveAttribute('data-pressed', 'true'); // the new circumstance is selected
  await expect(page.getByTestId('nb-passage')).toHaveCount(1);
  await expect.poll(async () => (await stored(page)).nodes.find((n) => n.sources)?.sources?.length).toBe(1);
  const m = await stored(page);
  const node = m.nodes.find((n) => n.sources)!;
  const span = m.notebook!.spans![0];
  expect(node.sources![0].span).toBe(span.id);
  expect(m.notebook!.annotations!.find((a) => a.span === span.id)!.targets).toEqual([{ kind: 'node', id: node.id }]);
  // export and import: still agreeing
  const [dl] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-json')]);
  const p = test.info().outputPath('m.json');
  await dl.saveAs(p);
  const file = JSON.parse(fs.readFileSync(p, 'utf8'));
  const fNode = file.nodes.find((n: { id: string }) => n.id === node.id);
  expect(fNode.sources).toEqual(node.sources);
  expect(file.notebook.annotations.find((a: { span: string }) => a.span === span.id).targets).toEqual([{ kind: 'node', id: node.id }]);
  await page.goto('/maps');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('open-map-file').click()]);
  await fc.setFiles(p);
  await expect(page.getByTestId('map-name')).toHaveText(/\(imported\)$/);
  await openNotebook(page);
  await expect(page.getByTestId('nb-body').locator('.sx-span')).toHaveText(QUOTE);
  await expect(page.getByTestId('nb-passage-target')).toHaveCount(1);
});

test('Add as evidence to… an existing circumstance: suggested first; the highlight has the reader class; a click selects it and opens its card, which lists the passage', async ({ page }) => {
  await start(page, 'SL27 evidence');
  await addNode(page, { code: 'QD51', search: 'low income', label: 'Low income' });
  await addNode(page, { code: 'QD71.Z', search: 'evict', label: 'Housing trouble' });
  await openNotebook(page);
  await freeNote(page, 'Contact', TEXT);
  await selectText(page, QUOTE);
  await page.getByTestId('nb-act-evidence').click();
  const picker = page.getByTestId('evidence-picker');
  await expect(picker.getByTestId('ev-node').first()).toHaveText(/Housing trouble/);
  await expect(picker.getByTestId('ev-node').first()).toHaveAttribute('data-suggested', 'true');
  await picker.getByTestId('ev-node').filter({ hasText: 'Housing trouble' }).click();
  await expect(page.getByTestId('evidence-dialog')).toBeHidden();
  const hl = page.getByTestId('nb-body').locator('.sx-span');
  await expect(hl).toHaveText(QUOTE);
  // clear the selection, then click the highlight
  await page.keyboard.press('Escape');
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dock-card-selection-toggle')).toHaveText(/Nothing selected$/);
  await hl.click();
  await expect(page.getByTestId('dock-card-selection-toggle')).toHaveText(/Selected circumstance$/);
  await expect(page.getByTestId('read-title')).toHaveText('Housing trouble');
  await expect(page.getByTestId('sources-list')).toContainText(QUOTE);
  await expect(page.getByTestId('source-where').first()).toHaveText('Contact');
  await expect(hl).toHaveAttribute('data-pressed', 'true');
  await expect(hl).toHaveCSS('outline-style', 'solid');
});

test('Link to… from a selection: two circumstances, the polarity chosen, the evidence check shown; the link gets the span as its source', async ({ page }) => {
  await start(page, 'SL27 link');
  await addNode(page, { code: 'QD71.Z', search: 'evict', label: 'Housing trouble' });
  await addNode(page, { code: 'QD51', search: 'low income', label: 'Low income' });
  await openNotebook(page);
  await freeNote(page, 'Contact', 'Since the eviction the money ran out.');
  await selectText(page, 'Since the eviction the money ran out');
  await page.getByTestId('nb-act-link').click();
  // SL28: Link to… is the picker over every kind; a new link between two circumstances is its first choice
  await page.getByTestId('link-any-dialog').getByTestId('link-any-new').click();
  const d = page.getByTestId('edge-dialog');
  await d.getByTestId('edge-from').selectOption({ label: 'Housing trouble' });
  await d.getByRole('radio', { name: /Low income/ }).check();
  await d.getByTestId('polarity-plus').check({ force: true });
  await expect(d.getByTestId('check-note')).toHaveAttribute('data-check', 'match');
  await d.getByTestId('edge-submit').click();
  await expect(d).toBeHidden();
  await expect.poll(async () => (await stored(page)).edges[0]?.sources?.length).toBe(1);
  await expect(page.getByTestId('sources-list')).toContainText('Since the eviction the money ran out');
});

test('delete a circumstance: keep its spans as plain highlights, or remove them; Undo restores both sides', async ({ page }) => {
  await start(page, 'SL27 delete');
  await openNotebook(page);
  await freeNote(page, 'Contact', TEXT);
  await selectText(page, QUOTE);
  await page.getByTestId('nb-act-create').click();
  await page.getByTestId('node-dialog').getByTestId('from-suggest').first().click();
  await page.getByTestId('node-dialog').getByTestId('node-submit').click();
  await page.getByTestId('mode-edit').click();
  await page.getByTestId('delete-node').click();
  const ask = page.getByTestId('delete-spans-dialog');
  await expect(page.getByTestId('delete-spans-lead')).toContainText('1 passage');
  await page.getByTestId('delete-spans-keep').click();
  await expect(ask).toBeHidden();
  await expect(page.getByTestId('nb-body').locator('.sx-span-plain')).toHaveText(QUOTE);
  await expect(page.getByTestId('nb-passage')).toContainText('A highlight only');
  // Undo: the circumstance and its highlight come back together
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('nb-body').locator('.sx-span')).toHaveText(QUOTE);
  await expect(page.getByTestId('nb-passage-target')).toHaveCount(1);
  // now remove
  await page.getByTestId('mode-edit').click();
  await page.getByTestId('nb-passage-target').click();
  await page.getByTestId('delete-node').click();
  await page.getByTestId('delete-spans-remove').click();
  await expect(page.getByTestId('nb-body').locator('[data-span]')).toHaveCount(0);
  await expect(page.getByTestId('nb-passages')).toHaveCount(0);
});

test('orphaned selections: deleting the text that holds a span lists it, never re-pointed; overlapping spans open a chooser', async ({ page }) => {
  await start(page, 'SL27 orphan');
  await addNode(page, { code: 'QD71.Z', search: 'evict', label: 'Housing trouble' });
  await addNode(page, { code: 'QD80', search: 'unemployment', label: 'Lost the job' });
  await openNotebook(page);
  await freeNote(page, 'Contact', TEXT);
  // two overlapping passages
  await selectText(page, QUOTE);
  await page.getByTestId('nb-act-evidence').click();
  await page.getByTestId('ev-node').filter({ hasText: 'Housing trouble' }).click();
  await selectText(page, 'the eviction. I lost my job');
  await page.getByTestId('nb-act-evidence').click();
  await page.getByTestId('ev-node').filter({ hasText: 'Lost the job' }).click();
  await expect(page.getByTestId('nb-passage')).toHaveCount(2);
  await page.getByTestId('nb-body').locator('[data-span]', { hasText: 'eviction' }).last().click();
  const ch = page.getByTestId('nb-chooser');
  await expect(ch.getByTestId('nb-chooser-item')).toHaveCount(2);
  await ch.getByTestId('nb-chooser-item').filter({ hasText: 'Lost the job' }).click();
  await expect(page.getByTestId('read-title')).toHaveText('Lost the job');
  // delete the words of the first passage
  await page.getByTestId('nb-body').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Rent was late.');
  await expect(page.getByTestId('nb-orphans').getByTestId('nb-orphan')).toHaveCount(2);
  await expect(page.getByTestId('nb-body').locator('[data-span]')).toHaveCount(0);
  // typing the words back does not re-point them
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(TEXT);
  await expect(page.getByTestId('nb-orphans').getByTestId('nb-orphan')).toHaveCount(2);
  expect((await stored(page)).notebook!.spans!.every((x) => x.orphaned)).toBe(true);
});

test('Annotate: the comment shows in the margin on a wide notebook and inline on a narrow one', async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 1000 });
  await start(page, 'SL27 annotate');
  await openNotebook(page);
  // widen the notebook so the margin fits
  await page.getByTestId('notebook-col').locator('[role="separator"]').focus();
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft');
  await freeNote(page, 'Contact', TEXT);
  await selectText(page, QUOTE);
  await page.getByTestId('nb-act-annotate').click();
  await page.getByTestId('nb-annot-text').fill('Doubled up after the eviction; ask about the lease.');
  await page.getByTestId('nb-annot-save').click();
  await expect(page.getByTestId('nb-passage-comment')).toHaveText('Doubled up after the eviction; ask about the lease.');
  await expect(page.getByTestId('nb-body').locator('.sx-span-plain')).toHaveText(QUOTE);
  await expect(page.getByTestId('nb-text-area')).toHaveAttribute('data-margin', 'margin');
  const body = (await page.getByTestId('nb-body').boundingBox())!;
  const margin = (await page.getByTestId('nb-margin').boundingBox())!;
  expect(margin.x).toBeGreaterThan(body.x + body.width - 1);
  // narrow: inline, below the text
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(page.getByTestId('nb-text-area')).toHaveAttribute('data-margin', 'inline');
  const b2 = (await page.getByTestId('nb-body').boundingBox())!;
  const m2 = (await page.getByTestId('nb-margin').boundingBox())!;
  expect(m2.y).toBeGreaterThan(b2.y + b2.height - 1);
});

test('the proposal queue: Suggest circumstances in this note (local code matcher), labelled; Accept makes an inferred-style span and keeps the label; Reject drops one', async ({ page }) => {
  await start(page, 'SL27 queue');
  await openNotebook(page);
  await freeNote(page, 'Contact', TEXT);
  await expect(page.getByTestId('nb-engine')).toHaveCount(0); // one extractor: no picker
  await page.getByTestId('nb-suggest').click();
  const props = page.getByTestId('nb-proposal');
  await expect(props.first()).toBeVisible();
  await expect(page.getByTestId('nb-proposal-by').first()).toHaveText('suggested by: Local code matcher');
  const qd80 = props.filter({ has: page.locator('[data-code="QD80"]') }).or(page.locator('[data-testid="nb-proposal"][data-code="QD80"]'));
  await expect(page.locator('[data-testid="nb-proposal"][data-code="QD80"]')).toHaveCount(1);
  void qd80;
  const n = await props.count();
  // reject the housing one, accept unemployment
  await page.locator('[data-testid="nb-proposal"][data-code^="QD71"]').getByTestId('nb-proposal-reject').click();
  await expect(props).toHaveCount(n - 1);
  await page.locator('[data-testid="nb-proposal"][data-code="QD80"]').getByTestId('nb-proposal-accept').click();
  await expect(page.getByTestId('read-suggested-by')).toHaveText('Local code matcher');
  await expect.poll(async () => (await stored(page)).nodes.find((x) => x.suggested_by)?.suggested_by?.label).toBe('Local code matcher');
  await expect(page.getByTestId('nb-passage-by')).toContainText('suggested by: Local code matcher');
});

test('grayscale: a span you made and one accepted as inferred stay distinguishable without color', async ({ page }) => {
  await start(page, 'SL27 gray');
  await addNode(page, { code: 'QD71.Z', search: 'evict', label: 'Housing trouble' });
  await openNotebook(page);
  await freeNote(page, 'Contact', "We've been staying at my sister's. I lost my job in March.");
  await selectText(page, "staying at my sister's");
  await page.getByTestId('nb-act-evidence').click();
  await page.getByTestId('ev-node').filter({ hasText: 'Housing trouble' }).click();
  await page.getByTestId('nb-suggest').click();
  await page.locator('[data-testid="nb-proposal"][data-code="QD80"]').getByTestId('nb-proposal-accept').click();
  await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });
  const made = page.getByTestId('nb-body').locator('.sx-span');
  const inferred = page.getByTestId('nb-body').locator('.sx-span-inferred, .sx-span-low');
  await expect(made).toHaveCount(1);
  await expect(inferred).toHaveCount(1);
  const style = (l: typeof made) => l.evaluate((el) => getComputedStyle(el).textDecorationStyle);
  expect(await style(made)).toBe('solid');
  expect(['dashed', 'dotted']).toContain(await style(inferred));
  await expect(page.getByTestId('nb-body').locator('.sx-approx')).toHaveText('≈');
});

test('keyboard only: Shift+arrows select, Ctrl+Enter opens the actions, Enter creates with a suggested code', async ({ page }) => {
  await start(page, 'SL27 keys');
  await openNotebook(page);
  await page.getByTestId('nb-new').click();
  await page.getByTestId('nb-title').fill('Keys');
  await page.keyboard.press('Tab'); // through the note's controls to the body
  await page.getByTestId('nb-body').focus();
  await page.keyboard.type('I lost my job in March');
  // at a held key's pace (a person's key repeat is ~30 ms), not a machine's
  for (let i = 0; i < 'lost my job in March'.length; i++) await page.keyboard.press('Shift+ArrowLeft', { delay: 25 });
  await expect(page.getByTestId('nb-action-bar')).toBeVisible();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('nb-act-create')).toBeFocused();
  await page.keyboard.press('Enter');
  const d = page.getByTestId('node-dialog');
  await expect(d.getByTestId('from-suggest').first()).toHaveAttribute('data-code', 'QD80');
  await d.getByTestId('from-suggest').first().focus();
  await page.keyboard.press('Enter');
  await d.getByTestId('node-submit').focus();
  await page.keyboard.press('Enter');
  await expect(d).toBeHidden();
  await expect(page.getByTestId('nb-body').locator('.sx-span')).toHaveText('lost my job in March');
  // Esc from the action bar returns to the text
  // the caret at the very end of the text (End stops at the end of a wrapped line), then select by keyboard
  await page.getByTestId('nb-body').evaluate((el) => {
    (el as HTMLElement).focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  });
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft', { delay: 25 });
  await expect(page.getByTestId('nb-action-quote')).toContainText('March');
  await page.keyboard.press('Shift+F10');
  await expect(page.getByTestId('nb-act-create')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('nb-body')).toBeFocused();
});

for (const theme of ['light', 'dark'] as const)
  test(`axe: the action bar, the suggestion panel and the proposal queue, ${theme}`, async ({ page }) => {
    await start(page, `SL27 axe ${theme}`);
    if (theme === 'dark') await page.getByTestId('theme-toggle').click();
    await openNotebook(page);
    await freeNote(page, 'Contact', TEXT);
    await selectText(page, QUOTE);
    const all = await scan(page, 'action bar');
    await page.getByTestId('nb-act-create').click();
    await expect(page.getByTestId('from-suggest-panel')).toBeVisible();
    all.push(...(await scan(page, 'suggestions')));
    await page.getByTestId('node-dialog').getByTestId('from-suggest').first().click();
    await page.getByTestId('node-dialog').getByTestId('node-submit').click();
    await page.getByTestId('nb-suggest').click();
    await expect(page.getByTestId('nb-proposal').first()).toBeVisible();
    all.push(...(await scan(page, 'queue and passages')));
    expect(all).toEqual([]);
  });

test('point 8: the card lists the passage in Read and in Edit, and the peek counts it; Go to passage lands on it with focus; Remove as evidence drops it and Undo brings it back; a highlight click keeps the viewer’s mode', async ({ page }) => {
  await start(page, 'SL27 sources');
  await addNode(page, { code: 'QD71.Z', search: 'evict', label: 'Housing trouble' });
  await page.getByTestId('mode-read').click();
  await openNotebook(page);
  // a structured note: its anchor is the field
  await page.getByTestId('nb-template').selectOption({ label: 'Contact note' });
  await page.getByTestId('nb-field-discussed').click();
  await page.keyboard.type(TEXT);
  const field = page.getByTestId('nb-field-discussed');
  await field.evaluate((el, t) => {
    (el as HTMLElement).focus();
    const n = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const i = n.textContent!.indexOf(t);
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + t.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  }, QUOTE);
  await page.getByTestId('nb-act-evidence').click();
  await page.getByTestId('ev-node').filter({ hasText: 'Housing trouble' }).click();
  // Read: In the notebook (1), the quote, note · anchor
  const list = page.getByTestId('selection-body').getByTestId('sources-list');
  await expect(list.getByRole('heading')).toHaveText('In the notebook (1)');
  await expect(list.getByTestId('source-quote')).toHaveText(`“${QUOTE}”`);
  await expect(list.getByTestId('source-where')).toHaveText('Contact note · What was discussed');
  await expect(list.getByTestId('source-quote').locator('..')).toHaveCSS('-webkit-line-clamp', '2');
  // Go to passage: scrolled to inside the notebook, focus in its text, the page unmoved
  await page.getByTestId('nb-scroll').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await list.getByTestId('source-go').click();
  const hl = field.locator('.sx-span');
  await expect(hl).toBeInViewport();
  await expect(field).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Remove as evidence: gone from the card and the text; Undo brings both back
  await list.getByTestId('source-remove').click();
  await expect(page.getByTestId('selection-body').getByTestId('sources-list')).toHaveCount(0);
  await expect(field.locator('[data-span]')).toHaveCount(0);
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('selection-body').getByTestId('sources-list')).toHaveCount(1);
  await expect(field.locator('.sx-span')).toHaveText(QUOTE);
  // Edit mode lists it too
  await page.getByTestId('mode-edit').click();
  const editList = page.getByTestId('inspector').getByTestId('sources-list');
  await expect(editList.getByTestId('source-where')).toHaveText('Contact note · What was discussed');
  await expect(editList.getByTestId('source-remove')).toBeVisible();
  // the peek counts it, and its link opens the card
  const b = (await page.getByTestId('canvas').boundingBox())!;
  const li = page.getByTestId('canvas-outline').locator('li[data-node]', { hasText: 'Housing trouble' }).first();
  await expect(async () => {
    await page.mouse.click(b.x + Number(await li.getAttribute('data-rx')), b.y + Number(await li.getAttribute('data-ry')), { button: 'right' });
    await expect(page.getByTestId('peek')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(page.getByTestId('peek-sources')).toHaveText('In the notebook: 1 passage');
  await page.getByTestId('peek-sources').click();
  await expect(page.getByTestId('peek')).toHaveCount(0);
  // a highlight click keeps the mode the viewer chose: Edit now, Read after choosing Read
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Escape');
  await field.locator('.sx-span').click();
  await expect(page.getByTestId('mode-edit')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('mode-read').click();
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Escape');
  await field.locator('.sx-span').click();
  await expect(page.getByTestId('mode-read')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('read-title')).toHaveText('Housing trouble');
});

test('point 9: a PDF printed from a page with an icon font and a custom-encoded "(" imports with no box or U+FFFD, keeps "(2024)", and reports what was dropped', async ({ page, context }) => {
  // the fixture PDF, made the way the user guide was: a browser's print to PDF (tests/fixtures/make-fixture-font.py)
  const font = fs.readFileSync('tests/fixtures/sl27-fixture-font.ttf').toString('base64');
  const printer = await context.newPage();
  await printer.setContent(`<style>@font-face{font-family:F;src:url(data:font/ttf;base64,${font})} body{font-family:F;font-size:20px} .c{font-feature-settings:'case'}</style><p>Collinson et al. <span class=c>(2024)</span> said so.</p><p><span>&#xE900;</span> Housing <span>&#xE900;</span></p><p>As the guide does, it also uses a plain (parenthesis).</p>`);
  await printer.evaluate(() => document.fonts.ready);
  const pdf = await printer.pdf();
  await printer.close();
  await start(page, 'SL27 pdf glyphs');
  await openNotebook(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('nb-import').click()]);
  await fc.setFiles({ name: 'guide.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByTestId('nb-review')).toBeVisible();
  const text = await page.getByTestId('nb-review-text').innerText();
  expect(text).toContain('Collinson et al. (2024) said so.');
  expect(text).not.toMatch(/[\uE000-\uF8FF\uFFFD\u25A1]/);
  await expect(page.getByTestId('nb-review-dropped')).toHaveText('2 characters could not be read and were left out.');
  await page.getByTestId('nb-review-save').click();
  await page.getByTestId('nb-import-done').click();
  await expect(page.getByTestId('nb-source')).toContainText('2 characters could not be read and were left out.');
  const stored = await page.evaluate(() => new Promise<string>((res) => { const r = indexedDB.open('sdoh-loops'); r.onsuccess = () => { const g = r.result.transaction('maps').objectStore('maps').getAll(); g.onsuccess = () => res(JSON.stringify(g.result)); }; }));
  expect(stored).toContain('(2024)');
  expect(stored).not.toMatch(/[\uE000-\uF8FF\uFFFD]/);
});
