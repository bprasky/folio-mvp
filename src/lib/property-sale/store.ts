import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertProjectPublish, assertProjectUnpublish, assertProjectWrite } from '@/lib/authz/access';
import { makeSlug } from '@/lib/posting/slug';
import { PropertySaleDetailsSchema, readPropertySale, type SavedPropertySale } from './schema';

export class PropertySaleConflict extends Error {
  constructor() { super('These property details changed in another session. Reload the saved details before trying again.'); }
}

export async function getPropertySale(projectId: string, actorId: string) {
  await assertProjectWrite(actorId, projectId);
  const post = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
  return readPropertySale(post?.provenance);
}

export async function savePropertySale(projectId: string, actorId: string, input: {
  version: number; requestId: string; details: unknown;
}) {
  await assertProjectWrite(actorId, projectId);
  const details = PropertySaleDetailsSchema.parse(input.details);
  // Permission applies even to drafts: an editor cannot pre-arm publication.
  if (details.publicationPermission) await assertProjectPublish(actorId, projectId);
  return prisma.$transaction(async tx => {
    const project = await tx.project.findUnique({ where: { id: projectId }, select: { title: true } });
    if (!project) throw new Error('NotFound');
    const post = await tx.projectPost.upsert({ where: { projectId }, update: {},
      create: { projectId, slug: makeSlug(project.title || undefined, projectId), status: 'DRAFT' },
      select: { id: true, provenance: true, updatedAt: true } });
    const current = readPropertySale(post.provenance);
    if (current?.requestId === input.requestId) {
      if (current.updatedBy === actorId && isDeepStrictEqual(current.details, details)) return current;
      throw new PropertySaleConflict();
    }
    if ((current?.version ?? 0) !== input.version) throw new PropertySaleConflict();
    if (current?.details.publicationPermission && !details.publicationPermission) await assertProjectUnpublish(actorId, projectId);
    const now = new Date().toISOString();
    const next: SavedPropertySale = { schemaVersion: 1, version: input.version + 1, requestId: input.requestId,
      updatedBy: actorId, updatedAt: now, confirmedAt: details.currentlyForSale && details.publicationPermission ? now : current?.confirmedAt ?? null, details };
    const provenance = post.provenance && typeof post.provenance === 'object' && !Array.isArray(post.provenance) ? post.provenance : {};
    const changed = await tx.projectPost.updateMany({
      where: { id: post.id, updatedAt: post.updatedAt, provenance: { equals: post.provenance === null ? Prisma.DbNull : post.provenance } },
      data: { provenance: { ...provenance, propertySale: next } as Prisma.InputJsonValue },
    });
    if (changed.count !== 1) throw new PropertySaleConflict();
    return next;
  });
}
