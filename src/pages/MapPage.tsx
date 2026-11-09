import { useEffect, useState } from 'react';
import { useHref, useNavigate, useSearchParams } from 'react-router-dom';
import pin from '@feelingsarereal/sdoh-loops-pack/pin.json';
import { SdohMap, PANELS, getStore, pref, setPref, type MapStore, type MapView, type Panel } from '@feelingsarereal/sdoh-loops-core';
import Maps from './Maps';

/**
 * /map and /map/list: the standalone app's frame around <SdohMap> from sdoh-loops-core (K13). The URL carries only the
 * map id and the panel (?id=…&view=loops), never map text; the last map opened comes back when /map has no id.
 * SL26: the standalone app turns the case manager notebook on. SL28: `?passage=` (a span id, from a "Cited in your
 * notebook" link) opens the notebook at that passage.
 */
export default function MapPage({ view }: { view: MapView }) {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const idParam = sp.get('id');
  const [store, setStore] = useState<MapStore | null>(null);
  const [resolved, setResolved] = useState<string | null | undefined>(idParam ?? undefined);
  useEffect(() => {
    getStore().then(setStore);
  }, []);
  useEffect(() => {
    if (idParam) return setResolved(idParam);
    (async () => {
      const store = await getStore();
      const list = await store.list();
      const last = pref('last-map');
      const pick = list.find((m) => m.id === last) ?? list[0];
      if (pick) {
        const n = new URLSearchParams(sp);
        n.set('id', pick.id);
        setSp(n, { replace: true });
      } else setResolved(null);
    })();
  }, [idParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const listHref = useHref('/map/list');
  const canvasHref = useHref('/map');
  const panel = (PANELS as readonly string[]).includes(sp.get('view') ?? '') ? (sp.get('view') as Panel) : 'loops';
  const setPanel = (p: Panel) => {
    const n = new URLSearchParams(sp);
    if (p === 'loops') n.delete('view');
    else n.set('view', p);
    setSp(n, { replace: true });
  };

  const maps = <Maps embedded onOpen={(id) => nav(`/map?id=${id}`)} />;
  if (resolved === undefined || (resolved && !store)) return <p role="status" className="bx-muted">Loading the map…</p>;
  if (resolved === null) return <div className="mx-auto max-w-3xl">{maps}</div>;
  return (
    <SdohMap
      map={resolved}
      pack={pin}
      canvasHeight="viewport"
      storage={store!}
      view={view}
      onViewChange={(v) => nav(`${v === 'list' ? '/map/list' : '/map'}?id=${resolved}`)}
      viewHref={(v, id) => `${v === 'list' ? listHref : canvasHref}?id=${id}`}
      panel={panel}
      onPanelChange={setPanel}
      onLoad={(m) => m && setPref('last-map', m.id)}
      onOpenMap={(id) => nav(`/map?id=${id}`)}
      notebook
      passage={sp.get('passage') ?? undefined}
      missing={
        <div className="mx-auto max-w-3xl">
          <p className="bx-banner" role="alert">That map is not in this browser.</p>
          {maps}
        </div>
      }
    />
  );
}
