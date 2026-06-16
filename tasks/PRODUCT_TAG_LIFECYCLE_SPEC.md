# Product Tag Lifecycle — Designer enrichment → Vendor ownership

How a product tagged from a pasted link travels from a designer-created stub to
a vendor-owned, searchable catalog entry. Phase 1 is built; Phases 2–4 are
specced here for sequencing.

## The lifecycle

1. **Designer tags + edits.** A pasted link creates an UNCLAIMED `Product`
   (`vendorId: null`, `isPending: true`). The designer can fill/correct its
   fields. We persist every value; the tag records who/where it was used.
2. **Vendor claims their brand/account.** Ownership of matching products turns
   over: `vendorId` is set, and edit rights move to the vendor.
3. **Vendor review queue.** The vendor sees the designer-created products
   attributed to their brand and confirms/corrects each.
4. **Cascade.** Because tags share one canonical product row, a vendor's
   confirmed values are seen by every existing tag immediately.
5. **Steady state.** Vendor owns review of new tags; ideally uploads their own
   catalog so products are first-class and searchable.

## Core invariants (decided with founder)

- **Canonical dedup by normalized URL.** All tags of the same product URL point
  at ONE `Product` row (reuse the `normalizeProductUrl` + `CachedProduct` key
  that already exists). This makes cascade free.
- **Add-only merges during the designer phase.** When a second designer tags an
  already-existing unclaimed product, they may **add** missing fields (fill
  blanks) but must **never overwrite or clear** a field another designer already
  populated. Only the vendor (canonical authority, post-claim) may overwrite.
- **Never lose tag count or attribution.** Dedup collapses *products*, never
  *tags*. Each tag keeps its own row with designer / project / image / position.
  The number of tags and who created them must survive dedup intact.

## Phase 1 — designer edit of unclaimed products  ✅ BUILT

- `PUT /api/products/[id]`: an UNCLAIMED product (`vendorId === null`) is
  editable by any signed-in user; a CLAIMED product stays vendor/admin-only.
  `category` added to the accepted/persisted fields.
- Tagging UI: pencil button on each tag opens an edit modal (name, brand, price,
  category, description, image URL); saving clears the "needs review" flag. The
  deferred "needs review" amber tags are now fixable.
- No schema change, no dedup yet — each paste still creates its own row, so the
  add-only rule does not bite until Phase 4.

## Phase 2 — claim turnover  ✅ BUILT (auto, domain-match only)

- Hooks into the existing vendor claim flow (`POST /api/vendor/claim`), right
  after the org transitions UNCLAIMED → CLAIMED. `Product.vendorId` is a `User`
  FK, so turnover sets `vendorId = session.user.id` (the claiming user), matching
  how vendors own products they create.
- **Deterministic domain match only** (`src/lib/vendor/claimTurnover.ts`): an
  unclaimed product turns over iff its URL's registrable domain equals one of the
  org's verified domains — the *same* `inferVendorDomains(orgId)` set that
  authorized the claim in `canClaimOrganization`. Fuzzy brand-name matches are
  intentionally excluded (no false turnovers).
- **Attribution preserved:** only `Product.vendorId` changes; tags are never
  read or written, so tag count and per-designer attribution survive intact.
- After turnover the Phase 1 gate already enforces vendor-only edits on the now
  claimed products. Best-effort: a turnover failure never blocks the claim.
  Response returns `productsAssigned`.
- **Not done (deferred):** brand-only matches (no domain) are left unclaimed —
  they belong in the Phase 3 admin review queue. A future indexed
  normalized-domain column would let turnover filter in SQL instead of scanning
  unclaimed-with-URL products (fine at MVP scale today).

## Phase 3 — vendor review queue  ✅ BUILT

- New `ProductClaimCandidate` model (`@@map("product_claim_candidates")`): one row
  per (product, org). String `matchType` ("DOMAIN"|"BRAND") and `status`
  ("PENDING"|"CONFIRMED"|"REJECTED") — String, not enums, so the migration is a
  single idempotent `CREATE TABLE`/`CREATE INDEX` with no `CREATE TYPE`.
  Migration `20260616120000_add_product_claim_candidate` (hand-authored
  idempotent SQL; FK names match Prisma convention to avoid drift).
- Phase 2 turnover now also writes this table: DOMAIN matches → CONFIRMED rows
  (full turnover audit trail); brand-only matches → PENDING rows for review
  (not assigned).
- `GET/POST /api/vendor/review-queue` (scoped + authorized via
  `getVendorContext`): lists PENDING candidates with tag-usage attribution
  (tag count + distinct designers, read-only from `ProjectProductTag`). Confirm
  → set `Product.vendorId`, mark CONFIRMED. Reject → mark REJECTED (stays
  unclaimed, won't resurface). Correct = existing PUT once owned.
- Vendor-facing surface at `/vendor/review` (`ReviewQueueClient`).
- Tag rows are never read for mutation or written — attribution preserved.
- **Note:** migration is committed but applied by the deploy pipeline
  (`migrate deploy`), not from the dev container (no DB connection here).

## Phase 4 — canonical dedup + cascade

### Dedup on create  ✅ BUILT (forward-looking; backfill deferred)

- `POST /api/products` normalizes the URL (`normalizeProductUrl`) and
  `findFirst`s an existing product for it. Found + UNCLAIMED → reuse that row and
  **add-only** merge any blank fields the new paste supplies. Found + CLAIMED →
  reuse read-only (no edit). Else create. Returns `deduped: true` on reuse.
- **Add-only merge rule:** a field is written only when `incoming` is non-empty
  AND `existing` is null/blank — never overwrite a populated field. `name` only
  replaces the `"Untitled product"` placeholder.
- **Tag preservation:** tag creation is unchanged and always points at the
  canonical product id. Dedup never reads, deletes, or merges tag rows, so tag
  count and per-designer attribution are fully preserved.
- **Canonical-URL storage fix:** both POST and PUT now store the normalized URL
  in `product.url`. This was also a latent bug fix — `getProductById` enriches
  via `cachedProduct.findUnique({ url: product.url })`, which only hit when the
  stored URL was already query-stripped. Variant query-params collapse to one
  product, consistent with how `CachedProduct` already caches.

### Still to do

- **Backfill of historical duplicates — NOT needed.** Founder confirmed there
  are no duplicate product rows, so there is nothing to merge. Dedup is purely
  forward-looking.
- **Optional one-time URL normalization (low priority):** pre-change rows store
  the raw URL. If any existing `product.url` carries query params, a future
  paste of that same product would normalize, miss the raw row, and create one
  new duplicate. A 1-line `UPDATE` stripping `?...` from existing `product.url`s
  closes that (and lets old rows hit the CachedProduct enrichment join). Run
  only if a stray dup ever appears — not worth a gated migration up front.
- **Unique index** on normalized `product.url` to close the concurrent-paste
  race (two first-time pastes can still create two rows). Schema change → gated.
- **Cascade** then works end-to-end: vendor edits the shared row; all tags see
  it. (Already true for any tags sharing a row today.)
- **Per-field provenance:** under a shared row, a designer's add-only edit is
  visible on every tag. Intended for enrichment, but argues for a
  `ProductFieldEdit` log (who set what) + a verified flag before cascade — see
  Phase 3 and the risks below.

## Risks / decisions still open

- Brand→vendor matching key (Phase 2) — must be deterministic + admin-gated.
- Per-field provenance: do we need a `ProductFieldEdit` log to show the vendor
  who supplied each value, and to support audit? Likely yes by Phase 3.
- Add-only across designers can still surface a bad value to everyone. Consider
  a lightweight confidence/verified flag per field before cascade-visibility.
