'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** Separate channel discovery from opening the existing article. */
export function ProjectChannelShareTracking({ projectId, slug }: { projectId: string; slug: string }) {
  const search = useSearchParams();
  const source = search?.get('utm_source');
  const medium = search?.get('utm_medium');
  const campaign = search?.get('utm_campaign');
  useEffect(() => {
    if (source !== 'folio_share') return;
    fetch('/api/analytics/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'project_channel_share_landing', payload: { projectId, postSlug: slug, utmSource: source, utmMedium: medium, utmCampaign: campaign } }),
    }).catch(() => {});
  }, [projectId, slug, source, medium, campaign]);
  return null;
}
