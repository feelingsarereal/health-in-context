/**
 * SL28 (S7.1 slice 4): @ mentions (empty spans) keep their place through edits and survive a reload; every target kind
 * has a name and turns up in the search; the passages behind a loop come grouped by circumstance; the trace set; the
 * case file round-trips with every annotation target resolving; the report's circumstance table equals the case
 * summary's rows, every quote in it resolves to a span, it says what the identifier check is, and a flagged identifier
 * appears only when the user kept it; the Word file is a valid package.
 */
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { docFromText } from '../../packages/sdoh-loops-core/src/lib/model/rich';
import { addNote, addPassage, fieldText, labelAll, makeChip, makeSpan, newFreeNote, notebookFlags, sanitizeNote, sanitizeNotebook, updateNote, type Note, type Notebook } from '../../packages/sdoh-loops-core/src/lib/model/notebook';
import { attachSpan } from '../../packages/sdoh-loops-core/src/lib/model/spans';
import { addEdge, addNode, newEdge, newMap, newNode, toGraph, type SdohMap } from '../../packages/sdoh-loops-core/src/lib/model/map';
import { importJSON, nodeName } from '../../packages/sdoh-loops-core/src/lib/model/interchange';
import { feedbackClusters, findLoops } from '../../packages/sdoh-loops-core/src/lib/analysis';
import { clusterTargetId, loopTargetId, passagesBehind, searchTargets, targetName, traceSet, type TargetContext } from '../../packages/sdoh-loops-core/src/lib/model/targets';
import { caseProvenance, exportCase } from '../../packages/sdoh-loops-core/src/lib/model/caseFile';
import { buildReport, reportQuotes, type ReportInput } from '../../packages/sdoh-loops-core/src/lib/model/report';
import { reportDocx, reportHTML, reportMarkdown } from '../../packages/sdoh-loops-core/src/lib/model/report-render';
import { summaryRow } from '../../packages/sdoh-loops-core/src/lib/model/summary';
import { codeMap } from '../../packages/sdoh-loops-core/src/lib/data/scheme';

const TEXT = "We've been staying at my sister's since the eviction. I lost my job in March. Call Mr. Jones on 205-555-0134.";
const note = (text = TEXT): Note => ({ ...newFreeNote('Contact'), body: sanitizeNote(docFromText(text)) });
const PINS = { core: '0.9.0', pack: '0.2.0', icd11: 'ICD-11 MMS 2026-01' };
const nm = (m: SdohMap) => (id: string) => nodeName(m.nodes.find((n) => n.id === id)!, (c) => codeMap.get(c)?.title);
const sp = (n: Note, q: string) => {
  const i = fieldText(n, 'body').indexOf(q);
  return makeSpan(n, 'body', i, i + q.length);
};

/** a two-circumstance loop with passages on both circumstances and one link, a mention, a code and a reference cite */
function fixture() {
  const housing = newNode({ code_status: 'sdoh', code: 'QD71.Z' });
  const income = newNode({ code_status: 'sdoh', code: 'QD51' });
  const why = { basis: 'override' as const, override_reason: docFromText('Seen in this case.'), override_at: '2026-11-04' };
  const e1 = newEdge({ from: housing.id, to: income.id, polarity: '+', ...why });
  const e2 = newEdge({ from: income.id, to: housing.id, polarity: '+', ...why });
  let m: SdohMap = addEdge(addEdge(addNode(addNode(newMap('Case'), housing), income), e1), e2);
  const n = note();
  m = { ...m, notebook: addNote(undefined, n) };
  m = attachSpan(m, sp(n, "staying at my sister's since the eviction"), { kind: 'node', id: housing.id }).map;
  m = attachSpan(m, sp(n, 'I lost my job in March'), { kind: 'node', id: income.id }).map;
  m = attachSpan(m, sp(n, 'since the eviction'), { kind: 'edge', id: e1.id }).map;
  const chip = makeChip(n, 'body', fieldText(n, 'body').indexOf(' I lost'));
  m = { ...m, notebook: addPassage(m.notebook, chip, { target: { kind: 'reference', id: '1' } }).notebook };
  m = { ...m, notebook: addPassage(m.notebook, sp(n, 'lost my job'), { target: { kind: 'code', id: 'QD51' }, text: 'Check the date.' }).notebook };
  const g = toGraph(m);
  const loops = findLoops(g);
  return { m, n, housing, income, e1, e2, g, loops, chip };
}
const ctxOf = (f: ReturnType<typeof fixture>): TargetContext => ({ map: f.m, nm: nm(f.m), loops: f.loops.loops, clusters: feedbackClusters(f.g) });

