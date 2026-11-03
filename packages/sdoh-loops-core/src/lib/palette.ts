/**
 * Group palette (DESIGN-SYSTEM §3, UI-12): one hue per ICD-11 block, from Paul Tol's colour-blind-safe "muted" and
 * "bright" sets. With more than 8 groups each hue is paired with a glyph, and every node also shows its code, so
 * colour is never the only cue. Fills are the hue mixed into the paper (light) or night (dark) background so labels
 * keep ≥ 4.5:1 contrast; borders use the full hue.
 */
export const GROUP_STYLE: Record<string, { hue: string; glyph: string }> = {
  'QD50-QD5Z': { hue: '#CC6677', glyph: '◆' },
  'QD60-QD6Z': { hue: '#999933', glyph: '▲' },
  'QD70-QD7Z': { hue: '#117733', glyph: '■' },
  QD71: { hue: '#44AA99', glyph: '⌂' },
  'QD80-QD8Z': { hue: '#4477AA', glyph: '●' },
  'QD90-QD9Z': { hue: '#DDCC77', glyph: '✎' },
  'QE00-QE0Z': { hue: '#882255', glyph: '✦' },
  'QE10-QE2Z': { hue: '#88CCEE', glyph: '◐' },
  'QE30-QE3Z': { hue: '#332288', glyph: '✚' },
  'QE40-QE4Z': { hue: '#AA4499', glyph: '⚖' },
  'QE50-QE5Z': { hue: '#EE6677', glyph: '♥' },
  'QE60-QE6Z': { hue: '#BBBBBB', glyph: '○' },
  QE70: { hue: '#228833', glyph: '⌘' },
  'QE80-QE8Z': { hue: '#EE7733', glyph: '⚡' },
  'QE90-QE9Z': { hue: '#CCBB44', glyph: '✿' },
  'QF20-QF2Z': { hue: '#66CCEE', glyph: '◇' },
};
export const NEUTRAL = { hue: '#8a8378', glyph: '' };

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((x, i) => Math.round(x * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}
export function fillFor(hue: string, dark: boolean) {
  return dark ? mix(hue, '#211d18', 0.32) : mix(hue, '#faf8f4', 0.28);
}
export function borderFor(hue: string, dark: boolean) {
  return dark ? mix(hue, '#efeae2', 0.8) : mix(hue, '#1f1b16', 0.72);
}
/** User palette for overrides (UI-12, UI-15 text colour): the group hues plus ink. */
export const USER_COLOURS = ['#1f1b16', '#2f5d9a', '#a3243b', '#117733', '#b45309', '#882255', '#332288', '#4477AA', '#CC6677', '#999933'];
