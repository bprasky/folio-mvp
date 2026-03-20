'use client';

import type { FeedProjectItem } from '@/lib/feed/feed-layout';
import { buildMosaicLayout } from '@/lib/feed/mosaic-layout';
import MosaicRow from './MosaicRow';
import MosaicCard from './MosaicCard';

interface MosaicFeedProps {
  projects: FeedProjectItem[];
}

export default function MosaicFeed({ projects }: MosaicFeedProps) {
  const rows = buildMosaicLayout(projects);

  return (
    <>
      {/* Mobile: full-width stack */}
      <div className="space-y-3 sm:hidden">
        {projects.map(project => (
          <MosaicCard key={project.id} project={project} size="full" />
        ))}
      </div>

      {/* Desktop: mosaic grid */}
      <div className="hidden sm:block space-y-3">
        {rows.map((row, i) => (
          <MosaicRow key={i} row={row} rowIndex={i} />
        ))}
      </div>
    </>
  );
}
