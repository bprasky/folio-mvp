# 21_ASSET_MATRIX — Delta 01

ADD-only delta against `docs/21_ASSET_MATRIX.md`. Records nine decisions and the findings
from `docs/audits/ASSET_MATRIX_IMPLEMENTATION_EVALUATION.md` and
`docs/audits/CAROUSEL_GENERATOR_EVALUATION.md`.

Nothing in the base document is removed. Sections 4, 6, and 11 gain content. Sections 14, 15,
and 16 are new.

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

### Forward-only, and what that costs the founding cohort

**D5a stops the loss. It does not repair it.** Every interview conducted before it shipped has
no retained audio and no word timings, and no code recovers them. Those projects are
permanently film-ineligible in their current state.

This has a product consequence that is already decided elsewhere and should not be
rediscovered. Decision 6 recruits the founding cohort on four deliverables with films added
later. For any designer interviewed before D5a landed, **four is not "for now" — it is
permanent**, unless they re-record.

**That promotes the retake affordance.** D1 lists Teaser Film as CLOSABLE with the remediation
"re-record this answer," which reads as an ordinary iteration control. It is not. It is the
only path to a film for every interview already in the record, so it carries the entire
existing cohort rather than serving occasional do-overs.

Two consequences follow for whoever builds it. Retake has to work per answer rather than per
interview, since asking a designer to sit the whole thing again to recover one quote is not a
remediation anyone takes. And the audio key is `interviews/<projectId>/answers/<questionId>`
with `upsert: true`, so a retake overwrites cleanly by construction — the storage layer already
supports this, and the affordance is the missing half.

**Do not read the film library as eventually covering every project.** It covers every project
interviewed after D5a, plus whichever earlier ones their designers choose to revisit.

### It is four files, not one. Do not shrink it back.

This document first scoped D5a as a change to the transcribe route alone, writing the URL
straight to `EditorialInterviewAnswer.audioUrl`. **That scope was wrong, and the smaller
version is a silent-loss bug on the exact field whose purpose is preventing silent loss.**

Two facts about the existing architecture make the one-file version fail:

**`EditorialInterviewAnswer` is a projection, not a record.**
`src/lib/editorial/syncInterviewAnswers.ts` says so directly: `provenance.interview.payload
.answers` on the `ProjectPost` is canonical, and the table is a queryable projection of it.
`rebuildAnswerProjection` is wipe-and-rebuild — `deleteMany` then `create` with fresh row ids —
and it runs on every interview save (`interview/route.ts:796`). It writes a fixed list of
fields; `audioUrl` is not among them. A URL written directly to that column survives until the
designer next saves, then vanishes. It would test clean.

**The transcribe route cannot write the answer row, because the row does not exist yet.**
`useVoiceRecording.ts` posts audio to the transcribe route, which is stateless and returns text.
The answer is saved later, by a separate request, which writes provenance and then rebuilds the
projection. At transcription time there is nothing to attach a URL to.

So the audio has to travel the same path the answer travels:

| # | File | Change |
|---|---|---|
| 1 | `interview/transcribe/route.ts` | Upload the blob; return `audioUrl` and word timings alongside the transcript |
| 2 | `components/posting/interview/useVoiceRecording.ts` | Carry both into the answer payload |
| 3 | `interview/route.ts` | Admit both through the normalizers into canonical provenance |
| 4 | `syncInterviewAnswers.ts` | Carry both into the projection so they stay queryable |

**File 3 is the one most likely to be missed.** The canonical answer shape has no declared
schema — `SaveBodySchema.answers` is `z.array(z.any())`. What constrains it is a pair of
hand-written normalizers, `normalizeQA` and `toInterviewAnswer`, that rebuild the object field
by field from an allowlist. A key not named in both is **silently dropped**, not rejected. This
is the same hazard as the projection, one layer up, and the codebase has already been bitten by
it: the "carried first-class, not stripped" comments on `roomId` mark where someone fixed
exactly this for room attribution.

**A declared schema on the canonical answer shape is worth having** and is not part of D5a. It
is recorded here because the next person adding a field to the interview record faces the same
two silent-drop points with nothing telling them so.

### Sequencing: the capture loss stops before the migration lands

Only one piece of this needs a schema change. `EditorialInterviewAnswer.audioUrl` already
exists, and canonical provenance is a `Json` column that holds any shape. So files 1 through 3,
plus the `audioUrl` half of file 4, ship with **no migration** — and that is the point at which
audio stops being destroyed.

The word-timings column on the projection is the only migration, and it can follow. Losing
query access to timings for a few days costs nothing; the timings themselves are already safe
in provenance from the moment file 3 lands.

### Word timings: a deliberate intermediate

Timings land as `Json` on the projection and in canonical provenance, shaped
`[{ word, start, end }]`. First-word start to last-word end resolves any contiguous substring —
which is what a pull quote is — to a time span, so a film can be cut without a further schema
change.

**This is an intermediate, not the destination.** The relational form is a `TranscriptWord`
table, which is more queryable and lets a pull quote point at a span by foreign key rather than
by substring search. It is not built now because D4's pull-quote model does not exist yet, and
building the table first means guessing at its foreign key.

