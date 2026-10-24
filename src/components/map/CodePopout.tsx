import { codeMap, groupMap, scheme, tiers } from '@/lib/data/scheme';
import { S } from '@/lib/data/core';
import { Todo } from '@/components/ui/bits';
import { CitedText } from '@/components/evidence/CitedText';
import type { XRef } from '@/lib/data/scheme';

const xref = (x: string | XRef) => (typeof x === 'string' ? x : `${x.title}${x.code ? ` (${x.code})` : ''}`);

/** UI-02: the code's verbatim ICD-11 text, its block, the proposed crosswalk, the interim-source note and the WHO link. */
export function CodePopout({ code, headingLevel = 3 }: { code: string; headingLevel?: 2 | 3 | 4 }) {
  const c = codeMap.get(code);
  if (!c) return <Todo>code {code} is not in the pack</Todo>;
  const H = `h${headingLevel}` as 'h3';
  const block = groupMap.get(c.group);
  const sub = c.subgroup ? groupMap.get(c.subgroup) : undefined;
  const parent = c.parent ? codeMap.get(c.parent) : undefined;
  const who = c.who_browser ?? scheme.official_browser;
  const checkNote = c.definition_check && !['diff_verified', 'quoted_direct'].includes(c.definition_check);
  return (
    <div className="text-sm" data-testid="code-popout">
      <H className="font-display text-lg font-semibold">
        <span className="font-mono text-base">{c.code}</span> <span data-testid="code-title">{c.title}</span>
      </H>
      <p className="mt-1 text-xs bx-muted">
        {block && <>Block {block.id}: {block.title}. </>}
        {sub && sub.id !== c.code && sub.id !== c.parent && <>Within {sub.id} {sub.title}. </>}
        {parent && <>Parent: {parent.code} {parent.title}. </>}
        {block && <>Tier: {tiers[(sub ?? block).tier]}.</>}
        {c.residual && <> Residual category ({c.residual}).</>}
      </p>
      {c.definition ? (
        <blockquote className="mt-2 border-l-2 border-[color:var(--bx-line)] pl-3 leading-6" data-testid="code-definition">
          {c.definition}
        </blockquote>
      ) : (
        <p className="mt-2 font-medium" data-testid="no-definition">{S.codes.no_definition}</p>
      )}
      {checkNote && <p className="mt-1 text-xs bx-muted" data-testid="check-note">Check against WHO: this text was {c.definition_check?.replace(/_/g, ' ')}.</p>}
      {c.inclusions.length > 0 && (
        <div className="mt-2"><p className="font-semibold">Inclusions</p><ul className="list-disc pl-5">{c.inclusions.map((x, i) => <li key={i}>{xref(x)}</li>)}</ul></div>
      )}
      {c.exclusions.length > 0 && (
        <div className="mt-2"><p className="font-semibold">Exclusions</p><ul className="list-disc pl-5">{c.exclusions.map((x, i) => <li key={i}>{xref(x)}</li>)}</ul></div>
      )}
      {c.coded_elsewhere.length > 0 && (
        <div className="mt-2"><p className="font-semibold">Coded elsewhere</p><ul className="list-disc pl-5">{c.coded_elsewhere.map((x, i) => <li key={i}>{xref(x)}</li>)}</ul></div>
      )}
      {c.crosswalk && (
        <div className="mt-2" data-testid="crosswalk">
          <p className="flex flex-wrap items-center gap-1">
            <span className="font-semibold">Crosswalk</span>
            {c.crosswalk.proposed && <span className="bx-chip border border-dashed border-[color:var(--bx-line)]" data-testid="proposed-chip">{S.codes.proposed_xwalk}</span>}
            {c.crosswalk.sources?.length ? <CitedText as="span" text={c.crosswalk.sources.map((n) => `[${n}]`).join(' ')} /> : null}
          </p>
          <ul className="mt-1 space-y-0.5">
            {c.crosswalk.hp2030.map((h, i) => (
              <li key={h} data-testid="xwalk-hp2030">
                Healthy People 2030: {c.crosswalk!.hp2030_titles?.[i] ?? <Todo>domain title for “{h}” not in the pack</Todo>} <span className="font-mono text-xs bx-muted">({h})</span>
              </li>
            ))}
            {c.crosswalk.icd10cm.map((z, i) => (
              <li key={z} data-testid="xwalk-icd10cm">
                ICD-10-CM <span className="font-mono">{z}</span>: {c.crosswalk!.icd10cm_titles?.[i] ?? <Todo>title for {z} not in the pack</Todo>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.index_terms.length > 1 && <p className="mt-2 text-xs bx-muted">Index terms: {c.index_terms.join('; ')}</p>}
      {scheme.interim_source && <p className="mt-2 text-xs bx-muted" data-testid="interim-note">{S.codes.interim}</p>}
      <p className="mt-2 flex flex-wrap gap-3">
        <a className="underline" href={who} target="_blank" rel="noreferrer" data-testid="who-link">{S.codes.open_who}</a>
        <a className="underline bx-muted" href={c.source_url} target="_blank" rel="noreferrer">Interim copy</a>
      </p>
    </div>
  );
}
