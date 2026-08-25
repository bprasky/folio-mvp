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

### CORRECTION (B2) — the gate is at the wrong granularity

**`finishConfirmed` is the wrong source, and the shipped frame still uses it.**

Finish was chosen in B1 because `FINISH_FAMILIES` in `src/lib/naming/descriptor.ts`
was the brand-free vocabulary that satisfied `docs/20`'s naming gate. That solved
brand safety and landed on data a headline cannot use. Published design headlines
name material **classes** — marble, terrazzo, travertine, oak, brass, concrete,
plaster. They do not name finishes.

**The correct source, which exists today:** `finishFamilyOf()` in
`src/lib/editorial-queue/signals.ts:27`, applied to `Selection.colorFinish` plus
`Product.name` / `.description` / `.category`.

There are **two** `FINISH_FAMILIES` lists in the repo and they are not the same:

| | entries | character |
|---|---|---|
| `src/lib/naming/descriptor.ts:25` | 31 | a **descriptor** vocabulary — includes `matte black`, `black`, `white`, `brushed steel`, `stainless`, `lacquer`. Colour and finish terms, correct for swap-in text. |
| `src/lib/editorial-queue/signals.ts:17` | 38 | a **class** vocabulary — `marble, travertine, limestone, granite, quartz, soapstone, terracotta, concrete, plaster, oak, walnut, maple, ash, teak, mahogany, brass, bronze, copper, linen, leather, velvet, wool…` |

Only in `descriptor.ts`: brushed steel, stainless, steel, matte black, black, white,
white oak, terrazzo. Only in `signals.ts`: pewter, zinc, silver, maple, mahogany,
pine, birch, limestone, granite, quartz, soapstone, terracotta, plaster, wool, jute.

Despite its name, **`signals.ts`'s list is a material-class vocabulary** and is the
one a headline wants. (`terrazzo` is the one class present only in `descriptor.ts` —
whichever list becomes canonical needs it.)

Three consequences, all of which raise coverage:

1. `finishFamilyOf` derives a class from the product itself, so it **does not
   require `finishConfirmed`** — it resolves for any tagged product. The B1 gate is
   strictly narrower than the correct one; §6.2 measures the gap.
2. Brand safety is **stronger**, not weaker: the derivation reads the product name
   but emits only a term from a fixed 38-entry vocabulary, so no proprietary string
   can survive it. `finishRaw` is free text a designer typed and needs
   `carriesProprietaryName()` to police it; a class does not.
3. It resolves per tag, so the same class in two rooms is computable — which is the
   `classInTwoPlaces` precondition the Continuity verbs need (§7).

**Not changed in this phase, by instruction.** The Material frame still gates on
`finishConfirmed`. The change is a B3 candidate and should not land before the
coverage numbers in §6.2 exist, since those are what size it.

### Eligibility (as shipped in B1)

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

## 6. Measurement

Two instruments: a discriminator that asks whether the writing passes as human
(§6.1), and a coverage report that asks how often a frame can fire at all (§6.2).
They fail differently — a frame that never fires and a frame that fires badly look
identical from outside — so both are needed.

### 6.1 The discriminator

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

### 6.2 Coverage — how often a frame can fire

`scripts/report-headline-coverage.ts`, `npm run report:headline-coverage`.

Every figure is a share of published projects (`ProjectPost.status = PUBLISHED`). B1
shipped a frame whose eligibility nothing had measured, so "the Material frame is
live" and "the Material frame ever fires" were separate unverified claims.

