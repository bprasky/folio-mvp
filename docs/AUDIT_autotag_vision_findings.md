# Audit: Auto-Tag / Vision Current State (for Inline Tagging + Finish Schedule Locate)

> Confirms the current implemented state before applying the "Inline Tagging Surface +
> Finish Schedule Locate" spec delta to `05_WORKFLOWS.md` and `13_IMPORT_AGENT_SPEC.md`.
> Each open item the spec routed to this audit is answered below with the backing code.

## Open items routed to the audit

### 1. Does the current vision call accept a target product list, or open detection only?

**Both modes already exist — targeted locate does not need a new vision call.**

`src/lib/tagging/estimateProductCoordinates.ts` exposes
`estimateProductCoordinates(imageUrl, productNames?)`. When `productNames` is supplied it
instructs the model to match detections against the known list and return coordinates only
for matched products ("Known target, locate on the photo"); with no list it falls back to
open detection. It is **already called in targeted mode** by the auto-tag route:

- `src/app/api/posting/project/[projectId]/auto-tag/route.ts:244` —
  `estimateProductCoordinates(image.url, productNamesForImage)` then
  `matchProductsToLocations(...)`.

The open-detection import path is separate: `analyzeImage` in `src/lib/import-agent`
(used by `/api/import/analyze`) does open detection + web-search attribution.

**Implication for B2:** `POST /api/import/locate-from-schedule` wraps the existing
`estimateProductCoordinates` targeted mode (+ `matchProductsToLocations`). It is not a
net-new vision surface; it is a new *route* over an existing capability.

### 2. Current nullability of `PendingProductTag.x` / `y`

**Both required.** `prisma/schema.prisma` (model `PendingProductTag`, ~L2297):
`x Float` and `y Float` — non-nullable. There is no `isLocated` field.

**Implication for B3:** migration must widen `x`/`y` to nullable (non-destructive) and add
`isLocated Boolean @default(true)`. Unlocated rows set `x/y = null`, `isLocated = false`.

### 3. Current Tags step route and component

- Route `src/app/project/[id]/setup/page.tsx` mounts **`ProjectCreationModal`** — the Tags
  step is currently a modal, matching the delta's premise.
- Newer inline pieces already exist and are the re-mount targets:
  - `src/app/project/[id]/MediaSection.tsx` — the room-organized media page.
  - `src/app/project/[id]/MaterialsStep.tsx` — chooser: "Upload finish schedule" vs
    "Tag by hand" (spec 20 §3d). The finish-schedule path already POSTs to
    `/api/import/finish-schedule` (`MediaSection.tsx:198`).

**Implication for A1/A2:** the room-organized page and the auto-vs-manual chooser exist.
Net-new work is the **top-of-page auto drop target wired to the locate stage** and the
**per-photo tag list** (beside the photo) with the pending-confirm → confirm affordance.

### 4. Presence of any xlsx or pdf-table parsing today

Libraries are installed (`package.json`): `exceljs`, `papaparse`, `pdf-parse`, `pdf-lib`,
`pdfjs-dist`. But `src/app/api/import/finish-schedule/route.ts` is a **stub** — it uploads
the file to storage and immediately marks the `ImportSession` `COMPLETED`; the parse +
locate work is a `TODO`. The session is also created with `sourceType: 'PRESENTATION'`
because no `FINISH_SCHEDULE` enum value exists yet.

**Implication:** the parse stage must be built, but the parsing libraries are already present.

### 5. Room → ProjectImage relations (to enumerate a room's photos for locate)

Two links exist on `ProjectImage` (`prisma/schema.prisma` ~L558):
- `room String?` — free-text room label.
- `roomId String?` + `assignedRoom Room? @relation("RoomProjectImages", ...)`, inverse
  `Room.projectImages ProjectImage[]` (~L889).

**Implication:** a room's photos are enumerable via the structured relation
(`room.projectImages`), supplying the `projectImageIds[]` the locate route needs.

## Reuse confirmed

- Manual write path: `POST /api/import` `src/app/api/tag-product-to-image/route.ts` exists.
- Pending-tag verify path: `src/app/api/import/pending-tag/[tagId]/verify/route.ts` exists
  (the confirm/correct/dismiss endpoint the per-photo list reuses).

## Net-new work the delta implies (not built here — gated)

