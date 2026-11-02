import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import cytoscape, { type Core, type EdgeCollection, type EdgeSingular, type ElementDefinition } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import cySvg from 'cytoscape-svg';
import { codeMap, colourGroup } from '@/lib/data/scheme';
import { GROUP_STYLE, NEUTRAL, borderFor, fillFor } from '@/lib/palette';
import { dominantStyle, plainText } from '@/lib/model/rich';
import { nodeName } from '@/lib/model/interchange';
import { useCoarsePointer } from '@/lib/pointer';
import type { SdohMap, MapNode, MapEdge } from '@/lib/model/map';
import type { Loop } from '@/lib/analysis';
import { S } from '@/lib/data/core';
import { C } from '@/lib/copy';

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
  onContext(nodeId: string): void;
  onMove(pos: Record<string, { x: number; y: number }>, pin: boolean | undefined, origin: 'drag' | 'layout'): void;
  onLoop(key: string): void;
  /** UI-17 drag-to-connect: dropped the connector handle of `from` onto `to` */
  onConnect(from: string, to: string): void;
  describeEdge(e: MapEdge): string;
  /** UI-18: tooltip text for an override or needs-review edge */
  edgeTip(e: MapEdge): string | null;
}

const titleOf = (c: string) => codeMap.get(c)?.title;
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const PIN = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="5" r="4" fill="#a3243b" stroke="#fff" stroke-width="1.2"/><path d="M7 9v5" stroke="#a3243b" stroke-width="1.6"/></svg>');

export function nodeLines(n: MapNode): string {
  if (n.kind === 'note') return trunc(plainText(n.notes) || C.node.note, 140);
  const g = n.code ? GROUP_STYLE[colourGroup(n.code) ?? ''] : undefined;
  const head =
    n.code_status === 'sdoh' && n.code ? `${g?.glyph ?? ''} ${n.code}`.trim() : n.code_status === 'undetermined' ? `?  ${S.codes.status.undetermined}` : `${S.codes.status.other.split(' ')[0]}${n.type ? ` · ${n.type}` : ''}`;
  const label = plainText(n.label);
  const name = label || (n.code ? titleOf(n.code) ?? '' : '');
  const circ = plainText(n.circumstance);
  return [head, name && trunc(name, 42), circ && trunc(circ, 48)].filter(Boolean).join('\n');
}

