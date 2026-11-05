import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export const spanMarksKey = new PluginKey<DecorationSet>('sdohSpanMarks');

/** SL27: a span drawn in a field — offsets into the field's text (textblocks joined by line breaks) */
export interface SpanDeco {
  id: string;
  start: number;
  end: number;
  /** sx-span (made by the user, backing something), sx-span-inferred / sx-span-low (accepted as inferred), sx-span-plain (backs nothing) */
  cls: string;
  pressed: boolean;
  /** what it supports, for the tooltip */
  title: string;
  /** SL28: an @ mention — drawn as a chip with this text at `start` (start = end) */
  chip?: string;
  /** SL28 trace view: not connected to the current span or selection */
  dim?: boolean;
}
export interface TextSelection {
  start: number;
  end: number;
  quote: string;
  /** the text just before and after, from the editor itself (the stored note can be a keystroke behind) */
  prefix: string;
  suffix: string;
  /** where to draw the action bar, in viewport coordinates */
  rect: { left: number; top: number; bottom: number };
}
export interface SpanMarksOptions {
  spans: () => SpanDeco[];
  onClick: (ids: string[], rect: DOMRect) => void;
  onSelect: (sel: TextSelection | null) => void;
  /** SL28: "@" typed at this offset (the @ is not inserted; `literal` inserts it after all) */
  onMention?: (at: number, literal: () => void) => void;
  /** SL28: the caret (a collapsed selection in the focused editor) is at this offset; null when it left */
  onCaret?: (at: number | null) => void;
}

/**
 * The document position of every character of the field's text, in order (a separator between blocks maps to the end
 * of the block before it), so offsets and positions convert both ways.
 */
