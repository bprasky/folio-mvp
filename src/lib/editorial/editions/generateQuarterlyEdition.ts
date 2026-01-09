import { prisma } from "../../prisma";
import { generateEditionCopy, generateEditionSlug, getBadgeLabel } from "./generateEditionCopy";

// [Edition System] Quarterly edition generator
// Aggregates best of monthly editions

type QuarterlyEditionResult = {
  editionId: string;
  slug: string;
  contentCount: number;
  includedMonthlyEditions: number;
  periodStart: Date;
  periodEnd: Date;
};

const QUARTERLY_MIN_CONTENT = 8;
const QUARTERLY_TOP_PERCENT = 0.25; // Top 25% of monthly performers

function getQuarterBounds(referenceDate: Date = new Date()): { start: Date; end: Date } {
  const date = new Date(referenceDate);
  const currentMonth = date.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  // Previous quarter
  const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
  const prevQuarterYear = currentQuarter === 0 ? date.getFullYear() - 1 : date.getFullYear();

  // Start of previous quarter
  const start = new Date(prevQuarterYear, prevQuarter * 3, 1);
  start.setHours(0, 0, 0, 0);

  // Start of current quarter (end of period)
  const end = new Date(date.getFullYear(), currentQuarter * 3, 1);
  end.setHours(0, 0, 0, 0);

  return { start, end };
}

async function fetchMonthlyEditions(periodStart: Date, periodEnd: Date) {
  return prisma.editorialEdition.findMany({
    where: {
      cadence: "MONTHLY",
      status: "PUBLISHED",
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    orderBy: { periodStart: "asc" },
  });
}

async function aggregateTopContent(monthlyEditionIds: string[]) {
  const inclusions = await prisma.contentEditionInclusion.findMany({
    where: { editionId: { in: monthlyEditionIds } },
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
    monthlyAppearances: number;
  };

  const contentScores = new Map<string, ContentScore>();

  for (const inclusion of inclusions) {
    const id = inclusion.projectPostId ?? inclusion.featureId;
    if (!id) continue;

    const type = inclusion.projectPostId ? "projectPost" : "feature";
    const existing = contentScores.get(id);

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
      // Multiple monthly appearances - significant boost for quarterly
      contentScores.set(id, {
        ...existing,
        score: existing.score + score * 0.7,
        monthlyAppearances: existing.monthlyAppearances + 1,
      });
    } else {
      contentScores.set(id, {
        id,
        type: type as "projectPost" | "feature",
        score,
        keywords,
        monthlyAppearances: 1,
      });
    }
  }

  const sorted = Array.from(contentScores.values()).sort((a, b) => b.score - a.score);
  const topCount = Math.max(QUARTERLY_MIN_CONTENT, Math.ceil(sorted.length * QUARTERLY_TOP_PERCENT));

  return sorted.slice(0, topCount);
}

export async function generateQuarterlyEdition(
  referenceDate: Date = new Date()
): Promise<QuarterlyEditionResult | null> {
  const { start: periodStart, end: periodEnd } = getQuarterBounds(referenceDate);
  const slug = generateEditionSlug("QUARTERLY", periodStart);

  // Check if edition already exists
  const existing = await prisma.editorialEdition.findUnique({
    where: { slug },
  });

  if (existing) {
    console.log(`[QuarterlyEdition] Edition ${slug} already exists`);
    return {
      editionId: existing.id,
      slug: existing.slug,
      contentCount: existing.projectPostIds.length + existing.featureIds.length,
      includedMonthlyEditions: existing.includedEditionIds.length,
      periodStart,
      periodEnd,
    };
  }

  // Fetch monthly editions from this quarter
  const monthlyEditions = await fetchMonthlyEditions(periodStart, periodEnd);

  if (monthlyEditions.length === 0) {
    console.log(`[QuarterlyEdition] No monthly editions found for period`);
    return null;
  }

  // Aggregate top content
  const topContent = await aggregateTopContent(monthlyEditions.map((e) => e.id));

  if (topContent.length < QUARTERLY_MIN_CONTENT) {
    console.log(`[QuarterlyEdition] Insufficient content: ${topContent.length}/${QUARTERLY_MIN_CONTENT}`);
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
    cadence: "QUARTERLY",
    periodStart,
    periodEnd,
    contentCount: topContent.length,
    topKeywords,
    topCategories: [],
    averageScore,
  });

  const badgeLabel = getBadgeLabel("QUARTERLY", periodStart);

  const projectPostIds = topContent.filter((c) => c.type === "projectPost").map((c) => c.id);
  const featureIds = topContent.filter((c) => c.type === "feature").map((c) => c.id);

  // Create edition
  const edition = await prisma.editorialEdition.create({
    data: {
      slug,
      cadence: "QUARTERLY",
      periodStart,
      periodEnd,
      title: copy.title,
      intro: copy.intro,
      projectPostIds,
      featureIds,
      includedEditionIds: monthlyEditions.map((e) => e.id),
      categoryIds: [],
      projectIds: [],
      status: "DRAFT",
      metrics: {
        contentCount: topContent.length,
        projectPostCount: projectPostIds.length,
        featureCount: featureIds.length,
        monthlyEditionsIncluded: monthlyEditions.length,
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

  console.log(`[QuarterlyEdition] Created ${slug} with ${topContent.length} items from ${monthlyEditions.length} monthly editions`);

  return {
    editionId: edition.id,
    slug: edition.slug,
    contentCount: topContent.length,
    includedMonthlyEditions: monthlyEditions.length,
    periodStart,
    periodEnd,
  };
}
