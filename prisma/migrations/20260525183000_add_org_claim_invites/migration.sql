-- New: OrgClaimInvite + ClaimStatus.
-- The founder/member fork in /auth/org-setup: a MEMBER who can't claim the
-- firm page themselves mints a single-use invite, sends the link to whoever
-- can configure the page, and that person becomes OWNER via the token. See
-- docs/AUTH_ORG_ENROLLMENT_FLOW.md.
--
-- Idempotent per CLAUDE.md Phase 5E CI baseline (#4: non-idempotent DDL in
-- recent migrations must be 0).

-- ClaimStatus enum: PENDING → CLAIMED on consume, EXPIRED past expiresAt,
-- REVOKED on admin invalidation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClaimStatus') THEN
    CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED', 'REVOKED');
  END IF;
END
$$;

-- The invite table.
CREATE TABLE IF NOT EXISTS "org_claim_invites" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "token"          TEXT NOT NULL,
  "invitedEmail"   TEXT,
  "status"         "ClaimStatus" NOT NULL DEFAULT 'PENDING',
  "createdById"    TEXT NOT NULL,
  "claimedById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt"      TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "org_claim_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_claim_invites_token_key"
  ON "org_claim_invites"("token");

CREATE INDEX IF NOT EXISTS "org_claim_invites_organizationId_status_idx"
  ON "org_claim_invites"("organizationId", "status");

-- FKs guarded so re-running doesn't fail. ON DELETE CASCADE on the org so an
-- org delete cleans up stranded invites; ON DELETE NO ACTION on users so we
-- don't accidentally orphan history when a user account is removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_claim_invites_organizationId_fkey'
  ) THEN
    ALTER TABLE "org_claim_invites"
      ADD CONSTRAINT "org_claim_invites_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_claim_invites_createdById_fkey'
  ) THEN
    ALTER TABLE "org_claim_invites"
      ADD CONSTRAINT "org_claim_invites_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_claim_invites_claimedById_fkey'
  ) THEN
    ALTER TABLE "org_claim_invites"
      ADD CONSTRAINT "org_claim_invites_claimedById_fkey"
      FOREIGN KEY ("claimedById") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END
$$;
