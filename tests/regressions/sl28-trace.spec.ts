/**
 * SL28 (S7.1 slice 4): traceability everywhere. Along the S7.1 walkthrough — write a contact note, flag and label, select
 * and create a circumstance, link it to Low income, the loop forms, Loops shows its passages, Go to passage lands on the
 * highlight, the trace view; Link to… over every kind and @ mentions; "Cited in your notebook" on a code, a term and the
 * References page; the case summary's Sources column; collapsing notes (point 6); Export case round trip; the report in
 * every format (no flagged identifier unless confirmed, its table equals the case summary, every quote resolves, the
 * printed PDF has a page per note); axe; 375 px.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import JSZip from 'jszip';
import { openTool, tool, addNode, dismissFirstRun, menuItem, newMap } from '../helpers';

const DISCUSSED = "Ms. Rivera called from 205-555-0134. We've been staying at my sister's since the eviction. I lost my job in March.";
const QUOTE = "staying at my sister's since the eviction";

async function start(page: Page, name: string) {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, name, '', 'read'); // the passages show in Read
}
async function openNotebook(page: Page) {
  await openTool(page, 'notebook-toggle');
  const t = page.getByTestId('notebook-toggle');
  if ((await t.getAttribute('aria-checked')) !== 'true') await t.click();
  else await page.keyboard.press('Escape');
  await expect(page.getByTestId('notebook')).toBeVisible();
  if (await page.getByTestId('dock-unfold').count()) await page.getByTestId('dock-unfold').click();
}
async function freeNote(page: Page, title: string, body: string) {
  await page.getByTestId('nb-new').click();
  await page.getByTestId('nb-title').fill(title);
  await page.getByTestId('nb-body').click();
  await page.keyboard.type(body);
}
/** select `text` inside a note field (a mouse-style selection) */
async function selectText(page: Page, text: string, field = 'nb-body') {
  await page.getByTestId(field).evaluate((el, t) => {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!n.parentElement?.closest('.sx-approx, .nb-page, .sx-chip')) nodes.push(n as Text);
    const all = nodes.map((n) => n.textContent!).join('');
    const i = all.indexOf(t);
    if (i < 0) throw new Error(`not found: ${t}`);
    const at = (off: number): [Text, number] => {
      for (const n of nodes) {
        if (off <= n.textContent!.length) return [n, off];
        off -= n.textContent!.length;
      }
      return [nodes[nodes.length - 1], nodes[nodes.length - 1].textContent!.length];
    };
    (el as HTMLElement).focus();
    const r = document.createRange();
    r.setStart(...at(i));
    r.setEnd(...at(i + t.length));
    const sel = getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
  }, text);
  await expect(page.getByTestId('nb-action-bar')).toBeVisible();
  // the bar shows this selection (not one left from before a dialog)
  await expect(page.getByTestId('nb-action-quote')).toHaveText(`“${text}”`);
}
/** put the caret inside `text` (a collapsed selection), as a click in the text would */
async function caretIn(page: Page, text: string, field = 'nb-body') {
  await page.getByTestId(field).evaluate((el, t) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent!.indexOf(t.slice(0, 6));
      if (i >= 0) {
        (el as HTMLElement).focus();
        const r = document.createRange();
        r.setStart(n, i + 3);
        r.collapse(true);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(r);
        return;
      }
    }
    throw new Error(`not found: ${t}`);
  }, text);
}
type Stored = {
  id: string; name: string;
  nodes: { id: string; code: string | null; sources?: { span: string }[] }[];
  edges: { id: string; from: string; to: string; sources?: unknown[] }[];
  notebook?: { notes: { id: string; title: string }[]; spans?: { id: string; quote: string; chip?: boolean; note: string }[]; annotations?: { span: string; text?: string; targets: { kind: string; id: string }[] }[] };
};
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Stored>((res) => {
        const r = indexedDB.open('sdoh-loops');
        r.onsuccess = () => {
          const g = r.result.transaction('maps').objectStore('maps').getAll();
          g.onsuccess = () => res((g.result as never[]).map((x) => (typeof x === 'string' ? JSON.parse(x) : x)).sort((a: { updated: string }, b: { updated: string }) => b.updated.localeCompare(a.updated))[0]);
        };
      }),
  );
