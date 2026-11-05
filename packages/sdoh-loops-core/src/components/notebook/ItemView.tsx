import { C } from '../../lib/copy';
import { conceptMap, refMap, termMap } from '../../lib/data/refs';
import type { SdohMap } from '../../lib/model/map';
import type { Target } from '../../lib/model/notebook';
import { CodePopout } from '../map/CodePopout';
import { RefCard } from '../evidence/RefCard';
import { CitedInNotebook } from './Citations';

/**
 * SL28: an item a passage points at that is not on the canvas — an ICD-11 code (WHO's text), a reference, a glossary
 * term, a 101, or a user-entered reference — shown in a dialog from the notebook, with "Cited in your notebook (n)".
 * Text comes from the pack as it is.
 */
export function ItemView({ t, map }: { t: Target; map: SdohMap }) {
  if (t.kind === 'code') return <CodePopout code={t.id} headingLevel={3} />;
  if (t.kind === 'reference') {
    if (t.id.startsWith('map:')) {
      const n = map.nodes.find((x) => x.id === t.id.slice(4));
      return (
        <div className="text-sm" data-testid="item-user-ref">
          <p className="font-medium">{n?.ref ?? '—'}</p>
          <p className="text-xs bx-muted">{C.node.userEntered}</p>
          <CitedInNotebook t={t} />
        </div>
      );
    }
    return refMap.has(Number(t.id)) ? <RefCard n={Number(t.id)} /> : null;
  }
  if (t.kind === 'glossary') {
    const g = termMap.get(t.id);
    if (!g) return null;
    return (
      <div className="text-sm" data-testid="item-term">
        <h3 className="font-display text-lg font-semibold">{g.term}</h3>
        <p className="mt-1 bx-prose leading-6">{g.definition}</p>
        <CitedInNotebook t={t} />
      </div>
    );
  }
  if (t.kind === 'concept') {
    const c = conceptMap.get(t.id);
    if (!c) return null;
    return (
      <div className="text-sm" data-testid="item-concept">
        <h3 className="font-display text-lg font-semibold">101: {c.title}</h3>
        <p className="mt-1 bx-prose leading-6">{c.one_liner}</p>
        <p className="mt-1 bx-prose leading-6">{c.why_here}</p>
        <CitedInNotebook t={t} />
      </div>
    );
  }
  return null;
}
