// src/lib/feed/getAISuggestions.ts

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getTrendingProjects } from "./getTrendingProjects";

export const getAISuggestions = cache(async (userId?: string) => {
  try {
    // 1. Get trending posts to exclude from suggestions
    const trending = await getTrendingProjects();
    const trendingIds = trending.map((p) => p.id);

    // 2. Query for different (non-trending) posts
    const posts = await prisma.projectPost.findMany({
      where: {
        status: "PUBLISHED",
        ...(trendingIds.length > 0 ? { NOT: { id: { in: trendingIds } } } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: 2,
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

    // 3. If not enough posts remain, fallback to a random selection
    if (posts.length < 2) {
      const allPosts = await prisma.projectPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 10, // Get more to sample from
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

      // Filter out trending posts and randomize
      const available = allPosts
        .filter((p) => !trendingIds.includes(p.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);

      return available.map((post) => {
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
    }

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

