import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Popover } from './Popover';
import { RefCard } from '@/components/evidence/RefCard';

/** Markdown for the 101s and glossary definitions; [n] becomes a citation popover, maths renders with KaTeX. */
export default function Md({ text, className }: { text: string; className?: string }) {
  const src = text.replace(/\[(\d+)\](?!\()/g, '[[$1]](#cite-$1)');
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a({ href, children }) {
            const m = /^#cite-(\d+)$/.exec(href ?? '');
            if (m) {
              return (
                <Popover className="bx-cite px-0.5" label={`Reference ${m[1]}`} trigger={<>[{m[1]}]</>}>
                  <RefCard n={+m[1]} />
                </Popover>
              );
            }
            return (
              <a href={href} className="underline" target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
}
