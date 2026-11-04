import { useId, useState } from 'react';
import { S } from '../../lib/data/core';
import { codeMap, type Code } from '../../lib/data/scheme';
import { C } from '../../lib/copy';
import { Field, Nudge } from '../ui/bits';
import { CODE_STATUSES, CONFIDENCES, OTHER_TYPES, type MapEdge, type MapNode } from '../../lib/model/map';
import { WEIGHT_STEPS } from '../../lib/analysis';
import { USER_COLOURS } from '../../lib/palette';
import RichField from './RichField';
import { CodePicker } from './CodePicker';

export type NodeDraft = Pick<MapNode, 'code_status' | 'code' | 'type' | 'ref' | 'label' | 'circumstance' | 'severity' | 'since' | 'notes' | 'style' | 'pinned' | 'kind'>;

/** The circumstance fields (UI-01, UI-04, UI-16). Used by the new-node dialog, the inspector and the list view. */
export function NodeFields({ draft, onChange, pickerOpen, only, suggested, compact }: { draft: NodeDraft; onChange: (p: Partial<NodeDraft>, key?: string) => void; pickerOpen?: boolean; only?: Code[]; suggested?: string[]; compact?: boolean }) {
  const id = useId();
  const [picking, setPicking] = useState(!!pickerOpen);
  if (draft.kind === 'note') {
    return (
      <Field label={C.node.note} htmlFor={`${id}-note`} nudgeId={`${id}-note-n`}>
        <RichField id={`${id}-note`} label={C.node.note} value={draft.notes} onChange={(d) => onChange({ notes: d }, 'notes')} describedBy={`${id}-note-n`} minRows={3} />
      </Field>
    );
  }
  const code = draft.code ? codeMap.get(draft.code) : undefined;
  return (
    <div>
      <fieldset className="mb-3">
        <legend className="mb-1 text-sm font-semibold">{C.node.status}</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          {CODE_STATUSES.map((st) => (
            <label key={st} className={`bx-btn ax-tap cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--bx-accent)] ${draft.code_status === st ? 'bx-btn-on' : ''}`}>
              <input type="radio" className="sr-only" name={`${id}-status`} value={st} checked={draft.code_status === st} onChange={() => onChange({ code_status: st })} data-testid={`status-${st}`} aria-labelledby={`${id}-st-${st}`} />
              <span id={`${id}-st-${st}`}>{S.codes.status[st]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {draft.code_status === 'undetermined' && !pickerOpen && !picking && (
        <button type="button" className="bx-btn ax-tap mb-3" onClick={() => setPicking(true)} data-testid="choose-code">
          {C.node.chooseCode}
        </button>
      )}
      {(draft.code_status === 'sdoh' || (draft.code_status === 'undetermined' && (pickerOpen || picking))) && (
        <div className="mb-3">
          <p className="mb-1 text-sm font-semibold">{C.node.code}</p>
          {code && (
            <p className="mb-1 text-sm" data-testid="chosen-code">
              <span className="font-mono">{code.code}</span> {code.title}
            </p>
          )}
          {suggested && suggested.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold bx-muted">{C.assoc.suggested}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {suggested.map((c) => (
                  <button key={c} type="button" className={`bx-btn ax-tap ${draft.code === c ? 'bx-btn-on' : ''}`} aria-pressed={draft.code === c} onClick={() => onChange({ code: c, code_status: 'sdoh' })} data-suggest={c}>
                    <span className="font-mono text-xs">{c}</span> {codeMap.get(c)?.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {picking || !code ? (
            <>
              {only && <p className="mb-1 text-xs bx-muted">{C.assoc.inBlock}</p>}
              <CodePicker value={draft.code} only={only} autoFocus={pickerOpen} onPick={(c) => { onChange({ code: c, code_status: 'sdoh' }); if (!pickerOpen) setPicking(false); }} />
            </>
          ) : (
            <button type="button" className="bx-btn ax-tap" onClick={() => setPicking(true)} data-testid="change-code">
              {C.node.changeCode}
            </button>
          )}
        </div>
      )}

      {draft.code_status === 'other' && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <Field label={C.node.type} htmlFor={`${id}-type`}>
            <select id={`${id}-type`} className="bx-input ax-tap" value={draft.type ?? ''} onChange={(e) => onChange({ type: (e.target.value || null) as NodeDraft['type'] })} data-testid="other-type">
              <option value="">—</option>
              {OTHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label={C.node.ref} htmlFor={`${id}-ref`}>
            <input id={`${id}-ref`} className="bx-input ax-tap" value={draft.ref ?? ''} onChange={(e) => onChange({ ref: e.target.value || null }, 'ref')} />
          </Field>
        </div>
      )}

      <Field label={C.node.label} htmlFor={`${id}-label`} nudgeId={`${id}-label-n`}>
        <RichField id={`${id}-label`} label={C.node.label} value={draft.label} onChange={(d) => onChange({ label: d }, 'label')} describedBy={`${id}-label-n`} singleLine />
      </Field>
      {/* K6 D6: the variable hint is about how to word the circumstance, so it sits with that field */}
      <Field label={C.node.circumstance} htmlFor={`${id}-circ`} nudgeId={`${id}-circ-n`} hint={C.node.variableHint} hintId={`${id}-circ-h`}>
        <RichField id={`${id}-circ`} label={C.node.circumstance} value={draft.circumstance} onChange={(d) => onChange({ circumstance: d }, 'circumstance')} describedBy={`${id}-circ-h ${id}-circ-n`} />
      </Field>
      {!compact && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={C.node.severity} htmlFor={`${id}-sev`}>
              <select id={`${id}-sev`} className="bx-input ax-tap" value={draft.severity ?? ''} onChange={(e) => onChange({ severity: e.target.value === '' ? null : (+e.target.value as 0) })}>
                <option value="">—</option>
                {[0, 1, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label={C.node.since} htmlFor={`${id}-since`}>
              <input id={`${id}-since`} className="bx-input ax-tap" placeholder="e.g. 2026-03 or unknown" value={draft.since ?? ''} onChange={(e) => onChange({ since: e.target.value || null }, 'since')} />
            </Field>
          </div>
          <Field label={C.node.notes} htmlFor={`${id}-notes`} nudgeId={`${id}-notes-n`}>
            <RichField id={`${id}-notes`} label={C.node.notes} value={draft.notes} onChange={(d) => onChange({ notes: d }, 'notes')} describedBy={`${id}-notes-n`} />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={C.node.fill} htmlFor={`${id}-fill`}>
              <select id={`${id}-fill`} className="bx-input ax-tap w-auto" value={draft.style.fill ?? ''} onChange={(e) => onChange({ style: { ...draft.style, fill: e.target.value || null } })}>
                <option value="">Block color</option>
                {USER_COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <label className="mb-3 inline-flex items-center gap-2 text-sm ax-tap">
              <input type="checkbox" checked={draft.pinned} onChange={(e) => onChange({ pinned: e.target.checked })} aria-labelledby={`${id}-pin`} /> <span id={`${id}-pin`}>{C.node.pinned}</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}

export type EdgeDraft = Pick<MapEdge, 'polarity' | 'weight' | 'delay' | 'confidence' | 'description' | 'style'>;

/** UI-05 edge fields: polarity, weight (sign locked to polarity, 5-step and free entry), delay, confidence, description, line. */
export function EdgeFields({ draft, onChange }: { draft: EdgeDraft; onChange: (p: Partial<EdgeDraft>, key?: string) => void }) {
  const id = useId();
  const mag = Math.abs(draft.weight);
  const sign = draft.polarity === '+' ? 1 : -1;
  const [free, setFree] = useState(String(mag));
  const setMag = (m: number) => onChange({ weight: sign * m }, 'weight');
  return (
    <div>
      <fieldset className="mb-3">
        <legend className="mb-1 text-sm font-semibold">{C.edge.polarity}</legend>
        <div className="flex flex-wrap gap-1.5">
          {(['+', '−'] as const).map((p) => (
            <label key={p} className={`bx-btn ax-tap cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--bx-accent)] ${draft.polarity === p ? 'bx-btn-on' : ''}`}>
              <input type="radio" className="sr-only" name={`${id}-pol`} checked={draft.polarity === p} onChange={() => onChange({ polarity: p, weight: (p === '+' ? 1 : -1) * mag })} data-testid={`polarity-${p === '+' ? 'plus' : 'minus'}`} aria-labelledby={`${id}-pol-${p === '+' ? 'plus' : 'minus'}`} />
              <span id={`${id}-pol-${p === '+' ? 'plus' : 'minus'}`}>{p === '+' ? S.edges.polarity_plus : S.edges.polarity_minus}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mb-3">
        <legend className="mb-1 text-sm font-semibold">{C.edge.weight}: <span data-testid="weight-value">{draft.weight > 0 ? '+' : '−'}{mag}</span></legend>
        <p className="mb-1 text-xs bx-muted">{S.edges.weight_help}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {WEIGHT_STEPS.map((w) => (
            <button key={w} type="button" className={`bx-btn ax-tap ${Math.abs(mag - w) < 1e-9 ? 'bx-btn-on' : ''}`} aria-pressed={Math.abs(mag - w) < 1e-9} onClick={() => { setMag(w); setFree(String(w)); }} data-weight={w}>
              {draft.polarity}{w}
            </button>
          ))}
          <label className="inline-flex items-center gap-1 text-sm">
            <span className="sr-only">Weight magnitude, 0 to 1</span>
            <span aria-hidden>{draft.polarity}</span>
            <input
              className="bx-input ax-tap w-24"
              type="number"
              min={0.01}
              max={1}
              step="any"
              value={free}
              data-testid="weight-free"
              onChange={(e) => {
                setFree(e.target.value);
                const v = Math.abs(parseFloat(e.target.value));
                if (v > 0 && v <= 1) setMag(v);
              }}
            />
          </label>
        </div>
      </fieldset>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="inline-flex items-center gap-2 text-sm ax-tap">
          <input type="checkbox" checked={draft.delay} onChange={(e) => onChange({ delay: e.target.checked })} data-testid="edge-delay" aria-labelledby={`${id}-delay`} /> <span id={`${id}-delay`}>{C.edge.delay}</span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">{C.edge.confidence}</span>
          <select className="bx-input ax-tap w-auto" value={draft.confidence} onChange={(e) => onChange({ confidence: e.target.value as EdgeDraft['confidence'] })}>
            {CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <Field label={C.edge.description} htmlFor={`${id}-desc`} nudgeId={`${id}-desc-n`}>
        <RichField id={`${id}-desc`} label={C.edge.description} value={draft.description} onChange={(d) => onChange({ description: d }, 'description')} describedBy={`${id}-desc-n`} />
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">{C.edge.line}</span>
          <select className="bx-input ax-tap w-auto" value={draft.style.line ?? 'solid'} onChange={(e) => onChange({ style: { ...draft.style, line: e.target.value as 'solid' } })}>
            <option value="solid">solid</option><option value="dashed">dashed</option><option value="dotted">dotted</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">{C.edge.route}</span>
          <select className="bx-input ax-tap w-auto" value={draft.style.route ?? 'curved'} onChange={(e) => onChange({ style: { ...draft.style, route: e.target.value as 'curved' } })}>
            <option value="curved">curved</option><option value="straight">straight</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">{C.edge.colour}</span>
          <select className="bx-input ax-tap w-auto" value={draft.style.color ?? ''} onChange={(e) => onChange({ style: { ...draft.style, color: e.target.value || null } })}>
            <option value="">By polarity</option>
            {USER_COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="mb-1 inline-flex items-center gap-2 text-sm ax-tap">
          <input type="checkbox" checked={draft.style.widthByWeight !== false} onChange={(e) => onChange({ style: { ...draft.style, widthByWeight: e.target.checked } })} aria-labelledby={`${id}-width`} /> <span id={`${id}-width`}>{C.edge.thickness}</span>
        </label>
      </div>
    </div>
  );
}

export { Nudge };
