/**
 * Restricted rich text (UI-15, planner.yaml → rich_text): a Tiptap/ProseMirror JSON document that may hold only
 * paragraphs, text and hard breaks, with the marks bold · italic · underline · textStyle(color, fontSize).
 * It is never stored or rendered as HTML. `sanitizeRich` runs on every load and import.
 */
export interface RichMark {
  type: 'bold' | 'italic' | 'underline' | 'textStyle';
  attrs?: { color?: string | null; fontSize?: string | null };
}
export interface RichText {
  type: 'text';
  text: string;
  marks?: RichMark[];
}
export interface RichBreak {
  type: 'hardBreak';
}
export interface RichPara {
  type: 'paragraph';
  content?: (RichText | RichBreak)[];
}
export interface RichDoc {
  type: 'doc';
  content: RichPara[];
}

export const FONT_SIZES = { S: '12px', M: '15px', L: '19px', XL: '24px' } as const;
const SIZE_VALUES = new Set<string>(Object.values(FONT_SIZES));
const COLOR_RE = /^#[0-9a-f]{6}$/i;

export function emptyDoc(): RichDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function docFromText(text: string): RichDoc {
  const lines = text.split('\n');
  return { type: 'doc', content: lines.map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) };
}

export function plainText(doc: RichDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content
    .map((p) => (p.content ?? []).map((n) => (n.type === 'text' ? n.text : '\n')).join(''))
    .join('\n')
    .trim();
}

export function isEmpty(doc: RichDoc | null | undefined): boolean {
  return plainText(doc) === '';
}

function cleanMarks(marks: unknown): RichMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: RichMark[] = [];
  for (const m of marks) {
    if (!m || typeof m !== 'object') continue;
    const t = (m as { type?: unknown }).type;
    if (t === 'bold' || t === 'italic' || t === 'underline') out.push({ type: t });
    else if (t === 'textStyle') {
      const a = ((m as { attrs?: Record<string, unknown> }).attrs ?? {}) as Record<string, unknown>;
      const color = typeof a.color === 'string' && COLOR_RE.test(a.color) ? a.color : null;
      const fontSize = typeof a.fontSize === 'string' && SIZE_VALUES.has(a.fontSize) ? a.fontSize : null;
      if (color || fontSize) out.push({ type: 'textStyle', attrs: { color, fontSize } });
    }
  }
  return out.length ? out : undefined;
}

/** Keep only the allowed structure; anything else (HTML strings, other nodes, unknown marks) is dropped or flattened. */
export function sanitizeRich(input: unknown): RichDoc {
  if (typeof input === 'string') return docFromText(input);
  if (!input || typeof input !== 'object' || (input as { type?: unknown }).type !== 'doc') return emptyDoc();
  const paras: RichPara[] = [];
  const visit = (node: unknown, into: (RichText | RichBreak)[]) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: unknown; text?: unknown; marks?: unknown; content?: unknown };
    if (n.type === 'text' && typeof n.text === 'string') {
      const marks = cleanMarks(n.marks);
      into.push(marks ? { type: 'text', text: n.text, marks } : { type: 'text', text: n.text });
    } else if (n.type === 'hardBreak') into.push({ type: 'hardBreak' });
    else if (Array.isArray(n.content)) n.content.forEach((c) => visit(c, into));
  };
  for (const block of ((input as { content?: unknown }).content as unknown[]) ?? []) {
    const content: (RichText | RichBreak)[] = [];
    visit(block, content);
    paras.push(content.length ? { type: 'paragraph', content } : { type: 'paragraph' });
  }
  return { type: 'doc', content: paras.length ? paras : [{ type: 'paragraph' }] };
}

/** Whole-label style for the canvas: a mark counts when it covers all of the text (Cytoscape labels are one run). */
export function dominantStyle(doc: RichDoc | null | undefined) {
  const runs = (doc?.content ?? []).flatMap((p) => (p.content ?? []).filter((n): n is RichText => n.type === 'text' && n.text.trim() !== ''));
  if (!runs.length) return {};
  const all = (f: (m: RichMark[]) => boolean) => runs.every((r) => f(r.marks ?? []));
  const first = runs[0].marks?.find((m) => m.type === 'textStyle')?.attrs ?? {};
  return {
    bold: all((m) => m.some((x) => x.type === 'bold')),
    italic: all((m) => m.some((x) => x.type === 'italic')),
    underline: all((m) => m.some((x) => x.type === 'underline')),
    color: all((m) => m.some((x) => x.type === 'textStyle' && x.attrs?.color === first.color)) ? first.color ?? undefined : undefined,
    fontSize: all((m) => m.some((x) => x.type === 'textStyle' && x.attrs?.fontSize === first.fontSize)) ? first.fontSize ?? undefined : undefined,
  };
}
