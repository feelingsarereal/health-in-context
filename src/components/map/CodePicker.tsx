import { useMemo, useState, useId } from 'react';
import { codeMap, groupMap, searchCodes, isFunctioning, type Code } from '@/lib/data/scheme';
import { S } from '@/lib/data/core';
import { Popover } from '@/components/ui/Popover';
import { CodePopout } from './CodePopout';

/**
 * Searchable ICD-11 code picker (UI-01): search over code, title and index terms; codes grouped by block in the
 * scheme's order, residual Y/Z codes after the block's specific codes, functioning codes under their own heading.
 */
export function CodePicker({ value, onPick, only, autoFocus }: { value?: string | null; onPick: (code: string) => void; only?: Code[]; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const id = useId();
  const list = useMemo(() => {
    const hits = searchCodes(q);
    const allowed = only ? new Set(only.map((c) => c.code)) : null;
    return allowed ? hits.filter((c) => allowed.has(c.code)) : hits;
  }, [q, only]);
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
    <div data-testid="code-picker">
      <label htmlFor={`${id}-q`} className="sr-only">Search ICD-11 codes</label>
      <input id={`${id}-q`} className="bx-input ax-tap" type="search" placeholder={S.codes.picker_placeholder} value={q} onChange={(e) => setQ(e.target.value)} data-autofocus={autoFocus ? '' : undefined} data-testid="code-search" />
      <p className="mt-1 text-xs bx-muted" role="status">{list.length} codes</p>
      <div className="mt-1 max-h-72 overflow-y-auto rounded-md border border-[color:var(--bx-line)] p-1">
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
        {!list.length && <p className="p-2 text-sm bx-muted">No code matches “{q}”.</p>}
      </div>
      {value && codeMap.get(value) && <p className="mt-1 text-xs">Chosen: <span className="font-mono">{value}</span> {codeMap.get(value)!.title}</p>}
    </div>
  );
}
