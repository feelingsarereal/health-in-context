/**
 * Export and import (planner.yaml: export [json, csv-edges, png, svg, md-report]; import [json, csv-edges]).
 * PNG/SVG come from the canvas (src/components/map/Canvas.tsx); everything here is pure text.
 */
import { findLoops, strongestLoops, type LoopResult } from '../analysis';
import { hasNotebook, migrate, newEdge, newMap, newNode, toGraph, today, withoutNotebook, ImportError, type MapNode, type SdohMap, type CodeStatus, type OtherType, type MapLoopName } from './map';
import { docFromText, plainText } from './rich';

export type TitleOf = (code: string) => string | undefined;

export function nodeName(n: MapNode, titleOf: TitleOf): string {
  const label = plainText(n.label);
  if (label) return label;
  if (n.code) return titleOf(n.code) ?? n.code;
  const c = plainText(n.circumstance);
  if (c) return c.length > 48 ? c.slice(0, 47) + '…' : c;
  return n.kind === 'note' ? 'Note' : 'Untitled circumstance';
}

/** K9: every export carries the ICD-11 licence citation (§1.3): JSON `meta`, a CSV comment line, a Markdown footer. */
/** SL26: a map with notes is written as schema 3 with its notebook; without notes, as schema 2 (withoutNotebook). */
export function exportJSON(m: SdohMap, citation?: string): string {
  const doc = hasNotebook(m) ? m : withoutNotebook(m);
  return JSON.stringify(citation ? { ...doc, meta: { icd11_citation: citation } } : doc, null, 2) + '\n';
}

export function importJSON(text: string): SdohMap {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('This file is not valid JSON. Nothing was imported.');
  }
  // the export's `meta` (the licence citation) is written fresh on every export, so it is not stored with the map
  if (raw && typeof raw === 'object' && 'meta' in raw) delete (raw as Record<string, unknown>).meta;
  return migrate(raw);
}

// ───────────────────────── CSV
const CSV_COLS = [
  'from_id', 'from_label', 'from_code', 'from_code_status', 'from_type',
  'to_id', 'to_label', 'to_code', 'to_code_status', 'to_type',
  'polarity', 'weight', 'delay', 'confidence', 'description', 'evidence',
  'basis', 'link', 'check', 'override_reason', 'override_at',
] as const;

