# 21_ASSET_MATRIX — Delta 01

ADD-only delta against `docs/21_ASSET_MATRIX.md`. Records eight decisions and the findings
from `docs/audits/ASSET_MATRIX_IMPLEMENTATION_EVALUATION.md` and
`docs/audits/CAROUSEL_GENERATOR_EVALUATION.md`.

Nothing in the base document is removed. Sections 4, 6, and 11 gain content. Sections 14 and
15 are new.

---

## D1. Section 4 gains a third block state

Section 4 currently defines two states: a block is available, or it is absent. Absence was
specified as silent.

**Replace two states with three. Blocks are AVAILABLE, CLOSABLE, or ABSENT.**

| State | Condition | Composer behavior |
|---|---|---|
| AVAILABLE | Eligibility condition met | Appears, toggleable |
| CLOSABLE | Condition unmet, and the designer can act to meet it | Appears greyed, with a stated fact and a destination |
| ABSENT | Condition unmet because the record cannot hold the data | Does not appear. Silent. |

**The distinction is whether an action exists today.** A Material Palette blocked because the
designer's products carry no finish is CLOSABLE once finish capture ships. The same block
before finish capture ships is ABSENT, because there is nowhere to put the value and the
designer can do nothing.

**Every block declares a remediation path and a destination alongside its eligibility
condition.** A CLOSABLE block that cannot name where the designer goes is specified
incorrectly.

| Block | Closable when | Remediation | Destination |
|---|---|---|---|
| Material Palette | Fewer than four distinct finishes | Add finishes to tagged products | Tagging surface, filtered to tags missing finish |
| In the Designer's Words | No quote for this room | Answer the room's interview question | Interview, that room |
| Teaser Film | Quote present, audio missing or unusable | Re-record this answer | Interview, that question |
| Tagged Detail | Fewer than two tags on the image | Tag products in this image | Tagging surface, that image |
| Before and After | No paired image | Upload and pair a prior-condition image | Project media |
| At a Glance | Project metadata incomplete | Complete project details | Project settings |

**Language constraint.** Remediation copy is a statement of fact and an action, nothing more.
Per `09`, the following are barred: unlock, complete your profile, progress meters, percentage
scores, counts framed as achievement, and any urgency or reward framing. The permitted form is
the plain one. "Material Palette needs four finishes. Three of your products have one." Then
the destination.

**Sequencing consequence.** Gap surfacing ships with capture, not before it. Until finish and
audio land, every gap is ABSENT, so there is nothing truthful to surface and the composer ships
plain. This is a consequence of the contract rather than a separate design decision.

---

## D2. Section 6 gains a render layer decision

Section 6 named four targets but did not specify the engine.

**The render layer is HTML and CSS through headless Chromium.** One stylesheet, one set of
block components, four targets. Chromium produces the 11 by 8.5in PDF with real pagination and
text flow, and rasterizes the 4:5, 1:1, and 9:16 frames from the same components.

**Sharp is demoted from composition engine to image processing dependency.** Resizing,
cropping, format conversion, and quality. It composites nothing.

Three requirements follow.

**Line breaking is measured, never counted.** The evaluation found character-count wrapping
throughout the surviving tree, which causes type to scale with the frame while line breaks do
not. CSS handles this natively, which is a further argument for the engine choice.

**Landscape is a first-class target.** Every vertical anchor must survive an inverted aspect.
The base document's Section 6 lists the case study at 11 by 8.5in, and it is one of the four
day-one deliverables, so it is not deferrable.

**Blocks are components, not templates.** A block renders at any target by responding to its
container, not by carrying per-target values.

### Open question: hosting the browser

The engine decision stands on its merits. Sharp cannot paginate a landscape document, and the
four PDF libraries already in `package.json` — `pdf-lib`, `pdfkit`, `pdf-to-png-converter`,
`pdfjs-dist` — are all used for extraction under `src/lib/pdf/`. None is a layout engine, so
this duplicates nothing.

**How the browser is hosted is not settled and is not priced.** No `puppeteer`, `playwright`,
or `chromium` package is in `package.json` today, and the deploy target is Vercel
(`vercel.json`). That leaves two shapes: `@sparticuz/chromium` bundled inside the serverless
function size limit, or a separate render service the app calls out to. They differ in cost,
cold-start behavior, and operational surface.

**This belongs in the base document's Section 12 open decisions, not settled here.** The delta
commits to the engine. It does not commit to where the engine runs.

