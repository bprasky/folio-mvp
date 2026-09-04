'use client';

import type { Project } from '@prisma/client';
import { SortKey } from './_lib/sort';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface ProjectsGridViewProps {
  projects: Project[];
  sortKey: SortKey;
}

export default function ProjectsGridView({ projects, sortKey }: ProjectsGridViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <RidgeCard
          key={project.id}
          className="hover:shadow-md transition-shadow"
        >
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="folio-h3 text-folio-text-primary truncate">
                  {project.description || 'Untitled Project'}
                </h3>
                <p className="folio-meta text-folio-text-secondary mt-1 line-clamp-2">
                  {project.description || 'No description available'}
                </p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                project.stage === 'install' ? 'bg-green-100 text-green-800' :
                project.stage === 'in_procurement' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' :
                project.stage === 'design_development' ? 'bg-[var(--accent)]/10 text-[var(--accent-hover)]' :
                project.stage === 'spec_locked' ? 'bg-purple-100 text-purple-800' :
                'bg-surface-canvas text-folio-text-secondary'
              }`}>
                {project.stage.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between folio-meta text-folio-text-tertiary">
              <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
              <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>

            <div className="mt-4 flex space-x-2">
              <Link
                href={`/project/${project.id}`}
                className="flex-1"
              >
                <Button variant="accent" className="w-full">
                  View Project
                </Button>
              </Link>
              <Button variant="outline">
                Edit
              </Button>
            </div>
          </div>
        </RidgeCard>
      ))}
    </div>
  );
}
