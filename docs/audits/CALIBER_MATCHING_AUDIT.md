# CALIBER MATCHING — AUDIT

Read-only. No code was changed. Scope holds honoured: homeowner consent, address-tier
targeting, and the resale/Zillow partnership are out of scope and are not analysed here.

**The governing risk, stated once and then tested against the data:** if caliber collapses
into "how expensive," this rebuilds the aspiration filter. The finding that matters most in
this report is that the codebase **already contains a working price-posture classifier**
(`analyzePricePattern`), it is **already the only caliber-shaped computation that exists**,
and it **already fails in the exact direction the risk predicts** — it returns a confident
middle band for designers who have no price data at all. The second axis is not a nice-to-have.
It is the difference between shipping this and shipping the thing it was built to replace.

---

## Summary

**C1. There is no location audit file in this repository.** No `*LOCATION*` document exists
on any branch, in `docs/`, `docs/audits/`, `tasks/`, or `memory/`, and none appears in
`git log --all --diff-filter=A`. The nearest prior work is
`docs/audits/BODY_OF_WORK_AUDIT.md` **§1 finding B4**, which lives on
`origin/claude/body-of-work-audit-fyd7se` and has **not landed on main**. Its conclusions are
restated and independently re-verified in §1 below. If a location audit exists outside the
repo, §1's precision findings still stand on their own — they were re-derived from source.

**C2. Location precision today is one free-text field, and it is coarser than a pin, not
finer.** `Project.city` is a single optional input whose placeholder is literally
`"City, country"` (`projects/new/page.tsx:1022-1024`). `Project.regionState` is written as
`null as string | null` on the primary create path (`:164`). There is no latitude, longitude,
postal code, parcel, or neighbourhood column anywhere on `Project`. A radius pin would be a
**precision increase** over the status quo, which is the one genuinely new exposure question
and is addressed in §1.

**C3. Area value is not sparse. It is absent.** There is no square-footage column on
`Project` and no project cost field of any kind. `Project.budgetBand` — the only project-level
price enum — is written `UNSPECIFIED` **unconditionally** by the legacy create path, under a
comment that says so (`normalizeCreatePayload.ts:82`: *"budget band removed from form"*). A
price-per-square-foot cannot be derived at any resolution because neither operand exists.

**C4. The existing price classifier reports "balanced" from zero evidence.**
`analyzePricePattern` (`extractDesignerReasoning.ts:468-494`) counts `unknown` in its
denominator. A designer whose selections all lack a price yields
`luxuryPremiumRatio = 0`, `valueRatio = 0`, `|0 − 0| < 0.2` → **`"balanced"`**. The
`"context_dependent"` value that would be honest is returned only for the empty-array case.
This mislabels precisely the designers the product exists to surface. Detail in §3.

**C5. There is a real second axis, and it is already selected by the corpus query.** Room
count, included-photo count, product-tag count, distinct product categories, and distinct
*confirmed* finishes are all counts over FK / enum / integer columns — direct matches in
`BODY_OF_WORK_AUDIT.md` §2's sense — and none of them is a price. They measure how much of a
project the designer actually resolved and documented. `fetchRawCorpusLayer.ts:36-98` already
selects every input. Detail and caveats in §2.

**C6. Reader banding is not possible on current data, and the gap is structural.** Post-level
saves are recorded **nowhere**: `post_saves` has no migration, and `getHomepageData.ts:166-172`
documents that joining to it **500'd the homepage**. Dwell does not exist — `logStorySignal`,
which declares `ROOM_DWELL`, has **zero callers**. The passive-analytics sink writes JSONL to a
Supabase Storage bucket **partitioned by project, not by user**, via a lossy
download-concatenate-reupload. `/api/signals/save` requires authentication, so anonymous
readers emit nothing. Detail in §4.

**C7. The front cover is already structurally safe.** The homepage hero is a curated editorial
slot (`homepageXlStartsAt/EndsAt`), and engagement-weighted ordering was **deliberately
removed** (`getHomepageData.ts:166-173`). The best-of-the-best hook is independent of any
matching, so matching the feed cannot seal the ceiling. Nothing must be built to protect it.

**C8. The feed has no scorer — this, not banding, is the ladder's real blocker.**
`getFilteredPosts.ts` is one `where` plus `orderBy: { publishedAt: 'desc' }` with a
timestamp cursor. A "show up, not just across" rule is a *composition* rule, and composition
cannot be expressed against a `publishedAt < cursor` page. Detail in §5.

