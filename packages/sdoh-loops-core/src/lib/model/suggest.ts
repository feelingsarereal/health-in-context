/**
 * SL27: the local code suggester — a selection matched against the pinned pack's code titles, index terms and builder
 * search aliases, on the device. Chapter 24 (social circumstances) only, so it never offers a diagnosis (H1); always
 * shown as "suggested", and nothing is chosen for the user.
 *
 * Words are compared by a light stem ("evicted" ~ "eviction", "housing" ~ "house"), ICD filler words ("problem",
 * "associated", "unspecified") carry no weight, and a rarer word counts for more. A small table turns everyday wording
 * into WHO's vocabulary ("lost my job" → "unemployment"): it maps words to words, never to a code, so every code still
 * comes from the pack's own text.
 */
import { codes, pickerOrder, searchAliases, type Code } from '../data/scheme';

export interface Suggestion {
  code: string;
  title: string;
  score: number;
  /** the pack text that matched best (the title, an index term, or a search alias) */
  via: string;
  viaKind: 'title' | 'index' | 'alias';
  /** the words of the selection that matched, as typed */
  words: string[];
  /** the words of `via` that matched, to highlight */
  viaWords: string[];
}

const STOP = new Set(
  'a an and or of the to in on at for from by with without as is are was were be been being it its this that these those my me i we our you your he him his she her they them their since about into over under than then there here have has had do does did not no nor but so if when while because problem problems associated associat other specified unspecified related relation relationship relationships person people due also any some such being certain'.split(' '),
);
/** everyday wording → WHO's words (word substitutions only; the pack decides which codes they reach) */
const PARAPHRASE: [RegExp, string][] = [
  [/\b(?:lost|lose|loses|losing|laid off|been laid off|got laid off|fired|got fired|let go|out of)\s+(?:(?:my|his|her|their|our|the|a|your)\s+)?(?:job|jobs|work|employment)\b/g, ' unemployment '],
  [/\b(?:no|without|can't find|cannot find|couldn't find)\s+(?:a\s+)?(?:job|work)\b/g, ' unemployment '],
  [/\b(?:out of work|unemployed|jobless)\b/g, ' unemployment '],
  [/\b(?:can't|cannot|couldn't|unable to)\s+(?:afford|pay)\s+(?:the\s+)?(?:rent|food|groceries|bills)\b/g, ' low income '],
  [/\b(?:no|not enough)\s+(?:money|income)\b/g, ' low income '],
  [/\bbehind on (?:the )?rent\b/g, ' behind on rent '],
];

export function stem(w: string): string {
  let s = w.toLowerCase().replace(/['’]s$/, '').replace(/[^a-z]/g, '');
  if (s.length <= 3) return s;
  for (const suf of ['ations', 'ation', 'ions', 'ion', 'ments', 'ment', 'ings', 'ing', 'ies', 'ied', 'ed', 'es', 's', 'e']) {
    if (s.endsWith(suf) && s.length - suf.length >= 3) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s.replace(/y$/, 'i');
}
const words = (t: string) => t.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
const stems = (t: string) => new Set(words(t).map(stem).filter((w) => w && !STOP.has(w) && !STOP.has(w.replace(/i$/, 'y'))));

interface Term {
  text: string;
  kind: Suggestion['viaKind'];
  stems: Set<string>;
}
let index: { code: Code; terms: Term[] }[] | null = null;
let idf: Map<string, number> | null = null;
function build() {
  if (index) return;
  const order = new Map(pickerOrder.map((c, i) => [c, i]));
  index = codes
    .filter((c) => c.code.startsWith('Q'))
    .sort((a, b) => (order.get(a.code) ?? 1e9) - (order.get(b.code) ?? 1e9))
    .map((c) => ({
      code: c,
      terms: [
        { text: c.title, kind: 'title' as const },
        ...c.index_terms.filter((t) => t !== c.title).map((t) => ({ text: t, kind: 'index' as const })),
        ...searchAliases.filter((a) => a.code === c.code).flatMap((a) => [a.term, ...a.also]).map((t) => ({ text: t, kind: 'alias' as const })),
      ].map((t) => ({ ...t, stems: stems(t.text) })).filter((t) => t.stems.size),
    }));
  const df = new Map<string, number>();
  for (const e of index) for (const s of new Set(e.terms.flatMap((t) => [...t.stems]))) df.set(s, (df.get(s) ?? 0) + 1);
  idf = new Map([...df].map(([s, n]) => [s, Math.log(1 + index!.length / n)]));
}

/**
 * The top codes for a piece of text (default 5), best first; an empty list when nothing matches. A term scores the
 * weight of its words found in the text times the share of its words found, so a short exact term ("Problem associated
 * with unemployment") beats a long one that only shares a word.
 */
export function suggestCodes(text: string, limit = 5): Suggestion[] {
  build();
  let t = ` ${text.toLowerCase().replace(/[’]/g, "'")} `;
  // the words a paraphrase stands for, so they are highlighted as the match ("lost my job" for "unemployment")
  const stood = new Map<string, string[]>();
  for (const [re, to] of PARAPHRASE)
    t = t.replace(re, (m) => {
      for (const s of stems(to)) stood.set(s, [...(stood.get(s) ?? []), ...words(m)]);
      return to;
    });
  const q = stems(t);
  if (!q.size) return [];
  const out: Suggestion[] = [];
  for (const { code, terms } of index!) {
    let best: { score: number; term: Term; hit: string[] } | null = null;
    for (const term of terms) {
      const hit = [...term.stems].filter((s) => q.has(s));
      if (!hit.length) continue;
      const weight = hit.reduce((n, s) => n + (idf!.get(s) ?? 1), 0);
      const all = [...term.stems].reduce((n, s) => n + (idf!.get(s) ?? 1), 0);
      // an alias phrase found whole in the text is the builder's own pointer: it counts double
      const whole = term.kind === 'alias' && t.includes(term.text.toLowerCase()) ? 2 : 1;
      const score = weight * (weight / all) * whole;
      if (!best || score > best.score) best = { score, term, hit };
    }
    if (best) {
      const hitSet = new Set(best.hit);
      out.push({
        code: code.code,
        title: code.title,
        score: Math.round(best.score * 1000) / 1000,
        via: best.term.text,
        viaKind: best.term.kind,
        words: [...new Set([...words(text).filter((w) => hitSet.has(stem(w))), ...best.hit.flatMap((h) => stood.get(h) ?? []).flatMap((w) => words(text).filter((x) => x.toLowerCase() === w.toLowerCase()))])],
        viaWords: [...new Set(words(best.term.text).filter((w) => hitSet.has(stem(w))))],
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
