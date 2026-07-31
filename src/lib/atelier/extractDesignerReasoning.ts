/**
 * extractDesignerReasoning.ts
 *
 * Analyzes existing designer content to derive reasoning patterns.
 * This is NOT about making AI "sound like" a designer - it's about
 * understanding HOW they actually think and decide.
 *
 * The interview is the primary source. Every answer arrives anchored to the
 * question that produced it, the room it was about, and — where the question was
 * generated from a tag — the product in the photo. That anchoring is what makes
 * a profile comparable to other designers' profiles later: two people answering
 * the same question CATEGORY about the same kind of room is a comparison; two
 * people's free prose is not.
 *
 * Every query in here was broken. `gatherExtractionSources` referenced four
 * relations that do not exist (`designerBrandAssets`, `Project.productTags`,
 * `InterviewSession.transcriptSegments`, `EditorialInterviewAnswer.editorialDraft`)
 * plus a `Product.material` column that was never in the schema, so the first
 * call threw PrismaClientValidationError and no reasoning profile has ever been
 * built from real data. The type errors were real but invisible inside the
 * repo's pre-existing backlog, and the phase5e CI check only looks for phantom
 * MODELS, not phantom relations on real ones.
 */

import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from '@/lib/ai/models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractionSources {
  // From User/DesignerBrandAssets
  bio: string | null;
  brandTagline: string | null;
  brandAdjectives: string[];
  designPhilosophy: string | null;

  // From Projects + ProductTags
  projectSelections: {
    productId: string;
    productName: string;
    vendorName: string;
    category: string;
    pricePoint: string;
    material: string | null;
  }[];

  // From InterviewSession + TranscriptSegment + QuoteHighlight
  interviewContent: {
    question: string;
    answer: string;
    highlightedQuotes: string[];
  }[];

  /**
   * From EditorialInterviewAnswer — the project interview, one entry per answer.
   *
   * Question-anchored on purpose. `category` is the cross-designer axis: the
   * five project-level questions carry a stable taxonomy in their id
   * (`project-<CATEGORY>-<uuid>`), so the same category can be compared across
   * designers and projects. Room questions have no such key yet, which is why
   * `category` is nullable — see tasks/todo.md.
   */
  editorialContent: {
    projectId: string;
    projectName: string;
    question: string | null;
    answer: string;
    /** Stable cross-project question key, when the question has one. */
    category: string | null;
    roomName: string | null;
    isFollowUp: boolean;
    /** e.g. "material:travertine" — what the question was testing. */
    attribute: string | null;
    linkedProductId: string | null;
  }[];

  /**
   * From DesignerDecision — a logged choice with its reasoning.
   *
   * This model carries the only outcome-adjacent signal in the schema
   * (`clientReaction`, `outcomeNotes`) and the only explicit marker of whose
   * decision it was (`isClientDriven`). Both are designer-reported rather than
   * observed, so they're evidence rather than ground truth — but "which of this
   * designer's calls were theirs, and how did they land" is the question a
   * client-matching model would eventually need to answer, so it is carried
   * through rather than dropped.
   */
  decisions: {
    reasoning: string | null;
    tradeoffs: string | null;
    /** What was chosen. `DesignerDecision.choice`, not a Product relation. */
    choice: string | null;
    decisionType: string | null;
    roomType: string | null;
    alternatives: any | null;
    influences: string[];
    isClientDriven: boolean;
    clientContext: string | null;
    convictionLevel: number | null;
    clientReaction: string | null;
    outcomeNotes: string | null;
  }[];
}

export interface DesignerReasoningOutput {
  statedApproach: string | null;
  statedValues: string[];
  materialTendencies: Record<string, number>;
  pricePointPattern:
    | "investment_focused"
    | "value_conscious"
    | "balanced"
    | "context_dependent";
  vendorAffinities: { vendorId: string; vendorName: string; frequency: number }[];
  decisionPatterns: string[];
  tradeoffExamples: { context: string; reasoning: string }[];
  quotesOnApproach: string[];
  explanationExamples: { topic: string; explanation: string }[];
  confidenceScore: number;
  dataSourcesUsed: string[];
}

// ---------------------------------------------------------------------------
// Source Gathering
// ---------------------------------------------------------------------------

/**
 * Gather all available sources for a designer
 */
