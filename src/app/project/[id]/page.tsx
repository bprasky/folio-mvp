'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FaArrowLeft, FaTag, FaShareAlt, FaHeart, FaBookmark, FaTimes, FaDownload, FaEdit, FaSave, FaPlus, FaTrash, FaFilePdf, FaPrint, FaPencilAlt, FaEye, FaUser, FaCalendarAlt, FaBuilding } from 'react-icons/fa';
import Navigation from '../../../components/Navigation';
import { useRole } from '../../../contexts/RoleContext';

interface ProjectImage {
  id: string;
  url: string;
  name: string;
  room?: string;
  tags: Array<{
    id: string;
    x: number;
    y: number;
    productId: string;
    productName: string;
    productImage: string;
    productPrice: number;
    productBrand: string;
    isPending?: boolean;
  }>;
}

interface ContentTimelineItem {
  type: 'story' | 'video' | 'editorial';
  id: string;
  title: string;
  imageUrl?: string;
  videoUrl?: string;
  description?: string;
  content?: string;
  isPortrait?: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  client: string;
  designerId: string;
  images: ProjectImage[];
  createdAt: string;
  status: string;
  metrics: {
    views?: number;
    saves?: number;
    shares?: number;
  };
  // Enhanced fields for rich project display
  heroImage?: string;
  tags?: string[];
  specs?: {
    squareFootage?: string;
    location?: string;
    completionDate?: string;
    materials?: string[];
  };
  contentTimeline?: ContentTimelineItem[];
  designerQuote?: {
    quote: string;
    designerName: string;
    designerProfileImage: string;
  };
  engagement?: {
    saves: number;
    likes: number;
    clickThroughs: number;
  };
  // Editorial submission fields
  submittedToEditorial?: boolean;
  editorialSubmissionDate?: string;
  isEditorialApproved?: boolean;
  editorialApprovalDate?: string;
  editorialRejectionReason?: string;
}

interface Designer {
  id: string;
  name: string;
  bio: string;
  profileImage: string;
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const { role } = useRole();
  const [project, setProject] = useState<Project | null>(null);
  const [designer, setDesigner] = useState<Designer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [showTags, setShowTags] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Project | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const isDesigner = role === 'designer' || role === 'admin';

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        
        // Fetch all projects to find the one we need
        const projectsResponse = await fetch('/api/projects?includeDrafts=true');
        const projects = await projectsResponse.json();
        
        const foundProject = projects.find((p: Project) => p.id === projectId);
        
        if (!foundProject) {
          setError('Project not found');
          return;
        }
        
        setProject(foundProject);
        