const scan = async (page: Page, where: string) =>
  (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${where}: ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

/** a link through the link form, with an override when the evidence check does not back it */
async function linkForm(page: Page, from: string, to: RegExp) {
  const d = page.getByTestId('edge-dialog');
  await expect(d).toBeVisible();
  await d.getByTestId('edge-from').selectOption({ label: from });
  await d.getByRole('radio', { name: to }).check();
  await d.getByTestId('polarity-plus').check({ force: true });
  if (await d.getByTestId('edge-submit').isDisabled()) {
    await d.getByTestId('override-checkbox').check();
    await d.getByRole('textbox', { name: 'Why keep this link?' }).click();
    await page.keyboard.type('Seen in this case.');
  }
  await d.getByTestId('edge-submit').click();
  await expect(d).toBeHidden();
}

/** the S7.1 walkthrough up to the loop: a contact note, labelled; Homelessness from the selection; links with Low income */
async function walkthrough(page: Page, name: string) {
  await start(page, name);
  await addNode(page, { code: 'QD51', search: 'low income', label: 'Low income' });
  await openNotebook(page);
  await page.getByTestId('nb-template').selectOption({ label: 'Contact note' });
  await page.getByTestId('nb-title').fill('Contact 1');
  await page.getByTestId('nb-field-discussed').click();
  await page.keyboard.type(DISCUSSED);
  // flag and label
  await expect(page.getByTestId('nb-flag-count')).toContainText('possible identifier');
  await page.getByTestId('nb-flag-count').click();
  await page.getByTestId('nb-label-all').click();
  await expect(page.getByTestId('nb-field-discussed')).not.toContainText('205-555-0134');
  // select → Create circumstance (suggested QD71.x)
  await selectText(page, QUOTE, 'nb-field-discussed');
  await page.getByTestId('nb-act-create').click();
  const d = page.getByTestId('node-dialog');
  const first = d.getByTestId('from-suggest').first();
  await expect(first).toHaveAttribute('data-code', /^QD71/);
  await first.click();
  await d.getByRole('textbox', { name: 'Short label (optional)' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Homelessness or housing instability');
  await d.getByTestId('node-submit').click();
  await expect(d).toBeHidden();
  // links it to Low income (from the passage: Link to… → a new link), and Low income back to it: the loop forms
  await selectText(page, 'since the eviction', 'nb-field-discussed');
  await page.getByTestId('nb-act-link').click();
  await expect(page.getByTestId('link-any-dialog')).toBeVisible();
  await page.getByTestId('link-any-new').click();
  await linkForm(page, 'Homelessness or housing instability', /Low income/);
  await selectText(page, 'I lost my job in March', 'nb-field-discussed');
  await page.getByTestId('nb-act-evidence').click();
  await page.getByTestId('evidence-dialog').getByTestId('ev-node').filter({ hasText: 'Low income' }).click();
  await page.getByTestId('add-edge').click();
  await linkForm(page, 'Low income', /Homelessness/);
  await expect(page.getByTestId('loops-count')).toHaveText('1');
}

test('the S7.1 walkthrough: the loop forms, Loops shows its passages, Go to passage lands on the highlight, the trace view dims the rest', async ({ page }) => {
  await walkthrough(page, 'SL28 walk');
  const m = await stored(page);
  expect(m.edges).toHaveLength(2);
  expect(m.edges.filter((e) => e.sources?.length)).toHaveLength(1);
  // Loops: the loop's passages, grouped by circumstance
  await page.getByTestId('panel-loops').click();
  const fold = page.getByTestId('loop-passages').first();
  await expect(fold).toHaveAttribute('data-count', '3');
  await fold.locator('summary').click();
  await expect(fold.getByRole('heading', { name: 'Homelessness or housing instability' })).toBeVisible();
  await expect(fold.getByRole('heading', { name: 'Low income' })).toBeVisible();
  // the case summary: the Sources column and the loop's passages
  const row = page.getByTestId('summary-table').locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: 'Low income', exact: true }) });
  await expect(row.getByTestId('summary-sources')).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('summary-loop-passages')).toHaveAttribute('data-count', '3');
  // collapse the note, then Go to passage from the loop reopens it at the highlight, with focus in its field
  await page.getByTestId('nb-collapse').click();
  await expect(page.getByTestId('nb-editor')).toHaveCount(0);
  await fold.getByTestId('fold-item').filter({ hasText: 'I lost my job in March' }).getByTestId('fold-go').click();
  const hl = page.getByTestId('nb-field-discussed').locator('[data-span]', { hasText: 'I lost my job in March' });
  await expect(hl).toBeVisible();
  await expect(hl).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('nb-field-discussed');
  // the trace view: with the caret in the Low income passage, Homelessness and its passage are dimmed
  await tool(page, 'trace-toggle');
  await openTool(page, 'trace-toggle');
  await expect(page.getByTestId('trace-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await caretIn(page, 'I lost my job in March', 'nb-field-discussed');
  const lowId = m.nodes.find((n) => n.code === 'QD51')!.id;
  const homeId = m.nodes.find((n) => n.code !== 'QD51')!.id;
  await expect(page.locator(`[data-testid="canvas-outline"] li[data-node="${lowId}"]`)).toHaveAttribute('data-state', 'highlighted');
  await expect(page.locator(`[data-testid="canvas-outline"] li[data-node="${homeId}"]`)).toHaveAttribute('data-state', 'dimmed');
  // the caret's passage selected its circumstance (the controlled selection), and dimmed the passages not connected
  await expect(page.locator(`[data-testid="canvas-outline"] li[data-node="${lowId}"]`)).toHaveAttribute('data-selected', 'true');
  const qid = m.notebook!.spans!.find((x) => x.quote === QUOTE)!.id;
  await expect(page.getByTestId('nb-field-discussed').locator(`[data-span="${qid}"].sx-dim`).first()).toBeVisible();
  await expect(page.getByTestId('nb-passage').filter({ hasText: 'I lost my job' })).not.toHaveAttribute('data-dim', 'true');
  expect(await scan(page, 'walkthrough + trace')).toEqual([]);
  // off: nothing is dimmed
  await tool(page, 'trace-toggle');
  await expect(page.getByTestId('nb-field-discussed').locator('.sx-dim')).toHaveCount(0);
});

