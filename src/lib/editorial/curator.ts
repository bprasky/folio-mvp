import { prisma } from "../prisma";
import { makeSlug } from "../posting/slug";
import {
  EDITORIAL_CURATOR_CONSTANTS,
  EDITORIAL_CURATOR_THRESHOLDS,
  EDITORIAL_SCORE_WEIGHTS,
} from "./constants";

// [Editorial Curator Integration] In-memory state shared across hooks
const scoreCache = new Map<string, number>();
let lastAssignmentProjectId: string | null = null;

type EngagementSnapshot = {
  views: number;
  likes: number;
  saves: number;
};

type StyleDistance = {
  categoryId: string;
  distance: number;
};

const prismaAny = prisma as unknown as {
  editorialCategory: {
    findMany: (args?: any) => Promise<any[]>;
  };
  editorialAssignment: {
    upsert: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
  editorialEdition: {
    findFirst: (args: any) => Promise<any | null>;
    findMany?: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  embedding: {
    findFirst: (args: any) => Promise<any | null>;
  };
  marketSignal?: {
    findFirst: (args: any) => Promise<any | null>;
  };
  projectPost: {
    findUnique: (args: any) => Promise<any | null>;
  };
  project: {
    findUnique: (args: any) => Promise<any | null>;
  };
  $queryRawUnsafe: (query: string, ...params: any[]) => Promise<any[]>;
};

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function loadSupabaseAdmin() {
  try {
    const mod = await import("../supabaseAdmin");
    return mod.supabaseAdmin;
  } catch (error) {
    console.warn("[EditorialCurator] Supabase unavailable:", error);
    return null;
  }
}

async function fetchEngagement(projectId: string): Promise<EngagementSnapshot> {
  const fallback: EngagementSnapshot = { views: 0, likes: 0, saves: 0 };
  const supabase = await loadSupabaseAdmin();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(EDITORIAL_CURATOR_CONSTANTS.analyticsTable)
        .select("views, likes, saves")
        .eq("project_id", projectId)
        .maybeSingle();

      if (!error && data) {
        return {
          views: Number(data.views ?? 0),
          likes: Number(data.likes ?? 0),
          saves: Number(data.saves ?? 0),
        };
      }
    } catch (error) {
      console.warn("[EditorialCurator] Analytics fetch failed:", error);
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { views: true, saves: true, shares: true },
  });

  if (!project) return fallback;

  return {
    views: Number(project.views ?? 0),
    likes: Number(project.shares ?? 0),
    saves: Number(project.saves ?? 0),
  };
}

function scoreEngagement({ views, likes, saves }: EngagementSnapshot) {
  const viewScore = clamp01(Math.log10(views + 1) / 3); // ~0-1 over 1k views
  const likeScore = clamp01(likes / 200);
  const saveScore = clamp01(saves / 200);
  return clamp01(0.3 * viewScore + 0.35 * likeScore + 0.35 * saveScore);
}

async function scoreVendorDiversity(projectId: string) {
  const tags = await prisma.productTag.findMany({
    where: { image: { projectId } },
    select: { product: { select: { id: true, vendorId: true } } },
  });

  const vendorIds = new Set<string>();
  const productIds = new Set<string>();

  for (const tag of tags) {
    const product = tag.product;
    if (!product) continue;
    if (product.vendorId) vendorIds.add(product.vendorId);
    if (product.id) productIds.add(product.id);
  }

  const diversity = vendorIds.size + productIds.size * 0.5;
  return clamp01(diversity / 12);
}

async function fetchStyleDistances(projectId: string): Promise<StyleDistance[]> {
  try {
    const distances = await prismaAny.$queryRawUnsafe(
      `
        SELECT
          c.id AS "categoryId",
          (e.vector <=> c.centroid) AS distance
        FROM "editorial_category" c
        JOIN "embeddings" e
          ON e."nodeType" = $1
         AND e."nodeId" = $2
        WHERE c.type = 'style'
          AND c.centroid IS NOT NULL
        ORDER BY distance ASC
      `,
      EDITORIAL_CURATOR_CONSTANTS.styleEmbeddingNodeType,
      projectId
    );
    return (distances as any[]).map((row) => ({
      categoryId: row.categoryId,
      distance: Number(row.distance ?? 1),
    }));
  } catch (error) {
    console.warn("[EditorialCurator] Style distance query failed:", error);
    return [];
  }
}

async function scoreStyleUniqueness(projectId: string) {
  const distances = await fetchStyleDistances(projectId);
  if (!distances.length) return 0.5;
  // Use mean of three nearest centroids, higher distance => more unique
  const sample = distances.slice(0, 3);
  const avg = sample.reduce((acc, d) => acc + d.distance, 0) / sample.length;
  return clamp01(avg);
}

