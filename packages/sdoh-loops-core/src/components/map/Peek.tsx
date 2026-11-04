import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { S } from '../../lib/data/core';
import { codeMap, links as packLinks } from '../../lib/data/scheme';
import { C } from '../../lib/copy';
import { plainText } from '../../lib/model/rich';
import { checkLink } from '../../lib/model/evidence';
import { nodeName } from '../../lib/model/interchange';
import type { MapEdge, MapNode, NodeText, SdohMap } from '../../lib/model/map';
import type { Loop } from '../../lib/analysis';
import { GradeChip } from '../ui/bits';
import { CitedText } from '../evidence/CitedText';
import { codeLine, nodeTextParts } from './nodeText';

/** SL17: what a peek is about, as a host's renderPeek receives it */
export type PeekTarget = { kind: 'node'; node: MapNode } | { kind: 'edge'; edge: MapEdge };

const titleOf = (c: string) => codeMap.get(c)?.title;

/** The facts a peek shows, without the markup: unit-tested, and the popover renders exactly these. */
export function peekFacts(target: PeekTarget, map: SdohMap, nm: (id: string) => string, loops: Loop[], loopNames: Map<string, string>) {
  if (target.kind === 'node') {
    const n = target.node;
    const t = nodeTextParts(n, 'title-code' satisfies NodeText);
    const out = map.edges.filter((e) => e.from === n.id);
    const into = map.edges.filter((e) => e.to === n.id);
    return {
      kind: 'node' as const,
      // SL30 point 5: the code, then WHO's title for it
      code: t.head ? codeLine(n) : null,
      // whole: the box cuts a long title at 42 characters
      title: nodeName(n, titleOf),
      label: plainText(n.label),
      circumstance: plainText(n.circumstance),
      status: `${S.codes.status[n.code_status]}${n.code ? ` · ${n.code}${titleOf(n.code) ? ` ${titleOf(n.code)}` : ''}` : ''}`,
      out: out.map((e) => nm(e.to)),
      in: into.map((e) => nm(e.from)),
      loops: loops.filter((l) => l.nodes.includes(n.id)).map((l) => `${loopNames.get(l.key) ?? l.kind} (${l.kind === 'R' ? S.loops.reinforcing : S.loops.balancing})`),
    };
  }
  const e = target.edge;
  const link = e.link ? packLinks.find((l) => l.id === e.link) : undefined;
  const a = map.nodes.find((n) => n.id === e.from);
  const b = map.nodes.find((n) => n.id === e.to);
  return {
    kind: 'edge' as const,
    from: nm(e.from),
    to: nm(e.to),
    polarity: e.polarity,
    weight: e.weight,
    delay: e.delay,
    basis: e.basis,
    link: e.basis === 'evidence' && link ? { id: link.id, grade: link.grade, mechanism: `${link.id}: ${link.mechanism}` } : null,
    reason: e.basis === 'override' ? plainText(e.override_reason) : e.basis === 'needs-review' ? (a && b ? checkLink(a, b, e.polarity).message : e.check) : null,
    description: plainText(e.description),
  };
}

/**
 * SL30 point 5: the small, muted code line — one line, cut with an ellipsis when the space runs out; the whole line is
 * its text (so its accessible name), its tooltip, and on keyboard focus it wraps to show all of it.
 */
