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
  it('one name for folding the dock; "Editor" and "side panels" are gone', async () => {
    const { C } = await import('../../packages/sdoh-loops-core/src/lib/copy');
    expect(C.dock.edit).toBe('Edit');
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

describe('SL23 copy', () => {
  it('the interface copy is US English: a short denylist of British forms finds nothing in C', async () => {
    const { C } = await import('../../packages/sdoh-loops-core/src/lib/copy');
    const all: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'string') all.push(`${path}: ${v}`);
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(C, 'C');
    // "behaviour" would be allowed only where it quotes a WHO ICD-11 title, and C quotes none
    const british = /colour|analys(e|ed|ing)\b|organis|recognis|behaviour|greyscale|neighbour|\bcentre/i;
    expect(all.filter((s) => british.test(s.slice(s.indexOf(": ") + 2)))).toEqual([]);
  });
  it('the dock and tab keys: dock.selection / read / edit / wholeMap; dock.analyse and panels.tocode are gone', async () => {
    const { C } = await import('../../packages/sdoh-loops-core/src/lib/copy');
    expect(C.dock.selection).toMatchObject({ node: 'Selected circumstance', edge: 'Selected link', none: 'Nothing selected' });
    expect([C.dock.read, C.dock.edit, C.dock.wholeMap]).toEqual(['Read', 'Edit', 'Whole map']);
    expect('analyse' in C.dock).toBe(false);
    expect(C.panels).not.toHaveProperty('tocode');
    expect(C.panels).not.toHaveProperty('map');
    expect(C.panels.needsCode).toBe('Needs a code');
    expect(C.panels.about).toBe('About this map');
  });
  it('E is Read / Edit and K a new link; E is no longer "new link"', async () => {
    const { C } = await import('../../packages/sdoh-loops-core/src/lib/copy');
    const keys = [...C.keys, ...C.keysMore];
    expect(keys.filter(([k]) => k === 'E')).toEqual([['E', 'read / edit the selection']]);
    expect(keys.find(([k]) => k === 'K')?.[1]).toBe('new link from the selection');
  });
  it('SL24: My maps and the Map menu share their wording; maps.import is gone', async () => {
    const { C } = await import('../../packages/sdoh-loops-core/src/lib/copy');
    expect(C.maps).toMatchObject({ start: 'Start a map', openFile: 'Open a map file', openFileHint: 'A map exported from SDOH Loops or an SDOH Interrogator app' });
    expect(C.maps.dropHere).toMatch(/drop/i);
    expect('import' in C.maps).toBe(false);
  });
});
