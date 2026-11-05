/**
 * SL26: the notebook's identifier check — a local heuristic, never a guarantee, and it never blocks typing (S7.1).
 * Patterns for: names after an honorific or "my name is", dates other than a bare year, phone numbers, email
 * addresses, street addresses, ZIP+4, SSN-like numbers and record-like numbers. SL31: dates of birth ("DOB", "born on"
 * and a date), ages ("34-year-old", "age 34", "aged 34") and a bare 5-digit ZIP code next to a state or a city and state.
 * SL29: a city before a state ("Huntsville, AL", "Huntsville, Alabama", "Huntsville AL 35801"): a HIPAA Safe Harbor
 * geographic unit smaller than a state; a state alone is never flagged.
 * Names without a title or "my name is" are out of scope: they cannot be told from capitalised words reliably.
 * Pure functions; nothing leaves the device.
 */
export const IDENTIFIER_CATEGORIES = ['person', 'date', 'dob', 'age', 'phone', 'email', 'address', 'city', 'zip', 'ssn', 'record'] as const;
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
const STATE_ABBR = '(?:A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])';
const STATE_NAME =
  '(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New[ \\t]+Hampshire|New[ \\t]+Jersey|New[ \\t]+Mexico|New[ \\t]+York|North[ \\t]+Carolina|North[ \\t]+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode[ \\t]+Island|South[ \\t]+Carolina|South[ \\t]+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West[ \\t]+Virginia|Wisconsin|Wyoming|Puerto[ \\t]+Rico)';
/** SL29: one word of a city name: capitalised, or a short abbreviation such as "St." or "Ft." */
const CITY_WORD = "(?:St\\.|Ste\\.|Ft\\.|Mt\\.|\\p{Lu}[\\p{L}'’-]+)";
const CITY = `(${CITY_WORD}(?:[ \\t]+${CITY_WORD}){0,2})`;
/** SL29: words a sentence often starts with before a city ("Visited Huntsville, AL"): trimmed off the front of a match */
const CITY_STOP = new Set(
  'The A An In At From To Of And Or But Near Outside Lives Lived Living Moved Moving Visited Visit Born Grew Raised Stays Stayed Staying Went Drove Back Yes No Okay Ok Thanks Thank Hi Hello Oh Well So Then We She He They I It Also Now Today Yesterday Called Spoke Met Mr Mrs Ms Dr Home Here There'.split(' '),
);
function trimCity(v: string): number {
  let at = 0;
  for (const m of v.matchAll(/(\S+)([ \t]*)/g)) {
    if (!CITY_STOP.has(m[1])) return at;
    at += m[0].length;
  }
  return -1;
}
/** SL31: the words that make the date after them a date of birth */
const DOB_LEAD = /\b(?:DOB|D\.O\.B\.?|[Dd]ate[ \t]+of[ \t]+[Bb]irth|[Bb]irth[ \t]?[Dd]ate|[Bb]orn(?:[ \t]+on)?)(?![\p{L}])\.?[ \t]*[:–-]?[ \t]*/gu;
const NAME = "\\p{Lu}[\\p{L}'’-]+(?:[ \\t]+\\p{Lu}[\\p{L}'’-]+)?";
// whole words take no period (a period after them ends the sentence); abbreviations may take one
const STREET = '(?:(?:Street|Avenue|Road|Boulevard|Lane|Drive|Court|Way|Place|Circle|Terrace|Parkway|Highway|Trail)\\b|(?:St|Ave|Rd|Blvd|Ln|Dr|Ct|Pl|Cir|Ter|Pkwy|Hwy|Trl)\\b\\.?)';

/**
 * Full dates: 03/14/2026, 3/4/26, 14-03-2026, 14.3.24, 2026-03-14, March 14, March 14th, 2026, 14 March 2026, the 14th
 * of March, March 2026. SL30: a numeric date may end a sentence ("on 03/14/2026." or "03/14/2026...") — only a further
 * digit, or a separator followed by a digit, rules it out; one separator throughout.
 */
const DATE_SRC = [
  '(?<!\\d|\\d[/.-])\\d{1,2}([/.-])\\d{1,2}\\1(?:\\d{4}|\\d{2})(?!\\d|[/.-]\\d)',
  '(?<!\\d|\\d[/.-])\\d{4}([/.-])\\d{1,2}\\2\\d{1,2}(?!\\d|[/.-]\\d)',
  `\\b${MONTH}\\.?[ \\t]+\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?[ \\t]+\\d{4}\\b)?`,
  `\\b\\d{1,2}(?:st|nd|rd|th)?[ \\t]+(?:of[ \\t]+)?${MONTH}\\b\\.?(?:,?[ \\t]+\\d{4}\\b)?`,
  `\\b${MONTH}\\.?,?[ \\t]+\\d{4}\\b`,
].join('|');
const DATE_RE = new RegExp(DATE_SRC, 'g');
/** SL31: a date that starts exactly where a DOB lead ends */
const DATE_AT = new RegExp(DATE_SRC, 'y');

