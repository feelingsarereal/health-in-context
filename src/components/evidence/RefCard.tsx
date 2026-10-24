import { refMap, type Ref } from '@/lib/data/refs';
import { C } from '@/lib/copy';
import { Todo } from '@/components/ui/bits';

const tierLabel: Record<string, string> = { seminal: 'Seminal', classic: 'Classic', current: 'Current', background: 'Background' };

export function RefCard({ n, r: given, showUsedBy }: { n?: number; r?: Ref; showUsedBy?: boolean }) {
  const r = given ?? (n !== undefined ? refMap.get(n) : undefined);
  if (!r) return <Todo>reference [{n}] not in the pack</Todo>;
  const href = r.url ?? (r.doi ? `https://doi.org/${r.doi}` : null);
  return (
    <div className="text-sm" data-testid="ref-card" id={`ref-${r.n}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs bx-muted">[{r.n}]</span>
        <span className="bx-tier">{tierLabel[r.tier]}</span>
        <span className="bx-chip border border-[color:var(--bx-line)] bx-muted">{r.year}</span>
        {!r.verified && <span className="bx-todo">{C.ref.notVerified}</span>}
      </div>
      <p className="font-medium">{r.citation}</p>
      {r.summary ? (
        <p className="mt-1 bx-prose text-sm leading-6">
          <span className="font-semibold">{C.ref.summary}: </span>
          {r.summary}
        </p>
      ) : (
        <p className="mt-1">
          <Todo>summary pending{r.abstract_note ? ` — ${r.abstract_note}` : ''}</Todo>
        </p>
      )}
      {r.why_it_mattered && (
        <p className="mt-1 bx-prose text-sm leading-6">
          <span className="font-semibold">{C.ref.why}: </span>
          {r.why_it_mattered}
        </p>
      )}
      {r.abstract ? (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold">{C.ref.abstract}</summary>
          <blockquote className="mt-1 border-l-2 border-[color:var(--bx-line)] pl-3 bx-prose text-sm leading-6" data-testid="abstract-verbatim">
            {r.abstract}
          </blockquote>
          <p className="mt-1 text-xs bx-muted">
            Source: {r.abstract_source ?? '—'}, harvested {r.harvested_on ?? '—'}.
          </p>
        </details>
      ) : (
        <p className="mt-2">
          <span className="bx-todo">
            {C.ref.noAbstract}
            {r.abstract_note ? ` — ${r.abstract_note}` : ''}
          </span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {href && (
          <a className="underline" href={href} target="_blank" rel="noreferrer">
            {C.ref.open}
            {r.doi ? ` (doi:${r.doi})` : ''}
          </a>
        )}
      </div>
      {showUsedBy && r.used_by.length > 0 && (
        <p className="mt-1 text-xs bx-muted">
          {C.ref.usedBy}: {r.used_by.join(' · ')}
        </p>
      )}
    </div>
  );
}
