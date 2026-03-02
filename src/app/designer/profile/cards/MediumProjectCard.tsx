'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface MediumProjectCardProps {
  project: {
    id: string;
    title: string;
    location?: string;
    year?: string;
    imageUrl?: string;
  };
}

export default function MediumProjectCard({ project }: MediumProjectCardProps) {
  return (
    <Link href={`/project/${project.id}`} className="block">
      <div className="medium-project-card group relative overflow-hidden rounded-xl cursor-pointer">
        <SafeImage
          src={project.imageUrl || ''}
          alt={project.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4
            className="text-white leading-tight mb-1"
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '17px',
              fontWeight: 500,
            }}
          >
            {project.title}
          </h4>
          <span className="text-[11px] text-white/70">
            {[project.location, project.year].filter(Boolean).join(' \u00B7 ')}
          </span>
        </div>
        <style jsx>{`
          .medium-project-card {
            position: relative;
            min-height: 320px;
            height: 100%;
          }
        `}</style>
      </div>
    </Link>
  );
}
