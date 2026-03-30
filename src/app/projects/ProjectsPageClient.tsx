'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Sparkles,
  TrendingUp,
  BadgeCheck,
  FolderKanban,
  BookOpenText,
  Newspaper,
  Filter,
  Layers,
  MoreVertical,
  Edit,
  Trash2,
  X,
  Eye,
  EyeOff,
  Search,
  ExternalLink,
  ChevronDown,
  User,
  Building2,
  MousePointerClick,
  Users,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserCapabilities } from '@/hooks/useUserCapabilities';
import { EmptyStateHero, GuideCard, UpgradePrompt } from '@/components/projects';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

// ============================================================================
// TYPE DEFINITIONS — Lifecycle + Overlays Model
// ============================================================================

/**
 * Lifecycle: The fundamental state of a project (3 states only)
 * - DRAFT: Has no substance yet (empty shell)
 * - ACTIVE: Has substance (images, rooms, tags, etc.)
 * - ARCHIVED: Explicitly archived by user
 */
export type Lifecycle = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

/**
 * Overlays: Status badges that can apply to any lifecycle state
 * Editorial is NOT a phase — it's an overlay/recognition layer
 */
export type Overlays = {
  isPublished: boolean;
  isEditorialCandidate: boolean;
  isEditorialFeatured: boolean;
};

/**
 * UI Section: How projects are grouped for display
 * (derived from Lifecycle + Overlays, not stored)
 */
export type UISection = 'IN_PROGRESS' | 'PUBLISHED' | 'DRAFTS' | 'ARCHIVED';

// Editorial thresholds (configurable constants)
const EDITORIAL_SAVES_THRESHOLD = 25;
const EDITORIAL_TAGGED_THRESHOLD = 10;

export type ProjectLite = {
  id: string;
  title: string;
  coverUrl?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  taggedCount?: number;
  savesByOthers?: number;
  influenceValueUsd?: number;
  views?: number;
  stage: string;
  status: string;
  isPublic: boolean;
  publishedAt: Date | null;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
  // Optional fields for enhanced lifecycle detection
  imageCount?: number;
  roomCount?: number;
  noteCount?: number;
  skeletonCount?: number;
  // Computed fields (added during mapping)
  lifecycle?: Lifecycle;
  overlays?: Overlays;
  uiSection?: UISection;
  // Ownership context
  ownershipContext?: 'personal' | 'organization';
  organizationId?: string | null;
  organizationName?: string | null;
};

interface ProjectsPageClientProps {
  projectsRaw: ProjectLite[];
  operatingAsOrgId?: string | null;
}

