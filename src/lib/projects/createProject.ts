import { isDeepStrictEqual } from 'node:util';
import { prisma } from '@/lib/prisma';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { normalizeCreatePayload } from '@/app/api/projects/normalizeCreatePayload';
import { makeSlug } from '@/lib/posting/slug';

export class CreationConflict extends Error {
  constructor(public readonly id: string) {
    super('This creation request already saved different details. Open the saved project to continue editing.');
  }
}

/** The unique project ID arbitrates independent requests; credits commit with it. */
export async function createProjectOnce(userId: string, orgId: string, requestId: string, raw: unknown) {
  const input = normalizeCreatePayload(raw);
  const id = requestIdentity('project-create', [userId, orgId, requestId]);
  const data = {
    title: input.title, stage: input.stage, projectType: input.projectType,
    clientType: input.clientType, budgetBand: input.budgetBand,
    city: input.city ?? null, regionState: input.regionState ?? null,
    description: input.description ?? null, timeline: input.timeline ?? null,
    completedYear: input.completedYear ?? null, completedMonth: input.completedMonth ?? null,
    designerId: userId, ownerId: userId, designerOrgId: orgId,
    status: input.projectStatus === 'completed_project' ? 'active' : 'draft',
  };
  const replay = async () => {
    const saved = await prisma.project.findUnique({ where: { id }, include: { post: { select: { credits: true } } } });
    if (!saved) return null;
    if (!Object.entries(data).every(([key, value]) => saved[key as keyof typeof data] === value)
      || !isDeepStrictEqual(saved.post?.credits ?? [], input.credits ?? [])) throw new CreationConflict(id);
    return { id, replayed: true };
  };
  const existing = await replay();
  if (existing) return existing;
  try {
    await prisma.$transaction(async tx => {
      await tx.project.create({ data: { id, ...data, isPublic: false, publishedAt: null,
        isAIEnabled: false, views: 0, saves: 0, shares: 0 } });
      if (input.credits?.length) await tx.projectPost.create({ data: {
        projectId: id, slug: makeSlug(input.title, id), status: 'DRAFT', credits: input.credits,
      } });
    });
    return { id, replayed: false };
  } catch (error) {
    // A uniqueness conflict aborts its transaction. Read the winner only after rollback.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const winner = await replay();
      if (winner) return winner;
    }
    throw error;
  }
}