test('Link to… over every kind: a code, a loop, a glossary term; each opens from the passage, and the code says "Cited in your notebook"', async ({ page }) => {
  await walkthrough(page, 'SL28 kinds');
  await selectText(page, 'I lost my job', 'nb-field-discussed');
  await page.getByTestId('nb-act-link').click();
  const pick = page.getByTestId('link-any-dialog');
  // with no query: what is on the map, grouped
  for (const k of ['node', 'edge', 'loop', 'cluster', 'code']) await expect(pick.locator(`[data-testid="picker-group"][data-kind="${k}"]`)).toBeVisible();
  await pick.getByTestId('picker-search').fill('unemployment');
  await pick.locator('[data-testid="picker-item"][data-kind="code"]').first().click();
  await expect(pick).toBeHidden();
  let m = await stored(page);
  const a = m.notebook!.annotations!.find((x) => x.targets.some((t) => t.kind === 'code'))!;
  expect(a.targets.find((t) => t.kind === 'code')!.id).toMatch(/^QD8/);
  // its target opens the code's own text, which lists the passage
  await page.getByTestId('nb-passage-target').filter({ hasText: /^QD8/ }).first().click();
  const item = page.getByTestId('item-dialog');
  await expect(item.getByTestId('code-popout')).toBeVisible();
  await expect(item.getByTestId('cited-in-notebook')).toHaveAttribute('data-count', '1');
  await item.getByTestId('cited-go').click();
  await expect(item).toBeHidden();
  // a loop, by its node cycle
  await selectText(page, 'We\'ve been', 'nb-field-discussed');
  await page.getByTestId('nb-act-link').click();
  await pick.locator('[data-testid="picker-item"][data-kind="loop"]').first().click();
  // and a glossary term
  await selectText(page, 'I lost', 'nb-field-discussed');
  await page.getByTestId('nb-act-link').click();
  await pick.getByTestId('picker-search').fill('loop');
  await expect(pick.locator('[data-testid="picker-group"][data-kind="glossary"]')).toBeVisible();
  await pick.locator('[data-testid="picker-item"][data-kind="glossary"]').first().click();
  m = await stored(page);
  const kinds = new Set(m.notebook!.annotations!.flatMap((x) => x.targets.map((t) => t.kind)));
  for (const k of ['node', 'edge', 'code', 'loop', 'glossary']) expect(kinds).toContain(k);
  // the loop target opens the Loops tab with the loop highlighted
  await page.getByTestId('nb-passage').filter({ hasText: "We've been" }).getByTestId('nb-passage-target').click();
  await expect(page.getByTestId('loop-item').first()).toHaveClass(/ring-2/);
  // the glossary term opens with "Cited in your notebook (1)"
  await page.getByTestId('nb-passage').filter({ hasText: /^“I lost”/ }).getByTestId('nb-passage-target').click();
  await expect(page.getByTestId('item-dialog').getByTestId('item-term')).toBeVisible();
  await expect(page.getByTestId('item-dialog').getByTestId('cited-in-notebook')).toHaveAttribute('data-count', '1');
  expect(await scan(page, 'item dialog')).toEqual([]);
});

