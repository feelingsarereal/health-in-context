import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { S, C, getStore, type MapSummary, newMap, newId, Field, PageHead, Dialog, importFile, count } from '@feelingsarereal/sdoh-loops-core';
import { ClearData } from '@/components/ui/ClearData';

/** The workspace index (/maps): several named maps per device; duplicate, rename, delete (ACTION-SPEC §4). */
export default function Maps({ embedded, onOpen }: { embedded?: boolean; onOpen?: (id: string) => void }) {
  const nav = useNavigate();
  const open = (id: string) => (onOpen ? onOpen(id) : nav(`/map?id=${id}`));
  const [list, setList] = useState<MapSummary[] | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  /** K6 D9: the map awaiting a delete confirmation, in the app's own dialog (as Clear my data does) */
  const [deleting, setDeleting] = useState<MapSummary | null>(null);
  const id = useId();
  const refresh = async () => setList(await (await getStore()).list());
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div>
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={deleting ? `${C.maps.delete}: ${deleting.name}` : ''} testId="delete-map-dialog">
        <p className="mb-4">{C.maps.deleteConfirm}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="bx-btn-primary ax-tap"
            data-testid="delete-map-confirm"
            onClick={async () => {
              const m = deleting;
              setDeleting(null);
              if (!m) return;
              await (await getStore()).remove(m.id);
              refresh();
            }}
          >
            {C.maps.delete}
          </button>
          <button type="button" className="bx-btn ax-tap" onClick={() => setDeleting(null)}>
            Cancel
          </button>
        </div>
      </Dialog>
      <PageHead title={C.maps.title} lead={`${C.maps.lead} ${S.privacy.saved_here}`} />
      <form
        className="bx-card mb-6 p-4"
        aria-labelledby={`${id}-new`}
        onSubmit={async (e) => {
          e.preventDefault();
          const m = newMap(name, subject);
          await (await getStore()).save(m);
          open(m.id);
        }}
      >
        <h2 id={`${id}-new`} className="mb-2 text-xl font-semibold">{C.maps.new}</h2>
        <Field label={C.maps.name} htmlFor={`${id}-name`}>
          <input id={`${id}-name`} className="bx-input ax-tap" value={name} onChange={(e) => setName(e.target.value)} data-testid="new-map-name" />
        </Field>
        <Field label={C.maps.subject} htmlFor={`${id}-subject`} nudgeId={`${id}-subject-n`}>
          <input id={`${id}-subject`} className="bx-input ax-tap" value={subject} onChange={(e) => setSubject(e.target.value)} aria-describedby={`${id}-subject-n`} data-testid="new-map-subject" />
        </Field>
        <button type="submit" className="bx-btn-primary ax-tap" data-testid="create-map">{C.maps.create}</button>
      </form>
      <h2 className="text-2xl">Saved maps</h2>
      {list === null ? <p role="status" className="bx-muted">Loading…</p> : !list.length ? <p className="mt-2 bx-muted" data-testid="no-maps">{C.maps.empty}</p> : (
        <ul className="mt-2 space-y-2" data-testid="map-list">
          {list.map((m) => (
            <li key={m.id} className="bx-card flex flex-wrap items-center gap-2 p-3" data-testid="map-row">
              {renaming === m.id ? (
                <form
                  className="flex flex-1 flex-wrap gap-1"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const s = await getStore();
                    const full = await s.load(m.id);
                    if (full) await s.save({ ...full, name: draft.trim() || full.name, updated: new Date().toISOString() });
                    setRenaming(null);
                    refresh();
                  }}
                >
                  <label className="sr-only" htmlFor={`${id}-r-${m.id}`}>{C.maps.name}</label>
                  <input id={`${id}-r-${m.id}`} className="bx-input w-48" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  <button type="submit" className="bx-btn ax-tap">Save</button>
                </form>
              ) : (
                <div className="min-w-0 flex-1">
                  <Link to={`/map?id=${m.id}`} className="font-semibold underline" onClick={(e) => { if (onOpen) { e.preventDefault(); open(m.id); } }}>{m.name}</Link>
                  <p className="text-xs bx-muted">{count(m.nodes, 'circumstance')} · {count(m.edges, 'link')} · saved {new Date(m.updated).toLocaleString()}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                <button type="button" className="bx-btn ax-tap" onClick={() => { setRenaming(m.id); setDraft(m.name); }} aria-label={`${C.maps.rename} ${m.name}`}>{C.maps.rename}</button>
                <button
                  type="button"
                  className="bx-btn ax-tap"
                  aria-label={`${C.maps.duplicate} ${m.name}`}
                  onClick={async () => {
                    const s = await getStore();
                    const full = await s.load(m.id);
                    if (full) await s.save({ ...full, id: newId('map'), name: `${full.name} (copy)`, created: new Date().toISOString(), updated: new Date().toISOString() });
                    refresh();
                  }}
                >
                  {C.maps.duplicate}
                </button>
                <button
                  type="button"
                  className="bx-btn ax-tap"
                  aria-label={`${C.maps.delete} ${m.name}`}
                  onClick={() => setDeleting(m)}
                  data-testid="delete-map"
                >
                  {C.maps.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 bx-card p-4">
        <label className="block text-sm font-semibold" htmlFor={`${id}-imp`}>{C.maps.import}</label>
        <input
          id={`${id}-imp`}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="mt-1 block w-full text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const m = await importFile(f, await getStore());
              open(m.id);
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        />
        {msg && <p role="alert" className="mt-2 text-sm">{msg}</p>}
      </div>
      {!embedded && (
        <div className="mt-6">
          <ClearData />
        </div>
      )}
    </div>
  );
}
