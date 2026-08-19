# Schema drift: Prisma write sites that throw at runtime

**Status:** decisions needed. Two sites fixed; 23 remain.
**Method:** `npx tsc --noEmit`, filtered to `TS2353` on Prisma `*CreateInput` / `*UpdateInput`,
then each field checked against `prisma/schema.prisma`.

## Why these are not type noise

Prisma validates `data` against the model at call time and throws
`PrismaClientValidationError` on an unknown field. Every site below therefore
**fails 100% of the time it executes** — it is not a "mostly works, types are
stale" situation. Several are wrapped in `try/catch` that converts the throw
into a friendly-looking failure message, which is why they have gone unnoticed.

**`TS2353` reports only the first unknown key per object literal.** Fixing one
key often exposes the next. The 23 sites below carry **at least 34 drifted
fields**; the true count is only knowable by fixing and re-running. Treat every
count here as a floor.

## Already fixed (commit `797bdb9c`)

| Site | Was | Resolution |
|---|---|---|
| `src/app/actions/projects.ts:83` | `ProjectPost.createdById` (absent) + `slug` omitted (required) | Dropped `createdById` (no readers; ownership via `projectId` → `Project.designerId`/`ownerId`), added `makeSlug(...)` per the repo's canonical pattern |
| `src/app/api/admin/projects/route.ts:94` | `Project.name` | Renamed to `title` |

`createEditorialDraft` was reachable via `POST /api/projects/[id]/approvals/draft-editorial`
and could never succeed.

---

## Reachability findings (resolves groups A and B)

Both large groups were traced. **Neither is reachable from the product**, so
neither justifies a migration.

### A. Consultation / Atelier — no UI exists at all

- **Zero** `fetch` calls to `/api/consultations` anywhere in the codebase.
- **Zero** pages render it: `find src/app -path "*atelier*"` returns only API
  routes. No `page.tsx` anywhere renders a consultation.
- The single navigation into it, `AtelierCTAs.tsx:20`
  (`window.location.href = '/designer/consultation'`), points at a route that
  **does not exist** — that CTA 404s today.

The surface is **26 files** carrying **106 of the ~1021 tsc errors (~10%)**:

| Path | Route files |
|---|---|
| `src/app/api/developments` | 10 |
| `src/app/api/consultations` | 6 |
| `src/app/api/atelier` | 4 |
| `src/lib/atelier` | 5 |
| `src/app/api/admin/atelier` | 1 |

### B. Vendor rep onboarding — the page is live, but no invite can exist

- `src/app/auth/rep-onboarding/page.tsx` is real and does POST to
  `/api/auth/rep-onboarding/complete` (line 87).
- `PendingRepInvite` **is** in the schema (`prisma/schema.prisma:7323`) with
  `token`, `status`, `vendorOrganizationId`.
- But **nothing anywhere creates one.** Across the whole codebase there is only
  `findUnique`, `findMany`, and `update` — all inside the two rep-onboarding
  routes themselves. Nothing mints an invite or builds the invite URL.
- Both route files open with the comment *"Define PendingRepInviteStatus locally
  since it may not be in Prisma schema yet"* — written defensively against a
  schema the author was unsure of.

So the page is only reachable by hand-constructing a URL whose `inviteId` and
`token` match a row nothing inserts.

> **Conclusion for A and B: do not migrate.** Adding four `Consultation` fields
> and five `User` fields would be migrating the schema to support code that
> nothing can reach — the inverse of the discipline in `CLAUDE.md`. Deleting is
> defensible for both, but that is a product-direction call, not cleanup:
> group A is 26 files and would remove ~10% of the error count in one commit.

## Decisions needed

Default posture: **code follows schema**, since the schema is the migrated truth
and migrations are approval-gated per `CLAUDE.md`. Where a field looks like a
real product capability rather than a typo, adding it is the honest fix — but
that is a migration and a product call, not cleanup.

### A. Consultation / Atelier upgrade pricing — 11 sites, the largest cluster

**Absent fields the code writes:** `ConsultationSelection.isUpgrade`,
`ConsultationSelection.upgradePriceCents`, `Consultation.totalUpgradeCents`,
`Consultation.notes`.

Read-side drift in the same feature (not write sites, but the same cause):

| Code reads | Schema has |
|---|---|
| `UnitType.bedroomCount` | `bedrooms` |
| `UnitType.bathroomCount` | `bathrooms` |
| `UnitType.sqft` | `squareFootage` |
| `UnitTypeRoom.roomType` | `name` / `type` |
| `FinishSlot.slotKey` | `key` |
| `Consultation.notes` | `designerNotes` — but it is `String?` and the code writes an **object**, so this is not a rename |

Sites: `consultations/[id]/chat` (456, 467, 484, 530), `consultations/[id]/selections`
(231, 258, 292, 385), `consultations/route` (159), `consultations/[id]/complete` (96).

> **Decision:** is buyer-facing upgrade pricing a live feature?
> **Yes** → one migration adding `isUpgrade`, `upgradePriceCents`, `totalUpgradeCents`,
> and a Json `notes`; then fix the read-side renames.
> **No** → delete the code. Right now the whole consultation flow is non-functional
> either way.

### B. Vendor rep onboarding — 1 site, 5 absent fields