**C9. The smallest real first slice is one score, stored, shown to nobody.** Compute the
scope-and-resolution composite per published project and sort the corpus by it. If the top of
that list is the expensive work rather than the resolved work, the second axis has failed and
no feed engineering will rescue it. That check costs one query and is the cheapest possible
test of the product premise. Detail in §6.

---

## 1. Fuzzy pin

### What the earlier audit landed on

There is no location audit in this repository (C1). The prior finding is
`BODY_OF_WORK_AUDIT.md` §1 **B4**, *"Location is a single free-text field and it is the wrong
shape for a place pattern"*, on an unmerged branch. Every claim below was re-verified against
source rather than taken from it.

| what | where | verified |
|---|---|---|
| One optional text input labelled "Location", placeholder `"City, country"` | `src/app/projects/new/page.tsx:1022-1024` | yes |
| Trimmed value goes to `Project.city`; `regionState` written `null as string \| null` | `:163-164` | yes |
| `regionState` settable only via the PATCH allowlist and the modal | `api/projects/route.ts:297`; `ProjectCreationModal.tsx:595` | yes |
| No geocoding, normalization, or autocomplete on the input | grep `geocod\|latitude\|parcel\|postalCode\|zipCode` over `src/`+`prisma/` returns nothing on `Project` | yes |
| A "Year" field sits beside Location and is collected but never written | `page.tsx:1027-1031` vs. the payload at `:155-166` | yes |

The audit's landing: the coarsest grain the data honestly supports is **same `city` string,
exact, case-folded, trimmed**, and it recommended *"a controlled locality on `Project` (a
normalized city/locality pair, or a geocoded id), plus backfill."* That recommendation is
unchanged by anything in this report.

### Can a deliberately coarse pin support area-value inference without identifying a property?

**Yes on privacy. No on usefulness — for a reason that has nothing to do with the pin.**

On privacy the answer is straightforward. A radius pin of roughly 1–2 km resolves to something
near a census tract or ZCTA, which is the unit external area-value data is published at anyway.
Coarse is therefore not a concession made for privacy — it is the natural join grain. A pin
fine enough to identify a parcel would be *worse* at the task as well as more exposing, because
it would resolve below the resolution of any area statistic it could be joined to.

On usefulness the pin is not the binding constraint. **There is nothing to join it to** (§3).
A resolved area with no price signal attached produces a more precise location and no more
inference than the city string already permits. This is the single most important sequencing
consequence in the report and it is carried into §6: building the pin first yields a
well-resolved area and nothing to look up in it.

### The precision-increase caveat

The brief frames the pin as *coarse*. It is coarse relative to a parcel; it is **finer than
what exists today**, which is an unnormalized city blob. So this is not a coarsening of an
existing exposure — it is a new, more precise one. Three constraints follow, and they should be
written into whatever spec follows this audit:

1. **Store the coarsened centroid and radius, never the input.** If an address is typed to
   derive the pin, it must not be persisted. A column that holds the precise input "for later"
   is the address-tier feature this audit was told to hold out of scope, arriving early.
2. **Never render finer than the radius.** A map that zooms past the stated radius discloses a
   precision the pin was defined not to have.
3. **The cross-project inference risk from `BODY_OF_WORK_AUDIT.md` §4 gets worse as the radius
   shrinks.** Two published projects by one designer with tightly overlapping pins imply a
   relationship — same client, same street, same building — that was never itself public, even
   though each project was. The published-only filter passes this, because both projects
   genuinely are public; what was never public is the link. The radius is the mitigation, which
   is a second, independent reason not to let it get small.

### Designer-side, no client consent — confirmed

Confirmed, on four independent grounds:

- **There is no client identity on `Project` at all.** No `clientName`, no `clientId`, no FK to
  a person. The only client-shaped fields are `DesignerDecision.clientBriefExcerpt` and the
  `CLIENT_BRIEF` interview answer, both project-scoped and designer-authored. A pin is
  therefore a designer's statement about their own work, not a record about a client.
- **Location is already public at city grain.** `api/posting/[slug]/route.ts:147-148` returns
  `city` and `regionState` on the published post. The feed already filters on it
  (`getFilteredPosts.ts:49-54`). Publishing place is established behaviour, not a new act.
