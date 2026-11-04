import type { ReactNode } from 'react';
import { codeMap } from '../../lib/data/scheme';
import { S } from '../../lib/data/core';
import { C } from '../../lib/copy';
import type { MapEdge, MapNode, SdohMap } from '../../lib/model/map';
import { RichView } from './RichView';

/** One circumstance's links in or out, as text: "+ Low income (L03 [1][2])", "− Support ⚑ override". */
export function linkSummary(map: SdohMap, nm: (id: string) => string, n: MapNode, dir: 'in' | 'out'): { edge: MapEdge; text: string }[] {
  return map.edges
    .filter((e) => (dir === 'out' ? e.from : e.to) === n.id)
    .map((e) => ({
      edge: e,
      text: `${e.polarity} ${nm(dir === 'out' ? e.to : e.from)} (${e.basis === 'evidence' ? `${e.link}${e.evidence.length ? ` ${e.evidence.map((r) => `[${r}]`).join('')}` : ''}` : e.basis === 'override' ? '⚑ override' : '⚑ needs review'})`,
    }));
}

/**
 * SL26: the circumstances table, shared by the list view and the notebook's case summary so the two stay identical:
 * circumstance (its label or WHO title), code and WHO title, code status and type, description, and links in and out
 * with polarity and evidence. `actions` adds the list view's edit column; the summary passes none (read only).
 */
export function NodesTable({ map, nodes, nm, selected, onSelect, actions, testId, caption, rowState }: {
  map: SdohMap; nodes: MapNode[]; nm: (id: string) => string; selected: { nodes: string[] }; onSelect: (id: string) => void;
  actions?: (n: MapNode) => ReactNode; testId: string; caption?: string;
  /** a row's dimmed or highlighted state (the list view's analysis highlight) */
  rowState?: (id: string) => 'normal' | 'dimmed' | 'highlighted';
}) {
  return (
    <table className="w-full text-sm" data-testid={testId}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="text-left">
          <th scope="col" className="py-1 pr-2">{C.table.circumstance}</th>
          <th scope="col" className="py-1 pr-2">{C.table.code}</th>
          <th scope="col" className="py-1 pr-2">{C.table.status}</th>
          <th scope="col" className="py-1 pr-2">{C.table.description}</th>
          <th scope="col" className="py-1 pr-2">{C.table.links}</th>
          {actions && <th scope="col" className="py-1">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {nodes.map((n) => {
          const out = linkSummary(map, nm, n, 'out');
          const inn = linkSummary(map, nm, n, 'in');
          return (
            <tr key={n.id} className={`border-t border-[color:var(--bx-line)] align-top ${rowState?.(n.id) === 'dimmed' ? 'opacity-50' : ''} ${selected.nodes.includes(n.id) ? 'bg-paper-2 dark:bg-night' : ''}`} data-node={n.id} data-state={rowState?.(n.id) ?? 'normal'} data-row>
              <th scope="row" className="py-1 pr-2 text-left font-medium" data-cell="name">
                <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onSelect(n.id)} aria-pressed={selected.nodes.includes(n.id)}>{nm(n.id)}</button>
                {n.pinned && <span className="ml-1 text-xs bx-muted">(pinned)</span>}
              </th>
              <td className="py-1 pr-2" data-cell="code">{n.kind === 'note' ? '—' : n.code ? <><span className="font-mono">{n.code}</span> {codeMap.get(n.code)?.title}</> : '—'}</td>
              <td className="py-1 pr-2" data-cell="status">{n.kind === 'note' ? C.node.note : `${n.code_status === 'undetermined' ? '? ' : ''}${S.codes.status[n.code_status]}${n.type ? ` · ${n.type}` : ''}`}</td>
              <td className="py-1 pr-2" data-cell="description"><RichView doc={n.kind === 'note' ? n.notes : n.circumstance} clamp={120} /></td>
              <td className="py-1 pr-2" data-cell="links">
                {out.length + inn.length === 0 ? (
                  <span className="bx-muted">—</span>
                ) : (
                  <ul className="space-y-0.5">
                    {out.map((l) => <li key={l.edge.id}><span className="sr-only">{C.table.out} </span><span aria-hidden="true">→ </span>{l.text}</li>)}
                    {inn.map((l) => <li key={l.edge.id}><span className="sr-only">{C.table.in} </span><span aria-hidden="true">← </span>{l.text}</li>)}
                  </ul>
                )}
              </td>
              {actions && <td className="py-1">{actions(n)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
