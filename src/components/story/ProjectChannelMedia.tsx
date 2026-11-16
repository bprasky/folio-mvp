'use client';
import { useState } from 'react';
import SafeImage from '@/components/SafeImage';
import type { ChannelMediaAsset } from '@/lib/project-channel/media';

export function ProjectChannelMedia({ assets, title }: { assets: ChannelMediaAsset[]; title: string }) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  return <div className="mt-8 space-y-8">
    {assets.map((asset, index) => <figure key={asset.url}>
      {failed.has(asset.url) ? <p role="status" className="rounded-lg border border-white/20 p-8">This media is currently unavailable.</p>
        : asset.kind === 'video' ? <video src={asset.url} poster={asset.poster || undefined} controls preload="none" playsInline
          aria-label={asset.caption || title} onError={() => setFailed(value => new Set(value).add(asset.url))} className="max-h-[75vh] w-full rounded-lg bg-black" />
          : asset.kind === 'image' ? <div className="relative h-[65vh] min-h-64">
            <SafeImage src={asset.url} alt={asset.caption || `${title}, photograph ${index + 1}`} fill unoptimized sizes="100vw"
              onError={() => setFailed(value => new Set(value).add(asset.url))} className="object-contain" />
          </div> : <a href={asset.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-white/60 px-6 underline">Watch on {new URL(asset.url).hostname} <span className="sr-only">(opens in a new tab)</span></a>}
      {asset.caption && <figcaption className="mt-3 text-sm text-white/80">{asset.caption}</figcaption>}
    </figure>)}
  </div>;
}
