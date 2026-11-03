/**
 * UI-18 evidence check (app-requirements UI-18; app-methods §2 `basis`, A0). A link between two circumstances is
 * `evidence` only when a shipped link in links.yaml lists the From code in its `codes.from` and the To code in its
 * `codes.to` (a listed code covers its descendants), in the same direction AND with the same polarity. Matching never
 * widens to the whole block (Daniel, 2026-10-24, option B): a block-level near miss is `outside-codes:<id>`, and names
 * that link's codes. Anything else is an override that needs a deliberate confirm and a reason. Withheld links are
 * reported (with their reason) but never back an edge.
 */
import { links, linksCanCycle, matchKeys, notOffered, endpointTitle, covers, rootsOf, type Link } from '../data/scheme';
import type { Polarity } from '../analysis';

export type Basis = 'evidence' | 'override' | 'needs-review';
/** `match` · `no-link` · `outside-codes:<id>` · `opposite-polarity` · `withheld:<id>` · `uncoded-end` (app-methods §2). */
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
  /** nearest supported alternatives: the block-level near miss, or shipped links leaving the From code or entering the To code */
  alternatives: Link[];
  /** plain-language reason the link is or is not supported */
  message: string;
}

const coded = (e: EndRef) => e.kind !== 'note' && e.code_status === 'sdoh' && !!e.code;

/** A link's evidence scope, as a person reads it: "QE04 → QD80". */
export const scopeOf = (l: Link) => `${rootsOf(l.codes.from).join(', ')} → ${rootsOf(l.codes.to).join(', ')}`;

/** Block-level candidates (code → parent → QD71 sub-block → block), most specific first. Used only for near misses. */
function blockMatch<T extends { from: string; to: string }>(cands: T[], fromKeys: string[], toKeys: string[]): T[] {
  return cands
    .filter((l) => fromKeys.includes(l.from) && toKeys.includes(l.to))
    .sort((a, b) => fromKeys.indexOf(a.from) + toKeys.indexOf(a.to) - (fromKeys.indexOf(b.from) + toKeys.indexOf(b.to)));
}

export function checkLink(from: EndRef, to: EndRef, polarity: Polarity, names?: { from: string; to: string }): CheckResult {
  if (!coded(from) || !coded(to)) {
    const which = !coded(from) ? names?.from ?? 'The From circumstance' : names?.to ?? 'The To circumstance';
    return { check: 'uncoded-end', link: null, withheld: null, alternatives: [], message: `${which} has no SDOH code, so no evidence link in this app can back this link.` };
  }
  const f = from.code!;
  const t = to.code!;
  const shipped = links.filter((l) => covers(l.codes.from, f) && covers(l.codes.to, t));
  const same = shipped.find((l) => l.polarity === polarity);
  if (same) return { check: 'match', link: same, withheld: null, alternatives: [], message: `Evidence link ${same.id} supports this link (${same.polarity}).` };
  if (shipped.length) {
    const o = shipped[0];
    return { check: 'opposite-polarity', link: o, withheld: null, alternatives: [o], message: `Evidence link ${o.id} supports the opposite polarity here (${o.polarity}), not ${polarity}.` };
  }
  const fk = matchKeys(f);
  const tk = matchKeys(t);
  const near = blockMatch(links, fk, tk);
  const n = near.find((l) => l.polarity === polarity) ?? near[0];
  if (n) return { check: `outside-codes:${n.id}`, link: null, withheld: null, alternatives: [n], message: `Evidence link ${n.id} connects these blocks, but its evidence covers ${scopeOf(n)} only.` };
  const alternatives = [...links.filter((l) => covers(l.codes.from, f)), ...links.filter((l) => covers(l.codes.to, t))].filter((l, i, a) => a.indexOf(l) === i).slice(0, 4);
  const w = blockMatch(notOffered, fk, tk)[0];
  if (w) return { check: `withheld:${w.id}`, link: null, withheld: { id: w.id, reason: w.reason }, alternatives, message: `Evidence link ${w.id} is withheld: ${w.reason.join(' ')}` };
  return { check: 'no-link', link: null, withheld: null, alternatives, message: `No evidence link from ${f} to ${t} in this app (${endpointTitle(f)} → ${endpointTitle(t)}).` };
}

/** Is there any cycle among the shipped links' codes? If not, no loop can close on evidence alone. Computed at build time. */
export function evidenceCanCloseALoop(): boolean {
  return linksCanCycle;
}
