/**
 * extractDesignerReasoning.ts
 *
 * Analyzes existing designer content to derive reasoning patterns.
 * This is NOT about making AI "sound like" a designer - it's about
 * understanding HOW they actually think and decide.
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

  // From ProjectPost/EditorialDraft
  editorialContent: {
    projectName: string;
    narrative: string;
  }[];

  // From DesignerDecision
  decisions: {
    reasoning: string | null;
    tradeoffs: string | null;
    productName: string | null;
    alternatives: any | null;
    influences: string[];
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
  // Fetch user with brand assets
  const user = await prisma.user.findUnique({
    where: { id: designerId },
    include: {
      designerBrandAssets: true,
    },
  });

  // Fetch projects with product tags
  const projects = await prisma.project.findMany({
    where: { designerId },
    include: {
      productTags: {
        include: {
          product: {
            include: {
              vendor: true,
            },
          },
        },
      },
    },
  });

  // Fetch interview content
  const interviews = await prisma.interviewSession.findMany({
    where: { createdByUserId: designerId, status: "PUBLISHED" },
    include: {
      transcriptSegments: {
        orderBy: { order: "asc" },
      },
      quoteHighlights: {
        where: { approvedByDesigner: true },
      },
    },
  });

  // Fetch editorial answers
  const editorialAnswers = await prisma.editorialInterviewAnswer.findMany({
    where: {
      editorialDraft: {
        project: {
          designerId,
        },
      },
    },
    include: {
      editorialDraft: {
        include: {
          project: true,
        },
      },
    },
  });

  // Fetch designer decisions
  const decisions = await prisma.designerDecision.findMany({
    where: { designerId },
    include: {
      product: true,
    },
  });

  // Transform into extraction format
  const sources: ExtractionSources = {
    bio: user?.bio || null,
    brandTagline: user?.designerBrandAssets?.tagline || null,
    brandAdjectives: user?.designerBrandAssets?.brandAdjectives || [],
    designPhilosophy: user?.designerBrandAssets?.inspirationNotes || null,

    projectSelections: projects.flatMap((p) =>
      p.productTags.map((pt) => ({
        productId: pt.productId,
        productName: pt.product.name,
        vendorName: pt.product.vendor?.name || "Unknown",
        category: pt.product.category || "GENERAL",
        pricePoint: inferPricePoint(pt.product.price),
        material: pt.product.material || null,
      }))
    ),

    interviewContent: interviews.map((i) => ({
      question: i.promptLens || "General interview",
      answer: i.transcriptSegments.map((s) => s.text).join(" "),
      highlightedQuotes: i.quoteHighlights.map((q) => q.quoteText),
    })),

    editorialContent: editorialAnswers
      .filter((ea) => ea.editorialDraft?.project)
      .map((ea) => ({
        projectName: ea.editorialDraft!.project!.title || "Untitled",
        narrative: ea.answerText,
      })),

    decisions: decisions.map((d) => ({
      reasoning: d.reasoning,
      tradeoffs: d.tradeoffs,
      productName: d.product?.name || null,
      alternatives: d.alternatives,
      influences: d.influences || [],
    })),
  };

  return sources;
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

function calculateConfidence(sources: ExtractionSources): number {
  let score = 0;

  if (sources.bio && sources.bio.length > 100) score += 0.2;
  if (sources.projectSelections.length >= 10) score += 0.25;
  if (sources.projectSelections.length >= 30) score += 0.15;
  if (sources.interviewContent.length >= 1) score += 0.25;
  if (sources.editorialContent.length >= 2) score += 0.15;

  return Math.min(score, 1.0);
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
        contentParts.push(
          `On ${decision.productName || "a selection"}: ${decision.reasoning}`
        );
        if (decision.tradeoffs) {
          contentParts.push(`Tradeoffs considered: ${decision.tradeoffs}`);
        }
        if (decision.influences.length > 0) {
          contentParts.push(`Influenced by: ${decision.influences.join(", ")}`);
        }
        contentParts.push("");
      }
    }
  }

  // Add editorial content
  if (sources.editorialContent.length > 0) {
    contentParts.push("## Project Narratives");
    for (const editorial of sources.editorialContent.slice(0, 3)) {
      contentParts.push(`Project: ${editorial.projectName}`);
      contentParts.push(
        editorial.narrative.substring(0, 1500) +
          (editorial.narrative.length > 1500 ? "..." : "")
      );
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

  // Check if we have enough data
  if (
    sources.projectSelections.length < 5 &&
    !sources.bio &&
    sources.interviewContent.length === 0
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
