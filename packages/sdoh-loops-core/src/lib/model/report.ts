/**
 * SL28 point 4: the complete case report as data — a cover (the map, the subject label, the date, the pins, the
 * provenance counts, what the identifier check is), the notebook's notes in order, the case summary (SL26 point 5) with
 * each circumstance's quoted sources and each loop's passages, and the references the notebook cites. Pure: the
 * renderers (report-render.ts: Markdown, HTML for print and file, Word) only lay this out, so every format says the same.
 */
import { refMap } from '../data/refs';
import { S } from '../data/core';
import { leverage, type AGraph, type Loop, type LoopResult } from '../analysis';
import { CODE_STATUSES, type SdohMap } from './map';
import { annotationOf, DATE_FIELD, isChip, isOrphaned, spanAnchor, spansFor, textblocks, type Note, type NoteDoc, type Span, type Target } from './notebook';
import { caseProvenance, type CaseProvenance, type Pins } from './caseFile';
import { summaryRow, type SummaryRow } from './summary';
import { passagesBehind, targetName, type TargetContext } from './targets';
import type { RichDoc } from './rich';

export interface ReportOptions {
  /** the notes themselves (else the report is the cover, the summary and the references) */
  notes: boolean;
  /** the map as a picture */
  image: boolean;
  /** comments on passages, @ mentions in the text, and each note's passages list */
  annotations: boolean;
}
export const REPORT_DEFAULTS: ReportOptions = { notes: true, image: true, annotations: true };

/** a run of a paragraph: text, or an @ mention */
export type Part = { text: string } | { chip: string; span: string };
export interface Block {
  kind: 'p' | 'h' | 'li' | 'page';
  parts: Part[];
}
export interface ReportQuote {
  span: string;
  quote: string;
  note: string;
  anchor: string;
  inferred: boolean;
  by?: string;
}
export interface ReportNote {
  id: string;
  title: string;
  kind: string;
  date?: string;
  source?: string;
  sections: { heading?: string; blocks: Block[] }[];
  table?: { header: string[]; rows: string[][] };
  passages: { quote: ReportQuote; comment?: string; supports: string[] }[];
}
export interface ReportRow extends SummaryRow {
  sources: ReportQuote[];
}
export interface CaseReport {
  options: ReportOptions;
  cover: {
    name: string;
    subject: string;
    date: string;
    pins: Pins;
    provenance: CaseProvenance;
    /** possible identifiers still in the notebook at export: only when the user confirmed exporting them */
    flaggedKept: number;
    heuristic: string;
    notice: string;
    citation: string;
  };
  notes: ReportNote[];
  summary: {
    tiles: { label: string; value: number; detail?: string }[];
    hidden: number;
    rows: ReportRow[];
    loops: { name: string; kind: string; cycle: string; passages: { label: string; quotes: ReportQuote[] }[]; total: number }[];
    leverage: { name: string; loops: number }[];
  };
  references: { n: string; citation: string; link?: string; userEntered?: boolean }[];
}

export interface ReportInput {
  /** the whole map (its notebook, after any labels the export warning applied) */
  map: SdohMap;
  /** the map as shown (hideNode applied): the summary works on this, as the case summary does */
  shown: SdohMap;
  graph: AGraph;
  loops: LoopResult;
  loopNames: Map<string, string>;
  nm: (id: string) => string;
  clusters: string[][];
  host?: TargetContext['host'];
  options: ReportOptions;
  pins: Pins;
  /** possible identifiers left in, which the user confirmed (0 when there were none or they were labelled) */
  flaggedKept: number;
  copy: { heuristic: string; notice: string; citation: string; templates: Map<string, string>; kinds: { free: string; structured: string; imported: string } };
  when?: Date;
}

function quoteOf(map: SdohMap, x: Span): ReportQuote {
  const note = map.notebook?.notes.find((n) => n.id === x.note);
  return { span: x.id, quote: x.quote, note: note?.title ?? '—', anchor: spanAnchor(note, x), inferred: !!x.by?.inferred, ...(x.by ? { by: x.by.label } : {}) };
}
const live = (map: SdohMap) => (x: Span) => !isOrphaned(map.notebook, x) && !isChip(x);

