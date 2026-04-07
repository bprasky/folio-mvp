'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import type { FeedProjectItem } from '@/lib/feed/feed-layout';

interface MosaicCardProps {
  project: FeedProjectItem;
  size: 'large' | 'small' | 'full';
}

const aspectRatios = {
  large: 'aspect-[4/5]',
  small: 'aspect-square',
  full: 'aspect-[16/9]',
};

export default function MosaicCard({ project, size }: MosaicCardProps) {
  return (
    <Link href={`/project/${project.id}`}>
      <div
        className={`
          group relative overflow-hidden rounded-xl bg-surface-elevated
          ${aspectRatios[size]}
          hover:shadow-lg transition-shadow duration-300
          h-full
        `}
      >
        {project.heroImage && (
          <SafeImage
            src={project.heroImage}
            alt={project.title}
            fill
            className="object-cover group-hover:scale-[1.03]
                       transition-transform duration-500"
          />
        )}

        {/* Hover overlay with title */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50
                        via-transparent to-transparent
                        opacity-0 group-hover:opacity-100
                        transition-opacity duration-300 flex items-end p-4">
          <div>
            <p className="text-white text-sm font-medium leading-tight">
              {project.title}
            </p>
            {size !== 'small' && project.location && (
              <p className="text-white/70 text-xs mt-0.5">
                {project.location}
              </p>
            )}
          </div>
        </div>

        {/* Editorial badge */}
        {project.isEditorial && (
          <div className="absolute top-2.5 left-2.5">
            <span className="text-[9px] uppercase tracking-widest
                             text-white bg-black/40 backdrop-blur-sm
                             px-2 py-0.5 rounded-full">
              Editorial
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
