import { C } from '../../lib/copy';
import { count } from '../../lib/plural';
import type { SdohMap } from '../../lib/model/map';
import { isOrphaned, spanAnchor, spansFor, type Target } from '../../lib/model/notebook';

/**
 * SL27 point 8: the notebook passages behind a circumstance or link — "In the notebook (n)" in the selection card, in
 * Read and in Edit: each quote (two lines at most), its note and anchor ("eviction-letter · p. 2"), Go to passage, and
 * Remove as evidence (left out on a read-only map).
 */
export function SourcesList({ map, t, onGo, onRemove, compact }: {
  map: SdohMap;
  t: Target;
  onGo?: (span: string) => void;
  onRemove?: (span: string) => void;
  /** Read mode: Remove as evidence as a small text button */
  compact?: boolean;
}) {
  const list = spansFor(map.notebook, t);
  if (!list.length) return null;
  const P = C.notebook.passages;
  return (
    <section className="mt-2 text-sm" aria-label={`${P.inNotebook} (${list.length})`} data-testid="sources-list" data-count={list.length}>
      <h3 className="m-0 font-semibold">{P.inNotebook} ({list.length})</h3>
      <ul className="mt-1 space-y-2">
        {list.map((x) => {
          const note = map.notebook?.notes.find((n) => n.id === x.note);
          const where = [note?.title ?? '—', spanAnchor(note, x)].filter(Boolean).join(' · ');
          const orphan = isOrphaned(map.notebook, x);
          return (
            <li key={x.id} className="min-w-0" data-testid="source-item" data-span={x.id}>
              <p className="m-0 line-clamp-2">
                <span className={x.by?.inferred ? (x.by.confidence === 'low' ? 'sx-span-low' : 'sx-span-inferred') : 'sx-span'} data-testid="source-quote">“{x.quote}”</span>
                {x.by?.inferred && <span className="sx-approx" aria-hidden="true">≈</span>}
              </p>
              <p className="m-0 text-xs bx-muted" data-testid="source-where">
                {where}
                {orphan ? ` · ${P.orphaned.toLowerCase()}` : ''}
                {x.by ? ` · ${P.suggestedBy} ${x.by.label}` : ''}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                {onGo && !orphan && (
                  <button type="button" className={compact ? 'ax-tap text-xs underline' : 'bx-btn ax-tap px-2 py-0 text-xs'} onClick={() => onGo(x.id)} data-testid="source-go">{P.goTo}</button>
                )}
                {onRemove && (
                  <button type="button" className={compact ? 'ax-tap text-xs underline' : 'bx-btn ax-tap px-2 py-0 text-xs'} onClick={() => onRemove(x.id)} data-testid="source-remove">{P.removeEvidence}</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** SL27 point 8: the peek's line — "In the notebook: 2 passages", a link that opens the card. */
export function SourcesCount({ map, t, onOpen }: { map: SdohMap; t: Target; onOpen?: () => void }) {
  const n = spansFor(map.notebook, t).length;
  if (!n) return null;
  const text = `${C.notebook.passages.inNotebook}: ${count(n, 'passage')}`;
  return onOpen ? (
    <button type="button" className="ax-tap mt-1 text-sm underline" onClick={onOpen} data-testid="peek-sources">{text}</button>
  ) : (
    <p className="m-0 mt-1 text-sm" data-testid="peek-sources">{text}</p>
  );
}
