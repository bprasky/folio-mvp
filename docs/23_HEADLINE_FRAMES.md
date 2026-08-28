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

**Three arrangements are implemented over the same six variables** (agent, verb,
object, instrument, borrowed fragment, locative tail). Two fire; one is declared and
correctly ineligible — see §3b.

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
   `classInTwoPlaces` precondition the Continuity verbs need (§7; narrowed to two
   NAMED rooms in §3l).

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

## 3a. The Borrowed-fragment frame

A verbatim fragment of the designer's speech carries the evaluative language;
everything around it stays factual.

> "It was the ugliest room in the house" — and the beam stayed

### Why this is not a loophole in the tail rule

`TAIL_RULE` and `EVALUATIVE_ADJECTIVES` ban evaluation because an assessment cannot
be checked and inflates by default. **A quoted evaluation is a different object.**
The claim is not *this house is remarkable*; it is *the designer said this house is
remarkable* — and that is a fact, checkable against the interview and wrong if they
did not say it.

`docs/17` §5 states the same rule from the other side: pull quotes are the
contributor's actual words, verbatim, never polished. The evaluation is admissible
precisely because it belongs to a named person rather than to us.

`hasEvaluativeTail` is therefore **quote-aware**: it strips double-quoted spans
before checking. Only double quotes — the apostrophe is the straight `'` per
`JSON_PROSE_QUOTING_RULE`, so treating single quotes as speech would swallow
*didn't* and blind the check to everything after it. An unclosed quote takes the
rest of the string, which fails safe: it can only under-report, never flag a quoted
word as an authored one.

**Our own evaluation is still caught alongside a quote.** `"We fought for it" and
the result is stunning` fails, which is the property that stops the frame becoming a
way in for the register it exists to borrow.

### Eligibility and selection

At least one headline-scale verbatim span. `extractQuoteCandidates` — the pull-quote
extractor — is deliberately **not** reused: its bounds are 6–45 words, tuned for a
display line, and a headline is 4–10 words *in total*. A fragment has to leave room
for the sentence around it, so `resolveFragmentCandidates` uses 3–9.

Ranking: worth-borrowing first, then follow-up answers, then shorter, then
alphabetically. The last key makes a batch reproducible across presses.

`WORTH_BORROWING` is deliberately **the same vocabulary `EVALUATIVE_ADJECTIVES`
bans us from using**. That is the device: the words we may not write are exactly the
words worth quoting, because in quotation marks they stop being our assessment.

### The verbatim gate

`borrowedFragmentIsVerbatim` runs on **every candidate that contains quotation
marks**, not only the framed angle. The model does not always keep to the position
it was asked for, and a headline is the worst place in the piece to attribute words
to a designer they did not use. Rejections log as `QUOTE_UNVERIFIED`.

The fragment is **selected, never written** — the pull-quote posture. A headline is
our sentence, so a designer may type their own; a borrowed fragment is a claim about
what they said out loud, so it can only be chosen.

---

## 3b. The Agent-verb-object frame — superseded by §3e

The corpus arrangement: a named studio as subject, a physical verb, the object, an
instrument tail. *"Studio X clads a Brooklyn loft in white oak."*

> **Superseded.** This section records the state through B6–B7. Two of the three
> blockers below were reversed or withdrawn in B8; see §3e for what is true now.

**It cannot fire on the article surface, and that is correct rather than a gap.**
Three independent blockers, none removable in this phase:

| # | blocker | evidence |
|---|---|---|
| 1 | **`agent` cannot be verified.** The contract requires a required slot to be non-null *and verified*. There is no name-verification predicate anywhere in the schema — `User.name` is a plain `String`. | audit §3.A |
| 2 | **Naming the designer is banned here.** `HEADLINE_CRITERIA` states it; `headlineIssues` enforces it as `NAMES_PEOPLE`, at write in the regenerate route and again on read in `buildRoomTiles`. Folio sets the byline directly under the headline. | `headline.ts:207` |
| 3 | **`namedSurface` is unknown.** Rooms are structured; surfaces are not. | docs/23 §7 |

`headlineSlots.ts` therefore **never resolves `agent`**. Resolving it with
`verified: true` would be the exact lie the contract exists to prevent, and would
make the frame eligible on a surface where every output it can produce is killed by
`NAMES_PEOPLE` — an eligible frame yielding nothing, ending in
`NO_USABLE_CANDIDATES`.

It is declared rather than omitted because **an absent frame gets rediscovered and
re-proposed, while an ineligible one carries its reasons with it.** Blocker 2 in
particular is a decision the user owns, not a limitation to engineer around: the
frame would work on a surface with no byline under the headline, which is a product
question.

---

## 3c. Exemplars — sourced

All three frames now carry real published exemplars from
`docs/audits/headline-discriminator-corpus.json`. Selection is mechanical and
asserted by `check:headline-frames` §21:

- **Present in the collected corpus**, compared through `normalizeForVerbatimCheck`
  (the corpus was supplied with straight quotes; anything reaching a prompt must be
  curly per `JSON_PROSE_QUOTING_RULE`). This is what makes "never invented"
  enforceable rather than merely stated.
- **Passes every check Folio enforces.** An exemplar that breaks a rule teaches the
  rule away — exactly how the old criteria came to list the balanced pair as GOOD.
- **Does not open on a named agent**, for the two frames that ship. 57% of the
  corpus does, and Folio bans it; an agent-led exemplar would teach a shape every
  output gets killed for.

| frame | exemplars | note |
|---|---|---|
| `material` | 3 | agent-free, 8–10 words |
| `borrowed-fragment` | **1** | see below |
| `agent-verb-object` | 5 | agent-led, which *is* this frame |

**Borrowed-fragment has one exemplar, and that is what the corpus contains.** Of
eight borrowed-fragment headlines collected, seven open on a studio name. Padding
the array with those would teach the naming shape alongside the borrowing, and the
borrowing is the only half Folio can use. One correct exemplar beats four carrying a
banned shape.

The `agent-verb-object` frame is the one place the corpus's Dezeen skew is an asset:
naming the agent is its shape, so all five fit directly. They pass every mechanical
check — what makes the frame ineligible is the naming ban, not its construction.

---

## 3d. Two rules reversed — B8

Both predate the frame library. Both were written when generation was producing bad
long headlines, and both were treating a symptom the frame library now treats at the
cause: a headline was bad because nothing gave it a shape, not because it was long or
because it named someone.

### The word cap: 10 → 16

35% of the v1 corpus exceeded 10 words; the v2 corpus runs to 17 and its median is
10. Ten was not house style — it was a guess that happened to suppress a failure
mode.

**16 is a backstop, not a shaping constraint.** The frame decides the shape; the cap
only catches a runaway. The 17-word headline that prompted the whole module
("A Miami Beach house that refuses to pick one mood and wear it all the way through")
is still caught, and `check:headline` asserts it.

The bound is now generated from `HEADLINE_MAX_WORDS` in the check rather than
hard-coded, because raising it left a stale literal asserting the old value.

### `NAMES_PEOPLE`: unbanned

**57% of v1 opened on a named agent.** The ban's stated reason — the byline sits
directly under the headline and already says who made this — is not one the corpus
shares. It was killing the best-supported arrangement in the collected corpus.

