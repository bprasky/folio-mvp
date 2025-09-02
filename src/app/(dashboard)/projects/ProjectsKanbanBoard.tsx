'use client';

import { useState } from 'react';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { updateProjectStage } from './actions';

interface ProjectImage {
  id: string;
  url: string;
  name: string;
}

interface ProjectOwner {
  id: string;
  name: string;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  stage: 'concept' | 'schematic' | 'design_development' | 'cd_pre_spec' | 'spec_locked' | 'in_procurement' | 'install';
  updatedAt: Date;
  images: ProjectImage[];
  owner: ProjectOwner;
  projectType?: string;
  clientType?: 'RESIDENTIAL' | 'COMMERCIAL';
  budgetBand?: string;
  city?: string;
  regionState?: string;
}

interface ProjectsKanbanBoardProps {
  projects: Project[];
}

const STAGES = [
  'concept',
  'schematic', 
  'design_development',
  'cd_pre_spec',
  'spec_locked',
  'in_procurement',
  'install'
] as const;

const STAGE_LABELS = {
  concept: 'Concept',
  schematic: 'Schematic',
  design_development: 'Design Development',
  cd_pre_spec: 'CD / Pre-Spec',
  spec_locked: 'Spec Locked',
  in_procurement: 'In Procurement',
  install: 'Install'
};

export default function ProjectsKanbanBoard({ projects }: ProjectsKanbanBoardProps) {
  const [updatingProject, setUpdatingProject] = useState<string | null>(null);

  const projectsByStage = projects.reduce((acc, project) => {
    if (!acc[project.stage]) {
      acc[project.stage] = [];
    }
    acc[project.stage].push(project);
    return acc;
  }, {} as Record<string, Project[]>);

  const handleStageChange = async (projectId: string, newStage: string) => {
    setUpdatingProject(projectId);
    try {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('stage', newStage);
      
      const result = await updateProjectStage(formData);
      if (!result.success) {
        console.error('Failed to update stage:', result.error);
      }
    } catch (error) {
      console.error('Error updating stage:', error);
    } finally {
      setUpdatingProject(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6 min-w-max">
        {STAGES.map((stage) => {
          const stageProjects = projectsByStage[stage] || [];
          
          return (
            <div key={stage} className="min-w-[280px]">
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-neutral-900">
                    {STAGE_LABELS[stage]}
                  </h2>
                  <span className="bg-neutral-100 text-neutral-800 text-xs font-medium px-2.5 py-1 rounded-full">
                    {stageProjects.length}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {stageProjects.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500 text-sm">
                      No projects in this stage yet
                    </div>
                  ) : (
                    stageProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onStageChange={handleStageChange}
                        showStageControls={true}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
