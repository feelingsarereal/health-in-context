/**
 * K13 consumer fixture: the smallest app that embeds sdoh-loops-core the way an SDOH Interrogator app will. It imports
 * only the published entry points (the core, its styles, the pack's pin), pins the pack, keeps maps under its own slug,
 * and opens a built map — the Collinson et al. 2024 worked example — as a read-only original.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import pin from '@feelingsarereal/sdoh-loops-pack/pin.json';
import { SdohMap, browserStore, importJSON, type MapStore, type SdohMapDoc } from '@feelingsarereal/sdoh-loops-core';
import '@feelingsarereal/sdoh-loops-core/styles.css';
import example from './collinson2024.sdohmap.json';

const original: SdohMapDoc = importJSON(JSON.stringify(example));

function Fixture() {
  const [store, setStore] = useState<MapStore | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [stored, setStored] = useState<string[]>([]);
  const log = (e: string) => setEvents((xs) => [...xs, e]);
  useEffect(() => {
    browserStore('sdoh-loops-consumer-fixture').then(setStore);
  }, []);
  const refresh = async () => store && setStored((await store.list()).map((m) => `${m.name} · ${m.edges} links`));
  useEffect(() => {
    refresh();
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!store) return <p role="status">Opening storage…</p>;
  return (
    <main className="p-3">
      <SdohMap
        map={original}
        pack={pin}
        storage={store}
        onLoad={(m) => log(`load:${m?.id ?? 'missing'}`)}
        onSelectionChange={(s) => log(`select:${s.nodes.length}:${s.edges.length}`)}
        onMapChange={(m, info) => {
          log(info.copiedFrom ? `copy:${m.id}:from:${info.copiedFrom}` : `change:${m.id}`);
          setTimeout(refresh, 50);
        }}
      />
      <section aria-label="Fixture state" className="mt-3 text-sm">
        <p>Original: <span data-testid="fixture-original">{original.id}</span></p>
        <ul data-testid="fixture-stored">{stored.map((s) => <li key={s}>{s}</li>)}</ul>
        <ol data-testid="fixture-events">{events.map((e, i) => <li key={i}>{e}</li>)}</ol>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
