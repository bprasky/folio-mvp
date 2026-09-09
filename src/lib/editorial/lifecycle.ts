import { Prisma, type PostStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite, assertProjectPublish } from '@/lib/authz/access';
import { computePublishReadiness, isDocumentImage } from '@/lib/publish/computePublishReadiness';
import { makeSlug } from '@/lib/posting/slug';

export type EditorialAction = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish' | 'archive';

export class EditorialError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function jsonObject(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function initiateEditorial(userId: string, projectId: string) {
  if (!userId) throw new EditorialError(401, 'Unauthorized');
  await assertProjectWrite(userId, projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId }, select: { title: true, _count: { select: { images: true } } },
  });
  if (!project._count.images) throw new EditorialError(422, 'Add at least one image before creating an editorial draft');
  // projectId is unique. A retry never replaces content or resets review/publication.
  try {
    return await prisma.projectPost.upsert({
      where: { projectId }, update: {},
      create: { projectId, slug: makeSlug(project.title, projectId), status: 'DRAFT' },
    });
  } catch (error) {
    // Prisma may implement an empty-update upsert as read/create. If another
    // initializer won, return its row; never reset its content or status.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.projectPost.findUnique({ where: { projectId } });
      if (existing) return existing;
    }
    throw error;
  }
}

const targets: Record<EditorialAction, PostStatus> = {
  submit: 'REVIEW', approve: 'PUBLISHED', reject: 'DRAFT',
  publish: 'PUBLISHED', unpublish: 'DRAFT', archive: 'ARCHIVED',
};

export function checkTransition(status: PostStatus, action: EditorialAction, review: Prisma.JsonObject) {
  // Only a matching completed decision is an idempotent review retry.
  if (action === 'approve' && status === 'PUBLISHED' && review.decision === 'approved') return false;
  if (action === 'reject' && status === 'DRAFT' && review.decision === 'rejected') return false;
  if (action === 'approve' || action === 'reject') {
    if (status !== 'REVIEW') throw new EditorialError(409, `Cannot ${action} a ${status} post`);
    return true;
  }
  if (status === targets[action]) return false;
  const allowed = action === 'submit' || action === 'publish' ? status === 'DRAFT'
    : action === 'unpublish' ? status === 'PUBLISHED'
    : status !== 'ARCHIVED' && status !== 'REVIEW';
  if (!allowed) throw new EditorialError(409, `Cannot ${action} a ${status} post`);
  return true;
}

