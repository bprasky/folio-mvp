import { prisma } from "../../prisma";
import { generateEditionCopy, generateEditionSlug, getBadgeLabel } from "./generateEditionCopy";

// [Edition System] Monthly edition generator
// Aggregates best of weekly editions + top weekly performers

type MonthlyEditionResult = {
  editionId: string;
  slug: string;
  contentCount: number;
  includedWeeklyEditions: number;
  periodStart: Date;
  periodEnd: Date;
};

const MONTHLY_MIN_CONTENT = 5;
const MONTHLY_TOP_PERCENT = 0.3; // Top 30% of weekly performers

function getMonthBounds(referenceDate: Date = new Date()): { start: Date; end: Date } {
  const date = new Date(referenceDate);

  // Start of last month
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);

  // Start of current month (end of period)
  const end = new Date(date.getFullYear(), date.getMonth(), 1);
  end.setHours(0, 0, 0, 0);

  return { start, end };
}

async function fetchWeeklyEditions(periodStart: Date, periodEnd: Date) {
  return prisma.editorialEdition.findMany({
    where: {
      cadence: "WEEKLY",
      status: "PUBLISHED",
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    orderBy: { periodStart: "asc" },
  });
}

async function aggregateTopContent(weeklyEditionIds: string[]) {
  // Get all content from weekly editions
  const inclusions = await prisma.contentEditionInclusion.findMany({
    where: { editionId: { in: weeklyEditionIds } },
    include: {
      projectPost: {
        include: {
          project: {
            select: { views: true, saves: true, shares: true },
          },
          editorialAssignments: {
            select: { editorialScore: true },
          },
        },
      },
    },
  });

  type ContentScore = {
    id: string;
    type: "projectPost" | "feature";
    score: number;
    keywords: string[];
    weeklyAppearances: number;
  };

  const contentScores = new Map<string, ContentScore>();

  for (const inclusion of inclusions) {
    const id = inclusion.projectPostId ?? inclusion.featureId;
    if (!id) continue;

    const type = inclusion.projectPostId ? "projectPost" : "feature";
    const existing = contentScores.get(id);

    // Calculate score
    let score = 0;
    let keywords: string[] = [];

    if (inclusion.projectPost) {
      const views = inclusion.projectPost.project?.views ?? 0;
      const saves = inclusion.projectPost.project?.saves ?? 0;
      const shares = inclusion.projectPost.project?.shares ?? 0;

      const viewScore = Math.min(1, Math.log10(views + 1) / 3);
      const engagementScore = 0.3 * viewScore + 0.35 * (saves / 200) + 0.35 * (shares / 200);

      const editorialScore = inclusion.projectPost.editorialAssignments.length > 0
        ? Math.max(...inclusion.projectPost.editorialAssignments.map((a) => a.editorialScore))
        : 0;

      score = Math.max(engagementScore, editorialScore);
      keywords = inclusion.projectPost.keywords ?? [];
    }

    if (existing) {
      // Content appeared in multiple weekly editions - boost score
      contentScores.set(id, {
        ...existing,
        score: existing.score + score * 0.5, // Diminishing returns for repeat appearances
        weeklyAppearances: existing.weeklyAppearances + 1,
      });
    } else {
      contentScores.set(id, {
        id,
        type: type as "projectPost" | "feature",
        score,
        keywords,
        weeklyAppearances: 1,
      });
    }
  }

  // Sort by score and take top performers
  const sorted = Array.from(contentScores.values()).sort((a, b) => b.score - a.score);
  const topCount = Math.max(MONTHLY_MIN_CONTENT, Math.ceil(sorted.length * MONTHLY_TOP_PERCENT));

  return sorted.slice(0, topCount);
}

export async function generateMonthlyEdition(
  referenceDate: Date = new Date()
): Promise<MonthlyEditionResult | null> {
  const { start: periodStart, end: periodEnd } = getMonthBounds(referenceDate);
  const slug = generateEditionSlug("MONTHLY", periodStart);

  // Check if edition already exists
  const existing = await prisma.editorialEdition.findUnique({
    where: { slug },
  });

  if (existing) {
    console.log(`[MonthlyEdition] Edition ${slug} already exists`);
    return {
      editionId: existing.id,
      slug: existing.slug,
      contentCount: existing.projectPostIds.length + existing.featureIds.length,
      includedWeeklyEditions: existing.includedEditionIds.length,
      periodStart,
      periodEnd,
    };
  }

  // Fetch weekly editions from this month
  const weeklyEditions = await fetchWeeklyEditions(periodStart, periodEnd);

  if (weeklyEditions.length === 0) {
    console.log(`[MonthlyEdition] No weekly editions found for period`);
    return null;
  }

  // Aggregate top content from weekly editions
  const topContent = await aggregateTopContent(weeklyEditions.map((e) => e.id));

  if (topContent.length < MONTHLY_MIN_CONTENT) {
    console.log(`[MonthlyEdition] Insufficient content: ${topContent.length}/${MONTHLY_MIN_CONTENT}`);
    return null;
  }

  // Gather metadata
  const allKeywords = topContent.flatMap((c) => c.keywords);
  const keywordFreq = new Map<string, number>();
  for (const kw of allKeywords) {
    keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
  }
  const topKeywords = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kw]) => kw);

  const averageScore = topContent.reduce((acc, c) => acc + c.score, 0) / topContent.length;

  // Generate copy
  const copy = await generateEditionCopy({
    cadence: "MONTHLY",
    periodStart,
    periodEnd,
    contentCount: topContent.length,
    topKeywords,
    topCategories: [],
    averageScore,
  });

  const badgeLabel = getBadgeLabel("MONTHLY", periodStart);

  const projectPostIds = topContent.filter((c) => c.type === "projectPost").map((c) => c.id);
  const featureIds = topContent.filter((c) => c.type === "feature").map((c) => c.id);

  // Create edition
  const edition = await prisma.editorialEdition.create({
    data: {
      slug,
      cadence: "MONTHLY",
      periodStart,
      periodEnd,
      title: copy.title,
      intro: copy.intro,
      projectPostIds,
      featureIds,
      includedEditionIds: weeklyEditions.map((e) => e.id),
      categoryIds: [],
      projectIds: [],
      status: "DRAFT",
      metrics: {
        contentCount: topContent.length,
        projectPostCount: projectPostIds.length,
        featureCount: featureIds.length,
        weeklyEditionsIncluded: weeklyEditions.length,
        averageScore: Number(averageScore.toFixed(4)),
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // Create content inclusions
  const inclusions = topContent.map((c, i) => ({
    projectPostId: c.type === "projectPost" ? c.id : null,
    featureId: c.type === "feature" ? c.id : null,
    editionId: edition.id,
    rank: i + 1,
    badgeLabel,
  }));

  await prisma.contentEditionInclusion.createMany({
    data: inclusions,
  });

  console.log(`[MonthlyEdition] Created ${slug} with ${topContent.length} items from ${weeklyEditions.length} weekly editions`);

  return {
    editionId: edition.id,
    slug: edition.slug,
    contentCount: topContent.length,
    includedWeeklyEditions: weeklyEditions.length,
    periodStart,
    periodEnd,
  };
}