**Promotion condition, so this does not become permanent by default: when D4's pull-quote model
lands, `TranscriptWord` is built with it and the `Json` column is backfilled and deprecated.**
D4 is the trigger. If D4 ships without it, that is a regression to name in review.

### If the reference is lost, the audio is not

The transcribe route read-modify-writes the provenance `Json` column, so a write racing a
concurrent interview save could in principle lose the reference. Timing makes this unlikely —
transcription completes while the designer is still answering, saves happen on submit — but it
is possible, as is a provenance write failing outright while the upload succeeded.

**In every one of those cases the recording itself is safe.** The blob is written to storage
before the reference, under a deterministic key: `interviews/<projectId>/answers/<questionId>`.
A lost reference is recoverable by rederiving it from the key. Nothing here can produce the
permanent loss D6 is about; the worst case is a repair job, not a re-interview.

**`TranscriptSegment` is not reused.** It exists, and it holds timings — but it is keyed to
`InterviewSession`, which belongs to the separate upload-based interview system. Those two
systems are independent today, and coupling them through a shared model to avoid one table is
the shortcut that becomes, in two years, the reason neither can change.

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
| 9 | The composer ships with a structural guard asserting one composer exists | Types cannot express it and runtime cannot observe it; three trees shipped with every check green |

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

## D10. New Section 16. Structural guard requirement

**When the composer lands, it ships with `check:single-composer`, a structural guard asserting
that exactly one composer exists in the tree.** This is a requirement of the composer, not a
follow-up task, and the composer is not done without it.

The precedent is `scripts/check-single-generator.ts`, which guards editorial article
generation. Its own docstring states the case:

> These checks are greps over source, deliberately. The invariant they protect is "there is
> only one of these in the tree", which types cannot express and a runtime test cannot observe.

That is exactly the invariant this document exists to defend. Section 2's frame invariance and
Section 3's operating rule — no asset generator composes its own layout, its own type scale, or
its own copy — are both statements of the same form: there is one of these in the tree.

**Neither existing guardrail would have caught the drift.** `check:single-generator` passed
throughout, correctly, because its scope is editorial text generation and says nothing about
asset or image generators. Types cannot express "no second Sharp composite chain." No runtime
test observes a duplicate directory. Three layout trees shipped simultaneously with every check
green.

At minimum the guard asserts:

1. **One composite path.** Exactly one module composites over project photography.
2. **One token source.** No color, type scale, or spacing value is declared outside the design
   system. The evaluation found two full palettes and three dimension declarations.
3. **One voice.** Every prompt producing copy that lands in a block imports `FOLIO_TONE` rather
   than declaring its own persona. The evaluation found three personas and zero importers.
4. **One line-breaking implementation,** measured rather than counted.
5. **No text over photography** except the numbered product tag marker permitted by Section 2.

Check 5 is the one that would have caught this earliest, and it is a grep.

---

## Immediate actions, ahead of all phases

**A. Remove the quotation marks at `src/lib/instagram-export/svg-templates.ts:85`.**
`generate-quotes.ts:48` invents a headline and `:85` typesets it in quotation marks over the
designer's photograph. That is fabricated speech attributed to a named professional, shipping
now, on the surface designers show their peers. It violates `08`, `17`, and `09`. Removing the
quotation marks makes the copy a headline, which is what it always was — and what the editor UI
already calls it. This does not fix the generator and must not wait for anything that does.

**B. Repoint the project-page export controls to the single surviving entry point.**
There are three entry points, not two: `InstagramExportModal` in `ProjectHeader.tsx` and
`ProjectHero.tsx`, and `CampaignWizard` in the same two files. All three drive the RETIRE tree
and produce output visually incompatible with the surviving one, which is the frame-invariance
failure in its most literal form.

**The button is repointed to `/designer/projects/[id]/instagram`, not removed.** Removing the
affordance from the public project page to fix a consistency problem is a worse trade than the
inconsistency: the designer loses a working path to an export they can currently produce, in
exchange for a defect they cannot see. The surviving path holds everything worth carrying
forward; only the destination changes.

**The ownership gate is fixed at the same time, on all three controls.** Both files gated
these controls on `project.isPublic && publishedAt && images.length > 0` — a publication check,
not an ownership one — so any visitor to a public published project could open them. The
destination redirects anyone who is not the owner, so a repoint without this fix sends
signed-out visitors to a sign-in wall and signed-in non-owners to a bounce.

`isOwner` is already computed in `src/app/project/[id]/page.tsx` and already passed to five
other children. It is passed here too and the controls gate on it.

**This is a live defect independent of the repoint.** The wrong gate predates this work and
ships today, so `CampaignWizard` gets the ownership fix now rather than at retirement, even
though its repoint waits for the composer.

**`ProjectHero.tsx` has no importers.** It is dead and retires under Decision 2 with the rest
of the tree. It is repointed in the interim so the pattern is not preserved if the file is ever
resurrected. This document previously cited it as a live mount, inheriting that claim from the
generator evaluation, which inferred liveness from the presence of a mount expression rather
than from an importer check. **Later audit phases must establish reachability by importer, not
by mount** — Phase C in particular, since a dead file's tokens are not drift.

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
6. Composer scope, shipping with `check:single-composer` per D10
7. Phase D, deferred; D3 answers its finish question
8. D5b transcription provider evaluation, any time after D5a
