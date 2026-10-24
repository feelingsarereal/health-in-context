/**
 * UI-18 golden fixtures (K2 item 6), written by hand from links.yaml. Each case names two coded ends, a polarity, and
 * the expected basis and check. A drift is a failure.
 *   L03  QD71 → QD80-QD8Z (+)          shipped
 *   L02  QD50-QD5Z → QD71 (+)          withheld (cited study is about what follows eviction)
 *   L01  QD80-QD8Z → QD50-QD5Z (+)     withheld
 *   L20  QE90-QE9Z → QD80-QD8Z (+)     shipped
 *   L12  QE00-QE0Z → QD80-QD8Z (+)     shipped
 */
import type { EndRef } from '../evidence';

const sdoh = (code: string): EndRef => ({ code_status: 'sdoh', code });
export const EVIDENCE_CASES: { name: string; from: EndRef; to: EndRef; polarity: '+' | '−'; basis: 'evidence' | 'override'; check: string; link?: string }[] = [
  { name: 'QD71.1 → QD80 (+) matches L03 via the QD71 sub-block and the QD80 block', from: sdoh('QD71.1'), to: sdoh('QD80'), polarity: '+', basis: 'evidence', check: 'match', link: 'L03' },
  { name: 'QD51 → QD71.1 (+) has only the withheld L02', from: sdoh('QD51'), to: sdoh('QD71.1'), polarity: '+', basis: 'override', check: 'withheld:L02' },
  { name: 'QD71.1 → QD80 (−) is the opposite of L03', from: sdoh('QD71.1'), to: sdoh('QD80'), polarity: '−', basis: 'override', check: 'opposite-polarity', link: 'L03' },
  { name: 'an edge to an other node has an uncoded end', from: sdoh('QE01'), to: { code_status: 'other', code: null }, polarity: '−', basis: 'override', check: 'uncoded-end' },
  { name: 'an edge from an undetermined node has an uncoded end', from: { code_status: 'undetermined', code: null }, to: sdoh('QE01'), polarity: '−', basis: 'override', check: 'uncoded-end' },
  { name: 'QD51 → QD80 (+) has no link at all (L01 runs the other way)', from: sdoh('QD51'), to: sdoh('QD80'), polarity: '+', basis: 'override', check: 'no-link' },
  // NB scenarios.yaml w2 says QE01 → QD80 has no evidence link; by the matching rule it is L12 (QE00-QE0Z → QD80-QD8Z, +),
  // because QE01 sits in block QE00-QE0Z. Pinned here as the rule gives it; flagged to Cowork in the K2 scrum note.
  { name: 'QE01 → QD80 (+) matches L12 through the QE00-QE0Z block', from: sdoh('QE01'), to: sdoh('QD80'), polarity: '+', basis: 'evidence', check: 'match', link: 'L12' },
  { name: 'QD80 → QD51 (+) has only the withheld L01', from: sdoh('QD80'), to: sdoh('QD51'), polarity: '+', basis: 'override', check: 'withheld:L01' },
  { name: 'QE90 → QD80 (+) matches L20', from: sdoh('QE90'), to: sdoh('QD80'), polarity: '+', basis: 'evidence', check: 'match', link: 'L20' },
];
/** Recoding QD80 → QE01 at the target of an L03 evidence edge leaves it unsupported: needs-review, check no-link. */
export const RECODE_CASE = { from: 'QD71.1', to: 'QD80', recodeTo: 'QE01', basis: 'needs-review', check: 'no-link' };
