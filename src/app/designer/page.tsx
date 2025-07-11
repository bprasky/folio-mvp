'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '../../components/SafeImage';
import { FaPlus, FaEdit, FaTrash, FaChartLine, FaBriefcase, FaUser, FaToggleOn, FaToggleOff, FaDownload, FaEye, FaEyeSlash, FaExternalLinkAlt, FaSync } from 'react-icons/fa';
import ProjectCreationModal from '../../components/ProjectCreationModal';
import ProfileSwitcher from '../../components/ProfileSwitcher';
import { useRole } from '../../contexts/RoleContext';

export default function DesignerProfile() {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [activeTab, setActiveTab] = useState<'portfolio' | 'projects'>('portfolio');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>('');
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [reimporting, setReimporting] = useState(false);

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

  const handleReimport = async () => {
    if (!confirm('This will reimport your website portfolio. Any existing projects may be updated or replaced. Continue?')) {
      return;
    }

    setReimporting(true);
    try {
      // Get current user's website
      const currentUser = designers.find(d => d.id === selectedDesignerId) || 
                         (role === 'designer' ? { website: '' } : null);
      
      if (!currentUser?.website) {
        alert('No website found for reimport. Please update your profile with your website URL first.');
        return;
      }

      // Call the reimport API
      const response = await fetch('/api/reimport-portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedDesignerId,
          website: currentUser.website
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Reimport completed! ${result.projectsCreated} projects created/updated.`);
        // Refresh projects
        loadProjects(selectedDesignerId);
      } else {
        const error = await response.json();
        alert(`Reimport failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error during reimport:', error);
      alert('Reimport failed. Please try again.');
    } finally {
      setReimporting(false);
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
    <div key={project.id} className="bg-white rounded-lg shadow-md overflow-hidden">
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
                : 'bg-gray-500 text-white'
            } hover:opacity-80 transition-opacity`}
            title={project.visibility === 'public' ? 'Public (click to make private)' : 'Private (click to make public)'}
          >
            {project.visibility === 'public' ? <FaEye className="w-4 h-4" /> : <FaEyeSlash className="w-4 h-4" />}
          </button>
          
          {/* Edit Button */}
          <button
            onClick={() => handleEditProject(project)}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
            title="Edit Project"
          >
            <FaEdit className="w-4 h-4" />
          </button>
          
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
            className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
          >
            {project.name}
          </Link>
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <span className={`px-2 py-1 text-xs rounded-full ${
              project.status === 'published' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {project.status === 'published' ? 'Published' : 'Draft'}
            </span>
            
            {/* Visibility Badge */}
            <span className={`px-2 py-1 text-xs rounded-full ${
              project.visibility === 'public' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {project.visibility === 'public' ? 'Public' : 'Private'}
            </span>
          </div>
        </div>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {project.description}
        </p>
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>{project.category}</span>
          <span>{project.images?.length || 0} images</span>
        </div>
        
        {project.metrics && (
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{project.metrics.views || 0} views</span>
            <span>{project.metrics.saves || 0} saves</span>
            <span>{project.metrics.shares || 0} shares</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Navigation */}
      {/* Main Content */}
      <div className="flex-1   overflow-y-auto p-6">
        {/* Profile Switcher for Designers */}
        {role === 'designer' && (
          <ProfileSwitcher onProfileChange={handleProfileChange} />
        )}
        
        {/* Admin Designer Selection */}
        {role === 'admin' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Select Designer Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {designers.map((designer) => (
                <div
                  key={designer.id}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedDesignerId === designer.id
                      ? 'border-purple-500 bg-purple-900/20'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                  }`}
                  onClick={() => toggleDesignerProfile(designer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <FaUser className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{designer.name}</h3>
                        <p className="text-sm text-gray-400">{designer.folders?.length || 0} projects</p>
                      </div>
                    </div>
                    {selectedDesignerId === designer.id ? (
                      <FaToggleOn className="w-6 h-6 text-purple-500" />
                    ) : (
                      <FaToggleOff className="w-6 h-6 text-gray-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {role === 'admin' && getCurrentDesigner() 
                ? `${getCurrentDesigner()?.name}'s Dashboard` 
                : 'Designer Dashboard'
              }
            </h1>
            <p className="text-gray-400">
              {role === 'admin' && !selectedDesignerId 
                ? 'Select a designer profile above to view their dashboard'
                : 'Showcase your work and manage projects'
              }
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleReimport}
              disabled={reimporting || (role === 'admin' && !selectedDesignerId)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
              title="Reimport portfolio from website"
            >
              <FaSync className={`mr-2 ${reimporting ? 'animate-spin' : ''}`} />
              {reimporting ? 'Reimporting...' : 'Reimport Portfolio'}
            </button>
            <button 
              onClick={handleExportAllMaterials}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
              disabled={role === 'admin' && !selectedDesignerId}
              title="Export all tagged materials as spreadsheet"
            >
              <FaDownload className="mr-2" /> Export Materials
            </button>
            <button 
              onClick={() => {
                setEditingProject(null);
                setShowProjectModal(true);
              }}
              className="bg-gradient-to-r from-amber-500 to-pink-500 text-white px-6 py-2 rounded-md flex items-center"
              disabled={role === 'admin' && !selectedDesignerId}
            >
              <FaPlus className="mr-2" /> Add Project
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            className={`px-4 py-2 rounded-md flex items-center ${
              activeTab === 'portfolio' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('portfolio')}
          >
            <FaBriefcase className="mr-2" /> Portfolio
          </button>
          <button
            className={`px-4 py-2 rounded-md flex items-center ${
              activeTab === 'projects' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('projects')}
          >
            <FaBriefcase className="mr-2" /> Projects
          </button>
          <Link
            href="/designer/analytics"
            className="px-4 py-2 rounded-md flex items-center text-gray-400 hover:text-white"
          >
            <FaChartLine className="mr-2" /> Analytics
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
          <div className="glass-panel p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Active Projects</h2>
            <p className="text-gray-400">Project management content coming soon...</p>
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