- **The capture surface is the designer's own create form**, behind their session, on a project
  they own.
- **The consent machinery that exists is designer-side.** `EditorialQueueItem.distributionConsent`
  / `consentScope` (`'feed_only' | 'feed_and_social'`) governs a designer's distribution choice;
  `User.tosAcceptedAt` / `privacyAcceptedAt` are account-level. Neither is a client consent
  record, and none is needed for a designer to say where their own project was.

The caveat is not consent but **inference**, per constraint 3 above: the pin needs no client
permission, and it can still disclose a client relationship in aggregate. That is a radius and
frame-constraint problem, not a consent problem.

---

## 2. What caliber could be inferred from, beyond price

### Structured today

| signal | column | shape | populated by | caveat |
|---|---|---|---|---|
| Project type | `Project.projectType` | enum, 10 values, default `UNSPECIFIED` | create-form picker (`page.tsx:158-160`) | must exclude `UNSPECIFIED`, as `signals.ts:185` already does for budget |
| Client type | `Project.clientType` | enum, 2 values | **derived** from projectType (`page.tsx:161-162`) | **carries no independent information — do not count it as a second axis** |
| Room count | `Room` rows per project | integer | room creation | clean |
| Room type | `Room.type` | **nullable free-text String**; the 24-value list is a *comment*, not an enum | room creation | nothing validates it; string match, not enum match |
| Photo count | `ProjectImage` rows, `inclusion` enum | integer + enum | publish flow | clean; `inclusion` gates what is actually published |
| Product mix breadth | `ProductTag` count, distinct `Product.category` | FK counts | tagging | clean — FK equality |
| Brand range | `Product.brand` | free-text, no canonical list | vendor/product records | "RH" and "Restoration Hardware" are two brands |
| Materials (AI) | `ProjectImage.aiMaterials[]`, `aiSpaces[]`, `aiTags[]`, `aiColors` | String[] / Json, with `indexedAt` | **only** `POST /api/projects/[id]/analyze-images` | fire-and-forget from three designer-side UIs (`ProjectCreationModal.tsx:707`, `MediaSection.tsx:167`, `DesignerBoard.tsx:181`) — **never runs on publish**, so coverage depends on which UI the designer passed through |
| Finish, per specification | `ProductTag.finishRaw` / `finishCanonical` / `finishConfirmed` | String / String / Boolean | tagging + extraction | `finishCanonical` is documented as **deferred** (*"matching rules need real values first"*), so the groupable column is empty; `finishConfirmed` is the only truth flag on any material signal in the schema |
| Material class | derived from `Selection.colorFinish` via `materialClassOf` | 38-term `MATERIAL_CLASSES` | `editorial-queue/signals.ts:36-42` | first-substring-match: `ash` matches "cashmere", `cane` matches "candlestick"; array order saves some collisions by luck and that is not a rule anyone wrote down |

Two entries deserve emphasis. **`finishConfirmed` is the highest-quality material signal in the
schema** — it is the only place where a human-stated fact is distinguished from an extraction
guess, and any caliber measure that counts materials should count confirmed ones. And
**`clientType` must be excluded**: because it is computed from `projectType` at write time, a
model that reads both is reading one field twice and will report false corroboration.

### Would need extraction (free text)

- **The five project interview categories**, always all five present by construction
  (`generateProjectQuestions.ts:28-33`): `CLIENT_BRIEF`, `SCOPE_PARAMETERS`,
  `DESIGN_DIRECTION`, `SIGNATURE_IDENTITY`, `SURPRISE_PIVOT`. Stored as
  `EditorialInterviewAnswer.answerText`, id format `project-<CATEGORY>-<uuid>`, parseable by
  `questionCategory()` (`extractDesignerReasoning.ts:317-320`).
  **`DESIGN_DIRECTION` is the stated-ambition field the brief asks for** — its fallback wording
  is literally *"What was the big idea? When you picture this project, what ties it all
  together?"* — and `SCOPE_PARAMETERS` (*"What were you working within… the space, the
  timeline, the realities that shaped your decisions"*) is the scope companion. Both exist on
  every interviewed project because the five categories are always emitted, LLM path and
  deterministic-fallback path alike.
- **`EditorialInterviewAnswer.inferredPriorities[]` and `softConstraints[]`** — `String[]`,
  already AI-extracted and already structured. **This is the cheapest existing bridge from
  ambition prose to a structured axis** and should be coverage-checked before anyone writes a
  new extractor.
