'use client';

import type { Project } from '@prisma/client';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';

interface ProjectsKanbanBoardProps {
  projects: Project[];
}

const PHASES = [
  { key: 'concept', label: 'Concept', color: 'bg-[var(--accent)]/10 text-[var(--accent-hover)]' },
  { key: 'schematic', label: 'Schematic', color: 'bg-green-100 text-green-800' },
  { key: 'design_development', label: 'Design Development', color: 'bg-[var(--accent)]/10 text-[var(--accent)]' },
  { key: 'cd_pre_spec', label: 'CD Pre-Spec', color: 'bg-purple-100 text-purple-800' },
  { key: 'spec_locked', label: 'Spec Locked', color: 'bg-orange-100 text-orange-800' },
  { key: 'in_procurement', label: 'In Procurement', color: 'bg-red-100 text-red-800' },
  { key: 'install', label: 'Install', color: 'bg-surface-canvas text-folio-text-secondary' },
];

export default function ProjectsKanbanBoard({ projects }: ProjectsKanbanBoardProps) {
  const projectsByPhase = PHASES.reduce((acc, phase) => {
    acc[phase.key] = projects.filter(project => project.stage === phase.key);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {PHASES.map((phase) => (
        <RidgeCard key={phase.key} className="overflow-hidden">
          <div className="p-4 border-b border-folio-border-subtle">
            <h3 className="folio-ui font-medium text-folio-text-primary">{phase.label}</h3>
            <span className="folio-meta text-folio-text-tertiary">
              {projectsByPhase[phase.key]?.length || 0} projects
            </span>
          </div>
          <div className="p-4 space-y-3">
            {projectsByPhase[phase.key]?.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block p-3 bg-surface-canvas rounded-md border border-folio-border-subtle hover:bg-surface-ground transition-colors"
              >
                <h4 className="folio-ui font-medium text-folio-text-primary truncate">
                  {project.description || 'Untitled Project'}
                </h4>
                <p className="folio-meta text-folio-text-tertiary mt-1">
                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </RidgeCard>
      ))}
    </div>
  );
}
