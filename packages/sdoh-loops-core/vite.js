/**
 * Vite settings a consumer needs (README): ELK's optional 'web-worker' import resolves to an empty module, so the
 * layout runs on the page and nothing is fetched as a worker; the package's content globs for Tailwind; and (SL32)
 * the crosswalk switch, which applies to the content pack's data as it is bundled.
 */
import { fileURLToPath, URL } from 'node:url';
import { PACK_DATA_ID, xwalkData, xwalkOn } from './xwalk.js';

export const sdohCoreAlias = { 'web-worker': fileURLToPath(new URL('./src/lib/empty-worker.ts', import.meta.url)) };
export const sdohCoreContent = [fileURLToPath(new URL('./src/**/*.{ts,tsx}', import.meta.url))];
export { xwalkOn };

/**
 * SL32 (T-LIC-01): `sdohCrosswalk({ crosswalk })` — with `crosswalk: false` the pack's ICD-10-CM half of every code's
 * crosswalk, its marked text (`<!-- xwalk -->…<!-- /xwalk -->`) and its marked records (`xwalk: true`) are left out
 * of the bundle, and the core's own crosswalk code is compiled out (VITE_SDOH_XWALK=off). Pass the same value as
 * `<SdohMap crosswalk>`. With `crosswalk: true` (the default) only the markers are removed.
 */
export function sdohCrosswalk({ crosswalk = true } = {}) {
  return {
    name: 'sdoh-crosswalk',
    enforce: 'pre',
    config() {
      return { define: { 'import.meta.env.VITE_SDOH_XWALK': JSON.stringify(crosswalk ? 'on' : 'off') } };
    },
    transform(code, id) {
      if (!PACK_DATA_ID.test(id)) return null;
      return { code: JSON.stringify(xwalkData(JSON.parse(code), crosswalk)), map: null };
    },
  };
}
