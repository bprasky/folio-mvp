'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '../../components/SafeImage';
import { FaPlus, FaEdit, FaTrash, FaChartLine, FaBriefcase, FaUser, FaToggleOn, FaToggleOff, FaDownload, FaEye, FaEyeSlash, FaExternalLinkAlt, FaUpload } from 'react-icons/fa';
import ProjectCreationModal from '../../components/ProjectCreationModal';
import { useRole } from '../../contexts/RoleContext';
import { PublishButton } from './PublishButton';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

export default function DesignerProfile() {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [activeTab, setActiveTab] = useState<'portfolio' | 'projects'>('projects');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>('');
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);

  const mockProjects = [
    {
      id: 'mock-1',
      title: 'Modern Living Room',
      category: 'Interior Design',
      client: 'Private Residence',
      image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace',
      views: 2345,
      likes: 189,
      status: 'published',
      visibility: 'public'
    },
    {
      id: 'mock-2',
      title: 'Office Space Redesign',
      category: 'Commercial',
      client: 'Tech Corp',
      image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
      views: 1876,
      likes: 145,
      status: 'published',
      visibility: 'public'
    }
  ];

  useEffect(() => {
    if (role === 'admin') {
      loadDesigners();
    }
    loadProjects();
  }, [role]);

  useEffect(() => {
    if (role === 'admin' && selectedDesignerId) {
      loadProjects(selectedDesignerId);
    } else if (role === 'designer') {
      loadProjects();
    }
  }, [selectedDesignerId, role]);

  useEffect(() => {
    // Update selectedDesignerId when activeProfileId changes
    if (activeProfileId && role === 'designer') {
      setSelectedDesignerId(activeProfileId);
      loadProjects(activeProfileId);
    }
  }, [activeProfileId, role]);

  const loadDesigners = async () => {
    try {
      const response = await fetch('/api/designers');
      const data = await response.json();
      setDesigners(data);
    } catch (error) {
      console.error('Error loading designers:', error);
    }
  };

  const loadProjects = async (designerId?: string) => {
    try {
      const url = designerId 
        ? `/api/projects?designerId=${designerId}&includeDrafts=true` 
        : '/api/projects?includeDrafts=true';
      const response = await fetch(url);
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleProfileChange = (profileId: string) => {
    setSelectedDesignerId(profileId);
    loadProjects(profileId);
  };

  const toggleDesignerProfile = (designerId: string) => {
    const newActiveId = selectedDesignerId === designerId ? '' : designerId;
    setSelectedDesignerId(newActiveId);
    setActiveProfileId(newActiveId);
  };

  const handleProjectCreated = (project: any) => {
    setProjects(prev => [project, ...prev]);
    console.log('Project created:', project);
    // Refresh projects from API to ensure consistency
    if (role === 'admin' && selectedDesignerId) {
      loadProjects(selectedDesignerId);
    } else {
      loadProjects();
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setShowProjectModal(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    setDeletingProject(projectId);
    try {
      const response = await fetch(`/api/projects?id=${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Remove from local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      alert('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setDeletingProject(null);
    }
  };

  const handleToggleVisibility = async (projectId: string, currentVisibility: string) => {
    try {
      const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
      
      const response = await fetch('/api/projects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: projectId,
          visibility: newVisibility
        }),
      });

      if (response.ok) {
        // Update the project in the local state
        setProjects(prevProjects => 
          prevProjects.map(project => 
            project.id === projectId 
              ? { ...project, visibility: newVisibility }
              : project
          )
        );
      } else {
        console.error('Failed to update project visibility');
      }
    } catch (error) {
      console.error('Error updating project visibility:', error);
    }
  };

  // Filter projects based on selected designer for admin
  const getFilteredProjects = () => {
    if (role === 'admin' && selectedDesignerId) {
      return projects.filter(project => project.designerId === selectedDesignerId);
    }
    return projects;
  };

  const getCurrentDesigner = () => {
    if (role === 'admin' && selectedDesignerId) {
      return designers.find(d => d.id === selectedDesignerId);
    }
    return null;
  };

  const handleExportAllMaterials = async () => {
    try {
      // Create a comprehensive export of all projects' materials
      const allMaterials: any[] = [];
      
      // For each project, collect all tagged materials
      for (const project of getFilteredProjects()) {
        if (project.images && project.images.length > 0) {
          project.images.forEach((image: any) => {
            if (image.tags && image.tags.length > 0) {
              image.tags.forEach((tag: any) => {
                allMaterials.push({
                  project: project.title || project.name,
                  projectClient: project.client || '',
                  projectDescription: project.description || '',
                  room: image.room || 'Unspecified',
                  imageName: image.name,
                  imageUrl: image.url,
                  productName: tag.productName,
                  productBrand: tag.productBrand,
                  productPrice: tag.productPrice,
                  productUrl: tag.productUrl || '',
                  productDescription: tag.productDescription || '',
                  productCategory: tag.productCategory || '',
                  vendorName: tag.vendorName || tag.productBrand,
                  coordinates: `(${tag.x?.toFixed(1) || 0}%, ${tag.y?.toFixed(1) || 0}%)`,
                  isPending: tag.isPending || false,
                  dateTagged: project.createdAt || new Date().toISOString().split('T')[0]
                });
              });
            }
          });
        }
      }

      if (allMaterials.length === 0) {
        alert('No tagged materials found to export.');
        return;
      }

      // Generate CSV content
      const headers = [
        'Project Name',
        'Client',
        'Project Description',
        'Room',
        'Image Name',
        'Image URL',
        'Product Name',
        'Brand',
        'Price',
        'Product URL',
        'Product Description',
        'Category',
        'Vendor',
        'Tag Coordinates',
        'Status',
        'Date Tagged'
      ];

      const csvRows = [
        headers.join(','),
        ...allMaterials.map(row => [
          `"${row.project}"`,
          `"${row.projectClient}"`,
          `"${row.projectDescription}"`,
          `"${row.room}"`,
          `"${row.imageName}"`,
          `"${row.imageUrl}"`,
          `"${row.productName}"`,
          `"${row.productBrand}"`,
          `"${row.productPrice}"`,
          `"${row.productUrl}"`,
          `"${row.productDescription}"`,
          `"${row.productCategory}"`,
          `"${row.vendorName}"`,
          `"${row.coordinates}"`,
          `"${row.isPending ? 'Pending' : 'Approved'}"`,
          `"${row.dateTagged}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const designerName = getCurrentDesigner()?.name || 'Designer';
      const fileName = `${designerName.replace(/[^a-zA-Z0-9]/g, '_')}_All_Tagged_Materials.csv`;

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export materials. Please try again.');
    }
  };

  const renderProjectCard = (project: any) => (
    <RidgeCard key={project.id} padding="none" className="overflow-hidden">
      <div className="relative">
        <SafeImage
          src={project.images?.[0]?.url || '/placeholder-project.jpg'}
          alt={project.name}
          width={400}
          height={300}
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-3 right-3 flex gap-2">
          {/* Public/Private Toggle */}
          <button
            onClick={() => handleToggleVisibility(project.id, project.visibility)}
            className={`p-2 rounded-full ${
              project.visibility === 'public'
                ? 'bg-green-500 text-white'
                : 'bg-[var(--text-tertiary)] text-white'
            } hover:opacity-80 transition-opacity`}
            title={project.visibility === 'public' ? 'Public (click to make private)' : 'Private (click to make public)'}
          >
            {project.visibility === 'public' ? <FaEye className="w-4 h-4" /> : <FaEyeSlash className="w-4 h-4" />}
          </button>

          {/* Edit Button */}
          <button
            onClick={() => handleEditProject(project)}
            className="p-2 bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-hover)] transition-colors"
            title="Edit Project"
          >
            <FaEdit className="w-4 h-4" />
          </button>

          {/* Publish Button - Only show for draft projects */}
          {(project.status === 'draft' || !project.isPublic) && (
            <PublishButton
              projectId={project.id}
              onPublished={() => loadProjects(selectedDesignerId)}
            />
          )}

          {/* Delete Button */}
          <button
            onClick={() => handleDeleteProject(project.id)}
            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            title="Delete Project"
          >
            <FaTrash className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <Link
            href={`/project/${project.id}`}
            className="folio-h3 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
          >
            {project.name}
          </Link>
          <div className="flex flex-col gap-2">
            {/* Action Buttons for Draft Projects */}
            {(project.status === 'draft' || !project.isPublic) && !project.images?.length && (
              <Link
                href={`/project/${project.id}/setup`}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] rounded-full hover:bg-[var(--accent)]/20 transition-colors"
              >
                <FaUpload className="w-3 h-3" />
                Continue Setup
              </Link>
            )}

            {/* Status Badge */}
            <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded-full ${
              project.status === 'published'
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {project.status === 'published' ? 'Published' : 'Draft'}
            </span>

            {/* Visibility Badge */}
            <span className={`px-2 py-1 text-xs rounded-full ${
              project.visibility === 'public'
                ? 'bg-[var(--accent)]/10 text-[var(--accent-hover)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
            }`}>
              {project.visibility === 'public' ? 'Public' : 'Private'}
            </span>
            </div>
          </div>
        </div>

        <p className="folio-body text-[var(--text-secondary)] mb-3 line-clamp-2">
          {project.description}
        </p>

        <div className="flex justify-between items-center folio-meta">
          <span>{project.category}</span>
          <span>{project.images?.length || 0} images</span>
        </div>

        {project.metrics && (
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border-subtle)] folio-meta">
            <span>{project.metrics.views || 0} views</span>
            <span>{project.metrics.saves || 0} saves</span>
            <span>{project.metrics.shares || 0} shares</span>
          </div>
        )}
      </div>
    </RidgeCard>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Profile Switcher for Designers */}
        {role === 'designer' && (
          <div className="mb-6">
            <h2 className="folio-h3 text-[var(--text-primary)] mb-4">Select Designer Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {designers.map((designer) => (
                <RidgeCard
                  key={designer.id}
                  padding="md"
                  className={`cursor-pointer transition-all ${
                    selectedDesignerId === designer.id
                      ? 'ring-2 ring-[var(--accent)]'
                      : 'hover:shadow-lg'
                  }`}
                  onClick={() => toggleDesignerProfile(designer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-full flex items-center justify-center">
                        <FaUser className="w-5 h-5 text-[var(--accent)]" />
                      </div>
                      <div>
                        <h3 className="font-medium text-[var(--text-primary)]">{designer.name}</h3>
                        <p className="folio-meta">{designer.folders?.length || 0} projects</p>
                      </div>
                    </div>
                    {selectedDesignerId === designer.id ? (
                      <FaToggleOn className="w-6 h-6 text-[var(--accent)]" />
                    ) : (
                      <FaToggleOff className="w-6 h-6 text-[var(--text-tertiary)]" />
                    )}
                  </div>
                </RidgeCard>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="folio-h1 text-[var(--text-primary)]">
              {role === 'admin' && getCurrentDesigner()
                ? `${getCurrentDesigner()?.name}'s Dashboard`
                : 'Designer Dashboard'
              }
            </h1>
            <p className="folio-body text-[var(--text-secondary)]">
              {role === 'admin' && !selectedDesignerId
                ? 'Select a designer profile above to view their dashboard'
                : 'Showcase your work and manage projects'
              }
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ridge"
              onClick={handleExportAllMaterials}
              disabled={role === 'admin' && !selectedDesignerId}
              title="Export all tagged materials as spreadsheet"
            >
              <FaDownload className="mr-2" /> Export Materials
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setEditingProject(null);
                setShowProjectModal(true);
              }}
              disabled={role === 'admin' && !selectedDesignerId}
            >
              <FaPlus className="mr-2" /> Add Project
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 p-1 bg-[var(--bg-elevated)] rounded-xl">
          <button
            className={`px-4 py-2 rounded-lg flex items-center transition-all ${
              activeTab === 'portfolio'
                ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            onClick={() => setActiveTab('portfolio')}
          >
            <FaBriefcase className="mr-2" /> Portfolio
          </button>
          <button
            className={`px-4 py-2 rounded-lg flex items-center transition-all ${
              activeTab === 'projects'
                ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            onClick={() => setActiveTab('projects')}
          >
            <FaBriefcase className="mr-2" /> Projects
          </button>
          <Link
            href="/designer/analytics"
            className="px-4 py-2 rounded-lg flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <FaChartLine className="mr-2" /> Analytics
          </Link>
          <Link
            href="/designer/directory"
            className="px-4 py-2 rounded-lg flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <FaBriefcase className="mr-2" /> Directory
          </Link>
        </div>

        {/* Content */}
        {activeTab === 'portfolio' && (role !== 'admin' || selectedDesignerId) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Show created projects first */}
            {getFilteredProjects().map((project) => renderProjectCard(project))}
            {/* Show mock projects */}
            {mockProjects.map((project) => renderProjectCard(project))}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <RidgeCard padding="lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="folio-h2 text-[var(--text-primary)]">Project Lifecycle</h2>
                <Link href="/designer/create">
                  <Button variant="accent" className="flex items-center gap-2">
                    <FaPlus className="w-4 h-4" />
                    Create New
                  </Button>
                </Link>
              </div>
              <p className="folio-body text-[var(--text-secondary)] mb-4">
                Manage your design projects with room organization, product selections, and spec sheets.
              </p>

              {/* Project Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="ridge-card p-4">
                  <div className="stats-value">{getFilteredProjects().length}</div>
                  <div className="stats-label">Total Projects</div>
                </div>
                <div className="ridge-card p-4">
                  <div className="stats-value">
                    {getFilteredProjects().filter(p => p.status === 'published').length}
                  </div>
                  <div className="stats-label">Published</div>
                </div>
                <div className="ridge-card p-4">
                  <div className="stats-value">
                    {getFilteredProjects().filter(p => p.status === 'draft').length}
                  </div>
                  <div className="stats-label">Drafts</div>
                </div>
                <div className="ridge-card p-4">
                  <div className="stats-value">
                    {getFilteredProjects().reduce((total, p) => total + (p.rooms?.length || 0), 0)}
                  </div>
                  <div className="stats-label">Total Rooms</div>
                </div>
              </div>
            </RidgeCard>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredProjects().map((project) => (
                <RidgeCard key={project.id} padding="none" className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-[var(--bg-elevated)] relative">
                    {project.imageUrl ? (
                      <SafeImage
                        src={project.imageUrl}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaBriefcase className="w-12 h-12 text-[var(--text-tertiary)]" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Link
                        href={`/designer/projects/${project.id}`}
                        className="p-2 bg-[var(--bg-base)] rounded-lg hover:shadow-md transition-all"
                        title="Manage Project"
                      >
                        <FaEdit className="w-4 h-4 text-[var(--text-secondary)]" />
                      </Link>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Link
                        href={`/designer/projects/${project.id}`}
                        className="folio-h3 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                      >
                        {project.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          project.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {project.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>

                    <p className="folio-body text-[var(--text-secondary)] mb-3 line-clamp-2">
                      {project.description}
                    </p>

                    <div className="flex justify-between items-center folio-meta">
                      <span>{project.category}</span>
                      <span>{project.rooms?.length || 0} rooms</span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
                      {project.status !== 'published' && (
                        <Link href={`/project/${project.id}/setup?onboard=1`}>
                          <Button variant="accent" size="sm" className="w-full">
                            <FaUpload className="inline mr-2" />
                            Continue Setup
                          </Button>
                        </Link>
                      )}
                      <Link href={`/designer/projects/${project.id}`}>
                        <Button variant="ridge" size="sm" className="w-full">
                          Manage Project
                        </Button>
                      </Link>
                    </div>
                  </div>
                </RidgeCard>
              ))}
            </div>

            {/* Empty State */}
            {getFilteredProjects().length === 0 && (
              <RidgeCard padding="xl" className="text-center">
                <FaBriefcase className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
                <h3 className="folio-h2 text-[var(--text-primary)] mb-2">No Projects Yet</h3>
                <p className="folio-body text-[var(--text-secondary)] mb-6">
                  Start creating your first design project to organize rooms and selections
                </p>
                <Link href="/designer/create">
                  <Button variant="accent" size="lg" className="inline-flex items-center gap-2">
                    <FaPlus className="w-4 h-4" />
                    Create Your First Project
                  </Button>
                </Link>
              </RidgeCard>
            )}
          </div>
        )}
      </div>

      {/* Project Creation Modal */}
      <ProjectCreationModal
        isOpen={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setEditingProject(null);
        }}
        onProjectCreated={handleProjectCreated}
        editingProject={editingProject}
      />
    </div>
  );
} 