/** One persisted lifecycle for API routes and server actions. No client identity input. */
export async function transitionEditorial(input: {
  userId: string;
  projectId: string;
  action: EditorialAction;
  reason?: string;
  expectedUpdatedAt?: string;
  postingV1?: boolean;
}) {
  const { userId, projectId, action } = input;
  if (!userId) throw new EditorialError(401, 'Unauthorized');
  const reviewing = action === 'approve' || action === 'reject';
  let mayHidePublicProject = true;
  if (reviewing) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'ADMIN') throw new EditorialError(403, 'Forbidden');
  } else if (action === 'submit') {
    await assertProjectWrite(userId, projectId);
    // A writer can submit a private draft. Withdrawing an already-public
    // project still requires the existing publish capability.
    try { await assertProjectPublish(userId, projectId); }
    catch { mayHidePublicProject = false; }
  } else {
    await assertProjectPublish(userId, projectId);
  }
  if (action === 'reject' && !input.reason?.trim()) throw new EditorialError(400, 'A rejection reason is required');

  // Retry serialization conflicts. Conditional version writes still reject a
  // stale review after a different action or edit wins the race.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const post = await tx.projectPost.findUnique({ where: { projectId } });
        if (!post) throw new EditorialError(404, 'Post not found');
        const provenance = jsonObject(post.provenance);
        const review = jsonObject(provenance.editorialReview);
        const changed = checkTransition(post.status, action, review);
        if (!changed) {
          // Older writers could leave visibility out of sync. An authorized
          // retry restores the same result without changing review identity or
          // the post's original publication timestamp.
          const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { isPublic: true, publishedAt: true, status: true } });
          const publishing = targets[action] === 'PUBLISHED';
          if (!publishing && project.isPublic && !mayHidePublicProject) throw new EditorialError(403, 'Publishing permission required');
          const projectStatus = publishing ? 'published' : 'draft';
          if (project.isPublic !== publishing || project.status !== projectStatus || (!publishing && project.publishedAt)) {
            await tx.project.update({ where: { id: projectId }, data: {
              isPublic: publishing, status: projectStatus,
              publishedAt: publishing ? project.publishedAt ?? post.publishedAt ?? new Date() : null,
            } });
          }
          return { ...post, changed: false };
        }
        if (input.expectedUpdatedAt && post.updatedAt.toISOString() !== input.expectedUpdatedAt) {
          throw new EditorialError(409, 'The post changed. Reload before reviewing.');
        }
        const interview = jsonObject(provenance.interview);
        if (jsonObject(interview.status).phase === 'generating') {
          throw new EditorialError(409, 'Generation is in progress. Try again when it finishes.');
        }
        const target = targets[action];
        const publishing = target === 'PUBLISHED';
        const project = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
          include: { images: { orderBy: { createdAt: 'desc' }, include: { tags: { select: { productId: true } } } }, designer: { select: { name: true } } },
        });
        const blocks = jsonObject(post.expandedBlocks);
        if (!publishing && project.isPublic && !mayHidePublicProject) {
          throw new EditorialError(403, 'Publishing permission is required to withdraw this public project for review');
        }
        const chapters = Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters.map(jsonObject) : [];
        const lead = jsonObject(blocks.lead);
        const imageIds = new Set(project.images.map(image => image.id));
        // Every embedded gallery/hero reference must belong to this project.
        for (const chapter of (publishing || action === 'submit') ? chapters : []) {
          if (Array.isArray(chapter.imageIds) && chapter.imageIds.some(id => typeof id !== 'string' || !imageIds.has(id))) {
            throw new EditorialError(422, 'Article references an image outside this project');
          }
        }
        if ((publishing || action === 'submit') && post.heroAssetId && !imageIds.has(post.heroAssetId)) throw new EditorialError(422, 'Hero image does not belong to this project');
        if ((publishing || action === 'submit') && !post.expandedBlocks) {
          throw new EditorialError(422, 'Generate the editorial content first');
        }
        if (publishing && !project.isPublic) {
          const readiness = computePublishReadiness({
            photos: project.images.filter(image => !isDocumentImage(image.name))
              .map(image => ({ ...image, tagCount: image.tags.length })),
            roomCount: 0, storyComplete: true,
          });
          if (!readiness.canPublish) throw new EditorialError(422, 'Sort every photo into a room before publishing.');
        }
        const data: Prisma.ProjectPostUpdateManyMutationInput = { status: target };
        if (publishing && input.postingV1) {
          // Preserve the stricter existing Posting V1 prerequisites; Path B
          // remains reachable through publishEditorial when the flag is off.
          const body = chapters[0]?.body;
          const sections = Array.isArray(blocks.sections) ? blocks.sections.map(jsonObject) : [];
          const narrative = (Array.isArray(body) && body.length > 0) || sections.some(section => section.type === 'narrative' && section.body);
          if (!(lead.title || lead.kicker || lead.deck) || !narrative || !Array.isArray(chapters[0]?.imageIds) || !chapters[0].imageIds.length) {
            throw new EditorialError(422, 'Editorial requires a lead, narrative and gallery images');
          }
          const hero = post.heroAssetId || (chapters[0].imageIds[0] as string) || project.images[0]?.id;
          const excerpt = post.excerpt?.trim() || (typeof lead.deck === 'string' ? lead.deck : '') || (Array.isArray(body) ? String(body[0] || '').slice(0, 300) : '') || project.description;
          if (!hero || !excerpt || !project.images.some(image => image.tags.length)) {
            throw new EditorialError(422, 'Editorial requires a hero, excerpt and at least one product tag');
          }
          data.heroAssetId = hero;
          data.excerpt = excerpt;
          if (!post.credits) data.credits = (Array.isArray(blocks.credits) ? blocks.credits : [{ role: 'Designer', name: project.designer?.name || null }]) as Prisma.InputJsonValue;
        }
        const now = new Date();
        if (action === 'submit') {
          provenance.editorialReview = { submittedBy: userId, submittedAt: now.toISOString() };
        } else if (reviewing) {
          provenance.editorialReview = {
            ...review, reviewedBy: userId, reviewedAt: now.toISOString(),
            decision: action === 'approve' ? 'approved' : 'rejected',
            ...(action === 'reject' ? { reason: input.reason!.trim() } : {}),
          };
        }
        if (action === 'submit' || reviewing) data.provenance = provenance as Prisma.InputJsonObject;
        if (publishing) data.publishedAt = post.publishedAt ?? now;
        const write = await tx.projectPost.updateMany({
          where: { id: post.id, status: post.status, updatedAt: post.updatedAt }, data,
        });
        if (write.count !== 1) throw new EditorialError(409, 'The post changed. Reload and try again.');
        await tx.project.update({
          where: { id: projectId },
          data: { isPublic: publishing, publishedAt: publishing ? project.publishedAt ?? now : null, status: publishing ? 'published' : 'draft' },
        });
        return { ...await tx.projectPost.findUniqueOrThrow({ where: { projectId } }), changed: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
}
