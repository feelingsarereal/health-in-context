import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';
import { lintText } from '../scripts/lib/lint';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const safety = yaml.load(fs.readFileSync(path.resolve(HERE, '../content-pack/safety.yaml'), 'utf8')) as { blocked_phrases: string[] };
const sit = yaml.load(fs.readFileSync(path.resolve(HERE, '../content-pack/situations.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA }) as any;
const scope = yaml.load(fs.readFileSync(path.resolve(HERE, '../content-pack/scope.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA }) as any;
const refs = yaml.load(fs.readFileSync(path.resolve(HERE, '../content-pack/references.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA }) as any[];
export const PHRASES = safety.blocked_phrases;

/** Text that may legitimately contain a blocked stem: ICD-11 fields (safety.yaml allowed_contexts), verbatim abstracts, and the scope's out-of-bounds list. */
export const ALLOWED_VERBATIM: string[] = [
  ...sit.items.flatMap((i: any) => [i.title, i.definition, ...i.index_terms, ...[...i.inclusions, ...i.exclusions, ...i.coded_elsewhere].map((x: any) => (typeof x === 'string' ? x : x.title))]),
  ...refs.map((r) => r.abstract),
  // builder exemption (listed on /methods): the scope's out-of-bounds list names what the app does NOT do
  ...scope.boundary.out,
].filter((x): x is string => typeof x === 'string' && x.length > 0);

/** H1 over rendered text: strip allowed verbatim strings, then fail on any non-negated hit. */
export function h1Violations(text: string, where: string) {
  let t = text;
  for (const s of ALLOWED_VERBATIM.sort((a, b) => b.length - a.length)) if (t.includes(s)) t = t.split(s).join(' ');
  return lintText(where, t, PHRASES).filter((h) => !h.negated);
}
