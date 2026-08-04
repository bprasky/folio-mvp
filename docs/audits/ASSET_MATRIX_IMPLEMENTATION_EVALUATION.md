# Asset Matrix — Implementation Evaluation

Companion to `docs/21_ASSET_MATRIX.md` and `tasks/ASSET_MATRIX_AUDIT_PLAYBOOK.md`.

**What this is:** a first-pass evaluation of how to implement the asset matrix, grounded in
schema and code recon done at commit time. **What this is not:** the Phase A audit. Phase A
additionally requires population rates for nullable fields against prod rows, which needs
database access this pass did not have. Every claim below cites `schema.prisma:line` or
`file:line`. Where this pass could not establish something, it says so.

---

## 1. The document's thesis holds, and the codebase already proves it

Section 3's premise is that asset generation is fragmenting into parallel generators. That
has already happened. There are two independent Instagram carousel trees:

- `src/lib/instagram/` — `generateCarouselSlides.ts`, `generateSingleSlide.ts`,
  `placeQuoteSmart.ts`, `matchQuoteToImage.ts`, `extractQuotes.ts`, `createZip.ts`,
  plus `campaign/generateRoomSpotlight.ts`
- `src/lib/instagram-export/` — `svg-templates.ts`, `generate-bio.ts`

Both composite over photography with Sharp. `generateCarouselSlides.ts:1-3` declares
"magazine-cover styling" and quote overlays; `instagram-export/svg-templates.ts:3` declares
its own `HeadlinePosition` union and its own text wrapping at
`svg-templates.ts:14`. Neither imports layout from a shared source. This is two declarations
of type placement over photography in two directories with nearly the same name — the exact
drift Section 2's frame invariance rule exists to prevent, present before the composer is
written.

The consolidation argument is therefore not speculative. Phase B should treat these two trees
as its first finding rather than as a search target.

---

## 2. Q1 resolves now, and the answer is the bad one

**Per-question interview audio is discarded. It is never written to storage.**

`src/app/api/posting/project/[projectId]/interview/transcribe/route.ts` is the transcription
path for the posting-flow interview. The sequence:

- `:58` — audio arrives as a `File` from multipart form data
- `:89-91` — read into an `ArrayBuffer`, then a `Buffer`, then re-wrapped as a `File`
- `:94-98` — posted to Whisper
- `:100` — `transcription.text` extracted
- `:128` — the route returns `{ ok: true, transcript }`

There is no storage client imported in this file and no write between receipt and return.
The buffer is garbage collected when the request ends.

Two schema columns exist to hold exactly this and neither is written on this path:

- `EditorialInterviewAnswer.audioUrl` (`schema.prisma:1828`), commented
  `// Optional: retained audio`
- `RealtimeConversationSegment.audioUrl` (`schema.prisma:5561`), commented
  `// S3/Supabase URL if retained`

Grepping `audioUrl` across `src/` returns hits only in the contributions flow
(`src/lib/contributions/submit.ts:128`), the separate upload-based interview system
(`src/app/api/interviews/[id]/*`, which does persist a `recordingAsset` and transcribe from
it at `process/route.ts:102`), and client-side object URLs that are explicitly revoked
(`src/components/interviews/RecordingInterface.tsx:34`). None of them is the posting
interview.

**Second defect on the same line.** Whisper is called at `transcribe/route.ts:94-98` with
only `file`, `model`, and `language`. Without `response_format: "verbose_json"` and
`timestamp_granularities: ["word"]`, the API returns text with no timestamps. So even if the
audio file were retained starting today, there would be no word-level offsets to resolve a
quote against. Both halves of the Teaser Film dependency are missing, and they are missing at
the same call site.

**Consequence, stated plainly.** Teaser Film is not buildable for any interview conducted to
date. Section 4 lists Teaser Film's eligibility as "verbatim quote with a resolvable audio
offset and usable audio" — that condition is unsatisfiable for the entire existing corpus,
and will remain unsatisfiable for every interview conducted until this route changes. The
playbook's "Separate track" note is correct that this is time-sensitive rather than sequence-
sensitive, and it understates it: the fix is small and localized to one file, while the cost
of delay accrues per interview and is not recoverable without re-interviewing.

---

## 3. Section 11 field resolution (schema pass)

Statuses below are resolved against `schema.prisma` only. Rows marked **UNKNOWN-POP** have a
column present but unknown fill rate, which Phase A still needs to close.

