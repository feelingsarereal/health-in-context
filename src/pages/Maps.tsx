import { useEffect, useId, useRef, useState } from 'react';
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
  /** SL24: a file dragged over the page shows the drop zone */
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // SL24: the same import as the map's Map menu (importFile, unchanged): a new map on this device, opened on success
  const openFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      const m = await importFile(f, await getStore());
      open(m.id);
    } catch (err) {
      setMsg((err as Error).message);
    }
  };
  useEffect(() => {
    let depth = 0;
    const hasFile = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault(); // allow the drop
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      openFile(e.dataTransfer?.files?.[0]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-xl border-4 border-dashed border-[color:var(--bx-accent)] bg-[color:var(--bx-bg)]/90" data-testid="drop-zone" aria-hidden="true">
          <p className="font-display text-2xl font-semibold">{C.maps.dropHere}</p>
        </div>
      )}
      {/* SL24: two equal ways to start — a blank map, or a map file — side by side, stacked on narrow screens */}
      <section className="bx-card mb-6 p-4" aria-labelledby={`${id}-start`} data-testid="start-map">
        <h2 id={`${id}-start`} className="mb-3 text-xl font-semibold">{C.maps.start}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <form
            aria-labelledby={`${id}-new`}
            onSubmit={async (e) => {
              e.preventDefault();
              const m = newMap(name, subject);
              await (await getStore()).save(m);
              open(m.id);
            }}
          >
            <h3 id={`${id}-new`} className="mb-2 text-lg font-semibold">{C.maps.new}</h3>
            <Field label={C.maps.name} htmlFor={`${id}-name`}>
              <input id={`${id}-name`} className="bx-input ax-tap" value={name} onChange={(e) => setName(e.target.value)} data-testid="new-map-name" />
            </Field>
            <Field label={C.maps.subject} htmlFor={`${id}-subject`} nudgeId={`${id}-subject-n`}>
              <input id={`${id}-subject`} className="bx-input ax-tap" value={subject} onChange={(e) => setSubject(e.target.value)} aria-describedby={`${id}-subject-n`} data-testid="new-map-subject" />
            </Field>
            <button type="submit" className="bx-btn-primary ax-tap" data-testid="create-map">{C.maps.create}</button>
          </form>
          <div aria-labelledby={`${id}-open`} role="group" className="md:border-l md:border-[color:var(--bx-line)] md:pl-6">
            <h3 id={`${id}-open`} className="mb-2 text-lg font-semibold">{C.maps.openFile}</h3>
            <p id={`${id}-open-hint`} className="mb-3 text-sm bx-muted">{C.maps.openFileHint}</p>
            <button type="button" className="bx-btn-primary ax-tap" aria-describedby={`${id}-open-hint${msg ? ` ${id}-open-err` : ''}`} onClick={() => fileInput.current?.click()} data-testid="open-map-file">
              {C.maps.openFile}…
            </button>
            <input ref={fileInput} type="file" hidden accept=".json,.csv,application/json,text/csv" aria-label={C.maps.openFile} data-testid="open-map-input" onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }} />
            {msg && <p id={`${id}-open-err`} role="alert" className="mt-2 text-sm bx-todo" data-testid="open-map-error">{msg}</p>}
          </div>
        </div>
      </section>
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
      {!embedded && (
        <div className="mt-6">
          <ClearData />
        </div>
      )}
    </div>
  );
}
