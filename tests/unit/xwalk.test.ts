/** SL32, SL33 (T-LIC-01): the pack carries no crosswalk, the old switch is a deprecated no-op, and the dist test's allowlist and scanner. */
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sdohCrosswalk, xwalkOn } from '../../packages/sdoh-loops-core/vite.js';
import { readAllowlist, scan, XWALK_PATTERN } from '../../scripts/check-xwalk-dist';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = path.join(ROOT, 'packages/sdoh-loops-pack/data');
const raw = (f: string) => fs.readFileSync(path.join(dataDir, f), 'utf8');
const ALL = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));

describe('the pack (0.4.0)', () => {
  it('no code carries a crosswalk, and no data file has the key or an HP2030 domain id as a value', () => {
    const sit = JSON.parse(raw('situations.json'));
    expect(sit.codes.length).toBeGreaterThan(100);
    for (const c of sit.codes) expect(c, c.code).not.toHaveProperty('crosswalk');
    for (const f of ALL) {
      expect(raw(f), f).not.toMatch(/"crosswalk"\s*:/);
      expect(raw(f), f).not.toMatch(/"(?:econ|edu|hca|nbe)"/);
      expect(raw(f), f).not.toMatch(/"hp2030(?:_titles|_sources)?"\s*:/);
      expect(raw(f), f).not.toMatch(/<!-- \/?xwalk -->/);
      expect(raw(f), f).not.toMatch(/builder topic/i);
    }
  });
  it('the primer loses its two pairing sentences and keeps its neighbours', () => {
    const c = JSON.parse(raw('concepts.json')).find((x: { id: string }) => x.id === 'icd11-chapter24');
    expect(c.body).not.toMatch(/play the same role|ICD-10-CM categories/);
    expect(c.body).toContain('Each code links to its entry in the WHO browser.\n\nCodes describe circumstances.');
    expect(c.body).not.toMatch(/\n{3,}/);
  });
  it('T-XWALK-02 says the table is held and the held table itself is not emitted; WHO\'s citation stays verbatim', () => {
    const todo = JSON.parse(raw('manifest.json')).todo as { id: string; what: string; xwalk?: boolean }[];
    const held = todo.find((t) => t.id === 'T-XWALK-02')!;
    expect(held.xwalk).toBe(true);
    expect(held).not.toHaveProperty('held');
    expect(todo.find((t) => t.id === 'T-XWALK-01')!.xwalk).toBe(true);
    for (const f of ALL) expect(raw(f), f).not.toContain('block_crosswalk_proposed');
    const S = JSON.parse(raw('strings.json'));
    expect(S.codes).not.toHaveProperty('builder_topic');
    expect(S.codes.who_citation).toBe('International Classification of Diseases, Eleventh Revision (ICD-11), World Health Organization (WHO) 2019 https://icd.who.int/browse11. Licensed under CC BY-ND 3.0 IGO.');
  });
  it('no data file matches the dist pattern except allowlisted text', () => {
    const allow = readAllowlist();
    const used = new Set<number>();
    for (const f of ALL) {
      // the allowlist's variants entry is the bundled form; in raw JSON the same terms are spaced across lines
      const found = scan(f, JSON.stringify(JSON.parse(raw(f))), allow, used).filter((x) => !(f === 'glossary.json' && x.context.includes('variants')));
      expect(found, f).toEqual([]);
    }
  });
});

describe('the deprecated switch', () => {
  it('sdohCrosswalk is a no-op that logs one line, however often it is called', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = sdohCrosswalk({ crosswalk: false });
    const b = sdohCrosswalk();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('deprecated');
    warn.mockRestore();
    for (const p of [a, b]) expect(Object.keys(p)).toEqual(['name']);
  });
  it('xwalkOn still answers', () => {
    expect([undefined, 'on', '1', ''].map((v) => xwalkOn(v))).toEqual([true, true, true, true]);
    expect(['off', 'OFF', 'false', '0'].map((v) => xwalkOn(v))).toEqual([false, false, false, false]);
  });
});

describe('the dist test', () => {
  it('every allowlist entry has a reason and itself matches the pattern', () => {
    const allow = readAllowlist();
    expect(allow.length).toBeGreaterThan(0);
    for (const a of allow) {
      expect(a.reason.length, a.text).toBeGreaterThan(20);
      expect(a.text.match(XWALK_PATTERN), a.text).not.toBeNull();
    }
  });
  it('flags a pairing and passes allowlisted text', () => {
    const allow = [{ text: 'what Z codes are: Z55–Z65', reason: 'general', line: 1 }];
    expect(scan('f', 'x QD71 → ICD-10-CM Z59 y', allow, new Set()).map((f) => f.match)).toEqual(['ICD-10-CM', 'Z59']);
    expect(scan('f', 'glossary: what Z codes are: Z55–Z65.', allow, new Set())).toEqual([]);
    expect(scan('f', 'QD71.Z and QE10 and Z9 and xZ59', allow, new Set())).toEqual([]);
  });
  it('flags crosswalk data in every bundled form, with no allowlist to pass it', () => {
    const hits = (t: string) => scan('f', t, [{ text: t, reason: 'tries to allow it', line: 1 }], new Set()).length;
    for (const t of ['{crosswalk:null}', '{"crosswalk":{}}', 'JSON.parse("{\\"crosswalk\\":1}")', 'hp2030:["econ"]', '[\\"nbe\\",\\"scc\\"]', "['edu']", 'Builder topic, not from WHO']) {
      expect(hits(t), t).toBeGreaterThan(0);
    }
    expect(hits('the proposed crosswalk is held')).toBe(0);
    expect(hits('https://example.edu/econ')).toBe(0);
    // "scc" is also a glossary term: only its own id and its place in the primer's term list pass
    for (const t of ['hp2030:["scc"]', '{"hp2030":["edu","scc"]}', '[\\"scc\\"]', '"balancing-loop","scc"']) expect(hits(t), t).toBeGreaterThan(0);
    for (const t of ['{id:"scc",term:"Feedback cluster"}', '{"id":"scc","term":"x"}', '{\\"id\\":\\"scc\\"}', '"elementary-circuit","scc","leverage-hint"']) expect(hits(t), t).toBe(0);
  });
});
