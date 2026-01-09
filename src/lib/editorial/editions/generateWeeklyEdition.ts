import { prisma } from "../../prisma";
import { generateEditionCopy, generateEditionSlug, getBadgeLabel } from "./generateEditionCopy";
import { EDITORIAL_CURATOR_THRESHOLDS } from "../constants";

// [Edition System] Weekly edition generator
// Aggregates top performers from the past week that met editorial threshold

type ContentItem = {
  id: string;
  type: "projectPost" | "feature";
  score: number;
  keywords: string[];
};

type WeeklyEditionResult = {
  editionId: string;
  slug: string;
  contentCount: number;
  periodStart: Date;
  periodEnd: Date;
};

const WEEKLY_MIN_CONTENT = 3; // Minimum content items for a weekly edition
const WEEKLY_ENGAGEMENT_THRESHOLD = 0.6; // Min score to qualify

function getWeekBounds(referenceDate: Date = new Date()): { start: Date; end: Date } {
  const date = new Date(referenceDate);
  // Set to start of current day
  date.setHours(0, 0, 0, 0);

  // Go back to last Monday (or today if Monday)
  const dayOfWeek = date.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // End is the start of today's week, start is 7 days before
  const end = new Date(date);
  end.setDate(end.getDate() - daysToSubtract);

  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  return { start, end };
}

async function fetchQualifyingProjectPosts(
  periodStart: Date,
  periodEnd: Date
): Promise<ContentItem[]> {
  // Find project posts that were above fold during this period
  const projectPosts = await prisma.projectPost.findMany({
    where: {
      status: "PUBLISHED",
      aboveFoldAt: { gte: periodStart, lt: periodEnd },
    },
    include: {
      project: {
        select: {
          views: true,
          saves: true,
          shares: true,
        },
      },
      editorialAssignments: {
        select: {
          editorialScore: true,
        },
      },
    },
  });

  return projectPosts
    .map((post) => {
      // Calculate engagement score
      const views = post.project?.views ?? 0;
      const saves = post.project?.saves ?? 0;
      const shares = post.project?.shares ?? 0;

      const viewScore = Math.min(1, Math.log10(views + 1) / 3);
      const engagementScore = 0.3 * viewScore + 0.35 * (saves / 200) + 0.35 * (shares / 200);

      // Use editorial assignment score if available
      const editorialScore = post.editorialAssignments.length > 0
        ? Math.max(...post.editorialAssignments.map((a) => a.editorialScore))
        : engagementScore;

      return {
        id: post.id,
        type: "projectPost" as const,
        score: Math.max(engagementScore, editorialScore),
        keywords: post.keywords ?? [],
      };
    })
    .filter((item) => item.score >= WEEKLY_ENGAGEMENT_THRESHOLD);
}

async function fetchQualifyingFeatures(
  periodStart: Date,
  periodEnd: Date
): Promise<ContentItem[]> {
  const features = await prisma.$queryRaw<Array<{
    id: string;
    views: number;
    saves: number;
    shares: number;
  }>>`
    SELECT id, views, saves, shares
    FROM features
    WHERE status = 'PUBLISHED'
      AND "aboveFoldAt" >= ${periodStart}
      AND "aboveFoldAt" < ${periodEnd}
  `;

  return features
    .map((feature) => {
      const viewScore = Math.min(1, Math.log10(feature.views + 1) / 3);
      const engagementScore = 0.3 * viewScore + 0.35 * (feature.saves / 200) + 0.35 * (feature.shares / 200);

      return {
        id: feature.id,
        type: "feature" as const,
        score: engagementScore,
        keywords: [],
      };
    })
    .filter((item) => item.score >= WEEKLY_ENGAGEMENT_THRESHOLD);
}

export async function generateWeeklyEdition(
  referenceDate: Date = new Date()
): Promise<WeeklyEditionResult | null> {
  const { start: periodStart, end: periodEnd } = getWeekBounds(referenceDate);
  const slug = generateEditionSlug("WEEKLY", periodStart);

  // Check if edition already exists
  const existing = await prisma.editorialEdition.findUnique({
    where: { slug },
  });

  if (existing) {
    console.log(`[WeeklyEdition] Edition ${slug} already exists`);
    return {
      editionId: existing.id,
      slug: existing.slug,
      contentCount: existing.projectPostIds.length + existing.featureIds.length,
      periodStart,
      periodEnd,
    };
  }

  // Fetch qualifying content
  const [projectPosts, features] = await Promise.all([
    fetchQualifyingProjectPosts(periodStart, periodEnd),
    fetchQualifyingFeatures(periodStart, periodEnd),
  ]);

  const allContent = [...projectPosts, ...features].sort((a, b) => b.score - a.score);

  if (allContent.length < WEEKLY_MIN_CONTENT) {
    console.log(`[WeeklyEdition] Insufficient content: ${allContent.length}/${WEEKLY_MIN_CONTENT}`);
    return null;
  }

  // Gather metadata for copy generation
  const allKeywords = allContent.flatMap((c) => c.keywords);
  const keywordFreq = new Map<string, number>();
  for (const kw of allKeywords) {
    keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
  }
  const topKeywords = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kw]) => kw);

  const averageScore = allContent.reduce((acc, c) => acc + c.score, 0) / allContent.length;

  // Generate edition copy
  const copy = await generateEditionCopy({
    cadence: "WEEKLY",
    periodStart,
    periodEnd,
    contentCount: allContent.length,
    topKeywords,
    topCategories: [],
    averageScore,
  });

  const badgeLabel = getBadgeLabel("WEEKLY", periodStart);

  // Create edition
  const edition = await prisma.editorialEdition.create({
    data: {
      slug,
      cadence: "WEEKLY",
      periodStart,
      periodEnd,
      title: copy.title,
      intro: copy.intro,
      projectPostIds: projectPosts.map((p) => p.id),
      featureIds: features.map((f) => f.id),
      categoryIds: [],
      projectIds: [],
      status: "DRAFT",
      metrics: {
        contentCount: allContent.length,
        projectPostCount: projectPosts.length,
        featureCount: features.length,
        averageScore: Number(averageScore.toFixed(4)),
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // Create content inclusions
  await prisma.contentEditionInclusion.createMany({
    data: [
      ...projectPosts.map((p, i) => ({
        projectPostId: p.id,
        editionId: edition.id,
        rank: i + 1,
        badgeLabel,
      })),
      ...features.map((f, i) => ({
        featureId: f.id,
        editionId: edition.id,
        rank: projectPosts.length + i + 1,
        badgeLabel,
      })),
    ],
  });

  console.log(`[WeeklyEdition] Created ${slug} with ${allContent.length} items`);

  return {
    editionId: edition.id,
    slug: edition.slug,
    contentCount: allContent.length,
    periodStart,
    periodEnd,
  };
}
