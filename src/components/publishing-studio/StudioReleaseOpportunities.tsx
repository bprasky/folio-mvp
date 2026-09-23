'use client';

import { useEffect, useState } from 'react';
import { StudioPublicationCard } from './StudioPublicationCard';
import { CarouselHero } from '@/components/instagram-export/CarouselHero';
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

export function StudioReleaseOpportunities({ opportunities, loading, error, onRetry, onHistory, saved = false, cardsOnly = false }: { opportunities: ReleaseOpportunity[]; loading?: boolean; error?: string; onRetry?(): void; onHistory?(sourceId: string): void; saved?: boolean; cardsOnly?: boolean }) {
  if (loading) return <p role="status" className="folio-meta my-5">Looking for related project stories…</p>;
  if (error) return <div className="my-5"><p role="alert" className="folio-body">{error}</p><button onClick={onRetry} className="folio-ui underline">Try again</button></div>;
  if (!opportunities.length) return null;
  const cards = opportunities.map(opportunity => <div key={opportunity.projectId}><StudioPublicationCard
    metadata={opportunity.hasPlan ? 'Project series · Saved plan' : 'Prepared for you · Project series'} title={opportunity.title || opportunity.projectTitle}
    preview={<div style={{aspectRatio: (opportunity.preview?.aspectRatio || '4:5').replace(':','/')}}>{opportunity.imageUrl ? <CarouselHero imageUrl={opportunity.imageUrl} headline={opportunity.title || opportunity.projectTitle} headlinePosition={opportunity.preview?.headlinePosition} watermarkText={opportunity.preview?.watermarkText || 'folio'} aspectRatio={opportunity.preview?.aspectRatio} /> : <div className="flex h-full items-center bg-surface-ground p-6 folio-ui">Review the opening post’s source image.</div>}</div>}
    href={`/designer/studio/release?projectId=${encodeURIComponent(opportunity.projectId)}`}
    actionLabel={opportunity.needsReview ? 'Review sources' : 'Review introduction'}
    benefit="Bring your Folio project story to your social audience." contribution={opportunity.needsReview ? 'Your saved choices are preserved. Review the changed sources.' : 'Review the opening post, then choose the rooms to feature.'}
    readiness={opportunity.needsReview ? 'needs_source' : opportunity.hasPlan ? 'saved' : 'prepared'} supportingSources={opportunity.sourceIds} />
    {onHistory && !opportunity.hasPlan && <button className="folio-meta mt-3 underline underline-offset-4" onClick={() => onHistory(opportunity.historySourceId || opportunity.sourceIds[0])}>Already shared this?</button>}</div>);
  return cardsOnly ? <>{cards}</> : <section aria-label={saved ? 'Saved project release plans' : 'Project release opportunities'} className="my-8"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{cards}</div></section>;
}
