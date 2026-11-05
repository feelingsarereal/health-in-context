/**
 * SL29: the notebook's file import — plain-text formats into a note's blocks. Pure functions with no DOM, so they run
 * in the import worker (and in unit tests): text, Markdown, HTML (sanitized to text, headings and lists), RTF and CSV.
 * Document metadata — an HTML <head> and <title>, an RTF \info group, a Markdown front matter block — is dropped and
 * never shown.
 */
import type { NoteBlock, NoteDoc, NoteTable } from '../model/notebook';

/** a block before it becomes a NoteDoc block: a paragraph, a heading (2 or 3) or a list of plain-text items */
export type Simple = { t: 'p'; text: string } | { t: 'h'; level: 2 | 3; text: string } | { t: 'ul' | 'ol'; items: string[] };

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t\u00A0]+/g, ' ').trim();

/** Inline text with line breaks kept as hard breaks. */
function inline(text: string) {
  const lines = text.split('\n').map(clean);
  const out: ({ type: 'text'; text: string } | { type: 'hardBreak' })[] = [];
  lines.forEach((l, i) => {
    if (i && out.length) out.push({ type: 'hardBreak' });
    if (l) out.push({ type: 'text', text: l });
  });
  while (out.length && out[out.length - 1].type === 'hardBreak') out.pop();
  return out;
}

export function toDoc(blocks: Simple[]): NoteDoc {
  return toDocMapped(blocks).doc;
}
/** As toDoc, with where each input block landed: `at[i]` is the output block index of input i (or the next one kept). */
export function toDocMapped(blocks: Simple[]): { doc: NoteDoc; at: number[] } {
  const content: NoteBlock[] = [];
  const at: number[] = [];
  for (const b of blocks) {
    at.push(content.length);
    if (b.t === 'p') {
      const c = inline(b.text);
      if (c.length) content.push({ type: 'paragraph', content: c as never });
    } else if (b.t === 'h') {
      const t = clean(b.text);
      if (t) content.push({ type: 'heading', attrs: { level: b.level }, content: [{ type: 'text', text: t }] });
    } else {
      const items = b.items.map(clean).filter(Boolean);
      if (items.length) content.push({ type: b.t === 'ul' ? 'bulletList' : 'orderedList', content: items.map((x) => ({ type: 'listItem' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: x }] }] })) });
    }
  }
  return { doc: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }, at };
}

/** Plain text: a blank line starts a paragraph; single line breaks stay inside it. */
export function parseTxt(text: string): Simple[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => ({ t: 'p' as const, text: p.replace(/^\n+|\n+$/g, '') }))
    .filter((b) => b.text.trim());
}

/** Inline Markdown to plain text: links keep their text, images and HTML tags go, emphasis and code marks go. */
function mdInline(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1');
}

/** Markdown: ATX and setext headings (# and ## become level 2, deeper level 3), lists, paragraphs, quotes as text. */
export function parseMd(text: string): Simple[] {
  let src = text.replace(/\r\n?/g, '\n');
  // front matter is metadata
  src = src.replace(/^---\n[\s\S]*?\n---\n/, '');
  const lines = src.split('\n');
  const out: Simple[] = [];
  let para: string[] = [];
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null;
  let fence = false;
  const flush = () => {
    if (para.length) out.push({ t: 'p', text: mdInline(para.join('\n')) });
    para = [];
    if (list) out.push(list);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) {
      fence = !fence;
      continue;
    }
    if (fence) {
      para.push(l);
      continue;
    }
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (h) {
      flush();
      out.push({ t: 'h', level: h[1].length <= 2 ? 2 : 3, text: mdInline(h[2]) });
      continue;
    }
    if (para.length && /^\s{0,3}(=+|-+)\s*$/.test(l) && !list) {
      const level = l.trim()[0] === '=' ? 2 : 2;
      const t = para.join(' ');
      para = [];
      out.push({ t: 'h', level, text: mdInline(t) });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) {
      flush();
      continue;
    }
    const li = /^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(l);
    if (li) {
      const t = /\d/.test(li[1]) ? 'ol' : 'ul';
      if (para.length) {
        out.push({ t: 'p', text: mdInline(para.join('\n')) });
        para = [];
      }
      if (!list || list.t !== t) {
        if (list) out.push(list);
        list = { t, items: [] };
      }
      list.items.push(mdInline(li[2]));
      continue;
    }
    if (!l.trim()) {
      flush();
      continue;
    }
    if (list && /^\s{2,}\S/.test(l)) {
      list.items[list.items.length - 1] += ' ' + mdInline(l.trim());
      continue;
    }
    if (list) flush();
    para.push(l.replace(/^\s{0,3}>\s?/, ''));
  }
  flush();
  return out;
}

