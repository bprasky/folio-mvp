'use client';

import { useState } from 'react';
import { Layers3 } from 'lucide-react';
import { CarouselHero } from '@/components/instagram-export/CarouselHero';
import type { StudioData } from '@/lib/publishing-studio/types';
import { StudioPublicationCard } from './StudioPublicationCard';
import { feedOpportunity } from '@/lib/publishing-studio/opportunities';

export type FeedItem = StudioData['feed'][number];
export const feedLabel = (value: string) => value === 'QA' ? 'Q&A' : value.replace(/_/g, ' ').toLowerCase();

/** The source image and headline are the same inputs carried into the editor. */
export function StudioFeedCard({ item, projectNames, onOpen, onCampaign, onRemove, pending = false, disabled = false }: {
  item: FeedItem; projectNames: string; onOpen: () => void; onCampaign?: () => void; onRemove?: () => void; pending?: boolean; disabled?: boolean;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageAvailable = item.imageUrl && failedImage !== item.imageUrl;
  const opportunity = item.kind === 'suggestion' || item.kind === 'idea' ? feedOpportunity(item,projectNames) : null;
  const action = opportunity?.action || (item.kind === 'carousel' && item.canPolish ? 'Continue editing' : item.kind === 'campaign' ? 'View campaign' : 'View post');
  const aspectRatio = item.preview?.aspectRatio || '4:5';
  const visual = <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-ground" onError={() => setFailedImage(item.imageUrl)}>
    {imageAvailable ? item.kind !== 'campaign' ? <div style={{ width: aspectRatio === '9:16' ? '70.3125%' : '100%', height: aspectRatio === '1:1' ? '80%' : '100%' }}><CarouselHero imageUrl={item.imageUrl!} headline={item.title} headlinePosition={item.preview?.headlinePosition} watermarkText={item.preview?.watermarkText || 'folio'} aspectRatio={aspectRatio} /></div> :
      <img src={item.imageUrl!} alt="" loading="lazy" className="h-full w-full object-cover" /> :
      <div className="flex h-full items-center justify-center p-6"><p className="folio-meta">Source image unavailable</p></div>}
    {(item.slideCount || item.imageUrls.length) > 1 && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 folio-meta text-white"><Layers3 className="h-3.5 w-3.5" aria-hidden="true" />{item.slideCount ? `${item.slideCount} slides` : `${item.imageUrls.length} photos`}</span>}
  </div>;
  return <div className="min-w-0">
    <StudioPublicationCard title={item.title} preview={visual}
      benefit={opportunity?.purpose || 'Continue the publication you have already shaped.'}
      contribution={item.kind === 'idea' ? 'Add your perspective to this proposed direction.' : !item.canPolish ? 'Review the prepared source in this workspace.' : !imageAvailable ? 'Choose an available project photograph.' : 'Review the caption and cover before sharing.'}
      actionLabel={pending ? 'Opening…' : item.kind === 'suggestion' && item.canPolish ? 'Polish this post' : item.kind === 'idea' ? 'Review this direction' : action}
      onAction={onOpen} disabled={disabled} supportingSources={item.projectIds}
      readiness={item.kind === 'suggestion' ? 'prepared' : item.kind === 'idea' ? 'working' : 'saved'}
      metadata={`${item.kind === 'suggestion' ? 'Prepared for you' : item.kind === 'idea' ? 'Working preview' : 'Saved work'} · ${projectNames}`} />
    {onCampaign && <button type="button" onClick={onCampaign} disabled={disabled} className="mt-3 folio-meta text-folio-text-secondary underline underline-offset-4 disabled:opacity-50">Build a campaign</button>}
    {onRemove && <button type="button" onClick={onRemove} disabled={disabled} className="mt-3 folio-meta text-folio-text-secondary underline underline-offset-4 disabled:opacity-50">Remove draft</button>}
  </div>;
}