- `ProjectIntent.summary / keyObjectives / constraints / styleTags / moodKeywords / budgetLevel`
  — written by `projectUnderstanding.ts:58` from *meeting notes*, not from the publish flow, so
  present only for projects that passed through the notes tool.
- `DesignerDecision.reasoning / tradeoffs / convictionLevel / isClientDriven` — per-decision,
  designer-authored.

### The recommended second axis

**A scope-and-resolution composite: room count × included-photo count × distinct product
categories × distinct confirmed finishes.**

Four counts over FK / enum / integer columns. All four are direct matches in
`BODY_OF_WORK_AUDIT.md` §2's sense — no model call, no string normalization beyond exact
equality. None is a price. What it measures is **how much of a project the designer actually
resolved and documented**, which is what separates a fully realized suburban renovation from a
thin luxury photoshoot. Every input is already selected by the existing corpus query
(`fetchRawCorpusLayer.ts:36-98`).

Two honest qualifications:

- **It is correlated with budget but not derived from it.** Bigger budgets buy more rooms. The
  claim is not independence; it is that a modest, thoroughly resolved project *can* outscore an
  expensive thin one, which is exactly what a price rename cannot do. §6 proposes the empirical
  check.
- **It partly measures documentation effort, not design quality.** A designer who tags
  diligently scores above an equally good one who does not. That is a real bias and it is at
  least a bias toward *engagement with the platform* rather than toward wealth — but it should
  be stated in whatever ships, not discovered later.

Pair the composite with `DESIGN_DIRECTION` / `SCOPE_PARAMETERS` extraction for stated ambition.
The composite is the floor that needs no new capture; the ambition extraction is the layer that
makes it about the work rather than about the count.

---

## 3. Area value

### Nothing is derivable today, at any resolution

**There is no square footage on a project.** `squareFootage` appears exactly once in
`schema.prisma` (line 3316), on an **Atelier developer unit-type** — a different vertical, tied
to presale listings, not to designer projects. `approximate_sqft` appears in
`spatialFlow.ts:112` inside a floor-plan analysis prompt's JSON shape; it is an LLM output used
for narrative flow, **is not persisted to any column**, and floor-plan analysis is not part of
the publish flow.

**There is no project cost.** The only project-level price field is `Project.budgetBand`, a
5-value enum (`UNSPECIFIED / LOW / MID / HIGH / LUXURY`), and it is effectively dead:

- `normalizeCreatePayload.ts:82` writes `const budgetBand = DEFAULTS.budgetBand` —
  `UNSPECIFIED` — **unconditionally**, under the comment *"budget band removed from form"*.
- The primary create form's payload (`projects/new/page.tsx:155-166`) does not include it.
- It is settable only through the PATCH allowlist (`api/projects/route.ts:297`) or
  `ProjectCreationModal.tsx:595`.
- `computeDistributionSignals` (`signals.ts:185`) skips `UNSPECIFIED` outright. That skip is the
  codebase conceding the column is mostly empty.

So a price-per-square-foot cannot be computed because **neither operand exists**. This is not
sparsity to be measured and worked around; it is absence.

Item-level prices exist but are trade tooling, not publish-flow data: `Selection.unitPrice`
`Decimal(10,2)` (written only at `rooms/[roomId]/selections/route.ts:73,83` and
`[selectionId]/route.ts:58`), `Product.price` `Float?`, and
`ProjectProductPricing.unitPriceTrade / unitPriceRetail`.

### The live defect (C4)

`extractDesignerReasoning.ts` already turns those item prices into a designer-level price
posture, and it is wrong in the direction that matters.

```
inferPricePoint(price)                     // :322-328
  !price            → "unknown"
  >= 5000           → "luxury"
  >= 1000           → "premium"
  >= 300            → "mid-range"
  else              → "value"

analyzePricePattern(selections)            // :468-494
  selections.length === 0 → "context_dependent"
  total              = selections.length         // ← includes "unknown"
  luxuryPremiumRatio = (luxury + premium) / total
  valueRatio         = (value + mid-range) / total
  luxuryPremiumRatio > 0.7          → "investment_focused"
  valueRatio         > 0.6          → "value_conscious"
  |lux − val|        < 0.2          → "balanced"
  else                              → "context_dependent"
```

