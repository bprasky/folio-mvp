'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Sparkles,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Search,
  ExternalLink,
  ChevronDown,
  Plus,
  Download,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserCapabilities } from '@/hooks/useUserCapabilities';
import { EmptyStateHero, GuideCard, UpgradePrompt } from '@/components/projects';
import { Button } from '@/components/ui/button';
import { compareCompletionDates, formatCompletionDate } from '@/lib/projects/completionDate';

// ============================================================================
// TYPES
// ============================================================================

export type Lifecycle = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type Overlays = {
  isPublished: boolean;
  isEditorialCandidate: boolean;
  isEditorialFeatured: boolean;
};

export type UISection = 'IN_PROGRESS' | 'PUBLISHED' | 'DRAFTS' | 'ARCHIVED';

const EDITORIAL_SAVES_THRESHOLD = 25;
const EDITORIAL_TAGGED_THRESHOLD = 10;

export type ProjectLite = {
  id: string;
  title: string;
  coverUrl?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  completedYear?: number | null;
  completedMonth?: number | null;
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
  imageCount?: number;
  roomCount?: number;
  noteCount?: number;
  skeletonCount?: number;
  lifecycle?: Lifecycle;
  overlays?: Overlays;
  uiSection?: UISection;
  ownershipContext?: 'personal' | 'organization';
  organizationId?: string | null;
  organizationName?: string | null;
  // False when the viewer can't delete directly (org Member/Manager/Viewer);
  // the card then offers "Request deletion" instead of "Delete".
  canDelete?: boolean;
};

// A pending deletion request the current user (an org Owner/Admin) can resolve.
export type DeletionRequestLite = {
  id: string;
  projectId: string;
  projectTitle: string;
  requesterName: string;
  reason: string | null;
  orgName: string | null;
};

type StatusTab = 'all' | 'progress' | 'published' | 'drafts';
type SortOption = 'Recent' | 'Completion date' | 'Name A–Z' | 'Most items';

interface ProjectsPageClientProps {
  projectsRaw: ProjectLite[];
  operatingAsOrgId?: string | null;
  pendingDeletionRequests?: DeletionRequestLite[];
}

// ============================================================================
// COVER GRADIENTS — deterministic by project id
// ============================================================================

const COVER_GRADIENTS = [
  'bg-[linear-gradient(160deg,#B89B7A_0%,#6E5642_100%)]',
  'bg-[linear-gradient(160deg,var(--folio-gold-ornament)_0%,#8A6B47_100%)]',
  'bg-[linear-gradient(160deg,#A89378_0%,#4F3A2A_100%)]',
  'bg-[linear-gradient(160deg,#5C6B4E_0%,#2E3B2A_100%)]',
  'bg-[linear-gradient(160deg,var(--folio-copper)_0%,#724A31_100%)]',
];

function hashToIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

function coverGradient(id: string): string {
  return COVER_GRADIENTS[hashToIndex(id, COVER_GRADIENTS.length)];
}

// ============================================================================
// MAIN CLIENT COMPONENT
// ============================================================================