| Field | Status | Citation |
|---|---|---|
| Quote → answer → transcript segment → audio offset | **ABSENT** | Chain breaks at hop 1 — see §4 |
| Per-question audio retained after transcription | **ABSENT** | `transcribe/route.ts:89-128` — see §2 |
| Quote carries room reference | **PARTIAL** | `EditorialInterviewAnswer.roomId:1843` present; published quotes are Json, see §4 |
| Image carries room reference | **PRESENT / UNKNOWN-POP** | `ProjectImage.roomId:580`, relation `:581`, nullable |
| Room carries designated hero image | **ABSENT** | `Room:877-897` has no hero field — see §5 |
| ProductTag carries x and y | **PRESENT** | `ProductTag.x:775`, `.y:776`, both required `Float` |
| Product carries structured finish | **ABSENT** | Not PARTIAL — see §6 |
| Product carries vendor reference | **PRESENT / UNKNOWN-POP** | `Product.vendorId:708`, `.vendor:713`, nullable |
| ImageSource provenance on every image | **ABSENT on images** | Enum exists `:669`, applied to `Product.imageSource:690`, not to `ProjectImage` — see §7 |
| First specifier timestamp per product | **PARTIAL** | `ProductTag.createdAt:782` is derivable but mutable-adjacent — see §8 |
| Same product resolvable across projects | **PRESENT** | `ProductTag → ProjectImage → projectId`; index coverage unverified |
| Same finish resolvable across projects | **ABSENT** | Blocked by the finish field not existing |
| Project carries typology, area, duration, completion | **ABSENT** | See §9 |
| Credits structured by role | **PRESENT** | `ProjectParticipant:1538` with `ParticipantRole:1562` |
| Paired image flag for before/after | **ABSENT** | No pairing field on `ProjectImage:558-613` |

**Ranked by blocks blocked:**

1. **Product finish** — blocks the entire Material row at all four scopes (Finish Swatch, Room
   Palette, Material Palette, Material Study). Four blocks, and the corpus-scope one is the
   defensibility argument in Section 7.
2. **Audio retention + timestamps** — blocks Teaser Film outright and degrades In the
   Designer's Words to Quote Card. One render target, one block.
3. **Room hero designation** — blocks Room Hero and, per Section 11's own note, the
   quote-to-image pairing that all room-scope quote blocks depend on.
4. **Project typology/area/duration/completion** — blocks At a Glance, and completion date
   additionally blocks Section 8's elapsed-time property and Phase D's Q5.
5. **Quote → answer FK** — blocks film eligibility determination even after audio exists.
6. **ProjectImage provenance** — blocks the cross-sharing license path in Section 13, not any
   Phase 1 block.
7. **Paired image flag** — blocks Before and After only.

---

## 4. The quote provenance chain breaks at the first hop, not the last

The doc anticipates the chain failing somewhere between transcript and offset. It fails
earlier than that.

Published pull quotes are stored as unstructured JSON with no foreign key to the answer they
came from:

- `EditorialDraft.pullQuotes` (`schema.prisma:7436`) — `Json?`
- `DesignerBrandProfile.pullQuotes` (`:4116`) — `Json? // string[]`
- `BoostOpportunity.suggestedPullQuote` (`:3661`) — `String? @db.Text`
- `Boost.pullQuote` (`:3698`) — `String @db.Text`
- `RealtimeInterviewSession.extractedQuotes` (`:5525`) — `Json?`
- `StoryThread.contributingAnswers` (`:5797`) — `Json` carrying `answerId` inside the blob,
  a soft reference rather than a relation

So: given a published quote, there is no query that returns the `EditorialInterviewAnswer` it
came from. The hop from answer to room *does* exist (`EditorialInterviewAnswer.roomId:1843`,
indexed at `:1854`), and the hop from answer to transcript would exist for realtime sessions
(`RealtimeConversationSegment` carries `startedAt:5564`, `durationMs:5566`, and
`extractedQuote:5578`). Those later hops are in better shape than the first one.

This matters beyond film eligibility. Section 11 states that only a quote with a live audio
offset is film eligible, and that this "enforces the verbatim rule at the rendering boundary."
That enforcement mechanism cannot be implemented at all while the quote → answer edge is a
JSON blob, because the renderer has nothing to resolve. The verbatim rule would fall back to
trusting whatever text is in the blob — which is the upstream enforcement the doc explicitly
rejects.

---

