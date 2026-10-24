import { Fragment, useState } from 'react';
import { RefCard } from './RefCard';

const CITE = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g;
function expand(s: string): number[] {
  return s.split(/\s*,\s*/).flatMap((p) => {
    const r = p.split(/\s*[-–]\s*/);
    if (r.length === 2) return Array.from({ length: +r[1] - +r[0] + 1 }, (_, i) => +r[0] + i);
    return [+p];
  });
}

/** Cited prose: each [n] is a bx-cite that opens the reference card as a fold-out under the text (MI pattern). */
export function CitedText({ text, as: Tag = 'p', className }: { text: string; as?: 'p' | 'span' | 'div'; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const parts: (string | number[])[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE)) {
    parts.push(text.slice(last, m.index));
    parts.push(expand(m[1]));
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return (
    <>
      <Tag className={className}>
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            <Fragment key={i}>{p}</Fragment>
          ) : (
            <Fragment key={i}>
              {p.map((n) => (
                <button key={n} type="button" className="bx-cite px-0.5" aria-expanded={open === n} aria-label={`Reference ${n}`} onClick={() => setOpen(open === n ? null : n)}>
                  [{n}]
                </button>
              ))}
            </Fragment>
          ),
        )}
      </Tag>
      {open !== null && (
        <div className="bx-foldout" data-testid="cite-foldout">
          <RefCard n={open} />
        </div>
      )}
    </>
  );
}