export async function gatherExtractionSources(
  designerId: string
): Promise<ExtractionSources> {
  const user = await prisma.user.findUnique({
    where: { id: designerId },
    include: { brandAssets: true },
  });

  // Products come from two places and they overlap: a Selection is the spec'd
  // item (and the only place finish/material language is written down), a
  // ProductTag is the pin on the photo pointing at a catalog product. A
  // Selection created from a tag carries that tag's id, which is how the two are
  // reconciled below — counting both would skew every tendency this file
  // computes.
  const projects = await prisma.project.findMany({
    where: { designerId },
    select: {
      id: true,
      title: true,
      rooms: { select: { id: true, name: true, type: true } },
      selections: {
        select: {
          productName: true,
          vendorName: true,
          colorFinish: true,
          unitPrice: true,
          productTagId: true,
          room: { select: { name: true, type: true } },
        },
      },
      images: {
        select: {
          tags: {
            select: {
              id: true,
              productId: true,
              product: {
                select: {
                  name: true,
                  price: true,
                  category: true,
                  vendor: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const interviews = await prisma.interviewSession.findMany({
    where: { createdByUserId: designerId, status: "PUBLISHED" },
    include: {
      TranscriptSegment: { orderBy: { order: "asc" } },
      QuoteHighlight: { where: { approvedByDesigner: true } },
    },
  });

  // The project interview. Ordered oldest-first so the profile reflects how the
  // designer has talked over time rather than whatever the database returns.
  const editorialAnswers = await prisma.editorialInterviewAnswer.findMany({
    where: { interview: { project: { designerId } } },
    select: {
      questionId: true,
      questionText: true,
      answerText: true,
      isFollowUp: true,
      roomId: true,
      aiClassificationAttribute: true,
      linkedProductId: true,
      interview: { select: { project: { select: { id: true, title: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // No `product` relation on this model — the chosen thing is the `choice`
  // string, with productTagId/selectionId as optional pointers.
  const decisions = await prisma.designerDecision.findMany({
    where: { designerId },
    orderBy: { createdAt: "desc" },
  });

  // roomId → room name, across every project this designer owns.
  const roomNameById = new Map<string, string>();
  for (const p of projects) {
    for (const r of p.rooms) roomNameById.set(r.id, r.name);
  }

  // Tags already represented by a Selection — skip them on the tag pass.
  const tagIdsWithSelection = new Set<string>();
  for (const p of projects) {
    for (const s of p.selections) {
      if (s.productTagId) tagIdsWithSelection.add(s.productTagId);
    }
  }

  const projectSelections: ExtractionSources["projectSelections"] = [];
  for (const p of projects) {
    for (const s of p.selections) {
      if (!s.productName && !s.vendorName) continue;
      projectSelections.push({
        productId: s.productTagId || "",
        productName: s.productName || "Unnamed selection",
        vendorName: s.vendorName || "Unknown",
        category: s.room?.type || "GENERAL",
        pricePoint: inferPricePoint(s.unitPrice === null ? null : Number(s.unitPrice)),
        // colorFinish is where the material actually lives ("Honed Carrara",
        // "unlacquered brass"). There is no Product.material column — reading one
        // is what threw here before, and inferring material from a product blurb
        // would manufacture tendencies that were never stated.
        material: s.colorFinish || null,
      });
    }
    for (const img of p.images) {
      for (const tag of img.tags) {
        if (tagIdsWithSelection.has(tag.id)) continue;
        projectSelections.push({
          productId: tag.productId,
          productName: tag.product.name,
          vendorName: tag.product.vendor?.name || "Unknown",
          category: tag.product.category || "GENERAL",
          pricePoint: inferPricePoint(tag.product.price),
          material: null,
        });
      }
    }
  }

  const sources: ExtractionSources = {
    bio: user?.bio || null,
    brandTagline: user?.brandAssets?.tagline || null,
    brandAdjectives: user?.brandAssets?.brandAdjectives || [],
    designPhilosophy: user?.brandAssets?.inspirationNotes || null,

    projectSelections,

    interviewContent: interviews.map((i) => ({
      question: i.promptLens || "General interview",
      answer: i.TranscriptSegment.map((s) => s.text).join(" "),
      highlightedQuotes: i.QuoteHighlight.map((q) => q.quoteText),
    })),

    editorialContent: editorialAnswers
      .filter((ea) => ea.interview?.project && ea.answerText.trim())
      .map((ea) => ({
        projectId: ea.interview!.project!.id,
        projectName: ea.interview!.project!.title || "Untitled",
        question: ea.questionText,
        answer: ea.answerText,
        category: questionCategory(ea.questionId),
        roomName: ea.roomId ? roomNameById.get(ea.roomId) ?? null : null,
        isFollowUp: ea.isFollowUp,
        attribute: ea.aiClassificationAttribute,
        linkedProductId: ea.linkedProductId,
      })),

    decisions: decisions.map((d) => ({
      reasoning: d.reasoning,
      tradeoffs: d.tradeoffs,
      choice: d.choice || null,
      decisionType: d.decisionType || null,
      roomType: d.roomType || null,
      alternatives: d.alternatives,
      influences: d.influences || [],
      isClientDriven: d.isClientDriven,
      clientContext: d.clientContext,
      convictionLevel: d.convictionLevel,
      clientReaction: d.clientReaction,
      outcomeNotes: d.outcomeNotes,
    })),
  };

  return sources;
}

/**
 * The stable cross-project key a question carries, if it has one.
 *
 * Project-level questions are minted as `project-<CATEGORY>-<uuid>` over a fixed
 * five-category taxonomy, so CATEGORY identifies the same question across every
 * designer and project. Room-level questions are minted as a bare uuid and have
 * no such key — they return null rather than a guess.
 */
function questionCategory(questionId: string): string | null {
  const match = questionId.match(/^project-([A-Z_]+)-/);
  return match ? match[1] : null;
}

function inferPricePoint(price: number | null): string {
  if (!price) return "unknown";
  if (price >= 5000) return "luxury";
  if (price >= 1000) return "premium";
  if (price >= 300) return "mid-range";
  return "value";
}

// ---------------------------------------------------------------------------
// Extraction Logic
// ---------------------------------------------------------------------------

/**
 * Main extraction function - analyzes sources and derives reasoning profile
 */
export async function extractDesignerReasoning(
  sources: ExtractionSources
): Promise<DesignerReasoningOutput> {
  const dataSourcesUsed: string[] = [];

  // 1. Extract stated approach and values from bio/brand
  let statedApproach: string | null = null;
  let statedValues: string[] = [];

  if (sources.bio || sources.designPhilosophy) {
    dataSourcesUsed.push("bio");
    statedApproach = sources.bio || sources.designPhilosophy;
  }

  if (sources.brandAdjectives.length > 0) {
    dataSourcesUsed.push("brand");
    statedValues = sources.brandAdjectives;
  }

  // 2. Analyze material tendencies from project selections
  const materialTendencies = analyzeMaterialTendencies(sources.projectSelections);
  if (Object.keys(materialTendencies).length > 0) {
    dataSourcesUsed.push("projects");
  }

  // 3. Determine price point pattern
  const pricePointPattern = analyzePricePattern(sources.projectSelections);

  // 4. Calculate vendor affinities
  const vendorAffinities = analyzeVendorAffinities(sources.projectSelections);

  // 5. Extract decision patterns and tradeoffs from decisions and interviews
  let decisionPatterns: string[] = [];
  let tradeoffExamples: { context: string; reasoning: string }[] = [];
  let quotesOnApproach: string[] = [];
  let explanationExamples: { topic: string; explanation: string }[] = [];

  // Use LLM to analyze interview and decision content if available
  if (
    sources.interviewContent.length > 0 ||
    sources.decisions.length > 0 ||
    sources.editorialContent.length > 0
  ) {
    const llmAnalysis = await analyzeContentWithLLM(sources);

    if (sources.interviewContent.length > 0) {
      dataSourcesUsed.push("interviews");
    }

    if (sources.editorialContent.length > 0) {
      dataSourcesUsed.push("editorial");
    }

    if (sources.decisions.length > 0) {
      dataSourcesUsed.push("decisions");
    }

    decisionPatterns = llmAnalysis.decisionPatterns;
    tradeoffExamples = llmAnalysis.tradeoffExamples;
    quotesOnApproach = llmAnalysis.quotesOnApproach;
    explanationExamples = llmAnalysis.explanationExamples;
  }

  // 6. Calculate confidence score
  const confidenceScore = calculateConfidence(sources);

  return {
    statedApproach,
    statedValues,
    materialTendencies,
    pricePointPattern,
    vendorAffinities,
    decisionPatterns,
    tradeoffExamples,
    quotesOnApproach,
    explanationExamples,
    confidenceScore,
    dataSourcesUsed,
  };
}

// ---------------------------------------------------------------------------
// Analysis Helpers
// ---------------------------------------------------------------------------

function analyzeMaterialTendencies(
  selections: ExtractionSources["projectSelections"]
): Record<string, number> {
  const materialCounts: Record<string, number> = {};
  let total = 0;

  for (const selection of selections) {
    if (selection.material) {
      const normalizedMaterial = normalizeMaterial(selection.material);
      materialCounts[normalizedMaterial] =
        (materialCounts[normalizedMaterial] || 0) + 1;
      total++;
    }
  }

  // Convert to percentages
  const tendencies: Record<string, number> = {};
  for (const [material, count] of Object.entries(materialCounts)) {
    tendencies[material] = Math.round((count / total) * 100) / 100;
  }

  return tendencies;
}

function normalizeMaterial(material: string): string {
  const normalized = material.toLowerCase().trim();

  // Group similar materials
  if (normalized.includes("marble") || normalized.includes("stone"))
    return "natural_stone";
  if (normalized.includes("quartz") || normalized.includes("engineered"))
    return "engineered_stone";
  if (normalized.includes("wood") || normalized.includes("oak"))
    return "wood";
  if (normalized.includes("brass") || normalized.includes("bronze"))
    return "brass_bronze";
  if (normalized.includes("ceramic") || normalized.includes("porcelain"))
    return "ceramic_porcelain";
  if (normalized.includes("glass")) return "glass";
  if (normalized.includes("fabric") || normalized.includes("textile"))
    return "textile";
  if (normalized.includes("leather")) return "leather";

  return normalized;
}

function analyzePricePattern(
  selections: ExtractionSources["projectSelections"]
): DesignerReasoningOutput["pricePointPattern"] {
  if (selections.length === 0) return "context_dependent";

  const priceCounts = {
    luxury: 0,
    premium: 0,
    "mid-range": 0,
    value: 0,
    unknown: 0,
  };

  for (const selection of selections) {
    priceCounts[selection.pricePoint as keyof typeof priceCounts]++;
  }

  const total = selections.length;
  const luxuryPremiumRatio = (priceCounts.luxury + priceCounts.premium) / total;
  const valueRatio = (priceCounts.value + priceCounts["mid-range"]) / total;

  if (luxuryPremiumRatio > 0.7) return "investment_focused";
  if (valueRatio > 0.6) return "value_conscious";
  if (Math.abs(luxuryPremiumRatio - valueRatio) < 0.2) return "balanced";

  return "context_dependent";
}

function analyzeVendorAffinities(
  selections: ExtractionSources["projectSelections"]
): DesignerReasoningOutput["vendorAffinities"] {
  const vendorCounts: Record<string, { name: string; count: number }> = {};

  for (const selection of selections) {
    const key = selection.vendorName;
    if (!vendorCounts[key]) {
      vendorCounts[key] = { name: selection.vendorName, count: 0 };
    }
    vendorCounts[key].count++;
  }

  return Object.entries(vendorCounts)
    .map(([vendorId, data]) => ({
      vendorId,
      vendorName: data.name,
      frequency: data.count,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

/**
 * How much the profile is standing on. Counted in PROJECTS interviewed, not
 * answers: forty answers about one house says a lot about one house and very
 * little about how this designer works in general, and the distinction matters
 * as soon as these profiles are compared to each other.
 */
function calculateConfidence(sources: ExtractionSources): number {
  let score = 0;

  const projectsInterviewed = new Set(
    sources.editorialContent.map((e) => e.projectId)
  ).size;

  if (sources.bio && sources.bio.length > 100) score += 0.15;
  if (sources.projectSelections.length >= 10) score += 0.2;
  if (sources.projectSelections.length >= 30) score += 0.1;
  if (sources.interviewContent.length >= 1) score += 0.15;
  if (projectsInterviewed >= 1) score += 0.15;
  if (projectsInterviewed >= 3) score += 0.15;
  if (sources.decisions.length >= 10) score += 0.1;

  return Math.min(score, 1.0);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.substring(0, max)}...` : text;
}

// ---------------------------------------------------------------------------
// LLM Analysis
// ---------------------------------------------------------------------------

const INTERVIEW_ANALYSIS_PROMPT = `
Analyze this designer's content to understand their design approach.

DO NOT invent or embellish. Only extract what's actually present.
If something isn't clear from the content, omit it.

Content to analyze:
{content}

Extract the following (return as JSON):

1. "decisionPatterns": string[]
   How do they describe making design decisions? What's their process?
   Include specific patterns you observe (e.g., "starts with how the space will be used", "considers light quality first")

2. "tradeoffExamples": { context: string, reasoning: string }[]
   When they discuss choosing between options, how do they frame it?
   Include specific examples with context. Max 5.

3. "quotesOnApproach": string[]
   Direct quotes (verbatim) that capture their design philosophy.
   These should be usable as examples of how they think. Max 5.

4. "explanationExamples": { topic: string, explanation: string }[]
   Examples of how they explain design choices or materials.
   Max 3.

If any category has no clear examples, return an empty array for it.
Only include what is genuinely evident from the content.

Return ONLY valid JSON, no other text.
`;

interface LLMAnalysisResult {
  decisionPatterns: string[];
  tradeoffExamples: { context: string; reasoning: string }[];
  quotesOnApproach: string[];
  explanationExamples: { topic: string; explanation: string }[];
}

async function analyzeContentWithLLM(
  sources: ExtractionSources
): Promise<LLMAnalysisResult> {
  const contentParts: string[] = [];

  // Add interview content
  if (sources.interviewContent.length > 0) {
    contentParts.push("## Interview Content");
    for (const interview of sources.interviewContent.slice(0, 3)) {
      contentParts.push(`Q: ${interview.question}`);
      contentParts.push(
        `A: ${interview.answer.substring(0, 2000)}${interview.answer.length > 2000 ? "..." : ""}`
      );
      if (interview.highlightedQuotes.length > 0) {
        contentParts.push(
          `Highlighted quotes: ${interview.highlightedQuotes.join("; ")}`
        );
      }
      contentParts.push("");
    }
  }

  // Add decision content
  if (sources.decisions.length > 0) {
    contentParts.push("## Design Decisions");
    for (const decision of sources.decisions.slice(0, 10)) {
      if (decision.reasoning) {
        const where = [decision.roomType, decision.decisionType]
          .filter(Boolean)
          .join(" · ");
        contentParts.push(
          `On ${decision.choice || "a selection"}${where ? ` [${where}]` : ""}: ${decision.reasoning}`
        );
        if (decision.tradeoffs) {
          contentParts.push(`Tradeoffs considered: ${decision.tradeoffs}`);
        }
        if (decision.influences.length > 0) {
          contentParts.push(`Influenced by: ${decision.influences.join(", ")}`);
        }
        // Whose call it was, and how it landed. Both matter for reading a
        // pattern: a choice the client pushed for is weak evidence about the
        // designer, and one they'd defend again is strong evidence.
        if (decision.isClientDriven) {
          contentParts.push(
            `Client-driven${decision.clientContext ? `: ${decision.clientContext}` : ""}`
          );
        }
        if (decision.clientReaction) {
          contentParts.push(`Client reaction: ${decision.clientReaction}`);
        }
        if (decision.outcomeNotes) {
          contentParts.push(`Outcome: ${decision.outcomeNotes}`);
        }
        contentParts.push("");
      }
    }
  }

  // Add the project interview, grouped by project and presented as Q → A.
  //
  // This used to pass the answer text alone, labelled "Project Narratives",
  // which asked the model to infer a designer's reasoning from prose with no
  // idea what had been asked. An answer only means something next to its
  // question: "we used the same stone everywhere" reads as a budget decision or
  // a continuity decision depending entirely on the prompt.
  if (sources.editorialContent.length > 0) {
    const byProject = new Map<string, ExtractionSources["editorialContent"]>();
    for (const entry of sources.editorialContent) {
      const list = byProject.get(entry.projectId);
      if (list) list.push(entry);
      else byProject.set(entry.projectId, [entry]);
    }

    contentParts.push("## Project Interviews");
    for (const entries of Array.from(byProject.values()).slice(0, 4)) {
      contentParts.push(`Project: ${entries[0].projectName}`);
      for (const e of entries.slice(0, 20)) {
        const context = [e.roomName, e.attribute].filter(Boolean).join(" · ");
        contentParts.push(
          `Q${e.isFollowUp ? " (follow-up)" : ""}${context ? ` [${context}]` : ""}: ${
            e.question || "(question text not recorded)"
          }`
        );
        contentParts.push(`A: ${truncate(e.answer, 1200)}`);
      }
      contentParts.push("");
    }
  }

  // If no content, return empty
  if (contentParts.length === 0) {
    return {
      decisionPatterns: [],
      tradeoffExamples: [],
      quotesOnApproach: [],
      explanationExamples: [],
    };
  }

  const prompt = INTERVIEW_ANALYSIS_PROMPT.replace(
    "{content}",
    contentParts.join("\n")
  );

  try {
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      thinking: { type: 'disabled' },
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as LLMAnalysisResult;
      return {
        decisionPatterns: parsed.decisionPatterns || [],
        tradeoffExamples: parsed.tradeoffExamples || [],
        quotesOnApproach: parsed.quotesOnApproach || [],
        explanationExamples: parsed.explanationExamples || [],
      };
    }
  } catch (error) {
    console.error("Error analyzing content with LLM:", error);
  }

  return {
    decisionPatterns: [],
    tradeoffExamples: [],
    quotesOnApproach: [],
    explanationExamples: [],
  };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Extract and persist reasoning profile for a designer
 */
export async function populateDesignerReasoning(
  designerId: string
): Promise<void> {
  console.log(`Extracting reasoning profile for designer: ${designerId}`);

  // Gather all sources
  const sources = await gatherExtractionSources(designerId);

  // Check if we have enough data. The project interview counts here — it is the
  // richest source we have, and excluding it meant a designer who had answered
  // an entire interview but tagged fewer than five products was skipped.
  if (
    sources.projectSelections.length < 5 &&
    !sources.bio &&
    sources.interviewContent.length === 0 &&
    sources.editorialContent.length === 0
  ) {
    console.log(`Skipping ${designerId}: insufficient data`);
    return;
  }

  // Run extraction
  const reasoning = await extractDesignerReasoning(sources);

  // Persist
  await prisma.designerReasoningProfile.upsert({
    where: { userId: designerId },
    create: {
      userId: designerId,
      statedApproach: reasoning.statedApproach,
      statedValues: reasoning.statedValues,
      materialTendencies: reasoning.materialTendencies,
      pricePointPattern: reasoning.pricePointPattern,
      vendorAffinities: reasoning.vendorAffinities,
      decisionPatterns: reasoning.decisionPatterns,
      tradeoffExamples: reasoning.tradeoffExamples,
      quotesOnApproach: reasoning.quotesOnApproach,
      explanationExamples: reasoning.explanationExamples,
      confidenceScore: reasoning.confidenceScore,
      dataSourcesUsed: reasoning.dataSourcesUsed,
      lastComputedAt: new Date(),
    },
    update: {
      statedApproach: reasoning.statedApproach,
      statedValues: reasoning.statedValues,
      materialTendencies: reasoning.materialTendencies,
      pricePointPattern: reasoning.pricePointPattern,
      vendorAffinities: reasoning.vendorAffinities,
      decisionPatterns: reasoning.decisionPatterns,
      tradeoffExamples: reasoning.tradeoffExamples,
      quotesOnApproach: reasoning.quotesOnApproach,
      explanationExamples: reasoning.explanationExamples,
      confidenceScore: reasoning.confidenceScore,
      dataSourcesUsed: reasoning.dataSourcesUsed,
      lastComputedAt: new Date(),
    },
  });

  console.log(
    `Completed reasoning profile for ${designerId} (confidence: ${reasoning.confidenceScore})`
  );
}

/**
 * Populate reasoning profiles for all designers
 */
export async function populateAllDesignerReasoning(): Promise<void> {
  const designers = await prisma.user.findMany({
    where: { role: "DESIGNER" },
    select: { id: true },
  });

  console.log(`Processing ${designers.length} designers...`);

  for (const designer of designers) {
    try {
      await populateDesignerReasoning(designer.id);
    } catch (error) {
      console.error(`Error processing designer ${designer.id}:`, error);
    }
  }

  console.log("Completed all designer reasoning profiles");
}