// ───────────────────────── HTML (also what the DOCX converter gives back)
const BR = '\uE000';
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', deg: '°', eacute: 'é', egrave: 'è', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : '';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/**
 * HTML to blocks with a small tokenizer (the worker has no DOM): h1–h2 become level-2 headings, h3–h6 level 3, list
 * items lists (nested lists flattened), table rows paragraphs with their cells joined by " · ", every other block a
 * paragraph. Scripts, styles, the <head> (title and meta: metadata) and comments are dropped; nothing is rendered.
 */
export function parseHtml(html: string): Simple[] {
  const src = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|math|head|title|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(meta|link|base)\b[^>]*>/gi, '');
  const out: Simple[] = [];
  let buf = '';
  let mode: 'p' | 'h2' | 'h3' | 'li' | 'cell' = 'p';
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null;
  const lists: ('ul' | 'ol')[] = [];
  let row: string[] | null = null;
  // spaces collapse; a <br> mark (BR) stays, and becomes a line break in a paragraph
  const text = () => decodeEntities(buf).replace(/[^\S\uE000]+/g, ' ').replace(/^[\s\uE000]+|[\s\uE000]+$/g, '');
  const end = () => {
    const t = text();
    buf = '';
    if (!t) return;
    if (mode === 'h2' || mode === 'h3') out.push({ t: 'h', level: mode === 'h2' ? 2 : 3, text: t });
    else if (mode === 'li' && list) list.items.push(t);
    else if (mode === 'cell' && row) row.push(t);
    else out.push({ t: 'p', text: t });
  };
  const closeList = () => {
    if (list?.items.length) out.push(list);
    list = null;
  };
  const re = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/)?\s*>|([^<]+)|(<)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[4] !== undefined || m[5] !== undefined) {
      buf += m[4] ?? m[5];
      continue;
    }
    const close = !!m[1];
    const tag = m[2].toLowerCase();
    if (tag === 'br') {
      // a <br> inside a paragraph keeps its line break (as BR, since spaces collapse); elsewhere a space
      buf += mode === 'p' ? BR : ' ';
      continue;
    }
    if (/^h[1-6]$/.test(tag)) {
      end();
      mode = close ? (lists.length ? 'li' : 'p') : Number(tag[1]) <= 2 ? 'h2' : 'h3';
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      end();
      if (close) {
        lists.pop();
        if (!lists.length) {
          closeList();
          mode = 'p';
        }
      } else {
        if (!lists.length) {
          closeList();
          list = { t: tag, items: [] };
        }
        lists.push(tag);
      }
      continue;
    }
    if (tag === 'li') {
      end();
      mode = lists.length ? 'li' : 'p';
      continue;
    }
    if (tag === 'tr') {
      end();
      if (close) {
        if (row?.length) out.push({ t: 'p', text: row.join(' · ') });
        row = null;
        mode = 'p';
      } else {
        row = [];
        mode = 'cell';
      }
      continue;
    }
    if (tag === 'td' || tag === 'th') {
      end();
      mode = row ? 'cell' : 'p';
      continue;
    }
    if (/^(p|div|section|article|header|footer|main|aside|nav|blockquote|pre|table|thead|tbody|tfoot|figure|figcaption|dl|dt|dd|address|hr|body|html|form|fieldset|legend|caption)$/.test(tag)) {
      end();
      if (!lists.length && !row) mode = 'p';
      continue;
    }
    // inline tags (b, i, a, span, …): their text stays, the tag goes
  }
  end();
  closeList();
  return out.map((b) => (b.t === 'p' ? { ...b, text: b.text.replace(/ ?\uE000 ?/g, '\n') } : b.t === 'h' ? { ...b, text: b.text.replace(/\uE000/g, ' ') } : b));
}

