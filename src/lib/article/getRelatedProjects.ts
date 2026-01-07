// src/lib/article/getRelatedProjects.ts

import { prisma } from "@/lib/prisma";

export async function getRelatedProjects(
  projectId: string,
  designerId?: string | null
) {
  // Prefer same designer; fall back to recent others
  const byDesigner = designerId
    ? await prisma.projectPost.findMany({
        where: {
          status: "PUBLISHED",
          project: { designerId },
          projectId: { not: projectId },
        },
        orderBy: { publishedAt: "desc" },
        take: 4,
        select: {
          id: true,
          slug: true,
          heroAssetId: true,
          project: {
            select: {
              title: true,
            images: {
              select: { id: true, url: true },
              take: 3,
              orderBy: { createdAt: "asc" },
            },
            },
          },
        },
      })
    : [];

  if (byDesigner.length >= 2) {
    // Map to expected format
    return byDesigner.map((post) => {
      const heroImageObj = post.heroAssetId
        ? post.project?.images?.find((img) => img.id === post.heroAssetId)
        : post.project?.images?.[0];

      return {
        id: post.id,
        slug: post.slug,
        project: {
          id: post.project?.id ?? "",
          title: post.project?.title ?? null,
          images: [
            {
              url: heroImageObj?.url ?? post.project?.images?.[0]?.url ?? null,
            },
          ],
        },
      };
    });
  }

  // Fallback to recent posts from any designer
  const recent = await prisma.projectPost.findMany({
    where: {
      status: "PUBLISHED",
      projectId: { not: projectId },
    },
    orderBy: { publishedAt: "desc" },
    take: 4,
    select: {
      id: true,
      slug: true,
      heroAssetId: true,
      project: {
        select: {
          title: true,
            images: {
              select: { id: true, url: true },
              take: 3,
              orderBy: { createdAt: "asc" },
            },
        },
      },
    },
  });

  // Merge: designer posts first, then fill with recent
  const merged = [...byDesigner];
  const recentIds = new Set(byDesigner.map((p) => p.id));
  for (const post of recent) {
    if (merged.length >= 4) break;
    if (!recentIds.has(post.id)) {
      merged.push(post);
    }
  }

  // Map to expected format with image resolution
  return merged.map((post) => {
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
        images: [
          {
            url: heroImageObj?.url ?? post.project?.images?.[0]?.url ?? null,
          },
        ],
      },
    };
  });
}

