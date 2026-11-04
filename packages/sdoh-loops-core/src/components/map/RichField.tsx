import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { EditorState } from '@tiptap/pm/state';
import { FONT_SIZES, sanitizeRich, type RichDoc } from '../../lib/model/rich';
import { sanitizeNote, type NoteDoc } from '../../lib/model/notebook';
import { USER_COLOURS } from '../../lib/palette';
import { IdentifierFlags, flagsKey, type FlagsOptions } from '../notebook/flagsExtension';

/** font-size as a textStyle attribute (UI-15: S / M / L / XL), restricted to the allowed sizes. */
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
          },
        },
      },
    ];
  },
});

/** SL26: the notebook's identifier underlines; `version` changes when the dismissed list does, to redraw them */
export type RichFieldFlags = Omit<FlagsOptions, 'tip'> & { tip: string; version: string };

/**
 * UI-15 rich text: Tiptap with only bold, italic, underline, text style, colour and font size. The value in and out
 * is the restricted JSON document (never HTML). ⌘B / ⌘I / ⌘U work while editing.
 * SL26: `blocks` adds headings (2, 3) and bullet and numbered lists, for the notebook's free notes (a NoteDoc), and
 * `flags` underlines possible identifiers as the user types.
 */
export default function RichField<D extends RichDoc | NoteDoc = RichDoc>({ id, value, onChange, label, describedBy, singleLine, minRows = 2, blocks, flags, testId }: { id: string; value: D; onChange: (d: D) => void; label: string; describedBy?: string; singleLine?: boolean; minRows?: number; blocks?: boolean; flags?: RichFieldFlags; testId?: string }) {
  const last = useRef<string>(JSON.stringify(value));
  const fl = useRef(flags);
  fl.current = flags;
  const clean = (d: unknown) => (blocks ? sanitizeNote(d) : sanitizeRich(d)) as D;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: blocks ? { levels: [2, 3] } : false, blockquote: false, ...(blocks ? {} : { bulletList: false, orderedList: false, listItem: false }), codeBlock: false, code: false, horizontalRule: false, strike: false }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      ...(flags ? [IdentifierFlags.configure({ isDismissed: (c, v) => !!fl.current?.isDismissed(c, v), tip: flags.tip, onFlag: () => fl.current?.onFlag?.() })] : []),
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': singleLine ? 'false' : 'true',
        'aria-label': label,
        ...(testId ? { 'data-testid': testId } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: `bx-input ax-rt min-h-[2.5rem] focus:outline-none ${blocks ? 'nb-doc' : ''}`,
        style: `min-height: ${singleLine ? 2.4 : 1.6 * minRows + 0.8}rem`,
      },
      handleKeyDown: (_v, e) => {
        if (singleLine && e.key === 'Enter') return true;
        e.stopPropagation();
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const doc = clean(editor.getJSON());
      const s = JSON.stringify(doc);
      if (s !== last.current) {
        last.current = s;
        onChange(doc);
      }
    },
  });
  useEffect(() => {
    if (!editor) return;
    const s = JSON.stringify(value);
    if (s !== last.current) {
      last.current = s;
      editor.commands.setContent(value, false);
      // SL26: a change from outside (Undo, a label replacing a value) starts the editor's own history afresh, so ⌘Z
      // inside the field can never bring a replaced value back
      if (flags) editor.view.updateState(EditorState.create({ doc: editor.state.doc, plugins: editor.state.plugins, selection: editor.state.selection }));
    }
  }, [value, editor]); // eslint-disable-line react-hooks/exhaustive-deps
  // the dismissed list changed: redraw the underlines
  useEffect(() => {
    if (editor && flags) editor.view.dispatch(editor.state.tr.setMeta(flagsKey, true));
  }, [editor, flags?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  // a click on a style button keeps the caret in the text (Tiptap's focus() lands a frame later, after the next key)
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  return (
    <div>
      {editor && (
        <div className="mb-1 flex flex-wrap items-center gap-1" role="toolbar" aria-label={`${label}: text style`}>
          <button type="button" onMouseDown={keepFocus} className={`bx-btn px-2 py-0.5 ${editor.isActive('bold') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
            <b>B</b>
          </button>
          <button type="button" onMouseDown={keepFocus} className={`bx-btn px-2 py-0.5 ${editor.isActive('italic') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
            <i>I</i>
          </button>
          <button type="button" onMouseDown={keepFocus} className={`bx-btn px-2 py-0.5 ${editor.isActive('underline') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
            <u>U</u>
          </button>
          {blocks && (
            <>
              <button type="button" onMouseDown={keepFocus} className={`bx-btn px-2 py-0.5 ${editor.isActive('heading', { level: 2 }) ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading">
                H2
              </button>
              <button type="button" onMouseDown={keepFocus} className={`bx-btn px-2 py-0.5 ${editor.isActive('heading', { level: 3 }) ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="Subheading">
                H3
              </button>
              <button type="button" onMouseDown={keepFocus} className={`bx-btn px-2 py-0.5 ${editor.isActive('bulletList') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bulleted list">
                •
              </button>
              <button type="button" onMouseDown={keepFocus} className={`bx-btn px-2 py-0.5 ${editor.isActive('orderedList') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">
                1.
              </button>
            </>
          )}
          <select
            className="bx-input w-auto py-0.5"
            aria-label="Text size"
            value={(Object.entries(FONT_SIZES).find(([, v]) => editor.isActive('textStyle', { fontSize: v }))?.[0]) ?? ''}
            onChange={(e) => {
              const v = FONT_SIZES[e.target.value as keyof typeof FONT_SIZES];
              editor.chain().focus().setMark('textStyle', { fontSize: v ?? null }).run();
            }}
          >
            <option value="">Size</option>
            {Object.keys(FONT_SIZES).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <select className="bx-input w-auto py-0.5" aria-label="Text colour" value="" onChange={(e) => (e.target.value === 'none' ? editor.chain().focus().unsetColor().run() : editor.chain().focus().setColor(e.target.value).run())}>
            <option value="">Colour</option>
            <option value="none">Default</option>
            {USER_COLOURS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input type="color" aria-label="Custom text colour" className="h-7 w-8 cursor-pointer rounded border border-[color:var(--bx-line)]" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
