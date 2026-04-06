'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  X,
  Clock,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
  Check,
  FolderPlus,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  ownershipContext?: 'personal' | 'organization';
  organizationName?: string | null;
  updatedAt?: string;
}

interface AddToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  eventId?: string;
  eventTitle?: string;
  onSuccess?: (projectId: string) => void;
}

// Local storage key for recent projects
const RECENT_PROJECTS_KEY = 'folio-recent-projects';
const MAX_RECENT_PROJECTS = 5;

export default function AddToProjectModal({
  isOpen,
  onClose,
  productId,
  eventId,
  eventTitle,
  onSuccess,
}: AddToProjectModalProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [multiSelect, setMultiSelect] = useState(false);
  const [createNew, setCreateNew] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState(
    eventTitle ? `Project from ${eventTitle}` : 'New Project'
  );

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    recent: true,
    personal: true,
    organization: true,
  });

  // Get recent projects from localStorage
  const recentProjectIds = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [isOpen]);

  // Group projects by context
  const groupedProjects = useMemo(() => {
    const recent: Project[] = [];
    const personal: Project[] = [];
    const organization: Project[] = [];

    // Get recent projects first
    recentProjectIds.forEach((id: string) => {
      const project = projects.find(p => p.id === id);
      if (project) recent.push(project);
    });

    // Group remaining by context
    projects.forEach(project => {
      if (project.ownershipContext === 'organization') {
        organization.push(project);
      } else {
        personal.push(project);
      }
    });

    return { recent, personal, organization };
  }, [projects, recentProjectIds]);

  // Get org name for display
  const orgName = useMemo(() => {
    const orgProject = projects.find(p => p.organizationName);
    return orgProject?.organizationName || session?.user?.operatingAsOrg?.name || 'My Firm';
  }, [projects, session]);

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetchProjects();
    }
  }, [isOpen, session]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: 'recent' | 'personal' | 'organization') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleProjectSelect = (projectId: string) => {
    if (multiSelect) {
      setSelectedProjectIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(projectId)) {
          newSet.delete(projectId);
        } else {
          newSet.add(projectId);
        }
        return newSet;
      });
    } else {
      setSelectedProjectIds(new Set([projectId]));
    }
    setCreateNew(false);
  };

  const saveRecentProject = (projectId: string) => {
    try {
      const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
      let recent: string[] = stored ? JSON.parse(stored) : [];

      // Remove if already exists, add to front
      recent = recent.filter(id => id !== projectId);
      recent.unshift(projectId);

      // Keep only max recent
      recent = recent.slice(0, MAX_RECENT_PROJECTS);

      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent));
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProjectIds.size === 0 && !createNew) return;

    setSaving(true);
    try {
      let projectIdsToSave: string[] = [];

      // Create new project if needed
      if (createNew) {
        const createResponse = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newProjectTitle,
            description: 'Created from event',
            projectType: 'RESIDENTIAL',
            clientType: 'RESIDENTIAL',
            budgetBand: 'UNSPECIFIED',
            stage: 'concept',
          }),
        });

        if (createResponse.ok) {
          const newProject = await createResponse.json();
          projectIdsToSave.push(newProject.id);
        } else {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create project');
        }
      } else {
        projectIdsToSave = Array.from(selectedProjectIds);
      }

      // Save product to each selected project
      for (const projectId of projectIdsToSave) {
        const saveResponse = await fetch(
          `/api/products/${productId}/save-to-project`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              sourceEventId: eventId,
            }),
          }
        );

        if (!saveResponse.ok) {
          throw new Error(`Failed to save product to project ${projectId}`);
        }

        // Save to recent
        saveRecentProject(projectId);
      }

      // Call success callback with first project
      onSuccess?.(projectIdsToSave[0]);

      // Redirect to first project with demo tour parameter
      router.push(`/project/${projectIdsToSave[0]}?demoTour=events-to-project-1`);
      onClose();
    } catch (error) {
      console.error('Error adding product to project:', error);
      alert('Failed to add product to project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-canvas rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-folio-border-subtle">
          <h2 className="text-lg font-semibold text-folio-text-primary">
            Save to Project
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-ground rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-folio-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-folio-text-tertiary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recent Projects */}
                {groupedProjects.recent.length > 0 && (
                  <ProjectSection
                    title="Recent"
                    icon={<Clock className="h-4 w-4" />}
                    projects={groupedProjects.recent}
                    expanded={expandedSections.recent}
                    onToggle={() => toggleSection('recent')}
                    selectedIds={selectedProjectIds}
                    onSelect={handleProjectSelect}
                    multiSelect={multiSelect}
                  />
                )}

                {/* Personal Projects */}
                {groupedProjects.personal.length > 0 && (
                  <ProjectSection
                    title="Personal Projects"
                    icon={<User className="h-4 w-4" />}
                    projects={groupedProjects.personal}
                    expanded={expandedSections.personal}
                    onToggle={() => toggleSection('personal')}
                    selectedIds={selectedProjectIds}
                    onSelect={handleProjectSelect}
                    multiSelect={multiSelect}
                  />
                )}

                {/* Organization Projects */}
                {groupedProjects.organization.length > 0 && (
                  <ProjectSection
                    title={orgName}
                    icon={<Building2 className="h-4 w-4" />}
                    projects={groupedProjects.organization}
                    expanded={expandedSections.organization}
                    onToggle={() => toggleSection('organization')}
                    selectedIds={selectedProjectIds}
                    onSelect={handleProjectSelect}
                    multiSelect={multiSelect}
                  />
                )}

                {/* Create New Project */}
                <div className="border-t border-folio-border-subtle pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateNew(true);
                      setSelectedProjectIds(new Set());
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                      createNew
                        ? "bg-[var(--text-primary)] text-[var(--bg-base)]"
                        : "hover:bg-surface-ground text-folio-text-primary"
                    )}
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span className="text-sm font-medium">Create new project</span>
                  </button>

                  {createNew && (
                    <div className="mt-3 px-3">
                      <input
                        type="text"
                        value={newProjectTitle}
                        onChange={(e) => setNewProjectTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-folio-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 bg-surface-canvas"
                        placeholder="Project name"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-folio-border-subtle bg-surface-ground">
            {/* Multi-select toggle */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={multiSelect}
                onChange={(e) => {
                  setMultiSelect(e.target.checked);
                  if (!e.target.checked && selectedProjectIds.size > 1) {
                    // Keep only first selection
                    const first = Array.from(selectedProjectIds)[0];
                    setSelectedProjectIds(first ? new Set([first]) : new Set());
                  }
                }}
                className="rounded border-folio-border-subtle text-folio-text-primary focus:ring-[var(--text-secondary)]"
              />
              <span className="text-sm text-folio-text-secondary">Select multiple projects</span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-folio-border-subtle rounded-lg text-folio-text-primary hover:bg-surface-ground transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (selectedProjectIds.size === 0 && !createNew)}
                className="flex-1 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  `Save${multiSelect && selectedProjectIds.size > 1 ? ` to ${selectedProjectIds.size} projects` : ''}`
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProjectSectionProps {
  title: string;
  icon: React.ReactNode;
  projects: Project[];
  expanded: boolean;
  onToggle: () => void;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  multiSelect: boolean;
}

function ProjectSection({
  title,
  icon,
  projects,
  expanded,
  onToggle,
  selectedIds,
  onSelect,
  multiSelect,
}: ProjectSectionProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {icon}
        <span>{title}</span>
        <span className="text-folio-text-tertiary">({projects.length})</span>
      </button>

      {expanded && (
        <div className="mt-1 space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                selectedIds.has(project.id)
                  ? "bg-surface-ground ring-1 ring-[var(--text-primary)]"
                  : "hover:bg-surface-ground"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                selectedIds.has(project.id)
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)]"
                  : "border-[var(--text-tertiary)]"
              )}>
                {selectedIds.has(project.id) && (
                  <Check className="h-3 w-3 text-[var(--bg-base)]" />
                )}
              </div>
              <span className="text-sm text-folio-text-primary truncate flex-1">
                {project.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
