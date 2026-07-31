import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { logPassiveEvent } from "../analytics";
import {
  EDITORIAL_CURATOR_CONSTANTS,
  EDITORIAL_CURATOR_THRESHOLDS,
  EDITORIAL_SCHEDULER_PROMPT,
} from "./constants";
import { MODELS } from '@/lib/ai/models';

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      title: `${payload.categoryLabels[0] ?? "Folio"} Edition`,
      intro:
        "An automated curation spotlighting projects that share a resonant aesthetic signature across the current Folio catalog.",
    };
  }

  const client = new Anthropic();
  const prompt = fillSchedulerPrompt(payload);

  try {
    const res = await client.messages.create({
      model: MODELS.sonnet,
      thinking: { type: 'disabled' },
      max_tokens: 320,
      system: "You are Folio's Editorial Edition curator. Maintain an elegant, professional, timeless tone. Respond with JSON only.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const rawText = res.content[0]?.type === "text" ? res.content[0].text : "{}";
    const payloadText = rawText.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(payloadText);
    if (typeof parsed?.title === "string" && typeof parsed?.intro === "string") {
      return {
        title: parsed.title.trim(),
        intro: parsed.intro.trim(),
      };
    }
  } catch (error) {
    console.warn("[EditorialScheduler] Anthropic generation failed:", error);
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


