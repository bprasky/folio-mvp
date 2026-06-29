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
