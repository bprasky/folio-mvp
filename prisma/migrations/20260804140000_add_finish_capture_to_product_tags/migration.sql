-- ProductTag finish capture (spec 21 delta D3) — MIGRATION A of two.
--
-- A finish is a specification decision made for THIS tag, not an attribute of the
-- SKU. The same faucet is unlacquered brass in one house and polished nickel in
-- another; putting finish on Product would split one product into two records and
-- break Repeat Specification, which depends on product identity holding across
-- projects.
--
-- Additive and idempotent.
--
-- finish_raw and finish_canonical are nullable with no backfill. Most existing
-- tags have no finish and NULL states that accurately, where an empty string
-- would be a value that looks observed. finish_canonical stays NULL for now by
-- design: normalization is deferred until real finish_raw values exist, because
-- matching rules written first would be rules written against imagination.
--
-- finish_confirmed is NOT NULL with a default of false, which reads correctly on
-- every existing row: no designer has confirmed a finish on any tag predating
-- this. It is the only thing separating an observed finish from a proposed one,
-- so corpus blocks can raise their bar later without a re-capture.

ALTER TABLE "product_tags"
  ADD COLUMN IF NOT EXISTS "finish_raw" TEXT,
  ADD COLUMN IF NOT EXISTS "finish_canonical" TEXT,
  ADD COLUMN IF NOT EXISTS "finish_confirmed" BOOLEAN NOT NULL DEFAULT false;

-- finish_canonical ONLY. It is the column Material Palette groups on and Material
-- Study joins across projects. finish_raw is display-only — never grouped, never
-- joined — so a second index on it would cost writes on every tag creation and
-- buy nothing. Do not add one for symmetry.
CREATE INDEX IF NOT EXISTS "product_tags_finish_canonical_idx"
  ON "product_tags" ("finish_canonical");
