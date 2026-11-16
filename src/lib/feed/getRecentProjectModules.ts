import { prisma } from "@/lib/prisma";
import { CHANNEL_MEDIA_TYPES, normalizeChannelMedia } from '@/lib/project-channel/media';

const FEED_TYPES = ["STORY", "SHORT_VIDEO", "LONG_VIDEO", "GALLERY", "BOARD"] as const;

export async function getRecentProjectModules(limit = 20) {
  const rows = await prisma.projectModule.findMany({
    where: {
      type: { in: FEED_TYPES as any },
      publishedAt: { not: null, lte: new Date() },
      // A published module is not public unless its parent project and editorial are public.
      project: { isPublic: true, post: { is: { status: "PUBLISHED" } } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      media: true,
      publishedAt: true,
      project: {
        select: {
          id: true,
          title: true,
          images: {
            where: { inclusion: 'INCLUDED' },
            select: {
              id: true,
              url: true,
            },
            take: 1,
            orderBy: { createdAt: "asc" },
          },
          designer: {
            select: {
              id: true,
              name: true,
              studio: true,
              profileImage: true,
            },
          },
          post: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });
  return rows.flatMap(row => {
    const normalized = normalizeChannelMedia(row.type === 'BOARD' ? 'GALLERY' : row.type, row.media);
    if (!normalized.assets.length || !row.project.post?.slug) return [];
    const projectHref = `/p/${encodeURIComponent(row.project.post.slug)}`;
    return [{ ...row, media: normalized.assets.map(asset => ({ ...asset, thumbnailUrl: asset.poster })),
      href: process.env.FOLIO_EDITORIAL_CHANNELS === 'true' && CHANNEL_MEDIA_TYPES.some(type => type === row.type)
        ? `${projectHref}/media/${encodeURIComponent(row.id)}` : projectHref }];
  });
}

