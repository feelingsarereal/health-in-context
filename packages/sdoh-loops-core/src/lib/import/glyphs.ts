/**
 * SL27 point 9: clean up a PDF's extracted text, so no box (an unknown glyph) or replacement character ever shows.
 *
 * A browser's print to PDF can name some glyphs by a private-use code point in its ToUnicode map: a font's contextual
 * alternates (Inter's "(" and "-" next to digits), and icon fonts. pdf.js passes those through. Here, per font:
 *   1. a glyph name that says what it is ("parenleft.case", "uni2192") gives the character;
 *   2. otherwise, in a Type 3 font (how Chrome prints a variable font), a glyph drawn with the same outline as a glyph
 *      the map does name (an alternate is the same shape, moved) gives that glyph's character;
 *   3. anything still unreadable is dropped and counted, never shown as a box.
 * The text is NFC-normalized; control characters and U+FFFD are dropped and counted too.
 */

/** Adobe Glyph List names for the punctuation and symbols that matter in prose (and digits and letters by name). */
const AGL: Record<string, string> = {
  parenleft: '(', parenright: ')', bracketleft: '[', bracketright: ']', braceleft: '{', braceright: '}',
  hyphen: '-', hyphenminus: '-', endash: '–', emdash: '—', minus: '−', figuredash: '‒', underscore: '_',
  bullet: '•', periodcentered: '·', middot: '·', ellipsis: '…', period: '.', comma: ',', colon: ':', semicolon: ';',
  exclam: '!', question: '?', slash: '/', backslash: '\\', bar: '|', ampersand: '&', at: '@', numbersign: '#',
  percent: '%', asterisk: '*', plus: '+', equal: '=', less: '<', greater: '>', multiply: '×', divide: '÷',
  quoteleft: '‘', quoteright: '’', quotedblleft: '“', quotedblright: '”', quotesingle: "'", quotedbl: '"',
  arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓', arrowboth: '↔', degree: '°', section: '§',
  dollar: '$', sterling: '£', euro: '€', copyright: '©', registered: '®', trademark: '™', space: ' ', nbspace: ' ',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};
/** The character a glyph name stands for, or null ("parenleft.case" → "(", "uni2192" → "→", "u1F600"). */
export function nameToChar(name: string | undefined | null): string | null {
  if (!name) return null;
  const base = name.split(/[._]/)[0];
  if (AGL[base]) return AGL[base];
  const uni = /^uni([0-9A-Fa-f]{4})$/.exec(base) ?? /^u([0-9A-Fa-f]{4,6})$/.exec(base);
  if (uni) {
    const cp = parseInt(uni[1], 16);
    if (!isPua(cp) && cp >= 0x20) return String.fromCodePoint(cp);
  }
  if (/^[A-Za-z]$/.test(base)) return base;
  return null;
}
export const isPua = (cp: number) => (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0x10fffd);

/** What pdf.js's main thread shows of a font, with `fontExtraProperties` on (only the fields used here). */
export interface PdfFontInfo {
  isType3Font?: boolean;
  differences?: (string | undefined)[];
  defaultEncoding?: (string | undefined)[];
  toUnicode?: { _map?: (string | number | undefined)[] } | null;
  charProcOperatorList?: Record<string, { fnArray: number[]; argsArray: unknown[] }>;
}
/** pdf.js's constructPath operator (OPS.constructPath) */
const CONSTRUCT_PATH = 91;
/** a glyph's bounding box, from its outline's own min/max */
function bbox(cp: { fnArray: number[]; argsArray: unknown[] } | undefined): { w: number; h: number; parts: number } | null {
  if (!cp) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, parts = 0;
  cp.fnArray.forEach((fn, i) => {
    if (fn !== CONSTRUCT_PATH) return;
    const [o, c, bx] = cp.argsArray[i] as [ArrayLike<number>, ArrayLike<number>, ArrayLike<number> | null];
    if (!o || !c) return;
    const ops = Array.from(o);
    const coords = Array.from(c);
    const box = bx ? Array.from(bx) : null;
    parts += ops.filter((k) => k === 13 || k === 19).length;
    const b = box ?? [Math.min(...coords.filter((_, k) => k % 2 === 0)), Math.min(...coords.filter((_, k) => k % 2 === 1)), Math.max(...coords.filter((_, k) => k % 2 === 0)), Math.max(...coords.filter((_, k) => k % 2 === 1))];
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  });
  return parts ? { w: x1 - x0, h: y1 - y0, parts } : null;
}

