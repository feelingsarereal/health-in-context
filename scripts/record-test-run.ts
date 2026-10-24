/**
 * npm run record:tests — after `npm run test:e2e`, write tests/safety/last-run.json (a summary of the safety and
 * walkthrough suites from Playwright's JSON report) so the next content build puts it in provenance.json (ACTION-SPEC §6.6).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-results/results.json'), 'utf8'));
const rows: { file: string; title: string; status: string }[] = [];
const walk = (s: any) => {
  for (const sp of s.specs ?? []) for (const t of sp.tests ?? []) rows.push({ file: sp.file, title: sp.title, status: t.results?.at(-1)?.status ?? 'unknown' });
  for (const c of s.suites ?? []) walk(c);
};
for (const s of rep.suites) walk(s);
const pick = (dir: string) => rows.filter((r) => r.file.includes(dir));
const sum = (rs: typeof rows) => ({ passed: rs.filter((r) => r.status === 'passed').length, failed: rs.filter((r) => r.status !== 'passed').length, tests: rs.map((r) => `${r.status === 'passed' ? '✓' : '✗'} ${r.title}`) });
const safety = sum(pick('safety/'));
const walkthroughs = sum(pick('walkthroughs/'));
const out = {
  date: new Date().toLocaleDateString('en-CA'),
  summary: `safety ${safety.passed}/${safety.passed + safety.failed} passed · walkthroughs ${walkthroughs.passed}/${walkthroughs.passed + walkthroughs.failed} passed (run ${new Date().toLocaleDateString('en-CA')})`,
  safety,
  walkthroughs,
};
fs.writeFileSync(path.join(ROOT, 'tests/safety/last-run.json'), JSON.stringify(out, null, 1) + '\n');
console.log(out.summary);
