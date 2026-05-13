# 19 — Cutout Fork + Catalog-Image Default

## Spec change (from session, 2026-05-01)

- **Primary product image, everywhere:** the catalog image pulled from the vendor product URL (`Product.imageUrl`).
- **Secondary asset, on the product detail page only:**
  - 3D-classified items → 3D mesh viewer (`Product.threeDAssetUrl`).
  - 2D-classified items → 2D cutout (`Product.cutoutImageUrl`).
- **All products run through a single 2D-vs-3D fork** keyed off `Product.category`.
- **`RUG` is 2D** (moves out of `MESHABLE_CATEGORIES`).
- **Unknown / `OTHER` defaults to 2D path** (cheap, always works).
- **Tagging a product must guarantee the catalog image is pulled** before any cutout/mesh work; if `Product.imageUrl` is null and `Product.url` is present, re-scrape.

## Why this is a change

Today the homepage reel reads `cutoutImageUrl ?? imageUrl` directly (`src/lib/homepage/getHomepageData.ts:345`), so stale 2D cutouts from a flawed batch run still surface as the primary visual. The 3D pipeline auto-fires on product create/update; the 2D pipeline is manual-only; tagging fires neither. Categories already discriminate 2D vs 3D (`src/lib/three-d/categories.ts`) but only for the 3D path, and the buckets disagree with this spec on `RUG`.

---

## Phase 0 — Homepage visible fixes *(fastest visible wins, no DB writes)*

- [x] **Reel uses catalog image directly.** `src/lib/homepage/getHomepageData.ts` — dropped the `cutoutImageUrl ?? imageUrl` fallback; also removed `cutoutImageUrl` from the prisma select since nothing else reads it on this code path.
- [x] **Display helper default stays catalog-first.** Audit confirmed zero callers pass `use2DCutout: true`; default `false` already matches the new spec. Full opt-in removal lands in Phase 5.
- [x] **Mobile editorial hero title no longer clips.** `src/components/homepage/HomepageHeroXL.tsx` — title dropped to `--type-h3` (28px) on mobile with `line-clamp-3`; desktop unchanged at `--type-h1` (48px) with no clamp.
- [ ] **User verification in browser at `/`:** (a) the four featured product cells render catalog images (no more colored backdrops from legacy cutouts), and (b) the editorial hero title fits within the card on mobile (no top clipping).

**Risk:** zero — no DB writes, no service calls, three single-file edits.

## Phase 1 — Catalog image health audit *(read-only)*

Goal: surface which currently-tagged products are missing `imageUrl`, separated by recoverability.

- [ ] Add `scripts/audit-tagged-product-images.ts` that prints, for every distinct product referenced by `ProductTag` or `ProjectProductTag`:
  - `imageUrl` populated → OK count.
  - `imageUrl` null but `url` populated → re-scrapable count, with sample IDs.
  - both null → vendor-blocked count, with sample IDs.
- [ ] Run it. Decide based on counts whether Phase 4 backfill needs to (a) re-scrape, (b) skip, or (c) flag for vendor follow-up.

## Phase 2 — Fork helper

- [ ] Add `src/lib/cutouts/resolveCutoutPath.ts`:
  - `type CutoutPath = "2D" | "3D"`
  - `resolveCutoutPath(category: string | null | undefined): CutoutPath`
  - 2D bucket: `ART`, `TEXTILES`, `MATERIALS`, `RUG`, `OTHER`, `tile`, `textile`, `fabric`, `paint`, `wallpaper`. Default for unknown/null.
  - 3D bucket: `FURNITURE`, `LIGHTING`, `FIXTURES`, `HARDWARE`, `ACCESSORIES`, `APPLIANCES`.
- [ ] Refactor `src/lib/three-d/categories.ts` so `isMeshableCategory()` delegates to `resolveCutoutPath() === "3D"`. Single source of truth for the bucket lists.
- [ ] Move `RUG` out of `MESHABLE_CATEGORIES`. Confirm no surface relies on rugs being meshable.

## Phase 3 — Auto-trigger on tag creation