// ───────────────────────── RTF
const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'object', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'themedata', 'colorschememapping', 'datastore', 'latentstyles', 'filetbl', 'revtbl', 'pgdsctbl', 'footnote', 'field']);
/**
 * RTF to text: control words and groups are read, \par and \line break lines, \'hh and \uN are decoded, and the
 * font, color and style tables, pictures, headers and footers and the \info group (author, title: metadata) are skipped.
 * A field keeps its result text (\fldrslt) only.
 */
export function parseRtf(rtf: string): Simple[] {
  let out = '';
  const stack: { skip: boolean; uc: number }[] = [{ skip: false, uc: 1 }];
  let skipChars = 0;
  let i = 0;
  const cur = () => stack[stack.length - 1];
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === '{') {
      stack.push({ ...cur() });
      i++;
      continue;
    }
    if (c === '}') {
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }
    if (c === '\\') {
      const n = rtf[i + 1];
      if (n === '\\' || n === '{' || n === '}') {
        if (!cur().skip) out += n;
        i += 2;
        continue;
      }
      if (n === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (skipChars > 0) skipChars--;
        else if (!cur().skip) out += cp1252(parseInt(hex, 16));
        i += 4;
        continue;
      }
      if (n === '*') {
        cur().skip = true;
        i += 2;
        continue;
      }
      if (n === '~') {
        if (!cur().skip) out += ' ';
        i += 2;
        continue;
      }
      if (n === '-' || n === '_') {
        i += 2;
        continue;
      }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 40));
      if (!m) {
        i += 2;
        continue;
      }
      i += m[0].length;
      const word = m[1];
      const arg = m[2] !== undefined ? Number(m[2]) : undefined;
      if (word === 'fldrslt') {
        cur().skip = false;
        continue;
      }
      if (word === 'fldinst' || RTF_SKIP.has(word)) {
        cur().skip = true;
        continue;
      }
      if (cur().skip) continue;
      if (word === 'par' || word === 'sect' || word === 'page') out += '\n\n';
      else if (word === 'line') out += '\n';
      else if (word === 'tab' || word === 'cell') out += ' ';
      else if (word === 'row') out += '\n\n';
      else if (word === 'uc' && arg !== undefined) cur().uc = arg;
      else if (word === 'u' && arg !== undefined) {
        out += String.fromCharCode(arg < 0 ? arg + 65536 : arg);
        skipChars = cur().uc;
      } else if (word === 'emdash') out += '—';
      else if (word === 'endash') out += '–';
      else if (word === 'lquote') out += '‘';
      else if (word === 'rquote') out += '’';
      else if (word === 'ldblquote') out += '“';
      else if (word === 'rdblquote') out += '”';
      else if (word === 'bullet') out += '•';
      continue;
    }
    if (c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (skipChars > 0) {
      skipChars--;
      i++;
      continue;
    }
    if (!cur().skip) out += c;
    i++;
  }
  return parseTxt(out);
}
const CP1252: Record<number, string> = { 0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™' };
const cp1252 = (b: number) => CP1252[b] ?? String.fromCharCode(b);

// ───────────────────────── CSV
/** RFC 4180 CSV (quotes, doubled quotes, line breaks inside quotes; a semicolon or tab delimiter when there is no comma). */
export function parseCsv(text: string): NoteTable {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const first = src.split('\n', 1)[0] ?? '';
  const delim = first.includes(',') ? ',' : first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && !cell) q = true;
    else if (c === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (c === '\n') {
      row.push(cell.trim());
      if (row.some((x) => x)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x)) rows.push(row);
  const width = Math.max(0, ...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
  const [header = [], ...rest] = rows.map(pad);
  return { header, rows: rest };
}
