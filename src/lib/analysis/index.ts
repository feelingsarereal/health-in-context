/**
 * Causal-loop analyses A1–A8 (content-pack/app-methods.md §3, normative). Pure functions over a small graph shape so
 * the golden fixtures in __fixtures__/ can pin every answer. All node kinds (sdoh · other · undetermined) take part
 * alike; canvas notes are not part of the graph.
 */
export type Polarity = '+' | '−';

export interface ANode {
  id: string;
  label?: string;
}
export interface AEdge {
  id: string;
  from: string;
  to: string;
  polarity: Polarity;
  weight: number;
}
export interface AGraph {
  nodes: ANode[];
  edges: AEdge[];
}

export const LOOP_MAX_LENGTH = 12;
export const LOOP_MAX_COUNT = 500;
export const PATH_MAX_COUNT = 200;
export const WEIGHT_STEPS = [0.1, 0.25, 0.5, 0.75, 1.0];
export const DEFAULT_WEIGHT = 0.5;

const sgn = (p: Polarity) => (p === '+' ? 1 : -1);

// ───────────────────────── validation (app-methods §3, "Validation rules")
/** Blocking errors for an edge; null when it may be saved. */
export function edgeError(e: { from: string; to: string; polarity: Polarity; weight: number }): string | null {
  if (e.from === e.to) return 'A link cannot start and end at the same circumstance (self-loops are refused).';
  if (!Number.isFinite(e.weight) || Math.abs(e.weight) > 1) return 'The weight must be a number from −1 to +1.';
  if (e.weight === 0) return 'The weight cannot be 0; remove the link instead.';
  if (Math.sign(e.weight) !== sgn(e.polarity)) return `The weight's sign must match the polarity (${e.polarity}).`;
  return null;
}

/** Warnings: two edges A→B with different polarity (Richardson 1986: split the variable instead). */
export function ambiguities(g: AGraph): { from: string; to: string; edges: string[] }[] {
  const by = new Map<string, AEdge[]>();
  for (const e of g.edges) {
    const k = `${e.from}\u0000${e.to}`;
    by.set(k, [...(by.get(k) ?? []), e]);
  }
  return [...by.values()]
    .filter((es) => new Set(es.map((e) => e.polarity)).size > 1)
    .map((es) => ({ from: es[0].from, to: es[0].to, edges: es.map((e) => e.id) }));
}

// ───────────────────────── A1 link inventory
export function inventory(g: AGraph) {
  const byW = (a: AEdge, b: AEdge) => Math.abs(b.weight) - Math.abs(a.weight) || a.id.localeCompare(b.id);
  return {
    positive: g.edges.filter((e) => e.polarity === '+').sort(byW),
    negative: g.edges.filter((e) => e.polarity === '−').sort(byW),
  };
}

// ───────────────────────── A2–A4 loops (Johnson 1975), polarity, strength
export interface Loop {
  /** stable key: the edge ids in loop order, rotated to start at the smallest node id */
  key: string;
  nodes: string[];
  edges: string[];
  length: number;
  negatives: number;
  kind: 'R' | 'B';
  /** A4 heuristic: product of |weights| */
  strength: number;
}
export interface LoopResult {
  loops: Loop[];
  truncated: boolean;
  truncatedBy: ('count' | 'length')[];
}

function adjacency(g: AGraph) {
  const ids = [...new Set(g.nodes.map((n) => n.id))].sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  const out: number[][] = ids.map(() => []);
  const edgesBetween = new Map<string, AEdge[]>();
  for (const e of g.edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    const k = `${a},${b}`;
    if (!edgesBetween.has(k)) out[a].push(b);
    edgesBetween.set(k, [...(edgesBetween.get(k) ?? []), e]);
  }
  out.forEach((l) => l.sort((x, y) => x - y));
  return { ids, index, out, edgesBetween };
}

