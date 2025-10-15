'use client';

import { useState } from 'react';
import { FaTag, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

interface Project {
  id: string;
  title: string;
  description?: string | null;
  stage: string;
  projectType: string;
  clientType: string;
  budgetBand: string;
  city?: string | null;
  regionState?: string | null;
  updatedAt: Date;
  createdAt: Date;
  category?: string | null;
  status: string;
  isPublic: boolean;
  views: number;
  saves: number;
  shares: number;
}

interface OverviewSectionProps {
  project: Project;
  isOwner: boolean;
}

export default function OverviewSection({ project, isOwner }: OverviewSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Project>(project);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStageLabel = (stage: string) => {
    const stageLabels: Record<string, string> = {
      concept: 'Concept',
      schematic: 'Schematic',
      design_development: 'Design Development',
      cd_pre_spec: 'CD Pre-Spec',
      spec_locked: 'Spec Locked',
      in_procurement: 'In Procurement',
      install: 'Install'
    };
    return stageLabels[stage] || stage;
  };

  const getProjectTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      UNSPECIFIED: 'Unspecified',
      RESIDENTIAL: 'Residential',
      COMMERCIAL: 'Commercial',
      HOSPITALITY: 'Hospitality',
      RETAIL: 'Retail',
      OFFICE: 'Office',
      HEALTHCARE: 'Healthcare',
      EDUCATIONAL: 'Educational',
      INDUSTRIAL: 'Industrial',
      LANDSCAPE: 'Landscape',
      INTERIOR: 'Interior',
      ARCHITECTURAL: 'Architectural'
    };
    return typeLabels[type] || type;
  };

  const getClientTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      RESIDENTIAL: 'Residential',
      COMMERCIAL: 'Commercial',
      HOSPITALITY: 'Hospitality',
      RETAIL: 'Retail',
      OFFICE: 'Office',
      HEALTHCARE: 'Healthcare',
      EDUCATIONAL: 'Educational',
      INDUSTRIAL: 'Industrial',
      GOVERNMENT: 'Government',
      NON_PROFIT: 'Non-Profit'
    };
    return typeLabels[type] || type;
  };

  const getBudgetBandLabel = (band: string) => {
    const bandLabels: Record<string, string> = {
      UNSPECIFIED: 'Unspecified',
      UNDER_50K: 'Under $50K',
      FIFTY_TO_100K: '$50K - $100K',
      HUNDRED_TO_250K: '$100K - $250K',
      TWO_FIFTY_TO_500K: '$250K - $500K',
      FIVE_HUNDRED_TO_1M: '$500K - $1M',
      OVER_1M: 'Over $1M'
    };
    return bandLabels[band] || band;
  };

  const handleSave = async () => {
    // TODO: Implement save functionality
    setIsEditing(false);
    setEditedProject(project);
  };

  const currentProject = isEditing ? editedProject : project;

  return (
    <div className="space-y-10">
      {/* Overview Section */}
      <section className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold">Overview</h2>
          {isOwner && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FaSave className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedProject(project);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaEdit className="w-4 h-4" />
                  Edit Project
                </button>
              )}
            </div>
          )}
        </div>
        
        {isEditing ? (
          <textarea
            value={currentProject.description || ''}
            onChange={(e) => setEditedProject({ ...currentProject, description: e.target.value })}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg mb-6 resize-none"
            placeholder="Project description..."
          />
        ) : (
          <p className="text-gray-700 leading-relaxed mb-6">{currentProject.description || 'No description yet.'}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
          <div>
            <span className="font-semibold">Stage:</span>
            <span className="ml-2">{getStageLabel(currentProject.stage)}</span>
          </div>
          
          <div>
            <span className="font-semibold">Project Type:</span>
            <span className="ml-2">{getProjectTypeLabel(currentProject.projectType)}</span>
          </div>
          
          <div>
            <span className="font-semibold">Client Type:</span>
            <span className="ml-2">{getClientTypeLabel(currentProject.clientType)}</span>
          </div>
          
          <div>
            <span className="font-semibold">Budget Band:</span>
            <span className="ml-2">{getBudgetBandLabel(currentProject.budgetBand)}</span>
          </div>
          
          <div>
            <span className="font-semibold">Location:</span>
            <span className="ml-2">
              {currentProject.city && currentProject.regionState 
                ? `${currentProject.city}, ${currentProject.regionState}`
                : currentProject.city || currentProject.regionState || 'Not specified'
              }
            </span>
          </div>
          
          <div>
            <span className="font-semibold">Status:</span>
            <span className="ml-2">{currentProject.status}</span>
          </div>
          
          <div>
            <span className="font-semibold">Created:</span>
            <span className="ml-2">{formatDate(currentProject.createdAt)}</span>
          </div>
          
          <div>
            <span className="font-semibold">Updated:</span>
            <span className="ml-2">{formatDate(currentProject.updatedAt)}</span>
          </div>
        </div>
      </section>

      {/* Project Stats Section */}
      <section className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-6">Project Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{currentProject.views.toLocaleString()}</div>
            <div className="text-gray-600">Views</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{currentProject.saves.toLocaleString()}</div>
            <div className="text-gray-600">Saves</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">{currentProject.shares.toLocaleString()}</div>
            <div className="text-gray-600">Shares</div>
          </div>
        </div>
      </section>

      {/* Placeholder for Images Section */}
      <section className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-6">Project Images</h2>
        <div className="text-center py-12 text-gray-500">
          <p>No images uploaded yet.</p>
          {isOwner && (
            <p className="text-sm mt-2">Upload images to showcase your project.</p>
          )}
        </div>
      </section>
    </div>
  );
}