test('@ mentions: the picker opens where @ is typed, the choice is a chip that stays put, survives a reload and backs the circumstance; Esc types an @', async ({ page }) => {
  await start(page, 'SL28 mention');
  await addNode(page, { code: 'QD51', search: 'low income', label: 'Low income' });
  await openNotebook(page);
  await freeNote(page, 'Visit', 'Talked about ');
  await page.keyboard.type('@');
  const d = page.getByTestId('mention-dialog');
  await expect(d).toBeVisible();
  await d.getByTestId('picker-search').fill('low');
  await d.locator('[data-testid="picker-item"][data-kind="node"]').first().click();
  await expect(d).toBeHidden();
  const chip = page.getByTestId('nb-body').locator('.sx-chip');
  await expect(chip).toHaveText('@Low income');
  await page.getByTestId('nb-body').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' and rent.');
  await expect(page.getByTestId('nb-body')).toContainText('Talked about @Low income and rent.');
  await expect.poll(async () => (await stored(page)).notebook?.spans?.filter((x) => x.chip).length).toBe(1);
  const m = await stored(page);
  const chipSpan = m.notebook!.spans!.find((x) => x.chip)!;
  expect(m.nodes.find((n) => n.code === 'QD51')!.sources!.map((s) => s.span)).toContain(chipSpan.id);
  // the card lists it; Esc in the picker types a plain @
  // inside a word (an email address) @ is just an @; at a word's start the picker opens, and Esc types the @
  await page.keyboard.type(' Mail a@b. Then ');
  await expect(d).toBeHidden();
  await page.keyboard.type('@');
  await expect(d).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
  await expect(page.getByTestId('nb-body')).toContainText('Mail a@b. Then @');
  await page.reload();
  await openNotebook(page);
  await expect(page.getByTestId('nb-body').locator('.sx-chip')).toHaveText('@Low income');
  // a click on the chip selects its circumstance
  await page.getByTestId('nb-body').locator('.sx-chip').click();
  await expect(page.getByTestId('sources-list')).toBeVisible();
  expect(await scan(page, 'mention')).toEqual([]);
});

