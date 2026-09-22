import { ExpertiseProjectReturn } from '@/components/publishing-studio/ExpertiseProjectReturn';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProjectTabs from './ProjectTabs';
import MediaSection from './MediaSection';
import DesignerBoard from './DesignerBoard';
import ProjectHeader from './ProjectHeader';
import PublishedProjectHome from './PublishedProjectHome';
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
  trackerTypeForTimeline,
  viewForStepKey,
  type TrackerState,
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
  draftExists: boolean;
  publishBlockedByRooms?: boolean;
  /**
   * The step whose surface is open. Omitted on the first pass, before the view
   * has resolved — that pass exists only to read `reachedIndex`, which is what
   * decides where the project opens.
   */
  activeKey?: string;
  /**
   * Keep the tracker once every step is done, instead of returning null.
   *
   * The tracker is the publishing flow's navigation — its Story and Publish
   * steps are the links to those surfaces, and nothing else offers them. Letting
   * it vanish on a fully-complete project left that project with no way to reach
   * either one.
   */
  keepWhenComplete?: boolean;
}): TrackerState | null {
  const {
    timeline,
    readiness,
    photoCount,
    roomCount,
    totalSelections,
    isPublished,
    interviewInProgress,
    draftExists,
    publishBlockedByRooms,
    activeKey,
  } = args;
  const materialsExist = totalSelections > 0;

  const type = trackerTypeForTimeline(timeline);

  let complete: Record<string, boolean>;
  let counts: Record<string, number | undefined>;
  // Open work per step, for steps whose gate counts something real (photos left
  // to sort / tag). The story and publish gates use `remaining` as a boolean, so
  // they're deliberately absent — "1 left" would mean nothing under them.
  let remaining: Record<string, number | undefined> = {};

  if (type === 'inProgress') {
    complete = {
      photos: photoCount > 0,
      rooms: readiness.gates.rooms.complete,
      products: materialsExist,
    };
    counts = { photos: photoCount, rooms: roomCount, products: totalSelections };
    remaining = { rooms: readiness.gates.rooms.remaining };
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
    remaining = {
      rooms: readiness.gates.rooms.remaining,
      tags: readiness.gates.tags.remaining,
    };
  }

  if (Object.values(complete).every(Boolean) && !args.keepWhenComplete) return null;

  return deriveTrackerState({
    type,
    complete,
    counts,
    remaining,
    materialsExist,
    interviewInProgress,
    draftExists,
    publishBlockedByRooms,
    // The tracker highlights whichever step's surface is open, so stepping back
    // to a finished step keeps the header in sync with what's on screen.
    activeKey,
  });
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { view?: string; step?: string; expertiseTopic?: string; expertiseProjects?: string };
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
          slug: true,
          heroAssetId: true,
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

  // Which flow is this project in? The timeline captured at creation decides,
  // read through the same classifier the tracker uses: the `completed` sequence
  // (PAST, or a legacy project with no timeline) is finished work, which exists
  // to be published, so it enters the publishing flow immediately. PRESENT/FUTURE
  // are working projects — boards, action items and media are their whole point.
  // A working project that later starts publishing (a draft exists) crosses over
  // too.
  //
  // Deriving this from `trackerType` rather than re-testing the timeline is what
  // keeps the stepper honest: the tracker only shows the Story and Publish steps
  // for the `completed` sequence, and those steps link to surfaces this flag
  // gates. Test the timeline twice and the two disagree on a null timeline — the
  // Story step renders, links to `?view=story`, and the page bounces it back to
  // the Tags screen.
  const trackerType = trackerTypeForTimeline(base.timeline);
  const inPublishingFlow = trackerType === 'completed' || hasDraftOrPublished;
  // A project still ahead of itself: in flight or a concept, never finished work.
  const isProspective = trackerType !== 'completed';

  // Project Progress Tracker — guided "what's next" region (top of page).
  const photoCount = base.images.filter(img => !isDocumentImage(img.name)).length;

  // Unsorted photos are the only thing that holds publishing closed — the
  // article is written room by room, so a photo with no room has nowhere to go.
  // Untagged photos block nothing; they are raised on the Story step, before the
  // draft is generated, where tagging still changes what the article can say.
  const publishBlockedByRooms = !publishReadiness.gates.rooms.complete;
  const untaggedPhotoCount = publishReadiness.gates.tags.remaining;
  // Photos the readiness selector actually counts: photos (not documents) that
  // are included in the project. `photoCount` above includes EXCLUDED ones, so
  // it would overstate how much tagging is left.
  const includedPhotoCount = base.images.filter(
    img => !isDocumentImage(img.name) && (img.inclusion ?? 'INCLUDED') === 'INCLUDED',
  ).length;

  const trackerArgs = {
    timeline: base.timeline ?? null,
    readiness: publishReadiness,
    photoCount,
    roomCount: base.rooms.length,
    totalSelections,
    isPublished,
    // INTERVIEWED = answers saved but no draft generated yet → "Continue interview".
    interviewInProgress: editorialState === 'INTERVIEWED',
    // A written draft is progress into the publish step even before it's public.
    draftExists: hasDraftOrPublished,
    publishBlockedByRooms,
  };

  // First pass, with no step surfaced: this exists purely to read `reachedIndex`
  // — how far the project has actually got. Landing reads it below.
  const progressState = buildTrackerState(trackerArgs);

  // Published projects open their home; explicit step links still open that step.
  // Unpublished projects open the furthest step reached, on the surface that owns
  // it. Derived from the tracker rather than re-branched here, so the header and
  // the surface under it can never disagree — a draft that exists opens the
  // Publish tab because the tracker says the publish step is where the project
  // got to, not because a separate ladder happens to agree. A null state means
  // every step is complete, which in the publishing flow is a published project.
  //
  // Working projects keep their own rule: Boards isn't a tracker step, and it's
  // the right surface for a project still being built.
  const defaultView: TabView = isPublished ? 'overview' : inPublishingFlow
    ? progressState
      ? viewForStepKey(progressState.steps[progressState.reachedIndex].key)
      : hasDraftOrPublished
        ? 'publish'
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
  if (!isPublished && inPublishingFlow && currentView === 'overview') currentView = defaultView;

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
  const isProjectHome = isPublished && view === 'overview';

  // Second pass, now that the view has resolved: same inputs, plus the step whose
  // surface is actually open, so the tracker highlights it (and so `step` can
  // pick between the Media-hosted steps, which share one view).
  const trackerState = buildTrackerState({
    ...trackerArgs,
    activeKey: activeStepKeyForView(view, searchParams.step, trackerType),
    // In the publishing flow the tracker IS the navigation, so it stays even
    // when every step is complete — see ProjectTabs, which no longer offers
    // Story and Publish as a second way in.
    keepWhenComplete: inPublishingFlow,
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

  const expertiseReturn = process.env.STUDIO_MY_EXPERTISE === 'true' && isOwner && viewerId ? <ExpertiseProjectReturn actorId={viewerId} workspaceId={operatingAsOrgId} projectId={params.id} topic={searchParams.expertiseTopic} projectIds={searchParams.expertiseProjects} /> : null;

  if (isProjectEmpty) {
    // URL/portfolio import is a Pro feature; it's available on any project,
    // not just completed ones (spec follow-up). Compute once.
    const canScrape = viewerId ? await canUsePortfolioScrape(viewerId) : false;
    // Completed ("PAST") projects get the guided New Project Wizard in every context.
    // Checked before the org/individual split so individual designers get it too.
    if (sanitizedProject.timeline === 'PAST') {
      return <>{expertiseReturn}<NewProjectWizard project={sanitizedProject} canScrape={canScrape} /></>;
    }
    const isOrganizationContext = !!operatingAsOrgId;
    if (isOrganizationContext) {
      return <>{expertiseReturn}<ProjectEmptyState project={sanitizedProject} canScrape={canScrape} /></>;
    } else {
      return <>{expertiseReturn}<ProjectEmptyStateDiscovery project={sanitizedProject} /></>;
    }
  }

  const crumbStatus = statusCrumbLabel(editorialState);
  const crumbStatusSlug = statusSlug(editorialState);

  return (
    <div className="min-h-screen bg-surface-canvas">
      {expertiseReturn}
      {/* Header area — breadcrumbs + editorial header + tabs */}
      <div className="max-w-[1280px] mx-auto px-10 pt-6">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 mb-5 text-[length:var(--type-meta)] text-folio-text-secondary"
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
        />
        {isPublished && !isProjectHome && (
          <Link href={`/project/${base.id}`} className="inline-block mb-4 folio-ui underline underline-offset-4">
            Back to project home
          </Link>
        )}

        {/* Project Progress Tracker — adaptive guided next-action region.
            Photo/product progress only. The interview's own progress (answers,
            coverage, generate) lives on the Story tab, so the two halves of the
            flow don't compete for the same header space. */}
        {!isProjectHome && trackerState && (
          <div className="mt-2 mb-2">
            <ProjectProgressTracker
              projectId={sanitizedProject.id}
              state={trackerState}
              currentView={view}
              hideNextAction={startInTagging}
            />
          </div>
        )}

        {/* Flat tab strip. Hidden on the Tags step: that surface is the focused
            inline tagging flow, and Boards / Action items / Media are cross-project
            navigation that only distracts from the active posting flow. */}
        {!isProjectHome && !startInTagging && (
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
          images={base.images}
          isOwner={isOwner}
          editorialState={editorialState}
          canPublish={publishReadiness.canPublish}
          taggedPhotoCount={
            base.images.filter(
              img => !isDocumentImage(img.name) && img.tags.length > 0,
            ).length
          }
          untaggedPhotoCount={publishReadiness.gates.tags.remaining}
          unsortedPhotoCount={publishReadiness.gates.rooms.remaining}
        />
      )}

      {/* All other tabs */}
      {view !== 'publish' && (
        <main className="max-w-[1280px] mx-auto px-10 py-8 pb-24">
          {isProjectHome && (
            <PublishedProjectHome
              project={sanitizedProject}
              slug={base.post?.slug ?? null}
              coverUrl={
                base.images.find(img => img.id === base.post?.heroAssetId)?.url ??
                base.images.find(img => !isDocumentImage(img.name))?.url ?? null
              }
              canUseSocialTools={!!viewerId && (viewerId === base.ownerId || viewerId === designerId)}
            />
          )}
          {view === 'media' && (
            <MediaSection
              project={sanitizedProject}
              isOwner={isOwner}
              images={base.images}
              isPublished={isPublished}
              editorialState={editorialState}
              initialTagging={startInTagging}
              // Credits moved off the Story tab: naming collaborators belongs
              // with sorting rooms, before the interview, not after the writing.
              showCredits={isOwner && currentStepKey === 'rooms'}
            />
          )}

          {view === 'story' && (
            <StoryPanel
              projectId={sanitizedProject.id}
              project={sanitizedProject}
              // Tagging changes what the interview can be written about, so the
              // Story step raises it before generating rather than after. Both
              // counts are over INCLUDED photos, matching what the readiness
              // selector counts — an excluded photo is not work left undone.
              untaggedPhotoCount={untaggedPhotoCount}
              taggedPhotoCount={includedPhotoCount - untaggedPhotoCount}
              // Photos only, with their room. The Story index draws each room's
              // hero from the first photo in that room, so documents (which have
              // no visual to show) are filtered out here rather than counted.
              images={base.images
                .filter(img => !isDocumentImage(img.name))
                .map(img => ({
                  id: img.id,
                  url: img.url,
                  name: img.name,
                  room: img.room ?? null,
                  roomId: img.roomId ?? null,
                  displayOrder: img.displayOrder ?? null,
                }))}
              // Room names for indexing the saved answers. Taken from the Room
              // rows rather than the interview's question set, which is
              // regenerated (and loses rooms) whenever the project is retagged.
              rooms={base.rooms.map(room => ({ id: room.id, name: room.name }))}
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

          {!isProjectHome && (view === 'boards' || view === 'overview') && (
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
  images,
  isOwner,
  editorialState,
  canPublish,
  taggedPhotoCount,
  untaggedPhotoCount,
  unsortedPhotoCount,
}: {
  projectId: string;
  images: any[];
  isOwner: boolean;
  editorialState: EditorialState;
  /** Server-derived publish gate — the same value the server action enforces. */
  canPublish: boolean;
  taggedPhotoCount: number;
  untaggedPhotoCount: number;
  unsortedPhotoCount: number;
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
      images={images}
      isOwner={isOwner}
      initialPostData={stagingData}
      initialModules={stagingData.modules || []}
      editorialState={editorialState}
      canPublish={canPublish}
      taggedPhotoCount={taggedPhotoCount}
      untaggedPhotoCount={untaggedPhotoCount}
      unsortedPhotoCount={unsortedPhotoCount}
    />
  );
}
