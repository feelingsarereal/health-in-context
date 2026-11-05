/**
 * SL29: a Word file (.docx) to blocks, with the bundled mammoth converter: the document body becomes HTML (headings,
 * paragraphs, lists, tables), then the same sanitizer as an imported web page. mammoth reads the body only, so the
 * file's properties (author, title, company) are never read; comments and images are left out.
 */
// static: this module runs only inside the import worker (and unit tests), which is itself loaded on first import
import * as mammothNs from 'mammoth';
import { parseHtml, type Simple } from './text';

export async function parseDocx(buf: ArrayBuffer): Promise<Simple[]> {
  const mammoth = ((mammothNs as unknown as { default?: unknown }).default ?? mammothNs) as object;
  const res = await (mammoth as { convertToHtml: (i: { arrayBuffer: ArrayBuffer; buffer: ArrayBuffer }, o?: object) => Promise<{ value: string }> }).convertToHtml(
    // the browser build reads `arrayBuffer`, the Node build (unit tests) `buffer`
    { arrayBuffer: buf, buffer: buf },
    {
      // images are not text; nothing is embedded or fetched
      convertImage: (mammoth as unknown as { images: { imgElement: (f: () => Promise<object>) => unknown } }).images.imgElement(async () => ({ src: '' })),
      ignoreEmptyParagraphs: true,
      includeDefaultStyleMap: true,
    },
  );
  return parseHtml(res.value.replace(/<img\b[^>]*>/gi, ''));
}
