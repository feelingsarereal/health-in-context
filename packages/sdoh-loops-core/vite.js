/**
 * Vite settings a consumer needs (README): ELK's optional 'web-worker' import resolves to an empty module, so the
 * layout runs on the page and nothing is fetched as a worker; and the package's content globs for Tailwind.
 */
import { fileURLToPath, URL } from 'node:url';

export const sdohCoreAlias = { 'web-worker': fileURLToPath(new URL('./src/lib/empty-worker.ts', import.meta.url)) };
export const sdohCoreContent = [fileURLToPath(new URL('./src/**/*.{ts,tsx}', import.meta.url))];
