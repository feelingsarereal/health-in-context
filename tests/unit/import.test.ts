/**
 * SL29: the notebook's file import — a fixture per format (a two-page PDF, a DOCX with headings, a scanned PDF with no
 * text layer, a CSV, and text, Markdown, HTML and RTF), page and heading anchors, and metadata dropped.
 */
import { describe, expect, it } from 'vitest';
import { makeDocx, makePdf } from '../fixtures/import-files';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseCsv, parseHtml, parseMd, parseRtf, parseTxt, toDoc, toDocMapped } from '../../packages/sdoh-loops-core/src/lib/import/text';
import { parseDocx } from '../../packages/sdoh-loops-core/src/lib/import/docx';
import { parsePdf, PdfError } from '../../packages/sdoh-loops-core/src/lib/import/pdf';
import { anchorOf, labelAll, newImportedNote, notebookFlags, noteDocText, addNote, sanitizeNotebook } from '../../packages/sdoh-loops-core/src/lib/model/notebook';

const require = createRequire(import.meta.url);

async function pdfjs() {
  const m = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return { pdfjs: m as never, workerSrc: pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href };
}

describe('SL29 text formats', () => {
  it('txt: a blank line starts a paragraph; single line breaks stay', () => {
    const doc = toDoc(parseTxt('First line\nsecond line\n\nNext paragraph.\r\n\r\n\r\nLast.'));
    expect(doc.content.map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    expect(noteDocText(doc)).toBe('First line\nsecond line\nNext paragraph.\nLast.');
  });
  it('md: headings (# and ## → 2, ### → 3), lists, inline marks and links stripped, front matter dropped', () => {
    const b = parseMd('---\nauthor: Secret Author\n---\n# Intake\nSee **the** [plan](http://x.test) `now`.\n\n## Housing\n- rent late\n- landlord called\n\n### Detail\n1. one\n2. two\n');
    expect(b).toEqual([
      { t: 'h', level: 2, text: 'Intake' },
      { t: 'p', text: 'See the plan now.' },
      { t: 'h', level: 2, text: 'Housing' },
      { t: 'ul', items: ['rent late', 'landlord called'] },
      { t: 'h', level: 3, text: 'Detail' },
      { t: 'ol', items: ['one', 'two'] },
    ]);
    expect(JSON.stringify(b)).not.toContain('Secret');
  });
  it('html: sanitized to text, headings and lists; head, title, meta, scripts and styles dropped; entities decoded', () => {
    const b = parseHtml('<html><head><title>Secret Title</title><meta name="author" content="Secret Author"><style>p{}</style></head><body><h1>Visit</h1><p>Rent &amp; food<br>were <b>late</b>.</p><script>alert(1)</script><h3>Next</h3><ul><li>Call <a href="x">landlord</a></li><li>Food bank<ul><li>Tuesday</li></ul></li></ul><table><tr><td>Rent</td><td>$900</td></tr></table></body></html>');
    expect(b).toEqual([
      { t: 'h', level: 2, text: 'Visit' },
      { t: 'p', text: 'Rent & food\nwere late.' },
      { t: 'h', level: 3, text: 'Next' },
      { t: 'ul', items: ['Call landlord', 'Food bank', 'Tuesday'] },
      { t: 'p', text: 'Rent · $900' },
    ]);
    expect(JSON.stringify(b)).not.toMatch(/Secret|alert/);
  });
  it('rtf: text and paragraphs; font table, color table and the \\info group (author) skipped; \\\'hh and \\u decoded', () => {
    const b = parseRtf("{\\rtf1\\ansi{\\fonttbl{\\f0 Times;}}{\\colortbl;\\red0\\green0\\blue0;}{\\info{\\author Secret Author}{\\title Secret Title}}\\f0 Behind on rent\\par Caf\\'e9 \\u8212? closed\\par}");
    expect(b.map((x) => (x as { text: string }).text)).toEqual(['Behind on rent', 'Café — closed']);
    expect(JSON.stringify(b)).not.toContain('Secret');
  });
  it('csv: a table — header and rows, quotes and line breaks inside quotes; semicolons too', () => {
    expect(parseCsv('Name,Note\n"Doe, Jane","said ""hi""\nlater"\nLee,ok\n')).toEqual({ header: ['Name', 'Note'], rows: [['Doe, Jane', 'said "hi"\nlater'], ['Lee', 'ok']] });
    expect(parseCsv('a;b\n1;2')).toEqual({ header: ['a', 'b'], rows: [['1', '2']] });
  });
});

describe('SL29 docx', () => {
  it('headings become note headings and anchors; the author and title in its properties are dropped', async () => {
    const blocks = await parseDocx(await makeDocx());
    expect(blocks).toEqual([
      { t: 'h', level: 2, text: 'Intake summary' },
      { t: 'p', text: 'First visit.' },
      { t: 'h', level: 2, text: 'Housing' },
      { t: 'p', text: 'Behind on rent since the spring.' },
      { t: 'h', level: 2, text: 'Income' },
      { t: 'p', text: 'Hours cut at work.' },
    ]);
    expect(JSON.stringify(blocks)).not.toContain('Secret');
    const n = newImportedNote({ title: 'intake', body: toDoc(blocks), source: { filename: 'intake.docx', type: 'docx', size: 100 } });
    expect(anchorOf(n, 3)).toMatchObject({ heading: 'Housing', label: 'under Housing' });
    expect(anchorOf(n, 5).label).toBe('under Income');
  });
});

describe('SL29 pdf', () => {
  it('a two-page PDF: its text page by page, a page anchor per page; the document info (author, title) never read', async () => {
    const r = await parsePdf(makePdf([['Behind on rent.', 'Landlord called.'], ['Food bank on Tuesdays.']]), { ...(await pdfjs()), maxPages: 300 });
    expect(r.pages).toBe(2);
    expect(r.blocks.map((b) => (b as { text: string }).text)).toEqual(['Behind on rent. Landlord called.', 'Food bank on Tuesdays.']);
    expect(r.pageStarts).toEqual([{ block: 0, page: 1 }, { block: 1, page: 2 }]);
    expect(JSON.stringify(r)).not.toContain('Secret');
    const { doc, at } = toDocMapped(r.blocks);
    const n = newImportedNote({ title: 'letter', body: doc, anchors: r.pageStarts.map((p) => ({ block: at[p.block], page: p.page })), source: { filename: 'letter.pdf', type: 'pdf', size: 1, pages: 2 } });
    expect(anchorOf(n, 1)).toMatchObject({ page: 2, label: 'p. 2' });
    expect(anchorOf(n, 0).label).toBe('p. 1');
  });
  it('a scanned PDF (no text layer) is reported, not OCR\'d', async () => {
    await expect(parsePdf(makePdf([[], []]), { ...(await pdfjs()), maxPages: 300 })).rejects.toMatchObject({ reason: 'scanned', message: 'This PDF has no text layer (it looks scanned), so nothing could be read.' });
  });
  it('the page limit is configurable', async () => {
    const e = await parsePdf(makePdf([['a'], ['b'], ['c']]), { ...(await pdfjs()), maxPages: 2 }).catch((x) => x);
    expect(e).toBeInstanceOf(PdfError);
    expect(e.reason).toBe('pages');
  });
});

describe('SL29 imported notes in the notebook', () => {
  it('flags cover the table; labels replace in cells; the note round-trips through sanitize with source, anchors and table', () => {
    const n = newImportedNote({ title: 'contacts', table: { header: ['Name', 'Phone'], rows: [['Mrs. Jane Doe', '(256) 555-0142']] }, source: { filename: 'contacts.csv', type: 'csv', size: 40 } });
    const nb = addNote(undefined, n);
    expect(notebookFlags(nb).map((f) => [f.where, f.category])).toEqual([['table', 'person'], ['table', 'phone']]);
    const out = labelAll(nb);
    expect(out.notes[0].table).toEqual({ header: ['Name', 'Phone'], rows: [['[Person A]', '[phone]']] });
    const back = sanitizeNotebook(JSON.parse(JSON.stringify(out)))!;
    expect(back.notes[0]).toMatchObject({ kind: 'imported', source: { filename: 'contacts.csv', type: 'csv', size: 40, review: 'none' }, table: out.notes[0].table });
  });
  it('an unknown kind or a broken source falls back to a free note', () => {
    const back = sanitizeNotebook({ notes: [{ id: 'x', kind: 'imported', body: { type: 'doc', content: [] } }] })!;
    expect(back.notes[0].kind).toBe('free');
    expect(back.notes[0].source).toBeUndefined();
  });
});
