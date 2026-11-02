import { describe, expect, it } from 'vitest';
import { checkLink, evidenceCanCloseALoop } from './evidence';
import { aliasHits, associations } from '@/lib/data/scheme';
import { EVIDENCE_CASES, QD71_1_EVICTION_CASE, RECODE_CASE, V2_BLOCK_LEVEL_CASE, W1_LOOP } from './__fixtures__/evidence-golden';
import { findLoops } from '@/lib/analysis';
import { assignLoopNames } from './interchange';
import { addEdge, addNode, migrate, newEdge, newMap, newNode, toGraph, updateEdge, updateNode, ModelError } from './map';
import { docFromText } from './rich';

describe('UI-18 evidence check — golden fixtures', () => {
  for (const c of EVIDENCE_CASES) {
    it(c.name, () => {
      const r = checkLink(c.from, c.to, c.polarity);
      expect(r.check).toBe(c.check);
      expect(r.check === 'match' ? 'evidence' : 'override').toBe(c.basis);
      if (c.link) expect(r.link?.id).toBe(c.link);
    });
  }
  it('withheld results carry the reason, never a link', () => {
    const r = checkLink({ code_status: 'sdoh', code: 'QD51' }, { code_status: 'sdoh', code: 'QE01' }, '+');
    expect(r.link).toBeNull();
    expect(r.message).toMatch(/^Evidence link L05 is withheld: /);
  });
  it('a block-level near miss names that link and the codes its evidence covers', () => {
    const r = checkLink({ code_status: 'sdoh', code: 'QE82.0' }, { code_status: 'sdoh', code: 'QD51' }, '+');
    expect(r.link).toBeNull();
    expect(r.alternatives.map((l) => l.id)).toEqual(['L25']);
    expect(r.message).toBe('Evidence link L25 connects these blocks, but its evidence covers QE82 → QD50 only.');
  });
  it('with the links shipped in this pack, loops can close on evidence alone (computed at build time, K5)', () => {
    expect(evidenceCanCloseALoop()).toBe(true);
  });
});

describe('association menu at code level (K3 item 2)', () => {
  const ids = (ls: { id: string }[]) => ls.map((l) => l.id);
  it('a link is under Leads to only for codes in its codes.from', () => {
    expect(ids(associations('QE04').leadsTo)).toEqual(expect.arrayContaining(['L12', 'L13']));
    expect(ids(associations('QE01').leadsTo)).toEqual(['L29']); // K6
    expect(ids(associations('QE82.0').leadsTo)).toEqual(expect.arrayContaining(['L18', 'L19', 'L20', 'L25']));
    expect(ids(associations('QE90').leadsTo)).toEqual([]);
  });
  it('a link is under Comes from only for codes in its codes.to', () => {
    expect(ids(associations('QD80').comesFrom)).toEqual(expect.arrayContaining(['L03', 'L10', 'L12', 'L20', 'L29']));
    expect(ids(associations('QD71.Z').comesFrom)).toEqual(expect.arrayContaining(['L02', 'L15', 'L26']));
    expect(ids(associations('QD82').comesFrom)).toEqual([]);
  });
  it('a parent code is not covered by its children: QD71 has no Leads to', () => {
    expect(ids(associations('QD71').leadsTo)).toEqual([]);
    expect(ids(associations('QD71.Z').leadsTo).sort()).toEqual(['L03', 'L27', 'L28']);
    expect(ids(associations('QD71.1').leadsTo)).toEqual([]); // poor housing conditions, not eviction (K5)
  });
});

function twoNodes(a: string, b: string) {
  let m = newMap('t');
  const x = newNode({ code_status: 'sdoh', code: a });
  const y = newNode({ code_status: 'sdoh', code: b });
  m = addNode(addNode(m, x), y);
  return { m, x, y };
}