test('point 6: collapse by row, by the button and by Esc; it stays collapsed after a reload; Go to passage reopens the right note; an empty untitled note goes on collapse and Undo restores it', async ({ page }) => {
  await start(page, 'SL28 collapse');
  await addNode(page, { code: 'QD51', search: 'low income', label: 'Low income' });
  await openNotebook(page);
  await freeNote(page, 'First', 'I lost my job in March.');
  await selectText(page, 'I lost my job');
  await page.getByTestId('nb-act-evidence').click();
  await page.getByTestId('evidence-dialog').getByTestId('ev-node').first().click();
  await freeNote(page, 'Second', 'Nothing much.');
  const row = (t: string) => page.getByTestId('nb-note').filter({ hasText: t }).locator('[data-note-button]');
  await expect(row('Second')).toHaveAttribute('aria-expanded', 'true');
  await expect(row('First')).toHaveAttribute('aria-expanded', 'false');
  // by row click
  await row('Second').click();
  await expect(page.getByTestId('nb-editor')).toHaveCount(0);
  await expect(row('Second')).toHaveAttribute('aria-expanded', 'false');
  // the list and the case summary sit together
  await expect(page.getByTestId('case-summary')).toBeVisible();
  // by the button
  await row('Second').click();
  await page.getByTestId('nb-collapse').click();
  await expect(page.getByTestId('nb-editor')).toHaveCount(0);
  await expect(row('Second')).toBeFocused();
  // by Esc in the list
  await row('First').click();
  await expect(page.getByTestId('nb-editor')).toHaveAttribute('data-note-id', /.+/);
  await row('First').press('Escape');
  await expect(page.getByTestId('nb-editor')).toHaveCount(0);
  // Alt+↓ still reorders
  await row('First').press('Alt+ArrowDown');
  await expect(page.getByTestId('nb-note').first()).toContainText('Second');
  // stays collapsed after a reload
  await page.reload();
  await openNotebook(page);
  await expect(page.getByTestId('nb-note')).toHaveCount(2);
  await expect(page.getByTestId('nb-editor')).toHaveCount(0);
  // Go to passage (the selection card) reopens the right note
  await page.getByTestId('summary-table').locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: 'Low income', exact: true }) }).getByTestId('summary-source-go').click();
  await expect(page.getByTestId('nb-editor')).toBeVisible();
  await expect(page.getByTestId('nb-title')).toHaveValue('First');
  // an empty untitled note disappears on collapse; Undo restores it
  await page.getByTestId('nb-new').click();
  await expect(page.getByTestId('nb-note')).toHaveCount(3);
  await page.getByTestId('nb-collapse').click();
  await expect(page.getByTestId('nb-note')).toHaveCount(2);
  await expect(page.getByTestId('nb-toast')).toContainText('Removed an empty untitled note');
  await page.getByTestId('nb-toast-undo').click();
  await expect(page.getByTestId('nb-note')).toHaveCount(3);
  // a new note, then another: the first (left empty) goes when the second opens
  await page.getByTestId('nb-new').click();
  await expect(page.getByTestId('nb-note')).toHaveCount(4);
  await page.getByTestId('nb-new').click();
  await expect(page.getByTestId('nb-note')).toHaveCount(4);
  await expect(page.getByTestId('nb-toast')).toContainText('Removed an empty untitled note');
  expect(await scan(page, 'collapse')).toEqual([]);
});

