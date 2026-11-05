import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { C } from '../../lib/copy';
import { count } from '../../lib/plural';
import { Dialog } from '../ui/Dialog';
import RichField from '../map/RichField';
import type { RichDoc } from '../../lib/model/rich';
import { dismissFlag, emptyNotebook, labelAll, labelFlag, notebookFlags, type Flag, type Note, type Notebook as NotebookDoc } from '../../lib/model/notebook';
import type { ImportOutcome } from '../../lib/import';
import type { ImportLimits } from '../../lib/import/limits';
import { ImportedTable } from './Notebook';

/** what the host can open from outside the notebook (its header button, the Map menu, a drop on it) */
export interface NotebookImportHandle {
  /** the file picker (from a click: browsers open it only during a user's action) */
  openFile(): void;
  openPaste(): void;
  importFiles(files: File[]): void;
}

type Item = { name: string; state: 'reading' | 'ready' | 'failed'; done: number; total: number; outcome?: ImportOutcome };
type Step = { kind: 'choose' } | { kind: 'one'; i: number } | { kind: 'keep' };

/**
 * SL29: import files into the notebook. Files are read on the device (lib/import, loaded on first use), each into one
 * note; a failure in one file never stops the others. Before anything is saved, each note opens in a review step with
 * the identifier check's flags and a count: Label all, Review one by one, or Keep as is (confirmed once, and recorded
 * on the note). Labelling happens on this unsaved copy, so a replaced value never reaches storage. The original file
 * is not stored, nor its metadata.
 */
