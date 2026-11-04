import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapStore } from '../../lib/storage';
import type { SdohMap } from '../../lib/model/map';
import { newId, toGraph } from '../../lib/model/map';
import { findLoops } from '../../lib/analysis';
import { assignLoopNames } from '../../lib/model/interchange';

const MAX_HISTORY = 100;

export interface MapDocEvents {
  /** the map as stored after each change (an edit, undo or redo, or a new loop's stored number) */
  onChange?: (map: SdohMap) => void;
  /** K13: the first edit to a read-only original made this copy; the copy is what is open (and saved) from now on */
  onCopy?: (copy: SdohMap, originalId: string) => void;
}

/**
 * One open map: undo/redo history, autosave on every change (ACTION-SPEC §4), and the derived loop analysis.
 * `apply(fn, key)` coalesces edits that share a key within a second (typing into a field is one undo step).
 * A read-only original (store.readOnly) is never saved: the first edit forks a copy with a new id, and the history
 * moves over to the copy, so undo never writes to the original (K13).
 */
export function useMapDoc(id: string | null, store: MapStore, events: MapDocEvents = {}) {
  const [map, setMap] = useState<SdohMap | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const past = useRef<SdohMap[]>([]);
  const future = useRef<SdohMap[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const [, force] = useState(0);
  const cur = useRef<SdohMap | null>(null);
  cur.current = map;
  const readOnly = useRef(false);
  const ev = useRef(events);
  ev.current = events;

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    past.current = [];
    future.current = [];
    (async () => {
      if (!id) {
        setMap(null);
        setStatus('missing');
        return;
      }
      const m = await store.load(id);
      if (!alive) return;
      readOnly.current = !!(m && store.readOnly?.(m.id));
      cur.current = m;
      setMap(m);
      setStatus(m ? 'ready' : 'missing');
    })();
    return () => {
      alive = false;
    };
  }, [id, store]);

  const persist = useCallback(
    (m: SdohMap) => {
      saving.current = saving.current.then(async () => {
        await store.save(m);
      });
    },
    [store],
  );

  const commit = useCallback(
    (next: SdohMap) => {
      cur.current = next;
      if (!readOnly.current) persist(next);
      setMap(next);
      if (!readOnly.current) ev.current.onChange?.(next);
    },
    [persist],
  );

  /** K13: leave the read-only original — the edited map and its whole history become a copy under a new id. */
  const fork = useCallback((m: SdohMap, next: SdohMap): [SdohMap, SdohMap] => {
    const copyId = newId('map');
    const name = `${m.name} (copy)`;
    const re = (x: SdohMap): SdohMap => ({ ...x, id: copyId, name: x.name === m.name ? name : x.name });
    past.current = past.current.map(re);
    future.current = future.current.map(re);
    readOnly.current = false;
    const copy = { ...re(next), updated: new Date().toISOString() };
    ev.current.onCopy?.(copy, m.id);
    return [copy, re(m)];
  }, []);

  const apply = useCallback(
    (fn: (m: SdohMap) => SdohMap, key?: string) => {
      const m = cur.current;
      if (!m) return;
      let next = fn(m);
      if (next === m) return;
      let prev = m;
      if (readOnly.current) [next, prev] = fork(m, next);
      const t = Date.now();
      const coalesce = key && lastKey.current && lastKey.current.key === key && t - lastKey.current.at < 1000;
      if (!coalesce) past.current = [...past.current.slice(-MAX_HISTORY + 1), prev];
      lastKey.current = key ? { key, at: t } : null;
      future.current = [];
      commit(next);
    },
    [commit, fork],
  );

  /**
   * SL26: change the open map and every step of its undo history the same way, without adding a step — a label that
   * replaces a possible identifier, so Undo can never bring the replaced value back. On a read-only original it is an
   * ordinary edit (the copy is forked, and the original was never stored here).
   */
  const scrub = useCallback(
    (fn: (m: SdohMap) => SdohMap) => {
      const m = cur.current;
      if (!m) return;
      if (readOnly.current) return apply(fn);
      const next = fn(m);
      if (next === m) return;
      past.current = past.current.map(fn);
      future.current = future.current.map(fn);
      lastKey.current = null;
      commit(next);
    },
    [apply, commit],
  );

  const undo = useCallback(() => {
    const m = cur.current;
    const prev = past.current.pop();
    if (!m || !prev) return;
    future.current.push(m);
    lastKey.current = null;
    commit(prev);
    force((x) => x + 1);
  }, [commit]);
  const redo = useCallback(() => {
    const m = cur.current;
    const next = future.current.pop();
    if (!m || !next) return;
    past.current.push(m);
    lastKey.current = null;
    commit(next);
    force((x) => x + 1);
  }, [commit]);

  const graph = useMemo(() => (map ? toGraph(map) : { nodes: [], edges: [] }), [map]);
  const loops = useMemo(() => findLoops(graph), [graph]);
  const named = useMemo(() => assignLoopNames(map?.loops ?? [], loops), [loops, map?.loops]);
  const loopNames = named.names;
  // K6 D4: store a new loop's number with the map (outside the undo history), so it never renumbers
  useEffect(() => {
    const m = cur.current;
    if (!m || !named.added.length) return;
    const have = new Set(m.loops.map((l) => l.id));
    const add = named.added.filter((l) => !have.has(l.id));
    if (add.length) commit({ ...m, loops: [...m.loops, ...add] });
  }, [named, commit]);

  return {
    map,
    status,
    apply,
    scrub,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    readOnly: readOnly.current,
    graph,
    loops,
    loopNames,
    flush: () => saving.current,
  };
}
export type MapDoc = ReturnType<typeof useMapDoc>;
