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

### CORRECTION (B2, applied in B3) — the gate was at the wrong granularity

**Applied.** The frame now resolves a material class; `finishConfirmed` no longer
gates it. What follows is the diagnosis; the new behaviour is under *Eligibility*.

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

In B2 this was recorded and not acted on. B3 applies it.

### Eligibility (B3)

**A material class resolves for the project.** That is the whole gate.
`finishConfirmed` is no longer read for eligibility — it is still counted and
logged, so one project's `[headline/regenerate] frames` line shows the old gate
beside the new one.

Resolution is `materialClassOf(colorFinish, productText)` per tag, where
`colorFinish` is `Selection.colorFinish` (falling back to `finishRaw`, then
`finishCanonical`) and `productText` is `Product.name` + `.description` +
`.category`.

#### What "verified" means under the class source

The frame contract requires a slot to be non-null and **verified**. Here that means
*traceable to a designer action on a row*: the designer placed the tag — they chose
that product for that photograph — and the class is a deterministic projection of
that product onto a closed vocabulary.

This is a different claim from B1's and weaker in one direction (the designer did
not type the word "marble") and stronger in another (a derived class cannot be a
brand, and cannot be a sentence typed into the wrong field). Neither source is
inference from prose, which is the line that actually matters.

#### Still refused, and one deliberate reversal

**Still refused: a material named in interview prose.** The interview supplies the
frame's tail; a noun a model found in a paragraph is not a structured value.

**Reversed: a material inferred from product data.** B1 refused this because
`buildDescriptor` would turn "Antolini Calacatta slab" into "a marble" and present
it as though the designer had said marble. Under `materialClassOf` the emitted token
is the class `marble` and can be nothing else — not the brand, not the collection,
not a phrase. **What made inference unsafe was the open output, not the reading of
the name.** Recorded in the source so it is not rediscovered as a regression.

#### Look-alike guard — added beyond the B3 instruction, flagged for review

`materialClassOf` substring-matches, so *"marble-look porcelain"* and *"faux
travertine"* resolve to the material they imitate. The corpus digest tolerates that;
a headline cannot. *"Marble runs from the kitchen to the bath"* is simply false about
a porcelain floor, in the most visible line of the piece and under an accuracy
contract.

So a tag whose text carries a look-alike qualifier (`look`, `effect`, `inspired`,
`style`, `faux`, `imitation`, `repro`) is dropped **on the headline path only**. It
rejects the tag, not the class — a project with real marble elsewhere still resolves
marble.

This was not in the B3 brief. Removing `LOOKALIKE` in `headlineSlots.ts` restores
plain `materialClassOf` behaviour.

### Ranking

Candidates rank by **distinct rooms**, then images, then tag count, then
alphabetically. Five
tags of the same brass on one photograph is one decision photographed five times; the
same brass across three rooms is the project answering to it. The alphabetical
tiebreak makes a batch reproducible across presses.

### Brand safety

`docs/20` gates product and brand names out of published prose unless the exposure is
paid for, and calls the sentence *"Folio's most valuable editorial real estate."* A
headline is the most valuable sentence there is.

The protection is **total by construction**: the slot value is a member of the fixed
38-entry `MATERIAL_CLASSES` vocabulary and nothing else. The resolver reads a product
name but cannot emit one — `materialClassOf` returns a vocabulary term or `null`.

This is strictly stronger than B1. There, the value was `finishRaw`, free text a
designer typed, and the hole was a designer entering a brand into the finish field
("Calacatta Gold by Antolini"); `carriesProprietaryName()` existed to police it.

`carriesProprietaryName()` is **retained as defence-in-depth and is now unreachable
on this path**. `assertIsMaterialClass()` is what makes that claim checkable rather
than asserted — the resolver drops any value not in the vocabulary before the
proprietary-name check is even reached, and `check:headline-frames` §3 asserts both
that every vocabulary member passes and that a brand string, a finish string and an
empty string all fail.

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

**The B3 before/after eligibility count was likewise not measured.** Row 2 is the old
gate and row 1 the new one, so the gap between them *is* the answer; both need a
database. What can be stated without one: the new gate is **strictly broader**. Every
project with a confirmed finish also has a tagged product, and `materialClassOf`
resolves from the product regardless of whether anyone typed a finish — so the new
eligible set contains the old one, minus only tags dropped by the look-alike guard.
Per-project, the `[headline/regenerate] frames` log now emits `confirmedFinishTags`
beside `materialClasses`, so a single press shows the difference.

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

### `echo` stays excluded — SETTLED (B3)

`echo` is excluded from Continuity; `continue` remains the substitute.

The reason: the ban in `docs/17` §5 targets **asserted resonance with nothing behind
it** — the register where one thing "echoes" another because it sounds like criticism,
not because anything was established. The Continuity category's `classInTwoPlaces`
precondition arguably dissolves that objection, since a verb that only fires when the
same material class is verified in more than one room is asserting a fact rather than
a resonance.

Settled against admitting it anyway, on cost: the substitution costs little —
`continue`, `run`, `carry`, `repeat` and `extend` cover the category — and reopening
canon for one verb is not warranted.

**The narrow amendment stays available.** If the Continuity set proves too thin in
use, the move is to narrow the `EDITORIAL_BANNED_PHRASES` entry to the prose sense it
was written for and admit `echoes` in headlines only, where the two-places
precondition already guarantees there is something behind it.

### Material-class vocabulary gap — AUDIT COMPLETE, ADDITIONS AWAITING APPROVAL (B4)

