import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { S } from './lib/data/core';
import { codeMap, codesUnder, type Link as PackLink } from './lib/data/scheme';
import { pinMismatch, type PackPin } from './lib/data/pack';
import { C } from './lib/copy';
import { USER_COLOURS } from './lib/palette';
import { useTheme } from './lib/theme';
import { useCoarsePointer, useWideViewport } from './lib/pointer';
import { count } from './lib/plural';
import { setViewPref, viewPref, withOriginals, type MapStore } from './lib/storage';
import { useMapDoc } from './components/map/useMapDoc';
import { addEdge, addNode, deleteEdges, deleteNodes, newEdge, newNode, renameLoop, setPositions, toGraph, updateEdge, updateNode, type MapEdge, type MapNode, type SdohMap as SdohMapDoc } from './lib/model/map';
import { emptyDoc, plainText } from './lib/model/rich';
import { feedbackClusters, neighbourhood, findLoops, DEFAULT_WEIGHT, type Loop } from './lib/analysis';
import { assignLoopNames } from './lib/model/interchange';
import { evidenceCanCloseALoop, checkLink } from './lib/model/evidence';
import { LinkForm, BasisPanel } from './components/map/LinkForm';
import { nodeName } from './lib/model/interchange';
import { Dialog } from './components/ui/Dialog';
import { NodeFields, EdgeFields, type NodeDraft } from './components/map/Forms';
import { AssociationMenu, type FollowRequest } from './components/map/AssociationMenu';
import { CodePopout } from './components/map/CodePopout';
import { CitedText } from './components/evidence/CitedText';
import { RefCard } from './components/evidence/RefCard';
import { LoopsPanel, LinksPanel, PathsPanel, LeveragePanel, PulsePanel, ToCodePanel, ClustersPanel, LegendPanel, nameOf } from './components/map/Panels';
import { MapDetails } from './components/map/MapDetails';
import { ListView } from './components/map/ListView';
import type { CanvasHandle, Highlight, PeekRequest } from './components/map/Canvas';
import { Peek, type PeekTarget } from './components/map/Peek';
import { links as packLinks } from './lib/data/scheme';

const Canvas = lazy(() => import('./components/map/Canvas'));
const titleOf = (c: string) => codeMap.get(c)?.title;
export const PANELS = ['inspect', 'loops', 'links', 'paths', 'leverage', 'pulse', 'tocode', 'clusters', 'legend', 'map'] as const;
export type Panel = (typeof PANELS)[number];
export type MapView = 'canvas' | 'list';
export interface Selection {
  nodes: string[];
  edges: string[];
}
export type { PeekTarget };
/** SL17: a host's card in the side dock, below the core's editor; `render` gets the current selection */
export interface SideCard {
  id: string;
  title: string;
  render: (selection: Selection) => ReactNode;
}
const NO_SELECTION: Selection = { nodes: [], edges: [] };
const sameSelection = (a: Selection, b: Selection) => a.nodes.join('\n') === b.nodes.join('\n') && a.edges.join('\n') === b.edges.join('\n');

export interface NewNodeReq {
  pos?: { x: number; y: number };
  follow?: { anchor: string; link: PackLink | null; direction: 'out' | 'in' };
  kind?: 'note';
}

export interface SdohMapProps {
  /** a map id in `storage`, or a built map, which opens as a read-only original: the first edit saves a copy */
  map: string | SdohMapDoc;
  /** the pin.json of the content pack this app pins; the map does not open when the loaded pack differs */
  pack: PackPin;
  /** where maps live: browserStore(slug), optionally wrapped in withOriginals() */
  storage: MapStore;
  /**
   * SL16: the selection, controlled — the map shows it, and asks for changes through onSelectionChange; uncontrolled
   * when left out. Ids that are not on the map (or are hidden by hideNode) are ignored.
   */
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
  /**
   * SL16: circumstances (and notes) this returns true for are left out of the canvas, the list view and every analysis,
   * with their links; they stay in the map, its edits and its file exports. Change it to show or hide them.
   */
  hideNode?: (node: MapNode) => boolean;
  /** SL17: the host's cards in the side dock, stacked below the core's editor */
  sideCards?: SideCard[];
  /** SL17: the host's own lines in the peek, below the core's */
  renderPeek?: (target: PeekTarget) => ReactNode;
  /** after every change; `copiedFrom` is set when this change forked a copy of a read-only original */
  onMapChange?: (map: SdohMapDoc, info: { copiedFrom?: string }) => void;
  /** once the map has loaded (null when it is not in `storage`) */
  onLoad?: (map: SdohMapDoc | null) => void;
  /** after an import in the map panel saved a new map */
  onOpenMap?: (id: string) => void;
  /** canvas or list; uncontrolled when left out */
  view?: MapView;
  onViewChange?: (view: MapView) => void;
  /** the href of the view switch, for a consumer that routes views by URL */
  viewHref?: (view: MapView, id: string) => string;
  /** the side-panel tab; uncontrolled when left out */
  panel?: Panel;
  onPanelChange?: (panel: Panel) => void;
  /** shown when the map is not in `storage` */
  missing?: ReactNode;
}

/**
 * K13: the SDOH Loops map as one component — canvas and list view, association menu, Link to… with the evidence gate
 * and overrides, the side-panel tabs and analyses A1–A8, greyscale, keyboard, exports and import. The standalone app's
 * /map is this component; an SDOH Interrogator app embeds the same one.
 */
