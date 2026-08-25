# 23_HEADLINE_FRAMES

## Purpose

Title generation becomes **frame selection plus slot filling from verified values**,
not free composition.

`HEADLINE_CRITERIA` is almost entirely prohibitive. `docs/audits/HEADLINE_GENERATION_AUDIT.md`
§2 counted it: six of ten headings are explicit prohibitions against one that gives
positive direction, and the only place a headline *shape* appears is a five-line
`GOOD` block, held against ten counter-examples and seven banned shapes. A model
writing under that has nothing to build from, so it climbs to a level of abstraction
where no specific rule applies — a category ("The Rise of Fluted Wood") or a verdict
("Formal outside, unruly within"). Neither breaks a stated rule. Both are retreats
from the reporting.

This is not a new pattern for Folio. `src/lib/editorial-queue/signals.ts` runs eleven
deterministic slot-templates over numeric facts and produces specific,
non-interchangeable lines; gallery chapter titles and Instagram campaign post titles
do the same. Reader-facing headlines are the one surface where it was never applied.

**Phase B1 scope: one frame, one live-violation fix, one measurement.**

---

## 1. Module structure

| module | holds | may import |
|---|---|---|
| `src/lib/interview/prompts/headlineFrames.ts` | frame declarations, eligibility, tail rule, `hasEvaluativeTail` | nothing impure |
| `src/lib/posting/headlineSlots.ts` | slot resolution from the database | Prisma |

The split is load-bearing. `docs/17` §6 makes `src/lib/interview/prompts/` the one
location prompts compose from, and every file in that directory is free of Prisma,
the AI SDKs and `next/*` — which is what lets any route import a prompt without
dragging the database in. A frame library that read rows would have broken that
purity for six unrelated modules. `check:headline-frames` asserts it.

Eligibility is pure and therefore computed **in code, before any model call**. The
model is never asked whether it has the facts a frame needs, because a model asked
that says yes.

---

## 2. The frame type

```ts
interface HeadlineFrame {
  id: string;
  name: string;
  slots: readonly HeadlineSlot[];     // ordered; each names its schema path
  requiredFields: readonly string[];  // must be non-null AND verified
  requiresDeck: boolean;
  exemplars: readonly string[];       // real published titles, never invented
  tailRule: string;                   // always TAIL_RULE — one rule, one copy
  shape: string;                      // the instruction; slots appear in {braces}
}

interface HeadlineSlot {
  name: string;
  source: string;       // a real column path, e.g. `ProductTag.finishRaw`
  description: string;
}
```

`source` is a schema path rather than a label on purpose. The whole point of a frame
is that the value is traceable to a row; a slot that cannot name where its value
comes from is free composition wearing a frame's clothes.

Built to hold five or more frames. One is implemented.

### Verified

`requiredFields` requires **verified**, which means *a human stated it*. Inference
from prose or from a product name is not verification. An unverified value is
represented by the slot being **absent**, never present-and-flagged — a frame that
fires on a proposed value is the fabrication the design exists to prevent.

---

## 3. The Material frame

**Shape:** a material noun as the grammatical subject; the designer as agent in the
tail, never as subject and never by name.

That ordering is the point. *"The designer chose unlacquered brass"* leads with the
person the byline already names. *"Unlacquered brass, specified before the plan"*
leads with the thing only this project has. Subject position is the scarcest real
estate in the sentence, and a frame is how it stops going to the wrong noun.

### Why this frame first

Materials are structured on the row and the headline route was passed **none of
them** (audit F8). The article generator flattens `buildMaterialContext` to a
names-only string; the headline endpoint received no product data at all. So the
`first-move` angle — *"the one selection that set everything after it, the material
the rest of the house had to answer to"* — was being asked of a writer that had never
been told which materials exist. Closing that gap is the whole of item 2.

### Eligibility

At least one `ProductTag` on the project with `finishConfirmed = true` and a non-empty
`finishRaw` (falling back to `finishCanonical`).

`finishConfirmed` is true exactly when the designer **typed or edited** the finish —
`AdvancedTagProducts.tsx:176`, `ProductTagPicker.tsx:365`,
`api/tag-product-to-image/route.ts:209`. The auto-tagger
(`auto-tag/route.ts:310,408`) and the room image generator
(`gen-image/route.ts:227`) both write proposed finishes with `finishConfirmed: false`.
The schema says why the column exists: it *"is the only thing separating an observed
finish from a suggested one."*

Two sources are explicitly refused:

- **A material named in interview prose.** The interview supplies the tail, but a
  noun a model found in a paragraph is not a structured value and cannot be traced
  to a row.
- **A material inferred from a product name or category.** `buildDescriptor` will
  turn "Antolini Calacatta slab" into "a marble" — correct as swap-in text, not
  evidence the designer specified marble.

### Ranking

Candidates rank by **distinct images**, then tag count, then alphabetically. Five
tags of the same brass on one photograph is one decision photographed five times; the
same brass across three rooms is the project answering to it. The alphabetical
tiebreak makes a batch reproducible across presses.

