import { describe, expect, it } from 'vitest';
import { overlay } from '../../packages/sdoh-loops-core/src/lib/copy';

describe('ui-strings overlay (K2 item 3)', () => {
  const base = { nav: { map: 'Map', maps: 'My maps' }, keys: [['N', 'new']] as [string, string][], loops: { rename: 'Rename' } };
  it('pack strings replace fallbacks at the same path; the rest stays', () => {
    expect(overlay(base, { nav: { map: 'Canvas' }, loops: { title: 'Loops', rename: 'Rename loop' } })).toEqual({ nav: { map: 'Canvas', maps: 'My maps' }, keys: [['N', 'new']], loops: { rename: 'Rename loop' } });
  });
  it('a value of the wrong shape never replaces a fallback', () => {
    expect(overlay(base, { nav: 'x', keys: {}, loops: { rename: 3 } })).toEqual(base);
  });
});

describe('SL17 review copy', () => {
  it('the dock has Edit and Analyse cards and one name for folding; "Editor" and "side panels" are gone', async () => {
    const { C } = await import('../../packages/sdoh-loops-core/src/lib/copy');
    expect(C.dock.edit).toBe('Edit');
    expect(C.dock.analyse).toBe('Analyse');
    expect(C.dock.fold).toBe('Fold the side dock');
    expect(C.dock.foldTip).toBe('Fold the side dock (])');
    expect('editor' in C.dock).toBe(false);
    expect(JSON.stringify(C.dock)).not.toMatch(/Editor|side panels/);
    expect(JSON.stringify(C.keysMore)).not.toMatch(/side panels/);
  });
  it('the layout picker uses plain names, each with a one-line tooltip; the engine ids stay', async () => {
    const { C } = await import('../../packages/sdoh-loops-core/src/lib/copy');
    expect(C.layoutPick.label).toBe('Layout');
    expect([C.layoutPick.fcose, C.layoutPick['elk-stress']]).toEqual(['Clustered', 'Evenly spaced']);
    for (const k of ['fcoseTip', 'elk-stressTip']) expect(C.layoutPick[k]).toMatch(/^[^\n]{10,90}$/);
  });
});
