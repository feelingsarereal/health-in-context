import { useState } from 'react';
import { S, safety, pref, setPref } from '@feelingsarereal/sdoh-loops-core';

/** SAFETY H5: the first-run panel, in the pack's own words. Dismissal is a per-device preference. */
export function FirstRun() {
  const [seen, setSeen] = useState(() => pref('first-run') === 'ok');
  if (seen) return null;
  return (
    <section className="bx-banner" aria-labelledby="first-run-title" data-testid="first-run">
      <h2 id="first-run-title" className="text-lg font-semibold">
        {S.first_run.title}
      </h2>
      <p className="mt-1">{safety.notice}</p>
      <button
        type="button"
        className="bx-btn-primary mt-3 ax-tap"
        onClick={() => {
          setPref('first-run', 'ok');
          setSeen(true);
        }}
      >
        {S.first_run.ok}
      </button>
    </section>
  );
}
