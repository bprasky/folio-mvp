// src/lib/feed/magazineFeed.ts
//
// Magazine Feed with Filtering and Weighting
//
// Provides the filtered and weighted magazine feed for:
// - All content (projects + features)
// - Projects only (Posted Projects with editorial status)
// - Features only (all feature types)
//
// Weighting considers:
// - Content type (editorial gets priority)
// - Engagement metrics
// - Recency decay
// - Badge bonus

import { prisma } from "@/lib/prisma";
import { BadgeType, PostStatus, PostVariant } from "@prisma/client";

export type MagazineFilter = "all" | "projects" | "features";

export interface MagazineFeedItem {
  id: string;
  type: "project" | "feature";
  postId: string;
  slug: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  designerName?: string;
  designerId?: string;
  locationLabel?: string;
  publishedAt: Date | null;
  variant: PostVariant;
  // Engagement and weighting
  engagement: {
    views: number;
    saves: number;
    shares: number;
    score: number;
  };
  // Badge information (if any)
  badge?: {
    type: BadgeType;
    earnedAt?: Date;
  };
  // Calculated weight for sorting
  weight: number;
}

// Weighting configuration
const WEIGHTS = {
  // Base weight by variant
  variantBase: {
    PROJECT_FEATURE: 10,
    MATERIAL_STUDY: 8,
    METHOD: 7,
    DESIGNER_PROFILE: 6,
    EVENT_ESSAY: 5,
  },
  // Badge bonuses
  badgeBonus: {
    EDITORS_PICK: 50,
    TRENDING: 30,
    FEATURED: 20,
    RISING_STAR: 15,
    STAFF_FAVORITE: 25,
  },
  // Engagement multipliers
  engagement: {
    viewWeight: 0.1,
    saveWeight: 2,
    shareWeight: 5,
  },
  // Recency decay (days)
  recencyHalfLife: 14, // Weight halves every 14 days
};

/**
 * Calculate weight for a feed item
 */
function calculateWeight(item: {
  variant: PostVariant;
  publishedAt: Date | null;
  engagement: { views: number; saves: number; shares: number };
  badgeType?: BadgeType | null;
}): number {
  // Base weight from variant
  let weight = WEIGHTS.variantBase[item.variant] ?? 5;

  // Badge bonus
  if (item.badgeType) {
    weight += WEIGHTS.badgeBonus[item.badgeType] ?? 0;
  }

  // Engagement contribution
  const engagementScore =
    item.engagement.views * WEIGHTS.engagement.viewWeight +
    item.engagement.saves * WEIGHTS.engagement.saveWeight +
    item.engagement.shares * WEIGHTS.engagement.shareWeight;
  weight += engagementScore;

  // Recency decay
  if (item.publishedAt) {
    const daysSincePublished =
      (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.pow(
      0.5,
      daysSincePublished / WEIGHTS.recencyHalfLife
    );
    weight *= decayFactor;
  }

  return Math.round(weight * 100) / 100;
}

/**
 * Get magazine feed with filtering and weighting
 */
export async function getMagazineFeed(
  filter: MagazineFilter,
  page: number = 1,
  limit: number = 20
): Promise<{
  items: MagazineFeedItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const offset = (page - 1) * limit;

  // Build where clause based on filter
  const whereClause: Record<string, any> = {
    status: PostStatus.PUBLISHED,
  };

  if (filter === "projects") {
    // Only PROJECT_FEATURE variant
    whereClause.variant = PostVariant.PROJECT_FEATURE;
  } else if (filter === "features") {
    // All non-PROJECT_FEATURE variants
    whereClause.variant = {
      in: [
        PostVariant.MATERIAL_STUDY,
        PostVariant.METHOD,
        PostVariant.DESIGNER_PROFILE,
        PostVariant.EVENT_ESSAY,
      ],
    };
  }
  // filter === "all" has no variant restriction

  // Get total count
  const total = await prisma.projectPost.count({ where: whereClause });

  // Fetch posts with related data
  const posts = await prisma.projectPost.findMany({
    where: whereClause,
    include: {
      project: {
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              studio: true,
              location: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
            },
            take: 5,
            orderBy: { createdAt: "asc" },
          },
        },
      },
      editorialPlacement: {
        select: {
          badgeType: true,
          badgeEarned: true,
          windowViews: true,
          windowSaves: true,
          windowShares: true,
          windowEngagementScore: true,
          rotatedToFeedAt: true,
        },
      },
    },
    orderBy: { publishedAt: "desc" },
    // Fetch more than needed to allow for re-sorting by weight
    take: Math.min(limit * 3, 100),
    skip: 0, // We'll handle pagination after weighting
  });

  // Transform and calculate weights
  const feedItems: MagazineFeedItem[] = posts
    .filter((post) => post.project) // Ensure project exists
    .map((post) => {
      const project = post.project!;
      const placement = post.editorialPlacement;
      const blocks = post.expandedBlocks as Record<string, any> | null;

      // Extract title from expandedBlocks or fallback
      const title =
        blocks?.lead?.title ??
        blocks?.lead?.kicker ??
        project.title ??
        "Untitled";

      // Resolve hero image
      const heroImageObj = post.heroAssetId
        ? project.images?.find((img) => img.id === post.heroAssetId)
        : null;
      const imageUrl = heroImageObj?.url ?? project.images?.[0]?.url ?? "";

      // Engagement data (from placement if available, otherwise from project)
      const engagement = {
        views: placement?.windowViews ?? project.views ?? 0,
        saves: placement?.windowSaves ?? project.saves ?? 0,
        shares: placement?.windowShares ?? project.shares ?? 0,
        score: placement?.windowEngagementScore ?? 0,
      };

      // Badge information
      const badge =
        placement?.badgeEarned && placement?.badgeType
          ? {
              type: placement.badgeType,
              earnedAt: placement.rotatedToFeedAt ?? undefined,
            }
          : undefined;

      // Calculate weight
      const weight = calculateWeight({
        variant: post.variant,
        publishedAt: post.publishedAt,
        engagement,
        badgeType: placement?.badgeType,
      });

      return {
        id: project.id,
        type: (post.variant === PostVariant.PROJECT_FEATURE
          ? "project"
          : "feature") as "project" | "feature",
        postId: post.id,
        slug: post.slug,
        title,
        subtitle:
          blocks?.lead?.deck ?? post.excerpt ?? project.city ?? undefined,
        imageUrl,
        designerName:
          project.designer?.studio ?? project.designer?.name ?? undefined,
        designerId: project.designer?.id ?? undefined,
        locationLabel: project.city ?? project.regionState ?? undefined,
        publishedAt: post.publishedAt,
        variant: post.variant,
        engagement,
        badge,
        weight,
      };
    })
    .filter((item) => item.imageUrl); // Only include items with images

  // Sort by weight (descending)
  feedItems.sort((a, b) => b.weight - a.weight);

  // Apply pagination after sorting
  const paginatedItems = feedItems.slice(offset, offset + limit);
  const totalPages = Math.ceil(total / limit);

  return {
    items: paginatedItems,
    total,
    page,
    totalPages,
  };
}

