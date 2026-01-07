'use client';

import { Project } from '@prisma/client';
import Link from 'next/link';

interface ProjectsKanbanBoardProps {
  projects: Project[];
}

const PHASES = [
  { key: 'concept', label: 'Concept', color: 'bg-blue-100 text-blue-800' },
  { key: 'schematic', label: 'Schematic', color: 'bg-green-100 text-green-800' },
  { key: 'design_development', label: 'Design Development', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'cd_pre_spec', label: 'CD Pre-Spec', color: 'bg-purple-100 text-purple-800' },
  { key: 'spec_locked', label: 'Spec Locked', color: 'bg-orange-100 text-orange-800' },
  { key: 'in_procurement', label: 'In Procurement', color: 'bg-red-100 text-red-800' },
  { key: 'install', label: 'Install', color: 'bg-gray-100 text-gray-800' },
];

export default function ProjectsKanbanBoard({ projects }: ProjectsKanbanBoardProps) {
  const projectsByPhase = PHASES.reduce((acc, phase) => {
    acc[phase.key] = projects.filter(project => project.stage === phase.key);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {PHASES.map((phase) => (
        <div key={phase.key} className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">{phase.label}</h3>
            <span className="text-xs text-gray-500">
              {projectsByPhase[phase.key]?.length || 0} projects
            </span>
          </div>
          <div className="p-4 space-y-3">
            {projectsByPhase[phase.key]?.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block p-3 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {project.description || 'Untitled Project'}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
