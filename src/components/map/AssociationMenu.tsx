import { useState } from 'react';
import { associations, codeMap, endpointTitle, inEndpoint, tierBasis, type Link } from '@/lib/data/scheme';
import { S } from '@/lib/data/core';
import { C } from '@/lib/copy';
import { CitedText } from '@/components/evidence/CitedText';
import { GradeChip, PolarityChip } from '@/components/ui/bits';
import type { MapNode, SdohMap } from '@/lib/model/map';

export interface FollowRequest {
  link: Link | null;
  direction: 'out' | 'in';
  /** UI-17: link to a circumstance already on the map instead of adding a new one */
  existing?: string;
}
export interface Existing {
  id: string;
  name: string;
  code: string;
  /** an edge in this direction already exists */
  linked: boolean;
}

function Entry({ l, dir, onFollow, second, existing }: { l: Link; dir: 'out' | 'in'; onFollow: (r: FollowRequest) => void; second: boolean; existing: (endpoint: string, dir: 'out' | 'in') => Existing[] }) {
  const other = dir === 'out' ? l.to : l.from;
  const here = existing(other, dir);
  const next = second ? associations('', other) : null;
  return (
    <li className="bx-card p-3" data-testid="assoc-entry" data-link={l.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs bx-muted">{l.id}</span>
        <PolarityChip p={l.polarity} />
        <GradeChip grade={l.grade} />
        {l.counter && <span className="bx-chip border border-[color:var(--bx-line)]">{S.associations.counter}</span>}
      </div>
      <p className="mt-1 font-semibold">
        {dir === 'out' ? '→ ' : '← '}
        <span className="font-mono text-sm">{other}</span> {endpointTitle(other)}
      </p>
      <CitedText text={l.mechanism} className="mt-1 text-sm bx-prose leading-6" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {here.map((n) => (
          <button key={n.id} type="button" className="bx-btn-primary ax-tap" disabled={n.linked} onClick={() => onFollow({ link: l, direction: dir, existing: n.id })} data-testid="assoc-link-existing" data-node={n.id}>
            {C.evidence.linkExisting} {n.name} <span className="font-mono text-xs">({n.code})</span>
            {n.linked ? ' — already linked' : ''}
          </button>
        ))}
        <button type="button" className="bx-btn ax-tap" onClick={() => onFollow({ link: l, direction: dir })} data-testid="assoc-follow">
          {C.assoc.follow}
        </button>
      </div>
      {next && (
        <div className="mt-2 border-l-2 border-[color:var(--bx-line)] pl-3 text-sm" data-testid="second-degree">
          {[...next.leadsTo.map((x) => ['→', x] as const), ...next.comesFrom.map((x) => ['←', x] as const)].filter(([, x]) => x.id !== l.id).length === 0 ? (
            <p className="bx-muted">{C.assoc.none}</p>
          ) : (
            <ul className="space-y-2">
              {next.leadsTo.filter((x) => x.id !== l.id).map((x) => (
                <li key={`o${x.id}`}>
                  <span className="font-mono text-xs">{x.id}</span> {x.polarity} <GradeChip grade={x.grade} /> → {x.to} {endpointTitle(x.to)}
                  <CitedText text={x.mechanism} className="bx-prose leading-6" />
                </li>
              ))}
              {next.comesFrom.filter((x) => x.id !== l.id).map((x) => (
                <li key={`i${x.id}`}>
                  <span className="font-mono text-xs">{x.id}</span> {x.polarity} <GradeChip grade={x.grade} /> ← {x.from} {endpointTitle(x.from)}
                  <CitedText text={x.mechanism} className="bx-prose leading-6" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** UI-03 association menu: evidence-graded Leads to / Comes from for an SDOH node; never the withheld links. */
export function AssociationMenu({ node, onFollow, map, nameOf }: { node: MapNode; onFollow: (r: FollowRequest) => void; map: SdohMap; nameOf: (id: string) => string }) {
  const [second, setSecond] = useState(false);
  /** UI-17: circumstances already on the map whose code falls in the entry's endpoint (code, parent, QD71, block) */
  const existing = (endpoint: string, dir: 'out' | 'in'): Existing[] =>
    map.nodes
      .filter((n) => n.id !== node.id && n.kind !== 'note' && n.code_status === 'sdoh' && n.code && inEndpoint(n.code, endpoint))
      .map((n) => ({ id: n.id, name: nameOf(n.id), code: n.code!, linked: map.edges.some((e) => (dir === 'out' ? e.from === node.id && e.to === n.id : e.from === n.id && e.to === node.id)) }));
  if (node.code_status !== 'sdoh' || !node.code) {
    return (
      <div data-testid="assoc-menu">
        <p data-testid="assoc-needs-code">{S.codes.assign_for_associations}</p>
        <button type="button" className="bx-btn ax-tap mt-3" onClick={() => onFollow({ link: null, direction: 'out' })} data-testid="assoc-own">
          {C.assoc.yourOwn}
        </button>
      </div>
    );
  }
  const { leadsTo, comesFrom } = associations(node.code);
  const c = codeMap.get(node.code);
  return (
    <div data-testid="assoc-menu">
      <p className="text-sm">
        <span className="font-mono">{node.code}</span> {c?.title}
      </p>
      <p className="mt-1 text-xs bx-muted">{S.associations.tiers_note} {tierBasis}</p>
      <button type="button" className={`bx-btn ax-tap mt-2 ${second ? 'bx-btn-on' : ''}`} aria-pressed={second} onClick={() => setSecond((s) => !s)} data-testid="second-degree-toggle">
        {second ? C.assoc.hideSecond : S.associations.second_degree}
      </button>
      <section className="mt-3" aria-labelledby="assoc-leads">
        <h3 id="assoc-leads" className="text-lg font-semibold">{S.associations.leads_to} ({leadsTo.length})</h3>
        {leadsTo.length ? <ul className="mt-2 space-y-2" data-testid="leads-to">{leadsTo.map((l) => <Entry key={l.id} l={l} dir="out" onFollow={onFollow} second={second} existing={existing} />)}</ul> : <p className="text-sm bx-muted">{C.assoc.none}</p>}
      </section>
      <section className="mt-4" aria-labelledby="assoc-comes">
        <h3 id="assoc-comes" className="text-lg font-semibold">{S.associations.comes_from} ({comesFrom.length})</h3>
        {comesFrom.length ? <ul className="mt-2 space-y-2" data-testid="comes-from">{comesFrom.map((l) => <Entry key={l.id} l={l} dir="in" onFollow={onFollow} second={second} existing={existing} />)}</ul> : <p className="text-sm bx-muted">{C.assoc.none}</p>}
      </section>
      <button type="button" className="bx-btn ax-tap mt-4" onClick={() => onFollow({ link: null, direction: 'out' })} data-testid="assoc-own">
        {C.assoc.yourOwn}
      </button>
    </div>
  );
}
