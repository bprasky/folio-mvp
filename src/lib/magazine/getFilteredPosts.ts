// src/lib/magazine/getFilteredPosts.ts
//
// Paginated, filterable feed query for the magazine.
// Supports cursor-based pagination and filter by category, keyword, or location.

import { prisma } from "@/lib/prisma";
import type { MagazineMosaicItem } from "./getMagazineData";

export interface FeedFilter {
  type: "category" | "keyword" | "location";
  value: string;
}

export interface FeedPage {
  posts: MagazineMosaicItem[];
  nextCursor: string | null;
}

export async function getFilteredPosts(params: {
  filter?: FeedFilter | null;
  cursor?: string | null;
  take?: number;
}): Promise<FeedPage> {
  const take = Math.min(params.take ?? 12, 24);
  const { filter, cursor } = params;

  // Build the where clause
  const where: any = { status: "PUBLISHED" };

  if (filter) {
    switch (filter.type) {
      case "category":
        where.editorialAssignments = {
          some: {
            category: {
              label: { equals: filter.value, mode: "insensitive" },
            },
          },
        };
        break;
      case "keyword":
        where.keywords = { has: filter.value };
        break;
      case "location":
        where.project = {
          OR: [
            { city: { contains: filter.value, mode: "insensitive" } },
            { regionState: { contains: filter.value, mode: "insensitive" } },
          ],
        };
        break;
    }
  }

  // If cursor provided, paginate after the cursor post
  if (cursor) {
    const cursorPost = await prisma.projectPost.findUnique({
      where: { id: cursor },
      select: { publishedAt: true },
    });
    if (cursorPost?.publishedAt) {
      where.publishedAt = { lt: cursorPost.publishedAt };
    }
  }

  const posts = await prisma.projectPost.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: take + 1, // Fetch one extra to determine if there's a next page
    select: {
      id: true,
      slug: true,
      publishedAt: true,
      heroAssetId: true,
      excerpt: true,
      expandedBlocks: true,
      keywords: true,
      project: {
        select: {
          id: true,
          title: true,
          city: true,
          regionState: true,
          images: {
            select: { id: true, url: true },
            orderBy: { createdAt: "asc" },
          },
          designer: {
            select: {
              id: true,
              name: true,
              studio: true,
              location: true,
            },
          },
        },
      },
    },
  });

  // Determine next cursor
  const hasMore = posts.length > take;
  const slice = hasMore ? posts.slice(0, take) : posts;
  const nextCursor = hasMore ? slice[slice.length - 1].id : null;

  // Map to MagazineMosaicItem
  const items: MagazineMosaicItem[] = slice
    .filter((post) => post.project?.id)
    .map((post) => {
      const heroImg = post.heroAssetId
        ? post.project?.images?.find((img) => img.id === post.heroAssetId)
        : post.project?.images?.[0];
      const imageUrl = heroImg?.url ?? "";

      const blocks = post.expandedBlocks as any;
      const title =
        blocks?.lead?.title ??
        blocks?.lead?.kicker ??
        post.project?.title ??
        "Untitled Project";

      return {
        id: post.project!.id,
        type: "project" as const,
        title,
        imageUrl,
        publishedAt: post.publishedAt ?? null,
        isEditorial: true,
        projectTitle: post.project?.title ?? undefined,
        postSlug: post.slug ?? null,
      };
    })
    .filter((item) => item.imageUrl);

  return { posts: items, nextCursor };
}