async function scoreTrendAlignment(projectId: string) {
  if (!prismaAny.marketSignal) return 0;
  try {
    const signal = await prismaAny.marketSignal.findFirst({
      where: { nodeType: "project", nodeId: projectId },
      orderBy: { updatedAt: "desc" },
      select: { momentum: true, confidence: true },
    });
    if (!signal) return 0;
    if (signal.confidence < 0.1) return 0;
    return signal.momentum >= EDITORIAL_CURATOR_THRESHOLDS.trendMomentumMin ? 1 : 0;
  } catch (error) {
    console.warn("[EditorialCurator] Trend alignment lookup failed:", error);
    return 0;
  }
}

function uniqueMatches(label: string | null | undefined, candidates: string[]) {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return candidates.some((candidate) => candidate.trim().toLowerCase() === normalized);
}

async function resolveProject(projectId: string) {
  const project = await prismaAny.project.findUnique({
    where: { id: projectId },
    include: {
      post: {
        select: {
          id: true,
          slug: true,
          keywords: true,
        },
      },
    },
  });
  if (!project?.post?.id) {
    throw new Error(`[EditorialCurator] Missing project post for ${projectId}`);
  }
  return project;
}

async function computeRegionCategories(project: any, categories: any[]) {
  const matches: any[] = [];
  const candidates = categories.filter((c) => c.type === "region");

  for (const category of candidates) {
    const tokens = category.label.split("|").map((t: string) => t.trim());
    if (
      uniqueMatches(project.city, tokens) ||
      uniqueMatches(project.regionState, tokens) ||
      tokens.includes("*")
    ) {
      matches.push(category);
    }
  }
  return matches.slice(0, 2);
}

async function computeStyleCategories(projectId: string, categories: any[]) {
  const distances = await fetchStyleDistances(projectId);
  if (!distances.length) return [];
  const byId = new Map(distances.map((d) => [d.categoryId, d.distance]));
  return categories
    .filter((c) => c.type === "style" && byId.has(c.id))
    .sort((a, b) => (byId.get(a.id)! - byId.get(b.id)!))
    .slice(0, 3);
}

function computeThemeCategories(project: any, categories: any[]) {
  const keywords = project.post?.keywords || [];
  if (!keywords.length) return [];
  const matches: any[] = [];
  for (const category of categories) {
    if (category.type !== "theme") continue;
    const tokens = category.label.split("|").map((t: string) => t.trim());
    const overlap = keywords.some((kw: string) =>
      tokens.includes(kw.trim().toLowerCase())
    );
    if (overlap) {
      matches.push(category);
    }
  }
  return matches.slice(0, 3);
}

async function persistAssignments(
  project: any,
  categories: any[],
  score: number
) {
  const created: string[] = [];

  for (const category of categories) {
    const response = await prismaAny.editorialAssignment.upsert({
      where: {
        projectId_categoryId: {
          projectId: project.id,
          categoryId: category.id,
        },
      },
      update: {
        editorialScore: score,
      },
      create: {
        projectId: project.id,
        editorialId: project.post.id,
        categoryId: category.id,
        editorialScore: score,
      },
    });
    created.push(category.id);
  }

  return created;
}

function buildEditionSlug(base: string, fallback: string) {
  return `${EDITORIAL_CURATOR_CONSTANTS.editionSlugPrefix}-${makeSlug(base, fallback)}`;
}

