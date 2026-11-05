import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { C } from '../../lib/copy';
import { codeMap } from '../../lib/data/scheme';
import { annotationOf, anchorOf, isChip, isOrphaned, type Notebook as NotebookDoc, type Note, type Span, type Target } from '../../lib/model/notebook';
import { mayRun, runExtractor, RefusedError, type NotebookExtractor, type Proposal } from '../../lib/model/extract';
import type { TextSelection } from './spanMarks';

const P = () => C.notebook.passages;
export type TargetName = (t: Target) => string;
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * SL27: the action bar on a text selection in a note — two equal actions, Create circumstance and Add as evidence to…,
 * then Link to…, Annotate and Copy quote. It opens under the selection; Ctrl+Enter (or Shift+F10) in the note moves
 * focus into it, and Esc gives focus back to the text.
 */
export interface ActionBarHandle {
  focus(): void;
}
export const ActionBar = forwardRef<ActionBarHandle, {
  sel: TextSelection;
  onCreate: () => void;
  onEvidence: () => void;
  onLink: () => void;
  onAnnotate: (text: string) => void;
  onCopy: () => void;
  onClose: () => void;
  /** focus back into the note's text */
  back: () => void;
}>(function ActionBar({ sel, onCreate, onEvidence, onLink, onAnnotate, onCopy, onClose, back }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({ focus: () => box.current?.querySelector<HTMLElement>('button')?.focus() }));
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  const left = Math.max(8, Math.min(sel.rect.left, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 340));
  const top = sel.rect.bottom + 6;
  return (
    <div
      ref={box}
      role="toolbar"
      aria-label={P().bar}
      className="bx-card fixed z-[45] flex max-w-[min(22rem,calc(100vw-1rem))] flex-wrap items-center gap-1 p-1.5 text-sm shadow-lg bg-[color:var(--bx-bg)] dark:bg-night-2"
      style={{ left, top }}
      data-testid="nb-action-bar"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          back();
        }
      }}
    >
      <span className="w-full truncate px-1 text-xs bx-muted" data-testid="nb-action-quote">“{short(sel.quote, 70)}”</span>
      {note === null ? (
        <>
          <button type="button" className="bx-btn-primary ax-tap px-2" onMouseDown={keep} onClick={onCreate} data-testid="nb-act-create">{P().create}</button>
          <button type="button" className="bx-btn-primary ax-tap px-2" onMouseDown={keep} onClick={onEvidence} data-testid="nb-act-evidence">{P().evidence}</button>
          <button type="button" className="bx-btn ax-tap px-2" onMouseDown={keep} onClick={onLink} data-testid="nb-act-link">{P().link}</button>
          <button type="button" className="bx-btn ax-tap px-2" onMouseDown={keep} onClick={() => setNote('')} data-testid="nb-act-annotate">{P().annotate}</button>
          <button type="button" className="bx-btn ax-tap px-2" onMouseDown={keep} onClick={onCopy} data-testid="nb-act-copy">{P().copy}</button>
        </>
      ) : (
        <form
          className="flex w-full flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) onAnnotate(note);
          }}
        >
          <label className="text-xs font-semibold" htmlFor="nb-annot-text">{P().comment}</label>
          <textarea id="nb-annot-text" className="bx-input" rows={2} value={note} autoFocus onChange={(e) => setNote(e.target.value)} data-testid="nb-annot-text" />
          <div className="flex gap-1">
            <button type="submit" className="bx-btn-primary ax-tap px-2" disabled={!note.trim()} data-testid="nb-annot-save">{P().saveComment}</button>
            <button type="button" className="bx-btn ax-tap px-2" onClick={() => setNote(null)}>{C.notebook.importing.back}</button>
          </div>
        </form>
      )}
    </div>
  );
});

