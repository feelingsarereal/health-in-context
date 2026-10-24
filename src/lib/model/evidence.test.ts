import { describe, expect, it } from 'vitest';
import { checkLink, evidenceCanCloseALoop } from './evidence';
import { EVIDENCE_CASES, RECODE_CASE } from './__fixtures__/evidence-golden';
import { addEdge, addNode, migrate, newEdge, newMap, newNode, updateEdge, updateNode, ModelError } from './map';
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
    const r = checkLink({ code_status: 'sdoh', code: 'QD51' }, { code_status: 'sdoh', code: 'QD71.1' }, '+');
    expect(r.link).toBeNull();
    expect(r.message).toMatch(/^Evidence link L02 is withheld: /);
  });
  it('with the links shipped in this pack, no loop can close on evidence alone', () => {
    expect(evidenceCanCloseALoop()).toBe(false);
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
    const { m, x, y } = twoNodes('QD71.1', 'QD80');
    const e = addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' })).edges[0];
    expect(e).toMatchObject({ basis: 'evidence', check: 'match', link: 'L03', evidence: [23] });
  });
  it('an unsupported edge is refused without a confirmed override and a reason', () => {
    const { m, x, y } = twoNodes('QD51', 'QD71.1');
    expect(() => addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' }))).toThrow(ModelError);
    expect(() => addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'override' }))).toThrow(/confirmed override with a reason/);
    const e = addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'override', override_reason: docFromText("Can't make rent") })).edges[0];
    expect(e).toMatchObject({ basis: 'override', check: 'withheld:L02', link: null });
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
    const { m, x, y } = twoNodes('QD71.1', 'QD80');
    const m1 = addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' }));
    expect(updateEdge(m1, m1.edges[0].id, { polarity: '−', weight: -0.5 }).edges[0]).toMatchObject({ basis: 'needs-review', check: 'opposite-polarity' });
  });
  it('a needs-review edge can be confirmed as an override with a reason', () => {
    const { m, x, y } = twoNodes('QD71.1', 'QD80');
    const m1 = updateNode(addEdge(m, newEdge({ from: x.id, to: y.id, polarity: '+', basis: 'evidence' })), y.id, { code: 'QE01' });
    const e = updateEdge(m1, m1.edges[0].id, { basis: 'override', override_reason: docFromText('Worker says so') }).edges[0];
    expect(e).toMatchObject({ basis: 'override', check: 'no-link' });
  });
  it('a v1 import re-checks every edge: L03 → evidence, the rest → needs-review', () => {
    const { m, x, y } = twoNodes('QD71.1', 'QD80');
    const z = newNode({ code_status: 'sdoh', code: 'QD51' });
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
    expect(out.edges.map((e) => [e.basis, e.check])).toEqual([['evidence', 'match'], ['needs-review', 'withheld:L01']]);
  });
});
