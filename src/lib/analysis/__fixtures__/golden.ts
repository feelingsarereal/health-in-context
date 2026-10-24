/**
 * Golden fixtures (KICKOFF §8.4) — written by hand, with the expected answers worked out by hand beside each graph.
 * A drift between these answers and the analyses is a failure; tolerances are never widened (ACTION-SPEC §7).
 */
import type { AGraph, AEdge, Polarity } from '../index';

const e = (id: string, from: string, to: string, polarity: Polarity, weight: number): AEdge => ({ id, from, to, polarity, weight });
const nodes = (...ids: string[]) => ids.map((id) => ({ id }));

/** G1 — three-node R loop: A→B(+), B→C(+), C→A(+), all weight 0.5. One loop, R, strength 0.5³ = 0.125. */
export const G1: AGraph = { nodes: nodes('A', 'B', 'C'), edges: [e('ab', 'A', 'B', '+', 0.5), e('bc', 'B', 'C', '+', 0.5), e('ca', 'C', 'A', '+', 0.5)] };
export const G1_EXPECT = { loops: 1, loop: { nodes: ['A', 'B', 'C'], kind: 'R', strength: 0.125, negatives: 0 } };

/**
 * G2 — mixed: G1 plus C→D(−0.5), D→C(−0.5). Two loops: {A,B,C} R (0 negatives, strength 0.125) and {C,D} R
 * (2 negatives multiply to +, strength 0.25). SCC = {A,B,C,D}.
 * Betweenness (directed, unweighted, raw pair counts), by hand from the shortest paths:
 *   A on C→B, D→B = 2 · B on A→C, A→D = 2 · C on A→D, B→A, B→D, D→A, D→B = 5 · D = 0.
 * Loop participation: A 1, B 1, C 2, D 1.
 */
export const G2: AGraph = { nodes: nodes('A', 'B', 'C', 'D'), edges: [...G1.edges, e('cd', 'C', 'D', '−', -0.5), e('dc', 'D', 'C', '−', -0.5)] };
export const G2_EXPECT = {
  loops: [
    { nodes: ['A', 'B', 'C'], kind: 'R', negatives: 0, strength: 0.125 },
    { nodes: ['C', 'D'], kind: 'R', negatives: 2, strength: 0.25 },
  ],
  scc: [['A', 'B', 'C', 'D']],
  betweenness: { A: 2, B: 2, C: 5, D: 0 },
  loopParticipation: { A: 1, B: 1, C: 2, D: 1 },
  strongestFirst: ['C', 'D'],
};

/** G3 — balancing: X→Y(+0.5), Y→X(−0.5). One loop, B (one negative), strength 0.25. */
export const G3: AGraph = { nodes: nodes('X', 'Y'), edges: [e('xy', 'X', 'Y', '+', 0.5), e('yx', 'Y', 'X', '−', -0.5)] };
export const G3_EXPECT = {
  loops: 1,
  loop: { nodes: ['X', 'Y'], kind: 'B', negatives: 1, strength: 0.25 },
  // what-if pulse with X clamped at +1: step 1 gives Y = tanh(0 + 0.5·1) = tanh(0.5) = 0.462117…; at convergence Y is
  // the fixed point of y = tanh(y + 0.5).
  pulseStep1Y: Math.tanh(0.5),
};

/**
 * G4 — no loops: a DAG of 5 nodes, source S, sink Z. S→A(+0.5), S→B(−0.5), A→B(+0.5), A→T(−0.25), B→T(+1), T→Z(+0.5).
 * 0 loops; 5 singleton SCCs. Paths S→Z, in depth-first order (neighbours by id):
 *   S·A·B·T·Z  signs + + + +  → +   weight 0.5·0.5·1·0.5       =  0.125
 *   S·A·T·Z    signs + − +    → −   weight 0.5·(−0.25)·0.5     = −0.0625
 *   S·B·T·Z    signs − + +    → −   weight (−0.5)·1·0.5        = −0.25
 * Net-sign summary: mixed.
 */
export const G4: AGraph = {
  nodes: nodes('S', 'A', 'B', 'T', 'Z'),
  edges: [e('sa', 'S', 'A', '+', 0.5), e('sb', 'S', 'B', '−', -0.5), e('ab', 'A', 'B', '+', 0.5), e('at', 'A', 'T', '−', -0.25), e('bt', 'B', 'T', '+', 1), e('tz', 'T', 'Z', '+', 0.5)],
};
export const G4_EXPECT = {
  loops: 0,
  sccCount: 5,
  pathsSZ: [
    { nodes: ['S', 'A', 'B', 'T', 'Z'], sign: '+', weight: 0.125 },
    { nodes: ['S', 'A', 'T', 'Z'], sign: '−', weight: -0.0625 },
    { nodes: ['S', 'B', 'T', 'Z'], sign: '−', weight: -0.25 },
  ],
  summarySZ: 'mixed',
};

/** G5 — the w1 map: QD71.1→QD80(+0.5), QD80→QD51(+0.5), QD51→QD71.1(+0.75). One R loop of 3, strength 0.1875. */
export const G5: AGraph = {
  nodes: nodes('QD71.1', 'QD80', 'QD51'),
  edges: [e('h-u', 'QD71.1', 'QD80', '+', 0.5), e('u-i', 'QD80', 'QD51', '+', 0.5), e('i-h', 'QD51', 'QD71.1', '+', 0.75)],
};
export const G5_EXPECT = { loops: 1, loop: { length: 3, kind: 'R', strength: 0.1875 } };

/**
 * G6 — truncation: the complete digraph on 8 nodes (every ordered pair, +0.5). It has
 * Σ_{k=2..8} C(8,k)·(k−1)! = 28 + 112 + 420 + 1344 + 3360 + 5760 + 5040 = 16 064 elementary circuits, so the
 * 500-loop cap fires: exactly 500 are listed and the result is marked truncated (by count).
 */
const K8 = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8'];
export const G6: AGraph = { nodes: nodes(...K8), edges: K8.flatMap((a) => K8.filter((b) => b !== a).map((b) => e(`${a}-${b}`, a, b, '+', 0.5))) };
export const G6_EXPECT = { listed: 500, truncated: true, truncatedBy: ['count'], totalCircuits: 16064 };
