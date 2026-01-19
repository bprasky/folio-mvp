/**
 * buildConsultationPrompt.ts
 *
 * Assembles designer-specific system prompts for consultation chat.
 *
 * Philosophy: This is NOT about making AI "sound like" a designer.
 * It's about AI that reasons from a designer's actual positions, grounded
 * in what they select in their work and how they describe their approach.
 *
 * The buyer knows this is AI. The value is that it's INFORMED AI.
 */

import type { DesignerReasoningProfile } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsultationPromptParams {
  designer: {
    id: string;
    name: string;
    bio: string | null;
    studio: string | null;
  };

  reasoningProfile: DesignerReasoningProfile | null;

  fingerprint: {
    aestheticTendencies?: Record<string, number>;
  } | null;

  development: {
    name: string;
    location: string;
    description: string | null;
    developerName: string;
  };

  consultation: {
    unitTypeName: string;
    unitDetails: { bedrooms: number; bathrooms: number; sqft: number };
    finishPackageName: string;
    finishPackageTier: "STANDARD" | "PREMIUM" | "LUXURY";
  };

  availableProducts: {
    slotCategory: string;
    roomName: string;
    products: {
      id: string;
      name: string;
      vendorName: string;
      tier: string;
      upgradeCost: number;
      description: string | null;
      material: string | null;
    }[];
  }[];

  currentSelections: {
    slotCategory: string;
    roomName: string;
    productName: string;
    upgradeCost: number;
  }[];

  buyerContext?: {
    statedPreferences: string[];
    budgetSignals: string[];
    lifestyleNotes: string[];
  };
}

// ---------------------------------------------------------------------------
// Main Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for a consultation chat session
 */
export function buildConsultationPrompt(
  params: ConsultationPromptParams
): string {
  const {
    designer,
    reasoningProfile,
    development,
    consultation,
    availableProducts,
    currentSelections,
    buyerContext,
  } = params;

  const hasReasoningData =
    reasoningProfile && (reasoningProfile.confidenceScore ?? 0) > 0.3;

  const lowDataDisclosure =
    reasoningProfile && (reasoningProfile.confidenceScore ?? 0) < 0.5
      ? `\nNote: We have limited data from ${designer.name}'s portfolio, so some guidance will be more general.\n`
      : "";

  return `
## Who You Are

You are an AI design assistant providing guidance informed by ${designer.name}'s design perspective and approach.

${designer.studio ? `${designer.name} is the principal of ${designer.studio}.` : ""}

Be clear: you are AI, not ${designer.name} personally. Your value is that your recommendations are grounded in their actual design sensibility, drawn from their portfolio, their stated approach, and how they work.
${lowDataDisclosure}
---

## ${designer.name}'s Design Approach

${buildApproachSection(designer, reasoningProfile)}

---

## How to Give Recommendations

When recommending products or finishes:

1. **Ground recommendations in real tendencies**
${buildTendenciesSection(reasoningProfile)}

2. **Frame tradeoffs honestly**
${buildTradeoffSection(reasoningProfile)}

3. **Use their actual reasoning patterns**
${buildReasoningExamples(reasoningProfile)}

---

## Current Context

**Development:** ${development.name}
**Location:** ${development.location}
${development.description ? `**About:** ${development.description}` : ""}

**Unit:** ${consultation.unitTypeName}
- ${consultation.unitDetails.bedrooms} bedroom, ${consultation.unitDetails.bathrooms} bath
- ${consultation.unitDetails.sqft.toLocaleString()} sqft

**Base Package:** ${consultation.finishPackageName} (${consultation.finishPackageTier})

${buyerContext ? buildBuyerContextSection(buyerContext) : ""}

---

## Available Selections

${formatAvailableProducts(availableProducts)}

---

## Current Selections & Running Total

${formatCurrentSelections(currentSelections)}

**Current upgrade total:** $${currentSelections.reduce((sum, s) => sum + s.upgradeCost, 0).toLocaleString()}

---

## Your Task

Help the buyer think through their finish selections for this unit.

DO:
- Ask about how they'll use the space before recommending
- Explain why certain options might suit them, grounded in design reasoning
- Be honest about tradeoffs (durability vs aesthetics, cost vs value)
- Make clear recommendations when you have enough information
- Acknowledge when personal preference should override any guidance

DON'T:
- Pretend to be ${designer.name} personally
- Make up information about products
- Push upgrades without reason
- Be precious or performative about design
- Use cringey AI assistant language ("I'd be happy to help!", "Great question!")

Speak naturally. Be useful. Ground your perspective in real design thinking.
`.trim();
}

// ---------------------------------------------------------------------------
// Section Builders
// ---------------------------------------------------------------------------

function buildApproachSection(
  designer: { name: string; bio: string | null },
  profile: DesignerReasoningProfile | null
): string {
  const sections: string[] = [];

  // Their own words first
  if (designer.bio) {
    sections.push(`**In their words:**\n"${designer.bio}"`);
  }

  if (profile?.statedApproach) {
    sections.push(`**Their stated approach:**\n${profile.statedApproach}`);
  }

  if (profile?.statedValues && profile.statedValues.length > 0) {
    sections.push(`**Values they emphasize:** ${profile.statedValues.join(", ")}`);
  }

  if (profile?.quotesOnApproach && profile.quotesOnApproach.length > 0) {
    const quotes = profile.quotesOnApproach.slice(0, 3);
    sections.push(
      `**From interviews:**\n${quotes.map((q) => `- "${q}"`).join("\n")}`
    );
  }

  if (sections.length === 0) {
    return `Limited information available about ${designer.name}'s specific approach. Provide thoughtful general guidance.`;
  }

  return sections.join("\n\n");
}

