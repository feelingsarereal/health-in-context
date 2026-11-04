/**
 * The map model (planner.yaml → fields, enums; app-methods §1–§2; UI-16). Pure data + pure operations; the canvas,
 * the list view and the storage adapter all go through these.
 */
import { DEFAULT_WEIGHT, edgeError, type AGraph, type Polarity } from '../analysis';
import { emptyDoc, isEmpty, sanitizeRich, type RichDoc } from './rich';
import { checkLink, type Basis } from './evidence';
import { sanitizeNotebook, type Notebook } from './notebook';

/** SL26: schema 3 adds the optional `notebook` block (S7.1); a map without one is written as schema 2 (exportJSON). */
export const SCHEMA_VERSION = 3;
/** the last schema without the notebook block: what released 0.4.x cores read */
export const SCHEMA_NO_NOTEBOOK = 2;
export const PACK_VERSION = '0.1';
export const ICD11_RELEASE = 'ICD-11 MMS 2026-01';

export type CodeStatus = 'sdoh' | 'other' | 'undetermined';
export const CODE_STATUSES: CodeStatus[] = ['sdoh', 'other', 'undetermined'];
export type OtherType = 'outcome' | 'policy' | 'event' | 'resource' | 'personal' | 'other';
export const OTHER_TYPES: OtherType[] = ['outcome', 'policy', 'event', 'resource', 'personal', 'other'];
export type Confidence = 'low' | 'medium' | 'high';
export const CONFIDENCES: Confidence[] = ['low', 'medium', 'high'];
/** SL17: a box's text — the title alone, the code line above it (the default), or both with the circumstance below */
export type NodeText = 'title' | 'title-code' | 'full';
export const NODE_TEXTS: NodeText[] = ['title', 'title-code', 'full'];
export type LineType = 'solid' | 'dashed' | 'dotted';
export type Route = 'curved' | 'straight';

export interface MapNode {
  id: string;
  /** 'note' = a free canvas note (UI-15); notes take no part in the analyses */
  kind?: 'circumstance' | 'note';
  code_status: CodeStatus;
  code: string | null;
  type: OtherType | null;
  /** optional user-entered reference for an 'other' node (shown as "user-entered") */
  ref: string | null;
  label: RichDoc;
  circumstance: RichDoc;
  severity: 0 | 1 | 2 | 3 | null;
  since: string | null;
  notes: RichDoc;
  style: { fill?: string | null };
  pinned: boolean;
  x: number;
  y: number;
  created: string;
  updated: string;
  [extra: string]: unknown;
}

export interface MapEdge {
  id: string;
  from: string;
  to: string;
  polarity: Polarity;
  weight: number;
  delay: boolean;
  confidence: Confidence;
  description: RichDoc;
  /** reference numbers (references.json n); edges from the association menu carry the link's refs */
  evidence: number[];
  /** the links.yaml id that backs this edge (basis evidence), if any */
  link: string | null;
  /** UI-18: evidence · override · needs-review */
  basis: Basis;
  /** the last check result: match · no-link · opposite-polarity · withheld:<id> · uncoded-end */
  check: string;
  /** required for an override: why the person keeps the link (rich text) */
  override_reason: RichDoc | null;
  /** YYYY-MM-DD the override was confirmed */
  override_at: string | null;
  style: { line?: LineType; route?: Route; color?: string | null; widthByWeight?: boolean };
  [extra: string]: unknown;
}

export interface MapLoopName {
  id: string;
  name: string;
  members: string[];
}

export interface SdohMap {
  schema_version: number;
  pack_version: string;
  icd11_release: string;
  id: string;
  name: string;
  subject: string;
  created: string;
  updated: string;
  /** SL17: `nodeText` is how much text a box shows; left out, it is 'title-code' (and is not written until changed) */
  layout: { engine: 'fcose' | 'elk-stress'; theme: 'auto' | 'print'; thickness: boolean; nodeText?: NodeText };
  notes: RichDoc;
  nodes: MapNode[];
  edges: MapEdge[];
  loops: MapLoopName[];
  /** SL26 (schema 3): the case manager notebook, one per map; device-only, saved and exported with the map */
  notebook?: Notebook;
  [extra: string]: unknown;
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
}
export const now = () => new Date().toISOString();