/**
 * Get feed items by badge type
 */
export async function getFeedItemsByBadge(
  badgeType: BadgeType,
  limit: number = 20
): Promise<MagazineFeedItem[]> {
  const posts = await prisma.projectPost.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      editorialPlacement: {
        badgeEarned: true,
        badgeType,
      },
    },
    include: {
      project: {
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              studio: true,
              location: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
            },
            take: 5,
            orderBy: { createdAt: "asc" },
          },
        },
      },
      editorialPlacement: {
        select: {
          badgeType: true,
          badgeEarned: true,
          windowViews: true,
          windowSaves: true,
          windowShares: true,
          windowEngagementScore: true,
          rotatedToFeedAt: true,
        },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return posts
    .filter((post) => post.project)
    .map((post) => {
      const project = post.project!;
      const placement = post.editorialPlacement!;
      const blocks = post.expandedBlocks as Record<string, any> | null;

      const title =
        blocks?.lead?.title ??
        blocks?.lead?.kicker ??
        project.title ??
        "Untitled";

      const heroImageObj = post.heroAssetId
        ? project.images?.find((img) => img.id === post.heroAssetId)
        : null;
      const imageUrl = heroImageObj?.url ?? project.images?.[0]?.url ?? "";

      const engagement = {
        views: placement.windowViews,
        saves: placement.windowSaves,
        shares: placement.windowShares,
        score: placement.windowEngagementScore ?? 0,
      };

      const weight = calculateWeight({
        variant: post.variant,
        publishedAt: post.publishedAt,
        engagement,
        badgeType: placement.badgeType,
      });

      return {
        id: project.id,
        type: (post.variant === PostVariant.PROJECT_FEATURE
          ? "project"
          : "feature") as "project" | "feature",
        postId: post.id,
        slug: post.slug,
        title,
        subtitle:
          blocks?.lead?.deck ?? post.excerpt ?? project.city ?? undefined,
        imageUrl,
        designerName:
          project.designer?.studio ?? project.designer?.name ?? undefined,
        designerId: project.designer?.id ?? undefined,
        locationLabel: project.city ?? project.regionState ?? undefined,
        publishedAt: post.publishedAt,
        variant: post.variant,
        engagement,
        badge: {
          type: placement.badgeType!,
          earnedAt: placement.rotatedToFeedAt ?? undefined,
        },
        weight,
      };
    })
    .filter((item) => item.imageUrl);
}

/**
 * Get trending feed items (sorted by engagement score)
 */
export async function getTrendingFeed(
  limit: number = 10
): Promise<MagazineFeedItem[]> {
  const result = await getMagazineFeed("all", 1, limit * 2);

  // Re-sort by engagement score only (ignoring recency)
  return result.items
    .sort((a, b) => b.engagement.score - a.engagement.score)
    .slice(0, limit);
}
