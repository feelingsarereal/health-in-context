/**
 * SL26 (S7.1 slice 1): the case manager notebook — one per map, stored in the map file's `notebook` block (schema 3).
 * Pure data and pure operations, like map.ts. A note is free (rich text with headings and lists) or structured (a
 * template's headed fields, each a short rich-text block, with a date field first that takes a year by default).
 *
 * Privacy (S7.1, health profile): the notebook is device-only. A local heuristic flags possible identifiers
 * (identifiers.ts); "Replace with a label" swaps a flagged value for a consistent [label] everywhere in the notebook.
 * What is stored is the category and count of what was replaced, never the value itself.
 */
import { emptyDoc, sanitizeRich, type RichDoc, type RichMark, type RichText } from './rich';
import { findIdentifiers, IDENTIFIER_CATEGORIES, type IdentifierCategory } from './identifiers';

// ───────────────────────── rich text for free notes: the map's marks, plus headings and lists
export interface NoteBreak {
  type: 'hardBreak';
}
export interface NotePara {
  type: 'paragraph';
  content?: (RichText | NoteBreak)[];
}
export interface NoteHeading {
  type: 'heading';
  attrs: { level: 2 | 3 };
  content?: (RichText | NoteBreak)[];
}
export interface NoteListItem {
  type: 'listItem';
  content: (NotePara | NoteList)[];
}
export interface NoteList {
  type: 'bulletList' | 'orderedList';
  content: NoteListItem[];
}
export type NoteBlock = NotePara | NoteHeading | NoteList;
export interface NoteDoc {
  type: 'doc';
  content: NoteBlock[];
}

