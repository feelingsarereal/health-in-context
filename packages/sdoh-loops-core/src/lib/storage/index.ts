/**
 * The on-device workspace (ACTION-SPEC §4, SAFETY H2/H4). Maps live in IndexedDB (idb-keyval, database
 * `sdoh-loops`), with a localStorage fallback when IndexedDB is unavailable. There is no server, account or sync.
 * Everything stored is keyed by the manifest slug, so "Clear my data" can remove all of it. An embedding app passes
 * its own slug to browserStore(), and may wrap the store in withOriginals() so its built maps open read-only (K13).
 */
import { createStore, get, set, del, keys, clear, type UseStore } from 'idb-keyval';
import { migrate, type SdohMap } from '../model/map';

export const SLUG = 'sdoh-loops';
export const DB_NAME = SLUG;
const lsPrefix = (slug: string) => `${slug}:map:`;
/** localStorage keys this app writes besides maps (preferences); all are removed by clearAll(). */
export const PREF_KEYS = ['bx-theme', `${SLUG}:first-run`, `${SLUG}:last-map`, `${SLUG}:panel`];

export interface MapSummary {
  id: string;
  name: string;
  updated: string;
  nodes: number;
  edges: number;
  /** an original the embedding app supplied: it opens, but every edit goes to a copy (K13) */
  readOnly?: boolean;
}

export interface MapStore {
  list(): Promise<MapSummary[]>;
  load(id: string): Promise<SdohMap | null>;
  save(map: SdohMap): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  kind: 'indexeddb' | 'localstorage';
  /** true for a read-only original; save() and remove() refuse it (K13) */
  readOnly?(id: string): boolean;
}

/** Thrown when something tries to overwrite or delete a read-only original. */
export class ReadOnlyMapError extends Error {}

function summarize(m: SdohMap): MapSummary {
  return { id: m.id, name: m.name, updated: m.updated, nodes: m.nodes.filter((n) => n.kind !== 'note').length, edges: m.edges.length };
}
const byUpdated = (a: MapSummary, b: MapSummary) => b.updated.localeCompare(a.updated);

export function idbStore(idb?: UseStore, slug = SLUG): MapStore {
  const store = idb ?? createStore(slug, 'maps');
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
      clearPrefs(undefined, slug);
      if (typeof indexedDB !== 'undefined') {
        await new Promise<void>((res) => {
          const r = indexedDB.deleteDatabase(slug);
          r.onsuccess = r.onerror = r.onblocked = () => res();
        });
      }
    },
  };
}

export function localStore(ls: Storage = globalThis.localStorage, slug = SLUG): MapStore {
  const prefix = lsPrefix(slug);
  const mapKeys = () => Array.from({ length: ls.length }, (_, i) => ls.key(i)!).filter((k) => k?.startsWith(prefix));
  return {
    kind: 'localstorage',
    async list() {
      return mapKeys()
        .map((k) => summarize(migrate(JSON.parse(ls.getItem(k)!))))
        .sort(byUpdated);
    },
    async load(id) {
      const v = ls.getItem(prefix + id);
      return v ? migrate(JSON.parse(v)) : null;
    },
    async save(map) {
      ls.setItem(prefix + map.id, JSON.stringify(map));
    },
    async remove(id) {
      ls.removeItem(prefix + id);
    },
    async clearAll() {
      for (const k of mapKeys()) ls.removeItem(k);
      clearPrefs(ls, slug);
    },
  };
}

function clearPrefs(ls: Storage | undefined = globalThis.localStorage, slug = SLUG) {
  try {
    if (!ls) return;
    if (slug === SLUG) for (const k of PREF_KEYS) ls.removeItem(k);
    for (const k of Array.from({ length: ls.length }, (_, i) => ls.key(i)!)) if (k?.startsWith(`${slug}:`)) ls.removeItem(k);
    globalThis.sessionStorage?.clear?.();
  } catch {
    /* storage blocked: nothing to clear */
  }
}

/** The browser store under a slug: IndexedDB when it opens, else localStorage. */
export async function browserStore(slug = SLUG): Promise<MapStore> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no idb');
    const s = idbStore(undefined, slug);
    await s.list();
    return s;
  } catch {
    return localStore(undefined, slug);
  }
}

/**
 * K13: an embedding app's built maps as read-only originals over a store. They list and open like any map; save() and
 * remove() refuse them, so the editor forks a copy (useMapDoc) and the original is never changed.
 */
export function withOriginals(base: MapStore, originals: SdohMap[]): MapStore {
  const byId = new Map(originals.map((m) => [m.id, migrate(JSON.parse(JSON.stringify(m)))]));
  const refuse = (id: string) => {
    if (byId.has(id)) throw new ReadOnlyMapError(`Map ${id} is a read-only original; edits go to a copy.`);
  };
  return {
    kind: base.kind,
    async list() {
      const own = (await base.list()).filter((s) => !byId.has(s.id));
      return [...[...byId.values()].map((m) => ({ ...summarize(m), readOnly: true })), ...own].sort(byUpdated);
    },
    async load(id) {
      const o = byId.get(id);
      return o ? migrate(JSON.parse(JSON.stringify(o))) : base.load(id);
    },
    async save(map) {
      refuse(map.id);
      await base.save(map);
    },
    async remove(id) {
      refuse(id);
      await base.remove(id);
    },
    clearAll: () => base.clearAll(),
    readOnly: (id) => byId.has(id) || !!base.readOnly?.(id),
  };
}

let chosen: Promise<MapStore> | null = null;
/** The standalone app's store (slug sdoh-loops), opened once. */
export function getStore(): Promise<MapStore> {
  if (!chosen) chosen = browserStore();
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
