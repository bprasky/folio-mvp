import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProjectTabs from './ProjectTabs';
import MediaSection from './MediaSection';
import DesignerBoard from './DesignerBoard';
import ProjectHeader from './ProjectHeader';
import ProjectMediaManager from './ProjectMediaManager';
import DraftsPanel from './DraftsPanel';
import StoryPanel from './StoryPanel';
import StagingPublishPanel, { NoDraftState } from './StagingPublishPanel';
import { getPostForStaging } from '@/lib/post/getPostForStaging';
import ProjectEmptyState from './ProjectEmptyState';
import ProjectEmptyStateDiscovery from './ProjectEmptyStateDiscovery';
import NewProjectWizard from './NewProjectWizard';
import { canUsePortfolioScrape } from '@/lib/pricing/canUsePortfolioScrape';
import ActionItemsPanel from './ActionItemsPanel';
import { getEditorialState, type EditorialState } from '@/lib/editorial/getEditorialState';
import {
  computePublishReadiness,
  isDocumentImage,
} from '@/lib/publish/computePublishReadiness';

type TabView = 'overview' | 'media' | 'boards' | 'drafts' | 'files' | 'publish' | 'story' | 'actions';

function statusSlug(state: EditorialState): string {
  if (state === 'PUBLISHED') return 'published';
  if (state === 'EMPTY') return 'drafts';
  return 'in-progress';
}

