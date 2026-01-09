import OpenAI from "openai";
import type { EditionCadence } from "@prisma/client";

// [Edition System] AI-generated copy for editions

export type EditionCopyPayload = {
  cadence: EditionCadence;
  periodStart: Date;
  periodEnd: Date;
  contentCount: number;
  topKeywords: string[];
  topCategories: string[];
  averageScore: number;
};

export type EditionCopy = {
  title: string;
  intro: string;
};

const CADENCE_CONTEXT: Record<EditionCadence, string> = {
  WEEKLY: "This week's standout work",
  MONTHLY: "This month's most compelling projects",
  QUARTERLY: "The quarter's defining work",
  ANNUAL: "The year's most exceptional achievements",
};

function formatPeriodLabel(cadence: EditionCadence, periodStart: Date, periodEnd: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = periodStart.getFullYear();
  const month = months[periodStart.getMonth()];
  const quarter = Math.floor(periodStart.getMonth() / 3) + 1;

  switch (cadence) {
    case "WEEKLY": {
      const weekStart = periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const weekEnd = periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `Week of ${weekStart} - ${weekEnd}, ${year}`;
    }
    case "MONTHLY":
      return `${month} ${year}`;
    case "QUARTERLY":
      return `Q${quarter} ${year}`;
    case "ANNUAL":
      return `Best of ${year}`;
  }
}

function buildPrompt(payload: EditionCopyPayload): string {
  const periodLabel = formatPeriodLabel(payload.cadence, payload.periodStart, payload.periodEnd);
  const context = CADENCE_CONTEXT[payload.cadence];

  return `
Generate an editorial title and 80-word introduction for a Folio Edition.

Context: ${context}
Period: ${periodLabel}
Featured content count: ${payload.contentCount}
Themes: ${payload.topKeywords.join(", ") || "diverse aesthetics"}
Categories: ${payload.topCategories.join(", ") || "mixed"}
Overall quality score: ${(payload.averageScore * 100).toFixed(0)}%

Guidelines:
- Title should be evocative and elegant, 3-8 words
- Intro should celebrate the curated work without being promotional
- Maintain Folio's editorial tone: sophisticated, professional, timeless
- Reference specific themes when relevant
- For annual editions, emphasize significance and legacy

Respond with JSON only: {"title": "...", "intro": "..."}
`.trim();
}

export async function generateEditionCopy(payload: EditionCopyPayload): Promise<EditionCopy> {
  const periodLabel = formatPeriodLabel(payload.cadence, payload.periodStart, payload.periodEnd);

  // Fallback copy if no API key
  if (!process.env.OPENAI_API_KEY) {
    return {
      title: periodLabel,
      intro: `A curated selection of ${payload.contentCount} exceptional projects showcasing the finest work from the Folio community.`,
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are Folio's Editorial Director. Write with elegance and authority. Respond with JSON only.",
        },
        {
          role: "user",
          content: buildPrompt(payload),
        },
      ],
      response_format: { type: "json_object" },
    });

    const text = res.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);

    if (typeof parsed?.title === "string" && typeof parsed?.intro === "string") {
      return {
        title: parsed.title.trim(),
        intro: parsed.intro.trim(),
      };
    }
  } catch (error) {
    console.warn("[EditionCopy] AI generation failed:", error);
  }

  // Fallback
  return {
    title: periodLabel,
    intro: `A curated selection of ${payload.contentCount} exceptional projects showcasing the finest work from the Folio community.`,
  };
}

export function generateEditionSlug(cadence: EditionCadence, periodStart: Date): string {
  const year = periodStart.getFullYear();
  const month = (periodStart.getMonth() + 1).toString().padStart(2, "0");
  const quarter = Math.floor(periodStart.getMonth() / 3) + 1;

  // Get ISO week number
  const date = new Date(periodStart);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  switch (cadence) {
    case "WEEKLY":
      return `weekly-${year}-w${weekNumber.toString().padStart(2, "0")}`;
    case "MONTHLY":
      return `monthly-${year}-${month}`;
    case "QUARTERLY":
      return `quarterly-${year}-q${quarter}`;
    case "ANNUAL":
      return `annual-${year}`;
  }
}

export function getBadgeLabel(cadence: EditionCadence, periodStart: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = periodStart.getFullYear();
  const month = months[periodStart.getMonth()];
  const quarter = Math.floor(periodStart.getMonth() / 3) + 1;

  switch (cadence) {
    case "WEEKLY":
      return `Week ${getISOWeek(periodStart)}, ${year}`;
    case "MONTHLY":
      return `${month} ${year}`;
    case "QUARTERLY":
      return `Q${quarter} ${year}`;
    case "ANNUAL":
      return `Best of ${year}`;
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
