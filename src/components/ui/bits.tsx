import type { ReactNode } from 'react';
import { manifest, NUDGE, S, safety } from '@/lib/data/core';

export function AsOf() {
  return <span className="bx-asof" data-testid="as-of">Research current as of {manifest.as_of}</span>;
}
export function Todo({ children }: { children: ReactNode }) {
  return <span className="bx-todo" data-todo>TODO(author): {children}</span>;
}
/** A heuristic's label; the "heuristic ·" prefix only when the label does not already say so (K4 D8). */
export function Heuristic({ label }: { label: string }) {
  return <span className="ax-heuristic" data-heuristic>{/heuristic/i.test(label) ? label : `heuristic · ${label}`}</span>;
}
export function Notice({ compact }: { compact?: boolean }) {
  return (
    <div className={`bx-banner ${compact ? 'mb-0' : ''}`} role="note" data-testid="notice">
      <p className="font-semibold">{S.first_run.title}</p>
      <p className="mt-1">{safety.notice}</p>
    </div>
  );
}
/** SAFETY H3 de-identification nudge, linked to its field by id. */
export function Nudge({ id }: { id: string }) {
  return (
    <p id={id} className="mt-1 text-xs bx-muted" data-testid="deidentify-nudge">
      {NUDGE}
    </p>
  );
}
export function Field({ label, htmlFor, children, nudgeId, hint }: { label: string; htmlFor: string; children: ReactNode; nudgeId?: string; hint?: string }) {
  return (
    <div className="mb-3">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      {hint && <p className="mb-1 text-xs bx-muted">{hint}</p>}
      {children}
      {nudgeId && <Nudge id={nudgeId} />}
    </div>
  );
}
export function GradeChip({ grade }: { grade: string }) {
  const label = S.associations.grade[grade] ?? grade;
  return (
    <span className="bx-chip border border-[color:var(--bx-line)]" title={label} data-grade={grade}>
      {grade} · {label.split(':')[0]}
    </span>
  );
}
export function PolarityChip({ p }: { p: string }) {
  const plus = p === '+';
  return (
    <span className={`bx-chip border border-[color:var(--bx-line)] ${plus ? 'ax-edge-pos' : 'ax-edge-neg'}`} data-polarity={p}>
      {plus ? S.edges.polarity_plus : S.edges.polarity_minus}
    </span>
  );
}
export function PageHead({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl sm:text-4xl font-semibold">{title}</h1>
      {lead && <p className="mt-2 bx-prose">{lead}</p>}
      {children}
    </div>
  );
}
