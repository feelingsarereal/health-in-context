/** SL17: the node-text modes, the peek's facts, and the Node text setting in the map file. */
import { describe, expect, it } from 'vitest';
import { codeLine, nodeLines, nodeTextParts } from './nodeText';
import { peekFacts } from './Peek';
import { migrate, newEdge, newMap, newNode, type MapNode } from '../../lib/model/map';
import { docFromText } from '../../lib/model/rich';
import { codeMap } from '../../lib/data/scheme';
import { links } from '../../lib/data/scheme';
import { S } from '../../lib/data/core';
import { findLoops } from '../../lib/analysis';
import { toGraph } from '../../lib/model/map';

const coded = (p: Partial<MapNode> = {}) => newNode({ code_status: 'sdoh', code: 'QD71.Z', circumstance: docFromText('Rent went up twice this year'), ...p });

describe('nodeTextParts (SL17)', () => {
  it('Title + code (the default): the code line above the title, no circumstance', () => {
    const t = nodeTextParts(coded({ label: docFromText('Losing the flat') }));
    expect(t.head).toMatch(/QD71\.Z$/);
    expect(t.title).toBe('Losing the flat');
    expect(t.sub).toBeNull();
    expect(nodeTextParts(coded())).toEqual(nodeTextParts(coded(), 'title-code'));
  });
  it('Title: the title alone', () => {
    expect(nodeTextParts(coded({ label: docFromText('Losing the flat') }), 'title')).toEqual({ head: null, title: 'Losing the flat', sub: null });
  });
  it('Full: the circumstance text below the title', () => {
    expect(nodeTextParts(coded({ label: docFromText('Losing the flat') }), 'full').sub).toBe('Rent went up twice this year');
  });
  it('an empty label falls back to the code title', () => {
    expect(nodeTextParts(coded({ code: 'QD80' })).title).toBe(codeMap.get('QD80')!.title);
  });
  it('a long title is cut at 42 characters with "…", as 0.1.1 cut the label (the peek has it whole)', () => {
    const t = nodeTextParts(coded()).title;
    expect(codeMap.get('QD71.Z')!.title.length).toBeGreaterThan(42);
    expect(t).toHaveLength(42);
    expect(t.endsWith('…')).toBe(true);
    const f = peekFacts({ kind: 'node', node: coded() }, { ...newMap('x'), nodes: [coded()] }, () => '', [], new Map());
    expect(f.kind === 'node' && f.title).toBe(codeMap.get('QD71.Z')!.title);
  });
  it('a title taken from the circumstance text is not repeated below it', () => {
    const n = newNode({ code_status: 'undetermined', circumstance: docFromText('Sleeping on a friend’s sofa') });
    const t = nodeTextParts(n, 'full');
    expect(t.title).toBe('Sleeping on a friend’s sofa');
    expect(t.sub).toBeNull();
    expect(t.head).toBe(`? ${S.codes.status.undetermined}`);
  });
  it('a canvas note is its text in every mode', () => {
    const n = newNode({ kind: 'note', code_status: 'undetermined', notes: docFromText('Ask about the landlord') });
    for (const m of ['title', 'title-code', 'full'] as const) expect(nodeTextParts(n, m)).toEqual({ head: null, title: 'Ask about the landlord', sub: null });
  });
  it('the flat export text is the parts on their own lines', () => {
    expect(nodeLines(coded({ label: docFromText('Losing the flat') }), 'full').split('\n')).toHaveLength(3);
  });
});

describe('the Node text setting is saved with the map (SL17)', () => {
  it('a valid setting round-trips; an unknown one is dropped; a map without one gets none written', () => {
    const m = newMap('x');
    expect(migrate({ ...m, layout: { ...m.layout, nodeText: 'full' } }).layout.nodeText).toBe('full');
    expect('nodeText' in migrate({ ...m, layout: { ...m.layout, nodeText: 'huge' } }).layout).toBe(false);
    expect('nodeText' in migrate(m).layout).toBe(false);
  });
});

