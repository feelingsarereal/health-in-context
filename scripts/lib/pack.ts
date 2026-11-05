/**
 * The action pack: load, validate (zod schemas mirroring docs/ACTION-PACK.md, plus every cross-reference rule that
 * tools/validate_pack.py enforces), and lint (SAFETY H1). Pure functions over an in-memory pack, so the Vitest
 * fixtures can feed one error per rule and check the message.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { allowedMatchers, joinPath, lintText, walkStrings, type LintHit } from './lint';

// ───────────────────────── schemas (ACTION-PACK §2–§5, SAFETY §4, SUSTAIN §2)
const dateLike = z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

export const ManifestSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case'),
    title: z.string(),
    short_title: z.string(),
    kind: z.enum(['navigator', 'planner', 'workbench']),
    modules: z.array(z.enum(['situations', 'links', 'pathway', 'resources', 'planner'])),
    safety_profile: z.enum(['general', 'health', 'crisis-adjacent']),
    question: z.string(),
    purpose: z.string().optional(),
    as_of: dateLike,
    authors: z.array(z.string()).optional(),
    venue: z.string(),
    evidence: z.object({ body: z.enum(['review', 'records']) }).optional(),
    delivery: z.enum(['local', 'pages', 'private']).default('local'),
    storage: z.literal('device', { errorMap: () => ({ message: "storage must be 'device' in v0.1 (SAFETY H2)" }) }),
    github_account: z.string(),
    builder: z.object({ name: z.string(), version: z.string(), date: dateLike }),
    permissions: z.object({ text: z.string(), figures: z.string() }),
    concept_self_checks: z.boolean().optional(),
  })
  .passthrough();

const ReferenceSchema = z
  .object({
    n: z.number().int(),
    key: z.string(),
    tier: z.enum(['seminal', 'classic', 'current', 'background']),
    citation: z.string(),
    year: z.number().int(),
    doi: z.string().optional(),
    url: z.string().optional(),
    isbn: z.string().optional(),
    abstract: z.string().nullable(),
    abstract_source: z.string().optional(),
    abstract_note: z.string().optional(),
    harvested_on: dateLike.optional(),
    summary: z.string().optional(),
    why_it_mattered: z.string().optional(),
    role_here: z.string(),
    role_note: z.string().optional(),
    verified: z.boolean(),
    verified_on: dateLike.nullable(),
    verified_by: z.string().optional(),
    used_by: z.array(z.string()),
    openalex: z.string().optional(),
    title_checked: z.string().optional(),
  })
  .passthrough();

const GlossarySchema = z
  .object({
    id: z.string(),
    term: z.string().min(1),
    kind: z.string().optional(),
    variants: z.array(z.string()).default([]),
    short: z.string().min(1).max(200, 'short > 200 chars'),
    definition: z.string().min(1),
    concept: z.string().optional(),
    see: z.array(z.string()).optional(),
    further_refs: z.array(z.number()).optional(),
  })
  .passthrough();

const PersonaSchema = z.object({
  id: z.string(),
  label: z.string(),
  acts_for: z.enum(['self', 'other', 'group']),
  situation: z.string().optional(),
  deciding: z.string().optional(),
  constraints: z.object({ reading_level: z.string() }).passthrough(),
  jobs: z.array(z.string()).min(1, 'at least one job required'),
});
const AudienceSchema = z.object({ personas: z.array(PersonaSchema).min(1, 'at least one persona required'), constraints_global: z.record(z.unknown()).optional() });

const ItemRefSchema = z.object({ title: z.string(), code: z.string().nullable().optional() }).passthrough();
const SituationItemSchema = z
  .object({
    code: z.string(),
    title: z.string().min(1, 'title required (verbatim)'),
    group: z.string(),
    parent: z.string().nullable(),
    subgroup: z.string().optional(),
    definition: z.string().nullable(),
    definition_check: z.string().nullable(),
    inclusions: z.array(z.union([z.string(), ItemRefSchema])),
    exclusions: z.array(z.union([z.string(), ItemRefSchema])),
    coded_elsewhere: z.array(z.union([z.string(), ItemRefSchema])),
    index_terms: z.array(z.string()),
    /** null when the code has no foundation id (QD71.Z); the pop-out then links to the WHO browser root */
    uri: z.string().nullable(),
    who_browser: z.string(),
    /** a residual (other specified / unspecified) code promoted to a linkable item (K5) */
    residual: z.boolean().optional(),
    source_url: z.string().min(1, 'source_url required'),
    verified_on: dateLike,
    crosswalk: z
      .object({
        icd10cm: z.array(z.string()),
        hp2030: z.array(z.string()),
        proposed: z.boolean().optional(),
        hp2030_titles: z.array(z.string().nullable()).optional(),
        icd10cm_titles: z.array(z.string().nullable()).optional(),
        sources: z.array(z.number().int()).optional(),
        /** SL32: the sources behind each half, so a build with the ICD-10-CM crosswalk off keeps only the HP2030 one */
        hp2030_sources: z.array(z.number().int()).optional(),
        icd10cm_sources: z.array(z.number().int()).optional(),
      })
      .optional(),
  })
  .passthrough();
const GroupSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    tier: z.string(),
    uri: z.string().optional(),
    source_url: z.string().optional(),
    functioning: z.boolean().optional(),
    subgroup_of: z.string().optional(),
    note: z.string().optional(),
  })
  .passthrough();
/** K5: builder search aliases — words people use that ICD-11 has no index term for (eviction → QD71.Z) */
const SearchAliasSchema = z.object({ term: z.string().min(1), also: z.array(z.string().min(1)).default([]), code: z.string(), note: z.string().min(1) });
const ResidualSchema = z.object({ code: z.string(), title: z.string(), parent: z.string(), parent_title: z.string().nullable(), kind: z.string(), source_url: z.string(), release: z.string() }).passthrough();
export const SituationsSchema = z
  .object({
    scheme: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      release: z.union([z.string(), z.date()]).transform(String),
      source: z.string().min(1),
      official_browser: z.string().optional(),
      verified_on: dateLike,
      /** retired 2026-11-02 (T-ICD-01): WHO's own text replaced the mirror; still read so an older pack builds */
      interim_source: z.string().optional(),
      text_source: z.string().optional(),
      /** the ICD-11 licence §1.3 citation, shown verbatim (K9) */
      licence: z.string().optional(),
    }),
    tiers: z.record(z.string()),
    tier_basis: z.string().optional(),
    groups: z.array(GroupSchema),
    items: z.array(SituationItemSchema),
    residuals: z.array(ResidualSchema).default([]),
    search_aliases: z.array(SearchAliasSchema).default([]),
    known_gaps: z.array(z.string()).default([]),
  })
  .passthrough();

const LinkSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    polarity: z.enum(['+', '−', '-'], { errorMap: () => ({ message: 'polarity must be + or −' }) }),
    grade: z.string(),
    mechanism: z.string(),
    refs: z.array(z.number().int()),
    suggest: z.array(z.string()).default([]),
    /** ACTION-PACK 0.1.1: the codes the cited evidence names; a code also backs its descendants (option B) */
    codes: z.object({ from: z.array(z.string()).default([]), to: z.array(z.string()).default([]) }).default({}),
    counter: z.boolean().optional(),
    withheld_because: z.array(z.string()).optional(),
  })
  .passthrough();
export const LinksSchema = z.object({
  grades: z.record(z.string()),
  framing: z.string().optional(),
  links: z.array(LinkSchema),
  counter_links: z.array(LinkSchema).default([]),
  withheld_links: z.array(LinkSchema).default([]),
});

