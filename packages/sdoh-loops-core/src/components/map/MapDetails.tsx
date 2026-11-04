import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent as RKeyboardEvent, type RefObject } from 'react';
import { S, safety } from '../../lib/data/core';
import { codeMap } from '../../lib/data/scheme';
import { C } from '../../lib/copy';
import { Field } from '../ui/bits';
import { exportCSV, exportJSON, loopReportMD } from '../../lib/model/interchange';
import { NODE_TEXTS, withoutNotebook, type NodeText, type SdohMap } from '../../lib/model/map';
import { plainText } from '../../lib/model/rich';
import type { MapStore } from '../../lib/storage';
import { importFile } from '../../lib/model/importFile';
import RichField from './RichField';
import { RichView } from './RichView';
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
type Apply = (fn: (m: SdohMap) => SdohMap, key?: string) => void;

/**
 * SL23: the Whole map card's "About this map" tab — the map's name, subject (with the de-identification hint), notes
 * and its two display settings. Editable only in Edit mode; in Read mode they show as text.
 */
export function AboutMap({ map, apply, editing }: { map: SdohMap; apply: Apply; editing: boolean }) {
  const id = useId();
  const nodeText = map.layout.nodeText ?? 'title-code';
  if (!editing)
    return (
      <div data-testid="about-map" data-mode="read" className="text-sm">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1">
          <dt className="font-semibold">{C.maps.name}</dt>
          <dd data-testid="about-name">{map.name}</dd>
          <dt className="font-semibold">{C.maps.subject}</dt>
          <dd data-testid="about-subject">{map.subject || <span className="bx-muted">—</span>}</dd>
          <dt className="font-semibold">{C.node.notes}</dt>
          <dd>{plainText(map.notes) ? <RichView doc={map.notes} /> : <span className="bx-muted">—</span>}</dd>
          <dt className="font-semibold">{C.nodeText.label}</dt>
          <dd>{C.nodeText[nodeText]}</dd>
          <dt className="font-semibold">{C.read.thickness}</dt>
          <dd>{map.layout.thickness ? C.peek.yes : C.peek.no}</dd>
        </dl>
        <p className="mt-3 text-xs bx-muted">{S.privacy.saved_here}</p>
      </div>
    );
  return (
    <div data-testid="about-map" data-mode="edit">
      <Field label={C.maps.name} htmlFor={`${id}-name`}>
        <input id={`${id}-name`} className="bx-input ax-tap" value={map.name} onChange={(e) => apply((m) => ({ ...m, name: e.target.value }), 'map:name')} data-testid="map-name-input" />
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
      {/* SL17: how much text each box shows, saved with the map; the circumstance text is always in the peek */}
      <label className="mb-3 flex items-center gap-2 text-sm">
        <span className="font-semibold">{C.nodeText.label}</span>
        <select className="bx-input ax-tap w-auto" value={nodeText} onChange={(e) => apply((m) => ({ ...m, layout: { ...m.layout, nodeText: e.target.value as NodeText } }))} data-testid="node-text">
          {NODE_TEXTS.map((t) => <option key={t} value={t}>{C.nodeText[t]}{t === 'title-code' ? ' (default)' : ''}</option>)}
        </select>
      </label>
      <p className="mb-3 text-xs bx-muted">{S.privacy.saved_here}</p>
    </div>
  );
}

/** SL23: a host's own item in the Map menu (e.g. "Reset to the built map") */
export interface MapMenuItem {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
  /** SL26: true for an item that sends the map somewhere (e.g. "Open in SDOH Loops"): the core warns first while the notebook has possible identifiers */
  exports?: boolean;
}
export interface MapMenuHandle {
  /** ⌘O / Ctrl+O */
  openFile(): void;
  /** ⌘S / Ctrl+S: the map as a .json file */
  saveCopy(): void;
}
interface Item {
  id: string;
  label: string;
  description: string;
  testId?: string;
  shortcut?: string;
  checked?: boolean;
  /** SL26: the map to use — after "Label them all" in the export warning, the labelled one */
  run: (m: SdohMap) => void;
  /** SL26: true for an export that can carry the notebook's text: it goes through the identifier warning */
  guarded?: boolean;
}

/**
 * SL23: the toolbar's "Map" menu, beside the map's title (the ARIA menu-button pattern): open a map file (first),
 * save a copy, the exports, Print / grayscale, then the host's own items. Each item has a one-line description.
 */
