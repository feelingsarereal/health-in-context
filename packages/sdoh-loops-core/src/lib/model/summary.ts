/**
 * SL26 / SL28: the circumstances table as data — one row per item on the map, in map order — shared by the list view,
 * the notebook's case summary and the case report, so the three always say the same thing.
 */
import { codeMap } from '../data/scheme';
import { S } from '../data/core';
import type { MapEdge, MapNode, SdohMap } from './map';
import { plainText } from './rich';

/** One circumstance's links in or out, as text: "+ Low income (L03 [1][2])", "− Support (⚑ override)". */
export function linkSummary(map: SdohMap, nm: (id: string) => string, n: MapNode, dir: 'in' | 'out'): { edge: MapEdge; text: string }[] {
  return map.edges
    .filter((e) => (dir === 'out' ? e.from : e.to) === n.id)
    .map((e) => ({
      edge: e,
      text: `${e.polarity} ${nm(dir === 'out' ? e.to : e.from)} (${e.basis === 'evidence' ? `${e.link}${e.evidence.length ? ` ${e.evidence.map((r) => `[${r}]`).join('')}` : ''}` : e.basis === 'override' ? '⚑ override' : '⚑ needs review'})`,
    }));
}

export interface SummaryRow {
  id: string;
  name: string;
  /** the code, or '' (a canvas note or no code) */
  code: string;
  /** WHO's title for the code */
  codeTitle: string;
  /** "Social circumstance (ICD-11 SDOH)", "? Not sure yet", "Note" */
  status: string;
  description: string;
  out: string[];
  in: string[];
}
export function summaryRow(map: SdohMap, nm: (id: string) => string, n: MapNode, noteLabel = 'Note'): SummaryRow {
  return {
    id: n.id,
    name: nm(n.id),
    code: n.kind === 'note' ? '' : n.code ?? '',
    codeTitle: n.kind !== 'note' && n.code ? codeMap.get(n.code)?.title ?? '' : '',
    status: n.kind === 'note' ? noteLabel : `${n.code_status === 'undetermined' ? '? ' : ''}${S.codes.status[n.code_status]}${n.type ? ` · ${n.type}` : ''}`,
    description: plainText(n.kind === 'note' ? n.notes : n.circumstance),
    out: linkSummary(map, nm, n, 'out').map((l) => l.text),
    in: linkSummary(map, nm, n, 'in').map((l) => l.text),
  };
}
