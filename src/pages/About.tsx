import { Link } from 'react-router-dom';
import { manifest, S, scheme, AsOf, Notice, PageHead } from '@feelingsarereal/sdoh-loops-core';
import { provenance } from '@/lib/build-info';

export default function About() {
  return (
    <div>
      <PageHead title="About SDOH Loops" lead={manifest.title}>
        <div className="mt-3"><AsOf /></div>
      </PageHead>
      <Notice />
      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-x-4 gap-y-3 text-[15px]">
        <dt className="font-semibold">Built by</dt>
        <dd>{manifest.builder.name} builder v{manifest.builder.version} ({manifest.builder.date}) from a commissioned action pack; app version 0.1.0.</dd>
        <dt className="font-semibold">Research</dt>
        <dd>{manifest.authors.join(', ')} — {manifest.venue}. Closed {manifest.as_of}.</dd>
        <dt className="font-semibold">Safety profile</dt>
        <dd>
          <span className="bx-chip border border-[color:var(--bx-line)]">health</span> In plain words: the app never says anyone has a condition and never recommends a
          clinical action; codes name circumstances. What you type stays in this browser on this device (IndexedDB) and leaves only when you export it. There is no
          server, account, sync or analytics. Fields that describe a person ask for initials or a label. "Clear my data" in the footer deletes everything.
        </dd>
        <dt className="font-semibold">Codes</dt>
        <dd>
          {scheme.name} release {scheme.release}, {scheme.source}.{' '}
          <a className="underline" href={scheme.official_browser} target="_blank" rel="noreferrer">WHO ICD-11 browser</a>
        </dd>
        <dt className="font-semibold">ICD-11 text</dt>
        <dd data-testid="text-source">{scheme.text_source}</dd>
        <dt className="font-semibold">ICD-11 citation</dt>
        <dd data-testid="icd-citation">{S.codes.citation}</dd>
        <dt className="font-semibold">Licence and permissions</dt>
        <dd>
          Text: {manifest.permissions.text}. Figures: {manifest.permissions.figures}.
        </dd>
        <dt className="font-semibold">Storage</dt>
        <dd>On this device only ({manifest.storage}). Delivery: {manifest.delivery} (this app is not published).</dd>
        <dt className="font-semibold">Report an error</dt>
        <dd>
          Note the page, the code or reference number, and what looks wrong, and send it to the app's maintainer (the {manifest.github_account} account that owns this
          app). Every fact and its source is listed on <Link to="/methods" className="underline">Methods</Link>. Pack build: {provenance.build_errors} build error(s).
        </dd>
      </dl>
    </div>
  );
}
