-- CreateTable: DesignerReasoningProfile
-- Captures HOW a designer thinks and decides, used for AI consultation guidance

CREATE TABLE "designer_reasoning_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    -- Derived from bio and brand profile
    "statedApproach" TEXT,
    "statedValues" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Derived from project selections
    "materialTendencies" JSONB DEFAULT '{}',
    "pricePointPattern" TEXT,
    "vendorAffinities" JSONB DEFAULT '[]',

    -- Derived from interview content
    "decisionPatterns" JSONB DEFAULT '[]',
    "tradeoffExamples" JSONB DEFAULT '[]',
    "quotesOnApproach" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Derived from editorial/project narratives
    "explanationExamples" JSONB DEFAULT '[]',

    -- Metadata
    "lastComputedAt" TIMESTAMP(3),
    "dataSourcesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceScore" DOUBLE PRECISION,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designer_reasoning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "designer_reasoning_profiles_userId_key" ON "designer_reasoning_profiles"("userId");

-- AddForeignKey
ALTER TABLE "designer_reasoning_profiles" ADD CONSTRAINT "designer_reasoning_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
