import { prisma } from "../prisma";
import type { EditionCadence } from "@prisma/client";

// [Edition System] Badge system for content recognition

export interface ContentBadge {
  type: "editorial" | "edition";
  label: string;
  editionId?: string;
  editionSlug?: string;
  cadence?: EditionCadence;
  earnedAt: Date;
  prestige: number; // 1=weekly, 2=monthly, 3=quarterly, 4=annual
}

export type ContentType = "projectPost" | "feature";

const CADENCE_PRESTIGE: Record<EditionCadence, number> = {
  WEEKLY: 1,
  MONTHLY: 2,
  QUARTERLY: 3,
  ANNUAL: 4,
};

/**
 * Get all badges earned by a piece of content
 * Badges stack - content can have Editorial + multiple edition badges
 */
export async function getBadgesForContent(
  contentId: string,
  contentType: ContentType
): Promise<ContentBadge[]> {
  const badges: ContentBadge[] = [];

  // Check for "above fold" editorial badge
  if (contentType === "projectPost") {
    const projectPost = await prisma.projectPost.findUnique({
      where: { id: contentId },
      select: { aboveFoldAt: true, aboveFoldEnd: true },
    });

    if (projectPost?.aboveFoldAt) {
      badges.push({
        type: "editorial",
        label: "Editorial",
        earnedAt: projectPost.aboveFoldAt,
        prestige: 0,
      });
    }
  } else if (contentType === "feature") {
    const feature = await prisma.$queryRaw<Array<{ aboveFoldAt: Date | null }>>`
      SELECT "aboveFoldAt" FROM features WHERE id = ${contentId}
    `;

    if (feature[0]?.aboveFoldAt) {
      badges.push({
        type: "editorial",
        label: "Editorial",
        earnedAt: feature[0].aboveFoldAt,
        prestige: 0,
      });
    }
  }

  // Get edition badges from content inclusions
  const whereClause = contentType === "projectPost"
    ? { projectPostId: contentId }
    : { featureId: contentId };

  const inclusions = await prisma.contentEditionInclusion.findMany({
    where: whereClause,
    include: {
      edition: {
        select: {
          id: true,
          slug: true,
          cadence: true,
          status: true,
        },
      },
    },
    orderBy: { earnedAt: "desc" },
  });

  for (const inclusion of inclusions) {
    // Only show badges from published editions
    if (inclusion.edition.status !== "PUBLISHED") {
      continue;
    }

    const cadence = inclusion.edition.cadence;
    if (!cadence) continue;

    badges.push({
      type: "edition",
      label: inclusion.badgeLabel ?? inclusion.edition.slug,
      editionId: inclusion.edition.id,
      editionSlug: inclusion.edition.slug,
      cadence,
      earnedAt: inclusion.earnedAt,
      prestige: CADENCE_PRESTIGE[cadence],
    });
  }

  // Sort by prestige (highest first), then by date (newest first)
  return badges.sort((a, b) => {
    if (b.prestige !== a.prestige) return b.prestige - a.prestige;
    return b.earnedAt.getTime() - a.earnedAt.getTime();
  });
}

/**
 * Award an edition badge to content
 * Creates a ContentEditionInclusion record
 */
export async function awardEditionBadge(
  contentId: string,
  contentType: ContentType,
  editionId: string,
  options?: {
    rank?: number;
    badgeLabel?: string;
  }
): Promise<void> {
  const data = {
    projectPostId: contentType === "projectPost" ? contentId : null,
    featureId: contentType === "feature" ? contentId : null,
    editionId,
    rank: options?.rank,
    badgeLabel: options?.badgeLabel,
  };

  // Upsert to handle idempotency
  const uniqueField = contentType === "projectPost"
    ? "projectPostId_editionId"
    : "featureId_editionId";

  const where = contentType === "projectPost"
    ? { projectPostId_editionId: { projectPostId: contentId, editionId } }
    : { featureId_editionId: { featureId: contentId, editionId } };

  await prisma.contentEditionInclusion.upsert({
    where,
    create: data,
    update: {
      rank: options?.rank,
      badgeLabel: options?.badgeLabel,
    },
  });
}

/**
 * Remove an edition badge from content
 */
export async function removeEditionBadge(
  contentId: string,
  contentType: ContentType,
  editionId: string
): Promise<void> {
  const where = contentType === "projectPost"
    ? { projectPostId_editionId: { projectPostId: contentId, editionId } }
    : { featureId_editionId: { featureId: contentId, editionId } };

  await prisma.contentEditionInclusion.delete({ where }).catch(() => {
    // Ignore if doesn't exist
  });
}

/**
 * Mark content as featured above the fold
 * This earns the "Editorial" badge
 */
export async function markAboveFold(
  contentId: string,
  contentType: ContentType
): Promise<void> {
  const now = new Date();

  if (contentType === "projectPost") {
    await prisma.projectPost.update({
      where: { id: contentId },
      data: { aboveFoldAt: now },
    });
  } else {
    await prisma.$executeRaw`
      UPDATE features SET "aboveFoldAt" = ${now} WHERE id = ${contentId}
    `;
  }
}

/**
 * End above-fold period for content
 */
export async function endAboveFold(
  contentId: string,
  contentType: ContentType
): Promise<void> {
  const now = new Date();

  if (contentType === "projectPost") {
    await prisma.projectPost.update({
      where: { id: contentId },
      data: { aboveFoldEnd: now },
    });
  } else {
    await prisma.$executeRaw`
      UPDATE features SET "aboveFoldEnd" = ${now} WHERE id = ${contentId}
    `;
  }
}

/**
 * Get the highest prestige badge for content
 * Useful for displaying a primary badge
 */
export async function getHighestBadge(
  contentId: string,
  contentType: ContentType
): Promise<ContentBadge | null> {
  const badges = await getBadgesForContent(contentId, contentType);
  return badges[0] ?? null;
}

/**
 * Check if content has earned a specific badge type
 */
export async function hasBadge(
  contentId: string,
  contentType: ContentType,
  badgeType: "editorial" | "edition",
  cadence?: EditionCadence
): Promise<boolean> {
  const badges = await getBadgesForContent(contentId, contentType);

  return badges.some((badge) => {
    if (badge.type !== badgeType) return false;
    if (cadence && badge.cadence !== cadence) return false;
    return true;
  });
}

/**
 * Get badge display info for a content item
 * Returns formatted badges ready for UI display
 */
export async function getBadgeDisplay(
  contentId: string,
  contentType: ContentType
): Promise<{
  primary: ContentBadge | null;
  all: ContentBadge[];
  hasEditorial: boolean;
  highestCadence: EditionCadence | null;
}> {
  const badges = await getBadgesForContent(contentId, contentType);

  const editorial = badges.find((b) => b.type === "editorial");
  const editions = badges.filter((b) => b.type === "edition");

  const highestEdition = editions.length > 0 ? editions[0] : null;

  return {
    primary: badges[0] ?? null,
    all: badges,
    hasEditorial: !!editorial,
    highestCadence: highestEdition?.cadence ?? null,
  };
}
