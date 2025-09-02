'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaArrowLeft, FaEdit, FaSave, FaTimes, FaTag, FaPlus, FaDownload, FaFilePdf, FaPencilAlt, FaEye, FaPrint, FaShareAlt, FaTrash } from 'react-icons/fa';

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

interface ProjectDetailPageProps {
  project: Project;
  isOwner: boolean;
}

export function ProjectDetailPage({ project, isOwner }: ProjectDetailPageProps) {
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
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Back Button & Edit Controls */}
      <div className="p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/projects" className="flex items-center text-blue-600 hover:underline">
            <FaArrowLeft className="mr-2" /> Back to Projects
          </Link>
          
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
      </div>

      {/* Project Hero Section */}
      <section className="relative w-full h-96 md:h-[600px] overflow-hidden flex items-end p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80"></div>
        
        <div className="relative z-10 text-white w-full">
          {isEditing ? (
            <input
              type="text"
              value={currentProject.title}
              onChange={(e) => setEditedProject({ ...currentProject, title: e.target.value })}
              className="text-5xl md:text-7xl font-bold mb-4 bg-transparent border-b-2 border-white/50 text-white placeholder-white/70 w-full"
              placeholder="Project Title"
            />
          ) : (
            <h1 className="text-5xl md:text-7xl font-bold mb-4">{currentProject.title}</h1>
          )}
          
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/20">
                <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
                  {currentProject.title.charAt(0).toUpperCase()}
                </div>
              </div>
              <span className="text-lg md:text-xl text-gray-300">
                Project Details
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-full flex items-center">
              <FaTag className="mr-1" /> {getStageLabel(currentProject.stage)}
            </span>
            <span className="bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-full flex items-center">
              <FaTag className="mr-1" /> {getProjectTypeLabel(currentProject.projectType)}
            </span>
            {currentProject.city && (
              <span className="bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-full flex items-center">
                <FaTag className="mr-1" /> {currentProject.city}
              </span>
            )}
          </div>
        </div>
      </section>

      <main className="container mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Main Content Column */}
        <div className="lg:col-span-3 space-y-10">

          {/* Overview Section */}
          <section className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold mb-4">Overview</h2>
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

          {/* Placeholder for Timeline Section */}
          <section className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold mb-6">Project Timeline</h2>
            <div className="text-center py-12 text-gray-500">
              <p>No timeline events yet.</p>
              {isOwner && (
                <p className="text-sm mt-2">Add milestones and progress updates to track your project journey.</p>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <aside className="lg:col-span-1 space-y-8">
          {/* Project Actions */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Actions</h2>
            <div className="space-y-3">
              <button className="flex items-center w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
                <FaEdit className="mr-2" /> Edit Project
              </button>
              <button className="flex items-center w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition">
                <FaDownload className="mr-2" /> Export Data
              </button>
              <button className="flex items-center w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition">
                <FaShareAlt className="mr-2" /> Share Project
              </button>
            </div>
          </div>

          {/* Project Files & Downloads */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Files & Downloads</h2>
            <div className="space-y-3">
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition">
                <FaDownload className="mr-2" /> Project Summary (PDF)
              </button>
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition">
                <FaFilePdf className="mr-2" /> Design Boards (PDF)
              </button>
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition">
                <FaDownload className="mr-2" /> Materials List
              </button>
            </div>
          </section>

          {/* Project Status */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Visibility:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  currentProject.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {currentProject.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Category:</span>
                <span className="text-gray-600">{currentProject.category || 'Uncategorized'}</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