Sites changed:

| file:line | change |
|---|---|
| `src/lib/posting/headline.ts:34` | `NAMES_PEOPLE` removed from the issue-code union |
| `src/lib/posting/headline.ts` | `HeadlineNames` interface and `nameForms()` deleted |
| `src/lib/posting/headline.ts:181` | `headlineIssues(text)` — the `names` parameter is gone |
| `src/lib/interview/prompts/editorialTone.ts` | the `NEVER NAME THE DESIGNER…` section removed from `HEADLINE_CRITERIA` |
| `src/lib/posting/generateEditorialDraft.ts:962` | `kickerIssues` no longer passes names |
| `src/lib/story/buildRoomTiles.ts:267,274` | the read path no longer re-grades against names |
| `…/headline/regenerate/route.ts:334` | the write filter no longer passes names |
| `…/headline/regenerate/route.ts` | the prompt no longer says "do NOT name them in the headline" |
| `scripts/check-headline.ts` §7 | rewritten to assert the reversal |
| `scripts/check-regenerate-surfaces.ts` | two assertions rewritten |

**What did NOT change: `docs/20`'s product naming gate.** That withholds *product and
brand* names from prose until the exposure is paid for — a commercial rule about a
placement Folio sells. A designer's own credit was never that placement, and the gate
is untouched. `check:headline` asserts both facts together so the two are not
confused later.

---

## 3e. Agent-verb-object now fires

Held back for three phases on three blockers. Two are gone and the third was
somewhere else.

| blocker (B6) | status |
|---|---|
| `agent` cannot be verified — no name-verification predicate exists | **withdrawn as inconsistent** |
| naming the designer is banned | **reversed** (§3d) |
| `namedSurface` is unknown | **true, and irrelevant** — it is a *verb* precondition, not a frame requirement |

**On the first: the schema still has no name-verification predicate, and the frame
now resolves `agent` anyway.** The contract's bar has always been *a human stated
it* — exactly the bar `ProductTag.finishConfirmed` clears. A designer typing their
own name is not a weaker fact than a designer typing a finish. What the schema lacks
is *identity* verification, a higher bar this contract never asked for anywhere else.
Holding `agent` to it while accepting `finishRaw` was an inconsistency, not a
standard. The slot records `account-asserted, not identity-verified` in its `source`.

`object` resolves from `Room.name` via the article's gallery chapters. A named
*surface* is still unavailable — the schema has rooms, not walls.

**It fires when:** a credited name exists, the article covers at least one room, and
a material class appears in more than one place.

**What still gates it is the VERB.** That last condition is doing all the work:
Application, Placement, Division and Aperture verbs all require preconditions nothing
can answer (`namedSurface`, `spatialObject`, `spatialRelation`, `apertureFact`), so
the only verbs ever offered are Continuity ones. The frame can currently say a
material *runs, carries, threads, repeats, extends* or *continues* — and nothing
else. Widening it means resolving surfaces and spatial relations; it does not mean
touching this frame.

It takes the `argument` angle, which asked for a claim someone could disagree with.

---

## 3f. Two arrangements the corpus shows and we do not have

Reported, not implemented.

### Project-as-subject — **distinct, not a generalization**

The v2 corpus's largest agent-free group: 17 entries. Of those, **8 lead with a
material** and are already covered by the Material frame. **9 do not**:

> A Remodel Turns a Dark and Choppy House in Melbourne Into a Bright, Flexible Family Home
> A Midcentury Home's Past Mistakes Are Finally Corrected
> This Ever-Expanding L.A. Home Was 24 Years in the Making

The subject is the *project* or the *intervention* — a remodel, a renovation, the
home itself. Generalizing the Material frame to admit them would destroy what makes
it work: its slot is a value from a closed 38-term vocabulary, traceable to a tagged
product row. "A remodel" is not a slot value; it is the project, which every project
has. The frame would go from *filling a verified slot* to *naming a category*, which
is the free composition the library replaced.

What it would need instead: a slot for the *intervention* — its scope or its scale —
which is not structured today. `Project.stage` is a workflow position and
`Project.timeline` is PAST/PRESENT/FUTURE; neither says what was done.

### Label prefix — the queue can supply a label, but not these labels

Eight entries, seven with a leading label: **Kitchen of the Week** (2),
**Before & After** (4), **Home Tour** (1).

Two candidate sources exist:

- `PostVariant` — `PROJECT_FEATURE, MATERIAL_STUDY, METHOD, DESIGNER_PROFILE,
  EVENT_ESSAY, PROMPTED_ARTICLE, QA, THIS_OR_THAT, GET_TO_KNOW`
- `DesignerAngle.angleType` — `material_loyalty, evolution, anatomy_of_room, process,
  philosophy, client_dynamic, regional_identity`

**Both are internal taxonomies, not reader-facing labels.** "MATERIAL_STUDY" and
"anatomy_of_room" describe why the piece exists; "Kitchen of the Week" and
"Before & After" describe what the reader is about to see, and carry a recurring-
series promise Folio does not make. The corpus labels are *editorial franchises*.

So the answer is: yes, the queue could supply *a* label, and no, it could not supply
these. Adopting the arrangement is a publishing decision — do we run recurring series?
— before it is a code one. Note also the colon construction is on the
`HEADLINE_CRITERIA` banned list ("Colon constructions that announce a theme"), which
would need reversing first.

---

## 3g. Agent-free threshold — there is no threshold frame

The v2 corpus has four:

> Inside an Architect's Minimalist North London Apartment
> Tour a Coastal Norway Home Made of Wood Flooring Scraps

**No threshold frame is implemented.** Three frames exist — `material`,
`borrowed-fragment`, `agent-verb-object` — and none can produce this shape. The
"threshold" grouping has only ever been a corpus label; it was never built.

What it would need:

1. **A frame.** Slots: the threshold verb (`Inside` / `Tour`), an indefinite
   possessor (`an Architect's`, `a Coastal Norway Home`), and the distinguishing
   detail. None of that is hard.
2. **The possessor slot is the real question.** "An Architect's" works because the
   indefinite article does the presupposition without a name. Folio has the credited
   name and the *role*, so `an architect's` is derivable — but whether a headline
   should refer to the credited designer *indefinitely* when the byline names them is
   an editorial call, not a data one.
3. All four corpus entries are Title Case, so none can serve as an exemplar until
   sentence-case instances are collected.

---

## 3h. Casing — B9

Three changes, one decision: **casing is a house convention, not a quality signal.**
Folio's sentence-case output rule is unchanged; what changed is everywhere casing was
being used to *judge*.

### The discriminator lowercases both sets

Dwell and Remodelista set Title Case; Folio sets sentence case. Left alone that is a
perfect tell — the judge would score *Title Case = human* and the rate would measure
which publication's typography the generator imitates, not whether the writing is
good. The same trap the naming ban was.

Both sets are lowercased before the judge sees either, and the system prompt says so
explicitly. The report prints the original, so what comes back is the headline as
published rather than as measured.

**Held-out set: 26 → 56.** Thirty Title Case entries, previously excluded, are now
admitted — including the whole project-as-subject group, which is the closest match
to what Folio produces.

| | v1, old rules | v2, B8 | B9 |
|---|---|---|---|
| held-out set | 5 | 26 | **56** |

