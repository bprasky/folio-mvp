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
import ProjectProgressTracker from './ProjectProgressTracker';
import {
  deriveTrackerState,
  activeStepKeyForView,
  type TrackerState,
  type TrackerType,
} from '@/lib/publish/computeTrackerState';

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

/**
 * Build the Project Progress Tracker state from the data already loaded for the
 * page. The wizard's timeline drives the type (PAST→completed, PRESENT→in
 * progress, FUTURE→concept). Completion comes from the publish-readiness gates
 * plus selections, so the tracker and the spine never disagree. Returns null
 * once every step is complete — the guided "what's next" region has nothing
 * left to guide.
 */
function buildTrackerState(args: {
  timeline: string | null;
  readiness: ReturnType<typeof computePublishReadiness>;
  photoCount: number;
  roomCount: number;
  totalSelections: number;
  isPublished: boolean;
  interviewInProgress: boolean;
  view: string;
  stepParam?: string;
}): TrackerState | null {
  const {
    timeline,
    readiness,
    photoCount,
    roomCount,
    totalSelections,
    isPublished,
    interviewInProgress,
    view,
    stepParam,
  } = args;
  const materialsExist = totalSelections > 0;

  const type: TrackerType =
    timeline === 'PRESENT' ? 'inProgress' : timeline === 'FUTURE' ? 'concept' : 'completed';

  let complete: Record<string, boolean>;
  let counts: Record<string, number | undefined>;

  if (type === 'inProgress') {
    complete = {
      photos: photoCount > 0,
      rooms: readiness.gates.rooms.complete,
      products: materialsExist,
    };
    counts = { photos: photoCount, rooms: roomCount, products: totalSelections };
  } else if (type === 'concept') {
    complete = {
      references: photoCount > 0,
      spaces: roomCount > 0,
      products: materialsExist,
      share: isPublished,
    };
    counts = { references: photoCount, spaces: roomCount, products: totalSelections };
  } else {
    complete = {
      photos: readiness.gates.photos.complete,
      rooms: readiness.gates.rooms.complete,
      tags: readiness.gates.tags.complete,
      story: readiness.gates.story.complete,
      publish: isPublished,
    };
    counts = { photos: photoCount, rooms: roomCount, tags: totalSelections };
  }

  if (Object.values(complete).every(Boolean)) return null;

  return deriveTrackerState({
    type,
    complete,
    counts,
    materialsExist,
    interviewInProgress,
    // The tracker highlights whichever step's surface is open, so stepping back
    // to a finished step keeps the header in sync with what's on screen.
    activeKey: activeStepKeyForView(view, stepParam, type),
  });
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { view?: string; step?: string };
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
    // The Story gate is complete only once a draft has actually been generated —
    // NOT the moment the first interview answer is saved. Marking it complete on
    // INTERVIEWED advanced the tracker/spine past the interview step, unmounting
    // the tagging surface (and its "Continue to interview" button) and removing
    // every entry point back into the in-progress interview, even though the
    // answers were safely persisted. Keep the step current while the interview
    // is in progress so the "Start interview" CTA stays visible and reopens the
    // modal (which resumes from the saved draft).
    storyComplete: hasDraftOrPublished,
  });

  // Boards is a real-selections surface — it only exists once products have
  // been tagged. No tags → no Boards tab, no default-routing to it, no landing
  // on it. Until then an upload leads with Media (sort + tag the photos there).
  const totalSelections = base.rooms.reduce(
    (sum, room) => sum + room.selections.length,
    0,
  );
  const boardsVisible = totalSelections > 0;
  const isProspective = base.timeline === 'PRESENT' || base.timeline === 'FUTURE';

  // Which flow is this project in? Must agree with the tracker type derived in
  // buildTrackerState, which treats anything that isn't PRESENT/FUTURE as
  // 'completed' — so a project with no timeline set (older projects, and
  // anything created without the wizard) gets the 5-step publishing stepper.
  // Testing `timeline === 'PAST'` here instead left those projects rendering the
  // publishing stepper while every publishing surface was switched off, which
  // hid the Story tab and silently bounced ?view=story back to Media.
  //
  // Derive it from the same signal the tracker uses: prospective projects are the
  // working ones; everything else is publishing. A working project that starts a
  // draft crosses over too.
  //
  // In the publishing flow the stepper is the navigation: Photos/Rooms/Tags all
  // live on the Media surface and are reached by step, so the working tabs
  // (Boards / Action items / Media) must not leak back in alongside it.
  const inPublishingFlow = !isProspective || hasDraftOrPublished;

  // Project Progress Tracker — guided "what's next" region (top of page).
  const photoCount = base.images.filter(img => !isDocumentImage(img.name)).length;
  // Where the project opens. In the publishing flow: the draft once there is
  // one; failing that the interview if it's underway (INTERVIEWED = answers
  // saved, no draft yet), so a designer returns to the work they'd actually
  // started rather than back to the photo surface; otherwise the stepper's first
  // surface. Working projects lead with Boards once it exists.
  const defaultView: TabView = inPublishingFlow
    ? hasDraftOrPublished
      ? 'publish'
      : editorialState === 'INTERVIEWED'
        ? 'story'
        : 'media'
    : boardsVisible && (isPublished || isProspective)
      ? 'boards'
      : 'media';
  let currentView: TabView = (searchParams.view as TabView) || defaultView;

  if (currentView === 'files') currentView = 'media';
  else if (currentView === 'drafts') currentView = 'publish';

  // Story is a publishing-flow surface: it's where the owner interviews, reviews
  // answers, and generates the draft. A working project has no Story step in its
  // tracker at all (inProgress is Photos/Rooms/Products; concept is
  // References/Spaces/Products/Share), so the tab would point at a stage that
  // doesn't exist for it. Owners get it throughout the publishing flow — not just
  // once answers exist — so the tracker's Story step always has somewhere to send
  // them. Everyone else only sees Story once it's published.
  const storyTabVisible =
    editorialState === 'PUBLISHED' || (isOwner && inPublishingFlow);
  if (currentView === 'story' && !storyTabVisible) currentView = 'media';
  if (!hasDraftOrPublished && currentView === 'publish') currentView = 'media';
  if (currentView === 'boards' && !boardsVisible) currentView = 'media';
  // The working surfaces don't exist in the publishing flow, so a stale link or
  // bookmark to one lands on the stepper's surface instead of an orphan view.
  if (inPublishingFlow && (currentView === 'boards' || currentView === 'actions')) {
    currentView = 'media';
  }

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

  // Built after the view resolves so the tracker can highlight the step whose
  // surface is actually open (and so `step` can pick between the Media-hosted
  // steps, which share one view).
  const trackerState = buildTrackerState({
    timeline: base.timeline ?? null,
    readiness: publishReadiness,
    photoCount,
    roomCount: base.rooms.length,
    totalSelections,
    isPublished,
    // INTERVIEWED = answers saved but no draft generated yet → "Continue interview".
    interviewInProgress: editorialState === 'INTERVIEWED',
    view,
    stepParam: searchParams.step,
  });

  // On the Tags step, the media view *is* the manual tagging surface (spec:
  // inline two-path, no separate route/modal). Landing here shows it directly;
  // stepping back to Photos/Rooms opens the plain photo workspace instead.
  const currentStepKey = trackerState
    ? trackerState.steps[trackerState.currentIndex]?.key ?? null
    : null;
  const startInTagging = isOwner && view === 'media' && currentStepKey === 'tags';

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

        {/* Project Progress Tracker — adaptive guided next-action region.
            Photo/product progress only. The interview's own progress (answers,
            coverage, generate) lives on the Story tab, so the two halves of the
            flow don't compete for the same header space. */}
        {trackerState && (
          <div className="mt-2 mb-2">
            <ProjectProgressTracker
              projectId={sanitizedProject.id}
              state={trackerState}
              hideNextAction={startInTagging}
            />
          </div>
        )}

        {/* Flat tab strip. Hidden on the Tags step: that surface is the focused
            inline tagging flow, and Boards / Action items / Media are cross-project
            navigation that only distracts from the active posting flow. */}
        {!startInTagging && (
          <ProjectTabs
            project={sanitizedProject}
            currentView={view}
            isPublished={isPublished}
            hasDraftOrPublished={hasDraftOrPublished}
            editorialState={editorialState}
            storyTabVisible={storyTabVisible}
            inPublishingFlow={inPublishingFlow}
          />
        )}
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
              initialTagging={startInTagging}
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