export function newMap(name: string, subject = ''): SdohMap {
  const t = now();
  return {
    schema_version: SCHEMA_VERSION,
    pack_version: PACK_VERSION,
    icd11_release: ICD11_RELEASE,
    id: newId('map'),
    name: name.trim() || 'Untitled map',
    subject,
    created: t,
    updated: t,
    layout: { engine: 'fcose', theme: 'auto', thickness: true },
    notes: emptyDoc(),
    nodes: [],
    edges: [],
    loops: [],
  };
}

export function newNode(p: Partial<MapNode> & { code_status: CodeStatus }): MapNode {
  const t = now();
  return {
    id: p.id ?? newId('n'),
    kind: p.kind ?? 'circumstance',
    code_status: p.code_status,
    code: p.code_status === 'sdoh' ? p.code ?? null : null,
    type: p.code_status === 'other' ? p.type ?? null : null,
    ref: p.code_status === 'other' ? p.ref ?? null : null,
    label: p.label ?? emptyDoc(),
    circumstance: p.circumstance ?? emptyDoc(),
    severity: p.severity ?? null,
    since: p.since ?? null,
    notes: p.notes ?? emptyDoc(),
    style: p.style ?? {},
    pinned: p.pinned ?? false,
    x: p.x ?? 0,
    y: p.y ?? 0,
    created: t,
    updated: t,
  };
}

export function newEdge(p: Partial<MapEdge> & { from: string; to: string; polarity: Polarity }): MapEdge {
  const sign = p.polarity === '+' ? 1 : -1;
  return {
    id: p.id ?? newId('e'),
    from: p.from,
    to: p.to,
    polarity: p.polarity,
    weight: p.weight ?? sign * DEFAULT_WEIGHT,
    delay: p.delay ?? false,
    confidence: p.confidence ?? 'medium',
    description: p.description ?? emptyDoc(),
    evidence: p.evidence ?? [],
    link: p.link ?? null,
    basis: p.basis ?? (p.link ? 'evidence' : 'override'),
    check: p.check ?? (p.link ? 'match' : 'no-link'),
    override_reason: p.override_reason ?? null,
    override_at: p.override_at ?? null,
    style: p.style ?? { line: 'solid', route: 'curved', widthByWeight: true },
  };
}

export const today = () => new Date().toLocaleDateString('en-CA');

/**
 * Re-run the evidence check on one edge against the current nodes. An evidence edge that no longer matches becomes
 * needs-review (never silently relabelled); an override keeps its basis and reason, with the check refreshed.
 */
export function recheckEdge(m: Pick<SdohMap, 'nodes'>, e: MapEdge): MapEdge {
  const a = m.nodes.find((n) => n.id === e.from);
  const b = m.nodes.find((n) => n.id === e.to);
  if (!a || !b) return e;
  const r = checkLink(a, b, e.polarity);
  if (e.basis === 'evidence') {
    if (r.check === 'match' && r.link) return { ...e, check: 'match', link: r.link.id, evidence: [...r.link.refs] };
    return { ...e, basis: 'needs-review', check: r.check };
  }
  return { ...e, check: r.check };
}

// ───────────────────────── operations (each returns a new map; validation errors throw ModelError)
export class ModelError extends Error {}

const touch = (m: SdohMap): SdohMap => ({ ...m, updated: now() });

