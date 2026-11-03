/** K13: read-only originals over a store, and the pack pin. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createStore } from 'idb-keyval';
import { idbStore, localStore, withOriginals, ReadOnlyMapError } from './index';
import { newMap } from '../model/map';
import { loadedPack, pinMismatch } from '../data/pack';

describe('withOriginals', () => {
  const original = { ...newMap('Built map', 'X.'), id: 'map-built' };
  it('lists and loads an original, flagged read-only, without writing it to the store', async () => {
    const base = idbStore(createStore('k13-a', 'maps'));
    const s = withOriginals(base, [original]);
    expect((await s.list()).map((m) => [m.id, m.readOnly])).toEqual([['map-built', true]]);
    expect((await s.load('map-built'))?.name).toBe('Built map');
    expect(s.readOnly?.('map-built')).toBe(true);
    expect(await base.list()).toEqual([]);
  });
  it('refuses to save or remove an original; other maps pass through to the store', async () => {
    const base = idbStore(createStore('k13-b', 'maps'));
    const s = withOriginals(base, [original]);
    await expect(s.save({ ...original, name: 'changed' })).rejects.toBeInstanceOf(ReadOnlyMapError);
    await expect(s.remove('map-built')).rejects.toBeInstanceOf(ReadOnlyMapError);
    const copy = { ...original, id: 'map-copy', name: 'Built map (copy)' };
    await s.save(copy);
    expect((await base.load('map-copy'))?.name).toBe('Built map (copy)');
    expect((await s.list()).map((m) => m.id).sort()).toEqual(['map-built', 'map-copy']);
    expect(s.readOnly?.('map-copy')).toBe(false);
  });
  it('hands out a fresh object each load, so editing it cannot reach the original', async () => {
    const s = withOriginals(idbStore(createStore('k13-c', 'maps')), [original]);
    const a = (await s.load('map-built'))!;
    a.name = 'mutated';
    expect((await s.load('map-built'))!.name).toBe('Built map');
  });
  it('a store slug keeps an embedding app apart from the standalone app', async () => {
    const mem = new Map<string, string>();
    const ls = { get length() { return mem.size; }, key: (i: number) => [...mem.keys()][i] ?? null, getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() } as Storage;
    await localStore(ls, 'sdoh-interrogator').save(original);
    expect(await localStore(ls).list()).toEqual([]);
    expect([...mem.keys()]).toEqual(['sdoh-interrogator:map:map-built']);
  });
});

describe('pack pin', () => {
  it('accepts the pin of the pack that is loaded, and names the difference otherwise', () => {
    expect(pinMismatch({ ...loadedPack })).toBeNull();
    expect(pinMismatch(null)).toMatch(/No content pack/);
    expect(pinMismatch({ ...loadedPack, version: '9.9.9' })).toMatch(/Pinned sdoh-loops 9\.9\.9/);
    expect(pinMismatch({ ...loadedPack, sha256: '0'.repeat(64) })).toMatch(/is loaded/);
  });
});
