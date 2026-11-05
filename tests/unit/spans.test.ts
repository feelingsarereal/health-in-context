/**
 * SL27: spans — re-anchoring after edits before, after and inside a span, and the orphan case; labels reach a span's
 * copies of the text; the code suggester's fixtures (nothing outside Chapter 24); the extractor refusal rule; sources and
 * targets agreeing through export and import, with the extractor's label kept.
 */
import { describe, expect, it } from 'vitest';
import { docFromText } from '../../packages/sdoh-loops-core/src/lib/model/rich';
import { addNote, fieldText, labelAll, locate, makeSpan, newFreeNote, sanitizeNote, spansFor, updateNote, isOrphaned, deleteNote, type Notebook, type Note } from '../../packages/sdoh-loops-core/src/lib/model/notebook';
import { suggestCodes } from '../../packages/sdoh-loops-core/src/lib/model/suggest';
import { localCodeMatcher, mayRun, runExtractor, RefusedError, type NotebookExtractor } from '../../packages/sdoh-loops-core/src/lib/model/extract';
import { attachSpan, deleteWithSpans, spansBehind } from '../../packages/sdoh-loops-core/src/lib/model/spans';
import { addNode, addEdge, migrate, newEdge, newMap, newNode } from '../../packages/sdoh-loops-core/src/lib/model/map';
import { exportJSON, importJSON } from '../../packages/sdoh-loops-core/src/lib/model/interchange';
import { codeMap } from '../../packages/sdoh-loops-core/src/lib/data/scheme';

const TEXT = "We've been staying at my sister's since the eviction. Mr. Jones said rent was late.";
const note = (text = TEXT): Note => ({ ...newFreeNote('Visit'), body: sanitizeNote(docFromText(text)) });
const withSpan = (n: Note, quote: string): { nb: Notebook; id: string } => {
  const t = fieldText(n, 'body');
  const i = t.indexOf(quote);
  const sp = makeSpan(n, 'body', i, i + quote.length);
  const nb = { ...addNote(undefined, n), spans: [sp] };
  return { nb, id: sp.id };
};
const edit = (nb: Notebook, n: Note, text: string) => updateNote(nb, n.id, { body: sanitizeNote(docFromText(text)) });
const QUOTE = "staying at my sister's";

describe('SL27 re-anchoring', () => {
  it('an edit before the span moves it; its quote and context follow', () => {
    const n = note();
    const { nb, id } = withSpan(n, QUOTE);
    const out = edit(nb, n, `Today: ${TEXT}`);
    const sp = out.spans!.find((x) => x.id === id)!;
    expect(sp.orphaned).toBeUndefined();
    expect(fieldText(out.notes[0], 'body').slice(sp.start, sp.end)).toBe(QUOTE);
    expect(sp.start).toBe(TEXT.indexOf(QUOTE) + 7);
  });
  it('an edit after the span leaves it where it is', () => {
    const n = note();
    const { nb, id } = withSpan(n, QUOTE);
    const out = edit(nb, n, `${TEXT} She called back.`);
    expect(out.spans!.find((x) => x.id === id)).toMatchObject({ start: TEXT.indexOf(QUOTE), quote: QUOTE });
    expect(out.spans![0].orphaned).toBeUndefined();
  });
  it('an edit inside the span orphans it; it is never re-pointed, even when the old quote comes back elsewhere', () => {
    const n = note();
    const { nb, id } = withSpan(n, QUOTE);
    const out = edit(nb, n, TEXT.replace(QUOTE, 'staying at my brother’s'));
    expect(out.spans!.find((x) => x.id === id)!.orphaned).toBe(true);
    const back = edit(out, n, `${TEXT}`);
    expect(back.spans!.find((x) => x.id === id)!.orphaned).toBe(true);
  });
  it('deleting the text that holds a span orphans it; deleting the note shows it orphaned too', () => {
    const n = note();
    const { nb, id } = withSpan(n, QUOTE);
    expect(edit(nb, n, 'Mr. Jones said rent was late.').spans![0].orphaned).toBe(true);
    expect(isOrphaned(deleteNote(nb, n.id), nb.spans!.find((x) => x.id === id)!)).toBe(true);
  });
  it('with the quote twice, the context decides; when it cannot, the span is orphaned', () => {
    const t = 'rent is late. Then: rent is late.';
    expect(locate({ quote: 'rent is late', prefix: 'Then: ', suffix: '.', start: 99, end: 111 }, t)).toEqual({ start: 20, end: 32 });
    expect(locate({ quote: 'rent is late', prefix: 'zzz', suffix: 'zzz', start: 99, end: 111 }, t)).toBeNull();
  });
  it('a label replaces the value in the span’s copies too, and the span stays anchored', () => {
    const n = note();
    const { nb, id } = withSpan(n, 'Mr. Jones said rent');
    const out = labelAll(nb);
    const sp = out.spans!.find((x) => x.id === id)!;
    expect(sp.quote).toBe('[Person A] said rent');
    expect(JSON.stringify(out)).not.toContain('Jones');
    expect(sp.orphaned).toBeUndefined();
    expect(fieldText(out.notes[0], 'body').slice(sp.start, sp.end)).toBe('[Person A] said rent');
  });
});

