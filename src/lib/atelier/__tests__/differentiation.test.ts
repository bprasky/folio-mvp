/**
 * differentiation.test.ts
 *
 * Tests to verify that different designer profiles produce
 * meaningfully different consultation guidance.
 *
 * The core question: If a buyer asks the same question to two different
 * designer Ateliers, do they get noticeably different responses?
 */

import { buildConsultationPrompt, __testing } from "../buildConsultationPrompt";
import type { DesignerReasoningProfile } from "@prisma/client";

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TEST_DEVELOPMENT = {
  name: "The Residences at Marina Gate",
  location: "Dubai Marina, UAE",
  description: "Luxury waterfront living with panoramic views",
  developerName: "Emaar Properties",
};

const TEST_CONSULTATION = {
  unitTypeName: "3BR Sky Residence",
  unitDetails: { bedrooms: 3, bathrooms: 2, sqft: 2100 },
  finishPackageName: "Premium Collection",
  finishPackageTier: "PREMIUM" as const,
};

const TEST_AVAILABLE_PRODUCTS = [
  {
    slotCategory: "COUNTERTOP",
    roomName: "Kitchen",
    products: [
      {
        id: "p1",
        name: "Caesarstone Quartz",
        vendorName: "Caesarstone",
        tier: "STANDARD",
        upgradeCost: 0,
        description: "Durable engineered quartz",
        material: "Engineered Quartz",
      },
      {
        id: "p2",
        name: "Italian Carrara Marble",
        vendorName: "Stonemark",
        tier: "PREMIUM",
        upgradeCost: 800000, // $8,000 in cents
        description: "Classic Italian marble",
        material: "Natural Marble",
      },
      {
        id: "p3",
        name: "Neolith Sintered Stone",
        vendorName: "Neolith",
        tier: "LUXURY",
        upgradeCost: 1500000, // $15,000 in cents
        description: "Ultra-durable sintered surface",
        material: "Sintered Stone",
      },
    ],
  },
  {
    slotCategory: "FIXTURE",
    roomName: "Master Bath",
    products: [
      {
        id: "p4",
        name: "Grohe Essence",
        vendorName: "Grohe",
        tier: "STANDARD",
        upgradeCost: 0,
        description: "German engineering, clean lines",
        material: "Chrome",
      },
      {
        id: "p5",
        name: "Hansgrohe Raindance",
        vendorName: "Hansgrohe",
        tier: "PREMIUM",
        upgradeCost: 250000,
        description: "Luxurious rain shower system",
        material: "Chrome/Brushed Nickel",
      },
      {
        id: "p6",
        name: "Dornbracht Tara",
        vendorName: "Dornbracht",
        tier: "LUXURY",
        upgradeCost: 600000,
        description: "Pinnacle of fixture design",
        material: "Platinum Matt",
      },
    ],
  },
];

// Designer A: Investment-focused, methodical
const DESIGNER_A = {
  id: "designer-a",
  name: "Sarah Mitchell",
  bio: "I believe in investing in pieces that will last. Every material choice should consider not just how it looks today, but how it will age over decades of use.",
  studio: "Mitchell Design Studio",
};

const PROFILE_A: Partial<DesignerReasoningProfile> = {
  userId: "designer-a",
  statedApproach:
    "My approach is methodical. I walk clients through options systematically, always connecting choices back to how they'll actually live in the space.",
  statedValues: ["longevity", "craftsmanship", "timeless"],
  materialTendencies: { natural_stone: 0.6, wood: 0.25, brass_bronze: 0.15 },
  pricePointPattern: "investment_focused",
  vendorAffinities: [
    { vendorId: "v1", vendorName: "Waterworks", frequency: 12 },
    { vendorId: "v2", vendorName: "Dornbracht", frequency: 8 },
  ],
  decisionPatterns: [
    "Always starts with how the space will be used daily",
    "Considers maintenance requirements upfront",
    "Frames cost as cost-per-year over lifetime",
  ],
  tradeoffExamples: [
    {
      context: "kitchen countertops",
      reasoning:
        "The marble requires more care, but the patina it develops tells the story of your life in this kitchen. If you cook seriously, it's worth the investment.",
    },
  ],
  quotesOnApproach: [
    "Buy once, cry once - that's my philosophy with materials.",
    "I'd rather have one beautiful piece than five mediocre ones.",
  ],
  explanationExamples: [
    {
      topic: "fixture selection",
      explanation:
        "Dornbracht fixtures are engineered to work flawlessly for 20+ years. When you calculate the cost per day of use, premium fixtures are actually economical.",
    },
  ],
  confidenceScore: 0.85,
  dataSourcesUsed: ["bio", "projects", "interviews", "editorial"],
};

