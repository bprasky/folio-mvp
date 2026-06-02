-- Publish flow tag review (spec 20 §3d, revised): replace the stored
-- review enum with a derived gate. Review state is now derived as
-- `tagCount > 0 OR noProducts`, so a confirmed tag auto-satisfies the gate and
-- dismissing the last tag auto-reverts to unreviewed — no write-site enum
-- bookkeeping, no way for a REVIEWED photo to sit with zero attribution.
--
-- ADD-only, idempotent. `noProducts` is the only persisted review signal: it
-- marks "this photo has no products to tag". `tagState` (added in the prior
-- migration) is retained for migration/DB consistency but is no longer read.

ALTER TABLE "project_images"
  ADD COLUMN IF NOT EXISTS "noProducts" BOOLEAN NOT NULL DEFAULT false;

-- Preserve any explicit "no products" marks made under the prior enum model
-- (REVIEWED with zero tags). Idempotent. No-op where tagState never shipped.
UPDATE "project_images" pi
SET "noProducts" = true
WHERE pi."noProducts" = false
  AND pi."tagState" = 'REVIEWED'
  AND NOT EXISTS (
    SELECT 1 FROM "product_tags" t WHERE t."imageId" = pi."id"
  );