`MATERIAL_CLASSES` (38) audited against `naming/descriptor.ts`'s `FINISH_FAMILIES`
(31). **Eight terms sit only on the descriptor side.** Nothing has been added;
`MATERIAL_CLASSES` is unchanged.

| term | material class? | verdict |
|---|---|---|
| `steel` | **yes** — a material, sibling of the `iron` / `zinc` / `pewter` / `bronze` already present | **propose** |
| `terrazzo` | **yes** — a composite material, sibling of `concrete` / `terracotta` | **propose** |
| `white oak` | **yes** — a species, narrower than the `oak` already present | **hold** — see below |
| `stainless` | no — shorthand for stainless *steel*; a qualifier, not a material | reject |
| `brushed steel` | no — a finish **of** steel | reject |
| `matte black` | no — colour + sheen | reject |
| `black` | no — colour | reject |
| `white` | no — colour | reject |

The five rejects are correctly filed: a descriptor's job is to describe the object,
so colours and finishes belong on that side. Only the misfiled *materials* move.

#### Pure addition versus regrouping — the distinction that decides the risk

Measured, not assumed. `materialClassOf` today returns `null` for text containing
seven of the eight candidates, and `"oak"` for `white oak`.

- **`steel`, `terrazzo` — pure additions.** No existing class claims their strings,
  so no product changes group. Tags that resolved to nothing start resolving.
- **`white oak` — a regrouping.** Matching is first-hit-wins in array order, so to
  take effect it must be placed *before* `oak`, and every white-oak tag then moves
  out of the `oak` group.

#### Digest impact — the five consumers of `finishFamily`

| consumer | gate | effect of a PURE ADDITION |
|---|---|---|
| Repetition (`byFamily`) | `projectIds.size >= 2` | **strictly additive.** Families are independent and `strength` is per-family. New signals only. |
| Positioning (`POSITIONING_TERMS`) | `families[]` membership | **none.** Neither `steel` nor `terrazzo` appears in any `families` array. |
| Outlier (Jaccard) | `PROJECT_OUTLIER_MIN_DISTANCE = 0.6` | **can change existing signals.** A new `finish:` trait shifts every pairwise distance, so an outlier can appear or disappear. |
| Singular | `repeatedFamilies >= 2` (global) | **can change existing signals.** A new repeated family can flip this gate on, enabling singular signals for *other* families that were suppressed. |
| Evolution | `EVOLUTION_MIN_DELTA = 0.15` | **can remove existing signals.** `total` counts only non-null families, so a new class raises the denominator and lowers *every* other family's share in both halves; a delta near 0.15 can fall under it. |

So an addition is **not strictly additive**. Two of the five consumers can alter or
drop signals that have nothing to do with the new term. That is the real cost, and it
applies to any addition, including the two proposed.

#### Why `white oak` is held back

Beyond the regrouping itself, there is a concrete regression path:

1. **It can destroy a repetition signal.** A designer with white oak in three
   projects has an `oak` signal at 3/N today. Split into two white-oak and one
   plain-oak project, `oak` drops to 1 and **falls below the `>= 2` gate** while
   `white oak` gets 2. Net can be a wash or a loss.
2. **It silently weakens positioning.** `oak` is named in **three**
   `POSITIONING_TERMS` entries (`signals.ts:257, 263, 269`). Once white-oak products
   resolve to `white oak`, they stop matching those claims unless `white oak` is
   added to each entry — which is a separate edit to a different constant.

`white oak` should be decided on its own, together with the positioning edits it
implies. It is not a one-line vocabulary addition.

#### Proposed batch — TWO terms, awaiting approval

```
steel      → beside 'iron' in the metals group
terrazzo   → beside 'concrete' in the stone/mineral group
```

Placement is free of ordering constraints: neither string overlaps an existing
class, so first-hit-wins is not in play. Grouping is for readability only.

Not written. `MATERIAL_CLASSES` is unchanged pending approval.

**One related edit deliberately NOT proposed:** `terrazzo` arguably belongs in the
stone `POSITIONING_TERMS` entry (`signals.ts:287` — marble, travertine, limestone,
granite, soapstone, quartz). That is a change to a different constant with its own
signal consequences and is out of scope here.

### The two `FINISH_FAMILIES` vocabularies — RESOLVED by rename (B3)

`signals.ts`'s constant is now **`MATERIAL_CLASSES`** and its resolver
**`materialClassOf()`**. `descriptor.ts` keeps its own local `FINISH_FAMILIES`,
untouched — it is a descriptor vocabulary for swap-in text and is correctly named for
what it holds.

Pure rename, verified: the vocabulary is identical in content and order (38 entries),
and the old and new implementations return identical results on all 52 probe inputs.

**Still open:** `terrazzo` exists only in `descriptor.ts`'s list, so the class
vocabulary cannot currently resolve a terrazzo floor. Adding it to `MATERIAL_CLASSES`
would change corpus-digest grouping as well as headlines, so it is not a free edit and
was left alone.

**Also left alone:** `descriptor.ts:18` carries a prose reference to the old
`finishFamilyOf` name in a comment explaining that it is deliberately *not* coupled to
the corpus digest. The instruction was to leave that file untouched, so the reference
is now stale by one name. Harmless, and a one-word fix whenever that file is next
edited.

`DigestProduct.finishFamily` (`editorial-queue/types.ts`) keeps its field name — it is
the digest's own data shape, and renaming it would ripple into grouping logic for no
gain in this phase.

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