test('Export case → Open a map file: the map and the notebook come back with every annotation target resolving', async ({ page }) => {
  await walkthrough(page, 'SL28 case');
  const [dl] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-case')]);
  expect(dl.suggestedFilename()).toMatch(/\.sdohcase\.json$/);
  const p = test.info().outputPath(dl.suggestedFilename());
  await dl.saveAs(p);
  const file = JSON.parse(fs.readFileSync(p, 'utf8'));
  expect(file.provenance).toMatchObject({ notes: 1, spans: 3, mentions: 0 });
  expect(file.provenance.labelledTotal).toBeGreaterThan(0);
  // the pack this build pins (SL32: 0.3.0)
  expect(file.provenance.pins).toMatchObject({ pack: JSON.parse(fs.readFileSync('packages/sdoh-loops-pack/package.json', 'utf8')).version });
  expect(JSON.stringify(file.provenance)).not.toContain('205-555');
  await page.getByTestId('import-file').setInputFiles(p);
  await expect(page.getByTestId('map-name')).toContainText('(imported)');
  const m = await stored(page);
  expect(m.notebook!.notes).toHaveLength(1);
  expect(m.notebook!.spans).toHaveLength(3);
  const ids = new Set([...m.nodes.map((n) => `node:${n.id}`), ...m.edges.map((e) => `edge:${e.id}`)]);
  for (const a of m.notebook!.annotations!) for (const t of a.targets) expect(ids.has(`${t.kind}:${t.id}`), `${t.kind}:${t.id}`).toBe(true);
  for (const n of m.nodes) for (const s of n.sources ?? []) expect(m.notebook!.spans!.some((x) => x.id === s.span)).toBe(true);
  await openNotebook(page);
  // the same note ids: the note this viewer left open is open in the copy too
  const r = page.getByTestId('nb-note').first().locator('[data-note-button]');
  if ((await r.getAttribute('aria-expanded')) !== 'true') await r.click();
  await expect(page.getByTestId('nb-passage')).toHaveCount(3);
});

test('the report in every format: no flagged identifier unless confirmed; its table equals the case summary; every quote resolves; the printed PDF has a page per note', async ({ page, browser }) => {
  await walkthrough(page, 'SL28 report');
  // a second note with an identifier left in
  await page.getByTestId('nb-new').click();
  await page.getByTestId('nb-title').fill('Phone');
  await page.getByTestId('nb-body').click();
  await page.keyboard.type('Call back on 256-555-0199.');
  const exportAs = async (f: string, answer: 'label' | 'anyway' | null) => {
    await menuItem(page, 'export-report');
    await page.getByTestId(`report-format-${f}`).check();
    const go = page.getByTestId('report-go').click();
    if (!answer) {
      const [d] = await Promise.all([page.waitForEvent('download'), go]);
      return d;
    }
    await go;
    await expect(page.getByTestId('nb-warn')).toBeVisible();
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId(answer === 'label' ? 'nb-warn-label' : 'nb-warn-anyway').click()]);
    return d;
  };
  const read = async (d: Awaited<ReturnType<typeof exportAs>>) => {
    const p = test.info().outputPath(d.suggestedFilename());
    await d.saveAs(p);
    return p;
  };
  // confirmed: the value is there, and the cover says it was confirmed
  const kept = fs.readFileSync(await read(await exportAs('html', 'anyway')), 'utf8');
  expect(kept).toContain('256-555-0199');
  expect(kept).toContain('as you confirmed before exporting');
  expect(kept).toContain('heuristic');
  // labelled: no identifier in any format
  const html = fs.readFileSync(await read(await exportAs('html', 'label')), 'utf8');
  const md = fs.readFileSync(await read(await exportAs('md', null)), 'utf8');
  const docx = await JSZip.loadAsync(fs.readFileSync(await read(await exportAs('docx', null))));
  const docXml = await docx.file('word/document.xml')!.async('string');
  for (const out of [html, md, docXml]) {
    expect(out).not.toContain('256-555-0199');
    expect(out).not.toContain('205-555-0134');
    expect(out).not.toContain('Rivera');
    expect(out).toContain('heuristic');
    expect(out).toContain('Contact 1');
  }
  // the circumstance table equals the case summary's
  const summaryNames = await page.getByTestId('summary-table').locator('tbody th[scope="row"]').allInnerTexts();
  const rp = await browser.newPage();
  await rp.setContent(html);
  const reportNames = await rp.locator('table[data-table="circumstances"] tbody th').allInnerTexts();
  expect(reportNames.map((s) => s.trim())).toEqual(summaryNames.map((s) => s.replace('(pinned)', '').trim()));
  const summaryCodes = await page.getByTestId('summary-table').locator('tbody td[data-cell="code"]').allInnerTexts();
  expect((await rp.locator('table[data-table="circumstances"] tbody tr td:nth-of-type(1)').allInnerTexts()).map((s) => s.trim())).toEqual(summaryCodes.map((s) => s.trim()));
  // every quote resolves to a span
  const m = await stored(page);
  const spans = new Map(m.notebook!.spans!.map((x) => [x.id, x.quote]));
  const quotes = await rp.locator('blockquote[data-span]').evaluateAll((els) => els.map((e) => ({ span: e.getAttribute('data-span')!, quote: e.querySelector('q')!.textContent! })));
  expect(quotes.length).toBeGreaterThan(3);
  for (const q of quotes) expect(spans.get(q.span)).toBe(q.quote);
  // printed: a page per note (cover, two notes, summary, references)
  await rp.emulateMedia({ media: 'print' });
  const pdf = await rp.pdf({ format: 'Letter' });
  fs.writeFileSync(test.info().outputPath('report.pdf'), pdf);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  expect(pages).toBeGreaterThanOrEqual(5);
  const noteTops = await rp.locator('article.note').evaluateAll((els) => els.map((e) => getComputedStyle(e).breakBefore));
  expect(noteTops).toEqual(['page', 'page']);
  await rp.close();
  // Print / Save as PDF: the report's page in a hidden frame
  await menuItem(page, 'export-report');
  await page.getByTestId('report-format-print').check();
  await page.getByTestId('report-go').click();
  const frame = page.locator('iframe[data-testid="report-print-frame"]');
  await expect(frame).toHaveCount(1);
  expect(await frame.getAttribute('srcdoc')).toContain('Case report: SL28 report');
  expect(await scan(page, 'report dialog done')).toEqual([]);
});

