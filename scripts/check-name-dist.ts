/**
 * SL38: the old product name must not reach a build, and SL39: nor a Google Fonts host. Fails on any case-insensitive "sdoh loops" in a text file under the
 * given folder, apart from a served CHANGELOG. "SDOH" alone stays: it is the term ("SDOH code").
 *   tsx scripts/check-name-dist.ts dist-pages
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'dist';
const TEXT = /\.(html|js|mjs|css|json|map|txt|svg|webmanifest|md)$/i;
const hits: string[] = [];
const walk = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (TEXT.test(e.name) && !/changelog/i.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8');
      for (const m of t.matchAll(/sdoh loops|fonts\.googleapis|fonts\.gstatic/gi)) hits.push(`${p}: …${t.slice(Math.max(0, m.index - 50), m.index + 60).replace(/\s+/g, ' ')}…`);
    }
  }
};
walk(root);
if (hits.length) {
  console.error(`FAIL: the old name or a font host in ${root}:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`PASS: neither the old name nor a font host appears in ${root}`);