`priceCounts.unknown` is incremented and **never subtracted from `total`**. For a designer with
selections that all lack a price: both ratios are `0`, `|0 − 0| = 0 < 0.2`, and the function
returns **`"balanced"`**. Absence of evidence is reported as a confident middle posture, and
`"context_dependent"` — the value that would be honest — is reachable only for an empty array.

Two consequences, both squarely on the governing risk:

- Designers with sparse price data are disproportionately those working outside high-spend
  markets and outside vendor-priced trade catalogues. **The classifier hands them a
  manufactured middle band**, and any caliber built on `pricePointPattern` inherits it as a
  silent floor.
- `inferPricePoint`'s cutoffs are **absolute USD with no regional adjustment**. A $1,200 sofa is
  `"premium"` in every market on earth. That is the price-rename failure in miniature, already
  compiled and shipping.

Neither is hypothetical; `populateDesignerReasoning` (`:743`) and
`api/jobs/populate-designer-reasoning` write these values today. **Both should be fixed before
anything reads `pricePointPattern` for caliber**: exclude `unknown` from the denominator, and
return a null/unknown posture below a coverage floor rather than a band.

### Sparsity is not measurable in this environment

`DATABASE_URL` is unset here — the same blocker recorded in `BODY_OF_WORK_AUDIT.md` §3 and
`PROJECT_ANGLE_AUDIT.md` §3. Queries to run against prod are in **Reproduction**.

---

## 4. Reader banding

A non-trade reader is `Role.INDIVIDUAL` (the default for all new signups, per the
Individual-First comment on the enum) or `GUEST`.

### What is user-attributed and queryable

| signal | table | migrated? | written by | fitness |
|---|---|---|---|---|
| Product saves | `saves` | **yes** — `20250814234946_add_engagement_models` | `recordSave` (`intelligence/signals.ts:173`) via `POST /api/signals/save` and the event-scan route | carries `userId`, `productId`, `boardId`, `roomType`, `productAttributes` Json (colors/materials/shapes/styles). **Requires authentication** (`signals/save/route.ts:21-27` → 401) |
| Follows | `follows` | **yes** — `20260421103011_record_bucket_b_follows` | user action **and** `repAutoFollow.ts:124`, which upserts a follow from a vendor rep to every connected designer in a `$transaction` | **polluted** — follow counts are not pure reader intent; rep-generated edges must be excluded |
| Taste profile | `user_taste_profiles` | **no migration found** | `recordSave` / `removeSave` increment `totalSaves` | `styleName`, `confirmedAttributes`, `profileStrength`, `fingerprintVector` — the right *shape* for banding; prod existence unverified |
| Boards | `boards` | **no migration found** | — | yet `prisma.board.findMany` runs live in `users/[userId]/taste-profile/route.ts:42` |

The two "no migration found" rows are not pedantry. **`post_saves` is the precedent for what
happens when a declared-but-unmigrated table is read**: it 500'd the homepage. Confirm prod
existence of `boards` and `user_taste_profiles` before anything reads them for banding.

### What does not exist

**Post-level saves are recorded nowhere.** `PostSave` is declared in `schema.prisma`, but
`post_saves` has **no migration**, and `getHomepageData.ts:166-172` records the incident
directly:

> *Originally this ordered by `postSaves: { _count: "desc" }` to surface highest-engagement
> work, but `post_saves` is part of pre-existing schema drift (declared in schema.prisma, never
> migrated to prod) and joining to it 500'd the homepage on first load.*

The fallback path is worse than it looks: `logPostSave` (`actions/posting.ts:43`) has **zero
callers**, and even if called it writes an analytics blob rather than a row. So there is **no
record anywhere of a reader saving a story** — only of saving a *product*.

