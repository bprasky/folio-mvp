'use client';

import { useSearchParams } from 'next/navigation';
import { LoadingSurface } from '@/components/loading/LoadingBrand';
import { SkeletonBlock as Block } from '@/components/loading/SkeletonBlock';
import { FeedContentSkeleton } from './skeleton';

export default function Loading() {
  const updates = useSearchParams()?.get('mode') === 'updates';
  return (
    <LoadingSurface label="Loading Discover">
      <div className="min-h-screen bg-surface-ground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-8">
            <div className="h-[calc(var(--type-h1)*var(--lh-h1))] mb-4 w-48 max-w-full" />
            <p className="folio-body max-w-2xl invisible">Explore projects from designers around the world</p>
          </header>
          <div className="flex gap-3 text-sm mb-8"><Block className="h-9 w-40 rounded-full" /><Block className="h-9 w-36 rounded-full" /></div>
          <FeedContentSkeleton updates={updates} />
        </div>
      </div>
    </LoadingSurface>
  );
}
