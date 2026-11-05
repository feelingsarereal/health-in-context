/**
 * SL32 (T-LIC-01): the crosswalk dist test for the public Pages build. Nothing in the build may pair an ICD-11 code
 * with an ICD-10-CM one, so no text in it may match /ICD-10-CM|\bZ[0-9]{2}(\.[0-9A-Z]+)?\b/ outside the general
 * mentions listed, each with its reason, in xwalk-allowlist.txt.
 *
 *   tsx scripts/check-xwalk-dist.ts dist-pages                                   # a local build
 *   tsx scripts/check-xwalk-dist.ts https://feelingsarereal.github.io/sdoh-loops/  # the live site (crawls its files)
 *
 * Every text file is read (HTML, JS, CSS, JSON, …). A match passes only inside an occurrence of an allowlisted
 * snippet; an allowlist entry that matches nothing is reported too, so the list cannot go stale.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const XWALK_PATTERN = /ICD-10-CM|\bZ[0-9]{2}(\.[0-9A-Z]+)?\b/g;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = /\.(html?|js|mjs|css|json|txt|svg|map|xml|webmanifest|md)$/i;

export interface AllowEntry { text: string; reason: string; line: number }

/** xwalk-allowlist.txt: `snippet<TAB>reason` per line; # comments and blank lines are skipped */
export function readAllowlist(file = path.join(ROOT, 'xwalk-allowlist.txt')): AllowEntry[] {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.trim() && !l.startsWith('#'))
    .map(({ l, i }) => {
      const [text, reason] = l.split('\t');
      if (!text || !reason?.trim()) throw new Error(`xwalk-allowlist.txt:${i + 1}: needs "snippet<TAB>reason"`);
      return { text, reason: reason.trim(), line: i + 1 };
    });
}

export interface Finding { file: string; match: string; context: string }

/** the matches in one file's text that no allowlisted snippet covers, and which entries were used */
export function scan(file: string, text: string, allow: AllowEntry[], used: Set<number>): Finding[] {
  const covered: [number, number][] = [];
  for (const a of allow) {
    for (let at = text.indexOf(a.text); at >= 0; at = text.indexOf(a.text, at + 1)) {
      covered.push([at, at + a.text.length]);
      used.add(a.line);
    }
  }
  const out: Finding[] = [];
  for (const m of text.matchAll(XWALK_PATTERN)) {
    const s = m.index!, e = s + m[0].length;
    if (covered.some(([a, b]) => s >= a && e <= b)) continue;
    out.push({ file, match: m[0], context: text.slice(Math.max(0, s - 70), e + 50).replace(/\s+/g, ' ') });
  }
  return out;
}

async function filesFromDir(dir: string): Promise<[string, string][]> {
  const out: [string, string][] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (TEXT.test(f)) out.push([path.relative(dir, p), fs.readFileSync(p, 'utf8')]);
    }
  };
  walk(dir);
  return out;
}

/** the live site: index.html, 404.html, the machine-readable files, and every asset referenced from those, recursively */
async function filesFromUrl(base: string): Promise<[string, string][]> {
  const root = base.endsWith('/') ? base : base + '/';
  const queue = ['', '404.html', 'provenance.json', 'staleness.json'];
  const seen = new Set<string>();
  const out: [string, string][] = [];
  while (queue.length) {
    const rel = queue.shift()!;
    if (seen.has(rel)) continue;
    seen.add(rel);
    const res = await fetch(new URL(rel, root));
    if (!res.ok) throw new Error(`${new URL(rel, root)}: HTTP ${res.status}`);
    const text = await res.text();
    out.push([rel || 'index.html', text]);
    for (const m of text.matchAll(/assets\/[\w.-]+\.(?:js|css|json|svg|txt)/g)) if (!seen.has(m[0])) queue.push(m[0]);
  }
  return out;
}

export async function checkXwalk(target: string) {
  const allow = readAllowlist();
  const files = /^https?:\/\//.test(target) ? await filesFromUrl(target) : await filesFromDir(path.resolve(ROOT, target));
  const used = new Set<number>();
  const findings = files.flatMap(([f, t]) => scan(f, t, allow, used));
  const unused = allow.filter((a) => !used.has(a.line));
  return { files: files.length, findings, unused, allow };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const target = process.argv[2] ?? 'dist-pages';
  checkXwalk(target).then(({ files, findings, unused, allow }) => {
    console.log(`crosswalk dist test: ${target} — ${files} text files, ${allow.length} allowlist entries`);
    for (const f of findings) console.log(`  ✗ ${f.file}: ${f.match} … ${f.context}`);
    for (const u of unused) console.log(`  ✗ allowlist line ${u.line} matches nothing (stale): ${u.text.slice(0, 80)}`);
    if (findings.length || unused.length) {
      console.log(`FAIL: ${findings.length} unallowed match(es), ${unused.length} stale allowlist entr(ies)`);
      process.exit(1);
    }
    console.log('PASS: no ICD-10-CM pairing outside the allowlist');
  });
}
