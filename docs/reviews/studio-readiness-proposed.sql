-- PROPOSAL ONLY. No existing rows, tables, columns or enums are modified.
CREATE TABLE IF NOT EXISTS public.studio_candidates (
  "id" TEXT NOT NULL PRIMARY KEY,
  "designerId" TEXT NOT NULL,
  "organizationId" TEXT,
  "projectIds" TEXT[] NOT NULL,
  "currentVersion" INTEGER NOT NULL CHECK ("currentVersion" > 0),
  "state" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.studio_candidate_versions (
  "candidateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "sourceVersion" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT studio_candidate_versions_pkey PRIMARY KEY ("candidateId", "version"),
  CONSTRAINT "studio_candidate_versions_candidateId_fkey" FOREIGN KEY ("candidateId")
    REFERENCES public.studio_candidates("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "studio_candidate_versions_candidateId_version_sourceVersion_key"
  ON public.studio_candidate_versions("candidateId", "version", "sourceVersion");

CREATE TABLE IF NOT EXISTS public.studio_candidate_events (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_candidate_events_candidateId_version_sourceVersion_fkey"
    FOREIGN KEY ("candidateId", "version", "sourceVersion")
    REFERENCES public.studio_candidate_versions("candidateId", "version", "sourceVersion")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "studio_candidates_designerId_organizationId_state_idx"
  ON public.studio_candidates("designerId", "organizationId", "state");
CREATE INDEX IF NOT EXISTS "studio_candidate_events_candidateId_createdAt_idx"
  ON public.studio_candidate_events("candidateId", "createdAt");

-- Server-only access: no anon/authenticated policies. Service checks ownership.
ALTER TABLE public.studio_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_candidate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_candidate_events ENABLE ROW LEVEL SECURITY;
