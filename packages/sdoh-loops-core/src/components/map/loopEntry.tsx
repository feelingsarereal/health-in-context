/** SL25 (WCAG 2.5.3, Label in Name): a loop entry has no separate aria-label, so its accessible name is its visible text. */
export interface LoopEntry { name: string; kind: 'R' | 'B'; kindWord: string; length: number; overrides: number; strength: number; nodes: string[] }

const overridesText = (n: number) => (n === 0 ? 'no overrides' : `${n} ${n === 1 ? 'override' : 'overrides'} ⚑`);

export function LoopEntryText({ entry: l }: { entry: LoopEntry }) {
  return (
    <>
      <span className="font-semibold" data-testid="loop-name">{l.name}</span> · <span className={`${l.kind === 'R' ? 'ax-edge-pos' : 'ax-edge-neg'} font-bold`} aria-hidden="true">{l.kind === 'R' ? '↻' : '↺'}</span> {l.kindWord} · <span data-testid="loop-length">{l.length}</span> {l.length === 1 ? 'link' : 'links'} · <span data-testid="loop-overrides">{overridesText(l.overrides)}</span> · strength {l.strength.toFixed(3)}
      <span className="mt-0.5 block text-xs bx-muted">{l.nodes.join(' → ')} → ↺</span>
    </>
  );
}