---

## D3. Section 11 gains the finish capture model

The audit found that `Product` carries no finish field. `colorFinish` exists on `Selection` and
`OrderItem`, both transaction-scoped, so Folio holds no queryable record of what any specified
product is made of. This blocks the entire Material row, including the corpus-scope block that
is Section 7's defensibility argument.

Greenfield, with no bad values to migrate. Capture has to start asking.

### Finish goes on ProductTag, not Product

**A finish is a specification decision the designer made for that room, not an attribute of the
SKU.** The same faucet in unlacquered brass in one house and polished nickel in another is one
product specified twice.

Putting finish on `Product` would split it into two `Product` records and break Repeat
Specification, which is the corpus block that depends on product identity holding across
projects. The Material row and the Product row would then be buying opposite things from the
same schema.

Consequences:

- **Material Study joins through `ProductTag`,** not through `Product`.
- **`Product` stays finish-free.** The catalog record describes the item; the tag records the
  specification.
- **The tagging UI asks about this instance,** not about the catalog item.
- **URL extraction prefills a suggestion for this tag,** rather than writing an attribute onto
  the product that every other designer's tag would inherit.

**Capture happens at tag time, prefilled by URL extraction.** The designer is already looking
at the product when they tag it. Extraction proposes, the designer confirms only when
confidence is low. The interview is the wrong surface, since no designer enumerates finishes
conversationally.

**The field is three fields, all on `ProductTag`.**

| Field | Purpose |
|---|---|
| `finishRaw` | The string as extracted or entered. Vendor wording, preserved. Displayed. |
| `finishCanonical` | Normalized value produced by a background matching pass. Queried. |
| `finishConfirmed` | Whether a human confirmed the value or extraction was silently accepted. |

**Normalization is required regardless of capture method.** Vendor pages return inconsistent
strings for one material. Unlacquered Brass, Living Finish Brass, and Raw brass unlacquered are
three strings for one finish. Capture-by-extraction removes the typing, not the matching pass.

**`finishConfirmed` exists so corpus blocks can raise their bar later.** If extraction proves
noisy, Material Study can require confirmed values without a migration or a re-capture. Without
the flag, the corpus block would be built on guesses with no way to tell which.

**No enum, no fixed dropdown.** A taxonomy authored today will be wrong at the edges,
designers will select the nearest wrong option, and the wrong values become indistinguishable
from right ones. The canonical value is derived, not chosen.

---

## D4. Section 11 gains the quote provenance model

The audit found the provenance chain breaks at hop one, not at the transcript end. Pull quotes
are `Json` blobs across six models with no foreign key to `EditorialInterviewAnswer`. This makes
Section 11's render-boundary verbatim check unimplementable as written, since the renderer has
nothing to resolve and would fall back to trusting the blob.

**Pull quotes become a model carrying a nullable `sourceAnswerId`.**

**Null is the mechanism, not a weakness.** `17` establishes that quotes are extracted from
composed body text, so some quotes legitimately do not resolve to a single interview answer.

| `sourceAnswerId` | Meaning | Eligibility |
|---|---|---|
| Present, audio resolvable | Verbatim, spoken | Film eligible and card eligible |
| Present, no audio | Verbatim, typed | Card eligible, film ineligible |
| Null | Composed from body text | Card eligible, film ineligible |

The eligibility contract then enforces itself at the rendering boundary exactly as the base
Section 11 intended, using a single nullable foreign key.

### What the new model supersedes

Adding a seventh store without naming what it replaces is the mechanism that produced six. The
six existing stores, all in `prisma/schema.prisma`:

| Store | Line | Type |
|---|---|---|
| `EditorialDraft.pullQuotes` | 7436 | `Json?` |
| `DesignerBrandProfile.pullQuotes` | 4116 | `Json?` — `string[]` |
| `BoostOpportunity.suggestedPullQuote` | 3661 | `String? @db.Text` |
| `Boost.pullQuote` | 3698 | `String @db.Text` |
| `RealtimeInterviewSession.extractedQuotes` | 5525 | `Json?` |
| `StoryThread.contributingAnswers` | 5797 | `Json`, carries `answerId` inside the blob |

**The new model supersedes all six.** The cutover:

1. **Writes go to the new model from the cutover date.** No new rows land in any of the six.
2. **Reads fall back to the Json blobs until backfill completes.** A reader checks the new
   model first, then the legacy blob for that record.
