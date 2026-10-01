-- DRAFT: apply only after explicit migration review. No production application in this task.
-- Private transport state is separate from canonical editorial answers.
CREATE TABLE IF NOT EXISTS live_interview_sessions (
  id text PRIMARY KEY,
  "actorId" text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "sourceType" text NOT NULL,
  "sourceId" text NOT NULL,
  "canonicalId" text NOT NULL,
  status text NOT NULL,
  "credentialHash" text NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  "providerIds" jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_interview_actor_source ON live_interview_sessions ("actorId", "sourceType", "sourceId", "createdAt");
CREATE INDEX IF NOT EXISTS live_interview_cleanup ON live_interview_sessions (status,"expiresAt");
-- A partial unique index prevents concurrent transport starts for the same source.
CREATE UNIQUE INDEX IF NOT EXISTS live_interview_one_active ON live_interview_sessions ("actorId", "sourceType", "sourceId") WHERE status IN ('starting','active','paused','ending','uncertain');
ALTER TABLE live_interview_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON live_interview_sessions FROM anon, authenticated;

-- Typed private documents: capture run (ordered chunks), edit plan (immutable
-- revision), render/finalize job (claim/lease). Kept outside public source tables.
CREATE TABLE IF NOT EXISTS interview_media_records (
  id text PRIMARY KEY,
  "actorId" text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "sessionId" text NOT NULL REFERENCES live_interview_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('capture','plan','job')),
  state text NOT NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "jobKey" text UNIQUE,
  "leaseToken" text,
  "leaseUntil" timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  "availableAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interview_media_actor ON interview_media_records ("actorId","sessionId",kind,"createdAt");
CREATE INDEX IF NOT EXISTS interview_media_claim ON interview_media_records (kind,state,"availableAt","leaseUntil");
CREATE UNIQUE INDEX IF NOT EXISTS interview_media_one_recorder ON interview_media_records ("actorId","sessionId") WHERE kind='capture' AND state='recording';
ALTER TABLE interview_media_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON interview_media_records FROM anon, authenticated;
