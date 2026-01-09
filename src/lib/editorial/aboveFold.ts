// src/lib/editorial/aboveFold.ts
//
// Above the Fold Management
//
// Handles the rotation system for featured content in the magazine hero section:
// - Equal time windows for all featured content
// - Engagement tracking during the window
// - Badge assignment after rotation
// - High performers flagged for editions

import { prisma } from "@/lib/prisma";
import { BadgeType } from "@prisma/client";

// Default window duration in hours (configurable via env)
const DEFAULT_WINDOW_HOURS = parseInt(process.env.ABOVE_FOLD_WINDOW_HOURS ?? "168", 10); // 168 = 1 week

// Engagement thresholds for badge types
const BADGE_THRESHOLDS = {
  EDITORS_PICK: { score: 100, manual: true }, // Requires manual selection
  TRENDING: { score: 50, views: 1000 },
  FEATURED: { score: 30, views: 500 },
  RISING_STAR: { score: 20, views: 200 },
  STAFF_FAVORITE: { score: 10, manual: true },
};

// Threshold for qualifying for edition inclusion
const EDITION_QUALIFICATION_SCORE = 75;

export interface AboveFoldItem {
  id: string;
  placementId: string;
  contentType: "projectPost";
  contentId: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  designerName?: string;
  locationLabel?: string;
  postSlug?: string;
  windowStartAt: Date;
  windowEndAt: Date;
  windowViews: number;
  windowSaves: number;
  windowShares: number;
  engagementScore: number;
  timeRemainingMs: number;
  percentTimeElapsed: number;
}

/**
 * Get current above fold content (content currently in the featured hero slot)
 */
export async function getAboveFoldContent(): Promise<AboveFoldItem[]> {
  const now = new Date();

  const placements = await prisma.editorialPlacement.findMany({
    where: {
      isAboveFold: true,
      aboveFoldEndAt: { gt: now },
    },
    orderBy: { aboveFoldStartAt: "asc" },
    include: {
      projectPost: {
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
        },
      },
    },
  });

  return placements
    .filter((p) => p.projectPost?.project)
    .map((p) => {
      const post = p.projectPost!;
      const project = post.project!;
      const blocks = post.expandedBlocks as Record<string, any> | null;
      const title =
        blocks?.lead?.title ??
        blocks?.lead?.kicker ??
        project.title ??
        "Untitled";

      // Resolve hero image
      const heroImageObj = post.heroAssetId
        ? project.images?.find((img) => img.id === post.heroAssetId)
        : null;
      const imageUrl =
        heroImageObj?.url ?? project.images?.[0]?.url ?? "";

      const windowDurationMs =
        p.aboveFoldEndAt.getTime() - p.aboveFoldStartAt.getTime();
      const elapsedMs = now.getTime() - p.aboveFoldStartAt.getTime();
      const timeRemainingMs = Math.max(
        0,
        p.aboveFoldEndAt.getTime() - now.getTime()
      );
      const percentTimeElapsed = Math.min(
        100,
        Math.round((elapsedMs / windowDurationMs) * 100)
      );

      return {
        id: project.id,
        placementId: p.id,
        contentType: "projectPost" as const,
        contentId: post.id,
        title,
        subtitle:
          blocks?.lead?.deck ?? post.excerpt ?? project.city ?? undefined,
        imageUrl,
        designerName:
          project.designer?.studio ?? project.designer?.name ?? undefined,
        locationLabel: project.city ?? project.regionState ?? undefined,
        postSlug: post.slug,
        windowStartAt: p.aboveFoldStartAt,
        windowEndAt: p.aboveFoldEndAt,
        windowViews: p.windowViews,
        windowSaves: p.windowSaves,
        windowShares: p.windowShares,
        engagementScore: p.windowEngagementScore ?? 0,
        timeRemainingMs,
        percentTimeElapsed,
      };
    });
}

/**
 * Add new content to the above fold queue
 */
export async function addToAboveFold(
  contentId: string,
  contentType: "projectPost",
  windowDurationHours: number = DEFAULT_WINDOW_HOURS
): Promise<{ placementId: string; startAt: Date; endAt: Date }> {
  // Find the latest scheduled end time to queue after it
  const latestPlacement = await prisma.editorialPlacement.findFirst({
    where: { isAboveFold: true },
    orderBy: { aboveFoldEndAt: "desc" },
    select: { aboveFoldEndAt: true },
  });

  const now = new Date();
  const startAt = latestPlacement?.aboveFoldEndAt ?? now;
  const endAt = new Date(startAt.getTime() + windowDurationHours * 60 * 60 * 1000);

  const placement = await prisma.editorialPlacement.create({
    data: {
      projectPostId: contentType === "projectPost" ? contentId : null,
      aboveFoldStartAt: startAt,
      aboveFoldEndAt: endAt,
      isAboveFold: true,
    },
  });

  return {
    placementId: placement.id,
    startAt,
    endAt,
  };
}

/**
 * Track engagement during the above fold window
 */