describe('UI-18 in the model', () => {
  it('an edge matching L03 is evidence, with its refs', () => {
    const { m, x, y } = twoNodes('QD71.Z', 'QD80');
    const e = addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' })).edges[0];
    expect(e).toMatchObject({ basis: 'evidence', check: 'match', link: 'L03', evidence: [23] });
  });
  it('an unsupported edge is refused without a confirmed override and a reason', () => {
    const { m, x, y } = twoNodes('QD51', 'QE01');
    expect(() => addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' }))).toThrow(ModelError);
    expect(() => addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'override' }))).toThrow(/confirmed override with a reason/);
    const e = addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'override', override_reason: docFromText('Client describes constant money worry') })).edges[0];
    expect(e).toMatchObject({ basis: 'override', check: 'withheld:L05', link: null });
    expect(e.override_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it(`recoding ${RECODE_CASE.to} → ${RECODE_CASE.recodeTo} on an L03 edge makes it needs-review, never silently relabelled`, () => {
    const { m, x, y } = twoNodes(RECODE_CASE.from, RECODE_CASE.to);
    const m1 = addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' }));
    const e = updateNode(m1, y.id, { code: RECODE_CASE.recodeTo }).edges[0];
    expect(e.basis).toBe(RECODE_CASE.basis);
    expect(e.check).toBe(RECODE_CASE.check);
    expect(e.link).toBe('L03'); // kept until the person decides
  });
  it('flipping polarity on an evidence edge makes it needs-review', () => {
    const { m, x, y } = twoNodes('QD71.Z', 'QD80');
    const m1 = addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' }));
    expect(updateEdge(m1, m1.edges[0].id, { polarity: '−', weight: -0.5 }).edges[0]).toMatchObject({ basis: 'needs-review', check: 'opposite-polarity' });
  });
  it('a needs-review edge can be confirmed as an override with a reason', () => {
    const { m, x, y } = twoNodes('QD71.Z', 'QD80');
    const m1 = updateNode(addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' })), y.id, { code: 'QE01' });
    const e = updateEdge(m1, m1.edges[0].id, { basis: 'override', override_reason: docFromText('Worker says so') }).edges[0];
    expect(e).toMatchObject({ basis: 'override', check: 'no-link' });
  });
  it('a v1 import re-checks every edge: L03 → evidence, the rest → needs-review', () => {
    const { m, x, y } = twoNodes('QD71.Z', 'QD80');
    const z = newNode({ code_status: 'sdoh', code: 'QE01' });
    const v1 = {
      ...m,
      schema_version: 1,
      nodes: [...m.nodes, z],
      edges: [
        { id: 'a', from: x.id, to: y.id, polarity: '+', weight: 0.5, evidence: [23], link: 'L03' },
        { id: 'b', from: y.id, to: z.id, polarity: '+', weight: 0.5, evidence: [] },
      ],
    };
    const out = migrate(v1);
    expect(out.schema_version).toBe(2);
    expect(out.edges.map((e) => [e.basis, e.check])).toEqual([['evidence', 'match'], ['needs-review', 'withheld:L22']]);
  });
  it('a v2 import with a block-level evidence edge now outside the codes becomes needs-review', () => {
    const c = V2_BLOCK_LEVEL_CASE;
    const { m, x, y } = twoNodes(c.from, c.to);
    const v2 = { ...m, edges: [{ id: 'a', from: x.id, to: y.id, polarity: '+', weight: 0.5, evidence: [31], link: c.link, basis: 'evidence', check: 'match' }] };
    const e = migrate(v2).edges[0];
    expect([e.basis, e.check, e.link]).toEqual([c.basis, c.check, c.link]);
  });
  it('K5: a saved map with eviction coded QD71.1 re-checks on import, and its L03 edge needs review', () => {
    const c = QD71_1_EVICTION_CASE;
    const { m, x, y } = twoNodes(c.from, c.to);
    const v2 = { ...m, edges: [{ id: 'a', from: x.id, to: y.id, polarity: '+', weight: 0.5, evidence: [23], link: c.link, basis: 'evidence', check: 'match' }] };
    const e = migrate(v2).edges[0];
    expect([e.basis, e.check, e.link]).toEqual([c.basis, c.check, c.link]);
  });
});

describe('K5: the w1 loop closes on evidence alone', () => {
  it('eviction → unemployment → low income → eviction: three evidence links, 0 overrides, and it survives the toggle', () => {
    let m = newMap('Client R.');
    const ns = W1_LOOP.codes.map((code) => newNode({ code_status: 'sdoh', code }));
    for (const n of ns) m = addNode(m, n);
    for (let i = 0; i < ns.length; i++) m = addEdge(m, newEdge({ from: ns[i].id, to: ns[(i + 1) % ns.length].id, polarity: '+', basis: 'evidence' }));
    expect(m.edges.map((e) => [e.basis, e.link])).toEqual(W1_LOOP.links.map((l) => ['evidence', l]));
    const all = toGraph(m);
    const evidenceOnly = { nodes: all.nodes, edges: all.edges.filter((e) => m.edges.find((x) => x.id === e.id)!.basis === 'evidence') };
    for (const g of [all, evidenceOnly]) {
      const r = findLoops(g);
      expect(r.loops).toHaveLength(1);
      expect(r.loops[0]).toMatchObject({ kind: 'R', length: 3 });
    }
  });
});

describe('K5: builder search aliases', () => {
  const hit = (q: string) => aliasHits(q).map((a) => a.code);
  it('each alias term finds QD71.Z', () => {
    for (const q of ['evict', 'eviction', 'Evicted', 'forced move', 'housing instability', 'behind on rent', 'evic', 'behind on r']) expect(hit(q), q).toEqual(['QD71.Z']);
  });
  it('a finished ordinary word, or an unrelated one, does not', () => {
    for (const q of ['', 'housing', 'behind', 'forced', 'eve', 'inadequate housing', 'unemploy']) expect(hit(q), q).toEqual([]);
  });
});

describe('K6: loop names are stable for the life of the map', () => {
  const g = (edges: [string, string, number][]) => ({ nodes: [...new Set(edges.flatMap(([a, b]) => [a, b]))].map((id) => ({ id })), edges: edges.map(([from, to, weight], i) => ({ id: `e${i}-${from}${to}`, from, to, polarity: '+' as const, weight })) });
  it('adding a stronger loop does not renumber the existing one; the new loop takes the next free number', () => {
    const first = findLoops(g([['A', 'B', 0.25], ['B', 'A', 0.25]]));
    const a = assignLoopNames([], first);
    expect([...a.names.values()]).toEqual(['R1']);
    const both = findLoops(g([['A', 'B', 0.25], ['B', 'A', 0.25], ['B', 'C', 1], ['C', 'B', 1]]));
    const b = assignLoopNames(a.added, both);
    const byMembers = new Map(both.loops.map((l) => [[...l.nodes].sort().join(''), b.names.get(l.key)]));
    expect(byMembers.get('AB')).toBe('R1'); // the weaker, older loop keeps R1
    expect(byMembers.get('BC')).toBe('R2');
    expect(b.added.map((l) => l.name)).toEqual(['R2']);
  });
  it('a renamed loop keeps its name, and a number in use is never given twice', () => {
    const r = findLoops(g([['A', 'B', 0.5], ['B', 'A', 0.5], ['B', 'C', 0.5], ['C', 'B', 0.5]]));
    const [l1, l2] = r.loops;
    const n = assignLoopNames([{ id: l1.key, name: 'Rent spiral', members: l1.nodes }, { id: 'gone', name: 'R1', members: [] }], r).names;
    expect(n.get(l1.key)).toBe('Rent spiral');
    expect(n.get(l2.key)).toBe('R2');
  });
});