export function CodeLine({ text, testId }: { text: string; testId: string }) {
  return (
    <p className="truncate rounded-sm text-xs font-semibold bx-muted focus:whitespace-normal focus-visible:outline focus-visible:outline-2" role="note" aria-label={text} title={text} tabIndex={0} data-testid={testId}>
      {text}
    </p>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{k}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
const names = (xs: string[]) => (xs.length ? `${xs.length}: ${xs.join(', ')}` : '0');

/**
 * SL17: the read-only peek — a popover over the canvas for one circumstance or link. It never edits: "Open in editor"
 * selects the target, and a circumstance's "Associations…" opens the association menu. A host's renderPeek lines go
 * below the core's. Click-away and Esc close it; opened from the keyboard, it takes focus and gives it back.
 */
export function Peek({ target, at, map, nm, loops, loopNames, renderPeek, keyboard, onClose, onOpen, onAssoc }: {
  target: PeekTarget; at: { x: number; y: number }; map: SdohMap; nm: (id: string) => string; loops: Loop[]; loopNames: Map<string, string>;
  renderPeek?: (target: PeekTarget) => ReactNode; keyboard: boolean; onClose: () => void; onOpen: () => void; onAssoc?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const back = useRef<Element | null>(null);
  const [pos, setPos] = useState(at);
  const f = peekFacts(target, map, nm, loops, loopNames);
  // kept inside the canvas: flipped to the other side of the pointer when it would run off
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const W = box.clientWidth;
    const H = box.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = at.x + 12 + w > W - 8 ? Math.max(8, at.x - 12 - w) : at.x + 12;
    const y = at.y + 12 + h > H - 8 ? Math.max(8, Math.min(H - 8 - h, at.y - 12 - h)) : at.y + 12;
    setPos({ x, y });
  }, [at.x, at.y, target]);
  useEffect(() => {
    back.current = document.activeElement;
    if (keyboard) ref.current?.focus();
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // a pointer press anywhere else closes it; the press that opened it has already happened
    document.addEventListener('pointerdown', away, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const heading = f.kind === 'node' ? f.title : `${f.from} → ${f.to}`;
  // opened from the keyboard, focus goes back where it was (before the popover leaves the page)
  const close = () => {
    if (keyboard && ref.current?.contains(document.activeElement)) (back.current as HTMLElement | null)?.focus?.();
    onClose();
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${C.peek.title}: ${heading}`}
      tabIndex={-1}
      className="bx-card absolute z-30 max-h-[min(28rem,calc(100%-1rem))] w-[min(22rem,calc(100%-1rem))] overflow-y-auto p-3 text-sm shadow-lg bg-[color:var(--bx-bg)] dark:bg-night-2"
      style={{ left: pos.x, top: pos.y }}
      data-testid="peek"
      data-kind={f.kind}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {f.kind === 'node' && f.code && <CodeLine text={f.code} testId="peek-code" />}
          <p className="font-semibold leading-snug" data-testid="peek-title">
            {f.kind === 'node' ? f.title : <>{f.from} <span aria-hidden>→</span><span className="sr-only">leads to</span> {f.to}</>}
          </p>
        </div>
        <button type="button" className="bx-btn ax-tap justify-center" onClick={close} aria-label={C.peek.close}>✕</button>
      </div>
      {f.kind === 'node' ? (
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1" data-testid="peek-facts">
          {f.label && <Row k={C.peek.label}>{f.label}</Row>}
          <Row k={C.peek.circumstance}>{f.circumstance || <span className="bx-muted">—</span>}</Row>
          <Row k={C.peek.status}>{f.status}</Row>
          <Row k={C.peek.out}><span data-testid="peek-out">{names(f.out)}</span></Row>
          <Row k={C.peek.in}><span data-testid="peek-in">{names(f.in)}</span></Row>
          <Row k={C.peek.loops}><span data-testid="peek-loops">{f.loops.length ? f.loops.join(', ') : C.peek.noLoops}</span></Row>
        </dl>
      ) : (
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1" data-testid="peek-facts">
          <Row k={C.edge.polarity}><span data-testid="peek-polarity">{f.polarity === '+' ? S.edges.polarity_plus : S.edges.polarity_minus}</span></Row>
          <Row k={C.edge.weight}>{f.weight}</Row>
          <Row k={S.edges.delay}>{f.delay ? C.peek.yes : C.peek.no}</Row>
          <Row k={C.evidence.basis}>
            <span data-testid="peek-basis">
              {f.link ? (
                <>{C.evidence.basisLabel.evidence} <span className="font-mono">{f.link.id}</span> <GradeChip grade={f.link.grade} /></>
              ) : (
                <>{C.evidence.basisLabel[f.basis]}{f.reason ? `: ${f.reason}` : ''}</>
              )}
            </span>
          </Row>
          {f.link && (
            <Row k={C.peek.mechanism}>
              <div data-testid="peek-mechanism"><CitedText text={f.link.mechanism} as="div" className="bx-prose leading-6" /></div>
            </Row>
          )}
          {f.description && <Row k={C.peek.description}>{f.description}</Row>}
        </dl>
      )}
      {renderPeek && <div className="mt-2 border-t border-[color:var(--bx-line)] pt-2" data-testid="peek-host">{renderPeek(target)}</div>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className="bx-btn ax-tap" onClick={onOpen} data-testid="peek-open">{C.peek.open}</button>
        {onAssoc && <button type="button" className="bx-btn ax-tap" onClick={onAssoc} data-testid="peek-assoc">{C.peek.assoc}</button>}
      </div>
    </div>
  );
}