### `TITLE_CASE` warns, it does not drop

`headline.ts` always documented it as *"a heuristic, not a gate"* that *"returns a
warning rather than driving a rewrite or blocking generation."* Two sites dropped on
it anyway. **The documentation and the behaviour disagreed, and the behaviour won
silently** — over a house convention a designer can fix in the preview in seconds,
and using a heuristic that trips on any headline which is genuinely mostly proper
nouns.

`HeadlineIssue` now carries `severity: 'error' | 'warning'`, decided on the issue
rather than at each call site — the call sites are what drifted apart. `TITLE_CASE`
is the only warning. `blockingIssues()` is the filter every dropping site uses;
`headlineIssues()` still returns everything, so logging is unaffected.

| file:line | change |
|---|---|
| `src/lib/posting/headline.ts:33` | `severity` added to `HeadlineIssue` |
| `src/lib/posting/headline.ts` | `TITLE_CASE` marked `warning`; the other four `error` |
| `src/lib/posting/headline.ts` | `blockingIssues()` added |
| `…/headline/regenerate/route.ts:380` | drops on `blockingIssues`, and logs `kept with warnings` |
| `src/lib/story/buildRoomTiles.ts:9,270` | read path re-grades on `blockingIssues` |
| `scripts/check-headline.ts` §11 | new — asserts the severity split and both sites |
| `scripts/check-regenerate-surfaces.ts` | two assertions updated |

`generateEditorialDraft.ts:962` already only warned; it was the one site already
matching the documentation.

### Exemplars: 6 / 5 / 6

**Casing turned out not to be the binding constraint — frame identity is.** Of seven
newly-admitted Title Case entries that looked like Material candidates, **only one is
actually material-led**. The other six lead with the *project* — a remodel, a
renovation, a loft — which is the project-as-subject arrangement §3f reports we do
not have a frame for. Using them as Material exemplars would teach the wrong frame
from inside the right one.

| frame | B7 | B8 | B9 |
|---|---|---|---|
| `material` | 3 | 5 | **6** |
| `borrowed-fragment` | 1 | 5 | **5** |
| `agent-verb-object` | 5 | 5 | **6** |

`borrowed-fragment` gains nothing: zero newly-admitted entries carry a quotation.
(*They Gave Their "Grey Gardens" Craftsman a Grand Reinvention* is excluded on
`BANNED_SHAPE` — "Reinvention" — not on casing.)

**One exemplar is re-cased**, and that is a deliberate exception worth stating.
Published as *"Steel Elements Bring a Sheen to This 1300s French Townhouse"*; the
exemplar reads *"Steel elements bring a sheen to this 1300s French townhouse"*. Same
words, same arrangement, house convention — only `French` needed keeping. Done **by
hand, never algorithmically**: `headline.ts`'s own header explains why lowercasing
cannot be automated (it would publish "Miami beach"). The corpus keeps the published
form; the exemplar check matches case-insensitively through
`normalizeForVerbatimCheck`, and asserts the result no longer reads as Title Case.

An exemplar going into a prompt must not teach Title Case, which is why exemplars are
re-cased while the held-out set is not: the held-out set is *judged* with casing
normalized away, but an exemplar is *copied*.

One exemplar still trips `looksTitleCased` — *"Studio Okami Architecten updates
Belgian home with The Garden Pavilion"* — as the documented false positive: it is
sentence case whose proper noun happens to be three capitalised words.

---

## 3i. B10 — the first batch that reached a designer, and why it was inert

Five headlines, reported as terrible. **All five passed every gate the pipeline
had.** Three defects, all of them ours.

```
A glass table was chosen to keep a bright dining room from crowding
A stone bought without a shopping list became the bathroom's anchor
Yes, always in the plan”: paneling that raises a bedroom ceiling by inches
Black anchors were the first idea for the dining room, and stayed the last
Styling that took more objects than the shelf could keep
```

### Defect 1 — the frame asked for the passive

The Material frame put the material in subject position and then said:

> Then {tail}: **what was decided about** that material

…and the tail slot read *"What was **done with it, decided about it**, or paid for
it."* Every phrasing is passive. The frame made the material **grammatically the
subject and semantically the patient** — which is exactly what came back.

The corpus does the opposite. The material **acts**: *Coloured marble **defines**
his-and-hers sinks*, *Blocks of terrazzo **divide up** muted pizza restaurant*.

The shape now demands an active transitive verb with the material as agent, and
carries two of the reported failures as labelled NOs so the defect is shown, not
described.

### Defect 2 — the verb library was dark

**Only 2 of 8 verb conditions were ever set.** `materialClass` and
`classInTwoPlaces`; never `namedSurface`, `spatialObject`, `spatialRelation`,
`apertureFact`, `existingStructure`, `newBuild`.

So five of six categories could never fire, `renderVerbInstruction` returned `''` on
nearly every project, and **the model picked its own verb** — *was chosen*,
*became*, *took*, *stayed*. The verb was called "the highest-leverage slot in the
corpus" in B2 and it was empty.

Two conditions were asking for the wrong thing:

- **`namedSurface` → `namedPlace`.** Surfaces are not structured — the schema has
  rooms, not walls — so it could never hold. But *"clads the kitchen in oak"* is
  what these verbs do; a **room** is the object they take. The condition was
  narrower than the verbs need and narrower than the data has.
- **`spatialObject`** is a tagged product on a photograph of a named room. The tag
  carries x/y coordinates, so the placement is recorded, not inferred.

| | before | after |
|---|---|---|
| verbs offered, material in one room | **0** | **14** |
| verbs offered, material in two places | 6 | **20** |

`spatialRelation`, `apertureFact`, `existingStructure` and `newBuild` remain
unresolvable and stay **absent rather than false** — that half was always working.

### Defect 3 — `normalizeHeadline` ate the opening quote

It stripped leading and trailing quotes **independently**, which was right until the
Borrowed-fragment frame started putting a quotation first:

```
in   “Yes, always in the plan”: paneling that raises a bedroom ceiling
out   Yes, always in the plan”: paneling that raises a bedroom ceiling
```

An orphaned closing quote, published. It now strips only a **wrapping pair** — both
ends, or neither.

The verbatim gate had the matching hole: it tested `/[“"]/`, opening glyphs only, so
a headline carrying a lone `”` skipped the check entirely. It now tests any quote
glyph.

### The enforcement: `hasWeakPredicate`

Prompt prose alone is what failed here, so the rule is checkable. Three shapes, all
ways of avoiding a finite active verb:

| shape | example |
|---|---|
| passive | *was chosen*, *were kept*, *was laid* |
| copula / becoming | *was the first idea*, *became the anchor*, *stayed the last* |
| verb demoted into a relative clause | *styling **that took***, *paneling **that raises*** |

Irregular participles are a small closed list (*laid, built, made, hung, sunk, cast,
held…*) and are covered — `was laid across the entry` is the common case, not
`was placed`.

Quoted spans are exempt: a passive inside a quotation is the designer's sentence,
not ours.

**Deliberately not a general English rule.** Published headlines do use the passive
(*"A Midcentury Home's Past Mistakes Are Finally Corrected"*). This is a rule for the
three arrangements Folio has, all of which want their subject to act. It flags 6 of
the 56 held-out headlines — every one a project-as-subject or copula shape we have no
frame for. **A project-as-subject frame would need to relax it.**