async function ensureEditionDraft(
  projectId: string,
  categorySet: { styleIds: string[]; regionIds: string[] },
  score: number
) {
  const categoryIds = [...categorySet.styleIds, ...categorySet.regionIds].sort();
  if (!categoryIds.length) return;

  const existing = await prismaAny.editorialEdition.findFirst({
    where: {
      categoryIds: { equals: categoryIds },
    },
  });

  const assignments = await prismaAny.editorialAssignment.findMany({
    where: {
      categoryId: { in: categoryIds },
      editorialScore: { gte: EDITORIAL_CURATOR_THRESHOLDS.highScore },
    },
    select: {
      projectId: true,
      categoryId: true,
      editorialScore: true,
    },
  });

  const grouped = new Map<
    string,
    { categories: Set<string>; score: number }
  >();

  for (const assignment of assignments) {
    const entry = grouped.get(assignment.projectId) ?? {
      categories: new Set<string>(),
      score: assignment.editorialScore,
    };
    entry.categories.add(assignment.categoryId);
    entry.score = Math.max(entry.score, assignment.editorialScore);
    grouped.set(assignment.projectId, entry);
  }

  // Ensure current project is represented
  if (!grouped.has(projectId)) {
    grouped.set(projectId, {
      categories: new Set(categoryIds),
      score,
    });
  }

  const qualifyingProjects = Array.from(grouped.entries()).filter(
    ([, entry]) =>
      categorySet.styleIds.every((id) => entry.categories.has(id)) &&
      categorySet.regionIds.every((id) => entry.categories.has(id)) &&
      entry.score >= EDITORIAL_CURATOR_THRESHOLDS.highScore
  );

  if (qualifyingProjects.length < EDITORIAL_CURATOR_THRESHOLDS.clusterMinimum) {
    return;
  }

  const projectIds = qualifyingProjects.map(([pid]) => pid);
  const avgScore =
    qualifyingProjects.reduce((acc, [, entry]) => acc + entry.score, 0) /
    qualifyingProjects.length;

  if (existing) {
    await prismaAny.editorialEdition.update({
      where: { id: existing.id },
      data: {
        projectIds,
        metrics: {
          projects: qualifyingProjects.length,
          averageScore: Number(avgScore.toFixed(3)),
        },
      },
    });
    return;
  }

  const slugBase = categoryIds.join("-");
  await prismaAny.editorialEdition.create({
    data: {
      slug: buildEditionSlug(slugBase, projectId),
      title: "Curated Edition Draft",
      intro: "Edition draft awaiting editorial polish.",
      categoryIds,
      projectIds,
      metrics: {
        projects: qualifyingProjects.length,
        averageScore: Number(avgScore.toFixed(3)),
      },
    },
  });
}

export async function calculateEditorialScore(projectId: string): Promise<number> {
  const [engagementRaw, vendorDiversity, styleUniqueness, trendAlignment] =
    await Promise.all([
      fetchEngagement(projectId),
      scoreVendorDiversity(projectId),
      scoreStyleUniqueness(projectId),
      scoreTrendAlignment(projectId),
    ]);

  const engagementScore = scoreEngagement(engagementRaw);

  const score =
    EDITORIAL_SCORE_WEIGHTS.engagement * engagementScore +
    EDITORIAL_SCORE_WEIGHTS.vendorDiversity * vendorDiversity +
    EDITORIAL_SCORE_WEIGHTS.styleUniqueness * styleUniqueness +
    EDITORIAL_SCORE_WEIGHTS.trendAlignment * trendAlignment;

  const normalized = Number(clamp01(score).toFixed(4));
  scoreCache.set(projectId, normalized);
  return normalized;
}

export async function assignEditorialCategories(projectId: string): Promise<string[]> {
  const [project, categories, cachedScore] = await Promise.all([
    resolveProject(projectId),
    prismaAny.editorialCategory.findMany(),
    (async () => scoreCache.get(projectId) ?? calculateEditorialScore(projectId))(),
  ]);

  const resolvedScore =
    typeof cachedScore === "number" ? cachedScore : await cachedScore;

  const styleCategories = await computeStyleCategories(projectId, categories);
  const regionCategories = await computeRegionCategories(project, categories);
  const themeCategories = computeThemeCategories(project, categories);

  const uniqueMap = new Map<string, any>();
  for (const category of [
    ...styleCategories,
    ...regionCategories,
    ...themeCategories,
  ]) {
    uniqueMap.set(category.id, category);
  }

  const assigned = Array.from(uniqueMap.values());
  const persisted = await persistAssignments(project, assigned, resolvedScore);

  lastAssignmentProjectId = projectId;
  return persisted;
}

export async function checkForEditionDrafts(categoryIds: string[]): Promise<void> {
  if (!lastAssignmentProjectId) return;
  if (!categoryIds.length) return;

  const score =
    scoreCache.get(lastAssignmentProjectId) ??
    (await calculateEditorialScore(lastAssignmentProjectId));

  const categories = await prismaAny.editorialCategory.findMany({
    where: { id: { in: categoryIds } },
  });

  const styleIds = categories
    .filter((c) => c.type === "style")
    .map((c) => c.id)
    .sort();
  const regionIds = categories
    .filter((c) => c.type === "region")
    .map((c) => c.id)
    .sort();

  if (!styleIds.length && !regionIds.length) {
    scoreCache.delete(lastAssignmentProjectId);
    lastAssignmentProjectId = null;
    return;
  }

  await ensureEditionDraft(
    lastAssignmentProjectId,
    { styleIds, regionIds },
    score
  );

  scoreCache.delete(lastAssignmentProjectId);
  lastAssignmentProjectId = null;
}

