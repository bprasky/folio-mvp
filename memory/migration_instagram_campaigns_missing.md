---
name: instagram_campaigns / instagram_campaign_posts models declared but no migration creates them
description: schema.prisma has InstagramCampaign + InstagramCampaignPost models, but no migration folder on disk creates the tables and they do not exist in prod — separate drift from the 43 audited
type: project
originSessionId: f64d0e6e-708a-4b36-9718-25c639f06dcb
---
As of Phase 4 Deploy #3 (2026-04-17), `schema.prisma` declares `model InstagramCampaign` and `model InstagramCampaignPost`, but:
- Neither `instagram_campaigns` nor `instagram_campaign_posts` table exists in prod.
- Grep across all `prisma/migrations/*/migration.sql` files returns **zero** matches for these table/model names.
- The `20260303000000_add_instagram_exports` migration only creates `instagram_exports` (single table). It does not touch campaigns.

**Runtime impact correction (2026-04-17, post-recon):** An earlier note in Deploy #3's report claimed code paths using these models were 500'ing in prod. That was wrong. A grep-audit found:
- Zero `prisma.instagramCampaign.*` callers in `src/`.
- Exactly one `prisma.instagramCampaignPost.*` caller: `src/app/api/projects/[id]/rooms/[roomId]/route.ts:164` — an `updateMany` to cascade room renames. It's **already wrapped in a try/catch** that explicitly acknowledges the table may not exist and logs a warning (`InstagramCampaignPost cascade skipped (table may not exist):`). No user-facing errors.

Same pattern as the ParticipantSide drift resolved in Deploy #2 (silent schema vs prod divergence), but not blocking any of the Phase 4 migrations (they don't reference the campaign tables) and not causing runtime errors today either.

**Why:** Pure silent drift. schema.prisma was extended with the models at some point without the companion migration folder being merged. May have been introduced on a cloud-thread branch that touched schema.prisma but not migrations, or lost in a merge.

**How to apply:** During Phase 5 hardening, author a dedicated fix migration (pattern: `<ts>_add_instagram_campaigns`) that creates both tables based on the current `schema.prisma` declarations. Introspect `model InstagramCampaign` and `model InstagramCampaignPost` in schema.prisma for the exact column/FK/index shape — do not guess. Use the same stub-folder pattern as Phase 2's authored migrations (idempotent guards, `CREATE TABLE IF NOT EXISTS`, etc.). Once the fix migration is applied, the editorial-curator-adjacent feature code that references campaigns will stop 500'ing.