describe('SL27 code suggestions (local, Chapter 24 only)', () => {
  it("“staying at my sister's since the eviction” suggests a QD71 housing code first", () => {
    const s = suggestCodes("we've been staying at my sister's since the eviction");
    expect(s[0].code).toMatch(/^QD71/);
    expect(s[0].words).toContain('eviction');
  });
  it('“lost my job” suggests QD80 Problem associated with unemployment first, with the words that matched', () => {
    const s = suggestCodes('I lost my job in March');
    expect(s[0]).toMatchObject({ code: 'QD80', title: 'Problem associated with unemployment' });
    expect(s[0].words).toEqual(['lost', 'my', 'job']);
  });
  it('at most five, every one a Chapter 24 code in the pinned pack, none for words with no match', () => {
    for (const t of ['no food in the house', 'kids not in school', "we can't afford the rent", 'trouble with my landlord about repairs', 'my husband hits me', 'feeling depressed and anxious'])
      for (const x of suggestCodes(t)) {
        expect(x.code).toMatch(/^Q/);
        expect(codeMap.has(x.code)).toBe(true);
      }
    expect(suggestCodes('no food in the house').length).toBeLessThanOrEqual(5);
    expect(suggestCodes('the the the')).toEqual([]);
  });
});

describe('SL27 extractors', () => {
  const remote: NotebookExtractor = { id: 'stub-remote', label: 'Stub model', kind: 'remote', describe: 'test', run: async () => [] };
  it('a remote extractor is refused without allowRemoteExtractors, and refused while flags remain even with it', async () => {
    expect(mayRun(remote, { flags: 0 })).toEqual({ ok: false, reason: 'remote-off' });
    expect(mayRun(remote, { allowRemote: true, flags: 2 })).toEqual({ ok: false, reason: 'flags' });
    expect(mayRun(remote, { allowRemote: true, flags: 0 })).toEqual({ ok: true });
    let called = false;
    const spy = { ...remote, run: async () => ((called = true), []) };
    await expect(runExtractor(spy, note(), { nodes: [] }, { flags: 0 })).rejects.toBeInstanceOf(RefusedError);
    await expect(runExtractor(spy, note(), { nodes: [] }, { allowRemote: true, flags: 1 })).rejects.toMatchObject({ reason: 'flags' });
    expect(called).toBe(false);
    expect(mayRun(localCodeMatcher, { flags: 9 })).toEqual({ ok: true });
  });
  it('the local code matcher proposes records in the SDOH-EXTRACTION shape, each labelled with its extractor', async () => {
    const ps = await runExtractor(localCodeMatcher, note("We've been staying at my sister's since the eviction. I lost my job in March."), { nodes: [] }, { flags: 0 });
    expect(ps.map((p) => p.code)).toEqual(expect.arrayContaining(['QD80']));
    expect(ps.some((p) => p.code?.startsWith('QD71'))).toBe(true);
    for (const p of ps) {
      expect(p.extractor).toEqual({ extractor: 'local-code-matcher', label: 'Local code matcher' });
      expect(p.spans.length).toBeGreaterThan(0);
      if (p.status === 'implicit') expect(p.rationale).toBeTruthy();
    }
  });
});

