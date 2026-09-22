'use client';

import { useEffect, useState } from 'react';
import { StudioPitchCard } from './StudioPitchCard';
import type { ReleaseOpportunity } from '@/lib/publishing-studio/release-plan';
export type { ReleaseOpportunity } from '@/lib/publishing-studio/release-plan';

export function useReleaseOpportunities() {
  const [opportunities, setOpportunities] = useState<ReleaseOpportunity[]>([]);
  const [plans, setPlans] = useState<ReleaseOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetch('/api/publishing-studio/releases', { cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load project release opportunities.');
      if (!cancelled) { setOpportunities(data.opportunities); setPlans(data.plans); }
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load project releases.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);
  return { opportunities, plans, loading, error, retry: () => setAttempt(value => value + 1) };
}

export function StudioReleaseOpportunities({ opportunities, loading, error, onRetry, saved = false, cardsOnly = false }: { opportunities: ReleaseOpportunity[]; loading?: boolean; error?: string; onRetry?(): void; saved?: boolean; cardsOnly?: boolean }) {
  if (loading) return <p role="status" className="folio-meta my-5">Looking for related project stories…</p>;
  if (error) return <div className="my-5"><p role="alert" className="folio-body">{error}</p><button onClick={onRetry} className="folio-ui underline">Try again</button></div>;
  if (!opportunities.length) return null;
  const cards = opportunities.map(opportunity => <StudioPitchCard key={opportunity.projectId}
    eyebrow={opportunity.hasPlan ? 'Project series · Saved plan' : 'Project series'} title={opportunity.purpose}
    image={opportunity.imageUrl ? <img src={opportunity.imageUrl} alt="" className="aspect-[4/5] w-full object-cover" /> : undefined}
    href={`/designer/studio/release?projectId=${encodeURIComponent(opportunity.projectId)}`}
    actionLabel={opportunity.hasPlan ? 'Resume this project’s release' : 'Get started'}>
    <p>{opportunity.reason}</p>
    <p>{opportunity.needsReview ? 'Your saved choices are preserved. Review the changed sources before continuing.' : 'Choose the rooms to feature, arrange your posts, then polish and download each one.'}</p>
    <p className="folio-meta text-folio-text-secondary">Project introduction + selected room stories{opportunity.needsReview ? ' · Source review needed' : ''}</p>
  </StudioPitchCard>);
  return cardsOnly ? <>{cards}</> : <section aria-label={saved ? 'Saved project release plans' : 'Project release opportunities'} className="my-8"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{cards}</div></section>;
}