### Brand safety

`docs/20` gates product and brand names out of published prose unless the exposure is
paid for, and calls the sentence *"Folio's most valuable editorial real estate."* A
headline is the most valuable sentence there is.

The protection here is **structural, not prompted**: the slot draws from a finish
column and the resolver never reads `Product.name` or `Product.brand` into a value,
so a gated name has no path in and the frame needs no gate of its own.

The one hole in that argument is a designer typing a brand into the finish field
("Calacatta Gold by Antolini"). `docs/20` is explicit that the gate is deterministic
and never trusts a prompt, so that case is checked rather than asked for:
`carriesProprietaryName()` refuses a finish that carries its own product's name or
brand. Matching is token-based with a 3-character floor, so "Antolini" in the finish
disqualifies it while a product named "Ash" does not disqualify the finish "ash".

### Integration

The frame **replaces the `first-move` angle in place** rather than adding a
candidate. Position is the angle in this endpoint (entries `2i` and `2i+1` are
`ANGLES[i]`, and the ordering logic depends on it), and `first-move` was already
asking for exactly this — the frame gives it a shape and a verified value instead of
a topic. Candidate counts are unchanged.

When no confirmed material exists, nothing changes: no frame, `first-move` keeps its
free brief, and the batch is what it was.

---

## 4. The tail rule

> The final clause must state a fact — who it was for, what it replaced, where it came
> from, what it cost, what happened next. Never an assessment of how good the result
> is. A tail a reader could check is correct; a tail a reader could only agree with is
> not.

One `TAIL_RULE` constant, binding on every frame; a frame declaring its own is a
structural error.

This is `docs/09` applied to the last four words. Editorial tone there is
"observational, not promotional" and editorial "does not inflate importance". An
evaluative tail is the inflation, and it is the cheapest place to put it — available
precisely when the writer has nothing left to report.

| | |
|---|---|
| fact | "Reimagined for a family of five" — wrong if the family has four |
| evaluation | "That pulls out all the stops" — cannot be wrong about anything |

### `EVALUATIVE_ADJECTIVES`

A **separate export** from `EDITORIAL_BANNED_PHRASES`, because it bans a different
kind of thing. That list catches AI-default constructions — phrases that signal a
model wrote the sentence. This one catches a *register*: language telling the reader
how impressed to be. A human writer produces it fluently, which is why it survives a
list aimed at machine tells.

