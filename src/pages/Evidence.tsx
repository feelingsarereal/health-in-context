import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { links, grades, groups, groupMap, codeMap, endpointTitle, linkFraming, notOffered, tierBasis } from '@/lib/data/scheme';

const inGroup = (endpoint: string, g: string) => endpoint === g || groupMap.get(endpoint)?.subgroup_of === g || codeMap.get(endpoint)?.group === g;
import { S } from '@/lib/data/core';
import { CitedText } from '@/components/evidence/CitedText';
import { GradeChip, PageHead, PolarityChip } from '@/components/ui/bits';

/** ACTION-SPEC §2 /evidence under evidence.body: records — every graded link, filterable by grade and group. */
export default function Evidence() {
  const [sp, setSp] = useSearchParams();
  const grade = sp.get('grade') ?? '';
  const group = sp.get('group') ?? '';
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  const shown = useMemo(
    () => links.filter((l) => (!grade || l.grade === grade) && (!group || inGroup(l.from, group) || inGroup(l.to, group))),
    [grade, group],
  );
  return (
    <div>
      <PageHead title="Evidence" lead={`${links.length} evidence-graded links between ICD-11 blocks. These feed the association menu on the map.`} />
      {linkFraming && <p className="bx-banner">{linkFraming}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Grade</span>
          <select className="bx-input ax-tap" value={grade} onChange={(e) => set('grade', e.target.value)}>
            <option value="">All grades</option>
            {Object.entries(grades).map(([g, d]) => (
              <option key={g} value={g}>{g} — {d}</option>
            ))}
          </select>
        </label>
        <label className="text-sm min-w-0 flex-1">
          <span className="mb-1 block font-semibold">Block</span>
          <select className="bx-input ax-tap" value={group} onChange={(e) => set('group', e.target.value)}>
            <option value="">All blocks</option>
            {groups.filter((g) => !g.functioning).map((g) => (
              <option key={g.id} value={g.id}>{g.id} {g.title}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-3 text-sm bx-muted" role="status">{shown.length} of {links.length} links shown.</p>
      <ul className="space-y-3">
        {shown.map((l) => (
          <li key={l.id} className="bx-card p-4" data-testid="evidence-link">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs bx-muted">{l.id}</span>
              <PolarityChip p={l.polarity} />
              <GradeChip grade={l.grade} />
              {l.counter && <span className="bx-chip border border-[color:var(--bx-line)]">{S.associations.counter}</span>}
            </div>
            <p className="mt-2 font-semibold">
              {l.from} {endpointTitle(l.from)} → {l.to} {endpointTitle(l.to)}
            </p>
            <CitedText text={l.mechanism} className="mt-1 bx-prose" />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm bx-muted">
        {tierBasis} {notOffered.length} further links are withheld after an independent check of their evidence; they are listed with the reasons on{' '}
        <Link to="/methods#withheld" className="underline">Methods</Link> and are never offered on the map.
      </p>
    </div>
  );
}
