import { prisma } from "../../prisma";
import { generateEditionCopy, generateEditionSlug, getBadgeLabel } from "./generateEditionCopy";

// [Edition System] Annual edition generator
// Aggregates best of quarterly editions + editor picks
// This is the highest prestige edition level

type AnnualEditionResult = {
  editionId: string;
  slug: string;
  contentCount: number;
  includedQuarterlyEditions: number;
  editorPicksCount: number;
  periodStart: Date;
  periodEnd: Date;
};

const ANNUAL_MIN_CONTENT = 12;
const ANNUAL_TOP_PERCENT = 0.2; // Top 20% of quarterly performers
const ANNUAL_EDITOR_PICK_SLOTS = 5; // Reserved slots for editor picks

function getYearBounds(referenceDate: Date = new Date()): { start: Date; end: Date } {
  const date = new Date(referenceDate);

  // Previous year
  const year = date.getFullYear() - 1;

  const start = new Date(year, 0, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(year + 1, 0, 1);
  end.setHours(0, 0, 0, 0);

  return { start, end };
}

async function fetchQuarterlyEditions(periodStart: Date, periodEnd: Date) {
  return prisma.editorialEdition.findMany({
    where: {
      cadence: "QUARTERLY",
      status: "PUBLISHED",
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    orderBy: { periodStart: "asc" },
  });
}

async function aggregateTopContent(quarterlyEditionIds: string[]) {
  const inclusions = await prisma.contentEditionInclusion.findMany({
    where: { editionId: { in: quarterlyEditionIds } },
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
    quarterlyAppearances: number;
    isEditorPick: boolean;
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
      // Multiple quarterly appearances - major boost for annual
      contentScores.set(id, {
        ...existing,
        score: existing.score + score * 0.8,
        quarterlyAppearances: existing.quarterlyAppearances + 1,
      });
    } else {
      contentScores.set(id, {
        id,
        type: type as "projectPost" | "feature",
        score,
        keywords,
        quarterlyAppearances: 1,
        isEditorPick: false,
      });
    }
  }

  const sorted = Array.from(contentScores.values()).sort((a, b) => b.score - a.score);
  const topCount = Math.max(ANNUAL_MIN_CONTENT, Math.ceil(sorted.length * ANNUAL_TOP_PERCENT));

  return sorted.slice(0, topCount);
}

async function fetchEditorPicks(periodStart: Date, periodEnd: Date) {
  // Editor picks are high-scoring content that might not have made quarterly editions
  // This gives editors a way to include exceptional work that deserves recognition

  const picks = await prisma.projectPost.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: periodStart, lt: periodEnd },
      editorialAssignments: {
        some: {
          editorialScore: { gte: 0.85 }, // Very high editorial score
        },
      },
    },
    include: {
      project: {
        select: { views: true, saves: true, shares: true },
      },
      editorialAssignments: {
        select: { editorialScore: true },
      },
    },
    orderBy: {
      editorialAssignments: {
        _count: "desc",
      },
    },
    take: ANNUAL_EDITOR_PICK_SLOTS * 2, // Fetch extra for filtering
  });

  return picks.map((post) => {
    const editorialScore = post.editorialAssignments.length > 0
      ? Math.max(...post.editorialAssignments.map((a) => a.editorialScore))
      : 0;

    return {
      id: post.id,
      type: "projectPost" as const,
      score: editorialScore,
      keywords: post.keywords ?? [],
      isEditorPick: true,
    };
  });
}

