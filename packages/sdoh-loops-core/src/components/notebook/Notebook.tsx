import { type ReactNode, useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as RKeyboardEvent } from 'react';
import { C } from '../../lib/copy';
import { count } from '../../lib/plural';
import type { SdohMap } from '../../lib/model/map';
import {
  addNote, allTags, deleteNote, dismissFlag, duplicateNote, isDismissed, labelAll, labelFlag, moveNote, newFreeNote, newStructuredNote, parseTags, searchNotes, updateField, updateNote, DATE_FIELD,
  type Flag, type Note, type NoteDoc, type Notebook as NotebookDoc, type NoteTemplate,
} from '../../lib/model/notebook';
import type { RichDoc } from '../../lib/model/rich';
import RichField, { type RichFieldFlags } from '../map/RichField';

type Apply = (fn: (m: SdohMap) => SdohMap, key?: string) => void;
type NB = (nb: NotebookDoc | undefined) => NotebookDoc;

export interface NotebookProps {
  map: SdohMap;
  apply: Apply;
  /** apply a change to the open map and to every undo step, outside the history (a label replacing a value) */
  scrub: (fn: (m: SdohMap) => SdohMap) => void;
  flags: Flag[];
  templates: NoteTemplate[];
  announce: (s: string) => void;
  /** Print, after the export warning when flags remain */
  onPrint: () => void;
  /** SL26 point 5: the case summary, always last, below every note */
  summary?: ReactNode;
}

interface Toast {
  text: string;
  undo?: () => void;
}

/**
 * SL26: the case manager notebook beside the map (S7.1 slice 1) — free and structured notes, search and tags,
 * reorder by drag or Alt+↑ / Alt+↓, duplicate and delete with an undo toast, and the identifier check's count, list
 * and one-click labels. Every edit goes through the map's own apply(), so it autosaves and Undo / Redo cover it.
 */