Covers the adjectives (stunning, gorgeous, breathtaking, dreamy, elevated, luxe,
jaw-dropping, must-see, showstopping, drop-dead, swoon-worthy) and the idioms that do
the same job ("pulls out all the stops", "goes all out", "wow factor", "knocks it out
of the park", "raises the bar", "sets a new standard").

**The line it must not cross.** Factual adjectives drawn from the work are the
frame's raw material and are encouraged: *cantilevered, lime-washed, book-matched,
unlacquered, fluted, quarter-sawn, hand-troweled*. Each names something visible in
the photograph; none could be written by someone who had not looked. The banned class
is the one that could be written without having seen the project at all.
`check:headline-frames` asserts both directions — six evaluative tails caught, six
factual tails spared.

`hasEvaluativeTail()` is the deterministic predicate. It is **not** wired into
`headlineIssues` in this phase — that would change grading for every headline on
every surface, and this phase ships one frame. See §7.

---

## 5. `requiresDeck` and which surfaces have decks

A frame that needs the deck to carry half the information is ineligible where there
is no deck. The failure this prevents is the obvious one: compensating by making the
title carry both loads, which is how a headline becomes a summary.

| surface | title field | deck field | deck-requiring frames |
|---|---|---|---|
| Article (initial + regenerate) | `blocks.lead.kicker` | **`blocks.lead.deck`** (`schemas.ts:43`) | eligible |
| Instagram export | `InstagramExport.headline` | none | ineligible |
| Collaboration story | `title` | `subtitle`, *optional* — emitted only if present | ineligible |
| Editorial queue angle | `summary` is the line itself | none | ineligible |
| `ArticleTopic` | `title` | `description` is internal admin notes | ineligible |

Three of the five title surfaces have no deck (audit §4). `DIVIDE THE WORK WITH THE
DECK` in `HEADLINE_CRITERIA` is therefore advice most surfaces cannot follow.

**The Material frame sets `requiresDeck: false`** — the material carries the subject
and the tail carries the event, so the sentence is complete alone. It is eligible on
every surface.

---

## 6. Measurement — the discriminator

`scripts/check-headline-discriminator.ts`, `npm run check:headline-discriminator`.

Every other check on this surface is a rule check. None can answer whether the output
reads like a human editor wrote it — a headline can pass every mechanical check,
survive the editor's four kill criteria, and still be obviously machine-made.

Method: mix generated headlines into a held-out set of human-written ones, ask a model
which is which, report **the share of generated headlines called human**. 0% means
every generated line is obvious; **50% is the ceiling** — above that the judge is
anti-correlated and the run should be repeated, not celebrated. The run also reports
a control (how often real headlines are correctly called human); below 60% the rate
is noise.

### Why the corpus is not our own published headlines

In Folio a published headline **is** a generated headline a designer accepted.
Scoring generated-vs-published would measure whether a batch resembles the batches
designers have already picked from — satisfied completely by a generator that
reproduced today's output, which is the thing being replaced. The comparison has to
be against writing from outside the system.

The held-out set is human-written headlines from real design magazines, supplied by
the operator at `docs/audits/headline-discriminator-corpus.json`:

```json
{ "human": ["...", "..."] }
```

It must not be invented, for the same reason a frame's exemplars must not be: an
invented corpus measures agreement with whoever invented it.

### Results

| run | date | misidentification rate | control | n |
|---|---|---|---|---|
| baseline (pre-frame) | — | **not obtained** | — | — |
| post-frame | — | **not obtained** | — | — |

**Neither number was obtained.** The authoring environment has no
`ANTHROPIC_API_KEY` and no `DATABASE_URL`, so neither the judge call nor a live
generation can run, and the held-out corpus does not exist yet. The harness is
complete and runs given a key and a corpus:

```
npx tsx scripts/check-headline-discriminator.ts --generated <batch.json>
```

No CI floor, per scope. One run is a sample and the judge is a model; a floor set
from a single number would fail honest work. Record runs in this table until there is
enough history to know the spread.

---

## 7. Blocked frames, and what each is waiting on

Five frame types were identified. One shipped. The others are blocked on data, not on
prompt work — which is the audit's central finding restated: the constraint is the
substrate, not the wording.

| frame | shape | blocked on |
|---|---|---|
| **Reversal** | what was nearly chosen, and what was chosen instead | `DesignerDecision.alternatives` is **declared and never written**. Both live write sites (`processInterviewAnswers.ts:147,365`) populate only `decisionType, choice, choiceType, imageId, reasoning, convictionLevel, captureSource`. Out of scope this phase. |
| **Constraint** | the limit, and what beat it | `DesignerDecision.tradeoffs` — same: declared, never written. |
| **Client** | what the client asked for, in their terms | `DesignerDecision.clientContext` / `clientBriefExcerpt` — same. `isClientDriven` **is** written and is usable as a predicate, but carries no content for a slot. |
| **Numeric** | a counted fact as subject | **No numeric fact exists for a design project** (audit F6). No square footage on `Project` (`squareFootage` belongs to `UnitType`), no era, no duration — `Project.timeline` is an enum, not a span. Room count (`project.rooms.length`) is the only obtainable one and is weak alone. |
| **Location** | a named place as subject | Location resolves to **city + region only** (audit F7). No street or neighborhood exists anywhere in the schema. A frame with a neighborhood slot cannot be filled today. |

The highest-value unblock is the `DesignerDecision` write path: three of the five
blocked frames depend on the same three columns, and the table, taxonomy and live
write path all already exist.

`AttributeVerification` (`aiValue` / `correctedValue` / `verified`, written by the
same live path) is a second untapped source of designer-confirmed structured values,
read by no title generator.

---

## 8. Outstanding — found during this phase, deliberately not fixed

### The banned-phrase list has a second, drifted copy

`EDITORIAL_BANNED_PHRASES` was centralized and imported by **zero** generators
(audit F10, a live `docs/17` §5 violation). This phase fixed the article generator:
`generateEditorialDraft.ts` now interpolates the constant, and the rendered system
prompt is **byte-identical** to before at 3,789 characters — zero change in model
output, which is the standard §5 sets.

A **second** inline copy lives in
`src/app/api/posting/project/[projectId]/sections/[chapterIndex]/regenerate/route.ts`,
and it has **drifted**:

| | chars | rules |
|---|---|---|
| the constant | 1,858 | 10 |
| section-regenerate's copy | 1,108 | 4 |

Missing from the section-regenerate copy: the "Product X does Y because Z" pattern,
sequential product descriptions, the swap-test rule, "treating the article as a
specification document", "mentioning every single tagged product", and "promotional
or inflated language". **A regenerated section is therefore governed by a weaker list
than the article it sits in.**

Not fixed, for two reasons: this phase scoped the violation fix to one file, and the
copies are not identical, so replacing it changes that generator's output. It needs
its own decision about which list is correct.

`check:headline-frames` asserts the copy count does not grow and fails if a new
inline copy appears.

### `Product` has no `finish` field

`buildMaterialContext` (`generateEditorialDraft.ts:152–161`) reads `p.finish ||
p.category`. `Product` has no `finish` column, so `p.finish` is always `undefined`
and the article's material context silently falls back to category for every product.
The specification decision lives on `ProductTag.finishRaw`, which per the schema
"always wins". The frame resolver reads the tag; the article generator still does not.

---

## Verification

```
npm run check:headline-frames        # this spec's invariants
npm run check:headline               # the criteria, rules, cycling, the editor
npm run check:regenerate-surfaces
npm run check:naming                 # the product naming gate
npm run check:single-generator
```
