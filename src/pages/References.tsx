import { references, TIERS } from '@/lib/data/refs';
import { C } from '@/lib/copy';
import { RefCard } from '@/components/evidence/RefCard';
import { PageHead } from '@/components/ui/bits';

/** Tiered as MI topic mode: seminal oldest first, current newest first; each with its verbatim abstract folded. */
export default function References() {
  return (
    <div>
      <PageHead title="References" lead={`${references.length} works, ${references.filter((r) => r.verified).length} verified. Each card shows the records that use it.`} />
      {TIERS.map((t) => {
        const rs = references
          .filter((r) => r.tier === t.id)
          .sort((a, b) => (t.id === 'current' ? b.year - a.year : a.year - b.year) || a.n - b.n);
        if (!rs.length) return null;
        return (
          <section key={t.id} className="mb-10" aria-labelledby={`tier-${t.id}`}>
            <h2 id={`tier-${t.id}`} className="text-2xl mt-8">
              {t.label} <span className="text-base bx-muted font-body">({rs.length})</span>
            </h2>
            <p className="mb-3 bx-prose">{C.tierExplain[t.id]}</p>
            <ul className="space-y-3">
              {rs.map((r) => (
                <li key={r.n} className="bx-card p-4">
                  <RefCard r={r} showUsedBy />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