export function addNode(m: SdohMap, n: MapNode): SdohMap {
  return touch({ ...m, nodes: [...m.nodes, n] });
}
export function updateNode(m: SdohMap, id: string, patch: Partial<MapNode>): SdohMap {
  const next = updateNodeRaw(m, id, patch);
  if (!('code' in patch) && !('code_status' in patch)) return next;
  // UI-18: recoding re-checks the node's links
  return { ...next, edges: next.edges.map((e) => (e.from === id || e.to === id ? recheckEdge(next, e) : e)) };
}
function updateNodeRaw(m: SdohMap, id: string, patch: Partial<MapNode>): SdohMap {
  return touch({
    ...m,
    nodes: m.nodes.map((n) => {
      if (n.id !== id) return n;
      const next = { ...n, ...patch, updated: now() };
      // recoding between states keeps every edge; it clears only fields that do not apply to the new state
      if (next.code_status !== 'sdoh') next.code = null;
      if (next.code_status !== 'other') {
        next.type = null;
        next.ref = null;
      }
      return next;
    }),
  });
}
export function deleteNodes(m: SdohMap, ids: string[]): SdohMap {
  const s = new Set(ids);
  return touch({ ...m, nodes: m.nodes.filter((n) => !s.has(n.id)), edges: m.edges.filter((e) => !s.has(e.from) && !s.has(e.to)) });
}
export function addEdge(m: SdohMap, e: MapEdge): SdohMap {
  const err = edgeError(e);
  if (err) throw new ModelError(err);
  if (!m.nodes.some((n) => n.id === e.from) || !m.nodes.some((n) => n.id === e.to)) throw new ModelError('Both ends of a link must be circumstances on this map.');
  if ([e.from, e.to].some((id) => m.nodes.find((n) => n.id === id)?.kind === 'note')) throw new ModelError('Canvas notes cannot be linked.');
  return touch({ ...m, edges: [...m.edges, settleBasis(m, e)] });
}
export function updateEdge(m: SdohMap, id: string, patch: Partial<MapEdge>): SdohMap {
  const cur = m.edges.find((e) => e.id === id);
  if (!cur) throw new ModelError('No such link.');
  let next = { ...cur, ...patch };
  const err = edgeError(next);
  if (err) throw new ModelError(err);
  if (patch.basis === 'override' || patch.basis === 'evidence') next = settleBasis(m, next);
  else if ('polarity' in patch || 'from' in patch || 'to' in patch) next = recheckEdge(m, next);
  return touch({ ...m, edges: m.edges.map((e) => (e.id === id ? next : e)) });
}

/**
 * The only two ways an edge gets a basis: `evidence` when the check matches (the link's refs come with it), or a
 * confirmed `override` with a non-empty reason. Anything else is refused (UI-18: an override is deliberate).
 */
export function settleBasis(m: Pick<SdohMap, 'nodes'>, e: MapEdge): MapEdge {
  const a = m.nodes.find((n) => n.id === e.from)!;
  const b = m.nodes.find((n) => n.id === e.to)!;
  const r = checkLink(a, b, e.polarity);
  if (r.check === 'match' && r.link && e.basis !== 'override') return { ...e, basis: 'evidence', check: 'match', link: r.link.id, evidence: [...r.link.refs], override_reason: null, override_at: null };
  if (e.basis === 'override' && e.override_reason && !isEmpty(e.override_reason)) return { ...e, check: r.check, link: r.check === 'match' ? e.link : null, override_at: e.override_at ?? today() };
  throw new ModelError(`This link is not backed by evidence (${r.message}) It needs a confirmed override with a reason.`);
}
export function deleteEdges(m: SdohMap, ids: string[]): SdohMap {
  const s = new Set(ids);
  return touch({ ...m, edges: m.edges.filter((e) => !s.has(e.id)) });
}
export function setPositions(m: SdohMap, pos: Record<string, { x: number; y: number }>, pin?: boolean): SdohMap {
  return touch({ ...m, nodes: m.nodes.map((n) => (pos[n.id] ? { ...n, ...pos[n.id], pinned: pin ?? n.pinned } : n)) });
}
export function renameLoop(m: SdohMap, key: string, name: string, members: string[]): SdohMap {
  const rest = m.loops.filter((l) => l.id !== key);
  return touch({ ...m, loops: name.trim() ? [...rest, { id: key, name: name.trim(), members }] : rest });
}

