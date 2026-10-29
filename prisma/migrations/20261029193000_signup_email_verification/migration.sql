-- Pending signups are separate from usable accounts; existing users are unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS "signup_email_challenges" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "returnTo" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "purgeAt" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sends" INTEGER NOT NULL DEFAULT 1,
  "deliveryAccepted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "signup_email_challenges_purgeAt_idx" ON "signup_email_challenges"("purgeAt");
-- Credentials and verification state are only accessible to the server.
ALTER TABLE "signup_email_challenges" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "signup_email_challenges" FROM PUBLIC, anon, authenticated;
COMMIT;
