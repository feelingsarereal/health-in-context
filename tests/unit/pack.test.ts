/** Pack schemas: the real pack is clean, and a fixture with one error per rule fails with the right message. */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPack, validatePack, type RawPack } from '../../scripts/lib/pack';

const { pack: REAL, loadErrors } = readPack(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content-pack'));
const clone = (): RawPack => structuredClone(REAL);
type Any = any; // fixtures poke into untyped YAML

describe('the shipped pack', () => {
  it('validates with 0 errors (same rules as tools/validate_pack.py)', () => {
    expect(loadErrors).toEqual([]);
    const r = validatePack(REAL);
    expect(r.errors).toEqual([]);
  });
  it('H1: no blocked phrase outside allowed contexts once the allowed phrases are removed', () => {
    expect(validatePack(REAL).lint).toEqual([]);
  });
});

const RULES: [string, (p: Any) => void, RegExp][] = [
  ['manifest kind', (p) => (p.manifest.kind = 'dashboard'), /manifest: kind — /],
  ['module listed but missing', (p) => (p.moduleFiles = p.moduleFiles.filter((m: string) => m !== 'links')), /links\.yaml: listed in manifest\.modules but missing/],
  ['module present but not listed', (p) => p.moduleFiles.push('pathway'), /pathway\.yaml: present but not listed/],
  ['storage must be device', (p) => (p.manifest.storage = 'cloud'), /storage must be 'device'/],
  ['duplicate reference n', (p) => (p.references[1].n = p.references[0].n), /references: duplicate n 1/],
  ['reference needs doi/url/isbn', (p) => { delete p.references[0].doi; delete p.references[0].url; }, /references\/1: doi, url or isbn required/],
  ['seminal needs why_it_mattered', (p) => delete p.references[0].why_it_mattered, /references\/1: seminal needs why_it_mattered/],
  ['abstract without harvested_on', (p) => delete p.references[0].harvested_on, /abstract without harvested_on/],
  ['cites a missing reference', (p) => (p.glossary[0].definition += ' [999]'), /glossary\/sdoh\.definition: cites \[999\] — no such reference/],
  ['citation coverage', (p) => (p.glossary[0].definition = 'word '.repeat(30)), /30-word prose with no \[n\] and no framing marker/],
  ['glossary concept not found', (p) => (p.glossary[0].concept = 'nope'), /glossary\/sdoh: concept nope not found/],
  ['glossary see not found', (p) => (p.glossary[0].see = ['nope']), /glossary\/sdoh: see nope not found/],
  ['glossary variant collision', (p) => p.glossary[1].variants.push('SDOH'), /variant 'SDOH' collides/],
  ['persona acts_for', (p) => (p.audience.personas[0].acts_for = 'boss'), /audience: personas\.0\.acts_for/],
  ['persona needs a job', (p) => (p.audience.personas[0].jobs = []), /at least one job required/],
  ['duplicate code', (p) => (p.situations.items[1].code = p.situations.items[0].code), /situations: duplicate code QD50/],
  ['item group exists', (p) => (p.situations.items[0].group = 'QX00-QX0Z'), /situations\/QD50: group 'QX00-QX0Z' not found/],
  ['item parent exists', (p) => (p.situations.items[0].parent = 'QX01'), /situations\/QD50: parent QX01 not found/],
  ['link endpoint exists', (p) => (p.links.links[0].from = 'QX00'), /links\/L03: from 'QX00' not a group or code/],
  ['link grade known', (p) => (p.links.links[0].grade = 'Z'), /links\/L03: grade 'Z' not in/],
  ['link mechanism cites', (p) => (p.links.links[0].mechanism = 'A forced move.'), /links\/L03\.mechanism: must carry at least one \[n\]/],
  ['link mechanism refs listed', (p) => (p.links.links[0].mechanism += ' [24]'), /links\/L03: mechanism cites \[24\] not listed in refs/],
  ['link refs verified', (p) => { p.links.links[0].refs = [23, 8]; p.links.links[0].mechanism += ' [8]'; }, /links\/L03: ref 8 is not verified — the link may not ship/],
  ['suggest is a code', (p) => (p.links.links[0].suggest = ['QX99']), /links\/L03: suggest QX99 not a code/],
  ['suggest inside target', (p) => (p.links.links[0].suggest = ['QD51']), /links\/L03: suggest QD51 is not inside QD80-QD8Z/],
  ['safety profile matches', (p) => (p.safety.profile = 'general'), /safety: profile 'general' does not match manifest 'health'/],
  ['notice required (H5)', (p) => delete p.safety.notice, /safety: notice required \(H5\)/],
  ['deidentify required (H3)', (p) => delete p.safety.deidentify, /deidentify\.fields required when a persona acts for others \(H3\)/],
  ['help required (H6)', (p) => (p.safety.help = []), /safety: help entries required \(H6\)/],
  ['H1: no negation exemption (Daniel, 2026-10-23)', (p) => (p.uiStrings.home.lead = "You don't need a diagnosis, you have options."), /^(?=[\s\S]*ui-strings\.home\.lead contains blocked phrase 'diagnos')(?=[\s\S]*ui-strings\.home\.lead contains blocked phrase 'you have')/],
  ['H1: an allowed phrase passes only verbatim', (p) => (p.uiStrings.home.lead = 'This does not diagnose. It cannot diagnose anyone.'), /ui-strings\.home\.lead contains blocked phrase 'diagnos' — “.*cannot diagnose/],
  ['H1: lints references outside the abstract', (p) => (p.references[0].summary = 'A cure for poverty.'), /references\[0\]\.summary contains blocked phrase 'cure'/],
  ['H1 lint', (p) => (p.uiStrings.home.lead = 'You have a housing problem.'), /safety lint \(H1\): ui-strings\.home\.lead contains blocked phrase 'you have'/],
  ['scenario persona', (p) => (p.scenarios[0].persona = 'p-nobody'), /scenarios\/w1: persona 'p-nobody' not found/],
  ['scenario must_not', (p) => delete p.scenarios[0].must_not, /scenarios\/w1: must_not required under health/],
  ['walkthrough per persona', (p) => (p.scenarios = p.scenarios.slice(1)), /scenarios: no walkthrough for persona p-navigator/],
  ['upkeep classes', (p) => (p.upkeep.classes = []), /upkeep: classes — classes required/],
  ['planner exports json', (p) => (p.planner.export = ['csv-edges']), /export must include json/],
  ['concept id matches file', (p) => (p.concepts[0].front.id = 'other-id'), /icd11-chapter24\.md: id must match file name/],
  ['ledger entry complete', (p) => delete p.changes[0].why, /changes: 0\.why — Required/],
];

describe('one error per rule', () => {
  for (const [name, mutate, msg] of RULES) {
    it(name, () => {
      const p = clone();
      mutate(p);
      const r = validatePack(p);
      expect(r.errors.join('\n')).toMatch(msg);
    });
  }
});
