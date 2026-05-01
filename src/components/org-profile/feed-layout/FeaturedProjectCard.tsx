'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import type { FeedProjectItem } from '@/lib/feed/feed-layout';

interface FeaturedProjectCardProps {
  project: FeedProjectItem;
}

export default function FeaturedProjectCard({ project }: FeaturedProjectCardProps) {
  return (
    <Link href={`/project/${project.id}`}>
      <div className="group rounded-2xl overflow-hidden border border-stone-200
                      bg-white hover:shadow-md transition-shadow duration-300">

        {/* Hero image — 16:9, full width */}
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-stone-100">
          {project.heroImage ? (
            <SafeImage
              src={project.heroImage}
              alt={project.title}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform
                         duration-500"
            />
          ) : (
            <div className="w-full h-full bg-stone-100" />
          )}

          {/* Editorial badge */}
          {project.isEditorial && (
            <div className="absolute top-3 left-3">
              <span className="text-[var(--type-fine)] uppercase tracking-widest
                               text-white bg-black/40 backdrop-blur-sm
                               px-2.5 py-1 rounded-full">
                Editorial
              </span>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="px-5 py-4">
          <h3 className="font-medium text-stone-900 text-base leading-snug
                         group-hover:text-stone-600 transition-colors">
            {project.title}
          </h3>

          {project.location && (
            <p className="text-xs text-stone-400 mt-1">{project.location}</p>
          )}

          <div className="flex items-center gap-4 mt-3">
            {project.roomCount > 0 && (
              <span className="text-xs text-stone-400">
                {project.roomCount} {project.roomCount === 1 ? 'room' : 'rooms'}
              </span>
            )}
            {project.saveCount > 0 && (
              <span className="text-xs text-stone-400">
                {project.saveCount} {project.saveCount === 1 ? 'save' : 'saves'}
              </span>
            )}
          </div>
        </div>

      </div>
    </Link>
  );
}
