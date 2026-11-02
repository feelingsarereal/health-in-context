import { useId, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { S, safety } from '@/lib/data/core';
import { codeMap } from '@/lib/data/scheme';
import { C } from '@/lib/copy';
import { Field } from '@/components/ui/bits';
import { exportCSV, exportJSON, loopReportMD } from '@/lib/model/interchange';
import type { SdohMap } from '@/lib/model/map';
import { importFile } from '@/lib/model/importFile';
import RichField from './RichField';
import type { CanvasHandle } from './Canvas';

const titleOf = (c: string) => codeMap.get(c)?.title;
/** data: URL → Blob without fetch(), so exporting a picture makes no request of any kind. */
function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream' });
}
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'map';

export function MapDetails({ map, apply, download, canvas }: { map: SdohMap; apply: (fn: (m: SdohMap) => SdohMap, key?: string) => void; download: (name: string, data: string | Blob, type: string) => void; canvas: RefObject<CanvasHandle> | null }) {
  const id = useId();
  const nav = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const base = slug(map.name);
  const report = () =>
    loopReportMD(map, titleOf, { strengthLabel: S.loops.strength_label, reinforcing: S.loops.reinforcing, balancing: S.loops.balancing, truncated: S.loops.truncated, none: S.loops.none, notice: safety.notice });
  return (
    <div data-testid="map-panel">
      <Field label={C.maps.name} htmlFor={`${id}-name`}>
        <input id={`${id}-name`} className="bx-input ax-tap" value={map.name} onChange={(e) => apply((m) => ({ ...m, name: e.target.value }), 'map:name')} />
      </Field>
      <Field label={C.maps.subject} htmlFor={`${id}-subj`} nudgeId={`${id}-subj-n`}>
        <input id={`${id}-subj`} className="bx-input ax-tap" value={map.subject} aria-describedby={`${id}-subj-n`} onChange={(e) => apply((m) => ({ ...m, subject: e.target.value }), 'map:subject')} data-testid="map-subject" />
      </Field>
      <Field label={C.node.notes} htmlFor={`${id}-notes`} nudgeId={`${id}-notes-n`}>
        <RichField id={`${id}-notes`} label="Map notes" value={map.notes} onChange={(d) => apply((m) => ({ ...m, notes: d }), 'map:notes')} describedBy={`${id}-notes-n`} />
      </Field>
      <label className="mb-3 inline-flex items-center gap-2 text-sm ax-tap">
        <input type="checkbox" checked={map.layout.thickness} onChange={(e) => apply((m) => ({ ...m, layout: { ...m.layout, thickness: e.target.checked } }))} aria-labelledby={`${id}-thick`} /> <span id={`${id}-thick`}>{C.edge.thickness}</span>
      </label>
      <p className="mb-3 text-xs bx-muted">{S.privacy.saved_here}</p>

      <h3 className="font-semibold">{C.exportI.title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className="bx-btn ax-tap" data-testid="export-json" onClick={() => download(`${base}.sdohmap.json`, exportJSON(map), 'application/json')}>{C.exportI.json}</button>
        <button type="button" className="bx-btn ax-tap" data-testid="export-csv" onClick={() => download(`${base}-edges.csv`, exportCSV(map, titleOf), 'text/csv')}>{C.exportI.csv}</button>
        <button type="button" className="bx-btn ax-tap" data-testid="export-md" onClick={() => download(`${base}-loops.md`, report(), 'text/markdown')}>{C.exportI.md}</button>
        {canvas && (
          <>
            <button type="button" className="bx-btn ax-tap" data-testid="export-png" onClick={() => download(`${base}.png`, dataUrlToBlob(canvas.current!.png()), 'image/png')}>{C.exportI.png}</button>
            <button type="button" className="bx-btn ax-tap" data-testid="export-svg" onClick={() => download(`${base}.svg`, canvas.current!.svg(), 'image/svg+xml')}>{C.exportI.svg}</button>
          </>
        )}
      </div>

      <h3 className="mt-4 font-semibold">{C.exportI.importTitle}</h3>
      <label className="mt-1 block text-sm" htmlFor={`${id}-imp`}>{C.maps.import}</label>
      <input
        id={`${id}-imp`}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="mt-1 block w-full text-sm"
        data-testid="import-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const m = await importFile(f);
            setMsg(C.exportI.imported);
            nav(`/map?id=${m.id}`);
          } catch (err) {
            setMsg((err as Error).message);
          }
          e.target.value = '';
        }}
      />
      {msg && <p role="status" className="mt-2 text-sm" data-testid="import-msg">{msg}</p>}
    </div>
  );
}