/** A field's textblocks as report blocks, with its @ mentions placed in the text when `chips` is given. */
function blocksOf(doc: NoteDoc | RichDoc | undefined, chips: { at: number; label: string; span: string }[], pages?: Map<number, number>): Block[] {
  const out: Block[] = [];
  let off = 0;
  // the kinds of the textblocks in reading order (a heading, a list item, a paragraph), with the top-level index
  const kinds: { kind: Block['kind']; top: number }[] = [];
  const walk = (list: unknown[], top: number | null, inList: boolean) => {
    list.forEach((b, i) => {
      const n = b as { type?: string; content?: unknown[] };
      const t = top ?? i;
      if (n.type === 'paragraph') kinds.push({ kind: inList ? 'li' : 'p', top: t });
      else if (n.type === 'heading') kinds.push({ kind: 'h', top: t });
      else if (Array.isArray(n.content)) walk(n.content, t, inList || n.type === 'bulletList' || n.type === 'orderedList');
    });
  };
  walk((doc?.content as unknown[]) ?? [], null, false);
  const tbs = textblocks(doc);
  let lastTop = -1;
  tbs.forEach((tb, i) => {
    const text = (tb.content ?? []).map((n) => (n.type === 'text' ? n.text : '\n')).join('');
    const k = kinds[i] ?? { kind: 'p', top: i };
    if (pages && k.top !== lastTop && pages.has(k.top)) out.push({ kind: 'page', parts: [{ text: `p. ${pages.get(k.top)}` }] });
    lastTop = k.top;
    const here = chips.filter((c) => c.at >= off && c.at <= off + text.length).sort((a, b) => a.at - b.at);
    const parts: Part[] = [];
    let at = 0;
    for (const c of here) {
      if (c.at - off > at) parts.push({ text: text.slice(at, c.at - off) });
      parts.push({ chip: c.label, span: c.span });
      at = c.at - off;
    }
    if (at < text.length) parts.push({ text: text.slice(at) });
    chips = chips.filter((c) => !here.includes(c));
    if (parts.length) out.push({ kind: k.kind, parts });
    off += text.length + 1;
  });
  return out;
}

function noteOf(map: SdohMap, n: Note, input: ReportInput, ctx: TargetContext): ReportNote {
  const nb = map.notebook;
  const name = (t: Target) => targetName(t, ctx) ?? `${t.kind} ${t.id}`;
  const chipsIn = (where: string) =>
    input.options.annotations
      ? (nb?.spans ?? []).filter((x) => x.note === n.id && x.where === where && isChip(x) && !x.orphaned).map((x) => ({ at: x.start, span: x.id, label: `@${(annotationOf(nb, x.id)?.targets ?? []).map(name).join(', ') || '…'}` }))
      : [];
  const kind = n.kind === 'structured' ? input.copy.templates.get(n.template ?? '') ?? input.copy.kinds.structured : n.kind === 'imported' ? `${input.copy.kinds.imported} · ${n.source?.type.toUpperCase() ?? ''}` : input.copy.kinds.free;
  const out: ReportNote = { id: n.id, title: n.title || 'Untitled note', kind, sections: [], passages: [] };
  if (n.kind === 'structured') {
    for (const f of n.fields ?? []) {
      if (f.key === DATE_FIELD.key) {
        if (f.value) out.date = f.value;
        continue;
      }
      out.sections.push({ heading: f.label, blocks: blocksOf(f.body, chipsIn(f.key)) });
    }
  } else {
    const pages = n.kind === 'imported' && n.anchors?.length ? new Map(n.anchors.map((a) => [a.block, a.page])) : undefined;
    out.sections.push({ blocks: blocksOf(n.body, chipsIn('body'), pages) });
    if (n.kind === 'imported' && n.source) out.source = `${n.source.filename} · ${n.source.type.toUpperCase()}${n.source.pages ? ` · ${n.source.pages} pages` : ''} · imported ${n.source.imported.slice(0, 10)}`;
    if (n.table) out.table = n.table;
  }
  if (input.options.annotations)
    out.passages = (nb?.spans ?? [])
      .filter((x) => x.note === n.id && live(map)(x))
      .sort((a, b) => (a.where === b.where ? a.start - b.start : a.where.localeCompare(b.where)))
      .map((x) => {
        const a = annotationOf(nb, x.id);
        return { quote: quoteOf(map, x), ...(a?.text ? { comment: a.text } : {}), supports: (a?.targets ?? []).map(name) };
      });
  return out;
}