/** Tarjan's SCCs on an index subgraph restricted to nodes ≥ min. */
function sccIdx(n: number, out: number[][], allowed: (v: number) => boolean): number[][] {
  let idx = 0;
  const index = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const on = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  const comps: number[][] = [];
  const strong = (v0: number) => {
    // iterative Tarjan
    const work: [number, number][] = [[v0, 0]];
    index[v0] = low[v0] = idx++;
    stack.push(v0);
    on[v0] = true;
    while (work.length) {
      const top = work[work.length - 1];
      const [v, i] = top;
      const nbrs = out[v];
      if (i < nbrs.length) {
        top[1]++;
        const w = nbrs[i];
        if (!allowed(w)) continue;
        if (index[w] === -1) {
          index[w] = low[w] = idx++;
          stack.push(w);
          on[w] = true;
          work.push([w, 0]);
        } else if (on[w]) low[v] = Math.min(low[v], index[w]);
      } else {
        work.pop();
        if (work.length) {
          const u = work[work.length - 1][0];
          low[u] = Math.min(low[u], low[v]);
        }
        if (low[v] === index[v]) {
          const comp: number[] = [];
          let w: number;
          do {
            w = stack.pop()!;
            on[w] = false;
            comp.push(w);
          } while (w !== v);
          comps.push(comp.sort((a, b) => a - b));
        }
      }
    }
  };
  for (let v = 0; v < n; v++) if (allowed(v) && index[v] === -1) strong(v);
  return comps;
}

export function findLoops(g: AGraph, opts: { maxLength?: number; maxCount?: number } = {}): LoopResult {
  const maxLength = opts.maxLength ?? LOOP_MAX_LENGTH;
  const maxCount = opts.maxCount ?? LOOP_MAX_COUNT;
  const { ids, out, edgesBetween } = adjacency(g);
  const n = ids.length;
  const loops: Loop[] = [];
  const truncatedBy = new Set<'count' | 'length'>();
  let stop = false;

  // Johnson enumerates every elementary circuit; circuits over the length cap are counted but not listed, and a
  // work budget stops pathological maps (reported as the count cap).
  let work = 0;
  const WORK_BUDGET = 200_000;
  const emitCircuit = (cyc: number[]) => {
    if (++work > WORK_BUDGET) {
      truncatedBy.add('count');
      stop = true;
      return;
    }
    if (cyc.length > maxLength) {
      truncatedBy.add('length');
      return;
    }
    // expand parallel edges into distinct loops
    let combos: AEdge[][] = [[]];
    for (let i = 0; i < cyc.length; i++) {
      const es = edgesBetween.get(`${cyc[i]},${cyc[(i + 1) % cyc.length]}`)!;
      combos = combos.flatMap((c) => es.map((e) => [...c, e]));
    }
    for (const c of combos) {
      if (loops.length >= maxCount) {
        truncatedBy.add('count');
        stop = true;
        return;
      }
      const negatives = c.filter((e) => e.polarity === '−').length;
      loops.push({
        key: c.map((e) => e.id).join('>'),
        nodes: cyc.map((i) => ids[i]),
        edges: c.map((e) => e.id),
        length: cyc.length,
        negatives,
        kind: negatives % 2 === 0 ? 'R' : 'B',
        strength: c.reduce((p, e) => p * Math.abs(e.weight), 1),
      });
    }
  };

  // Johnson's algorithm: for each s, circuits through s in the SCC of the subgraph induced by {s..n-1}.
  let s = 0;
  while (s < n && !stop) {
    const comps = sccIdx(n, out, (v) => v >= s).filter((c) => c.length > 1);
    if (!comps.length) break;
    // the component containing the least vertex
    let comp = comps[0];
    for (const c of comps) if (c[0] < comp[0]) comp = c;
    s = comp[0];
    const inComp = new Set(comp);
    const blocked = new Array<boolean>(n).fill(false);
    const B: Set<number>[] = ids.map(() => new Set());
    const path: number[] = [];
    const unblock = (u: number) => {
      const st = [u];
      while (st.length) {
        const x = st.pop()!;
        if (!blocked[x]) continue;
        blocked[x] = false;
        for (const w of B[x]) st.push(w);
        B[x].clear();
      }
    };
    // iterative CIRCUIT(v)
    const frames: { v: number; i: number; found: boolean }[] = [];
    const push = (v: number) => {
      path.push(v);
      blocked[v] = true;
      frames.push({ v, i: 0, found: false });
    };
    push(s);
    while (frames.length && !stop) {
      const f = frames[frames.length - 1];
      const nbrs = out[f.v].filter((w) => inComp.has(w));
      if (f.i < nbrs.length) {
        const w = nbrs[f.i++];
        if (w === s) {
          emitCircuit([...path]);
          f.found = true;
        } else if (!blocked[w]) {
          push(w);
        }
      } else {
        frames.pop();
        path.pop();
        if (f.found) unblock(f.v);
        else for (const w of nbrs) B[w].add(f.v);
        if (frames.length && f.found) frames[frames.length - 1].found = true;
      }
    }
    s++;
  }
  return { loops, truncated: truncatedBy.size > 0, truncatedBy: [...truncatedBy].sort() };
}

