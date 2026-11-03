/**
 * npm run build:content — validate content-pack/, resolve every cross-reference, emit src/data/*.json,
 * public/provenance.json and public/staleness.json (KICKOFF §3).
 *
 * Fails loudly: every error goes to content-pack/BUILD-ERRORS.md and src/data/build-errors.json (shown on /methods),
 * and the rest still builds. The pack is never "fixed" here. Idempotent: the same pack gives byte-identical output
 * (the build date is the pack's as_of unless SDOH_BUILD_DATE is set, so re-runs do not churn the files).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPack, validatePack, resolveRangeGroup, cites, linksCanCycle, type Validated } from './lib/pack';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'content-pack');
const OUT = path.join(ROOT, 'src', 'data');
const PUB = path.join(ROOT, 'public');

const { pack, loadErrors } = readPack(PACK);
const res = validatePack(pack);
const errors = [...loadErrors, ...res.errors];
const d = res.data as Validated;

const asOf = d.manifest?.as_of ?? '2026-10-23';
const BUILD_DATE = process.env.SDOH_BUILD_DATE ?? asOf;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

fs.mkdirSync(OUT, { recursive: true });
const written: [string, number][] = [];
function emit(file: string, value: unknown, dir = OUT) {
  const p = path.join(dir, file);
  const json = JSON.stringify(value, null, 1) + '\n';
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== json) fs.writeFileSync(p, json);
  written.push([path.relative(ROOT, p), json.length]);
}

// ───────────────────────── situations: resolve blocks, tiers, residual placement, picker order
const s = d.situations;
const groupIds = s ? s.groups.map((g) => g.id) : [];
const itemByCode = new Map((s?.items ?? []).map((i) => [i.code, i]));
function groupOf(code: string): string | undefined {
  const it = itemByCode.get(code);
  if (it) return it.group;
  if (groupIds.includes(code)) return code;
  return resolveRangeGroup(code, groupIds.filter((g) => !s!.groups.find((x) => x.id === g)?.subgroup_of));
}
const codes = s
  ? [
      ...s.items.map((i) => ({
        code: i.code,
        title: i.title,
        group: i.group,
        parent: i.parent,
        subgroup: i.subgroup ?? null,
        definition: i.definition,
        definition_check: i.definition_check,
        inclusions: i.inclusions,
        exclusions: i.exclusions,
        coded_elsewhere: i.coded_elsewhere,
        index_terms: i.index_terms,
        uri: i.uri,
        who_browser: i.who_browser,
        source_url: i.source_url,
        verified_on: i.verified_on,
        crosswalk: i.crosswalk ?? null,
        // K5: a residual promoted to an item (QD71.Z) keeps its kind, so it sorts after the block's specific codes
        residual: (i.residual ? (i.code.endsWith('Y') ? 'other' : 'unspecified') : null) as null | string,
      })),
      ...s.residuals.map((r) => {
        const g = groupOf(r.parent);
        if (!g) errors.push(`situations/residuals/${r.code}: no group for parent ${r.parent}`);
        return {
          code: r.code,
          title: r.title,
          group: g ?? r.parent,
          parent: itemByCode.has(r.parent) ? r.parent : null,
          subgroup: itemByCode.get(r.parent)?.subgroup ?? null,
          definition: null,
          definition_check: null,
          inclusions: [],
          exclusions: [],
          coded_elsewhere: [],
          index_terms: [],
          uri: (r.uri as string | undefined) ?? null,
          // K9: a residual's source_url is its WHO browser entry now (the mirror is retired)
          who_browser: r.source_url.startsWith('https://icd.who.int/') ? r.source_url : null,
          source_url: r.source_url,
          verified_on: s.scheme.verified_on,
          crosswalk: null,
          residual: r.kind,
          parent_title: r.parent_title,
        };
      }),
    ]
  : [];
// Picker order: groups in the scheme's order; inside a group, specific codes first, then its residuals (KICKOFF §8.5).
const gOrder = new Map(groupIds.map((g, i) => [g, i]));
const order = codes
  .map((c, i) => ({ c, i }))
  .sort((a, b) => (gOrder.get(a.c.group)! - gOrder.get(b.c.group)!) || (+!!a.c.residual - +!!b.c.residual) || a.i - b.i)
  .map((x) => x.c.code);
if (s) {
  emit('situations.json', {
    scheme: s.scheme,
    tiers: s.tiers,
    tier_basis: s.tier_basis ?? null,
    groups: s.groups,
    codes,
    picker_order: order,
    search_aliases: s.search_aliases,
    known_gaps: s.known_gaps,
  });
}

// ───────────────────────── links (shipped); withheld only as a list for /methods
const L = d.links;
const situationParent = new Map((d.situations?.items ?? []).map((it) => [it.code, it.parent ?? null]));
const unverifiedRefs = new Set((d.references ?? []).filter((r) => !r.verified).map((r) => r.n));
if (L) {
  const ship = [...L.links, ...L.counter_links].map(({ counter: _c, ...l }) => ({ ...l, polarity: l.polarity === '-' ? '−' : l.polarity }));
  // Belt and braces (KICKOFF §1): a shipped link resting on an unverified reference is not offered.
  const offered = ship.filter((l) => !l.refs.some((n) => unverifiedRefs.has(n)));
  const blocked = ship.filter((l) => l.refs.some((n) => unverifiedRefs.has(n)));
  emit('links.json', {
    grades: L.grades,
    framing: L.framing ?? null,
    links: offered,
    // K3 item 6: whether the shipped links' code graph has a cycle decides the evidence-only empty-state wording
    can_cycle: linksCanCycle(offered, (c) => situationParent.get(c)),
    not_offered: [
      ...L.withheld_links.map((l) => ({ id: l.id, from: l.from, to: l.to, polarity: l.polarity, grade: l.grade, refs: l.refs, reason: l.withheld_because ?? [], kind: 'withheld' })),
      ...blocked.map((l) => ({ id: l.id, from: l.from, to: l.to, polarity: l.polarity, grade: l.grade, refs: l.refs, reason: ['cites an unverified reference'], kind: 'unverified' })),
    ],
  });
}

// ───────────────────────── references, with the records that use them (used_by, plus links resolved here)
const usedBy = new Map<number, Set<string>>();
for (const r of d.references ?? []) usedBy.set(r.n, new Set(r.used_by));
for (const l of [...(L?.links ?? []), ...(L?.counter_links ?? [])]) for (const n of l.refs) usedBy.get(n)?.add(`links/${l.id}`);
for (const g of d.glossary ?? []) for (const n of cites(g.definition)) usedBy.get(n)?.add(`glossary/${g.id}`);
for (const c of d.concepts ?? []) for (const n of cites(c.body)) usedBy.get(n)?.add(`concepts/${c.front.id}`);
emit(
  'references.json',
  (d.references ?? []).map((r) => ({
    n: r.n,
    key: r.key,
    tier: r.tier,
    citation: r.citation,
    year: r.year,
    doi: r.doi ?? null,
    url: r.url ?? (r.doi ? `https://doi.org/${r.doi}` : null),
    isbn: r.isbn ?? null,
    abstract: r.abstract,
    abstract_source: r.abstract_source ?? null,
    abstract_note: r.abstract_note ?? null,
    harvested_on: r.harvested_on ?? null,
    summary: r.summary ?? null,
    why_it_mattered: r.why_it_mattered ?? null,
    role_here: r.role_here,
    role_note: r.role_note ?? null,
    verified: r.verified,
    verified_on: r.verified_on,
    used_by: [...(usedBy.get(r.n) ?? [])].sort(),
  })),
);

// ───────────────────────── glossary, concepts, strings
emit('glossary.json', d.glossary ?? []);
emit(
  'concepts.json',
  (d.concepts ?? []).map((c) => ({ ...c.front, body: c.body.replace(/<!-- framing -->\n?/g, ''), cites: [...cites(c.body)].sort((a, b) => a - b) })),
);
const ui = (pack.uiStrings ?? {}) as Record<string, any>;
const strings = JSON.parse(JSON.stringify(ui));
if (strings.first_run?.body_from === 'safety.notice') strings.first_run.body = d.safety?.notice ?? null;
strings.deidentify = d.safety?.deidentify?.nudge ?? null;
// K9: the ICD-11 licence citation (§1.3), shown verbatim on /about, /methods, the pop-out and in every export
if (strings.codes?.citation_from === 'situations.scheme.licence') {
  strings.codes.citation = s?.scheme.licence ?? null;
  if (!strings.codes.citation) errors.push('ui-strings/codes.citation_from: situations.scheme.licence is not set');
}
emit('strings.json', strings);

// ───────────────────────── manifest bundle (identity, audience, safety, scope, upkeep, ledger, todo)
emit('manifest.json', {
  manifest: d.manifest,
  audience: d.audience,
  safety: d.safety ? { ...d.safety } : null,
  scope: d.scope ?? null,
  upkeep: d.upkeep ?? null,
  changes: (d.changes ?? []).slice(-10).reverse(),
  planner: d.planner ?? null,
  todo: d.todo ?? [],
  scenarios: (d.scenarios ?? []).map((w) => ({ id: w.id, persona: w.persona, title: w.title })),
  lint_hits: res.lint.length,
});

// ───────────────────────── staleness (SUSTAIN §4) — same walk as validate_pack.py --staleness
const classes = new Map((d.upkeep?.classes ?? []).map((c) => [c.id, c]));
const FILE_CLASS: [string, string, unknown][] = [
  ['situations.yaml', 'scheme', pack.situations],
  ['references.yaml', 'reference', pack.references],
  ['links.yaml', 'link', pack.links],
  ['safety.yaml', 'help', pack.safety],
];
const stale: { class: string; where: string; checked: string; age_days: number; recheck_days: number }[] = [];
const dated: Record<string, { count: number; oldest: string | null }> = {};
for (const [fn, cls, obj] of FILE_CLASS) {
  const c = classes.get(cls);
  if (!c || obj === undefined) continue;
  const visit = (o: unknown, p: string) => {
    if (Array.isArray(o)) o.forEach((v, i) => visit(v, `${p}[${i}]`));
    else if (o && typeof o === 'object') {
      const rec = o as Record<string, unknown>;
      const dt = (rec.verified_on ?? rec.harvested_on) as string | undefined;
      if (dt && /^\d{4}-\d{2}-\d{2}$/.test(String(dt))) {
        const age = dayDiff(String(dt), BUILD_DATE);
        const lim = (rec.recheck_days as number) ?? c.recheck_days;
        dated[cls] ??= { count: 0, oldest: null };
        dated[cls].count++;
        if (!dated[cls].oldest || String(dt) < dated[cls].oldest!) dated[cls].oldest = String(dt);
        if (age > lim) stale.push({ class: cls, where: `${fn}:${p}`, checked: String(dt), age_days: age, recheck_days: lim });
      }
      for (const [k, v] of Object.entries(rec)) visit(v, p ? `${p}.${k}` : k);
    }
  };
  visit(obj, '');
}
const staleness = { as_of: BUILD_DATE, classes: d.upkeep?.classes ?? [], dated, stale, sweeps: d.upkeep?.sweeps ?? [] };
emit('staleness.json', staleness, PUB);
emit('staleness.json', staleness);

// ───────────────────────── provenance (ACTION-SPEC §6.6)
const refs = d.references ?? [];
const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});
const sdohCodes = (s?.items ?? []).filter((i) => !s!.groups.find((g) => g.id === i.group)?.functioning);
let safetyRun: unknown = null;
const runFile = path.join(ROOT, 'tests', 'safety', 'last-run.json');
if (fs.existsSync(runFile)) safetyRun = JSON.parse(fs.readFileSync(runFile, 'utf8'));
const provenance = {
  slug: d.manifest?.slug,
  as_of: asOf,
  built: BUILD_DATE,
  pack_version: d.manifest?.builder?.version,
  scheme: s ? { name: s.scheme.name, release: s.scheme.release, text_source: s.scheme.text_source ?? null, interim_source: s.scheme.interim_source ?? null, licence: s.scheme.licence ?? null } : null,
  modules: {
    situations: s
      ? {
          codes: s.items.length,
          sdoh_codes: sdohCodes.length,
          functioning_codes: s.items.length - sdohCodes.length,
          residuals: s.residuals.length,
          groups: s.groups.length,
          definitions_present: s.items.filter((i) => i.definition).length,
          definitions_null: s.items.filter((i) => !i.definition).length,
          definition_check: count(s.items, (i) => String(i.definition_check ?? 'none')),
          crosswalk_proposed: s.items.filter((i) => i.crosswalk?.proposed).length,
        }
      : null,
    links: L
      ? {
          offered: L.links.length + L.counter_links.length,
          by_grade: count([...L.links, ...L.counter_links], (l) => l.grade),
          withheld: L.withheld_links.length,
        }
      : null,
    actions: 0,
    gates: 0,
    resources: null,
  },
  references: {
    total: refs.length,
    by_tier: count(refs, (r) => r.tier),
    verified: refs.filter((r) => r.verified).length,
    unverified: refs.filter((r) => !r.verified).length,
    abstracts_present: refs.filter((r) => r.abstract).length,
  },
  glossary: (d.glossary ?? []).length,
  concepts: (d.concepts ?? []).length,
  todo: (d.todo ?? []).length,
  heuristics: [
    { id: 'A4', what: 'Loop strength (product of |weights|)', label: ui.loops?.strength_label },
    { id: 'A7', what: 'Leverage hints (weighted degree, betweenness, loop participation)', label: ui.analyses?.leverage_label },
    { id: 'A8', what: 'What-if pulse (FCM iteration)', label: ui.analyses?.pulse_label },
    { id: 'tiers', what: 'Association menu order by Solar–Irwin tier', label: s?.tier_basis ?? null },
  ],
  stale: stale.length,
  build_errors: errors.length,
  safety_tests: safetyRun ?? { note: 'Safety suite not yet recorded — run npm run test:e2e' },
};
emit('provenance.json', provenance, PUB);
emit('provenance.json', provenance);

// ───────────────────────── build errors
emit('build-errors.json', { errors, warnings: res.warnings });
const be = ['# BUILD-ERRORS — content build', '', `Built ${BUILD_DATE} by scripts/build-content.ts.`, ''];
be.push(errors.length ? `## ${errors.length} error(s)\n\n${errors.map((e) => `- ${e}`).join('\n')}` : '0 errors.');
if (res.warnings.length) be.push('', `## ${res.warnings.length} warning(s)`, '', ...res.warnings.map((w) => `- ${w}`));
const beText = be.join('\n') + '\n';
const beFile = path.join(PACK, 'BUILD-ERRORS.md');
if (!fs.existsSync(beFile) || fs.readFileSync(beFile, 'utf8') !== beText) fs.writeFileSync(beFile, beText);

// ───────────────────────── summary table
const rows: [string, string | number][] = [
  ['codes (items · residuals)', `${s?.items.length ?? 0} · ${s?.residuals.length ?? 0}`],
  ['definitions present / null', `${provenance.modules.situations?.definitions_present} / ${provenance.modules.situations?.definitions_null}`],
  ['links offered · withheld', `${provenance.modules.links?.offered} · ${provenance.modules.links?.withheld}`],
  ['references (verified · abstracts)', `${refs.length} (${provenance.references.verified} · ${provenance.references.abstracts_present})`],
  ['glossary · concepts · todo', `${provenance.glossary} · ${provenance.concepts} · ${provenance.todo}`],
  ['H1 lint hits', res.lint.length],
  ['stale facts', stale.length],
  ['errors · warnings', `${errors.length} · ${res.warnings.length}`],
];
console.log('build-content · sdoh-loops');
for (const [k, v] of rows) console.log(`  ${k.padEnd(36)} ${v}`);
for (const [f, n] of written) console.log(`  → ${f} (${(n / 1024).toFixed(1)} kB)`);
for (const e of errors) console.error('  ERROR', e);
if (errors.length) console.error(`\n${errors.length} build error(s) — see content-pack/BUILD-ERRORS.md and /methods`);
