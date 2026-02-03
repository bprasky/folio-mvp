'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  X,
  Clock,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
  Check,
  FolderPlus,
  Loader2,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface Project {
  id: string;
  title: string;
  ownershipContext?: 'personal' | 'organization';
  organizationId?: string | null;
  organizationName?: string | null;
  updatedAt?: string;
}

interface UserOrg {
  id: string;
  name: string;
  type: string;
}

interface Selection {
  id: string;
  photo?: string | null;
  productName?: string | null;
  vendorName?: string | null;
  projectId: string;
}

interface SaveSelectionToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selection: Selection | null;
  onSuccess?: (targetProjectId: string) => void;
}

// Local storage key for recent projects
const RECENT_PROJECTS_KEY = 'folio-recent-projects';
const MAX_RECENT_PROJECTS = 5;

export default function SaveSelectionToProjectModal({
  isOpen,
  onClose,
  selection,
  onSuccess,
}: SaveSelectionToProjectModalProps) {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('New Project');
  const [newProjectOrgId, setNewProjectOrgId] = useState<string | null>(null); // null = personal

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

  // Group projects by context (exclude current project)
  const groupedProjects = useMemo(() => {
    const recent: Project[] = [];
    const personal: Project[] = [];
    const organization: Project[] = [];

    // Filter out the source project
    const availableProjects = projects.filter(p => p.id !== selection?.projectId);

    // Get recent projects first
    recentProjectIds.forEach((id: string) => {
      const project = availableProjects.find(p => p.id === id);
      if (project) recent.push(project);
    });

    // Group remaining by context
    availableProjects.forEach(project => {
      if (project.ownershipContext === 'organization') {
        organization.push(project);
      } else {
        personal.push(project);
      }
    });

    return { recent, personal, organization };
  }, [projects, recentProjectIds, selection?.projectId]);

  // Get first org name for section title
  const primaryOrgName = useMemo(() => {
    if (userOrgs.length > 0) {
      return userOrgs[0].name;
    }
    const orgProject = projects.find(p => p.organizationName);
    return orgProject?.organizationName || 'Organization';
  }, [projects, userOrgs]);

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetchProjects();
    }
  }, [isOpen, session]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId(null);
      setCreateNew(false);
      setNewProjectTitle('New Project');
      setNewProjectOrgId(null);
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/my-projects');
      if (response.ok) {
        const data = await response.json();
        // Handle both old format (array) and new format ({ projects, userOrgs })
        if (Array.isArray(data)) {
          setProjects(data);
          setUserOrgs([]);
        } else {
          setProjects(data.projects || []);
          setUserOrgs(data.userOrgs || []);
        }
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
    setSelectedProjectId(projectId);
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
    if (!selection || (!selectedProjectId && !createNew)) return;

    setSaving(true);
    try {
      let targetProjectId = selectedProjectId;

      // Create new project if needed
      if (createNew) {
        const createPayload: any = {
          title: newProjectTitle,
          description: 'Created from saved selection',
          projectType: 'RESIDENTIAL',
          clientType: 'RESIDENTIAL',
          budgetBand: 'UNSPECIFIED',
          stage: 'concept',
          projectStatus: 'new_project', // Required field
        };

        // If creating for an org, include the org ID
        if (newProjectOrgId) {
          createPayload.designerOrgId = newProjectOrgId;
        }

        const createResponse = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        });

        if (createResponse.ok) {
          const newProject = await createResponse.json();
          targetProjectId = newProject.id;
        } else {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create project');
        }
      }

      if (!targetProjectId) {
        throw new Error('No target project selected');
      }

      // Save selection to target project
      const saveResponse = await fetch(
        `/api/selections/${selection.id}/save-to-project`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetProjectId,
          }),
        }
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save selection to project');
      }

      // Save to recent
      saveRecentProject(targetProjectId);

      const targetProject = projects.find(p => p.id === targetProjectId);
      toast.success(`Saved to ${targetProject?.title || newProjectTitle}`);
      onSuccess?.(targetProjectId);
      onClose();
    } catch (error: any) {
      console.error('Error saving selection to project:', error);
      toast.error(error.message || 'Failed to save selection to project');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !selection) return null;

  const hasOrgs = userOrgs.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-base,#fff)] rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ridge-outer,#e5e7eb)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary,#111)]">
            Save to Another Project
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--bg-elevated,#f3f4f6)] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[var(--text-secondary,#6b7280)]" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-6 py-3 border-b border-[var(--ridge-outer,#e5e7eb)] bg-[var(--bg-elevated,#f9fafb)]">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              {selection.photo ? (
                <img
                  src={selection.photo}
                  alt={selection.productName || 'Product'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary,#111)] truncate">
                {selection.productName || 'Untitled Product'}
              </p>
              {selection.vendorName && (
                <p className="text-xs text-[var(--text-secondary,#6b7280)] truncate mt-0.5">
                  {selection.vendorName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary,#9ca3af)]" />
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
                    selectedId={selectedProjectId}
                    onSelect={handleProjectSelect}
                  />
                )}

                {/* Personal Projects */}
                <ProjectSection
                  title="Personal Projects"
                  icon={<User className="h-4 w-4" />}
                  projects={groupedProjects.personal}
                  expanded={expandedSections.personal}
                  onToggle={() => toggleSection('personal')}
                  selectedId={selectedProjectId}
                  onSelect={handleProjectSelect}
                  emptyMessage="No personal projects"
                />

                {/* Organization Projects - always show if user has orgs */}
                {hasOrgs && (
                  <ProjectSection
                    title={primaryOrgName}
                    icon={<Building2 className="h-4 w-4" />}
                    projects={groupedProjects.organization}
                    expanded={expandedSections.organization}
                    onToggle={() => toggleSection('organization')}
                    selectedId={selectedProjectId}
                    onSelect={handleProjectSelect}
                    emptyMessage="No organization projects"
                  />
                )}

                {/* Create New Project */}
                <div className="border-t border-[var(--ridge-outer,#e5e7eb)] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateNew(true);
                      setSelectedProjectId(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                      createNew
                        ? "bg-[var(--text-primary,#111)] text-[var(--bg-base,#fff)]"
                        : "hover:bg-[var(--bg-elevated,#f3f4f6)] text-[var(--text-primary,#111)]"
                    )}
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span className="text-sm font-medium">Create new project</span>
                  </button>

                  {createNew && (
                    <div className="mt-3 space-y-3 px-3">
                      {/* Project name */}
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary,#6b7280)] mb-1">
                          Project name
                        </label>
                        <input
                          type="text"
                          value={newProjectTitle}
                          onChange={(e) => setNewProjectTitle(e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--ridge-outer,#e5e7eb)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-primary,#111)]/20 bg-[var(--bg-base,#fff)]"
                          placeholder="Project name"
                          autoFocus
                        />
                      </div>

                      {/* Ownership selector - only show if user has orgs */}
                      {hasOrgs && (
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-secondary,#6b7280)] mb-1">
                            Create in
                          </label>
                          <div className="space-y-2">
                            {/* Personal option */}
                            <button
                              type="button"
                              onClick={() => setNewProjectOrgId(null)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left",
                                newProjectOrgId === null
                                  ? "border-[var(--text-primary,#111)] bg-[var(--bg-elevated,#f3f4f6)]"
                                  : "border-[var(--ridge-outer,#e5e7eb)] hover:bg-[var(--bg-elevated,#f3f4f6)]"
                              )}
                            >
                              <User className="h-4 w-4 text-[var(--text-secondary,#6b7280)]" />
                              <span className="text-sm text-[var(--text-primary,#111)]">Personal</span>
                              {newProjectOrgId === null && (
                                <Check className="h-4 w-4 ml-auto text-[var(--text-primary,#111)]" />
                              )}
                            </button>

                            {/* Org options */}
                            {userOrgs.map(org => (
                              <button
                                key={org.id}
                                type="button"
                                onClick={() => setNewProjectOrgId(org.id)}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left",
                                  newProjectOrgId === org.id
                                    ? "border-[var(--text-primary,#111)] bg-[var(--bg-elevated,#f3f4f6)]"
                                    : "border-[var(--ridge-outer,#e5e7eb)] hover:bg-[var(--bg-elevated,#f3f4f6)]"
                                )}
                              >
                                <Building2 className="h-4 w-4 text-[var(--text-secondary,#6b7280)]" />
                                <span className="text-sm text-[var(--text-primary,#111)]">{org.name}</span>
                                {newProjectOrgId === org.id && (
                                  <Check className="h-4 w-4 ml-auto text-[var(--text-primary,#111)]" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--ridge-outer,#e5e7eb)] bg-[var(--bg-elevated,#f9fafb)]">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-[var(--ridge-outer,#e5e7eb)] rounded-lg text-[var(--text-primary,#111)] hover:bg-[var(--bg-elevated,#f3f4f6)] transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (!selectedProjectId && !createNew)}
                className="flex-1 px-4 py-2 bg-[var(--text-primary,#111)] text-[var(--bg-base,#fff)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save'
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
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

function ProjectSection({
  title,
  icon,
  projects,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  emptyMessage,
}: ProjectSectionProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-[var(--text-secondary,#6b7280)] hover:text-[var(--text-primary,#111)] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {icon}
        <span>{title}</span>
        <span className="text-[var(--text-tertiary,#9ca3af)]">({projects.length})</span>
      </button>

      {expanded && (
        <div className="mt-1 space-y-1">
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--text-tertiary,#9ca3af)] italic">
              {emptyMessage || 'No projects'}
            </p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelect(project.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                  selectedId === project.id
                    ? "bg-[var(--bg-elevated,#f3f4f6)] ring-1 ring-[var(--text-primary,#111)]"
                    : "hover:bg-[var(--bg-elevated,#f3f4f6)]"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                  selectedId === project.id
                    ? "border-[var(--text-primary,#111)] bg-[var(--text-primary,#111)]"
                    : "border-[var(--text-tertiary,#9ca3af)]"
                )}>
                  {selectedId === project.id && (
                    <Check className="h-3 w-3 text-[var(--bg-base,#fff)]" />
                  )}
                </div>
                <span className="text-sm text-[var(--text-primary,#111)] truncate flex-1">
                  {project.title}
                </span>
                {project.organizationName && (
                  <span className="text-xs text-[var(--text-tertiary,#9ca3af)] truncate max-w-[100px]">
                    {project.organizationName}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