| # | measure | source | result |
|---|---|---|---|
| 1 | ≥1 material **class** resolvable at project level | derived — `finishFamilyOf()` over `Selection.colorFinish` + `Product.name`/`.description`/`.category` | **not obtained** |
| 2 | ≥1 `ProductTag.finishConfirmed` (the shipped B1 gate) | `ProductTag.finishConfirmed` | **not obtained** |
| 3 | a class in more than one room or image | derived, per tag, keyed to `ProjectImage.roomId` | **not obtained** |
| 4 | new build vs renovation vs unknown | **no such field** — see below | **100% unknown**, structurally |
| 5 | ≥1 verbatim designer quote at headline-generation time | `loadInterviewAnswers()`, the read the headline route makes | **not obtained** |
| 6 | resolvable location, and at what specificity | `Project.city`, `Project.regionState` | **not obtained** |

**The percentages were not obtained.** This environment has no `DATABASE_URL`. The
script reports and exits 2 rather than estimating — an estimated coverage figure is
worse than none, because it gets quoted back as though it were measured.

The structural answers below do **not** depend on data and are settled.

#### 1 — is there a class-level vocabulary?

**No stored one.** No `materialClass`, `material_class`, or equivalent column exists
anywhere in the schema, and no material taxonomy constant exists in `src/`. A class
must be **derived**, and `finishFamilyOf()` (38 entries) is the only class-level
vocabulary in the repo. See the B2 correction in §3.

#### 4 — new build versus renovation

**No such field exists.** Named plainly, because this one blocks a whole verb
category:

| field | what it actually encodes |
|---|---|
| `Project.projectType` | sector — `RESIDENTIAL, COMMERCIAL, HOSPITALITY, HEALTHCARE, EDUCATION, OFFICE, RETAIL, INDUSTRIAL, OTHER, UNSPECIFIED` |
| `Project.stage` | workflow position — `concept … install` |
| `Project.timeline` | *when* — `PAST / PRESENT / FUTURE` |
| `Project.clientType` | `RESIDENTIAL / COMMERCIAL` |

The only renovation-versus-new-build strings in the schema are
`User.architectSpecializations` (`"adaptive_reuse"`, `"ground_up"`,
`"historic_preservation"`) and `User.builderProjectTypes` (`"renovations"`,
`"custom_homes"`) — both on **User**, describing the practitioner's practice, not
this project. They cannot answer it for a given project.

Consequence: **all seven Intervention verbs are withheld on every project**, today
and until a per-project field exists. `check:headline-frames` asserts it.

#### 6 — location specificity

City and region only. **No street or neighborhood column exists on `Project`** — the
only address fields in the schema belong to vendor, shipping and proxy records, none
reachable from a project. A frame or verb with a neighborhood slot cannot be filled.

---

## 7. The verb library

`src/lib/interview/prompts/headlineVerbs.ts`. Pure, like the rest of `prompts/`.

The verb is the highest-leverage slot. Published design headlines turn on a specific
physical action — *clads, perches, inserts, splits, frames, wraps* — and the generic
ones are where a headline goes to say nothing. A specific verb forces a specific
object, so choosing the verb is most of choosing the sentence.

**38 verbs across six categories.** Breadth is safe because preconditions do the
filtering, not scarcity.

### Verbs carry preconditions

```ts
interface HeadlineVerb {
  id: string;              // `${category}:${verb}`
  verb: string;            // lemma, as an extractor would find it
  headlineForm: string;    // third-person singular, the form a headline uses
  category: VerbCategory;
  requires: readonly VerbCondition[];    // each must be known to HOLD
  barredWhen: readonly VerbCondition[];  // each must be known NOT to hold
  bannedCollocations?: readonly string[];
}
```

`id` is composite because a lemma can hold two senses with different preconditions —
`intervention:extend` (a building) and `continuity:extend` (a material run).

Eligibility is computed in code before the model sees the list, exactly as frame
eligibility works. **The model chooses among eligible verbs; it never proposes one.**

### Unknown is not permission

Conditions are **tri-state**: `holds`, `doesNotHold`, `unknown`. A condition absent
from the facts map is `unknown`, and unknown **withholds on both sides** — a required
condition must be known to hold, and a barring condition must be known *not* to.

