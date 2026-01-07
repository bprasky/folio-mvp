// src/lib/feed/getTrendingProjects.ts

import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getTrendingProjects = cache(async () => {
  try {
    const posts = await prisma.projectPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        heroAssetId: true,
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
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    });

    return posts.map((post) => {
      // Resolve hero image from heroAssetId
      const heroImageObj = post.heroAssetId
        ? post.project?.images?.find((img) => img.id === post.heroAssetId)
        : post.project?.images?.[0];

      return {
        id: post.id,
        slug: post.slug,
        project: {
          id: post.project?.id ?? "",
          title: post.project?.title ?? null,
          imageUrl: heroImageObj?.url ?? post.project?.images?.[0]?.url ?? null,
        },
      };
    });
  } catch {
    return [];
  }
});


