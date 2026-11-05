import { C } from '../../lib/copy';
import { count } from '../../lib/plural';
import { isChip, isOrphaned, spanAnchor, type Notebook } from '../../lib/model/notebook';
import type { PassageGroup } from '../../lib/model/targets';

/**
 * SL28 point 2: the passages behind a loop or a cluster — "4 passages", a fold-out grouped by circumstance: each quote,
 * its note and anchor, and Go to passage. Nothing shows when no passage backs it.
 */
export function PassagesFold({ notebook, groups, onGo, testId = 'passages-fold' }: { notebook: Notebook | undefined; groups: { groups: PassageGroup[]; total: number }; onGo?: (span: string) => void; testId?: string }) {
  if (!groups.total) return null;
  const P = C.notebook.passages;
  return (
    <details className="mt-1 text-sm" data-testid={testId} data-count={groups.total}>
      <summary className="ax-tap cursor-pointer text-xs font-semibold">{count(groups.total, 'passage')}</summary>
      <div className="mt-1 space-y-2">
        {groups.groups.map((g) => (
          <section key={g.node ?? g.label} aria-label={g.label}>
            <h4 className="m-0 text-xs font-semibold">{g.label}</h4>
            <ul className="mt-0.5 space-y-1">
              {g.spans.map((x) => {
                const note = notebook?.notes.find((n) => n.id === x.note);
                const orphan = isOrphaned(notebook, x);
                return (
                  <li key={x.id} className="min-w-0" data-testid="fold-item" data-span={x.id}>
                    <p className="m-0 line-clamp-2">{isChip(x) ? <span className="sx-chip">@ {P.mention}</span> : <span className="sx-span">“{x.quote}”</span>}</p>
                    <p className="m-0 text-xs bx-muted">
                      {[note?.title ?? '—', spanAnchor(note, x)].filter(Boolean).join(' · ')}
                      {orphan ? ` · ${P.orphaned.toLowerCase()}` : ''}
                    </p>
                    {onGo && !orphan && <button type="button" className="ax-tap text-xs underline" onClick={() => onGo(x.id)} data-testid="fold-go">{P.goTo}</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