// Designer B: Value-conscious, intuitive
const DESIGNER_B = {
  id: "designer-b",
  name: "Marcus Chen",
  bio: "Good design doesn't require the biggest budget. I help clients find moments of delight within their means, saving where it makes sense to splurge where it matters most to them.",
  studio: "Chen Interiors",
};

const PROFILE_B: Partial<DesignerReasoningProfile> = {
  userId: "designer-b",
  statedApproach:
    "I trust intuition. When you walk into a space, you know within seconds if it feels right. My job is helping clients find that feeling without overthinking it.",
  statedValues: ["approachable", "joyful", "practical"],
  materialTendencies: { ceramic_porcelain: 0.4, engineered_stone: 0.35, textile: 0.25 },
  pricePointPattern: "value_conscious",
  vendorAffinities: [
    { vendorId: "v3", vendorName: "Kohler", frequency: 15 },
    { vendorId: "v4", vendorName: "Caesarstone", frequency: 10 },
  ],
  decisionPatterns: [
    "Leads with emotional response - how does it make you feel?",
    "Identifies opportunities to save without sacrifice",
    "Focuses on visual impact per dollar",
  ],
  tradeoffExamples: [
    {
      context: "bathroom fixtures",
      reasoning:
        "The standard Grohe is honestly excellent. Save that upgrade budget for the kitchen where you'll notice it every day.",
    },
  ],
  quotesOnApproach: [
    "Design should feel effortless, even when it's not.",
    "The best investment is in the rooms where you spend the most time.",
  ],
  explanationExamples: [
    {
      topic: "countertops",
      explanation:
        "Engineered quartz gives you 90% of the look of marble with none of the maintenance anxiety. That peace of mind is worth something.",
    },
  ],
  confidenceScore: 0.75,
  dataSourcesUsed: ["bio", "projects", "interviews"],
};

// Designer C: Low data (new to platform)
const DESIGNER_C = {
  id: "designer-c",
  name: "New Designer",
  bio: null,
  studio: null,
};

