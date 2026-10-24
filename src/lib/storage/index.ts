/**
 * The on-device workspace (ACTION-SPEC §4, SAFETY H2/H4). Maps live in IndexedDB (idb-keyval, database
 * `sdoh-loops`), with a localStorage fallback when IndexedDB is unavailable. There is no server, account or sync.
 * Everything stored is keyed by the manifest slug, so "Clear my data" can remove all of it.
 */
import { createStore, get, set, del, keys, clear, type UseStore } from 'idb-keyval';
import { migrate, type SdohMap } from '../model/map';

export const SLUG = 'sdoh-loops';
export const DB_NAME = SLUG;
const LS_PREFIX = `${SLUG}:map:`;
/** localStorage keys this app writes besides maps (preferences); all are removed by clearAll(). */
export const PREF_KEYS = ['bx-theme', `${SLUG}:first-run`, `${SLUG}:last-map`, `${SLUG}:panel`];

export interface MapSummary {
  id: string;
  name: string;
  updated: string;
  nodes: number;
  edges: number;
}

export interface MapStore {
  list(): Promise<MapSummary[]>;
  load(id: string): Promise<SdohMap | null>;
  save(map: SdohMap): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  kind: 'indexeddb' | 'localstorage';
}

function summarize(m: SdohMap): MapSummary {
  return { id: m.id, name: m.name, updated: m.updated, nodes: m.nodes.filter((n) => n.kind !== 'note').length, edges: m.edges.length };
}
const byUpdated = (a: MapSummary, b: MapSummary) => b.updated.localeCompare(a.updated);

export function idbStore(idb?: UseStore): MapStore {
  const store = idb ?? createStore(DB_NAME, 'maps');
  return {
    kind: 'indexeddb',
    async list() {
      const ks = (await keys(store)) as string[];
      const out: MapSummary[] = [];
      for (const k of ks) {
        const v = await get(k, store);
        if (v) out.push(summarize(migrate(v)));
      }
      return out.sort(byUpdated);
    },
    async load(id) {
      const v = await get(id, store);
      return v ? migrate(v) : null;
    },
    async save(map) {
      await set(map.id, JSON.parse(JSON.stringify(map)), store);
    },
    async remove(id) {
      await del(id, store);
    },
    async clearAll() {
      await clear(store);
      clearPrefs();
      if (typeof indexedDB !== 'undefined') {
        await new Promise<void>((res) => {
          const r = indexedDB.deleteDatabase(DB_NAME);
          r.onsuccess = r.onerror = r.onblocked = () => res();
        });
      }
    },
  };
}

export function localStore(ls: Storage = globalThis.localStorage): MapStore {
  const mapKeys = () => Array.from({ length: ls.length }, (_, i) => ls.key(i)!).filter((k) => k?.startsWith(LS_PREFIX));
  return {
    kind: 'localstorage',
    async list() {
      return mapKeys()
        .map((k) => summarize(migrate(JSON.parse(ls.getItem(k)!))))
        .sort(byUpdated);
    },
    async load(id) {
      const v = ls.getItem(LS_PREFIX + id);
      return v ? migrate(JSON.parse(v)) : null;
    },
    async save(map) {
      ls.setItem(LS_PREFIX + map.id, JSON.stringify(map));
    },
    async remove(id) {
      ls.removeItem(LS_PREFIX + id);
    },
    async clearAll() {
      for (const k of mapKeys()) ls.removeItem(k);
      clearPrefs(ls);
    },
  };
}

function clearPrefs(ls: Storage | undefined = globalThis.localStorage) {
  try {
    if (!ls) return;
    for (const k of PREF_KEYS) ls.removeItem(k);
    for (const k of Array.from({ length: ls.length }, (_, i) => ls.key(i)!)) if (k?.startsWith(`${SLUG}:`)) ls.removeItem(k);
    globalThis.sessionStorage?.clear?.();
  } catch {
    /* storage blocked: nothing to clear */
  }
}

let chosen: Promise<MapStore> | null = null;
/** IndexedDB when it opens, else localStorage. */
export function getStore(): Promise<MapStore> {
  if (!chosen) {
    chosen = (async () => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('no idb');
        const s = idbStore();
        await s.list();
        return s;
      } catch {
        return localStore();
      }
    })();
  }
  return chosen;
}
/** After clearAll() deletes the database, the next call re-opens it fresh. */
export function resetStore() {
  chosen = null;
}

export function pref(key: string): string | null {
  try {
    return localStorage.getItem(`${SLUG}:${key}`);
  } catch {
    return null;
  }
}
export function setPref(key: string, value: string) {
  try {
    localStorage.setItem(`${SLUG}:${key}`, value);
  } catch {
    /* ignore */
  }
}
