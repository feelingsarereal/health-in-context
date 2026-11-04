/** SL17: a box's text, kept out of Canvas.tsx so the peek and the package entry do not pull the lazy canvas chunk in. */
import { codeMap, colourGroup } from '../../lib/data/scheme';
import { GROUP_STYLE } from '../../lib/palette';
import { plainText } from '../../lib/model/rich';
import { nodeName } from '../../lib/model/interchange';
import type { MapNode, NodeText } from '../../lib/model/map';
import { S } from '../../lib/data/core';
import { C } from '../../lib/copy';

const titleOf = (c: string) => codeMap.get(c)?.title;
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** SL17: a box's text in order of weight — the code line (small, above), the title (bold, larger), the circumstance (smallest, muted) */
export interface NodeTextParts {
  head: string | null;
  title: string;
  sub: string | null;
}

/**
 * SL17: what a box shows under the map's Node text setting. The title is the label, or the code's title when the label
 * is empty (nodeName's fallbacks after that). 'title' shows it alone; 'title-code' (the default) adds the code line
 * above; 'full' adds the circumstance text below. A canvas note is its text, in every mode.
 */
export function nodeTextParts(n: MapNode, mode: NodeText = 'title-code'): NodeTextParts {
  if (n.kind === 'note') return { head: null, title: trunc(plainText(n.notes) || C.node.note, 140), sub: null };
  const g = n.code ? GROUP_STYLE[colourGroup(n.code) ?? ''] : undefined;
  const head =
    n.code_status === 'sdoh' && n.code ? `${g?.glyph ?? ''} ${n.code}`.trim() : n.code_status === 'undetermined' ? `? ${S.codes.status.undetermined}` : `${S.codes.status.other.split(' ')[0]}${n.type ? ` · ${n.type}` : ''}`;
  const named = !!plainText(n.label) || !!(n.code && titleOf(n.code));
  const circ = plainText(n.circumstance);
  return {
    head: mode === 'title' ? null : head,
    title: trunc(nodeName(n, titleOf), 42),
    // a title that fell back to the circumstance text is not repeated below it
    sub: mode === 'full' && named && circ ? trunc(circ, 90) : null,
  };
}

/**
 * SL30 point 5: the code line of the selection card (Read) and the peek — the box's code line, and for a coded
 * circumstance WHO's title for the code from the pinned pack after it: "⚡ QE8Z · Harmful or traumatic events,
 * unspecified". "Other" and "Not sure yet" show their type as the box does; a canvas note has none.
 */
export function codeLine(n: MapNode): string | null {
  const head = nodeTextParts(n, 'title-code').head;
  if (!head) return null;
  const t = n.code_status === 'sdoh' && n.code ? titleOf(n.code) : undefined;
  return t ? `${head} · ${t}` : head;
}

/** The flat text of a box (head, title, circumstance on their own lines): drawn by the canvas only in PNG and SVG exports. */
export function nodeLines(n: MapNode, mode: NodeText = 'title-code'): string {
  const p = nodeTextParts(n, mode);
  return [p.head, p.title, p.sub].filter(Boolean).join('\n');
}

