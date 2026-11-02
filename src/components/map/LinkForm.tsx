import { useId, useMemo, useState } from 'react';
import { S } from '@/lib/data/core';
import { C } from '@/lib/copy';
import { checkLink, scopeOf, type CheckResult } from '@/lib/model/evidence';
import { newEdge, ModelError, type MapEdge, type SdohMap } from '@/lib/model/map';
import { emptyDoc, isEmpty, type RichDoc } from '@/lib/model/rich';
import { DEFAULT_WEIGHT, edgeError, type Polarity } from '@/lib/analysis';
import { CitedText } from '@/components/evidence/CitedText';
import { GradeChip } from '@/components/ui/bits';
import { EdgeFields, type EdgeDraft } from './Forms';
import RichField from './RichField';

/** The check result, in words: evidence (with the link's citation) or why it is not supported (UI-18). */
export function CheckNote({ r, onUse }: { r: CheckResult; onUse?: (p: Polarity) => void }) {
  if (r.check === 'match' && r.link) {
    return (
      <div className="bx-banner mb-3" data-testid="check-note" data-check="match">
        <p className="font-semibold">
          {C.evidence.supported} <span className="font-mono">{r.link.id}</span> <GradeChip grade={r.link.grade} />
        </p>
        <CitedText text={r.link.mechanism} className="mt-1 bx-prose text-sm leading-6" />
      </div>
    );
  }
  return (
    <div className="bx-card mb-3 border-l-4 p-3 text-sm" style={{ borderLeftColor: 'var(--ax-neg)' }} data-testid="check-note" data-check={r.check}>
      <p className="font-semibold">⚑ {C.evidence.notSupported}</p>
      <p className="mt-1" data-testid="check-message">{r.message}</p>
      {r.check === 'opposite-polarity' && r.link && onUse && (
        <button type="button" className="bx-btn ax-tap mt-2" onClick={() => onUse(r.link!.polarity)} data-testid="use-evidence-polarity">
          {C.evidence.usePolarity} {r.link.polarity} ({r.link.id})
        </button>
      )}
      {r.check !== 'opposite-polarity' && r.alternatives.length > 0 && (
        <p className="mt-2 text-xs bx-muted">
          {C.evidence.nearest}: {r.alternatives.map((l) => `${l.id} ${scopeOf(l)} (${l.polarity})`).join(' · ')}
        </p>
      )}
    </div>
  );
}

/** Confirm-and-reason block for an override; the reason is required (rich text). */
export function OverrideConfirm({ confirmed, reason, onConfirmed, onReason }: { confirmed: boolean; reason: RichDoc; onConfirmed: (b: boolean) => void; onReason: (d: RichDoc) => void }) {
  const id = useId();
  return (
    <fieldset className="mb-3 rounded-md border border-[color:var(--bx-line)] p-3" data-testid="override-confirm">
      <legend className="px-1 text-sm font-semibold">{C.evidence.overrideTitle}</legend>
      <label className="inline-flex items-start gap-2 text-sm ax-tap">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirmed(e.target.checked)} data-testid="override-checkbox" className="mt-1" aria-labelledby={`${id}-ok`} />
        <span id={`${id}-ok`}>{C.evidence.overrideConfirm}</span>
      </label>
      <div className="mt-2">
        <label htmlFor={`${id}-why`} className="mb-1 block text-sm font-semibold">{C.evidence.overrideReason}</label>
        <RichField id={`${id}-why`} label={C.evidence.overrideReason} value={reason} onChange={onReason} describedBy={`${id}-why-n`} />
        <p id={`${id}-why-n`} className="mt-1 text-xs bx-muted" data-testid="deidentify-nudge">{S.deidentify}</p>
      </div>
    </fieldset>
  );
}

/**
 * UI-17/UI-18 link form: From, a searchable To list, the live evidence check, the edge fields, and — when the link is
 * not backed by evidence — a required, deliberate override with a reason. It cannot be saved otherwise.
 */