function statusCrumbLabel(state: EditorialState): string {
  if (state === 'PUBLISHED') return 'Published';
  if (state === 'EMPTY') return 'Drafts';
  return 'In progress';
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { view?: string };
}) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const viewerRole = (session as any)?.user?.role ?? 'GUEST';
  const operatingAsOrgId = (session as any)?.user?.operatingAsOrgId ?? null;

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
      targetInstallDate: true,
      updatedAt: true,
      ownerId: true,
      createdAt: true,
      category: true,
      status: true,
      timeline: true,
      isPublic: true,
      publishedAt: true,
      views: true,
      saves: true,
      shares: true,
      images: {
        include: {
          tags: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      post: {
        select: {
          expandedBlocks: true,
          status: true,
          publishedAt: true,
        },
      },
      rooms: {
        include: {
          selections: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!base) {
    console.warn('[project-detail] not found by id', { id: params.id });
    notFound();
  }

  let designerId: string | null = null;
  try {
    const extra = (await prisma.project.findUnique({
      where: { id: params.id },
      // @ts-ignore
      select: { designerId: true },
    } as any)) as any;
    designerId = extra?.designerId ?? null;
  } catch {}

  const isOwner =
    viewerRole === 'ADMIN' ||
    (!!viewerId &&
      (viewerId === base.ownerId || (!!designerId && viewerId === designerId)));

  if (!isOwner) {
    console.warn('[project-detail] forbidden', {
      projectId: base.id,
      viewerId,
      viewerRole,
      ownerId: base.ownerId,
      designerId,
    });
    notFound();
  }

  const interviewAnswerCount = await prisma.editorialInterviewAnswer.count({
    where: { interview: { projectId: params.id } },
  });

  const editorialState = getEditorialState({
    post: base.post
      ? {
          status: base.post.status,
          publishedAt: base.post.publishedAt ?? null,
          expandedBlocks: base.post.expandedBlocks,
        }
      : null,
    interviewAnswerCount,
  });

  const isPublished = editorialState === 'PUBLISHED';
  const hasDraftOrPublished = (
    ['GENERATED', 'PUBLISHED', 'UNPUBLISHED'] as EditorialState[]
  ).includes(editorialState);

  // Publish readiness — single source of truth for the spine (spec 20 §6).
  // Computed server-side from already-fetched data, hydrated to the client.
  const publishReadiness = computePublishReadiness({
    photos: base.images
      .filter(img => !isDocumentImage(img.name))
      .map(img => ({
        id: img.id,
        inclusion: img.inclusion,
        roomId: img.roomId,
        room: img.room ?? null,
        noProducts: img.noProducts,
        tagCount: img.tags.length,
      })),
    roomCount: base.rooms.length,
    storyComplete: editorialState !== 'EMPTY',
  });

  // Boards timeline fork (spec 20 §8). Completed (PAST) projects lead with
  // Media and lock Boards until products are tagged — empty rooms shouldn't
  // make a finished upload feel broken. Concept/in-progress lead with Boards.
  const isCompleted = base.timeline === 'PAST';
  const isProspective = base.timeline === 'PRESENT' || base.timeline === 'FUTURE';
  const boardsLocked = isCompleted && !publishReadiness.gates.tags.complete;

  // Published → Boards. Concept/in-progress lead with Boards. Completed (and
  // legacy null-timeline) lead with Media.
  const defaultView: TabView = isPublished || isProspective ? 'boards' : 'media';
  let currentView: TabView = (searchParams.view as TabView) || defaultView;

  if (currentView === 'files') currentView = 'media';
  else if (currentView === 'drafts') currentView = 'publish';

  if (!isPublished && currentView === 'story') currentView = 'media';
  if (!hasDraftOrPublished && currentView === 'publish') currentView = 'media';
  if (currentView === 'boards' && boardsLocked) currentView = 'media';

  const validViews: TabView[] = [
    'overview',
    'media',
    'boards',
    'drafts',
    'files',
    'publish',
    'story',
    'actions',
  ];
  const view = validViews.includes(currentView) ? currentView : defaultView;

  const sanitizedProject = {
    ...base,
    rooms: base.rooms.map(room => ({
      ...room,
      selections: room.selections.map(selection => ({
        ...selection,
        unitPrice: selection.unitPrice ? Number(selection.unitPrice) : null,
      })),
    })),
  };
  const hasMedia = base.images && base.images.length > 0;
  const hasRooms = base.rooms && base.rooms.length > 0;
  const isProjectEmpty = !hasMedia && !hasRooms;

  if (isProjectEmpty) {
    // URL/portfolio import is a Pro feature; it's available on any project,
    // not just completed ones (spec follow-up). Compute once.
    const canScrape = viewerId ? await canUsePortfolioScrape(viewerId) : false;
    // Completed ("PAST") projects get the guided New Project Wizard in every context.
    // Checked before the org/individual split so individual designers get it too.
    if (sanitizedProject.timeline === 'PAST') {
      return <NewProjectWizard project={sanitizedProject} canScrape={canScrape} />;
    }
    const isOrganizationContext = !!operatingAsOrgId;
    if (isOrganizationContext) {
      return <ProjectEmptyState project={sanitizedProject} canScrape={canScrape} />;
    } else {
      return <ProjectEmptyStateDiscovery project={sanitizedProject} />;
    }
  }

  const crumbStatus = statusCrumbLabel(editorialState);
  const crumbStatusSlug = statusSlug(editorialState);

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Header area — breadcrumbs + editorial header + tabs */}
      <div className="max-w-[1280px] mx-auto px-10 pt-6">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 mb-7 text-[13px] text-folio-text-secondary"
        >
          <Link
            href="/projects"
            className="hover:text-[var(--accent)] transition-colors duration-150"
          >
            Projects
          </Link>
          <span className="text-folio-text-tertiary" aria-hidden>
            /
          </span>
          <Link
            href={`/projects?status=${crumbStatusSlug}`}
            className="hover:text-[var(--accent)] transition-colors duration-150"
          >
            {crumbStatus}
          </Link>
          <span className="text-folio-text-tertiary" aria-hidden>
            /
          </span>
          <span className="text-folio-text-primary" aria-current="page">
            {sanitizedProject.title}
          </span>
        </nav>

        {/* Editorial header — H1 + badges + meta + actions */}
        <ProjectHeader
          project={sanitizedProject}
          editorialState={editorialState}
          images={base.images.map(img => ({ id: img.id, url: img.url, name: img.name }))}
          expandedBlocks={base.post?.expandedBlocks}
        />

        {/* Flat tab strip */}
        <ProjectTabs
          project={sanitizedProject}
          currentView={view}
          isPublished={isPublished}
          hasDraftOrPublished={hasDraftOrPublished}
          editorialState={editorialState}
          boardsLocked={boardsLocked}
        />
      </div>

      {/* PUBLISH tab — full-bleed immersive preview */}
      {view === 'publish' && (
        <PublishTabContent
          projectId={sanitizedProject.id}
          project={sanitizedProject}
          images={base.images}
          isOwner={isOwner}
          editorialState={editorialState}
        />
      )}

      {/* All other tabs */}
      {view !== 'publish' && (
        <main className="max-w-[1280px] mx-auto px-10 py-8 pb-24">
          {view === 'media' && (
            <MediaSection
              project={sanitizedProject}
              isOwner={isOwner}
              images={base.images}
              isPublished={isPublished}
              editorialState={editorialState}
              publishReadiness={publishReadiness}
            />
          )}

          {view === 'story' && (
            <StoryPanel
              projectId={sanitizedProject.id}
              project={sanitizedProject}
              images={base.images.map(img => ({ id: img.id, url: img.url, name: img.name }))}
              isOwner={isOwner}
            />
          )}

          {view === 'actions' && (
            <ActionItemsPanel
              projectId={sanitizedProject.id}
              projectName={sanitizedProject.title}
              targetInstallDate={base.targetInstallDate?.toISOString() || null}
              selections={sanitizedProject.rooms.flatMap(r =>
                r.selections.map(s => ({
                  id: s.id,
                  productName: s.productName,
                  vendorName: s.vendorName,
                  unitPrice: s.unitPrice,
                  roomId: s.roomId,
                  room: { id: r.id, name: r.name },
                  productTagId: s.productTagId,
                })),
              )}
            />
          )}

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
                  product: tag.product
                    ? {
                        id: tag.product.id,
                        name: tag.product.name,
                        imageUrl: tag.product.imageUrl ?? null,
                      }
                    : null,
                })),
              }))}
            />
          )}
        </main>
      )}
    </div>
  );
}

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
      <main className="max-w-[1280px] mx-auto px-10 py-8 pb-24">
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