export function charPositions(doc: PMNode): number[] {
  const at: number[] = [];
  let first = true;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!first) at.push(pos - 1);
    first = false;
    node.forEach((child, offset) => {
      if (child.isText) for (let i = 0; i < child.text!.length; i++) at.push(pos + 1 + offset + i);
      else at.push(pos + 1 + offset);
    });
    return false;
  });
  return at;
}
/** The field's text as the span offsets count it, from the editor's document (matches notebook.ts fieldText). */
export function docText(doc: PMNode): string {
  const blocks: string[] = [];
  doc.descendants((node) => {
    if (!node.isTextblock) return true;
    let t = '';
    node.forEach((child) => (t += child.isText ? child.text! : '\n'));
    blocks.push(t);
    return false;
  });
  return blocks.join('\n');
}
const offsetAt = (at: number[], pos: number) => {
  let lo = 0;
  let hi = at.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at[mid] < pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

function build(doc: PMNode, spans: SpanDeco[]): DecorationSet {
  const at = charPositions(doc);
  const decos: Decoration[] = [];
  // longer spans first, so an inner span is drawn inside an outer one (its line raised to show both)
  const sorted = [...spans].sort((a, b) => b.end - b.start - (a.end - a.start));
  for (const s of sorted) {
    if (s.chip !== undefined) {
      // a mention: a chip between two characters (after the last one at the very end)
      if (s.start > at.length) continue;
      const pos = s.start < at.length ? at[s.start] : at.length ? at[at.length - 1] + 1 : 1;
      const label = s.chip;
      decos.push(
        Decoration.widget(
          pos,
          () => {
            const el = document.createElement('span');
            el.className = `sx-chip${s.pressed ? ' sx-chip-on' : ''}${s.dim ? ' sx-dim' : ''}`;
            el.contentEditable = 'false';
            el.textContent = label;
            el.title = s.title;
            el.dataset.span = s.id;
            el.dataset.chip = 'true';
            el.dataset.pressed = s.pressed ? 'true' : 'false';
            return el;
          },
          { side: -1, key: `chip-${s.id}-${label}-${s.pressed ? 1 : 0}-${s.dim ? 1 : 0}`, ignoreSelection: true },
        ),
      );
      continue;
    }
    if (s.start >= s.end || s.end > at.length) continue;
    // an outer span (one with another inside it) draws its line lower, so both lines show
    const outer = sorted.some((o) => o !== s && o.start >= s.start && o.end <= s.end && o.end - o.start < s.end - s.start);
    const from = at[s.start];
    const to = at[s.end - 1] + 1;
    decos.push(Decoration.inline(from, to, { class: `${s.cls}${outer ? ' sx-nest' : ''}${s.dim ? ' sx-dim' : ''}`, 'data-span': s.id, 'data-pressed': s.pressed ? 'true' : 'false', title: s.title }));
    if (s.cls === 'sx-span-inferred' || s.cls === 'sx-span-low') decos.push(Decoration.widget(to, () => Object.assign(document.createElement('span'), { className: 'sx-approx', textContent: '≈', ariaHidden: 'true' }), { side: -1, key: `approx-${s.id}` }));
  }
  return DecorationSet.create(doc, decos);
}

/** The DOM selection inside the editor as field offsets (works in a read-only editor too), or null. */
function readSelection(view: EditorView): TextSelection | null {
  const ds = view.dom.ownerDocument.getSelection();
  if (!ds || ds.isCollapsed || !ds.rangeCount) return null;
  const r = ds.getRangeAt(0);
  if (!view.dom.contains(r.startContainer) || !view.dom.contains(r.endContainer)) return null;
  let from: number;
  let to: number;
  try {
    from = view.posAtDOM(r.startContainer, r.startOffset);
    to = view.posAtDOM(r.endContainer, r.endOffset);
  } catch {
    return null;
  }
  if (from > to) [from, to] = [to, from];
  const at = charPositions(view.state.doc);
  const full = docText(view.state.doc);
  let start = offsetAt(at, from);
  let end = Math.max(start, offsetAt(at, to));
  // trim surrounding whitespace off the selection
  while (start < end && /\s/.test(full[start])) start++;
  while (end > start && /\s/.test(full[end - 1])) end--;
  const quote = full.slice(start, end);
  if (!quote) return null;
  const b = r.getBoundingClientRect();
  return { start, end, quote, prefix: full.slice(Math.max(0, start - 32), start), suffix: full.slice(end, end + 32), rect: { left: b.left, top: b.top, bottom: b.bottom } };
}

/**
 * SL27: spans as highlights in a note's editor, a click on one reporting every span under the pointer (overlaps open a
 * chooser), and the text selection reported as field offsets for the action bar. Decorations only: the text is never
 * changed here. Dispatch a transaction with `spanMarksKey` meta to redraw after the spans or the map selection change.
 */
export const SpanMarks = Extension.create<SpanMarksOptions>({
  name: 'sdohSpanMarks',
  addOptions() {
    return { spans: () => [], onClick: () => undefined, onSelect: () => undefined };
  },
  addProseMirrorPlugins() {
    const o = this.options;
    const spanClick = (view: EditorView, pos: number, e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-span]');
      if (!el) return false;
      if ((el as HTMLElement).dataset.chip) {
        o.onClick([(el as HTMLElement).dataset.span!], el.getBoundingClientRect());
        return true;
      }
      const off = offsetAt(charPositions(view.state.doc), pos);
      const ids = o.spans().filter((s) => s.start <= off && s.end >= off).map((s) => s.id);
      if (ids.length) o.onClick(ids, el.getBoundingClientRect());
      return false;
    };
    return [
      new Plugin<DecorationSet>({
        key: spanMarksKey,
        state: {
          init: (_, { doc }) => build(doc, o.spans()),
          apply: (tr, old) => (tr.docChanged || tr.getMeta(spanMarksKey) ? build(tr.doc, o.spans()) : old),
        },
        props: {
          decorations: (state) => spanMarksKey.getState(state),
          handleClick: (view, pos, e) => spanClick(view, pos, e),
          // a second click soon after the first counts as a double click in ProseMirror: it shows the item too (and
          // still selects the word, as a double click does)
          handleDoubleClick: (view, pos, e) => spanClick(view, pos, e),
          // SL28: "@" at the start of a word opens the mention picker where it was typed (inside a word, as in an email
          // address, it is just an @)
          handleTextInput: (view, from, to, text) => {
            if (text !== '@' || !o.onMention || !view.editable) return false;
            const $from = view.state.doc.resolve(from);
            const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, undefined, ' ');
            if (before && !/[\s([{“"'‘—–-]/.test(before)) return false;
            const off = offsetAt(charPositions(view.state.doc), from);
            o.onMention(off, () => {
              const tr = view.state.tr.insertText('@', Math.min(from, view.state.doc.content.size), Math.min(to, view.state.doc.content.size));
              view.dispatch(tr);
              view.focus();
            });
            return true;
          },
        },
        view: (view) => {
          const doc = view.dom.ownerDocument;
          let t = 0;
          let caret: number | null = null;
          const on = () => {
            clearTimeout(t);
            t = window.setTimeout(() => {
              o.onSelect(readSelection(view));
              if (!o.onCaret) return;
              const ds = doc.getSelection();
              const inside = !!ds && ds.isCollapsed && ds.rangeCount > 0 && view.dom.contains(ds.anchorNode) && view.hasFocus();
              const next = inside ? offsetAt(charPositions(view.state.doc), view.state.selection.from) : null;
              if (next !== caret) {
                caret = next;
                o.onCaret(next);
              }
            }, 60);
          };
          // the selection-action keys read the selection now, not after the debounce, so the action gets every
          // character the user selected (capture: before the editor's own key handling)
          const flush = (e: KeyboardEvent) => {
            if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.key === 'F10' && e.shiftKey)) {
              clearTimeout(t);
              o.onSelect(readSelection(view));
            }
          };
          doc.addEventListener('selectionchange', on);
          view.dom.addEventListener('keydown', flush, true);
          return {
            destroy: () => {
              clearTimeout(t);
              doc.removeEventListener('selectionchange', on);
              view.dom.removeEventListener('keydown', flush, true);
            },
          };
        },
      }),
    ];
  },
});