## 5. Room hero is derivable but not designated

`Room` (`schema.prisma:877-897`) carries `name`, `type`, `projectId`, and relations to quotes,
selections, skeleton items, and `projectImages` via `@relation("RoomProjectImages")` at `:894`.
No hero field.

`ProjectImage.displayOrder` (`:563`) is nullable and is the only ordering signal, so "the
room's primary image" today means "lowest displayOrder among images with this roomId, ties
broken arbitrarily." That is a convention, not a designation, and it will silently reorder
when a designer reorders photos for an unrelated reason.

Section 11 says quote-to-image pairing "requires no model call — the quote came from a room
answer, the room has a designated hero image, use it. Resist making this an inference." The
resistance is warranted and currently impossible: with no designation, any pairing today *is*
an inference. This is a one-column add (`Room.heroImageId`) and it is worth more than its size
suggests, because it converts a class of model calls into a lookup.

---

## 6. The Material row is worse off than the document assumes

Section 11 anticipates finish as a PARTIAL — "a String finish field satisfies display but does
not satisfy Material Palette." The playbook's Phase A instruction reinforces this, asking for
the distinct-value count on free-text finishes to decide whether normalization is "a cleanup or
a rebuild."

Neither applies. **There is no finish field on Product at all.** `Product`
(`schema.prisma:681-771`) carries `name`, `description`, `price`, `imageUrl`,
`cutoutImageUrl`, `category:702`, `brand:703`, `url:704`, `vendorId:708`, plus 3D mesh, scrape
lifecycle, and provenance fields. No finish, no material, no colorway.

`colorFinish` exists elsewhere and on the wrong entities: `Selection.colorFinish:904` and
`OrderItem.colorFinish:2745`. Both are transaction-scoped rather than product-scoped, so a
finish recorded on a selection does not describe the product as specified in a published
project.

The nearest available signal is AI-derived and per-image: `ProjectImage.aiMaterials:587`
(`String[]`) and `MomentIndex.materials` (`:639`). These are unconfirmed model output on
photographs, not designer-confirmed attributes on products, and there is no join from them to
`ProductTag`. They cannot ground Material Palette, which Section 3 defines as "distinct
finishes across tagged products."

So the Phase A question is not "cleanup or rebuild" — it is a greenfield add, which is the
easier answer. There is no free-text corpus to normalize and no migration of bad values.
The cost is entirely in capture: something in the tagging flow has to start asking.

---

## 7. ImageSource exists, on the wrong model

`enum ImageSource` (`schema.prisma:669-674`) has the right four values —
`VENDOR_REFERENCE`, `VENDOR_LICENSED`, `DESIGNER_ORIGINAL`, `FOLIO_COMMISSIONED` — with
`VENDOR_REFERENCE` as the fail-safe default. It is applied to `Product.imageSource:690`
alongside `Product.displayScope:688`, both defaulting to internal-only per
`17_IMAGE_PROVENANCE_GATE`.

`ProjectImage` (`:558-613`) has neither field.

