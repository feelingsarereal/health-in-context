import { Link } from 'react-router-dom';
import { concepts } from '@/lib/data/refs';
import { PageHead } from '@/components/ui/bits';

export default function Concepts() {
  return (
    <div>
      <PageHead title="Primers" lead="Short introductions to the ideas the map uses." />
      <ul className="space-y-3">
        {concepts.map((c) => (
          <li key={c.id} className="bx-card p-4">
            <h2 className="text-xl font-semibold">
              <Link to={`/concepts/${c.id}`} className="underline">{c.title}</Link>
            </h2>
            <p className="mt-1">{c.one_liner}</p>
            <p className="mt-1 text-sm bx-muted">{c.why_here}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