Results: **5 of 5 reported headlines caught, 0 of 17 exemplars lost.** Rejections log
as `WEAK_PREDICATE`.

---

## 3j. The tail is resolved — B10

`docs/audits/HEADLINE_GRAIN_AUDIT.md` found the Material frame's `tail` slot was
**never pushed**. It rendered as a description — *"what the material acts on, and
where"* — so the model supplied the place. **Three of the first five headlines to
reach a designer named no location at all.**

### The room was known and discarded

`resolveMaterialCandidates` built a `Set` of room identities and exported only
`.size`. It knew a class appeared in *Dining Room* and *Primary Bath* and reported
**2**.

`MaterialCandidate` now carries `rooms: string[]`. Two sets, because counting and
naming are different questions:

| set | answers | includes |
|---|---|---|
| `places` | how many distinct places → `roomCount` | rooms **and** unassigned images (an unassigned image is its own place; it cannot be proven to be the same one) |
| `rooms` | which rooms, by name | real room names only |

The `image:<id>` sentinel exists to keep the count honest and **must never reach a
headline as a place name**, which is why it lives in the other set. Room names come
from `assignedRoom.name` with the legacy `image.room` string as fallback — the same
precedence the gallery uses — and are sorted, so a batch is reproducible.

### The tail slot

`resolveTail(rooms, location)`:

1. one room → that room
2. two or more → the first two, joined. **At most two** — a headline listing four
   rooms is an inventory, which is the caption shape the criteria ban
3. otherwise → `Project.city, regionState`
4. otherwise → **null**

**`tail` joined `requiredFields`.** Null makes the frame ineligible rather than a
prompt to guess. A Material headline that cannot say *where* is not one this frame
should offer.

The location fallback is genuinely weaker — it says the marble is in Miami, not which
room — but it is still a fact, and a fact beats the model choosing.

### One thing this exposed

