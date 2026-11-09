/** SL39: the kit's colour pairs meet their contrast minimums, computed from the pack's brand record. SL38/SL39: the report's header line. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { loopReportMD, newMap } from '@feelingsarereal/sdoh-loops-core';

const brand = (yaml.load(fs.readFileSync('content-pack/manifest.yaml', 'utf8')) as { brand: { colors: Record<string, string> } }).brand;
const c = brand.colors;
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('SL39 brand colours', () => {
  const css = fs.readFileSync('src/brand.css', 'utf8');
  it.each([
    ['body ink on white', c.dark_gray, c.white],
    ['muted on white', c.medium_gray, c.white],
    ['links and headings on white', c.orange_text, c.white],
    ['white on the accent', c.white, c.orange_text],
    ['links and headings on the dark surface', c.lof_orange, c.dark_bg],
    ['ink on the light tint', c.dark_gray, '#fbe5d6'],
  ])('%s is at least 4.5:1', (_n, a, b) => expect(ratio(a, b)).toBeGreaterThanOrEqual(4.5));
  it('the stylesheet uses the kit\'s values', () => {
    for (const v of [c.dark_gray, c.medium_gray, c.orange_text, c.lof_orange, c.dark_bg]) expect(css.toLowerCase()).toContain(v.toLowerCase());
  });
});

describe('SL39 report header', () => {
  it('prints the made-with line under the header when given', () => {
    const map = newMap('x', '');
    const L = { strengthLabel: 's', reinforcing: 'r', balancing: 'b', truncated: 't', none: 'n', notice: 'not advice' };
    const out = loopReportMD(map, () => '', { ...L, madeWith: 'Made with Health in Context (Little Orange Fish)' });
    expect(out).toMatch(/from Health in Context \(schema \d+\)\.\n/);
    expect(out).toContain('\nMade with Health in Context (Little Orange Fish)\n');
  });
});