describe('SL28 @ mentions (empty spans)', () => {
  it('typing after a chip leaves it in place; text inserted before it moves it; it survives sanitize', () => {
    const n = note('Moved in with my sister.');
    const at = 'Moved in'.length;
    const chip = makeChip(n, 'body', at);
    expect(chip).toMatchObject({ quote: '', start: at, end: at, chip: true });
    let nb: Notebook = { ...addNote(undefined, n), spans: [chip] };
    nb = updateNote(nb, n.id, { body: sanitizeNote(docFromText('Moved in last week with my sister.')) });
    expect(nb.spans![0].start).toBe(at);
    expect(nb.spans![0].orphaned).toBeUndefined();
    nb = updateNote(nb, n.id, { body: sanitizeNote(docFromText('Today: Moved in last week with my sister.')) });
    expect(nb.spans![0].start).toBe(at + 7);
    const back = sanitizeNotebook(JSON.parse(JSON.stringify(nb)))!;
    expect(back.spans![0]).toMatchObject({ chip: true, quote: '', start: at + 7, end: at + 7 });
  });
  it('a chip whose context is gone is orphaned, never moved to a guess', () => {
    const n = note('Moved in with my sister.');
    const nb: Notebook = { ...addNote(undefined, n), spans: [makeChip(n, 'body', 8)] };
    expect(updateNote(nb, n.id, { body: sanitizeNote(docFromText('Something else entirely.')) }).spans![0].orphaned).toBe(true);
  });
  it('two mentions at one place stay two annotations', () => {
    const n = note('Here.');
    let nb = addNote(undefined, n);
    nb = addPassage(nb, makeChip(n, 'body', 4), { target: { kind: 'glossary', id: 'x' } }).notebook;
    nb = addPassage(nb, makeChip(n, 'body', 4), { target: { kind: 'concept', id: 'y' } }).notebook;
    expect(nb.spans).toHaveLength(2);
    expect(nb.annotations).toHaveLength(2);
  });
});

describe('SL28 targets', () => {
  it('every kind has a name, and the search finds circumstances, links, loops, clusters, codes, references, terms, notes', () => {
    const f = fixture();
    const ctx = ctxOf(f);
    const loop = f.loops.loops[0];
    expect(targetName({ kind: 'loop', id: loopTargetId(loop) }, ctx)).toMatch(/→ ↺$/);
    expect(targetName({ kind: 'cluster', id: clusterTargetId([f.housing.id, f.income.id]) }, ctx)).toMatch(/^Cluster 1/);
    expect(targetName({ kind: 'code', id: 'QD51' }, ctx)).toContain('QD51');
    expect(targetName({ kind: 'reference', id: '1' }, ctx)).toMatch(/^\[1\]/);
    expect(targetName({ kind: 'node', id: 'gone' }, ctx)).toBeNull();
    const kinds = (q: string) => searchTargets(q, ctx).map((g) => g.kind);
    expect(kinds('')).toEqual(expect.arrayContaining(['node', 'edge', 'loop', 'cluster', 'code']));
    expect(kinds('housing')).toEqual(expect.arrayContaining(['node', 'code']));
    const g = searchTargets('loop', ctx).flatMap((x) => x.items.map((i) => i.t.kind));
    expect(g).toContain('glossary');
    // a host's own kind, searched and named
    const host = { kind: 'primer-code', label: 'Primer entries', search: (q: string) => (q ? [{ id: 'qd71', label: 'QD71 in the primer' }] : []), open: () => undefined, name: () => 'QD71 in the primer' };
    expect(searchTargets('qd', { ...ctx, host: [host] }).find((x) => x.kind === 'primer-code')?.items[0].label).toBe('QD71 in the primer');
    expect(targetName({ kind: 'primer-code', id: 'qd71' }, { ...ctx, host: [host] })).toBe('QD71 in the primer');
  });
  it('the passages behind a loop come grouped by circumstance, each counted once', () => {
    const f = fixture();
    const p = passagesBehind(f.m.notebook, f.m, nm(f.m), { kind: 'loop', loop: f.loops.loops[0] });
    expect(p.total).toBe(3);
    expect(p.groups.map((g) => g.node).sort()).toEqual([f.housing.id, f.income.id].sort());
    expect(p.groups.find((g) => g.node === f.housing.id)!.spans).toHaveLength(2); // its own, and its link's
  });
  it('the trace set: a span brings what it supports and what the spans that cite those also cite', () => {
    const f = fixture();
    const spanId = f.m.notebook!.annotations!.find((a) => a.targets.some((t) => t.kind === 'edge'))!.span;
    const t = traceSet(f.m, { span: spanId, nodes: [], edges: [] }, ctxOf(f));
    expect([...t.edges]).toEqual([f.e1.id]);
    expect([...t.nodes].sort()).toEqual([f.housing.id, f.income.id].sort());
    const bySel = traceSet(f.m, { nodes: [f.housing.id], edges: [] }, ctxOf(f));
    expect(bySel.spans.size).toBe(1);
  });
});

