-- API cost hardening Phase 3: CostEvent instrumentation. ADD-only, idempotent.
-- One row per paid-API call (anthropic | fal | resend | deepgram | livekit).
-- cacheReadInputTokens / cacheCreationInputTokens quantify the Phase 2 caching win.

CREATE TABLE IF NOT EXISTS "CostEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadInputTokens" INTEGER,
    "cacheCreationInputTokens" INTEGER,
    "units" DOUBLE PRECISION,
    "costUsdEstimate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CostEvent_projectId_idx" ON "CostEvent"("projectId");
CREATE INDEX IF NOT EXISTS "CostEvent_provider_createdAt_idx" ON "CostEvent"("provider", "createdAt");