export async function trackAboveFoldEngagement(
  placementId: string,
  action: "view" | "save" | "share"
): Promise<void> {
  const placement = await prisma.editorialPlacement.findUnique({
    where: { id: placementId },
  });

  if (!placement || !placement.isAboveFold) {
    // Content is no longer above fold, skip tracking
    return;
  }

  const now = new Date();
  if (now < placement.aboveFoldStartAt || now > placement.aboveFoldEndAt) {
    // Outside of window, skip tracking
    return;
  }

  // Update engagement counters
  const updateData: Record<string, any> = {};
  if (action === "view") {
    updateData.windowViews = { increment: 1 };
  } else if (action === "save") {
    updateData.windowSaves = { increment: 1 };
  } else if (action === "share") {
    updateData.windowShares = { increment: 1 };
  }

  await prisma.editorialPlacement.update({
    where: { id: placementId },
    data: updateData,
  });
}

/**
 * Calculate engagement score based on views, saves, and shares
 */
function calculateEngagementScore(
  views: number,
  saves: number,
  shares: number
): number {
  // Weighted scoring: views=1, saves=5, shares=10
  return views + saves * 5 + shares * 10;
}

/**
 * Determine badge type based on engagement
 */
function determineBadgeType(
  score: number,
  views: number
): BadgeType | null {
  // Note: EDITORS_PICK and STAFF_FAVORITE require manual selection
  if (score >= BADGE_THRESHOLDS.TRENDING.score && views >= BADGE_THRESHOLDS.TRENDING.views) {
    return BadgeType.TRENDING;
  }
  if (score >= BADGE_THRESHOLDS.FEATURED.score && views >= BADGE_THRESHOLDS.FEATURED.views) {
    return BadgeType.FEATURED;
  }
  if (score >= BADGE_THRESHOLDS.RISING_STAR.score && views >= BADGE_THRESHOLDS.RISING_STAR.views) {
    return BadgeType.RISING_STAR;
  }
  return null;
}

/**
 * Rotate expired content out of above fold and apply badges
 * This should be run periodically (e.g., every hour via cron)
 */
export async function rotateAboveFold(): Promise<{
  rotatedCount: number;
  badgesAwarded: number;
  editionQualified: number;
}> {
  const now = new Date();

  // Find all placements that have expired but haven't been rotated yet
  const expiredPlacements = await prisma.editorialPlacement.findMany({
    where: {
      isAboveFold: true,
      aboveFoldEndAt: { lte: now },
    },
  });

  let rotatedCount = 0;
  let badgesAwarded = 0;
  let editionQualified = 0;

  for (const placement of expiredPlacements) {
    // Calculate final engagement score
    const score = calculateEngagementScore(
      placement.windowViews,
      placement.windowSaves,
      placement.windowShares
    );

    // Determine badge
    const badgeType = determineBadgeType(score, placement.windowViews);

    // Check if qualifies for edition
    const qualifies = score >= EDITION_QUALIFICATION_SCORE;

    // Update placement
    await prisma.editorialPlacement.update({
      where: { id: placement.id },
      data: {
        isAboveFold: false,
        rotatedToFeedAt: now,
        windowEngagementScore: score,
        badgeEarned: badgeType !== null,
        badgeType: badgeType,
        qualifiesForEdition: qualifies,
      },
    });

    rotatedCount++;
    if (badgeType) badgesAwarded++;
    if (qualifies) editionQualified++;
  }

  return { rotatedCount, badgesAwarded, editionQualified };
}

/**
 * Manually assign a badge to a placement (for EDITORS_PICK, STAFF_FAVORITE)
 */
export async function assignManualBadge(
  placementId: string,
  badgeType: BadgeType
): Promise<void> {
  await prisma.editorialPlacement.update({
    where: { id: placementId },
    data: {
      badgeEarned: true,
      badgeType,
    },
  });
}

/**
 * Get placements that have rotated out of above fold (for feed display)
 */
export async function getRotatedPlacements(
  options: {
    withBadge?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  id: string;
  projectPostId: string | null;
  badgeType: BadgeType | null;
  engagementScore: number;
  rotatedAt: Date | null;
}[]> {
  const { withBadge, limit = 50, offset = 0 } = options;

  const where: Record<string, any> = {
    isAboveFold: false,
    rotatedToFeedAt: { not: null },
  };

  if (withBadge) {
    where.badgeEarned = true;
  }

  const placements = await prisma.editorialPlacement.findMany({
    where,
    orderBy: { rotatedToFeedAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      projectPostId: true,
      badgeType: true,
      windowEngagementScore: true,
      rotatedToFeedAt: true,
    },
  });

  return placements.map((p) => ({
    id: p.id,
    projectPostId: p.projectPostId,
    badgeType: p.badgeType,
    engagementScore: p.windowEngagementScore ?? 0,
    rotatedAt: p.rotatedToFeedAt,
  }));
}

/**
 * Get placements that qualify for edition inclusion
 */
export async function getEditionQualifiedPlacements(): Promise<
  {
    id: string;
    projectPostId: string | null;
    engagementScore: number;
    badgeType: BadgeType | null;
  }[]
> {
  const placements = await prisma.editorialPlacement.findMany({
    where: {
      qualifiesForEdition: true,
      isAboveFold: false,
    },
    orderBy: { windowEngagementScore: "desc" },
    select: {
      id: true,
      projectPostId: true,
      windowEngagementScore: true,
      badgeType: true,
    },
  });

  return placements.map((p) => ({
    id: p.id,
    projectPostId: p.projectPostId,
    engagementScore: p.windowEngagementScore ?? 0,
    badgeType: p.badgeType,
  }));
}