function elements(map: SdohMap, dark: boolean): ElementDefinition[] {
  const out: ElementDefinition[] = [];
  for (const n of map.nodes) {
    const gid = n.code ? colourGroup(n.code) : undefined;
    const hue = (n.code_status === 'sdoh' && gid && GROUP_STYLE[gid]?.hue) || NEUTRAL.hue;
    const coded = n.code_status === 'sdoh' && !!n.code;
    const st = dominantStyle(n.label.content.some((p) => p.content?.length) ? n.label : n.circumstance);
    const fill = n.style.fill ? fillFor(n.style.fill, dark) : n.kind === 'note' ? (dark ? '#3a3320' : '#fdf3c4') : coded ? fillFor(hue, dark) : dark ? '#2a2620' : '#efebe4';
    out.push({
      group: 'nodes',
      data: {
        id: n.id,
        label: nodeLines(n),
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
        label: 'data(label)',
        'text-wrap': 'wrap',
        'text-max-width': '170px',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-family': '"Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif',
        'font-size': 'data(size)',
        'font-weight': 'data(fw)' as unknown as number,
        'font-style': 'data(fs)' as unknown as 'normal',
        color: print ? '#1f1b16' : 'data(tc)',
        width: 'label',
        height: 'label',
        padding: '10px',
        'line-height': 1.3,
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
        'target-label': 'data(pol)',
        'target-text-offset': 26,
        'font-weight': 700,
        color: ink,
        'text-background-color': bg,
        'text-background-opacity': 1,
        'text-background-padding': '2px',
        'text-background-shape': 'round-rectangle',
        label: 'data(mid)',
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
/** K7: the canvas glyph shows the loop's name, cut to 8 characters (the full name is in the tooltip) */
export function glyphLabel(name: string) {
  return name.length > 8 ? `${name.slice(0, 7)}…` : name;
}
/** half the glyph's rendered width: 11 px bold runs about 7 px a character, plus the ↻ and 8 px padding each side */
function glyphHalfWidth(label: string) {
  return Math.max(15, ((label.length + 1) * 7 + 16) / 2);
}
const handleSize = (zoom: number) => Math.max(44, Math.min(72, Math.round(HANDLE_PX * zoom)));
/** K6 D10: a link whose straight line would run through another circumstance bends around it, by this much clearance */
const BEND_CLEAR = 18;

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
    loops: { key: string; x: number; y: number; kind: string; label: string }[];
    more: { x: number; y: number } | null;
    handle: { x: number; y: number } | null;
    /** rendered size of the ⋯ and connector buttons (px) */
    size: number;
    tip: { x: number; y: number; text: string } | null;
    hulls: string[];
    pos: Record<string, { x: number; y: number; bb: string }>;
    ends: Record<string, string>;
    /** rendered midpoint x,y and the K6 bend, per edge (outline only) */
    mids: Record<string, string>;
    zoom: number;
  }>({ loops: [], more: null, handle: null, size: HANDLE_PX, tip: null, hulls: [], pos: {}, ends: {}, mids: {}, zoom: 1 });
  const coarse = useCoarsePointer();
  const hover = useRef<string | null>(null);
  /** K4 D5: the selected edge whose tooltip the pointer has moved away from; it stays hidden until the selection changes */
  const tipGone = useRef<string | null>(null);
  const [drag, setDrag] = useState<{ from: string; x0: number; y0: number; x: number; y: number } | null>(null);

  const recompute = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const p = P.current;
    const shownLoops = p.activeLoop ? p.loops.filter((l) => l.key === p.activeLoop) : p.loops.slice(0, 24);
    const loops = shownLoops.flatMap((l) => {
      const ps = l.nodes.map((id) => cy.getElementById(id)).filter((n) => n.nonempty()).map((n) => n.renderedPosition());
      if (!ps.length) return [];
      const label = glyphLabel(p.loopNames.get(l.key) ?? l.kind);
      return [{ key: l.key, kind: l.kind, label, hw: glyphHalfWidth(label), x: ps.reduce((s, q) => s + q.x, 0) / ps.length, y: ps.reduce((s, q) => s + q.y, 0) / ps.length }];
    });
    // K7: every edge's marks, as circles in rendered px: the mid-edge badge (⚑, ‖) and the +/− polarity label, which sits
    // 26 model px back from the arrowhead along the edge (approximated toward the midpoint on a bent edge)
    const marks: { x: number; y: number; r: number }[] = [];
    {
      const z = cy.zoom();
      cy.edges().forEach((e) => {
        const r = e as unknown as RenderedEdge;
        const m = r.renderedMidpoint();
        if (e.data('mid')) marks.push({ ...m, r: (e.hasClass('override') || e.hasClass('review') ? 18 : 12) * z });
        const t = r.renderedTargetEndpoint();
        const len = Math.hypot(m.x - t.x, m.y - t.y) || 1;
        const off = Math.min(26 * z, len);
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
    // K6 D7: a loop glyph (30 px) starts at its loop's centre and is nudged to the nearest spot clear of every node box,
    // every edge's mid-edge mark (⚑, ‖), the ⋯ and connector buttons and the glyphs already placed, scored like the handles
    {
      // K7: a glyph is a pill, hw wide either side of its centre and 15 px up and down; 4 px clearance all round
      const C = 4;
      const nodeBoxes = cy.nodes().map((n) => n.renderedBoundingBox({}));
      const taken: { x: number; y: number; hw: number; hh: number }[] = [...[more, handle].filter((c): c is { x: number; y: number } => !!c).map((c) => ({ ...c, hw: size / 2, hh: size / 2 }))];
      const W = cy.width();
      const H = cy.height();
      for (const g of loops) {
        const cands = [{ x: g.x, y: g.y }];
        for (const r of [36, 60, 90, 130]) for (let i = 0; i < 12; i++) cands.push({ x: g.x + (r + g.hw - 15) * Math.cos((i * Math.PI) / 6), y: g.y + r * Math.sin((i * Math.PI) / 6) });
        const score = (c: { x: number; y: number }) => {
          let d = -Math.hypot(c.x - g.x, c.y - g.y);
          for (const b of nodeBoxes) if (c.x + g.hw + C > b.x1 && c.x - g.hw - C < b.x2 && c.y + 15 + C > b.y1 && c.y - 15 - C < b.y2) d -= 1000;
          for (const o of taken) if (Math.abs(c.x - o.x) < g.hw + o.hw + C && Math.abs(c.y - o.y) < 15 + o.hh + C) d -= 500;
          for (const q of marks) if (Math.abs(c.x - q.x) < g.hw + q.r + C && Math.abs(c.y - q.y) < 15 + q.r + C) d -= 300;
          if (c.x < g.hw + C || c.y < 15 + C || c.x > W - g.hw - C || c.y > H - 15 - C) d -= 50;
          return d;
        };
        const best = cands.reduce((a, c) => (score(c) > score(a) ? c : a), cands[0]);
        g.x = best.x;
        g.y = best.y;
        taken.push({ ...best, hw: g.hw, hh: 15 });
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
    const pos: Record<string, { x: number; y: number; bb: string }> = {};
    cy.nodes().forEach((n) => {
      const q = n.renderedPosition();
      const b = n.renderedBoundingBox({});
      pos[n.id()] = { x: Math.round(q.x), y: Math.round(q.y), bb: [b.x1, b.y1, b.x2, b.y2].map(Math.round).join(',') };
    });
    const endsMap: Record<string, string> = {};
    const midMap: Record<string, string> = {};
    cy.edges().forEach((e) => {
      const r = e as unknown as RenderedEdge;
      const a = r.renderedSourceEndpoint();
      const b = r.renderedTargetEndpoint();
      const m = r.renderedMidpoint();
      endsMap[e.id()] = [a.x, a.y, b.x, b.y].map(Math.round).join(',');
      midMap[e.id()] = `${Math.round(m.x)},${Math.round(m.y)},${e.scratch('bend') ?? 0}`;
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
    setOverlay({ loops, more, handle, size, tip, hulls, pos, ends: endsMap, mids: midMap, zoom: cy.zoom() });
  }, []);

  // mount
  useEffect(() => {
    const cy = cytoscape({
      container: box.current!,
      elements: elements(P.current.map, P.current.dark),
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
    cy.on('cxttap taphold', 'node', (e) => {
      const n = e.target;
      if (n.hasClass('note')) return;
      cy.$(':selected').unselect();
      n.select();
      P.current.onContext(n.id());
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
      container.removeEventListener('mouseleave', away);
      cy.destroy();
      cyRef.current = null;
    };
  }, [recompute]);

  // sync elements with the map
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const els = elements(props.map, props.dark);
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
    recompute();
  }, [props.map, props.dark, recompute]);

  useEffect(() => {
    cyRef.current?.style(stylesheet(props.dark, props.print));
  }, [props.dark, props.print]);

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
      return cyRef.current!.png({ full: true, scale: 2, bg: P.current.dark ? '#15130f' : '#faf8f4' });
    },
    svg() {
      return (cyRef.current as unknown as { svg(o: object): string }).svg({ full: true, bg: P.current.dark ? '#15130f' : '#faf8f4' });
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
      {overlay.loops.map((l) => (
        <button
          key={l.key}
          type="button"
          className={`${l.kind === 'R' ? 'ax-loop-r' : 'ax-loop-b'} ${props.activeLoop === l.key ? 'ring-2 ring-[color:var(--bx-accent)]' : ''}`}
          style={{ left: l.x, top: l.y }}
          onClick={() => props.onLoop(l.key)}
          aria-label={`Loop ${props.loopNames.get(l.key)}: ${l.kind === 'R' ? S.loops.reinforcing : S.loops.balancing}`}
          aria-pressed={props.activeLoop === l.key}
          title={props.loopNames.get(l.key)}
          data-testid="loop-glyph"
          data-label={l.label}
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
            <li key={e.id} data-edge={e.id} data-pol={e.polarity} data-basis={e.basis} data-check={e.check}  data-ends={overlay.ends[e.id]} data-mid={overlay.mids[e.id]} data-width={props.map.layout.thickness && e.style.widthByWeight !== false ? 1 + 5 * Math.abs(e.weight) : 2.5} data-state={props.highlight ? (props.highlight.edges.has(e.id) ? 'highlighted' : 'dimmed') : 'normal'}>
              {props.describeEdge(e)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

export default Canvas;
