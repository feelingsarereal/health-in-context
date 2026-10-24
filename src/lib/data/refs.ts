/** References (with verbatim abstracts), glossary and the 101s. */
import referencesJson from '@/data/references.json';
import glossaryJson from '@/data/glossary.json';
import conceptsJson from '@/data/concepts.json';

export interface Ref {
  n: number; key: string; tier: 'seminal' | 'classic' | 'current' | 'background'; citation: string; year: number;
  doi: string | null; url: string | null; isbn: string | null; abstract: string | null; abstract_source: string | null; abstract_note: string | null;
  harvested_on: string | null; summary: string | null; why_it_mattered: string | null; role_here: string; role_note: string | null;
  verified: boolean; verified_on: string | null; used_by: string[];
}
export interface Term { id: string; term: string; kind?: string; variants: string[]; short: string; definition: string; concept?: string; see?: string[]; further_refs?: number[] }
export interface Concept { id: string; title: string; one_liner: string; why_here: string; prerequisites: string[]; terms: string[]; further_reading: { title: string; url: string; kind?: string }[]; body: string; cites: number[] }

export const references = referencesJson as Ref[];
export const glossary = glossaryJson as Term[];
export const concepts = conceptsJson as Concept[];
export const refMap = new Map(references.map((r) => [r.n, r]));
export const termMap = new Map(glossary.map((t) => [t.id, t]));
export const conceptMap = new Map(concepts.map((c) => [c.id, c]));
export const TIERS: { id: Ref['tier']; label: string }[] = [
  { id: 'seminal', label: 'Seminal' },
  { id: 'classic', label: 'Classic' },
  { id: 'current', label: 'Current' },
  { id: 'background', label: 'Background' },
];
