import { Link, useParams } from 'react-router-dom';
import { conceptMap, termMap, Popover } from '@feelingsarereal/sdoh-loops-core';
import Md from '@/components/ui/Md';
import NotFound from './NotFound';

export default function Concept() {
  const { id } = useParams();
  const c = conceptMap.get(id ?? '');
  if (!c) return <NotFound />;
  return (
    <article>
      <p className="text-sm bx-muted"><Link to="/concepts" className="underline">Primers</Link></p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-semibold">{c.title}</h1>
      <p className="mt-2 text-[17px]">{c.one_liner}</p>
      <p className="mt-1 text-sm bx-muted">{c.why_here}</p>
      {c.prerequisites.length > 0 && (
        <p className="mt-2 text-sm">
          Read first:{' '}
          {c.prerequisites.map((p, i) => (
            <span key={p}>{i > 0 && ' · '}<Link className="underline" to={`/concepts/${p}`}>{conceptMap.get(p)?.title ?? p}</Link></span>
          ))}
        </p>
      )}
      <Md text={c.body} className="bx-101 bx-reader mt-4" />
      {c.terms.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl">Terms</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.terms.map((t) => {
              const term = termMap.get(t);
              return term ? (
                <Popover key={t} className="bx-term text-sm" label={`${term.term}: definition`} trigger={term.term}>
                  <p className="font-semibold">{term.term}</p>
                  <p className="mt-1">{term.short}</p>
                  <Link to={`/glossary#${term.id}`} className="mt-1 inline-block underline">Glossary</Link>
                </Popover>
              ) : null;
            })}
          </div>
        </section>
      )}
      {c.further_reading.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl">Further reading</h2>
          <ul className="mt-2 list-disc pl-5">
            {c.further_reading.map((f) => (
              <li key={f.url}><a className="underline" href={f.url} target="_blank" rel="noreferrer">{f.title}</a></li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
