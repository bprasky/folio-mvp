// src/lib/feed/getPublishedProjectPosts.ts

import { cache } from "react";

import { prisma } from "@/lib/prisma"; // your prisma singleton

type Post = {
  id: string;
  slug: string | null;
  title: string | null;
  deck: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  designer: {
    id: string;
    name: string;
    studio: string | null;
    profileImage: string | null;
    location: string | null;
  } | null;
  project: {
    id: string;
    name: string | null;
    heroImage: string | null;
  } | null;
};

export const getPublishedProjectPosts = cache(async (opts?: { take?: number }) => {
  const take = opts?.take ?? 6;

  try {
    const posts = await prisma.projectPost.findMany({
      where: { status: "PUBLISHED", project: { isPublic: true } },
      orderBy: { publishedAt: "desc" },
      take,
      select: {
        id: true,
        slug: true,
        publishedAt: true,
        heroAssetId: true,
        excerpt: true,
        expandedBlocks: true,
        project: {
          select: {
            id: true,
            title: true,
            images: {
              select: {
                id: true,
                url: true,
              },
              take: 3,
              orderBy: {
                createdAt: "asc",
              },
            },
            designer: {
              select: {
                id: true,
                name: true,
                studio: true,
                profileImage: true,
                location: true,
              },
            },
          },
        },
      },
    });

    // Map to expected format
    return posts.map((post) => {
      // Resolve hero image from heroAssetId
      const heroImageObj = post.heroAssetId
        ? post.project?.images?.find((img) => img.id === post.heroAssetId)
        : post.project?.images?.[0];
      
      const coverImage = heroImageObj?.url ?? null;
      const heroImage = post.project?.images?.[0]?.url ?? null;

      // Extract editorial context from expandedBlocks
      const blocks = post.expandedBlocks as any;
      const editorialTitle =
        blocks?.lead?.title ?? blocks?.lead?.kicker ?? post.project?.title ?? null;
      const editorialDeck =
        blocks?.lead?.deck ?? post.excerpt ?? null;

      return {
        id: post.id,
        slug: post.slug,
        title: editorialTitle,
        deck: editorialDeck,
        coverImage,
        publishedAt: post.publishedAt,
        designer: post.project?.designer ?? null,
        project: {
          id: post.project?.id ?? "",
          name: post.project?.title ?? null,
          heroImage,
        },
      } as Post;
    });
  } catch {
    // Fallback: return empty gracefully (renders skeleton/empty layout)
    return [] as Post[];
  }
});

