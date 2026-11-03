import { useState } from 'react';
import { codeMap } from '../../lib/data/scheme';
import { S } from '../../lib/data/core';
import { C } from '../../lib/copy';
import { deleteEdges, deleteNodes, updateEdge, updateNode, type MapEdge, type SdohMap } from '../../lib/model/map';
import { plainText } from '../../lib/model/rich';
import { Dialog } from '../ui/Dialog';
import { NodeFields, EdgeFields } from './Forms';
import { BasisPanel } from './LinkForm';
import { RichView } from './RichView';
import type { Highlight } from './Canvas';

/** ACTION-SPEC §3.3: the accessible view — every node and edge as a table row with create, edit and delete. */
export function ListView({ map, nm, selected, onSelect, onAddNode, onAddEdge, onAssoc, apply, describeEdge, highlight, announce }: {
  map: SdohMap; nm: (id: string) => string; selected: { nodes: string[]; edges: string[] }; onSelect: (s: { nodes: string[]; edges: string[] }) => void;
  onAddNode: () => void; onAddEdge: () => void; onAssoc: (id: string) => void; apply: (fn: (m: SdohMap) => SdohMap, key?: string) => void;
  describeEdge: (e: MapEdge) => string; highlight: Highlight | null; announce: (s: string) => void;
}) {
  const [editNode, setEditNode] = useState<string | null>(null);
  const [editEdge, setEditEdge] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const node = editNode ? map.nodes.find((n) => n.id === editNode) : undefined;
  const edge = editEdge ? map.edges.find((e) => e.id === editEdge) : undefined;
  const state = (id: string) => (highlight ? (highlight.nodes.has(id) || highlight.edges.has(id) || highlight.out?.has(id) || highlight.in?.has(id) ? 'highlighted' : 'dimmed') : 'normal');
  return (
    <div className="bx-card p-3" data-testid="list-view">
      <h2 className="text-2xl">{C.list.title}</h2>
      <p className="bx-prose">{C.list.lead}</p>
      <section className="mt-4" aria-labelledby="lv-nodes">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="lv-nodes" className="text-xl">{C.list.nodes} ({map.nodes.length})</h3>
          <button type="button" className="bx-btn-primary ax-tap" onClick={onAddNode} data-testid="list-add-node">{C.node.add}</button>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm" data-testid="nodes-table">
            <thead>
              <tr className="text-left"><th scope="col" className="py-1 pr-2">Circumstance</th><th scope="col" className="py-1 pr-2">Code</th><th scope="col" className="py-1 pr-2">Description</th><th scope="col" className="py-1">Actions</th></tr>
            </thead>
            <tbody>
              {map.nodes.map((n) => (
                <tr key={n.id} className={`border-t border-[color:var(--bx-line)] align-top ${state(n.id) === 'dimmed' ? 'opacity-50' : ''} ${selected.nodes.includes(n.id) ? 'bg-paper-2 dark:bg-night' : ''}`} data-node={n.id} data-state={state(n.id)}>
                  <th scope="row" className="py-1 pr-2 text-left font-medium">
                    <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onSelect({ nodes: [n.id], edges: [] })} aria-pressed={selected.nodes.includes(n.id)}>{nm(n.id)}</button>
                    {n.pinned && <span className="ml-1 text-xs bx-muted">(pinned)</span>}
                  </th>
                  <td className="py-1 pr-2">{n.kind === 'note' ? 'note' : n.code ? <><span className="font-mono">{n.code}</span> {codeMap.get(n.code)?.title}</> : `${n.code_status === 'undetermined' ? '? ' : ''}${S.codes.status[n.code_status]}${n.type ? ` · ${n.type}` : ''}`}</td>
                  <td className="py-1 pr-2"><RichView doc={n.kind === 'note' ? n.notes : n.circumstance} clamp={120} /></td>
                  <td className="py-1">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="bx-btn ax-tap" onClick={() => setEditNode(n.id)} aria-label={`${C.list.edit} ${nm(n.id)}`} data-testid="list-edit-node">{C.list.edit}</button>
                      {n.kind !== 'note' && <button type="button" className="bx-btn ax-tap" onClick={() => onAssoc(n.id)} aria-label={`${C.assoc.open} for ${nm(n.id)}`}>{C.assoc.open}</button>}
                      <button type="button" className="bx-btn ax-tap" onClick={() => apply((m) => updateNode(m, n.id, { pinned: !n.pinned }))} aria-label={`${n.pinned ? 'Unpin' : 'Pin'} ${nm(n.id)}`}>{n.pinned ? 'Unpin' : 'Pin'}</button>
                      <button type="button" className="bx-btn ax-tap" onClick={() => { apply((m) => deleteNodes(m, [n.id])); announce(`Deleted ${nm(n.id)}.`); }} aria-label={`${C.list.delete} ${nm(n.id)}`} data-testid="list-delete-node">{C.list.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!map.nodes.length && <p className="mt-2 text-sm bx-muted">{C.list.none}</p>}
        </div>
      </section>
      <section className="mt-6" aria-labelledby="lv-edges">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="lv-edges" className="text-xl">{C.list.edges} ({map.edges.length})</h3>
          <button type="button" className="bx-btn ax-tap" onClick={onAddEdge} disabled={map.nodes.length < 2} data-testid="list-add-edge">{C.edge.add}</button>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm" data-testid="edges-table">
            <thead>
              <tr className="text-left"><th scope="col" className="py-1 pr-2">From → To</th><th scope="col" className="py-1 pr-2">Polarity · weight</th><th scope="col" className="py-1 pr-2">Basis</th><th scope="col" className="py-1 pr-2">Description</th><th scope="col" className="py-1">Actions</th></tr>
            </thead>
            <tbody>
              {map.edges.map((e) => (
                <tr key={e.id} className={`border-t border-[color:var(--bx-line)] align-top ${state(e.id) === 'dimmed' ? 'opacity-50' : ''}`} data-edge={e.id} data-state={state(e.id)}>
                  <th scope="row" className="py-1 pr-2 text-left font-medium">
                    <span className="sr-only">{describeEdge(e)}</span>
                    <span aria-hidden>{nm(e.from)} → {nm(e.to)}</span>
                  </th>
                  <td className="py-1 pr-2"><span className={e.polarity === '+' ? 'ax-edge-pos font-bold' : 'ax-edge-neg font-bold'}>{e.polarity}</span> {e.weight}{e.delay ? ' ‖' : ''} · {e.confidence}{e.evidence.length ? ` · ${e.evidence.map((n) => `[${n}]`).join('')}` : ''}</td>
                  <td className="py-1 pr-2" data-testid="edge-basis">{e.basis === 'evidence' ? `evidence ${e.link}` : e.basis === 'override' ? '⚑ override' : '⚑ needs review'}</td>
                  <td className="py-1 pr-2">{plainText(e.description) ? <RichView doc={e.description} clamp={120} /> : <span className="bx-muted">—</span>}</td>
                  <td className="py-1">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="bx-btn ax-tap" onClick={() => { setEditEdge(e.id); setErr(null); }} aria-label={`${C.list.edit} link ${nm(e.from)} to ${nm(e.to)}`} data-testid="list-edit-edge">{C.list.edit}</button>
                      <button type="button" className="bx-btn ax-tap" onClick={() => { apply((m) => deleteEdges(m, [e.id])); announce('Deleted the link.'); }} aria-label={`${C.list.delete} link ${nm(e.from)} to ${nm(e.to)}`} data-testid="list-delete-edge">{C.list.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!map.edges.length && <p className="mt-2 text-sm bx-muted">{C.list.none}</p>}
        </div>
      </section>
      <Dialog open={!!node} onClose={() => setEditNode(null)} title={node ? `${C.list.edit}: ${nm(node.id)}` : ''} wide testId="list-node-dialog">
        {node && (
          <>
            <NodeFields draft={node} onChange={(p, key) => apply((m) => updateNode(m, node.id, p), key ? `n:${node.id}:${key}` : undefined)} />
            <button type="button" className="bx-btn-primary ax-tap" onClick={() => setEditNode(null)} data-testid="list-node-done">Done</button>
          </>
        )}
      </Dialog>
      <Dialog open={!!edge} onClose={() => setEditEdge(null)} title={edge ? `${C.list.edit}: ${nm(edge.from)} → ${nm(edge.to)}` : ''} wide testId="list-edge-dialog">
        {edge && (
          <>
            {err && <p role="alert" className="bx-todo mb-2">{err}</p>}
            <BasisPanel
              key={`${edge.id}:${edge.basis}`}
              edge={edge}
              map={map}
              nm={nm}
              onPatch={(p) => {
                try {
                  apply((m) => updateEdge(m, edge.id, p));
                  setErr(null);
                } catch (x) {
                  setErr((x as Error).message);
                }
              }}
            />
            <EdgeFields
              draft={edge}
              onChange={(p, key) => {
                try {
                  apply((m) => updateEdge(m, edge.id, p), key ? `e:${edge.id}:${key}` : undefined);
                  setErr(null);
                } catch (x) {
                  setErr((x as Error).message);
                }
              }}
            />
            <button type="button" className="bx-btn-primary ax-tap" onClick={() => setEditEdge(null)}>Done</button>
          </>
        )}
      </Dialog>
    </div>
  );
}
