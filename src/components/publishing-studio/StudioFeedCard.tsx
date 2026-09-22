'use client';

import { useState } from 'react';
import { Layers3 } from 'lucide-react';
import { CarouselHero } from '@/components/instagram-export/CarouselHero';
import type { StudioData } from '@/lib/publishing-studio/types';
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
  return <article className="flex min-w-0 flex-col">
    <button type="button" onClick={onOpen} disabled={disabled} aria-label={`${action}: ${item.title}`} className="group flex h-full w-full flex-col text-left disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
      <div className="relative flex w-full shrink-0 aspect-[4/5] items-center justify-center overflow-hidden rounded-xl bg-surface-ground" onError={() => setFailedImage(item.imageUrl)}>
        {imageAvailable ? item.kind === 'suggestion' || item.kind === 'carousel' ? <div style={{ width: aspectRatio === '9:16' ? '70.3125%' : '100%', height: aspectRatio === '1:1' ? '80%' : '100%' }}><CarouselHero imageUrl={item.imageUrl!} headline={item.title} headlinePosition={item.preview?.headlinePosition} watermarkText={item.preview?.watermarkText || 'folio'} /></div> : <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl!} alt={item.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        </> : <div className="flex h-full flex-col justify-end gap-3 p-6"><h2 className="folio-h3 break-words">{item.title}</h2><p className="folio-meta text-folio-text-secondary">Source image unavailable</p></div>}
        {(item.slideCount || item.imageUrls.length) > 1 && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 folio-meta text-white"><Layers3 className="h-3.5 w-3.5" aria-hidden="true" />{item.slideCount ? `${item.slideCount} slides` : `${item.imageUrls.length} photos`}</span>}
        <span className="absolute bottom-3 left-3 rounded-full bg-surface-canvas px-3 py-1.5 folio-meta text-folio-text-primary shadow-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{pending ? 'Opening…' : action}</span>
      </div>
      <div className="flex flex-1 flex-col pt-3"><div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 folio-meta text-folio-text-secondary"><span className="capitalize">{feedLabel(item.format)}{aspectRatio !== '4:5' ? ` · ${aspectRatio}` : ''}</span><span>{item.kind === 'suggestion' ? 'Proposed post' : item.kind === 'idea' ? 'Needs your perspective' : feedLabel(item.status)}</span></div><h3 className="folio-ui mt-1.5 line-clamp-2 break-words">{opportunity?.purpose || item.pitch || item.title}</h3>{<p className="folio-body mt-2 line-clamp-2 text-folio-text-primary">{opportunity?.reason || item.caption || 'No caption saved.'}</p>}{opportunity && <><p className="folio-body mt-2 text-folio-text-secondary">{opportunity.path}</p><p className="folio-meta mt-2 text-folio-text-secondary">{opportunity.result} {opportunity.destination}</p></>}<p className="folio-meta mt-2 text-folio-text-secondary">{projectNames || 'Across your practice'}</p>{item.kind === 'suggestion' && <p className="folio-meta mt-2 text-folio-text-secondary">{item.caption && imageAvailable ? 'Caption and opening image prepared' : 'Source review needed'}</p>}<span className="folio-ui mt-auto block pt-4 underline underline-offset-4">{pending ? 'Opening…' : action}</span></div>
    </button>
    {onCampaign && <button type="button" onClick={onCampaign} disabled={disabled} className="mt-3 folio-meta text-folio-text-secondary underline underline-offset-4 disabled:opacity-50">Build a campaign</button>}
    {onRemove && <button type="button" onClick={onRemove} disabled={disabled} className="mt-3 folio-meta text-folio-text-secondary underline underline-offset-4 disabled:opacity-50">Remove draft</button>}
  </article>;
}
