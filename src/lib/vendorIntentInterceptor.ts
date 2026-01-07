// lib/vendorIntentInterceptor.ts

export type IntentCategory =
  | "EVENT_ANALYSIS"
  | "DESIGNER_ANALYSIS"
  | "PRODUCT_ANALYSIS"
  | "PIPELINE_INFLUENCE"
  | "RELATIONSHIP_BUILDING"
  | "EDUCATION_GAP"
  | "SEGMENTATION"
  | "STRATEGY_PLANNING"
  | "RESTRICTED_REQUEST"
  | "STRESS_TEST"
  | "OPEN_ENDED";

export type LikelyGoal =
  | "improve_retention"
  | "increase_visibility"
  | "increase_conversion"
  | "strengthen_relationships"
  | "plan_next_event"
  | "understand_performance"
  | "fix_problem"
  | "grow_business"
  | "unsure";

export interface IntentClassification {
  intent: IntentCategory;
  likelyGoal: LikelyGoal;
  reasons: string[];
  matchedKeywords: string[];
}

/**
 * Normalize text to lower-case, trimmed.
 */
function normalize(text: string): string {
  return text.toLowerCase().trim();
}

const EVENT_KEYWORDS = [
  "event",
  "booth",
  "trade show",
  "fair",
  "festival",
  "rsvp",
  "check-in",
  "design week",
  "nycxdesign",
  "icff",
  "miami",
];

const DESIGNER_KEYWORDS = [
  "designer",
  "firm",
  "client",
  "architect",
  "studio",
  "which designers",
  "which clients",
  "who should i invite",
  "who should i reach out",
];

const PRODUCT_KEYWORDS = [
  "product",
  "sku",
  "collection",
  "line",
  "launch",
  "slab",
  "tile",
  "finish",
  "color",
  "stone",
  "surface",
];

const PIPELINE_KEYWORDS = [
  "pipeline",
  "influence",
  "influenced",
  "budget",
  "project value",
  "conversion",
  "roi",
  "return",
];

const RELATIONSHIP_KEYWORDS = [
  "thank",
  "appreciate",
  "relationship",
  "dinner",
  "lunch",
  "cocktail",
  "invite",
  "who should i invite",
  "who should i thank",
  "who are my best clients",
  "who are my top clients",
];

const EDUCATION_KEYWORDS = [
  "educate",
  "education",
  "teach",
  "training",
  "pk session",
  "lunch and learn",
  "lunch & learn",
  "why don't they understand",
  "why dont they understand",
  "confused",
  "don't understand",
  "dont understand",
];

const SEGMENTATION_KEYWORDS = [
  "segment",
  "group",
  "cohort",
  "audience",
  "which designers",
  "who should i focus",
];

const STRATEGY_KEYWORDS = [
  "strategy",
  "plan",
  "roadmap",
  "what should i do",
  "what should my next",
  "how do i grow",
  "how do i increase",
  "how do i improve",
  "how do i double",
  "fix my",
  "what's my next move",
  "whats my next move",
  "next quarter",
];

const RESTRICTED_PHRASES = [
  "who isn't buying from me",
  "who isnt buying from me",
  "who is not buying from me",
  "who prefers my competitor",
  "who prefers competitors",
  "who prefers someone else",
  "who hates my product",
  "who hates my stuff",
  "why do designers hate my",
  "who buys from",
  "who is buying from",
];

const STRESS_TEST_PHRASES = [
  "are you stupid",
  "are you dumb",
  "you are useless",
  "prove you are smart",
  "tell me something magic",
  "just fix it",
  "fix my business",
  "double my sales",
  "triple my sales",
];

const NEGATIVE_PERFORMANCE_PHRASES = [
  "worst clients",
  "worst designers",
  "worst accounts",
  "not buying",
  "isn't buying",
  "isnt buying",
  "not specifying",
  "no longer specifying",
  "stopped specifying",
  "why don't they buy",
  "why dont they buy",
  "why are they not buying",
  "churn",
  "lost account",
  "losing accounts",
  "losing clients",
  "low engagement",
  "declining engagement",
];

const RETENTION_WORDS = [
  "retention",
  "keep them",
  "keep clients",
  "keep designers",
  "keep working with",
  "stay with us",
  "stay engaged",
];

const NEXT_EVENT_PHRASES = [
  "what should my next event be",
  "what should our next event be",
  "next event",
  "who should i invite to my next event",
];

/**
 * Simple helper to test if the question contains any of these phrases.
 */
function containsAny(question: string, phrases: string[]): string[] {
  const hits: string[] = [];
  for (const p of phrases) {
    if (question.includes(p)) hits.push(p);
  }
  return hits;
}

/**
 * Classify vendor question into an IntentCategory and LikelyGoal.
 */
