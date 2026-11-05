/**
 * SL32 (T-LIC-01): the ICD-10-CM crosswalk switch, applied to the content pack's data at build time.
 *
 * WHO's ICD-11 licence lets an app reproduce codes, titles and definitions, but any mapping between ICD-11 and another
 * classification needs WHO's separate written agreement (§1.2.4). A build with the crosswalk off must therefore carry
 * no ICD-11 ↔ ICD-10-CM pairing anywhere in its output. The pack marks what pairs them:
 *   - `crosswalk.icd10cm`, `crosswalk.icd10cm_titles`, `crosswalk.icd10cm_sources` on a code;
 *   - `<!-- xwalk -->…<!-- /xwalk -->` around text in a string (a primer's sentence);
 *   - `xwalk: true` on a record in a list (a to-do item about the crosswalk).
 * With the crosswalk on, only the markers go. With it off, the marked text, the marked records and the ICD-10-CM half
 * of every code's crosswalk go too; the Healthy People 2030 half stays as the builder's own topic tag.
 *
 * Plain JavaScript, so a host's vite.config can import it (through ./vite.js) and so can the core's own tests.
 */

const SEGMENT = /[ \t]*<!-- xwalk -->[\s\S]*?<!-- \/xwalk -->/g;
const MARKER = /<!-- \/?xwalk -->\n?/g;

/** A string with the markers removed (on), or with the marked text removed as well (off). */
export function xwalkText(s, on = true) {
  if (on) return s.replace(MARKER, '');
  return s
    .replace(SEGMENT, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '');
}

/** A deep copy of pack data with the crosswalk switch applied. */
export function xwalkData(value, on = true) {
  if (typeof value === 'string') return xwalkText(value, on);
  if (Array.isArray(value)) {
    const kept = on ? value : value.filter((v) => !(v && typeof v === 'object' && v.xwalk === true));
    return kept.map((v) => xwalkData(v, on));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = xwalkData(v, on);
    if (!on && 'crosswalk' in out && out.crosswalk && typeof out.crosswalk === 'object' && Array.isArray(out.crosswalk.icd10cm)) {
      const cw = out.crosswalk;
      cw.icd10cm = [];
      cw.icd10cm_titles = [];
      delete cw.icd10cm_sources;
      // the HP2030 half keeps only its own source; a pack without the split keeps none rather than the ICD-10-CM one
      cw.sources = cw.hp2030_sources ? [...cw.hp2030_sources] : [];
      // a code whose crosswalk was ICD-10-CM only (Z72, the health behaviours) has none left
      if (!Array.isArray(cw.hp2030) || cw.hp2030.length === 0) out.crosswalk = null;
    }
    return out;
  }
  return value;
}

/** Whether an env value turns the crosswalk off: 'off', 'false' or '0' (anything else, or unset, is on). */
export function xwalkOn(env) {
  return !['off', 'false', '0'].includes(String(env ?? 'on').trim().toLowerCase());
}

/** The pack's data files, as a host resolves them (workspace link or node_modules). */
export const PACK_DATA_ID = /[\\/]sdoh-loops-pack[\\/]data[\\/][\w.-]+\.json(\?.*)?$/;
