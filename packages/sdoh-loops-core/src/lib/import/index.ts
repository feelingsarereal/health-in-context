/**
 * SL29: import files into the case manager notebook, on the device. Loaded on first use only (the map route does not
 * carry the parsers). Text, Markdown, HTML, RTF, CSV and Word files are read in a worker bundled with the app; PDFs in
 * pdf.js's worker, served from the app's own origin. Nothing is fetched. The original file is not stored: only its
 * text, as an `imported` note with `source` (name, type, size, pages) — never its metadata.
 */
import ParseWorker from './parse.worker.ts?worker';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { IMPORT_TYPES, newImportedNote, type ImportType, type Note, type NoteTable } from '../model/notebook';
import { toDocMapped, type Simple } from './text';
import { parsePdf, PdfError } from './pdf';
import type { WorkerIn } from './parse.worker';

import { DEFAULT_LIMITS, EXTENSIONS, SUPPORTED, type ImportLimits } from './limits';
export { ACCEPT, DEFAULT_LIMITS, EXTENSIONS, SUPPORTED, type ImportLimits } from './limits';

export type ImportOutcome = { ok: true; note: Note } | { ok: false; filename: string; reason: 'type' | 'size' | 'pages' | 'scanned' | 'encrypted' | 'empty' | 'error'; message: string };

/** The type a file is read as, from its extension: null when it is not one the notebook imports. */
export function importType(name: string): ImportType | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return (ext && EXTENSIONS[ext]) || null;
}
const titleOf = (name: string) => name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim() || name;

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (r: { ok: boolean; blocks?: Simple[]; table?: NoteTable }) => void>();
function run(type: WorkerIn['type'], buf: ArrayBuffer) {
  if (!worker) {
    worker = new ParseWorker();
    worker.onmessage = (e) => {
      const r = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      r?.(e.data);
    };
  }
  const id = ++seq;
  return new Promise<{ ok: boolean; blocks?: Simple[]; table?: NoteTable }>((resolve) => {
    waiting.set(id, resolve);
    worker!.postMessage({ id, type, buf } satisfies WorkerIn, [buf]);
  });
}

/**
 * Read one file into an imported note (not yet saved: the identifier review comes first). A failure is an outcome,
 * not an exception, so one bad file never stops the others.
 */
export async function readImport(file: File, limits: ImportLimits = DEFAULT_LIMITS, onProgress?: (done: number, total: number) => void): Promise<ImportOutcome> {
  const filename = file.name || 'Untitled';
  const type = importType(filename);
  if (!type) return { ok: false, filename, reason: 'type', message: `${filename} can't be imported. The notebook imports ${SUPPORTED} files.` };
  if (file.size > limits.maxMB * 1024 * 1024) return { ok: false, filename, reason: 'size', message: `${filename} is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${limits.maxMB} MB.` };
  const size = file.size;
  try {
    const buf = await file.arrayBuffer();
    if (type === 'pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const r = await parsePdf(buf, { pdfjs: pdfjs as never, workerSrc: pdfWorkerSrc, maxPages: limits.maxPages, onProgress });
      const { doc, at } = toDocMapped(r.blocks);
      const anchors = r.pageStarts.map((p) => ({ block: p.block < at.length ? at[p.block] : doc.content.length, page: p.page })).filter((a) => a.block < doc.content.length);
      return { ok: true, note: newImportedNote({ title: titleOf(filename), body: doc, anchors, source: { filename, type, size, pages: r.pages, ...(r.dropped ? { dropped: r.dropped } : {}) } }) };
    }
    onProgress?.(0, 1);
    const r = await run(type, buf);
    onProgress?.(1, 1);
    if (!r.ok) return { ok: false, filename, reason: 'error', message: `${filename} could not be read.` };
    if (r.table) {
      if (!r.table.header.length) return { ok: false, filename, reason: 'empty', message: `${filename} has no rows to import.` };
      return { ok: true, note: newImportedNote({ title: titleOf(filename), table: r.table, source: { filename, type, size } }) };
    }
    const { doc } = toDocMapped(r.blocks ?? []);
    if (!doc.content.some((b) => b.type !== 'paragraph' || b.content?.length)) return { ok: false, filename, reason: 'empty', message: `${filename} has no text to import.` };
    return { ok: true, note: newImportedNote({ title: titleOf(filename), body: doc, source: { filename, type, size } }) };
  } catch (e) {
    if (e instanceof PdfError) return { ok: false, filename, reason: e.reason, message: `${filename}: ${e.message}` };
    return { ok: false, filename, reason: 'error', message: `${filename} could not be read.` };
  }
}

/** Pasted text, as an imported note of type txt (it goes through the same review). */
export async function readPasted(text: string, title = 'Pasted text'): Promise<ImportOutcome> {
  const file = new File([text], `${title}.txt`, { type: 'text/plain' });
  return readImport(file);
}
export { IMPORT_TYPES };