The second half is the one that is easy to get wrong. A verb whose requirements are
met must still be withheld when a bar cannot be evaluated; otherwise `renovate` sails
past a `newBuild` bar nobody could check. With an empty facts map, **0 of 38 verbs
are offered**.

`explainVerb()` returns the reason rather than logging it, so a verb withheld because
a column does not exist is distinguishable from a verb nobody wanted. That is how a
missing field stays visible instead of quietly shaping output.

### Categories

| category | verbs | requires | barred when |
|---|---|---|---|
| **Intervention** | renovate, restore, convert, extend, remodel, strip, expose | `existingStructure` | `newBuild` |
| **Application** | clad, wrap, line, sheathe, panel, tile, face | `namedSurface` + `materialClass` | — |
| **Placement** | anchor, center, set, perch, suspend, float, sink | `spatialObject` | — |
| **Division** | split, divide, screen, partition, separate, break | `spatialRelation` | — |
| **Continuity** | run, carry, thread, repeat, extend, continue | `classInTwoPlaces` | — |
| **Aperture** | frame, open, admit, filter, screen | `apertureFact` | — |

Intervention is **entirely withheld today** (§6.2 item 4). Continuity depends on
coverage item 3, which is why that measure exists.

### Sourcing versus validating — the seam

Where the interview states what physically happened, the verb should come from the
designer's own account rather than be chosen freely. That is **two gates, both
required**:

1. the verb must be **in the library**
2. its **preconditions must be satisfied** by structured data

A verb passing one and failing the other is rejected, not partially credited. A
designer saying *"we clad it in oak"* does not make `clad` usable if no material
class resolves; a resolvable class does not license a verb the designer never used.

**Extraction is not built in this phase.** The seam is
`selectVerbs(facts, { candidate })` — pass a lemma an extractor found and it goes
through both gates. `candidateRejection` names which gate failed, so extraction is
debuggable when it arrives.

### Banned generics

`BANNED_HEADLINE_VERBS`: features, showcases, elevates, transforms, reimagines,
redefines, celebrates, embraces, boasts, unveils — with all inflections. Each can be
written about any project by someone who has not seen it, which is the same test
`EVALUATIVE_ADJECTIVES` applies to the tail.

`unveil` carries the one stated exception (`UNVEIL_EXCEPTION`): a genuine first
public reveal. That is a fact about the piece rather than a judgement about the
writing, so it is granted by the caller, not by the word list.

Wired into `check:headline-frames` §15.

### Where the verb library met the centralized banned list

`EDITORIAL_BANNED_PHRASES` is canon (`docs/17` §5), and four of the specified verbs
collide with it. Two different kinds of collision, handled differently:

| verb | collision | resolution |
|---|---|---|
| `anchor` | `"anchors the space"` is banned | **kept.** The verb is fine — *"brass anchors the stair"* names a real object. The banned **collocation** travels with the verb via `bannedCollocations` and is repeated in the rendered instruction. |
| `run` | `"thread that runs through"` | kept, same treatment |
| `thread` | `"metallic thread"`, `"thread that runs through"` | kept, same treatment |
| `echo` | `"echoing" (to describe formal relationships)` — banned as a **verb**, for exactly what Continuity describes | **excluded.** A formal relationship is precisely what Continuity is (the same travertine in two rooms), so including it would put a new list in direct contradiction with the binding one. `continue` covers the ground without the conflict. |

The `echo` exclusion is a judgement call and is flagged in §9 for a decision.

---

## 8. Blocked frames, and what each is waiting on

Five frame types were identified. One shipped. The others are blocked on data, not on
prompt work — which is the audit's central finding restated: the constraint is the
substrate, not the wording.