/** A Type 3 glyph's outline, independent of where it sits: its path ops and coordinates from its own corner, rounded. */
function outline(cp: { fnArray: number[]; argsArray: unknown[] } | undefined): string | null {
  if (!cp) return null;
  const parts: string[] = [];
  cp.fnArray.forEach((fn, i) => {
    if (fn !== CONSTRUCT_PATH) return;
    // in a browser the worker hands these over as typed arrays
    const [o, c, bx] = cp.argsArray[i] as [ArrayLike<number>, ArrayLike<number>, ArrayLike<number> | null];
    if (!o || !c) return;
    const ops = Array.from(o);
    const coords = Array.from(c);
    const box = bx ? Array.from(bx) : null;
    const minX = box?.[0] ?? Math.min(...coords.filter((_, k) => k % 2 === 0));
    const minY = box?.[1] ?? Math.min(...coords.filter((_, k) => k % 2 === 1));
    parts.push(`${ops.join(',')}|${coords.map((c, k) => Math.round((c - (k % 2 ? minY : minX)) / 4)).join(',')}`);
  });
  return parts.length ? parts.join(';') : null;
}

/**
 * For one font: each private-use character its ToUnicode map gives, and what it stands for (or '' to drop it). Built
 * from the glyph names first, then (Type 3) from outlines shared with glyphs whose Unicode is known.
 */
export function recoverMap(font: PdfFontInfo | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const map = font?.toUnicode?._map;
  if (!font || !Array.isArray(map)) return out;
  const names = font.differences?.length ? font.differences : font.defaultEncoding ?? [];
  const nameOf = (code: number) => names[code] ?? font.defaultEncoding?.[code];
  const known = new Map<string, string>();
  const pua: { code: number; ch: string }[] = [];
  map.forEach((u, code) => {
    if (typeof u !== 'string' || !u) return;
    const cp = u.codePointAt(0)!;
    if (isPua(cp)) pua.push({ code, ch: u });
    else if (font.isType3Font && [...u].length === 1) {
      const sig = outline(font.charProcOperatorList?.[nameOf(code) ?? '']);
      if (sig && !known.has(sig)) known.set(sig, u);
    }
  });
  // the width of a digit in this font, to size a dash by
  let digitW = 0;
  if (font.isType3Font)
    map.forEach((u, code) => {
      // the widest digit's ink (a "1" alone is too narrow to size by)
      if (typeof u === 'string' && /^[0-9]$/.test(u)) digitW = Math.max(digitW, bbox(font.charProcOperatorList?.[nameOf(code) ?? ''])?.w ?? 0);
    });
  for (const { code, ch } of pua) {
    const byName = nameToChar(nameOf(code));
    if (byName) {
      out.set(ch, byName);
      continue;
    }
    const cp = font.charProcOperatorList?.[nameOf(code) ?? ''];
    const sig = font.isType3Font ? outline(cp) : null;
    const same = sig && known.get(sig);
    if (same) {
      out.set(ch, same);
      continue;
    }
    // one shape reads unambiguously: a single flat bar is a dash — hyphen, en dash or em dash by its width against
    // the font's digits (Chrome prints Inter's "–" next to digits this way, with no name and no plain twin)
    const b = font.isType3Font ? bbox(cp) : null;
    if (b && b.parts === 1 && b.h > 0 && b.h < b.w * 0.3 && digitW) out.set(ch, b.w < digitW * 0.75 ? '-' : b.w < digitW * 1.5 ? '–' : '—');
    else out.set(ch, '');
  }
  return out;
}

/** NFC; private-use characters through the font's map (or dropped); controls and U+FFFD dropped. Counts the drops. */
export function cleanPdfText(s: string, map: Map<string, string> | undefined): { text: string; dropped: number } {
  let dropped = 0;
  let out = '';
  for (const ch of s.normalize('NFC')) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfffd || (cp < 0x20 && ch !== '\n' && ch !== '\t') || (cp >= 0x7f && cp < 0xa0)) {
      dropped++;
      continue;
    }
    if (isPua(cp)) {
      const r = map?.get(ch);
      if (r) out += r;
      else dropped++;
      continue;
    }
    out += ch;
  }
  return { text: out, dropped };
}
/** True when a string has anything cleanPdfText would change. */
export const needsCleaning = (s: string) => /[\uE000-\uF8FF\uFFFD\u0000-\u0008\u000B-\u001F\u007F-\u009F]|[\uDB80-\uDBFF]/.test(s);