describe('peekFacts (SL17)', () => {
  const link = links.find((l) => l.polarity === '+' && l.codes.from.length && l.codes.to.length)!;
  const a = newNode({ id: 'a', code_status: 'sdoh', code: link.codes.from[0], label: docFromText('Alpha') });
  const b = newNode({ id: 'b', code_status: 'sdoh', code: link.codes.to[0], label: docFromText('Beta'), circumstance: docFromText('What was said') });
  const ab = newEdge({ id: 'ab', from: 'a', to: 'b', polarity: '+', weight: 0.5, evidence: [...link.refs], link: link.id, basis: 'evidence' });
  const ba = newEdge({ id: 'ba', from: 'b', to: 'a', polarity: '+', weight: 0.5, basis: 'override', override_reason: docFromText('They said so') });
  const map = { ...newMap('peek'), nodes: [a, b], edges: [ab, ba] };
  const nm = (id: string) => (id === 'a' ? 'Alpha' : 'Beta');
  const loops = findLoops(toGraph(map));
  const names = new Map(loops.loops.map((l) => [l.key, 'R1']));

  it('a circumstance: code and title, label, circumstance text, code status, links in and out, its loops', () => {
    const f = peekFacts({ kind: 'node', node: b }, map, nm, loops.loops, names);
    if (f.kind !== 'node') throw new Error('kind');
    expect(f.title).toBe('Beta');
    expect(f.code).toContain(link.codes.to[0]);
    expect(f.label).toBe('Beta');
    expect(f.circumstance).toBe('What was said');
    expect(f.status).toContain(S.codes.status.sdoh);
    expect(f.in).toEqual(['Alpha']);
    expect(f.out).toEqual(['Alpha']);
    expect(f.loops).toEqual([`R1 (${S.loops.reinforcing})`]);
  });
  it('an evidence link: from → to, polarity, weight, delay, the link id and grade, and the mechanism with its [n]', () => {
    const f = peekFacts({ kind: 'edge', edge: ab }, map, nm, loops.loops, names);
    if (f.kind !== 'edge') throw new Error('kind');
    expect([f.from, f.to, f.polarity, f.weight, f.delay, f.basis]).toEqual(['Alpha', 'Beta', '+', 0.5, false, 'evidence']);
    expect(f.link).toEqual({ id: link.id, grade: link.grade, mechanism: `${link.id}: ${link.mechanism}` });
    expect(f.link!.mechanism).toMatch(/\[\d+/);
  });
  it('an override: ⚑ basis and the reason', () => {
    const f = peekFacts({ kind: 'edge', edge: ba }, map, nm, loops.loops, names);
    if (f.kind !== 'edge') throw new Error('kind');
    expect(f.basis).toBe('override');
    expect(f.link).toBeNull();
    expect(f.reason).toBe('They said so');
  });
});

describe('SL30 point 5: the code line of the selection card and the peek', () => {
  it('a coded circumstance: the box\'s code line, " · ", then WHO\'s title from the pinned pack, byte for byte', () => {
    for (const code of ['QD71.Z', 'QE8Z', 'QD80'].filter((c) => codeMap.has(c))) {
      const n = coded({ code });
      expect(codeLine(n)).toBe(`${nodeTextParts(n).head} · ${codeMap.get(code)!.title}`);
      expect(codeLine(n)).toMatch(new RegExp(`^\\S+ ${code.replace('.', '\\.')} · `));
    }
  });
  it('the peek and the Read view use it; the canvas box keeps the code alone', () => {
    const n = coded();
    const f = peekFacts({ kind: 'node', node: n }, { ...migrate(newMap('t')), nodes: [n] }, () => '', [], new Map());
    expect(f.kind === 'node' && f.code).toBe(codeLine(n));
    expect(nodeTextParts(n).head).toMatch(/QD71\.Z$/);
  });
  it('"Other" and "Not sure yet" show their type as the box does; a note has none', () => {
    const u = newNode({ code_status: 'undetermined', label: docFromText('Unsure') });
    expect(codeLine(u)).toBe(nodeTextParts(u).head);
    const o = newNode({ code_status: 'other', label: docFromText('Other') });
    expect(codeLine(o)).toBe(nodeTextParts(o).head);
    expect(codeLine(newNode({ kind: 'note', code_status: 'other', notes: docFromText('A note') }))).toBeNull();
  });
});