export function loopCounts(r: LoopResult) {
  return { total: r.loops.length, R: r.loops.filter((l) => l.kind === 'R').length, B: r.loops.filter((l) => l.kind === 'B').length };
}

/**
 * A4: loops ranked by the strength heuristic. Ties (within 1e-9, so 0.5 × 0.25 ties 0.5³) go by name when names are given
 * (K7: R1 before R2, R2 before R10), otherwise by length; then by key.
 */
export function strongestLoops(r: LoopResult, names?: Map<string, string>): Loop[] {
  const byName = (a: Loop, b: Loop) => (names ? (names.get(a.key) ?? '').localeCompare(names.get(b.key) ?? '', undefined, { numeric: true }) : 0);
  return [...r.loops].sort((a, b) => (Math.abs(b.strength - a.strength) > 1e-9 ? b.strength - a.strength : 0) || byName(a, b) || a.length - b.length || a.key.localeCompare(b.key));
}

// ───────────────────────── A5 strongly connected components
export function scc(g: AGraph): string[][] {
  const { ids, out } = adjacency(g);
  return sccIdx(ids.length, out, () => true)
    .map((c) => c.map((i) => ids[i]).sort())
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}
/** Feedback clusters: SCCs with more than one node. */
export function feedbackClusters(g: AGraph): string[][] {
  return scc(g).filter((c) => c.length > 1);
}

// ───────────────────────── A6 paths
export interface PathResult {
  paths: { nodes: string[]; edges: string[]; sign: Polarity; weight: number }[];
  truncated: boolean;
  summary: 'none' | 'all +' | 'all −' | 'mixed';
}
export function paths(g: AGraph, from: string, to: string, cap = PATH_MAX_COUNT): PathResult {
  const outE = new Map<string, AEdge[]>();
  for (const e of g.edges) if (e.from !== e.to) outE.set(e.from, [...(outE.get(e.from) ?? []), e]);
  for (const l of outE.values()) l.sort((a, b) => a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  const res: PathResult['paths'] = [];
  let truncated = false;
  if (from === to) return { paths: [], truncated: false, summary: 'none' };
  const seen = new Set<string>([from]);
  const nodes = [from];
  const edges: AEdge[] = [];
  const dfs = (v: string) => {
    if (truncated) return;
    for (const e of outE.get(v) ?? []) {
      if (seen.has(e.to)) continue;
      if (e.to === to) {
        if (res.length >= cap) {
          truncated = true;
          return;
        }
        const es = [...edges, e];
        const neg = es.filter((x) => x.polarity === '−').length;
        res.push({ nodes: [...nodes, to], edges: es.map((x) => x.id), sign: neg % 2 ? '−' : '+', weight: es.reduce((p, x) => p * x.weight, 1) });
        continue;
      }
      seen.add(e.to);
      nodes.push(e.to);
      edges.push(e);
      dfs(e.to);
      edges.pop();
      nodes.pop();
      seen.delete(e.to);
      if (truncated) return;
    }
  };
  dfs(from);
  const signs = new Set(res.map((p) => p.sign));
  const summary = !res.length ? 'none' : signs.size > 1 ? 'mixed' : signs.has('+') ? 'all +' : 'all −';
  return { paths: res, truncated, summary };
}

// ───────────────────────── A7 leverage hints (heuristic)
export interface LeverageRow {
  id: string;
  weightedIn: number;
  weightedOut: number;
  betweenness: number;
  loops: number;
}
/** Brandes betweenness on the directed, unweighted graph (raw pair counts, not normalised). */
export function betweenness(g: AGraph): Map<string, number> {
  const ids = [...new Set(g.nodes.map((n) => n.id))].sort();
  const adj = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of g.edges) if (e.from !== e.to && adj.has(e.from) && adj.has(e.to) && !adj.get(e.from)!.includes(e.to)) adj.get(e.from)!.push(e.to);
  const cb = new Map(ids.map((i) => [i, 0]));
  for (const s of ids) {
    const S: string[] = [];
    const P = new Map<string, string[]>(ids.map((i) => [i, []]));
    const sigma = new Map(ids.map((i) => [i, 0]));
    const dist = new Map(ids.map((i) => [i, -1]));
    sigma.set(s, 1);
    dist.set(s, 0);
    const Q = [s];
    while (Q.length) {
      const v = Q.shift()!;
      S.push(v);
      for (const w of adj.get(v)!) {
        if (dist.get(w)! < 0) {
          Q.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          P.get(w)!.push(v);
        }
      }
    }
    const delta = new Map(ids.map((i) => [i, 0]));
    while (S.length) {
      const w = S.pop()!;
      for (const v of P.get(w)!) delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!);
    }
  }
  return cb;
}
export type LeverageSort = 'loops' | 'betweenness' | 'weightedOut' | 'weightedIn';
export function leverage(g: AGraph, loopResult?: LoopResult, sortBy: LeverageSort = 'loops'): LeverageRow[] {
  const lr = loopResult ?? findLoops(g);
  const bc = betweenness(g);
  const rows: LeverageRow[] = g.nodes.map((n) => ({
    id: n.id,
    weightedIn: round(g.edges.filter((e) => e.to === n.id).reduce((s, e) => s + Math.abs(e.weight), 0)),
    weightedOut: round(g.edges.filter((e) => e.from === n.id).reduce((s, e) => s + Math.abs(e.weight), 0)),
    betweenness: round(bc.get(n.id) ?? 0),
    loops: lr.loops.filter((l) => l.nodes.includes(n.id)).length,
  }));
  const tie = (a: LeverageRow, b: LeverageRow) => b.loops - a.loops || b.betweenness - a.betweenness || b.weightedOut + b.weightedIn - (a.weightedOut + a.weightedIn) || a.id.localeCompare(b.id);
  return rows.sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number) || tie(a, b));
}
const round = (x: number) => Math.round(x * 1e6) / 1e6;

