/**
 * UI-18 golden fixtures (K2 item 6, K3 item 4, K5 item 3), written by hand from links.yaml. Each case names two coded
 * ends, a polarity, and the expected basis and check. A drift is a failure. Matching is at code level (option B):
 * `codes`. Eviction is QD71.Z (K5; QD71.1 means poor housing conditions).
 *   L01  QD80-QD8Z → QD50-QD5Z (+)     shipped; codes QD80 → QD51
 *   L02  QD50-QD5Z → QD71 (+)          shipped; codes QD51 → QD71.Z
 *   L03  QD71 → QD80-QD8Z (+)          shipped; codes QD71.Z → QD80
 *   L12  QE00-QE0Z → QD80-QD8Z (+)     shipped; codes QE04 → QD80
 *   L20  QE80-QE8Z → QD80-QD8Z (+)     shipped; codes QE82, QE82.0–.2 → QD80
 *   L25  QE80-QE8Z → QD50-QD5Z (+)     shipped; codes QE82, QE82.0–.2 → QD50
 *   L26  QD80-QD8Z → QD71 (+)          shipped; codes QD80 → QD71.Z
 *   L27  QD71 → QD50-QD5Z (+)          shipped; codes QD71.Z → QD51
 *   L28  QD71 → QD71 (+)               shipped; codes QD71.Z → QD71.0
 *   L05  QD50-QD5Z → QE00-QE0Z (+)     withheld
 */
import type { EndRef } from '../evidence';

const sdoh = (code: string): EndRef => ({ code_status: 'sdoh', code });
export const EVIDENCE_CASES: { name: string; from: EndRef; to: EndRef; polarity: '+' | '−'; basis: 'evidence' | 'override'; check: string; link?: string }[] = [
  { name: 'QD71.Z → QD80 (+) is evidence: L03', from: sdoh('QD71.Z'), to: sdoh('QD80'), polarity: '+', basis: 'evidence', check: 'match', link: 'L03' },
  { name: 'QD71.1 → QD80 (+) is outside L03, whose evidence names eviction (QD71.Z) only', from: sdoh('QD71.1'), to: sdoh('QD80'), polarity: '+', basis: 'override', check: 'outside-codes:L03' },
  { name: 'QD71.Z → QD82 (+) is outside L03, whose evidence names QD80 only', from: sdoh('QD71.Z'), to: sdoh('QD82'), polarity: '+', basis: 'override', check: 'outside-codes:L03' },
  { name: 'QD80 → QD51 (+) is evidence: L01', from: sdoh('QD80'), to: sdoh('QD51'), polarity: '+', basis: 'evidence', check: 'match', link: 'L01' },
  { name: 'QD51 → QD71.Z (+) is evidence: L02', from: sdoh('QD51'), to: sdoh('QD71.Z'), polarity: '+', basis: 'evidence', check: 'match', link: 'L02' },
  { name: 'QD71.Z → QD51 (+) is evidence: L27', from: sdoh('QD71.Z'), to: sdoh('QD51'), polarity: '+', basis: 'evidence', check: 'match', link: 'L27' },
  { name: 'QD80 → QD71.Z (+) is evidence: L26', from: sdoh('QD80'), to: sdoh('QD71.Z'), polarity: '+', basis: 'evidence', check: 'match', link: 'L26' },
  { name: 'QD71.Z → QD71.0 (+) is evidence: L28', from: sdoh('QD71.Z'), to: sdoh('QD71.0'), polarity: '+', basis: 'evidence', check: 'match', link: 'L28' },
  { name: 'QD51 → QE01 (+) has only the withheld L05', from: sdoh('QD51'), to: sdoh('QE01'), polarity: '+', basis: 'override', check: 'withheld:L05' },
  { name: 'QD71.Z → QD80 (−) is the opposite of L03', from: sdoh('QD71.Z'), to: sdoh('QD80'), polarity: '−', basis: 'override', check: 'opposite-polarity', link: 'L03' },
  { name: 'an edge to an other node has an uncoded end', from: sdoh('QE01'), to: { code_status: 'other', code: null }, polarity: '−', basis: 'override', check: 'uncoded-end' },
  { name: 'an edge from an undetermined node has an uncoded end', from: { code_status: 'undetermined', code: null }, to: sdoh('QE01'), polarity: '−', basis: 'override', check: 'uncoded-end' },
  { name: 'QD51 → QD80 (+) has no link at all (L01 runs the other way)', from: sdoh('QD51'), to: sdoh('QD80'), polarity: '+', basis: 'override', check: 'no-link' },
  { name: 'QE01 → QD80 (+) is outside L12, whose evidence names QE04 only', from: sdoh('QE01'), to: sdoh('QD80'), polarity: '+', basis: 'override', check: 'outside-codes:L12' },
  { name: 'QE04 → QD80 (+) is evidence: L12', from: sdoh('QE04'), to: sdoh('QD80'), polarity: '+', basis: 'evidence', check: 'match', link: 'L12' },
  { name: 'QE82.0 → QD50 (+) is evidence: L25', from: sdoh('QE82.0'), to: sdoh('QD50'), polarity: '+', basis: 'evidence', check: 'match', link: 'L25' },
  { name: 'QE82.Z → QD80 (+) is evidence: a listed code (QE82) covers its descendants', from: sdoh('QE82.Z'), to: sdoh('QD80'), polarity: '+', basis: 'evidence', check: 'match', link: 'L20' },
  { name: 'QE90 → QD80 (+) has no link: the ACE links start from QE82.x now', from: sdoh('QE90'), to: sdoh('QD80'), polarity: '+', basis: 'override', check: 'no-link' },
];
/** K5: the w1 loop, eviction → unemployment → low income → eviction, closes on evidence alone (L03, L01, L02). */
export const W1_LOOP = { codes: ['QD71.Z', 'QD80', 'QD51'], links: ['L03', 'L01', 'L02'] };
/** K5: a map saved with eviction coded QD71.1 re-checks on import: its L03 edge is now outside L03's codes. */
export const QD71_1_EVICTION_CASE = { from: 'QD71.1', to: 'QD80', link: 'L03', basis: 'needs-review', check: 'outside-codes:L03' };
/** Recoding QD80 → QE01 at the target of an L03 evidence edge leaves it unsupported: needs-review, check no-link. */
export const RECODE_CASE = { from: 'QD71.Z', to: 'QD80', recodeTo: 'QE01', basis: 'needs-review', check: 'no-link' };
/** A v2 map saved under the block-level rule: QE01 → QD80 was evidence (L12). On import it is outside L12's codes. */
export const V2_BLOCK_LEVEL_CASE = { from: 'QE01', to: 'QD80', link: 'L12', basis: 'needs-review', check: 'outside-codes:L12' };