export default function ProjectsPageClient({ projectsRaw, operatingAsOrgId, pendingDeletionRequests = [] }: ProjectsPageClientProps) {
  const { data: session } = useSession();
  const capabilities = useUserCapabilities();
  const [projectsState, setProjectsState] = useState<ProjectLite[]>(projectsRaw);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequestLite[]>(pendingDeletionRequests);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [sort, setSort] = useState<SortOption>('Recent');
  const [activeContextTab, setActiveContextTab] = useState<'all' | 'personal' | 'organization'>('all');

  const projects: ProjectLite[] = useMemo(
    () => (projectsState ?? []).map(mapToProjectLite),
    [projectsState]
  );

  const contextFiltered = useMemo(() => {
    if (activeContextTab === 'personal') return projects.filter(p => p.ownershipContext !== 'organization');
    if (activeContextTab === 'organization') return projects.filter(p => p.ownershipContext === 'organization');
    return projects;
  }, [projects, activeContextTab]);

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return contextFiltered;
    const q = searchQuery.toLowerCase();
    return contextFiltered.filter(p => p.title?.toLowerCase().includes(q));
  }, [contextFiltered, searchQuery]);

  const sortedProjects = useMemo(() => {
    const arr = [...searchFiltered];
    if (sort === 'Name A–Z') {
      arr.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    } else if (sort === 'Most items') {
      arr.sort((a, b) =>
        ((b.taggedCount ?? 0) + (b.roomCount ?? 0)) - ((a.taggedCount ?? 0) + (a.roomCount ?? 0))
      );
    } else {
      arr.sort((a, b) => {
        if (sort === 'Completion date') {
          const completionOrder = compareCompletionDates(a, b);
          if (completionOrder) return completionOrder;
        }
        const da = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        const db = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        return db - da;
      });
    }
    return arr;
  }, [searchFiltered, sort]);

  const allGrouped = useMemo(() => groupBySection(sortedProjects), [sortedProjects]);

  const visibleGroups = useMemo(() => {
    if (statusTab === 'progress') return { ...allGrouped, PUBLISHED: [], DRAFTS: [], ARCHIVED: [] };
    if (statusTab === 'published') return { ...allGrouped, IN_PROGRESS: [], DRAFTS: [], ARCHIVED: [] };
    if (statusTab === 'drafts') return { ...allGrouped, IN_PROGRESS: [], PUBLISHED: [], ARCHIVED: [] };
    return allGrouped;
  }, [allGrouped, statusTab]);

  const contextCounts = useMemo(() => {
    const personal = projects.filter(p => p.ownershipContext !== 'organization').length;
    const organization = projects.filter(p => p.ownershipContext === 'organization').length;
    return { personal, organization, total: projects.length };
  }, [projects]);

  const orgName = useMemo(() => {
    const orgProject = projects.find(p => p.organizationName);
    return orgProject?.organizationName || (session?.user as any)?.operatingAsOrg?.name || 'My Firm';
  }, [projects, session]);

  const totals = useMemo(() => {
    const totalProjects = sortedProjects.length;
    const published = allGrouped.PUBLISHED;
    const totalPublished = published.length;
    const totalTagged = sortedProjects.reduce((a, p) => a + (p.taggedCount ?? 0), 0);
    const totalViews = published.reduce((a, p) => a + (p.views ?? 0), 0);
    const inProgress = allGrouped.IN_PROGRESS.length;
    const drafts = allGrouped.DRAFTS.length;
    const lastPublishedAt = published.reduce<Date | null>((latest, p) => {
      const d = p.publishedAt ? new Date(p.publishedAt) : null;
      if (!d) return latest;
      return !latest || d > latest ? d : latest;
    }, null);
    return { totalProjects, totalPublished, totalTagged, totalViews, inProgress, drafts, lastPublishedAt };
  }, [sortedProjects, allGrouped]);

  const summarySentence = useMemo(() => {
    if (totals.totalProjects === 0) return 'Nothing in progress yet — start your first project.';
    if (totals.inProgress === 0) return `${spellNumber(totals.totalPublished)} published, nothing active`;
    const uniqueStages = new Set(allGrouped.IN_PROGRESS.map(p => p.stage).filter(Boolean));
    const stageCount = uniqueStages.size || 1;
    return `${spellNumber(totals.inProgress)} active across ${spellNumber(stageCount)} ${stageCount === 1 ? 'phase' : 'phases'}`;
  }, [totals, allGrouped]);

  // ── Handlers (unchanged logic) ──

  const handleRename = async (projectId: string, newTitle: string) => {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rename project');
    }
    setProjectsState(prev => prev.map(p => p.id === projectId ? { ...p, title: newTitle } : p));
  };

  const handleDelete = async (projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete project');
    }
    const result = await response.json();
    if (result.deleted) {
      setProjectsState(prev => prev.filter(p => p.id !== projectId));
    } else if (result.archived) {
      setProjectsState(prev =>
        prev.map(p => p.id === projectId ? { ...p, status: 'archived', lifecycle: 'ARCHIVED' as Lifecycle } : p)
      );
      alert(result.message);
    }
  };

  const handleForceDelete = async (projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}/force-delete`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to force delete project');
    }
    setProjectsState(prev => prev.filter(p => p.id !== projectId));
  };

  // Member without delete rights asks an Owner/Admin to delete. On success we
  // hide the project from this viewer ("hide for you") — it reappears only if
  // an admin declines and the page is reloaded.
  const handleRequestDeletion = async (projectId: string, reason?: string) => {
    const response = await fetch(`/api/projects/${projectId}/deletion-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to submit deletion request');
    }
    setProjectsState(prev => prev.filter(p => p.id !== projectId));
  };

  // Owner/Admin resolves a pending request from the queue.
  const handleResolveRequest = async (requestId: string, action: 'approve' | 'decline') => {
    const response = await fetch(`/api/deletion-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to resolve request');
    }
    const resolved = deletionRequests.find(r => r.id === requestId);
    setDeletionRequests(prev => prev.filter(r => r.id !== requestId));
    // If approved, the project is gone — drop it from the grid too.
    if (action === 'approve' && resolved) {
      setProjectsState(prev => prev.filter(p => p.id !== resolved.projectId));
    }
  };

  // ── Derived display data ──

  const STATUS_TABS: { value: StatusTab; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: totals.totalProjects },
    { value: 'progress', label: 'In progress', count: totals.inProgress },
    { value: 'published', label: 'Published', count: totals.totalPublished },
    { value: 'drafts', label: 'Drafts', count: totals.drafts },
  ];

  const stats = [
    { label: 'Projects', value: String(totals.totalProjects), delta: `${totals.inProgress} in progress` },
    {
      label: 'Published',
      value: String(totals.totalPublished),
      delta: totals.lastPublishedAt ? `last on ${formatShort(totals.lastPublishedAt)}` : 'none yet',
    },
    { label: 'Products tagged', value: formatCount(totals.totalTagged), delta: 'across projects' },
    { label: 'Total views', value: formatCount(totals.totalViews), delta: 'since publishing' },
    { label: 'Affiliate clicks', value: '—', delta: 'trailing 30 days' },
  ];

  const userName = session?.user?.name ?? '';
  const operatingAsOrg = (session?.user as any)?.operatingAsOrg;
  const studioName = operatingAsOrg?.name ?? (userName ? `${userName.split(' ')[0]} Design Studio` : 'My Studio');
  const totalForNew = sortedProjects.length;

  return (
    <div className="min-h-screen w-full -mx-6">
      <div className="max-w-[1280px] mx-auto px-10 pt-9 pb-24">

        {/* ── Page header ── */}
        <header className="grid grid-cols-[1fr_auto] items-end gap-6 pb-7 border-b border-folio-border-subtle">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="folio-eyebrow text-folio-text-secondary">My workspace</span>
              <span className="w-1 h-1 rounded-full bg-folio-text-tertiary" aria-hidden />
              <span className="folio-eyebrow text-folio-text-tertiary">{studioName}</span>
            </div>
            <h1 className={"font-headline italic font-medium text-[56px] leading-[1.02] tracking-[-0.01em] text-folio-text-primary" /* folio-design-system: off-scale */}>
              Projects
            </h1>
            <div className="mt-2.5 flex items-center gap-4 text-sm text-folio-text-secondary">
              <span>{summarySentence}</span>
              <span className="w-1 h-1 rounded-full bg-folio-text-tertiary" aria-hidden />
              <Link
                href="/designer/profile"
                className="text-folio-gold no-underline hover:text-folio-gold-hover transition-colors"
              >
                View directory listing →
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="ridge"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[length:var(--type-meta)] font-medium rounded-[10px]"
            >
              <Download className="w-3.5 h-3.5" />
              Import
            </Button>
            <Link
              href="/projects/new"
              className="accent-btn inline-flex items-center gap-2 px-4 py-2.5 text-[length:var(--type-meta)] font-medium rounded-[10px]"
            >
              <Plus className="w-3.5 h-3.5" />
              New project
            </Link>
          </div>
        </header>

        {/* ── Stats baseline (designer only) ── */}
        {!capabilities.isIndividual && (
          <div className="flex gap-9 items-end py-[22px] border-b border-folio-border-subtle overflow-x-auto">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  'flex flex-col gap-1 flex-shrink-0',
                  i < stats.length - 1 && 'pr-9 border-r border-folio-border-subtle'
                )}
              >
                <span className="text-[length:var(--type-eyebrow)] font-medium tracking-[var(--ls-eyebrow)] uppercase text-folio-text-tertiary">
                  {s.label}
                </span>
                <span className={"font-headline text-[30px] font-medium leading-none tabular-nums text-folio-text-primary" /* folio-design-system: off-scale */}>
                  {s.value}
                </span>
                <span className="text-xs text-folio-text-secondary">{s.delta}</span>
              </div>
            ))}
          </div>
        )}

        {/* Context tabs — only when user has projects in multiple contexts */}
        {!operatingAsOrgId && contextCounts.organization > 0 && (
          <div className="flex items-center gap-2 pt-5">
            {(['all', 'personal', 'organization'] as const).map((tab) => {
              const label =
                tab === 'all' ? `All (${contextCounts.total})` :
                tab === 'personal' ? `Personal (${contextCounts.personal})` :
                `${orgName} (${contextCounts.organization})`;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveContextTab(tab)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-full transition-colors',
                    activeContextTab === tab
                      ? 'bg-folio-text-primary text-surface-canvas'
                      : 'bg-surface-canvas text-folio-text-secondary hover:bg-surface-ground'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Filter strip ── */}
        <div className="flex items-center gap-2.5 py-5 pb-6">
          <div role="tablist" className="inline-flex bg-surface-ground border border-folio-border-subtle rounded-full p-[3px]">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={statusTab === tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors duration-150',
                  statusTab === tab.value
                    ? 'bg-surface-canvas text-folio-text-primary shadow-[0_1px_2px_rgba(22,22,20,0.06)]'
                    : 'text-folio-text-secondary hover:text-folio-text-primary'
                )}
              >
                {tab.label}
                <span className="ml-1 text-folio-text-tertiary tabular-nums">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <label
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-folio-border-subtle bg-surface-canvas min-w-[240px] hover:border-folio-border-strong focus-within:border-folio-border-strong transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-folio-text-tertiary flex-shrink-0" />
            <input
              type="search"
              placeholder="Search projects by name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search projects"
              className="bg-transparent border-0 outline-none text-sm text-folio-text-primary placeholder:text-folio-text-tertiary w-full"
            />
          </label>

          <SortMenu value={sort} onChange={setSort} />
        </div>

        {/* ── Pending deletion requests (approvers only) ── */}
        {deletionRequests.length > 0 && (
          <DeletionRequestsQueue
            requests={deletionRequests}
            onResolve={handleResolveRequest}
          />
        )}

        {/* ── Empty state ── */}
        {projects.length === 0 && (
          <div className="py-12">
            <EmptyStateHero
              userType={capabilities.userType}
              userName={session?.user?.name ?? undefined}
            />
            {capabilities.isDesigner && (
              <div className="mt-6">
                <GuideCard projectCount={0} taggedCount={0} hasInterviewed={false} publishedCount={0} />
              </div>
            )}
            {capabilities.isFreeDesigner && (
              <div className="mt-6">
                <UpgradePrompt variant="subtle" />
              </div>
            )}
          </div>
        )}

        {/* ── Sections ── */}
        {projects.length > 0 && (
          <div className="space-y-10">
            {capabilities.isDesigner && totals.totalProjects > 0 && totals.totalPublished === 0 && (
              <GuideCard
                projectCount={totals.totalProjects}
                taggedCount={totals.totalTagged}
                hasInterviewed={false}
                publishedCount={totals.totalPublished}
              />
            )}

            {(statusTab === 'all' || statusTab === 'drafts') && (
              <CollapsibleSection
                title="Drafts"
                projects={visibleGroups.DRAFTS}
                defaultExpanded={visibleGroups.DRAFTS.length > 0}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
                onRequestDeletion={handleRequestDeletion}
              />
            )}

            {(statusTab === 'all' || statusTab === 'progress') && visibleGroups.IN_PROGRESS.length > 0 && (
              <ProjectSection
                title="In progress"
                projects={visibleGroups.IN_PROGRESS}
                showNewTile={totalForNew < 9}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
                onRequestDeletion={handleRequestDeletion}
              />
            )}

            {(statusTab === 'all' || statusTab === 'published') && visibleGroups.PUBLISHED.length > 0 && (
              <ProjectSection
                title="Published"
                projects={visibleGroups.PUBLISHED}
                showNewTile={false}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
                onRequestDeletion={handleRequestDeletion}
              />
            )}

            {statusTab === 'all' && (
              <CollapsibleSection
                title="Archived"
                projects={visibleGroups.ARCHIVED}
                defaultExpanded={false}
                onRename={handleRename}
                onDelete={handleDelete}
                onForceDelete={handleForceDelete}
                onRequestDeletion={handleRequestDeletion}
              />
            )}

            {capabilities.isFreeDesigner && totals.totalProjects > 0 && (
              <div className="pt-4">
                <UpgradePrompt variant="prominent" />
              </div>
            )}
          </div>
        )}
      </div>

      <FolioIndexDrawer projects={projects} />
    </div>
  );
}

// ============================================================================
// DELETION REQUEST QUEUE (Owner/Admin)
// ============================================================================

function DeletionRequestsQueue({
  requests,
  onResolve,
}: {
  requests: DeletionRequestLite[];
  onResolve: (id: string, action: 'approve' | 'decline') => Promise<void>;
}) {
  return (
    <section className="mb-8 rounded-xl border border-folio-border-subtle bg-surface-canvas p-5">
      <h2 className="folio-ui font-semibold text-folio-text-secondary uppercase tracking-wider mb-4">
        Deletion requests
        <span className="ml-2 text-folio-text-tertiary normal-case tracking-normal">
          {requests.length} pending
        </span>
      </h2>
      <ul className="space-y-3">
        {requests.map(r => (
          <DeletionRequestRow key={r.id} request={r} onResolve={onResolve} />
        ))}
      </ul>
    </section>
  );
}

function DeletionRequestRow({
  request,
  onResolve,
}: {
  request: DeletionRequestLite;
  onResolve: (id: string, action: 'approve' | 'decline') => Promise<void>;
}) {
  const [busy, setBusy] = useState<null | 'approve' | 'decline'>(null);

  const resolve = async (action: 'approve' | 'decline') => {
    if (action === 'approve' && !window.confirm(
      `Permanently delete "${request.projectTitle}"? This cannot be undone.`
    )) return;
    try {
      setBusy(action);
      await onResolve(request.id, action);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to resolve request.');
      setBusy(null);
    }
  };

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-folio-border-subtle bg-surface-ground px-4 py-3">
      <div className="min-w-0">
        <div className="folio-ui text-folio-text-primary font-medium truncate">
          {request.projectTitle}
        </div>
        <div className="folio-meta text-folio-text-tertiary truncate">
          Requested by {request.requesterName}
          {request.orgName ? ` · ${request.orgName}` : ''}
          {request.reason ? ` · "${request.reason}"` : ''}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => resolve('decline')}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 folio-meta font-medium text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:bg-surface-canvas transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
        <button
          onClick={() => resolve('approve')}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 folio-meta font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          {busy === 'approve' ? 'Deleting…' : 'Approve & delete'}
        </button>
      </div>
    </li>
  );
}

// ============================================================================
// SECTION HEAD
// ============================================================================

function ProjectsSectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3.5 mt-3 mb-5">
      <h2 className="font-headline italic font-medium text-2xl leading-none text-folio-text-primary">
        {title}
      </h2>
      <span className="text-sm text-folio-text-tertiary">
        {count} {count === 1 ? 'project' : 'projects'}
      </span>
      <span className="flex-1 h-px bg-folio-border-subtle self-center" />
    </div>
  );
}

// ============================================================================
// PROJECT SECTION (non-collapsible)
// ============================================================================

function ProjectSection({
  title,
  projects,
  showNewTile,
  onRename,
  onDelete,
  onForceDelete,
  onRequestDeletion,
}: {
  title: string;
  projects: ProjectLite[];
  showNewTile?: boolean;
  onRename?: (id: string, t: string) => void;
  onDelete?: (id: string) => void;
  onForceDelete?: (id: string) => void;
  onRequestDeletion?: (id: string, reason?: string) => Promise<void>;
}) {
  if (projects.length === 0 && !showNewTile) return null;

  return (
    <div>
      <ProjectsSectionHead title={title} count={projects.length} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-7">
        {projects.map(p => (
          <ProjectCard key={p.id} p={p} onRename={onRename} onDelete={onDelete} onForceDelete={onForceDelete} onRequestDeletion={onRequestDeletion} />
        ))}
        {showNewTile && <NewProjectTile />}
      </div>
    </div>
  );
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function CollapsibleSection({
  title,
  projects,
  defaultExpanded,
  onRename,
  onDelete,
  onForceDelete,
  onRequestDeletion,
}: {
  title: string;
  projects: ProjectLite[];
  defaultExpanded: boolean;
  onRename?: (id: string, t: string) => void;
  onDelete?: (id: string) => void;
  onForceDelete?: (id: string) => void;
  onRequestDeletion?: (id: string, reason?: string) => Promise<void>;
}) {
  const storageKey = `projects-section-${title}-expanded`;
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? saved === 'true' : defaultExpanded;
    }
    return defaultExpanded;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(isExpanded));
    }
  }, [isExpanded, storageKey]);

  if (projects.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-baseline gap-3.5 mt-3 mb-5 text-left"
      >
        <h2 className="font-headline italic font-medium text-2xl leading-none text-folio-text-primary">
          {title}
        </h2>
        <span className="text-sm text-folio-text-tertiary">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </span>
        <span className="flex-1 h-px bg-folio-border-subtle self-center" />
        <ChevronDown
          className={cn('w-4 h-4 text-folio-text-tertiary flex-shrink-0 transition-transform self-center', isExpanded && 'rotate-180')}
        />
      </button>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-7">
          {projects.map(p => (
            <ProjectCard key={p.id} p={p} onRename={onRename} onDelete={onDelete} onForceDelete={onForceDelete} onRequestDeletion={onRequestDeletion} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NEW PROJECT TILE
// ============================================================================

function NewProjectTile() {
  return (
    <Link href="/projects/new" className="opacity-60 hover:opacity-100 transition-opacity block">
      <div className="aspect-[4/3] rounded-xl border border-dashed border-folio-border-strong bg-surface-ground flex items-center justify-center text-sm text-folio-text-tertiary">
        + New project
      </div>
      <div className="pt-3.5 px-1">
        <div className={"font-headline italic text-[19px] text-folio-text-tertiary" /* folio-design-system: off-scale */}>Untitled</div>
        <div className="text-xs text-folio-text-tertiary mt-0.5">Start a new board</div>
      </div>
    </Link>
  );
}

// ============================================================================
// SORT MENU
// ============================================================================

const SORT_OPTIONS: SortOption[] = ['Recent', 'Completion date', 'Name A–Z', 'Most items'];

function SortMenu({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-folio-border-subtle bg-surface-canvas text-sm font-medium text-folio-text-secondary hover:border-folio-border-strong transition-colors"
      >
        {value}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-surface-canvas border border-folio-border-subtle rounded-lg shadow-lg py-1 z-20">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                'w-full text-left px-3.5 py-2 text-sm transition-colors',
                opt === value
                  ? 'text-folio-text-primary font-medium bg-surface-ground'
                  : 'text-folio-text-secondary hover:text-folio-text-primary hover:bg-surface-ground'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROJECT CARD
// ============================================================================

function ProjectCard({ p, onRename, onDelete, onForceDelete, onRequestDeletion }: {
  p: ProjectLite;
  onRename?: (id: string, t: string) => void;
  onDelete?: (id: string) => void;
  onForceDelete?: (id: string) => void;
  onRequestDeletion?: (id: string, reason?: string) => Promise<void>;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(p.title);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  // Members of an org who lack delete rights can't delete directly.
  const canDelete = p.canDelete !== false;
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isArchived = p.lifecycle === 'ARCHIVED' || p.status === 'archived';
  const isPublished = !!(p.isPublic || p.publishedAt || p.status === 'published');
  const isDraft = p.lifecycle === 'DRAFT';

  const statusLabel = isPublished ? 'Published' : isDraft ? 'Draft' : 'In progress';
  const statusDot = isPublished ? 'bg-[#6FA67A]' : isDraft ? 'bg-folio-text-tertiary' : 'bg-folio-gold-ornament';

  const itemCount = (p.taggedCount ?? 0) + (p.roomCount ?? 0);
  const completionDate = formatCompletionDate(p);
  const category = !completionDate && p.stage ? stageLabelShort(p.stage) : '';
  const subline = isPublished && p.publishedAt
    ? formatShort(new Date(p.publishedAt))
    : `${p.roomCount ?? 0} ${(p.roomCount ?? 0) === 1 ? 'room' : 'rooms'}`;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    }
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const doRename = async () => {
    if (!onRename || !newTitle.trim()) return;
    try {
      await onRename(p.id, newTitle.trim());
      setIsRenaming(false);
      setIsMenuOpen(false);
    } catch {
      alert('Failed to rename project. Please try again.');
    }
  };

  const doDelete = async () => {
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
      alert(error instanceof Error ? error.message : 'Failed to delete project. Please try again.');
      setIsDeleting(false);
    }
  };

  const doRequestDeletion = async () => {
    if (!onRequestDeletion) return;
    const reason = window.prompt(
      'Ask an org Owner/Admin to delete this project. Add an optional note for them:',
      ''
    );
    if (reason === null) return; // cancelled
    try {
      setIsRequesting(true);
      await onRequestDeletion(p.id, reason.trim() || undefined);
      setIsMenuOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit deletion request. Please try again.');
      setIsRequesting(false);
    }
  };

  const doForceDelete = async () => {
    if (!onForceDelete) return;
    const confirmed = window.confirm(
      'Permanently delete this archived project? This cannot be undone.'
    );
    if (!confirmed) return;
    try {
      setIsDeleting(true);
      await onForceDelete(p.id);
      setIsMenuOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete project. Please try again.');
      setIsDeleting(false);
    }
  };

  const doTogglePublish = async () => {
    try {
      setIsPublishing(true);
      const response = await fetch(`/api/projects/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !p.isPublic }),
      });
      if (!response.ok) throw new Error('Failed to update publish status');
      window.location.reload();
    } catch {
      alert('Failed to update publish status. Please try again.');
      setIsPublishing(false);
    }
  };

  return (
    <article
      className="group transition-transform duration-[220ms] hover:-translate-y-0.5"
      aria-label={`${p.title}, ${statusLabel}, ${itemCount} items`}
    >
      <Link href={`/project/${p.id}`} className="block">
        {/* Cover */}
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-folio-border-subtle transition-shadow duration-[220ms] group-hover:shadow-[0_6px_24px_rgba(22,22,20,0.08)]">
          {p.coverUrl ? (
            <Image
              src={p.coverUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className={cn('absolute inset-0', coverGradient(p.id))}>
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: 'repeating-linear-gradient(135deg, #fff 0px, #fff 1px, transparent 1px, transparent 8px)' }}
              />
            </div>
          )}

          {/* Status pill */}
          <span className={"absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.92] backdrop-blur-md rounded-full border border-folio-border-subtle text-[length:var(--type-eyebrow)] font-medium tracking-[0.04em] text-folio-text-primary" /* folio-design-system: off-scale */}>
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDot)} aria-hidden />
            {statusLabel}
          </span>

          {/* Context menu */}
          <div
            ref={menuRef}
            className="absolute top-3 right-3 z-20"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
              className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
              title="Project options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface-ground border border-folio-border-subtle rounded-lg shadow-lg py-1 z-50">
                {!isRenaming ? (
                  <>
                    <Link
                      href={`/project/${p.id}`}
                      onClick={e => { e.stopPropagation(); setIsMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas text-folio-text-primary flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" /> Edit
                    </Link>
                    <Link
                      href={`/project/${p.id}`}
                      onClick={e => { e.stopPropagation(); setIsMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas text-folio-text-primary flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Preview
                    </Link>
                    {!isArchived && (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); doTogglePublish(); setIsMenuOpen(false); }}
                        disabled={isPublishing}
                        className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas text-folio-text-primary flex items-center gap-2 disabled:opacity-50"
                      >
                        {p.isPublic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {isPublishing ? 'Updating…' : p.isPublic ? 'Unpublish' : 'Publish'}
                      </button>
                    )}
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setIsRenaming(true); }}
                      className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas text-folio-text-primary flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" /> Rename
                    </button>
                    {!canDelete ? (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); doRequestDeletion(); }}
                        disabled={isRequesting}
                        className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas text-folio-text-secondary flex items-center gap-2 disabled:opacity-50"
                        title="You don't have permission to delete; this asks an org Owner/Admin"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isRequesting ? 'Requesting…' : 'Request deletion'}
                      </button>
                    ) : isArchived ? (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); doForceDelete(); }}
                        disabled={isDeleting}
                        className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas text-red-600 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? 'Deleting…' : 'Permanently delete'}
                      </button>
                    ) : (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); doDelete(); }}
                        disabled={isDeleting}
                        className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas text-red-600 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="px-3 py-2">
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') doRename();
                        else if (e.key === 'Escape') { setNewTitle(p.title); setIsRenaming(false); }
                      }}
                      className="w-full px-2 py-1 folio-ui border border-folio-border-subtle rounded bg-surface-ground text-folio-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); doRename(); }}
                        className="flex-1 px-2 py-1 folio-meta bg-[var(--text-primary)] text-[var(--surface-ground)] rounded hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setNewTitle(p.title); setIsRenaming(false); }}
                        className="flex-1 px-2 py-1 folio-meta bg-surface-canvas text-folio-text-secondary rounded hover:bg-surface-ground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body — text under image, no card chrome */}
        <div className="pt-3.5 px-1 flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className={"font-headline font-medium text-[19px] leading-tight text-folio-text-primary mb-1 truncate" /* folio-design-system: off-scale */}>
              {p.title}
            </div>
            {completionDate && <p className="mb-1 text-xs text-folio-text-secondary">{completionDate}</p>}
            <div className="flex items-center gap-2 text-xs text-folio-text-tertiary">
              {category && <span>{category}</span>}
              {category && <span className="w-[3px] h-[3px] rounded-full bg-folio-text-tertiary flex-shrink-0" />}
              <span>{subline}</span>
            </div>
          </div>
          <span className={"font-mono text-[length:var(--type-eyebrow)] text-folio-text-secondary tracking-[0.02em] whitespace-nowrap pt-0.5 flex-shrink-0" /* folio-design-system: off-scale */}>
            {itemCount} items
          </span>
        </div>
      </Link>
    </article>
  );
}

