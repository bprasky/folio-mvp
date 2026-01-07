import { prisma } from "@/lib/prisma";

const FEED_TYPES = ["STORY", "SHORT_VIDEO", "LONG_VIDEO", "GALLERY", "BOARD"] as const;

export async function getRecentProjectModules(limit = 20) {
  return prisma.projectModule.findMany({
    where: {
      type: { in: FEED_TYPES as any },
      publishedAt: { not: null },
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
}

