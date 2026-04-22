---
name: Phase 5D phantom code deletions (Bucket C + D cleanup)
description: Deleted 6 phantom `prisma.<model>` app code references — tables never existed in prod, migrations, or schema.prisma. Closes Phase 5C triage: Buckets A+B restored in 5H1/5H2, C+D deleted here. Per-file removal rationale so future engineers don't resurrect the code.
type: project
---

# Phase 5D phantom code deletions

## Decision

Deleted app code that referenced Prisma models for tables that do not exist anywhere — no prod table, no migration folder, no schema.prisma declaration. All calls would have thrown `Cannot read properties of undefined (reading 'X')` at runtime. Phase 5C triage memory (`migration_phase5h_restoration_triage.md`) had classified these as Bucket C (5 models, pure phantom) and Bucket D (1 model, stranded loose SQL).

**Why:** deleting dead code removes "Cannot read properties of undefined" silently-failing code paths, shrinks the TS error surface, and prevents future engineers from adding callers to phantom Prisma delegates thinking "surely this works somewhere." Buckets A+B were restorable because tables existed; C+D had no underlying tables, so deletion was the only correct resolution.

**How to apply:**
- Before adding a new `prisma.<model>.X` call, verify the model is declared in `schema.prisma`. Do not assume.
- If resurrecting any of these features: first add the Prisma model + backing table, then add the schema declaration, then the call site. Do not scaffold app code ahead of schema. (The pattern that created these phantoms in the first place.)
- For `projectMember` specifically: the owner-only access pattern in `assertProjectAccess` (`src/lib/permissions.ts`) is now the sole membership check. If organizational project access is needed, add ProjectMember model + table before restoring the lookup.
- For `vendorDiscoveryBudget`: spend-tracking infrastructure was deleted (`applySignalSpend.ts`, `priceSignal.ts`). Restoration requires the full VendorDiscoveryBudget model + table + the existing `collaborationStatus`/`spendPerSaveUsd`/`spendPerClickUsd`/`budgetCapUsd` fields on ProjectParticipant. Git history before commit closing Phase 5D preserves the prior implementation.

## What was deleted

### File-level deletions (4 files)

| File | Lines | Reason |
|---|-:|---|
| `src/app/api/3d-assets/route.ts` | 225 | Entire route was about 3D assets; `prisma.threeDAsset` never existed |
| `src/app/api/3d-assets/[id]/route.ts` | 166 | Same |
| `src/app/api/projects/[id]/unreal-export/route.ts` | 168 | Route exported 3D assets for Unreal Engine; no data to export |
| `prisma/migrations/add_vendor_invite_contacts.sql` | (3172 bytes) | Orphan loose SQL at migrations root; never in a timestamped folder, never tracked by Prisma, never run |
| `src/lib/spend/applySignalSpend.ts` | 165 | Vendor discovery budget spend-tracking; 0 callers in src/; pure orphan infrastructure |
| `src/lib/spend/priceSignal.ts` | 97 | Only caller was applySignalSpend (also deleted); transitively orphan |

Empty parent directories removed: `src/app/api/3d-assets/`, `src/app/api/3d-assets/[id]/`, `src/app/api/projects/[id]/unreal-export/`.
`src/lib/spend/` retained — still contains `resolveCollaboration.ts`.

### Block-level edits (5 files modified)

1. **`src/app/actions/projects.ts`** — deleted 30 lines of commented-out `/* TODO: Generate affiliate links... */` block (L323-352). Already dead code (inside block comment). Comment block referenced a never-declared `AffiliateLink` model.

2. **`src/lib/analytics.ts`** — deleted the "Try database first" try/catch block (30 lines). Originally attempted `prisma.analyticsEvent.create` with a defensive runtime guard. Storage fallback path (Supabase Storage bucket) is now the sole persistence layer. Function signature and exports preserved.

3. **`src/lib/permissions.ts`** — replaced `prisma.projectMember?.findFirst?.()` membership lookup with `const hasMembership = false;`. Runtime behavior unchanged (optional chain was resolving to `undefined` at runtime). `assertProjectAccess` now enforces owner-only access.

4. **`src/app/api/vendor/collaborations/route.ts`** — replaced the `prisma.vendorDiscoveryBudget.findUnique()` call with `const budget: { ... } | null = null;`. Downstream code uses optional chaining and conditional returns, so null flows through safely. Budget reporting in the API response is now always null.

5. **`src/lib/vendor/inviteCandidates.ts`** — deleted the `prisma.vendorInviteContact.upsert` block (L141-176) inside `captureVendorInviteData`. The function's core vendorInviteCandidate upsert (real Bucket B model, restored in Phase 5H2) remains. Return type updated from `{ candidateId, created, contactCreated }` to `{ candidateId, created }` — `contactCreated` field was never referenced by any caller.

## Metrics

- Phantom `prisma.<model>` call sites removed: **20** (threeDAsset ×9, vendorDiscoveryBudget ×5, analyticsEvent ×1 active + 1 warning, projectMember ×1, affiliateLink ×1 in dead comment, vendorInviteContact ×1)
- Files deleted: **6** (4 src/ + 1 orphan SQL + 2 lib/spend/*)
- Files modified: **5**
- Empty directories removed: **3**
- Lines removed from codebase: ~900+
- TS errors: 1095 → 1068 (−27) post-5D

## State after Phase 5D

- All 6 phantom models: no app code references remain in `src/`
- `prisma validate` / `generate` / `migrate status`: unchanged (we didn't touch schema or DB)
- Phase 5C triage fully addressed: 22 Bucket A restored (5H1) + 13 Bucket B restored (5H2) + 6 Bucket C/D deleted (5D)
- 35 models restored + 6 phantoms cleaned = all 41 dangling references from Phase 5C resolved