export const PlannerSchema = z
  .object({
    holds: z.enum(['plan', 'map', 'both']),
    schema_version: z.number().int(),
    export: z.array(z.string()).refine((a) => a.includes('json'), 'export must include json'),
    import: z.array(z.string()),
    file_extension: z.string().optional(),
    fields: z.record(z.array(z.string())),
    enums: z.record(z.array(z.union([z.string(), z.number()]))),
    rich_text: z.object({ fields: z.array(z.string()), marks: z.array(z.string()), storage: z.string() }).optional(),
    templates: z.array(z.string()).default([]),
  })
  .passthrough();

const HelpSchema = z.object({ name: z.string().min(1), how: z.string().min(1), url: z.string().optional(), source: z.string().min(1), verified_on: dateLike, recheck_days: z.number().int().optional() });
export const SafetySchema = z.object({
  profile: z.enum(['general', 'health', 'crisis-adjacent']),
  notice: z.string().optional(),
  blocked_phrases: z.array(z.string()).default([]),
  allowed_phrases: z.array(z.string()).default([]),
  allowed_contexts: z.array(z.object({ field: z.string() })).default([]),
  deidentify: z.object({ fields: z.array(z.string()), nudge: z.string() }).optional(),
  help: z.array(HelpSchema).default([]),
  crisis: z.array(z.unknown()).default([]),
});

const ScenarioSchema = z
  .object({
    id: z.string(),
    persona: z.string(),
    title: z.string(),
    starts_with: z.string(),
    viewport: z.string().optional(),
    steps: z.array(z.object({ do: z.string().min(1), expect: z.string().min(1) })).min(1, 'steps required'),
    must_not: z.array(z.string()).optional(),
  })
  .passthrough();
export const ScenariosSchema = z.array(ScenarioSchema);

export const UpkeepSchema = z.object({
  classes: z.array(z.object({ id: z.string(), what: z.string(), recheck_days: z.number().int(), how: z.string() })).min(1, 'classes required'),
  harvests: z.array(z.record(z.unknown())).default([]),
  sweeps: z.array(z.object({ id: z.string(), every_days: z.number().int(), scope: z.string() })).default([]),
});
export const ChangesSchema = z.array(z.object({ date: dateLike, what: z.string(), why: z.string(), records: z.array(z.string()).optional(), source: z.string().optional(), by: z.string() }));
export const TodoSchema = z.object({ items: z.array(z.object({ id: z.string(), what: z.string(), blocks: z.string().optional(), status: z.string().optional(), xwalk: z.boolean().optional() })) });
export const ScopeSchema = z
  .object({
    interview: z.array(z.object({ q: z.string(), a: z.string(), date: dateLike })).default([]),
    boundary: z.object({ in: z.array(z.string()), out: z.array(z.string()) }),
    search_strategy: z.object({ approach: z.string(), sources: z.array(z.string()), date_closed: dateLike, known_gaps: z.array(z.string()) }).passthrough(),
  })
  .passthrough();
