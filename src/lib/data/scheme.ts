/** ICD-11 codes (situations.json) and the evidence-graded links (links.json), with the association matcher (UI-03). */
import situationsJson from '@/data/situations.json';
import linksJson from '@/data/links.json';

export interface XRef { title: string; code?: string | null }
export interface Code {
  code: string; title: string; group: string; parent: string | null; subgroup: string | null;
  definition: string | null; definition_check: string | null;
  inclusions: (string | XRef)[]; exclusions: (string | XRef)[]; coded_elsewhere: (string | XRef)[];
  index_terms: string[]; uri: string | null; who_browser: string | null; source_url: string; verified_on: string;
  crosswalk: { icd10cm: string[]; hp2030: string[]; proposed?: boolean; hp2030_titles?: (string | null)[]; icd10cm_titles?: (string | null)[]; sources?: number[] } | null;
  residual: null | 'other' | 'unspecified'; parent_title?: string | null;
}
export interface Group { id: string; title: string; tier: string; uri?: string; source_url?: string; functioning?: boolean; subgroup_of?: string; note?: string }
export interface Link {
  id: string; from: string; to: string; polarity: '+' | '−'; grade: string; mechanism: string; refs: number[]; suggest: string[];
  /** the codes the cited evidence names on each end; a code also backs its descendants (ACTION-PACK 0.1.1, option B) */
  codes: { from: string[]; to: string[] };
}
export interface NotOffered { id: string; from: string; to: string; polarity: string; grade: string; refs: number[]; reason: string[]; kind: 'withheld' | 'unverified' }

const SJ = situationsJson as any;
export const scheme = SJ.scheme as { id: string; name: string; release: string; source: string; official_browser: string; verified_on: string; interim_source?: string };
export const tiers = SJ.tiers as Record<string, string>;
export const tierBasis = SJ.tier_basis as string | null;
export const groups = SJ.groups as Group[];
export const codes = SJ.codes as Code[];
export const pickerOrder = SJ.picker_order as string[];
export const knownGaps = SJ.known_gaps as string[];
const LJ = linksJson as any;
export const grades = LJ.grades as Record<string, string>;
export const linkFraming = LJ.framing as string | null;
export const links = LJ.links as Link[];
export const notOffered = LJ.not_offered as NotOffered[];
/** Computed at build time from the shipped links' code graph (K3 item 6). */
export const linksCanCycle = LJ.can_cycle as boolean;

export const codeMap = new Map(codes.map((c) => [c.code, c]));
export const groupMap = new Map(groups.map((g) => [g.id, g]));
export const TIER_ORDER = Object.keys(tiers);
export const isFunctioning = (c: Code) => !!groupMap.get(c.group)?.functioning;

/** The block (or the QD71 housing sub-block) a code is coloured by. */
export function colourGroup(code: string): string | undefined {
  const c = codeMap.get(code);
  return c ? c.subgroup ?? c.group : undefined;
}
export function endpointTitle(id: string): string {
  return codeMap.get(id)?.title ?? groupMap.get(id)?.title ?? id;
}
export function endpointTier(id: string): string {
  const c = codeMap.get(id);
  const g = groupMap.get(c ? c.subgroup ?? c.group : id);
  return g?.tier ?? 'functioning';
}

/** Keys a code matches in links.yaml: itself, its parents, its QD71 sub-block, its block (KICKOFF §8.3.4). */
export function matchKeys(code: string): string[] {
  const keys: string[] = [];
  let c = codeMap.get(code);
  const seen = new Set<string>();
  while (c && !seen.has(c.code)) {
    seen.add(c.code);
    keys.push(c.code);
    if (c.subgroup) keys.push(c.subgroup);
    c = c.parent ? codeMap.get(c.parent) : undefined;
  }
  const g = codeMap.get(code)?.group;
  if (g) keys.push(g);
  return [...new Set(keys)];
}
/** Is a code one of `listed`, or a descendant of one? A link's `codes` back their descendants, never their parents. */
export function covers(listed: string[], code: string): boolean {
  let c = codeMap.get(code);
  const seen = new Set<string>();
  while (c && !seen.has(c.code)) {
    seen.add(c.code);
    if (listed.includes(c.code)) return true;
    c = c.parent ? codeMap.get(c.parent) : undefined;
  }
  return false;
}
/** The listed codes without those a listed ancestor already covers: what a person reads ("QE82", not QE82 and QE82.0–3). */
export function rootsOf(listed: string[]): string[] {
  return listed.filter((c) => !listed.some((o) => o !== c && covers([o], c)));
}
/** Codes the picker offers on one end of a link: the listed codes and their descendants. */
export function codesUnder(listed: string[]): Code[] {
  return pickerOrder.map((c) => codeMap.get(c)!).filter((c) => covers(listed, c.code));
}

const GRADE_ORDER = ['S', 'M', 'F'];
function rank(l: Link, other: string) {
  return [TIER_ORDER.indexOf(endpointTier(other)), GRADE_ORDER.indexOf(l.grade), l.id] as const;
}
const cmp = (a: readonly (number | string)[], b: readonly (number | string)[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
};
/**
 * UI-03 at code level (UI-18): a link is under Leads to only when the code is in its `codes.from`, and under Comes from
 * only when it is in its `codes.to`. Ordered by tier (structural → behavioural), then grade, then id. With a list of
 * codes (the 2nd-degree view), a link is listed when its codes and the list overlap either way.
 */
export function associations(code: string | string[]) {
  const on = (listed: string[]) => (Array.isArray(code) ? code.some((c) => covers(listed, c) || listed.some((x) => covers([c], x))) : covers(listed, code));
  const leadsTo = links.filter((l) => on(l.codes.from)).sort((a, b) => cmp(rank(a, a.to), rank(b, b.to)));
  const comesFrom = links.filter((l) => on(l.codes.to)).sort((a, b) => cmp(rank(a, a.from), rank(b, b.from)));
  return { leadsTo, comesFrom };
}

/** Code picker search over code, title and index_terms. */
export function searchCodes(q: string): Code[] {
  const t = q.trim().toLowerCase();
  const all = pickerOrder.map((c) => codeMap.get(c)!);
  if (!t) return all;
  const words = t.split(/\s+/);
  return all.filter((c) => {
    const hay = [c.code, c.title, ...c.index_terms].join(' \u0001 ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
