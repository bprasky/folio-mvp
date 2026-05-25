-- AlterTable: add multi-capability tag array to organizations (additive, idempotent).
-- Org.type stays the primary affinity; org.capabilities tracks every capability
-- the org has been tagged with, including its primary type. Hybrid orgs
-- (designer + vendor, design + build, etc.) get extra entries in this array.
-- Admin-only writes are enforced at the API layer (POST /api/auth/org-setup/add-capability).
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "capabilities" "OrgType"[] NOT NULL DEFAULT ARRAY[]::"OrgType"[];

-- Backfill: seed capabilities with the primary type for every existing org so
-- capability-based queries return the same set as type-based queries from day
-- one. Guarded on cardinality=0 so re-running the migration is safe.
UPDATE "organizations"
   SET "capabilities" = ARRAY["type"]::"OrgType"[]
 WHERE cardinality("capabilities") = 0;