export const ConceptFrontSchema = z.object({
  id: z.string(),
  title: z.string(),
  one_liner: z.string(),
  why_here: z.string(),
  prerequisites: z.array(z.string()).default([]),
  terms: z.array(z.string()).default([]),
  further_reading: z.array(z.object({ title: z.string(), url: z.string(), kind: z.string().optional() })).default([]),
  self_check: z.unknown().optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type Situations = z.infer<typeof SituationsSchema>;
export type SituationItem = z.infer<typeof SituationItemSchema>;
export type Links = z.infer<typeof LinksSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type GlossaryEntry = z.infer<typeof GlossarySchema>;
export type Safety = z.infer<typeof SafetySchema>;

// ───────────────────────── raw pack
export interface RawConcept {
  file: string;
  front: unknown;
  body: string;
}
export interface RawPack {
  manifest: unknown;
  audience: unknown;
  situations?: unknown;
  links?: unknown;
  planner?: unknown;
  safety: unknown;
  scenarios: unknown;
  upkeep: unknown;
  changes?: unknown;
  scope?: unknown;
  references: unknown;
  glossary?: unknown;
  uiStrings?: unknown;
  todo?: unknown;
  concepts: RawConcept[];
  appRequirements?: string;
  appMethods?: string;
  /** which module files exist on disk (for the manifest ⇄ files rule) */
  moduleFiles: string[];
}

const MODULE_NAMES = ['situations', 'links', 'pathway', 'resources', 'planner'];

export function readPack(dir: string): { pack: RawPack; loadErrors: string[] } {
  const loadErrors: string[] = [];
  const y = (name: string, required = true): unknown => {
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) {
      if (required) loadErrors.push(`${name}: missing`);
      return undefined;
    }
    try {
      return yaml.load(fs.readFileSync(p, 'utf8'), { schema: yaml.CORE_SCHEMA });
    } catch (e) {
      loadErrors.push(`${name}: YAML error — ${(e as Error).message.split('\n')[0]}`);
      return undefined;
    }
  };
  const concepts: RawConcept[] = [];
  const cdir = path.join(dir, 'concepts');
  if (fs.existsSync(cdir)) {
    for (const f of fs.readdirSync(cdir).filter((f) => f.endsWith('.md')).sort()) {
      const txt = fs.readFileSync(path.join(cdir, f), 'utf8');
      const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(txt);
      if (!m) {
        loadErrors.push(`${f}: no frontmatter`);
        continue;
      }
      concepts.push({ file: f, front: yaml.load(m[1], { schema: yaml.CORE_SCHEMA }), body: m[2] });
    }
  }
  const md = (name: string) => (fs.existsSync(path.join(dir, name)) ? fs.readFileSync(path.join(dir, name), 'utf8') : undefined);
  const pack: RawPack = {
    manifest: y('manifest.yaml'),
    audience: y('audience.yaml'),
    situations: y('situations.yaml', false),
    links: y('links.yaml', false),
    planner: y('planner.yaml', false),
    safety: y('safety.yaml'),
    scenarios: y('scenarios.yaml'),
    upkeep: y('upkeep.yaml'),
    changes: y('changes.yaml', false),
    scope: y('scope.yaml', false),
    references: y('references.yaml'),
    glossary: y('glossary.yaml', false),
    uiStrings: y('ui-strings.yaml', false),
    todo: y('todo.yaml', false),
    concepts,
    appRequirements: md('app-requirements.md'),
    appMethods: md('app-methods.md'),
    moduleFiles: MODULE_NAMES.filter((m) => fs.existsSync(path.join(dir, `${m}.yaml`))),
  };
  return { pack, loadErrors };
}

// ───────────────────────── validation
const CITE = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g;
export function cites(text: unknown): Set<number> {
  const out = new Set<number>();
  for (const m of String(text ?? '').matchAll(CITE)) {
    for (const part of m[1].split(/\s*,\s*/)) {
      const r = part.split(/\s*[-–]\s*/);
      if (r.length === 2) for (let i = +r[0]; i <= +r[1]; i++) out.add(i);
      else out.add(+part);
    }
  }
  return out;
}
const words = (t: unknown) => (String(t ?? '').match(/\w+/g) ?? []).length;

export interface Validated {
  manifest: Manifest;
  audience: z.infer<typeof AudienceSchema>;
  situations?: Situations;
  links?: Links;
  planner?: z.infer<typeof PlannerSchema>;
  safety: Safety;
  scenarios: z.infer<typeof ScenariosSchema>;
  upkeep: z.infer<typeof UpkeepSchema>;
  changes: z.infer<typeof ChangesSchema>;
  scope?: z.infer<typeof ScopeSchema>;
  references: Reference[];
  glossary: GlossaryEntry[];
  concepts: { front: z.infer<typeof ConceptFrontSchema>; body: string }[];
  todo: z.infer<typeof TodoSchema>['items'];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  lint: LintHit[];
  data: Partial<Validated>;
}

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown, where: string, errors: string[]): z.infer<T> | undefined {
  if (value === undefined) return undefined;
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  for (const iss of r.error.issues.slice(0, 20)) {
    const p = iss.path.length ? iss.path.join('.') : '(root)';
    errors.push(`${where}: ${p} — ${iss.message}`);
  }
  return undefined;
}