export const MapMenu = forwardRef<MapMenuHandle, {
  map: SdohMap; apply: Apply; download: (name: string, data: string | Blob, type: string) => void; canvas: RefObject<CanvasHandle> | null; store: MapStore;
  onOpenMap?: (id: string) => void; announce: (s: string) => void; hostItems?: MapMenuItem[];
  /** SL26: runs an export, after the identifier warning when the notebook has flags; without it, at once */
  guard?: (run: (m: SdohMap) => void) => void;
  /** SL26: the notebook is on and has notes: "Save a copy" carries them, and "Save a copy without the notebook" is offered */
  notebook?: boolean;
}>(function MapMenu({ map, apply, download, canvas, store, onOpenMap, announce, hostItems, guard, notebook }, ref) {
  const id = useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const focusAt = useRef<'first' | 'last'>('first');
  const base = slug(map.name);
  const report = (map: SdohMap) =>
    loopReportMD(map, titleOf, { strengthLabel: S.loops.strength_label, reinforcing: S.loops.reinforcing, balancing: S.loops.balancing, truncated: S.loops.truncated, none: S.loops.none, notice: safety.notice, citation: S.codes.citation });
  const exportVia = (run: (m: SdohMap) => void) => (guard ? guard(run) : run(map));
  const saveJSON = (m: SdohMap) => {
    download(`${base}.sdohmap.json`, exportJSON(m, S.codes.citation), 'application/json');
    announce(C.mapMenu.saved);
  };
  const saveCopy = () => exportVia(saveJSON);
  const openFile = () => file.current?.click();
  useImperativeHandle(ref, () => ({ openFile, saveCopy }));
  const print = map.layout.theme === 'print';
  const items: Item[] = [
    { id: 'open', label: `${C.maps.openFile}…`, description: C.maps.openFileHint, testId: 'menu-open', shortcut: 'Meta+O Control+O', run: openFile },
    { id: 'save', label: C.mapMenu.save, description: notebook ? C.notebook.saveDesc : C.mapMenu.saveDesc, testId: 'export-json', shortcut: 'Meta+S Control+S', run: saveJSON, guarded: true },
    // SL26: the map alone (schema 2), so the notes stay on this device; nothing of the notebook to warn about
    ...(notebook ? [{ id: 'save-bare', label: C.notebook.saveBare, description: C.notebook.saveBareDesc, testId: 'export-json-bare', run: (m: SdohMap) => {
      download(`${base}.sdohmap.json`, exportJSON(withoutNotebook(m), S.codes.citation), 'application/json');
      announce(C.mapMenu.saved);
    } }] : []),
    { id: 'csv', label: C.mapMenu.csv, description: C.mapMenu.csvDesc, testId: 'export-csv', run: (m) => download(`${base}-edges.csv`, exportCSV(m, titleOf, S.codes.citation), 'text/csv'), guarded: true },
    { id: 'md', label: C.mapMenu.md, description: C.mapMenu.mdDesc, testId: 'export-md', run: (m) => download(`${base}-loops.md`, report(m), 'text/markdown'), guarded: true },
    ...(canvas
      ? [
          { id: 'png', label: C.mapMenu.png, description: C.mapMenu.pngDesc, testId: 'export-png', run: () => download(`${base}.png`, dataUrlToBlob(canvas.current!.png()), 'image/png'), guarded: true },
          { id: 'svg', label: C.mapMenu.svg, description: C.mapMenu.svgDesc, testId: 'export-svg', run: () => download(`${base}.svg`, canvas.current!.svg(), 'image/svg+xml'), guarded: true },
        ]
      : []),
    { id: 'print', label: C.toolbar.print, description: C.mapMenu.printDesc, testId: 'menu-print', checked: print, run: () => apply((m) => ({ ...m, layout: { ...m.layout, theme: m.layout.theme === 'print' ? 'auto' : 'print' } })) },
    ...(hostItems ?? []).map((h) => ({ id: `host-${h.id}`, label: h.label, description: h.description ?? '', testId: `menu-host-${h.id}`, run: () => h.onSelect(), guarded: !!h.exports })),
  ];
  const all = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  useEffect(() => {
    if (!open) return;
    const els = all();
    (focusAt.current === 'last' ? els[els.length - 1] : els[0])?.focus();
    focusAt.current = 'first';
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };
  const onBtnKey = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  };
  const onMenuKey = (e: RKeyboardEvent) => {
    const els = all();
    const i = els.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => els[(j + els.length) % els.length]?.focus();
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(els.length - 1);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') return setOpen(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btn}
        type="button"
        className={`bx-btn ax-tap ${open ? 'bx-btn-on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onBtnKey}
        data-testid="map-menu"
      >
        {C.mapMenu.button} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-label={C.mapMenu.label}
          className="bx-card absolute left-0 top-full z-40 mt-1 w-[min(22rem,calc(100vw-2rem))] p-1 shadow-lg bg-[color:var(--bx-bg)] dark:bg-night-2"
          onKeyDown={onMenuKey}
          data-testid="map-menu-list"
        >
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={it.checked}
              aria-describedby={it.description ? `${id}-${it.id}-d` : undefined}
              aria-keyshortcuts={it.shortcut}
              tabIndex={-1}
              className="ax-tap flex w-full flex-col items-start rounded px-3 py-1.5 text-left hover:bg-paper-2 focus:bg-paper-2 dark:hover:bg-night dark:focus:bg-night"
              onClick={() => {
                close(it.id !== 'open');
                if (it.guarded) exportVia(it.run);
                else it.run(map);
              }}
              data-testid={it.testId}
            >
              <span className="text-sm font-semibold">
                {it.checked !== undefined && <span aria-hidden="true">{it.checked ? '☑ ' : '☐ '}</span>}
                {it.label}
                {it.id === 'open' && <span className="ml-2 bx-kbd" aria-hidden="true">⌘O</span>}
                {it.id === 'save' && <span className="ml-2 bx-kbd" aria-hidden="true">⌘S</span>}
              </span>
              {it.description && <span id={`${id}-${it.id}-d`} className="text-xs bx-muted">{it.description}</span>}
            </button>
          ))}
        </div>
      )}
      <input
        ref={file}
        type="file"
        hidden
        accept=".json,.csv,application/json,text/csv"
        aria-label={C.maps.openFile}
        data-testid="import-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const m = await importFile(f, store);
            setMsg(C.exportI.imported);
            announce(C.exportI.imported);
            onOpenMap?.(m.id);
          } catch (err) {
            setMsg((err as Error).message);
          }
          e.target.value = '';
        }}
      />
      {msg && <span role="status" className="ml-2 text-sm" data-testid="import-msg">{msg}</span>}
    </span>
  );
});
