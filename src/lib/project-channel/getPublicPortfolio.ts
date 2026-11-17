import { publicPropertySale } from '@/lib/property-sale/schema';
import { prisma } from '@/lib/prisma';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';

/** Reuse explicit project publication; never infer approval from an import or a draft post. */
export async function getPublicPortfolio(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, isPublic: true, publishedAt: { lte: new Date() } },
    select: {
      id: true, title: true, description: true, city: true, regionState: true,
      portfolioCoverImageId: true,
      post: { select: { provenance: true } },
      designer: { select: { id: true, name: true, studio: true } },
      designerOrg: { select: { id: true, name: true } },
      images: {
        where: { inclusion: 'INCLUDED' },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, url: true, name: true, room: true, roomId: true },
      },
    },
  });
  if (!project) return null;
  const { post, ...publicProject } = project;
  return { ...publicProject, propertySale: publicPropertySale(post?.provenance), images: project.images.filter(image => !isDocumentImage(image.name)) };
}

/** Keep a shared project channel alive while its feature returns to draft. */
export async function getPublicPortfolioBySlug(slug: string) {
  const project = await prisma.project.findFirst({
    where: { isPublic: true, publishedAt: { lte: new Date() }, portfolioPublishedAt: { not: null }, post: { is: { slug } } },
    select: { id: true },
  });
  return project ? getPublicPortfolio(project.id) : null;
}
