'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    city?: string | null;
    saves?: number;
    images?: { url: string }[];
  };
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const image = project.images?.[0]?.url;
  // Vary aspect ratio based on id for visual interest
  const aspectIndex = project.id?.charCodeAt(0) % 3 || 0;
  const aspects = ['3/4', '4/3', '1/1'];
  const aspect = aspects[aspectIndex];

  return (
    <Link href={`/project/${project.id}`} className="block group">
      <div
        className="rounded-lg overflow-hidden relative"
        style={{ backgroundColor: '#E8E4DF', aspectRatio: aspect }}
      >
        {image && (
          <SafeImage
            src={image}
            alt={project.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {/* Badge */}
        <div className="absolute top-3 left-3">
          <span
            className="px-2 py-1 text-xs rounded-full backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#6B635B' }}
          >
            Project
          </span>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white text-sm font-medium">{project.name}</p>
            <p className="text-white/70 text-xs mt-1">
              {project.city || 'Project'}
              {project.saves ? ` · ${project.saves} saves` : ''}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