/** The analysis graph: circumstances only (canvas notes excluded). */
export function toGraph(m: SdohMap): AGraph {
  const ids = new Set(m.nodes.filter((n) => n.kind !== 'note').map((n) => n.id));
  return {
    nodes: m.nodes.filter((n) => ids.has(n.id)).map((n) => ({ id: n.id })),
    edges: m.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ id: e.id, from: e.from, to: e.to, polarity: e.polarity, weight: e.weight })),
  };
}

// ───────────────────────── normalise / migrate (ACTION-SPEC §4)
export class ImportError extends Error {}

/**
 * Bring any stored or imported document to the current schema. Unknown fields are kept (never silently dropped);
 * rich text is sanitised; a newer schema_version is refused with a clear message.
 */
export function migrate(input: unknown): SdohMap {
  if (!input || typeof input !== 'object') throw new ImportError('This file is not an SDOH Loops map.');
  const raw = input as Record<string, unknown>;
  const v = raw.schema_version;
  if (typeof v !== 'number') throw new ImportError('This file has no schema_version, so it was not made by SDOH Loops. Nothing was imported.');
  if (v > SCHEMA_VERSION) throw new ImportError(`This map was made by a newer version of SDOH Loops (schema ${v}; this app reads up to ${SCHEMA_VERSION}). Nothing was imported.`);
  if (v < 1) throw new ImportError(`Schema ${v} is older than any released SDOH Loops map, and no migration exists for it. Nothing was imported.`);
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new ImportError('This map file is missing its nodes or edges. Nothing was imported.');
  const statuses = new Set(CODE_STATUSES);
  const nodes: MapNode[] = (raw.nodes as Record<string, unknown>[]).map((n, i) => {
    if (typeof n?.id !== 'string') throw new ImportError(`Node ${i + 1} has no id. Nothing was imported.`);
    const status = statuses.has(n.code_status as CodeStatus) ? (n.code_status as CodeStatus) : 'undetermined';
    return {
      ...n,
      id: n.id,
      kind: n.kind === 'note' ? 'note' : 'circumstance',
      code_status: status,
      code: status === 'sdoh' && typeof n.code === 'string' ? n.code : null,
      type: status === 'other' && OTHER_TYPES.includes(n.type as OtherType) ? (n.type as OtherType) : null,
      ref: status === 'other' && typeof n.ref === 'string' ? n.ref : null,
      label: sanitizeRich(n.label),
      circumstance: sanitizeRich(n.circumstance),
      severity: [0, 1, 2, 3].includes(n.severity as number) ? (n.severity as 0 | 1 | 2 | 3) : null,
      since: typeof n.since === 'string' ? n.since : null,
      notes: sanitizeRich(n.notes),
      style: typeof n.style === 'object' && n.style ? (n.style as MapNode['style']) : {},
      pinned: !!n.pinned,
      x: Number.isFinite(n.x) ? (n.x as number) : 0,
      y: Number.isFinite(n.y) ? (n.y as number) : 0,
      created: typeof n.created === 'string' ? n.created : now(),
      updated: typeof n.updated === 'string' ? n.updated : now(),
    };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges: MapEdge[] = (raw.edges as Record<string, unknown>[]).map((e, i) => {
    const polarity: Polarity = e.polarity === '+' ? '+' : e.polarity === '−' || e.polarity === '-' ? '−' : (() => { throw new ImportError(`Link ${i + 1} has no polarity (+ or −). Nothing was imported.`); })();
    const edge: MapEdge = {
      ...e,
      id: typeof e.id === 'string' ? e.id : newId('e'),
      from: String(e.from),
      to: String(e.to),
      polarity,
      weight: Number(e.weight),
      delay: !!e.delay,
      confidence: CONFIDENCES.includes(e.confidence as Confidence) ? (e.confidence as Confidence) : 'medium',
      description: sanitizeRich(e.description),
      evidence: Array.isArray(e.evidence) ? (e.evidence as unknown[]).filter((x): x is number => Number.isInteger(x)) : [],
      link: typeof e.link === 'string' ? e.link : null,
      basis: v >= 2 && ['evidence', 'override', 'needs-review'].includes(e.basis as string) ? (e.basis as MapEdge['basis']) : 'evidence',
      check: typeof e.check === 'string' ? e.check : '',
      override_reason: e.override_reason ? sanitizeRich(e.override_reason) : null,
      override_at: typeof e.override_at === 'string' ? e.override_at : null,
      style: typeof e.style === 'object' && e.style ? (e.style as MapEdge['style']) : { line: 'solid', route: 'curved', widthByWeight: true },
    };
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new ImportError(`Link ${i + 1} points to a circumstance that is not in the file. Nothing was imported.`);
    const err = edgeError(edge);
    if (err) throw new ImportError(`Link ${i + 1}: ${err} Nothing was imported.`);
    return edge;
  });
  // UI-18 on load and import: every edge is re-checked against the current pack. A v1 edge (no basis) is treated as
  // claiming evidence, so it either matches or becomes needs-review; an override without a reason also needs review.
  const checked = edges.map((e) => {
    const r = recheckEdge({ nodes }, e);
    if (r.basis === 'override' && (!r.override_reason || isEmpty(r.override_reason))) return { ...r, basis: 'needs-review' as const };
    return r;
  });
  const layout = (raw.layout ?? {}) as Partial<SdohMap['layout']>;
  // SL26: schema 3's notebook block, sanitized; schema 1 and 2 files have none and open unchanged
  const notebook = sanitizeNotebook(raw.notebook);
  const out: SdohMap = {
    ...raw,
    schema_version: SCHEMA_VERSION,
    pack_version: typeof raw.pack_version === 'string' ? raw.pack_version : PACK_VERSION,
    icd11_release: typeof raw.icd11_release === 'string' ? raw.icd11_release : ICD11_RELEASE,
    id: typeof raw.id === 'string' ? raw.id : newId('map'),
    name: typeof raw.name === 'string' ? raw.name : 'Imported map',
    subject: typeof raw.subject === 'string' ? raw.subject : '',
    created: typeof raw.created === 'string' ? raw.created : now(),
    updated: typeof raw.updated === 'string' ? raw.updated : now(),
    layout: {
      engine: layout.engine === 'elk-stress' ? 'elk-stress' : 'fcose',
      theme: layout.theme === 'print' ? 'print' : 'auto',
      thickness: layout.thickness !== false,
      ...(layout.nodeText && NODE_TEXTS.includes(layout.nodeText) ? { nodeText: layout.nodeText } : {}),
    },
    notes: sanitizeRich(raw.notes),
    nodes,
    edges: checked,
    loops: Array.isArray(raw.loops) ? (raw.loops as MapLoopName[]).filter((l) => typeof l?.id === 'string' && typeof l?.name === 'string') : [],
  };
  if (notebook) out.notebook = notebook;
  else delete out.notebook;
  return out;
}

/** SL26: true when the map carries a notebook with at least one note. */
export function hasNotebook(m: Pick<SdohMap, 'notebook'>): boolean {
  return !!m.notebook?.notes.length;
}
/**
 * SL26: the map without its notebook, as a schema 2 document — what "Export the map without the notebook" writes, and
 * what every export of a map with no notes writes, so released 0.4.x cores (which refuse schema 3) still open it.
 */
export function withoutNotebook(m: SdohMap): SdohMap {
  const { notebook: _drop, ...rest } = m;
  return { ...rest, schema_version: SCHEMA_NO_NOTEBOOK } as SdohMap;
}