export function LinkForm({ map, nm, from, to, onCancel, onCreate }: { map: SdohMap; nm: (id: string) => string; from: string | null; to: string | null; onCancel: () => void; onCreate: (e: MapEdge) => void }) {
  const id = useId();
  const nodes = map.nodes.filter((n) => n.kind !== 'note');
  const first = from && nodes.some((n) => n.id === from) ? from : nodes[0]?.id ?? '';
  const [a, setA] = useState(first);
  const [b, setB] = useState(() => (to && to !== first ? to : nodes.find((n) => n.id !== first)?.id ?? ''));
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<EdgeDraft>(() => ({ polarity: '+', weight: DEFAULT_WEIGHT, delay: false, confidence: 'medium', description: emptyDoc(), style: { line: 'solid', route: 'curved', widthByWeight: true } }));
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState<RichDoc>(emptyDoc());
  const [err, setErr] = useState<string | null>(null);
  const A = nodes.find((n) => n.id === a);
  const B = nodes.find((n) => n.id === b);
  const r = useMemo(() => (A && B ? checkLink(A, B, draft.polarity, { from: nm(A.id), to: nm(B.id) }) : null), [A, B, draft.polarity, nm]);
  const evidence = r?.check === 'match';
  const canSave = !!A && !!B && a !== b && (evidence || (confirmed && !isEmpty(reason)));
  const others = nodes.filter((n) => n.id !== a && nm(n.id).toLowerCase().includes(q.trim().toLowerCase()));
  const exists = map.edges.some((e) => e.from === a && e.to === b);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        const edge = newEdge({ from: a, to: b, ...draft, ...(evidence ? { basis: 'evidence' as const } : { basis: 'override' as const, override_reason: reason }) });
        const msg = edgeError(edge);
        if (msg) return setErr(msg);
        try {
          onCreate(edge);
        } catch (x) {
          setErr(x instanceof ModelError ? x.message : String(x));
        }
      }}
    >
      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-semibold">{C.edge.from}</span>
        <select className="bx-input ax-tap" value={a} onChange={(e) => setA(e.target.value)} data-testid="edge-from">
          {nodes.map((n) => <option key={n.id} value={n.id}>{nm(n.id)}</option>)}
        </select>
      </label>
      <fieldset className="mb-3">
        <legend className="mb-1 text-sm font-semibold">{C.edge.to}</legend>
        <label htmlFor={`${id}-q`} className="sr-only">{C.evidence.searchNodes}</label>
        <input id={`${id}-q`} className="bx-input ax-tap" type="search" placeholder={C.evidence.searchNodes} value={q} onChange={(e) => setQ(e.target.value)} data-testid="link-search" />
        <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-[color:var(--bx-line)] p-1" role="radiogroup" aria-label={C.edge.to} tabIndex={-1}>
          {others.map((n) => (
            <label key={n.id} className={`ax-tap flex cursor-pointer items-center gap-2 rounded px-2 text-sm ${b === n.id ? 'bx-btn-on' : 'hover:bg-paper-2 dark:hover:bg-night'}`}>
              <input type="radio" name={`${id}-to`} checked={b === n.id} onChange={() => setB(n.id)} data-testid="link-target" data-node={n.id} aria-labelledby={`${id}-to-${n.id}`} />
              <span id={`${id}-to-${n.id}`}>{nm(n.id)}{n.code ? <span className="font-mono text-xs"> · {n.code}</span> : null}</span>
            </label>
          ))}
          {!others.length && <p className="p-2 text-sm bx-muted">{C.list.none}</p>}
        </div>
      </fieldset>
      {exists && <p className="mb-2 text-xs bx-muted">{C.evidence.alreadyLinked}</p>}
      {r && <CheckNote r={r} onUse={(p) => setDraft((d) => ({ ...d, polarity: p, weight: (p === '+' ? 1 : -1) * Math.abs(d.weight) }))} />}
      <EdgeFields draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
      {r && !evidence && <OverrideConfirm confirmed={confirmed} reason={reason} onConfirmed={setConfirmed} onReason={setReason} />}
      {err && <p role="alert" className="bx-todo my-2" data-testid="edge-error">{err}</p>}
      {!canSave && r && !evidence && <p className="mb-2 text-sm" data-testid="override-needed">{C.evidence.cannotSave}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" className="bx-btn-primary ax-tap" data-testid="edge-submit" disabled={!canSave}>
          {evidence ? C.edge.add : C.evidence.saveOverride}
        </button>
        <button type="button" className="bx-btn ax-tap" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** The basis of an existing edge, in the inspector and the list view: evidence, override (with reason), needs-review. */
export function BasisPanel({ edge, map, nm, onPatch }: { edge: MapEdge; map: SdohMap; nm: (id: string) => string; onPatch: (p: Partial<MapEdge>) => void }) {
  const A = map.nodes.find((n) => n.id === edge.from)!;
  const B = map.nodes.find((n) => n.id === edge.to)!;
  const r = checkLink(A, B, edge.polarity, { from: nm(A.id), to: nm(B.id) });
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState<RichDoc>(edge.override_reason ?? emptyDoc());
  return (
    <section className="mt-3" aria-label={C.evidence.basis} data-testid="basis-panel" data-basis={edge.basis}>
      <h3 className="font-semibold">
        {C.evidence.basis}: <span data-testid="basis-value">{C.evidence.basisLabel[edge.basis]}</span>
      </h3>
      {edge.basis === 'evidence' ? (
        <CheckNote r={r} />
      ) : (
        <>
          <CheckNote r={r} onUse={(p) => onPatch({ polarity: p, weight: (p === '+' ? 1 : -1) * Math.abs(edge.weight) })} />
          {edge.basis === 'override' && (
            <>
              <p className="text-sm">
                <span className="font-semibold">{C.evidence.overrideReason}</span> ({C.evidence.confirmedOn} {edge.override_at}):
              </p>
              <RichField id={`why-${edge.id}`} label={C.evidence.overrideReason} value={edge.override_reason ?? emptyDoc()} onChange={(d) => !isEmpty(d) && onPatch({ override_reason: d })} />
              {r.check === 'match' && (
                <button type="button" className="bx-btn ax-tap mt-2" onClick={() => onPatch({ basis: 'evidence' })} data-testid="use-evidence">
                  {C.evidence.useEvidence} {r.link?.id}
                </button>
              )}
            </>
          )}
          {edge.basis === 'needs-review' && (
            <div data-testid="needs-review">
              <p className="mb-2 text-sm">{C.evidence.reviewLead}</p>
              {r.check === 'match' ? (
                <button type="button" className="bx-btn ax-tap" onClick={() => onPatch({ basis: 'evidence' })} data-testid="use-evidence">
                  {C.evidence.useEvidence} {r.link?.id}
                </button>
              ) : (
                <>
                  <OverrideConfirm confirmed={confirmed} reason={reason} onConfirmed={setConfirmed} onReason={setReason} />
                  <button type="button" className="bx-btn-primary ax-tap" disabled={!confirmed || isEmpty(reason)} onClick={() => onPatch({ basis: 'override', override_reason: reason, override_at: null })} data-testid="confirm-override">
                    {C.evidence.saveOverride}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
