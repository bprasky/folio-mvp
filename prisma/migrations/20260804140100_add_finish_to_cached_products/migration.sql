-- CachedProduct.finish (spec 21 delta D3) — MIGRATION B of two.
--
-- What the URL says the product is, shared across every designer. A DIFFERENT
-- fact from product_tags.finish_raw, which is what one designer specified in one
-- room. The variant-selector case proves they must stay separate: a product page
-- with a finish picker gives extraction the default variant while the designer
-- specified the third option down. Conflated, one designer's specification would
-- overwrite the shared record and then propose itself to everyone else.
--
-- Also distinct from the existing material_type column, which is a category
-- (stone, tile, wood, metal, ...). This is a finish ("Unlacquered Brass").
-- Finish must not collapse into the category.
--
-- Additive and idempotent. Nullable, no default, no backfill: cached rows were
-- fetched before finish was extracted and have no value to state.
--
-- No index. Nothing groups or joins on this column — it is read once a product is
-- already resolved by URL, which cached_products.url already covers with a unique
-- constraint.

ALTER TABLE "cached_products"
  ADD COLUMN IF NOT EXISTS "finish" TEXT;