/** Build the report. Everything in it comes from the map and its notebook; nothing is added. */
export function buildReport(input: ReportInput): CaseReport {
  const { map, shown, nm, loops, loopNames } = input;
  const when = input.when ?? new Date();
  const nb = map.notebook;
  const ctx: TargetContext = { map, nm, loops: loops.loops, loopNames, clusters: input.clusters, host: input.host };
  const circ = shown.nodes.filter((n) => n.kind !== 'note');
  const byStatus = Object.fromEntries(CODE_STATUSES.map((s) => [s, circ.filter((n) => n.code_status === s).length])) as Record<string, number>;
  const ev = shown.edges.filter((e) => e.basis === 'evidence').length;
  const R = loops.loops.filter((l) => l.kind === 'R').length;
  const rows: ReportRow[] = shown.nodes.map((n) => ({ ...summaryRow(shown, nm, n), sources: spansFor(nb, { kind: 'node', id: n.id }).filter(live(map)).map((x) => quoteOf(map, x)) }));
  const loopRows = loops.loops.map((l: Loop) => {
    const p = passagesBehind(nb, shown, nm, { kind: 'loop', loop: l });
    return {
      name: loopNames.get(l.key) ?? '',
      kind: l.kind === 'R' ? S.loops.reinforcing : S.loops.balancing,
      cycle: `${l.nodes.map(nm).join(' → ')} → ↺`,
      passages: p.groups.map((g) => ({ label: g.label, quotes: g.spans.filter(live(map)).map((x) => quoteOf(map, x)) })).filter((g) => g.quotes.length),
      total: p.total,
    };
  });
  // the references the notebook cites (a span's or a mention's target), in the pack's numbering; then the map's own
  const cited = new Set<string>();
  for (const a of nb?.annotations ?? []) for (const t of a.targets) if (t.kind === 'reference') cited.add(t.id);
  const pack = [...cited].filter((id) => !id.startsWith('map:') && refMap.has(Number(id))).map(Number).sort((a, b) => a - b);
  const own = [...cited].filter((id) => id.startsWith('map:'));
  const references: CaseReport['references'] = [
    ...pack.map((n) => {
      const r = refMap.get(n)!;
      const link = r.url ?? (r.doi ? `https://doi.org/${r.doi}` : undefined);
      return { n: String(n), citation: r.citation, ...(link ? { link } : {}) };
    }),
    ...own.map((id, i) => {
      const node = map.nodes.find((x) => x.id === id.slice(4));
      return { n: `U${i + 1}`, citation: node?.ref ?? '—', userEntered: true };
    }),
  ];
  return {
    options: input.options,
    cover: {
      name: map.name,
      subject: map.subject,
      date: when.toISOString().slice(0, 10),
      pins: input.pins,
      provenance: caseProvenance(nb, input.pins, when),
      flaggedKept: input.flaggedKept,
      heuristic: input.copy.heuristic,
      notice: input.copy.notice,
      citation: input.copy.citation,
    },
    notes: input.options.notes ? (nb?.notes ?? []).map((n) => noteOf(map, n, input, ctx)) : [],
    summary: {
      tiles: [
        { label: 'Circumstances', value: circ.length, detail: CODE_STATUSES.map((s) => `${byStatus[s]} ${S.codes.status[s]}`).join(' · ') },
        { label: 'Links', value: shown.edges.length, detail: `${ev} evidence · ${shown.edges.length - ev} ⚑` },
        { label: 'Loops', value: loops.loops.length, detail: `${R} ${S.loops.reinforcing.toLowerCase()} · ${loops.loops.length - R} ${S.loops.balancing.toLowerCase()}` },
        { label: 'Needs a code', value: byStatus.undetermined },
      ],
      hidden: map.nodes.length - shown.nodes.length,
      rows,
      loops: loopRows,
      leverage: leverage(input.graph, loops, 'loops').slice(0, 5).map((r) => ({ name: nm(r.id), loops: r.loops })),
    },
    references,
  };
}

/** Every quote the report shows, with its span id (the report's check: each one resolves to a span in the notebook). */
export function reportQuotes(r: CaseReport): ReportQuote[] {
  return [...r.notes.flatMap((n) => n.passages.map((p) => p.quote)), ...r.summary.rows.flatMap((x) => x.sources), ...r.summary.loops.flatMap((l) => l.passages.flatMap((p) => p.quotes))];
}
