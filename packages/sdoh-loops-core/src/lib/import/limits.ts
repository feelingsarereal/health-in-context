/** SL29: what the notebook imports and how much — static and tiny, so the map route never loads the parsers for it. */
import type { ImportType } from '../model/notebook';

export interface ImportLimits {
  /** the largest file, in MB (default 20) */
  maxMB: number;
  /** the most PDF pages (default 300) */
  maxPages: number;
}
export const DEFAULT_LIMITS: ImportLimits = { maxMB: 20, maxPages: 300 };
export const EXTENSIONS: Record<string, ImportType> = { txt: 'txt', text: 'txt', md: 'md', markdown: 'md', html: 'html', htm: 'html', rtf: 'rtf', csv: 'csv', docx: 'docx', pdf: 'pdf' };
export const SUPPORTED = '.txt, .md, .html, .htm, .rtf, .csv, .docx and .pdf';
export const ACCEPT = '.txt,.md,.markdown,.html,.htm,.rtf,.csv,.docx,.pdf';
