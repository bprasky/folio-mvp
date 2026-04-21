---
name: vendor_product_match_scores has orphan-risk columns without FK constraints
description: During Phase 5H2 introspection, vendor_product_match_scores in prod has vendorId/productId/projectId/eventId scalar columns that logically point at other tables, but no FK constraint enforces those references. Orphan rows possible. Documented for future cleanup.
type: project
---

# vendor_product_match_scores — missing FK constraints (Phase 5H2)

## Decision

During Phase 5H2's `information_schema.referential_constraints` introspection, the `vendor_product_match_scores` table in prod was found to have **only 1 FK constraint** (`designerId → users.id`), despite having 4 additional columns that logically reference other tables:

- `vendorId` — logically points at `vendors.id` (or possibly `users.id` per historical vendor-as-user pattern; see `migration_phase5h2_vendor_product_atelier_drift.md`)
- `productId` — logically points at `products.id`
- `projectId` — logically points at `projects.id`
- `eventId` — logically points at `events.id`

**None of these have FK constraints in prod.** Phase 5H2's record-existing-state migration (`20260421103005_record_bucket_b_vendor_product_match_scores`) faithfully mirrors prod — only emits the one `designerId` FK. Shadow DB matches prod.

**Why:** either intentional (designer wanted loose pointers that survive parent deletion without CASCADE behavior), or an oversight in the original hand-managed DDL. Without product/architectural context, I can't tell which. Either way, adding FK constraints in a future phase is non-trivial:
- `vendorId`'s target table is ambiguous (vendors vs users — related to the Vendor↔Product drift memo)
- Adding `ON DELETE CASCADE` could delete match-score rows when a product/project/event is deleted, which may or may not be desired
- Adding `ON DELETE SET NULL` requires the columns to be nullable (currently `vendorId`/`productId` are NOT NULL)

**How to apply:**
- If a future feature depends on FK-enforced referential integrity for these columns: query prod for orphan rows first (`SELECT COUNT(*) FROM vendor_product_match_scores m LEFT JOIN products p ON m.productId = p.id WHERE p.id IS NULL` and similar for each). If orphans exist, clean them up or add CASCADE.
- Clarify `vendorId`'s intended target (vendors vs users) before adding its FK — part of the broader Vendor↔Product drift resolution.
- Not urgent. App code currently uses Prisma Client which won't enforce cross-column integrity either way.

## Other Phase 5H2 tables — FK coverage notes

For reference, the other 12 Bucket B tables have all expected FKs (lifted from prod via introspection):
- `project_product_tags`: 3 FKs (productId, projectId, projectImageId)
- `meeting_notes`: 1 FK (projectId)
- `vendors`: 0 FKs (leaf node; `userId` column exists without FK — similar orphan-risk, but less critical)
- `vendor_preview_tokens`: 3 FKs (productId, projectId, vendorId)
- `pending_rep_invites`: 5 FKs (designerId, projectId, projectTagId, repUserId, vendorOrganizationId)
- `room_intents`: 1 FK (projectId; `roomId` column has no FK)
- `project_lifecycle_scores`: 1 FK (designerId; `projectId` has no FK)
- `project_intents`: 1 FK (projectId)
- `designer_activity_profiles`: 1 FK (designerId)
- `proximity_to_purchase_indicators`: 1 FK (designerId)
- `follows`: 2 FKs (followerId, followingId)
- `editorial_drafts`: 1 FK (projectId)

The FK-missing pattern on scalar ID columns is common across these hand-managed tables — likely all created during a period when FK constraints were sometimes skipped for deployment speed. Could be a single future-phase sweep rather than 13 separate fixes.
