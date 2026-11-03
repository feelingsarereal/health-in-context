import type { CSSProperties } from 'react';
import type { RichDoc, RichText } from '../../lib/model/rich';

/** Renders the restricted rich-text JSON with the same marks; never via HTML strings. */
export function RichView({ doc, className, clamp }: { doc: RichDoc | null | undefined; className?: string; clamp?: number }) {
  if (!doc?.content?.length) return null;
  let chars = 0;
  const out = doc.content.map((p, i) => {
    if (clamp && chars >= clamp) return null;
    return (
      <p key={i} className="my-0.5">
        {(p.content ?? []).map((n, j) => {
          if (n.type === 'hardBreak') return <br key={j} />;
          let text = (n as RichText).text;
          if (clamp) {
            if (chars >= clamp) return null;
            if (chars + text.length > clamp) text = text.slice(0, clamp - chars) + '…';
            chars += text.length;
          }
          const st: CSSProperties = {};
          for (const m of n.marks ?? []) {
            if (m.type === 'bold') st.fontWeight = 700;
            if (m.type === 'italic') st.fontStyle = 'italic';
            if (m.type === 'underline') st.textDecoration = 'underline';
            if (m.type === 'textStyle') {
              if (m.attrs?.color) st.color = m.attrs.color;
              if (m.attrs?.fontSize) st.fontSize = m.attrs.fontSize;
            }
          }
          return (
            <span key={j} style={st}>
              {text}
            </span>
          );
        })}
      </p>
    );
  });
  return <div className={className}>{out}</div>;
}
