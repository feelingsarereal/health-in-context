import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export const pageMarksKey = new PluginKey<DecorationSet>('sdohPageMarks');

/**
 * SL29: an imported PDF's page starts, drawn before the block each page starts at ("p. 2") — widgets only, so the
 * imported text itself is never changed. `pages` maps a top-level block index to its page number.
 */
export const PageMarks = Extension.create<{ pages: { block: number; page: number }[] }>({
  name: 'sdohPageMarks',
  addOptions() {
    return { pages: [] };
  },
  addProseMirrorPlugins() {
    const pages = this.options.pages;
    const build = (doc: PMNode) => {
      const at = new Map(pages.map((p) => [p.block, p.page]));
      const decos: Decoration[] = [];
      doc.forEach((_node, offset, index) => {
        const page = at.get(index);
        if (page === undefined) return;
        decos.push(
          Decoration.widget(offset, () => {
            const el = document.createElement('span');
            el.className = 'nb-page';
            el.setAttribute('data-page', String(page));
            el.setAttribute('contenteditable', 'false');
            el.textContent = `p. ${page}`;
            return el;
          }, { side: -1, key: `p${page}` }),
        );
      });
      return DecorationSet.create(doc, decos);
    };
    return [
      new Plugin<DecorationSet>({
        key: pageMarksKey,
        state: { init: (_, { doc }) => build(doc), apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old) },
        props: { decorations: (state) => pageMarksKey.getState(state) },
      }),
    ];
  },
});
