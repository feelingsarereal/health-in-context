/**
 * SL26: the notebook's identifier check — a local heuristic, never a guarantee, and it never blocks typing (S7.1).
 * Patterns for: names after an honorific or "my name is", dates other than a bare year, phone numbers, email
 * addresses, street addresses, ZIP+4, SSN-like numbers and record-like numbers. Pure functions; nothing leaves the device.
 */
export const IDENTIFIER_CATEGORIES = ['person', 'date', 'phone', 'email', 'address', 'zip', 'ssn', 'record'] as const;
export type IdentifierCategory = (typeof IDENTIFIER_CATEGORIES)[number];

export interface IdentifierMatch {
  category: IdentifierCategory;
  start: number;
  end: number;
  /** the matched text; for "my name is Ana" it is the name alone */
  value: string;
  /** a person match's name part (after the honorific), so labelling can replace the bare name too */
  name?: string;
}

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const NAME = "\\p{Lu}[\\p{L}'’-]+(?:[ \\t]+\\p{Lu}[\\p{L}'’-]+)?";
// whole words take no period (a period after them ends the sentence); abbreviations may take one
const STREET = '(?:(?:Street|Avenue|Road|Boulevard|Lane|Drive|Court|Way|Place|Circle|Terrace|Parkway|Highway|Trail)\\b|(?:St|Ave|Rd|Blvd|Ln|Dr|Ct|Pl|Cir|Ter|Pkwy|Hwy|Trl)\\b\\.?)';

/** In priority order: where two matches overlap, the earlier category wins. */
const PATTERNS: { category: IdentifierCategory; re: RegExp; group?: number; name?: number }[] = [
  { category: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { category: 'ssn', re: /(?<![\d-])\d{3}[- ]\d{2}[- ]\d{4}(?![\d-])/g },
  { category: 'zip', re: /(?<![\d-])\d{5}-\d{4}(?![\d-])/g },
  { category: 'phone', re: /(?<![\w-])(?:\+?1[ .-]?)?(?:\(\d{3}\)[ ]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?![\w-])/g },
  // full dates: 03/14/2026, 3/4/26, 14-03-2026, 14.3.24, 2026-03-14, March 14, March 14th, 2026, 14 March 2026,
  // the 14th of March, March 2026. SL30: a numeric date may end a sentence ("on 03/14/2026." or "03/14/2026...") —
  // only a further digit, or a separator followed by a digit, rules it out; one separator throughout.
  {
    category: 'date',
    re: new RegExp(
      [
        '(?<!\\d|\\d[/.-])\\d{1,2}([/.-])\\d{1,2}\\1(?:\\d{4}|\\d{2})(?!\\d|[/.-]\\d)',
        '(?<!\\d|\\d[/.-])\\d{4}([/.-])\\d{1,2}\\2\\d{1,2}(?!\\d|[/.-]\\d)',
        `\\b${MONTH}\\.?[ \\t]+\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?[ \\t]+\\d{4}\\b)?`,
        `\\b\\d{1,2}(?:st|nd|rd|th)?[ \\t]+(?:of[ \\t]+)?${MONTH}\\b\\.?(?:,?[ \\t]+\\d{4}\\b)?`,
        `\\b${MONTH}\\.?,?[ \\t]+\\d{4}\\b`,
      ].join('|'),
      'g',
    ),
  },
  {
    category: 'address',
    re: new RegExp(`\\b\\d{1,6}[ \\t]+(?:[NSEW]\\.?[ \\t]+)?(?:\\p{Lu}[\\p{L}'’-]*[ \\t]+){1,3}${STREET}(?:,?[ \\t]+(?:Apt|Apartment|Unit|Suite|Ste|#)\\.?[ \\t]*[\\w-]+)?|\\bP\\.?[ \\t]?O\\.?[ \\t]+Box[ \\t]+\\d+`, 'gu'),
  },
  {
    category: 'record',
    re: /\b(?:MRN|[Mm]edical [Rr]ecord|[Rr]ecord|[Cc]ase|[Aa]ccount|[Aa]cct|[Mm]ember|[Pp]atient|[Cc]lient|[Pp]olicy|[Cc]laim|ID)[ \t]*(?:[Nn]o\.?|[Nn]umber|[Nn]um\.?|#)?[ \t]*[:#]?[ \t]*([A-Z]{0,3}-?\d[\d-]{3,}\d)\b|(?<![\d-])\d{7,}(?![\d-])/g,
  },
  { category: 'person', re: new RegExp(`\\b(?:Mrs|Mr|Ms|Miss|Mx|Dr|Prof|Mister|Rev)\\b\\.?[ \\t]+(${NAME})`, 'gu'), name: 1 },
  { category: 'person', re: new RegExp(`\\b(?:[Mm]y name(?:[ \\t]+is|'s|’s)|[Cc]all me|I(?:'m|’m|[ \\t]+am)[ \\t]+called)[ \\t]+(${NAME})`, 'gu'), group: 1 },
];

/** Every possible identifier in a piece of text, by position; overlapping matches keep the higher-priority one. */
export function findIdentifiers(text: string): IdentifierMatch[] {
  if (!text) return [];
  const taken: IdentifierMatch[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    for (let m = p.re.exec(text); m; m = p.re.exec(text)) {
      let start = m.index;
      let value = m[0];
      if (p.group && m[p.group]) {
        start = m.index + m[0].lastIndexOf(m[p.group]);
        value = m[p.group];
      }
      const end = start + value.length;
      if (taken.some((t) => start < t.end && end > t.start)) continue;
      const hit: IdentifierMatch = { category: p.category, start, end, value };
      if (p.name && m[p.name]) hit.name = m[p.name];
      taken.push(hit);
    }
  }
  return taken.sort((a, b) => a.start - b.start);
}
