import { type ReactNode, useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as RKeyboardEvent } from 'react';
import { C } from '../../lib/copy';
import { count } from '../../lib/plural';
import type { SdohMap } from '../../lib/model/map';
import {
  addNote, addPassage, allTags, annotationOf, deleteNote, dismissFlag, duplicateNote, isDismissed, labelAll, labelFlag, moveNote, spanFromSelection, newFreeNote, newStructuredNote, parseTags, searchNotes, setAnnotationText, updateField, updateNote, DATE_FIELD,
  type Flag, type Note, type NoteDoc, type Notebook as NotebookDoc, type NoteTable, type NoteTemplate, type Span, type Target,
} from '../../lib/model/notebook';
import type { RichDoc } from '../../lib/model/rich';
import RichField, { type RichFieldFlags } from '../map/RichField';
import { plainText } from '../../lib/model/rich';
import { removeSpan } from '../../lib/model/spans';
import type { NotebookExtractor, Proposal } from '../../lib/model/extract';
import { ActionBar, PassageList, ProposalQueue, SpanChooser, type ActionBarHandle, type TargetName } from './Passages';
import type { SpanDeco, TextSelection } from './spanMarks';
import { findIdentifiers } from '../../lib/model/identifiers';

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
  /** SL29: import — the file picker, "Paste as a note", and files dropped on the notebook */
  onImport?: () => void;
  onPaste?: () => void;
  onDropFiles?: (files: File[]) => void;
  /** SL29: show this note (after an import); `n` changes each time */
  focus?: { id: string; n: number; span?: string } | null;
  /** SL27: spans — what the map has selected (their highlights get the focus ring), names of items, show one on the map */
  selectedTargets?: Target[];
  targetName?: TargetName;
  onShow?: (t: Target) => void;
  /** SL27: the selection actions that open the map's dialogs */
  onCreateFrom?: (span: Span) => void;
  onEvidenceFrom?: (span: Span) => void;
  onLinkFrom?: (span: Span) => void;
  /** SL27: extractors (the local code matcher first), the refusal rule's switch, and accepting a proposal */
  extractors?: NotebookExtractor[];
  allowRemote?: boolean;
  onAccept?: (note: Note, p: Proposal, edit: boolean) => void;
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
export function Notebook({ map, apply, scrub, flags, templates, announce, onPrint, summary, onImport, onPaste, onDropFiles, focus, selectedTargets = [], targetName, onShow, onCreateFrom, onEvidenceFrom, onLinkFrom, extractors = [], allowRemote = false, onAccept }: NotebookProps) {
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
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  // SL27 point 8: Go to passage — the note, then its highlight
  const [focusSpan, setFocusSpan] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (!focus) return;
    setSel(focus.id);
    setQ('');
    setTag(null);
    if (focus.span) setFocusSpan({ id: focus.span, n: focus.n });
    else focusNote.current = focus.id;
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
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
    // the new note's title takes focus — unless the user has already moved focus somewhere else meanwhile
    const from = document.activeElement;
    setTimeout(() => {
      const t = document.getElementById(`${uid}-title`) as HTMLInputElement | null;
      if (t && (document.activeElement === from || document.activeElement === document.body || !document.activeElement)) t.select();
    }, 30);
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
    <section
      className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
      aria-labelledby={`${uid}-h`}
      data-notebook
      data-testid="notebook"
      onDragEnter={(e) => {
        if (!onDropFiles || !hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current++;
        setDropping(true);
      }}
      onDragOver={(e) => {
        if (onDropFiles && hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!onDropFiles || !hasFiles(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDropping(false);
      }}
      onDrop={(e) => {
        if (!onDropFiles || !e.dataTransfer?.files?.length) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDropping(false);
        onDropFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {dropping && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-[color:var(--bx-ink)] bg-[color:var(--bx-bg)]/90 p-4 text-center font-semibold" data-testid="nb-drop-zone">
          {C.notebook.importing.drop}
        </div>
      )}
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
          {onImport && <button type="button" className="bx-btn ax-tap" title={C.notebook.importing.buttonTip} onClick={onImport} data-testid="nb-import">{C.notebook.importing.button}</button>}
          {onPaste && <button type="button" className="bx-btn ax-tap" onClick={onPaste} data-testid="nb-paste-open">{C.notebook.importing.paste}</button>}
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
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="nb-scroll">
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
                        <span className="text-xs bx-muted">{x.kind === 'structured' ? templates.find((t) => t.id === x.template)?.name ?? C.notebook.structured : x.kind === 'imported' ? `${C.notebook.importing.kind} · ${x.source?.type.toUpperCase()}` : C.notebook.free}</span>
                        {k > 0 && <span className="bx-chip px-1.5 text-xs" aria-label={count(k, C.notebook.identifier)}>⚠ {k}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {note ? (
              <NoteEditor key={note.id} uid={uid} note={note} index={notes.indexOf(note)} total={notes.length} templates={templates} flags={flagsProp} change={change} focusSpan={focusSpan}
                spansCtx={{
                  nb, selected: selectedTargets, name: targetName ?? ((t) => t.id), onShow: (t) => onShow?.(t), announce,
                  onCreate: onCreateFrom, onEvidence: onEvidenceFrom, onLink: onLinkFrom,
                  onRemove: (id) => {
                    apply((m) => removeSpan(m, id));
                    announce(C.notebook.passages.removed);
                  },
                  extractors, allowRemote, flags: flagsByNote.get(note.id) ?? 0,
                  nodes: map.nodes.filter((x) => x.kind !== 'note').map((x) => ({ id: x.id, code: x.code, label: plainText(x.label) })),
                  onAccept: onAccept ? (p, edit) => onAccept(note, p, edit) : undefined,
                }}
                onMove={(to) => move(note, to)} onDuplicate={() => {
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

interface SpansCtx {
  nb: NotebookDoc | undefined;
  selected: Target[];
  name: TargetName;
  onShow: (t: Target) => void;
  announce: (s: string) => void;
  onCreate?: (span: Span) => void;
  onEvidence?: (span: Span) => void;
  onLink?: (span: Span) => void;
  onRemove: (span: string) => void;
  extractors: NotebookExtractor[];
  allowRemote: boolean;
  flags: number;
  nodes: { id: string; code: string | null; label: string }[];
  onAccept?: (p: Proposal, edit: boolean) => void;
}

function NoteEditor({ uid, note, index, total, templates, flags, change, onMove, onDuplicate, onDelete, spansCtx: sc, focusSpan }: {
  uid: string; note: Note; index: number; total: number; templates: NoteTemplate[]; flags: RichFieldFlags;
  change: (fn: NB, key?: string) => void; onMove: (to: number) => void; onDuplicate: () => void; onDelete: () => void; spansCtx: SpansCtx;
  focusSpan?: { id: string; n: number } | null;
}) {
  // SL27 point 8: Go to passage lands here — the highlight scrolled into view inside the notebook (not the page),
  // the caret at its start and the focus in its text, and a brief flash
  useEffect(() => {
    if (!focusSpan) return;
    let tries = 0;
    const go = () => {
      const el = art.current?.querySelector<HTMLElement>(`[data-span="${focusSpan.id}"]`);
      if (!el) return void (tries++ < 20 && setTimeout(go, 50));
      const box = el.closest<HTMLElement>('[data-testid="nb-scroll"]');
      if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientHeight / 3;
      const ed = el.closest<HTMLElement>('[role="textbox"]');
      ed?.focus({ preventScroll: true });
      const r = document.createRange();
      r.setStart(el.firstChild ?? el, 0);
      r.collapse(true);
      const s = getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      el.classList.add('sx-flash');
      setTimeout(() => el.classList.remove('sx-flash'), 1700);
    };
    go();
  }, [focusSpan?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  // SL27: the text selection (for the action bar), the overlap chooser, and the margin on a wide notebook
  const [textSel, setTextSel] = useState<{ where: string; sel: TextSelection } | null>(null);
  // the latest selection, set at once (the action keys flush it before React renders): the span is made from this
  const selNow = useRef<{ where: string; sel: TextSelection } | null>(null);
  const [chooser, setChooser] = useState<{ at: DOMRect; items: { span: Span; targets: Target[] }[] } | null>(null);
  const bar = useRef<ActionBarHandle>(null);
  const art = useRef<HTMLElement>(null);
  const [wideNb, setWideNb] = useState(false);
  useEffect(() => {
    const el = art.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWideNb(el.getBoundingClientRect().width >= 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lastFocus = useRef<HTMLElement | null>(null);
  const spanList = (where: string): SpanDeco[] =>
    (sc.nb?.spans ?? [])
      .filter((x) => x.note === note.id && x.where === where && !x.orphaned)
      .map((x) => {
        const targets = annotationOf(sc.nb, x.id)?.targets ?? [];
        const pressed = targets.some((t) => sc.selected.some((s) => s.kind === t.kind && s.id === t.id));
        const cls = x.by?.inferred ? (x.by.confidence === 'low' ? 'sx-span-low' : 'sx-span-inferred') : targets.length ? 'sx-span' : 'sx-span-plain';
        return { id: x.id, start: x.start, end: x.end, cls, pressed, title: targets.length ? targets.map(sc.name).join(' · ') : C.notebook.passages.plain };
      });
  const spansFor = (where: string) => {
    const list = spanList(where);
    return {
      list,
      version: JSON.stringify(list),
      onClick: (ids: string[], rect: DOMRect) => {
        const items = ids.map((id) => ({ span: sc.nb!.spans!.find((x) => x.id === id)!, targets: annotationOf(sc.nb, id)?.targets ?? [] })).filter((x) => x.span);
        const all = items.flatMap((x) => x.targets);
        if (all.length === 1) sc.onShow(all[0]);
        else if (all.length > 1) setChooser({ at: rect, items: items.filter((x) => x.targets.length) });
      },
      onSelect: (s: TextSelection | null) => {
        if (s) {
          lastFocus.current = document.activeElement as HTMLElement | null;
          selNow.current = { where, sel: s };
        }
        setTextSel((cur) => (s ? { where, sel: s } : cur?.where === where && !art.current?.querySelector('[data-testid="nb-action-bar"]')?.contains(document.activeElement) ? null : cur));
      },
    };
  };
  const onKey = (e: KeyboardEvent) => {
    if (textSel && ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.key === 'F10' && e.shiftKey))) {
      bar.current?.focus();
      return true;
    }
    return false;
  };
  const span = () => {
    const cur = selNow.current ?? textSel;
    return cur ? spanFromSelection(note.id, cur.where, cur.sel) : null;
  };
  const act = (fn?: (s: Span) => void) => () => {
    const s = span();
    setTextSel(null);
    selNow.current = null;
    if (s && fn) fn(s);
  };
  const fieldLabel = (where: string) => note.fields?.find((f) => f.key === where)?.label ?? where;
  const passages = (
    <PassageList
      nb={sc.nb}
      note={note}
      fieldLabel={fieldLabel}
      name={sc.name}
      selected={sc.selected}
      onShow={sc.onShow}
      onComment={(id, t) => change((b) => setAnnotationText(b, id, t))}
      onRemove={sc.onRemove}
    />
  );
  const [tagDraft, setTagDraft] = useState(note.tags.join(', '));
  useEffect(() => setTagDraft(note.tags.join(', ')), [note.tags.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  const commitTags = () => {
    const t = parseTags(tagDraft);
    if (t.join('\n') !== note.tags.join('\n')) change((b) => updateNote(b, note.id, { tags: t }));
    setTagDraft(t.join(', '));
  };
  const tpl = templates.find((t) => t.id === note.template);
  return (
    <article ref={art} className="p-3" aria-labelledby={`${uid}-title-l`} data-testid="nb-editor" data-note-id={note.id}>
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
      <p id={`${uid}-sel-h`} className="mt-2 text-xs bx-muted" data-print-hide>{C.notebook.passages.keyHint}</p>
      <div className={`mt-3 ${wideNb ? 'grid grid-cols-[minmax(0,1fr)_15rem] gap-3' : ''}`} data-testid="nb-text-area" data-margin={wideNb ? 'margin' : 'inline'}>
      <div className="min-w-0">
          {note.kind === 'imported' ? (
            <ImportedBody uid={uid} note={note} flags={flags} spans={spansFor('body')} />
          ) : note.kind === 'free' ? (
            <>
              <p className="mb-1 text-sm font-semibold" id={`${uid}-body-l`}>{C.notebook.body}</p>
              <RichField id={`${uid}-body`} label={C.notebook.body} value={note.body as unknown as RichDoc} blocks flags={flags} minRows={8} testId="nb-body" describedBy={`${uid}-sel-h`} spans={spansFor('body')} onKey={onKey} onChange={(d) => change((b) => updateNote(b, note.id, { body: d as unknown as NoteDoc }), `nb:${note.id}:body`)} />
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
                    <RichField id={`${uid}-f-${f.key}`} label={f.label} value={f.body!} flags={flags} testId={`nb-field-${f.key}`} describedBy={`${uid}-sel-h`} spans={spansFor(f.key)} onKey={onKey} onChange={(d) => change((b) => updateField(b, note.id, f.key, { body: d as RichDoc }), `nb:${note.id}:${f.key}`)} />
                  </div>
                ),
              )}
            </div>
          )}
      </div>
      <div className={wideNb ? 'min-w-0' : 'mt-3'} data-testid="nb-margin">{passages}</div>
      </div>
      {sc.onAccept && !note.table && <ProposalQueue note={note} extractors={sc.extractors} allowRemote={sc.allowRemote} flags={sc.flags} nodes={sc.nodes} onAccept={sc.onAccept} />}
      {textSel && (
        <ActionBar
          ref={bar}
          sel={textSel.sel}
          onCreate={act(sc.onCreate)}
          onEvidence={act(sc.onEvidence)}
          onLink={act(sc.onLink)}
          onAnnotate={(t) => {
            const s = span();
            setTextSel(null);
            selNow.current = null;
            if (!s) return;
            change((b) => addPassage(b, s, { text: t }).notebook);
            sc.announce(C.notebook.passages.annotated);
          }}
          onCopy={() => {
            const q = textSel.sel.quote;
            navigator.clipboard?.writeText(q).catch(() => undefined);
            sc.announce(C.notebook.passages.copied);
          }}
          onClose={() => {
            setTextSel(null);
            selNow.current = null;
          }}
          back={() => lastFocus.current?.focus()}
        />
      )}
      {chooser && <SpanChooser at={chooser.at} items={chooser.items} name={sc.name} onPick={(t) => (setChooser(null), sc.onShow(t))} onClose={() => setChooser(null)} />}
    </article>
  );
}

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/**
 * SL29: an imported note's text, verbatim — read-only (selectable, flagged, with a PDF's page markers), or a CSV's
 * table — under a line that says where it came from and what the identifier review decided.
 */
function ImportedBody({ uid, note, flags, spans }: { uid: string; note: Note; flags: RichFieldFlags; spans?: Parameters<typeof RichField>[0]['spans'] }) {
  const s = note.source;
  return (
    <div data-testid="nb-imported" data-type={s?.type}>
      {s && (
        <p className="mb-2 text-xs bx-muted" data-testid="nb-source">
          {C.notebook.importing.source} <span className="font-semibold">{s.filename}</span> · {s.type.toUpperCase()} · {size(s.size)}
          {s.pages ? ` · ${count(s.pages, 'page')}` : ''} · {new Date(s.imported).toLocaleDateString()} · {C.notebook.importing.review[s.review]}
          {s.review === 'kept' && s.kept ? ` (${count(s.kept, C.notebook.identifier)})` : ''}
          {s.dropped ? ` · ${s.dropped} ${s.dropped === 1 ? C.notebook.importing.droppedOne : C.notebook.importing.droppedMany}` : ''}
        </p>
      )}
      <p className="mb-2 text-xs bx-muted">{C.notebook.importing.verbatim}</p>
      {note.table ? (
        <ImportedTable table={note.table} label={C.notebook.importing.table} isDismissed={flags.isDismissed} />
      ) : (
        <>
          <p className="mb-1 text-sm font-semibold">{C.notebook.importing.text}</p>
          <RichField id={`${uid}-body`} label={C.notebook.importing.text} value={note.body as unknown as RichDoc} blocks readOnly pages={note.anchors} flags={flags} spans={spans} minRows={8} testId="nb-body" onChange={() => undefined} />
        </>
      )}
    </div>
  );
}

/** SL29: an imported CSV — its cells as text, possible identifiers marked as in the editors. */
export function ImportedTable({ table, label, isDismissed }: { table: NoteTable; label: string; isDismissed: (c: string, v: string) => boolean }) {
  const cell = (t: string) => {
    const hits = findIdentifiers(t).filter((h) => !isDismissed(h.category, h.value));
    if (!hits.length) return t;
    const out: ReactNode[] = [];
    let at = 0;
    hits.forEach((h, i) => {
      out.push(t.slice(at, h.start), <span key={i} className="nb-flag" data-flag={h.category} title={C.notebook.flagTip}>{t.slice(h.start, h.end)}</span>);
      at = h.end;
    });
    out.push(t.slice(at));
    return out;
  };
  return (
    <div className="max-h-[28rem] overflow-auto overscroll-contain rounded border border-[color:var(--bx-line)]" tabIndex={0} role="region" aria-label={label} data-testid="nb-table">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>{table.header.map((h, i) => <th key={i} scope="col" className="border-b border-[color:var(--bx-line)] px-2 py-1 text-left font-semibold">{cell(h)}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-[color:var(--bx-line)] px-2 py-1 align-top whitespace-pre-wrap">{cell(c)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
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
      <p className="mt-2">{C.notebook.help.importing}</p>
      <p className="mt-2">{C.notebook.help.cannot}</p>
    </section>
  );
}
