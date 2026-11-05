/** SL32 (T-LIC-01): the crosswalk switch over the real pack data, and the dist test's allowlist and scanner. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { xwalkData, xwalkText, xwalkOn, PACK_DATA_ID } from '../../packages/sdoh-loops-core/xwalk.js';
import { readAllowlist, scan, XWALK_PATTERN } from '../../scripts/check-xwalk-dist';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdoh-loops-pack/data', f), 'utf8'));
const ALL = ['situations.json', 'links.json', 'references.json', 'glossary.json', 'concepts.json', 'strings.json', 'manifest.json'];

describe('xwalkData (off)', () => {
  const sit = xwalkData(data('situations.json'), false);
  it('leaves no ICD-10-CM half on any code; HP2030 stays with its own source', () => {
    const cws = sit.codes.map((c: any) => c.crosswalk).filter(Boolean);
    // 114 codes had a crosswalk; 23 of them (QE10–QE1Z, health behaviours) mapped to Z72 alone and now have none
    expect(cws.length).toBe(91);
    for (const cw of cws) {
      expect(cw.icd10cm).toEqual([]);
      expect(cw.icd10cm_titles).toEqual([]);
      expect(cw.icd10cm_sources).toBeUndefined();
      expect(cw.sources).toEqual([62]);
      expect(cw.hp2030.length).toBeGreaterThan(0);
    }
  });
  it('removes the marked text and records, and no data file is left matching the pattern except allowlisted text', () => {
    const concepts = xwalkData(data('concepts.json'), false);
    const c = concepts.find((x: any) => x.id === 'icd11-chapter24');
    expect(c.body).not.toMatch(/xwalk|play the same role|ICD-10-CM categories/);
    expect(c.body).toContain('Each code links to its entry in the WHO browser.\n\nCodes describe circumstances.');
    expect(c.body).not.toMatch(/\n{3,}/);
    const m = xwalkData(data('manifest.json'), false);
    expect(m.todo.map((t: any) => t.id)).not.toContain('T-XWALK-01');
    const allow = readAllowlist();
    const used = new Set<number>();
    for (const f of ALL) {
      const text = JSON.stringify(xwalkData(data(f), false));
      expect(text).not.toContain('<!-- xwalk');
      // JSON escapes nothing the allowlist holds except quotes inside the variants entry, which is matched unescaped in JS
      const found = scan(f, text, allow, used).filter((x) => !(f === 'glossary.json' && x.context.includes('variants')));
      expect(found, f).toEqual([]);
    }
  });
});

describe('xwalkData (on)', () => {
  it('keeps everything and removes only the markers', () => {
    const raw = data('concepts.json');
    const on = xwalkData(raw, true);
    const body = on.find((x: any) => x.id === 'icd11-chapter24').body;
    expect(body).not.toContain('<!--');
    expect(body).toContain('Z55–Z65 play the same role [63]');
    expect(body).toContain('The crosswalk to Healthy People 2030 domains and to ICD-10-CM categories');
    expect(xwalkData(data('situations.json'), true).codes.find((c: any) => c.crosswalk).crosswalk.icd10cm.length).toBeGreaterThan(0);
    expect(xwalkData(data('manifest.json'), true).todo.map((t: any) => t.id)).toContain('T-XWALK-01');
  });
  it('xwalkText handles inline and block segments', () => {
    expect(xwalkText('A.<!-- xwalk --> B.<!-- /xwalk --> C.', false)).toBe('A. C.');
    expect(xwalkText('A.\n\n<!-- xwalk -->\nB.\n<!-- /xwalk -->\n\nC.', false)).toBe('A.\n\nC.');
    expect(xwalkText('A.<!-- xwalk --> B.<!-- /xwalk --> C.', true)).toBe('A. B. C.');
  });
  it('the env switch and the pack data id', () => {
    expect([undefined, 'on', '1', ''].map((v) => xwalkOn(v))).toEqual([true, true, true, true]);
    expect(['off', 'OFF', 'false', '0'].map((v) => xwalkOn(v))).toEqual([false, false, false, false]);
    expect(PACK_DATA_ID.test('/x/packages/sdoh-loops-pack/data/situations.json')).toBe(true);
    expect(PACK_DATA_ID.test('/x/node_modules/@feelingsarereal/sdoh-loops-pack/data/glossary.json?import')).toBe(true);
    expect(PACK_DATA_ID.test('/x/src/data/provenance.json')).toBe(false);
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
});
