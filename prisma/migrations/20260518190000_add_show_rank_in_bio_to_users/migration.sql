-- Add users.showRankInBio: schema declared it (prisma/schema.prisma) but no migration
-- ever added the column, so every Prisma SELECT on `users` (e.g. signup's findFirst)
-- failed in prod with P2022. Idempotent so shadow-DB replay and re-runs succeed.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "showRankInBio" BOOLEAN NOT NULL DEFAULT true;
