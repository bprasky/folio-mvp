import 'server-only';
import { prisma } from '@/lib/prisma';
import { publicationPhotos, type PublicationPhoto } from './publication-photo';

/** Call only after the Studio has authorized the candidate's project IDs. */
export async function approvedPhotoPresentations(projectIds: string[]): Promise<Record<string, Record<string, PublicationPhoto>>> {
  const projects = await prisma.project.findMany({
    where: { id: { in: Array.from(new Set(projectIds)) } },
    select: {
      id: true, title: true, city: true, regionState: true,
      designerOrg: { select: { name: true } },
      designer: { select: { name: true, studio: true, companyName: true } },
      owner: { select: { name: true, studio: true, companyName: true } },
      post: { select: { expandedBlocks: true } },
      images: { where: { inclusion: 'INCLUDED' }, select: { id: true, url: true, room: true, roomId: true } },
    },
  });
  return Object.fromEntries(projects.map(project => [project.id, publicationPhotos(project, project.post, project.images, project.designer ?? project.owner)]));
}

/** Approved headlines are editorial copy, never quotations attributed to a person. */
export function approvedHeadlinePhoto(photo: PublicationPhoto | undefined, headline: string, designerName?: string): PublicationPhoto {
  if (!photo) throw new Error('This image needs a new source review.');
  return { ...photo, ...(designerName ? { firmName: designerName } : {}), quote: headline.trim() || null, attribution: null };
}
