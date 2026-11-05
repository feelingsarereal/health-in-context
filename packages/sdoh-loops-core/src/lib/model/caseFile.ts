/**
 * SL28 point 4: a case — the map plus its notebook — as one file. "Export case" writes the map file (schema 3, the
 * notebook inside it) with a provenance block: how many notes, spans, mentions and annotations it holds, how many
 * identifiers were replaced by labels in each category (never the values), and the pins it was made under. Import goes
 * through the map file's own import (migrate, sanitize, reconcile), so both sides come back with their links; the block
 * itself is written fresh on every export and is not kept.
 */
import { exportJSON } from './interchange';
import type { SdohMap } from './map';
import { isChip, type Notebook } from './notebook';
import type { IdentifierCategory } from './identifiers';

export interface Pins {
  core: string;
  pack: string;
  icd11: string;
}
export interface CaseProvenance {
  exported: string;
  notes: number;
  spans: number;
  /** inline @ mentions, counted apart from the spans */
  mentions: number;
  annotations: number;
  /** comments on spans */
  comments: number;
  /** identifiers replaced by a [label], per category: how many distinct values, never the values */
  labelled: Partial<Record<IdentifierCategory, number>>;
  labelledTotal: number;
  pins: Pins;
}

export function caseProvenance(nb: Notebook | undefined, pins: Pins, when = new Date()): CaseProvenance {
  const spans = nb?.spans ?? [];
  const labelled = { ...(nb?.replaced ?? {}) };
  return {
    exported: when.toISOString(),
    notes: nb?.notes.length ?? 0,
    spans: spans.filter((x) => !isChip(x)).length,
    mentions: spans.filter(isChip).length,
    annotations: nb?.annotations?.length ?? 0,
    comments: (nb?.annotations ?? []).filter((a) => a.text).length,
    labelled,
    labelledTotal: Object.values(labelled).reduce((a, b) => a + (b ?? 0), 0),
    pins,
  };
}

/** The case file: the map file with its notebook, plus `provenance`. */
export function exportCase(m: SdohMap, pins: Pins, citation?: string, when = new Date()): string {
  const doc = JSON.parse(exportJSON(m, citation)) as Record<string, unknown>;
  return JSON.stringify({ ...doc, provenance: caseProvenance(m.notebook, pins, when) }, null, 2) + '\n';
}