**Dwell does not exist.** `logStorySignal` (`actions/posting.ts:66`) declares the full
vocabulary — `ROOM_EXPAND`, `ROOM_DWELL`, `PRODUCT_TAP`, `ROOM_NAVIGATE`, `INBOUND_REFERRAL`,
`TAGS_VIEWED`, `ROOM_IMPRESSION`, `ROOM_PEEK`, `PRODUCT_PEEK` — and has **zero callers**
anywhere in `src/`. It also buckets everything under `type: 'project_create'` ("reuse existing
type bucket"), so even once wired the events would be indistinguishable from project creations
without parsing the payload.

*(Grep warning for whoever follows: the `"dwell"` hits in `detectAesthetic.ts:254` are the
magazine* Dwell*, in a publication→aesthetic mapping. Not dwell time.)*

**The passive-analytics sink cannot be queried.** `logPassiveEvent` (`lib/analytics.ts`) writes
JSONL to a private Supabase Storage bucket by download-file → concatenate → re-upload. Three
consequences:

1. **Not SQL-queryable.** Banding needs aggregation; this needs an ETL first.
2. **Partitioned by project, not by user** — the path is `project-<projectId>.jsonl`. Banding a
   reader means scanning every project file in the bucket. `actorId` is also optional.
3. **Lossy under concurrency.** Read-modify-write with no locking: two simultaneous events on
   one project and the later upload silently drops the earlier.

The comment at `:18-19` notes `prisma.analyticsEvent` was removed in Phase 5D because
`analytics_events` never existed, and that this fallback *"is now the sole code path."*

**Aggregate counters cannot band anyone.** `ProjectImage.momentViews / momentSaves /
momentShares` (written by `api/search/signals/route.ts:53-55`) and `Project.views / saves /
shares` (only `saves` has a writer found, at `events/[id]/scan/route.ts:118`) carry **no
`userId`**. They can rank content; they can never place a person.

### Is there enough to place a reader without asking them?

**No.** A reader can be banded today only if they (a) hold an account, (b) are logged in, and
(c) save products. That is a small, self-selected slice, and product saves speak to **taste**
(`productAttributes`: colors, materials, shapes, styles) rather than to **caliber**. Nothing in
the schema says "this reader is operating at this level."

The honest interim, and it is a real option rather than a placeholder: **band the feed by
caliber and leave the reader unbanded.** Serve a default composition, let saves and follows
move them over time, and never ask. That requires §5's composition layer and none of the reader
signals that do not exist — which makes it the only version of matched-feed that is reachable
from here.

---

## 5. The ladder, not the ceiling

### The ceiling is already safe (C7)

`getHomepageData.ts` resolves the hero in three steps: a pinned post → a calendar-window XL slot
(`homepageXlStartsAt` / `homepageXlEndsAt`, editorially scheduled, app-level uniqueness) → an
algorithmic fallback of the most recent published post in 14 days, labelled *"Editor's Pick"*.
The comment at `:166-173` records that engagement-weighted ordering was **deliberately removed**,
partly for the `post_saves` outage and partly on editorial grounds: *"recency reads editorial;
save-count reads algorithmic."*

**The best-of-the-best hook is a curated slot, structurally independent of any matching.**
Nothing needs to be built to keep it that way, and the aspiration hook survives banding by
construction. This is the most useful fact in this section and it means the ladder work is
purely about the feed body.

### The ladder's real blocker is that there is no scorer (C8)

`getFilteredPosts.ts` in full is: one `where` (`status: 'PUBLISHED'` plus at most one filter),
`orderBy: { publishedAt: 'desc' }`, and a cursor that resolves to `publishedAt < cursorPost.publishedAt`.
There is **no scoring function, no slot allocator, no interleaver anywhere in the feed path.**

Filters available are `category | keyword | location`, and **`location` already exists**:
`city contains value OR regionState contains value`, case-insensitive (`:49-54`), intersected
with `following` when set. So place-filtering the feed is shipped; ranking it is not.

### What a "show up, not just across" rule would need

1. **A band on the post.** No caliber column exists on `Project` or `ProjectPost`.
2. **A band on the reader.** Per §4 — not available, and possibly never needed if the feed is
   banded instead.
3. **An ordering that is not `publishedAt desc`.** This is the underappreciated one. A ladder
   rule is a *composition* rule — "per N posts at band B, one at band B+1" — and composition
   requires slot-aware assembly. A timestamp cursor cannot express it: you cannot say "one rung
   up every fourth card" against `publishedAt < cursor` without either over-fetching and
   re-sorting in memory or replacing the cursor with an offset/seed pair. Both are real changes
   to a pagination contract that the mosaic and `BoostReel` already depend on.
4. **A band-gap policy.** The up-rung must be **one** rung, not the top. Showing a matched
   reader the front cover as their "ladder rung" is the aspiration filter returning under a new
   name — the rule has to cap the gap, not just guarantee a gap exists.

### Recommendation

Put the ladder in a **composition layer** above the query — over-fetch a banded pool, assemble
slots, return a page — and keep the ceiling in the curated slot where it already is. Make the
up-rung post carry a visible reason ("one level up"), so the rule is legible to the reader
rather than a silent reshuffle. A ladder the reader cannot see is indistinguishable from a
ranking they did not ask for.

---

## 6. Ship-now versus needs-data

### Computable today from published data — no new capture

| what | inputs | already available at |
|---|---|---|
| Scope-and-resolution composite | room count, included-image count, `ProductTag` count, distinct `Product.category` | all selected by `fetchRawCorpusLayer.ts:36-98` |
| Distinct **confirmed** finishes per project | `ProductTag.finishConfirmed = true`, grouped | same query; no new column |
| Material-class distribution per project | `materialClassOf` over `Selection.colorFinish` | `editorial-queue/signals.ts:36-42` — implemented and in use, with the substring caveat |
| Project-type distribution | `Project.projectType`, `UNSPECIFIED` excluded | enum equality |
| Place clustering at the honest grain | `lower(btrim(city))` | free-text, exact-folded only |
| Corpus depth per designer | published-story count | already computed as `maturity.publishedStoryCount` |

### Needs the location field

Everything that resolves a project to an area finer than a free-text city — i.e. **every
area-value join**. Requires new columns, a capture control, and backfill of existing rows.

### Needs price capture

**Any area-value number at all** (§3 — absent, not sparse). Requires either designer-entered
project cost and/or area, or an external area dataset joined on a resolved location — and that
second option is itself gated on the location field. This is the longest pole and it should be
scoped as its own workstream, not as a sub-task of the pin.

### Needs reader-behaviour signals

Reader banding, in full (§4). Minimum viable substrate: a queryable, **user-partitioned** event
store replacing the Storage-blob sink; reconciled `post_saves` so story saves are recorded at
all; and some signal from unauthenticated readers, who today emit nothing.

### The smallest real first slice

**Compute a scope-and-resolution score per published project, store it, and expose it to
nobody.**

Four counts over columns the corpus query already selects. No new capture, no schema change on
the capture side, no reader change, no feed change, no user-visible surface. Then sort the
published corpus by it and read the list.

That last step is the point. **It settles the governing question empirically for the cost of one
query:** if the top of the list is the expensive work, the second axis has failed and it has
failed cheaply, before any band was drawn or any reader was matched. If the top of the list is
the *resolved* work — the thoroughly documented suburban renovation ranking above the thin
luxury shoot — then caliber has a real second leg and everything downstream is worth building.
No amount of feed engineering can rescue a composite that fails this check, and nothing else in
this workstream is worth starting until it passes.

**Explicitly not first: the pin.** Per §1, a resolved area with no price signal to look up in it
buys nothing. Location precision is a prerequisite for area value, and area value is a
prerequisite for the pin being useful — so the pin is third in line, not first.

**Two small fixes that should precede or ride along:**

1. **`analyzePricePattern`'s denominator** (`extractDesignerReasoning.ts:468-494`) — exclude
   `unknown`, and return a null/unknown posture below a coverage floor instead of `"balanced"`.
   Until this is fixed, `pricePointPattern` is actively misleading about exactly the population
   this product exists to serve.
2. **Confirm prod existence of `boards` and `user_taste_profiles`** before anything reads them
   for banding. `post_saves` is the precedent: a declared-but-unmigrated table read on a hot
   path took down the homepage.

---

## Reproduction

Environment: `DATABASE_URL` is unset here, so no count in this report is measured — every
sparsity and coverage claim is structural (a column that cannot be written, a caller that does
not exist), never statistical.

### Greps that establish the structural claims

```bash
# C2 — no fine-grained location anywhere on Project
grep -rn "geocod\|latitude\|parcel\|postalCode\|zipCode" --include=*.ts --include=*.prisma src/ prisma/
sed -n '155,170p;1015,1030p' src/app/projects/new/page.tsx      # payload + the "City, country" input

# C3 — budgetBand written UNSPECIFIED unconditionally
sed -n '80,84p' src/app/api/projects/normalizeCreatePayload.ts   # "budget band removed from form"

# C4 — unknown counted in the denominator
sed -n '322,328p;468,494p' src/lib/atelier/extractDesignerReasoning.ts

# C6 — the three absences
grep -rl "post_saves" prisma/migrations/                          # empty
grep -rn "logStorySignal\|logPostSave" --include=*.ts --include=*.tsx src/ | grep -v actions/posting.ts   # empty
sed -n '1,30p' src/lib/analytics.ts                               # Storage JSONL, project-partitioned

# C7/C8 — curated ceiling, no scorer
sed -n '150,190p' src/lib/homepage/getHomepageData.ts
sed -n '30,90p' src/lib/magazine/getFilteredPosts.ts
```

### SQL to run against prod

```sql
-- Is there ANY price signal? (§3 — expected: near-zero non-UNSPECIFIED)
SELECT p."budgetBand", COUNT(*)
FROM projects p JOIN project_posts pp ON pp."projectId" = p.id
WHERE pp.status = 'PUBLISHED'
GROUP BY 1 ORDER BY 2 DESC;

-- Item-level price coverage, per published project (§3)
SELECT p.id,
       COUNT(s.id)                                        AS selections,
       COUNT(s."unitPrice")                               AS priced,
       ROUND(100.0 * COUNT(s."unitPrice") / NULLIF(COUNT(s.id),0), 1) AS pct_priced
FROM projects p
JOIN project_posts pp ON pp."projectId" = p.id
LEFT JOIN selections s ON s."projectId" = p.id
WHERE pp.status = 'PUBLISHED'
GROUP BY p.id ORDER BY pct_priced NULLS FIRST;

-- Blast radius of the C4 defect: designers who would be scored "balanced" from no data
SELECT p."designerId",
       COUNT(s.id) AS selections,
       COUNT(s."unitPrice") AS priced
FROM projects p
JOIN selections s ON s."projectId" = p.id
WHERE p."designerId" IS NOT NULL
GROUP BY 1 HAVING COUNT(s.id) > 0 AND COUNT(s."unitPrice") = 0;

-- The first slice: the scope-and-resolution composite, ranked (§6)
SELECT p.id, p.title,
       COUNT(DISTINCT r.id)                                          AS rooms,
       COUNT(DISTINCT i.id) FILTER (WHERE i.inclusion = 'INCLUDED')   AS photos,
       COUNT(DISTINCT t.id)                                          AS tags,
       COUNT(DISTINCT pr.category)                                   AS categories,
       COUNT(DISTINCT lower(btrim(t.finish_raw)))
         FILTER (WHERE t.finish_confirmed)                           AS confirmed_finishes
FROM projects p
JOIN project_posts pp ON pp."projectId" = p.id AND pp.status = 'PUBLISHED'
LEFT JOIN rooms r          ON r."projectId" = p.id
LEFT JOIN project_images i ON i."projectId" = p.id
LEFT JOIN product_tags t   ON t."imageId"   = i.id
LEFT JOIN products pr      ON pr.id         = t."productId"
GROUP BY p.id, p.title
ORDER BY rooms + photos + categories DESC;
-- Then read the top 20 by hand. Expensive work, or resolved work? That is the whole test.
-- finish_raw, not finish_canonical: the canonical column is documented as deferred (§2)
-- and is therefore empty, so grouping on it would silently return zero for every project.

-- Reader-signal reality check (§4)
SELECT COUNT(DISTINCT s."userId") AS users_with_saves FROM saves s;
SELECT COUNT(*) AS rep_generated_follows
FROM follows f JOIN users u ON u.id = f."followerId" WHERE u.role = 'VENDOR';

-- Are the unmigrated tables actually in prod? (§4 — run BEFORE reading them)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('post_saves','boards','user_taste_profiles');

-- How dirty is the city column? (§1)
SELECT COUNT(DISTINCT p.city) AS raw, COUNT(DISTINCT lower(btrim(p.city))) AS folded
FROM projects p JOIN project_posts pp ON pp."projectId" = p.id
WHERE pp.status = 'PUBLISHED';
```

### Prior art

- `docs/audits/BODY_OF_WORK_AUDIT.md` — §1 B2/B4 (no geography signal; location is free text),
  §2 (direct match vs. inference), §4 (the privacy line, cross-project client exposure).
  **On `origin/claude/body-of-work-audit-fyd7se`, not on main.**
- `docs/audits/EVOLUTION_DENOMINATOR_AUDIT.md` — vocabulary sensitivity in derived signals;
  the same class of problem as `materialClassOf`'s substring scan.
- `docs/16_ATTRIBUTION_CONSENT.md` — the consent model `EditorialQueueItem.consentScope`
  implements.
