import { useId, useMemo, useState, type ReactNode } from 'react';
import { C } from '../../lib/copy';
import { codeMap } from '../../lib/data/scheme';
import { suggestCodes } from '../../lib/model/suggest';
import { plainText } from '../../lib/model/rich';
import type { SdohMap } from '../../lib/model/map';
import type { Span, Target } from '../../lib/model/notebook';

const P = () => C.notebook.passages;

/** The text with the given words marked (case-insensitive, whole words). */
export function marked(text: string, words: string[]): ReactNode {
  if (!words.length) return text;
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<![\\p{L}'])(${esc.join('|')})(?![\\p{L}])`, 'giu');
  const out: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(at, m.index), <mark key={m.index} className="rounded-sm bg-[color:var(--sx-tint)] px-0.5 font-semibold text-inherit underline">{m[0]}</mark>);
    at = m.index! + m[0].length;
  }
  out.push(text.slice(at));
  return out;
}

export type FromChoice = { kind: 'code'; code: string } | { kind: 'undetermined' } | { kind: 'other' } | { kind: 'search' };

/**
 * SL27: the suggested codes for a selection — the top five from the local suggester, each with its matched words
 * marked and labelled "suggested", then "Not sure yet", "Other (not an SDOH code)" and "Search all codes". Nothing is
 * chosen until the user picks.
 */
