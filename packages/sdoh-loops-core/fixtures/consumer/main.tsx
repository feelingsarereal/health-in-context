/**
 * K13 consumer fixture: the smallest app that embeds sdoh-loops-core the way an SDOH Interrogator app will. It imports
 * only the published entry points (the core, its styles, the pack's pin), pins the pack, keeps maps under its own slug,
 * and opens a built map — the Collinson et al. 2024 worked example — as a read-only original. Since 0.2.0 it also
 * drives the selection from outside (SL16), hides circumstances by a predicate (SL16), and adds a side card and peek
 * lines of its own (SL17), the way an SDOH Interrogator app's reader and circumstance card will.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import pin from '@feelingsarereal/sdoh-loops-pack/pin.json';
import { SdohMap, browserStore, importJSON, type MapStore, type SdohMapDoc, type Selection } from '@feelingsarereal/sdoh-loops-core';
import '@feelingsarereal/sdoh-loops-core/styles.css';
import example from './collinson2024.sdohmap.json';

const original: SdohMapDoc = importJSON(JSON.stringify(example));

function Fixture() {
  const [store, setStore] = useState<MapStore | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [stored, setStored] = useState<string[]>([]);
  const [selection, setSelection] = useState<Selection>({ nodes: [], edges: [] });
  const [hideOther, setHideOther] = useState(false);
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
        selection={selection}
        onSelectionChange={(s) => {
          log(`select:${s.nodes.length}:${s.edges.length}`);
          setSelection(s);
        }}
        hideNode={hideOther ? (n) => n.code_status === 'other' : undefined}
        sideCards={[{ id: 'source', title: 'In the source', render: (s) => <p data-testid="fixture-card">Selected here: {s.nodes.join(', ') || s.edges.join(', ') || 'nothing'}</p> }]}
        renderPeek={(t) => <p data-testid="fixture-peek">From the host: {t.kind === 'node' ? t.node.id : t.edge.id}</p>}
        onMapChange={(m, info) => {
          log(info.copiedFrom ? `copy:${m.id}:from:${info.copiedFrom}` : `change:${m.id}`);
          setTimeout(refresh, 50);
        }}
      />
      <section aria-label="Fixture state" className="mt-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="bx-btn" onClick={() => setSelection({ nodes: ['n6-credit'], edges: [] })} data-testid="fixture-select">Select “Debt up” from the host</button>
          <button type="button" className="bx-btn" aria-pressed={hideOther} onClick={() => setHideOther((h) => !h)} data-testid="fixture-hide">Hide the circumstances without an SDOH code</button>
        </div>
        <p>Host selection: <span data-testid="fixture-selection">{selection.nodes.join(',')}|{selection.edges.join(',')}</span></p>
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
