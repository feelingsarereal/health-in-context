import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import cytoscape, { type Core, type EdgeCollection, type EdgeSingular, type ElementDefinition } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import cySvg from 'cytoscape-svg';
import { codeMap, colourGroup } from '../../lib/data/scheme';
import { GROUP_STYLE, NEUTRAL, borderFor, fillFor } from '../../lib/palette';
import { dominantStyle } from '../../lib/model/rich';
import { nodeName } from '../../lib/model/interchange';
import { useCoarsePointer, useNarrowViewport } from '../../lib/pointer';
import type { SdohMap, MapEdge, NodeText } from '../../lib/model/map';
import type { Loop } from '../../lib/analysis';
import { S } from '../../lib/data/core';
import { C } from '../../lib/copy';
import { nodeLines, nodeTextParts } from './nodeText';

cytoscape.use(fcose);
let elkReady: Promise<void> | null = null;
/** ELK is large (~1.4 MB); it loads only when someone picks the ELK stress layout. */
function loadElk() {
  elkReady ??= import('cytoscape-elk').then((m) => cytoscape.use(m.default));
  return elkReady;
}
cytoscape.use(cySvg);

export interface Highlight {
  nodes: Set<string>;
  edges: Set<string>;
  out?: Set<string>;
  in?: Set<string>;
}
export interface CanvasHandle {
  layout(scope: 'unpinned' | 'all' | 'selection', engine: 'fcose' | 'elk-stress'): void;
  circle(ids: string[]): void;
  fit(): void;
  /** K6 D3: fit these circumstances (a loop) with padding, capped like Fit */
  fitTo(ids: string[]): void;
  zoom(f: number): void;
  png(): string;
  svg(): string;
  /** SL16: bring these circumstances into view (centred, zoom kept) when any is outside it */
  reveal(ids: string[]): void;
  /** SL17: after the canvas changed size (full screen, the dock): resize and fit */
  refit(): void;
  /** SL17: where a circumstance or link is drawn, in px within the canvas (the keyboard peek opens there) */
  where(id: string): { x: number; y: number } | null;
}
/** SL17: a right-click, Ctrl-click or long-press on a circumstance or a link, at x, y px within the canvas */
export interface PeekRequest {
  kind: 'node' | 'edge';
  id: string;
  x: number;
  y: number;
}
interface Props {
  map: SdohMap;
  dark: boolean;
  print: boolean;
  reducedMotion: boolean;
  selected: { nodes: string[]; edges: string[] };
  highlight: Highlight | null;
  loops: Loop[];
  loopNames: Map<string, string>;
  activeLoop: string | null;
  hulls: string[][] | null;
  onSelect(nodes: string[], edges: string[]): void;
  onAddAt(pos: { x: number; y: number }): void;
  /** the ⋯ button: the association menu */
  onContext(nodeId: string): void;
  /** SL17: right-click, Ctrl-click or long-press on a circumstance or a link: the read-only peek */
  onPeek(req: PeekRequest): void;
  nodeText: NodeText;
  onMove(pos: Record<string, { x: number; y: number }>, pin: boolean | undefined, origin: 'drag' | 'layout'): void;
  onLoop(key: string): void;
  /** UI-17 drag-to-connect: dropped the connector handle of `from` onto `to` */
  onConnect(from: string, to: string): void;
  describeEdge(e: MapEdge): string;
  /** UI-18: tooltip text for an override or needs-review edge */
  edgeTip(e: MapEdge): string | null;
}

const titleOf = (c: string) => codeMap.get(c)?.title;
const PIN = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="5" r="4" fill="#a3243b" stroke="#fff" stroke-width="1.2"/><path d="M7 9v5" stroke="#a3243b" stroke-width="1.6"/></svg>');

/** before a box's text is measured, this size stands in */
const EST = { w: 150, h: 56 };

