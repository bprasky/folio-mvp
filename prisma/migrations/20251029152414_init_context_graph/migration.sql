-- CreateTable
CREATE TABLE "context_signals" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "vendorId" TEXT,
    "productId" TEXT,
    "materialId" TEXT,
    "projectId" TEXT,
    "eventId" TEXT,
    "action" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "vector" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "id" TEXT NOT NULL,
    "srcType" TEXT NOT NULL,
    "srcId" TEXT NOT NULL,
    "dstType" TEXT NOT NULL,
    "dstId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "decayAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_signals" (
    "id" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "liquidity" DOUBLE PRECISION NOT NULL,
    "momentum" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "window" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spend_recommendations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "recommendedUsd" DOUBLE PRECISION NOT NULL,
    "rationale" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spend_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "context_signals_userId_action_createdAt_idx" ON "context_signals"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "context_signals_productId_projectId_action_idx" ON "context_signals"("productId", "projectId", "action");

-- CreateIndex
CREATE INDEX "context_signals_eventId_action_idx" ON "context_signals"("eventId", "action");

-- CreateIndex
CREATE INDEX "embeddings_nodeType_idx" ON "embeddings"("nodeType");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_nodeType_nodeId_key" ON "embeddings"("nodeType", "nodeId");

-- CreateIndex
CREATE INDEX "graph_edges_srcType_srcId_idx" ON "graph_edges"("srcType", "srcId");

-- CreateIndex
CREATE INDEX "graph_edges_dstType_dstId_idx" ON "graph_edges"("dstType", "dstId");

-- CreateIndex
CREATE INDEX "graph_edges_kind_idx" ON "graph_edges"("kind");

-- CreateIndex
CREATE INDEX "graph_edges_updatedAt_idx" ON "graph_edges"("updatedAt");

-- CreateIndex
CREATE INDEX "market_signals_nodeType_nodeId_idx" ON "market_signals"("nodeType", "nodeId");

-- CreateIndex
CREATE INDEX "market_signals_updatedAt_idx" ON "market_signals"("updatedAt");

-- CreateIndex
CREATE INDEX "spend_recommendations_vendorId_scopeType_scopeId_idx" ON "spend_recommendations"("vendorId", "scopeType", "scopeId");