// ============================================================================
// FOLIO INDEX DRAWER
// ============================================================================

function FolioIndexDrawer({ projects }: { projects: ProjectLite[] }) {
  const [open, setOpen] = useState(false);

  const aggregates = useMemo(() => {
    const total = projects.length || 1;
    const avgSaves = projects.reduce((a, p) => a + (p.savesByOthers ?? 0), 0) / total;
    const avgTagged = projects.reduce((a, p) => a + (p.taggedCount ?? 0), 0) / total;
    const grouped = groupBySection(projects);
    const editorialCandidates = projects.filter(p => p.overlays?.isEditorialCandidate).length;
    const editorialFeatured = projects.filter(p => p.overlays?.isEditorialFeatured).length;
    return { avgSaves: Math.round(avgSaves), avgTagged: Math.round(avgTagged), editorialCandidates, editorialFeatured, bySection: grouped };
  }, [projects]);

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open Folio Index"
        className="fixed right-4 bottom-6 z-30 inline-flex items-center gap-2 pl-[14px] pr-4 py-[10px] rounded-full bg-surface-canvas border border-folio-border-strong shadow-[var(--neu-raised)] hover:-translate-y-px hover:shadow-[var(--neu-raised-lg)] transition-all duration-150 text-sm font-medium text-folio-text-primary"
      >
        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        Folio Index
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-surface-canvas/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <aside
            onClick={e => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-[360px] bg-surface-ground border-l border-folio-border-subtle p-5 overflow-y-auto shadow-lg"
          >
            <h3 className="folio-h3 mb-4 text-folio-text-primary">Portfolio intelligence</h3>

            <div className="mb-6">
              <h4 className="folio-meta uppercase tracking-wider text-folio-text-secondary mb-2">By section</h4>
              <ul className="space-y-2 folio-body">
                <li className="flex justify-between text-folio-text-primary"><span>Drafts</span><span className="font-medium">{aggregates.bySection.DRAFTS.length}</span></li>
                <li className="flex justify-between text-folio-text-primary"><span>In progress</span><span className="font-medium">{aggregates.bySection.IN_PROGRESS.length}</span></li>
                <li className="flex justify-between text-folio-text-primary"><span>Published</span><span className="font-medium">{aggregates.bySection.PUBLISHED.length}</span></li>
                <li className="flex justify-between text-folio-text-secondary"><span>Archived</span><span className="font-medium">{aggregates.bySection.ARCHIVED.length}</span></li>
              </ul>
            </div>

            <div className="mb-6">
              <h4 className="folio-meta uppercase tracking-wider text-folio-text-secondary mb-2">Engagement</h4>
              <ul className="space-y-2 folio-body text-folio-text-primary">
                <li className="flex justify-between"><span>Avg saves / project</span><span className="font-medium">{aggregates.avgSaves}</span></li>
                <li className="flex justify-between"><span>Avg tagged products</span><span className="font-medium">{aggregates.avgTagged}</span></li>
              </ul>
            </div>

            <div className="mb-6">
              <h4 className="folio-meta uppercase tracking-wider text-folio-text-secondary mb-2">Editorial status</h4>
              <ul className="space-y-2 folio-body text-folio-text-primary">
                <li className="flex justify-between"><span>Editorial candidates</span><span className="font-medium">{aggregates.editorialCandidates}</span></li>
                <li className="flex justify-between"><span>Editorial featured</span><span className="font-medium">{aggregates.editorialFeatured}</span></li>
              </ul>
            </div>

            <p className="folio-meta text-folio-text-tertiary">
              All metrics computed non-destructively from current data.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}

// ============================================================================
// LIFECYCLE + OVERLAYS (unchanged logic)
// ============================================================================

function computeLifecycle(p: ProjectLite): Lifecycle {
  if (p.archivedAt || (p.status ?? '').toLowerCase() === 'archived') return 'ARCHIVED';
  const hasSubstance =
    (p.imageCount ?? 0) > 0 || p.coverUrl != null ||
    (p.roomCount ?? 0) > 0 || (p.taggedCount ?? 0) > 0 ||
    (p.noteCount ?? 0) > 0 || (p.skeletonCount ?? 0) > 0;
  return hasSubstance ? 'ACTIVE' : 'DRAFT';
}

function computeOverlays(p: ProjectLite): Overlays {
  const isPublished = Boolean(p.isPublic || p.publishedAt);
  const saves = p.savesByOthers ?? 0;
  const tagged = p.taggedCount ?? 0;
  const isEditorialCandidate = isPublished && saves >= EDITORIAL_SAVES_THRESHOLD && tagged >= EDITORIAL_TAGGED_THRESHOLD;
  return { isPublished, isEditorialCandidate, isEditorialFeatured: false };
}

function computeUISection(lifecycle: Lifecycle, overlays: Overlays): UISection {
  if (lifecycle === 'ARCHIVED') return 'ARCHIVED';
  if (overlays.isPublished) return 'PUBLISHED';
  if (lifecycle === 'DRAFT') return 'DRAFTS';
  return 'IN_PROGRESS';
}

function mapToProjectLite(p: ProjectLite): ProjectLite {
  const taggedCount = Number(p.taggedCount ?? 0);
  const savesByOthers = Number(p.savesByOthers ?? 0);
  const influenceValueUsd = Number(p.influenceValueUsd ?? 0);
  const views = Number(p.views ?? 0);
  const lifecycle = computeLifecycle({ ...p, taggedCount, savesByOthers });
  const overlays = computeOverlays({ ...p, taggedCount, savesByOthers });
  const uiSection = computeUISection(lifecycle, overlays);
  return { ...p, taggedCount, savesByOthers, influenceValueUsd, views, lifecycle, overlays, uiSection };
}

function groupBySection(projects: ProjectLite[]) {
  return projects.reduce<Record<UISection, ProjectLite[]>>(
    (acc, p) => {
      const section = p.uiSection ?? 'IN_PROGRESS';
      (acc[section] ??= []).push(p);
      return acc;
    },
    { IN_PROGRESS: [], PUBLISHED: [], DRAFTS: [], ARCHIVED: [] }
  );
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

function formatShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const suffix = d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${months[d.getMonth()]} ${d.getDate()}${suffix}`;
}

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n > 999) return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  return String(n);
}

const SPELL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

function spellNumber(n: number): string {
  return n >= 0 && n <= 12 ? SPELL[n] : String(n);
}

function stageLabelShort(stage: string): string {
  const map: Record<string, string> = {
    concept: 'Concept',
    schematic: 'Schematic',
    design_development: 'DD',
    cd_pre_spec: 'CD / pre-spec',
    spec_locked: 'Spec locked',
    in_procurement: 'Procurement',
    install: 'Install',
  };
  return map[stage] ?? stage;
}