1. Schema migration: `FINISH_SCHEDULE` enum value; `PendingProductTag.x/y` → nullable;
   add `isLocated`. (Per CLAUDE.md migration discipline: audit-before-implement done;
   per-migration approval gate still required before applying.)
2. `POST /api/import/locate-from-schedule` wrapping `estimateProductCoordinates` targeted mode.
3. Parse stage for finish schedules (Excel/CSV/PDF table → `{roomLabel, productDescription,
   vendor?, sku?}`), replacing the stub in `/api/import/finish-schedule`.
4. Per-photo tag list UI on `MediaSection`, rendering manual (confirmed) and imported
   (pending-confirm) tags beside each photo.

## Locate miss behavior

> The decision input for how `isLocated` keys off the locate result in the gated step-two
> migration. Derived from the call contract in
> `src/lib/tagging/estimateProductCoordinates.ts`; the validation harness
> (`scripts/validate-finish-schedule.ts`, stage D3) captures the empirical numbers when run
> with `ANTHROPIC_API_KEY` + a real project photo (neither is available in the audit
> environment, so the observed-confidence figures below are marked PENDING a keyed run).

**What a miss returns.** In targeted mode the prompt instructs the model: *"If a product from
the list is not visible, do not include it."* So a miss is **absence from the returned
array** — there is no null coordinate, no empty sentinel, no `found: false`. The return is
`{ description, x, y, confidence }[]` where every returned item has real coordinates
(clamped to 5–95) and a confidence. **Presence-in-the-array is the locate signal; absence is
the miss signal.**

**Confidence is present but is NOT a reliable miss discriminator.** `confidence` is one of
`'high' | 'medium' | 'low'`, and the parser coerces any missing/invalid value to `'medium'`
(`estimateProductCoordinates.ts:79–81`). A hallucinated detection can therefore carry
`medium` or even `high`. Do not gate `isLocated` on a confidence threshold alone.

**The trap to avoid.** `matchProductsToLocations(productNames, detections)` (the helper
auto-tag uses at `auto-tag/route.ts:245`) **always returns a coordinate for every input
product** — unmatched products get evenly-spaced fallback positions (`computeFallbackPositions`),
never null. If `isLocated` were derived from that helper's output, **every** scheduled product
would look located. The locate stage must read the **raw** `estimateProductCoordinates`
output and decide located/unlocated by whether the product description actually matched a
returned detection above the fuzzy threshold. The harness does exactly this in
`scripts/finish-schedule/locate.ts` (`bestDetection()` returns `null` on a miss — no
fallback), deliberately diverging from `matchProductsToLocations`.

**Step-two rule this licenses.**
- `located` = the product's description fuzzy-matched a returned detection (in raw output,
  best across the room's photos) → `isLocated = true`, set `x/y` from the detection, store
  `confidence`.
- otherwise → `isLocated = false`, `x/y = null`, render "place manually".
- `confidence` may be persisted for display/review ordering, but the **gate is
  presence-of-match, not confidence**. (Optional refinement: keep `low`-confidence matches as
  located-but-flagged rather than unlocated.)

**Empirical confirmation (PENDING keyed run).** Harness D3 calls the targeted vision over a
real project photo with a deliberately-absent product (`"vintage red British telephone
booth"`) plus a present hint (`"flooring"`), then prints the raw return and whether the
absent product appears. Expected per the contract: the absent product is **absent** from the
array; the present hint returns with a coordinate. Record the observed confidence on the
deliberate miss vs the true hit here once captured.

## Harness validation results (this environment)

- **CSV** (`scripts/finish-schedule/fixtures/sample-finish-schedule.csv`): parsed clean —
  header detected at row 4 (title rows skipped), section-header rooms tracked, notes column
  borrowed when description empty, `sku`/`vendor` captured; the one row with no description
  landed in `unparsed` with a reason. 8 rows / 1 unparsed.
- **XLSX** (generated with a vertically-merged room cell): parsed clean — merged "Kitchen"
  cell filled down across its rows, header-not-row-1 handled, a vendor-less/sku-less row kept
  as a valid product. 4 rows / 0 unparsed.
- **PDF**: code-complete (pdf-parse v2 `getTable()` primary, positioned-text fallback); not
  exercised in this environment — drop a real PDF finish schedule through the harness to
  validate.
- **Locate (D2)** and **miss check (D3)**: not runnable here (`DATABASE_URL` and
  `ANTHROPIC_API_KEY` both absent). Code mirrors the confirmed call site; run the harness in
  an environment with both to exercise.