`renderFrameInstruction` appended *"stated by the designer"* to every resolved value.
True of a confirmed finish; **false of a room name or a city**. A prompt that
overstates provenance invites the model to treat a database value as speech. The
label is now the slot's own `source`: `[verified — Room.name where travertine is
tagged]`.

---

## 3k. The room-as-object variant — reported, not built

The audit's sharpest number: **76% of the corpus names no material class at all**,
and the Material frame requires one. Material-as-subject is real but a minority — of
19 corpus headlines naming a material, 4 have it as subject and 10 as instrument.
Subject grain across the whole corpus is **41% project/dwelling, 13% room, ~0%
product instance**. The five samples were 100% product-or-below.

What the variant would take:

| change | consequence |
|---|---|
| `requiredFields: ['object']` | fires on any project with a room, not only one with a tagged material class — this is where the coverage is |
| material demoted to `instrument` | *"…clads the kitchen in oak"* rather than *"oak clads…"*, which is the corpus's dominant form |
| ranking inverted — pick the room first, then the class within it | `roomCount` stops being the sort key and becomes evidence for *which* room; the aggregation is the same, keyed the other way |
| Application and Placement verbs read correctly | today they need the material as their subject, which is the minority form |

### What `hasWeakPredicate` would need to relax, and why

It currently flags **6 of the 56 held-out headlines**, and every one is a project- or
room-subject shape:

```
A Miami Renovation That Blends Concrete and Rich Wooden Interiors
A Midcentury Home's Past Mistakes Are Finally Corrected
Vollerup Atrium House is a monolithic summerhouse on the Danish coast
```

That is not a false-positive rate to fix — it is the predicate correctly enforcing a
rule scoped to the three arrangements Folio has, **all of which want their subject to
act**. A room-as-object frame changes the premise: a room legitimately *is* acted
upon, so the passive and the copula stop being evasions and become the arrangement.

Two of the three sub-rules would need scoping to the frame rather than the batch:

- **`PASSIVE_VOICE`** — *"A Midcentury Home's Past Mistakes Are Finally Corrected"* is
  a published headline and a room-grain one.
- **`COPULA` / `BECOMING`** — *"Vollerup Atrium House **is** a monolithic summerhouse"*
  is the named-project copula arrangement.

**`VERB_DEMOTED` should stay global.** *"Styling that took more objects than the shelf
could keep"* is inert at any grain — a subject owning no verb is not an arrangement,
it is a missing one.

Scoping it means the route must know which frame produced which candidate, and it
currently does not — it applies the check to the whole batch precisely because the
model does not reliably keep to the position it was asked for. That coupling is the
real cost of the variant, and it is why this is reported rather than built.

---

## 3l. Project grain reaches the prompt — C1

Three defects, one theme: the generator had project-level material and could not see
it as project-level.

### The question category was destroyed on read

`loadInterviewAnswers` resolves each answer's `roomId` to a room name and assigns it
to `section`. Its own docblock said `section` was the question category. Both are
true of different things — the category is what a STORED answer's `section` holds,
the room is what a LOADED answer's holds — and the second overwrote the first.

For a room answer that is correct and load-bearing. `quoteCandidates.ts:98` and
`selectPullQuotes.ts:173` both match `section` against a chapter title; a quote whose
section stops naming its room stops being offered for that room. **The field was not
renamed and its meaning was not changed.**

The cost was the other half. A project-level answer has no `roomId`, so it fell to
`'General'` and reached the headline prompt rendered `- [General] …`, identical to an
unassigned room answer. The five most narrative answers on the project — the brief,
the limits, the big idea, the signature, the pivot — were present in the prompt and
unlabelled.

`LoadedAnswer.category` now carries the other half alongside. It is recovered from
the question id, because **no column records it**: `EditorialInterviewAnswer` has
`questionId`, `questionText` and `roomId`, and no scope, topic or category field. Ids
are minted `project-<CATEGORY>-<uuid>` and two readers already depended on that shape
(`getInterviewQuestions.ts:318`, `interview/route.ts:302`). No migration.

Two details worth keeping:

- **Matched against `PROJECT_QUESTION_CATEGORIES`, not split on hyphens.** A category
  contains underscores and a uuid contains hyphens, so splitting would work by
  accident. Prefix-matching a known member means a malformed id yields `null` rather
  than whatever sat between the first two hyphens.
- **A follow-up inherits its parent's category, resolved from BOTH stores.** A
  follow-up carries its own question id, not its parent's. Provenance holds
  `parentQuestionId` directly; the projection resolved that to a row id at write time,
  so it is walked back through the loaded rows. They must agree, because the category
  is part of the de-dupe key — a disagreement would surface not as a wrong label but
  as the same answer appearing twice.

### The prompt now has two blocks

Project-grain answers are rendered under their own heading, labelled by what the
question asked ("The big idea", not `DESIGN_DIRECTION`); room answers keep the heading
and the room bracket they had. `PROJECT_ANSWER_LABELS` is typed
`Record<ProjectQuestionCategory, string>`, so a sixth category fails the build rather
than shipping an unlabelled answer.

**The editor still sees both.** `judgeHeadlines` cuts a candidate the interview does
not support; handed only the room block it would have started cutting exactly the
headlines this split exists to enable — a candidate grounded in the client brief would
read as unsupported because the brief was not in the evidence. The prompt splits;
the editor does not.

### `classInTwoPlaces` was not the Continuity precondition

It was `roomCount > 1 || imageCount > 1`, and neither half asked the Continuity
question:

- `roomCount` is `places.size`, and `places` carries an `image:<id>` sentinel for every
  tag on an unassigned photo. That is deliberate — counting must not understate — but
  it means two unassigned photos read as two places.
- `|| imageCount > 1` then made even that irrelevant. **Two photographs of one kitchen
  satisfied it outright.**

So run, carry, thread, repeat, extend and continue were being offered on projects where
the class had been photographed twice in the same room. The verb claims the material
crosses the house; the evidence said it was shot from two angles.

Now `rooms.length >= 2` — the naming set, two named rooms, which is the claim the verb
makes. **Strictly narrower.** Some projects lose the Continuity category, and those are
the projects that never earned it. §7's table row and §6.2's coverage item 3 both refer
to this predicate and now mean the stricter one.

### Continuity ships with an empty exemplar array

When a Continuity angle or frame lands, its `exemplars` array must be **empty**.

Of the 56 held-out human headlines, seven carry any project-wide spread — and **not one
of them says "room to room."** They are project-wide impressions: *"Steel Elements Bring
a Sheen to This 1300s French Townhouse"*, *"Tour a 17th-Century Paris Loft Overflowing
with Vintage Items"*, *"Erik Bratsberg fills Persona restaurant with tactile materials
and own artworks"*. The shape a Continuity angle proposes — one move traced across named
rooms — has **no published analogue in the corpus**.

That is not a reason to drop the angle. It is the one place Folio holds evidence a
publisher's writer never sees: room-level tag data. But it must ship knowing it is
unattested, and `HeadlineFrame.exemplars` already carries the rule (`headlineFrames.ts:76`):

> Empty means unsourced, not "none exist". `assertFrameLibraryIntegrity` reports empty
> arrays rather than failing, so a frame ships usable and gets its exemplars when
> someone can read them off published articles.

An invented exemplar here would teach a shape nobody has validated — which is precisely
how the previous criteria taught the balanced pair as GOOD. See
`docs/audits/PROJECT_ANGLE_AUDIT.md` §3 for the measurement.

### Correction: `agent` is resolved, just not here

`headlineSlots.ts` carried a comment stating `agent` is NEVER resolved, and gave the
reason: `headlineIssues` killed every output the Agent-verb-object frame could produce
(`NAMES_PEOPLE`), so eligibility would have been pointless. **B8 removed that ban** and
the regenerate route has resolved `agent` from the credited party since. The comment
stayed on the page after it stopped being true.

What survives is *where*, not *whether*. The credited name comes off
`Project.designerOrg` / `Project.designer`, which `resolveHeadlineSlots` does not load —
it selects `city` and `regionState`. The route already holds that row for the byline, so
resolving it there costs no query and resolving it in the slot resolver would cost one.

The honesty note is still live: `agent` is account-asserted, not identity-verified.

---

## 3m. Project grain becomes the subject — C2

Three frames added, both re-gate holes closed, and the angle list stopped being a
constant.

### The two re-gate holes

Both let a headline outlive the rule that bans it, from opposite ends.

**The read path ran only half the mechanical checks.** `buildRoomTiles` re-grades a
stored pool on the way out precisely so a shape banned this week is retired from
batches written before the ban. `hasWeakPredicate` shipped as a route-only check in
§3l's predecessor, so it was never in that list — and `blockingIssues` has no opinion
about voice. *"A stairway's mixed metals **were kept**, then let loose into rooms next
door"* passed the re-grade every time it was read. A stale pool could not self-clean;
the only way to stop being offered a passive headline was to generate a new batch.

**The live headline re-entered the pool ungated.** `pool = [currentKicker, ...kept]`
prepended it unconditionally, so a headline written before a rule existed came back on
every press *because it was the one currently showing*. It is now gated by the same
two checks every other pool member passes. That does not strand the designer:
`HeadlinePicker` splices the live headline back when the stored pool lacks it, so it
stays reachable while live and simply stops being preserved as an **option** once they
move off it.

### Three project-grain frames

The three original frames put a MATERIAL, a QUOTE or a STUDIO in subject position. The
corpus puts the project there 41% of the time and a room 13% (grain audit §4). An
article is about a project.

| frame | subject | evidence | source | required |
|---|---|---|---|---|
| **Continuity** | the project | a material class | `MaterialCandidate.rooms`, ≥2 named | `project`, `material`, `rooms` |
| **Governing decision** | the project | one choice | DESIGN_DIRECTION answer, verbatim | `project`, `decision` |
| **Constraint** | the project | a limit | CLIENT_BRIEF + SCOPE_PARAMETERS, verbatim | `project`, `constraint` |

**Transformation is deliberately absent.** It is the corpus's largest angle at 37% and
there is no before-state anywhere in the schema — no renovation/new-build field, no
before-image flag, and the two tables that look right are dead. An angle built on it
would be an LLM asked to find a prior state in five answers that never ask about one,
which returns something every time. See `docs/audits/PROJECT_ANGLE_AUDIT.md` §2.

**The prose slots are verbatim, and that is the borrowed fragment's standard, not the
material class's.** `decision` and `constraint` carry the designer's own answer text.
What is verified is that they wrote this sentence — not that a model correctly
extracted a governing element from it. The writer is handed the words and told to find
it there or write a different angle; the shape says so and the editor checks it.

**`project` is resolved, never inferred.** The place comes off `Project.city` /
`regionState`; the dwelling noun off `Project.projectType`, an enum, and only for the
values that map to one ordinary noun. COMMERCIAL covers an office and a shop and a
gym, so it maps to nothing. UNSPECIFIED is the column default and the common case, and
there the slot carries the place alone — *"Brooklyn"*, not *"a Brooklyn house"*. A
weaker headline and a true one; the alternative is a model deciding from nothing
whether a project is a house or an apartment, in the most-read sentence Folio publishes.

No location at all → the slot is null → **all three frames go ineligible together.**
That is correct: *"A house answered to one stone"* is about nothing.

### Continuity ships with an empty exemplar array

Recorded in §3l and now enforced. `check-headline-frames` names the exemption rather
than expressing it as a threshold, so a second frame shipping empty still fails and
filling this one also fails — both are wrong, in opposite directions.

### The angle list is computed per project

`ANGLES` was a constant of six. It is now built per request:

1. **Project-grain angles**, each present only if `eligibleFrames` returned its frame.
   No fallback brief — an angle whose source did not resolve is not asked for.
2. **Base angles with an eligible frame** behind them (`client` →
   borrowed-fragment, `argument` → agent-verb-object, `first-move` → material).
3. **Free-form briefs** for the rest.

Capped at `MAX_ANGLES = 6`, which is what the batch was before, so cost is unchanged.

Two things this order encodes:

- **GOVERNING-DECISION displaces FIRST-MOVE, and CONSTRAINT displaces CONSTRAINT.**
  These are the same questions at two grains — *"the one selection that set everything
  after it"* is the governing decision with a material in the subject slot — and asking
  both would spend four candidates arguing with itself. So the Material frame is often
  eligible and unbound on a well-interviewed project. That is the phase working, and
  `unboundFrames` logs it so it is not mistaken for the other cause.
- **Computed angles outrank briefs under the cap.** Ordering the other way had a quiet
  cost worth recording: with all three project-grain angles resolved, the cap fell on
  ARGUMENT and FIRST-MOVE, so the two richest material-grain frames silently stopped
  firing on exactly the best-equipped projects. `bind` no-ops when its angle is absent,
  so nothing said so.

Measured eligibility, over synthetic slot sets:

| project shape | project-grain | material-grain |
|---|---|---|
| tagged + interviewed | continuity, governing-decision, constraint | all three |
| interviewed, no tags | governing-decision, constraint | borrowed-fragment |
| tagged, not interviewed | continuity | material |
| material in ONE room | governing-decision | material |
| no location | — none | material |
| nothing | — none | — none |

Nothing pads. A material in one room loses Continuity; a project with no location loses
all three.

### `hasWeakPredicate` does NOT need scoping for these three

Measured rather than assumed. All four of the angles' own worked examples pass
unmodified:

| headline | verdict |
|---|---|
| Paneling runs room to room through a Miami Beach house | ok |
| A Miami Beach house built for a family that never leaves the water | ok |
| One stone set the palette for an entire Miami Beach house | ok |
| A dark Miami Beach house opened to the light it was hiding from | ok |

Of 14 project- and agent-subject corpus headlines, two are flagged: *"A Midcentury
Home's Past Mistakes **Are** Finally **Corrected**"* (true passive) and *"Vollerup Atrium
House **is a** monolithic summerhouse"* (copula). Both are Transformation-adjacent or
copular — shapes the tail rule and the subject-must-act instruction discourage
independently, and Transformation is not in this phase.

The reduced passive is why: *"a house **built** for a family"* has no auxiliary, so
`PASSIVE_VOICE` (`(was|were|is|are|been|being) + participle`) does not match it. A
project can be acted upon in the corpus's grammar without tripping the check.

**What scoping would take, if Transformation ever lands.** `PASSIVE_VOICE` and
`COPULA`/`BECOMING` would need to be frame-scoped; `VERB_DEMOTED` stays global, since a
verb hidden in a relative clause is wrong in every frame. §3k recorded that scoping
needs the route to know which frame produced which candidate and that it deliberately
did not. **C2 changes that half:** position is the angle (`Math.floor(index/2)`) and
`framesByAngle` maps angle to frame, so the route can now name the intended frame for
any candidate. What it still cannot do is verify the model kept to it — the mapping is
what was *asked for*, not what came back. Scoping on that basis relaxes the check for a
candidate that may have drifted, so it should wait for a real need rather than being
built speculatively.

---

## 3n. The article headline is rebuilt on the interview — C3

§3m added project-grain angles and left the material-grain frames in the same
candidate pool. That was not enough, and the reported batch says why:

- *"BP Design clads the Dining Room in glass, to keep the room from crowding"*
- *"BP Design clads the Dining Room in black hardware and pendants"*
- *"Wood paneling reaches the primary bedroom because it was 'yes, always in the plan'"*
- *"A Miami Beach house carries one marble from the kitchen into Connor's Bath"*

Two agent-verb-object at room grain, one material-grain, one Continuity working
exactly as designed. Adding angles could not fix this, because **the pool still
offered the shape**.

### The candidate set is the interview

`resolveProjectHeadlineSlots` replaces `resolveHeadlineSlots` on this route. It
issues **no `ProductTag` read**, resolves no material class and reads no room name.
The room-answer block is gone from the prompt too.

Why the tag path came off: it ranked material classes by tag count and built the
headline around the winner, so the output was confidently specific about whatever
had been photographed most rather than about anything the designer emphasised. **A
tag count is evidence of what got photographed, not of what mattered.** If a
material or a room reaches an article headline now, it is because an answer put it
there.

`resolveHeadlineSlots` is untouched and still resolves everything, because the
caption layer needs exactly what this one refuses.

### Two gate axes, because neither implies the other

`HeadlineFrame` carries `grain` (what is in subject position) and `source` (where
the evidence comes from). The article surface requires **both** `grain: 'project'`
and `source: 'interview'`.

| frame | grain | source | leads an article? |
|---|---|---|---|
| constraint | project | interview | **yes** |
| governing-decision | project | interview | **yes** |
| change | project | interview | **yes** |
| continuity | project | tags | no — caption |
| material | material | tags | no — caption |
| agent-verb-object | material | tags | no — caption |
| borrowed-fragment | material | interview | no — caption |

One axis would not have done it. **Continuity is project-subject and tag-sourced** —
it says something about the whole house, and says it because tag counts put a
material in two rooms. Borrowed fragment is the mirror image. Relabelling either to
force a single axis would have been a lie about what it does; two independent
predicates say the actual rule.

Nothing is deleted. All four off-surface frames stay declared, exemplar-checked
against the corpus, and asserted by `check-headline-frames`.

### Change, the third angle

Sourced from SURPRISE_PIVOT — *"what changed along the way"*. That is a change of
DIRECTION, not the corpus's before-and-after: the audit found no before-state in the
schema and that is still true. The frame reports the change the designer described
and its shape forbids inferring a prior condition they did not state.

### Substantive, not merely present

`"n/a"`, `"not sure"`, a stray character — each is a non-empty answer and none is a
headline source. An angle needs its answer to clear a floor (24 characters, 5 words)
or it is ineligible.

The floor is set by what it must let THROUGH. A first pass at 40/8 rejected *"One
stone, everywhere it could go"* — 34 characters, six words, and the best
governing-decision answer in any sample here. A designer being terse is not a
designer being unhelpful, so it sits just above the answers that carry no content at
all and leaves the rest to the writer and the editor.

### No eligible angle means no headline

Measured on the article surface:

| project shape | angles |
|---|---|
| all four opening answers substantive | governing-decision, constraint, change |
| big idea + pivot only | governing-decision, change |
| client/scope only | constraint |
| answers but no location | **NONE** |
| **tags only, no interview** | **NONE** |
| nothing | **NONE** |

The last three return HTTP 422, `NO_ELIGIBLE_ANGLE`, naming which opening question
is unanswered. That is the same decision the endpoint already made when every
candidate failed the rules — offering nothing is a correct outcome, not a failure to
hide — and it is actionable in a way a bad headline is not: every angle here is
unlocked by work the designer can do.

Falling back to a material frame would reintroduce exactly what this removes, one
layer down. A well-tagged, un-interviewed project gets **no article headline**, and
that is the intended answer.

### Batch size holds, spread over what resolved

Two candidates per angle was right at six angles. At one angle it is a batch of two,
which is not a picker. `TARGET_CANDIDATES` is divided over however many angles
resolved, capped by `MAX_PER_ANGLE` — six takes on one angle would be the flat batch
this structure exists to prevent, arrived at from the other direction.

### What C2 built and C3 removed

The room-grain angle briefs (`BASE_ANGLES`) are retained in the route file, unused,
for the caption surface. They must not come back: carrying no frame, nothing
constrains their grain, and the most concrete thing in this prompt is the article's
own room list. `check-headline-frames` asserts the angle list is built from
`PROJECT_GRAIN_ANGLES` alone, so wiring them back in fails a check rather than
quietly reintroducing the bug.

Also gone from this route with the tag path: the `agent`, `object` and `verb` slots,
and the verb library — every one of its preconditions is tag-derived, so none could
be answered here. The frames still declare those slots, which is what a caption
surface will resolve against.

---

## 3o. The picker shows angles, and the deck follows the title — P1

Presentation only. No generation logic changed.

### The angle stops being discarded

Position always encoded the angle, and the route used that three times — to spread
the kept set, to log per-keep angles, to log coverage — then dropped it when `kept`
mapped to `s.text`. So the designer was handed several different STORIES presented as
one list of interchangeable strings, and asked to arrow through them. Comparing
wordings is a different and harder task than choosing what the article is about.

The pool moves from `string[]` to the shape pull quotes already use:

```ts
{ selected: { text, angle, angleLabel } | null,
  alternatives: [{ text, angle, angleLabel }] }
