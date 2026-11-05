import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { C } from '../../lib/copy';
import type { MapStore } from '../../lib/storage';
import type { SdohMap } from '../../lib/model/map';
import { isChip, isOrphaned, spanAnchor, spansFor, type Span, type Target } from '../../lib/model/notebook';

/** SL28: one passage (or mention) that cites an item, with where it is */
export interface Citation {
  span: Span;
  note: string;
  anchor: string;
  /** set when the passage is in another map than the one open (a page outside the map lists every map's) */
  map?: { id: string; name: string };
  /** a link to it (pages outside the map) */
  href?: string;
}
export interface CitationsValue {
  list(t: Target): Citation[];
  /** Go to passage, inside the map workspace */
  onGo?: (c: Citation) => void;
}
/** SL28: where "Cited in your notebook (n)" finds its passages: the open map's notebook, or every map's on this device */
export const CitationsContext = createContext<CitationsValue | null>(null);

export function citationsIn(map: SdohMap, t: Target, href?: (map: string, span: string) => string, other = false): Citation[] {
  return spansFor(map.notebook, t)
    .filter((x) => !isOrphaned(map.notebook, x))
    .map((x) => {
      const note = map.notebook?.notes.find((n) => n.id === x.note);
      return { span: x, note: note?.title ?? '—', anchor: spanAnchor(note, x), ...(other ? { map: { id: map.id, name: map.name } } : {}), ...(href ? { href: href(map.id, x.id) } : {}) };
    });
}

/**
 * SL28 point 2: "Cited in your notebook (n)" — the passages and mentions that cite a reference, a glossary term, a 101
 * or a code, wherever it opens: each quote, its note and anchor, and Go to passage (or a link to it from a page outside
 * the map). Nothing shows when nothing cites it, or outside a notebook's reach.
 */
export function CitedInNotebook({ t, className = '' }: { t: Target; className?: string }) {
  const c = useContext(CitationsContext);
  if (!c) return null;
  const list = c.list(t);
  if (!list.length) return null;
  const P = C.notebook.passages;
  return (
    <section className={`mt-2 text-sm ${className}`} aria-label={`${P.citedIn} (${list.length})`} data-testid="cited-in-notebook" data-count={list.length}>
      <h4 className="m-0 font-semibold">{P.citedIn} ({list.length})</h4>
      <ul className="mt-1 space-y-1.5">
        {list.map((x) => (
          <li key={`${x.map?.id ?? ''}:${x.span.id}`} className="min-w-0" data-testid="cited-item" data-span={x.span.id}>
            <p className="m-0 line-clamp-2">{isChip(x.span) ? <span className="sx-chip">@ {P.mention}</span> : <span className="sx-span">“{x.span.quote}”</span>}</p>
            <p className="m-0 text-xs bx-muted">
              {[x.note, x.anchor].filter(Boolean).join(' · ')}
              {x.map ? ` · ${P.citedInMap} ${x.map.name}` : ''}
            </p>
            {x.href ? (
              <a className="ax-tap text-xs underline" href={x.href} data-testid="cited-go">{P.goTo}</a>
            ) : c.onGo ? (
              <button type="button" className="ax-tap text-xs underline" onClick={() => c.onGo!(x)} data-testid="cited-go">{P.goTo}</button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * SL28: for a page outside the map (the References, Glossary and 101 pages): every map's notebook on this device, read
 * from the store once; `href` builds the link that opens a map at a passage. Device-only, like the store itself.
 */
export function NotebookCitations({ store, href, children }: { store: MapStore | null; href: (map: string, span: string) => string; children: ReactNode }) {
  const [maps, setMaps] = useState<SdohMap[]>([]);
  useEffect(() => {
    if (!store) return;
    let live = true;
    (async () => {
      const list = await store.list();
      const all = (await Promise.all(list.map((m) => store.load(m.id).catch(() => null)))).filter((m): m is SdohMap => !!m?.notebook?.spans?.length);
      if (live) setMaps(all);
    })();
    return () => {
      live = false;
    };
  }, [store]);
  const value = useMemo<CitationsValue>(() => ({ list: (t) => maps.flatMap((m) => citationsIn(m, t, href, true)) }), [maps, href]);
  return <CitationsContext.Provider value={value}>{children}</CitationsContext.Provider>;
}