export function SdohMap(props: SdohMapProps) {
  const { map: mapProp, pack, onLoad } = props;
  const original = typeof mapProp === 'string' ? null : mapProp;
  const id = typeof mapProp === 'string' ? mapProp : mapProp.id;
  // keyed on the id, not the object: a consumer that rebuilds the same original each render keeps one store
  const storage = useMemo(() => (original ? withOriginals(props.storage, [original]) : props.storage), [props.storage, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ev = useRef(props);
  ev.current = props;
  const events = useMemo(
    () => ({
      onChange: (m: SdohMapDoc) => ev.current.onMapChange?.(m, {}),
      onCopy: (m: SdohMapDoc, from: string) => ev.current.onMapChange?.(m, { copiedFrom: from }),
    }),
    [],
  );
  const pinError = pinMismatch(pack);
  const doc = useMapDoc(pinError ? null : id, storage, events);
  useEffect(() => {
    if (doc.status !== 'loading') onLoad?.(doc.map);
  }, [doc.status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (pinError) return <p className="bx-banner" role="alert" data-testid="pack-pin-error">{pinError}</p>;
  if (doc.status === 'loading') return <p role="status" className="bx-muted">Loading the map…</p>;
  if (doc.status === 'missing' || !doc.map) return <>{props.missing ?? <p className="bx-banner" role="alert">That map is not in this browser.</p>}</>;
  // keyed on the id that was opened, so forking a read-only original keeps the workspace (and its selection) in place
  return <MapWorkspace key={id} doc={doc} {...props} storage={storage} />;
}

function MapWorkspace({ doc, storage, ...props }: SdohMapProps & { doc: ReturnType<typeof useMapDoc> }) {
  const full = doc.map!;
  const { apply } = doc;
  // SL16: what the map shows — the document less the circumstances hideNode hides and their links. Edits still go to
  // the whole document (apply), so a hidden circumstance is never lost. Keyed on the hidden ids, so a predicate the host
  // writes inline does not rebuild the canvas on every render.
  const hiddenIds = props.hideNode ? full.nodes.filter((n) => props.hideNode!(n)).map((n) => n.id) : [];
  const hiddenKey = hiddenIds.join('\n');
  const map = useMemo(() => {
    if (!hiddenKey) return full;
    const gone = new Set(hiddenKey.split('\n'));
    return { ...full, nodes: full.nodes.filter((n) => !gone.has(n.id)), edges: full.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)) };
  }, [full, hiddenKey]);
  const { theme, reducedMotion } = useTheme();
  const canvas = useRef<CanvasHandle>(null);
  const [ownView, setOwnView] = useState<MapView>('canvas');
  const view = props.view ?? ownView;
  const otherView: MapView = view === 'canvas' ? 'list' : 'canvas';
  const switchView = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (props.onViewChange) props.onViewChange(otherView);
    else setOwnView(otherView);
  };
  const [ownPanel, setOwnPanel] = useState<Panel>('inspect');
  const panel = props.panel ?? ownPanel;
  const setPanel = (p: Panel) => {
    if (props.onPanelChange) props.onPanelChange(p);
    else setOwnPanel(p);
  };
  // SL16: the selection is the host's when it passes `selection`, else the workspace's own; either way a change is
  // reported once through onSelectionChange, and never when nothing changed
  const controlled = props.selection !== undefined;
  const [ownSel, setOwnSel] = useState<Selection>(NO_SELECTION);
  const rawSel = props.selection ?? ownSel;
  const selected = useMemo(() => {
    const ok = (ids: string[], has: (id: string) => boolean) => ids.every(has) ? ids : ids.filter(has);
    const nodes = ok(rawSel.nodes, (id) => map.nodes.some((n) => n.id === id));
    const edges = ok(rawSel.edges, (id) => map.edges.some((e) => e.id === id));
    return nodes === rawSel.nodes && edges === rawSel.edges ? rawSel : { nodes, edges };
  }, [rawSel, map]);
  const onSel = useRef(props.onSelectionChange);
  onSel.current = props.onSelectionChange;
  const emitted = useRef<Selection>(selected);
  // the canvas reports a click as one select and one unselect: the second report, before the host has re-rendered, is the same change
  const unrendered = useRef<Selection | null>(null);
  useEffect(() => {
    unrendered.current = null;
  });
  const setSelected = (s: Selection) => {
    if (sameSelection(s, selected) || (unrendered.current && sameSelection(s, unrendered.current))) return;
    unrendered.current = s;
    emitted.current = s;
    if (!controlled) setOwnSel(s);
    onSel.current?.(s);
  };
  // a selection the host set (not one this map reported) is brought into view
  useEffect(() => {
    if (!controlled || sameSelection(selected, emitted.current)) return;
    emitted.current = selected;
    if (view === 'canvas' && selected.nodes.length) canvas.current?.reveal(selected.nodes);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeLoop, setActiveLoop] = useState<string | null>(null);
  const [hood, setHood] = useState<{ id: string; hops: 1 | 2 } | null>(null);
  const [pathHl, setPathHl] = useState<{ nodes: string[]; edges: string[] } | null>(null);
  const [hulls, setHulls] = useState(false);
  const [newNodeReq, setNewNodeReq] = useState<NewNodeReq | null>(null);
  const [linkReq, setLinkReq] = useState<{ from: string | null; to: string | null } | null>(null);
  const openLink = (from: string | null, to: string | null = null) => setLinkReq({ from, to });
  // w2 walk: a just-added link is the selection, so From carries on from that link's source, not the map's first node
  const linkFrom = () => selected.nodes[0] ?? (selected.edges.length === 1 ? map.edges.find((e) => e.id === selected.edges[0])?.from ?? null : null);
  const [evidenceOnly, setEvidenceOnly] = useState(false);
  // A0: the evidence filter — every analysis runs on evidence-backed links only when the toggle is on
  const basisOf = useMemo(() => new Map(map.edges.map((e) => [e.id, e.basis])), [map.edges]);
  // SL16: with circumstances hidden, the analyses run on what is shown
  const shownGraph = useMemo(() => (map === full ? doc.graph : toGraph(map)), [map, full, doc.graph]);
  const graph = useMemo(() => (evidenceOnly ? { nodes: shownGraph.nodes, edges: shownGraph.edges.filter((e) => basisOf.get(e.id) === 'evidence') } : shownGraph), [evidenceOnly, shownGraph, basisOf]);
  const loops = useMemo(() => (graph === doc.graph ? doc.loops : findLoops(graph)), [graph, doc.graph, doc.loops]);
  const loopNames = useMemo(() => {
    if (loops === doc.loops) return doc.loopNames;
    // the evidence-only (or shown-only) loops are a subset, keyed the same way: their stored names carry over (K6 D4)
    const d = assignLoopNames(full.loops, loops).names;
    for (const [k, v] of doc.loopNames) if (d.has(k)) d.set(k, v);
    return d;
  }, [loops, doc.loops, doc.loopNames, full.loops]);
  const overrides = (l: Loop) => l.edges.filter((id) => basisOf.get(id) !== 'evidence').length;
  const counts = { all: map.edges.length, evidence: map.edges.filter((e) => e.basis === 'evidence').length, review: map.edges.filter((e) => e.basis === 'needs-review').length };
  const [assocFor, setAssocFor] = useState<string | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const coarse = useCoarsePointer();
  /** K4 D10: on a phone the secondary tools sit behind "More" (always shown from the sm breakpoint up) */
  const [toolsOpen, setToolsOpen] = useState(false);
  const sec = toolsOpen ? '' : 'max-sm:hidden';
  const [engine, setEngine] = useState<'fcose' | 'elk-stress'>(map.layout.engine);
  const [live, setLive] = useState('');
  const [error, setError] = useState<string | null>(null);
  const announce = useCallback((s: string) => setLive((p) => (p === s ? s + ' ' : s)), []);
  const nm = useMemo(() => nameOf(map), [map]);
  const byId = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map.nodes]);

  // ── SL17: full screen — the whole workspace (toolbar, canvas, dock) through the Fullscreen API, else a fixed overlay.
  // A view state only: never saved into the map.
  const ws = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState<'off' | 'api' | 'overlay'>('off');
  const fsWait = useRef(0);
  const enterFs = () => {
    const el = ws.current;
    if (!el?.requestFullscreen || !document.fullscreenEnabled) return setFs('overlay');
    // fullscreenchange says when it took; refused (an iframe, a policy) or no answer within 800 ms, the overlay instead
    el.requestFullscreen().catch(() => setFs((f) => (f === 'api' ? f : 'overlay')));
    clearTimeout(fsWait.current);
    fsWait.current = window.setTimeout(() => setFs((f) => (f === 'off' && document.fullscreenElement !== el ? 'overlay' : f)), 800);
  };
  const exitFs = () => {
    clearTimeout(fsWait.current);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    setFs('off');
  };
  const toggleFs = () => (fs === 'off' ? enterFs() : exitFs());
  useEffect(() => {
    // the Fullscreen API took, or the browser's own Esc (or F11) left it without us
    const on = () => setFs((f) => (document.fullscreenElement && document.fullscreenElement === ws.current ? 'api' : f === 'api' ? 'off' : f));
    document.addEventListener('fullscreenchange', on);
    return () => {
      clearTimeout(fsWait.current);
      document.removeEventListener('fullscreenchange', on);
      if (document.fullscreenElement && document.fullscreenElement === ws.current) document.exitFullscreen().catch(() => undefined);
    };
  }, []);
  const fsFirst = useRef(true);
  useEffect(() => {
    if (fsFirst.current) {
      fsFirst.current = false;
      return;
    }
    // the canvas refits once the layout has settled at its new size
    const t = setTimeout(() => canvas.current?.refit(), 80);
    announce(fs === 'off' ? 'Left full screen.' : 'Full screen. Press Esc to leave.');
    return () => clearTimeout(t);
  }, [fs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SL17: the side dock — the core's editor card, then the host's cards; each collapses, and from lg up the whole dock
  // collapses to a rail. Per-viewer browser storage under the store's slug; never saved into the map.
  const wide = useWideViewport();
  const dockId = `dock-${useId().replace(/:/g, '')}`;
  const [dock, setDock] = useState<{ open: boolean; closed: string[] }>(() => {
    try {
      const v = JSON.parse(viewPref(storage, 'dock') ?? 'null');
      if (v && typeof v.open === 'boolean' && Array.isArray(v.closed)) return { open: v.open, closed: v.closed.filter((x: unknown) => typeof x === 'string') };
    } catch {
      /* unreadable: the defaults */
    }
    return { open: true, closed: [] };
  });
  const saveDock = (d: typeof dock) => {
    setDock(d);
    setViewPref(storage, 'dock', JSON.stringify(d));
  };
  const dockOpen = dock.open || !wide;
  const setDockOpen = (open: boolean) => {
    saveDock({ ...dock, open });
    announce(open ? 'Side panels shown.' : 'Side panels hidden; the canvas has the full width.');
  };
  const setCardOpen = (id: string, open: boolean, alsoDock = false) => saveDock({ open: alsoDock ? true : dock.open, closed: open ? dock.closed.filter((x) => x !== id) : [...new Set([...dock.closed, id])] });
  const cardOpen = (id: string) => !dock.closed.includes(id);

  // ── SL17: the peek
  const [peek, setPeek] = useState<(PeekRequest & { keyboard: boolean }) | null>(null);
  const peekTarget: PeekTarget | null = peek
    ? peek.kind === 'node'
      ? byId.has(peek.id) ? { kind: 'node', node: byId.get(peek.id)! } : null
      : (() => {
          const e = map.edges.find((x) => x.id === peek.id);
          return e ? { kind: 'edge' as const, edge: e } : null;
        })()
    : null;
  const peekSelection = () => {
    const one = selected.nodes.length + selected.edges.length === 1 ? selected.nodes[0] ?? selected.edges[0] : null;
    const at = one ? canvas.current?.where(one) : null;
    if (!one || !at) return false;
    setPeek({ kind: selected.nodes.length ? 'node' : 'edge', id: one, ...at, keyboard: true });
    return true;
  };

  // analysis announcements (DESIGN-SYSTEM §2: live regions for analysis results)
  const loopCount = `${loops.loops.length}:${loops.loops.filter((l) => l.kind === 'R').length}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const R = loops.loops.filter((l) => l.kind === 'R').length;
    const B = loops.loops.length - R;
    announce(`${loops.loops.length} ${loops.loops.length === 1 ? 'loop' : 'loops'} found: ${R} ${S.loops.reinforcing.toLowerCase()}, ${B} ${S.loops.balancing.toLowerCase()}.`);
  }, [loopCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const describeEdge = useCallback(
    (e: MapEdge) =>
      `Link: ${nm(e.from)} to ${nm(e.to)}, polarity ${e.polarity === '+' ? 'plus' : 'minus'}, weight ${e.weight}${e.delay ? ', with delay' : ''}` +
      (e.basis === 'evidence' ? `, evidence ${e.link}, cites ${e.evidence.map((n) => `[${n}]`).join(' ')}` : e.basis === 'override' ? `, override ⚑ (${e.check}): ${plainText(e.override_reason)}` : `, needs review ⚑ (${e.check})`),
    [nm],
  );
  const edgeTip = useCallback(
    (e: MapEdge) => {
      if (e.basis === 'evidence') return null;
      if (e.basis === 'override') return `⚑ ${C.evidence.legend}. ${C.evidence.overrideReason} ${plainText(e.override_reason)}`;
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      return `⚑ ${C.evidence.legendReview}. ${a && b ? checkLink(a, b, e.polarity).message : ''}`;
    },
    [byId],
  );

  const highlight: Highlight | null = useMemo(() => {
    if (activeLoop) {
      const l = loops.loops.find((x) => x.key === activeLoop);
      if (l) return { nodes: new Set(l.nodes), edges: new Set(l.edges) };
    }
    if (pathHl) return { nodes: new Set(pathHl.nodes), edges: new Set(pathHl.edges) };
    if (hood && byId.has(hood.id)) {
      const h = neighbourhood(graph, hood.id, hood.hops);
      return { nodes: new Set([hood.id]), edges: new Set([...h.edgesOut, ...h.edgesIn]), out: new Set(h.out), in: new Set(h.in.filter((x) => !h.out.includes(x))) };
    }
    return null;
  }, [activeLoop, pathHl, hood, loops, graph, byId]);

  const clearHighlights = () => {
    setActiveLoop(null);
    setHood(null);
    setPathHl(null);
  };
  const selectNode = (id: string) => {
    setSelected({ nodes: [id], edges: [] });
    setPanel('inspect');
  };
  const pickLoop = (l: Loop | null) => {
    setPathHl(null);
    setHood(null);
    setActiveLoop(l?.key ?? null);
    // K6 D3: show the whole loop, with padding, never zoomed past Fit's cap
    if (l && view === 'canvas') canvas.current?.fitTo(l.nodes);
    if (l) announce(`Highlighting loop ${loopNames.get(l.key)}: ${l.kind === 'R' ? S.loops.reinforcing : S.loops.balancing}, ${count(l.length, 'circumstance')}. Everything else is dimmed.`);
  };

  // ── actions
  const nextPos = (anchor?: MapNode, dir: 'out' | 'in' = 'out') => {
    if (anchor) {
      const k = map.edges.filter((e) => (dir === 'out' ? e.from : e.to) === anchor.id).length;
      return { x: anchor.x + (dir === 'out' ? 240 : -240), y: anchor.y + k * 90 - 40 };
    }
    const i = map.nodes.length;
    return { x: (i % 4) * 240, y: Math.floor(i / 4) * 150 };
  };
  const createNode = (draft: NodeDraft, req: NewNodeReq) => {
    const anchor = req.follow ? byId.get(req.follow.anchor) : undefined;
    const dir = req.follow?.link ? req.follow.direction : 'out';
    const pos = req.pos ?? nextPos(anchor, dir);
    const n = newNode({ ...draft, ...pos });
    let edge: MapEdge | null = null;
    const l = req.follow?.link ?? null;
    if (anchor && l) edge = newEdge({ from: dir === 'out' ? anchor.id : n.id, to: dir === 'out' ? n.id : anchor.id, polarity: l.polarity, weight: (l.polarity === '+' ? 1 : -1) * DEFAULT_WEIGHT, evidence: [...l.refs], link: l.id, basis: 'evidence' });
    apply((m) => {
      let next = addNode(m, n);
      if (edge) next = addEdge(next, edge);
      return next;
    });
    setSelected({ nodes: [n.id], edges: [] });
    setNewNodeReq(null);
    setAssocFor(null);
    announce(`Added ${nodeName(n, titleOf)}${edge ? `, linked ${edge.polarity === '+' ? 'plus' : 'minus'} ${edge.from === n.id ? 'to' : 'from'} ${nm(anchor!.id)}` : ''}.`);
    // "add a new circumstance and link it yourself": the link goes through the checked link form
    if (anchor && !l) openLink(anchor.id, n.id);
  };
  /** UI-17 via the association menu: an evidence link between two circumstances already on the map. */
  const linkExisting = (anchor: string, existing: string, l: PackLink, dir: 'out' | 'in') => {
    const edge = newEdge({ from: dir === 'out' ? anchor : existing, to: dir === 'out' ? existing : anchor, polarity: l.polarity, weight: (l.polarity === '+' ? 1 : -1) * DEFAULT_WEIGHT, evidence: [...l.refs], link: l.id, basis: 'evidence' });
    apply((m) => addEdge(m, edge));
    setAssocFor(null);
    setSelected({ nodes: [], edges: [edge.id] });
    announce(`Linked ${nm(edge.from)} to ${nm(edge.to)} with evidence link ${l.id}.`);
  };
  const removeSelection = () => {
    if (!selected.nodes.length && !selected.edges.length) return;
    apply((m) => deleteEdges(deleteNodes(m, selected.nodes), selected.edges));
    announce(`Deleted ${selected.nodes.length} circumstance(s) and ${selected.edges.length} link(s).`);
    setSelected({ nodes: [], edges: [] });
  };
  const togglePin = () => {
    if (!selected.nodes.length) return;
    const pin = !selected.nodes.every((id) => byId.get(id)?.pinned);
    apply((m) => selected.nodes.reduce((acc, id) => updateNode(acc, id, { pinned: pin }), m));
    announce(pin ? 'Pinned.' : 'Unpinned.');
  };
  const arrange = (scope: 'unpinned' | 'all' | 'selection') => {
    canvas.current?.layout(scope, engine);
    announce(scope === 'selection' ? 'Arranging the selection.' : 'Arranging the map.');
  };
  const openAssoc = (id?: string) => {
    const target = id ?? selected.nodes[0];
    if (!target || byId.get(target)?.kind === 'note') return;
    setSelected({ nodes: [target], edges: [] });
    setAssocFor(target);
  };
  const moveSelected = (dx: number, dy: number) => {
    const pos: Record<string, { x: number; y: number }> = {};
    for (const id of selected.nodes) {
      const n = byId.get(id);
      if (n) pos[id] = { x: n.x + dx, y: n.y + dy };
    }
    apply((m) => setPositions(m, pos, true), `move:${selected.nodes.join(',')}`);
  };
  const stepSelection = (d: 1 | -1) => {
    const ns = map.nodes;
    if (!ns.length) return;
    const cur = ns.findIndex((n) => n.id === selected.nodes[0]);
    const n = ns[(cur + d + ns.length) % ns.length] ?? ns[0];
    setSelected({ nodes: [n.id], edges: [] });
    const e = map.edges.filter((x) => x.from === n.id || x.to === n.id).length;
    announce(`Selected ${nodeName(n, titleOf)}${n.code ? ` (${n.code})` : ''}, ${e} link(s). ${n.pinned ? 'Pinned.' : ''}`);
  };

  // ── keyboard map (app-requirements, "Keyboard map")
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : document.body;
      if (t.closest('input, textarea, select, [contenteditable="true"], dialog[open]') || document.querySelector('dialog[open]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doc.redo();
        else doc.undo();
        return;
      }
      if (mod || e.altKey) return;
      const onCanvas = t.closest('[data-testid="canvas-wrap"]');
      // SL17: the ContextMenu key or Shift+F10 on the canvas peeks at the selected circumstance or link
      if (onCanvas && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
        if (peekSelection()) e.preventDefault();
        return;
      }
      switch (e.key) {
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFs();
          break;
        case ']':
          if (wide) setDockOpen(!dock.open);
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          setNewNodeReq({});
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          openLink(linkFrom());
          break;
        case 'a':
        case 'A':
          if (selected.nodes.length) {
            e.preventDefault();
            openAssoc();
          }
          break;
        case '1':
        case '2':
          if (selected.nodes.length) {
            const hops = e.key === '1' ? 1 : 2;
            setActiveLoop(null);
            setPathHl(null);
            setHood((h) => (h && h.id === selected.nodes[0] && h.hops === hops ? null : { id: selected.nodes[0], hops }));
            announce(`${hops === 1 ? '1st' : '2nd'}-degree neighbourhood of ${nm(selected.nodes[0])}: outgoing and incoming shown in separate tints.`);
          }
          break;
        case 'l':
        case 'L':
          setPanel('loops');
          break;
        case 'r':
        case 'R':
          if (view === 'canvas') arrange('unpinned');
          break;
        case 'p':
        case 'P':
          togglePin();
          break;
        case 'Delete':
        case 'Backspace':
          if (selected.nodes.length || selected.edges.length) {
            e.preventDefault();
            removeSelection();
          }
          break;
        case '?':
          setKeysOpen(true);
          break;
        case 'Escape':
          // SL17: Esc closes the peek first, then leaves full screen, then clears the selection
          if (peek) setPeek(null);
          else if (fs !== 'off') exitFs(); // the browser usually takes Esc itself under the Fullscreen API
          else {
            setSelected({ nodes: [], edges: [] });
            clearHighlights();
          }
          break;
        case 'Enter':
          if (onCanvas && selected.nodes.length) {
            e.preventDefault();
            setPanel('inspect');
            setTimeout(() => (document.querySelector('[data-testid="inspector"] [contenteditable], [data-testid="inspector"] input, [data-testid="inspector"] button') as HTMLElement | null)?.focus(), 30);
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowUp':
          if (!onCanvas) break;
          e.preventDefault();
          if (e.shiftKey && selected.nodes.length) {
            const d = 20;
            moveSelected(e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0, e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0);
          } else stepSelection(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── exports
  const download = (name: string, data: string | Blob, type: string) => {
    const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const selNode = selected.nodes.length === 1 && !selected.edges.length ? byId.get(selected.nodes[0]) : undefined;
  const selEdge = selected.edges.length === 1 && !selected.nodes.length ? map.edges.find((e) => e.id === selected.edges[0]) : undefined;
  const clusters = useMemo(() => (hulls ? feedbackClusters(graph) : null), [hulls, graph]);

  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 no-print" role="toolbar" aria-label="Map tools" data-testid="toolbar">
      <span className="mr-1 font-display text-lg font-semibold" data-testid="map-name">{map.name}</span>
      <span className="mr-1 text-sm bx-muted" data-testid="link-counts">
        {counts.all} {counts.all === 1 ? 'link' : 'links'}: {counts.evidence} evidence · {counts.all - counts.evidence} override{counts.review ? ` (${counts.review} to review)` : ''}
      </span>
      <button type="button" className="bx-btn-primary ax-tap" onClick={() => setNewNodeReq({})} data-testid="add-node" aria-keyshortcuts="N">{C.toolbar.addNode}</button>
      <button type="button" className="bx-btn ax-tap" onClick={() => openLink(linkFrom())} disabled={map.nodes.length < 2} data-testid="add-edge" aria-keyshortcuts="E">{C.toolbar.addEdge}</button>
      <button type="button" className="bx-btn ax-tap" onClick={() => openAssoc()} disabled={!selNode || selNode.kind === 'note'} data-testid="open-assoc" aria-keyshortcuts="A">{C.toolbar.assoc}</button>
      <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => setNewNodeReq({ kind: 'note' })}>{C.node.addNote}</button>
      {view === 'canvas' && (
        <>
          <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => arrange('unpinned')} disabled={!map.nodes.length} data-testid="arrange" aria-keyshortcuts="R">{C.toolbar.arrange}</button>
          <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => arrange('all')} disabled={!map.nodes.length}>{C.toolbar.arrangeAll}</button>
          <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => arrange('selection')} disabled={selected.nodes.length < 2}>{C.toolbar.arrangeSel}</button>
          <label className={`inline-flex items-center gap-1 text-sm ${sec}`}>
            <span className="sr-only">{C.toolbar.engine}</span>
            <select className="bx-input ax-tap w-auto" value={engine} onChange={(e) => { const v = e.target.value as 'fcose'; setEngine(v); apply((m) => ({ ...m, layout: { ...m.layout, engine: v } })); }} aria-label={C.toolbar.engine}>
              <option value="fcose">fCoSE (default)</option>
              <option value="elk-stress">ELK stress</option>
            </select>
          </label>
        </>
      )}
      <button type="button" className="bx-btn ax-tap" onClick={doc.undo} disabled={!doc.canUndo} aria-keyshortcuts="Meta+Z" data-testid="undo">{C.toolbar.undo}</button>
      <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={doc.redo} disabled={!doc.canRedo} aria-keyshortcuts="Meta+Shift+Z">{C.toolbar.redo}</button>
      <button type="button" className={`bx-btn ax-tap ${sec} ${hood?.hops === 1 ? 'bx-btn-on' : ''}`} disabled={!selNode} aria-pressed={hood?.hops === 1} onClick={() => { setActiveLoop(null); setPathHl(null); setHood(hood?.hops === 1 ? null : { id: selNode!.id, hops: 1 }); }} aria-keyshortcuts="1">{C.toolbar.hood1}</button>
      <button type="button" className={`bx-btn ax-tap ${sec} ${hood?.hops === 2 ? 'bx-btn-on' : ''}`} disabled={!selNode} aria-pressed={hood?.hops === 2} onClick={() => { setActiveLoop(null); setPathHl(null); setHood(hood?.hops === 2 ? null : { id: selNode!.id, hops: 2 }); }} aria-keyshortcuts="2">{C.toolbar.hood2}</button>
      {view === 'canvas' && (
        <>
          <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => canvas.current?.fit()}>{C.toolbar.fit}</button>
          <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => canvas.current?.zoom(1.25)} aria-label="Zoom in">＋</button>
          <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => canvas.current?.zoom(0.8)} aria-label="Zoom out">－</button>
          <button type="button" className={`bx-btn ax-tap ${sec} ${map.layout.theme === 'print' ? 'bx-btn-on' : ''}`} aria-pressed={map.layout.theme === 'print'} onClick={() => apply((m) => ({ ...m, layout: { ...m.layout, theme: m.layout.theme === 'print' ? 'auto' : 'print' } }))}>{C.toolbar.print}</button>
        </>
      )}
      <button type="button" className={`bx-btn ax-tap ${fs !== 'off' ? 'bx-btn-on' : ''}`} aria-pressed={fs !== 'off'} onClick={toggleFs} aria-keyshortcuts="F" data-testid="fullscreen">{fs !== 'off' ? C.dock.exitFullscreen : C.dock.fullscreen}</button>
      {wide && <button type="button" className="bx-btn ax-tap" aria-expanded={dock.open} aria-controls={dockId} onClick={() => setDockOpen(!dock.open)} aria-keyshortcuts="]" data-testid="dock-toggle">{dock.open ? C.dock.collapse : C.dock.expand}</button>}
      <a className="bx-btn ax-tap" href={props.viewHref?.(otherView, map.id) ?? '#'} onClick={switchView} data-testid="switch-view">{view === 'canvas' ? C.toolbar.listView : C.toolbar.canvasView}</a>
      <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => setKeysOpen(true)} aria-keyshortcuts="?">{C.toolbar.keys} <span className="bx-kbd">?</span></button>
      <button type="button" className="bx-btn ax-tap sm:hidden" aria-expanded={toolsOpen} onClick={() => setToolsOpen((o) => !o)} data-testid="toolbar-more">{C.toolbar.moreTools} {toolsOpen ? '▴' : '▾'}</button>
    </div>
  );

  const inspector = (
    <div data-testid="inspector">
      {!selNode && !selEdge && (
        <div className="text-sm bx-muted">
          {selected.nodes.length + selected.edges.length > 1 ? (
            <div>
              <p>{count(selected.nodes.length, 'circumstance')} and {count(selected.edges.length, 'link')} selected.</p>
              {selected.nodes.length > 1 && (
                // UI-12: colour override per selection (K2 decision 6)
                <label className="mt-2 block text-sm text-[color:var(--bx-ink)]">
                  <span className="mb-1 block font-semibold">{C.node.fill} ({selected.nodes.length})</span>
                  <select
                    className="bx-input ax-tap w-auto"
                    value=""
                    data-testid="selection-fill"
                    onChange={(e) => {
                      const fill = e.target.value === 'block' ? null : e.target.value;
                      apply((m) => selected.nodes.reduce((acc, id) => updateNode(acc, id, { style: { ...(acc.nodes.find((n) => n.id === id)?.style ?? {}), fill } }), m));
                      announce(`Colour set on ${count(selected.nodes.length, 'circumstance')}.`);
                    }}
                  >
                    <option value="" disabled>Choose…</option>
                    <option value="block">Block colour</option>
                    {USER_COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
              <button type="button" className="bx-btn ax-tap mt-2" onClick={removeSelection}>Delete selection</button>
            </div>
          ) : (
            // K14: the add-the-first-circumstance hint only on an empty map
            <p data-testid="inspector-empty">
              {map.nodes.length ? 'Select a circumstance or a link to edit it.' : coarse ? C.canvas.emptyTouch : C.canvas.empty}
            </p>
          )}
        </div>
      )}
      {selNode && (
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selNode.kind !== 'note' && <button type="button" className="bx-btn ax-tap" onClick={() => openAssoc(selNode.id)} data-testid="inspector-assoc">{C.assoc.open}</button>}
            {selNode.kind !== 'note' && <button type="button" className="bx-btn ax-tap" onClick={() => openLink(selNode.id)} data-testid="inspector-link-to">{C.evidence.linkTo}</button>}
            <button type="button" className="bx-btn ax-tap" onClick={togglePin}>{selNode.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" className="bx-btn ax-tap" onClick={removeSelection} data-testid="delete-node">{C.list.delete}</button>
          </div>
          <NodeFields draft={selNode} onChange={(p, key) => apply((m) => updateNode(m, selNode.id, p), key ? `n:${selNode.id}:${key}` : undefined)} />
          {selNode.code && (
            <section className="bx-card mt-3 p-3" aria-label="About this code">
              <CodePopout code={selNode.code} />
            </section>
          )}
          {selNode.code_status === 'other' && selNode.ref && <p className="mt-2 text-xs bx-muted">Reference: {selNode.ref} ({C.node.userEntered})</p>}
        </div>
      )}
      {selEdge && (
        <EdgeInspector
          edge={selEdge}
          map={map}
          nm={nm}
          onChange={(p, key) => {
            try {
              apply((m) => updateEdge(m, selEdge.id, p), key ? `e:${selEdge.id}:${key}` : undefined);
              setError(null);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
          onDelete={removeSelection}
          error={error}
        />
      )}
    </div>
  );

  const panelBody: Record<Panel, JSX.Element> = {
    inspect: inspector,
    loops: (
      <LoopsPanel
        map={map}
        result={loops}
        names={loopNames}
        overrides={overrides}
        evidenceOnly={evidenceOnly}
        emptyNote={evidenceOnly ? (evidenceCanCloseALoop() ? C.evidence.toggleOnNoneMaybe : C.evidence.toggleOnNone) : null}
        active={activeLoop}
        onPick={pickLoop}
        onRename={(l, name) => apply((m) => renameLoop(m, l.key, name, l.nodes))}
        onCircle={(l) => {
          if (view === 'canvas') canvas.current?.circle(l.nodes);
          else apply((m) => m);
          pickLoop(l);
        }}
      />
    ),
    links: <LinksPanel map={map} graph={graph} basisOf={basisOf} onPick={(id) => { setSelected({ nodes: [], edges: [id] }); setPanel('inspect'); }} />,
    paths: <PathsPanel map={map} graph={graph} announce={announce} onPick={(p) => { setActiveLoop(null); setHood(null); setPathHl(p ? { nodes: p.nodes, edges: p.edges } : null); }} />,
    leverage: <LeveragePanel map={map} graph={graph} loops={loops} onPick={selectNode} />,
    pulse: <PulsePanel map={map} graph={graph} announce={announce} />,
    tocode: <ToCodePanel map={map} onPick={selectNode} onPickEdge={(id) => { setSelected({ nodes: [], edges: [id] }); setPanel('inspect'); }} nm={nm} />,
    clusters: <ClustersPanel map={map} graph={graph} show={hulls} onShow={setHulls} onPick={(ids) => setSelected({ nodes: ids, edges: [] })} />,
    legend: <LegendPanel />,
    // the file exports are the whole document, hidden circumstances included (SL16); the pictures are what the canvas shows
    map: <MapDetails map={full} apply={apply} download={download} canvas={view === 'canvas' ? canvas : null} store={storage} onOpenMap={props.onOpenMap} />,
  };
  const toCodeCount = map.nodes.filter((n) => n.kind !== 'note' && n.code_status === 'undetermined').length;

  const editor = (
    <>
      <label className="flex items-center gap-2 border-b border-[color:var(--bx-line)] px-3 py-2 text-sm font-semibold ax-tap">
        <input type="checkbox" checked={evidenceOnly} onChange={(e) => { setEvidenceOnly(e.target.checked); setActiveLoop(null); setPathHl(null); announce(e.target.checked ? `Analyses now use evidence-backed links only (${counts.evidence} of ${counts.all}).` : 'Analyses use every link again.'); }} data-testid="evidence-toggle" aria-labelledby="evidence-toggle-label" />
        <span id="evidence-toggle-label">{C.evidence.toggle}</span>
      </label>
      <div className="flex flex-wrap gap-1 border-b border-[color:var(--bx-line)] p-2" role="group" aria-label="Panels">
        {PANELS.map((p) => (
          <button key={p} type="button" className={`bx-btn ax-tap px-2 ${panel === p ? 'bx-btn-on' : ''}`} aria-pressed={panel === p} onClick={() => setPanel(p)} data-testid={`panel-${p}`}>
            {C.panels[p]}
            {p === 'loops' && <span className="bx-chip bg-paper-2 text-ink dark:bg-night dark:text-night-ink px-1.5" data-testid="loops-count">{loops.loops.length}</span>}
            {p === 'tocode' && toCodeCount > 0 && <span className="bx-chip bg-paper-2 text-ink dark:bg-night dark:text-night-ink px-1.5">{toCodeCount}</span>}
          </button>
        ))}
      </div>
      {/* positioned, so sr-only (absolute) fields inside scroll with the panel and are clipped by it */}
      <div className="relative min-h-0 flex-1 overflow-y-auto p-3" tabIndex={0} role="region" aria-label={C.panels[panel]}>
        <h3 className="sr-only">{C.panels[panel]}</h3>
        {panelBody[panel]}
      </div>
    </>
  );
  // SL17: the dock's cards, top to bottom: the core's editor, then the host's; each scrolls inside itself, so one card
  // never pushes the others off screen
  const cards: { id: string; title: string; body: ReactNode; editor?: boolean }[] = [
    { id: 'editor', title: C.dock.editor, body: editor, editor: true },
    ...(props.sideCards ?? []).map((c) => ({ id: `host:${c.id}`, title: c.title, body: <div className="p-3">{c.render(selected)}</div> })),
  ];
  const side = (
    <aside id={dockId} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" aria-label="Map panels" data-testid="side-dock" data-open={dockOpen ? 'true' : 'false'}>
      {dockOpen ? (
        cards.map((c) => {
          const open = cardOpen(c.id);
          return (
            <section
              key={c.id}
              className={`bx-card flex min-h-0 min-w-0 flex-col p-0 ${open ? (c.editor ? 'lg:flex-[3_1_0%]' : 'lg:flex-[2_1_0%]') : 'flex-none'}`}
              aria-labelledby={`${dockId}-${c.id}-h`}
              data-testid={`dock-card-${c.id}`}
              data-open={open ? 'true' : 'false'}
            >
              <h2 id={`${dockId}-${c.id}-h`} className="m-0 border-b border-[color:var(--bx-line)] text-sm font-semibold">
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left ax-tap" aria-expanded={open} aria-controls={`${dockId}-${c.id}-b`} onClick={() => setCardOpen(c.id, !open)} data-testid={`dock-card-${c.id}-toggle`}>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                  {c.title}
                </button>
              </h2>
              <div id={`${dockId}-${c.id}-b`} className={`relative min-h-0 flex-1 flex-col ${c.editor ? '' : 'overflow-y-auto'} ${open ? 'flex' : 'hidden'}`} data-testid={`dock-card-${c.id}-body`}>
                {c.body}
              </div>
            </section>
          );
        })
      ) : (
        <div className="bx-card flex h-full flex-col items-center gap-2 overflow-y-auto p-1" data-testid="dock-rail">
          {cards.map((c) => (
            <button key={c.id} type="button" className="ax-tap rounded px-1 py-2 text-sm font-semibold hover:bg-paper-2 dark:hover:bg-night [writing-mode:vertical-rl]" onClick={() => setCardOpen(c.id, true, true)} data-testid={`dock-rail-${c.id}`}>
              {c.title}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
  const peekBox = peek && peekTarget && (
    <Peek
      key={`${peek.kind}:${peek.id}:${peek.x}:${peek.y}`}
      target={peekTarget}
      at={peek}
      map={map}
      nm={nm}
      loops={loops.loops}
      loopNames={loopNames}
      renderPeek={props.renderPeek}
      keyboard={peek.keyboard}
      onClose={() => setPeek(null)}
      onOpen={() => {
        setPeek(null);
        setSelected(peek.kind === 'node' ? { nodes: [peek.id], edges: [] } : { nodes: [], edges: [peek.id] });
        setPanel('inspect');
        if (!dockOpen || !cardOpen('editor')) saveDock({ open: true, closed: dock.closed.filter((x) => x !== 'editor') });
      }}
      onAssoc={peek.kind === 'node' && peekTarget.kind === 'node' && peekTarget.node.kind !== 'note' ? () => { setPeek(null); openAssoc(peek.id); } : undefined}
    />
  );
  const fsOn = fs !== 'off';
  const grid = `grid grid-cols-[minmax(0,1fr)] gap-3 ${dockOpen ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : 'lg:grid-cols-[minmax(0,1fr)_3rem]'} ${fsOn ? 'min-h-0 flex-1 lg:grid-rows-[minmax(0,1fr)]' : ''}`;
  const tall = fsOn ? 'lg:h-full' : 'lg:h-[calc(100vh-11rem)]';

  return (
    <div
      ref={ws}
      className={`${map.layout.theme === 'print' ? 'ax-print' : ''} ${fsOn ? 'flex flex-col overflow-auto bg-[color:var(--bx-bg)] p-2 text-[color:var(--bx-ink)] sm:p-3' : ''} ${fs === 'overlay' ? 'fixed inset-0 z-[60]' : ''} ${fs === 'api' ? 'h-full w-full' : ''}`}
      data-testid="map-workspace"
      data-fullscreen={fs}
    >
      <h1 className="sr-only">{view === 'canvas' ? 'Map' : C.list.title}: {map.name}</h1>
      <div className="sr-only" role="status" aria-live="polite" data-testid="live">{live}</div>
      {toolbar}
      {view === 'canvas' ? (
        <div className={grid}>
          <div className={`relative h-[60vh] min-h-[22rem] ${tall} rounded-xl border border-[color:var(--bx-line)] overflow-hidden`}>
            <Suspense fallback={<p role="status" className="p-4 bx-muted">Loading the canvas…</p>}>
              <Canvas
                ref={canvas}
                map={map}
                dark={theme === 'dark'}
                print={map.layout.theme === 'print'}
                reducedMotion={reducedMotion}
                selected={selected}
                highlight={highlight}
                loops={loops.loops}
                loopNames={loopNames}
                activeLoop={activeLoop}
                hulls={clusters}
                describeEdge={describeEdge}
                edgeTip={edgeTip}
                onConnect={(from, to) => openLink(from, to || null)}
                onSelect={(nodes, edges) => {
                  setSelected({ nodes, edges });
                  if (nodes.length + edges.length) setPanel('inspect');
                }}
                onAddAt={(pos) => setNewNodeReq({ pos })}
                onContext={(id) => openAssoc(id)}
                onPeek={(r) => setPeek({ ...r, keyboard: false })}
                nodeText={map.layout.nodeText ?? 'title-code'}
                onMove={(pos, pin, origin) => apply((m) => setPositions(m, pos, pin), origin === 'drag' ? undefined : 'layout')}
                onLoop={(key) => {
                  const l = loops.loops.find((x) => x.key === key) ?? null;
                  setPanel('loops');
                  pickLoop(activeLoop === key ? null : l);
                }}
              />
            </Suspense>
            {peekBox}
          </div>
          <div className={`${tall} min-h-0 min-w-0 flex`}>{side}</div>
        </div>
      ) : (
        <div className={grid}>
          <ListView map={map} nm={nm} selected={selected} onSelect={(s) => setSelected(s)} onAddNode={() => setNewNodeReq({})} onAddEdge={() => openLink(null)} onAssoc={openAssoc} apply={apply} describeEdge={describeEdge} highlight={highlight} announce={announce} />
          <div className="min-h-0 flex">{side}</div>
        </div>
      )}

      <NewNodeDialog req={newNodeReq} onClose={() => setNewNodeReq(null)} onCreate={createNode} anchorName={newNodeReq?.follow ? nm(newNodeReq.follow.anchor) : ''} />
      <Dialog open={!!linkReq} onClose={() => setLinkReq(null)} title={C.evidence.linkTo} wide testId="edge-dialog">
        {linkReq && (
          <LinkForm
            map={map}
            nm={nm}
            from={linkReq.from}
            to={linkReq.to}
            onCancel={() => setLinkReq(null)}
            onCreate={(e) => {
              apply((m) => addEdge(m, e));
              setLinkReq(null);
              setSelected({ nodes: [], edges: [e.id] });
              setPanel('inspect');
              announce(`Added ${describeEdge(e)}.`);
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!assocFor} onClose={() => setAssocFor(null)} title={S.associations.title} wide testId="assoc-dialog">
        {assocFor && byId.get(assocFor) && (
          <AssociationMenu
            node={byId.get(assocFor)!}
            map={map}
            nameOf={nm}
            onFollow={(r: FollowRequest) => (r.existing && r.link ? linkExisting(assocFor, r.existing, r.link, r.direction) : setNewNodeReq({ follow: { anchor: assocFor, link: r.link, direction: r.direction } }))}
          />
        )}
      </Dialog>
      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title="Keyboard" testId="keys-dialog">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          {[...C.keys, ...C.keysMore].map(([k, v]) => (
            <div key={k} className="contents"><dt><span className="bx-kbd">{k}</span></dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-sm bx-muted">Right-click, Ctrl-click or long-press a circumstance or a link for a quick look. On a touch screen, tap a circumstance's ⋯ button for the association menu.</p>
      </Dialog>
    </div>
  );
}

function EdgeInspector({ edge, map, nm, onChange, onDelete, error }: { edge: MapEdge; map: SdohMapDoc; nm: (id: string) => string; onChange: (p: Partial<MapEdge>, key?: string) => void; onDelete: () => void; error: string | null }) {
  const link = edge.link ? packLinks.find((l) => l.id === edge.link) : undefined;
  return (
    <div data-testid="edge-inspector">
      <p className="mb-2 font-semibold">
        {nm(edge.from)} <span aria-hidden>→</span><span className="sr-only">leads to</span> {nm(edge.to)}
      </p>
      <div className="mb-2 flex gap-1.5">
        <button type="button" className="bx-btn ax-tap" onClick={onDelete} data-testid="delete-edge">{C.list.delete}</button>
      </div>
      {error && <p role="alert" className="bx-todo mb-2">{error}</p>}
      <BasisPanel key={`${edge.id}:${edge.basis}`} edge={edge} map={map} nm={nm} onPatch={(p) => onChange(p)} />
      <EdgeFields draft={edge} onChange={onChange} />
      <section className="mt-3" aria-label={C.edge.evidence}>
        <h3 className="font-semibold">{C.edge.evidence}</h3>
        {edge.evidence.length ? (
          <div data-testid="edge-evidence">
            {link && <CitedText text={`${link.id}: ${link.mechanism}`} className="text-sm bx-prose leading-6" />}
            {!link && edge.evidence.map((n) => <div key={n} className="bx-foldout"><RefCard n={n} /></div>)}
          </div>
        ) : (
          <p className="text-sm bx-muted" data-testid="edge-no-evidence">{C.edge.userDrawn}</p>
        )}
      </section>
    </div>
  );
}

function NewNodeDialog({ req, onClose, onCreate, anchorName }: { req: NewNodeReq | null; onClose: () => void; onCreate: (d: NodeDraft, req: NewNodeReq) => void; anchorName: string }) {
  const link = req?.follow?.link ?? null;
  const title = req?.kind === 'note' ? C.node.addNote : req?.follow ? (link ? `${C.assoc.follow} (${link.id})` : C.assoc.yourOwn) : C.node.add;
  return (
    <Dialog open={!!req} onClose={onClose} title={title} wide testId="node-dialog">
      {req && <NewNodeForm req={req} onClose={onClose} onCreate={onCreate} anchorName={anchorName} />}
    </Dialog>
  );
}

/** Mounted fresh for each request, so a quick submit never reuses the previous draft. */
function NewNodeForm({ req, onClose, onCreate, anchorName }: { req: NewNodeReq; onClose: () => void; onCreate: (d: NodeDraft, req: NewNodeReq) => void; anchorName: string }) {
  const [draft, setDraft] = useState<NodeDraft>(() => ({ kind: req.kind === 'note' ? 'note' : 'circumstance', code_status: 'undetermined', code: null, type: null, ref: null, label: emptyDoc(), circumstance: emptyDoc(), severity: null, since: null, notes: emptyDoc(), style: {}, pinned: false }));
  const link = req.follow?.link ?? null;
  // K3: 'Add new' offers only codes the link's evidence names — its `suggest` codes downstream, its `codes.from` upstream
  const offered = link ? (req.follow!.direction === 'out' ? link.suggest : link.codes.from) : undefined;
  const only = offered ? codesUnder(offered) : undefined;
  return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(draft, req);
          }}
        >
          {req.follow && (
            <p className="mb-3 text-sm bx-banner">
              {link ? (
                <>
                  New circumstance {req.follow.direction === 'out' ? 'linked from' : 'linking to'} <span className="font-semibold">{anchorName}</span> with a {link.polarity} link that cites{' '}
                  {link.refs.map((n) => `[${n}]`).join(' ')}.
                </>
              ) : (
                <>A new circumstance; after you add it, the link form opens from <span className="font-semibold">{anchorName}</span> so the link is checked against the evidence.</>
              )}
            </p>
          )}
          <NodeFields draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p, ...(p.code_status && p.code_status !== 'sdoh' && !p.code ? { code: null } : {}) }))} pickerOpen only={only} suggested={offered} compact />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" className="bx-btn-primary ax-tap" data-testid="node-submit" disabled={draft.code_status === 'sdoh' && !draft.code}>
              {req.kind === 'note' ? C.node.addNote : C.node.add}
            </button>
            <button type="button" className="bx-btn ax-tap" onClick={onClose}>Cancel</button>
          </div>
        </form>
  );
}
