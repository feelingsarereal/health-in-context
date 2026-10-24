/**
 * UI-18 evidence check (app-requirements UI-18; app-methods §2 `basis`, A0). A link between two circumstances is
 * `evidence` only when a shipped link in links.yaml matches both ends — walking each code upward: the code, its parent,
 * the QD71 sub-block, its block — in the same direction AND with the same polarity. Anything else is an override that
 * needs a deliberate confirm and a reason. Withheld links are reported (with their reason) but never back an edge.
 */
import { links, matchKeys, notOffered, endpointTitle, codeMap, groupMap, type Link } from '@/lib/data/scheme';
import type { Polarity } from '../analysis';

export type Basis = 'evidence' | 'override' | 'needs-review';
/** `match` · `no-link` · `opposite-polarity` · `withheld:<id>` · `uncoded-end` (app-methods §2). */
export type Check = string;

export interface EndRef {
  code_status: 'sdoh' | 'other' | 'undetermined';
  code: string | null;
  kind?: 'circumstance' | 'note';
}

export interface CheckResult {
  check: Check;
  /** the shipped link that backs the edge (match) or that supports the other polarity (opposite-polarity) */
  link: Link | null;
  /** the withheld link and its reasons */
  withheld: { id: string; reason: string[] } | null;
  /** nearest supported alternatives: shipped links leaving the From end or entering the To end */
  alternatives: Link[];
  /** plain-language reason the link is or is not supported */
  message: string;
}

const coded = (e: EndRef) => e.kind !== 'note' && e.code_status === 'sdoh' && !!e.code;

/** Specificity rank of a match: lower is more specific (code before parent before sub-block before block). */
function bestMatch<T extends { from: string; to: string }>(cands: T[], fromKeys: string[], toKeys: string[]): T[] {
  return cands
    .filter((l) => fromKeys.includes(l.from) && toKeys.includes(l.to))
    .sort((a, b) => fromKeys.indexOf(a.from) + toKeys.indexOf(a.to) - (fromKeys.indexOf(b.from) + toKeys.indexOf(b.to)));
}

export function checkLink(from: EndRef, to: EndRef, polarity: Polarity, names?: { from: string; to: string }): CheckResult {
  if (!coded(from) || !coded(to)) {
    const which = !coded(from) ? names?.from ?? 'The From circumstance' : names?.to ?? 'The To circumstance';
    return { check: 'uncoded-end', link: null, withheld: null, alternatives: [], message: `${which} has no SDOH code, so no evidence link in this app can back this link.` };
  }
  const fk = matchKeys(from.code!);
  const tk = matchKeys(to.code!);
  const shipped = bestMatch(links, fk, tk);
  const same = shipped.find((l) => l.polarity === polarity);
  if (same) return { check: 'match', link: same, withheld: null, alternatives: [], message: `Evidence link ${same.id} supports this link (${same.polarity}).` };
  const alternatives = [...links.filter((l) => fk.includes(l.from)), ...links.filter((l) => tk.includes(l.to))].filter((l, i, a) => a.indexOf(l) === i).slice(0, 4);
  if (shipped.length) {
    const o = shipped[0];
    return { check: 'opposite-polarity', link: o, withheld: null, alternatives: [o], message: `Evidence link ${o.id} supports the opposite polarity here (${o.polarity}), not ${polarity}.` };
  }
  const w = bestMatch(notOffered, fk, tk)[0];
  if (w) return { check: `withheld:${w.id}`, link: null, withheld: { id: w.id, reason: w.reason }, alternatives, message: `Evidence link ${w.id} is withheld: ${w.reason.join(' ')}` };
  return { check: 'no-link', link: null, withheld: null, alternatives, message: `No evidence link from ${from.code} to ${to.code} in this app (${endpointTitle(from.code!)} → ${endpointTitle(to.code!)}).` };
}

/** Is there any cycle among the shipped links at all? If not, no loop can close on evidence alone. */
export function evidenceCanCloseALoop(): boolean {
  const adj = new Map<string, Set<string>>();
  // endpoints overlap when one contains the other (a code inside a block, a sub-block inside its block)
  const up = (e: string) => (codeMap.has(e) ? matchKeys(e) : [e, groupMap.get(e)?.subgroup_of].filter((x): x is string => !!x));
  const overlap = (a: string, b: string) => up(a).includes(b) || up(b).includes(a);
  const starts = (end: string) => links.filter((l) => overlap(end, l.from));
  for (const l of links) adj.set(l.id, new Set(starts(l.to).map((n) => n.id)));
  const seen = new Set<string>();
  const stack = new Set<string>();
  const dfs = (id: string): boolean => {
    if (stack.has(id)) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    stack.add(id);
    for (const n of adj.get(id) ?? []) if (dfs(n)) return true;
    stack.delete(id);
    return false;
  };
  return links.some((l) => dfs(l.id));
}
