'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

export interface OrgProject {
  id: string;
  title: string;
  imageUrl: string | null;
  location: string | null;
  type: string | null;
  year: string | null;
}

interface OrgProjectsGridProps {
  projects: OrgProject[];
  isOwner: boolean;
}

export default function OrgProjectsGrid({ projects, isOwner }: OrgProjectsGridProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ background: '#F0EDE9' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B8178" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)', fontSize: '15px', color: '#8B8178' }}>
          No projects yet
        </p>
        <p style={{ fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)', fontSize: '13px', color: '#A69E96', marginTop: '4px' }}>
          Projects will appear here once published.
        </p>
        {isOwner && (
          <Link
            href="/projects/new"
            className="inline-block mt-6 px-6 py-2.5 rounded-full text-[13px] font-medium text-white no-underline"
            style={{ backgroundColor: '#2C2825' }}
          >
            Create Your First Project
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project, i) => {
        const isFirst = i === 0;
        return (
          <Link
            key={project.id}
            href={`/project/${project.id}`}
            className={`group relative block rounded-2xl overflow-hidden no-underline ${isFirst ? 'sm:col-span-2 sm:row-span-2' : ''}`}
            style={{ minHeight: isFirst ? '420px' : '280px' }}
          >
            <div className="absolute inset-0">
              {project.imageUrl ? (
                <SafeImage
                  src={project.imageUrl}
                  alt={project.title}
                  fill
                  sizes={isFirst ? '(max-width: 640px) 100vw, 66vw' : '(max-width: 640px) 100vw, 33vw'}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: '#E8E4DF' }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </div>

            <div className="relative flex h-full items-end p-5">
              <div className="text-white">
                <div className={`font-semibold leading-tight ${isFirst ? 'text-xl' : 'text-base'}`}>
                  {project.title}
                </div>
                <div className="mt-1 text-white/80 text-[12px]">
                  {[project.location, project.year].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