Section 13's closing line makes cross-sharing to a vendor record conditional on `ImageSource`
distinguishing in-situ designer photography from vendor-derived images. The enum that would
make that distinction is attached to the entity where the distinction is least interesting
(vendor product imagery, which is vendor-derived nearly by definition) and absent from the
entity where the whole question lives (the designer's project photographs). Extending the two
existing columns to `ProjectImage` with the same defaults is a mechanical add and closes the
Section 13 dependency without new enum design.

---

## 8. Provenance permanence is derivable but not durable

Section 8 states that the first specifier is attributed permanently and that this "derives from
a timestamp already held." The timestamp is `ProductTag.createdAt:782`, and the earliest tag
per product does identify a first specifier today.

Two caveats the audit should carry forward. `ProductTag` rows cascade-delete with their image
(`:789`, `onDelete: Cascade`), so deleting a photograph silently transfers first-specifier
status to the next-earliest tagger. And the derivation requires a scan over all tags for a
product with no supporting index visible on `createdAt`. Both argue for materializing the
attribution rather than deriving it on read, which is also what "permanently, never displaced"
implies — a derived value that changes when unrelated rows are deleted is not permanent.

---

## 9. At a Glance has no data behind it

Section 3 defines At a Glance as typology, area, duration, completion date, credits.

`Project` (`schema.prisma:410-516`) carries `projectType:433` (`ProjectType` enum),
`clientType:434`, `budgetBand:435`, `timeline:432` (`ProjectTimeline` enum — bands, not a
duration), `city:436`, `regionState:437`, `createdAt:422`, `publishedAt:417`, and
`targetInstallDate:494`.

Mapping against the block: typology is approximated by `projectType`; area does not exist;
duration does not exist (`timeline` is a planning band, not elapsed build time); completion
date does not exist. `publishedAt` is when the record went public and will diverge from
completion by however long the designer took to write it up — for archive projects, by years.

Credits are the one part that is fine: `ProjectParticipant:1538` with a structured
`ParticipantRole` enum (`:1562`) satisfies the Credits block directly.

Completion date is the highest-value single add here, because it is not only At a Glance. It is
the field Section 8's "records carry elapsed time" runs on and the one Phase D Q5 asks for
directly. Using `publishedAt` as a proxy would make "a quote at two years" — which the document
calls the evidence no other party can produce — silently wrong.

---

## 10. Assessment of the playbook, and what I would change

The sequencing instinct is right: audit before composer, and Phase A genuinely does gate scope.
Four changes.

**Pull Q1 out entirely and ship it as a change, not a finding.** The playbook already flags
audio as time-sensitive but leaves it inside a read-only phase. Q1 is now answered (§2) and the
fix is confined to one file: persist the buffer to Supabase before the Whisper call, write the
URL to `EditorialInterviewAnswer.audioUrl` (the column already exists), and add
`response_format: "verbose_json"` with word timestamp granularity. Nothing downstream needs to
exist for this to be worth doing — it stops the loss. Every interview conducted before it lands
is one that can never produce the asset the document calls the strongest one.

**Split Phase A into a cheap mechanical half and an expensive empirical half.** Most of §3 above
took a schema pass. What it could not resolve is population: `ProjectImage.roomId` and
`Product.vendorId` are present but nullable, and their fill rates decide whether room-scope and
Specification Index blocks are eligible in practice or only in principle. That half needs prod
queries. Running them as one phase means the cheap answers wait on database access.

**Merge Phase B and Phase C.** Both read the same generator files —
B for which matrix cell each occupies, C for where each redeclares type scale and spacing. The
two trees in §1 are the entire surface for both. Reading them once and answering both questions
saves a full pass, and C's photography-rule violation check (Section 2, per `02`) is best
answered while looking at the composite calls B is already cataloguing.

**Defer Phase D honestly rather than running it early.** Corpus scope is Phase 2 by Section 7,
and §6 above already answers D's second question — finish resolution across projects is blocked,
not deferred, because the field does not exist. D's remaining questions are worth asking after
the Phase E adds land, not before, because three of the five will change answers once finish and
completion date exist.

**One risk the playbook does not name.** Section 4's eligibility contract is the architecture,
and its worked example is a thorough designer finding fourteen blocks available against a rushed
designer's five. On the current schema, a maximally thorough designer today gets roughly: Cover,
Credits, End Card, Tagged Detail, Quote Card, Specification Index — call it five or six, with
Room Hero available only by convention. The Material row is empty, At a Glance is empty, Teaser
Film is impossible. Thoroughness is currently not rewarded, because the blocks that reward it
are the ones with no fields behind them. That inverts Section 4's report-card claim: the
composer would tell every designer the same thing regardless of effort. This is a decision to
make before build, not after — whether Phase 1 ships the buildable subset and accepts that the
eligibility signal is flat for now, or waits on the Phase E adds so that the first composer a
designer sees actually varies with what they gave it.

---

## 11. Recommended order

0. **Audio retention + Whisper timestamps.** Standalone, one file, ship now. Not gated on
   anything in this document.
1. **Finish Phase A's empirical half** — population rates for `ProjectImage.roomId`,
   `Product.vendorId`, `EditorialInterviewAnswer.roomId` against prod. §3's schema half is done.
2. **Combined B+C pass** over `src/lib/instagram/` and `src/lib/instagram-export/`.
3. **Phase E proposal**, scoped from §3's ranked list: `Product.finish`,
   `Project.completedAt` + area + typology, `Room.heroImageId`, `ProjectImage.imageSource` +
   `displayScope`, quote → answer FK, `ProjectImage` pairing flag. ADD-only, one migration each,
   per `CLAUDE.md`'s migration discipline.
4. **Decide the Section 4 question** in §10 before composer scoping.
5. **Composer scoping**, against whichever block set step 4 settles on.

Phase D moves after step 3.