3. **The blobs are deprecated on write, not dropped.** They keep their data and their columns.

ADD-only discipline is preserved: nothing is dropped, no type narrows, no existing column
becomes required. Removing the six is a separate, later, deliberate migration — and only once
backfill has been verified complete.

---

## D5a. Audio retention and word timestamps — immediate, no vendor decision

The audit resolved Q1 and the answer is the bad one. The transcribe route reads the audio blob,
posts it to Whisper, returns text, and imports no storage client. The buffer is garbage
collected with the request. Whisper is called without word-timestamp granularity, so offsets
would not exist even if the file were retained. `EditorialInterviewAnswer.audioUrl` and
`RealtimeConversationSegment.audioUrl` both exist and neither is written.

**Teaser Film is unbuildable for every interview conducted to date.**

**The fix is two parameters and a storage write, on the existing Whisper call.** Add
`response_format: "verbose_json"` and `timestamp_granularities: ["word"]`, and persist the audio
blob to storage with the URL written to `EditorialInterviewAnswer.audioUrl`.

**Both halves are required.** Either alone leaves Teaser Film unbuildable: retained audio with
no offsets cannot resolve a quote to a time span, and offsets with no audio have nothing to play.

**This is gated behind nothing.** It is the only item in this document accruing permanent loss,
per D6. It requires no new vendor, no comparison run, and no cutover.

## D5b. Transcription provider evaluation — deferred, normal decision

Evaluate Deepgram against Whisper on accuracy, cost, and word-timestamp quality, using three or
more real interview recordings including at least one from a noisy setting. This route produces
the text that becomes verbatim quotes, so accuracy is not incidental.

**This is a new vendor integration and is scoped as such.** Deepgram is not in the stack today.
It appears in exactly two places: a cost-model rate entry (`src/lib/ai/cost.ts:12`, `:37`,
`:67-69`) and a comment in `src/lib/flags.ts:10`. There is no `@deepgram/sdk` in
`package.json`, and no LiveKit or Cartesia SDK either. The realtime interview is schema plus a
flag defaulting off (`src/lib/flags.ts:11`, `realtimeInterviewConfig.enabled` at `:19`) with no
running implementation. A Deepgram move adds a vendor; it does not consolidate one.

**It also does not remove OpenAI from the product.** Whisper on this route is one of four OpenAI
call sites. The others are `src/app/api/interviews/[id]/process/route.ts` (also Whisper),
`src/lib/ai/embeddings.ts`, and `src/lib/ai/imageGen.ts`.

**Nothing irreversible rides on this once D5a has landed.** Sequencing it ahead of D5a would
gate the only item accruing permanent loss behind a reversible preference.

---

## D6. Section 11 gains a priority rule

The base Section 11 ranks fields by how many blocks each unblocks. **That is the wrong sort
key. Rank by recoverability.**

**Capture loss is permanent. Everything else is deferrable at no cost.**

Audio and finish are the same class. Both are capture, both are unrecoverable, and both accrue
loss every day they wait. Every interview conducted without retained audio is permanently
unfilmable. Every product tagged without a finish is permanently absent from the Material row,
and no designer will retroactively re-tag a completed project to add them.

Join paths, indexes, provenance foreign keys, and render code operate on data that will still
be sitting there in a year. They are sequencing questions. Capture is not.

---

## D7. Section 11 gains a note on inherited defects

The surviving tree carries its own thin-data failures. These must be replaced by the
eligibility contract, not absorbed into it: an empty bio slide when bio text is absent, a bare
pair of quotation marks over a photograph when the headline is empty, a call-to-action-only
carousel when no images resolve, and no timeout or retry on image fetch.

Under D1, each of these is a block that should not have rendered. The composer spec states this
explicitly so the behavior is not carried forward silently during harvest.

---

## D8. New Section 14. Decisions log

