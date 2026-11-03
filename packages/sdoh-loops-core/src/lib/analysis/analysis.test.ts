import { describe, expect, it } from 'vitest';
import { edgeError, findLoops, scc, feedbackClusters, paths, leverage, betweenness, pulse, inventory, ambiguities, neighbourhood, strongestLoops, loopCounts } from './index';
import { G1, G1_EXPECT, G2, G2_EXPECT, G3, G3_EXPECT, G4, G4_EXPECT, G5, G5_EXPECT, G6, G6_EXPECT } from './__fixtures__/golden';

describe('G1 three-node R loop', () => {
  const r = findLoops(G1);
  it('finds exactly one reinforcing loop with strength = product of |w|', () => {
    expect(r.loops).toHaveLength(G1_EXPECT.loops);
    expect(r.loops[0].nodes).toEqual(G1_EXPECT.loop.nodes);
    expect(r.loops[0].kind).toBe(G1_EXPECT.loop.kind);
    expect(r.loops[0].negatives).toBe(G1_EXPECT.loop.negatives);
    expect(r.loops[0].strength).toBe(G1_EXPECT.loop.strength);
    expect(r.truncated).toBe(false);
  });
});

describe('G2 mixed', () => {
  const r = findLoops(G2);
  it('finds the two R loops', () => {
    const got = r.loops.map((l) => ({ nodes: l.nodes, kind: l.kind, negatives: l.negatives, strength: l.strength }));
    expect(got).toEqual(G2_EXPECT.loops);
    expect(loopCounts(r)).toEqual({ total: 2, R: 2, B: 0 });
  });
  it('one SCC of all four nodes', () => {
    expect(scc(G2)).toEqual(G2_EXPECT.scc);
    expect(feedbackClusters(G2)).toEqual(G2_EXPECT.scc);
  });
  it('betweenness and loop participation by hand', () => {
    expect(Object.fromEntries(betweenness(G2))).toEqual(G2_EXPECT.betweenness);
    const rows = leverage(G2, r);
    expect(Object.fromEntries(rows.map((x) => [x.id, x.loops]))).toEqual(G2_EXPECT.loopParticipation);
    expect(rows[0].id).toBe('C');
  });
  it('strength ranking puts {C,D} first', () => {
    expect(strongestLoops(r)[0].nodes).toEqual(G2_EXPECT.strongestFirst);
  });
});

describe('G3 balancing', () => {
  it('finds one B loop', () => {
    const r = findLoops(G3);
    expect(r.loops).toHaveLength(1);
    expect(r.loops[0]).toMatchObject(G3_EXPECT.loop);
  });
  it('what-if pulse: first step exact, converges to the fixed point, stimulus clamped', () => {
    expect(pulse(G3, 'X', 1, 1).values.Y).toBeCloseTo(G3_EXPECT.pulseStep1Y, 6);
    const p = pulse(G3, 'X', 1);
    expect(p.values.X).toBe(1);
    expect(Math.abs(p.values.Y - Math.tanh(p.values.Y + 0.5))).toBeLessThan(1e-3);
    expect(p.steps).toBeLessThanOrEqual(30);
  });
});

describe('G4 no loops', () => {
  it('0 loops and 5 singleton SCCs', () => {
    expect(findLoops(G4).loops).toHaveLength(G4_EXPECT.loops);
    expect(G4.nodes).toHaveLength(5);
    expect(scc(G4)).toHaveLength(G4_EXPECT.sccCount);
    expect(scc(G4).every((c) => c.length === 1)).toBe(true);
    expect(feedbackClusters(G4)).toEqual([]);
  });
  it('paths source→sink enumerated with net signs and weight products', () => {
    const p = paths(G4, 'S', 'Z');
    expect(p.paths.map((x) => ({ nodes: x.nodes, sign: x.sign, weight: x.weight }))).toEqual(G4_EXPECT.pathsSZ);
    expect(p.summary).toBe(G4_EXPECT.summarySZ);
    expect(p.truncated).toBe(false);
  });
});

describe('G5 the w1 map', () => {
  it('one R loop of 3', () => {
    const r = findLoops(G5);
    expect(r.loops).toHaveLength(1);
    expect(r.loops[0]).toMatchObject(G5_EXPECT.loop);
  });
});

describe('G6 truncation', () => {
  it('the loop cap fires with the truncated flag', () => {
    const r = findLoops(G6);
    expect(r.loops).toHaveLength(G6_EXPECT.listed);
    expect(r.truncated).toBe(G6_EXPECT.truncated);
    expect(r.truncatedBy).toEqual(G6_EXPECT.truncatedBy);
  });
  it('without the cap, Johnson finds all 16 064 circuits', () => {
    expect(findLoops(G6, { maxCount: 100_000 }).loops).toHaveLength(G6_EXPECT.totalCircuits);
  });
  it('the length cap drops long circuits and says so', () => {
    const r = findLoops(G1, { maxLength: 2 });
    expect(r.loops).toHaveLength(0);
    expect(r.truncatedBy).toEqual(['length']);
  });
  it('paths cap at 200', () => {
    const p = paths(G6, 'N1', 'N8');
    expect(p.paths).toHaveLength(200);
    expect(p.truncated).toBe(true);
  });
});

describe('validation rules', () => {
  it('refuses a weight whose sign disagrees with its polarity', () => {
    expect(edgeError({ from: 'A', to: 'B', polarity: '+', weight: -0.5 })).toMatch(/sign must match/);
    expect(edgeError({ from: 'A', to: 'B', polarity: '−', weight: 0.5 })).toMatch(/sign must match/);
    expect(edgeError({ from: 'A', to: 'B', polarity: '−', weight: -0.5 })).toBeNull();
  });
  it('refuses a self-loop', () => {
    expect(edgeError({ from: 'A', to: 'A', polarity: '+', weight: 0.5 })).toMatch(/self-loops are refused/);
  });
  it('flags two A→B edges with different polarity', () => {
    const g = { nodes: G1.nodes, edges: [...G1.edges, { id: 'ab2', from: 'A', to: 'B', polarity: '−' as const, weight: -0.5 }] };
    expect(ambiguities(g)).toEqual([{ from: 'A', to: 'B', edges: ['ab', 'ab2'] }]);
    // parallel edges expand into distinct loops: one R, one B
    expect(findLoops(g).loops.map((l) => l.kind).sort()).toEqual(['B', 'R']);
  });
});

describe('A1 inventory and UI-10 neighbourhood', () => {
  it('splits + and − links sorted by |weight|', () => {
    const inv = inventory(G4);
    expect(inv.positive.map((e) => e.id)).toEqual(['bt', 'ab', 'sa', 'tz']);
    expect(inv.negative.map((e) => e.id)).toEqual(['sb', 'at']);
  });
  it('1-hop and 2-hop neighbourhoods keep in and out apart', () => {
    expect(neighbourhood(G4, 'A', 1)).toEqual({ out: ['B', 'T'], in: ['S'], edgesOut: ['ab', 'at'], edgesIn: ['sa'] });
    const n2 = neighbourhood(G4, 'A', 2);
    expect(n2.out.sort()).toEqual(['B', 'T', 'Z']);
  });
});