export async function generateAnnualEdition(
  referenceDate: Date = new Date()
): Promise<AnnualEditionResult | null> {
  const { start: periodStart, end: periodEnd } = getYearBounds(referenceDate);
  const slug = generateEditionSlug("ANNUAL", periodStart);

  // Check if edition already exists
  const existing = await prisma.editorialEdition.findUnique({
    where: { slug },
  });

  if (existing) {
    console.log(`[AnnualEdition] Edition ${slug} already exists`);
    return {
      editionId: existing.id,
      slug: existing.slug,
      contentCount: existing.projectPostIds.length + existing.featureIds.length,
      includedQuarterlyEditions: existing.includedEditionIds.length,
      editorPicksCount: 0,
      periodStart,
      periodEnd,
    };
  }

  // Fetch quarterly editions
  const quarterlyEditions = await fetchQuarterlyEditions(periodStart, periodEnd);

  if (quarterlyEditions.length < 2) {
    console.log(`[AnnualEdition] Insufficient quarterly editions: ${quarterlyEditions.length}/2`);
    return null;
  }

  // Aggregate top content from quarterly editions
  const topFromQuarterly = await aggregateTopContent(quarterlyEditions.map((e) => e.id));

  // Fetch editor picks (content not already in quarterly editions)
  const editorPicks = await fetchEditorPicks(periodStart, periodEnd);
  const quarterlyContentIds = new Set(topFromQuarterly.map((c) => c.id));

  // Filter editor picks to exclude content already selected from quarterly editions
  const uniqueEditorPicks = editorPicks
    .filter((p) => !quarterlyContentIds.has(p.id))
    .slice(0, ANNUAL_EDITOR_PICK_SLOTS);

  // Combine all content
  const allContent = [...topFromQuarterly, ...uniqueEditorPicks].sort((a, b) => b.score - a.score);

  if (allContent.length < ANNUAL_MIN_CONTENT) {
    console.log(`[AnnualEdition] Insufficient content: ${allContent.length}/${ANNUAL_MIN_CONTENT}`);
    return null;
  }

  // Gather metadata
  const allKeywords = allContent.flatMap((c) => c.keywords);
  const keywordFreq = new Map<string, number>();
  for (const kw of allKeywords) {
    keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
  }
  const topKeywords = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([kw]) => kw);

  const averageScore = allContent.reduce((acc, c) => acc + c.score, 0) / allContent.length;

  // Generate copy
  const copy = await generateEditionCopy({
    cadence: "ANNUAL",
    periodStart,
    periodEnd,
    contentCount: allContent.length,
    topKeywords,
    topCategories: [],
    averageScore,
  });

  const badgeLabel = getBadgeLabel("ANNUAL", periodStart);

  const projectPostIds = allContent.filter((c) => c.type === "projectPost").map((c) => c.id);
  const featureIds = allContent.filter((c) => c.type === "feature").map((c) => c.id);

  // Create edition with REVIEW status (annual editions require human review)
  const edition = await prisma.editorialEdition.create({
    data: {
      slug,
      cadence: "ANNUAL",
      periodStart,
      periodEnd,
      title: copy.title,
      intro: copy.intro,
      projectPostIds,
      featureIds,
      includedEditionIds: quarterlyEditions.map((e) => e.id),
      categoryIds: [],
      projectIds: [],
      status: "REVIEW", // Annual editions go to review, not draft
      metrics: {
        contentCount: allContent.length,
        projectPostCount: projectPostIds.length,
        featureCount: featureIds.length,
        quarterlyEditionsIncluded: quarterlyEditions.length,
        editorPicksCount: uniqueEditorPicks.length,
        averageScore: Number(averageScore.toFixed(4)),
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // Create content inclusions
  const inclusions = allContent.map((c, i) => ({
    projectPostId: c.type === "projectPost" ? c.id : null,
    featureId: c.type === "feature" ? c.id : null,
    editionId: edition.id,
    rank: i + 1,
    badgeLabel,
  }));

  await prisma.contentEditionInclusion.createMany({
    data: inclusions,
  });

  console.log(
    `[AnnualEdition] Created ${slug} with ${allContent.length} items ` +
    `(${topFromQuarterly.length} from quarterly, ${uniqueEditorPicks.length} editor picks)`
  );

  return {
    editionId: edition.id,
    slug: edition.slug,
    contentCount: allContent.length,
    includedQuarterlyEditions: quarterlyEditions.length,
    editorPicksCount: uniqueEditorPicks.length,
    periodStart,
    periodEnd,
  };
}