function elements(map: SdohMap, dark: boolean, mode: NodeText, sizes: Map<string, { w: number; h: number }>): ElementDefinition[] {
  const out: ElementDefinition[] = [];
  for (const n of map.nodes) {
    const gid = n.code ? colourGroup(n.code) : undefined;
    const hue = (n.code_status === 'sdoh' && gid && GROUP_STYLE[gid]?.hue) || NEUTRAL.hue;
    const coded = n.code_status === 'sdoh' && !!n.code;
    const st = dominantStyle(n.label.content.some((p) => p.content?.length) ? n.label : n.circumstance);
    const fill = n.style.fill ? fillFor(n.style.fill, dark) : n.kind === 'note' ? (dark ? '#3a3320' : '#fdf3c4') : coded ? fillFor(hue, dark) : dark ? '#2a2620' : '#efebe4';
    const sz = sizes.get(n.id) ?? EST;
    out.push({
      group: 'nodes',
      data: {
        id: n.id,
        label: nodeLines(n, mode),
        w: sz.w,
        h: sz.h,
        bg: fill,
        border: n.kind === 'note' ? (dark ? '#8a7a40' : '#c9b458') : coded ? borderFor(hue, dark) : dark ? '#b3aca1' : '#5d5750',
        fw: st.bold ? 700 : 500,
        fs: st.italic ? 'italic' : 'normal',
        tc: st.color ?? (dark ? '#efeae2' : '#1f1b16'),
        size: st.fontSize ? parseInt(st.fontSize) : 13,
      },
      position: { x: n.x, y: n.y },
      classes: [n.kind === 'note' ? 'note' : n.code_status, n.pinned ? 'pinned' : ''].filter(Boolean).join(' '),
    });
  }
  for (const e of map.edges) {
    const w = Math.abs(e.weight);
    out.push({
      group: 'edges',
      data: {
        id: e.id,
        source: e.from,
        target: e.to,
        pol: e.polarity,
        // the mid-edge mark: ‖ for a delay (UI-13) and ⚑ for an override (UI-18), kept apart from line style and colour
        mid: [e.delay ? '‖' : '', e.basis === 'override' ? '⚑' : e.basis === 'needs-review' ? '⚑?' : ''].filter(Boolean).join(' '),
        // what is painted: K8 folds the polarity into the mid badge on a short edge (see fitMarks)
        midShown: [e.delay ? '‖' : '', e.basis === 'override' ? '⚑' : e.basis === 'needs-review' ? '⚑?' : ''].filter(Boolean).join(' '),
        polShown: e.polarity,
        width: map.layout.thickness && e.style.widthByWeight !== false ? 1 + 5 * w : 2.5,
        color: e.style.color ?? (e.polarity === '+' ? (dark ? '#8fb4ea' : '#2f5d9a') : dark ? '#f2a0ae' : '#a3243b'),
        line: e.style.line ?? 'solid',
        curve: e.style.route === 'straight' ? 'straight' : 'bezier',
      },
      classes: [e.polarity === '+' ? 'pos' : 'neg', e.basis === 'needs-review' ? 'review' : e.basis === 'override' ? 'override' : 'evidence'].join(' '),
    });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stylesheet(dark: boolean, print: boolean): any[] {
  const ink = dark ? '#efeae2' : '#1f1b16';
  const bg = dark ? '#15130f' : '#faf8f4';
  return [
    {
      selector: 'node',
      style: {
        shape: 'round-rectangle',
        'background-color': print ? '#ffffff' : 'data(bg)',
        'border-color': print ? '#1f1b16' : 'data(border)',
        'border-width': 1.5,
        // SL17: on screen the box's text is the HTML layer (title, code line, circumstance in their own weights); the
        // canvas label is the same text flat, drawn only into PNG and SVG exports (see withLabels)
        label: 'data(label)',
        'text-opacity': 0,
        'text-wrap': 'wrap',
        'text-max-width': '150px',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-family': '"Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif',
        'font-size': 11,
        'font-weight': 'data(fw)' as unknown as number,
        'font-style': 'data(fs)' as unknown as 'normal',
        color: print ? '#1f1b16' : 'data(tc)',
        // the size of the HTML text, measured
        width: 'data(w)',
        height: 'data(h)',
        padding: '0px',
        'line-height': 1.25,
      },
    },
    { selector: 'node.other, node.undetermined', style: { 'border-style': 'dashed', 'border-width': 2 } },
    { selector: 'node.note', style: { shape: 'rectangle', 'border-style': 'dotted', 'text-halign': 'center', 'font-size': 12 } },
    {
      selector: 'node.pinned',
      style: { 'background-image': PIN, 'background-width': '14px', 'background-height': '14px', 'background-position-x': '100%', 'background-position-y': '0%', 'background-clip': 'none', 'bounds-expansion': 8, 'background-image-containment': 'over' },
    },
    { selector: 'node:selected', style: { 'border-width': 4, 'border-color': dark ? '#8fb4ea' : '#2f5d9a', 'border-style': 'solid' } },
    {
      selector: 'edge',
      style: {
        'curve-style': 'data(curve)' as unknown as 'bezier',
        width: 'data(width)',
        'line-color': print ? '#1f1b16' : 'data(color)',
        'line-style': 'data(line)' as unknown as 'solid',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': print ? '#1f1b16' : 'data(color)',
        'arrow-scale': 1.1,
        'target-label': 'data(polShown)',
        'target-text-offset': POL_OFFSET,
        'font-weight': 700,
        color: ink,
        'text-background-color': bg,
        'text-background-opacity': 1,
        'text-background-padding': '2px',
        'text-background-shape': 'round-rectangle',
        label: 'data(midShown)',
        'font-size': 16,
        'text-rotation': 'autorotate',
      },
    },
    // Daniel's call (K2 decision 5): the ⚑ is larger and sits in a haloed badge, so overrides stay findable when zoomed out
    {
      selector: 'edge.override, edge.review',
      style: {
        'font-size': 22,
        'text-background-padding': '4px',
        'text-border-width': 2,
        'text-border-color': print ? '#1f1b16' : dark ? '#f2a0ae' : '#a3243b',
        'text-border-opacity': 1,
        'text-background-shape': 'round-rectangle',
      },
    },
    { selector: 'edge.review', style: { 'underlay-color': dark ? '#fbbf24' : '#b45309', 'underlay-opacity': 0.35, 'underlay-padding': 5 } },
    { selector: 'edge:selected', style: { 'overlay-color': dark ? '#8fb4ea' : '#2f5d9a', 'overlay-opacity': 0.25, 'overlay-padding': 6 } },
    { selector: '.dim', style: { opacity: 0.15 } },
    { selector: 'node.hl', style: { 'border-width': 4, 'border-color': dark ? '#efeae2' : '#1f1b16' } },
    { selector: 'edge.hl', style: { 'z-index': 10 } },
    { selector: 'node.hl-out', style: { 'border-width': 4, 'border-color': dark ? '#5eead4' : '#0f766e', 'border-style': 'double' } },
    { selector: 'node.hl-in', style: { 'border-width': 4, 'border-color': dark ? '#fbbf24' : '#b45309', 'border-style': 'double' } },
  ];
}

/** Convex hull (Andrew's monotone chain) for the cluster outlines. */
function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Rendered-coordinate edge methods Cytoscape has but its typings omit. */
type RenderedEdge = { renderedSourceEndpoint(): { x: number; y: number }; renderedTargetEndpoint(): { x: number; y: number }; renderedMidpoint(): { x: number; y: number } };

/** The ⋯ and connector buttons are this big at zoom 1 and scale with zoom between the 44 px touch-target floor and
 *  72 px. They never hide (K6 D1: hiding them below 44 px made drag-to-link vanish after Fit on four or more nodes). */
const HANDLE_PX = 52;
/** K14: a glyph shows up to this many characters of the loop's name over two lines (K7 cut it to 8); the full name is in the tooltip */
const GLYPH_MAX = 24;
/** K14: a label longer than this wraps onto a second line, at the space nearest its middle */
const GLYPH_LINE = 12;
/**
 * The canvas glyph's label: the loop's name, cut at a word to GLYPH_MAX characters with "…" (a hard cut when one word is
 * too long), on one line or, past GLYPH_LINE, two lines joined by "\n".
 */
export function glyphLabel(name: string) {
  let s = name.trim();
  if (s.length > GLYPH_MAX) {
    const sp = s.lastIndexOf(' ', GLYPH_MAX - 1);
    s = `${(sp > GLYPH_MAX / 2 ? s.slice(0, sp) : s.slice(0, GLYPH_MAX - 1)).trimEnd()}…`;
  }
  if (s.length <= GLYPH_LINE) return s;
  const mid = s.length / 2;
  let at = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  return at < 0 ? s : `${s.slice(0, at)}\n${s.slice(at + 1)}`;
}
/** half the glyph's size at scale 1: 11 px bold runs about 7 px a character (the ↻ on the first line), 8 px padding each
 *  side; one line is 30 px tall, two are 38 */
function glyphHalf(label: string) {
  const lines = label.split('\n');
  const chars = Math.max(lines[0].length + 1, ...lines.slice(1).map((l) => l.length));
  return { hw: Math.max(15, (chars * 7 + 16) / 2), hh: lines.length > 1 ? 19 : 15 };
}
/** K14: under 768 px the glyphs scale with the canvas zoom, as the boxes do, within these bounds */
const glyphScale = (narrow: boolean, zoom: number) => (narrow ? Math.max(0.3, Math.min(1.5, zoom)) : 1);
const handleSize = (zoom: number) => Math.max(44, Math.min(72, Math.round(HANDLE_PX * zoom)));
/** K6 D10: a link whose straight line would run through another circumstance bends around it, by this much clearance */
const BEND_CLEAR = 18;

/** SL17: the canvas draws the boxes' flat text only for an export; on screen the HTML layer draws it */
function withLabels<T>(cy: Core, f: (cy: Core) => T): T {
  cy.nodes().style('text-opacity', 1);
  try {
    return f(cy);
  } finally {
    cy.nodes().removeStyle('text-opacity');
  }
}

function fitCapped(cy: Core, eles = cy.nodes(), pad = 50) {
  if (!eles.length) return;
  cy.fit(eles, pad);
  if (cy.zoom() > 1.2) {
    cy.zoom(1.2);
    cy.center(eles);
  }
}

/**
 * K6 D10: bend a link around any circumstance its straight line would cross, without moving anything. A one-point
 * (quadratic) bezier strays 2t(1−t)·c from the line at t, so c is the clearance needed where the blocking box sits,
 * divided by that; the side needing less bend wins. Links between the same two circumstances (either way) bend as a
 * group, side by side, 26 px apart. Straight-routed links are left alone, and so is a group with nothing in its way
 * (Cytoscape spreads parallel links itself). The bend is kept in scratch for the outline (data-bend).
 */
/** the +/− label sits this many model px back from the arrowhead */
const POL_OFFSET = 26;

/**
 * K8: on a short edge the +/− label would be drawn over the mid-edge badge and hide its ⚑ (UI-18 needs every override
 * visible). There one combined badge ("+ ⚑", "− ‖ ⚑") replaces both. Worked in model units, which the labels, the offset
 * and the edge all share, so zooming never changes the outcome; rerun after routing, on every sync.
 */
function fitMarks(cy: Core) {
  cy.edges().forEach((e) => {
    const mid: string = e.data('mid');
    const pol: string = e.data('pol');
    let short = false;
    if (mid) {
      const big = e.hasClass('override') || e.hasClass('review');
      const s = e.sourceEndpoint();
      const t = e.targetEndpoint();
      const m = e.midpoint();
      const len = Math.hypot(m.x - s.x, m.y - s.y) + Math.hypot(t.x - m.x, t.y - m.y);
      // half the badge: about 0.6 em a character plus 0.4 em for the wide ⚑, with its padding and border
      const halfMid = ((mid.length * 0.6 + 0.4) * (big ? 22 : 16)) / 2 + (big ? 6 : 2);
      short = len / 2 - POL_OFFSET < halfMid + 7 + 4; // 7: half the +/− label; 4: a gap
    }
    const midShown = short ? `${pol} ${mid}` : mid;
    const polShown = short ? '' : pol;
    if (e.data('midShown') !== midShown || e.data('polShown') !== polShown) e.data({ midShown, polShown });
  });
}

function routeEdges(cy: Core) {
  const SPREAD = 26;
  const groups = new Map<string, EdgeCollection>();
  cy.edges().forEach((e) => {
    const [a, b] = [e.source().id(), e.target().id()].sort();
    const k = `${a}|${b}`;
    groups.set(k, (groups.get(k) ?? cy.collection()).union(e));
  });
  const clear = (e: EdgeSingular) => {
    if (e.scratch('bend')) e.removeStyle('curve-style control-point-distances control-point-weights');
    e.scratch('bend', 0);
  };
  for (const [k, es] of groups) {
    const [aId, bId] = k.split('|');
    const s = cy.getElementById(aId);
    const t = cy.getElementById(bId);
    const A = s.position();
    const B = t.position();
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    if (aId === bId || L < 1 || es.some((e) => e.data('curve') === 'straight')) {
      es.forEach(clear);
      continue;
    }
    const ux = (B.x - A.x) / L;
    const uy = (B.y - A.y) / L;
    let up = 0;
    let down = 0;
    cy.nodes().forEach((n) => {
      if (n.id() === aId || n.id() === bId) return;
      const bb = n.boundingBox({});
      const corners = [[bb.x1 - BEND_CLEAR, bb.y1 - BEND_CLEAR], [bb.x2 + BEND_CLEAR, bb.y1 - BEND_CLEAR], [bb.x1 - BEND_CLEAR, bb.y2 + BEND_CLEAR], [bb.x2 + BEND_CLEAR, bb.y2 + BEND_CLEAR]];
      const along = corners.map(([x, y]) => (x - A.x) * ux + (y - A.y) * uy);
      const across = corners.map(([x, y]) => -(x - A.x) * uy + (y - A.y) * ux);
      if (!(Math.min(...across) < 0 && Math.max(...across) > 0 && Math.max(...along) > 0 && Math.min(...along) < L)) return;
      const tm = Math.min(0.85, Math.max(0.15, (((bb.x1 + bb.x2) / 2 - A.x) * ux + ((bb.y1 + bb.y2) / 2 - A.y) * uy) / L));
      const kk = 2 * tm * (1 - tm);
      up = Math.max(up, Math.max(...across) / kk);
      down = Math.max(down, -Math.min(...across) / kk);
    });
    if (!up && !down) {
      es.forEach(clear);
      continue;
    }
    const side = up <= down ? 1 : -1;
    const base = up <= down ? up : down;
    es.forEach((e, i) => {
      // the i-th link of the group sits i spreads further out; a link drawn b → a measures distance the other way
      const c = side * (base + (i * SPREAD) / 0.5);
      const bend = Math.round(e.source().id() === aId ? c : -c);
      e.style({ 'curve-style': 'unbundled-bezier', 'control-point-distances': bend, 'control-point-weights': 0.5 });
      e.scratch('bend', bend);
    });
  }
}

const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const P = useRef(props);
  P.current = props;
  const syncing = useRef(false);
  const [overlay, setOverlay] = useState<{
    loops: { key: string; x: number; y: number; kind: string; label: string; scale: number }[];
    more: { x: number; y: number } | null;
    handle: { x: number; y: number } | null;
    /** rendered size of the ⋯ and connector buttons (px) */
    size: number;
    tip: { x: number; y: number; text: string } | null;
    hulls: string[];
    /** rounded rendered position and box (the outline); fx, fy unrounded (the HTML node text sits there) */
    pos: Record<string, { x: number; y: number; bb: string; fx: number; fy: number }>;
    ends: Record<string, string>;
    /** rendered midpoint x,y and the K6 bend, per edge (outline only) */
    mids: Record<string, string>;
    shown: Record<string, { mid: string; pol: string }>;
    zoom: number;
  }>({ loops: [], more: null, handle: null, size: HANDLE_PX, tip: null, hulls: [], pos: {}, ends: {}, mids: {}, shown: {}, zoom: 1 });
  const coarse = useCoarsePointer();
  const narrow = useNarrowViewport();
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;
  const hover = useRef<string | null>(null);
  /** K4 D5: the selected edge whose tooltip the pointer has moved away from; it stays hidden until the selection changes */
  const tipGone = useRef<string | null>(null);
  const [drag, setDrag] = useState<{ from: string; x0: number; y0: number; x: number; y: number } | null>(null);
  /** SL17: each box's size is its HTML text's, measured at zoom 1 */
  const sizes = useRef(new Map<string, { w: number; h: number }>());
  const textLayer = useRef<HTMLDivElement>(null);

  const recompute = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const p = P.current;
    const shownLoops = p.activeLoop ? p.loops.filter((l) => l.key === p.activeLoop) : p.loops.slice(0, 24);
    const loops = shownLoops.flatMap((l) => {
      const ps = l.nodes.map((id) => cy.getElementById(id)).filter((n) => n.nonempty()).map((n) => n.renderedPosition());
      if (!ps.length) return [];
      const label = glyphLabel(p.loopNames.get(l.key) ?? l.kind);
      const k = glyphScale(narrowRef.current, cy.zoom());
      const h = glyphHalf(label);
      return [{ key: l.key, kind: l.kind, label, scale: k, hw: h.hw * k, hh: h.hh * k, x: ps.reduce((s, q) => s + q.x, 0) / ps.length, y: ps.reduce((s, q) => s + q.y, 0) / ps.length }];
    });
    // K7: every edge's marks, as circles in rendered px: the mid-edge badge (⚑, ‖) and the +/− polarity label, which sits
    // 26 model px back from the arrowhead along the edge (approximated toward the midpoint on a bent edge)
    const marks: { x: number; y: number; r: number }[] = [];
    {
      const z = cy.zoom();
      cy.edges().forEach((e) => {
        const r = e as unknown as RenderedEdge;
        const m = r.renderedMidpoint();
        const shown: string = e.data('midShown');
        if (shown) marks.push({ ...m, r: (e.hasClass('override') || e.hasClass('review') ? 18 : 12) * z * (shown.length > 2 ? 1.3 : 1) });
        if (!e.data('polShown')) return; // K8: folded into the mid badge
        const t = r.renderedTargetEndpoint();
        const len = Math.hypot(m.x - t.x, m.y - t.y) || 1;
        const off = Math.min(POL_OFFSET * z, len);
        marks.push({ x: t.x + ((m.x - t.x) / len) * off, y: t.y + ((m.y - t.y) / len) * off, r: 11 * z });
      });
    }
    // D2: the ⋯ button and the connector handle sit outside the node's box, at the candidate spots farthest from the
    // node's own edge endpoints, other nodes and the canvas edge, so they never cover the label or an edge (K7: nor a mark).
    let more = null;
    let handle = null;
    const size = handleSize(cy.zoom());
    if (p.selected.nodes.length === 1 && !p.selected.edges.length) {
      const n = cy.getElementById(p.selected.nodes[0]);
      if (n.nonempty()) {
        // the whole button stays clear of the node's box, selection overlay included, by 8 px
        const bb = n.renderedBoundingBox({});
        const g = size / 2 + 8;
        const cx = (bb.x1 + bb.x2) / 2;
        const cyy = (bb.y1 + bb.y2) / 2;
        const ring = (g: number) => [
          { x: bb.x2 + g, y: bb.y1 }, { x: bb.x2 + g, y: bb.y2 }, { x: bb.x1 - g, y: bb.y1 }, { x: bb.x1 - g, y: bb.y2 },
          { x: cx, y: bb.y1 - g }, { x: cx, y: bb.y2 + g }, { x: bb.x2 + g, y: cyy }, { x: bb.x1 - g, y: cyy },
          // K7: above and below the box's corners too
          { x: bb.x1 + size / 2, y: bb.y1 - g }, { x: bb.x2 - size / 2, y: bb.y1 - g }, { x: bb.x1 + size / 2, y: bb.y2 + g }, { x: bb.x2 - size / 2, y: bb.y2 + g },
        ];
        // K7: a second ring one button (and a 6 px gap) further out, used only when the near spots are covered (it costs 15 points)
        const cands = [...ring(g), ...ring(g + size + 6).map((c) => ({ ...c, far: true }))];
        const ends: { x: number; y: number }[] = [];
        n.connectedEdges().forEach((e) => {
          const r = e as unknown as RenderedEdge;
          ends.push(r.renderedSourceEndpoint(), r.renderedTargetEndpoint(), r.renderedMidpoint());
        });
        const boxes = cy.nodes().filter((o) => o.id() !== n.id()).map((o) => o.renderedBoundingBox({}));
        const W = cy.width();
        const H = cy.height();
        const score = (c: { x: number; y: number; far?: boolean }) => {
          let d = Math.min(60, ...ends.map((q) => Math.hypot(q.x - c.x, q.y - c.y))) - (c.far ? 15 : 0);
          for (const b of boxes) if (c.x > b.x1 - size / 2 && c.x < b.x2 + size / 2 && c.y > b.y1 - size / 2 && c.y < b.y2 + size / 2) d -= 100;
          // the button is a square: the nearest point of the square to the mark's centre must be clear of its circle
          for (const q of marks) if (Math.hypot(Math.max(Math.abs(c.x - q.x) - size / 2, 0), Math.max(Math.abs(c.y - q.y) - size / 2, 0)) < q.r) d -= 80;
          if (c.x < size / 2 + 2 || c.y < size / 2 + 2 || c.x > W - size / 2 - 2 || c.y > H - size / 2 - 2) d -= 50;
          return d;
        };
        const ranked = cands.map((c, i) => ({ c, s: score(c) - i * 0.01 })).sort((a, b) => b.s - a.s);
        more = ranked[0].c;
        // the two buttons never overlap each other
        handle = (ranked.find((r) => Math.abs(r.c.x - more!.x) >= size + 4 || Math.abs(r.c.y - more!.y) >= size + 4) ?? ranked[1]).c;
      }
    }
    // K6 D7: a loop glyph (30 px; K14: two lines, and scaled on a phone) starts at its loop's centre and is nudged to the nearest spot clear of every node box,
    // every edge's mid-edge mark (⚑, ‖), the ⋯ and connector buttons and the glyphs already placed, scored like the handles
    {
      // K7: a glyph is a pill, hw wide either side of its centre and hh up and down; 4 px clearance all round
      const C = 4;
      const nodeBoxes = cy.nodes().map((n) => n.renderedBoundingBox({}));
      const taken: { x: number; y: number; hw: number; hh: number }[] = [...[more, handle].filter((c): c is { x: number; y: number } => !!c).map((c) => ({ ...c, hw: size / 2, hh: size / 2 }))];
      const W = cy.width();
      const H = cy.height();
      for (const g of loops) {
        const cands = [{ x: g.x, y: g.y }];
        for (const r of [36, 60, 90, 130]) for (let i = 0; i < 12; i++) cands.push({ x: g.x + (r + g.hw - 15) * Math.cos((i * Math.PI) / 6), y: g.y + (r + g.hh - 15) * Math.sin((i * Math.PI) / 6) });
        const score = (c: { x: number; y: number }) => {
          let d = -Math.hypot(c.x - g.x, c.y - g.y);
          for (const b of nodeBoxes) if (c.x + g.hw + C > b.x1 && c.x - g.hw - C < b.x2 && c.y + g.hh + C > b.y1 && c.y - g.hh - C < b.y2) d -= 1000;
          for (const o of taken) if (Math.abs(c.x - o.x) < g.hw + o.hw + C && Math.abs(c.y - o.y) < g.hh + o.hh + C) d -= 500;
          for (const q of marks) if (Math.abs(c.x - q.x) < g.hw + q.r + C && Math.abs(c.y - q.y) < g.hh + q.r + C) d -= 300;
          if (c.x < g.hw + C || c.y < g.hh + C || c.x > W - g.hw - C || c.y > H - g.hh - C) d -= 50;
          return d;
        };
        const best = cands.reduce((a, c) => (score(c) > score(a) ? c : a), cands[0]);
        g.x = best.x;
        g.y = best.y;
        taken.push({ ...best, hw: g.hw, hh: g.hh });
      }
    }
    // UI-18 tooltip: the hovered (or the single selected) override edge shows its reason
    let tip = null;
    const sel = p.selected.edges.length === 1 && !p.selected.nodes.length ? p.selected.edges[0] : null;
    if (tipGone.current && sel !== tipGone.current) tipGone.current = null; // the selection changed
    const tipId = hover.current ?? (sel !== tipGone.current ? sel : null);
    if (tipId) {
      const e = cy.getElementById(tipId);
      const me = p.map.edges.find((x) => x.id === tipId);
      const text = me ? p.edgeTip(me) : null;
      if (e.nonempty() && text) {
        const m = (e as unknown as RenderedEdge).renderedMidpoint();
        tip = { x: m.x, y: m.y, text };
      }
    }
    // rendered geometry, mirrored on the outline for tests and assistive tech (no map text involved)
    const pos: Record<string, { x: number; y: number; bb: string; fx: number; fy: number }> = {};
    cy.nodes().forEach((n) => {
      const q = n.renderedPosition();
      const b = n.renderedBoundingBox({});
      pos[n.id()] = { x: Math.round(q.x), y: Math.round(q.y), bb: [b.x1, b.y1, b.x2, b.y2].map(Math.round).join(','), fx: q.x, fy: q.y };
    });
    const endsMap: Record<string, string> = {};
    const midMap: Record<string, string> = {};
    const shownMap: Record<string, { mid: string; pol: string }> = {};
    cy.edges().forEach((e) => {
      const r = e as unknown as RenderedEdge;
      const a = r.renderedSourceEndpoint();
      const b = r.renderedTargetEndpoint();
      const m = r.renderedMidpoint();
      endsMap[e.id()] = [a.x, a.y, b.x, b.y].map(Math.round).join(',');
      midMap[e.id()] = `${Math.round(m.x)},${Math.round(m.y)},${e.scratch('bend') ?? 0}`;
      shownMap[e.id()] = { mid: e.data('midShown') ?? '', pol: e.data('polShown') ?? '' };
    });
    const hulls = (p.hulls ?? []).map((ids) => {
      const pts: [number, number][] = [];
      for (const id of ids) {
        const n = cy.getElementById(id);
        if (n.empty()) continue;
        const b = n.renderedBoundingBox({});
        const pad = 12;
        pts.push([b.x1 - pad, b.y1 - pad], [b.x2 + pad, b.y1 - pad], [b.x1 - pad, b.y2 + pad], [b.x2 + pad, b.y2 + pad]);
      }
      return hull(pts).map((q) => q.join(',')).join(' ');
    });
    setOverlay({ loops, more, handle, size, tip, hulls, pos, ends: endsMap, mids: midMap, shown: shownMap, zoom: cy.zoom() });
  }, []);

  // SL17: measure each box's HTML text at zoom 1 (offsetWidth and offsetHeight ignore the zoom transform) and size the
  // box to it; the mount and sync effects read the sizes as they build the elements
  const measure = useCallback(() => {
    const layer = textLayer.current;
    let changed = false;
    layer?.querySelectorAll<HTMLElement>('[data-node-text]').forEach((el) => {
      const id = el.dataset.nodeText!;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const cur = sizes.current.get(id);
      if (!cur || cur.w !== w || cur.h !== h) {
        sizes.current.set(id, { w, h });
        changed = true;
      }
    });
    const cy = cyRef.current;
    if (!changed || !cy) return;
    cy.batch(() => {
      sizes.current.forEach((sz, id) => {
        const n = cy.getElementById(id);
        if (n.nonempty() && (n.data('w') !== sz.w || n.data('h') !== sz.h)) n.data(sz);
      });
    });
    routeEdges(cy);
    fitMarks(cy);
    recompute();
  }, [recompute]);
  useLayoutEffect(measure, [props.map, props.nodeText, measure]);

  // mount
  useEffect(() => {
    const cy = cytoscape({
      container: box.current!,
      elements: elements(P.current.map, P.current.dark, P.current.nodeText, sizes.current),
      style: stylesheet(P.current.dark, P.current.print),
      layout: { name: 'preset' },
      boxSelectionEnabled: true,
      minZoom: 0.2,
      maxZoom: 3,
      // K6 D2: one wheel tick was about 2.5×; damped so a tick is a small step
      wheelSensitivity: 0.2,
    });
    cyRef.current = cy;
    if (P.current.map.nodes.length) fitCapped(cy);
    else cy.zoom(1).center();
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };
    cy.on('render pan zoom position', schedule);
    const emitSel = () => {
      if (syncing.current) return;
      P.current.onSelect(cy.$('node:selected').map((n) => n.id()), cy.$('edge:selected').map((e) => e.id()));
    };
    cy.on('select unselect', () => setTimeout(emitSel, 0));
    cy.on('dbltap', (e) => {
      if (e.target === cy) P.current.onAddAt(e.position);
    });
    // SL17: right-click, Ctrl-click and long-press open the read-only peek (Daniel, 2026-11-04: the association menu
    // moves to the peek's Associations… button; A, the toolbar and the editor keep theirs). A Ctrl-click on a Mac also
    // arrives as a right-click: the second report of the same browser event is the same gesture.
    let last: Event | undefined;
    const peek = (e: cytoscape.EventObject) => {
      const t = e.target;
      if (e.originalEvent && e.originalEvent === last) return;
      last = e.originalEvent;
      const p = e.renderedPosition ?? (t.isNode() ? t.renderedPosition() : (t as unknown as RenderedEdge).renderedMidpoint());
      P.current.onPeek({ kind: t.isNode() ? 'node' : 'edge', id: t.id(), x: p.x, y: p.y });
    };
    cy.on('cxttap taphold', 'node, edge', peek);
    cy.on('tap', 'node, edge', (e) => {
      if ((e.originalEvent as MouseEvent | undefined)?.ctrlKey) peek(e);
    });
    cy.on('mouseover', 'edge', (e) => {
      hover.current = e.target.id();
      schedule();
    });
    // the pointer leaving an edge closes its tooltip, and so does pointer movement anywhere else on the canvas: that
    // also hides the selected edge's tooltip (a new link is selected), which otherwise sat over the nodes (K4 D5)
    const away = () => {
      const s = P.current.selected;
      hover.current = null;
      tipGone.current = s.edges.length === 1 && !s.nodes.length ? s.edges[0] : null;
      schedule();
    };
    cy.on('mouseout', 'edge', away);
    cy.on('mousemove', (e) => {
      if (e.target === cy || e.target.isNode?.()) {
        const s = P.current.selected;
        if (hover.current || (s.edges.length === 1 && !s.nodes.length && tipGone.current !== s.edges[0])) away();
      }
    });
    const container = box.current!;
    container.addEventListener('mouseleave', away);
    // SL17: full screen and the collapsible dock change the canvas's size without a window resize
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      cy.resize();
      schedule();
    }) : null;
    ro?.observe(container);
    document.fonts?.ready.then(() => cyRef.current === cy && measure());
    cy.on('dragfree', 'node', (e) => {
      const moved = cy.$('node:selected').union(e.target);
      const pos: Record<string, { x: number; y: number }> = {};
      moved.forEach((n) => {
        pos[n.id()] = { ...n.position() };
      });
      P.current.onMove(pos, true, 'drag');
    });
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      container.removeEventListener('mouseleave', away);
      cy.destroy();
      cyRef.current = null;
    };
  }, [recompute]); // eslint-disable-line react-hooks/exhaustive-deps

  // sync elements with the map
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const els = elements(props.map, props.dark, props.nodeText, sizes.current);
    const want = new Set(els.map((e) => e.data.id as string));
    const added: string[] = [];
    cy.batch(() => {
      cy.elements().forEach((el) => {
        if (!want.has(el.id())) el.remove();
      });
      for (const e of els) {
        const cur = cy.getElementById(e.data.id as string);
        if (cur.empty()) {
          cy.add(e);
          added.push(e.data.id as string);
        } else {
          cur.data(e.data);
          cur.classes(e.classes as string);
          if (e.position && !cur.grabbed()) {
            const p = cur.position();
            if (Math.abs(p.x - e.position.x) > 0.5 || Math.abs(p.y - e.position.y) > 0.5) cur.position(e.position);
          }
        }
      }
    });
    // keep new circumstances in view: fit when one lands outside the visible extent (never zoom past 1.2)
    if (added.length) {
      const ext = cy.extent();
      const outside = added.some((id) => {
        const n = cy.getElementById(id);
        if (n.empty() || !n.isNode()) return false;
        const b = n.boundingBox({});
        return b.x1 < ext.x1 || b.x2 > ext.x2 || b.y1 < ext.y1 || b.y2 > ext.y2;
      });
      if (outside) fitCapped(cy);
    }
    routeEdges(cy);
    fitMarks(cy);
    recompute();
  }, [props.map, props.dark, props.nodeText, recompute]);

  useEffect(() => {
    cyRef.current?.style(stylesheet(props.dark, props.print));
  }, [props.dark, props.print]);
  // K14: crossing 768 px changes the glyphs' scale
  useEffect(() => {
    recompute();
  }, [narrow, recompute]);

  // selection from outside
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    syncing.current = true;
    const want = new Set([...props.selected.nodes, ...props.selected.edges]);
    cy.batch(() => {
      cy.elements().forEach((el) => {
        if (want.has(el.id()) && !el.selected()) el.select();
        else if (!want.has(el.id()) && el.selected()) el.unselect();
      });
    });
    syncing.current = false;
    recompute();
  }, [props.selected, recompute]);

  // highlight
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const h = props.highlight;
    cy.batch(() => {
      cy.elements().removeClass('dim hl hl-out hl-in');
      if (!h) return;
      cy.elements().forEach((el) => {
        const id = el.id();
        const on = h.nodes.has(id) || h.edges.has(id) || h.out?.has(id) || h.in?.has(id);
        if (!on) el.addClass('dim');
        else if (h.out?.has(id)) el.addClass('hl-out');
        else if (h.in?.has(id)) el.addClass('hl-in');
        else el.addClass('hl');
      });
    });
    recompute();
  }, [props.highlight, recompute]);

  useEffect(() => {
    recompute();
  }, [props.loops, props.loopNames, props.activeLoop, props.hulls, recompute]);

  useImperativeHandle(ref, () => ({
    layout(scope, engine) {
      const cy = cyRef.current;
      if (!cy) return;
      const anim = !P.current.reducedMotion;
      const nodes = scope === 'selection' ? cy.$('node:selected') : cy.nodes();
      if (!nodes.length) return;
      const eles = nodes.union(nodes.edgesWith(nodes));
      const pinned = scope === 'unpinned' ? cy.nodes('.pinned') : cy.collection();
      const pinnedPos = new Map(pinned.map((n) => [n.id(), { ...n.position() }]));
      const opts: Record<string, unknown> =
        engine === 'elk-stress'
          ? { name: 'elk', elk: { algorithm: 'stress', 'stress.desiredEdgeLength': 160 }, nodeDimensionsIncludeLabels: true, fit: scope !== 'selection', padding: 40, animate: anim, animationDuration: 450 }
          : {
              name: 'fcose',
              quality: 'proof',
              randomize: scope === 'all',
              animate: anim,
              animationDuration: 500,
              fit: scope !== 'selection',
              padding: 40,
              nodeDimensionsIncludeLabels: true,
              nodeSeparation: 90,
              idealEdgeLength: () => 150,
              nodeRepulsion: () => 12000,
              packComponents: true,
              fixedNodeConstraint: pinned.length && scope !== 'selection' ? pinned.map((n) => ({ nodeId: n.id(), position: { ...n.position() } })) : undefined,
            };
      const run = () => {
      const l = eles.layout(opts as unknown as cytoscape.LayoutOptions);
      l.one('layoutstop', () => {
        // ELK has no pin constraint: put pinned nodes back where they were
        if (engine === 'elk-stress') pinnedPos.forEach((p, id) => cy.getElementById(id).position(p));
        const pos: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          pos[n.id()] = { ...n.position() };
        });
        P.current.onMove(pos, undefined, 'layout');
      });
      l.run();
      };
      if (engine === 'elk-stress') loadElk().then(run);
      else run();
    },
    circle(ids) {
      const cy = cyRef.current;
      if (!cy || !ids.length) return;
      const ns = ids.map((id) => cy.getElementById(id)).filter((n) => n.nonempty());
      const cx = ns.reduce((s, n) => s + n.position().x, 0) / ns.length;
      const cyy = ns.reduce((s, n) => s + n.position().y, 0) / ns.length;
      const r = Math.max(110, (ns.length * 190) / (2 * Math.PI));
      const pos: Record<string, { x: number; y: number }> = {};
      ns.forEach((n, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / ns.length;
        pos[n.id()] = { x: cx + r * Math.cos(a), y: cyy + r * Math.sin(a) };
      });
      if (!P.current.reducedMotion) ns.forEach((n) => n.animate({ position: pos[n.id()] }, { duration: 400 }));
      P.current.onMove(pos, true, 'layout');
    },
    fit() {
      if (cyRef.current) fitCapped(cyRef.current);
    },
    fitTo(ids) {
      const cy = cyRef.current;
      if (!cy) return;
      const eles = cy.collection(ids.map((id) => cy.getElementById(id)).filter((n) => n.nonempty()));
      fitCapped(cy, eles, 70);
    },
    zoom(f) {
      const cy = cyRef.current;
      if (!cy) return;
      cy.zoom({ level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    },
    png() {
      return withLabels(cyRef.current!, (cy) => cy.png({ full: true, scale: 2, bg: P.current.dark ? '#15130f' : '#faf8f4' }));
    },
    svg() {
      return withLabels(cyRef.current!, (cy) => (cy as unknown as { svg(o: object): string }).svg({ full: true, bg: P.current.dark ? '#15130f' : '#faf8f4' }));
    },
    reveal(ids) {
      const cy = cyRef.current;
      if (!cy) return;
      const eles = cy.collection(ids.map((id) => cy.getElementById(id)).filter((n) => n.nonempty() && n.isNode()));
      if (!eles.length) return;
      const ext = cy.extent();
      const bb = eles.boundingBox({});
      if (bb.x1 >= ext.x1 && bb.x2 <= ext.x2 && bb.y1 >= ext.y1 && bb.y2 <= ext.y2) return;
      if (bb.w > ext.w || bb.h > ext.h) fitCapped(cy, eles, 70);
      else cy.center(eles);
    },
    refit() {
      const cy = cyRef.current;
      if (!cy) return;
      cy.resize();
      if (cy.nodes().length) fitCapped(cy);
    },
    where(id) {
      const cy = cyRef.current;
      const el = cy?.getElementById(id);
      if (!cy || !el || el.empty()) return null;
      return el.isNode() ? el.renderedPosition() : (el as unknown as RenderedEdge).renderedMidpoint();
    },
  }));

  return (
    <div className="ax-canvas h-full w-full overflow-hidden" data-testid="canvas-wrap" data-zoom={overlay.zoom.toFixed(3)}>
      <div
        ref={box}
        className="absolute inset-0"
        role="application"
        aria-roledescription="map canvas"
        aria-label={C.canvas.label}
        aria-describedby="canvas-outline-h"
        tabIndex={0}
        data-testid="canvas"
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {overlay.hulls.map((pts, i) => (
          <polygon key={i} points={pts} fill="var(--bx-accent)" fillOpacity={0.07} stroke="var(--bx-accent)" strokeDasharray="6 4" strokeWidth={1.5} />
        ))}
      </svg>
      <div ref={textLayer} className="pointer-events-none absolute inset-0" aria-hidden data-testid="node-text-layer">
        {props.map.nodes.map((n) => {
          const t = nodeTextParts(n, props.nodeText);
          const q = overlay.pos[n.id];
          const st = dominantStyle(n.label.content.some((p) => p.content?.length) ? n.label : n.circumstance);
          const dim = props.highlight && !(props.highlight.nodes.has(n.id) || props.highlight.out?.has(n.id) || props.highlight.in?.has(n.id));
          const title: CSSProperties = {
            fontStyle: st.italic ? 'italic' : undefined,
            color: props.print ? undefined : st.color,
            fontSize: st.fontSize ? parseInt(st.fontSize) : undefined,
          };
          return (
            <div
              key={n.id}
              className={`ax-node-text ${n.kind === 'note' ? 'ax-nt-note' : ''}`}
              data-node-text={n.id}
              data-mode={props.nodeText}
              style={{ left: q?.fx ?? -9999, top: q?.fy ?? -9999, transform: `translate(-50%, -50%) scale(${overlay.zoom})`, opacity: dim ? 0.15 : undefined }}
            >
              {t.head && <span className="ax-nt-code" data-part="code">{t.head}</span>}
              <span className="ax-nt-title" data-part="title" style={title}>{t.title}</span>
              {t.sub && <span className="ax-nt-sub" data-part="sub">{t.sub}</span>}
            </div>
          );
        })}
      </div>
      {overlay.loops.map((l) => (
        <button
          key={l.key}
          type="button"
          className={`${l.kind === 'R' ? 'ax-loop-r' : 'ax-loop-b'} ${props.activeLoop === l.key ? 'ring-2 ring-[color:var(--bx-accent)]' : ''}`}
          style={{ left: l.x, top: l.y, transform: `translate(-50%, -50%) scale(${l.scale})` }}
          onClick={() => props.onLoop(l.key)}
          aria-label={`Loop ${props.loopNames.get(l.key)}: ${l.kind === 'R' ? S.loops.reinforcing : S.loops.balancing}`}
          aria-pressed={props.activeLoop === l.key}
          title={props.loopNames.get(l.key)}
          data-testid="loop-glyph"
          data-label={l.label}
          data-scale={l.scale.toFixed(3)}
        >
          <span aria-hidden="true">{l.kind === 'R' ? '↻' : '↺'}</span>
          {l.label}
        </button>
      ))}
      {overlay.more && (
        <button
          type="button"
          className="bx-btn ax-tap absolute justify-center px-2 py-0"
          style={{ left: overlay.more.x, top: overlay.more.y, width: overlay.size, height: overlay.size, fontSize: overlay.size * 0.4, transform: 'translate(-50%, -50%)' }}
          onClick={() => props.onContext(props.selected.nodes[0])}
          aria-label={C.toolbar.more}
          data-testid="node-more"
        >
          ⋯
        </button>
      )}
      {overlay.handle && !drag && (
        <button
          type="button"
          className="bx-btn ax-tap absolute cursor-crosshair touch-none justify-center rounded-full px-2 py-0"
          style={{ left: overlay.handle.x, top: overlay.handle.y, width: overlay.size, height: overlay.size, fontSize: overlay.size * 0.4, transform: 'translate(-50%, -50%)' }}
          aria-label={C.evidence.connect}
          title={C.evidence.connect}
          data-testid="connect-handle"
          onClick={() => props.onConnect(props.selected.nodes[0], '')}
          onPointerDown={(e) => {
            const from = props.selected.nodes[0];
            const r = box.current!.getBoundingClientRect();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setDrag({ from, x0: overlay.handle!.x, y0: overlay.handle!.y, x: e.clientX - r.left, y: e.clientY - r.top });
          }}
        >
          ⊸
        </button>
      )}
      {drag && (
        <div
          className="absolute inset-0 z-10 cursor-crosshair touch-none"
          data-testid="connect-drag"
          onPointerMove={(e) => {
            const r = box.current!.getBoundingClientRect();
            setDrag((d) => d && { ...d, x: e.clientX - r.left, y: e.clientY - r.top });
          }}
          onPointerUp={(e) => {
            const r = box.current!.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            const cy = cyRef.current;
            const hit = cy?.nodes().filter((n) => {
              const b = n.renderedBoundingBox({});
              return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2 && !n.hasClass('note');
            });
            const from = drag.from;
            setDrag(null);
            if (hit && hit.nonempty() && hit[0].id() !== from) props.onConnect(from, hit[0].id());
          }}
          onPointerCancel={() => setDrag(null)}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <line x1={drag.x0} y1={drag.y0} x2={drag.x} y2={drag.y} stroke="var(--bx-accent)" strokeWidth={2.5} strokeDasharray="6 4" />
          </svg>
        </div>
      )}
      {overlay.tip && (
        <div role="tooltip" className="bx-card pointer-events-none absolute z-20 max-w-xs p-2 text-xs bg-[color:var(--bx-bg)] dark:bg-night-2" style={{ left: overlay.tip.x, top: overlay.tip.y + 14, transform: 'translateX(-50%)' }} data-testid="edge-tooltip">
          {overlay.tip.text}
        </div>
      )}
      {!props.map.nodes.length && <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 text-center bx-muted"><span data-testid="canvas-empty">{coarse ? C.canvas.emptyTouch : C.canvas.empty}</span></p>}
      <div className="sr-only">
        <h2 id="canvas-outline-h">{C.canvas.outline}</h2>
        <ul data-testid="canvas-outline">
          {props.map.nodes.map((n) => (
            <li key={n.id} data-node={n.id} data-rx={overlay.pos[n.id]?.x} data-ry={overlay.pos[n.id]?.y} data-bb={overlay.pos[n.id]?.bb} data-status={n.code_status} data-group={n.code ? colourGroup(n.code) ?? '' : ''} data-dashed={n.code_status !== 'sdoh' ? 'true' : 'false'} data-pinned={n.pinned ? 'true' : 'false'} data-fill={n.style.fill ?? ''} data-state={props.highlight ? (props.highlight.nodes.has(n.id) || props.highlight.out?.has(n.id) || props.highlight.in?.has(n.id) ? 'highlighted' : 'dimmed') : 'normal'} data-selected={props.selected.nodes.includes(n.id) ? 'true' : 'false'}>
              {n.kind === 'note' ? 'Note' : 'Circumstance'}: {nodeName(n, titleOf)}
              {n.code ? `, code ${n.code}` : `, ${S.codes.status[n.code_status]}`}
              {n.pinned ? ', pinned' : ''}
              {props.selected.nodes.includes(n.id) ? ', selected' : ''}
              {props.highlight && !(props.highlight.nodes.has(n.id) || props.highlight.out?.has(n.id) || props.highlight.in?.has(n.id)) ? ', dimmed' : ''}
            </li>
          ))}
          {props.map.edges.map((e) => (
            <li key={e.id} data-edge={e.id} data-pol={e.polarity} data-basis={e.basis} data-check={e.check}  data-ends={overlay.ends[e.id]} data-mid={overlay.mids[e.id]} data-mark={overlay.shown[e.id]?.mid} data-pol-label={overlay.shown[e.id]?.pol} data-width={props.map.layout.thickness && e.style.widthByWeight !== false ? 1 + 5 * Math.abs(e.weight) : 2.5} data-state={props.highlight ? (props.highlight.edges.has(e.id) ? 'highlighted' : 'dimmed') : 'normal'}>
              {props.describeEdge(e)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

export default Canvas;
