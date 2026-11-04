import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { findIdentifiers } from '../../lib/model/identifiers';

export const flagsKey = new PluginKey<DecorationSet>('sdohIdentifierFlags');

export interface FlagsOptions {
  /** true for a value the user marked "Not an identifier" in this notebook */
  isDismissed: (category: string, value: string) => boolean;
  /** the underline's tooltip */
  tip: string;
  /** a click on an underlined value */
  onFlag?: () => void;
}

function build(doc: PMNode, o: FlagsOptions): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // the block's text, with each character's document position (a hard break counts as one newline)
    let text = '';
    const at: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) at.push(pos + 1 + offset + i);
        text += child.text;
      } else {
        at.push(pos + 1 + offset);
        text += '\n';
      }
    });
    for (const m of findIdentifiers(text)) {
      if (o.isDismissed(m.category, m.value)) continue;
      decos.push(Decoration.inline(at[m.start], at[m.end - 1] + 1, { class: 'nb-flag', 'data-flag': m.category, title: o.tip }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/**
 * SL26: underline possible identifiers as the user types. Decorations only: the document is never changed here, and
 * typing is never blocked. Dispatch a transaction with `flagsKey` meta to rebuild after the dismissed list changes.
 */
export const IdentifierFlags = Extension.create<FlagsOptions>({
  name: 'sdohIdentifierFlags',
  addOptions() {
    return { isDismissed: () => false, tip: 'Possible identifier' };
  },
  addProseMirrorPlugins() {
    const o = this.options;
    return [
      new Plugin<DecorationSet>({
        key: flagsKey,
        state: {
          init: (_, { doc }) => build(doc, o),
          apply: (tr, old) => (tr.docChanged || tr.getMeta(flagsKey) ? build(tr.doc, o) : old),
        },
        props: {
          decorations: (state) => flagsKey.getState(state),
          handleClick: (_view, _pos, e) => {
            if ((e.target as Element | null)?.closest?.('[data-flag]')) o.onFlag?.();
            return false;
          },
        },
      }),
    ];
  },
});