        // Fetch designer info
        if (foundProject.designerId) {
          const designersResponse = await fetch('/api/admin/designers');
          const designers = await designersResponse.json();
          const foundDesigner = designers.find((d: Designer) => d.id === foundProject.designerId);
          setDesigner(foundDesigner || null);
        }
      } catch (err) {
        console.error('Error fetching project data:', err);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const handleSave = async () => {
    if (!editedProject) return;
    
    try {
      const response = await fetch('/api/projects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedProject),
      });

      if (response.ok) {
        setProject(editedProject);
        setIsEditing(false);
        alert('Project updated successfully!');
      } else {
        throw new Error('Failed to update project');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project. Please try again.');
    }
  };

  const handleSubmitToEditorial = async () => {
    if (!project) return;
    
    // Check if project has sufficient content for editorial
    if (!project.description || project.images.length === 0) {
      alert('Please ensure your project has a description and at least one image before submitting to editorial.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to submit this project for editorial review? Once submitted, it will be reviewed by our editorial team.'
    );
    
    if (!confirmed) return;

    try {
      const response = await fetch('/api/editorial-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          projectId: project.id,
          designerId: project.designerId 
        }),
      });

      if (response.ok) {
        const updatedProject = {
          ...project,
          submittedToEditorial: true,
          editorialSubmissionDate: new Date().toISOString()
        };
        setProject(updatedProject);
        alert('Project successfully submitted for editorial review! You will be notified once it has been reviewed.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit project');
      }
    } catch (error) {
      console.error('Error submitting to editorial:', error);
      alert('Failed to submit project for editorial review. Please try again.');
    }
  };

  const openLightbox = (image: ProjectImage) => {
    setSelectedImage(image);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setSelectedImage(null);
  };

  const handleExport = async (format: 'csv' | 'json' = 'csv', room?: string) => {
    try {
      const params = new URLSearchParams({
        projectId: projectId,
        format: format
      });
      
      if (room) {
        params.append('room', room);
      }

      const response = await fetch(`/api/export-project-tags?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_Tagged_Materials${room ? `_${room}` : ''}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_Tagged_Materials${room ? `_${room}` : ''}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export project data. Please try again.');
    }
  };

  const handleTearsheetExport = async (room?: string) => {
    try {
      const params = new URLSearchParams({
        projectId: projectId
      });
      
      if (room) {
        params.append('room', room);
      }

      const response = await fetch(`/api/export-tearsheet?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Tearsheet export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_Tearsheet${room ? `_${room}` : ''}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Tearsheet export failed:', error);
      alert('Failed to generate tearsheet. Please try again.');
    }
  };

  const handleAdvancedExport = () => {
    // Get unique rooms from project
    const rooms = Array.from(new Set(
      project?.images
        ?.filter(img => img.room)
        .map(img => img.room!)
    )) || [];

    const exportOptions = [
      { label: 'All Rooms - CSV Spreadsheet', action: () => handleExport('csv') },
      { label: 'All Rooms - PDF Tear Sheet', action: () => handleTearsheetExport() },
      ...rooms.map(room => ({
        label: `${room} Only - CSV`,
        action: () => handleExport('csv', room)
      })),
      ...rooms.map(room => ({
        label: `${room} Only - PDF Tear Sheet`,
        action: () => handleTearsheetExport(room)
      }))
    ];

    // Create a simple modal for export options
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Export Options</h3>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          ${exportOptions.map((option, index) => `
            <button 
              class="w-full text-left p-3 rounded hover:bg-gray-100 transition border"
              data-option="${index}"
            >
              ${option.label}
            </button>
          `).join('')}
        </div>
        <button 
          class="mt-4 w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600 transition"
          id="close-modal"
        >
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelectorAll('[data-option]').forEach((button, index) => {
      button.addEventListener('click', () => {
        exportOptions[index].action();
        document.body.removeChild(modal);
      });
    });

    modal.querySelector('#close-modal')?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  };

  const addContentItem = (type: 'story' | 'video' | 'editorial') => {
    if (!editedProject) return;
    
    const newItem: ContentTimelineItem = {
      type,
      id: `${type}-${Date.now()}`,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      description: `Add your ${type} description here...`,
      imageUrl: type !== 'video' ? 'https://via.placeholder.com/400x300' : undefined,
      videoUrl: type === 'video' ? '' : undefined,
    };

    setEditedProject({
      ...editedProject,
      contentTimeline: [...(editedProject.contentTimeline || []), newItem]
    });
  };

  const updateContentItem = (itemId: string, field: string, value: string) => {
    if (!editedProject) return;
    
    setEditedProject({
      ...editedProject,
      contentTimeline: editedProject.contentTimeline?.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      ) || []
    });
  };

  const removeContentItem = (itemId: string) => {
    if (!editedProject) return;
    
    setEditedProject({
      ...editedProject,
      contentTimeline: editedProject.contentTimeline?.filter(item => item.id !== itemId) || []
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Project Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The project you\'re looking for doesn\'t exist.'}</p>
          <Link
            href="/designer"
            className="bg-amber-500 text-black px-6 py-3 rounded-lg hover:bg-amber-600 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentProject = isEditing ? editedProject! : project;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDesignerSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-');
  };

  const currentImage = currentProject.images[selectedImageIndex];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Back Button & Edit Controls */}
      <div className="p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/designer" className="flex items-center text-blue-600 hover:underline">
            <FaArrowLeft className="mr-2" /> Back to Designer Profile
          </Link>
          
          {isDesigner && (
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
        <Image
          src={currentProject.heroImage || currentProject.images[0]?.url || 'https://via.placeholder.com/1600x900'}
          alt={currentProject.name}
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80"></div>
        
        <div className="relative z-10 text-white w-full">
          {isEditing ? (
            <input
              type="text"
              value={currentProject.name}
              onChange={(e) => setEditedProject({ ...currentProject, name: e.target.value })}
              className="text-5xl md:text-7xl font-bold mb-4 bg-transparent border-b-2 border-white/50 text-white placeholder-white/70 w-full"
              placeholder="Project Title"
            />
          ) : (
            <h1 className="text-5xl md:text-7xl font-bold mb-4">{currentProject.name}</h1>
          )}
          
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={currentProject.designerQuote?.designerProfileImage || '/images/designers/default-designer.jpg'}
                  alt="Designer"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-lg md:text-xl text-gray-300">
                By {currentProject.designerQuote?.designerName || 'Designer'}
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {currentProject.tags?.map(tag => (
              <span key={tag} className="bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-full flex items-center">
                <FaTag className="mr-1" /> {tag}
              </span>
            ))}
            {isEditing && (
              <button
                onClick={() => {
                  const newTag = prompt('Enter new tag:');
                  if (newTag) {
                    setEditedProject({
                      ...currentProject,
                      tags: [...(currentProject.tags || []), newTag]
                    });
                  }
                }}
                className="bg-amber-500 text-black text-sm px-3 py-1 rounded-full flex items-center hover:bg-amber-600 transition-colors"
              >
                <FaPlus className="mr-1" /> Add Tag
              </button>
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
                value={currentProject.description}
                onChange={(e) => setEditedProject({ ...currentProject, description: e.target.value })}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg mb-6 resize-none"
                placeholder="Project description..."
              />
            ) : (
              <p className="text-gray-700 leading-relaxed mb-6">{currentProject.description}</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
              <div>
                <span className="font-semibold">Size:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject.specs?.squareFootage || ''}
                    onChange={(e) => setEditedProject({
                      ...currentProject,
                      specs: { ...currentProject.specs, squareFootage: e.target.value }
                    })}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded"
                    placeholder="e.g., 350 sq ft"
                  />
                ) : (
                  <span className="ml-2">{currentProject.specs?.squareFootage || 'Not specified'}</span>
                )}
              </div>
              
              <div>
                <span className="font-semibold">Location:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject.specs?.location || ''}
                    onChange={(e) => setEditedProject({
                      ...currentProject,
                      specs: { ...currentProject.specs, location: e.target.value }
                    })}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded"
                    placeholder="e.g., New York City, USA"
                  />
                ) : (
                  <span className="ml-2">{currentProject.specs?.location || 'Not specified'}</span>
                )}
              </div>
              
              <div>
                <span className="font-semibold">Completed:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject.specs?.completionDate || ''}
                    onChange={(e) => setEditedProject({
                      ...currentProject,
                      specs: { ...currentProject.specs, completionDate: e.target.value }
                    })}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded"
                    placeholder="e.g., Spring 2023"
                  />
                ) : (
                  <span className="ml-2">{currentProject.specs?.completionDate || 'Not specified'}</span>
                )}
              </div>
              
              <div>
                <span className="font-semibold">Materials:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject.specs?.materials?.join(', ') || ''}
                    onChange={(e) => setEditedProject({
                      ...currentProject,
                      specs: { 
                        ...currentProject.specs, 
                        materials: e.target.value.split(',').map(m => m.trim()).filter(m => m)
                      }
                    })}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded"
                    placeholder="e.g., Oak Wood, Concrete, Linen"
                  />
                ) : (
                  <span className="ml-2">{currentProject.specs?.materials?.join(', ') || 'Not specified'}</span>
                )}
              </div>
            </div>
          </section>

          {/* Story + Content Timeline */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">Project Journey</h2>
              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => addContentItem('story')}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    + Story
                  </button>
                  <button
                    onClick={() => addContentItem('video')}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    + Video
                  </button>
                  <button
                    onClick={() => addContentItem('editorial')}
                    className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
                  >
                    + Editorial
                  </button>
                </div>
              )}
            </div>
            
            {currentProject.contentTimeline?.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateContentItem(item.id, 'title', e.target.value)}
                      className="text-2xl font-semibold border-b border-gray-300 bg-transparent flex-1 mr-4"
                    />
                  ) : (
                    <h3 className="text-2xl font-semibold">{item.title}</h3>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => removeContentItem(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
                
                {item.type === "story" && item.imageUrl && (
                  <div className="relative w-full h-80 rounded-lg overflow-hidden mb-4">
                    <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    {isEditing && (
                      <div className="absolute top-2 right-2">
                        <input
                          type="url"
                          value={item.imageUrl}
                          onChange={(e) => updateContentItem(item.id, 'imageUrl', e.target.value)}
                          className="px-2 py-1 text-xs bg-white/90 rounded"
                          placeholder="Image URL"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {item.type === "video" && (
                  <div className="relative w-full h-96 mb-4 rounded-lg overflow-hidden">
                    {isEditing ? (
                      <input
                        type="url"
                        value={item.videoUrl || ''}
                        onChange={(e) => updateContentItem(item.id, 'videoUrl', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded"
                        placeholder="YouTube embed URL"
                      />
                    ) : item.videoUrl ? (
                      <iframe
                        src={item.videoUrl}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute top-0 left-0 w-full h-full"
                      ></iframe>
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <p className="text-gray-500">No video URL provided</p>
                      </div>
                    )}
                  </div>
                )}
                
                {item.type === "editorial" && item.imageUrl && (
                  <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4">
                    <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                    {isEditing && (
                      <div className="absolute top-2 right-2">
                        <input
                          type="url"
                          value={item.imageUrl}
                          onChange={(e) => updateContentItem(item.id, 'imageUrl', e.target.value)}
                          className="px-2 py-1 text-xs bg-white/90 rounded"
                          placeholder="Image URL"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {isEditing ? (
                  <textarea
                    value={item.description || item.content || ''}
                    onChange={(e) => updateContentItem(item.id, item.description ? 'description' : 'content', e.target.value)}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded resize-none"
                    placeholder="Content description..."
                  />
                ) : (
                  <p className="text-gray-700 leading-relaxed">{item.description || item.content}</p>
                )}
              </div>
            ))}
            
            {(!currentProject.contentTimeline || currentProject.contentTimeline.length === 0) && !isEditing && (
              <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <p className="text-gray-500">No project journey content yet.</p>
                {isDesigner && (
                  <p className="text-sm text-gray-400 mt-2">Click "Edit Project" to add stories, videos, and editorial content.</p>
                )}
              </div>
            )}
          </section>

          {/* Tagged Image Gallery */}
          <section className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">Tagged Designs</h2>
              <button
                onClick={() => setShowTags(!showTags)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  showTags 
                    ? 'bg-amber-500 text-black' 
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                <FaTag className="w-4 h-4 inline mr-2" />
                {showTags ? 'Hide Tags' : 'Show Tags'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
              {currentProject.images.map((img) => (
                <div 
                  key={img.id} 
                  className="relative group cursor-pointer overflow-hidden rounded-lg shadow-sm hover:shadow-lg transition-all duration-300"
                  onClick={() => openLightbox(img)}
                >
                  <Image 
                    src={img.url} 
                    alt="Tagged design"
                    width={800}
                    height={600}
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Product Tags */}
                  {showTags && img.tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="absolute w-6 h-6 bg-amber-500 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform group-hover:animate-pulse"
                      style={{
                        left: `${tag.x}%`,
                        top: `${tag.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      title={`${tag.productName} - $${tag.productPrice}`}
                    >
                      <div className="w-full h-full rounded-full bg-amber-500"></div>
                    </div>
                  ))}
                  
                  {img.tags && img.tags.length > 0 && (
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {img.tags.map((tag, index) => (
                        <span 
                          key={index} 
                          className="bg-black/70 text-white text-xs px-2 py-1 rounded-full"
                        >
                          {tag.productName}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Room Label */}
                  {img.room && (
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                      {img.room}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Tagged Products Summary */}
          {currentProject.images.some(img => img.tags.length > 0) && (
            <section className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-3xl font-bold mb-6">Products Used in This Project</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {currentProject.images
                  .flatMap(img => img.tags)
                  .filter((tag, index, self) => 
                    index === self.findIndex(t => t.productId === tag.productId)
                  )
                  .map((tag) => (
                    <div key={tag.productId} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
                      <div className="relative h-28">
                        <Image src={tag.productImage} alt={tag.productName} fill className="object-cover" />
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-sm mb-1">{tag.productName}</h3>
                        <p className="text-xs text-gray-600 mb-1">{tag.productBrand}</p>
                        <p className="text-amber-600 font-bold text-sm">${tag.productPrice}</p>
                        <button className="mt-2 w-full bg-amber-500 text-black text-xs px-3 py-2 rounded-full font-semibold hover:bg-amber-600 transition">
                          Add to Mood Board
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar Column */}
        <aside className="lg:col-span-1 space-y-8">
          {/* Project Stats */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Insights</h2>
            <div className="space-y-3">
              <p className="flex justify-between items-center text-lg">
                <span>Views:</span> 
                <span className="font-bold text-blue-600">{currentProject.engagement?.likes?.toLocaleString() || 0}</span>
              </p>
              <p className="flex justify-between items-center text-lg">
                <span>Saves:</span> 
                <span className="font-bold text-green-600">{currentProject.engagement?.saves?.toLocaleString() || 0}</span>
              </p>
              <p className="flex justify-between items-center text-lg">
                <span>Product Clicks:</span> 
                <span className="font-bold text-amber-600">{currentProject.engagement?.clickThroughs?.toLocaleString() || 0}</span>
              </p>
            </div>
          </div>

          {/* Designer Quote */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={currentProject.designerQuote?.quote || ''}
                  onChange={(e) => setEditedProject({
                    ...currentProject,
                    designerQuote: {
                      ...currentProject.designerQuote!,
                      quote: e.target.value
                    }
                  })}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  placeholder="Designer quote..."
                />
                <input
                  type="text"
                  value={currentProject.designerQuote?.designerName || ''}
                  onChange={(e) => setEditedProject({
                    ...currentProject,
                    designerQuote: {
                      ...currentProject.designerQuote!,
                      designerName: e.target.value
                    }
                  })}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  placeholder="Designer name..."
                />
              </div>
            ) : (
              <>
                <p className="italic text-gray-700 mb-4 text-lg">"{currentProject.designerQuote?.quote}"</p>
                <div className="flex items-center">
                  <Image
                    src={currentProject.designerQuote?.designerProfileImage || '/images/designers/default-designer.jpg'}
                    alt={currentProject.designerQuote?.designerName || 'Designer'}
                    width={40}
                    height={40}
                    className="rounded-full mr-3"
                  />
                  <p className="font-semibold text-blue-700">- {currentProject.designerQuote?.designerName}</p>
                </div>
              </>
            )}
          </div>

          {/* Project Files & Downloads */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Files & Downloads</h2>
            <div className="space-y-3">
              <button 
                onClick={() => handleAdvancedExport()}
                className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-full font-medium hover:bg-gray-300 transition"
              >
                <FaDownload className="mr-2" /> Tagged Materials (Advanced)
              </button>
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                <FaFilePdf className="mr-2" /> Project Summary (PDF)
              </button>
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                <FaDownload className="mr-2" /> Designer Boards (PDF)
              </button>
            </div>
          </section>

          {/* Share & Submit */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Share & Submit</h2>
            <div className="space-y-3">
              {/* Editorial Submission Button */}
              {!currentProject.submittedToEditorial ? (
                <button 
                  onClick={handleSubmitToEditorial}
                  className="flex items-center w-full bg-blue-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
                >
                  <FaPencilAlt className="mr-2" /> Submit to Folio Editorial
                </button>
              ) : currentProject.isEditorialApproved ? (
                <div className="w-full bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-full font-semibold flex items-center">
                  <FaEye className="mr-2" /> Editorial Published
                  {currentProject.editorialApprovalDate && (
                    <span className="text-xs ml-2">
                      ({formatDate(currentProject.editorialApprovalDate)})
                    </span>
                  )}
                </div>
              ) : currentProject.editorialRejectionReason ? (
                <div className="w-full">
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-full font-semibold flex items-center mb-2">
                    <FaTimes className="mr-2" /> Editorial Declined
                  </div>
                  <p className="text-xs text-red-600 px-2">
                    Reason: {currentProject.editorialRejectionReason}
                  </p>
                </div>
              ) : (
                <div className="w-full bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-full font-semibold flex items-center">
                  <FaCalendarAlt className="mr-2" /> Submitted - Awaiting Review
                  {currentProject.editorialSubmissionDate && (
                    <span className="text-xs ml-2">
                      ({formatDate(currentProject.editorialSubmissionDate)})
                    </span>
                  )}
                </div>
              )}
              
              <button className="flex items-center w-full bg-green-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-green-700 transition">
                <FaPrint className="mr-2" /> Generate Print-Friendly Version
              </button>
              <button className="flex items-center w-full bg-gray-700 text-white px-4 py-2 rounded-full font-semibold hover:bg-gray-600 transition">
                <FaShareAlt className="mr-2" /> Share Link with Client
              </button>
            </div>
          </section>
        </aside>
      </main>

      {/* Lightbox for Tagged Images */}
      {lightboxOpen && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={closeLightbox}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={closeLightbox} 
              className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full z-10 hover:bg-white/40 transition"
            >
              <FaTimes className="text-xl" />
            </button>
            <Image 
              src={selectedImage.url} 
              alt="Full screen tagged design"
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
            
            {/* Tags in lightbox */}
            {showTags && selectedImage.tags.map((tag) => (
              <div
                key={tag.id}
                className="absolute w-8 h-8 bg-amber-500 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform"
                style={{
                  left: `${tag.x}%`,
                  top: `${tag.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                title={`${tag.productName} - $${tag.productPrice}`}
              >
                <div className="w-full h-full rounded-full bg-amber-500"></div>
              </div>
            ))}
            
            {selectedImage.tags && selectedImage.tags.length > 0 && (
              <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                {selectedImage.tags.map((tag, index) => (
                  <div 
                    key={index} 
                    className="bg-amber-500 text-black text-sm px-3 py-1 rounded-full font-semibold"
                  >
                    {tag.productName}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 