import { useId, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react';
import { C } from '../../lib/copy';
import { searchTargets, type TargetContext } from '../../lib/model/targets';
import type { Target } from '../../lib/model/notebook';

const P = () => C.notebook.passages;

/**
 * SL28 point 1: one picker over every item kind — circumstances, links, loops (by their node cycle), clusters, ICD-11
 * codes, references (the pack's and the map's own), glossary terms, 101s, other notes and passages, and the host's own
 * kinds — for a passage's Link to… and for an @ mention. Grouped results under headings; ↓ from the search goes into
 * them, ↑ / ↓ move, Home / End jump, and Esc closes (the dialog's own).
 */
export function TargetPicker({ ctx, quote, lead, onPick, onCancel, top, note, span, testId = 'target-picker' }: {
  ctx: TargetContext;
  /** the passage being linked (left out for a mention) */
  quote?: string;
  lead: string;
  onPick: (t: Target, label: string) => void;
  onCancel: () => void;
  /** above the results: Link to…'s "Draw a new link…" */
  top?: ReactNode;
  /** the note (and span) the picker was opened from, left out of the results */
  note?: string;
  span?: string;
  testId?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const [q, setQ] = useState('');
  const groups = useMemo(() => searchTargets(q, ctx, { note, span }), [q, ctx, note, span]);
  const box = useRef<HTMLDivElement>(null);
  const items = () => Array.from(box.current?.querySelectorAll<HTMLElement>('[data-picker-item]') ?? []);
  const onListKey = (e: RKeyboardEvent) => {
    const els = items();
    const i = els.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => els[Math.max(0, Math.min(els.length - 1, j))]?.focus();
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') {
      if (i <= 0) document.getElementById(`${uid}-q`)?.focus();
      else go(i - 1);
    } else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(els.length - 1);
    else return;
    e.preventDefault();
  };
  const n = groups.reduce((a, g) => a + g.items.length, 0);
  return (
    <div data-testid={testId}>
      {quote !== undefined && (
        <p className="mb-2 text-sm">
          {P().fromText} <span className="sx-span">“{quote.length > 140 ? `${quote.slice(0, 139)}…` : quote}”</span>
        </p>
      )}
      <p className="mb-2 text-sm bx-muted">{lead}</p>
      {top}
      <label htmlFor={`${uid}-q`} className="sr-only">{P().linkSearch}</label>
      <input
        id={`${uid}-q`}
        type="search"
        className="bx-input ax-tap w-full"
        placeholder={P().linkSearch}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            items()[0]?.focus();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            items()[0]?.click();
          }
        }}
        aria-describedby={`${uid}-n`}
        data-autofocus
        data-testid="picker-search"
      />
      <p id={`${uid}-n`} className="sr-only" role="status">{n ? `${n} results` : P().linkNone}</p>
      <div ref={box} className="mt-2 max-h-[50vh] overflow-y-auto overscroll-contain" onKeyDown={onListKey}>
        {groups.map((g) => (
          <section key={g.kind} aria-labelledby={`${uid}-${g.kind}`} data-testid="picker-group" data-kind={g.kind}>
            <h3 id={`${uid}-${g.kind}`} className="m-0 mt-2 text-sm font-semibold">{g.label}</h3>
            <ul className="mt-1">
              {g.items.map((it) => (
                <li key={`${it.t.kind}:${it.t.id}`}>
                  <button
                    type="button"
                    data-picker-item
                    className="ax-tap flex w-full flex-col items-start rounded px-2 py-1 text-left text-sm hover:bg-paper-2 focus:bg-paper-2 dark:hover:bg-night dark:focus:bg-night"
                    onClick={() => onPick(it.t, it.label)}
                    data-testid="picker-item"
                    data-kind={it.t.kind}
                    data-id={it.t.id}
                  >
                    <span>{it.label}</span>
                    {it.detail && <span className="text-xs bx-muted">{it.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!n && <p className="text-sm bx-muted">{P().linkNone}</p>}
      </div>
      <button type="button" className="bx-btn ax-tap mt-3" onClick={onCancel} data-testid="picker-cancel">{P().cancel}</button>
    </div>
  );
}