export function SuggestPanel({ text, choice, onPick }: { text: string; choice: FromChoice | null; onPick: (c: FromChoice) => void }) {
  const uid = useId();
  const list = useMemo(() => suggestCodes(text), [text]);
  const on = (c: FromChoice) => !!choice && choice.kind === c.kind && (c.kind !== 'code' || (choice.kind === 'code' && choice.code === c.code));
  const btn = 'bx-btn ax-tap flex w-full flex-col items-start gap-0.5 px-2 py-1 text-left';
  return (
    <fieldset className="mb-3 rounded border border-[color:var(--bx-line)] p-2" aria-describedby={`${uid}-h`} data-testid="from-suggest-panel">
      <legend className="px-1 text-sm font-semibold">{P().suggestedTitle}</legend>
      <p id={`${uid}-h`} className="m-0 mb-2 text-xs bx-muted">{P().suggestHint}</p>
      {list.length ? (
        <ul className="space-y-1">
          {list.map((s) => (
            <li key={s.code}>
              <button type="button" className={`${btn} ${on({ kind: 'code', code: s.code }) ? 'bx-btn-on' : ''}`} aria-pressed={on({ kind: 'code', code: s.code })} onClick={() => onPick({ kind: 'code', code: s.code })} data-testid="from-suggest" data-code={s.code}>
                <span>
                  <span className="font-mono text-xs">{s.code}</span> {s.viaKind === 'title' ? marked(s.title, s.viaWords) : s.title} <span className="bx-chip ml-1 px-1.5 text-xs">{P().suggestedTag}</span>
                </span>
                {s.viaKind !== 'title' && <span className="text-xs bx-muted">“{marked(s.via, s.viaWords)}”</span>}
                {s.words.length > 0 && <span className="text-xs bx-muted">{marked(text.length > 120 ? `${text.slice(0, 119)}…` : text, s.words)}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm bx-muted" data-testid="from-suggest-none">{P().noSuggestion}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <button type="button" className={`bx-btn ax-tap ${on({ kind: 'undetermined' }) ? 'bx-btn-on' : ''}`} aria-pressed={on({ kind: 'undetermined' })} onClick={() => onPick({ kind: 'undetermined' })} data-testid="from-notsure">{P().notSure}</button>
        <button type="button" className={`bx-btn ax-tap ${on({ kind: 'other' }) ? 'bx-btn-on' : ''}`} aria-pressed={on({ kind: 'other' })} onClick={() => onPick({ kind: 'other' })} data-testid="from-other">{P().otherOpt}</button>
        <button type="button" className={`bx-btn ax-tap ${on({ kind: 'search' }) ? 'bx-btn-on' : ''}`} aria-pressed={on({ kind: 'search' })} onClick={() => onPick({ kind: 'search' })} data-testid="from-search">{P().searchAll}</button>
      </div>
    </fieldset>
  );
}

/**
 * SL27: Add as evidence to… — the map's circumstances and links, searchable by label and code title; those whose code
 * the selection suggests come first, marked "suggested". Choosing one adds the passage to its sources.
 */
export function EvidencePicker({ map, span, nm, onPick, onCancel }: { map: SdohMap; span: Span; nm: (id: string) => string; onPick: (t: Target) => void; onCancel: () => void }) {
  const [q, setQ] = useState('');
  const sugg = useMemo(() => new Set(suggestCodes(span.quote, 8).map((s) => s.code)), [span.quote]);
  const isSugg = (code: string | null) => !!code && [...sugg].some((c) => c === code || code.startsWith(`${c}.`) || c.startsWith(`${code}.`));
  const nodes = map.nodes.filter((n) => n.kind !== 'note');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const text = (id: string) => `${nm(id)} ${byId.get(id)?.code ?? ''} ${byId.get(id)?.code ? codeMap.get(byId.get(id)!.code!)?.title ?? '' : ''} ${plainText(byId.get(id)?.label)}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (t: string) => words.every((w) => t.includes(w));
  const ns = nodes
    .filter((n) => hit(text(n.id)))
    .map((n) => ({ n, s: isSugg(n.code) }))
    .sort((a, b) => Number(b.s) - Number(a.s) || nm(a.n.id).localeCompare(nm(b.n.id)));
  const es = map.edges
    .filter((e) => hit(`${text(e.from)} ${text(e.to)}`))
    .map((e) => ({ e, s: isSugg(byId.get(e.from)?.code ?? null) || isSugg(byId.get(e.to)?.code ?? null) }))
    .sort((a, b) => Number(b.s) - Number(a.s));
  const item = 'ax-tap flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-paper-2 dark:hover:bg-night';
  return (
    <div data-testid="evidence-picker">
      <p className="mb-2 text-sm">
        {P().fromText} <span className="sx-span">“{span.quote.length > 140 ? `${span.quote.slice(0, 139)}…` : span.quote}”</span>
      </p>
      <input type="search" className="bx-input ax-tap w-full" aria-label={P().evidenceSearch} placeholder={P().evidenceSearch} value={q} onChange={(e) => setQ(e.target.value)} data-autofocus data-testid="ev-search" />
      <div className="mt-2 max-h-[50vh] overflow-y-auto overscroll-contain">
        <h3 className="m-0 text-sm font-semibold">{P().evidenceNodes}</h3>
        <ul className="mt-1">
          {ns.map(({ n, s }) => (
            <li key={n.id}>
              <button type="button" className={item} onClick={() => onPick({ kind: 'node', id: n.id })} data-testid="ev-node" data-id={n.id} data-suggested={s ? 'true' : 'false'}>
                <span className="min-w-0 flex-1">{nm(n.id)}{n.code && <span className="ml-1 font-mono text-xs bx-muted">{n.code}</span>}</span>
                {s && <span className="bx-chip px-1.5 text-xs">{P().suggestedTag}</span>}
              </button>
            </li>
          ))}
        </ul>
        {es.length > 0 && <h3 className="m-0 mt-2 text-sm font-semibold">{P().evidenceEdges}</h3>}
        <ul className="mt-1">
          {es.map(({ e, s }) => (
            <li key={e.id}>
              <button type="button" className={item} onClick={() => onPick({ kind: 'edge', id: e.id })} data-testid="ev-edge" data-id={e.id} data-suggested={s ? 'true' : 'false'}>
                <span className="min-w-0 flex-1">{nm(e.from)} <span aria-hidden>→</span><span className="sr-only">leads to</span> {nm(e.to)} <span className="bx-muted">({e.polarity})</span></span>
                {s && <span className="bx-chip px-1.5 text-xs">{P().suggestedTag}</span>}
              </button>
            </li>
          ))}
        </ul>
        {!ns.length && !es.length && <p className="text-sm bx-muted">{P().evidenceNone}</p>}
      </div>
      <button type="button" className="bx-btn ax-tap mt-3" onClick={onCancel}>{P().deleteCancel}</button>
    </div>
  );
}
