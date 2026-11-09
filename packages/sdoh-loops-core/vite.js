/**
 * Vite settings a consumer needs (README): ELK's optional 'web-worker' import resolves to an empty module, so the
 * layout runs on the page and nothing is fetched as a worker; and the package's content globs for Tailwind.
 */
import { fileURLToPath, URL } from 'node:url';

export const sdohCoreAlias = { 'web-worker': fileURLToPath(new URL('./src/lib/empty-worker.ts', import.meta.url)) };
export const sdohCoreContent = [fileURLToPath(new URL('./src/**/*.{ts,tsx}', import.meta.url))];

/** @deprecated SL33 (0.11.0): nothing reads the switch any more. Off for 'off', 'false', '0'; on otherwise. */
export function xwalkOn(env) {
  return !['off', 'false', '0'].includes(String(env ?? 'on').trim().toLowerCase());
}

let warned = false;

/** @deprecated SL33 (0.11.0): a no-op that logs one deprecation line. Pack 0.4.0 carries no crosswalk to switch off. */
export function sdohCrosswalk() {
  if (!warned) {
    warned = true;
    console.warn('[sdoh-loops-core] sdohCrosswalk is deprecated and does nothing: the pack carries no crosswalk since 0.4.0. Remove it from your Vite config.');
  }
  return { name: 'sdoh-crosswalk' };
}