export function Notebook({ map, apply, scrub, flags, templates, announce, onPrint, summary }: NotebookProps) {
  const uid = useId().replace(/:/g, '');
  const nb = map.notebook;
  const notes = nb?.notes ?? [];
  const [sel, setSel] = useState<string | null>(notes[0]?.id ?? null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastT = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);
  const focusNote = useRef<string | null>(null);
  const dragId = useRef<string | null>(null);
  const flagsList = useRef<HTMLDivElement>(null);

  const note = notes.find((n) => n.id === sel) ?? null;
  useEffect(() => {
    if (!note && notes.length && sel === null) setSel(notes[0].id);
  }, [note, notes, sel]);
  useEffect(() => () => clearTimeout(toastT.current), []);
  useEffect(() => {
    const id = focusNote.current;
    focusNote.current = null;
    if (id) listRef.current?.querySelector<HTMLElement>(`[data-note-id="${id}"] [data-note-button]`)?.focus();
  });

  const change = (fn: NB, key?: string) => apply((m) => ({ ...m, notebook: fn(m.notebook), updated: new Date().toISOString() }), key);
  const show = (t: Toast) => {
    clearTimeout(toastT.current);
    setToast(t);
    toastT.current = window.setTimeout(() => setToast(null), 10_000);
  };
  const shown = useMemo(() => (nb ? searchNotes(nb, q, tag) : []), [nb, q, tag]);
  const tags = useMemo(() => allTags(nb), [nb]);
  const flagsByNote = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flags) m.set(f.note, (m.get(f.note) ?? 0) + 1);
    return m;
  }, [flags]);
  // the flag list groups occurrences of one value, since a label replaces all of them
  const groups = useMemo(() => {
    const g = new Map<string, { flag: Flag; n: number }>();
    for (const f of flags) {
      const k = `${f.category}:${f.value}`;
      const x = g.get(k);
      if (x) x.n++;
      else g.set(k, { flag: f, n: 1 });
    }
    return [...g.values()];
  }, [flags]);

  const create = (n: Note) => {
    change((b) => addNote(b, n));
    setSel(n.id);
    setQ('');
    setTag(null);
    announce(`${C.notebook.newFree}: ${n.title}.`);
    setTimeout(() => (document.getElementById(`${uid}-title`) as HTMLInputElement | null)?.select(), 30);
  };
  const remove = (n: Note) => {
    const at = notes.findIndex((x) => x.id === n.id);
    change((b) => deleteNote(b, n.id));
    const next = notes[at + 1] ?? notes[at - 1] ?? null;
    setSel(next?.id ?? null);
    show({
      text: `${C.notebook.deleted} “${n.title}”.`,
      undo: () => {
        change((b) => addNote(b, n, at));
        setSel(n.id);
        setToast(null);
        announce(`${C.notebook.undo}: “${n.title}”.`);
      },
    });
    announce(`${C.notebook.deleted} “${n.title}”.`);
  };
  const move = (n: Note, to: number) => {
    if (to < 0 || to >= notes.length) return;
    change((b) => moveNote(b, n.id, to));
    focusNote.current = n.id;
    announce(`${C.notebook.moved} ${to + 1} of ${notes.length}: “${n.title}”.`);
  };
  const label = (f: Flag) => {
    const { label: l } = labelFlag(map.notebook, f);
    scrub((m) => ({ ...m, notebook: labelFlag(m.notebook, f).notebook, updated: new Date().toISOString() }));
    const msg = `${C.notebook.replaced} ${l}. ${C.notebook.replacedNote}`;
    show({ text: msg });
    announce(msg);
  };
  const dismiss = (f: Flag) => {
    change((b) => dismissFlag(b, f.category, f.value));
    show({ text: C.notebook.dismissedMsg });
    announce(C.notebook.dismissedMsg);
  };
  const labelEvery = () => {
    scrub((m) => ({ ...m, notebook: labelAll(m.notebook), updated: new Date().toISOString() }));
    const msg = `${C.notebook.replaced} labels. ${C.notebook.replacedNote}`;
    show({ text: msg });
    announce(msg);
  };

  // the editors read the dismissed list through a ref; `version` redraws their underlines when it changes
  const nbRef = useRef(nb);
  nbRef.current = nb;
  const dismissedKey = (nb?.dismissed ?? []).join('\n');
  const flagsProp = useMemo<RichFieldFlags>(
    () => ({
      isDismissed: (c, v) => isDismissed(nbRef.current, c, v),
      tip: C.notebook.flagTip,
      version: dismissedKey,
      onFlag: () => {
        setFlagsOpen(true);
        setTimeout(() => flagsList.current?.querySelector<HTMLElement>('button')?.focus(), 30);
      },
    }),
    [dismissedKey],
  );

  const onItemKey = (e: RKeyboardEvent, n: Note, i: number) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(n, i + (e.key === 'ArrowUp' ? -1 : 1));
    } else if (!e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const els = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-note-button]') ?? []);
      els[els.indexOf(e.currentTarget as HTMLElement) + (e.key === 'ArrowUp' ? -1 : 1)]?.focus();
    }
  };
  const onDrop = (e: DragEvent, i: number) => {
    e.preventDefault();
    const id = dragId.current;
    dragId.current = null;
    const n = notes.find((x) => x.id === id);
    if (n) move(n, i);
  };

  const n = flags.length;
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-labelledby={`${uid}-h`} data-notebook data-testid="notebook">
      <div className="border-b border-[color:var(--bx-line)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={`${uid}-h`} className="m-0 font-display text-lg font-semibold">{C.notebook.title}</h2>
          <span className="text-xs bx-muted">{C.notebook.check}:</span>
          {n ? (
            <button type="button" className={`bx-btn ax-tap px-2 text-sm ${flagsOpen ? 'bx-btn-on' : ''}`} aria-expanded={flagsOpen} aria-controls={`${uid}-flags`} onClick={() => setFlagsOpen((o) => !o)} data-testid="nb-flag-count">
              <span aria-hidden="true" className="mr-1">⚠</span>
              {count(n, C.notebook.identifier)}
            </button>
          ) : (
            <span className="text-sm bx-muted" data-testid="nb-flag-count">{C.notebook.none}</span>
          )}
          <button type="button" className="bx-btn ax-tap ml-auto" title={C.notebook.printTip} onClick={onPrint} data-testid="nb-print" data-print-hide>{C.notebook.print}</button>
        </div>
        <p className="mt-1 text-xs bx-muted" data-print-hide>{C.notebook.lead}</p>
        {flagsOpen && n > 0 && (
          <div id={`${uid}-flags`} ref={flagsList} className="mt-2 rounded border border-[color:var(--bx-line)] p-2" role="region" aria-label={C.notebook.flagsTitle} data-testid="nb-flags" data-print-hide>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm font-semibold">{C.notebook.flagsTitle}</h3>
              <button type="button" className="bx-btn ax-tap ml-auto px-2 text-sm" onClick={labelEvery} data-testid="nb-label-all">{C.notebook.labelAll}</button>
            </div>
            <p className="mt-1 text-xs bx-muted" data-testid="nb-heuristic">{C.notebook.heuristic}</p>
            <ul className="mt-2 space-y-2">
              {groups.map(({ flag: f, n: k }) => (
                <li key={`${f.category}:${f.value}`} className="text-sm" data-testid="nb-flag" data-category={f.category}>
                  <p className="m-0">
                    <span className="font-semibold">{C.notebook.categories[f.category]}</span>: <mark className="nb-flag">{f.value}</mark>
                    {k > 1 && <span className="bx-muted"> · {count(k, C.notebook.places)}</span>}
                  </p>
                  <p className="m-0 text-xs bx-muted">{f.context}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button type="button" className="bx-btn ax-tap px-2 text-sm" onClick={() => label(f)} data-testid="nb-flag-label">{C.notebook.label}</button>
                    <button type="button" className="bx-btn ax-tap px-2 text-sm" onClick={() => dismiss(f)} data-testid="nb-flag-dismiss">{C.notebook.dismiss}</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2" data-print-hide>
          <button type="button" className="bx-btn-primary ax-tap" onClick={() => create(newFreeNote(C.notebook.untitled))} data-testid="nb-new">{C.notebook.newFree}</button>
          <select
            className="bx-input ax-tap w-auto"
            aria-label={C.notebook.newFromTemplate}
            value=""
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) create(newStructuredNote(t));
            }}
            data-testid="nb-template"
          >
            <option value="" disabled>{C.notebook.newFromTemplate}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {notes.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2" data-print-hide>
            <input type="search" className="bx-input ax-tap min-w-0 flex-1" placeholder={C.notebook.search} aria-label={C.notebook.search} value={q} onChange={(e) => setQ(e.target.value)} data-testid="nb-search" />
            {tags.length > 0 && (
              <select className="bx-input ax-tap w-auto" aria-label={C.notebook.tagFilter} value={tag ?? ''} onChange={(e) => setTag(e.target.value || null)} data-testid="nb-tag-filter">
                <option value="">{C.notebook.allTags}</option>
                {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="nb-scroll">
        {notes.length === 0 ? (
          <p className="p-3 text-sm bx-muted" data-testid="nb-empty">{C.notebook.empty}</p>
        ) : (
          <>
            <nav aria-label={C.notebook.notes} className="border-b border-[color:var(--bx-line)] p-2" data-print-hide>
              <p id={`${uid}-hint`} className="sr-only">{C.notebook.reorderHint}</p>
              {shown.length === 0 && <p className="p-1 text-sm bx-muted">{C.notebook.noMatch}</p>}
              <ul ref={listRef} className="max-h-48 space-y-0.5 overflow-y-auto overscroll-contain" data-testid="nb-list">
                {shown.map((x) => {
                  const i = notes.indexOf(x);
                  const k = flagsByNote.get(x.id) ?? 0;
                  return (
                    <li
                      key={x.id}
                      data-note-id={x.id}
                      data-testid="nb-note"
                      draggable
                      onDragStart={(e) => {
                        dragId.current = x.id;
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDrop(e, i)}
                    >
                      <button
                        type="button"
                        data-note-button
                        className={`ax-tap flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-paper-2 dark:hover:bg-night ${x.id === sel ? 'bg-paper-2 font-semibold dark:bg-night' : ''}`}
                        aria-current={x.id === sel ? 'true' : undefined}
                        aria-describedby={`${uid}-hint`}
                        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                        onClick={() => setSel(x.id)}
                        onKeyDown={(e) => onItemKey(e, x, i)}
                      >
                        <span aria-hidden="true" className="cursor-grab bx-muted">⋮⋮</span>
                        <span className="min-w-0 flex-1 truncate">{x.title || C.notebook.untitled}</span>
                        <span className="text-xs bx-muted">{x.kind === 'structured' ? templates.find((t) => t.id === x.template)?.name ?? C.notebook.structured : C.notebook.free}</span>
                        {k > 0 && <span className="bx-chip px-1.5 text-xs" aria-label={count(k, C.notebook.identifier)}>⚠ {k}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {note ? (
              <NoteEditor key={note.id} uid={uid} note={note} index={notes.indexOf(note)} total={notes.length} templates={templates} flags={flagsProp} change={change} onMove={(to) => move(note, to)} onDuplicate={() => {
                const d = duplicateNote(map.notebook, note.id, C.notebook.copy);
                if (!d.note) return;
                change(() => d.notebook);
                setSel(d.note.id);
                announce(`${C.notebook.duplicate}: “${d.note.title}”.`);
              }} onDelete={() => remove(note)} />
            ) : (
              <p className="p-3 text-sm bx-muted">{C.notebook.selectOne}</p>
            )}
          </>
        )}
        {summary}
      </div>
      {toast && (
        <div className="flex items-center gap-2 border-t border-[color:var(--bx-line)] bg-paper-2 px-3 py-2 text-sm dark:bg-night" role="status" data-testid="nb-toast" data-print-hide>
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.undo && <button type="button" className="bx-btn ax-tap px-2" onClick={toast.undo} data-testid="nb-toast-undo">{C.notebook.undo}</button>}
          <button type="button" className="bx-btn ax-tap px-2" aria-label={C.notebook.dismissToast} onClick={() => setToast(null)}>✕</button>
        </div>
      )}
    </section>
  );
}

function NoteEditor({ uid, note, index, total, templates, flags, change, onMove, onDuplicate, onDelete }: {
  uid: string; note: Note; index: number; total: number; templates: NoteTemplate[]; flags: RichFieldFlags;
  change: (fn: NB, key?: string) => void; onMove: (to: number) => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [tagDraft, setTagDraft] = useState(note.tags.join(', '));
  useEffect(() => setTagDraft(note.tags.join(', ')), [note.tags.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  const commitTags = () => {
    const t = parseTags(tagDraft);
    if (t.join('\n') !== note.tags.join('\n')) change((b) => updateNote(b, note.id, { tags: t }));
    setTagDraft(t.join(', '));
  };
  const tpl = templates.find((t) => t.id === note.template);
  return (
    <article className="p-3" aria-labelledby={`${uid}-title-l`} data-testid="nb-editor" data-note-id={note.id}>
      <label id={`${uid}-title-l`} htmlFor={`${uid}-title`} className="mb-1 block text-sm font-semibold">{C.notebook.noteTitle}</label>
      <input id={`${uid}-title`} className="bx-input ax-tap w-full font-semibold" value={note.title} onChange={(e) => change((b) => updateNote(b, note.id, { title: e.target.value }), `nb:${note.id}:title`)} data-testid="nb-title" />
      <div className="mt-2 flex flex-wrap gap-1.5" data-print-hide>
        <button type="button" className="bx-btn ax-tap px-2 text-sm" onClick={() => onMove(index - 1)} disabled={index === 0} data-testid="nb-move-up">{C.notebook.moveUp}</button>
        <button type="button" className="bx-btn ax-tap px-2 text-sm" onClick={() => onMove(index + 1)} disabled={index >= total - 1} data-testid="nb-move-down">{C.notebook.moveDown}</button>
        <button type="button" className="bx-btn ax-tap px-2 text-sm" onClick={onDuplicate} data-testid="nb-duplicate">{C.notebook.duplicate}</button>
        <button type="button" className="bx-btn ax-tap px-2 text-sm" onClick={onDelete} data-testid="nb-delete">{C.notebook.delete}</button>
      </div>
      <label htmlFor={`${uid}-tags`} className="mb-1 mt-3 block text-sm font-semibold">{C.notebook.tags}</label>
      <input id={`${uid}-tags`} className="bx-input ax-tap w-full" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onBlur={commitTags} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitTags())} data-testid="nb-tags" />
      <div className="mt-3">
          {note.kind === 'free' ? (
            <>
              <p className="mb-1 text-sm font-semibold" id={`${uid}-body-l`}>{C.notebook.body}</p>
              <RichField id={`${uid}-body`} label={C.notebook.body} value={note.body as unknown as RichDoc} blocks flags={flags} minRows={8} testId="nb-body" onChange={(d) => change((b) => updateNote(b, note.id, { body: d as unknown as NoteDoc }), `nb:${note.id}:body`)} />
            </>
          ) : (
            <div className="space-y-3" data-testid="nb-fields" data-template={tpl?.id ?? note.template}>
              {(note.fields ?? []).map((f) =>
                f.key === DATE_FIELD.key ? (
                  <div key={f.key}>
                    <label htmlFor={`${uid}-f-date`} className="mb-1 block text-sm font-semibold">{f.label}</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {f.full ? (
                        <input id={`${uid}-f-date`} type="date" className="bx-input ax-tap w-auto" value={/^\d{4}-\d{2}-\d{2}$/.test(f.value ?? '') ? f.value : ''} aria-describedby={`${uid}-f-date-h`} onChange={(e) => change((b) => updateField(b, note.id, f.key, { value: e.target.value }), `nb:${note.id}:date`)} data-testid="nb-date" />
                      ) : (
                        <input id={`${uid}-f-date`} type="text" inputMode="numeric" className="bx-input ax-tap w-28" placeholder={C.notebook.dateYear} value={f.value ?? ''} aria-describedby={`${uid}-f-date-h`} onChange={(e) => change((b) => updateField(b, note.id, f.key, { value: e.target.value }), `nb:${note.id}:date`)} data-testid="nb-date" />
                      )}
                      <label className="inline-flex items-center gap-1 text-sm ax-tap">
                        <input type="checkbox" checked={!!f.full} onChange={(e) => change((b) => updateField(b, note.id, f.key, { full: e.target.checked, value: e.target.checked ? '' : (f.value ?? '').slice(0, 4) }))} data-testid="nb-date-full" />
                        {C.notebook.dateFull}
                      </label>
                    </div>
                    <p id={`${uid}-f-date-h`} className="mt-1 text-xs bx-muted">{f.full ? C.notebook.dateFullHint : C.notebook.dateYearHint}</p>
                  </div>
                ) : (
                  <div key={f.key}>
                    <p className="mb-1 text-sm font-semibold">{f.label}</p>
                    <RichField id={`${uid}-f-${f.key}`} label={f.label} value={f.body!} flags={flags} testId={`nb-field-${f.key}`} onChange={(d) => change((b) => updateField(b, note.id, f.key, { body: d as RichDoc }), `nb:${note.id}:${f.key}`)} />
                  </div>
                ),
              )}
            </div>
          )}
      </div>
    </article>
  );
}

/** SL26: the Help page's section on the notebook — what it is for, that it stays on this device, what the check can and cannot catch. */
export function NotebookHelp() {
  return (
    <section className="mt-8" aria-labelledby="nb-help-title" data-testid="notebook-help">
      <h2 id="nb-help-title" className="font-display text-xl font-semibold">{C.notebook.help.title}</h2>
      <p className="mt-2">{C.notebook.help.what}</p>
      <p className="mt-2">{C.notebook.help.device}</p>
      <h3 className="mt-4 text-lg font-semibold">{C.notebook.check}</h3>
      <p className="mt-2">{C.notebook.help.check}</p>
      <p className="mt-2">{C.notebook.help.cannot}</p>
    </section>
  );
}
