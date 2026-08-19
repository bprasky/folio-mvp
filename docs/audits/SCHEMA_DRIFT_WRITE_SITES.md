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

### E. Singles

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
