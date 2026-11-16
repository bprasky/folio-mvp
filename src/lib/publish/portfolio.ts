import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertProjectPublish, assertProjectUnpublish } from '@/lib/authz/access';
import { canPublishFromOrg } from '@/lib/permissions';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { isDocumentImage } from './computePublishReadiness';

type ReviewPhoto = { id: string; url: string; name?: string | null; inclusion?: string | null; updatedAt?: Date };
type ReviewProject = { title: string; updatedAt: Date; portfolioPublishedAt?: Date | null; portfolioCoverImageId?: string | null; images: ReviewPhoto[]; post?: { status: string } | null };

export function portfolioReviewVersion(project: ReviewProject) {
  return createHash('sha256').update(JSON.stringify([project.title, project.updatedAt, project.portfolioPublishedAt,
    project.portfolioCoverImageId, project.post?.status,
    [...project.images].sort((a, b) => a.id.localeCompare(b.id)).map(image => [image.id, image.url, image.name, image.inclusion, image.updatedAt]),
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
});

export async function publishPortfolio(userId: string, raw: unknown) {
  const input = PortfolioPublishInput.parse(raw);
  await assertProjectPublish(userId, input.projectId);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM projects WHERE id = ${input.projectId} FOR UPDATE`;
        const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId }, include: { images: true, post: { select: { status: true } } } });
        if (!(await canPublishFromOrg(userId, project.designerOrgId, tx)).ok) throw new Error('Forbidden');
        if (project.post && project.post.status !== 'DRAFT') throw new Error('Use the feature publication controls for this project.');
        const photos = project.images.filter(image => image.url && !isDocumentImage(image.name));
        const selected = new Set(input.includedImageIds);
        if (selected.size !== input.includedImageIds.length || input.includedImageIds.some(id => !photos.some(photo => photo.id === id))) throw new Error('Choose photographs from this project.');
        if (!selected.has(input.coverImageId)) throw new Error('Choose a cover from the included photographs.');
        const unchanged = project.isPublic && project.portfolioPublishedAt && project.title === input.title
          && project.portfolioCoverImageId === input.coverImageId
          && project.images.every(photo => (photo.inclusion !== 'EXCLUDED') === selected.has(photo.id));
        if (unchanged) return { projectId: project.id };
        if (portfolioReviewVersion(project) !== input.version) throw new Error('This project changed. Reload and review the latest photographs before publishing.');
        const now = new Date();
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
          id, userId: recipient, type: 'PROJECT_INTERVIEW_INVITATION', title: 'Your project is live. Tell its story.',
          body: `Add the story behind ${input.title} to create your Folio Feature, prepare editorial content to share, and help Folio identify relevant media opportunities.`,
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
