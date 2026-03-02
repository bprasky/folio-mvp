'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface LargeProjectCardProps {
  project: {
    id: string;
    title: string;
    location?: string;
    type?: string;
    imageUrl?: string;
    productCount?: number;
  };
}

export default function LargeProjectCard({ project }: LargeProjectCardProps) {
  return (
    <Link href={`/project/${project.id}`} className="block">
      <div className="large-project-card group relative overflow-hidden rounded-xl cursor-pointer">
        <SafeImage
          src={project.imageUrl || ''}
          alt={project.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute top-4 left-4">
          <span className="mosaic-badge-featured">Featured Project</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3 className="folio-h3 text-white leading-tight mb-2">{project.title}</h3>
          <div className="flex gap-4 items-center">
            {project.location && (
              <span className="text-xs text-white/80">{project.location}</span>
            )}
            {project.type && (
              <>
                <span className="text-xs text-white/50">&middot;</span>
                <span className="text-xs text-white/80">{project.type}</span>
              </>
            )}
            {project.productCount !== undefined && project.productCount > 0 && (
              <>
                <span className="text-xs text-white/50">&middot;</span>
                <span className="text-xs text-white/80">{project.productCount} products</span>
              </>
            )}
          </div>
        </div>
        <style jsx>{`
          .large-project-card {
            position: relative;
            min-height: 420px;
            height: 100%;
          }
          .mosaic-badge-featured {
            padding: 4px 10px;
            border-radius: 4px;
            background: rgba(184, 132, 92, 0.9);
            color: #fff;
            font-family: var(--font-body);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
        `}</style>
      </div>
    </Link>
  );
}
