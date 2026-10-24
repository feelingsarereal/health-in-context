import { Link } from 'react-router-dom';
import { manifest, S } from '@/lib/data/core';
import { AsOf, Notice } from '@/components/ui/bits';

export default function Home() {
  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-semibold">{manifest.short_title}</h1>
      <p className="mt-3 text-[17px] leading-8">{S.home.lead}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link to="/maps" className="bx-btn-primary ax-tap text-base" data-testid="start">
          {S.home.start}
        </Link>
        <Link to="/evidence" className="bx-btn ax-tap">
          {S.home.evidence}
        </Link>
        <AsOf />
      </div>
      <div className="mt-8">
        <Notice />
      </div>
      <p className="mt-6 bx-prose">
        <span className="font-semibold">The question behind it: </span>
        {manifest.question}
      </p>
      <p className="mt-3 text-sm bx-muted">{manifest.venue}.</p>
    </div>
  );
}