| # | Decision | Rationale |
|---|---|---|
| 1 | Retiring tree's broken outputs are replaced wholesale, not patched | Composer replaces the surface; patching retiring code buys little |
| 2 | `src/lib/instagram/` is deleted after harvest, not left dead behind an unmount | Dead code behind an unmounted entry point is how the duplicate tree came to exist |
| 3a | Audio retention and word timestamps ship immediately on the existing Whisper call | Only item accruing permanent loss; two parameters and a storage write; no vendor decision |
| 3b | Transcription provider evaluation is deferred and scoped as a new vendor integration | Deepgram is not in the stack; nothing irreversible rides on it once 3a has landed |
| 4 | Finish is captured at tag time, prefilled by URL extraction | Designer is looking at the product; prefill turns composition into confirmation |
| 5 | Finish is extracted and normalized onto `ProductTag`, not selected from an enum on `Product` | A finish is a specification decision, not a SKU attribute; a taxonomy authored now is wrong at the edges |
| 6 | Founding cohort is recruited on four deliverables, films added later | Honest, and four already exceeds what any publication delivers |
| 7 | One render layer for all four targets, HTML and CSS via headless Chromium | Real pagination and text flow; Sharp cannot produce the landscape document. Hosting is open, see D2 |
| 8 | Gaps are surfaced to designers, distinguished from schema blocks | Actionable gaps teach the system; blocked gaps stay silent because the ask would be false |

---

## D9. New Section 15. Retirement and harvest

Verdicts from `docs/audits/CAROUSEL_GENERATOR_EVALUATION.md`.

**`src/lib/instagram/` and `src/lib/instagram/campaign/`: RETIRE.** C1 fails at every
photographic slide. The tree is a near-verbatim duplicate of itself with a shop-slide index
divergence that already produces a preview-versus-export mismatch.

Harvest exactly two items:

- **The `/api/instagram/proxy-image` route**, which is the correct answer to the CDN problem
  that the sibling file answers with a spoofed User-Agent.
- **`src/lib/instagram/createZip.ts`** — 34 lines of JSZip, engine-independent. A carousel
  export remains a zip of images plus a caption regardless of what renders the images.
  (Note: this file lives in the retiring tree, not in `instagram-export/`. It is a harvest
  item, not a carry-forward.)

**`src/lib/instagram-export/`: HARVEST.**

Carries forward:
- `DIMENSIONS` and the width-relative scaling scheme, extended to landscape
- `assembleSlideSequence` returning descriptors against independently exported renderers, which
  is the correct shape for the block library and solves most of C6
- `createBioSlideSVG`, the only two-region composition in the codebase, as the reference
  implementation for Section 2

Discarded: the hero and detail slides, the gradient scrim, the local palette, the three
declared personas, character-count line breaking, and the thin-data behaviors in D7.

**`placeQuoteSmart.ts` is retired in full.** Four hundred nineteen lines of luminance sampling
exist to find somewhere on a photograph where white text survives. Under Section 2 the file has
no reason to exist. It is the cost of treating photography as substrate, measured in code, and
belongs in the deck rather than the backlog.

---

## Immediate actions, ahead of all phases

**A. Remove the quotation marks at `src/lib/instagram-export/svg-templates.ts:85`.**
`generate-quotes.ts:48` invents a headline and `:85` typesets it in quotation marks over the
designer's photograph. That is fabricated speech attributed to a named professional, shipping
now, on the surface designers show their peers. It violates `08`, `17`, and `09`. Removing the
quotation marks makes the copy a headline, which is what it always was — and what the editor UI
already calls it. This does not fix the generator and must not wait for anything that does.

**B. Repoint `InstagramExportModal` to the single surviving entry point.**
The modal is mounted at `ProjectHeader.tsx:274` and `ProjectHero.tsx:149`. Two live entry points
produce visually incompatible carousels from the same project, which is the frame-invariance
failure in its most literal form.

**The button is repointed to `/designer/projects/[id]/instagram`, not removed.** Removing the
affordance from the public project page to fix a consistency problem is a worse trade than the
inconsistency: the designer loses a working path to an export they can currently produce, in
exchange for a defect they cannot see. The surviving path holds everything worth carrying
forward; only the destination changes.

**C. Begin the capture workstream.** D5a — audio retention and word timestamps — and the three
finish fields with extraction. Both are accruing permanent loss. Neither waits on the remaining
audit phases, and neither waits on D5b.

---

## Sequencing update

Phase B is closed. The generator evaluation covers everything Phase B would have inventoried.

1. Immediate actions A and B
2. Capture workstream: D5a audio retention and word timestamps, finish capture on `ProductTag`
3. Phase A empirical half, population rates, requires production access
4. Phase C, token and frame audit
5. Phase E, migration proposal
6. Composer scope
7. Phase D, deferred; D3 answers its finish question
8. D5b transcription provider evaluation, any time after D5a