describe('SL27 sources and targets on the map', () => {
  const setup = () => {
    const n = note();
    const t = fieldText(n, 'body');
    const sp = makeSpan(n, 'body', t.indexOf(QUOTE), t.indexOf(QUOTE) + QUOTE.length, { extractor: 'local-code-matcher', label: 'Local code matcher', inferred: true, confidence: 'medium' });
    const node = { ...newNode({ code_status: 'sdoh', code: 'QD71.Z' }), suggested_by: { extractor: 'local-code-matcher', label: 'Local code matcher' } };
    let m = addNode({ ...migrate(newMap('t')), notebook: addNote(undefined, n) }, node);
    const r = attachSpan(m, sp, { kind: 'node', id: node.id });
    m = r.map;
    return { m, node, span: r.span };
  };
  it('the node’s sources and the span’s target agree, and still do after export and import, with the extractor label', () => {
    const { m, node, span } = setup();
    expect(m.nodes[0].sources).toEqual([{ note: m.notebook!.notes[0].id, span }]);
    expect(spansFor(m.notebook, { kind: 'node', id: node.id }).map((x) => x.id)).toEqual([span]);
    const back = importJSON(exportJSON(m));
    expect(back.nodes[0].sources).toEqual(m.nodes[0].sources);
    expect(back.nodes[0].suggested_by).toEqual({ extractor: 'local-code-matcher', label: 'Local code matcher' });
    expect(spansFor(back.notebook, { kind: 'node', id: node.id })[0]).toMatchObject({ id: span, by: { label: 'Local code matcher', inferred: true } });
  });
  it('a one-sided file is made to agree on import; a source to a missing span is dropped', () => {
    const { m, node, span } = setup();
    const oneSided = { ...m, notebook: { ...m.notebook!, annotations: [] }, nodes: m.nodes.map((n) => ({ ...n, sources: [...(n.sources ?? []), { note: 'x', span: 'gone' }] })) };
    const back = importJSON(exportJSON(oneSided));
    expect(back.nodes[0].sources).toEqual([{ note: m.notebook!.notes[0].id, span }]);
    expect(spansFor(back.notebook, { kind: 'node', id: node.id }).map((x) => x.id)).toEqual([span]);
  });
  it('deleting a circumstance keeps its spans as plain highlights, or removes them; its links’ targets go too', () => {
    const { m, node, span } = setup();
    const other = newNode({ code_status: 'sdoh', code: 'QD51' });
    let m2 = addNode(m, other);
    const e = newEdge({ from: node.id, to: other.id, polarity: "+", weight: 0.5, basis: "evidence", link: "L27" });
    m2 = attachSpan(addEdge(m2, e), m2.notebook!.spans![0], { kind: 'edge', id: e.id }).map;
    expect(spansBehind(m2, [node.id], [])).toBe(1);
    const kept = deleteWithSpans(m2, [node.id], [], 'keep');
    expect(kept.notebook!.spans!.map((x) => x.id)).toEqual([span]);
    expect(kept.notebook!.annotations![0].targets).toEqual([]);
    const removed = deleteWithSpans(m2, [node.id], [], 'remove');
    expect(removed.notebook!.spans ?? []).toEqual([]);
  });
});
