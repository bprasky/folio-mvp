---
name: Atelier enum taxonomy deferred (Tier B, 5B.2 and 5B.3)
description: AtelierRelationType and AtelierSignalSourceType have divergent value sets between schema.prisma and prod — deferred from Phase 5B to post-launch product decision
type: project
---

During Phase 5B recon on 2026-04-20, two atelier enums surfaced as not-a-superset diffs — genuine taxonomy disagreement between schema.prisma and prod, not a simple drift:

**AtelierRelationType**:
- schema.prisma: `PROJECT_ROOM_FOCUS, FREQUENT_VENDOR, PREFERS, STYLE_MATERIAL, STYLE_COLOR`
- prod: `PREFERS, FREQUENT_VENDOR, USES_MATERIAL, PROJECT_ROOM_FOCUS, COLOR_TENDENCY, EMERGING`
- Likely renames: `STYLE_MATERIAL ↔ USES_MATERIAL`, `STYLE_COLOR ↔ COLOR_TENDENCY`; plus `EMERGING` in prod only.

**AtelierSignalSourceType**:
- schema.prisma: `PROJECT, SELECTION, SAVE, TAG, INTERVIEW, BEHAVIOR`
- prod: `ONBOARDING, PROJECT, PROJECT_TAG, MOODBOARD, PRODUCT_TAG, EVENT, BEHAVIOR`
- Overlap only on `PROJECT` and `BEHAVIOR`; everything else diverges.

**Data state at defer time (2026-04-20):**
- `atelier_edges` (plural, Phase 2 stub): 0 rows — no data risk either way.
- `atelier_signals` (plural, Phase 2 stub): 8 rows using values `[PRODUCT_TAG, PROJECT]`. `PRODUCT_TAG` exists in prod enum but is NOT in schema.prisma. Reconciling toward schema.prisma would orphan those rows.
- `atelier_edge` / `atelier_signal` (singular legacy tables): exist but row counts not yet queried; outside Phase 5 scope until the singular-vs-plural question is resolved.

**Why:** This is a product decision (which taxonomy reflects current atelier/taste-graph design intent), not a migration decision. Forcing one direction now would either (a) write an enum value set into prod that the product owner hasn't confirmed, or (b) edit schema.prisma to codify an older taxonomy that may be wrong. Both risk having to reverse it post-launch.

**How to apply:** Defer until post-launch taste-graph work exercises the atelier pipeline under real load. At that point, founder or whoever owns atelier semantics picks one taxonomy, then one migration updates prod (ALTER TYPE ADD VALUE + possibly a separate data migration to rename values in `atelier_signals.sourceType`), and one schema.prisma edit brings the model declarations in line. Do NOT treat either enum as "broken" today — schema.prisma expects one set, prod enforces another, and nothing in active code hits the uncovered paths in the 8-row data set.

When this debt is picked up:
1. Product owner picks authoritative taxonomy (proposals: schema.prisma-side, prod-side, or merged).
2. If prod-side wins: edit schema.prisma to match, no DDL needed, run `prisma generate`.
3. If schema-side wins: author a fix migration that adds the schema-side values, then data-migrates existing rows (the 8 `atelier_signals` rows using `PRODUCT_TAG`) to the new taxonomy, then optionally drops the obsolete prod values (requires recreating the enum type — heavy).
4. Update this memory to remove the deferred status.
