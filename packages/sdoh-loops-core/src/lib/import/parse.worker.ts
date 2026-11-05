/**
 * SL29: the import worker — reads text, Markdown, HTML, RTF, CSV and Word files off the page, so the map stays
 * responsive. It makes no requests: the converters are bundled with it. (PDFs run in pdf.js's own worker.)
 */
import { parseCsv, parseHtml, parseMd, parseRtf, parseTxt } from './text';
import { parseDocx } from './docx';

export type WorkerIn = { id: number; type: 'txt' | 'md' | 'html' | 'rtf' | 'csv' | 'docx'; buf: ArrayBuffer };

function decode(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u);
  } catch {
    return new TextDecoder('windows-1252').decode(u);
  }
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { id, type, buf } = e.data;
  try {
    if (type === 'csv') return self.postMessage({ id, ok: true, table: parseCsv(decode(buf)) });
    const blocks =
      type === 'docx' ? await parseDocx(buf) : type === 'html' ? parseHtml(decode(buf)) : type === 'md' ? parseMd(decode(buf)) : type === 'rtf' ? parseRtf(decode(buf)) : parseTxt(decode(buf));
    self.postMessage({ id, ok: true, blocks });
  } catch {
    self.postMessage({ id, ok: false });
  }
};