export default function ProjectsPageClient({ projectsRaw, operatingAsOrgId }: ProjectsPageClientProps) {
  const { data: session } = useSession();
  const capabilities = useUserCapabilities();
  const [projectsState, setProjectsState] = useState<ProjectLite[]>(projectsRaw);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeContextTab, setActiveContextTab] = useState<'all' | 'personal' | 'organization'>('all');

  const projects: ProjectLite[] = useMemo(() =>
    (projectsState ?? []).map(mapToProjectLite),
    [projectsState]
  );

  // Filter projects by search query and context tab
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Filter by context tab
    if (activeContextTab === 'personal') {
      filtered = filtered.filter(p => p.ownershipContext !== 'organization');
    } else if (activeContextTab === 'organization') {
      filtered = filtered.filter(p => p.ownershipContext === 'organization');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [projects, searchQuery, activeContextTab]);

  const grouped = useMemo(() => groupBySection(filteredProjects), [filteredProjects]);

  // Group projects by ownership context for counts
  const contextCounts = useMemo(() => {
    const personal = projects.filter(p => p.ownershipContext !== 'organization').length;
    const organization = projects.filter(p => p.ownershipContext === 'organization').length;
    return { personal, organization, total: projects.length };
  }, [projects]);

  // Get unique org names for display
  const orgName = useMemo(() => {
    const orgProject = projects.find(p => p.organizationName);
    return orgProject?.organizationName || session?.user?.operatingAsOrg?.name || 'My Firm';
  }, [projects, session]);

  // Determine page title based on operating context
  const pageTitle = useMemo(() => {
    const userName = session?.user?.name || 'My';
    const operatingAsOrg = session?.user?.operatingAsOrg;

    if (operatingAsOrg) {
      return `${operatingAsOrg.name} Projects`;
    }
    return `${userName}'s Projects`;
  }, [session]);

  // Handler for renaming projects
  const handleRename = async (projectId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename project');
      }

      // Update local state
      setProjectsState(prev =>
        prev.map(p => p.id === projectId ? { ...p, title: newTitle } : p)
      );
    } catch (error) {
      console.error('Error renaming project:', error);
      throw error;
    }
  };

  // Handler for deleting/archiving projects
  const handleDelete = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete project');
      }

      const result = await response.json();

      // If project was deleted (not archived), remove from state
      if (result.deleted) {
        setProjectsState(prev => prev.filter(p => p.id !== projectId));
      } else if (result.archived) {
        // If archived, update status
        setProjectsState(prev =>
          prev.map(p => p.id === projectId ? { ...p, status: 'archived', lifecycle: 'ARCHIVED' as Lifecycle } : p)
        );
        alert(result.message);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  // Handler for force deleting archived projects
  const handleForceDelete = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/force-delete`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to force delete project');
      }

      // Remove from state
      setProjectsState(prev => prev.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error force deleting project:', error);
      throw error;
    }
  };

  const totals = useMemo(() => {
    const totalProjects = projects.length;
    const publishedProjects = projects.filter(p => p.isPublic || p.publishedAt || p.status === 'published');
    const totalPublished = publishedProjects.length;
    const totalTagged = projects.reduce((a, p) => a + (p.taggedCount ?? 0), 0);
    const totalViews = publishedProjects.reduce((a, p) => a + (p.views ?? 0), 0);
    return { totalProjects, totalPublished, totalTagged, totalViews };
  }, [projects]);

  return (
    <div className="min-h-screen w-full -mx-6">
      <div className="relative w-full">
        {/* Designer Header */}
        <div className="border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
            <div className="flex items-center gap-6 mb-6">
              {/* Designer Avatar */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center shadow-[var(--neu-raised)] border-2 border-[var(--ridge-outer)]">
                  {session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'Profile'}
                      width={80}
                      height={80}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
                </div>
              </div>

              {/* Designer Info */}
              <div className="flex-1">
                <h1 className="folio-h1 text-[var(--text-primary)] mb-1">
                  {pageTitle}
                </h1>
                <p className="folio-body text-[var(--text-secondary)]">
                  {totals.totalProjects} {totals.totalProjects === 1 ? 'project' : 'projects'} in portfolio
                </p>
              </div>

              {/* Create Button */}
              <Link
                href="/projects/new"
                className="accent-btn px-5 py-2.5 inline-flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                <span>Create Project</span>
              </Link>
            </div>

            {/* Context Tabs - only show if user has mixed contexts (not filtered by operatingAsOrgId) */}
            {!operatingAsOrgId && contextCounts.organization > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveContextTab('all')}
                  className={cn(
                    "px-4 py-2 folio-ui font-medium rounded-full transition-colors",
                    activeContextTab === 'all'
                      ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                      : "bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  )}
                >
                  All ({contextCounts.total})
                </button>
                <button
                  onClick={() => setActiveContextTab('personal')}
                  className={cn(
                    "px-4 py-2 folio-ui font-medium rounded-full transition-colors flex items-center gap-2",
                    activeContextTab === 'personal'
                      ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                      : "bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  )}
                >
                  <User className="h-4 w-4" />
                  Personal ({contextCounts.personal})
                </button>
                <button
                  onClick={() => setActiveContextTab('organization')}
                  className={cn(
                    "px-4 py-2 folio-ui font-medium rounded-full transition-colors flex items-center gap-2",
                    activeContextTab === 'organization'
                      ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                      : "bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  {orgName} ({contextCounts.organization})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Designer Impact Bar */}
        <TopImpactBar totals={totals} capabilities={capabilities} />

        {/* Search/Filter Bar */}
        <div className="px-4 md:px-8 pt-6 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search projects by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>
          </div>
        </div>

        {/* Empty State - Show when user has no projects */}
        {projects.length === 0 && (
          <div className="px-4 md:px-8 pb-8 pt-4 space-y-6">
            <div className="max-w-7xl mx-auto">
              <EmptyStateHero
                userType={capabilities.userType}
                userName={session?.user?.name ?? undefined}
              />
              {/* Guide card for designers */}
              {capabilities.isDesigner && (
                <div className="mt-6">
                  <GuideCard
                    projectCount={0}
                    taggedCount={0}
                    hasInterviewed={false}
                    publishedCount={0}
                  />
                </div>
              )}
              {/* Subtle upgrade prompt for free designers */}
              {capabilities.isFreeDesigner && (
                <div className="mt-6">
                  <UpgradePrompt variant="subtle" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sections: Drafts first (inbox behavior), then In Progress, Published, Archived */}
        {projects.length > 0 && (
          <>
            <div className="space-y-6 px-4 md:px-8 pb-8 pt-4 mx-4 md:mx-8">
              {/* Drafts section - appears first, expands if has projects */}
              <CollapsibleSectionBand
                section="DRAFTS"
                projects={grouped.DRAFTS}
                defaultExpanded={grouped.DRAFTS.length > 0}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
              />

              {/* Guide card for designers with some projects but incomplete workflow */}
              {capabilities.isDesigner && totals.totalProjects > 0 && totals.totalPublished === 0 && (
                <GuideCard
                  projectCount={totals.totalProjects}
                  taggedCount={totals.totalTagged}
                  hasInterviewed={false}
                  publishedCount={totals.totalPublished}
                />
              )}
            </div>

            {/* Primary Sections: In Progress + Published */}
            <div className="space-y-10 px-4 md:px-8 pb-8">
              <SectionBand
                section="IN_PROGRESS"
                projects={grouped.IN_PROGRESS}
                defaultExpanded={grouped.IN_PROGRESS.length > 0 || grouped.PUBLISHED.length === 0}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
              />
              <SectionBand
                section="PUBLISHED"
                projects={grouped.PUBLISHED}
                defaultExpanded={grouped.PUBLISHED.length > 0 || grouped.IN_PROGRESS.length === 0}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
              />
            </div>

            {/* Secondary Section: Archived (collapsible) */}
            <div className="space-y-6 px-4 md:px-8 pb-8">
              <CollapsibleSectionBand
                section="ARCHIVED"
                projects={grouped.ARCHIVED}
                defaultExpanded={false}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
              />
            </div>

            {/* Upgrade prompt for free designers at bottom */}
            {capabilities.isFreeDesigner && totals.totalProjects > 0 && (
              <div className="px-4 md:px-8 pb-20">
                <div className="max-w-7xl mx-auto">
                  <UpgradePrompt variant="prominent" />
                </div>
              </div>
            )}

            {/* Spacer for non-free designers */}
            {!capabilities.isFreeDesigner && <div className="pb-12" />}
          </>
        )}

        {/* Folio Index Drawer trigger (right rail) */}
        <FolioIndexDrawer projects={projects} />
      </div>
    </div>
  );
}

// ============================================================================
// LIFECYCLE + OVERLAYS COMPUTATION (Source of Truth)
// ============================================================================

/**
 * Compute the lifecycle state of a project
 * Rules (in priority order):
 * 1. If explicitly archived → ARCHIVED
 * 2. If no substance (no images, rooms, tags, notes) → DRAFT
 * 3. Otherwise → ACTIVE
 *
 * IMPORTANT: ProjectStage is NOT used for lifecycle determination.
 * Stage is only a sorting hint, not the truth layer.
 */
function computeLifecycle(p: ProjectLite): Lifecycle {
  // Check for explicit archive signal (archivedAt field or status)
  if (p.archivedAt || (p.status ?? '').toLowerCase() === 'archived') {
    return 'ARCHIVED';
  }

  // Determine "substance" using available fields
  // Use coverUrl as proxy for hasImages when imageCount isn't available
  const hasImages = (p.imageCount ?? 0) > 0 || p.coverUrl != null;
  const hasRooms = (p.roomCount ?? 0) > 0;
  const hasTags = (p.taggedCount ?? 0) > 0;
  const hasNotes = (p.noteCount ?? 0) > 0;
  const hasSkeletons = (p.skeletonCount ?? 0) > 0;

  const hasSubstance = hasImages || hasRooms || hasTags || hasNotes || hasSkeletons;

  if (!hasSubstance) {
    return 'DRAFT';
  }

  return 'ACTIVE';
}

/**
 * Compute overlay flags for a project
 * - isPublished: Project is publicly visible
 * - isEditorialCandidate: Meets engagement thresholds (requires published)
 * - isEditorialFeatured: Has been elevated to editorial (actual publication)
 */
function computeOverlays(p: ProjectLite): Overlays {
  const isPublished = Boolean(p.isPublic || p.publishedAt);

  // Editorial Featured: Check for actual editorial publication
  // TODO: Wire to editorial post model when available (e.g., p.editorialPost?.publishedAt)
  // For now, we don't have this field, so default to false
  const isEditorialFeatured = false;

  // Editorial Candidate: Must be published AND meet engagement thresholds
  const saves = p.savesByOthers ?? 0;
  const tagged = p.taggedCount ?? 0;
  const isEditorialCandidate = isPublished &&
    saves >= EDITORIAL_SAVES_THRESHOLD &&
    tagged >= EDITORIAL_TAGGED_THRESHOLD;

  return {
    isPublished,
    isEditorialCandidate,
    isEditorialFeatured,
  };
}

/**
 * Derive UI section from lifecycle + overlays
 * Priority rule: Published always wins (shows in Published section)
 */
function computeUISection(lifecycle: Lifecycle, overlays: Overlays): UISection {
  // Archived always goes to Archived (even if published)
  if (lifecycle === 'ARCHIVED') {
    return 'ARCHIVED';
  }

  // Published projects go to Published section
  if (overlays.isPublished) {
    return 'PUBLISHED';
  }

  // Drafts (no substance) go to Drafts section
  if (lifecycle === 'DRAFT') {
    return 'DRAFTS';
  }

  // Active unpublished projects go to In Progress
  return 'IN_PROGRESS';
}

// ---------- Helpers / Components ----------

function mapToProjectLite(p: ProjectLite): ProjectLite {
  const taggedCount = Number(p.taggedCount ?? 0);
  const savesByOthers = Number(p.savesByOthers ?? 0);
  const influenceValueUsd = Number(p.influenceValueUsd ?? 0);
  const views = Number(p.views ?? 0);

  // Compute lifecycle and overlays (the new truth layer)
  const lifecycle = computeLifecycle({ ...p, taggedCount, savesByOthers });
  const overlays = computeOverlays({ ...p, taggedCount, savesByOthers });
  const uiSection = computeUISection(lifecycle, overlays);

  return {
    ...p,
    taggedCount,
    savesByOthers,
    influenceValueUsd,
    views,
    lifecycle,
    overlays,
    uiSection,
  };
}

/**
 * Group projects by UI section for display
 */
function groupBySection(projects: ProjectLite[]) {
  return projects.reduce<Record<UISection, ProjectLite[]>>((acc, p) => {
    const section = p.uiSection ?? 'IN_PROGRESS';
    (acc[section] ??= []).push(p);
    return acc;
  }, {
    IN_PROGRESS: [],
    PUBLISHED: [],
    DRAFTS: [],
    ARCHIVED: []
  });
}

interface TopImpactBarProps {
  totals: {
    totalProjects: number;
    totalPublished: number;
    totalTagged: number;
    totalViews: number;
    affiliateClicks?: number;
    collectionsCount?: number;
    savedProductsCount?: number;
  };
  capabilities: ReturnType<typeof useUserCapabilities>;
}

function TopImpactBar({ totals, capabilities }: TopImpactBarProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-metrics-expanded');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  // Persist expanded state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('projects-metrics-expanded', String(isExpanded));
    }
  }, [isExpanded]);

  const {
    isIndividual,
    showPublishedStat,
    showProductsTaggedStat,
    showAffiliateClicks,
    showDirectoryLink
  } = capabilities;

  // Individual users see Collections and Saved Products only
  if (isIndividual) {
    return (
      <RidgeCard className="mx-4 md:mx-8 mt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-base)] transition-all duration-150 rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
              <TrendingUp className="h-4 w-4 text-[var(--text-secondary)]" />
            </div>
            <h3 className="folio-h3 text-[var(--text-primary)]">Portfolio Stats</h3>
          </div>
          <div className={cn(
            "text-[var(--text-secondary)] transition-transform",
            isExpanded ? "rotate-180" : ""
          )}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricPill icon={Layers} label="COLLECTIONS" value={formatNumber(totals.collectionsCount ?? 0)} />
              <MetricPill icon={BookOpenText} label="SAVED PRODUCTS" value={formatNumber(totals.savedProductsCount ?? 0)} />
            </div>
          </div>
        )}
      </RidgeCard>
    );
  }

  // Designers see the full stats bar (collapsible)
  return (
    <RidgeCard className="mx-4 md:mx-8 mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-base)] transition-all duration-150 rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
            <TrendingUp className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <h3 className="folio-h3 text-[var(--text-primary)]">Portfolio Stats</h3>
          <span className="folio-meta text-[var(--text-secondary)]">
            {formatNumber(totals.totalProjects)} projects, {formatNumber(totals.totalViews)} views
          </span>
        </div>
        <div className={cn(
          "text-[var(--text-secondary)] transition-transform",
          isExpanded ? "rotate-180" : ""
        )}>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className={cn(
            "grid gap-3",
            showAffiliateClicks ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"
          )}>
            <MetricPill icon={FolderKanban} label="PROJECTS" value={formatNumber(totals.totalProjects)} />
            {showPublishedStat && (
              <MetricPill icon={BadgeCheck} label="PUBLISHED" value={formatNumber(totals.totalPublished)} />
            )}
            {showProductsTaggedStat && (
              <MetricPill icon={Layers} label="PRODUCTS TAGGED" value={formatNumber(totals.totalTagged)} />
            )}
            <MetricPill icon={Eye} label="TOTAL VIEWS" value={formatNumber(totals.totalViews)} />
            {showAffiliateClicks && (
              <MetricPill
                icon={MousePointerClick}
                label="AFFILIATE CLICKS"
                value={formatNumber(totals.affiliateClicks ?? 0)}
                emphasis={true}
              />
            )}
          </div>
          {showDirectoryLink && (
            <div className="mt-3 flex justify-end">
              <Link
                href="/designer/profile"
                className="inline-flex items-center gap-1.5 folio-meta text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Users className="h-3.5 w-3.5" />
                View your directory listing
              </Link>
            </div>
          )}
        </div>
      )}
    </RidgeCard>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  emphasis = false,
  muted = false
}: {
  icon: any;
  label: string;
  value: any;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn(
      "px-4 py-3 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)]",
      muted && "opacity-60"
    )}>
      <Icon className={cn(
        "h-5 w-5 text-[var(--text-secondary)]",
        emphasis && "text-[var(--accent)]"
      )} />
      <div className="flex flex-col leading-tight">
        <span className="folio-meta uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
        <span className={cn(
          "folio-h3",
          muted ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]",
          emphasis && "text-[var(--accent)]"
        )}>{value}</span>
      </div>
    </div>
  );
}

const SECTION_CONFIG: Record<UISection, { title: string; emptyMessage: string; icon: any }> = {
  IN_PROGRESS: {
    title: 'In Progress',
    emptyMessage: 'No active projects. Start one by uploading your latest completed work.',
    icon: FolderKanban
  },
  PUBLISHED: {
    title: 'Published',
    emptyMessage: 'Nothing published yet. When you\'re ready to share, your work will appear here.',
    icon: BadgeCheck
  },
  DRAFTS: {
    title: 'Drafts',
    emptyMessage: 'No empty drafts.',
    icon: Filter
  },
  ARCHIVED: {
    title: 'Archived',
    emptyMessage: 'No archived projects.',
    icon: Filter
  },
};

function SectionBand({
  section,
  projects,
  defaultExpanded = true,
  onRename,
  onDelete,
  onForceDelete
}: {
  section: UISection;
  projects: ProjectLite[];
  defaultExpanded?: boolean;
  onRename?: (projectId: string, newTitle: string) => void;
  onDelete?: (projectId: string) => void;
  onForceDelete?: (projectId: string) => void;
}) {
  const config = SECTION_CONFIG[section];

  return (
    <RidgeCard className="p-4 md:p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
            <config.icon className="h-5 w-5 text-[var(--text-secondary)]" />
          </div>
          <h2 className="folio-h2 text-[var(--text-primary)]">
            {config.title}
          </h2>
        </div>
        <div className="flex items-center gap-2 folio-meta text-[var(--text-secondary)]">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="folio-body text-[var(--text-secondary)] italic py-8 px-2">{config.emptyMessage}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              p={p}
              onRename={onRename}
              onDelete={onDelete}
              onForceDelete={onForceDelete}
            />
          ))}
        </div>
      )}
    </RidgeCard>
  );
}

function CollapsibleSectionBand({
  section,
  projects,
  defaultExpanded = false,
  onRename,
  onDelete,
  onForceDelete
}: {
  section: UISection;
  projects: ProjectLite[];
  defaultExpanded?: boolean;
  onRename?: (projectId: string, newTitle: string) => void;
  onDelete?: (projectId: string) => void;
  onForceDelete?: (projectId: string) => void;
}) {
  const storageKey = `projects-section-${section}-expanded`;
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? saved === 'true' : defaultExpanded;
    }
    return defaultExpanded;
  });
  const config = SECTION_CONFIG[section];

  // Persist expanded state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(isExpanded));
    }
  }, [isExpanded, storageKey]);

  // Don't render empty collapsible sections (cleaner UI)
  if (projects.length === 0) {
    return null;
  }

  return (
    <RidgeCard className={cn(
      "overflow-hidden transition-all",
      isExpanded && "p-4 md:p-6"
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-base)] transition-all duration-150 rounded-t-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
            <config.icon className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <h3 className="folio-h3 text-[var(--text-primary)]">
            {config.title}
          </h3>
          <span className="folio-meta text-[var(--text-secondary)]">
            ({projects.length})
          </span>
        </div>
        <div className={cn(
          "text-[var(--text-secondary)] transition-transform",
          isExpanded ? "rotate-180" : ""
        )}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {projects.length === 0 ? (
            <div className="folio-body text-[var(--text-secondary)] italic py-8">{config.emptyMessage}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {projects.map(p => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  onRename={onRename}
                  onDelete={onDelete}
                  onForceDelete={onForceDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </RidgeCard>
  );
}

function ProjectCard({ p, onRename, onDelete, onForceDelete }: {
  p: ProjectLite;
  onRename?: (projectId: string, newTitle: string) => void;
  onDelete?: (projectId: string) => void;
  onForceDelete?: (projectId: string) => void;
}) {
  const overlays = p.overlays ?? { isPublished: false, isEditorialCandidate: false, isEditorialFeatured: false };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(p.title);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Determine project status
  const getProjectStatus = () => {
    if (p.lifecycle === 'DRAFT') return 'Draft';
    if (p.isPublic || p.publishedAt || p.status === 'published') return 'Published';
    // Check if has images (ready to publish) - use coverUrl as proxy or imageCount
    const hasImages = (p.imageCount && p.imageCount > 0) || p.coverUrl != null;
    if (hasImages) return 'Ready to Publish';
    return 'Draft';
  };

  const projectStatus = getProjectStatus();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = async () => {
    if (!onRename || !newTitle.trim()) return;

    try {
      await onRename(p.id, newTitle.trim());
      setIsRenaming(false);
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Failed to rename project:', error);
      alert('Failed to rename project. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this project? ' +
      (p.lifecycle === 'ARCHIVED'
        ? 'This will permanently delete the project.'
        : 'If the project has content, it will be archived for 30 days before permanent deletion.')
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await onDelete(p.id);
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleForceDelete = async () => {
    if (!onForceDelete) return;

    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this archived project? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await onForceDelete(p.id);
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Failed to force delete project:', error);
      alert('Failed to delete project. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleTogglePublish = async () => {
    const newPublishState = !p.isPublic;

    try {
      setIsPublishing(true);
      const response = await fetch(`/api/projects/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newPublishState }),
      });

      if (!response.ok) {
        throw new Error('Failed to update publish status');
      }

      // Update local state - refresh projects to get updated data
      const refreshResponse = await fetch('/api/projects');
      if (refreshResponse.ok) {
        const updatedProjects = await refreshResponse.json();
        // Note: This would require passing setProjectsState down or using a context
        // For now, reload to ensure consistency
        window.location.reload();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to toggle publish:', error);
      alert('Failed to update publish status. Please try again.');
      setIsPublishing(false);
    }
  };

  const isArchived = p.lifecycle === 'ARCHIVED' || p.status === 'archived';

  return (
    <div className="group relative">
      <article className="relative overflow-hidden rounded-2xl bg-[var(--bg-elevated)] shadow-[var(--neu-raised)] transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-[var(--ridge-outer)]">
        <Link href={`/project/${p.id}`} className="block">
          <div className="relative aspect-[3/4]">
            {p.coverUrl ? (
              <Image
                src={p.coverUrl}
                alt={p.title || 'Project image'}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full bg-[var(--bg-base)] flex items-center justify-center">
                <div className="folio-meta text-[var(--text-tertiary)]">No image</div>
              </div>
            )}

            {/* Quick Actions on Hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <Link
                href={`/project/${p.id}`}
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-lg folio-ui font-medium hover:bg-[var(--bg-base)] transition-colors flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
              <Link
                href={`/project/${p.id}`}
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-lg folio-ui font-medium hover:bg-[var(--bg-base)] transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                Preview
              </Link>
              {!isArchived && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTogglePublish();
                  }}
                  disabled={isPublishing}
                  className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-lg folio-ui font-medium hover:bg-[var(--bg-base)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {p.isPublic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {isPublishing ? '...' : p.isPublic ? 'Unpublish' : 'Publish'}
                </button>
              )}
            </div>

            {/* Status Badge */}
            <div className="absolute top-3 left-3 z-10">
              <StatusBadge status={projectStatus} />
            </div>

            {/* Action Menu Button */}
            <div
              ref={menuRef}
              className="absolute top-3 right-3 z-20"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
                title="Project options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-lg py-1 z-50">
                  {!isRenaming ? (
                    <>
                      <Link
                        href={`/project/${p.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 folio-ui hover:bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Link>
                      <Link
                        href={`/project/${p.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 folio-ui hover:bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Preview
                      </Link>
                      {!isArchived && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTogglePublish();
                            setIsMenuOpen(false);
                          }}
                          disabled={isPublishing}
                          className="w-full text-left px-3 py-2 folio-ui hover:bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center gap-2 disabled:opacity-50"
                        >
                          {p.isPublic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {isPublishing ? 'Updating...' : p.isPublic ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsRenaming(true);
                        }}
                        className="w-full text-left px-3 py-2 folio-ui hover:bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Rename
                      </button>
                      {isArchived ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleForceDelete();
                          }}
                          disabled={isDeleting}
                          className="w-full text-left px-3 py-2 folio-ui hover:bg-[var(--bg-base)] text-red-600 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete();
                          }}
                          disabled={isDeleting}
                          className="w-full text-left px-3 py-2 folio-ui hover:bg-[var(--bg-base)] text-red-600 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="px-3 py-2">
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRename();
                          } else if (e.key === 'Escape') {
                            setNewTitle(p.title);
                            setIsRenaming(false);
                          }
                        }}
                        className="w-full px-2 py-1 folio-ui border border-[var(--border)] rounded bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRename();
                          }}
                          className="flex-1 px-2 py-1 folio-meta bg-[var(--text-primary)] text-[var(--bg-elevated)] rounded hover:opacity-90"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setNewTitle(p.title);
                            setIsRenaming(false);
                          }}
                          className="flex-1 px-2 py-1 folio-meta bg-[var(--bg-base)] text-[var(--text-secondary)] rounded hover:bg-[var(--bg-elevated)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* bottom overlay for text legibility */}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div className="rounded-xl bg-gradient-to-t from-black/70 via-black/50 to-transparent px-4 py-3">
                <div className="folio-ui font-semibold text-white truncate mb-1">
                  {p.title}
                </div>
                <div className="flex items-center justify-between folio-meta text-white/90">
                  <span>Updated {formatTimeAgo(p.updatedAt || p.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </article>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  // Simplified status labels: Draft or Published only
  const displayStatus = status === 'Published' ? 'Published' : 'Draft';

  const styles = {
    'Draft': 'bg-[var(--bg-base)]/80 text-[var(--text-secondary)] border-[var(--border)] backdrop-blur-sm',
    'Published': 'bg-[var(--accent)]/90 text-white border-[var(--accent)] backdrop-blur-sm',
  };

  const style = styles[displayStatus as keyof typeof styles] || styles['Draft'];

  return (
    <span className={cn(
      "folio-meta uppercase tracking-wider px-2.5 py-1 rounded-full border font-medium",
      style
    )}>
      {displayStatus}
    </span>
  );
}

/**
 * Editorial Badge - Shows editorial status as an overlay, NOT a phase
 */
function EditorialBadge({ variant }: { variant: 'featured' | 'candidate' }) {
  if (variant === 'featured') {
    return (
      <div className="flex items-center gap-1.5 rounded-full px-3 py-1 folio-meta border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Editorial</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full px-3 py-1 folio-meta border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
      <Newspaper className="h-3.5 w-3.5" />
      <span>Editorial Candidate</span>
    </div>
  );
}

function Badge({ label, icon: Icon }: { label: string; icon: any }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-3 py-1 folio-meta border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function EditorialProgress({ value }: { value: number }) {
  // 0..100
  return (
    <div className="mt-2">
      <div className="h-2 w-full rounded-full bg-[var(--bg-base)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <div className="mt-1 folio-meta text-[var(--text-secondary)]">
        Editorial readiness: {Math.round(value)}%
      </div>
    </div>
  );
}

function editorialScore(p: ProjectLite) {
  // purely derived client-side; tune safely without schema edits
  const s = (p.savesByOthers ?? 0);
  const t = (p.taggedCount ?? 0);
  const v = (p.influenceValueUsd ?? 0);
  const base = Math.min(100, (s * 2) + (t * 3) + Math.log10(v + 1) * 10);
  // Use overlay-based editorial candidate detection
  const isEditorialCandidate = p.overlays?.isEditorialCandidate ?? false;
  return Math.max(base, isEditorialCandidate ? 75 : 0);
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return 'recently';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'recently';

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
}

function FolioIndexDrawer({ projects }: { projects: ProjectLite[] }) {
  const [open, setOpen] = useState(false);

  const aggregates = useMemo(() => {
    const total = projects.length || 1;
    const avgSaves = projects.reduce((a, p) => a + (p.savesByOthers ?? 0), 0) / total;
    const avgTagged = projects.reduce((a, p) => a + (p.taggedCount ?? 0), 0) / total;

    // Use section-based grouping (new model)
    const grouped = groupBySection(projects);
    const sectionEntries = Object.entries(grouped) as [UISection, ProjectLite[]][];
    const topSection = sectionEntries
      .filter(([key]) => key !== 'ARCHIVED') // Exclude archived from "top" calculation
      .sort((a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0))[0]?.[0] ?? 'IN_PROGRESS';

    // Editorial stats
    const editorialCandidates = projects.filter(p => p.overlays?.isEditorialCandidate).length;
    const editorialFeatured = projects.filter(p => p.overlays?.isEditorialFeatured).length;

    return {
      avgSaves: Math.round(avgSaves),
      avgTagged: Math.round(avgTagged),
      topSection,
      editorialCandidates,
      editorialFeatured,
      bySection: grouped,
    };
  }, [projects]);

  return (
    <>
      <Button
        onClick={() => setOpen(v => !v)}
        variant="outline"
        className="fixed right-4 bottom-6 z-30 shadow-lg"
        aria-label="Open Folio Index"
      >
        <Sparkles className="h-5 w-5 inline mr-2" />
        Folio Index
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-[var(--bg-base)]/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            onClick={e => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-[360px] bg-[var(--bg-elevated)] border-l border-[var(--border)] p-5 overflow-y-auto shadow-lg"
          >
            <h3 className="folio-h3 mb-4 text-[var(--text-primary)]">Portfolio Intelligence</h3>

            {/* Section Breakdown */}
            <div className="mb-6">
              <h4 className="folio-meta uppercase tracking-wider text-[var(--text-secondary)] mb-2">By Section</h4>
              <ul className="space-y-2 folio-body">
                <li className="flex justify-between text-[var(--text-primary)]">
                  <span>Drafts</span>
                  <span className="font-medium">{aggregates.bySection.DRAFTS.length}</span>
                </li>
                <li className="flex justify-between text-[var(--text-primary)]">
                  <span>In Progress</span>
                  <span className="font-medium">{aggregates.bySection.IN_PROGRESS.length}</span>
                </li>
                <li className="flex justify-between text-[var(--text-primary)]">
                  <span>Published</span>
                  <span className="font-medium">{aggregates.bySection.PUBLISHED.length}</span>
                </li>
                <li className="flex justify-between text-[var(--text-secondary)]">
                  <span>Archived</span>
                  <span className="font-medium">{aggregates.bySection.ARCHIVED.length}</span>
                </li>
              </ul>
            </div>

            {/* Engagement Stats */}
            <div className="mb-6">
              <h4 className="folio-meta uppercase tracking-wider text-[var(--text-secondary)] mb-2">Engagement</h4>
              <ul className="space-y-2 folio-body text-[var(--text-primary)]">
                <li className="flex justify-between">
                  <span>Avg Saves / Project</span>
                  <span className="font-medium">{aggregates.avgSaves}</span>
                </li>
                <li className="flex justify-between">
                  <span>Avg Tagged Products</span>
                  <span className="font-medium">{aggregates.avgTagged}</span>
                </li>
              </ul>
            </div>

            {/* Editorial Overlay Stats */}
            <div className="mb-6">
              <h4 className="folio-meta uppercase tracking-wider text-[var(--text-secondary)] mb-2">Editorial Status</h4>
              <ul className="space-y-2 folio-body text-[var(--text-primary)]">
                <li className="flex justify-between">
                  <span>Editorial Candidates</span>
                  <span className="font-medium">{aggregates.editorialCandidates}</span>
                </li>
                <li className="flex justify-between">
                  <span>Editorial Featured</span>
                  <span className="font-medium">{aggregates.editorialFeatured}</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 folio-meta text-[var(--text-tertiary)]">
              *All metrics computed non-destructively from current data. No uploads or schema changes required.
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function formatSectionName(s: UISection): string {
  return {
    IN_PROGRESS: 'In Progress',
    PUBLISHED: 'Published',
    DRAFTS: 'Drafts',
    ARCHIVED: 'Archived',
  }[s] ?? 'In Progress';
}
