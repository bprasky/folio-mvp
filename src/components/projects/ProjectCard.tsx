'use client';

import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';

interface ProjectCardProps {
  project: { 
    id: string; 
    title: string; 
    coverUrl?: string; 
    stage?: string; 
    updatedAt?: Date;
    images?: Array<{ url: string; name?: string }>;
  };
  onStageChange?: (projectId: string, newStage: string) => void;
  showStageControls?: boolean;
}

const STAGE_LABELS = {
  concept: 'Concept',
  schematic: 'Schematic',
  design_development: 'Design Development',
  cd_pre_spec: 'CD / Pre-Spec',
  spec_locked: 'Spec Locked',
  in_procurement: 'In Procurement',
  install: 'Install'
};

const STAGE_COLORS = {
  concept: 'bg-blue-50 text-blue-700 border-blue-200',
  schematic: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  design_development: 'bg-purple-50 text-purple-700 border-purple-200',
  cd_pre_spec: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  spec_locked: 'bg-orange-50 text-orange-700 border-orange-200',
  in_procurement: 'bg-red-50 text-red-700 border-red-200',
  install: 'bg-green-50 text-green-700 border-green-200'
};

export function ProjectCard({ 
  project, 
  onStageChange, 
  showStageControls = false 
}: ProjectCardProps) {
  const coverSrc = project.coverUrl || 
    (project.images && project.images.length > 0 ? project.images[0].url : null) || 
    '/images/placeholders/project-16x9.jpg';

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStageChange) {
      onStageChange(project.id, e.target.value);
    }
  };

  return (
    <div className="group relative rounded-2xl border border-neutral-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200">
      {/* Cover Image - Clickable Link */}
      <Link
        href={`/project/${project.id}`}
        className="block relative h-48 w-full bg-neutral-100"
        title={`View ${project.title}`}
        prefetch
      >
        <Image
          src={coverSrc}
          alt={project.title}
          fill
          className="object-cover"
        />
        
        {/* Stage Pill - positioned over image */}
        {project.stage && (
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STAGE_COLORS[project.stage as keyof typeof STAGE_COLORS] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
              {STAGE_LABELS[project.stage as keyof typeof STAGE_LABELS] || project.stage}
            </span>
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div className="p-4">
        {/* Title */}
        <Link 
          href={`/project/${project.id}`}
          className="block group-hover:text-neutral-700 transition-colors"
        >
          <h3 className="font-semibold text-neutral-900 mb-2 line-clamp-2 group-hover:underline">
            {project.title}
          </h3>
        </Link>

        {/* Stage Controls - if enabled */}
        {showStageControls && onStageChange && project.stage && (
          <div className="mt-3">
            <select
              value={project.stage}
              onChange={handleStageChange}
              className="text-xs border border-neutral-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              {Object.entries(STAGE_LABELS).map(([stage, label]) => (
                <option key={stage} value={stage}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
