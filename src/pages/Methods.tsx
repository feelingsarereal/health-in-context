import { bundle, buildErrors, provenance, staleness, S } from '@/lib/data/core';
import { scheme, knownGaps, notOffered, endpointTitle, tierBasis, codes } from '@/lib/data/scheme';
import { references } from '@/lib/data/refs';
import { AsOf, PageHead, Todo } from '@/components/ui/bits';

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mt-10 scroll-mt-20" aria-labelledby={`${id}-h`}>
    <h2 id={`${id}-h`} className="text-2xl">{title}</h2>
    <div className="mt-2 space-y-2 text-[15px] leading-7">{children}</div>
  </section>
);

/** ACTION-SPEC §2 /methods: provenance counts, every TODO(author), heuristics, interim sources, build errors, staleness. */
export default function Methods() {
  const p = provenance;
  const sit = p.modules.situations;
  const todo = bundle.todo as { id: string; what: string; blocks?: string }[];
  const unverified = references.filter((r) => !r.verified);
  const noAbstract = references.filter((r) => !r.abstract);
  const noSummary = references.filter((r) => !r.summary);
  const checkNotes = codes.filter((c) => c.definition_check && !['diff_verified', 'quoted_direct'].includes(c.definition_check));
  const scope = bundle.scope;
  const missingXwalk = [
    ...new Set(
      codes.flatMap((c) => [
        ...(c.crosswalk?.icd10cm ?? []).filter((_, i) => !c.crosswalk?.icd10cm_titles?.[i]).map((z) => `ICD-10-CM ${z}`),
        ...(c.crosswalk?.hp2030 ?? []).filter((_, i) => !c.crosswalk?.hp2030_titles?.[i]).map((h) => `HP2030 ${h}`),
      ]),
    ),
  ].sort();
  return (
    <div className="[overflow-wrap:anywhere]">
      <PageHead title="Methods and provenance" lead="Where every fact in this app comes from, what is missing, and what is a heuristic.">
        <div className="mt-3"><AsOf /></div>
      </PageHead>

      <Section id="counts" title="Provenance counts">
        <ul className="list-disc pl-5" data-testid="provenance-counts">
          <li>{sit.codes} ICD-11 codes ({sit.sdoh_codes} SDOH, {sit.functioning_codes} functioning) in {sit.groups} groups, plus {sit.residuals} "other specified / unspecified" residual codes.</li>
          <li>Definitions: {sit.definitions_present} present (verbatim), {sit.definitions_null} with no definition in ICD-11. Definition checks: {Object.entries(sit.definition_check).map(([k, v]) => `${k} ${v}`).join(' · ')}.</li>
          <li>Crosswalks (ICD-10-CM, HP2030): {sit.crosswalk_proposed} marked proposed.</li>
          <li>Links offered: {p.modules.links.offered} (by grade: {Object.entries(p.modules.links.by_grade).map(([k, v]) => `${k} ${v}`).join(' · ')}; {p.modules.links.counter} protective). Withheld: {p.modules.links.withheld}.</li>
          <li>References: {p.references.total} ({Object.entries(p.references.by_tier).map(([k, v]) => `${k} ${v}`).join(' · ')}); {p.references.verified} verified, {p.references.unverified} not verified; {p.references.abstracts_present} with verbatim abstracts.</li>
          <li>Glossary terms: {p.glossary}. Primers: {p.concepts}. Open research items (todo): {p.todo}. Stale facts: {p.stale}. Build errors: {p.build_errors}.</li>
        </ul>
        <p className="text-sm bx-muted">Machine-readable: <a className="underline" href={`${import.meta.env.BASE_URL}provenance.json`}>provenance.json</a> · <a className="underline" href={`${import.meta.env.BASE_URL}staleness.json`}>staleness.json</a></p>
      </Section>

      <Section id="interim" title="Interim sources">
        <p data-testid="interim-source"><span className="font-semibold">{scheme.name} {scheme.release}: </span>{scheme.interim_source}</p>
        {checkNotes.length > 0 && <p>Codes whose definition text should be checked against WHO (shown with a note in the pop-out): {checkNotes.map((c) => `${c.code} (${c.definition_check})`).join(', ')}.</p>}
        <details>
          <summary className="cursor-pointer font-semibold">Known gaps in the code extraction ({knownGaps.length})</summary>
          <ul className="mt-2 list-disc pl-5">{knownGaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </details>
      </Section>

      <Section id="heuristics" title="Heuristics and their labels">
        <ul className="list-disc pl-5" data-testid="heuristics">
          {p.heuristics.map((h: { id: string; what: string; label: string | null }) => (
            <li key={h.id}><span className="font-semibold">{h.id} — {h.what}.</span> Label shown wherever it renders: “{h.label}”.</li>
          ))}
        </ul>
      </Section>

      <Section id="todo" title="TODO(author)">
        <p>Gaps render in amber where they occur and are all listed here. Nothing below is shown as fact.</p>
        <ul className="space-y-2" data-testid="todo-list">
          {todo.map((t) => (
            <li key={t.id}><Todo>{t.id}</Todo> {t.what}{t.blocks ? ` — blocks: ${t.blocks}` : ''}</li>
          ))}
          <li><Todo>references</Todo> {unverified.length} not verified (never cited as evidence): {unverified.map((r) => `[${r.n}] ${r.key}`).join(', ')}.</li>
          <li><Todo>abstracts</Todo> {noAbstract.length} references have no harvested abstract: {noAbstract.map((r) => `[${r.n}]`).join(' ')}.</li>
          <li><Todo>summaries</Todo> {noSummary.length} references have no summary: {noSummary.map((r) => `[${r.n}]`).join(' ')}.</li>
          {missingXwalk.length > 0 && (
            <li><Todo>crosswalk titles</Todo> The pack gives no title for: {missingXwalk.join(', ')} (shown in amber in the pop-out).</li>
          )}
          <li><Todo>interface copy</Todo> Labels and instructions not yet in ui-strings.yaml live in src/lib/copy.ts for review.</li>
        </ul>
      </Section>

      <Section id="withheld" title="Links withheld or not offered">
        <p>These links are never offered on the map or shown as evidence.</p>
        <ul className="space-y-2" data-testid="withheld-list">
          {notOffered.map((l) => (
            <li key={l.id} className="bx-card p-3">
              <span className="font-mono text-xs">{l.id}</span> {l.from} {endpointTitle(l.from)} → {l.to} {endpointTitle(l.to)} ({l.polarity}, grade {l.grade}, refs {l.refs.join(', ')}).
              <ul className="mt-1 list-disc pl-5 text-sm bx-muted">{l.reason.map((r) => <li key={r}>{r}</li>)}</ul>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="staleness" title="Upkeep and staleness">
        <p>Checked against the build date {staleness.as_of}. {staleness.stale.length === 0 ? 'Nothing is past its re-check interval.' : `${staleness.stale.length} facts are past their re-check interval:`}</p>
        {staleness.stale.length > 0 && (
          <ul className="list-disc pl-5">{staleness.stale.map((s: any) => <li key={s.where}>[{s.class}] {s.where} — checked {s.checked} ({s.age_days} days)</li>)}</ul>
        )}
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left"><th className="py-1 pr-2">Class</th><th className="py-1 pr-2">Re-check</th><th className="py-1 pr-2">Dated facts</th><th className="py-1">How</th></tr></thead>
          <tbody>
            {staleness.classes.map((c: any) => (
              <tr key={c.id} className="border-t border-[color:var(--bx-line)] align-top">
                <td className="py-1 pr-2">{c.id}</td><td className="py-1 pr-2">{c.recheck_days} days</td>
                <td className="py-1 pr-2">{staleness.dated[c.id] ? `${staleness.dated[c.id].count} (oldest ${staleness.dated[c.id].oldest})` : 'none dated'}</td>
                <td className="py-1">{c.how}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="text-sm bx-muted">Links carry no dates of their own in this pack; their age is that of the research (as of {p.as_of}).</p>
        <h3 className="text-lg mt-4">Change ledger (last ten)</h3>
        <ul className="list-disc pl-5">{bundle.changes.map((c: any, i: number) => <li key={i}>{c.date} — {c.what} ({c.why}; by {c.by})</li>)}</ul>
      </Section>

      <Section id="safety" title="Safety profile: health">
        <p>Each invariant is a test in tests/safety/ (SAFETY §1–§2): G2 no runtime fetches, G5 no telemetry, H1 the safety.yaml phrase lint (over the pack and over the built app), H2 nothing typed leaves the device, H3 de-identification nudges, H4 clear my data, H5 the notice, H6 help.</p>
        <p>The H1 lint checks {bundle.safety.blocked_phrases.length} blocked phrases (listed in content-pack/safety.yaml, not repeated here so this page passes its own lint). Allowed contexts: {bundle.safety.allowed_contexts.map((a: any) => a.field).join(', ')}.</p>
        <p>
          Exact phrases removed before the lint runs (safety.yaml → allowed_phrases, SAFETY 0.1.1): {bundle.safety.allowed_phrases.map((x: string) => `“${x}”`).join(', ')}. There is no
          general negation exemption. Hits in the pack at this build: {bundle.lint_hits}.
        </p>
        <p className="text-sm bx-muted">Last recorded safety run: {p.safety_tests?.summary ?? p.safety_tests?.note}</p>
      </Section>

      <Section id="build" title="Build errors">
        {buildErrors.errors.length === 0 ? <p data-testid="build-errors">0 errors in the content build.</p> : (
          <ul className="list-disc pl-5" data-testid="build-errors">{buildErrors.errors.map((e) => <li key={e}><Todo>build</Todo> {e}</li>)}</ul>
        )}
        {buildErrors.warnings.length > 0 && <ul className="list-disc pl-5">{buildErrors.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      </Section>

      <Section id="methods" title="How the analyses work">
        <p>The map is read as a causal loop diagram. Loops are every elementary circuit (Johnson's algorithm), capped at 12 circumstances per loop and 500 loops; a loop with an even number of − links is reinforcing (R), an odd number balancing (B). Paths between two circumstances are capped at 200. Clusters are strongly connected components (Tarjan). Leverage hints combine weighted in/out degree, betweenness and loop count. The what-if pulse iterates x(t+1) = tanh(x(t) + Wᵀx(t)) with the pushed circumstance held fixed, for at most 30 steps. {S.loops.strength_label}.</p>
        <p>{tierBasis}</p>
      </Section>

      {scope && (
        <Section id="scope" title="Scope and how the research was done">
          <p>{scope.search_strategy.approach}</p>
          <p className="text-sm">Sources: {scope.search_strategy.sources.join(', ')}. Closed {scope.search_strategy.date_closed}.</p>
          <h3 className="text-lg mt-3">In scope</h3>
          <ul className="list-disc pl-5">{scope.boundary.in.map((x: string) => <li key={x}>{x}</li>)}</ul>
          <h3 className="text-lg mt-3">Out of scope</h3>
          <ul className="list-disc pl-5">{scope.boundary.out.map((x: string) => <li key={x}>{x}</li>)}</ul>
          <h3 className="text-lg mt-3">Known gaps</h3>
          <ul className="list-disc pl-5">{scope.search_strategy.known_gaps.map((x: string) => <li key={x}>{x}</li>)}</ul>
          <h3 className="text-lg mt-3">Scoping interview</h3>
          <dl className="text-sm">{scope.interview.map((x: any) => <div key={x.q} className="mt-1"><dt className="font-semibold">{x.q}</dt><dd>{x.a} ({x.date})</dd></div>)}</dl>
        </Section>
      )}
    </div>
  );
}