const q = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(m: SdohMap, titleOf: TitleOf, citation?: string): string {
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const rows = [...(citation ? [`# ${citation.replace(/[\r\n]+/g, ' ')}`] : []), CSV_COLS.join(',')];
  for (const e of m.edges) {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    rows.push(
      [
        a.id, nodeName(a, titleOf), a.code, a.code_status, a.type,
        b.id, nodeName(b, titleOf), b.code, b.code_status, b.type,
        e.polarity, e.weight, e.delay ? 'yes' : 'no', e.confidence, plainText(e.description), e.evidence.join(' '),
        e.basis, e.link, e.check, plainText(e.override_reason), e.override_at,
      ].map(q).join(','),
    );
  }
  return rows.join('\n') + '\n';
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** A CSV edge list becomes a new map. Nodes are matched by id, else by label; codes must exist in the scheme. */
export function importCSV(text: string, name: string, isCode: (c: string) => boolean): SdohMap {
  // leading `#` lines are comments (the licence citation that exportCSV writes)
  const rows = parseCSV(text.replace(/^\uFEFF?(?:#[^\r\n]*(?:\r?\n|$))+/, ''));
  if (!rows.length) throw new ImportError('The CSV file is empty. Nothing was imported.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (k: string) => head.indexOf(k);
  const need = ['polarity'];
  if (col('from_id') < 0 && col('from_label') < 0 && col('from') < 0) need.push('from_id or from_label');
  if (col('to_id') < 0 && col('to_label') < 0 && col('to') < 0) need.push('to_id or to_label');
  const missing = need.filter((k) => !k.includes(' or ') && col(k) < 0).concat(need.filter((k) => k.includes(' or ')));
  if (missing.length) throw new ImportError(`The CSV needs the column(s): ${missing.join(', ')}. Nothing was imported.`);
  let m = newMap(name);
  const nodes = new Map<string, MapNode>();
  const get = (r: string[], k: string) => (col(k) >= 0 ? (r[col(k)] ?? '').trim() : '');
  const end = (r: string[], side: 'from' | 'to', line: number) => {
    const id = get(r, `${side}_id`);
    const label = get(r, `${side}_label`) || get(r, side);
    const key = id || `label:${label.toLowerCase()}`;
    if (!id && !label) throw new ImportError(`Row ${line}: the ${side} end has no id or label. Nothing was imported.`);
    if (nodes.has(key)) return nodes.get(key)!;
    const code = get(r, `${side}_code`);
    let status = (get(r, `${side}_code_status`) as CodeStatus) || (code ? 'sdoh' : 'undetermined');
    if (!['sdoh', 'other', 'undetermined'].includes(status)) status = 'undetermined';
    if (status === 'sdoh' && (!code || !isCode(code))) throw new ImportError(`Row ${line}: '${code}' is not an ICD-11 code in this app. Nothing was imported.`);
    const n = newNode({
      id: id || undefined,
      code_status: status,
      code: status === 'sdoh' ? code : null,
      type: status === 'other' ? ((get(r, `${side}_type`) as OtherType) || null) : null,
      label: docFromText(label),
    });
    nodes.set(key, n);
    return n;
  };
  const edges = rows.slice(1).map((r, i) => {
    const line = i + 2;
    const a = end(r, 'from', line);
    const b = end(r, 'to', line);
    const pol = get(r, 'polarity');
    const polarity = pol === '+' ? '+' : pol === '−' || pol === '-' ? '−' : null;
    if (!polarity) throw new ImportError(`Row ${line}: polarity must be + or −. Nothing was imported.`);
    const w = get(r, 'weight');
    return newEdge({
      from: a.id,
      to: b.id,
      polarity,
      weight: w ? Number(w) : undefined,
      delay: /^(yes|true|1)$/i.test(get(r, 'delay')),
      confidence: (['low', 'medium', 'high'].includes(get(r, 'confidence')) ? get(r, 'confidence') : 'medium') as 'medium',
      description: docFromText(get(r, 'description')),
      evidence: get(r, 'evidence').split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger),
      // UI-18: a confirmed override keeps its reason; everything else claims evidence and is re-checked on import
      basis: get(r, 'basis') === 'override' && get(r, 'override_reason') ? 'override' : 'evidence',
      override_reason: get(r, 'override_reason') ? docFromText(get(r, 'override_reason')) : null,
      override_at: get(r, 'override_at') || null,
    });
  });
  const ns = [...nodes.values()];
  ns.forEach((n, i) => {
    n.x = 160 * Math.cos((2 * Math.PI * i) / ns.length) * Math.max(1, ns.length / 6);
    n.y = 160 * Math.sin((2 * Math.PI * i) / ns.length) * Math.max(1, ns.length / 6);
  });
  m = { ...m, nodes: ns, edges: [] };
  // validate through migrate so CSV obeys the same blocking rules as JSON
  return migrate({ ...m, edges });
}

// ───────────────────────── loop report (Markdown)
export interface ReportLabels {
  strengthLabel: string;
  reinforcing: string;
  balancing: string;
  truncated: string;
  none: string;
  notice: string;
  /** the ICD-11 licence citation, for the footer (K9) */
  citation?: string;
}
export function loopReportMD(m: SdohMap, titleOf: TitleOf, L: ReportLabels, result?: LoopResult): string {
  const r = result ?? findLoops(toGraph(m));
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const { names } = assignLoopNames(m.loops, r);
  const desc = (id: string) => {
    const n = byId.get(id)!;
    const tag = n.code_status === 'sdoh' ? n.code : n.code_status === 'other' ? `other${n.type ? `: ${n.type}` : ''}` : 'undetermined';
    return `${nodeName(n, titleOf)} (${tag})`;
  };
  const out = [
    `# Loop report — ${m.name}`,
    '',
    `Subject: ${m.subject || '—'} · ${m.icd11_release} · exported ${today()} from SDOH Loops (schema ${m.schema_version}).`,
    '',
    `> ${L.notice}`,
    '',
    `## Circumstances (${m.nodes.filter((n) => n.kind !== 'note').length})`,
    '',
    '| Circumstance | Code status | Code | Type |',
    '|---|---|---|---|',
    ...m.nodes.filter((n) => n.kind !== 'note').map((n) => `| ${nodeName(n, titleOf).replace(/\|/g, '\\|')} | ${n.code_status} | ${n.code ?? ''} | ${n.type ?? ''} |`),
    '',
    `## Loops (${r.loops.length}: ${r.loops.filter((l) => l.kind === 'R').length} ${L.reinforcing.toLowerCase()}, ${r.loops.filter((l) => l.kind === 'B').length} ${L.balancing.toLowerCase()})`,
    '',
  ];
  if (r.truncated) out.push(`**${L.truncated}**`, '');
  if (!r.loops.length) out.push(L.none, '');
  else {
    out.push(`Strength = ${L.strengthLabel}.`, '', '| Loop | Kind | Length | Overrides | Strength (heuristic) | Members |', '|---|---|---|---|---|---|');
    const basisOf = new Map(m.edges.map((e) => [e.id, e.basis]));
    for (const l of strongestLoops(r, names)) {
      const ov = l.edges.filter((id) => basisOf.get(id) !== 'evidence').length;
      out.push(`| ${names.get(l.key)} | ${l.kind === 'R' ? L.reinforcing : L.balancing} | ${l.length} | ${ov} | ${l.strength.toFixed(4)} | ${l.nodes.map(desc).join(' → ')} → ↺ |`);
    }
    out.push('');
  }
  const ev = m.edges.filter((e) => e.basis === 'evidence').length;
  out.push(`## Links (${m.edges.length}: ${ev} evidence · ${m.edges.length - ev} override)`, '', '| From | To | Polarity | Weight | Delay | Confidence | Basis | Evidence or override reason |', '|---|---|---|---|---|---|---|---|');
  for (const e of m.edges) {
    const why = e.basis === 'evidence' ? `${e.link} ${e.evidence.map((n) => `[${n}]`).join(' ')}` : `⚑ ${e.check}${e.override_reason ? ` — ${plainText(e.override_reason).replace(/\|/g, '\\|')} (${e.override_at})` : ''}`;
    out.push(`| ${desc(e.from)} | ${desc(e.to)} | ${e.polarity} | ${e.weight} | ${e.delay ? '‖' : ''} | ${e.confidence} | ${e.basis} | ${why} |`);
  }
  if (L.citation) out.push('', '---', '', L.citation);
  return out.join('\n') + '\n';
}

/**
 * Loop names, stable for the life of the map (K6 D4). A loop is keyed by its edge set; a name stored in `m.loops` (a
 * rename, or a number given earlier) is kept. A loop without one takes the next free number of its kind (R1, R2, B1…),
 * in strength order when several appear at once (app-methods §4). `added` lists the new names, for the caller to store.
 */
export function assignLoopNames(stored: MapLoopName[], r: LoopResult): { names: Map<string, string>; added: MapLoopName[] } {
  const byKey = new Map(stored.map((l) => [l.id, l.name]));
  const used = new Set(stored.map((l) => l.name));
  const names = new Map<string, string>();
  const added: MapLoopName[] = [];
  for (const l of strongestLoops(r)) {
    const have = byKey.get(l.key);
    if (have) {
      names.set(l.key, have);
      continue;
    }
    let n = 1;
    while (used.has(`${l.kind}${n}`)) n++;
    const name = `${l.kind}${n}`;
    used.add(name);
    names.set(l.key, name);
    added.push({ id: l.key, name, members: l.nodes });
  }
  return { names, added };
}
