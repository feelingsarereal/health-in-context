import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
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
import { addEdge, addNode, deleteEdges, deleteNodes, newEdge, newNode, renameLoop, setPositions, toGraph, updateEdge, updateNode, type CodeStatus, type MapEdge, type MapNode, type OtherType, type SdohMap as SdohMapDoc } from './lib/model/map';
import { docFromText, emptyDoc, plainText } from './lib/model/rich';
import { feedbackClusters, neighbourhood, findLoops, DEFAULT_WEIGHT, type Loop } from './lib/analysis';
type Engine = 'fcose' | 'elk-stress';
const ENGINES: Engine[] = ['fcose', 'elk-stress'];
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
import { AboutMap, MapMenu, type MapMenuHandle, type MapMenuItem } from './components/map/MapDetails';
import { SelectionRead } from './components/map/SelectionRead';
import { NotebookImport, type NotebookImportHandle } from './components/notebook/Import';
import { ACCEPT, DEFAULT_LIMITS, type ImportLimits } from './lib/import/limits';
import { ListView } from './components/map/ListView';
import type { CanvasHandle, Highlight, PeekRequest } from './components/map/Canvas';
import { Peek, type PeekTarget } from './components/map/Peek';
import { links as packLinks } from './lib/data/scheme';
import { Notebook } from './components/notebook/Notebook';
import { CaseSummary } from './components/notebook/CaseSummary';
import { addNote, CORE_TEMPLATES, fieldText, labelAll, locate, makeSpan, notebookFlags, type Note, type NoteTemplate, type Span, type SuggestedBy, type Target } from './lib/model/notebook';
import { attachSpan, deleteWithSpans, detachSpan, spansBehind } from './lib/model/spans';
import { SourcesCount, SourcesList } from './components/map/SourcesList';
import { localCodeMatcher, type NotebookExtractor, type Proposal } from './lib/model/extract';
import { EvidencePicker, SuggestPanel, type FromChoice } from './components/notebook/FromText';
import { hasNotebook } from './lib/model/map';
import { addPassage, makeChip, notebookFlags as flagsOf } from './lib/model/notebook';
import { clusterTargetId, loopTargetId, targetName as nameOfTarget, traceSet, type NotebookTargetKind, type TargetContext } from './lib/model/targets';
import { TargetPicker } from './components/notebook/TargetPicker';
import { CitationsContext, citationsIn, type CitationsValue } from './components/notebook/Citations';
import { ItemView } from './components/notebook/ItemView';
import type { MentionRequest } from './components/notebook/Notebook';
import { ReportDialog, type ReportChoice } from './components/notebook/ReportDialog';
import { exportCase } from './lib/model/caseFile';
import { CORE_VERSION } from './lib/version';
import { loadedPack } from './lib/data/pack';
import { scheme } from './lib/data/scheme';
import { safety } from './lib/data/core';

const Canvas = lazy(() => import('./components/map/Canvas'));
const titleOf = (c: string) => codeMap.get(c)?.title;
/** SL23: the Whole map card's tabs (the selection has its own card; the file actions are in the Map menu) */
export const PANELS = ['loops', 'links', 'paths', 'leverage', 'pulse', 'clusters', 'legend', 'needsCode', 'about'] as const;
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

/** SL17: the dock's per-viewer state; `width` (review 4) only once the viewer resized it */
interface DockPref {
  open: boolean;
  closed: string[];
  width?: number;
  /** SL23: the selection card's mode, only once the viewer chose */
  mode?: 'read' | 'edit';
  /** SL26: the notebook is shown (beside the map from lg up, as the second tab below), and its width once resized */
  notebook?: boolean;
  nbWidth?: number;
  /** SL30: the dock was folded once, the first time the notebook opened on a screen under 1600 px */
  nbAutoFolded?: boolean;
  /** SL28 point 6: the note left open (none: every note collapsed) */
  nbNote?: string;
  /** SL28 point 3: the trace view is on */
  trace?: boolean;
}
/** SL30: under this width, the notebook's first opening folds the dock to its rail (once per viewer) */
const NB_AUTOFOLD_BELOW = 1600;
/** SL30: from lg up the workspace fills the viewport below where it starts; SL31: less what the page has below it (the
 * site footer, a host's notice), so the page itself is exactly the viewport and never scrolls. When that leaves less
 * than FIT_MIN (a map placed far down a host's page), it keeps the older height and the page scrolls to it. */
const FIT_MIN = 480;
/** SL31: the most of the window that what sits below the workspace (a footer) may take before it is left to scroll */
const FIT_BELOW_MAX = 0.15;
/**
 * SL31: the height of what the page lays out below an element in normal flow: its following siblings, then each
 * ancestor's following siblings, plus each ancestor's bottom padding and border, up to <body>. A stretched (flex-1)
 * ancestor counts only its own padding, so the measure does not feed on the height it sets.
 */
function spaceBelow(el: HTMLElement): number {
  let sum = 0;
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const p = n.parentElement;
    if (!p) break;
    const pcs = getComputedStyle(p);
    const column = pcs.display !== 'flex' && pcs.display !== 'inline-flex' && pcs.display !== 'grid' ? true : pcs.display === 'grid' ? false : pcs.flexDirection.startsWith('column');
    if (!column) continue;
    for (let sib = n.nextElementSibling as HTMLElement | null; sib; sib = sib.nextElementSibling as HTMLElement | null) {
      const cs = getComputedStyle(sib);
      if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
      sum += sib.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom) + (parseFloat(pcs.rowGap) || 0);
    }
    sum += parseFloat(pcs.paddingBottom) + parseFloat(pcs.borderBottomWidth);
  }
  return sum;
}
const DOCK_DEFAULT = 400;
const DOCK_MIN = 280;
const NB_DEFAULT = 420;
const NB_MIN = 300;

