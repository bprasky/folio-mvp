'use client';

import { useState } from 'react';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { updateProjectStage } from './actions';
import { SortKey } from './_lib/sort';

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

interface ProjectsGridViewProps {
  projects: Project[];
  sortKey: SortKey;
}

export default function ProjectsGridView({ projects, sortKey }: ProjectsGridViewProps) {
  const [updatingProject, setUpdatingProject] = useState<string | null>(null);

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

  const getSortLabel = (key: SortKey) => {
    switch (key) {
      case 'updated_at': return 'Last Updated';
      case 'created_at': return 'Date Created';
      case 'budget_band': return 'Budget Range';
      case 'project_type': return 'Project Type';
      case 'client_type': return 'Client Type';
      case 'region_state': return 'Region/State';
      case 'city': return 'City';
      case 'title': return 'Project Name';
      default: return 'Projects';
    }
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-neutral-400 text-6xl mb-4">📁</div>
        <h3 className="text-lg font-medium text-neutral-900 mb-2">No projects yet</h3>
        <p className="text-neutral-500">Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-neutral-900">
          {getSortLabel(sortKey)} ({projects.length})
        </h2>
        <p className="text-sm text-neutral-600 mt-1">
          Projects sorted by {getSortLabel(sortKey).toLowerCase()}
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onStageChange={handleStageChange}
            showStageControls={true}
          />
        ))}
      </div>
    </div>
  );
}
