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