export function validatePack(pack: RawPack): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const E = (s: string) => errors.push(s);
  const data: Partial<Validated> = {};

  // manifest
  const m = parse(ManifestSchema, pack.manifest, 'manifest', errors);
  if (pack.manifest === undefined) E('manifest.yaml: missing');
  if (m) {
    data.manifest = m;
    if (!/peer/i.test(m.venue)) warnings.push('manifest: venue should make the not-peer-reviewed status unmissable');
    if (m.short_title.split(/\s+/).length > 3) warnings.push('manifest: short_title should be ≤ 3 words');
    for (const mod of MODULE_NAMES) {
      const listed = (m.modules as string[]).includes(mod);
      const exists = pack.moduleFiles.includes(mod);
      if (listed && !exists) E(`${mod}.yaml: listed in manifest.modules but missing`);
      if (exists && !listed) E(`${mod}.yaml: present but not listed in manifest.modules`);
    }
  }
  const mods = new Set<string>(m?.modules ?? []);

  // references
  const refsRaw = Array.isArray(pack.references) ? pack.references : [];
  const REF = new Map<number, Reference>();
  refsRaw.forEach((r, i) => {
    const ref = parse(ReferenceSchema, r, `references[${i}]`, errors);
    if (!ref) return;
    if (REF.has(ref.n)) E(`references: duplicate n ${ref.n}`);
    REF.set(ref.n, ref);
    if (!(ref.doi || ref.url || ref.isbn)) E(`references/${ref.n}: doi, url or isbn required`);
    if (ref.verified) {
      if ((ref.tier === 'seminal' || ref.tier === 'classic') && !ref.summary) E(`references/${ref.n}: ${ref.tier} needs a summary`);
      if (ref.tier === 'seminal' && !ref.why_it_mattered) E(`references/${ref.n}: seminal needs why_it_mattered`);
      if (ref.doi && ref.abstract === null && !ref.abstract_note) warnings.push(`references/${ref.n}: verified DOI with no abstract and no abstract_note`);
    }
    if (ref.abstract && !ref.harvested_on) E(`references/${ref.n}: abstract without harvested_on (abstracts are harvested, never typed)`);
  });
  data.references = [...REF.values()].sort((a, b) => a.n - b.n);
  const VERIFIED = new Set([...REF.values()].filter((r) => r.verified).map((r) => r.n));

  const checkCites = (where: string, text: unknown, blockRule = true, mustCite = false) => {
    const ns = cites(text);
    for (const n of ns) if (!REF.has(n)) E(`${where}: cites [${n}] — no such reference`);
    if (blockRule && words(text) >= 25 && ns.size === 0 && !String(text).includes('<!-- framing -->'))
      E(`${where}: ${words(text)}-word prose with no [n] and no framing marker (citation coverage)`);
    if (mustCite && ns.size === 0) E(`${where}: must carry at least one [n]`);
    return ns;
  };

  // concepts
  const conceptIds = new Set<string>();
  data.concepts = [];
  for (const c of pack.concepts) {
    const fm = parse(ConceptFrontSchema, c.front, `concepts/${c.file}`, errors);
    if (!fm) continue;
    if (fm.id !== c.file.replace(/\.md$/, '')) E(`${c.file}: id must match file name`);
    conceptIds.add(fm.id);
    data.concepts.push({ front: fm, body: c.body });
    let framingNext = false;
    for (const blk of c.body.split(/\n\s*\n/)) {
      const b = blk
        .trim()
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('#'))
        .join('\n')
        .trim();
      if (!b || b.startsWith('$$') || b.startsWith('```')) continue;
      if (b.includes('<!-- framing -->')) {
        framingNext = true;
        continue;
      }
      if (framingNext) {
        framingNext = false;
        checkCites(`concepts/${fm.id}`, b, false);
        continue;
      }
      checkCites(`concepts/${fm.id}`, b);
    }
  }

  // glossary
  const gl: GlossaryEntry[] = [];
  const gids = new Set<string>();
  const variants = new Map<string, string>();
  (Array.isArray(pack.glossary) ? pack.glossary : []).forEach((g, i) => {
    const e = parse(GlossarySchema, g, `glossary[${i}]`, errors);
    if (!e) return;
    if (gids.has(e.id)) E(`glossary: duplicate id ${e.id}`);
    gids.add(e.id);
    gl.push(e);
    if (e.concept && !conceptIds.has(e.concept)) E(`glossary/${e.id}: concept ${e.concept} not found`);
    checkCites(`glossary/${e.id}.definition`, e.definition);
    for (const v of [e.term, ...e.variants]) {
      const k = v.toLowerCase();
      if (variants.has(k) && variants.get(k) !== e.id) E(`glossary: variant '${v}' collides (${variants.get(k)} vs ${e.id})`);
      variants.set(k, e.id);
    }
  });
  for (const e of gl) for (const s of e.see ?? []) if (!gids.has(s)) E(`glossary/${e.id}: see ${s} not found`);
  for (const c of data.concepts) for (const t of c.front.terms) if (!gids.has(t)) E(`concepts/${c.front.id}: term ${t} not in glossary`);
  for (const c of data.concepts) for (const p of c.front.prerequisites) if (!conceptIds.has(p)) E(`concepts/${c.front.id}: prerequisite ${p} not found`);
  data.glossary = gl;

  // audience
  const aud = parse(AudienceSchema, pack.audience, 'audience', errors);
  const personas = new Map((aud?.personas ?? []).map((p) => [p.id, p]));
  const actsForOthers = [...personas.values()].some((p) => p.acts_for !== 'self');
  if (aud) data.audience = aud;

  // situations
  const items = new Map<string, SituationItem>();
  const groups = new Map<string, z.infer<typeof GroupSchema>>();
  if (mods.has('situations')) {
    const s = parse(SituationsSchema, pack.situations, 'situations', errors);
    if (s) {
      data.situations = s;
      for (const g of s.groups) {
        if (groups.has(g.id)) E(`situations: duplicate group ${g.id}`);
        groups.set(g.id, g);
        if (!s.tiers[g.tier]) E(`situations/groups/${g.id}: tier ${g.tier} not in tiers`);
      }
      for (const it of s.items) {
        if (items.has(it.code)) E(`situations: duplicate code ${it.code}`);
        items.set(it.code, it);
        if (!groups.has(it.group)) E(`situations/${it.code}: group '${it.group}' not found`);
        if (it.subgroup && !groups.has(it.subgroup)) E(`situations/${it.code}: subgroup '${it.subgroup}' not found`);
      }
      for (const it of s.items) if (it.parent && !items.has(it.parent)) E(`situations/${it.code}: parent ${it.parent} not found`);
      for (const r of s.residuals) {
        if (items.has(r.code)) E(`situations/residuals/${r.code}: duplicates an item code`);
        if (!items.has(r.parent) && !groups.has(r.parent) && !resolveRangeGroup(r.parent, [...groups.keys()]))
          E(`situations/residuals/${r.code}: parent ${r.parent} resolves to no code or group`);
      }
      for (const a of s.search_aliases) if (!items.has(a.code)) E(`situations/search_aliases/${a.term}: code ${a.code} is not a linkable item`);
    }
  }
  const endpoints = new Set([...groups.keys(), ...items.keys()]);
  const inTarget = (code: string, target: string): boolean => {
    if (code === target) return true;
    let it = items.get(code);
    const seen = new Set<string>();
    while (it && !seen.has(it.code)) {
      seen.add(it.code);
      if (it.group === target || it.parent === target || it.subgroup === target) return true;
      it = it.parent ? items.get(it.parent) : undefined;
    }
    return false;
  };

  /** a code, or one of its parents, is in `roots` (a link's codes back their descendants) */
  const under = (code: string, roots: string[]): boolean => {
    let it = items.get(code);
    const seen = new Set<string>();
    while (it && !seen.has(it.code)) {
      seen.add(it.code);
      if (roots.includes(it.code)) return true;
      it = it.parent ? items.get(it.parent) : undefined;
    }
    return false;
  };

  // links
  if (mods.has('links')) {
    const L = parse(LinksSchema, pack.links, 'links', errors);
    if (L) {
      data.links = L;
      const grades = new Set(Object.keys(L.grades));
      const seen = new Set<string>();
      for (const ln of [...L.links, ...L.counter_links]) {
        if (seen.has(ln.id)) E(`links: duplicate id ${ln.id}`);
        seen.add(ln.id);
        for (const end of ['from', 'to'] as const) if (endpoints.size && !endpoints.has(ln[end])) E(`links/${ln.id}: ${end} '${ln[end]}' not a group or code`);
        if (!grades.has(ln.grade)) E(`links/${ln.id}: grade '${ln.grade}' not in [${[...grades].sort().join(', ')}]`);
        const rs = new Set(ln.refs);
        const ns = checkCites(`links/${ln.id}.mechanism`, ln.mechanism, true, true);
        const extra = [...ns].filter((n) => !rs.has(n));
        if (extra.length) E(`links/${ln.id}: mechanism cites [${extra.join(', ')}] not listed in refs`);
        for (const n of rs) {
          if (!REF.has(n)) E(`links/${ln.id}: ref ${n} not found`);
          else if (!VERIFIED.has(n)) E(`links/${ln.id}: ref ${n} is not verified — the link may not ship (ACTION-PACK §3.3)`);
        }
        for (const end of ['from', 'to'] as const)
          for (const c of ln.codes[end]) {
            if (!items.has(c)) E(`links/${ln.id}: codes.${end} ${c} not a code`);
            else if (!inTarget(c, ln[end])) E(`links/${ln.id}: codes.${end} ${c} is not inside ${ln[end]}`);
          }
        for (const c of ln.suggest) {
          if (!items.has(c)) E(`links/${ln.id}: suggest ${c} not a code`);
          else if (!inTarget(c, ln.to)) E(`links/${ln.id}: suggest ${c} is not inside ${ln.to}`);
          else if (ln.codes.to.length && !under(c, ln.codes.to)) E(`links/${ln.id}: suggest ${c} is outside codes.to`);
        }
      }
      for (const ln of L.withheld_links) if (seen.has(ln.id)) E(`links/${ln.id}: both shipped and withheld`);
    }
  }

  // planner
  if (mods.has('planner')) {
    const pl = parse(PlannerSchema, pack.planner, 'planner', errors);
    if (pl) data.planner = pl;
  }

  // safety
  const sf = parse(SafetySchema, pack.safety, 'safety', errors);
  const profile = m?.safety_profile;
  if (sf) {
    data.safety = sf;
    if (profile && sf.profile !== profile) E(`safety: profile '${sf.profile}' does not match manifest '${profile}'`);
    const level = ['general', 'health', 'crisis-adjacent'].indexOf(profile ?? 'general');
    if (level >= 1) {
      if (!sf.notice) E('safety: notice required (H5)');
      if (!sf.blocked_phrases.length) E('safety: blocked_phrases required (H1)');
      if (actsForOthers && !sf.deidentify?.fields.length) E('safety: deidentify.fields required when a persona acts for others (H3)');
      if (!sf.help.length) E('safety: help entries required (H6)');
    }
    if (level >= 2 && !sf.crisis.length) E('safety: crisis entries required (C1)');
  }

  // scenarios
  const sc = parse(ScenariosSchema, pack.scenarios, 'scenarios', errors) ?? [];
  data.scenarios = sc;
  const covered = new Set<string>();
  for (const w of sc) {
    if (!personas.has(w.persona)) E(`scenarios/${w.id}: persona '${w.persona}' not found`);
    covered.add(w.persona);
    if (profile && profile !== 'general' && !w.must_not?.length) E(`scenarios/${w.id}: must_not required under ${profile}`);
  }
  for (const pid of personas.keys()) if (!covered.has(pid)) E(`scenarios: no walkthrough for persona ${pid}`);

  // upkeep, changes, scope, todo
  const up = parse(UpkeepSchema, pack.upkeep, 'upkeep', errors);
  if (up) data.upkeep = up;
  data.changes = parse(ChangesSchema, pack.changes ?? [], 'changes', errors) ?? [];
  if (pack.scope !== undefined) data.scope = parse(ScopeSchema, pack.scope, 'scope', errors);
  data.todo = parse(TodoSchema, pack.todo ?? { items: [] }, 'todo', errors)?.items ?? [];

  // H1 lint (SAFETY 0.1.1): validate_pack.py 0.1.1's file set, plus the 101s, which render too. Exact allowed_phrases
  // are removed before matching; allowed_contexts are skipped; no negation exemption.
  const lint: LintHit[] = [];
  if (sf && sf.blocked_phrases.length) {
    const allowed = allowedMatchers(sf.allowed_contexts.map((a) => a.field));
    const files: [string, unknown][] = [
      ['ui-strings', pack.uiStrings],
      ['links', pack.links],
      ['scenarios', pack.scenarios],
      ['audience', pack.audience],
      ['situations', pack.situations],
      ['glossary', pack.glossary],
      ['scope', pack.scope],
      ['references', pack.references],
      ['safety', pack.safety],
      ...pack.concepts.map((c): [string, unknown] => [`concepts/${c.file}`, { front: c.front, body: c.body }]),
    ];
    for (const [base, obj] of files) {
      if (obj === undefined) continue;
      for (const [p, txt] of walkStrings(obj)) {
        const full = joinPath(base, p);
        if (allowed.some((r) => r.test(full)) || full.includes('.must_not') || full.startsWith('safety.blocked_phrases') || full.startsWith('safety.allowed_phrases')) continue;
        lint.push(...lintText(full, txt, sf.blocked_phrases, sf.allowed_phrases));
      }
    }
    for (const h of lint) E(`safety lint (H1): ${h.where} contains blocked phrase '${h.phrase}' — “${h.excerpt}”`);
  }

  return { errors, warnings, lint, data };
}

