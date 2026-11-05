/**
 * SL27: notebook spans on the map — attach a span to a circumstance or link (both sides at once, so one Undo restores
 * both), and delete circumstances or links while keeping or removing the spans behind them.
 */
import { deleteEdges, deleteNodes, type MapEdge, type MapNode, type SdohMap, type SourceRef } from './map';
import { addPassage, deleteSpans, removeTargets, type Notebook, type Span, type Target } from './notebook';

const nb0 = (m: SdohMap): Notebook => m.notebook ?? { notes: [], dismissed: [], replaced: {} };
const withSource = <T extends MapNode | MapEdge>(x: T, r: SourceRef): T => (x.sources?.some((s) => s.span === r.span) ? x : { ...x, sources: [...(x.sources ?? []), r] });

/** The span (new, or the same selection already stored) becomes a source of the item, and the item its target. */
export function attachSpan(m: SdohMap, sp: Span, t: { kind: 'node' | 'edge'; id: string }, text?: string): { map: SdohMap; span: string } {
  const { notebook, span } = addPassage(nb0(m), sp, { target: t, ...(text ? { text } : {}) });
  const r = { note: sp.note, span };
  return {
    map: {
      ...m,
      notebook,
      nodes: t.kind === 'node' ? m.nodes.map((n) => (n.id === t.id ? withSource(n, r) : n)) : m.nodes,
      edges: t.kind === 'edge' ? m.edges.map((e) => (e.id === t.id ? withSource(e, r) : e)) : m.edges,
      updated: new Date().toISOString(),
    },
    span,
  };
}

/** How many spans back these circumstances and links (and the links that go with the circumstances). */
export function spansBehind(m: SdohMap, nodes: string[], edges: string[]): number {
  const ns = new Set(nodes);
  const es = new Set([...edges, ...m.edges.filter((e) => ns.has(e.from) || ns.has(e.to)).map((e) => e.id)]);
  const ids = new Set([...m.nodes.filter((n) => ns.has(n.id)), ...m.edges.filter((e) => es.has(e.id))].flatMap((x) => (x.sources ?? []).map((s) => s.span)));
  return ids.size;
}

/**
 * Delete circumstances (with their links) and links. Their spans stay as plain highlights (`keep`), or go, unless they
 * still support something else (`remove`).
 */
export function deleteWithSpans(m: SdohMap, nodes: string[], edges: string[], spans: 'keep' | 'remove'): SdohMap {
  const ns = new Set(nodes);
  const gone: Target[] = [...nodes.map((id) => ({ kind: 'node', id })), ...[...edges, ...m.edges.filter((e) => ns.has(e.from) || ns.has(e.to)).map((e) => e.id)].map((id) => ({ kind: 'edge', id }))];
  const next = deleteEdges(deleteNodes(m, nodes), edges);
  return m.notebook ? { ...next, notebook: removeTargets(m.notebook, gone, spans === 'remove') } : next;
}

/** Remove a passage everywhere: the span, its annotation, and the sources that name it. */
export function removeSpan(m: SdohMap, spanId: string): SdohMap {
  const drop = <T extends MapNode | MapEdge>(x: T): T => {
    if (!x.sources?.some((s) => s.span === spanId)) return x;
    const rest = x.sources.filter((s) => s.span !== spanId);
    const next = { ...x };
    if (rest.length) next.sources = rest;
    else delete next.sources;
    return next;
  };
  return { ...m, nodes: m.nodes.map(drop), edges: m.edges.map(drop), notebook: m.notebook ? deleteSpans(m.notebook, [spanId]) : m.notebook, updated: new Date().toISOString() };
}

/**
 * SL27 point 8: "Remove as evidence" — the span comes off this item's sources and the item off the span's targets; the
 * highlight goes too unless something else still uses it (another item, or a comment). One change, so one Undo.
 */
export function detachSpan(m: SdohMap, spanId: string, t: { kind: 'node' | 'edge'; id: string }): SdohMap {
  const drop = <T extends MapNode | MapEdge>(x: T): T => {
    if (x.id !== t.id || !x.sources?.some((s) => s.span === spanId)) return x;
    const rest = x.sources.filter((s) => s.span !== spanId);
    const next = { ...x };
    if (rest.length) next.sources = rest;
    else delete next.sources;
    return next;
  };
  const nb = m.notebook;
  let notebook = nb;
  if (nb?.annotations) {
    const annotations = nb.annotations.map((a) => (a.span === spanId ? { ...a, targets: a.targets.filter((x) => !(x.kind === t.kind && x.id === t.id)) } : a));
    const a = annotations.find((x) => x.span === spanId);
    notebook = a && !a.targets.length && !a.text ? deleteSpans({ ...nb, annotations }, [spanId]) : { ...nb, annotations };
  }
  return {
    ...m,
    nodes: t.kind === 'node' ? m.nodes.map(drop) : m.nodes,
    edges: t.kind === 'edge' ? m.edges.map(drop) : m.edges,
    notebook,
    updated: new Date().toISOString(),
  };
}
