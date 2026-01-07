'use client';

import { Project } from '@prisma/client';
import { SortKey } from './_lib/sort';
import Link from 'next/link';

interface ProjectsGridViewProps {
  projects: Project[];
  sortKey: SortKey;
}

export default function ProjectsGridView({ projects, sortKey }: ProjectsGridViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {project.description || 'Untitled Project'}
                </h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {project.description || 'No description available'}
                </p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                project.stage === 'install' ? 'bg-green-100 text-green-800' :
                project.stage === 'in_procurement' ? 'bg-yellow-100 text-yellow-800' :
                project.stage === 'design_development' ? 'bg-blue-100 text-blue-800' :
                project.stage === 'spec_locked' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.stage.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
              <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
            
            <div className="mt-4 flex space-x-2">
              <Link 
                href={`/project/${project.id}`}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors text-center"
              >
                View Project
              </Link>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                Edit
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