export function emptyNoteDoc(): NoteDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** Keep only the allowed structure (paragraph, heading 2–3, bullet and ordered lists, text with the map's marks). */
export function sanitizeNote(input: unknown): NoteDoc {
  if (typeof input === 'string') return { type: 'doc', content: sanitizeRich(input).content };
  if (!input || typeof input !== 'object' || (input as { type?: unknown }).type !== 'doc') return emptyNoteDoc();
  const inline = (block: unknown): (RichText | NoteBreak)[] => {
    // the map's sanitizer already flattens anything unknown into runs with clean marks
    const p = sanitizeRich({ type: 'doc', content: [block] }).content[0];
    return (p?.content ?? []) as (RichText | NoteBreak)[];
  };
  const blocks = (list: unknown[], depth: number): NoteBlock[] => {
    const out: NoteBlock[] = [];
    for (const b of list) {
      if (!b || typeof b !== 'object') continue;
      const n = b as { type?: unknown; attrs?: { level?: unknown }; content?: unknown };
      if ((n.type === 'bulletList' || n.type === 'orderedList') && Array.isArray(n.content) && depth < 4) {
        const items: NoteListItem[] = [];
        for (const li of n.content as unknown[]) {
          const kids = Array.isArray((li as { content?: unknown })?.content) ? ((li as { content: unknown[] }).content) : [];
          const inner = blocks(kids, depth + 1).map((x) => (x.type === 'heading' ? ({ type: 'paragraph', ...(x.content ? { content: x.content } : {}) } as NotePara) : x));
          items.push({ type: 'listItem', content: inner.length ? (inner as (NotePara | NoteList)[]) : [{ type: 'paragraph' }] });
        }
        if (items.length) out.push({ type: n.type, content: items });
      } else if (n.type === 'heading') {
        const level = n.attrs?.level === 3 ? 3 : 2;
        const c = inline(b);
        out.push(c.length ? { type: 'heading', attrs: { level }, content: c } : { type: 'heading', attrs: { level } });
      } else {
        const c = inline(b);
        out.push(c.length ? { type: 'paragraph', content: c } : { type: 'paragraph' });
      }
    }
    return out;
  };
  const content = blocks(((input as { content?: unknown }).content as unknown[]) ?? [], 0);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

type AnyDoc = RichDoc | NoteDoc;
type Inline = RichText | NoteBreak;
interface Textblock {
  content?: Inline[];
}

/** Every textblock (paragraph or heading, inside lists too), in reading order. */
export function textblocks(doc: AnyDoc | null | undefined): Textblock[] {
  const out: Textblock[] = [];
  const walk = (list: unknown[]) => {
    for (const b of list as { type: string; content?: unknown[] }[]) {
      if (!b) continue;
      if (b.type === 'paragraph' || b.type === 'heading') out.push(b as Textblock);
      else if (Array.isArray(b.content)) walk(b.content);
    }
  };
  walk(doc?.content ?? []);
  return out;
}
const blockText = (b: Textblock) => (b.content ?? []).map((n) => (n.type === 'text' ? n.text : '\n')).join('');
export function noteDocText(doc: AnyDoc | null | undefined): string {
  return textblocks(doc).map(blockText).join('\n').trim();
}

// ───────────────────────── notes, templates, the notebook block
export interface NoteField {
  /** the template's field key; `date` is the date field */
  key: string;
  label: string;
  /** the date field's value: a year by default ("2026"), or a full date when `full` is set */
  value?: string;
  full?: boolean;
  /** every other field: a short rich-text block */
  body?: RichDoc;
}
/** SL29: the file an imported note came from. The original is never stored, nor its metadata (author, title fields). */
export interface NoteSource {
  filename: string;
  /** the format it was read as: txt, md, html, rtf, csv, docx or pdf */
  type: ImportType;
  /** bytes */
  size: number;
  /** when it was imported (ISO) */
  imported: string;
  /** a PDF's page count */
  pages?: number;
  /** SL27 point 9: characters that could not be read and were left out (a PDF's unmapped glyphs) */
  dropped?: number;
  /**
   * what the user chose in the identifier review before saving: 'none' (nothing was flagged), 'labelled' (Label all),
   * 'reviewed' (one by one), 'kept' (Keep as is, confirmed); `kept` is how many flags were left as they were
   */
  review: 'none' | 'labelled' | 'reviewed' | 'kept';
  kept?: number;
}
export const IMPORT_TYPES = ['txt', 'md', 'html', 'rtf', 'csv', 'docx', 'pdf'] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];
/** SL29: a page break kept as an anchor: the page starts at this top-level block of the body ("p. 3") */
export interface NoteAnchor {
  block: number;
  page: number;
}
/** SL29: an imported CSV, as a table: the header row and the rows, every cell plain text */
export interface NoteTable {
  header: string[];
  rows: string[][];
}
export interface Note {
  id: string;
  title: string;
  /** SL29: 'imported' — text read from a file, kept verbatim (title and tags stay editable; labels still replace values) */
  kind: 'free' | 'structured' | 'imported';
  /** SL29: an imported note's file, page anchors and (for a CSV) its table */
  source?: NoteSource;
  anchors?: NoteAnchor[];
  table?: NoteTable;
  /** the template id of a structured note */
  template?: string;
  /** a free note's body */
  body: NoteDoc;
  /** a structured note's fields, in the template's order */
  fields?: NoteField[];
  created: string;
  updated: string;
  tags: string[];
}
// ───────────────────────── SL27: spans and annotations (S7.1 model)
/** where in a note a span sits: 'body', or a structured note's field key */
export type SpanWhere = string;
/**
 * SL27: a selection in a note, anchored like a W3C TextQuoteSelector with a position hint: its quote, the text just
 * before and after it, and its offsets into the field's text (textblocks joined by line breaks). A span whose quote no
 * longer matches is `orphaned` and is never silently re-pointed.
 */
export interface Span {
  id: string;
  note: string;
  where: SpanWhere;
  quote: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  orphaned?: boolean;
  /** made by accepting an extractor's proposal: who suggested it, and whether the reading was inferred */
  by?: SuggestedBy & { inferred?: boolean; confidence?: 'high' | 'medium' | 'low' };
}
/** SL27: who suggested something (kept in the map file, so a reader can tell user-made from machine-suggested) */
export interface SuggestedBy {
  extractor: string;
  label: string;
}
/** what a span supports: a circumstance (node), a link (edge), or (SL28) any other item */
export type TargetKind = 'node' | 'edge' | 'loop' | 'cluster' | 'code' | 'reference' | 'glossary' | 'concept' | 'note' | 'span' | (string & {});
export interface Target {
  kind: TargetKind;
  id: string;
}
/** SL27: a span's comment and the items it supports */
export interface Annotation {
  id: string;
  span: string;
  text?: string;
  targets: Target[];
}

export interface Notebook {
  notes: Note[];
  /** SL27: selections in the notes, and their annotations */
  spans?: Span[];
  annotations?: Annotation[];
  /** values the user marked "Not an identifier", as `category:value` (lower case); remembered per notebook */
  dismissed: string[];
  /** what "Replace with a label" replaced: the count of distinct values per category. Never the values. */
  replaced: Partial<Record<IdentifierCategory, number>>;
}

export interface NoteTemplate {
  id: string;
  name: string;
  /** the headed fields after the date field */
  fields: { key: string; label: string }[];
}

export const DATE_FIELD = { key: 'date', label: 'Date' } as const;
/** SL26: the core's four templates; a host adds its own through <SdohMap notebookTemplates>. */
export const CORE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'intake',
    name: 'Intake',
    fields: [
      { key: 'present', label: 'Who took part' },
      { key: 'asks', label: 'What the person wants help with' },
      { key: 'housing', label: 'Housing' },
      { key: 'income', label: 'Income and work' },
      { key: 'food', label: 'Food' },
      { key: 'transport', label: 'Transportation' },
      { key: 'supports', label: 'Supports and connections' },
      { key: 'next', label: 'Next steps' },
    ],
  },
  {
    id: 'contact',
    name: 'Contact note',
    fields: [
      { key: 'how', label: 'Contact type (call, visit, message)' },
      { key: 'discussed', label: 'What was discussed' },
      { key: 'changed', label: 'What changed since last time' },
      { key: 'followup', label: 'Follow-up' },
    ],
  },
  {
    id: 'conference',
    name: 'Case conference',
    fields: [
      { key: 'who', label: 'Who took part' },
      { key: 'circumstances', label: 'Circumstances discussed' },
      { key: 'options', label: 'Options considered' },
      { key: 'actions', label: 'Agreed actions and who does what' },
    ],
  },
  {
    id: 'review',
    name: 'Plan review',
    fields: [
      { key: 'goals', label: 'Goals' },
      { key: 'progress', label: 'Progress' },
      { key: 'barriers', label: 'Barriers' },
      { key: 'changes', label: 'Changes to the plan' },
      { key: 'nextReview', label: 'Next review' },
    ],
  },
];