const PROFILE_C: Partial<DesignerReasoningProfile> = {
  userId: "designer-c",
  statedApproach: null,
  statedValues: [],
  materialTendencies: {},
  pricePointPattern: null,
  vendorAffinities: [],
  decisionPatterns: [],
  tradeoffExamples: [],
  quotesOnApproach: [],
  explanationExamples: [],
  confidenceScore: 0.15,
  dataSourcesUsed: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Designer Atelier Differentiation", () => {
  describe("buildConsultationPrompt", () => {
    it("should produce different prompts for different designers", () => {
      const promptA = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      const promptB = buildConsultationPrompt({
        designer: DESIGNER_B,
        reasoningProfile: PROFILE_B as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      // Prompts should be different
      expect(promptA).not.toEqual(promptB);

      // Designer names should appear
      expect(promptA).toContain("Sarah Mitchell");
      expect(promptB).toContain("Marcus Chen");

      // Designer A should have investment-focused language
      expect(promptA).toContain("investment");
      expect(promptA).toContain("longevity");

      // Designer B should have value-conscious language
      expect(promptB).toContain("value");
      expect(promptB).toContain("practical");
    });

    it("should include designer quotes when available", () => {
      const promptA = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      // Should include actual quotes
      expect(promptA).toContain("Buy once, cry once");
      expect(promptA).toContain("one beautiful piece");
    });

    it("should include tradeoff examples when available", () => {
      const promptA = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      expect(promptA).toContain("kitchen countertops");
      expect(promptA).toContain("patina");
    });

    it("should include material tendencies", () => {
      const promptA = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      // Should mention material preferences
      expect(promptA).toContain("Natural Stone");
      expect(promptA).toContain("60%");
    });

    it("should include vendor affinities", () => {
      const promptA = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      expect(promptA).toContain("Waterworks");
      expect(promptA).toContain("Dornbracht");
    });

    it("should disclose when data is limited", () => {
      const promptC = buildConsultationPrompt({
        designer: DESIGNER_C,
        reasoningProfile: PROFILE_C as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      // Should include disclosure about limited data
      expect(promptC).toContain("limited");
    });

    it("should gracefully handle null reasoning profile", () => {
      const prompt = buildConsultationPrompt({
        designer: DESIGNER_C,
        reasoningProfile: null,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      // Should still produce a valid prompt
      expect(prompt).toContain("New Designer");
      expect(prompt).toContain("general design principles");
    });

    it("should include buyer context when provided", () => {
      const prompt = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
        buyerContext: {
          statedPreferences: ["prefers modern aesthetic", "likes clean lines"],
          budgetSignals: ["concerned about total cost"],
          lifestyleNotes: ["works from home", "entertains frequently"],
        },
      });

      expect(prompt).toContain("Buyer preferences");
      expect(prompt).toContain("modern aesthetic");
      expect(prompt).toContain("entertains frequently");
    });

    it("should include current selections and running total", () => {
      const prompt = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [
          {
            slotCategory: "COUNTERTOP",
            roomName: "Kitchen",
            productName: "Italian Carrara Marble",
            upgradeCost: 800000,
          },
        ],
      });

      expect(prompt).toContain("Italian Carrara Marble");
      expect(prompt).toContain("$800,000"); // upgrade cost in cents displayed as dollars
    });

    it("should never suggest pretending to be the designer", () => {
      const promptA = buildConsultationPrompt({
        designer: DESIGNER_A,
        reasoningProfile: PROFILE_A as DesignerReasoningProfile,
        fingerprint: null,
        development: TEST_DEVELOPMENT,
        consultation: TEST_CONSULTATION,
        availableProducts: TEST_AVAILABLE_PRODUCTS,
        currentSelections: [],
      });

      // Should explicitly state it's AI, not the designer
      expect(promptA).toContain("you are AI");
      expect(promptA).toContain("not Sarah Mitchell personally");
      expect(promptA).toContain("DON'T");
      expect(promptA).toContain("Pretend to be");
    });
  });

  describe("Section builders", () => {
    it("buildApproachSection should use bio when available", () => {
      const section = __testing.buildApproachSection(DESIGNER_A, PROFILE_A as DesignerReasoningProfile);

      expect(section).toContain("In their words");
      expect(section).toContain("investing in pieces that will last");
    });

    it("buildTendenciesSection should format material percentages", () => {
      const section = __testing.buildTendenciesSection(PROFILE_A as DesignerReasoningProfile);

      expect(section).toContain("Natural Stone");
      expect(section).toContain("60%");
    });

    it("buildTradeoffSection should include real examples", () => {
      const section = __testing.buildTradeoffSection(PROFILE_A as DesignerReasoningProfile);

      expect(section).toContain("kitchen countertops");
      expect(section).toContain("patina");
    });

    it("formatAvailableProducts should list all products", () => {
      const formatted = __testing.formatAvailableProducts(TEST_AVAILABLE_PRODUCTS);

      expect(formatted).toContain("Kitchen - COUNTERTOP");
      expect(formatted).toContain("Caesarstone Quartz");
      expect(formatted).toContain("[included]");
      expect(formatted).toContain("+$");
    });
  });
});

// ---------------------------------------------------------------------------
// Integration Test Ideas (require actual API calls)
// ---------------------------------------------------------------------------

/*
These tests would need to be run with actual Claude API calls:

describe('Live Differentiation Tests', () => {
  const TEST_QUERY = "I'm not sure about the kitchen countertops. What would you recommend?";

  it('should produce meaningfully different responses for different designers', async () => {
    const responseA = await callConsultationChat(DESIGNER_A, PROFILE_A, TEST_QUERY);
    const responseB = await callConsultationChat(DESIGNER_B, PROFILE_B, TEST_QUERY);

    // Responses should be different
    expect(responseA).not.toEqual(responseB);

    // Designer A should lean toward investment framing
    expect(responseA.toLowerCase()).toMatch(/invest|last|quality|worth|decades/);

    // Designer B should lean toward value framing
    expect(responseB.toLowerCase()).toMatch(/save|practical|budget|value|feel/);
  });

  it('should incorporate signature phrases', async () => {
    const responseA = await callConsultationChat(DESIGNER_A, PROFILE_A, TEST_QUERY);

    // Should use language consistent with their quotes
    // (may not be exact quotes, but same concepts)
    expect(responseA.toLowerCase()).toMatch(/invest|lifetime|craft/);
  });
});
*/
