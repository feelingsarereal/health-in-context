import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStore, setPref } from '@/lib/storage';
import type { SdohMap } from '@/lib/model/map';
import { toGraph } from '@/lib/model/map';
import { findLoops } from '@/lib/analysis';
import { assignLoopNames } from '@/lib/model/interchange';

const MAX_HISTORY = 100;

/**
 * One open map: undo/redo history, autosave on every change (ACTION-SPEC §4), and the derived loop analysis.
 * `apply(fn, key)` coalesces edits that share a key within a second (typing into a field is one undo step).
 */
export function useMapDoc(id: string | null) {
  const [map, setMap] = useState<SdohMap | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const past = useRef<SdohMap[]>([]);
  const future = useRef<SdohMap[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const [, force] = useState(0);
  const cur = useRef<SdohMap | null>(null);
  cur.current = map;

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
      const store = await getStore();
      const m = await store.load(id);
      if (!alive) return;
      cur.current = m;
      setMap(m);
      setStatus(m ? 'ready' : 'missing');
      if (m) setPref('last-map', m.id);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const persist = useCallback((m: SdohMap) => {
    saving.current = saving.current.then(async () => {
      const store = await getStore();
      await store.save(m);
    });
  }, []);

  const commit = useCallback(
    (next: SdohMap) => {
      cur.current = next;
      persist(next);
      setMap(next);
    },
    [persist],
  );

  const apply = useCallback(
    (fn: (m: SdohMap) => SdohMap, key?: string) => {
      const m = cur.current;
      if (!m) return;
      const next = fn(m);
      if (next === m) return;
      const t = Date.now();
      const coalesce = key && lastKey.current && lastKey.current.key === key && t - lastKey.current.at < 1000;
      if (!coalesce) past.current = [...past.current.slice(-MAX_HISTORY + 1), m];
      lastKey.current = key ? { key, at: t } : null;
      future.current = [];
      commit(next);
    },
    [commit],
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
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    graph,
    loops,
    loopNames,
    flush: () => saving.current,
  };
}
export type MapDoc = ReturnType<typeof useMapDoc>;