let counter = 0;
const nid = () => {
  counter = (counter + 1) % 1e6;
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `note-${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
};
const now = () => new Date().toISOString();

export function emptyNotebook(): Notebook {
  return { notes: [], dismissed: [], replaced: {} };
}

export function newFreeNote(title = 'Untitled note'): Note {
  const t = now();
  return { id: nid(), title, kind: 'free', body: emptyNoteDoc(), created: t, updated: t, tags: [] };
}
export function newStructuredNote(tpl: NoteTemplate, year = String(new Date().getFullYear())): Note {
  const t = now();
  return {
    id: nid(),
    title: tpl.name,
    kind: 'structured',
    template: tpl.id,
    body: emptyNoteDoc(),
    fields: [{ ...DATE_FIELD, value: year, full: false }, ...tpl.fields.map((f) => ({ key: f.key, label: f.label, body: emptyDoc() }))],
    created: t,
    updated: t,
    tags: [],
  };
}

/** SL29: an imported note, ready for the review step (not yet in any notebook). */
export function newImportedNote(p: { title: string; body?: NoteDoc; anchors?: NoteAnchor[]; table?: NoteTable; source: Omit<NoteSource, 'imported' | 'review'> }): Note {
  const t = now();
  return {
    id: nid(),
    title: p.title,
    kind: 'imported',
    body: p.body ?? emptyNoteDoc(),
    ...(p.anchors?.length ? { anchors: p.anchors } : {}),
    ...(p.table ? { table: p.table } : {}),
    source: { ...p.source, imported: t, review: 'none' },
    created: t,
    updated: t,
    tags: [],
  };
}
/**
 * SL29: where a top-level block of an imported note sits — its page ("p. 3") and the heading it is under ("under
 * Housing") — so a span can say where its quote came from.
 */
export function anchorOf(n: Note, block: number): { page?: number; heading?: string; label: string } {
  const page = [...(n.anchors ?? [])].filter((a) => a.block <= block).sort((a, b) => b.block - a.block)[0]?.page;
  let heading: string | undefined;
  for (let i = Math.min(block, n.body.content.length - 1); i >= 0; i--) {
    const b = n.body.content[i];
    if (b?.type === 'heading' && i < block) {
      heading = blockText(b).trim();
      break;
    }
  }
  const label = [page ? `p. ${page}` : '', heading ? `under ${heading}` : ''].filter(Boolean).join(', ');
  return { ...(page ? { page } : {}), ...(heading ? { heading } : {}), label };
}
const tableText = (t: NoteTable | undefined) => (t ? [t.header, ...t.rows].map((r) => r.join(' ')).join('\n') : '');

/** The note's searchable text: title, tags, body and every field. */
export function noteText(n: Note): string {
  return [n.title, n.tags.join(' '), noteDocText(n.body), tableText(n.table), ...(n.fields ?? []).map((f) => (f.key === DATE_FIELD.key ? f.value ?? '' : `${f.label}\n${noteDocText(f.body)}`))].join('\n');
}
export function searchNotes(nb: Notebook, q: string, tag?: string | null): Note[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return nb.notes.filter((n) => (!tag || n.tags.includes(tag)) && (!words.length || words.every((w) => noteText(n).toLowerCase().includes(w))));
}
export function allTags(nb: Notebook | undefined): string[] {
  return [...new Set((nb?.notes ?? []).flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b));
}
export function parseTags(s: string): string[] {
  return [...new Set(s.split(',').map((t) => t.trim().replace(/\s+/g, ' ')).filter(Boolean))];
}

// ───────────────────────── operations on a notebook (each returns a new notebook)
const nb0 = (nb: Notebook | undefined) => nb ?? emptyNotebook();
export function addNote(nb: Notebook | undefined, n: Note, at?: number): Notebook {
  const b = nb0(nb);
  const notes = [...b.notes];
  notes.splice(at ?? notes.length, 0, n);
  return { ...b, notes };
}
export function updateNote(nb: Notebook | undefined, id: string, patch: Partial<Note>): Notebook {
  const b = nb0(nb);
  const next = { ...b, notes: b.notes.map((n) => (n.id === id ? { ...n, ...patch, updated: now() } : n)) };
  // SL27: a change to the text moves its spans with it, or orphans them
  return patch.body || patch.fields ? reanchorNote(next, id) : next;
}
export function updateField(nb: Notebook | undefined, id: string, key: string, patch: Partial<NoteField>): Notebook {
  const b = nb0(nb);
  const n = b.notes.find((x) => x.id === id);
  if (!n?.fields) return b;
  return updateNote(b, id, { fields: n.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) });
}
export function deleteNote(nb: Notebook | undefined, id: string): Notebook {
  const b = nb0(nb);
  return { ...b, notes: b.notes.filter((n) => n.id !== id) };
}
export function duplicateNote(nb: Notebook | undefined, id: string, copyLabel = 'copy'): { notebook: Notebook; note: Note | null } {
  const b = nb0(nb);
  const i = b.notes.findIndex((n) => n.id === id);
  if (i < 0) return { notebook: b, note: null };
  const t = now();
  const src = b.notes[i];
  const note: Note = { ...JSON.parse(JSON.stringify(src)), id: nid(), title: `${src.title} (${copyLabel})`, created: t, updated: t };
  return { notebook: addNote(b, note, i + 1), note };
}
/** Move a note to a new index (drag and drop, or Alt+↑ / Alt+↓). */
export function moveNote(nb: Notebook | undefined, id: string, to: number): Notebook {
  const b = nb0(nb);
  const from = b.notes.findIndex((n) => n.id === id);
  if (from < 0) return b;
  const dest = Math.max(0, Math.min(b.notes.length - 1, to));
  if (dest === from) return b;
  const notes = [...b.notes];
  const [n] = notes.splice(from, 1);
  notes.splice(dest, 0, n);
  return { ...b, notes };
}

// ───────────────────────── identifier flags
export interface Flag {
  note: string;
  /** 'title', 'body', 'tags', or a field key */
  where: string;
  category: IdentifierCategory;
  value: string;
  /** the name inside a person match (after the honorific or "my name is"), replaced with the same label */
  name?: string;
  /** a few words around the match, for the flag list */
  context: string;
}
const dismissKey = (category: string, value: string) => `${category}:${value.trim().toLowerCase()}`;
export function isDismissed(nb: Notebook | undefined, category: string, value: string): boolean {
  return !!nb?.dismissed.includes(dismissKey(category, value));
}

function flagsIn(text: string, base: Omit<Flag, 'category' | 'value' | 'context' | 'name'>, nb: Notebook | undefined, out: Flag[]) {
  for (const m of findIdentifiers(text)) {
    if (isDismissed(nb, m.category, m.value)) continue;
    const a = Math.max(0, m.start - 24);
    const b = Math.min(text.length, m.end + 24);
    out.push({ ...base, category: m.category, value: m.value, ...(m.name ? { name: m.name } : {}), context: `${a > 0 ? '…' : ''}${text.slice(a, b).replace(/\s+/g, ' ')}${b < text.length ? '…' : ''}` });
  }
}
/** Every possible identifier left in the notebook (dismissed ones excluded), note by note in order. */
export function notebookFlags(nb: Notebook | undefined): Flag[] {
  const out: Flag[] = [];
  for (const n of nb?.notes ?? []) {
    flagsIn(n.title, { note: n.id, where: 'title' }, nb, out);
    if (n.tags.length) flagsIn(n.tags.join(', '), { note: n.id, where: 'tags' }, nb, out);
    for (const b of textblocks(n.body)) flagsIn(blockText(b), { note: n.id, where: 'body' }, nb, out);
    // SL29: an imported table, cell by cell
    if (n.table) for (const row of [n.table.header, ...n.table.rows]) for (const cell of row) flagsIn(cell, { note: n.id, where: 'table' }, nb, out);
    for (const f of n.fields ?? []) {
      if (f.key === DATE_FIELD.key) flagsIn(f.value ?? '', { note: n.id, where: f.key }, nb, out);
      else for (const b of textblocks(f.body)) flagsIn(blockText(b), { note: n.id, where: f.key }, nb, out);
    }
    // SL27: the comments on this note's spans
    for (const a of nb?.annotations ?? []) if (a.text && nb?.spans?.some((x) => x.id === a.span && x.note === n.id)) flagsIn(a.text, { note: n.id, where: 'annotation' }, nb, out);
  }
  return out;
}

/** "Not an identifier": remembered per notebook, so the same value is never flagged again in it. */
export function dismissFlag(nb: Notebook | undefined, category: string, value: string): Notebook {
  const b = nb0(nb);
  const k = dismissKey(category, value);
  return b.dismissed.includes(k) ? b : { ...b, dismissed: [...b.dismissed, k] };
}

export const LABELS: Record<IdentifierCategory, string> = {
  person: '[Person]',
  date: '[date]',
  dob: '[date of birth]',
  age: '[age]',
  phone: '[phone]',
  email: '[email]',
  address: '[address]',
  city: '[city]',
  zip: '[ZIP code]',
  ssn: '[ID number]',
  record: '[record no.]',
};
const letters = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letters(Math.floor(i / 26) - 1) + letters(i % 26));
/** The next label of a category: people get letters in order ([Person A], [Person B]…); the rest one label each. */
export function nextLabel(nb: Notebook | undefined, category: IdentifierCategory): string {
  if (category === 'person') return `[Person ${letters(nb?.replaced.person ?? 0)}]`;
  return LABELS[category];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace every match of `re` in one textblock's inline content, across mark boundaries. The replacement takes the
 * marks of the first character it replaces; hard breaks are kept unless a match spans them.
 */
function replaceInBlock(content: Inline[] | undefined, re: RegExp, label: string): Inline[] | undefined {
  if (!content?.length) return content;
  const text = content.map((n) => (n.type === 'text' ? n.text : '\n')).join('');
  const hits: [number, number][] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0].length) {
      re.lastIndex++;
      continue;
    }
    hits.push([m.index, m.index + m[0].length]);
  }
  if (!hits.length) return content;
  // per UTF-16 unit (the regex offsets' unit) with its marks, then rebuild runs
  const units: { ch: string; marks?: RichMark[]; br?: boolean }[] = [];
  for (const n of content) {
    if (n.type === 'text') for (let k = 0; k < n.text.length; k++) units.push({ ch: n.text[k], marks: n.marks });
    else units.push({ ch: '\n', br: true });
  }
  const out: typeof units = [];
  let i = 0;
  for (const [a, b] of hits) {
    while (i < a) out.push(units[i++]);
    const marks = units[a]?.marks;
    for (const ch of label) out.push({ ch, marks });
    i = b;
  }
  while (i < units.length) out.push(units[i++]);
  const runs: Inline[] = [];
  for (const u of out) {
    if (u.br) {
      runs.push({ type: 'hardBreak' });
      continue;
    }
    const last = runs[runs.length - 1];
    if (last && last.type === 'text' && JSON.stringify(last.marks ?? null) === JSON.stringify(u.marks ?? null)) last.text += u.ch;
    else runs.push(u.marks ? { type: 'text', text: u.ch, marks: u.marks } : { type: 'text', text: u.ch });
  }
  return runs;
}
function replaceInDoc<D extends AnyDoc>(doc: D, re: RegExp, label: string): D {
  const walk = (list: unknown[]): unknown[] =>
    (list as { type: string; content?: unknown[] }[]).map((b) => {
      if (!b) return b;
      if (b.type === 'paragraph' || b.type === 'heading') {
        const c = replaceInBlock(b.content as Inline[] | undefined, re, label);
        return c === b.content ? b : { ...b, content: c };
      }
      return Array.isArray(b.content) ? { ...b, content: walk(b.content) } : b;
    });
  return { ...doc, content: walk(doc.content) } as D;
}
function replaceInNote(n: Note, res: RegExp[], label: string): Note {
  const str = (s: string) => res.reduce((acc, re) => acc.replace(re, label), s);
  const doc = <D extends AnyDoc>(d: D) => res.reduce((acc, re) => replaceInDoc(acc, re, label), d);
  const next: Note = {
    ...n,
    title: str(n.title),
    tags: n.tags.map(str),
    body: doc(n.body),
    ...(n.table ? { table: { header: n.table.header.map(str), rows: n.table.rows.map((r) => r.map(str)) } } : {}),
    ...(n.fields
      ? { fields: n.fields.map((f) => (f.key === DATE_FIELD.key ? { ...f, value: str(f.value ?? ''), ...(str(f.value ?? '') !== (f.value ?? '') ? { full: false } : {}) } : { ...f, body: f.body ? doc(f.body) : f.body })) }
      : {}),
  };
  return JSON.stringify(next) === JSON.stringify(n) ? n : { ...next, updated: now() };
}

/**
 * "Replace with a label": every occurrence of the flagged value, in every note, becomes one label — so the same person
 * is the same [Person A] throughout the notebook. For a person match the bare name is replaced too (whole word).
 * The notebook stores only that one more value of the category was replaced, never the value.
 */
export function labelFlag(nb: Notebook | undefined, flag: Pick<Flag, 'category' | 'value' | 'name'>): { notebook: Notebook; label: string } {
  const b = nb0(nb);
  const label = nextLabel(b, flag.category);
  const res = [new RegExp(esc(flag.value), 'g')];
  if (flag.category === 'person' && flag.name && flag.name !== flag.value) res.push(new RegExp(`(?<![\\p{L}\\p{N}])${esc(flag.name)}(?![\\p{L}\\p{N}])`, 'gu'));
  const notes = b.notes.map((n) => replaceInNote(n, res, label));
  // SL27: a span keeps copies of its text (quote, prefix, suffix), and an annotation is text too: the label goes there as
  // well, so no copy of the value is left, then every span is placed again in the labelled text
  const str = (v: string) => res.reduce((acc, re) => acc.replace(re, label), v);
  let next: Notebook = {
    ...b,
    notes,
    ...(b.spans ? { spans: b.spans.map((x) => ({ ...x, quote: str(x.quote), prefix: str(x.prefix), suffix: str(x.suffix) })) } : {}),
    ...(b.annotations ? { annotations: b.annotations.map((a) => (a.text ? { ...a, text: str(a.text) } : a)) } : {}),
    replaced: { ...b.replaced, [flag.category]: (b.replaced[flag.category] ?? 0) + 1 },
  };
  for (const n of notes) next = reanchorNote(next, n.id);
  return { notebook: next, label };
}
/** "Label them all": each distinct flagged value in turn, in reading order. */
export function labelAll(nb: Notebook | undefined): Notebook {
  let b = nb0(nb);
  for (let guard = 0; guard < 500; guard++) {
    const f = notebookFlags(b)[0];
    if (!f) break;
    b = labelFlag(b, f).notebook;
  }
  return b;
}


// ───────────────────────── SL27: spans — anchoring, re-anchoring, targets
const CONTEXT = 32;
const sid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** The text a span's offsets count in: a field's textblocks, joined by line breaks (a hard break is one too). */
export function fieldText(n: Note | undefined, where: SpanWhere): string {
  if (!n) return '';
  if (where === 'body') return textblocks(n.body).map(blockText).join('\n');
  const f = n.fields?.find((x) => x.key === where);
  return f && f.key !== DATE_FIELD.key ? textblocks(f.body).map(blockText).join('\n') : '';
}

/** SL27: a span from an editor selection, taken from the editor's own text (it never lags a keystroke behind). */
export function spanFromSelection(note: string, where: SpanWhere, sel: { start: number; end: number; quote: string; prefix: string; suffix: string }, by?: Span['by']): Span {
  return { id: sid('span'), note, where, quote: sel.quote, prefix: sel.prefix, suffix: sel.suffix, start: sel.start, end: sel.end, ...(by ? { by } : {}) };
}
/** A new span over `start`–`end` of a field's text (not yet in any notebook). */
export function makeSpan(n: Note, where: SpanWhere, start: number, end: number, by?: Span['by']): Span {
  const text = fieldText(n, where);
  const a = Math.max(0, Math.min(start, end));
  const b = Math.min(text.length, Math.max(start, end));
  return { id: sid('span'), note: n.id, where, quote: text.slice(a, b), prefix: text.slice(Math.max(0, a - CONTEXT), a), suffix: text.slice(b, b + CONTEXT), start: a, end: b, ...(by ? { by } : {}) };
}

/**
 * Where a span's quote is in the text now: where it was, if it is still there; else the one occurrence of the quote,
 * or among several the one whose text before and after still matches. Null when the quote is gone or the choice is
 * not clear — the span is then orphaned, never re-pointed to a guess.
 */
export function locate(sp: Pick<Span, 'quote' | 'prefix' | 'suffix' | 'start' | 'end'>, text: string): { start: number; end: number } | null {
  if (!sp.quote) return null;
  if (text.slice(sp.start, sp.end) === sp.quote) return { start: sp.start, end: sp.end };
  const at: number[] = [];
  for (let i = text.indexOf(sp.quote); i >= 0; i = text.indexOf(sp.quote, i + 1)) at.push(i);
  if (!at.length) return null;
  if (at.length === 1) return { start: at[0], end: at[0] + sp.quote.length };
  const score = (i: number) => (sp.prefix && text.slice(Math.max(0, i - sp.prefix.length), i) === sp.prefix ? 1 : 0) + (sp.suffix && text.slice(i + sp.quote.length, i + sp.quote.length + sp.suffix.length) === sp.suffix ? 1 : 0);
  const best = Math.max(...at.map(score));
  const top = at.filter((i) => score(i) === best);
  if (!best || top.length > 1) return null;
  return { start: top[0], end: top[0] + sp.quote.length };
}

/** After a note's text changed: its spans follow their quotes, or become orphaned (and stay so). */
export function reanchorNote(nb: Notebook, noteId: string): Notebook {
  if (!nb.spans?.some((x) => x.note === noteId && !x.orphaned)) return nb;
  const n = nb.notes.find((x) => x.id === noteId);
  const texts = new Map<string, string>();
  const textOf = (w: string) => (texts.has(w) ? texts.get(w)! : (texts.set(w, fieldText(n, w)), texts.get(w)!));
  let changed = false;
  const spans = nb.spans.map((x) => {
    if (x.note !== noteId || x.orphaned) return x;
    const t = textOf(x.where);
    const loc = locate(x, t);
    if (!loc) {
      changed = true;
      return { ...x, orphaned: true };
    }
    const prefix = t.slice(Math.max(0, loc.start - CONTEXT), loc.start);
    const suffix = t.slice(loc.end, loc.end + CONTEXT);
    if (loc.start === x.start && loc.end === x.end && prefix === x.prefix && suffix === x.suffix) return x;
    changed = true;
    return { ...x, ...loc, prefix, suffix };
  });
  return changed ? { ...nb, spans } : nb;
}
/** The top-level block of a note's body a span starts in (for an imported note's page and heading). */
export function spanBlock(n: Note, x: Pick<Span, 'start'>): number {
  let off = 0;
  const blocks = n.body.content;
  for (let i = 0; i < blocks.length; i++) {
    const len = textblocks({ type: 'doc', content: [blocks[i]] } as NoteDoc).map(blockText).join('\n').length;
    if (x.start <= off + len) return i;
    off += len + 1;
  }
  return Math.max(0, blocks.length - 1);
}
/**
 * SL27 point 8: where a span sits, in words — an imported note's page and heading ("p. 2", "under Housing"), a
 * structured note's field ("What was discussed"), or nothing for a free note's body.
 */
export function spanAnchor(n: Note | undefined, x: Span): string {
  if (!n) return '';
  if (n.kind === 'imported') return anchorOf(n, spanBlock(n, x)).label;
  if (x.where !== 'body') return n.fields?.find((f) => f.key === x.where)?.label ?? '';
  return '';
}
/** A span is orphaned when its quote was lost, or its note was deleted. */
export function isOrphaned(nb: Notebook | undefined, x: Span): boolean {
  return !!x.orphaned || !nb?.notes.some((n) => n.id === x.note);
}
export function annotationOf(nb: Notebook | undefined, spanId: string): Annotation | undefined {
  return nb?.annotations?.find((a) => a.span === spanId);
}
const sameTarget = (a: Target, b: Target) => a.kind === b.kind && a.id === b.id;
/** The spans that support an item, in the notebook's order. */
export function spansFor(nb: Notebook | undefined, t: Target): Span[] {
  const ids = new Set((nb?.annotations ?? []).filter((a) => a.targets.some((x) => sameTarget(x, t))).map((a) => a.span));
  return (nb?.spans ?? []).filter((x) => ids.has(x.id));
}

/**
 * Add a span (or reuse the same selection if it is already one) with its annotation, and optionally a comment and a
 * target. Returns the notebook and the span's id.
 */
export function addPassage(nb: Notebook | undefined, sp: Span, opts: { text?: string; target?: Target } = {}): { notebook: Notebook; span: string } {
  const b = nb0(nb);
  const spans = b.spans ?? [];
  const same = spans.find((x) => !x.orphaned && x.note === sp.note && x.where === sp.where && x.start === sp.start && x.end === sp.end && x.quote === sp.quote);
  const id = same?.id ?? sp.id;
  const anns = b.annotations ?? [];
  const ann = anns.find((a) => a.span === id);
  const text = opts.text?.trim();
  const next: Annotation = ann
    ? { ...ann, ...(text ? { text } : {}), targets: opts.target && !ann.targets.some((x) => sameTarget(x, opts.target!)) ? [...ann.targets, opts.target] : ann.targets }
    : { id: sid('ann'), span: id, ...(text ? { text } : {}), targets: opts.target ? [opts.target] : [] };
  return {
    notebook: { ...b, spans: same ? spans : [...spans, sp], annotations: ann ? anns.map((a) => (a === ann ? next : a)) : [...anns, next] },
    span: id,
  };
}
export function setAnnotationText(nb: Notebook | undefined, spanId: string, text: string): Notebook {
  const b = nb0(nb);
  const t = text.trim();
  return { ...b, annotations: (b.annotations ?? []).map((a) => (a.span === spanId ? (t ? { ...a, text: t } : (({ text: _x, ...rest }) => rest)(a)) : a)) };
}
/** Take items off every span that supports them; with `dropSpans`, spans left supporting nothing (and no comment) go. */
export function removeTargets(nb: Notebook | undefined, ts: Target[], dropSpans = false): Notebook {
  const b = nb0(nb);
  if (!b.annotations?.length) return b;
  const touched = new Set<string>();
  const annotations = b.annotations.map((a) => {
    const kept = a.targets.filter((x) => !ts.some((t) => sameTarget(t, x)));
    if (kept.length === a.targets.length) return a;
    touched.add(a.span);
    return { ...a, targets: kept };
  });
  if (!dropSpans) return { ...b, annotations };
  const gone = new Set(annotations.filter((a) => touched.has(a.span) && !a.targets.length && !a.text).map((a) => a.span));
  return { ...b, spans: (b.spans ?? []).filter((x) => !gone.has(x.id)), annotations: annotations.filter((a) => !gone.has(a.span)) };
}
export function deleteSpans(nb: Notebook | undefined, ids: string[]): Notebook {
  const b = nb0(nb);
  const s = new Set(ids);
  return { ...b, spans: (b.spans ?? []).filter((x) => !s.has(x.id)), annotations: (b.annotations ?? []).filter((a) => !s.has(a.span)) };
}

// ───────────────────────── load and import
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
export function sanitizeNotebook(input: unknown): Notebook | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const notes: Note[] = (Array.isArray(raw.notes) ? (raw.notes as Record<string, unknown>[]) : [])
    .filter((n) => n && typeof n.id === 'string')
    .map((n) => {
      const kind = n.kind === 'structured' && Array.isArray(n.fields) ? 'structured' : n.kind === 'imported' && n.source && typeof n.source === 'object' ? 'imported' : 'free';
      const note: Note = {
        ...n,
        id: n.id as string,
        title: str(n.title, 'Untitled note'),
        kind,
        body: sanitizeNote(n.body),
        created: str(n.created, now()),
        updated: str(n.updated, now()),
        tags: Array.isArray(n.tags) ? parseTags((n.tags as unknown[]).filter((t): t is string => typeof t === 'string').join(',')) : [],
      };
      if (typeof n.template === 'string') note.template = n.template;
      else delete note.template;
      if (kind === 'structured')
        note.fields = (n.fields as Record<string, unknown>[])
          .filter((f) => f && typeof f.key === 'string')
          .map((f) => (f.key === DATE_FIELD.key ? { key: DATE_FIELD.key, label: str(f.label, DATE_FIELD.label), value: str(f.value), full: !!f.full } : { key: f.key as string, label: str(f.label, f.key as string), body: sanitizeRich(f.body) }));
      else delete note.fields;
      if (kind === 'imported') {
        const src = n.source as Record<string, unknown>;
        const reviews = ['none', 'labelled', 'reviewed', 'kept'];
        note.source = {
          filename: str(src.filename, 'Imported file'),
          type: (IMPORT_TYPES as readonly string[]).includes(src.type as string) ? (src.type as ImportType) : 'txt',
          size: Number.isFinite(src.size) ? Math.max(0, Math.round(src.size as number)) : 0,
          imported: str(src.imported, now()),
          ...(Number.isInteger(src.pages) && (src.pages as number) > 0 ? { pages: src.pages as number } : {}),
          ...(Number.isInteger(src.dropped) && (src.dropped as number) > 0 ? { dropped: src.dropped as number } : {}),
          review: reviews.includes(src.review as string) ? (src.review as NoteSource['review']) : 'none',
          ...(Number.isInteger(src.kept) && (src.kept as number) > 0 ? { kept: src.kept as number } : {}),
        };
        const anchors = (Array.isArray(n.anchors) ? (n.anchors as Record<string, unknown>[]) : []).filter((a) => a && Number.isInteger(a.block) && Number.isInteger(a.page) && (a.block as number) >= 0 && (a.page as number) > 0).map((a) => ({ block: a.block as number, page: a.page as number }));
        if (anchors.length) note.anchors = anchors;
        else delete note.anchors;
        const t = n.table as { header?: unknown; rows?: unknown } | undefined;
        const cells = (r: unknown) => (Array.isArray(r) ? r.map((c) => (typeof c === 'string' ? c : c == null ? '' : String(c))) : []);
        if (t && Array.isArray(t.header) && Array.isArray(t.rows)) note.table = { header: cells(t.header), rows: (t.rows as unknown[]).map(cells) };
        else delete note.table;
      } else {
        delete note.source;
        delete note.anchors;
        delete note.table;
      }
      return note;
    });
  const replaced: Notebook['replaced'] = {};
  const r = (raw.replaced ?? {}) as Record<string, unknown>;
  for (const c of IDENTIFIER_CATEGORIES) if (Number.isInteger(r[c]) && (r[c] as number) > 0) replaced[c] = r[c] as number;
  // SL27: spans and annotations, kept only in their own shapes
  const sstr = (v: unknown) => (typeof v === 'string' ? v : '');
  const int = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  const spans: Span[] = (Array.isArray(raw.spans) ? (raw.spans as Record<string, unknown>[]) : [])
    .filter((x) => x && typeof x.id === 'string' && typeof x.note === 'string' && typeof x.quote === 'string' && x.quote)
    .map((x) => {
      const by = x.by as Record<string, unknown> | undefined;
      const sp: Span = { id: x.id as string, note: x.note as string, where: typeof x.where === 'string' && x.where ? x.where : 'body', quote: x.quote as string, prefix: sstr(x.prefix), suffix: sstr(x.suffix), start: int(x.start), end: Math.max(int(x.start), int(x.end)) };
      if (x.orphaned === true) sp.orphaned = true;
      if (by && typeof by.extractor === 'string' && typeof by.label === 'string')
        sp.by = { extractor: by.extractor, label: by.label, ...(by.inferred === true ? { inferred: true } : {}), ...(['high', 'medium', 'low'].includes(by.confidence as string) ? { confidence: by.confidence as 'high' | 'medium' | 'low' } : {}) };
      return sp;
    });
  const spanIds = new Set(spans.map((x) => x.id));
  const annotations: Annotation[] = (Array.isArray(raw.annotations) ? (raw.annotations as Record<string, unknown>[]) : [])
    .filter((a) => a && typeof a.id === 'string' && typeof a.span === 'string' && spanIds.has(a.span))
    .map((a) => ({
      id: a.id as string,
      span: a.span as string,
      ...(typeof a.text === 'string' && a.text.trim() ? { text: a.text } : {}),
      targets: (Array.isArray(a.targets) ? (a.targets as Record<string, unknown>[]) : []).filter((t) => t && typeof t.kind === 'string' && typeof t.id === 'string').map((t) => ({ kind: t.kind as TargetKind, id: t.id as string })),
    }));
  return {
    ...raw,
    notes,
    ...(spans.length ? { spans } : { spans: undefined }),
    ...(annotations.length ? { annotations } : { annotations: undefined }),
    dismissed: Array.isArray(raw.dismissed) ? (raw.dismissed as unknown[]).filter((d): d is string => typeof d === 'string') : [],
    replaced,
  };
}
