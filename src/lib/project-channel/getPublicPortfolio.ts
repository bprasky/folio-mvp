import { prisma } from '@/lib/prisma';

/** Reuse explicit project publication; never infer approval from an import or a draft post. */
export async function getPublicPortfolio(projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, isPublic: true, publishedAt: { lte: new Date() } },
    select: {
      id: true, title: true, description: true, city: true, regionState: true,
      designer: { select: { name: true, studio: true } },
      designerOrg: { select: { name: true } },
      images: {
        where: { inclusion: 'INCLUDED' },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, url: true, name: true, room: true, roomId: true },
      },
    },
  });
}
