import { prisma } from "@/lib/prisma";
import { CHANNEL_MEDIA_TYPES, normalizeChannelMedia } from '@/lib/project-channel/media';
import { projectChannelHref } from '@/lib/project-channel/links';

/** Public transport is intentionally separate from the workspace module reader. */
export async function getPublicProjectModules(projectId: string, slug: string) {
  const rows = await prisma.projectModule.findMany({
    where: { projectId, publishedAt: { lte: new Date() }, type: { in: [...CHANNEL_MEDIA_TYPES] },
      project: { isPublic: true, post: { is: { status: 'PUBLISHED', slug } } } },
    select: { id: true, type: true, title: true, description: true, media: true, pinned: true, isPrimary: true, publishedAt: true },
    orderBy: [{ pinned: 'desc' }, { isPrimary: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }],
  });
  return rows.flatMap(row => {
    const media = normalizeChannelMedia(row.type, row.media);
    if (!media.assets.length) return [];
    return [{ id: row.id, type: row.type, title: row.title, description: row.description, pinned: row.pinned, isPrimary: row.isPrimary, publishedAt: row.publishedAt,
      media: media.assets, thumbnail: media.thumbnail,
      href: process.env.FOLIO_EDITORIAL_CHANNELS === 'true'
        ? `${projectChannelHref(slug)}/media/${encodeURIComponent(row.id)}` : projectChannelHref(slug) }];
  });
}

export async function getProjectModules(projectId: string) {
  return prisma.projectModule.findMany({
    where: { projectId, publishedAt: { not: null } },
    orderBy: [
      { pinned: "desc" },
      { type: "asc" },
      { publishedAt: "desc" },
    ],
  });
}


