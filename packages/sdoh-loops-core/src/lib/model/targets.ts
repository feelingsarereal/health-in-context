/**
 * SL28 (S7.1 slice 4): what a notebook span can point at, and the way back. Every item kind — circumstances, links,
 * loops (by their node cycle), clusters, ICD-11 codes, references (the pack's and the map's own), glossary terms, 101s,
 * other notes and spans, and kinds a host adds — has a stable target id, a name, a search, and the passages behind it.
 * Loops and clusters are computed, so a loop target is its node cycle and the passages behind it are found through its
 * circumstances and links as well (never stored on the loop).
 */
import { codeMap, searchCodes } from '../data/scheme';
import { conceptMap, concepts, glossary, refMap, references, termMap } from '../data/refs';
import type { Loop } from '../analysis';
import type { SdohMap } from './map';
import { isChip, isOrphaned, spansFor, type Notebook, type Span, type Target } from './notebook';
import { plainText } from './rich';

/** SL28: a host's own item kind for the notebook's Link to… and @ mentions (e.g. the primer's `/code` entries). */
export interface NotebookTargetKind {
  /** the target kind stored on the span (e.g. 'primer-code'); never one of the core's kinds */
  kind: string;
  /** the group's heading in the picker ("Primer entries") */
  label: string;
  search(q: string): { id: string; label: string; detail?: string }[];
  /** show the item (the host's own page or panel) */
  open(id: string): void;
  /** the item's name, for a span's tooltip and the report (falls back to the id) */
  name?(id: string): string | undefined;
}

export const CORE_KINDS = ['node', 'edge', 'loop', 'cluster', 'code', 'reference', 'glossary', 'concept', 'note', 'span'] as const;

/** A loop's target id: its circumstances in loop order, as the analysis gives them (it starts at the smallest id). */
export const loopTargetId = (l: Pick<Loop, 'nodes'>) => l.nodes.join('>');
/** A cluster's target id: its circumstances, sorted. */
export const clusterTargetId = (ids: string[]) => [...ids].sort().join('+');
/** A user-entered reference on an "other" circumstance, as a reference target id. */
export const mapRefId = (nodeId: string) => `map:${nodeId}`;

