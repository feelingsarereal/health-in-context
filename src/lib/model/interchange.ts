/**
 * Export and import (planner.yaml: export [json, csv-edges, png, svg, md-report]; import [json, csv-edges]).
 * PNG/SVG come from the canvas (src/components/map/Canvas.tsx); everything here is pure text.
 */
import { findLoops, strongestLoops, type LoopResult } from '../analysis';
import { migrate, newEdge, newMap, newNode, toGraph, ImportError, type MapNode, type SdohMap, type CodeStatus, type OtherType } from './map';
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

export function exportJSON(m: SdohMap): string {
  return JSON.stringify(m, null, 2) + '\n';
}

export function importJSON(text: string): SdohMap {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('This file is not valid JSON. Nothing was imported.');
  }
  return migrate(raw);
}

// ───────────────────────── CSV
const CSV_COLS = [
  'from_id', 'from_label', 'from_code', 'from_code_status', 'from_type',
  'to_id', 'to_label', 'to_code', 'to_code_status', 'to_type',
  'polarity', 'weight', 'delay', 'confidence', 'description', 'evidence',
] as const;

const q = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(m: SdohMap, titleOf: TitleOf): string {
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const rows = [CSV_COLS.join(',')];
  for (const e of m.edges) {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    rows.push(
      [
        a.id, nodeName(a, titleOf), a.code, a.code_status, a.type,
        b.id, nodeName(b, titleOf), b.code, b.code_status, b.type,
        e.polarity, e.weight, e.delay ? 'yes' : 'no', e.confidence, plainText(e.description), e.evidence.join(' '),
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
  const rows = parseCSV(text);
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
}
export function loopReportMD(m: SdohMap, titleOf: TitleOf, L: ReportLabels, result?: LoopResult): string {
  const r = result ?? findLoops(toGraph(m));
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const named = new Map(m.loops.map((l) => [l.id, l.name]));
  const names = defaultLoopNames(r);
  const desc = (id: string) => {
    const n = byId.get(id)!;
    const tag = n.code_status === 'sdoh' ? n.code : n.code_status === 'other' ? `other${n.type ? `: ${n.type}` : ''}` : 'undetermined';
    return `${nodeName(n, titleOf)} (${tag})`;
  };
  const out = [
    `# Loop report — ${m.name}`,
    '',
    `Subject: ${m.subject || '—'} · ${m.icd11_release} · exported ${new Date().toISOString().slice(0, 10)} from SDOH Loops (schema ${m.schema_version}).`,
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
    out.push(`Strength = ${L.strengthLabel}.`, '', '| Loop | Kind | Length | Strength (heuristic) | Members |', '|---|---|---|---|---|');
    for (const l of strongestLoops(r)) {
      out.push(`| ${named.get(l.key) ?? names.get(l.key)} | ${l.kind === 'R' ? L.reinforcing : L.balancing} | ${l.length} | ${l.strength.toFixed(4)} | ${l.nodes.map(desc).join(' → ')} → ↺ |`);
    }
    out.push('');
  }
  out.push(`## Links (${m.edges.length})`, '', '| From | To | Polarity | Weight | Delay | Confidence | Evidence |', '|---|---|---|---|---|---|---|');
  for (const e of m.edges) out.push(`| ${desc(e.from)} | ${desc(e.to)} | ${e.polarity} | ${e.weight} | ${e.delay ? '‖' : ''} | ${e.confidence} | ${e.evidence.map((n) => `[${n}]`).join(' ') || 'user-drawn'} |`);
  return out.join('\n') + '\n';
}

/** Default loop names R1, R2, B1… in strength order (app-methods §4). */
export function defaultLoopNames(r: LoopResult): Map<string, string> {
  const c = { R: 0, B: 0 };
  const out = new Map<string, string>();
  for (const l of strongestLoops(r)) out.set(l.key, `${l.kind}${++c[l.kind]}`);
  return out;
}
