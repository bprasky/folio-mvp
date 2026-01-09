import OpenAI from "openai";
import { prisma } from "../prisma";
import { logPassiveEvent } from "../analytics";
import {
  EDITORIAL_CURATOR_CONSTANTS,
  EDITORIAL_CURATOR_THRESHOLDS,
  EDITORIAL_SCHEDULER_PROMPT,
} from "./constants";
import {
  generateWeeklyEdition,
  generateMonthlyEdition,
  generateQuarterlyEdition,
  generateAnnualEdition,
} from "./editions";

// [Editorial Curator Integration] Edition publishing orchestrator

const prismaAny = prisma as unknown as {
  editorialEdition: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  editorialAssignment: {
    findMany: (args: any) => Promise<any[]>;
  };
  editorialCategory: {
    findMany: (args: any) => Promise<any[]>;
  };
  project: {
    findMany: (args: any) => Promise<any[]>;
  };
  projectPost: {
    findMany: (args: any) => Promise<any[]>;
  };
};

type EditionCopy = {
  title: string;
  intro: string;
};

function fillSchedulerPrompt(params: {
  categoryLabels: string[];
  regionLabels: string[];
  trendKeywords: string[];
}) {
  const template = `${EDITORIAL_SCHEDULER_PROMPT}

Respond with a JSON object: {"title": "...", "intro": "..."} and nothing else.`;

  return template
    .replace("{{category_labels}}", params.categoryLabels.join(", ") || "Mixed")
    .replace("{{region_labels}}", params.regionLabels.join(", ") || "Various Regions")
    .replace("{{trend_keywords}}", params.trendKeywords.join(", ") || "timeless, enduring");
}