| frame | shape | blocked on |
|---|---|---|
| **Reversal** | what was nearly chosen, and what was chosen instead | `DesignerDecision.alternatives` is **declared and never written**. Both live write sites (`processInterviewAnswers.ts:147,365`) populate only `decisionType, choice, choiceType, imageId, reasoning, convictionLevel, captureSource`. Out of scope this phase. |
| **Constraint** | the limit, and what beat it | `DesignerDecision.tradeoffs` — same: declared, never written. |
| **Client** | what the client asked for, in their terms | `DesignerDecision.clientContext` / `clientBriefExcerpt` — same. `isClientDriven` **is** written and is usable as a predicate, but carries no content for a slot. |
| **Continuity** *(new in B2)* | the same material class in two rooms | Nothing structural — the verbs exist and `finishFamilyOf` can derive the class per tag. Waiting only on §6.2 item 3 to size it, and on the Material frame moving to a class source (§3 correction). **The nearest frame to unblocked.** |
| **Numeric** | a counted fact as subject | **No numeric fact exists for a design project** (audit F6). No square footage on `Project` (`squareFootage` belongs to `UnitType`), no era, no duration — `Project.timeline` is an enum, not a span. Room count (`project.rooms.length`) is the only obtainable one and is weak alone. |
| **Location** | a named place as subject | Location resolves to **city + region only** (audit F7). No street or neighborhood exists anywhere in the schema. A frame with a neighborhood slot cannot be filled today. |

The highest-value unblock is the `DesignerDecision` write path: three of the five
blocked frames depend on the same three columns, and the table, taxonomy and live
write path all already exist.

`AttributeVerification` (`aiValue` / `correctedValue` / `verified`, written by the
same live path) is a second untapped source of designer-confirmed structured values,
read by no title generator.

---

## 9. Outstanding — awaiting a decision

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

### `echo` was excluded from Continuity — confirm or overrule

The B2 brief lists `echo` in the Continuity category. `EDITORIAL_BANNED_PHRASES`
bans `"echoing" (to describe formal relationships)`, and a formal relationship is
exactly what Continuity describes. I excluded it and substituted `continue`,
because `docs/17` §5 makes the centralized list binding and a new list quietly
contradicting it is the fragmentation this effort exists to end.

Three ways to settle it, in the order I'd rank them:

1. **Leave it excluded** (current state). `continue`, `run`, `carry`, `repeat` and
   `extend` cover the category.
2. **Narrow the banned-phrase entry** to the prose sense it was written for, and
   admit `echoes` in headlines only. Requires editing canon, which is your call.
3. **Admit it with a collocation ban** — the `anchor` treatment. Weaker here,
   because the ban is on the verb's *meaning* rather than on one phrasing.

### Two `FINISH_FAMILIES` vocabularies exist

`descriptor.ts` (31 entries) and `signals.ts` (38) both define `FINISH_FAMILIES`,
and they differ in both directions — see §3's correction table. They are not
copies that drifted; they were written for different jobs (swap-in descriptor
versus corpus grouping) and the names collide.

Not merged in this phase. If the Material frame moves to a class source, one of
them becomes load-bearing for reader-facing prose and the naming should stop being
ambiguous — `signals.ts`'s list is a material-class vocabulary and `descriptor.ts`'s
is a descriptor vocabulary. `terrazzo` exists only in `descriptor.ts` and would need
carrying over.

### `Product` has no `finish` field

`buildMaterialContext` (`generateEditorialDraft.ts:152–161`) reads `p.finish ||
p.category`. `Product` has no `finish` column, so `p.finish` is always `undefined`
and the article's material context silently falls back to category for every product.
The specification decision lives on `ProductTag.finishRaw`, which per the schema
"always wins". The frame resolver reads the tag; the article generator still does not.

---

## Verification

```
npm run check:headline-frames        # this spec's invariants, frames and verbs
npm run report:headline-coverage     # coverage (needs DATABASE_URL)
npm run check:headline               # the criteria, rules, cycling, the editor
npm run check:regenerate-surfaces
npm run check:naming                 # the product naming gate
npm run check:single-generator
```
