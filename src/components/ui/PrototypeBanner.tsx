import { useState } from 'react';
import { S } from '@feelingsarereal/sdoh-loops-core';

/** SL32: the public (GitHub Pages) build only — set by `npm run build:pages` (VITE_SDOH_PAGES=on) */
export const PAGES_BUILD = import.meta.env.VITE_SDOH_PAGES === 'on';
/** a plain link to the repo's Issues page: nothing prefilled, nothing sent */
export const ISSUES_URL = 'https://github.com/feelingsarereal/health-in-context/issues';

/**
 * SL32: the prototype banner on every page of the public build, above the site header. Hiding it lasts for this visit
 * only: it is React state in the layout, never stored, so a reload brings it back.
 */
export function PrototypeBanner() {
  const [hidden, setHidden] = useState(false);
  const b = S.prototype_banner;
  if (!PAGES_BUILD || hidden || !b) return null;
  return (
    <div role="region" aria-label="Prototype notice" data-testid="prototype-banner" className="no-print border-b border-[color:var(--bx-line)] bg-[color:var(--bx-surface,var(--bx-bg))]">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2 text-sm">
        <p className="flex-1">
          <strong>{b.lead}</strong> {b.body_1} <strong>{b.strong}</strong>
          {b.body_2}{' '}
          <a className="underline" href={ISSUES_URL} target="_blank" rel="noreferrer" data-testid="report-problem">{b.report}</a>
        </p>
        <button type="button" className="bx-btn ax-tap shrink-0" onClick={() => setHidden(true)} aria-label={b.dismiss} title={b.dismiss} data-testid="prototype-banner-dismiss">
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}