```

`angleLabel` is the frame's own `name` — already written for display, so nothing was
authored.

**The legacy arm is not optional.** Every pool in production is a bare array and
`BlocksSchema` is strict, so an undeclared shape is stripped on the next parse.
`kickerAlternatives` is a union and readers go through `normalizeTitleAlternatives`,
mirroring `normalizePullQuote`. A legacy entry gets no angle — honest, since none was
recorded — and renders without a label. Verified: both shapes survive a strict parse.

### One labelled option per angle

`HeadlinePicker` renders a group per angle, headed by the label, with every option as
a row. Cycling is gone: the invariant the counter protected — reach every option, not
two of them — is structural once each option is its own row.

"New options" splits in two. **"More like this"** regenerates ONE angle; the
top-level button still re-rolls all of them. The per-angle request replaces only that
angle's entries and leaves the rest standing — re-rolling everything would cost the
designer the stories they had not rejected yet, which is the slot-machine behaviour
the batch model exists to prevent.

A requested angle can NARROW the batch and never create one: an angle whose source
answer did not resolve stays ineligible however it is asked for. A stale request
(the label outlived the answer behind it) returns `ANGLE_NOT_ELIGIBLE`, 409 — a
different condition from an empty project and it must not borrow its message.

### The deck follows the title

Choosing a title now POSTs `sections/deck/regenerate`: fixed title in, one deck out.

`frozenLead` already solved the general version — a designer-edited lead field is
passed to the generator as FIXED context so the unfrozen field is written to fit it —
and choosing already wrote that override. What was missing was a cheap trigger: the
only consumer of `frozenLead` is a full article regeneration, which rewrites every
chapter to update one sentence.

The endpoint is deliberately not a generator. It writes no headline, touches no
chapter, and **reads the same project answers the title was written from**, so the
deck cannot introduce a fact the title's own angle never had access to. It is also
told which angle the title took, which turns the existing DIVIDE THE WORK rule from a
hope into a decidable instruction.

Failure is non-blocking on purpose. A deck that fails to rewrite leaves the previous
one — which is what the designer already had — and must not cost them the title they
just chose.

### The no-angle state is a to-do

`NO_ELIGIBLE_ANGLE` already named which opening questions were unanswered, and
`HeadlinePicker` rendered it as one line of grey error text. It is now a panel: *"Answer
a few more opening questions to get title options"* and the list. It is the most
actionable message in the flow — every angle is unlocked by work the designer can do —
and it was the most buried.

### Not done, deliberately

No correction-signal capture. The audit found the stored pair is *(pre-batch headline
→ current text)*, not *(generated candidate → correction)*, and fixing that needs
changes to the override path plus a row-volume question that needs the database.
`SectionOverride` is untouched.

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

#### v2, re-measured under the B8 rules

80 unique headlines (up from 46), adding Dwell and Remodelista, which write
agent-free by default.

| | v1, old rules | v2, new rules |
|---|---|---|
| unique entries | 46 | **80** |
| passes every Folio check | 22 (48%) | **38 (48%)** |
| agent-free | 20 (43%) | **53 (66%)** |
| Folio-legal **and** single-project — the held-out set | **5** | **26** |

**The held-out set goes from 5 to 26** — from below the script's floor to above the
20 it recommends. Two things did it: the naming unban stopped excluding 57% of the
corpus, and v2 added publications that do not lead with a studio name.

Word count now spans 4–17, median 10.

**The dominant rejection is now `TITLE_CASE` — 38 of 80.** Dwell and Remodelista set
headlines in Title Case; Folio's house style is sentence case. That costs the entire
project-as-subject group, which is otherwise the closest match to what Folio
produces. Ignoring casing would give **56** rather than 26, but the judge could then
separate on casing alone — the same methodological trap the naming ban was. 26 is the
set that needs no normalization, and it is what `human` holds.

##### A live inconsistency this surfaced

`headline.ts` documents `TITLE_CASE` as *"a heuristic, not a gate"* that *"returns a
warning rather than driving a rewrite or blocking generation."* The regenerate route
drops any candidate with **any** issue, `TITLE_CASE` included — so it is a gate in
practice. Thirty corpus entries turn on which of the two is true. Not fixed here: B8
decided two rule changes and this is a third.

#### v1 (superseded) — 57% of it was a shape Folio could not produce

Collected by the project owner from Dezeen (majority) and Architectural Digest: 46
unique published headlines, classified by arrangement. Measured against Folio's own
checks:

| | count | share |
|---|---|---|
| opens on a **named agent** — banned here by `NAMES_PEOPLE` | 26 / 46 | **57%** |
| over the 10-word maximum (median real headline is 9, max 13) | 16 / 46 | 35% |
| reads as Title Case | 4 / 46 | 9% |
| uses a banned generic verb — `unveils`, `features`, `celebrate` | 3 / 46 | 7% |
| **passes every check Folio enforces** | 22 / 46 | **48%** |
| agent-free **and** Folio-legal | 13 / 46 | 28% |
| …and a single-project feature rather than a round-up or news item | **5 / 46** | **11%** |

`hasEvaluativeTail` flags **zero** of the 46 — every piece of evaluative language in
the corpus is already inside quotation marks, which is the borrowed-fragment device
appearing independently in the wild.

**This governs how the held-out set is built.** A discriminator whose human set is
57% studio-as-subject is not measuring writing quality; it is measuring whether the
generator imitates Dezeen's byline grammar — a shape Folio bans outright, so the
judge would score `names a studio → human` and the rate would be near zero while
saying nothing. The set is therefore restricted to headlines Folio could plausibly
have produced, which is **5**.

Five is the script's bare floor and well below the 20 it recommends, so
`check-headline-discriminator` now warns loudly under 20 rather than reporting a
rate as though it were settled. The gap is precisely the one the collector flagged:
publications like *World of Interiors* and *Cabana* that use three allusive words
with the deck carrying the facts, and do not lead with the studio name.

The full 46 are kept in `byArrangement`; `_humanSelection` records the three
exclusion criteria and the count each removes.

### Results

| run | date | misidentification rate | control | n |
|---|---|---|---|---|
| baseline (pre-frame) | — | **not obtained** | — | — |
| post-frame | — | **not obtained** | — | — |

**Neither number was obtained.** Of the three things a run needs, **one is now
resolved permanently**:

| | status |
|---|---|
| the held-out corpus | **DONE** — v2, 80 entries; the held-out set is 56, well above the recommended 20 |
| `ANTHROPIC_API_KEY` | still unset in every authoring session; the judge is a model call |
| a generated set | needs `DATABASE_URL` plus generation — press New options on ~20 projects, or read `blocks.lead.kickerAlternatives` off published posts |

The corpus was the blocker nobody could clear from inside the repo, and it is
cleared. The remaining two are credentials.

The harness is complete and runs given all three:

```
npx tsx scripts/check-headline-discriminator.ts --generated <batch.json>
```

No CI floor, per scope. One run is a sample and the judge is a model; a floor set
from a single number would fail honest work. Record runs in this table until there is
enough history to know the spread.

### 6.1b Frame selection on real projects — `npm run report:headline-samples`

The B6 deliverable: for each published project, which frames are eligible, which
angle each takes, and the slot values it draws from — computed by the same functions
the route calls (`resolveHeadlineSlots`, `eligibleFrames`, `selectVerbs`), so the
eligibility reported is the eligibility production sees.

**Not obtained — no `DATABASE_URL`.** The script refuses rather than inventing
projects.

**It does not generate headlines, deliberately.** The writer prompt is assembled
inside the route handler and `check:regenerate-surfaces` pins seven assertions to
its text living there. Copying it into a script would create the second copy this
whole effort exists to prevent; extracting it would mean rewriting that guard, in
service of a script that cannot be run here anyway. So the model call stays where it
is. Everything the deliverable asks for *except* the generated line is decided
before the model is called — which is the design — and all of it is in this report.

To see actual headlines: press **New options**, and read `[headline/regenerate]
frames` for what fired.

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
| **Continuity** | run, carry, thread, repeat, extend, continue | `classInTwoPlaces` — two NAMED rooms since §3l | — |
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

That argument was not yet true when it was written. Until §3l the precondition also
fired on `imageCount > 1`, so "verified in more than one room" described a predicate
that two photographs of one room satisfied. It is true now. The decision does not
change — it was settled on cost, not on this — but the reasoning behind it only
started holding in C1.

Settled against admitting it anyway, on cost: the substitution costs little —
`continue`, `run`, `carry`, `repeat` and `extend` cover the category — and reopening
canon for one verb is not warranted.

**The narrow amendment stays available.** If the Continuity set proves too thin in
use, the move is to narrow the `EDITORIAL_BANNED_PHRASES` entry to the prose sense it
was written for and admit `echoes` in headlines only, where the two-places
precondition already guarantees there is something behind it.

### Material-class vocabulary gap — APPLIED (B5)

`MATERIAL_CLASSES` audited against `naming/descriptor.ts`'s `FINISH_FAMILIES` (31).
**Eight terms sat only on the descriptor side.** Two were added in B5, taking the
vocabulary from 38 to 40. `white oak` is rejected; the other five are correctly filed
as descriptors.

| term | material class? | verdict |
|---|---|---|
| `steel` | **yes** — a material, sibling of the `iron` / `zinc` / `pewter` / `bronze` already present | **added** |
| `terrazzo` | **yes** — a composite material, sibling of `concrete` / `terracotta` | **added** |
| `white oak` | **yes** — a species, narrower than the `oak` already present | **rejected** — see below |
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

#### `white oak` — REJECTED, settled (B5)

Not deferred. Under first-hit-wins, admitting `white oak` is a **splitting operation
on an existing group**, and splitting can only ever remove signals: tags leave the
`oak` group, and any signal that depended on `oak` clearing a threshold can fall
below it. Nothing is gained that offsets that.

**Adding a class that resolves to `null` today and splitting an existing class are
different kinds of change and must not be batched together.** The first cannot
regroup anything; the second does nothing else. Treating them as one edit is how a
vocabulary change quietly becomes a signal migration.

The concrete regression path:

1. **It can destroy a repetition signal.** A designer with white oak in three
   projects has an `oak` signal at 3/N today. Split into two white-oak and one
   plain-oak project, `oak` drops to 1 and **falls below the `>= 2` gate** while
   `white oak` gets 2. Net can be a wash or a loss.
2. **It silently weakens positioning.** `oak` is named in **three**
   `POSITIONING_TERMS` entries (`signals.ts:257, 263, 269`). Once white-oak products
   resolve to `white oak`, they stop matching those claims unless `white oak` is
   added to each entry — which is a separate edit to a different constant.

**If species-level resolution is ever wanted, a flat list is the wrong shape for
it.** `white oak` and `oak` are not siblings — one contains the other — and a
first-hit-wins array cannot express that. It needs a **two-level taxonomy** (class →
species, with the class retained for grouping and the species available for
headlines), plus coordinated `POSITIONING_TERMS` edits so a species still matches
every claim its class matches. That is a design change, not a vocabulary line.

#### Applied (B5)

```
steel      signals.ts:28   beside 'iron' in the metals group
terrazzo   signals.ts:31   beside 'concrete' in the stone/mineral group
```

Placement carries no ordering constraint: neither string overlaps an existing class,
so first-hit-wins is not in play and grouping is for readability only. Verified after
the edit — `"White Oak Counter Stool"` still resolves to `oak`, so nothing was split.

**`terrazzo` also joined the stone positioning claim** (`signals.ts:287`, alongside
marble, travertine, limestone, granite, soapstone, quartz). Without it the class
would be half-admitted: repeated terrazzo would produce a repetition signal but could
never support a positioning claim, because positioning matches on `families[]`
membership and nothing else. `steel` was **not** added to any positioning entry —
none of the existing terms (warm, natural, quiet, rich, stone, texture, glossy) has a
reading steel obviously belongs to, and inventing one is a separate editorial call.

#### Churn measured — `npm run report:digest-churn`

B4 predicted an addition is not strictly additive: Outlier, Singular and Evolution
can each move signals for unrelated families. Measured before and after.

| corpus | gained | lost | unrelated families moved |
|---|---|---|---|
| `fixtureA` (check:digest) | 0 | 0 | 0 |
| `fixtureB` (check:digest) | 0 | 0 | 0 |
| probe (engineered) | 4 | 1 | **1** |

**Zero churn on the real fixtures — and that is a fact about the fixtures, not
evidence the mechanism is inert.** Neither contains a steel or terrazzo product, so
no tag changed class and no consumer could move. A report stopping there would read
as reassurance it had not earned.

So the tool carries a probe corpus engineered to make the mechanism visible. Early
half: brass 20%, chrome 80%. Late half: brass 40%, chrome 60%, plus steel and
terrazzo tags present in **both** runs — only the vocabulary changes whether they
count toward the `familyShares` denominator.

```
+ evo:finish:steel:rising
+ evo:finish:terrazzo:rising
+ rep:finish:steel
+ rep:finish:terrazzo
- evo:finish:brass:rising      <-- UNRELATED FAMILY
```

Brass has nothing to do with steel or terrazzo. Its rising signal disappeared because
the denominator grew: `8/20 = 40%` became `8/30 = 27%`, so its delta fell from +0.20
to +0.07 — under `EVOLUTION_MIN_DELTA = 0.15`. Exactly the mechanism B4 named, now
reproducible with one command.

Expected, not a failure. Recorded so the next vocabulary change is measured rather
than assumed, and so a missing evolution signal is not later investigated as a bug.

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
