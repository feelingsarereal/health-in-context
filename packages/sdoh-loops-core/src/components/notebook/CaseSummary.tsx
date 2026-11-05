import { useMemo, useState } from 'react';
import { S } from '../../lib/data/core';
import { codeMap, groupMap } from '../../lib/data/scheme';
import { C } from '../../lib/copy';
import { count } from '../../lib/plural';
import { leverage, type AGraph, type Loop, type LoopResult } from '../../lib/analysis';
import { CODE_STATUSES, type MapNode, type SdohMap } from '../../lib/model/map';
import { Heuristic } from '../ui/bits';
import { NodesTable } from '../map/NodesTable';
import { PassagesFold } from './PassagesFold';
import { isOrphaned, spansFor, type Notebook } from '../../lib/model/notebook';
import { passagesBehind } from '../../lib/model/targets';

type Sort = 'map' | 'name' | 'code' | 'status' | 'links';

/**
 * SL26 point 5: the case summary at the foot of the notebook — a live, read-only dashboard of the map: tiles, the
 * circumstances table (the list view's NodesTable, so the two stay identical), the loops, and the top 5 by leverage.
 * It works on the map as shown, so circumstances the host hides (hideNode) are left out, and it says how many.
 */
export function CaseSummary({ map, graph, loops, loopNames, nm, flags, hidden, selected, onSelect, onLoop, notebook, onGo }: {
  /** the map as shown (hideNode applied) */
  map: SdohMap; graph: AGraph; loops: LoopResult; loopNames: Map<string, string>; nm: (id: string) => string;
  flags: number; hidden: number; selected: { nodes: string[] }; onSelect: (id: string) => void; onLoop: (l: Loop) => void;
  /** SL28: the notebook (its passages: the Sources column and each loop's Passages) and Go to passage */
  notebook?: Notebook; onGo?: (span: string) => void;
}) {
  const [sort, setSort] = useState<Sort>('map');
  const [filter, setFilter] = useState('');
  const circ = map.nodes.filter((n) => n.kind !== 'note');
  const byStatus = Object.fromEntries(CODE_STATUSES.map((s) => [s, circ.filter((n) => n.code_status === s).length])) as Record<string, number>;
  const ev = map.edges.filter((e) => e.basis === 'evidence').length;
  const R = loops.loops.filter((l) => l.kind === 'R').length;
  const blocks = useMemo(() => {
    const ids = [...new Set(map.nodes.map((n) => (n.code ? codeMap.get(n.code)?.group : undefined)).filter((g): g is string => !!g))];
    return ids.map((id) => ({ id, title: groupMap.get(id)?.title ?? id }));
  }, [map.nodes]);
  const degree = (n: MapNode) => map.edges.filter((e) => e.from === n.id || e.to === n.id).length;
  const rows = useMemo(() => {
    let r = map.nodes;
    if (filter.startsWith('status:')) r = r.filter((n) => n.kind !== 'note' && n.code_status === filter.slice(7));
    else if (filter.startsWith('block:')) r = r.filter((n) => !!n.code && codeMap.get(n.code)?.group === filter.slice(6));
    const by: Record<Sort, ((a: MapNode, b: MapNode) => number) | null> = {
      map: null,
      name: (a, b) => nm(a.id).localeCompare(nm(b.id)),
      code: (a, b) => (a.code ?? '~').localeCompare(b.code ?? '~'),
      status: (a, b) => CODE_STATUSES.indexOf(a.code_status) - CODE_STATUSES.indexOf(b.code_status),
      links: (a, b) => degree(b) - degree(a),
    };
    return by[sort] ? [...r].sort(by[sort]!) : r;
  }, [map, sort, filter, nm]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = useMemo(() => leverage(graph, loops, 'loops').slice(0, 5), [graph, loops]);
  const tile = 'bx-card flex min-w-[8rem] flex-1 flex-col p-2';
  return (
    <section className="border-t-2 border-[color:var(--bx-line)] p-3" aria-labelledby="nb-summary-h" data-testid="case-summary">
      <h2 id="nb-summary-h" className="m-0 font-display text-lg font-semibold">{C.notebook.summary.title}</h2>
      <p className="mt-1 text-xs bx-muted">{C.notebook.summary.lead}</p>
      {hidden > 0 && <p className="mt-1 text-sm" data-testid="summary-hidden">{count(hidden, C.notebook.summary.hiddenOne, C.notebook.summary.hiddenMany)} {C.notebook.summary.notShown}</p>}
      <ul className="mt-2 flex flex-wrap gap-2" aria-label={C.notebook.summary.tiles} data-testid="summary-tiles">
        <li className={tile} data-testid="tile-circumstances">
          <span className="text-2xl font-semibold">{circ.length}</span>
          <span className="text-sm font-semibold">{C.notebook.summary.circumstances}</span>
          <span className="text-xs bx-muted">{CODE_STATUSES.map((s) => `${byStatus[s]} ${S.codes.status[s]}`).join(' · ')}</span>
        </li>
        <li className={tile} data-testid="tile-links">
          <span className="text-2xl font-semibold">{map.edges.length}</span>
          <span className="text-sm font-semibold">{C.notebook.summary.links}</span>
          <span className="text-xs bx-muted">{ev} evidence · {map.edges.length - ev} ⚑</span>
        </li>
        <li className={tile} data-testid="tile-loops">
          <span className="text-2xl font-semibold">{loops.loops.length}</span>
          <span className="text-sm font-semibold">{C.notebook.summary.loops}</span>
          <span className="text-xs bx-muted">{R} {S.loops.reinforcing.toLowerCase()} · {loops.loops.length - R} {S.loops.balancing.toLowerCase()}</span>
        </li>
        <li className={tile} data-testid="tile-needs-code">
          <span className="text-2xl font-semibold">{byStatus.undetermined}</span>
          <span className="text-sm font-semibold">{C.panels.needsCode}</span>
        </li>
        <li className={tile} data-testid="tile-flags">
          <span className="text-2xl font-semibold">{flags}</span>
          <span className="text-sm font-semibold">{C.notebook.summary.flags}</span>
        </li>
      </ul>

      <h3 className="mt-4 text-base font-semibold">{C.list.nodes} ({rows.length})</h3>
      <div className="mt-1 flex flex-wrap gap-2" data-print-hide>
        <label className="inline-flex items-center gap-1 text-sm">
          <span>{C.notebook.summary.sort}</span>
          <select className="bx-input ax-tap w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-testid="summary-sort">
            {(['map', 'name', 'code', 'status', 'links'] as const).map((k) => <option key={k} value={k}>{C.notebook.summary.sortBy[k]}</option>)}
          </select>
        </label>
        <label className="inline-flex items-center gap-1 text-sm">
          <span>{C.notebook.summary.filter}</span>
          <select className="bx-input ax-tap w-auto max-w-[14rem]" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="summary-filter">
            <option value="">{C.notebook.summary.all}</option>
            <optgroup label={C.node.status}>
              {CODE_STATUSES.map((s) => <option key={s} value={`status:${s}`}>{S.codes.status[s]}</option>)}
            </optgroup>
            {blocks.length > 0 && (
              <optgroup label={C.notebook.summary.block}>
                {blocks.map((b) => <option key={b.id} value={`block:${b.id}`}>{b.title}</option>)}
              </optgroup>
            )}
          </select>
        </label>
      </div>
      {/* a scrolling region a keyboard can reach (the table is wider than a phone) */}
      <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={`${C.list.nodes}: ${C.notebook.summary.title}`} data-testid="summary-table-wrap">
        <NodesTable
          map={map} nodes={rows} nm={nm} selected={selected} onSelect={onSelect} testId="summary-table" caption={C.notebook.summary.title}
          sources={(n) => {
            const list = spansFor(notebook, { kind: 'node', id: n.id }).filter((x) => !isOrphaned(notebook, x));
            if (!list.length) return <span className="bx-muted">—</span>;
            return (
              <div data-testid="summary-sources" data-count={list.length}>
                <span>{count(list.length, 'passage')}</span>
                {onGo && <button type="button" className="ax-tap ml-1 block text-xs underline" onClick={() => onGo(list[0].id)} data-testid="summary-source-go">{C.notebook.passages.goTo}</button>}
              </div>
            );
          }}
        />
        {!rows.length && <p className="mt-2 text-sm bx-muted">{C.list.none}</p>}
      </div>

      <h3 className="mt-4 text-base font-semibold">{C.notebook.summary.loops} ({loops.loops.length})</h3>
      {loops.loops.length ? (
        <ul className="mt-1 space-y-1 text-sm" data-testid="summary-loops">
          {loops.loops.map((l) => (
            <li key={l.key} data-testid="summary-loop-item">
              <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onLoop(l)} data-testid="summary-loop">
                <span className="font-semibold">{loopNames.get(l.key)}</span> · {l.kind === 'R' ? S.loops.reinforcing : S.loops.balancing}: {l.nodes.map(nm).join(' → ')} → ↺
              </button>
              <PassagesFold notebook={notebook} groups={passagesBehind(notebook, map, nm, { kind: 'loop', loop: l })} onGo={onGo} testId="summary-loop-passages" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm bx-muted">{S.loops.none}</p>
      )}

      <h3 className="mt-4 text-base font-semibold">{C.notebook.summary.leverage}</h3>
      <p className="mt-1"><Heuristic label={S.analyses.leverage_label} /></p>
      {top.length ? (
        <ol className="mt-1 list-decimal pl-5 text-sm" data-testid="summary-leverage">
          {top.map((r) => (
            <li key={r.id}>
              <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onSelect(r.id)}>{nm(r.id)}</button>
              <span className="bx-muted"> · {count(r.loops, 'loop')}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-sm bx-muted">{C.list.none}</p>
      )}
    </section>
  );
}