test('Cited in your notebook on the References page, linking back to the passage in its map', async ({ page }) => {
  await start(page, 'SL28 refs');
  await openNotebook(page);
  await freeNote(page, 'Reading', 'The loop idea comes from the classic texts.');
  await selectText(page, 'The loop idea');
  await page.getByTestId('nb-act-link').click();
  const pick = page.getByTestId('link-any-dialog');
  await pick.getByTestId('picker-search').fill('19');
  const ref = pick.locator('[data-testid="picker-item"][data-kind="reference"]').first();
  const refId = await ref.getAttribute('data-id');
  await ref.click();
  // once autosave has it
  await expect.poll(async () => (await stored(page)).notebook?.annotations?.some((a) => a.targets.some((t) => t.kind === 'reference'))).toBe(true);
  await page.goto('/references');
  const card = page.locator(`#ref-${refId}`);
  await expect(card.getByTestId('cited-in-notebook')).toHaveAttribute('data-count', '1');
  await card.getByTestId('cited-go').click();
  await expect(page).toHaveURL(/\/map\?id=.*&passage=/);
  const hl = page.getByTestId('nb-body').locator('[data-span]', { hasText: 'The loop idea' });
  await expect(hl).toBeVisible();
  expect(await scan(page, 'back from references')).toEqual([]);
});

test('375 px: the picker, a mention and the collapse work on a phone, with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page, 'SL28 phone');
  await addNode(page, { code: 'QD51', search: 'low income', label: 'Low income' });
  await page.getByTestId('nb-tab-nb').click();
  await freeNote(page, 'Visit', 'Talked about ');
  await page.keyboard.type('@');
  const d = page.getByTestId('mention-dialog');
  await d.getByTestId('picker-search').fill('low');
  await d.locator('[data-testid="picker-item"][data-kind="node"]').first().click();
  await expect(page.getByTestId('nb-body').locator('.sx-chip')).toHaveText('@Low income');
  await page.getByTestId('nb-collapse').click();
  await expect(page.getByTestId('nb-editor')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(await scan(page, '375')).toEqual([]);
});