/**
 * K3 item 6: can the shipped links close a loop on evidence alone? Each link is a step from its `codes.from` to its
 * `codes.to`; one link leads into another when a code on the first's To end and one on the second's From end overlap
 * (one is the other or its ancestor, so a single node's code is covered by both). Any cycle among links → true.
 */
export function linksCanCycle(links: { id: string; codes: { from: string[]; to: string[] } }[], parentOf: (code: string) => string | null | undefined): boolean {
  const up = (c: string) => {
    const out: string[] = [];
    for (let x: string | null | undefined = c; x && !out.includes(x); x = parentOf(x)) out.push(x);
    return out;
  };
  const overlap = (a: string, b: string) => up(a).includes(b) || up(b).includes(a);
  const next = new Map(links.map((l) => [l.id, links.filter((m) => l.codes.to.some((a) => m.codes.from.some((b) => overlap(a, b))))]));
  const done = new Set<string>();
  const onPath = new Set<string>();
  const dfs = (id: string): boolean => {
    if (onPath.has(id)) return true;
    if (done.has(id)) return false;
    onPath.add(id);
    for (const m of next.get(id) ?? []) if (dfs(m.id)) return true;
    onPath.delete(id);
    done.add(id);
    return false;
  };
  return links.some((l) => dfs(l.id));
}

/** Find the group whose code range (e.g. QE10-QE2Z) contains a code or sub-block id (e.g. QE10-QE1Z). */
export function resolveRangeGroup(code: string, groupIds: string[]): string | undefined {
  const head = code.split('-')[0].slice(0, 4);
  for (const g of groupIds) {
    const [a, b] = g.split('-');
    if (!b) continue;
    if (head >= a && head <= b) return g;
  }
  return undefined;
}
