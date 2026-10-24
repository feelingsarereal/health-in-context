import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { FONT_SIZES, sanitizeRich, type RichDoc } from '@/lib/model/rich';
import { USER_COLOURS } from '@/lib/palette';

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

/**
 * UI-15 rich text: Tiptap with only bold, italic, underline, text style, colour and font size. The value in and out
 * is the restricted JSON document (never HTML). ⌘B / ⌘I / ⌘U work while editing.
 */
export default function RichField({ id, value, onChange, label, describedBy, singleLine, minRows = 2 }: { id: string; value: RichDoc; onChange: (d: RichDoc) => void; label: string; describedBy?: string; singleLine?: boolean; minRows?: number }) {
  const last = useRef<string>(JSON.stringify(value));
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, bulletList: false, orderedList: false, listItem: false, codeBlock: false, code: false, horizontalRule: false, strike: false }),
      Underline,
      TextStyle,
      Color,
      FontSize,
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': singleLine ? 'false' : 'true',
        'aria-label': label,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: 'bx-input ax-rt min-h-[2.5rem] focus:outline-none',
        style: `min-height: ${singleLine ? 2.4 : 1.6 * minRows + 0.8}rem`,
      },
      handleKeyDown: (_v, e) => {
        if (singleLine && e.key === 'Enter') return true;
        e.stopPropagation();
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const doc = sanitizeRich(editor.getJSON());
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
    }
  }, [value, editor]);
  return (
    <div>
      {editor && (
        <div className="mb-1 flex flex-wrap items-center gap-1" role="toolbar" aria-label={`${label}: text style`}>
          <button type="button" className={`bx-btn px-2 py-0.5 ${editor.isActive('bold') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
            <b>B</b>
          </button>
          <button type="button" className={`bx-btn px-2 py-0.5 ${editor.isActive('italic') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
            <i>I</i>
          </button>
          <button type="button" className={`bx-btn px-2 py-0.5 ${editor.isActive('underline') ? 'bx-btn-on' : ''}`} aria-pressed={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
            <u>U</u>
          </button>
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
