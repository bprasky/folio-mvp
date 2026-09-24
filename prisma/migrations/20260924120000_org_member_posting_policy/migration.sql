-- Creator-confirmed firms allow approved members to publish by default.
-- Organization admins can disable this without changing membership roles.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "membersCanPublish" BOOLEAN NOT NULL DEFAULT TRUE;