/** In priority order: where two matches overlap, the earlier category wins. */
const PATTERNS: { category: IdentifierCategory; re: RegExp; group?: number; name?: number; /** the match is this pattern, right after `re` */ after?: RegExp; /** the group is at the start of the match */ lead?: boolean; /** characters to drop from the front of the value (-1: no match) */ trim?: (v: string) => number }[] = [
  // SL31: a date after "DOB" or "born on" is a date of birth (checked before plain dates, so it wins the overlap); the
  // match is the date alone, so "DOB 03/14/1961" becomes "DOB [date of birth]"
  { category: 'dob', re: DOB_LEAD, after: DATE_AT },
  { category: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { category: 'ssn', re: /(?<![\d-])\d{3}[- ]\d{2}[- ]\d{4}(?![\d-])/g },
  { category: 'zip', re: /(?<![\d-])\d{5}-\d{4}(?![\d-])/g },
  // SL31: a bare 5-digit ZIP only next to a state ("AL 35801", "Huntsville, Alabama 35801"); "the 10012 form" is not one
  { category: 'zip', re: new RegExp(`\\b(?:${STATE_ABBR}|${STATE_NAME}),?[ \\t]+(\\d{5})(?![\\d-])`, 'g'), group: 1 },
  // SL31: ages — "34-year-old", "34 years old", "34 y/o", "age 34", "aged 34", "34 years of age"; "5 years" is not one
  {
    category: 'age',
    re: /\b\d{1,3}[ \t-]*(?:years?|yrs?)[ \t-]*old\b|\b\d{1,3}[ \t]*(?:y\/o|yo)\b|\b\d{1,3}[ \t]+years?[ \t]+of[ \t]+age\b|\b(?:[Aa]ged?|AGED?)\b[ \t]*:?[ \t]*\d{1,3}(?![\d\/.-]*\d)/g,
  },
  { category: 'phone', re: /(?<![\w-])(?:\+?1[ .-]?)?(?:\(\d{3}\)[ ]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?![\w-])/g },
  { category: 'date', re: DATE_RE },
  {
    category: 'address',
    re: new RegExp(`\\b\\d{1,6}[ \\t]+(?:[NSEW]\\.?[ \\t]+)?(?:\\p{Lu}[\\p{L}'’-]*[ \\t]+){1,3}${STREET}(?:,?[ \\t]+(?:Apt|Apartment|Unit|Suite|Ste|#)\\.?[ \\t]*[\\w-]+)?|\\bP\\.?[ \\t]?O\\.?[ \\t]+Box[ \\t]+\\d+`, 'gu'),
  },
  {
    category: 'record',
    re: /\b(?:MRN|[Mm]edical [Rr]ecord|[Rr]ecord|[Cc]ase|[Aa]ccount|[Aa]cct|[Mm]ember|[Pp]atient|[Cc]lient|[Pp]olicy|[Cc]laim|ID)[ \t]*(?:[Nn]o\.?|[Nn]umber|[Nn]um\.?|#)?[ \t]*[:#]?[ \t]*([A-Z]{0,3}-?\d[\d-]{3,}\d)\b|(?<![\d-])\d{7,}(?![\d-])/g,
  },
  { category: 'person', re: new RegExp(`\\b(?:Mrs|Mr|Ms|Miss|Mx|Dr|Prof|Mister|Rev)\\b\\.?[ \\t]+(${NAME})`, 'gu'), name: 1 },
  // SL29: a city before a state, with a comma ("Huntsville, AL", "Huntsville, Alabama") or before a ZIP ("Huntsville AL
  // 35801"); after the people, so "Mrs. Jane Doe, AL" stays a name
  { category: 'city', re: new RegExp(`\\b${CITY},[ \\t]*(?:${STATE_ABBR}|${STATE_NAME})(?![\\p{L}])`, 'gu'), group: 1, lead: true, trim: trimCity },
  { category: 'city', re: new RegExp(`\\b${CITY}[ \\t]+${STATE_ABBR}[ \\t]+\\d{5}(?![\\d])`, 'gu'), group: 1, lead: true, trim: trimCity },
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
      if (p.after) {
        p.after.lastIndex = m.index + m[0].length;
        const d = p.after.exec(text);
        if (!d) continue;
        start = d.index;
        value = d[0];
      }
      if (p.group && m[p.group]) {
        start = m.index + (p.lead ? m[0].indexOf(m[p.group]) : m[0].lastIndexOf(m[p.group]));
        value = m[p.group];
      }
      if (p.trim) {
        const k = p.trim(value);
        if (k < 0) continue;
        start += k;
        value = value.slice(k);
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
