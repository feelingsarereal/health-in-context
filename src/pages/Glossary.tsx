import { Link } from 'react-router-dom';
import { glossary, termMap, conceptMap, PageHead, CitedInNotebook } from '@feelingsarereal/sdoh-loops-core';
import NotebookCites from '@/components/NotebookCites';
import Md from '@/components/ui/Md';

export default function Glossary() {
  const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <NotebookCites>
    <div>
      <PageHead title="Glossary" lead="The terms the app and its primers use." />
      <dl className="space-y-4">
        {sorted.map((t) => (
          <div key={t.id} id={t.id} className="bx-card p-4 scroll-mt-20">
            <dt className="text-lg font-semibold font-display">{t.term}</dt>
            <dd>
              <p className="mt-1">{t.short}</p>
              <Md text={t.definition} className="bx-101 mt-1 text-[15px] leading-7" />
              <p className="mt-1 text-sm bx-muted">
                {t.concept && conceptMap.get(t.concept) && (
                  <>Primer: <Link className="underline" to={`/concepts/${t.concept}`}>{conceptMap.get(t.concept)!.title}</Link>. </>
                )}
                {t.see && t.see.length > 0 && (
                  <>See also: {t.see.map((s, i) => <span key={s}>{i > 0 && ', '}<a className="underline" href={`#${s}`}>{termMap.get(s)?.term ?? s}</a></span>)}.</>
                )}
              </p>
              <CitedInNotebook t={{ kind: 'glossary', id: t.id }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
    </NotebookCites>
  );
}