// ───────────────────────── A8 what-if pulse (FCM, heuristic)
export interface PulseResult {
  values: Record<string, number>;
  steps: number;
  converged: boolean;
}
/** x(t+1) = tanh(x(t) + Wᵀx(t)), stimulus clamped, ≤ 30 steps or until max |Δ| < 1e-4 (Kosko 1986). */
export function pulse(g: AGraph, stimulus: string, direction: 1 | -1 = 1, maxSteps = 30): PulseResult {
  const ids = g.nodes.map((n) => n.id);
  let x = new Map(ids.map((i) => [i, i === stimulus ? direction : 0]));
  let steps = 0;
  let converged = false;
  while (steps < maxSteps) {
    steps++;
    const next = new Map<string, number>();
    for (const i of ids) {
      if (i === stimulus) {
        next.set(i, direction);
        continue;
      }
      let sum = x.get(i)!;
      for (const e of g.edges) if (e.to === i && e.from !== i && x.has(e.from)) sum += e.weight * x.get(e.from)!;
      next.set(i, Math.tanh(sum));
    }
    const delta = Math.max(0, ...ids.map((i) => Math.abs(next.get(i)! - x.get(i)!)));
    x = next;
    if (delta < 1e-4) {
      converged = true;
      break;
    }
  }
  return { values: Object.fromEntries([...x].map(([k, v]) => [k, round(v)])), steps, converged };
}

// ───────────────────────── neighbourhood (UI-10)
export function neighbourhood(g: AGraph, id: string, hops: 1 | 2) {
  const out = new Set<string>();
  const inn = new Set<string>();
  const edgesOut = new Set<string>();
  const edgesIn = new Set<string>();
  let frontOut = new Set([id]);
  let frontIn = new Set([id]);
  for (let h = 0; h < hops; h++) {
    const nOut = new Set<string>();
    const nIn = new Set<string>();
    for (const e of g.edges) {
      if (frontOut.has(e.from) && e.to !== id) {
        edgesOut.add(e.id);
        if (!out.has(e.to)) nOut.add(e.to);
      }
      if (frontIn.has(e.to) && e.from !== id) {
        edgesIn.add(e.id);
        if (!inn.has(e.from)) nIn.add(e.from);
      }
    }
    nOut.forEach((v) => out.add(v));
    nIn.forEach((v) => inn.add(v));
    frontOut = nOut;
    frontIn = nIn;
  }
  return { out: [...out], in: [...inn], edgesOut: [...edgesOut], edgesIn: [...edgesIn] };
}