`src/app/api/auth/rep-onboarding/complete/route.ts:75` writes `isVendorRep`,
`originalInviteEmail`, `workEmail`, `workEmailVerifiedAt`, `vendorOrganizationId`.
**`User` has none of them.** It has `role`, `repShadowProfile`, `vendorRepContacts`.

> **Decision:** this flow is written against a `User` model that does not exist.
> Add the five fields, or the rep-onboarding completion path is dead code.
> Note it runs inside `prisma.$transaction`, so the whole transaction aborts.

### C. Vendor invite candidates — 3 sites

`src/lib/vendor/inviteCandidates.ts`:
- `:121` `VendorInviteCandidate.primaryDomain` — absent (model has `vendorWebsite`, `normalizedKey`)
- `:138` `VendorInviteCandidate.lastSeenAt` — absent (model has `updatedAt`, `firstSeenByDesignerId`)
- `:128` `VendorInviteSignal.candidateId` — **rename** to `vendorInviteCandidateId`; the same
  literal also writes absent `tagId` and omits required `vendorName` / `signalType`

> **Decision:** `candidateId` is a safe rename. The rest needs intent: is `primaryDomain`
> meant to be `normalizedKey`, and is `lastSeenAt` distinct from `updatedAt`?

### D. Product scrape ingest — 1 site, 3 fields

`src/lib/products/upsertProductFromScrape.ts:120` writes `sourceUrl` (schema has `url`),
plus absent `sourceType` and `origin`.

> **Decision:** `sourceUrl` → `url` is safe. `sourceType`/`origin` look like provenance
> the record was meant to carry — add them, or drop them from the create.

### E. Singles — FIXED (commit `d3931a02`), except as noted

| Site | Was | Resolution |
|---|---|---|
| `processInterviewAnswers.ts:117` | required `projectId` missing; `designerId`, `aiConfidence`, `interviewAnswerId` absent | Added `projectId`; dropped the three. Also wrapped the call site in try/catch — it was the only unguarded write in that loop, so the throw aborted the entire run |
| `applyDynamicHero.ts` | `dynamicHeroUpdatedAt` written **and** read; absent | Guardrail now reads `expandedBlocks.living.updatedAt`, which this function already stamps. Behaviour restored, no migration |
| `skeleton/move/route.ts:46` | `roomName` absent; room is the required `roomId` FK | Resolves the name (or a raw id) to a `Room` in the same project; 404s when it does not match |
| `designer/.../selections/route.ts` | `vendorId` absent; required `projectId` missing; six client fields silently discarded | Added `projectId`, dropped `vendorId`, now persists `vendorName`, `productName`, `colorFinish`, `phaseOfUse`, `gpsLocation`, `source` |
| `designer/.../selections/[selectionId]/route.ts` | `vendorId` written and read | Dropped from both |

**Still open in group E:**

- **`Selection.vendorId` needs a product decision, not a mapping.** The value comes
  from a free-text *"Vendor ID (optional)"* input. `vendorRepId` and
  `vendorProductId` are foreign keys — free text would dangle — and `vendorName`
  is a guess about intent. The write is dropped for now, so the routes work;
  either map the input deliberately or remove it from the UI.
- **`vendor/claim-product/route.ts:75`** — `Product.vendorRecordId` and `status`.
  `Vendor` is a real model (`schema.prisma:7286`), but `Product.vendorId` points
  at **`User`**, not `Vendor`. Attaching a claimed vendor needs a **new FK**, i.e.
  a migration. Not a code fix — left alone.
- **`init-db/route.ts:81,99`** — `Event.type` vs `eventTypes` (array). Dev/seed
  route, lowest priority, untouched.

### E. Original inventory

| Site | Field(s) | Schema has | Note |
|---|---|---|---|
| `src/lib/editorial/processInterviewAnswers.ts:117` | `AttributeVerification.designerId`, `aiConfidence` | `projectId`, `imageId`, `attributeType`, `aiValue`, `verified` | **On the interview path.** `designerId` is derivable via project |
| `src/lib/living/applyDynamicHero.ts:79` | `ProjectPost.dynamicHeroUpdatedAt` | `updatedAt` | Lean drop unless a hero-specific timestamp is genuinely wanted |
| `src/app/api/living/skeleton/move/route.ts:46` | `SkeletonItem.roomName` | `roomId`, `room` | Comment says the denormalized label is deliberate ("do NOT mutate ProjectImage.room") — so probably **add** `roomName String?` |
| `src/app/api/vendor/claim-product/route.ts:75` | `Product.vendorRecordId`, `status` | `vendorId`, `scrapeStatus` | Confirm whether `vendor.id` is a `User` (Product.vendor is `User?`) before renaming |
| `designer/projects/[id]/rooms/[roomId]/selections/{route,[selectionId]/route}:47` | `Selection.vendorId` | `vendorRepId`, `vendorProductId`, `vendorName` | Which one was meant? |
| `src/app/api/init-db/route.ts:81,99` | `Event.type` | `eventTypes` (array) | Dev/seed route — lowest priority |

---

## Suggested order

1. **B (rep onboarding)** and **A (consultations)** — whole features currently inert.
2. **E: `processInterviewAnswers`** — on the interview path we are actively working.
3. **D, C** — ingest provenance.
4. **E: remainder**, then `init-db` last.

## What is not claimed here

Reachability was verified only for `createEditorialDraft`. The other sites are
confirmed **invalid**, not confirmed **reached** — some may sit in paths nothing
calls. Worth checking per group before writing a migration for a dead feature.