async function generateEditionCopy(payload: {
  categoryLabels: string[];
  regionLabels: string[];
  trendKeywords: string[];
}): Promise<EditionCopy> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      title: `${payload.categoryLabels[0] ?? "Folio"} Edition`,
      intro:
        "An automated curation spotlighting projects that share a resonant aesthetic signature across the current Folio catalog.",
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = fillSchedulerPrompt(payload);

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 320,
      messages: [
        {
          role: "system",
          content:
            "You are Folio’s Editorial Edition curator. Maintain an elegant, professional, timeless tone. Respond with JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const payloadText = res.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(payloadText);
    if (typeof parsed?.title === "string" && typeof parsed?.intro === "string") {
      return {
        title: parsed.title.trim(),
        intro: parsed.intro.trim(),
      };
    }
  } catch (error) {
    console.warn("[EditorialScheduler] OpenAI generation failed:", error);
  }

  return {
    title: `${payload.categoryLabels[0] ?? "Folio"} Edition`,
    intro:
      "An automated curation spotlighting projects that share a resonant aesthetic signature across the current Folio catalog.",
  };
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

async function gatherEditionContext(edition: any) {
  const categories = await prismaAny.editorialCategory.findMany({
    where: { id: { in: edition.categoryIds } },
  });

  const assignments = await prismaAny.editorialAssignment.findMany({
    where: {
      categoryId: { in: edition.categoryIds },
      editorialScore: { gte: EDITORIAL_CURATOR_THRESHOLDS.editionPublishScore },
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

  const qualifyingProjects = Array.from(grouped.entries()).filter(
    ([, entry]) =>
      edition.categoryIds.every((id: string) => entry.categories.has(id)) &&
      entry.score >= EDITORIAL_CURATOR_THRESHOLDS.editionPublishScore
  );

  return {
    categories,
    qualifyingProjects,
  };
}

async function fetchProjectKeywords(projectIds: string[]) {
  if (!projectIds.length) return [] as string[];
  const posts = await prismaAny.projectPost.findMany({
    where: { projectId: { in: projectIds } },
    select: { keywords: true },
  });

  return dedupe(
    posts.flatMap((post: any) => (post.keywords ?? []).map((kw: string) => kw.toLowerCase()))
  );
}

async function notifyStakeholders(editionId: string, projectIds: string[]) {
  if (!projectIds.length) return;
  const projects = await prismaAny.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, ownerId: true, designerId: true },
  });

  await Promise.all(
    projects.flatMap((project: any) => {
      const payload = {
        editionId,
        projectId: project.id,
      };

      const notifications: Promise<void>[] = [];

      if (project.designerId) {
        notifications.push(
          logPassiveEvent({
            type: EDITORIAL_CURATOR_CONSTANTS.notificationEvent as any,
            projectId: project.id,
            actorId: project.designerId,
            payload,
          })
        );
      }

      if (project.ownerId && project.ownerId !== project.designerId) {
        notifications.push(
          logPassiveEvent({
            type: EDITORIAL_CURATOR_CONSTANTS.notificationEvent as any,
            projectId: project.id,
            actorId: project.ownerId,
            payload,
          })
        );
      }

      return notifications;
    })
  );
}

export async function runEditorialEditionScheduler() {
  const drafts = await prismaAny.editorialEdition.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const published: string[] = [];

  for (const draft of drafts) {
    const { categories, qualifyingProjects } = await gatherEditionContext(draft);

    if (qualifyingProjects.length < EDITORIAL_CURATOR_THRESHOLDS.schedulerMinimum) {
      continue;
    }

    const averageScore =
      qualifyingProjects.reduce((acc, [, entry]) => acc + entry.score, 0) /
      qualifyingProjects.length;

    if (averageScore < EDITORIAL_CURATOR_THRESHOLDS.editionPublishScore) {
      continue;
    }

    const categoryLabels = categories.filter((c) => c.type === "style").map((c) => c.label);
    const regionLabels = categories.filter((c) => c.type === "region").map((c) => c.label);
    const projectIds = qualifyingProjects.map(([projectId]) => projectId);
    const trendKeywords = await fetchProjectKeywords(projectIds);

    const copy = await generateEditionCopy({
      categoryLabels,
      regionLabels,
      trendKeywords,
    });

    const now = new Date();
    await prismaAny.editorialEdition.update({
      where: { id: draft.id },
      data: {
        title: copy.title,
        intro: copy.intro,
        projectIds,
        publishedAt: now,
        metrics: {
          ...(draft.metrics ?? {}),
          projects: qualifyingProjects.length,
          averageScore: Number(averageScore.toFixed(3)),
          publishedAt: now.toISOString(),
        },
      },
    });

    await notifyStakeholders(draft.id, projectIds);
    published.push(draft.id);
  }

  return { published };
}

export async function runDailyEditorialScheduler() {
  return runEditorialEditionScheduler();
}

// ============================================================
// Edition System - Cadenced Edition Generation
// ============================================================

type EditionGenerationResult = {
  editionId: string;
  slug: string;
  contentCount: number;
} | null;

/**
 * Weekly edition job - runs every Monday
 * Generates edition for the previous week's top performers
 */
export async function runWeeklyEditionJob(): Promise<EditionGenerationResult> {
  console.log("[EditionScheduler] Running weekly edition job");
  try {
    const result = await generateWeeklyEdition();
    if (result) {
      console.log(`[EditionScheduler] Weekly edition created: ${result.slug}`);
      // Auto-publish weekly editions
      await publishEdition(result.editionId);
    }
    return result;
  } catch (error) {
    console.error("[EditionScheduler] Weekly edition job failed:", error);
    return null;
  }
}

/**
 * Monthly edition job - runs on 1st of each month
 * Generates edition from the previous month's best weekly performers
 */
export async function runMonthlyEditionJob(): Promise<EditionGenerationResult> {
  console.log("[EditionScheduler] Running monthly edition job");
  try {
    const result = await generateMonthlyEdition();
    if (result) {
      console.log(`[EditionScheduler] Monthly edition created: ${result.slug}`);
      // Auto-publish monthly editions
      await publishEdition(result.editionId);
    }
    return result;
  } catch (error) {
    console.error("[EditionScheduler] Monthly edition job failed:", error);
    return null;
  }
}

/**
 * Quarterly edition job - runs at start of each quarter
 * Generates edition from the previous quarter's best monthly performers
 */
export async function runQuarterlyEditionJob(): Promise<EditionGenerationResult> {
  console.log("[EditionScheduler] Running quarterly edition job");
  try {
    const result = await generateQuarterlyEdition();
    if (result) {
      console.log(`[EditionScheduler] Quarterly edition created: ${result.slug}`);
      // Auto-publish quarterly editions
      await publishEdition(result.editionId);
    }
    return result;
  } catch (error) {
    console.error("[EditionScheduler] Quarterly edition job failed:", error);
    return null;
  }
}

/**
 * Annual edition job - runs in January
 * Generates draft edition for review (highest prestige, requires manual approval)
 */
export async function runAnnualEditionJob(): Promise<EditionGenerationResult> {
  console.log("[EditionScheduler] Running annual edition job");
  try {
    const result = await generateAnnualEdition();
    if (result) {
      console.log(`[EditionScheduler] Annual edition draft created: ${result.slug} (pending review)`);
      // Annual editions are created in REVIEW status, not auto-published
    }
    return result;
  } catch (error) {
    console.error("[EditionScheduler] Annual edition job failed:", error);
    return null;
  }
}

/**
 * Publish an edition and notify stakeholders
 */
async function publishEdition(editionId: string): Promise<void> {
  const edition = await prismaAny.editorialEdition.update({
    where: { id: editionId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // Notify stakeholders for included content
  const projectIds = edition.projectPostIds ?? [];
  if (projectIds.length > 0) {
    await notifyStakeholders(editionId, projectIds);
  }
}

/**
 * Check which edition jobs should run based on current date
 * Returns functions to execute
 */
export function getScheduledEditionJobs(date: Date = new Date()): (() => Promise<EditionGenerationResult>)[] {
  const jobs: (() => Promise<EditionGenerationResult>)[] = [];

  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  const month = date.getMonth();

  // Weekly: Run on Monday (day 1)
  if (dayOfWeek === 1) {
    jobs.push(runWeeklyEditionJob);
  }

  // Monthly: Run on 1st of month
  if (dayOfMonth === 1) {
    jobs.push(runMonthlyEditionJob);
  }

  // Quarterly: Run on 1st of Jan, Apr, Jul, Oct (months 0, 3, 6, 9)
  if (dayOfMonth === 1 && [0, 3, 6, 9].includes(month)) {
    jobs.push(runQuarterlyEditionJob);
  }

  // Annual: Run on January 15 (give time to finalize quarterly)
  if (month === 0 && dayOfMonth === 15) {
    jobs.push(runAnnualEditionJob);
  }

  return jobs;
}

/**
 * Run all scheduled edition jobs for today
 */
export async function runScheduledEditionJobs(): Promise<{
  weekly: EditionGenerationResult;
  monthly: EditionGenerationResult;
  quarterly: EditionGenerationResult;
  annual: EditionGenerationResult;
}> {
  const jobs = getScheduledEditionJobs();

  const results = {
    weekly: null as EditionGenerationResult,
    monthly: null as EditionGenerationResult,
    quarterly: null as EditionGenerationResult,
    annual: null as EditionGenerationResult,
  };

  for (const job of jobs) {
    const result = await job();

    // Determine which result slot to fill based on the job
    if (job === runWeeklyEditionJob) results.weekly = result;
    else if (job === runMonthlyEditionJob) results.monthly = result;
    else if (job === runQuarterlyEditionJob) results.quarterly = result;
    else if (job === runAnnualEditionJob) results.annual = result;
  }

  return results;
}

/**
 * Force generate all edition types (for backfilling or testing)
 */
export async function forceGenerateAllEditions(referenceDate: Date = new Date()): Promise<{
  weekly: EditionGenerationResult;
  monthly: EditionGenerationResult;
  quarterly: EditionGenerationResult;
  annual: EditionGenerationResult;
}> {
  console.log("[EditionScheduler] Force generating all editions");

  const [weekly, monthly, quarterly, annual] = await Promise.all([
    generateWeeklyEdition(referenceDate).catch(() => null),
    generateMonthlyEdition(referenceDate).catch(() => null),
    generateQuarterlyEdition(referenceDate).catch(() => null),
    generateAnnualEdition(referenceDate).catch(() => null),
  ]);

  return { weekly, monthly, quarterly, annual };
}
