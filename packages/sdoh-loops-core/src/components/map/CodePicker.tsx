import { useEffect, useMemo, useRef, useState, useId, type KeyboardEvent as RKeyboardEvent } from 'react';
import { aliasHits, codeMap, groupMap, searchCodes, isFunctioning, type Code } from '../../lib/data/scheme';
import { S } from '../../lib/data/core';
import { C } from '../../lib/copy';
import { Popover } from '../ui/Popover';
import { CodePopout } from './CodePopout';

/**
 * Searchable ICD-11 code picker (UI-01): search over code, title and index terms; codes grouped by block in the
 * scheme's order, residual Y/Z codes after the block's specific codes, functioning codes under their own heading.
 * A query that hits a builder search alias (K5: 'evict' → QD71.Z) puts that code at the top, with the alias note.
 * SL34 `collapsible`: the list opens only when the search box is focused or typed in, or from the ▾; ↓ moves into it,
 * Tab and Esc close it, so a keyboard user does not walk through every code.
 */
export function CodePicker({ value, onPick, only, autoFocus, collapsible, focusOnMount }: { value?: string | null; onPick: (code: string) => void; only?: Code[]; autoFocus?: boolean; collapsible?: boolean; focusOnMount?: boolean }) {
  const [q, setQ] = useState('');
  const id = useId();
  const [open, setOpen] = useState(!collapsible);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!collapsible || !open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      // the ⓘ popover is portalled out of the picker, and belongs to it
      if (!root.current?.contains(t) && !t.closest?.('[data-testid="popover"]')) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [collapsible, open]);
  const onInputKey = (e: RKeyboardEvent) => {
    if (!collapsible) return;
    if (e.key === 'Tab') setOpen(false);
    else if (e.key === 'Enter') {
      // never the dialog's submit: Enter takes the first code listed
      e.preventDefault();
      listEl.current?.querySelector<HTMLElement>('button')?.click();
    }
    else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = () => listEl.current?.querySelector<HTMLElement>('button')?.focus();
      if (open) first();
      else {
        setOpen(true);
        requestAnimationFrame(first);
      }
    }
  };
  const onListKey = (e: RKeyboardEvent) => {
    if (!collapsible) return;
    const els = Array.from(listEl.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') els[Math.min(i + 1, els.length - 1)]?.focus();
    else if (e.key === 'ArrowUp') (i <= 0 ? input.current : els[i - 1])?.focus();
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      input.current?.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const { list, aliases } = useMemo(() => {
    const allowed = only ? new Set(only.map((c) => c.code)) : null;
    const aliases = aliasHits(q).filter((a) => codeMap.has(a.code) && (!allowed || allowed.has(a.code)));
    const top = new Set(aliases.map((a) => a.code));
    const hits = searchCodes(q).filter((c) => !top.has(c.code));
    return { list: allowed ? hits.filter((c) => allowed.has(c.code)) : hits, aliases };
  }, [q, only]);
  const count = list.length + new Set(aliases.map((a) => a.code)).size;
  const sections = useMemo(() => {
    const sdoh = list.filter((c) => !isFunctioning(c));
    const fn = list.filter((c) => isFunctioning(c));
    const byGroup = new Map<string, Code[]>();
    for (const c of sdoh) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
    return { byGroup: [...byGroup.entries()], fn };
  }, [list]);
  const row = (c: Code) => (
    <li key={c.code} className="flex items-stretch gap-1">
      <button
        type="button"
        className={`ax-tap flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-paper-2 dark:hover:bg-night ${value === c.code ? 'bx-btn-on' : ''}`}
        onClick={() => onPick(c.code)}
        data-code={c.code}
        aria-pressed={value === c.code}
      >
        <span className="font-mono text-xs">{c.code}</span> {c.title}
      </button>
      <Popover className="bx-btn ax-tap justify-center px-2" label={`About ${c.code}`} trigger="ⓘ">
        <CodePopout code={c.code} />
      </Popover>
    </li>
  );
  return (
    <div ref={root} data-testid="code-picker" data-open={open ? 'true' : 'false'}>
      <label htmlFor={`${id}-q`} className="sr-only">Search ICD-11 codes</label>
      <div className="flex items-stretch gap-1">
        <input ref={input} id={`${id}-q`} className="bx-input ax-tap" type="search" placeholder={S.codes.picker_placeholder} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onInputKey} data-autofocus={autoFocus ? '' : undefined} data-testid="code-search" />
        {collapsible && <button type="button" className="bx-btn ax-tap justify-center px-2" aria-label={C.toolbar.showCodes} aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="code-list-toggle"><span aria-hidden="true">{open ? '▴' : '▾'}</span></button>}
      </div>
      {open && <>
      <p className="mt-1 text-xs bx-muted" role="status">{count} {count === 1 ? "code" : "codes"}</p>
      <div ref={listEl} onKeyDown={onListKey} className="mt-1 max-h-72 overflow-y-auto rounded-md border border-[color:var(--bx-line)] p-1" data-testid="code-list">
        {aliases.map((a) => (
          <section key={a.term} aria-label={`${S.codes.builder_alias}: ${a.term}`} className="mb-1 rounded-md bg-paper-2 dark:bg-night" data-testid="alias-hit" data-alias={a.term}>
            <h4 className="px-2 py-1 text-xs font-semibold bx-muted">“{a.term}” · {S.codes.builder_alias}</h4>
            <ul>{row(codeMap.get(a.code)!)}</ul>
            <p className="px-2 pb-2 text-xs" data-testid="alias-note">{a.note}</p>
          </section>
        ))}
        {sections.byGroup.map(([g, cs]) => (
          <section key={g} aria-label={`${g} ${groupMap.get(g)?.title ?? ''}`}>
            <h4 className="sticky top-0 bg-[color:var(--bx-bg)] dark:bg-night-2 px-2 py-1 text-xs font-semibold bx-muted">{g} · {groupMap.get(g)?.title}</h4>
            <ul>{cs.map(row)}</ul>
          </section>
        ))}
        {sections.fn.length > 0 && (
          <section aria-label="Functioning (outside the SDOH set)">
            <h4 className="sticky top-0 bg-[color:var(--bx-bg)] dark:bg-night-2 px-2 py-1 text-xs font-semibold bx-muted">Functioning (outside the SDOH set)</h4>
            <ul>{sections.fn.map(row)}</ul>
          </section>
        )}
        {!count && <p className="p-2 text-sm bx-muted">No code matches “{q}”.</p>}
      </div>
      </>}
      {!collapsible && value && codeMap.get(value) && <p className="mt-1 text-xs">Chosen: <span className="font-mono">{value}</span> {codeMap.get(value)!.title}</p>}
    </div>
  );
}