- [ ] Add `src/lib/cutouts/ensureProductSecondaryAsset.ts` (fire-and-forget):
  1. Load product (`imageUrl`, `url`, `category`, `cutoutImageUrl`, `threeDAssetUrl`, `mesh3dStatus`).
  2. If `imageUrl` is null and `url` is present, call `upsertProductFromScrape` / the existing scrape path to populate `imageUrl`. Bail if still null.
  3. Run `resolveCutoutPath(category)`.
  4. `2D` path → if `cutoutImageUrl` already populated, exit. Otherwise extract the single-product cutout core out of `src/app/api/projects/[id]/generate-2d-cutouts/route.ts` into a reusable `runSam3CutoutForProduct(productId)` and call it.
  5. `3D` path → call existing `triggerMeshGeneration(productId, imageUrl)`.
  6. Catch all errors silently (mirrors current `triggerMeshGeneration` shape).
- [ ] Wire it after `ProductTag` insert in:
  - `src/app/api/tag-product-to-image/route.ts`
  - `src/app/api/living/skeleton/confirm/route.ts`
  - `src/app/api/import/pending-tag/[tagId]/verify/route.ts`
- [ ] Refactor the cutout API route to delegate to the same `runSam3CutoutForProduct` helper so the manual button and tag trigger share one implementation.

## Phase 4 — Backfill script

- [ ] Add `scripts/backfill-product-secondary-assets.ts` with flags:
  - `--scope=tagged` (default) | `--scope=project <id>` | `--scope=post <slug>` | `--scope=all`
  - `--force` to regenerate even if asset exists.
  - `--dry-run` for plan output only.
- [ ] For each product in scope:
  - If `imageUrl` is null and `url` is present, scrape.
  - Run `resolveCutoutPath` and call the matching pipeline.
  - Idempotent by default.
- [ ] First run: `--scope=post <current homepage XL slug>` to fix the visible reel. Then expand to `tagged`.
- [ ] Verify on the live homepage that the four reel cells render proper catalog images (Phase 0 already does this) and that the backfill produced clean `cutoutImageUrl` / `threeDAssetUrl` rows in the DB for downstream Phase 5.

## Phase 5 — Product detail page secondary asset

- [ ] In `src/lib/products/getProductById.ts`, build `assets[]` with both primary and secondary:
  - `assets[0] = { type: "image", src: imageUrl }` (always primary).
  - If `resolveCutoutPath(category) === "3D"` and `threeDAssetUrl` exists → push `{ type: "model", src: threeDAssetUrl }`.
  - If `resolveCutoutPath(category) === "2D"` and `cutoutImageUrl` exists → push `{ type: "image", src: cutoutImageUrl, label: "Cutout" }`.
- [ ] Update `Gallery.tsx` to render the second asset as a thumbnail; click swaps the hero. For `type: "model"`, hero swap mounts `Product3DViewer`.
- [ ] Reconsider the `NEXT_PUBLIC_FEATURE_CINEMATIC_PRODUCT` flag: 3D is no longer primary, so cinematic-only-when-flagged is fine to keep, but the secondary slot lives in the default layout too.
- [ ] Test in browser: a 3D-classified product (e.g. a sofa) shows catalog image as hero with 3D thumb; clicking thumb swaps to viewer. A 2D-classified product (e.g. a rug) shows catalog hero with cutout thumb; clicking swaps to cutout.

## Verification gate per phase

Don't move to the next phase until:
- Phase 0: visual reel fixed in browser.
- Phase 1: counts inspected, Phase 4 plan adjusted accordingly.
- Phase 2: typecheck passes; `isMeshableCategory` callers unchanged behaviorally except for RUG.
- Phase 3: tag a product end-to-end on staging; observe the appropriate asset populates within ~30s.
- Phase 4: re-run audit script; "missing" count drops to expected residual.
- Phase 5: detail page hero is catalog image; secondary asset shows for both classifications.

## Out of scope for this spec

- Editorial cutout rail (`EditorialProductCutoutsRail`) — already a display-only component; will pick up the new resolver automatically.
- Re-classifying products that have a free-text `category` not in either bucket — handled by the "unknown → 2D" default.
- The `mesh3dStatus` lifecycle — already covered by `triggerMeshGeneration`.
