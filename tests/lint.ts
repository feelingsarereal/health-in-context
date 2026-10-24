import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { allowedMatchers, joinPath, lintText, walkStrings } from '../scripts/lib/lint';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content-pack');
const load = (f: string) => yaml.load(fs.readFileSync(path.join(PACK, f), 'utf8'), { schema: yaml.CORE_SCHEMA }) as any;
const safety = load('safety.yaml') as { blocked_phrases: string[]; allowed_phrases: string[]; allowed_contexts: { field: string }[] };
export const PHRASES = safety.blocked_phrases;
export const ALLOWED_PHRASES = safety.allowed_phrases ?? [];

/**
 * Every string the pack places in an allowed context (safety.yaml → allowed_contexts: ICD-11 verbatim fields, verbatim
 * abstracts, the scope's out-of-bounds list). Rendered text has these removed before the lint, exactly as the pack
 * lint skips those fields. Nothing here is builder-chosen.
 */
const matchers = allowedMatchers(safety.allowed_contexts.map((a) => a.field));
export const ALLOWED_VERBATIM: string[] = [];
for (const [base, file] of [['situations', 'situations.yaml'], ['references', 'references.yaml'], ['scope', 'scope.yaml']] as const) {
  for (const [p, txt] of walkStrings(load(file))) if (txt && matchers.some((r) => r.test(joinPath(base, p)))) ALLOWED_VERBATIM.push(txt);
}
ALLOWED_VERBATIM.sort((a, b) => b.length - a.length);

/** H1 over rendered text: strip the allowed-context strings, then lint with the exact allowed phrases. Every hit fails. */
export function h1Violations(text: string, where: string) {
  let t = text;
  for (const s of ALLOWED_VERBATIM) if (t.includes(s)) t = t.split(s).join(' ');
  return lintText(where, t, PHRASES, ALLOWED_PHRASES);
}
