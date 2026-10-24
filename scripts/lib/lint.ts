/**
 * SAFETY H1 lint — shared by the content build (pack strings), the dist lint (tests/safety/lint-dist.ts) and the
 * rendered-text crawl (tests/safety/h1-lint.spec.ts).
 *
 * Rule (validate_pack.py): case-insensitive, word-start match of each `safety.yaml → blocked_phrases` entry
 * (so "diagnos" catches diagnose/diagnosis/diagnosed). Strings in `allowed_contexts` are skipped.
 *
 * Builder addition, listed on /methods for Daniel to ratify: a hit that is *negated* within the preceding four
 * words ("does not diagnose", "not a diagnosis", "no diagnosis language") is the safety disclaimer itself, not
 * diagnosis language. It is reported as `negated` and does not fail. Every other hit fails.
 */
export interface LintHit {
  where: string;
  phrase: string;
  excerpt: string;
  negated: boolean;
}

const NEGATORS = /\b(not|no|never|nor|without|doesn't|don't|isn't|won't|cannot|can't)\b/i;

export function lintText(where: string, text: string, phrases: string[]): LintHit[] {
  const hits: LintHit[] = [];
  const low = text.toLowerCase();
  for (const ph of phrases) {
    const re = new RegExp('\\b' + ph.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(low))) {
      const before = low.slice(Math.max(0, m.index - 60), m.index);
      const lastWords = before.split(/[.;:!?\n]/).pop()!.trim().split(/\s+/).slice(-4).join(' ');
      hits.push({
        where,
        phrase: ph,
        excerpt: text.slice(Math.max(0, m.index - 50), m.index + ph.length + 40).replace(/\s+/g, ' '),
        negated: NEGATORS.test(lastWords),
      });
    }
  }
  return hits;
}

/** Turn `situations.items[].definition` into a matcher for walk paths like `situations.items[52].definition`. */
export function allowedMatchers(fields: string[]): RegExp[] {
  return fields.map((f) => {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('\\[\\]').join('\\[\\d+\\]');
    return new RegExp('^' + esc + '(\\[\\d+\\]|\\.|$)');
  });
}

export function* walkStrings(obj: unknown, path = ''): Generator<[string, string]> {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) yield* walkStrings(obj[i], `${path}[${i}]`);
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) yield* walkStrings(v, path ? `${path}.${k}` : k);
  } else if (typeof obj === 'string') {
    yield [path, obj];
  }
}