export interface NewNodeReq {
  pos?: { x: number; y: number };
  follow?: { anchor: string; link: PackLink | null; direction: 'out' | 'in' };
  kind?: 'note';
  /** SL27: made from a notebook selection — the span to attach, and (Edit then accept) the proposal's reading */
  fromSpan?: Span;
  by?: SuggestedBy & { inferred?: boolean; confidence?: 'high' | 'medium' | 'low' };
  preset?: { code_status: CodeStatus; code: string | null; type: OtherType | null; label: string };
  /** the proposal's other spans, attached too */
  moreSpans?: Span[];
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
  /**
   * SL31: quick field edit in the selection card's Read mode — a ✎ on the label, the description, the notes and a
   * link's description, and switches for "Pinned in place" and a link's delay. Default true wherever the map is
   * editable; a read-only map never shows it. Codes, code status, polarity, weight, confidence and overrides stay in Edit.
   */
  quickEdit?: boolean;
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
  /** SL23: the host's own items at the end of the toolbar's Map menu (e.g. "Reset to the built map") */
  mapMenuItems?: MapMenuItem[];
  /** the Whole map card's tab; uncontrolled when left out */
  panel?: Panel;
  onPanelChange?: (panel: Panel) => void;
  /** shown when the map is not in `storage` */
  missing?: ReactNode;
  /**
   * SL26: the case manager notebook beside the map (a view toggle; tabs on a phone). Off by default; from SL28 (0.9.0)
   * available to hosts, with spans and mentions tied to every item kind, case export and the case report.
   */
  notebook?: boolean;
  /** SL26: the host's own note templates, offered after the core's four (Intake, Contact note, Case conference, Plan review) */
  notebookTemplates?: NoteTemplate[];
  /**
   * SL29: the notebook's file import limits — the largest file in MB (default 20) and the most PDF pages (default 300).
   * Import runs on the device; the parsers load on first use.
   */
  notebookImport?: Partial<ImportLimits>;
  /**
   * SL27: more extractors for "Suggest circumstances in this note", after the core's local code matcher (an engine
   * picker appears when there is more than one). A `remote` one runs only with `allowRemoteExtractors` and only on a
   * note with no unresolved identifier flags; the health profile keeps it off until a SAFETY ruling (S7.2).
   */
  extractors?: NotebookExtractor[];
  allowRemoteExtractors?: boolean;
  /**
   * SL28: the host's own item kinds for the notebook's Link to… and @ mentions (e.g. an Interrogator app's `/code`
   * entries and sections): each with a search, an open and (optionally) a name. Its kind must not be one of the core's.
   */
  notebookTargets?: NotebookTargetKind[];
  /** SL28: open the notebook at this passage (a span id) once the map has loaded, e.g. from a "Cited in your notebook" link */
  passage?: string;
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
  const mapMenu = useRef<MapMenuHandle>(null);
  const [ownView, setOwnView] = useState<MapView>('canvas');
  const view = props.view ?? ownView;
  const otherView: MapView = view === 'canvas' ? 'list' : 'canvas';
  const switchView = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (props.onViewChange) props.onViewChange(otherView);
    else setOwnView(otherView);
  };
  const [ownPanel, setOwnPanel] = useState<Panel>('loops');
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
  const [linkReq, setLinkReq] = useState<{ from: string | null; to: string | null; span?: Span } | null>(null);
  // SL27: Add as evidence to… (a passage onto an existing circumstance or link)
  const [evidenceReq, setEvidenceReq] = useState<Span | null>(null);
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
  // SL17 review 2: the layout engine is the map's own (so Undo puts the picker back too)
  const engine = map.layout.engine;
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
  // SL30 point 3: the height that fills the viewport below the workspace's top (a sticky site header included), or null
  const [fitH, setFitH] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!wide || fs !== 'off') return setFitH(null);
    const measure = () => {
      const el = ws.current;
      if (!el) return;
      // a footer's worth below (up to 15% of the window) gets room, so the page is exactly the window; more than
      // that is the host's page carrying on below the map, which the page scrolls to as before
      const below = spaceBelow(el);
      const room = Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - (below <= window.innerHeight * FIT_BELOW_MAX ? below : 0));
      setFitH(room >= FIT_MIN ? room : null);
    };
    measure();
    window.addEventListener('resize', measure);
    // what sits above the workspace can change height after the first paint (a host's banner, fonts, leaving full screen)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [wide, fs]);
  const dockId = `dock-${useId().replace(/:/g, '')}`;
  // SL17 review 4: the dock's width (set by its resize handle) is kept with the collapse state, only once changed
  const [dock, setDock] = useState<DockPref>(() => {
    try {
      const v = JSON.parse(viewPref(storage, 'dock') ?? 'null');
      if (v && typeof v.open === 'boolean' && Array.isArray(v.closed)) {
        const d: DockPref = { open: v.open, closed: v.closed.filter((x: unknown) => typeof x === 'string') };
        if (typeof v.width === 'number' && Number.isFinite(v.width)) d.width = Math.max(DOCK_MIN, Math.round(v.width));
        if (v.mode === 'read' || v.mode === 'edit') d.mode = v.mode;
        if (typeof v.notebook === 'boolean') d.notebook = v.notebook;
        if (typeof v.nbWidth === 'number' && Number.isFinite(v.nbWidth)) d.nbWidth = Math.max(NB_MIN, Math.round(v.nbWidth));
        if (v.nbAutoFolded === true) d.nbAutoFolded = true;
        if (typeof v.nbNote === 'string') d.nbNote = v.nbNote;
        if (v.trace === true) d.trace = true;
        return d;
      }
    } catch {
      /* unreadable: the defaults */
    }
    return { open: true, closed: [] };
  });
  const saveDock = (d: DockPref) => {
    setDock(d);
    setViewPref(storage, 'dock', JSON.stringify(d));
  };
  /** SL28: one field of the dock's state, from the latest state (two changes in one tick both stick) */
  const patchDock = (patch: Partial<DockPref>) =>
    setDock((prev) => {
      const next: DockPref = { ...prev, ...patch };
      for (const k of Object.keys(patch) as (keyof DockPref)[]) if (patch[k] === undefined) delete next[k];
      setViewPref(storage, 'dock', JSON.stringify(next));
      return next;
    });
  const dockOpen = dock.open || !wide;
  const foldBtn = useRef<HTMLButtonElement>(null);
  const unfoldBtn = useRef<HTMLButtonElement>(null);
  const refocusDock = useRef<'fold' | 'unfold' | null>(null);
  const setDockOpen = (open: boolean, focus = false) => {
    saveDock({ ...dock, open });
    // SL17 review 1: the control that folded the dock is gone, so focus moves to its counterpart (« on the rail, » on the dock)
    if (focus) refocusDock.current = open ? 'fold' : 'unfold';
    announce(open ? 'Side dock open.' : 'Side dock folded; the canvas has the full width.');
  };
  useEffect(() => {
    const f = refocusDock.current;
    refocusDock.current = null;
    if (f) (f === 'fold' ? foldBtn : unfoldBtn).current?.focus();
  }, [dockOpen]);
  const setCardOpen = (id: string, open: boolean, alsoDock = false) => saveDock({ ...dock, open: alsoDock ? true : dock.open, closed: open ? dock.closed.filter((x) => x !== id) : [...new Set([...dock.closed, id])] });
  const cardOpen = (id: string) => !dock.closed.includes(id);
  // ── SL23: Read / Edit for the selection card (and About this map). A read-only original is always in Read, with no
  // toggle: the first edit made elsewhere (a drag, a new circumstance) forks a copy, and the toggle appears on the copy.
  const canEdit = !doc.readOnly;
  const mode: 'read' | 'edit' = canEdit && dock.mode === 'edit' ? 'edit' : 'read';
  const editing = mode === 'edit';
  const setMode = (m: 'read' | 'edit', extra: Partial<DockPref> = {}) => {
    if (!canEdit) return;
    saveDock({ ...dock, ...extra, mode: m });
    announce(m === 'edit' ? 'Edit mode: the editing controls are shown.' : 'Read mode.');
  };
  // the canvas refits once the grid has settled at its new size, after a fold or a reopen
  const dockFirst = useRef(true);
  useEffect(() => {
    if (dockFirst.current) {
      dockFirst.current = false;
      return;
    }
    const t = setTimeout(() => canvas.current?.refit(), 80);
    return () => clearTimeout(t);
  }, [dockOpen]);

  // ── SL17 review 4: the dock's resize handle, on its left edge. Between DOCK_MIN and half the workspace; the canvas
  // refits while it moves, throttled. Per viewer, never in the map; folding to the rail keeps it.
  const gridEl = useRef<HTMLDivElement>(null);
  const [dockW, setDockW] = useState<number | null>(null); // while dragging: not yet saved
  const dockMax = () => Math.max(DOCK_MIN, Math.floor((gridEl.current?.getBoundingClientRect().width ?? 2 * DOCK_DEFAULT) / 2));
  const clampW = (w: number) => Math.round(Math.min(dockMax(), Math.max(DOCK_MIN, w)));
  const width = clampW(dockW ?? dock.width ?? DOCK_DEFAULT);
  const refitAt = useRef(0);
  const refitT = useRef(0);
  const refitSoon = () => {
    // throttled: at most every 120 ms while it moves, and once more when it stops
    clearTimeout(refitT.current);
    const now = Date.now();
    if (now - refitAt.current > 120) {
      refitAt.current = now;
      requestAnimationFrame(() => canvas.current?.refit());
    }
    refitT.current = window.setTimeout(() => canvas.current?.refit(), 140);
  };
  useEffect(() => () => clearTimeout(refitT.current), []);
  const saveWidth = (w: number | undefined) => {
    const next: DockPref = { ...dock };
    if (w === undefined) delete next.width;
    else next.width = clampW(w);
    saveDock(next);
    setDockW(null);
    refitSoon();
  };
  const dragFrom = useRef<number | null>(null);
  const resizer = wide && dockOpen && (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={C.dock.resize}
      aria-controls={dockId}
      aria-valuenow={width}
      aria-valuemin={DOCK_MIN}
      aria-valuemax={dockMax()}
      tabIndex={0}
      title={C.dock.resizeTip}
      className="group absolute -left-3 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none items-center justify-center outline-none"
      data-testid="dock-resize"
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') saveWidth(width + (e.key === 'ArrowLeft' ? step : -step));
        else if (e.key === 'Home') saveWidth(undefined);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDoubleClick={() => saveWidth(undefined)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragFrom.current = e.clientX + width; // the dock's right edge stays put
        setDockW(width);
      }}
      onPointerMove={(e) => {
        if (dragFrom.current === null) return;
        setDockW(clampW(dragFrom.current - e.clientX));
        refitSoon();
      }}
      onPointerUp={(e) => {
        if (dragFrom.current === null) return;
        const w = clampW(dragFrom.current - e.clientX);
        dragFrom.current = null;
        saveWidth(w);
      }}
      onPointerCancel={() => {
        dragFrom.current = null;
        setDockW(null);
      }}
    >
      <span aria-hidden="true" className="h-12 w-1 rounded-full bg-[color:var(--bx-line)] group-hover:bg-[color:var(--bx-accent,currentColor)] group-focus-visible:bg-[color:var(--bx-accent,currentColor)] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2" />
    </div>
  );

  // ── SL26: the notebook — a view state per viewer (kept with the dock's), never in the map. From lg up it is a column
  // between the canvas and the dock with its own resize handle; below lg it is the second of two tabs (Map, Notebook).
  const nbEnabled = !!props.notebook;
  const nbOn = nbEnabled && dock.notebook === true;
  /** SL28 point 3: the trace view (with the notebook) */
  const traceOn = nbOn && dock.trace === true;
  const setNbOn = (on: boolean) => {
    // SL30 point 4: on a screen under 1600 px the first opening folds the dock to its rail, once; unfolding it again sticks
    if (on && wide && !dock.nbAutoFolded && window.innerWidth < NB_AUTOFOLD_BELOW) {
      const fold = dock.open;
      saveDock({ ...dock, notebook: true, nbAutoFolded: true, open: false });
      announce(`${C.notebook.title} shown.${fold ? ` ${C.notebook.autoFolded}` : ''}`);
      return;
    }
    saveDock({ ...dock, notebook: on });
    announce(on ? `${C.notebook.title} shown.` : `${C.notebook.title} hidden.`);
  };
  // SL29: import files into the notebook — the controller stays mounted, so the Map menu item works with it closed
  const importer = useRef<NotebookImportHandle>(null);
  const [nbFocus, setNbFocus] = useState<{ id: string; n: number; span?: string } | null>(null);
  const importLimits = { ...DEFAULT_LIMITS, ...(props.notebookImport ?? {}) };
  const saveImported = (note: Parameters<typeof addNote>[1], base: { dismissed: string[]; replaced: Record<string, number> }) =>
    apply((m) => {
      const b = m.notebook ?? { notes: [], dismissed: [], replaced: {} };
      return { ...m, notebook: { ...addNote(b, note), dismissed: [...new Set([...b.dismissed, ...base.dismissed])], replaced: { ...b.replaced, ...base.replaced } }, updated: new Date().toISOString() };
    });
  const importItem: MapMenuItem | null = nbEnabled
    ? {
        id: 'nb-import',
        label: C.notebook.importing.menu,
        description: C.notebook.importing.menuHint,
        onSelect: () => importer.current?.openFile(),
      }
    : null;
  const nbImport = nbEnabled && (
    <NotebookImport
      ref={importer}
      notebook={full.notebook}
      onSave={saveImported}
      onDone={(id) => {
        if (!id) return;
        if (!nbOn) setNbOn(true);
        setNbFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
      }}
      limits={importLimits}
      accept={ACCEPT}
      announce={announce}
    />
  );
  const [nbW, setNbW] = useState<number | null>(null);
  const nbMax = () => Math.max(NB_MIN, Math.floor((gridEl.current?.getBoundingClientRect().width ?? 3 * NB_DEFAULT) * 0.45));
  const clampNb = (w: number) => Math.round(Math.min(nbMax(), Math.max(NB_MIN, w)));
  const nbWidth = clampNb(nbW ?? dock.nbWidth ?? NB_DEFAULT);
  const saveNbWidth = (w: number | undefined) => {
    const next: DockPref = { ...dock };
    if (w === undefined) delete next.nbWidth;
    else next.nbWidth = clampNb(w);
    saveDock(next);
    setNbW(null);
    refitSoon();
  };
  const nbDrag = useRef<number | null>(null);
  const nbResizer = wide && nbOn && (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={C.notebook.resize}
      aria-valuenow={nbWidth}
      aria-valuemin={NB_MIN}
      aria-valuemax={nbMax()}
      tabIndex={0}
      title={C.notebook.resizeTip}
      className="group absolute -left-3 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none items-center justify-center outline-none"
      data-testid="nb-resize"
      data-print-hide
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') saveNbWidth(nbWidth + (e.key === 'ArrowLeft' ? step : -step));
        else if (e.key === 'Home') saveNbWidth(undefined);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDoubleClick={() => saveNbWidth(undefined)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        nbDrag.current = e.clientX + nbWidth;
        setNbW(nbWidth);
      }}
      onPointerMove={(e) => {
        if (nbDrag.current === null) return;
        setNbW(clampNb(nbDrag.current - e.clientX));
        refitSoon();
      }}
      onPointerUp={(e) => {
        if (nbDrag.current === null) return;
        const w = clampNb(nbDrag.current - e.clientX);
        nbDrag.current = null;
        saveNbWidth(w);
      }}
      onPointerCancel={() => {
        nbDrag.current = null;
        setNbW(null);
      }}
    >
      <span aria-hidden="true" className="h-12 w-1 rounded-full bg-[color:var(--bx-line)] group-hover:bg-[color:var(--bx-accent,currentColor)] group-focus-visible:bg-[color:var(--bx-accent,currentColor)] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2" />
    </div>
  );
  const nbFirst = useRef(true);
  useEffect(() => {
    if (nbFirst.current) {
      nbFirst.current = false;
      return;
    }
    const t = setTimeout(() => canvas.current?.refit(), 80);
    return () => clearTimeout(t);
  }, [nbOn]);
  // the identifier check over the whole notebook; every export, Print and a host's exporting item warn while it finds any
  const flags = useMemo(() => (nbEnabled ? notebookFlags(full.notebook) : []), [nbEnabled, full.notebook]);
  const [warn, setWarn] = useState<{ run: (m: SdohMapDoc) => void } | null>(null);
  const guard = (run: (m: SdohMapDoc) => void) => {
    if (!flags.length) return run(full);
    setWarn({ run });
  };
  const [printing, setPrinting] = useState(false);
  const printNotebook = () =>
    guard(() => {
      setPrinting(true);
      setTimeout(() => {
        window.print();
        setPrinting(false);
      }, 60);
    });

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
    if (req.by) n.suggested_by = { extractor: req.by.extractor, label: req.by.label };
    apply((m) => {
      let next = addNode(m, n);
      if (edge) next = addEdge(next, edge);
      // SL27: the selection it was made from — the span gets the circumstance as a target, the circumstance the span as
      // a source, in this one step (so Undo restores both)
      for (const sp of req.fromSpan ? [req.fromSpan, ...(req.moreSpans ?? [])] : []) next = attachSpan(next, req.by ? { ...sp, by: req.by } : sp, { kind: 'node', id: n.id }).map;
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
  const [delAsk, setDelAsk] = useState<{ nodes: string[]; edges: string[]; n: number } | null>(null);
  const removeSelection = (spans?: 'keep' | 'remove') => {
    if (!selected.nodes.length && !selected.edges.length) return;
    // SL27: passages in the notebook support what is being deleted: keep them as plain highlights, or remove them
    const n = spansBehind(full, selected.nodes, selected.edges);
    if (n && !spans) return setDelAsk({ nodes: selected.nodes, edges: selected.edges, n });
    setDelAsk(null);
    apply((m) => (n ? deleteWithSpans(m, selected.nodes, selected.edges, spans!) : deleteEdges(deleteNodes(m, selected.nodes), selected.edges)));
    announce(`Deleted ${selected.nodes.length} circumstance(s) and ${selected.edges.length} link(s).`);
    setSelected({ nodes: [], edges: [] });
  };
  const togglePin = () => {
    if (!selected.nodes.length) return;
    const pin = !selected.nodes.every((id) => byId.get(id)?.pinned);
    apply((m) => selected.nodes.reduce((acc, id) => updateNode(acc, id, { pinned: pin }), m));
    announce(pin ? 'Pinned.' : 'Unpinned.');
  };
  const arrange = (scope: 'unpinned' | 'all' | 'selection', using: Engine = engine) => {
    canvas.current?.layout(scope, using);
    announce(scope === 'selection' ? 'Arranging the selection.' : 'Arranging the map.');
  };
  /**
   * SL17 review 2: picking a layout re-arranges the unpinned boxes at once, as Auto-arrange does. The engine and the new
   * positions share the 'layout' undo key, so one Undo puts both back when the layout settles within a second.
   */
  const pickEngine = (v: Engine) => {
    if (v === engine) return;
    apply((m) => ({ ...m, layout: { ...m.layout, engine: v } }), 'layout');
    if (map.nodes.length) arrange('unpinned', v);
    announce(`Layout: ${C.layoutPick[v]}. Arranging the unpinned circumstances; Undo puts them back.`);
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
      // SL31: a key a field already handled (Enter saving or Esc cancelling a quick edit) is not a map key too: the
      // editor it came from may already have left the page by now, so its target can no longer say it was typing
      if (e.defaultPrevented) return;
      const t = e.target instanceof Element ? e.target : document.body;
      const mod = e.metaKey || e.ctrlKey;
      // SL23: ⌘O opens a map file, ⌘S saves a copy — from anywhere in the map but a dialog
      if (mod && !e.altKey && !e.shiftKey && (e.key === 'o' || e.key === 's' || e.key === 'O' || e.key === 'S') && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'o') mapMenu.current?.openFile();
        else mapMenu.current?.saveCopy();
        return;
      }
      // SL26: nothing typed or pressed in the notebook is a map key (Delete there never deletes a circumstance)
      if (t.closest('input, textarea, select, [contenteditable="true"], dialog[open], [data-notebook]') || document.querySelector('dialog[open]')) return;
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
          if (wide) setDockOpen(!dock.open, t.closest('[data-testid="side-dock"]') !== null);
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          setNewNodeReq({});
          break;
        case 'e':
        case 'E':
          // SL23: E toggles Read / Edit; a new link is K (and the toolbar's Link to…)
          if (canEdit) {
            e.preventDefault();
            setMode(editing ? 'read' : 'edit');
          }
          break;
        case 'k':
        case 'K':
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
            announce(`${hops === 1 ? '1st' : '2nd'}-degree neighborhood of ${nm(selected.nodes[0])}: outgoing and incoming shown in separate tints.`);
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
            // SL23: Enter edits the selection — Edit mode, then its first field
            if (!editing) setMode('edit', { open: true, closed: dock.closed.filter((x) => x !== 'selection') });
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

  // ── SL28 point 4: Export case, and the case report
  const pins = { core: CORE_VERSION, pack: loadedPack.version, icd11: `${scheme.name} ${scheme.release}` };
  const fileBase = map.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'map';
  const [reportOpen, setReportOpen] = useState(false);
  const caseItems = nbEnabled
    ? [
        { id: 'case', label: C.notebook.caseFile.menu, description: C.notebook.caseFile.menuDesc, testId: 'export-case', guarded: true, run: (m: SdohMapDoc) => {
          download(`${fileBase}.sdohcase.json`, exportCase(m, pins, S.codes.citation), 'application/json');
          announce(C.mapMenu.saved);
        } },
        { id: 'report', label: C.notebook.caseFile.report, description: C.notebook.caseFile.reportDesc, testId: 'export-report', guarded: false, run: () => setReportOpen(true) },
      ]
    : undefined;
  const printFrame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => printFrame.current?.remove(), []);
  /** Print / Save as PDF: the report's own page (its print stylesheet) in a hidden frame, so the workspace is untouched */
  const printReport = (html: string) => {
    printFrame.current?.remove();
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.tabIndex = -1;
    f.title = C.notebook.caseFile.reportTitle;
    f.dataset.testid = 'report-print-frame';
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    f.onload = () => {
      f.contentWindow?.focus();
      f.contentWindow?.print();
    };
    f.srcdoc = html;
    document.body.appendChild(f);
    printFrame.current = f;
  };
  const exportReport = (choice: ReportChoice) => {
    setReportOpen(false);
    const png = choice.options.image && view === 'canvas' ? canvas.current?.png() : undefined;
    guard(async (m) => {
      const [{ buildReport }, R] = await Promise.all([import('./lib/model/report'), import('./lib/model/report-render')]);
      const templates = new Map([...CORE_TEMPLATES, ...(props.notebookTemplates ?? [])].map((t) => [t.id, t.name]));
      const report = buildReport({
        map: m, shown: { ...map, notebook: m.notebook }, graph, loops, loopNames, nm, clusters: allClusters, host: props.notebookTargets,
        options: choice.options, pins, flaggedKept: flagsOf(m.notebook).length,
        copy: { heuristic: C.notebook.heuristic, notice: safety.notice, citation: S.codes.citation, templates, kinds: { free: C.notebook.free, structured: C.notebook.structured, imported: C.notebook.importing.kind } },
      });
      const image = png ? { png, alt: `The map “${m.name}”: ${count(map.nodes.filter((n) => n.kind !== 'note').length, 'circumstance')} and ${count(map.edges.length, 'link')}.` } : undefined;
      if (choice.format === 'md') download(`${fileBase}-report.md`, R.reportMarkdown(report, image), 'text/markdown');
      else if (choice.format === 'html') download(`${fileBase}-report.html`, R.reportHTML(report, image), 'text/html');
      else if (choice.format === 'docx') download(`${fileBase}-report.docx`, new Blob([R.reportDocx(report, image)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      else printReport(R.reportHTML(report, image));
      announce(C.notebook.caseFile.made);
    });
  };

  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 no-print" role="toolbar" aria-label="Map tools" data-testid="toolbar">
      <span className="mr-1 font-display text-lg font-semibold" data-testid="map-name">{map.name}</span>
      {/* SL23: the map file actions — open (import) first, save a copy, the exports, print, the host's items */}
      <MapMenu ref={mapMenu} map={full} apply={apply} download={download} canvas={view === 'canvas' ? canvas : null} store={storage} onOpenMap={props.onOpenMap} announce={announce} hostItems={importItem ? [importItem, ...(props.mapMenuItems ?? [])] : props.mapMenuItems} guard={nbEnabled ? guard : undefined} notebook={nbEnabled && hasNotebook(full)} coreItems={caseItems} />
      <span className="mr-1 text-sm bx-muted" data-testid="link-counts">
        {counts.all} {counts.all === 1 ? 'link' : 'links'}: {counts.evidence} evidence · {counts.all - counts.evidence} override{counts.review ? ` (${counts.review} to review)` : ''}
      </span>
      <button type="button" className="bx-btn-primary ax-tap" onClick={() => setNewNodeReq({})} data-testid="add-node" aria-keyshortcuts="N">{C.toolbar.addNode}</button>
      <button type="button" className="bx-btn ax-tap" onClick={() => openLink(linkFrom())} disabled={map.nodes.length < 2} data-testid="add-edge" aria-keyshortcuts="K">{C.toolbar.addEdge}</button>
      <button type="button" className="bx-btn ax-tap" onClick={() => openAssoc()} disabled={!selNode || selNode.kind === 'note'} data-testid="open-assoc" aria-keyshortcuts="A">{C.toolbar.assoc}</button>
      <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => setNewNodeReq({ kind: 'note' })}>{C.node.addNote}</button>
      {view === 'canvas' && (
        <>
          {/* SL17 review 2: the layout picker sits with the three arrange buttons */}
          <div className={`inline-flex flex-wrap items-center gap-1.5 ${sec}`} role="group" aria-label="Arrange" data-testid="arrange-group">
            <label className="inline-flex items-center gap-1 text-sm font-semibold" title={C.layoutPick[`${engine}Tip`]}>
              <span>{C.layoutPick.label}</span>
              <select className="bx-input ax-tap w-auto font-normal" value={engine} onChange={(e) => pickEngine(e.target.value as Engine)} data-testid="layout-engine">
                {ENGINES.map((v) => <option key={v} value={v} title={C.layoutPick[`${v}Tip`]}>{C.layoutPick[v]}</option>)}
              </select>
            </label>
            <button type="button" className="bx-btn ax-tap" onClick={() => arrange('unpinned')} disabled={!map.nodes.length} data-testid="arrange" aria-keyshortcuts="R">{C.toolbar.arrange}</button>
            <button type="button" className="bx-btn ax-tap" onClick={() => arrange('all')} disabled={!map.nodes.length}>{C.toolbar.arrangeAll}</button>
            <button type="button" className="bx-btn ax-tap" onClick={() => arrange('selection')} disabled={selected.nodes.length < 2}>{C.toolbar.arrangeSel}</button>
          </div>
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
        </>
      )}
      <button type="button" className={`bx-btn ax-tap ${fs !== 'off' ? 'bx-btn-on' : ''}`} aria-pressed={fs !== 'off'} onClick={toggleFs} aria-keyshortcuts="F" data-testid="fullscreen">{fs !== 'off' ? C.dock.exitFullscreen : C.dock.fullscreen}</button>
      <a className="bx-btn ax-tap" href={props.viewHref?.(otherView, map.id) ?? '#'} onClick={switchView} data-testid="switch-view">{view === 'canvas' ? C.toolbar.listView : C.toolbar.canvasView}</a>
      {/* SL26: the notebook beside the canvas or the list (below lg, the Map / Notebook tabs instead) */}
      {nbEnabled && wide && (
        <button type="button" className={`bx-btn ax-tap ${nbOn ? 'bx-btn-on' : ''}`} aria-pressed={nbOn} title={C.notebook.toggleTip} onClick={() => setNbOn(!nbOn)} data-testid="notebook-toggle">
          {C.notebook.toggle}
          {flags.length > 0 && <span className="bx-chip ml-1 px-1.5 text-xs" aria-label={count(flags.length, C.notebook.identifier)}>⚠ {flags.length}</span>}
        </button>
      )}
      {/* SL28 point 3: the trace view, with the notebook */}
      {nbEnabled && nbOn && (
        <button type="button" className={`bx-btn ax-tap ${traceOn ? 'bx-btn-on' : ''}`} aria-pressed={traceOn} title={C.notebook.trace.tip} onClick={toggleTrace} data-testid="trace-toggle">{C.notebook.trace.toggle}</button>
      )}
      <button type="button" className={`bx-btn ax-tap ${sec}`} onClick={() => setKeysOpen(true)} aria-keyshortcuts="?">{C.toolbar.keys} <span className="bx-kbd">?</span></button>
      <button type="button" className="bx-btn ax-tap sm:hidden" aria-expanded={toolsOpen} onClick={() => setToolsOpen((o) => !o)} data-testid="toolbar-more">{C.toolbar.moreTools} {toolsOpen ? '▴' : '▾'}</button>
    </div>
  );

  const emptyHint = map.nodes.length ? 'Select a circumstance or a link to edit it.' : coarse ? C.canvas.emptyTouch : C.canvas.empty;
  const inspector = (
    <div data-testid="inspector" data-mode="edit">
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
                      announce(`Color set on ${count(selected.nodes.length, 'circumstance')}.`);
                    }}
                  >
                    <option value="" disabled>Choose…</option>
                    <option value="block">Block color</option>
                    {USER_COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
              <button type="button" className="bx-btn ax-tap mt-2" onClick={() => removeSelection()}>Delete selection</button>
            </div>
          ) : (
            // K14: the add-the-first-circumstance hint only on an empty map
            <p data-testid="inspector-empty">{emptyHint}</p>
          )}
        </div>
      )}
      {selNode && (
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selNode.kind !== 'note' && <button type="button" className="bx-btn ax-tap" onClick={() => openAssoc(selNode.id)} data-testid="inspector-assoc">{C.assoc.open}</button>}
            {selNode.kind !== 'note' && <button type="button" className="bx-btn ax-tap" onClick={() => openLink(selNode.id)} data-testid="inspector-link-to">{C.evidence.linkTo}</button>}
            <button type="button" className="bx-btn ax-tap" onClick={togglePin}>{selNode.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" className="bx-btn ax-tap" onClick={() => removeSelection()} data-testid="delete-node">{C.list.delete}</button>
          </div>
          <NodeFields draft={selNode} onChange={(p, key) => apply((m) => updateNode(m, selNode.id, p), key ? `n:${selNode.id}:${key}` : undefined)} />
          {selNode.code && (
            <section className="bx-card mt-3 p-3" aria-label="About this code">
              <CodePopout code={selNode.code} />
            </section>
          )}
          {selNode.code_status === 'other' && selNode.ref && <p className="mt-2 text-xs bx-muted">Reference: {selNode.ref} ({C.node.userEntered})</p>}
          <SourcesList map={full} t={{ kind: 'node', id: selNode.id }} onGo={goToPassage} onRemove={(sp) => removeEvidence(sp, { kind: 'node', id: selNode.id })} />
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
          onDelete={() => removeSelection()}
          error={error}
        />
      )}
      {selEdge && <SourcesList map={full} t={{ kind: 'edge', id: selEdge.id }} onGo={goToPassage} onRemove={(sp) => removeEvidence(sp, { kind: 'edge', id: selEdge.id })} />}
    </div>
  );

  // SL27 point 8: from the card (or the peek) back to the passage, and "Remove as evidence"
  function goToPassage(spanId: string) {
    const sp = full.notebook?.spans?.find((x) => x.id === spanId);
    if (!sp) return;
    if (!nbOn) setNbOn(true);
    setNbFocus((f) => ({ id: sp.note, span: spanId, n: (f?.n ?? 0) + 1 }));
  }
  function removeEvidence(spanId: string, t: { kind: 'node' | 'edge'; id: string }) {
    apply((m) => detachSpan(m, spanId, t));
    announce(`${C.notebook.passages.removedEvidence} ${t.kind === 'node' ? nm(t.id) : 'the link'}.`);
  }
  // SL23: Read mode — the selection as text; SL31: with quick field edit for the text fields and two switches
  const quick =
    canEdit && props.quickEdit !== false
      ? {
          save: (name: string, change: () => void) => {
            change();
            announce(`${name} ${C.quick.saved}`);
          },
          more: () => setMode('edit'),
          node: (id: string, patch: Partial<MapNode>) => apply((m) => updateNode(m, id, patch)),
          edge: (id: string, patch: Partial<MapEdge>) => apply((m) => updateEdge(m, id, patch)),
        }
      : undefined;
  const reader = (
    <div data-testid="inspector" data-mode="read" data-quick-edit={quick ? 'on' : 'off'}>
      <SelectionRead map={map} node={selNode} edge={selEdge} multi={{ nodes: selected.nodes.length, edges: selected.edges.length }} nm={nm} loops={loops.loops} loopNames={loopNames} empty={emptyHint} quick={quick} sources={{ onGo: goToPassage, onRemove: canEdit ? removeEvidence : undefined }} />
    </div>
  );
  const panelBody: Record<Panel, JSX.Element> = {
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
        onGo={nbEnabled ? goToPassage : undefined}
        onRename={(l, name) => apply((m) => renameLoop(m, l.key, name, l.nodes))}
        onCircle={(l) => {
          if (view === 'canvas') canvas.current?.circle(l.nodes);
          else apply((m) => m);
          pickLoop(l);
        }}
      />
    ),
    links: <LinksPanel map={map} graph={graph} basisOf={basisOf} onPick={(id) => setSelected({ nodes: [], edges: [id] })} />,
    paths: <PathsPanel map={map} graph={graph} announce={announce} onPick={(p) => { setActiveLoop(null); setHood(null); setPathHl(p ? { nodes: p.nodes, edges: p.edges } : null); }} />,
    leverage: <LeveragePanel map={map} graph={graph} loops={loops} onPick={selectNode} />,
    pulse: <PulsePanel map={map} graph={graph} announce={announce} />,
    needsCode: <ToCodePanel map={map} onPick={selectNode} onPickEdge={(id) => setSelected({ nodes: [], edges: [id] })} nm={nm} />,
    clusters: <ClustersPanel map={map} graph={graph} show={hulls} onShow={setHulls} onPick={(ids) => setSelected({ nodes: ids, edges: [] })} onGo={nbEnabled ? goToPassage : undefined} />,
    legend: <LegendPanel />,
    // SL23: the map's name, subject and notes; editable in Edit mode only. The file actions are in the Map menu.
    about: <AboutMap map={full} apply={apply} editing={editing} />,
  };
  const toCodeCount = map.nodes.filter((n) => n.kind !== 'note' && n.code_status === 'undetermined').length;

  // SL23 point 7: "Needs a code" stays visible at zero, greyed out (aria-disabled) with a tooltip, while it lists nothing
  const needsCodeEmpty = toCodeCount === 0 && counts.review === 0;
  const chip = 'bx-chip bg-paper-2 text-ink dark:bg-night dark:text-night-ink px-1.5';
  // SL23: two core cards — the selection (no tabs; Read or Edit) and the Whole map (the evidence filter and its tabs)
  const wholeCard = (
    <>
      <label className="flex items-center gap-2 border-b border-[color:var(--bx-line)] px-3 py-2 text-sm font-semibold ax-tap">
        <input type="checkbox" checked={evidenceOnly} onChange={(e) => { setEvidenceOnly(e.target.checked); setActiveLoop(null); setPathHl(null); announce(e.target.checked ? `Analyses now use evidence-backed links only (${counts.evidence} of ${counts.all}).` : 'Analyses use every link again.'); }} data-testid="evidence-toggle" aria-labelledby="evidence-toggle-label" />
        <span id="evidence-toggle-label">{C.evidence.toggle}</span>
      </label>
      <div className="flex flex-wrap gap-1 border-b border-[color:var(--bx-line)] p-2" role="group" aria-label="Panels">
        {PANELS.map((p) => {
          const off = p === 'needsCode' && needsCodeEmpty && panel !== p;
          return (
            <button
              key={p}
              type="button"
              className={`bx-btn ax-tap px-2 ${panel === p ? 'bx-btn-on' : ''} ${off ? 'cursor-not-allowed opacity-60' : ''}`}
              aria-pressed={panel === p}
              aria-disabled={off || undefined}
              title={off ? C.needsCode.none : undefined}
              onClick={() => !off && setPanel(p)}
              data-testid={`panel-${p}`}
            >
              {C.panels[p]}
              {p === 'loops' && <span className={chip} data-testid="loops-count">{loops.loops.length}</span>}
              {p === 'needsCode' && toCodeCount > 0 && <span className={chip} data-testid="needs-code-count">{toCodeCount}</span>}
            </button>
          );
        })}
      </div>
      {/* positioned, so sr-only (absolute) fields inside scroll with the panel and are clipped by it */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" tabIndex={0} role="region" aria-label={C.panels[panel]} data-testid={`panel-body-${panel}`}>
        <h3 className="sr-only">{C.panels[panel]}</h3>
        {panelBody[panel]}
      </div>
    </>
  );
  const nSel = selected.nodes.length + selected.edges.length;
  const selTitle = selNode
    ? (selNode.kind === 'note' ? C.dock.selection.note : C.dock.selection.node)
    : selEdge
      ? C.dock.selection.edge
      : nSel
        ? `${C.dock.selection.many}: ${[selected.nodes.length ? count(selected.nodes.length, 'circumstance') : '', selected.edges.length ? count(selected.edges.length, 'link') : ''].filter(Boolean).join(', ')}`
        : C.dock.selection.none;
  const selectionCard = (
    // positioned, so sr-only (absolute) fields inside scroll with the card and are clipped by it
    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" tabIndex={0} role="region" aria-label={selTitle} data-testid="selection-body">
      {editing ? inspector : reader}
    </div>
  );
  // the dock's cards, top to bottom: the selection, the whole map, then the host's; each scrolls inside itself, so one
  // card never pushes the others off screen
  const cards: { id: string; title: string; body: ReactNode; kind: 'selection' | 'core' | 'host' }[] = [
    { id: 'selection', title: selTitle, body: selectionCard, kind: 'selection' },
    { id: 'whole', title: C.dock.wholeMap, body: wholeCard, kind: 'core' },
    ...(props.sideCards ?? []).map((c) => ({ id: `host:${c.id}`, title: c.title, body: <div className="p-3">{c.render(selected)}</div>, kind: 'host' as const })),
  ];
  const modeToggle = canEdit && (
    <div className="flex items-center gap-0.5 self-center px-1" role="group" aria-label={C.dock.mode} data-testid="mode-toggle">
      {(['read', 'edit'] as const).map((m) => (
        <button key={m} type="button" className={`bx-btn ax-tap px-2 py-0.5 text-xs ${mode === m ? 'bx-btn-on' : ''}`} aria-pressed={mode === m} aria-keyshortcuts="E" onClick={() => mode !== m && setMode(m)} data-testid={`mode-${m}`}>
          {C.dock[m]}
        </button>
      ))}
    </div>
  );
  const side = (
    <aside id={dockId} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" aria-label="Map panels" data-testid="side-dock" data-open={dockOpen ? 'true' : 'false'}>
      {dockOpen ? (
        cards.map((c, i) => {
          const open = cardOpen(c.id);
          return (
            <section
              key={c.id}
              // SL23: the selection card takes its content's height (up to 55%); the whole map and the host's cards share the rest
              // (the Whole map keeps room for its tabs and a few lines; each card clips what it cannot show, and scrolls inside)
              className={`bx-card flex min-h-0 min-w-0 flex-col overflow-hidden p-0 ${open ? (c.kind === 'selection' ? 'lg:max-h-[50%] lg:flex-[0_1_auto]' : c.kind === 'core' ? 'lg:min-h-[15rem] lg:flex-[3_1_0%]' : 'lg:flex-[2_1_0%]') : 'flex-none'}`}
              aria-labelledby={`${dockId}-${c.id}-h`}
              data-testid={`dock-card-${c.id}`}
              data-open={open ? 'true' : 'false'}
            >
              <div className="flex items-stretch border-b border-[color:var(--bx-line)]">
                <h2 id={`${dockId}-${c.id}-h`} className="m-0 min-w-0 flex-1 text-sm font-semibold">
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left ax-tap" aria-expanded={open} aria-controls={`${dockId}-${c.id}-b`} onClick={() => setCardOpen(c.id, !open)} data-testid={`dock-card-${c.id}-toggle`}>
                    <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                    {c.title}
                  </button>
                </h2>
                {c.kind === 'selection' && open && modeToggle}
                {/* SL17 review 1: the fold control is on the dock itself, top right, beside the first card's header */}
                {i === 0 && wide && (
                  <button ref={foldBtn} type="button" className="ax-tap px-3 text-base font-semibold hover:bg-paper-2 dark:hover:bg-night" aria-label={C.dock.fold} title={C.dock.foldTip} aria-expanded={true} aria-controls={dockId} aria-keyshortcuts="]" onClick={() => setDockOpen(false, true)} data-testid="dock-fold">
                    <span aria-hidden="true">»</span>
                  </button>
                )}
              </div>
              <div id={`${dockId}-${c.id}-b`} className={`relative min-h-0 flex-1 flex-col ${c.kind === 'host' ? 'overflow-y-auto overscroll-contain' : ''} ${open ? 'flex' : 'hidden'}`} data-testid={`dock-card-${c.id}-body`}>
                {c.body}
              </div>
            </section>
          );
        })
      ) : (
        <div className="bx-card flex h-full flex-col items-center gap-2 overflow-y-auto p-1" data-testid="dock-rail">
          <button ref={unfoldBtn} type="button" className="ax-tap w-full rounded px-1 py-1 text-base font-semibold hover:bg-paper-2 dark:hover:bg-night" aria-label={C.dock.unfold} title={C.dock.unfoldTip} aria-expanded={false} aria-controls={dockId} aria-keyshortcuts="]" onClick={() => setDockOpen(true, true)} data-testid="dock-unfold">
            <span aria-hidden="true">«</span>
          </button>
          {cards.map((c) => (
            <button key={c.id} type="button" className="ax-tap rounded px-1 py-2 text-sm font-semibold hover:bg-paper-2 dark:hover:bg-night [writing-mode:vertical-rl]" onClick={() => { refocusDock.current = 'fold'; setCardOpen(c.id, true, true); }} data-testid={`dock-rail-${c.id}`}>
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
        // SL23: "Open in editor" opens the selection card in Edit (Read only on a read-only original)
        const shown = { open: true, closed: dock.closed.filter((x) => x !== 'selection') };
        if (canEdit) setMode('edit', shown);
        else if (!dockOpen || !cardOpen('selection')) saveDock({ ...dock, ...shown });
      }}
      onAssoc={peek.kind === 'node' && peekTarget.kind === 'node' && peekTarget.node.kind !== 'note' ? () => { setPeek(null); openAssoc(peek.id); } : undefined}
      extra={<SourcesCount map={full} t={{ kind: peek.kind, id: peek.id }} onOpen={() => { setPeek(null); showTarget({ kind: peek.kind, id: peek.id }); }} />}
    />
  );
  const fsOn = fs !== 'off';
  // SL30 point 3: from lg up, on the canvas, the workspace (toolbar, canvas, notebook, dock) fills the viewport below
  // where it starts, so the page does not scroll while you work; the notebook and the dock scroll inside themselves
  const fitted = !fsOn && fitH !== null && view === 'canvas';
  const grid = `grid grid-cols-[minmax(0,1fr)] gap-3 ${fsOn || fitted ? 'min-h-0 flex-1 lg:grid-rows-[minmax(0,1fr)]' : ''}`;
  // from lg up the dock column takes its stored width (review 4), or the rail's
  const tall = fsOn || fitted ? 'lg:h-full' : 'lg:h-[calc(100vh-11rem)]';
  const gridStyle = wide ? { gridTemplateColumns: `minmax(0,1fr) ${nbOn ? `${nbWidth}px ` : ''}${dockOpen ? `${width}px` : '3rem'}` } : undefined;
  // SL26: below lg the notebook is a tab of its own: it takes the canvas's place, and the canvas stays mounted, hidden
  const nbTab = nbOn && !wide;
  // ── SL27: spans in the notebook ↔ the map
  const selectedTargets: Target[] = useMemo(() => [...selected.nodes.map((id) => ({ kind: 'node', id })), ...selected.edges.map((id) => ({ kind: 'edge', id }))], [selected]);
  // SL28: every item kind a passage can point at, with names; loops and clusters as they are computed now
  const allClusters = useMemo(() => feedbackClusters(graph), [graph]);
  const targetCtx: TargetContext = useMemo(() => ({ map: { ...map, notebook: full.notebook }, nm, loops: loops.loops, loopNames, clusters: allClusters, host: props.notebookTargets }), [map, full.notebook, nm, loops, loopNames, allClusters, props.notebookTargets]);
  const targetName = (t: Target) => nameOfTarget(t, targetCtx) ?? `${t.kind} ${t.id}`;
  // SL28: a code, reference, term or 101 a passage points at opens in a dialog of its own
  const [itemOpen, setItemOpen] = useState<Target | null>(null);
  /** a click on a highlight (or a target in the passages list): show the item — on the map, in a panel, or in a dialog */
  const showTarget = (t: Target) => {
    if (t.kind === 'loop') {
      const l = loops.loops.find((x) => loopTargetId(x) === t.id);
      if (!l) return announce(C.notebook.passages.linkNone);
      if (!wide) setNbOn(false);
      if (wide && (!dock.open || !cardOpen('whole'))) saveDock({ ...dock, open: true, closed: dock.closed.filter((x) => x !== 'whole') });
      setPanel('loops');
      setTimeout(() => pickLoop(l), wide ? 0 : 120);
      return;
    }
    if (t.kind === 'cluster') {
      const c = allClusters.find((x) => clusterTargetId(x) === t.id);
      if (!c) return announce(C.notebook.passages.linkNone);
      if (!wide) setNbOn(false);
      setSelected({ nodes: c, edges: [] });
      setPanel('clusters');
      if (view === 'canvas') setTimeout(() => canvas.current?.fitTo(c), wide ? 0 : 120);
      announce(`Selected ${targetName(t)}.`);
      return;
    }
    if (t.kind === 'code' || t.kind === 'reference' || t.kind === 'glossary' || t.kind === 'concept') return setItemOpen(t);
    if (t.kind === 'note') {
      if (!full.notebook?.notes.some((n) => n.id === t.id)) return;
      if (!nbOn) setNbOn(true);
      setNbFocus((f) => ({ id: t.id, n: (f?.n ?? 0) + 1 }));
      return;
    }
    if (t.kind === 'span') return goToPassage(t.id);
    if (t.kind !== 'node' && t.kind !== 'edge') {
      const h = props.notebookTargets?.find((k) => k.kind === t.kind);
      h?.open(t.id);
      return;
    }
    if (t.kind === 'node' && !byId.has(t.id)) return;
    setSelected(t.kind === 'node' ? { nodes: [t.id], edges: [] } : { nodes: [], edges: [t.id] });
    if (wide && (!dock.open || !cardOpen('selection'))) saveDock({ ...dock, open: true, closed: dock.closed.filter((x) => x !== 'selection') });
    if (!wide) setNbOn(false);
    const ids = t.kind === 'node' ? [t.id] : (() => { const e = map.edges.find((x) => x.id === t.id); return e ? [e.from, e.to] : []; })();
    if (view === 'canvas') setTimeout(() => canvas.current?.reveal(ids), wide ? 0 : 120);
    announce(`Selected ${targetName(t)}.`);
  };
  // ── SL28 point 1: Link to… over every kind, and @ mentions
  const [linkAny, setLinkAny] = useState<Span | null>(null);
  const [mention, setMention] = useState<MentionRequest | null>(null);
  const mentionDone = useRef(false);
  /** attach a passage (or a mention) to any target: a circumstance or link gets it as a source too */
  const attachAny = (m: SdohMapDoc, sp: Span, t: Target): SdohMapDoc =>
    t.kind === 'node' || t.kind === 'edge' ? attachSpan(m, sp, { kind: t.kind as 'node' | 'edge', id: t.id }).map : { ...m, notebook: addPassage(m.notebook, sp, { target: t }).notebook, updated: new Date().toISOString() };
  const linkTo = (sp: Span, t: Target) => {
    apply((m) => attachAny(m, sp, t));
    setLinkAny(null);
    announce(`${C.notebook.passages.linked} ${targetName(t)}.`);
  };
  const mentionPick = (t: Target) => {
    const req = mention;
    if (!req) return;
    mentionDone.current = true;
    setMention(null);
    apply((m) => {
      const note = m.notebook?.notes.find((n) => n.id === req.note.id);
      return note ? attachAny(m, makeChip(note, req.where, req.at), t) : m;
    });
    announce(`${C.notebook.passages.mentioned} ${targetName(t)}.`);
  };
  const closeMention = () => {
    const req = mention;
    setMention(null);
    // closed without a choice: the @ is typed after all
    if (req && !mentionDone.current) setTimeout(() => req.literal(), 0);
    mentionDone.current = false;
  };
  // ── SL28 point 3: cross-highlighting — the passage the caret is in selects what it supports; the trace view
  const [caretSpan, setCaretSpan] = useState<string | null>(null);
  const onFocusSpan = (sp: Span | null) => {
    setCaretSpan(sp?.id ?? null);
    if (!sp) return;
    const ts = full.notebook?.annotations?.find((a) => a.span === sp.id)?.targets ?? [];
    const nodes = ts.filter((t) => t.kind === 'node' && byId.has(t.id)).map((t) => t.id);
    const edges = ts.filter((t) => t.kind === 'edge' && map.edges.some((e) => e.id === t.id)).map((t) => t.id);
    if (nodes.length || edges.length) {
      setSelected({ nodes, edges });
      if (view === 'canvas' && wide) canvas.current?.reveal([...nodes, ...map.edges.filter((e) => edges.includes(e.id)).flatMap((e) => [e.from, e.to])]);
    }
  };
  const trace = useMemo(() => {
    if (!traceOn) return null;
    const live = caretSpan && full.notebook?.spans?.some((x) => x.id === caretSpan) ? caretSpan : null;
    if (!live && !selected.nodes.length && !selected.edges.length) return null;
    return traceSet({ ...map, notebook: full.notebook }, { span: live, nodes: selected.nodes, edges: selected.edges }, { loops: loops.loops, clusters: allClusters });
  }, [traceOn, caretSpan, selected, map, full.notebook, loops, allClusters]);
  // an analysis highlight the user just asked for (a loop, a path, a neighbourhood) wins; else the trace view
  const shownHighlight: Highlight | null = highlight ?? (trace ? { nodes: trace.nodes, edges: trace.edges } : null);
  function toggleTrace() {
    patchDock({ trace: traceOn ? undefined : true });
    announce(traceOn ? C.notebook.trace.off : C.notebook.trace.on);
  }
  // SL28 point 2: "Cited in your notebook (n)" wherever a reference, code, term or 101 opens inside the map
  // (made each render: Go to passage must see the dock's state as it is now)
  const citations: CitationsValue = { list: (t) => citationsIn(full, t), onGo: (c) => { setItemOpen(null); goToPassage(c.span.id); } };
  // SL28: opened at a passage (a link from a page outside the map)
  const passageDone = useRef(false);
  useEffect(() => {
    if (passageDone.current || !props.passage || !nbEnabled) return;
    passageDone.current = true;
    if (full.notebook?.spans?.some((x) => x.id === props.passage)) goToPassage(props.passage);
  }, [props.passage]); // eslint-disable-line react-hooks/exhaustive-deps
  const extractors = useMemo(() => [localCodeMatcher, ...(props.extractors ?? []).filter((x) => x.id !== localCodeMatcher.id)], [props.extractors]);
  /** Accept (or Edit then accept) a proposal: the same path as Create circumstance, with the extractor's label kept */
  const acceptProposal = (note: Note, p: Proposal, edit: boolean) => {
    const by = { ...p.extractor, inferred: p.status === 'implicit', confidence: p.confidence };
    const spans = p.spans
      .map((x) => {
        const text = fieldText(note, x.where);
        const loc = locate({ ...x, start: -1, end: -1 }, text);
        return loc ? makeSpan(note, x.where, loc.start, loc.end) : null;
      })
      .filter((x): x is Span => !!x);
    if (!spans.length) return announce(C.notebook.passages.failed);
    const preset = { code_status: (p.code ? 'sdoh' : p.other_type ? 'other' : 'undetermined') as CodeStatus, code: p.code, type: p.other_type, label: p.label };
    const req: NewNodeReq = { fromSpan: spans[0], moreSpans: spans.slice(1), by, preset };
    if (edit) return setNewNodeReq(req);
    createNode({ kind: 'circumstance', code_status: preset.code_status, code: preset.code, type: preset.type, ref: null, label: docFromText(p.label), circumstance: emptyDoc(), severity: null, since: null, notes: emptyDoc(), style: {}, pinned: false }, req);
  };
  const addEvidence = (sp: Span, t: Target) => {
    if (t.kind !== 'node' && t.kind !== 'edge') return;
    apply((m) => attachSpan(m, sp, { kind: t.kind as 'node' | 'edge', id: t.id }).map);
    setEvidenceReq(null);
    showTarget(t);
    announce(`${C.notebook.passages.evidenceAdded} ${targetName(t)}.`);
  };
  const nbCol = nbOn && (
    <div className={`${wide ? tall : 'h-[75vh] min-h-[24rem]'} relative min-h-0 min-w-0 flex`} id={`${dockId}-nb`} role={wide ? undefined : 'tabpanel'} aria-labelledby={wide ? undefined : `${dockId}-tab-nb`} data-testid="notebook-col">
      {nbResizer}
      <div className="bx-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
        <Notebook map={full} apply={apply} scrub={doc.scrub} flags={flags} templates={[...CORE_TEMPLATES, ...(props.notebookTemplates ?? [])]} announce={announce} onPrint={printNotebook}
          onImport={() => importer.current?.openFile()} onPaste={() => importer.current?.openPaste()} onDropFiles={(fs) => importer.current?.importFiles(fs)} focus={nbFocus}
          selectedTargets={selectedTargets} targetName={targetName} onShow={showTarget}
          onCreateFrom={canEdit ? (sp) => setNewNodeReq({ fromSpan: sp }) : undefined}
          onEvidenceFrom={canEdit ? (sp) => setEvidenceReq(sp) : undefined}
          onLinkAny={canEdit ? (sp) => setLinkAny(sp) : undefined}
          onMention={canEdit ? (req) => { mentionDone.current = false; setMention(req); } : undefined}
          onFocusSpan={onFocusSpan}
          trace={trace?.spans ?? null}
          open={dock.nbNote && full.notebook?.notes.some((n) => n.id === dock.nbNote) ? dock.nbNote : null}
          onOpen={(id) => patchDock({ nbNote: id ?? undefined })}
          editable={canEdit}
          extractors={extractors} allowRemote={!!props.allowRemoteExtractors} onAccept={canEdit ? acceptProposal : undefined}
          summary={
            <CaseSummary
              map={map}
              graph={graph}
              loops={loops}
              loopNames={loopNames}
              nm={nm}
              flags={flags.length}
              hidden={hiddenIds.length}
              selected={selected}
              notebook={full.notebook}
              onGo={goToPassage}
              onSelect={(id) => {
                setSelected({ nodes: [id], edges: [] });
                // below lg the map is the other tab: go there to show it
                if (!wide) setNbOn(false);
                if (view === 'canvas') setTimeout(() => canvas.current?.reveal([id]), wide ? 0 : 120);
              }}
              onLoop={(l) => {
                if (!wide) setNbOn(false);
                setPanel('loops');
                setTimeout(() => pickLoop(l), wide ? 0 : 120);
              }}
            />
          }
        />
      </div>
    </div>
  );
  const nbTabs = nbEnabled && !wide && (
    <div className="mb-2 flex gap-1" role="tablist" aria-label={C.notebook.tabs} data-testid="nb-tabs" data-print-hide>
      {([['map', C.notebook.mapTab], ['nb', C.notebook.toggle]] as const).map(([k, l]) => {
        const on = k === 'nb' ? nbOn : !nbOn;
        return (
          <button key={k} type="button" role="tab" id={`${dockId}-tab-${k}`} aria-selected={on} aria-controls={k === 'nb' ? `${dockId}-nb` : `${dockId}-main`} tabIndex={on ? 0 : -1} className={`bx-btn ax-tap flex-1 ${on ? 'bx-btn-on' : ''}`} onClick={() => on || setNbOn(k === 'nb')} onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setNbOn(!nbOn); setTimeout(() => document.getElementById(`${dockId}-tab-${nbOn ? 'map' : 'nb'}`)?.focus(), 0); } }} data-testid={`nb-tab-${k}`}>
            {l}
            {k === 'nb' && flags.length > 0 && <span className="bx-chip ml-1 px-1.5 text-xs" aria-label={count(flags.length, C.notebook.identifier)}>⚠ {flags.length}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <CitationsContext.Provider value={citations}>
    <div
      ref={ws}
      style={fitted ? { height: fitH! } : undefined}
      data-fit={fitted ? 'viewport' : undefined}
      className={`${map.layout.theme === 'print' ? 'ax-print' : ''} ${printing ? 'nb-printing' : ''} ${fitted ? 'flex flex-col' : ''} ${fsOn ? 'flex flex-col overflow-auto bg-[color:var(--bx-bg)] p-2 text-[color:var(--bx-ink)] sm:p-3' : ''} ${fs === 'overlay' ? 'fixed inset-0 z-[60]' : ''} ${fs === 'api' ? 'h-full w-full' : ''}`}
      data-testid="map-workspace"
      data-fullscreen={fs}
    >
      <h1 className="sr-only">{view === 'canvas' ? 'Map' : C.list.title}: {map.name}</h1>
      <div className="sr-only" role="status" aria-live="polite" data-testid="live">{live}</div>
      {toolbar}
      {nbTabs}
      {nbImport}
      {view === 'canvas' ? (
        <div ref={gridEl} className={grid} style={gridStyle}>
          <div id={`${dockId}-main`} className={`relative h-[60vh] min-h-[22rem] ${tall} overscroll-contain rounded-xl border border-[color:var(--bx-line)] overflow-hidden ${nbTab ? 'hidden' : ''}`} data-print-hide>
            <Suspense fallback={<p role="status" className="p-4 bx-muted">Loading the canvas…</p>}>
              <Canvas
                ref={canvas}
                map={map}
                dark={theme === 'dark'}
                print={map.layout.theme === 'print'}
                reducedMotion={reducedMotion}
                selected={selected}
                highlight={shownHighlight}
                loops={loops.loops}
                loopNames={loopNames}
                activeLoop={activeLoop}
                hulls={clusters}
                describeEdge={describeEdge}
                edgeTip={edgeTip}
                onConnect={(from, to) => openLink(from, to || null)}
                onSelect={(nodes, edges) => setSelected({ nodes, edges })}
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
          {nbCol}
          <div className={`${tall} relative min-h-0 min-w-0 flex ${nbTab ? 'hidden' : ''}`} data-print-hide>{resizer}{side}</div>
        </div>
      ) : (
        <div ref={gridEl} className={grid} style={gridStyle}>
          <div id={`${dockId}-main`} className={`min-w-0 ${nbTab ? 'hidden' : ''}`} data-print-hide>
            <ListView map={map} nm={nm} selected={selected} onSelect={(s) => setSelected(s)} onAddNode={() => setNewNodeReq({})} onAddEdge={() => openLink(null)} onAssoc={openAssoc} apply={apply} describeEdge={describeEdge} highlight={shownHighlight} announce={announce} />
          </div>
          {nbCol}
          <div className={`relative min-h-0 flex ${nbTab ? 'hidden' : ''}`} data-print-hide>{resizer}{side}</div>
        </div>
      )}
      <Dialog open={!!warn} onClose={() => setWarn(null)} title={C.notebook.warnTitle} testId="nb-warn">
        <p className="mb-2" data-testid="nb-warn-count">{C.notebook.warnLead} {count(flags.length, C.notebook.identifier)}.</p>
        <p className="mb-4 text-sm bx-muted">{C.notebook.warnHint}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="bx-btn-primary ax-tap"
            data-autofocus
            data-testid="nb-warn-label"
            onClick={() => {
              const w = warn;
              setWarn(null);
              const next = { ...full, notebook: labelAll(full.notebook), updated: new Date().toISOString() };
              doc.scrub((m) => ({ ...m, notebook: labelAll(m.notebook) }));
              announce(`${C.notebook.replaced} labels. ${C.notebook.replacedNote}`);
              w?.run(next);
            }}
          >
            {C.notebook.warnLabel}
          </button>
          <button type="button" className="bx-btn ax-tap" data-testid="nb-warn-anyway" onClick={() => { const w = warn; setWarn(null); w?.run(full); }}>{C.notebook.warnAnyway}</button>
          <button type="button" className="bx-btn ax-tap" data-testid="nb-warn-cancel" onClick={() => setWarn(null)}>{C.notebook.warnCancel}</button>
        </div>
      </Dialog>

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
              const sp = linkReq.span;
              apply((m) => (sp ? attachSpan(addEdge(m, e), sp, { kind: 'edge', id: e.id }).map : addEdge(m, e)));
              setLinkReq(null);
              setSelected({ nodes: [], edges: [e.id] });
              announce(`Added ${describeEdge(e)}.`);
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!evidenceReq} onClose={() => setEvidenceReq(null)} title={C.notebook.passages.evidenceTitle} wide testId="evidence-dialog">
        {evidenceReq && <EvidencePicker map={map} span={evidenceReq} nm={nm} onPick={(t) => addEvidence(evidenceReq, t)} onCancel={() => setEvidenceReq(null)} />}
      </Dialog>
      {/* SL28 point 1: Link to… over every kind (a new map link is one choice among them) */}
      <Dialog open={!!linkAny} onClose={() => setLinkAny(null)} title={C.notebook.passages.linkTitle} wide testId="link-any-dialog">
        {linkAny && (
          <TargetPicker
            ctx={targetCtx}
            quote={linkAny.quote}
            lead={C.notebook.passages.linkLead}
            note={linkAny.note}
            onPick={(t) => linkTo(linkAny, t)}
            onCancel={() => setLinkAny(null)}
            top={
              map.nodes.filter((n) => n.kind !== 'note').length >= 1 ? (
                <button type="button" className="bx-btn ax-tap mb-2" onClick={() => { const sp = linkAny; setLinkAny(null); setLinkReq({ from: null, to: null, span: sp }); }} data-testid="link-any-new">{C.notebook.passages.linkNew}</button>
              ) : undefined
            }
          />
        )}
      </Dialog>
      {/* SL28 point 1: "@" in a note — the same picker; the choice becomes a chip (an empty span with its target) */}
      <Dialog open={!!mention} onClose={closeMention} title={C.notebook.passages.mentionTitle} wide testId="mention-dialog">
        {mention && <TargetPicker ctx={targetCtx} lead={C.notebook.passages.mentionLead} note={mention.note.id} onPick={(t) => mentionPick(t)} onCancel={closeMention} testId="mention-picker" />}
      </Dialog>
      <Dialog open={!!itemOpen} onClose={() => setItemOpen(null)} title={itemOpen ? targetName(itemOpen) : ''} wide testId="item-dialog">
        {itemOpen && <ItemView t={itemOpen} map={full} />}
      </Dialog>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} canImage={view === 'canvas'} onExport={exportReport} />
      <Dialog open={!!delAsk} onClose={() => setDelAsk(null)} title={C.notebook.passages.deleteTitle} testId="delete-spans-dialog">
        {delAsk && (
          <>
            <p className="mb-3" data-testid="delete-spans-lead">{count(delAsk.n, 'passage')} {C.notebook.passages.deleteLead.replace(/^passages /, '')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="bx-btn-primary ax-tap" data-autofocus onClick={() => removeSelection('keep')} data-testid="delete-spans-keep">{C.notebook.passages.deleteKeep}</button>
              <button type="button" className="bx-btn ax-tap" onClick={() => removeSelection('remove')} data-testid="delete-spans-remove">{C.notebook.passages.deleteRemove}</button>
              <button type="button" className="bx-btn ax-tap" onClick={() => setDelAsk(null)}>{C.notebook.passages.deleteCancel}</button>
            </div>
          </>
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
    </CitationsContext.Provider>
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
  const [draft, setDraft] = useState<NodeDraft>(() => ({
    kind: req.kind === 'note' ? 'note' : 'circumstance',
    code_status: req.preset?.code_status ?? 'undetermined',
    code: req.preset?.code ?? null,
    type: req.preset?.type ?? null,
    ref: null,
    // SL27: made from a selection, the label starts as the selected words (editable)
    label: req.preset ? docFromText(req.preset.label) : req.fromSpan ? docFromText(req.fromSpan.quote) : emptyDoc(),
    circumstance: emptyDoc(),
    severity: null,
    since: null,
    notes: emptyDoc(),
    style: {},
    pinned: false,
  }));
  // SL27: from a selection nothing is chosen for the user: a suggested code, Not sure yet, Other, or a search first
  const [choice, setChoice] = useState<FromChoice | null>(req.preset ? (req.preset.code ? { kind: 'code', code: req.preset.code } : req.preset.code_status === 'other' ? { kind: 'other' } : { kind: 'undetermined' }) : null);
  const pick = (c: FromChoice) => {
    setChoice(c);
    if (c.kind === 'code') setDraft((d) => ({ ...d, code_status: 'sdoh', code: c.code, type: null }));
    else if (c.kind === 'undetermined') setDraft((d) => ({ ...d, code_status: 'undetermined', code: null, type: null }));
    else if (c.kind === 'other') setDraft((d) => ({ ...d, code_status: 'other', code: null }));
    else setDraft((d) => ({ ...d, code_status: 'sdoh', code: null }));
  };
  const fromText = !!req.fromSpan;
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
          {fromText && (
            <>
              <p className="mb-2 text-sm">{C.notebook.passages.fromText} <span className="sx-span">“{req.fromSpan!.quote.length > 160 ? `${req.fromSpan!.quote.slice(0, 159)}…` : req.fromSpan!.quote}”</span></p>
              <SuggestPanel text={req.fromSpan!.quote} choice={choice} onPick={pick} />
            </>
          )}
          {(!fromText || choice) && (
            <NodeFields draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p, ...(p.code_status && p.code_status !== 'sdoh' && !p.code ? { code: null } : {}) }))} pickerOpen={!fromText || choice?.kind === 'search'} only={only} suggested={offered} compact />
          )}
          {fromText && !choice && <p className="text-sm bx-muted" data-testid="from-pick-first">{C.notebook.passages.pickFirst}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" className="bx-btn-primary ax-tap" data-testid="node-submit" disabled={(fromText && !choice) || (draft.code_status === 'sdoh' && !draft.code)}>
              {req.kind === 'note' ? C.node.addNote : C.node.add}
            </button>
            <button type="button" className="bx-btn ax-tap" onClick={onClose}>Cancel</button>
          </div>
        </form>
  );
}