function buildTendenciesSection(
  profile: DesignerReasoningProfile | null
): string {
  if (!profile) {
    return "No specific tendencies data available. Use general design principles.";
  }

  const lines: string[] = [];

  // Material tendencies
  const materialTendencies = profile.materialTendencies as Record<
    string,
    number
  > | null;
  if (materialTendencies && Object.keys(materialTendencies).length > 0) {
    const topMaterials = Object.entries(materialTendencies)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(
        ([material, weight]) =>
          `${formatMaterialName(material)} (${Math.round(weight * 100)}% of selections)`
      );

    if (topMaterials.length > 0) {
      lines.push(
        `**Material preferences from their portfolio:** ${topMaterials.join(", ")}`
      );
    }
  }

  // Price point pattern
  if (profile.pricePointPattern) {
    const patternDescriptions: Record<string, string> = {
      investment_focused:
        "Tends toward investment pieces - quality over quantity",
      value_conscious:
        "Looks for value - good design at reasonable price points",
      balanced: "Balances splurges with savings strategically",
      context_dependent:
        "Varies by context - invests where it matters most for each project",
    };
    lines.push(
      `**Price approach:** ${patternDescriptions[profile.pricePointPattern] || profile.pricePointPattern}`
    );
  }

  // Vendor affinities
  const vendorAffinities = profile.vendorAffinities as
    | { vendorId: string; vendorName: string; frequency: number }[]
    | null;
  if (vendorAffinities && vendorAffinities.length > 0) {
    const topVendors = vendorAffinities.slice(0, 5).map((v) => v.vendorName);
    lines.push(`**Frequently specified vendors:** ${topVendors.join(", ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "Use general design principles.";
}

function buildTradeoffSection(
  profile: DesignerReasoningProfile | null
): string {
  const tradeoffExamples = profile?.tradeoffExamples as
    | { context: string; reasoning: string }[]
    | null;

  if (!tradeoffExamples || tradeoffExamples.length === 0) {
    return `Frame tradeoffs honestly:
- Cost vs. long-term value
- Durability vs. aesthetic preference
- Trend-forward vs. timeless
- Maintenance requirements vs. visual impact`;
  }

  const examples = tradeoffExamples.slice(0, 2);
  return `Examples of how they frame tradeoffs:\n${examples.map((e) => `- **${e.context}:** "${e.reasoning}"`).join("\n")}`;
}

function buildReasoningExamples(
  profile: DesignerReasoningProfile | null
): string {
  const explanationExamples = profile?.explanationExamples as
    | { topic: string; explanation: string }[]
    | null;

  if (!explanationExamples || explanationExamples.length === 0) {
    return "Explain your reasoning clearly. Connect recommendations to how the buyer will actually use the space.";
  }

  const examples = explanationExamples.slice(0, 2);
  return `Examples of their explanations:\n${examples.map((e) => `- On ${e.topic}: "${e.explanation}"`).join("\n")}`;
}

function buildBuyerContextSection(buyerContext: {
  statedPreferences: string[];
  budgetSignals: string[];
  lifestyleNotes: string[];
}): string {
  const parts: string[] = [];

  if (buyerContext.statedPreferences.length > 0) {
    parts.push(
      `**Buyer preferences noted:** ${buyerContext.statedPreferences.join(", ")}`
    );
  }

  if (buyerContext.budgetSignals.length > 0) {
    parts.push(
      `**Budget signals:** ${buyerContext.budgetSignals.join(", ")}`
    );
  }

  if (buyerContext.lifestyleNotes.length > 0) {
    parts.push(
      `**Lifestyle notes:** ${buyerContext.lifestyleNotes.join(", ")}`
    );
  }

  if (parts.length === 0) return "";

  return `\n---\n\n## What We Know About the Buyer\n\n${parts.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

function formatAvailableProducts(
  products: ConsultationPromptParams["availableProducts"]
): string {
  if (products.length === 0) {
    return "No products loaded yet.";
  }

  return products
    .map(
      (slot) => `
**${slot.roomName} - ${slot.slotCategory}:**
${slot.products
  .map(
    (p) =>
      `- ${p.name} (${p.vendorName}) - ${p.tier}${p.upgradeCost > 0 ? ` [+$${p.upgradeCost.toLocaleString()}]` : " [included]"}${p.material ? ` - ${p.material}` : ""}`
  )
  .join("\n")}`
    )
    .join("\n");
}

function formatCurrentSelections(
  selections: ConsultationPromptParams["currentSelections"]
): string {
  if (selections.length === 0) {
    return "No selections made yet.";
  }

  return selections
    .map(
      (s) =>
        `- ${s.roomName} ${s.slotCategory}: ${s.productName}${s.upgradeCost > 0 ? ` (+$${s.upgradeCost.toLocaleString()})` : ""}`
    )
    .join("\n");
}

function formatMaterialName(material: string): string {
  const names: Record<string, string> = {
    natural_stone: "Natural Stone",
    engineered_stone: "Engineered Stone",
    wood: "Wood",
    brass_bronze: "Brass/Bronze",
    ceramic_porcelain: "Ceramic/Porcelain",
    glass: "Glass",
    textile: "Textile",
    leather: "Leather",
  };

  return names[material] || material.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Exports for Testing
// ---------------------------------------------------------------------------

export const __testing = {
  buildApproachSection,
  buildTendenciesSection,
  buildTradeoffSection,
  buildReasoningExamples,
  formatAvailableProducts,
  formatCurrentSelections,
};
