import { useMemo, useState, useId } from 'react';
import { S } from '@/lib/data/core';
import { C } from '@/lib/copy';
import { GROUP_STYLE } from '@/lib/palette';
import { groupMap, codeMap } from '@/lib/data/scheme';
import { inventory, leverage, paths, pulse, feedbackClusters, ambiguities, strongestLoops, type LeverageSort, type Loop, type LoopResult, type PathResult, type AGraph } from '@/lib/analysis';
import { nodeName } from '@/lib/model/interchange';
import type { SdohMap } from '@/lib/model/map';
import { Heuristic } from '@/components/ui/bits';

const titleOf = (c: string) => codeMap.get(c)?.title;
export const nameOf = (map: SdohMap) => {
  const by = new Map(map.nodes.map((n) => [n.id, n]));
  return (id: string) => {
    const n = by.get(id);
    return n ? nodeName(n, titleOf) : id;
  };
};

// ───────────────────────── UI-09 loops
export function LoopsPanel({ map, result, names, active, onPick, onRename, onCircle, overrides, evidenceOnly, emptyNote }: { map: SdohMap; result: LoopResult; names: Map<string, string>; active: string | null; onPick: (l: Loop | null) => void; onRename: (l: Loop, name: string) => void; onCircle: (l: Loop) => void; overrides: (l: Loop) => number; evidenceOnly: boolean; emptyNote: string | null }) {
  const [kind, setKind] = useState<'all' | 'R' | 'B'>('all');
  const [through, setThrough] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const nm = nameOf(map);
  const id = useId();
  const shown = strongestLoops(result).filter((l) => (kind === 'all' || l.kind === kind) && (!through || l.nodes.includes(through)));
  const counts = { R: result.loops.filter((l) => l.kind === 'R').length, B: result.loops.filter((l) => l.kind === 'B').length };
  return (
    <div data-testid="loops-panel">
      <p className="text-sm" data-testid="loop-summary">
        {result.loops.length} {result.loops.length === 1 ? 'loop' : 'loops'}: {counts.R} {S.loops.reinforcing.toLowerCase()}, {counts.B} {S.loops.balancing.toLowerCase()}.
      </p>
      {result.truncated && <p className="mt-1 bx-todo" data-testid="loops-truncated">{S.loops.truncated}</p>}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="flex gap-1" role="group" aria-label="Filter by kind">
          {(['all', 'R', 'B'] as const).map((k) => (
            <button key={k} type="button" className={`bx-btn ax-tap ${kind === k ? 'bx-btn-on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? C.loops.filterAll : k === 'R' ? `↻R ${S.loops.reinforcing}` : `↺B ${S.loops.balancing}`}
            </button>
          ))}
        </div>
        <label className="text-sm min-w-0 flex-1">
          <span className="mb-1 block font-semibold">{C.loops.byNode}</span>
          <select className="bx-input ax-tap" value={through} onChange={(e) => setThrough(e.target.value)}>
            <option value="">{C.loops.anyNode}</option>
            {map.nodes.filter((n) => n.kind !== 'note').map((n) => <option key={n.id} value={n.id}>{nm(n.id)}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs"><Heuristic label={S.loops.strength_label} /></p>
      {evidenceOnly && <p className="mt-2 text-sm font-semibold" data-testid="evidence-only-on">{C.evidence.toggle}: on.</p>}
      {!result.loops.length && <p className="mt-2 text-sm bx-muted" data-testid="loops-empty">{emptyNote ?? S.loops.none}</p>}
      {active && (
        <button type="button" className="bx-btn ax-tap mt-2" onClick={() => onPick(null)}>{C.loops.clear}</button>
      )}
      <ul className="mt-2 space-y-2" data-testid="loop-list">
        {shown.map((l) => (
          <li key={l.key} className={`bx-card p-2 ${active === l.key ? 'ring-2 ring-[color:var(--bx-accent)]' : ''}`} data-testid="loop-item" data-kind={l.kind}>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="ax-tap flex-1 text-left" aria-pressed={active === l.key} onClick={() => onPick(active === l.key ? null : l)} data-testid="loop-pick">
                <span className={`${l.kind === 'R' ? 'ax-edge-pos' : 'ax-edge-neg'} font-bold`}>{l.kind === 'R' ? '↻' : '↺'}{l.kind}</span>{' '}
                <span className="font-semibold" data-testid="loop-name">{names.get(l.key)}</span> · {l.kind === 'R' ? S.loops.reinforcing : S.loops.balancing} · <span data-testid="loop-length">{l.length}</span> links · <span data-testid="loop-overrides">{overrides(l) === 0 ? 'no overrides' : `${overrides(l)} ${overrides(l) === 1 ? 'override' : 'overrides'} ⚑`}</span> · strength {l.strength.toFixed(3)}
                <span className="mt-0.5 block text-xs bx-muted">{l.nodes.map(nm).join(' → ')} → ↺</span>
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {editing === l.key ? (
                <form
                  className="flex flex-wrap gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename(l, draft);
                    setEditing(null);
                  }}
                >
                  <label htmlFor={`${id}-${l.key}`} className="sr-only">Loop name</label>
                  <input id={`${id}-${l.key}`} className="bx-input w-40" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  <button className="bx-btn ax-tap" type="submit">Save</button>
                </form>
              ) : (
                <button type="button" className="bx-btn ax-tap" onClick={() => { setEditing(l.key); setDraft(names.get(l.key) ?? ''); }}>{C.loops.rename}</button>
              )}
              <button type="button" className="bx-btn ax-tap" onClick={() => onCircle(l)}>{C.loops.arrangeCircle}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── A1 link inventory
export function LinksPanel({ map, graph, onPick, basisOf }: { map: SdohMap; graph: AGraph; onPick: (edgeId: string) => void; basisOf: Map<string, string> }) {
  const inv = inventory(graph);
  const amb = ambiguities(graph);
  const nm = nameOf(map);
  const by = new Map(map.edges.map((e) => [e.id, e]));
  const list = (title: string, es: typeof inv.positive, testId: string) => (
    <section className="mt-2">
      <h3 className="font-semibold">{title} ({es.length})</h3>
      <ul className="mt-1 space-y-1 text-sm" data-testid={testId}>
        {es.map((e) => (
          <li key={e.id}>
            <button type="button" className="ax-tap w-full rounded px-1 text-left hover:bg-paper-2 dark:hover:bg-night" onClick={() => onPick(e.id)}>
              {nm(e.from)} → {nm(e.to)} <span className="font-mono">{e.weight > 0 ? '+' : ''}{e.weight}</span>
              {basisOf.get(e.id) === 'evidence' ? <span className="bx-muted"> · {by.get(e.id)!.link} {by.get(e.id)!.evidence.map((n) => `[${n}]`).join('')}</span> : <span className="ax-edge-neg"> · ⚑ {basisOf.get(e.id) === 'needs-review' ? 'needs review' : 'override'}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div data-testid="links-panel">
      <p className="text-sm" data-testid="link-summary">{inv.positive.length} + links, {inv.negative.length} − links.</p>
      <p className="text-sm" data-testid="link-basis-summary">{graph.edges.filter((e) => basisOf.get(e.id) === 'evidence').length} evidence · {graph.edges.filter((e) => basisOf.get(e.id) !== 'evidence').length} override ⚑</p>
      {amb.length > 0 && (
        <p className="mt-1 text-sm bx-todo">{C.edge.ambiguity} ({amb.map((a) => `${nm(a.from)} → ${nm(a.to)}`).join('; ')})</p>
      )}
      {list(S.edges.polarity_plus, inv.positive, 'links-plus')}
      {list(S.edges.polarity_minus, inv.negative, 'links-minus')}
    </div>
  );
}

// ───────────────────────── A6 paths
export function PathsPanel({ map, graph, onPick, announce }: { map: SdohMap; graph: AGraph; onPick: (p: PathResult['paths'][number] | null) => void; announce: (s: string) => void }) {
  const nodes = map.nodes.filter((n) => n.kind !== 'note');
  const nm = nameOf(map);
  const [from, setFrom] = useState(nodes[0]?.id ?? '');
  const [to, setTo] = useState(nodes[1]?.id ?? '');
  const [res, setRes] = useState<PathResult | null>(null);
  const id = useId();
  return (
    <div data-testid="paths-panel">
      <h3 className="font-semibold">{S.analyses.paths_title}</h3>
      <form
        className="mt-2 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const r = paths(graph, from, to);
          setRes(r);
          announce(`${r.paths.length} paths from ${nm(from)} to ${nm(to)}; net effect ${r.summary}.`);
        }}
      >
        <label className="text-sm" htmlFor={`${id}-f`}>{C.paths.from}</label>
        <select id={`${id}-f`} className="bx-input ax-tap" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="paths-from">
          {nodes.map((n) => <option key={n.id} value={n.id}>{nm(n.id)}</option>)}
        </select>
        <label className="text-sm" htmlFor={`${id}-t`}>{C.paths.to}</label>
        <select id={`${id}-t`} className="bx-input ax-tap" value={to} onChange={(e) => setTo(e.target.value)} data-testid="paths-to">
          {nodes.map((n) => <option key={n.id} value={n.id}>{nm(n.id)}</option>)}
        </select>
        <button type="submit" className="bx-btn-primary ax-tap justify-center" data-testid="paths-find">{C.paths.find}</button>
      </form>
      {res && (
        <div className="mt-3" data-testid="paths-result">
          {res.paths.length === 0 ? <p className="text-sm bx-muted">{C.paths.none}</p> : (
            <>
              <p className="text-sm"><span className="font-semibold">{C.paths.summary}:</span> <span data-testid="paths-summary">{res.summary}</span> ({res.paths.length} paths{res.truncated ? ', capped at 200' : ''})</p>
              <ul className="mt-2 space-y-1 text-sm">
                {res.paths.map((p, i) => (
                  <li key={i}>
                    <button type="button" className="ax-tap w-full rounded px-1 text-left hover:bg-paper-2 dark:hover:bg-night" onClick={() => onPick(p)} data-testid="path-item">
                      <span className={`font-bold ${p.sign === '+' ? 'ax-edge-pos' : 'ax-edge-neg'}`} data-testid="path-sign">{p.sign}</span> · weight product <span className="font-mono" data-testid="path-weight">{+p.weight.toFixed(4)}</span>
                      <span className="block text-xs bx-muted">{p.nodes.map(nm).join(' → ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── A7 leverage
export function LeveragePanel({ map, graph, loops, onPick }: { map: SdohMap; graph: AGraph; loops: LoopResult; onPick: (id: string) => void }) {
  const [sort, setSort] = useState<LeverageSort>('loops');
  const rows = useMemo(() => leverage(graph, loops, sort), [graph, loops, sort]);
  const nm = nameOf(map);
  const th = (k: LeverageSort, label: string) => (
    <th scope="col" className="py-1 pr-1 text-right" aria-sort={sort === k ? 'descending' : 'none'}>
      <button type="button" className={`underline-offset-2 ${sort === k ? 'font-bold underline' : ''}`} onClick={() => setSort(k)}>{label}</button>
    </th>
  );
  return (
    <div data-testid="leverage-panel">
      <h3 className="font-semibold">{S.analyses.leverage_title}</h3>
      <p className="mt-1"><Heuristic label={S.analyses.leverage_label} /></p>
      <p className="mt-1 text-xs bx-muted">{C.leverage.sortNote}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm" data-testid="leverage-table">
          <caption className="sr-only">{S.analyses.leverage_title} — {S.analyses.leverage_label}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-1 text-left">{C.leverage.node}</th>
              {th('loops', C.leverage.loops)}
              {th('betweenness', C.leverage.between)}
              {th('weightedIn', C.leverage.in)}
              {th('weightedOut', C.leverage.out)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--bx-line)]">
                <td className="py-1 pr-1"><button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onPick(r.id)}>{nm(r.id)}</button></td>
                <td className="py-1 pr-1 text-right font-mono">{r.loops}</td>
                <td className="py-1 pr-1 text-right font-mono">{+r.betweenness.toFixed(2)}</td>
                <td className="py-1 pr-1 text-right font-mono">{+r.weightedIn.toFixed(2)}</td>
                <td className="py-1 pr-1 text-right font-mono">{+r.weightedOut.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────── A8 what-if pulse
export function PulsePanel({ map, graph, announce }: { map: SdohMap; graph: AGraph; announce: (s: string) => void }) {
  const nodes = map.nodes.filter((n) => n.kind !== 'note');
  const nm = nameOf(map);
  const [stim, setStim] = useState(nodes[0]?.id ?? '');
  const [dir, setDir] = useState<1 | -1>(1);
  const [res, setRes] = useState<ReturnType<typeof pulse> | null>(null);
  const id = useId();
  return (
    <div data-testid="pulse-panel">
      <p><Heuristic label={S.analyses.pulse_label} /></p>
      <form
        className="mt-2 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const r = pulse(graph, stim, dir);
          setRes(r);
          announce(`What-if pulse run for ${r.steps} steps.`);
        }}
      >
        <label className="text-sm" htmlFor={`${id}-s`}>{C.pulse.stimulus}</label>
        <select id={`${id}-s`} className="bx-input ax-tap" value={stim} onChange={(e) => setStim(e.target.value)}>
          {nodes.map((n) => <option key={n.id} value={n.id}>{nm(n.id)}</option>)}
        </select>
        <div className="flex gap-1">
          <button type="button" className={`bx-btn ax-tap ${dir === 1 ? 'bx-btn-on' : ''}`} aria-pressed={dir === 1} onClick={() => setDir(1)}>{C.pulse.up}</button>
          <button type="button" className={`bx-btn ax-tap ${dir === -1 ? 'bx-btn-on' : ''}`} aria-pressed={dir === -1} onClick={() => setDir(-1)}>{C.pulse.down}</button>
        </div>
        <button type="submit" className="bx-btn-primary ax-tap justify-center">{C.pulse.run}</button>
      </form>
      {res && (
        <div className="mt-3">
          <p className="text-xs bx-muted">{res.steps} {C.pulse.steps}, {res.converged ? C.pulse.converged : C.pulse.notConverged}.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(res.values).map(([k, v]) => (
              <li key={k} className="grid grid-cols-[1fr_6rem] items-center gap-2">
                <span className="truncate">{nm(k)}</span>
                <span className="relative h-4 rounded bg-paper-2 dark:bg-night" aria-label={`${v > 0 ? 'up' : v < 0 ? 'down' : 'no change'} ${Math.abs(v).toFixed(2)}`} role="img">
                  <span className="absolute top-0 h-4 rounded" style={{ left: v >= 0 ? '50%' : `${50 + v * 50}%`, width: `${Math.abs(v) * 50}%`, background: v >= 0 ? 'var(--ax-pos)' : 'var(--ax-neg)' }} />
                  <span className="absolute left-1/2 top-0 h-4 w-px bg-[color:var(--bx-ink)]" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── To code, clusters, legend
export function ToCodePanel({ map, onPick, onPickEdge, nm: nmE }: { map: SdohMap; onPick: (id: string) => void; onPickEdge: (id: string) => void; nm: (id: string) => string }) {
  const nm = nameOf(map);
  const todo = map.nodes.filter((n) => n.kind !== 'note' && n.code_status === 'undetermined');
  const review = map.edges.filter((e) => e.basis === 'needs-review');
  return (
    <div data-testid="tocode-panel">
      {review.length > 0 && (
        <section className="mb-4" aria-label={C.evidence.toReview}>
          <h3 className="font-semibold">⚑ {C.evidence.toReview} ({review.length})</h3>
          <ul className="mt-1 space-y-1" data-testid="review-list">
            {review.map((e) => (
              <li key={e.id}><button type="button" className="bx-btn ax-tap w-full" onClick={() => onPickEdge(e.id)}>⚑ {nmE(e.from)} → {nmE(e.to)}</button></li>
            ))}
          </ul>
        </section>
      )}
      {!todo.length ? <p className="text-sm bx-muted">{C.node.toCodeEmpty}</p> : (
        <ul className="space-y-1" data-testid="tocode-list">
          {todo.map((n) => (
            <li key={n.id}><button type="button" className="bx-btn ax-tap w-full" onClick={() => onPick(n.id)}>? {nm(n.id)}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function ClustersPanel({ map, graph, show, onShow, onPick }: { map: SdohMap; graph: AGraph; show: boolean; onShow: (b: boolean) => void; onPick: (ids: string[]) => void }) {
  const cl = feedbackClusters(graph);
  const nm = nameOf(map);
  return (
    <div data-testid="clusters-panel">
      <p className="text-sm">{C.clusters.lead}</p>
      <label className="mt-2 inline-flex items-center gap-2 text-sm ax-tap"><input type="checkbox" checked={show} onChange={(e) => onShow(e.target.checked)} /> {C.clusters.hulls}</label>
      {!cl.length ? <p className="mt-2 text-sm bx-muted">{C.clusters.none}</p> : (
        <ul className="mt-2 space-y-1 text-sm">
          {cl.map((c, i) => <li key={i}><button type="button" className="ax-tap w-full rounded px-1 text-left hover:bg-paper-2 dark:hover:bg-night" onClick={() => onPick(c)}>Cluster {i + 1} ({c.length}): {c.map(nm).join(', ')}</button></li>)}
        </ul>
      )}
    </div>
  );
}
export function LegendPanel() {
  return (
    <div data-testid="legend-panel" className="text-sm">
      <ul className="space-y-1">
        {Object.entries(GROUP_STYLE).map(([g, s]) => (
          <li key={g} className="flex items-center gap-2">
            <span className="inline-block h-4 w-6 rounded border" style={{ background: s.hue, borderColor: s.hue }} aria-hidden />
            <span aria-hidden className="w-4 text-center">{s.glyph}</span>
            <span><span className="font-mono text-xs">{g}</span> {groupMap.get(g)?.title}</span>
          </li>
        ))}
        <li className="flex items-center gap-2"><span className="inline-block h-4 w-6 rounded border-2 border-dashed border-[color:var(--bx-muted)]" aria-hidden /> {S.codes.status.other} / {S.codes.status.undetermined} (? badge)</li>
      </ul>
      <ul className="mt-3 space-y-1">
        <li><span className="font-bold ax-edge-pos">+</span> at the arrowhead: {S.edges.polarity_plus}</li>
        <li><span className="font-bold ax-edge-neg">−</span> at the arrowhead: {S.edges.polarity_minus}</li>
        <li>‖ on a line: {S.edges.delay}</li>
        <li data-testid="legend-override"><span className="font-bold ax-edge-neg">⚑</span> mid-line: {C.evidence.legend}</li>
        <li><span className="font-bold ax-edge-neg">⚑?</span> with an amber glow: {C.evidence.legendReview}</li>
        <li>Line thickness: |weight| (can be switched off)</li>
        <li>↻R / ↺B: {S.loops.reinforcing} / {S.loops.balancing} loop</li>
      </ul>
    </div>
  );
}
