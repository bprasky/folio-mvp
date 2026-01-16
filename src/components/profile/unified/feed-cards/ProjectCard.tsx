'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface ProjectCardProps {
  project: {
    id: string;
    title?: string;
    name?: string;
    imageUrl?: string;
    city?: string;
    regionState?: string;
    saveCount?: number;
    saves?: number;
    projectType?: string;
  };
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const imageUrl = project.imageUrl || '/images/placeholders/project-16x9.jpg';
  const title = project.title || project.name || 'Untitled Project';
  const location = [project.city, project.regionState].filter(Boolean).join(', ');
  const saves = project.saveCount || project.saves || 0;

  return (
    <Link href={`/project/${project.id}`} className="group block">
      <article className="overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundColor: '#E8E4DF' }}>
          <SafeImage
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3
              className="text-lg font-medium leading-tight text-white"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {title}
            </h3>
            {location && <p className="text-sm text-white/80 mt-1">{location}</p>}
          </div>

          {/* Badge */}
          <div className="absolute top-3 left-3">
            <span
              className="px-2 py-1 text-xs rounded-full backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#6B635B' }}
            >
              Project
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-white" style={{ borderTop: '1px solid #E8E4DF' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: '#8B8178' }}>
            <span>{project.projectType || 'Design Project'}</span>
            {saves > 0 && (
              <span className="flex items-center gap-1">
                <BookmarkIcon />
                {saves}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

function BookmarkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
    </svg>
  );
}
