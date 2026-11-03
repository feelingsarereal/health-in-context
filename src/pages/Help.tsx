import { ageDays, safety, PageHead } from '@feelingsarereal/sdoh-loops-core';

/** SAFETY H6: a static list of the pack's help entries. No triage logic, no branches on user input. */
export default function Help() {
  return (
    <div>
      <PageHead title="Where to get help" lead="Services listed by this app. Each shows where the details came from and the date they were checked." />
      <ul className="space-y-3" data-testid="help-list">
        {safety.help.map((h) => {
          const stale = h.recheck_days !== undefined && ageDays(h.verified_on) > h.recheck_days;
          return (
            <li key={h.name} className="bx-card p-4" data-testid="help-entry">
              <h2 className="text-xl font-semibold">{h.name}</h2>
              <p className="mt-1 text-[17px]">{h.how}</p>
              {h.url && (
                <p className="mt-1">
                  <a className="underline ax-tap inline-flex items-center" href={h.url} target="_blank" rel="noreferrer">
                    {h.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </p>
              )}
              <p className="mt-2 text-sm bx-muted">
                Source: {h.source}. Checked {h.verified_on}.{' '}
                {stale && <span className="bx-todo">checked {h.verified_on} — due for a re-check</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