describe('SL28 case file', () => {
  it('Export case → import: notes, spans, mentions and every annotation target come back and resolve', () => {
    const f = fixture();
    const text = exportCase(f.m, PINS, 'citation');
    const raw = JSON.parse(text);
    expect(raw.provenance).toMatchObject({ notes: 1, spans: 4, mentions: 1, annotations: 5, comments: 1, pins: PINS });
    const back = importJSON(text);
    expect(back.provenance).toBeUndefined();
    expect(back.notebook!.spans).toHaveLength(5);
    const ctx: TargetContext = { map: back, nm: nm(back), loops: findLoops(toGraph(back)).loops, clusters: feedbackClusters(toGraph(back)) };
    for (const a of back.notebook!.annotations!) for (const t of a.targets) expect(targetName(t, ctx), `${t.kind}:${t.id}`).not.toBeNull();
    expect(back.nodes.find((n) => n.id === f.housing.id)!.sources).toHaveLength(1);
    expect(back.edges.find((e) => e.id === f.e1.id)!.sources).toHaveLength(1);
  });
  it('provenance counts labels by category, never the values', () => {
    const f = fixture();
    const nb = labelAll(f.m.notebook);
    const p = caseProvenance(nb, PINS);
    expect(p.labelledTotal).toBeGreaterThan(0);
    expect(JSON.stringify(p)).not.toContain('Jones');
    expect(JSON.stringify(p)).not.toContain('555');
  });
});

function report(m: SdohMap, kept = 0, options = { notes: true, image: false, annotations: true }) {
  const g = toGraph(m);
  const loops = findLoops(g);
  const input: ReportInput = {
    map: m, shown: m, graph: g, loops, loopNames: new Map(loops.loops.map((l, i) => [l.key, `L${i + 1}`])), nm: nm(m), clusters: feedbackClusters(g),
    options, pins: PINS, flaggedKept: kept,
    copy: { heuristic: 'This check is a heuristic.', notice: 'Not advice.', citation: 'ICD-11 citation', templates: new Map(), kinds: { free: 'Free note', structured: 'Structured', imported: 'Imported' } },
  };
  return buildReport(input);
}

describe('SL28 report', () => {
  it('its circumstance table equals the case summary rows; every quote resolves to a span', () => {
    const f = fixture();
    const r = report(f.m);
    expect(r.summary.rows.map(({ sources: _s, ...row }) => row)).toEqual(f.m.nodes.map((n) => summaryRow(f.m, nm(f.m), n)));
    const spans = new Map(f.m.notebook!.spans!.map((x) => [x.id, x]));
    const qs = reportQuotes(r);
    expect(qs.length).toBeGreaterThan(4);
    for (const q of qs) expect(spans.get(q.span)?.quote).toBe(q.quote);
    expect(r.summary.rows.find((x) => x.id === f.housing.id)!.sources).toHaveLength(1);
    expect(r.summary.loops[0].total).toBe(3);
    expect(r.references.map((x) => x.n)).toEqual(['1']);
  });
  it('the cover says the check is a heuristic; a flagged identifier is in the text only when the user kept it', () => {
    const f = fixture();
    expect(notebookFlags(f.m.notebook).length).toBeGreaterThan(0);
    const labelled = { ...f.m, notebook: labelAll(f.m.notebook) };
    for (const out of [reportMarkdown(report(labelled)), reportHTML(report(labelled))]) {
      expect(out).toContain('heuristic');
      expect(out).not.toContain('Jones');
      expect(out).not.toContain('205-555-0134');
      expect(out).toContain('No possible identifiers were found');
    }
    const kept = reportHTML(report(f.m, notebookFlags(f.m.notebook).length));
    expect(kept).toContain('205-555-0134');
    expect(kept).toMatch(/left in this report as written, as you confirmed/);
  });
  it('mentions appear in the note text; without annotations, no mentions, comments or passages', () => {
    const f = fixture();
    const md = reportMarkdown(report(f.m));
    expect(md).toContain('**@\\[1\\]');
    expect(md).toContain('Check the date.');
    const bare = reportMarkdown(report(f.m, 0, { notes: true, image: false, annotations: false }));
    expect(bare).not.toContain('@');
    expect(bare).not.toContain('Check the date.');
    expect(reportHTML(report(f.m, 0, { notes: false, image: false, annotations: true }))).not.toContain('class="note"');
  });
  it('the Word file is a valid package with the notes, the table and a page break per note', async () => {
    const f = fixture();
    const z = await JSZip.loadAsync(reportDocx(report(f.m)));
    expect(Object.keys(z.files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', '_rels/.rels']));
    const doc = await z.file('word/document.xml')!.async('string');
    expect(doc).toContain('Case report: Case');
    expect(doc).toContain('staying at my sister');
    expect(doc).toContain('<w:tbl>');
    expect((doc.match(/w:type="page"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(doc).not.toMatch(/[\u0000-\u0008]/);
  });
});