/** SL27: overlapping spans under one click — a small chooser listing each span and what it supports. */
export function SpanChooser({ at, items, name, onPick, onClose }: { at: DOMRect; items: { span: Span; targets: Target[] }[]; name: TargetName; onPick: (t: Target) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && onClose();
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const choices: ReactNode[] = [];
  for (const { span, targets } of items)
    for (const t of targets)
      choices.push(
        <li key={`${span.id}:${t.kind}:${t.id}`}>
          <button type="button" className="ax-tap w-full rounded px-2 py-1 text-left hover:bg-paper-2 dark:hover:bg-night" onClick={() => onPick(t)} data-testid="nb-chooser-item">
            <span className="block font-semibold">{name(t)}</span>
            <span className="block text-xs bx-muted">“{short(span.quote, 60)}”</span>
          </button>
        </li>,
      );
  return (
    <div
      ref={box}
      role="dialog"
      aria-label={P().chooser}
      className="bx-card fixed z-[45] w-[min(18rem,calc(100vw-1rem))] p-1 text-sm shadow-lg bg-[color:var(--bx-bg)] dark:bg-night-2"
      style={{ left: Math.max(8, Math.min(at.left, window.innerWidth - 300)), top: at.bottom + 6 }}
      data-testid="nb-chooser"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <p className="m-0 px-2 py-1 text-xs bx-muted">{P().chooser}</p>
      <ul>{choices}</ul>
    </div>
  );
}

/**
 * SL27: one note's passages — every span with what it supports (a button that selects it on the map), its comment and
 * who suggested it; then the "Orphaned selections" whose text was edited away. On a wide notebook this list is the
 * margin beside the text; on a narrow one it follows the text.
 */
export function PassageList({ nb, note, fieldLabel, name, selected, onShow, onComment, onRemove, dim }: {
  /** SL28 trace view: dimmed passages */
  dim?: (span: string) => boolean;
  nb: NotebookDoc | undefined;
  note: Note;
  fieldLabel: (where: string) => string;
  name: TargetName;
  selected: Target[];
  onShow: (t: Target) => void;
  onComment: (span: string, text: string) => void;
  onRemove: (span: string) => void;
}) {
  const all = (nb?.spans ?? []).filter((x) => x.note === note.id);
  const live = all.filter((x) => !isOrphaned(nb, x)).sort((a, b) => (a.where === b.where ? a.start - b.start : a.where.localeCompare(b.where)));
  const orphans = all.filter((x) => isOrphaned(nb, x));
  if (!all.length) return null;
  const row = (x: Span, orphan: boolean) => {
    const a = annotationOf(nb, x.id);
    const targets = a?.targets ?? [];
    const pressed = targets.some((t) => selected.some((s) => s.kind === t.kind && s.id === t.id));
    const where = note.kind === 'imported' ? anchorOf(note, blockAt(note, x)).label : x.where === 'body' ? '' : fieldLabel(x.where);
    return (
      <li key={x.id} className={`rounded border p-2 text-sm ${pressed ? 'border-[color:var(--sx-selected)]' : 'border-[color:var(--bx-line)]'} ${dim?.(x.id) ? 'sx-dim' : ''}`} data-testid={orphan ? 'nb-orphan' : 'nb-passage'} data-span={x.id} data-pressed={pressed ? 'true' : 'false'} data-dim={dim?.(x.id) ? 'true' : undefined} data-chip={isChip(x) ? 'true' : undefined}>
        <p className="m-0">
          {isChip(x) ? (
            <span className="sx-chip" data-testid="nb-passage-chip">@ {P().mention}</span>
          ) : (
          <span className={x.by?.inferred ? (x.by.confidence === 'low' ? 'sx-span-low' : 'sx-span-inferred') : targets.length ? 'sx-span' : 'sx-span-plain'}>“{short(x.quote)}”</span>
          )}
          {x.by?.inferred && <span className="sx-approx" aria-hidden="true">≈</span>}
          {x.by?.inferred && <span className="sr-only"> ({P().inferred})</span>}
        </p>
        {where && <p className="m-0 text-xs bx-muted">{where}</p>}
        {x.by && <p className="m-0 text-xs bx-muted" data-testid="nb-passage-by">{P().suggestedBy} {x.by.label}{x.by.inferred ? ` · ${P().inferred}` : ''}</p>}
        {targets.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1" aria-label={P().supports}>
            {targets.map((t) => (
              <li key={`${t.kind}:${t.id}`}>
                <button type="button" className="bx-btn ax-tap px-2 py-0 text-xs" onClick={() => onShow(t)} data-testid="nb-passage-target">{name(t)}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-xs bx-muted">{P().plain}</p>
        )}
        <Comment text={a?.text ?? ''} onSave={(t) => onComment(x.id, t)} />
        <button type="button" className="bx-btn ax-tap mt-1 px-2 py-0 text-xs" onClick={() => onRemove(x.id)} data-testid="nb-passage-remove">{P().remove}</button>
      </li>
    );
  };
  return (
    <section className="space-y-2" aria-label={P().title} data-testid="nb-passages">
      {live.length > 0 && (
        <>
          <h3 className="m-0 text-sm font-semibold">{P().title}</h3>
          <ul className="space-y-2">{live.map((x) => row(x, false))}</ul>
        </>
      )}
      {orphans.length > 0 && (
        <div data-testid="nb-orphans">
          <h3 className="m-0 text-sm font-semibold">{P().orphaned}</h3>
          <p className="m-0 text-xs bx-muted">{P().orphanedHint}</p>
          <ul className="mt-1 space-y-2">{orphans.map((x) => row(x, true))}</ul>
        </div>
      )}
    </section>
  );
}
/** the top-level block a span starts in (for an imported note's page and heading) */
function blockAt(n: Note, x: Span): number {
  let off = 0;
  const blocks = n.body.content;
  for (let i = 0; i < blocks.length; i++) {
    const len = textLen(blocks[i]);
    if (x.start <= off + len) return i;
    off += len + 1;
  }
  return Math.max(0, blocks.length - 1);
}
function textLen(b: unknown): number {
  const walk = (n: { type?: string; text?: string; content?: unknown[] }): number[] =>
    n.type === 'paragraph' || n.type === 'heading' ? [(n.content as { type: string; text?: string }[] | undefined)?.reduce((k, c) => k + (c.type === 'text' ? c.text!.length : 1), 0) ?? 0] : ((n.content as never[]) ?? []).flatMap(walk);
  const lens = walk(b as never);
  return lens.reduce((a, c) => a + c, 0) + Math.max(0, lens.length - 1);
}

function Comment({ text, onSave }: { text: string; onSave: (t: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(text);
  useEffect(() => setV(text), [text]);
  if (!edit)
    return (
      <div className="mt-1">
        {text && <p className="m-0 whitespace-pre-wrap" data-testid="nb-passage-comment">{text}</p>}
        <button type="button" className="bx-btn ax-tap mt-1 px-2 py-0 text-xs" onClick={() => setEdit(true)} data-testid="nb-passage-comment-edit">{text ? P().editComment : P().annotate}</button>
      </div>
    );
  return (
    <form
      className="mt-1 flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
        setEdit(false);
      }}
    >
      <textarea className="bx-input" rows={2} aria-label={P().comment} value={v} autoFocus onChange={(e) => setV(e.target.value)} />
      <div className="flex gap-1">
        <button type="submit" className="bx-btn-primary ax-tap px-2 py-0 text-xs">{P().saveComment}</button>
        <button type="button" className="bx-btn ax-tap px-2 py-0 text-xs" onClick={() => setEdit(false)}>{C.notebook.importing.back}</button>
      </div>
    </form>
  );
}

/**
 * SL27: the proposal queue — "Suggest circumstances in this note" runs an extractor (a picker only when there is more
 * than one), under the refusal rule; each proposal says who suggested it, and is applied only by Accept or Edit then
 * accept. Reject drops it.
 */
export function ProposalQueue({ note, extractors, allowRemote, flags, nodes, onAccept }: {
  note: Note;
  extractors: NotebookExtractor[];
  allowRemote: boolean;
  /** this note's unresolved identifier flags */
  flags: number;
  nodes: { id: string; code: string | null; label: string }[];
  onAccept: (p: Proposal, edit: boolean) => void;
}) {
  const [engine, setEngine] = useState(extractors[0]?.id ?? '');
  const [list, setList] = useState<Proposal[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ex = extractors.find((x) => x.id === engine) ?? extractors[0];
  if (!ex) return null;
  const gate = mayRun(ex, { allowRemote, flags });
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setList(await runExtractor(ex, note, { nodes }, { allowRemote, flags }));
    } catch (e) {
      setErr(e instanceof RefusedError ? e.message : P().failed);
      setList(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-3 rounded border border-[color:var(--bx-line)] p-2" aria-label={P().queue} data-testid="nb-proposals">
      <div className="flex flex-wrap items-center gap-2">
        {extractors.length > 1 && (
          <label className="text-sm">
            <span className="mr-1">{P().engine}</span>
            <select className="bx-input ax-tap w-auto" value={engine} onChange={(e) => (setEngine(e.target.value), setList(null))} data-testid="nb-engine">
              {extractors.map((x) => <option key={x.id} value={x.id}>{x.label}{x.kind === 'remote' ? ` (${P().remote})` : ''}</option>)}
            </select>
          </label>
        )}
        <button type="button" className="bx-btn ax-tap" onClick={run} disabled={busy || !gate.ok} aria-describedby="nb-suggest-h" data-testid="nb-suggest">{P().suggest}</button>
      </div>
      <p id="nb-suggest-h" className="m-0 mt-1 text-xs bx-muted">{ex.describe}</p>
      {!gate.ok && <p className="m-0 mt-1 text-sm bx-banner" role="status" data-testid="nb-suggest-refused">{gate.reason === 'remote-off' ? P().refusedRemote : P().refusedFlags}</p>}
      {err && <p className="m-0 mt-1 text-sm bx-banner" role="alert">{err}</p>}
      {list && (
        <>
          <h3 className="m-0 mt-2 text-sm font-semibold" role="status">{list.length ? `${P().queue} (${list.length})` : P().none}</h3>
          <ul className="mt-1 space-y-2">
            {list.map((p) => (
              <li key={p.id} className="rounded border border-[color:var(--bx-line)] p-2 text-sm" data-testid="nb-proposal" data-code={p.code ?? ''}>
                <p className="m-0 font-semibold">{p.label}</p>
                <p className="m-0 text-xs bx-muted">
                  {p.code ? `${p.code} · ${codeMap.get(p.code)?.title ?? ''}` : `${C.notebook.passages.other} · ${p.other_type}`} · {p.status === 'implicit' ? P().inferred : P().explicit} · {P().confidence[p.confidence]}
                </p>
                {p.spans.map((s, i) => (
                  <p key={i} className="m-0 mt-1">
                    <span className={p.status === 'implicit' ? (p.confidence === 'low' ? 'sx-span-low' : 'sx-span-inferred') : 'sx-span'}>“{short(s.quote)}”</span>
                  </p>
                ))}
                {p.rationale && <p className="m-0 mt-1 text-xs">{p.rationale}</p>}
                <p className="m-0 mt-1 text-xs bx-muted" data-testid="nb-proposal-by">{P().suggestedBy} {p.extractor.label}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button type="button" className="bx-btn-primary ax-tap px-2" onClick={() => (onAccept(p, false), setList((l) => l?.filter((x) => x !== p) ?? null))} data-testid="nb-proposal-accept">{P().accept}</button>
                  <button type="button" className="bx-btn ax-tap px-2" onClick={() => (onAccept(p, true), setList((l) => l?.filter((x) => x !== p) ?? null))} data-testid="nb-proposal-edit">{P().editAccept}</button>
                  <button type="button" className="bx-btn ax-tap px-2" onClick={() => setList((l) => l?.filter((x) => x !== p) ?? null)} data-testid="nb-proposal-reject">{P().reject}</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
