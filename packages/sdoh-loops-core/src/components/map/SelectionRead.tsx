import type { ReactNode } from 'react';
import { S } from '../../lib/data/core';
import { links as packLinks } from '../../lib/data/scheme';
import { C } from '../../lib/copy';
import { count } from '../../lib/plural';
import { plainText } from '../../lib/model/rich';
import type { MapEdge, MapNode, SdohMap } from '../../lib/model/map';
import type { Loop } from '../../lib/analysis';
import { GradeChip } from '../ui/bits';
import { CitedText } from '../evidence/CitedText';
import { RefCard } from '../evidence/RefCard';
import { CodePopout } from './CodePopout';
import { RichView } from './RichView';
import { CodeLine, peekFacts } from './Peek';

function Row({ k, children, testId }: { k: string; children: ReactNode; testId?: string }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{k}</dt>
      <dd className="min-w-0" data-testid={testId}>{children}</dd>
    </div>
  );
}
const dash = <span className="bx-muted">—</span>;

/** one link in a circumstance's "links in / out" list: the other end, its polarity and its basis (evidence id and grade) */
function LinkLine({ e, other, nm }: { e: MapEdge; other: string; nm: (id: string) => string }) {
  const link = e.basis === 'evidence' && e.link ? packLinks.find((l) => l.id === e.link) : undefined;
  return (
    <li>
      <span className="font-mono" aria-label={e.polarity === '+' ? S.edges.polarity_plus : S.edges.polarity_minus}>{e.polarity === '+' ? '+' : '−'}</span> {nm(other)}{' '}
      <span className="bx-muted">
        · {C.evidence.basisLabel[e.basis]}
        {link && <> <span className="font-mono">{link.id}</span> <GradeChip grade={link.grade} /></>}
      </span>
    </li>
  );
}

/**
 * SL23: the selection card's Read mode — the selected circumstance, note or link as a reader sees it, as text. No
 * editing control is rendered at all (Edit mode adds them); the evidence references stay openable.
 */
export function SelectionRead({ map, node, edge, multi, nm, loops, loopNames, empty }: {
  map: SdohMap; node?: MapNode; edge?: MapEdge; multi: { nodes: number; edges: number }; nm: (id: string) => string; loops: Loop[]; loopNames: Map<string, string>; empty: string;
}) {
  if (node && node.kind === 'note')
    return (
      <div data-testid="selection-read" data-kind="note">
        <RichView doc={node.notes} className="bx-prose text-sm" />
        <p className="mt-2 text-sm bx-muted">{node.pinned ? C.node.pinned : C.read.notPinned}</p>
      </div>
    );
  if (node) {
    const f = peekFacts({ kind: 'node', node }, map, nm, loops, loopNames);
    if (f.kind !== 'node') return null;
    const out = map.edges.filter((e) => e.from === node.id);
    const into = map.edges.filter((e) => e.to === node.id);
    return (
      <div data-testid="selection-read" data-kind="node" className="text-sm">
        {f.code && <CodeLine text={f.code} testId="read-code" />}
        <p className="font-display text-lg font-semibold leading-snug" data-testid="read-title">{f.title}</p>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1">
          {f.label && <Row k={C.peek.label}>{f.label}</Row>}
          <Row k={C.peek.circumstance}>{node.circumstance.content.some((p) => p.content?.length) ? <RichView doc={node.circumstance} /> : dash}</Row>
          <Row k={C.peek.status} testId="read-status">{f.status}</Row>
          {node.code_status === 'other' && <Row k={C.read.type}>{node.type ?? dash}{node.ref ? ` · ${node.ref} (${C.node.userEntered})` : ''}</Row>}
          {node.severity !== null && <Row k={C.read.severity}>{node.severity}</Row>}
          {node.since && <Row k={C.read.since}>{node.since}</Row>}
          <Row k={C.peek.out} testId="read-out">{out.length ? <ul>{out.map((e) => <LinkLine key={e.id} e={e} other={e.to} nm={nm} />)}</ul> : '0'}</Row>
          <Row k={C.peek.in} testId="read-in">{into.length ? <ul>{into.map((e) => <LinkLine key={e.id} e={e} other={e.from} nm={nm} />)}</ul> : '0'}</Row>
          <Row k={C.peek.loops}>{f.loops.length ? f.loops.join(', ') : C.peek.noLoops}</Row>
          <Row k={C.read.pinned} testId="read-pinned">{node.pinned ? C.peek.yes : C.peek.no}</Row>
          {plainText(node.notes) && <Row k={C.node.notes}><RichView doc={node.notes} /></Row>}
        </dl>
        {node.code && (
          <section className="bx-card mt-3 p-3" aria-label="About this code">
            <CodePopout code={node.code} />
          </section>
        )}
      </div>
    );
  }
  if (edge) {
    const f = peekFacts({ kind: 'edge', edge }, map, nm, loops, loopNames);
    if (f.kind !== 'edge') return null;
    return (
      <div data-testid="selection-read" data-kind="edge" className="text-sm">
        <p className="font-display text-lg font-semibold leading-snug" data-testid="read-title">
          {f.from} <span aria-hidden>→</span><span className="sr-only">leads to</span> {f.to}
        </p>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1">
          <Row k={C.edge.polarity}>{f.polarity === '+' ? S.edges.polarity_plus : S.edges.polarity_minus}</Row>
          <Row k={C.edge.weight}>{f.weight}</Row>
          <Row k={S.edges.delay}>{f.delay ? C.peek.yes : C.peek.no}</Row>
          <Row k={C.edge.confidence}>{edge.confidence}</Row>
          <Row k={C.evidence.basis} testId="read-basis">
            {f.link ? <>{C.evidence.basisLabel.evidence} <span className="font-mono">{f.link.id}</span> <GradeChip grade={f.link.grade} /></> : <>{C.evidence.basisLabel[f.basis]}{f.reason ? `: ${f.reason}` : ''}</>}
          </Row>
          {f.link && <Row k={C.peek.mechanism}><CitedText text={f.link.mechanism} as="div" className="bx-prose leading-6" /></Row>}
          {f.description && <Row k={C.peek.description}>{f.description}</Row>}
        </dl>
        {!f.link && edge.evidence.length > 0 && (
          <section className="mt-3" aria-label={C.edge.evidence}>
            <h3 className="font-semibold">{C.edge.evidence}</h3>
            {edge.evidence.map((n) => <div key={n} className="bx-foldout"><RefCard n={n} /></div>)}
          </section>
        )}
        {!edge.evidence.length && <p className="mt-2 bx-muted">{C.edge.userDrawn}</p>}
      </div>
    );
  }
  if (multi.nodes + multi.edges > 0)
    return <p className="text-sm bx-muted" data-testid="selection-read" data-kind="many">{count(multi.nodes, 'circumstance')} and {count(multi.edges, 'link')} selected.</p>;
  return <p className="text-sm bx-muted" data-testid="inspector-empty">{empty}</p>;
}