export const NotebookImport = forwardRef<NotebookImportHandle, {
  /** the notebook as it is now (dismissed values and label counts carry over) */
  notebook: NotebookDoc | undefined;
  /** save one reviewed note (and the notebook's updated dismissed list and label counts): one Undo step */
  onSave: (note: Note, base: Pick<NotebookDoc, 'dismissed' | 'replaced'>) => void;
  /** after the last file: open the notebook at the last note saved */
  onDone: (lastId: string | null) => void;
  limits: ImportLimits;
  accept: string;
  announce: (s: string) => void;
}>(function NotebookImport({ notebook, onSave, onDone, limits, accept, announce }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState({ title: '', text: '' });
  // the note under review, on a copy of the notebook's dismissed list and label counts
  const [cur, setCur] = useState<{ index: number; temp: NotebookDoc } | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [log, setLog] = useState<{ saved: string[]; skipped: string[]; lastId: string | null }>({ saved: [], skipped: [], lastId: null });
  const nbRef = useRef(notebook);
  nbRef.current = notebook;

  const begin = (index: number, list: Item[]) => {
    const o = list[index]?.outcome;
    if (!o || !o.ok) return setCur(null);
    const nb = nbRef.current ?? emptyNotebook();
    setCur({ index, temp: { notes: [o.note], dismissed: [...nb.dismissed], replaced: { ...nb.replaced } } });
    setStep({ kind: 'choose' });
  };
  const nextReady = (from: number, list: Item[]) => list.findIndex((x, i) => i > from && x.outcome?.ok);

  const read = async (files: File[]) => {
    if (!files.length) return;
    const list: Item[] = files.map((f) => ({ name: f.name || C.notebook.importing.pasteDefault, state: 'reading', done: 0, total: 1 }));
    setItems(list);
    setCur(null);
    setLog({ saved: [], skipped: [], lastId: null });
    setOpen(true);
    announce(`${C.notebook.importing.reading} ${count(files.length, 'file')}.`);
    const lib = await import('../../lib/import');
    const out = [...list];
    await Promise.all(
      files.map(async (f, i) => {
        const o = await lib.readImport(f, limits, (done, total) =>
          setItems((xs) => xs.map((x, j) => (j === i ? { ...x, done, total } : x))),
        );
        out[i] = { ...out[i], state: o.ok ? 'ready' : 'failed', outcome: o, done: 1, total: 1 };
        setItems((xs) => xs.map((x, j) => (j === i ? out[i] : x)));
      }),
    );
    const failed = out.filter((x) => x.outcome && !x.outcome.ok).length;
    announce(`${count(out.length - failed, 'file')} read${failed ? `, ${failed} not imported` : ''}.`);
    begin(nextReady(-1, out), out);
  };

  useImperativeHandle(ref, () => ({
    openFile: () => input.current?.click(),
    openPaste: () => {
      setPaste({ title: '', text: '' });
      setPasteOpen(true);
    },
    importFiles: (files) => void read(files),
  }));

  const flags: Flag[] = useMemo(() => (cur ? notebookFlags(cur.temp) : []), [cur]);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flags) m.set(f.category, (m.get(f.category) ?? 0) + 1);
    return [...m.entries()];
  }, [flags]);
  const note = cur?.temp.notes[0];

  const finish = (review: NonNullable<Note['source']>['review'], temp = cur!.temp) => {
    const n = temp.notes[0];
    const left = notebookFlags(temp).length;
    const saved: Note = { ...n, source: { ...n.source!, review: review === 'kept' ? 'kept' : review, ...(review === 'kept' && left ? { kept: left } : {}) } };
    onSave(saved, { dismissed: temp.dismissed, replaced: temp.replaced });
    announce(`${C.notebook.importing.saved} ${saved.title}.`);
    const nextLog = { ...log, saved: [...log.saved, saved.title], lastId: saved.id };
    setLog(nextLog);
    const k = nextReady(cur!.index, items);
    if (k >= 0) begin(k, items);
    else setCur(null);
  };
  const skip = () => {
    setLog((l) => ({ ...l, skipped: [...l.skipped, note!.title] }));
    const k = nextReady(cur!.index, items);
    if (k >= 0) begin(k, items);
    else setCur(null);
  };
  const close = () => {
    setOpen(false);
    setCur(null);
    onDone(log.lastId);
  };
  const oneByOne = (temp: NotebookDoc) => {
    if (!notebookFlags(temp).length) return finish('reviewed', temp);
    setCur((c) => c && { ...c, temp });
    setStep({ kind: 'one', i: 0 });
  };

  const readyCount = items.filter((x) => x.outcome?.ok).length;
  const position = cur ? items.slice(0, cur.index + 1).filter((x) => x.outcome?.ok).length : 0;
  const reading = items.some((x) => x.state === 'reading');
  const T = C.notebook.importing;

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="nb-import-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void read(files);
        }}
      />
      <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} title={T.pasteTitle} testId="nb-paste">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!paste.text.trim()) return;
            setPasteOpen(false);
            const title = paste.title.trim() || T.pasteDefault;
            void read([new File([paste.text], `${title}.txt`, { type: 'text/plain' })]);
          }}
        >
          <label className="mb-1 block text-sm font-semibold" htmlFor="nb-paste-title">{T.pasteName}</label>
          <input id="nb-paste-title" className="bx-input ax-tap w-full" value={paste.title} placeholder={T.pasteDefault} onChange={(e) => setPaste((p) => ({ ...p, title: e.target.value }))} data-testid="nb-paste-title" />
          <label className="mb-1 mt-3 block text-sm font-semibold" htmlFor="nb-paste-text">{T.pasteLabel}</label>
          <textarea id="nb-paste-text" className="bx-input w-full" rows={10} value={paste.text} onChange={(e) => setPaste((p) => ({ ...p, text: e.target.value }))} data-autofocus data-testid="nb-paste-text" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className="bx-btn-primary ax-tap" disabled={!paste.text.trim()} data-testid="nb-paste-go">{T.pasteGo}</button>
            <button type="button" className="bx-btn ax-tap" onClick={() => setPasteOpen(false)}>{T.back}</button>
          </div>
        </form>
      </Dialog>
      <Dialog open={open} onClose={close} title={T.title} wide testId="nb-import-dialog">
        <ul className="space-y-1.5 text-sm" aria-label={T.title} data-testid="nb-import-files">
          {items.map((x, i) => (
            <li key={i} data-testid="nb-import-file" data-state={x.state}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{x.name}</span>
                <span className="bx-muted">{x.state === 'reading' ? T.reading : x.state === 'ready' ? T.ready : T.failed}</span>
              </div>
              {x.state === 'reading' && <progress className="h-2 w-full" max={x.total || 1} value={x.total > 1 ? x.done : undefined} aria-label={`${T.reading} ${x.name}`} data-testid="nb-import-progress" />}
              {x.outcome && !x.outcome.ok && (
                <p className="m-0 bx-banner" role="alert" data-testid="nb-import-error" data-reason={x.outcome.reason}>
                  {x.outcome.message}
                  {x.outcome.reason === 'scanned' ? ` ${T.later}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs bx-muted" data-testid="nb-import-original">{T.original}</p>
        {note && cur && (
          <section className="mt-3 border-t border-[color:var(--bx-line)] pt-3" aria-labelledby="nb-review-h" data-testid="nb-review" data-step={step.kind}>
            <h3 id="nb-review-h" className="m-0 text-lg font-semibold" data-testid="nb-review-title">
              {note.title} <span className="text-sm font-normal bx-muted">({position} {T.reviewOf} {readyCount})</span>
            </h3>
            <p className="mt-1 text-sm" data-testid="nb-review-count" role="status">
              {flags.length ? (
                <>
                  <span aria-hidden="true">⚠ </span>
                  {count(flags.length, C.notebook.identifier)}: {byCat.map(([c, k]) => `${k} ${C.notebook.categories[c]}`).join(', ')}
                </>
              ) : (
                T.noneFound
              )}
            </p>
            <p className="mt-1 text-xs bx-muted">{C.notebook.heuristic}</p>
            <div className="mt-2 max-h-[min(22rem,40vh)] overflow-y-auto overscroll-contain rounded border border-[color:var(--bx-line)] p-2" data-testid="nb-review-text">
              {note.table ? (
                <ImportedTable table={note.table} label={C.notebook.importing.table} isDismissed={(c, v) => cur.temp.dismissed.includes(`${c}:${v.trim().toLowerCase()}`)} />
              ) : (
                <RichField
                  key={JSON.stringify(cur.temp.dismissed) + JSON.stringify(note.body).length}
                  id="nb-review-body"
                  label={C.notebook.importing.text}
                  value={note.body as unknown as RichDoc}
                  blocks
                  readOnly
                  pages={note.anchors}
                  flags={{ isDismissed: (c, v) => cur.temp.dismissed.includes(`${c}:${v.trim().toLowerCase()}`), tip: C.notebook.flagTip, version: cur.temp.dismissed.join('\n') }}
                  testId="nb-review-body"
                  onChange={() => undefined}
                />
              )}
            </div>
            {step.kind === 'choose' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {flags.length ? (
                  <>
                    <button type="button" className="bx-btn-primary ax-tap" onClick={() => finish('labelled', labelAll(cur.temp))} data-testid="nb-review-label-all">{T.labelAll}</button>
                    <button type="button" className="bx-btn ax-tap" onClick={() => oneByOne(cur.temp)} data-testid="nb-review-one">{T.oneByOne}</button>
                    <button type="button" className="bx-btn ax-tap" onClick={() => setStep({ kind: 'keep' })} data-testid="nb-review-keep">{T.keep}</button>
                  </>
                ) : (
                  <button type="button" className="bx-btn-primary ax-tap" onClick={() => finish('none')} data-testid="nb-review-save">{T.save}</button>
                )}
                <button type="button" className="bx-btn ax-tap" onClick={skip} data-testid="nb-review-skip">{T.skip}</button>
              </div>
            )}
            {step.kind === 'keep' && (
              <div className="mt-3 rounded border border-[color:var(--bx-line)] p-2" role="alertdialog" aria-labelledby="nb-keep-q" data-testid="nb-review-keep-confirm">
                <p id="nb-keep-q" className="m-0 text-sm">{T.keepConfirm}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="bx-btn-primary ax-tap" onClick={() => finish('kept')} data-testid="nb-review-keep-yes">{T.keepYes}</button>
                  <button type="button" className="bx-btn ax-tap" onClick={() => setStep({ kind: 'choose' })}>{T.back}</button>
                </div>
              </div>
            )}
            {step.kind === 'one' && flags[0] && (
              <div className="mt-3 rounded border border-[color:var(--bx-line)] p-2" data-testid="nb-review-flag" data-category={flags[0].category}>
                <p className="m-0 text-sm">
                  {T.flagN} 1 {T.reviewOf} {flags.length}: <span className="font-semibold">{C.notebook.categories[flags[0].category]}</span> <mark className="nb-flag">{flags[0].value}</mark>
                </p>
                <p className="m-0 text-xs bx-muted">{flags[0].context}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="bx-btn-primary ax-tap" onClick={() => oneByOne(labelFlag(cur.temp, flags[0]).notebook)} data-testid="nb-review-flag-label">{C.notebook.label}</button>
                  <button type="button" className="bx-btn ax-tap" onClick={() => oneByOne(dismissFlag(cur.temp, flags[0].category, flags[0].value))} data-testid="nb-review-flag-dismiss">{C.notebook.dismiss}</button>
                </div>
              </div>
            )}
          </section>
        )}
        {!cur && !reading && (
          <div className="mt-3 border-t border-[color:var(--bx-line)] pt-3 text-sm" data-testid="nb-import-summary">
            {log.saved.length > 0 && <p className="m-0">{T.saved} {log.saved.join(', ')}.</p>}
            {log.skipped.length > 0 && <p className="m-0">{T.skipped} {log.skipped.join(', ')}.</p>}
            <button type="button" className="bx-btn-primary ax-tap mt-2" onClick={close} data-testid="nb-import-done">{T.done}</button>
          </div>
        )}
      </Dialog>
    </>
  );
});
