/**
 * SAFETY H1 lint (SAFETY 0.1.1) — shared by the content build (pack strings), the rendered-text crawl and the dist
 * lint in tests/safety/.
 *
 * Rule (tools/validate_pack.py 0.1.1): the exact `safety.yaml → allowed_phrases` are removed first (case-insensitive),
 * then each `blocked_phrases` entry is matched case-insensitively at a word start (so "diagnos" catches
 * diagnose/diagnosis/diagnosed). Strings in `allowed_contexts` are skipped by the caller. There is no general negation
 * exemption (Daniel, 2026-10-23): "you don't need a diagnosis, you have …" fails.
 */
export interface LintHit {
  where: string;
  phrase: string;
  excerpt: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Blank out the allowed phrases (same length, so excerpts keep their positions). */
export function stripAllowed(text: string, allowedPhrases: string[]): string {
  let t = text;
  for (const ap of allowedPhrases) t = t.replace(new RegExp(esc(ap), 'gi'), (m) => ' '.repeat(m.length));
  return t;
}

export function lintText(where: string, text: string, phrases: string[], allowedPhrases: string[] = []): LintHit[] {
  const hits: LintHit[] = [];
  const low = stripAllowed(text, allowedPhrases).toLowerCase();
  for (const ph of phrases) {
    const re = new RegExp('\\b' + esc(ph.toLowerCase()), 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(low))) {
      hits.push({ where, phrase: ph, excerpt: text.slice(Math.max(0, m.index - 50), m.index + ph.length + 40).replace(/\s+/g, ' ') });
    }
  }
  return hits;
}

/** Turn `situations.items[].definition` into a matcher for walk paths like `situations.items[52].definition`. */
export function allowedMatchers(fields: string[]): RegExp[] {
  return fields.map((f) => {
    const e = esc(f).split('\\[\\]').join('\\[\\d+\\]');
    return new RegExp('^' + e + '(\\[\\d+\\]|\\.|$)');
  });
}

/** Walk every string with its path; a top-level list gives `[0].x`, so callers join with the file base directly. */
export function* walkStrings(obj: unknown, path = ''): Generator<[string, string]> {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) yield* walkStrings(obj[i], `${path}[${i}]`);
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) yield* walkStrings(v, path ? `${path}.${k}` : k);
  } else if (typeof obj === 'string') {
    yield [path, obj];
  }
}

/** `base` + walk path, as validate_pack.py 0.1.1 joins them (`references[3].abstract`, `situations.items[0].title`). */
export const joinPath = (base: string, path: string) => (path.startsWith('[') ? `${base}${path}` : `${base}.${path}`);
