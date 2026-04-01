import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import ProjectTabs from './ProjectTabs';
import MediaSection from './MediaSection';
import DesignerBoard from './DesignerBoard';
import ProjectHero from './ProjectHero';
import ProjectMediaManager from './ProjectMediaManager';
import DraftsPanel from './DraftsPanel';
import StoryPanel from './StoryPanel';
import StagingPublishPanel, { NoDraftState } from './StagingPublishPanel';
import { getPostForStaging } from '@/lib/post/getPostForStaging';
import ProjectEmptyState from './ProjectEmptyState';
import ProjectEmptyStateDiscovery from './ProjectEmptyStateDiscovery';
import ActionItemsPanel from './ActionItemsPanel';
import { getEditorialState, type EditorialState } from '@/lib/editorial/getEditorialState';

type TabView = 'overview' | 'media' | 'boards' | 'drafts' | 'files' | 'publish' | 'story' | 'actions';

export default async function ProjectPage({ 
  params, 
  searchParams 
}: { 
  params: { id: string };
  searchParams: { view?: string };
}) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const viewerRole = (session as any)?.user?.role ?? 'GUEST';
  // Context detection: null = individual/personal, string = operating as organization
  const operatingAsOrgId = (session as any)?.user?.operatingAsOrgId ?? null;

  // Fetch by ID only — never add owner constraints here
  const base = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      projectType: true,
      clientType: true,
      budgetBand: true,
      city: true,
      regionState: true,
      updatedAt: true,
      ownerId: true,
      createdAt: true,
      category: true,
      status: true,
      isPublic: true,
      publishedAt: true,
      views: true,
      saves: true,
      shares: true,
      // Include images with tags for Media tab
      images: {
        include: {
          tags: {
            include: {
              product: true,
            },
          },
        },
        // Order by displayOrder if available, otherwise by createdAt
        // Note: We'll sort in memory to handle nulls properly
        orderBy: { createdAt: 'desc' },
      },
      // Include ProjectPost for Instagram export + publish state detection
      post: {
        select: {
          expandedBlocks: true,
          status: true,
          publishedAt: true,
        },
      },
      // Include rooms and selections for Designer Board
      rooms: {
        include: {
          selections: {
            orderBy: { createdAt: 'desc' }
          }
        }
      },
    },
  });

  if (!base) {
    console.warn('[project-detail] not found by id', { id: params.id });
    notFound();
  }

  // Some data sets still have designerId; try to read it but don't fail if column doesn't exist
  let designerId: string | null = null;
  try {
    const extra = (await prisma.project.findUnique({
      where: { id: params.id },
      // @ts-ignore — ignore if the column doesn't exist in this schema
      select: { designerId: true },
    } as any)) as any;
    designerId = extra?.designerId ?? null;
  } catch {}

  const isOwner =
    viewerRole === 'ADMIN' ||
    (!!viewerId && (viewerId === base.ownerId || (!!designerId && viewerId === designerId)));

  if (!isOwner) {
    console.warn('[project-detail] forbidden', { projectId: base.id, viewerId, viewerRole, ownerId: base.ownerId, designerId });
    // Use 404 for now to avoid leaking; later swap to a 403 page
    notFound();
  }

  // Count interview answers for state detection
  const interviewAnswerCount = await prisma.editorialInterviewAnswer.count({
    where: { interview: { projectId: params.id } },
  });

  // Formalized editorial state machine (spec: 17_EDITORIAL_FLOW_SPEC.md §2)
  const editorialState = getEditorialState({
    post: base.post ? {
      status: base.post.status,
      publishedAt: base.post.publishedAt ?? null,
      expandedBlocks: base.post.expandedBlocks,
    } : null,
    interviewAnswerCount,
  });

  const isPublished = editorialState === 'PUBLISHED';
  const hasDraftOrPublished = (['GENERATED', 'PUBLISHED', 'UNPUBLISHED'] as EditorialState[]).includes(editorialState);

  // Determine current view from search params
  // Default: 'media' for unpublished (primary workspace), 'boards' for published
  const defaultView: TabView = isPublished ? 'boards' : 'media';
  let currentView: TabView = (searchParams.view as TabView) || defaultView;

  // Handle redirects from old tab names
  // files → media, drafts → publish
  if (currentView === 'files') {
    currentView = 'media';
  } else if (currentView === 'drafts') {
    currentView = 'publish';
  }

  // Redirect story tab to media when project is not yet published
  if (!isPublished && currentView === 'story') {
    currentView = 'media';
  }
  // Redirect publish tab to media only when no draft or published content exists
  if (!hasDraftOrPublished && currentView === 'publish') {
    currentView = 'media';
  }

  // Validate view parameter
  const validViews: TabView[] = ['overview', 'media', 'boards', 'drafts', 'files', 'publish', 'story', 'actions'];
  const view = validViews.includes(currentView) ? currentView : defaultView;

  // Convert Prisma Decimal objects to numbers for client components
  const sanitizedProject = {
    ...base,
    rooms: base.rooms.map(room => ({
      ...room,
      selections: room.selections.map(selection => ({
        ...selection,
        unitPrice: selection.unitPrice ? Number(selection.unitPrice) : null,
      }))
    }))
  };

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

  // Determine if project has meaningful content
  // A project is considered "empty" if:
  // - No images uploaded, AND
  // - No rooms created
  const hasMedia = base.images && base.images.length > 0;
  const hasRooms = base.rooms && base.rooms.length > 0;
  const isProjectEmpty = !hasMedia && !hasRooms;

  // Show empty state for empty projects
  // Context-aware: organization context → designer flow, personal context → discovery flow
  if (isProjectEmpty) {
    // If operating as organization → show designer import/publish flow
    // If operating as individual/personal (no org context) → show discovery flow
    const isOrganizationContext = !!operatingAsOrgId;

    if (isOrganizationContext) {
      return <ProjectEmptyState project={sanitizedProject} />;
    } else {
      return <ProjectEmptyStateDiscovery project={sanitizedProject} />;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Back Button */}
      <div className="p-4 bg-[var(--bg-elevated)] border-b border-[var(--border-default)]">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/projects" className="flex items-center text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
            <FaArrowLeft className="mr-2" /> Back to Projects
          </Link>
        </div>
      </div>

      {/* Project Hero Section - Fixed height with Overview menu */}
      <ProjectHero 
        project={sanitizedProject} 
        images={base.images.map(img => ({
          id: img.id,
          url: img.url,
          name: img.name,
        }))}
        expandedBlocks={base.post?.expandedBlocks}
      />

      {/* Tab Navigation */}
      <ProjectTabs project={sanitizedProject} currentView={view} isPublished={isPublished} hasDraftOrPublished={hasDraftOrPublished} editorialState={editorialState} />

      {/* PUBLISH tab — renders outside <main> for full-width immersive preview */}
      {view === 'publish' && <PublishTabContent projectId={sanitizedProject.id} project={sanitizedProject} images={base.images} isOwner={isOwner} editorialState={editorialState} />}

      {/* Main Content - Full Width (non-publish tabs) */}
      {view !== 'publish' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* MEDIA tab */}
          {view === 'media' && (
            <MediaSection project={sanitizedProject} isOwner={isOwner} images={base.images} isPublished={isPublished} editorialState={editorialState} />
          )}

          {/* STORY tab */}
          {view === 'story' && (
            <StoryPanel
              projectId={sanitizedProject.id}
              project={sanitizedProject}
              images={base.images.map(img => ({ id: img.id, url: img.url, name: img.name }))}
              isOwner={isOwner}
            />
          )}

          {/* ACTION ITEMS tab */}
          {view === 'actions' && (
            <ActionItemsPanel
              projectId={sanitizedProject.id}
              projectName={sanitizedProject.title}
              selections={sanitizedProject.rooms.flatMap(r =>
                r.selections.map(s => ({
                  ...s,
                  room: { id: r.id, name: r.name },
                }))
              )}
              onRefresh={() => {}}
            />
          )}

          {/* BOARDS tab - default view */}
          {(view === 'boards' || view === 'overview') && (
            <DesignerBoard
              projectId={sanitizedProject.id}
              project={sanitizedProject}
              imageCount={base.images.length}
              images={base.images.map(img => ({
                id: img.id,
                url: img.url,
                room: img.room ?? null,
                tags: img.tags.map(tag => ({
                  id: tag.id,
                  x: tag.x,
                  y: tag.y,
                  productId: tag.productId,
                  product: tag.product ? {
                    id: tag.product.id,
                    name: tag.product.name,
                    imageUrl: tag.product.imageUrl ?? null,
                  } : null,
                })),
              }))}
            />
          )}
        </main>
      )}
    </div>
  );
}

/** Server component that fetches staging data and renders the appropriate publish view */
async function PublishTabContent({
  projectId,
  project,
  images,
  isOwner,
  editorialState,
}: {
  projectId: string;
  project: { id: string; title: string };
  images: any[];
  isOwner: boolean;
  editorialState: EditorialState;
}) {
  const stagingData = await getPostForStaging(projectId);

  if (!stagingData || !stagingData.expandedBlocks) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NoDraftState projectId={projectId} />
      </main>
    );
  }

  return (
    <StagingPublishPanel
      projectId={projectId}
      project={project}
      images={images}
      isOwner={isOwner}
      initialPostData={stagingData}
      initialModules={stagingData.modules || []}
      editorialState={editorialState}
    />
  );
}