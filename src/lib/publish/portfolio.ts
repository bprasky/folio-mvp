import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertProjectPublish, assertProjectUnpublish } from '@/lib/authz/access';
import { canPublishFromOrg } from '@/lib/permissions';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { isDocumentImage } from './computePublishReadiness';
import { updateImageRoomInTransaction } from '@/lib/projects/updateImageRoom';

type ReviewPhoto = { id: string; url: string; name?: string | null; inclusion?: string | null; roomId?: string | null; updatedAt?: Date };
type ReviewProject = { title: string; updatedAt: Date; portfolioPublishedAt?: Date | null; portfolioCoverImageId?: string | null; images: ReviewPhoto[]; post?: { status: string } | null };

export function portfolioReviewVersion(project: ReviewProject) {
  return createHash('sha256').update(JSON.stringify([project.title, project.updatedAt, project.portfolioPublishedAt,
    project.portfolioCoverImageId, project.post?.status,
    [...project.images].sort((a, b) => a.id.localeCompare(b.id)).map(image => [image.id, image.url, image.name, image.inclusion, image.roomId, image.updatedAt]),
  ])).digest('hex');
}

export function hasPortfolioInterviewProgress(value: unknown): boolean {
  const object = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const interview = object(object(value).interview);
  const answers = object(interview.payload).answers;
  return Boolean(object(interview.guided).id) || (Array.isArray(answers) && answers.length > 0);
}

export const PortfolioPublishInput = z.object({
  projectId: z.string().uuid(), title: z.string().trim().min(1, 'Add a project title.').max(200),
  coverImageId: z.string().uuid(), includedImageIds: z.array(z.string().uuid()).min(1, 'Choose at least one photograph.').max(1000),
  version: z.string().length(64),
  roomAssignments: z.array(z.object({ imageId: z.string().uuid(), roomName: z.string().trim().min(1).max(120).nullable() })).max(1000).optional(),
});

/** Only offer another unpublished photo project in this authorized firm. */
export async function nextPortfolioProject(userId: string, currentProjectId: string) {
  await assertProjectPublish(userId, currentProjectId);
  const current = await prisma.project.findUniqueOrThrow({ where: { id: currentProjectId }, select: { designerOrgId: true } });
  if (!current.designerOrgId) return null;
  let cursor: string | undefined;
  for (;;) {
    const candidates = await prisma.project.findMany({
      where: { id: { not: currentProjectId, ...(cursor ? { gt: cursor } : {}) }, designerOrgId: current.designerOrgId, isPublic: false,
        OR: [{ post: null }, { post: { is: { status: 'DRAFT' } } }],
      },
      select: { id: true, title: true, images: { select: { url: true, name: true } } },
      orderBy: { id: 'asc' }, take: 25,
    });
    const next = candidates.find(project => project.images.some(photo => photo.url && !isDocumentImage(photo.name)));
    if (next) return { id: next.id, title: next.title };
    if (candidates.length < 25) return null;
    cursor = candidates[candidates.length - 1].id;
  }
}

export async function publishPortfolio(userId: string, raw: unknown) {
  const input = PortfolioPublishInput.parse(raw);
  await assertProjectPublish(userId, input.projectId);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM projects WHERE id = ${input.projectId} FOR UPDATE`;
        const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId }, include: { images: true, rooms: { orderBy: { id: 'asc' } }, post: { select: { status: true } } } });
        if (!(await canPublishFromOrg(userId, project.designerOrgId, tx)).ok) throw new Error('Forbidden');
        if (project.post && project.post.status !== 'DRAFT') throw new Error('Use the feature publication controls for this project.');
        const photos = project.images.filter(image => image.url && !isDocumentImage(image.name));
        const selected = new Set(input.includedImageIds);
        if (selected.size !== input.includedImageIds.length || input.includedImageIds.some(id => !photos.some(photo => photo.id === id))) throw new Error('Choose photographs from this project.');
        if (!selected.has(input.coverImageId)) throw new Error('Choose a cover from the included photographs.');
        const assignments = input.roomAssignments ?? [];
        if (new Set(assignments.map(item => item.imageId)).size !== assignments.length || assignments.some(item => !selected.has(item.imageId))) throw new Error('Organize only the included photographs from this project.');
        const roomForName = (name: string) => project.rooms.find(room => room.name.trim().toLowerCase() === name.toLowerCase());
        const roomsUnchanged = assignments.every(item => {
          const photo = photos.find(photo => photo.id === item.imageId)!;
          return item.roomName === null ? !photo.roomId : photo.roomId === roomForName(item.roomName)?.id;
        });
        const unchanged = project.isPublic && project.portfolioPublishedAt && project.title === input.title
          && project.portfolioCoverImageId === input.coverImageId
          && project.images.every(photo => (photo.inclusion !== 'EXCLUDED') === selected.has(photo.id)) && roomsUnchanged;
        if (unchanged) return { projectId: project.id };
        if (portfolioReviewVersion(project) !== input.version) throw new Error('This project changed. Reload and review the latest photographs before publishing.');
        const now = new Date();
        // Room sorting is optional and commits with photo approval, never before it.
        for (const assignment of assignments) {
          let room = assignment.roomName ? roomForName(assignment.roomName) : undefined;
          if (assignment.roomName && !room) {
            room = await tx.room.create({ data: { projectId: project.id, name: assignment.roomName } });
            project.rooms.push(room);
          }
          await updateImageRoomInTransaction(tx, project.id, assignment.imageId, room?.id ?? null, undefined, room?.name ?? null);
        }
        await tx.projectImage.updateMany({ where: { projectId: project.id }, data: { inclusion: 'EXCLUDED' } });
        await tx.projectImage.updateMany({ where: { projectId: project.id, id: { in: input.includedImageIds } }, data: { inclusion: 'INCLUDED' } });
        // Existing profile cards read the first included photo. Keep that cover
        // consistent without reading any private feature content.
        if (project.portfolioCoverImageId !== input.coverImageId) {
          await tx.projectImage.updateMany({ where: { projectId: project.id }, data: { displayOrder: { increment: 1 } } });
          await tx.projectImage.update({ where: { id: input.coverImageId, projectId: project.id }, data: { displayOrder: 0 } });
        }
        await tx.project.update({ where: { id: project.id }, data: {
          title: input.title, portfolioCoverImageId: input.coverImageId, portfolioPublishedAt: project.portfolioPublishedAt ?? now,
          isPublic: true, publishedAt: project.publishedAt ?? now, status: 'published',
        } });
        const recipient = project.designerId || project.ownerId;
        const id = requestIdentity('portfolio-interview', [project.id]);
        await tx.notification.upsert({ where: { id }, update: {}, create: {
          id, userId: recipient, type: 'PROJECT_INTERVIEW_INVITATION', title: 'Your photos are on your Folio profile.',
          body: `Complete the interview for ${input.title}, then publish its Folio Feature to unlock Publishing Studio tools and eligibility for the Folio main feed and media opportunities.`,
          actionUrl: `/project/${project.id}?view=story`, metadata: { projectId: project.id },
        } });
        return { projectId: project.id };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
}

/** Explicit project withdrawal hides the portfolio and feature together. */
export async function unpublishPortfolio(userId: string, projectId: string) {
  z.string().uuid().parse(projectId);
  await assertProjectUnpublish(userId, projectId);
  await prisma.$transaction(async tx => {
    await tx.project.update({ where: { id: projectId }, data: { isPublic: false, publishedAt: null, portfolioPublishedAt: null, status: 'draft' } });
    await tx.projectPost.updateMany({ where: { projectId, status: 'PUBLISHED' }, data: { status: 'DRAFT' } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