export function classifyVendorQuestion(
  questionRaw: string
): IntentClassification {
  const q = normalize(questionRaw);

  const matchedKeywords: string[] = [];
  const reasons: string[] = [];

  // Signals for negative performance, retention, etc.
  const negativeHits = containsAny(q, NEGATIVE_PERFORMANCE_PHRASES);
  const retentionHits = containsAny(q, RETENTION_WORDS);
  const nextEventHits = containsAny(q, NEXT_EVENT_PHRASES);

  // 1) Hard checks for RESTRICTED and STRESS_TEST first.
  const restrictedHits = containsAny(q, RESTRICTED_PHRASES);
  if (restrictedHits.length > 0) {
    return {
      intent: "RESTRICTED_REQUEST",
      likelyGoal:
        negativeHits.length > 0 || retentionHits.length > 0
          ? "improve_retention"
          : "increase_conversion",
      reasons: [
        "Question includes phrases that imply competitor or purchase-disclosure requests.",
        `Matched restricted phrases: ${restrictedHits.join(", ")}`,
      ],
      matchedKeywords: restrictedHits,
    };
  }

  const stressHits = containsAny(q, STRESS_TEST_PHRASES);
  if (stressHits.length > 0) {
    return {
      intent: "STRESS_TEST",
      likelyGoal: "fix_problem",
      reasons: [
        "Question appears adversarial, unrealistic, or framed as a challenge to the AI.",
        `Matched stress-test phrases: ${stressHits.join(", ")}`,
      ],
      matchedKeywords: stressHits,
    };
  }

  // 2) Detect core topical intents.
  const eventHits = containsAny(q, EVENT_KEYWORDS);
  const designerHits = containsAny(q, DESIGNER_KEYWORDS);
  const productHits = containsAny(q, PRODUCT_KEYWORDS);
  const pipelineHits = containsAny(q, PIPELINE_KEYWORDS);
  const relationshipHits = containsAny(q, RELATIONSHIP_KEYWORDS);
  const educationHits = containsAny(q, EDUCATION_KEYWORDS);
  const segmentationHits = containsAny(q, SEGMENTATION_KEYWORDS);
  const strategyHits = containsAny(q, STRATEGY_KEYWORDS);

  matchedKeywords.push(
    ...eventHits,
    ...designerHits,
    ...productHits,
    ...pipelineHits,
    ...relationshipHits,
    ...educationHits,
    ...segmentationHits,
    ...strategyHits,
    ...negativeHits,
    ...retentionHits,
    ...nextEventHits
  );

  // Helper: decide likelyGoal based on context.
  const hasNegative = negativeHits.length > 0 || retentionHits.length > 0;

  // 3) Relationship: invites, appreciation, dinners, etc.
  if (relationshipHits.length > 0) {
    reasons.push(
      "Question refers to invites, appreciation, or relationship-oriented phrases."
    );
    const likelyGoal: LikelyGoal = hasNegative
      ? "improve_retention"
      : "strengthen_relationships";

    // If clearly about "next event", shift towards planning.
    if (nextEventHits.length > 0) {
      return {
        intent: "RELATIONSHIP_BUILDING",
        likelyGoal: "plan_next_event",
        reasons: [
          ...reasons,
          "Question explicitly references the next event.",
        ],
        matchedKeywords,
      };
    }

    return {
      intent: "RELATIONSHIP_BUILDING",
      likelyGoal,
      reasons,
      matchedKeywords,
    };
  }

  // 4) Education gap: PK sessions, confusion, "why don't they understand".
  if (educationHits.length > 0) {
    reasons.push(
      "Question mentions education, training, PK sessions, or knowledge gaps."
    );
    return {
      intent: "EDUCATION_GAP",
      likelyGoal: hasNegative ? "increase_conversion" : "understand_performance",
      reasons,
      matchedKeywords,
    };
  }

  // 5) Event analysis.
  if (eventHits.length > 0) {
    reasons.push("Question mentions events, booths, design weeks, or RSVPs.");
    const likelyGoal: LikelyGoal = nextEventHits.length > 0
      ? "plan_next_event"
      : "increase_visibility";

    return {
      intent: "EVENT_ANALYSIS",
      likelyGoal,
      reasons,
      matchedKeywords,
    };
  }

  // 6) Designer analysis vs segmentation.
  if (designerHits.length > 0) {
    if (segmentationHits.length > 0) {
      reasons.push(
        "Question asks which designers to group, segment, or focus on."
      );
      return {
        intent: "SEGMENTATION",
        likelyGoal: hasNegative
          ? "improve_retention"
          : "understand_performance",
        reasons,
        matchedKeywords,
      };
    }

    reasons.push("Question explicitly references designers, firms, or clients.");
    return {
      intent: "DESIGNER_ANALYSIS",
      likelyGoal: hasNegative
        ? "improve_retention"
        : "understand_performance",
      reasons,
      matchedKeywords,
    };
  }

  // 7) Product analysis.
  if (productHits.length > 0) {
    reasons.push("Question references products, SKUs, collections, or lines.");
    return {
      intent: "PRODUCT_ANALYSIS",
      likelyGoal: hasNegative ? "increase_conversion" : "understand_performance",
      reasons,
      matchedKeywords,
    };
  }

  // 8) Pipeline / influence.
  if (pipelineHits.length > 0) {
    reasons.push("Question mentions pipeline, ROI, budgets, or influence.");
    return {
      intent: "PIPELINE_INFLUENCE",
      likelyGoal: hasNegative
        ? "increase_conversion"
        : "understand_performance",
      reasons,
      matchedKeywords,
    };
  }

  // 9) Segmentation (without explicit designer keywords).
  if (segmentationHits.length > 0) {
    reasons.push("Question references segments, cohorts, or audiences.");
    return {
      intent: "SEGMENTATION",
      likelyGoal: hasNegative
        ? "improve_retention"
        : "understand_performance",
      reasons,
      matchedKeywords,
    };
  }

  // 10) Strategy planning.
  if (strategyHits.length > 0) {
    reasons.push(
      "Question uses strategy, roadmap, growth, or 'what should I do next' phrasing."
    );
    const likelyGoal: LikelyGoal = hasNegative ? "fix_problem" : "grow_business";

    return {
      intent: "STRATEGY_PLANNING",
      likelyGoal,
      reasons,
      matchedKeywords,
    };
  }

  // 11) Fallback: OPEN_ENDED.
  reasons.push(
    "Question did not strongly match any specific topical intent; treating as OPEN_ENDED."
  );
  return {
    intent: "OPEN_ENDED",
    likelyGoal: hasNegative ? "fix_problem" : "unsure",
    reasons,
    matchedKeywords,
  };
}
