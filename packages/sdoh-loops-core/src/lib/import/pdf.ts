/**
 * SL29: a PDF's text layer, page by page, with the bundled pdf.js. Its worker is served from the app's own origin
 * (passed in as `workerSrc`); the file is read from memory, never by URL, and with no font, CMap or other fetch.
 * Each page's text becomes paragraphs (a line gap wider than usual starts one), and each page start is kept as an
 * anchor so a span can say "p. 3". The document info (author, title, producer) is never read. A PDF with no text
 * layer at all (a scan) is reported as such; it is not OCR'd.
 */
import type { Simple } from './text';
import { cleanPdfText, needsCleaning, recoverMap, type PdfFontInfo } from './glyphs';

export interface PdfResult {
  blocks: Simple[];
  /** the block each page starts at */
  pageStarts: { block: number; page: number }[];
  pages: number;
  /** SL27 point 9: characters that could not be read (unmapped private-use glyphs, U+FFFD, controls) and were left out */
  dropped: number;
}
export class PdfError extends Error {
  constructor(public reason: 'pages' | 'scanned' | 'encrypted' | 'error', message: string) {
    super(message);
  }
}

type TextItem = { str: string; hasEOL?: boolean; transform: number[]; height?: number; fontName?: string };
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: object) => { promise: Promise<PdfDoc>; destroy: () => Promise<void> };
}
interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: (TextItem | object)[] }>;
    getOperatorList: () => Promise<unknown>;
    commonObjs: { has: (id: string) => boolean; get: (id: string) => unknown };
    cleanup: () => void;
  }>;
  destroy: () => Promise<void>;
}

export async function parsePdf(
  buf: ArrayBuffer,
  opts: { pdfjs: PdfJs; workerSrc?: string; maxPages: number; onProgress?: (done: number, total: number) => void },
): Promise<PdfResult> {
  const { pdfjs } = opts;
  if (opts.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = opts.workerSrc;
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    useWorkerFetch: false,
    stopAtErrors: false,
    // SL27 point 9: the fonts' encodings, ToUnicode maps and Type 3 outlines, to read private-use glyphs
    fontExtraProperties: true,
  });
  let doc: PdfDoc;
  try {
    doc = await task.promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'PasswordException') throw new PdfError('encrypted', 'This PDF is password-protected, so nothing could be read.');
    throw new PdfError('error', 'This PDF could not be read.');
  }
  try {
    if (doc.numPages > opts.maxPages) throw new PdfError('pages', `This PDF has ${doc.numPages} pages; the limit is ${opts.maxPages}.`);
    const blocks: Simple[] = [];
    const pageStarts: { block: number; page: number }[] = [];
    let chars = 0;
    let dropped = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      let items = tc.items.filter((x): x is TextItem => typeof (x as TextItem).str === 'string');
      if (items.some((it) => needsCleaning(it.str))) {
        // the fonts are loaded with the page's operators; then each font's private-use glyphs are read where possible
        await page.getOperatorList();
        const maps = new Map<string, Map<string, string>>();
        const mapFor = (name: string | undefined) => {
          if (!name) return undefined;
          if (!maps.has(name)) maps.set(name, recoverMap(page.commonObjs.has(name) ? (page.commonObjs.get(name) as PdfFontInfo) : null));
          return maps.get(name);
        };
        items = items.map((it) => {
          if (!needsCleaning(it.str)) return it;
          const r = cleanPdfText(it.str, mapFor(it.fontName));
          dropped += r.dropped;
          return { ...it, str: r.text };
        });
      } else items = items.map((it) => ({ ...it, str: it.str.normalize('NFC') }));
      page.cleanup();
      const paras = pageParagraphs(items);
      pageStarts.push({ block: blocks.length, page: p });
      for (const t of paras) {
        chars += t.replace(/\s/g, '').length;
        blocks.push({ t: 'p', text: t });
      }
      opts.onProgress?.(p, doc.numPages);
    }
    if (!chars) throw new PdfError('scanned', 'This PDF has no text layer (it looks scanned), so nothing could be read.');
    // a page with no text still has its anchor, at the next page's first block
    return { blocks, pageStarts, pages: doc.numPages, dropped };
  } finally {
    await doc.destroy().catch(() => undefined);
  }
}

/** One page's text items to paragraphs: items on one line join; a vertical gap over 1.6 lines starts a paragraph. */
export function pageParagraphs(items: TextItem[]): string[] {
  const lines: { text: string; y: number; h: number }[] = [];
  let cur: { text: string; y: number; h: number } | null = null;
  for (const it of items) {
    const y = it.transform?.[5] ?? 0;
    const h = Math.abs(it.height ?? it.transform?.[3] ?? 10) || 10;
    if (!cur) cur = { text: '', y, h };
    else if (Math.abs(y - cur.y) > h * 0.5 && it.str.trim()) {
      lines.push(cur);
      cur = { text: '', y, h };
    }
    cur.text += it.str;
    if (it.hasEOL) {
      lines.push(cur);
      cur = null;
    }
  }
  if (cur) lines.push(cur);
  const paras: string[] = [];
  let buf: string[] = [];
  let prev: { y: number; h: number } | null = null;
  for (const l of lines) {
    const t = l.text.replace(/\s+/g, ' ').trim();
    if (!t) {
      if (buf.length) paras.push(buf.join(' '));
      buf = [];
      prev = null;
      continue;
    }
    if (prev && Math.abs(prev.y - l.y) > Math.max(prev.h, l.h) * 1.6 && buf.length) {
      paras.push(buf.join(' '));
      buf = [];
    }
    // a word hyphenated across lines joins up
    if (buf.length && /[a-z]-$/.test(buf[buf.length - 1]) && /^[a-z]/.test(t)) buf[buf.length - 1] = buf[buf.length - 1].slice(0, -1) + t;
    else buf.push(t);
    prev = l;
  }
  if (buf.length) paras.push(buf.join(' '));
  return paras;
}
