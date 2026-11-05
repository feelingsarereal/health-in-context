import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { C } from '../../lib/copy';
import type { RichDoc } from '../../lib/model/rich';
import RichField from './RichField';

/**
 * SL31: quick field edit in the selection card's Read mode. Hovering or focusing a row shows a small ✎ ("Edit Label");
 * it turns only that field into an editor in place, focused, while the card stays in Read mode. Enter (or a click
 * away) saves as one Undo step, Esc cancels; focus goes back to the ✎ either way, and the live region says
 * "Label saved.". Only text fields come here: codes, code status, polarity, weight, confidence, overrides and delete
 * stay behind Edit mode, because each changes what the evidence check vouches for or needs a reason.
 */
export interface QuickEditApi {
  /** save one field: a single Undo step */
  save: (name: string, change: () => void) => void;
  /** "More formatting": Edit mode, for the full toolbar */
  more: () => void;
}

export function QuickRich({ name, value, view, onSave, quick, singleLine, testId }: {
  /** the field's name, as its row shows it ("Label") */
  name: string;
  value: RichDoc;
  /** the row's read view */
  view: ReactNode;
  onSave: (doc: RichDoc) => void;
  quick: QuickEditApi;
  singleLine?: boolean;
  testId: string;
}) {
  const id = `qe-${useId().replace(/:/g, '')}`;
  const [draft, setDraft] = useState<RichDoc | null>(null);
  const pen = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const back = useRef(false);
  // set once a save or cancel has run, so the blur of the editor leaving the page does not save a second time
  const closed = useRef(false);
  const editing = draft !== null;
  useEffect(() => {
    if (!editing && back.current) {
      back.current = false;
      pen.current?.focus();
    }
  }, [editing]);
  const finish = (save: boolean, focusBack = true) => {
    if (draft === null || closed.current) return;
    closed.current = true;
    const d = draft;
    back.current = focusBack;
    setDraft(null);
    if (save && JSON.stringify(d) !== JSON.stringify(value)) quick.save(name, () => onSave(d));
  };
  if (!editing)
    return (
      <span className="relative flex min-w-0 items-start gap-1" data-qe data-testid={`${testId}-row`}>
        <span className="min-w-0 flex-1">{view}</span>
        <button
          ref={pen}
          type="button"
          className="ax-qe-pen bx-btn shrink-0 px-1.5 py-0 text-xs leading-5"
          aria-label={`${C.quick.edit} ${name}`}
          title={`${C.quick.edit} ${name}`}
          onClick={() => {
            closed.current = false;
            setDraft(value);
          }}
          data-testid={`${testId}-edit`}
        >
          <span aria-hidden>✎</span>
        </button>
      </span>
    );
  return (
    <div
      ref={box}
      className="min-w-0"
      data-testid={`${testId}-editor`}
      onBlur={(e) => {
        // a click away saves; moving between the editor and its own toolbar does not
        const to = e.relatedTarget as Node | null;
        if (to && box.current?.contains(to)) return;
        finish(true, false);
      }}
    >
      <RichField
        id={id}
        label={name}
        value={draft}
        onChange={(d) => setDraft(d)}
        singleLine={singleLine}
        minRows={singleLine ? 1 : 3}
        compact
        autoFocus
        describedBy={`${id}-h`}
        testId={testId}
        onKey={(e) => {
          if (e.key === 'Escape') return finish(false), true;
          if (e.key === 'Enter' && !e.shiftKey) return finish(true), true;
          return false;
        }}
        toolbarEnd={
          singleLine ? null : (
            <button
              type="button"
              className="ml-auto rounded px-1 text-xs underline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                finish(true, false);
                quick.more();
              }}
              data-testid={`${testId}-more`}
            >
              {C.quick.more}
            </button>
          )
        }
      />
      <p id={`${id}-h`} className="mt-1 text-xs bx-muted">{singleLine ? C.quick.hintLine : C.quick.hint}</p>
    </div>
  );
}

/** SL31: a yes / no field ("Pinned in place", a link's delay) as a switch: one click is one saved, undoable change */
export function QuickToggle({ name, on, onChange, quick, testId }: { name: string; on: boolean; onChange: (on: boolean) => void; quick: QuickEditApi; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={name}
      className={`bx-btn ax-tap px-2 py-0 text-sm ${on ? 'bx-btn-on' : ''}`}
      onClick={() => quick.save(name, () => onChange(!on))}
      data-testid={testId}
    >
      {on ? C.quick.on : C.quick.off}
    </button>
  );
}
