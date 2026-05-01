'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import SafeImage from '../../components/SafeImage';
import { FaPlus, FaEdit, FaTrash, FaChartLine, FaBriefcase, FaUser, FaToggleOn, FaToggleOff, FaDownload, FaUpload, FaInstagram } from 'react-icons/fa';
import ProjectCreationModal from '../../components/ProjectCreationModal';
import { useRole } from '../../contexts/RoleContext';
import { PublishButton } from './PublishButton';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

/* ──── Mosaic grid helpers ──── */

type Size = 'L' | 'M' | 'S';

function assignProjectSizes(projects: any[]): { project: any; size: Size }[] {
  if (projects.length === 0) return [];
  if (projects.length === 1) return [{ project: projects[0], size: 'L' }];

  return projects.map((project, index) => {
    if (index === 0) return { project, size: 'L' as const };
    // With few projects, all non-hero cards are medium for better density
    if (projects.length <= 4 || index <= Math.ceil(projects.length * 0.4)) {
      return { project, size: 'M' as const };
    }
    return { project, size: 'S' as const };
  });
}

function projectSpanFor(size: Size, cols: number) {
  if (size === 'L') {
    const col = cols >= 6 ? 4 : cols >= 4 ? 3 : cols >= 2 ? 2 : 1;
    const row = cols >= 6 ? 34 : cols >= 4 ? 32 : 30;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  if (size === 'M') {
    const col = 2;
    const row = cols >= 4 ? 26 : 24;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  return { colSpan: 1, rowSpan: 18 };
}

function useEstimatedCols() {
  if (typeof window === 'undefined') return 4;
  const w = window.innerWidth;
  if (w >= 1280) return 6;
  if (w >= 1024) return 4;
  if (w >= 640) return 2;
  return 1;
}

/* ──── Component ──── */

export default function DesignerProfile() {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [activeTab, setActiveTab] = useState<'portfolio' | 'projects'>('projects');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>('');
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);

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

      setProjects(prev => prev.filter(p => p.id !== projectId));
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
      const allMaterials: any[] = [];

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

      const headers = [
        'Project Name', 'Client', 'Project Description', 'Room',
        'Image Name', 'Image URL', 'Product Name', 'Brand',
        'Price', 'Product URL', 'Product Description', 'Category',
        'Vendor', 'Tag Coordinates', 'Status', 'Date Tagged'
      ];

      const csvRows = [
        headers.join(','),
        ...allMaterials.map(row => [
          `"${row.project}"`, `"${row.projectClient}"`, `"${row.projectDescription}"`,
          `"${row.room}"`, `"${row.imageName}"`, `"${row.imageUrl}"`,
          `"${row.productName}"`, `"${row.productBrand}"`, `"${row.productPrice}"`,
          `"${row.productUrl}"`, `"${row.productDescription}"`, `"${row.productCategory}"`,
          `"${row.vendorName}"`, `"${row.coordinates}"`,
          `"${row.isPending ? 'Pending' : 'Approved'}"`, `"${row.dateTagged}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const designerName = getCurrentDesigner()?.name || 'Designer';
      const fileName = `${designerName.replace(/[^a-zA-Z0-9]/g, '_')}_All_Tagged_Materials.csv`;

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

  /* ──── Mosaic grid state ──── */

  const cols = useEstimatedCols();
  const filteredProjects = getFilteredProjects();
  const totalProjects = filteredProjects.length;
  const publishedCount = filteredProjects.filter((p: any) => p.status === 'published').length;
  const totalRooms = filteredProjects.reduce((t: number, p: any) => t + (p.rooms?.length || 0), 0);
  const sized = useMemo(() => assignProjectSizes(filteredProjects), [filteredProjects]);

  /* ──── Render a mosaic project card ──── */

  const renderMosaicCard = (project: any, size: Size, linkBase: string) => {
    const { colSpan, rowSpan } = projectSpanFor(size, cols);
    const img = project.images?.[0]?.url || project.imageUrl || project.image;
    const name = project.name || project.title || 'Untitled';
    const href = `${linkBase}/${project.id}`;

    return (
      <article
        key={project.id}
        className={`group relative rounded-[20px] overflow-hidden col-span-${colSpan}`}
        style={{ gridRowEnd: `span ${rowSpan}` }}
      >
        <Link href={href} className="absolute inset-0 z-30 block" aria-label={name} />
        <div className="relative h-full">
          {/* Full-bleed image or warm placeholder */}
          <div className="absolute inset-0">
            {img ? (
              <SafeImage
                src={img}
                alt={name}
                fill
                sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, (max-width:1280px) 33vw, 25vw"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
                <FaBriefcase className="w-12 h-12 text-folio-text-tertiary" />
              </div>
            )}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </div>

          {/* Content overlay — bottom */}
          <div className="relative z-20 pointer-events-none flex h-full items-end p-3">
            <div className="text-white w-full">
              <div className={`font-semibold leading-tight ${
                size === 'L' ? 'text-xl' : size === 'M' ? 'text-lg' : 'text-sm'
              }`}>
                {name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-white/85 text-[var(--type-eyebrow)]">
                {project.status === 'draft' && (
                  <span className="inline-flex items-center bg-[rgba(30,30,30,0.7)] px-1.5 py-0.5 rounded backdrop-blur-sm font-sans font-medium uppercase tracking-wide">
                    Draft
                  </span>
                )}
                {project.category && (
                  <span className="inline-flex items-center bg-black/45 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {project.category}
                  </span>
                )}
                {(project.rooms?.length || 0) > 0 && (
                  <span className="inline-flex items-center bg-black/45 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {project.rooms.length} room{project.rooms.length !== 1 ? 's' : ''}
                  </span>
                )}
                {(project.images?.length || 0) > 0 && (
                  <span className="inline-flex items-center bg-black/45 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {project.images.length} image{project.images.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Hover: manage affordance */}
          <div className="absolute top-2 right-2 z-40 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
            {project.status === 'draft' && !project.id?.startsWith('mock') && (
              <Link
                href={`/project/${project.id}/setup?onboard=1`}
                className="rounded bg-black/60 text-white text-[var(--type-eyebrow)] px-2 py-1 hover:bg-black/80"
                onClick={(e) => e.stopPropagation()}
              >
                <FaUpload className="inline w-3 h-3 mr-1" />
                Setup
              </Link>
            )}
            {project.status === 'published' && !project.id?.startsWith('mock') && (
              <Link
                href={`/designer/projects/${project.id}/instagram`}
                className="rounded bg-black/60 text-white text-[var(--type-eyebrow)] px-2 py-1 hover:bg-black/80"
                onClick={(e) => e.stopPropagation()}
              >
                <FaInstagram className="inline w-3 h-3 mr-1" />
                Instagram
              </Link>
            )}
            {!project.id?.startsWith('mock') && (
              <Link
                href={`/project/${project.id}?view=media`}
                className="rounded bg-black/60 text-white text-[var(--type-eyebrow)] px-2 py-1 hover:bg-black/80"
                onClick={(e) => e.stopPropagation()}
              >
                ✎ Manage
              </Link>
            )}
          </div>
        </div>
      </article>
    );
  };

  /* ──── Mosaic grid wrapper ──── */

  const renderMosaicGrid = (projectList: any[], linkBase: string) => {
    const gridSized = assignProjectSizes(projectList);
    return (
      <div className="grid grid-flow-dense gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 auto-rows-[8px]">
        {gridSized.map(({ project, size }) => renderMosaicCard(project, size, linkBase))}
      </div>
    );
  };

  /* ──── Empty state ──── */

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-surface-elevated rounded-[20px] flex items-center justify-center mb-4">
        <FaBriefcase className="w-8 h-8 text-folio-text-tertiary" />
      </div>
      <h3 className="font-serif text-xl text-folio-text-primary mb-2">No Projects Yet</h3>
      <p className="text-sm text-folio-text-secondary mb-6">
        Create your first project to get started
      </p>
      <Link href="/designer/create">
        <Button variant="accent" className="inline-flex items-center gap-2">
          <FaPlus className="w-4 h-4" />
          Create Your First Project
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Profile Switcher — only for admin with loaded designers */}
      {role === 'admin' && designers.length > 0 && (
        <div className="mb-4">
          <h2 className="font-serif text-lg font-medium text-folio-text-primary mb-3">Select Designer Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {designers.map((designer) => (
              <RidgeCard
                key={designer.id}
                padding="sm"
                className={`cursor-pointer transition-all ${
                  selectedDesignerId === designer.id
                    ? 'ring-2 ring-[var(--accent)]'
                    : 'hover:shadow-lg'
                }`}
                onClick={() => toggleDesignerProfile(designer.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-full flex items-center justify-center">
                      <FaUser className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-folio-text-primary">{designer.name}</h3>
                      <p className="text-xs text-folio-text-secondary">{designer.folders?.length || 0} projects</p>
                    </div>
                  </div>
                  {selectedDesignerId === designer.id ? (
                    <FaToggleOn className="w-5 h-5 text-[var(--accent)]" />
                  ) : (
                    <FaToggleOff className="w-5 h-5 text-folio-text-tertiary" />
                  )}
                </div>
              </RidgeCard>
            ))}
          </div>
        </div>
      )}

      {/* ── Compact Header Band ── */}
      <div className="flex items-center justify-between py-4">
        <div>
          <h1 className="font-serif text-2xl font-medium text-folio-text-primary leading-tight">
            {role === 'admin' && getCurrentDesigner()
              ? `${getCurrentDesigner()?.name}'s Projects`
              : 'My Projects'
            }
          </h1>
          {(role !== 'admin' || selectedDesignerId) && (
            <span className="font-sans text-sm text-folio-text-secondary">
              {totalProjects} project{totalProjects !== 1 ? 's' : ''}
              {' · '}{publishedCount} published
              {totalRooms > 0 && <> · {totalRooms} room{totalRooms !== 1 ? 's' : ''}</>}
            </span>
          )}
          {role === 'admin' && !selectedDesignerId && (
            <span className="font-sans text-sm text-folio-text-secondary">
              Select a designer profile above to view their projects
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="ridge"
            onClick={handleExportAllMaterials}
            disabled={role === 'admin' && !selectedDesignerId}
            title="Export all tagged materials as spreadsheet"
          >
            <FaDownload className="mr-2" /> Export
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              setEditingProject(null);
              setShowProjectModal(true);
            }}
            disabled={role === 'admin' && !selectedDesignerId}
          >
            <FaPlus className="mr-2" /> Create Project
          </Button>
        </div>
      </div>

      {/* ── Compact Tabs ── */}
      <div className="flex items-center gap-1 mb-4 border-b border-folio-border-subtle">
        <button
          className={`px-3 py-2 text-sm font-sans transition-colors border-b-2 -mb-px ${
            activeTab === 'projects'
              ? 'border-folio-text-secondary text-folio-text-primary font-medium'
              : 'border-transparent text-folio-text-secondary hover:text-folio-text-primary'
          }`}
          onClick={() => setActiveTab('projects')}
        >
          Projects
        </button>
        <button
          className={`px-3 py-2 text-sm font-sans transition-colors border-b-2 -mb-px ${
            activeTab === 'portfolio'
              ? 'border-folio-text-secondary text-folio-text-primary font-medium'
              : 'border-transparent text-folio-text-secondary hover:text-folio-text-primary'
          }`}
          onClick={() => setActiveTab('portfolio')}
        >
          Portfolio
        </button>
        <Link
          href="/designer/analytics"
          className="px-3 py-2 text-sm font-sans text-folio-text-secondary hover:text-folio-text-primary transition-colors border-b-2 border-transparent -mb-px"
        >
          Analytics
        </Link>
        <Link
          href="/designer/sourcebook"
          className="px-3 py-2 text-sm font-sans text-folio-text-secondary hover:text-folio-text-primary transition-colors border-b-2 border-transparent -mb-px"
        >
          Sourcebook
        </Link>
      </div>

      {/* ── Content ── */}
      {activeTab === 'projects' && (
        <>
          {filteredProjects.length > 0
            ? renderMosaicGrid(filteredProjects, '/designer/projects')
            : renderEmptyState()
          }
        </>
      )}

      {activeTab === 'portfolio' && (role !== 'admin' || selectedDesignerId) && (
        <>
          {filteredProjects.length > 0
            ? renderMosaicGrid(filteredProjects, '/project')
            : renderEmptyState()
          }
        </>
      )}

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