export interface TargetContext {
  map: SdohMap;
  nm: (id: string) => string;
  loops: Loop[];
  loopNames?: Map<string, string>;
  clusters: string[][];
  host?: NotebookTargetKind[];
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** The words for an item kind, for headings and screen readers. */
export const KIND_LABEL: Record<string, string> = {
  node: 'Circumstance', edge: 'Link', loop: 'Loop', cluster: 'Cluster', code: 'ICD-11 code', reference: 'Reference', glossary: 'Glossary term', concept: '101', note: 'Note', span: 'Passage',
};

/** A target's name, as the picker, a chip, a tooltip and the report show it; null when the item is not there. */
export function targetName(t: Target, ctx: TargetContext): string | null {
  const { map, nm } = ctx;
  switch (t.kind) {
    case 'node':
      return map.nodes.some((n) => n.id === t.id) ? nm(t.id) : null;
    case 'edge': {
      const e = map.edges.find((x) => x.id === t.id);
      return e ? `${nm(e.from)} → ${nm(e.to)}` : null;
    }
    case 'loop': {
      const l = ctx.loops.find((x) => loopTargetId(x) === t.id);
      if (!l) return null;
      const name = ctx.loopNames?.get(l.key);
      return `${name ? `${name}: ` : ''}${l.nodes.map(nm).join(' → ')} → ↺`;
    }
    case 'cluster': {
      const i = ctx.clusters.findIndex((c) => clusterTargetId(c) === t.id);
      return i < 0 ? null : `Cluster ${i + 1}: ${ctx.clusters[i].map(nm).join(', ')}`;
    }
    case 'code': {
      const c = codeMap.get(t.id);
      return c ? `${c.code} ${c.title}` : null;
    }
    case 'reference': {
      if (t.id.startsWith('map:')) {
        const n = map.nodes.find((x) => x.id === t.id.slice(4));
        return n?.ref ? `${n.ref} (user-entered, on ${nm(n.id)})` : null;
      }
      const r = refMap.get(Number(t.id));
      return r ? `[${r.n}] ${short(r.citation, 80)}` : null;
    }
    case 'glossary':
      return termMap.get(t.id)?.term ?? null;
    case 'concept': {
      const c = conceptMap.get(t.id);
      return c ? `101: ${c.title}` : null;
    }
    case 'note': {
      const n = map.notebook?.notes.find((x) => x.id === t.id);
      return n ? `Note: ${n.title || 'Untitled note'}` : null;
    }
    case 'span': {
      const x = map.notebook?.spans?.find((s) => s.id === t.id);
      if (!x) return null;
      const n = map.notebook?.notes.find((y) => y.id === x.note);
      return `“${short(x.quote || '@', 50)}” (${n?.title ?? 'note'})`;
    }
    default: {
      const h = ctx.host?.find((k) => k.kind === t.kind);
      return h ? h.name?.(t.id) ?? t.id : null;
    }
  }
}

export interface TargetGroup {
  kind: string;
  label: string;
  items: { t: Target; label: string; detail?: string }[];
}
const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const hit = (w: string[], text: string) => {
  const t = text.toLowerCase();
  return w.every((x) => t.includes(x));
};

/**
 * Search every kind at once, for Link to… and @ mentions: up to `per` items a group, in the order the picker lists them.
 * With no query a group shows what is on the map (its circumstances, links, loops, clusters, the codes used) and the
 * other notes; the pack's references, terms and 101s wait for a word.
 */
export function searchTargets(q: string, ctx: TargetContext, opts: { per?: number; note?: string; span?: string } = {}): TargetGroup[] {
  const per = opts.per ?? 8;
  const w = words(q);
  const { map, nm } = ctx;
  const out: TargetGroup[] = [];
  const push = (kind: string, label: string, items: TargetGroup['items']) => items.length && out.push({ kind, label, items: items.slice(0, per) });
  const circ = map.nodes.filter((n) => n.kind !== 'note');
  push('node', 'Circumstances', circ.filter((n) => hit(w, `${nm(n.id)} ${n.code ?? ''} ${n.code ? codeMap.get(n.code)?.title ?? '' : ''} ${plainText(n.circumstance)}`)).map((n) => ({ t: { kind: 'node', id: n.id }, label: nm(n.id), detail: n.code ?? undefined })));
  push('edge', 'Links', map.edges.filter((e) => hit(w, `${nm(e.from)} ${nm(e.to)}`)).map((e) => ({ t: { kind: 'edge', id: e.id }, label: `${nm(e.from)} → ${nm(e.to)}`, detail: `${e.polarity}${e.link ? ` · ${e.link}` : ''}` })));
  push('loop', 'Loops', ctx.loops.filter((l) => hit(w, `${ctx.loopNames?.get(l.key) ?? ''} ${l.nodes.map(nm).join(' ')}`)).map((l) => ({ t: { kind: 'loop', id: loopTargetId(l) }, label: targetName({ kind: 'loop', id: loopTargetId(l) }, ctx)!, detail: l.kind === 'R' ? 'reinforcing' : 'balancing' })));
  push('cluster', 'Clusters', ctx.clusters.map((c, i) => ({ c, i })).filter(({ c }) => hit(w, c.map(nm).join(' '))).map(({ c, i }) => ({ t: { kind: 'cluster', id: clusterTargetId(c) }, label: `Cluster ${i + 1}: ${c.map(nm).join(', ')}` })));
  const used = [...new Set(circ.map((n) => n.code).filter((c): c is string => !!c))];
  const codeHits = w.length ? searchCodes(q).map((c) => c.code) : used;
  push('code', 'ICD-11 codes', codeHits.filter((c) => codeMap.has(c)).map((c) => ({ t: { kind: 'code', id: c }, label: `${c} ${codeMap.get(c)!.title}` })));
  const mapRefs = circ.filter((n) => n.ref && hit(w, n.ref)).map((n) => ({ t: { kind: 'reference', id: mapRefId(n.id) }, label: n.ref!, detail: `user-entered, on ${nm(n.id)}` }));
  const packRefs = w.length ? references.filter((r) => hit(w, `${r.n} ${r.citation} ${r.year}`)).map((r) => ({ t: { kind: 'reference', id: String(r.n) }, label: `[${r.n}] ${short(r.citation, 90)}` })) : [];
  push('reference', 'References', [...mapRefs, ...packRefs]);
  if (w.length) {
    push('glossary', 'Glossary', glossary.filter((g) => hit(w, `${g.term} ${g.variants.join(' ')}`)).map((g) => ({ t: { kind: 'glossary', id: g.id }, label: g.term, detail: short(g.short, 70) })));
    push('concept', '101s', concepts.filter((c) => hit(w, `${c.title} ${c.one_liner}`)).map((c) => ({ t: { kind: 'concept', id: c.id }, label: c.title, detail: short(c.one_liner, 70) })));
  }
  const notes = (map.notebook?.notes ?? []).filter((n) => n.id !== opts.note && hit(w, n.title));
  push('note', 'Notes', notes.map((n) => ({ t: { kind: 'note', id: n.id }, label: n.title || 'Untitled note' })));
  if (w.length) {
    const spans = (map.notebook?.spans ?? []).filter((x) => x.id !== opts.span && !isChip(x) && !isOrphaned(map.notebook, x) && hit(w, x.quote));
    push('span', 'Passages', spans.map((x) => ({ t: { kind: 'span', id: x.id }, label: `“${short(x.quote, 70)}”`, detail: map.notebook?.notes.find((n) => n.id === x.note)?.title })));
  }
  for (const h of ctx.host ?? []) {
    if ((CORE_KINDS as readonly string[]).includes(h.kind)) continue;
    let found: ReturnType<NotebookTargetKind['search']> = [];
    try {
      found = h.search(q);
    } catch {
      found = [];
    }
    push(h.kind, h.label, found.map((x) => ({ t: { kind: h.kind, id: x.id }, label: x.label, detail: x.detail })));
  }
  return out;
}

export interface PassageGroup {
  /** the circumstance the group is under; none for the loop's or cluster's own passages */
  node?: string;
  label: string;
  spans: Span[];
}
const uniq = (xs: Span[]) => [...new Map(xs.map((x) => [x.id, x])).values()];

/**
 * The passages behind a loop or a cluster, grouped by circumstance: each circumstance's own, then those of the links
 * that leave it inside the loop or cluster; the loop's (or cluster's) own passages first. `total` counts each once.
 */
export function passagesBehind(nb: Notebook | undefined, map: SdohMap, nm: (id: string) => string, what: { kind: 'loop'; loop: Loop } | { kind: 'cluster'; nodes: string[] }): { groups: PassageGroup[]; total: number } {
  const nodes = what.kind === 'loop' ? what.loop.nodes : what.nodes;
  const inside = new Set(nodes);
  const edges = what.kind === 'loop' ? new Set(what.loop.edges) : new Set(map.edges.filter((e) => inside.has(e.from) && inside.has(e.to)).map((e) => e.id));
  const own = spansFor(nb, { kind: what.kind, id: what.kind === 'loop' ? loopTargetId(what.loop) : clusterTargetId(what.nodes) });
  const groups: PassageGroup[] = [];
  if (own.length) groups.push({ label: what.kind === 'loop' ? 'The loop itself' : 'The cluster itself', spans: own });
  for (const id of nodes) {
    const outE = map.edges.filter((e) => e.from === id && edges.has(e.id));
    const list = uniq([...spansFor(nb, { kind: 'node', id }), ...outE.flatMap((e) => spansFor(nb, { kind: 'edge', id: e.id }))]);
    if (list.length) groups.push({ node: id, label: nm(id), spans: list });
  }
  return { groups, total: new Set(groups.flatMap((g) => g.spans.map((x) => x.id))).size };
}

/**
 * SL28 trace view: what is connected to the current span, or else to the selection — the items it supports (or the
 * selection itself), then through the notebook every span that cites one of them and every other item those spans cite.
 * A link brings its two ends; a loop or cluster its circumstances (and a loop its links).
 */
export function traceSet(map: SdohMap, focus: { span?: string | null; nodes: string[]; edges: string[] }, ctx: Pick<TargetContext, 'loops' | 'clusters'>): { nodes: Set<string>; edges: Set<string>; spans: Set<string> } {
  const nb = map.notebook;
  const anns = nb?.annotations ?? [];
  const nodes = new Set<string>();
  const edges = new Set<string>();
  const spans = new Set<string>();
  const add = (t: Target) => {
    if (t.kind === 'node') nodes.add(t.id);
    else if (t.kind === 'edge') {
      edges.add(t.id);
      const e = map.edges.find((x) => x.id === t.id);
      if (e) nodes.add(e.from).add(e.to);
    } else if (t.kind === 'loop') {
      const l = ctx.loops.find((x) => loopTargetId(x) === t.id);
      l?.nodes.forEach((n) => nodes.add(n));
      l?.edges.forEach((e) => edges.add(e));
    } else if (t.kind === 'cluster') ctx.clusters.find((c) => clusterTargetId(c) === t.id)?.forEach((n) => nodes.add(n));
  };
  const base: Target[] = focus.span
    ? anns.find((a) => a.span === focus.span)?.targets ?? []
    : [...focus.nodes.map((id) => ({ kind: 'node', id })), ...focus.edges.map((id) => ({ kind: 'edge', id }))];
  if (focus.span) spans.add(focus.span);
  base.forEach(add);
  const isBase = (t: Target) => base.some((b) => b.kind === t.kind && b.id === t.id);
  for (const a of anns) {
    if (!a.targets.some(isBase)) continue;
    spans.add(a.span);
    a.targets.forEach(add);
  }
  return { nodes, edges, spans };
}
