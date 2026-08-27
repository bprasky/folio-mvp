# PROJECT-LEVEL HEADLINE ANGLES — AUDIT

Read-only. No code changed.

Scope: article headlines move to project grain; room grain moves to social captions.
The generator produces up to four angles — Continuity, Constraint, Transformation,
Governing decision — the designer picks one, the rest disappear, and the chosen one is
editable.

Everything below is what exists today, not what should be built.

---

## Summary

Six findings, in the order they change the plan.

**A1. Project-scoped answers are distinguishable, but by string prefix, not by schema.**
`questionId` is `project-<CATEGORY>-<uuid>` and `roomId` is null. Two independent
readers already rely on the prefix. Nothing in `EditorialInterviewAnswer` names the
category as a column.

**A2. `loadInterviewAnswers` — the reader the headline generator uses — destroys the
category.** It overwrites `section` with the resolved room name, so every project-level
answer arrives labelled `General`. The headline pipeline has never been able to tell a
CLIENT_BRIEF answer from a follow-up about a bathroom faucet.

**A3. The corpus supports the four angles very unevenly, and it is inverted against
Folio's data.** Transformation is the corpus's largest angle (37%) and Folio has no
before-state field anywhere. Continuity is the corpus's smallest (12%, and zero of those
say "room to room") and is the only one Folio can compute exactly today.

**A4. Only one of the four is computable from structured data. The other three are
LLM extractions over prose,** which is a different reliability class and needs saying
out loud before four angles are promised.

**A5. The pick is already recorded — the resolver's inputs are not.** `SectionOverride`
stores `originalBody`/`editedBody`/`editedAt` on every headline change, so the correction
signal is half-built. What is missing is which angle produced the text and what the
resolver put in the governing slot; both exist today only as a `console.info` line.

**A6. All three existing frames survive as angle *shapes*, none as an angle.** Frames
answer "what grammar", angles answer "what about". They are orthogonal, and the current
code conflates them — `framesByAngle` overwrites an angle's brief with a frame's shape.

---

## 1. The opening interview answers

### Which questions are project-scoped

Exactly five, fixed, always all present. `src/lib/interview/generateProjectQuestions.ts:28`:

| category | what it asks (fallback wording, `:71`) |
|---|---|
| `CLIENT_BRIEF` | "Who was this project for, and what did they come to you wanting?" |
| `SCOPE_PARAMETERS` | "What were you working within on this one — the space, the timeline, the realities that shaped your decisions?" |
| `DESIGN_DIRECTION` | "What was the big idea? When you picture this project, what ties it all together?" |
| `SIGNATURE_IDENTITY` | "What in this project would someone who knows your work immediately recognize as yours?" |
| `SURPRISE_PIVOT` | "What changed along the way — a decision or discovery that took the project somewhere you did not expect?" |

The LLM path rewrites the wording per respondent role (DESIGNER / ARCHITECT / BUILDER /
HOMEOWNER / VENDOR / PHOTOGRAPHER) but **cannot change the category set** — it is asked
for exactly one question per category and the ids are stamped in code, not by the model
(`:95`, `:326`). When the call fails, `buildFallbackProjectQuestions` (`:89`) ships the same
five. So the project section is guaranteed present on every project, which matters for
eligibility: the *questions* always exist, only the *answers* vary.

They are grouped into a synthetic room (`getInterviewQuestions.ts:212`):

```
roomId: 'project',
roomName: 'About This Project',
```

### How the answers are stored

Two stores, and the split is documented at `loadInterviewAnswers.ts:1-22`:

- **`ProjectPost.provenance.interview.payload.answers`** — canonical JSON. Everything
  that decides reads here.
- **`EditorialInterviewAnswer`** — a queryable projection, rebuilt wholesale by
  `rebuildAnswerProjection` (`syncInterviewAnswers.ts:91`).

### Distinguishable in the schema, or only by position?

**Neither, precisely. By ID prefix — a string convention.**

`EditorialInterviewAnswer` (`prisma/schema.prisma:1866`) has `questionId`, `questionText`,
`roomId`, `isFollowUp`, `isCrossRoom`, `questionSource`. It has **no** category, topic, or
scope column. The generator does carry a `topic` field (`project_client_brief` etc.,
`generateProjectQuestions.ts:104`) but `topic` is on `GeneratedQuestion`, never on the
answer row, and `rebuildAnswerProjection` does not write it.

What survives is the id. `questionId` is copied verbatim through the projection
(`syncInterviewAnswers.ts:121`), so `project-CLIENT_BRIEF-<uuid>` is intact in the table
and in provenance. Two readers already depend on this:

- `getInterviewQuestions.ts:318` — `a.questionId.startsWith('project-')`
- `interview/route.ts:302` — with the comment that states the rule outright:
  *"Answers carry a first-class `roomId` (D5); project-level answers have none and are
  identified by their id prefix."*

So the discriminator is: **`roomId === null` AND `questionId` starts with `project-`**,
and the category is the middle segment of the id. That is recoverable with a `split('-')`
and no migration. It is also fragile in the ordinary way — nothing enforces the format,
and a `LIKE 'project-%'` scan is the only SQL that can find these rows.

### The one place it is already lost

`loadInterviewAnswers` — the function the headline endpoint calls — **overwrites the
category**:

```ts
// loadInterviewAnswers.ts:45
const roomOf = (a: any): string =>
  resolveRoomName({ roomId: ..., room: ... }) ?? 'General';
...
push(a?.answer ?? a?.a, roomOf(a), !!a?.isFollowUp);
```

`section` is documented as *"the question category ('what'/'how'), not a room"* at
`:16` — and then assigned the room name anyway. For a project-level answer `roomId` is
null, so it falls to `'General'`.

The headline prompt renders these as `- [${a.section}] …`
(`regenerate/route.ts:185`). Every one of the five most narrative answers on the project
reaches the writer tagged `[General]`, indistinguishable from an unassigned room answer.
**The interview's project-grain layer is present in the prompt and unlabelled.** Any
project-angle work needs a reader that keeps the category, and `loadInterviewAnswers`
is not it.

### The digest

There is already a project-grain distillation: `distillInterviewFacts.ts:20`.

```ts
export interface KnownFacts {
  client?: string;      // who the client is
  scope?: string;       // new build / renovation / furnishing, extent
  timeline?: string;    // how long / when
  direction?: string;   // the stated big idea, neutral
  corrections?: string; // where the designer contradicted the metadata
}
```

Fed exclusively by `readAboutProjectAnswers` (the prefix filter), persisted to
`provenance.interview.knownFacts` (`getInterviewQuestions.ts:330`), capped at 220 chars
per field, Haiku-extracted, and **explicitly stripped of emphasis** — *"Strip all
emotional emphasis, storytelling, and the designer's rhetorical framing."*

This is the closest thing to project-angle source data that exists, it is already
persisted, and the headline generator does not read it. It is also deliberately the
wrong shape for a headline: it is a notebook, and it was built to *prevent* narrative
from steering room questions.

---

## 2. Sourcing each angle

### Continuity — reachable, exactly, today

`MaterialCandidate` already carries what this needs (`headlineSlots.ts:82`, built at `:360`):

```ts
{ value, tagCount, imageCount, roomCount, rooms: string[] }
```

`rooms` holds real room names, sorted; `roomCount` counts distinct places. Ranking is
already *by distinct rooms first* (`:370`) — the sort key literally is "how many rooms
did this repeat in". A material class in ≥2 named rooms is a computed continuity claim
with the room names attached.

This is the only one of the four that needs no model call, no new capture, and no prose.
It is B10's `rooms` array read for what it is rather than as a tail.

One correction if this ships: the existing `classInTwoPlaces` fact is **not** the
Continuity predicate. It is `roomCount > 1 || imageCount > 1` (`:483`), and `roomCount`
counts a `places` set that includes an `image:<id>` sentinel for unassigned photos. Two
photographs of one kitchen satisfy it. Continuity needs `rooms.length >= 2` — the naming
set, not the counting set.

**Coverage caveat.** Continuity inherits every gate on the material path: the project
must have tagged products, resolving to a `MATERIAL_CLASSES` member, surviving the
lookalike filter, on images with rooms assigned. That is a narrower population than
"projects with an interview".

### Constraint — partially reachable, and the reachable part is thin

Three sources, none sufficient alone:

1. **`SCOPE_PARAMETERS`** — the question is literally *"the realities that shaped your
   decisions"*. This is the angle's question, already asked on every project. It is free
   prose and needs extraction.
2. **`KnownFacts.scope` / `.timeline`** — already distilled, already persisted, 220 chars,
   third person. Deliberately de-emphasised, so a distilled scope reads *"gut renovation
   of a 1920s duplex, 14 months"*, which is a fact, not a constraint someone had to beat.
3. **Structured fields** — `Project.budgetBand` (UNSPECIFIED/LOW/MID/HIGH/LUXURY),
   `Project.projectType`, `Project.clientType`, `Project.timeline` (PAST/PRESENT/FUTURE).
   All enums, all defaulting to UNSPECIFIED or RESIDENTIAL, none of them a constraint
   the project answered — `budgetBand: LOW` is a band, not "built for the cost of the
   kitchen it replaced".

**Verdict: reachable only as an LLM extraction over the SCOPE_PARAMETERS answer.** The
structured fields cannot carry it. The corpus's own constraint headlines confirm the
shape needed is specific — *"24 Years in the Making"*, *"first US affordable housing
development"*, *"A Pet-Friendly Overhaul"* — and none of those is an enum value.

### Transformation — NOT reachable. No before-state exists anywhere.

This is the finding that most affects the plan. Searched and confirmed absent:

- **No renovation/new-build field on `Project`.** `grep -in "renovat|newbuild|existingStructure"`
  over `schema.prisma` returns `builderProjectTypes` (a User profile array), the
  `ProjectType` enum (RESIDENTIAL/COMMERCIAL/HOSPITALITY/… — building use, not
  intervention type), and nothing else. `docs/23` §6.2 already records this as the reason
  every Intervention verb is permanently withheld.
- **No before-images.** `ProjectImage` has `inclusion`, `roomId`, `aiTags`, `aiMaterials`
  — no phase, era, or before/after flag.
- **`ProjectDesignJourney`** (`schema.prisma:5483`) *is* a transformation table —
  `productsKept/Swapped/Added/Removed`, `originalStyleTags` vs `finalStyleTags`,
  `styleDriftNotes`. It is about **procurement drift**, not the building's prior state,
  and it is dead: `src/lib/design-journey.ts` is its only reference and **that file has
  no callers**.
- **`ProjectDesignIntent`** (`schema.prisma:5392`) has `styleGoals`, `materialPreferences`,
  `clientNotes` — a plausible "what was intended" side. **Zero references in `src/`.** No
  writer, no reader.

What does exist is prose: `SURPRISE_PIVOT` ("what changed along the way") and
`KnownFacts.corrections`. `SURPRISE_PIVOT` asks about a change of *direction*, not a
change of *state* — "we abandoned the original kitchen plan" is a pivot, not "a dark
house opened to the light".

**Verdict: needs capture that does not exist.** Either a project-provenance field
(the same one `docs/23` §6.2 has wanted since B2) or a new interview question that asks
for the prior state directly. An LLM asked to extract a before-state from the current
five answers will invent one, because four of the five questions never ask about it.

### Governing decision — reachable as extraction; a structured version exists but is unusable

Sources, best first:

1. **`DESIGN_DIRECTION`** — *"What was the big idea? … what ties it all together?"* This
   is the angle's question verbatim. Prose.
2. **`KnownFacts.direction`** — already distilled and persisted from exactly that answer.
   Closest existing artifact, 220 chars, neutral.
3. **`materials[0]`** — the top-ranked material class is already a defensible "the palette
   everything answered to", and the existing `first-move` angle asks for precisely this.
   Structured, but it can only ever name a *material*; a governing decision is often a
   layout, a reference, or a sightline (*"uses broken-plan layout"*, *"looks to 1960s
   offices"*).
4. **`DesignerDecision`** (`schema.prisma:2080`) —
   the schema is exactly right for this: `choice`, `reasoning`, `alternatives`,
   `tradeoffs`, `convictionLevel`, `isClientDriven`, `clientBriefExcerpt`. **The write
   path does not fill it.** Two writers, both in `processInterviewAnswers.ts`:
   - `:147` — image-linked classification answers only; needs `linkedImageId` and an
     `attributeType`. Room/image grain.
   - `:365` — any answer with `richnessScore > 0.5`, which writes
     `decisionType: 'style_direction'`, **`choice: 'interview_response'`** and
     `reasoning: <the whole answer text>`.

   `choice` — the field that would name the governing element — is a literal placeholder
   string on every project-level row. `alternatives`, `tradeoffs` and `isClientDriven` are
   never written by either writer. And `richnessScore` is a word count
   (`digestInterviewAnswer.ts:207`: `<20 words → 0.1`, `<50 → 0.3`, `<100 → 0.5` …), so
   the gate selects long answers, not decisive ones.

**Verdict: reachable as an LLM extraction over DESIGN_DIRECTION + SURPRISE_PIVOT.** The
structured table that should hold it holds a placeholder.

### Sourcing, condensed

| angle | structured source | prose source | verdict |
|---|---|---|---|
| Continuity | `MaterialCandidate.rooms` | — | **computable today** |
| Constraint | none usable | `SCOPE_PARAMETERS`, `KnownFacts.scope` | extraction only |
| Transformation | **none** | `SURPRISE_PIVOT` (wrong question) | **needs new capture** |
| Governing decision | `materials[0]` (material only) | `DESIGN_DIRECTION`, `KnownFacts.direction` | extraction, plus a weak structured fallback |

**One of four is computed. One of four cannot be sourced at all.**

---

## 3. Eligibility

### What predicate would gate each

Angles must be computed, never padded. Stated as predicates over what exists:

**Continuity** — pure, no model call:
```
materials.some(m => m.rooms.length >= 2)
```
Governing element: `m.value`. Evidence: `m.rooms`. Both already on the row. Note this is
strictly stronger than the existing `facts.classInTwoPlaces`, per §2.

**Constraint** — two-part, and the second part is the real gate:
```
answerFor('SCOPE_PARAMETERS') is non-empty
  AND an extraction returns a named limit with a stated consequence
```
The first half is a lookup. The second is a model call that must be allowed to return
nothing — and, on the evidence of `richnessScore`, must not be gated on answer length.
A long answer about a timeline is not a constraint the project answered.

**Transformation** — cannot be written honestly today:
```
a prior-state fact exists   ← no field, no image flag, no question asks for it
```
Any predicate over the current five answers is a predicate over an LLM's willingness to
find a before-state, which is ~1.0. This is the definition of padding.

**Governing decision** — a disjunction, and the branches are not equal:
```
extraction over DESIGN_DIRECTION returns a named element with stated consequence
  OR materials.length > 0 AND materials[0].roomCount >= 2
```
The second branch is the current `first-move` angle. It is honest but narrow — it can
only produce "one stone set the palette", never "one layout decision did".

### What fraction of projects would have zero / one / two / three / four

**This needs a database and I do not have one.** `DATABASE_URL` is unset in this
environment; `ANTHROPIC_API_KEY` is unset, so the three extraction-gated angles could not
be measured even with rows. This is the same blocker that has held the B2 coverage report
§6.2 percentages and the B6 twenty-project sample.

What can be said without measuring:

- **Four is not reachable on any project today.** Transformation has no predicate, so the
  ceiling is three.
- **Continuity's population is bounded by the material path** — tagged products →
  `MATERIAL_CLASSES` hit → not a lookalike → images with `roomId` assigned → ≥2 distinct
  rooms. `docs/23` §6.2 flags the assigned-room step as the narrowest of these.
- **Constraint and Governing decision are bounded by the same thing:** whether the
  designer answered `SCOPE_PARAMETERS` and `DESIGN_DIRECTION` at all. The questions are
  guaranteed present; the answers are not.
- **Zero-angle projects will exist and the surface has to survive them.** A project with
  no tags and a skipped interview yields nothing on all four predicates. The existing
  endpoint already handles this correctly — `NO_USABLE_CANDIDATES`, HTTP 422
  (`regenerate/route.ts:577`) — and that behaviour should not be softened to fill a
  four-slot UI.

To measure: count projects where `rooms.length >= 2` holds for some material class, and
count non-empty `SCOPE_PARAMETERS` / `DESIGN_DIRECTION` answers via the `questionId`
prefix. Both are single queries against prod. Neither is runnable here.

### The corpus disagrees with the data — and this is the important part

Measured over the 56 held-out human headlines in
`docs/audits/headline-discriminator-corpus.json`. Surface-marker matching, not judgement;
the markers are listed below the table and the matched headlines are reproducible.

| angle | n / 56 | share |
|---|---|---|
| Transformation (explicit prior state or before/after label) | 12 | **21%** |
| Transformation (change-word only — "renovation", "remodel", "updates") | 9 | 16% |
| **Transformation, combined** | **21** | **37%** |
| Governing decision (one element + an active governing verb) | 16 | **29%** |
| Constraint (a named limit) | 10 | 18% |
| Continuity (project-wide spread) | 7 | **12%** |

Two things follow, and they point in opposite directions:

1. **Transformation is the corpus's biggest angle by a wide margin, and Folio's data
   cannot produce it.** *"A Remodel Turns a Dark and Choppy House in Melbourne Into a
   Bright, Flexible Family Home"*, *"A Midcentury Home's Past Mistakes Are Finally
   Corrected"*, four separate *Before & After:* prefixes. Publishers lead with it because
   the reader wants the delta. This is the strongest argument yet for the
   project-provenance field `docs/23` §6.2 has been asking for — it is not one verb
   category, it is the single most-published angle.

2. **Continuity is the corpus's smallest, and not one of the seven says "room to
   room".** The seven are project-wide *impressions* — *"Steel Elements Bring a Sheen to
   This 1300s French Townhouse"*, *"Overflowing with Vintage Items"*, *"fills Persona
   restaurant with tactile materials"*. The proposed exemplar, *"Paneling runs room to
   room through a Miami Beach house"*, has **no** analogue in 56 published headlines.

   That does not make Continuity wrong. It makes it the angle where Folio has evidence
   nobody else has — the room-level tag data a publisher's writer never sees. But it
   should ship knowing it is unattested, and the exemplar slot should stay empty rather
   than be filled with an invented one. `HeadlineFrame.exemplars` already has this rule
   (`headlineFrames.ts:76`): *"Empty means unsourced, not 'none exist'."*

Reproduction: the marker regexes are `PRIOR_STATE`, `CHANGE_WORD`, `LIMIT`, `GOVERNS`,
`SPREAD` over `d['human']`. Headlines can match more than one bucket, so the columns sum
above 56. Coarse by construction, reported as shares, not exact figures.

---

## 4. The pick as a signal

### Where a chosen angle would be stored

The pick already has a storage path, and it is not the obvious one.

**Today:**
- The batch lives at `expandedBlocks.lead.kickerAlternatives` — declared in
  `BlocksSchema` (`schemas.ts:137`) as `z.array(z.string().max(120)).max(8)`. **A flat
  string array. No angle, no frame, no slot values.**
- The live headline is `expandedBlocks.lead.kicker`.
- Choosing goes through `HeadlinePicker.choose` → `edit.save(LEAD, 0, 'kicker', next)`
  (`HeadlinePicker.tsx:61`) → `PATCH /sections/override`.

`BlocksSchema` is strict — an undeclared key is stripped on the next parse, and the
`kickerAlternatives` declaration carries a comment saying exactly that. So a
`{text, angle, governingElement}` shape needs a schema change to survive, but only a Zod
one; `expandedBlocks` is a `Json` column and needs no migration.

### What already records the choice

`SectionOverride` (`editingTypes.ts:8`) — and it is better than expected:

```ts
{ chapterIndex, paragraphIndex, field, originalBody, editedBody, editedAt }
```

The override route (`sections/override/route.ts:80-97`) reads the live value first and
stores it as `originalBody`, then writes `editedBody`. On re-edit it **preserves the
first `originalBody`** (`:95`) rather than chaining, so the record is always
`what-was-generated → what-the-designer-has-now`. Persisted to
`ProjectPost.sectionOverrides`.

So for headlines: **every pick and every hand-edit already writes a before/after pair
with a timestamp.** The correction signal is half-built.

### What it would take to record the choice plus the edit

Three gaps, in increasing cost:

1. **The pick and a hand-typed headline are indistinguishable.** Both arrive as the same
   PATCH with `field: 'kicker'`. Distinguishing them needs either a flag on the request
   or a membership test against `kickerAlternatives` at write time. Cheap.

2. **Nothing records which angle produced the chosen text.** The batch is
   position-encoded at generation (`ANGLES[Math.floor(index/2)]`) and that mapping is
   discarded before storage — `kept` is mapped to `s.text` (`:493`). The angle survives
   only into a `console.info` line (`:536`). Fixing this means storing the pool as
   objects, which means the `BlocksSchema` change above.

3. **Nothing records what the resolver put in the governing slot — and this is the
   valuable one.** The user's framing is right: *an edit that replaces the governing
   element is the designer correcting the resolver.* If the resolver said the governing
   material was `marble` and the designer edits it to say `oak`, that is a labelled
   correction on a structured field. If they only rewrite the phrasing, that is style.
   **The two are indistinguishable in `SectionOverride` today**, because the override
   stores two opaque strings and the slot values were never persisted beside them.

   Everything needed is computed and thrown away. `resolveHeadlineSlots` returns
   `slots` with `{name, value, source, verified}` per slot; the route logs
   `topMaterial`, `topMaterialRooms`, `tail`, `eligible`, `verbsOffered`
   (`regenerate/route.ts:536-553`) and persists none of it. Recording the resolved
   governing element beside each candidate is what turns a text diff into a labelled
   training signal — and it is a JSON-shape change, not a schema change.

   Worth noting what it would be worth: it is the only mechanism in the system that
   would let a designer's edit correct the **resolver** rather than the **sentence**.
   Every other correction path in the codebase (`AttributeVerification`,
   `verifiedAttributes`) works at image grain; there is no project-grain equivalent.

### What must not be inferred

An edit that changes the governing element is only a correction **if the designer saw
what the resolver claimed**. If the headline says "one stone set the palette" and the
designer rewrites it to name oak, they may be correcting the resolver or they may be
writing a better sentence about a different thing. Recording it as a resolver correction
requires the UI to have shown the claim, not just the sentence. That is a product
decision, not a storage one, and it should be settled before the signal is trusted.

---

## 5. What the existing frames become

The three frames were built for a single-headline flow at material grain. The distinction
that resolves this cleanly:

> **A frame is a grammar. An angle is a subject.** A frame says "material, verb, place".
> An angle says "one move repeats across rooms". They compose — the same angle can be
> written in two frames, and the same frame can carry three angles.

The current code conflates them. `framesByAngle` *replaces* an angle's
brief with a frame's shape (built at `regenerate/route.ts:273`, rendered at `:318`):

```ts
`${framesByAngle.has(i) ? `write these two to the ${...} frame below, not freely.` : a.brief}`
```

When the Material frame fires, the FIRST-MOVE angle loses its brief entirely. Under a
four-angle model the composition has to be explicit: the angle picks the *subject*, the
frame picks the *grammar*, and both go in the prompt.

### Frame by frame

**`MATERIAL_FRAME` — survives, demoted from "the frame that fires for everything".**
Slots `[material, verb, tail]`, required `['material', 'tail']`, three of the four
proposed angles can wear it:
- Continuity: material as subject, ≥2 rooms as tail — this is the frame *plus* a
  multi-room predicate, and it is the closest thing to a shipping angle.
- Governing decision: material as subject, its consequence as tail — the existing
  `first-move` behaviour, unchanged.
- Constraint: awkward. The material is rarely the constraint; it is usually the answer
  to one.

The grain audit (§4) already found `MATERIAL_FRAME` is the frame that fires for
everything, and that its material-as-subject ordering is a minority shape (4 of 19
material-naming corpus headlines put the material in subject position; 10 put it after a
preposition). Under project-grain angles that pressure is relieved rather than solved —
the angle now names the subject, so the frame's job shrinks to grammar.

**`AGENT_VERB_OBJECT_FRAME` — survives, and is the corpus's largest group.** Slots
`[agent, verb, object, instrument]`, required `['agent','verb','object']`. The `object`
slot currently takes `chapterTitles[0]` — a room — which is exactly the room-grain the
plan is moving away from. **Project as object is the corpus's own usage:** *"Studio Font
perches cliffside home in Mexico on inhabitable concrete columns"*, *"Iterare Arquitectos
inserts stark white home into shell of old Spanish building"*, *"OMA completes first US
affordable housing development"*. Repointing `object` from `chapterTitles[0]` to the
project is one line and moves the frame *toward* the corpus.

Best fit: Governing decision and Constraint, where a named agent doing one thing to the
whole project is the corpus's default shape.

**`BORROWED_FRAGMENT_FRAME` — survives unchanged, and is angle-agnostic.** Slots
`[fragment, context]`, required `['fragment']`. It is a quoting device, not a subject:
any of the four angles can be written with the designer's own words inside the quotation
marks. Its source is `resolveFragmentCandidates` over interview answers — which is
already project-wide, since `loadInterviewAnswers` reads every answer on the project.

**What is superseded: the six `ANGLES` briefs.** `reversal`, `constraint`, `accident`,
`client`, `first-move`, `argument` (`regenerate/route.ts:75`). These are the thing being
replaced. The mapping is not clean:

| current angle | fate under project grain |
|---|---|
| `first-move` | → **Governing decision** (renamed, same intent) |
| `constraint` | → **Constraint** (survives, needs a computed predicate) |
| `reversal` | folds into **Transformation** — closest existing analogue, still prose-only |
| `accident` | no home. Room/object grain by nature ("arrived wrong and was kept") |
| `client` | no home as an angle. It is the borrowed-fragment *frame*'s natural content |
| `argument` | no home. It asks for a claim, not a subject — and it is the angle that produced *"Glass won the dining table argument"* |

**Nothing moves to captions as a frame.** All three frames are grammars and grammars are
grain-neutral. What moves to captions is the *room-grain subject matter* — the `accident`
angle, and `object`-as-room in the Agent frame.

**One doc-drift note found in passing.** `headlineSlots.ts:467` carries a block comment
stating *"`agent` is NEVER resolved, and this is deliberate"*. That has been false since
B8 — the route resolves `agent` from the credited name at `regenerate/route.ts:226`. The
comment describes the pre-B8 state and should be corrected whenever that file is next
touched.

---

## 6. Caption surface

### Does a room-level caption generator have anywhere to live on the edit page today?

**Yes — the slot and the precedent both exist. The field does not.**

The edit page is `StagingPublishPanel.tsx`, which mounts `StoryEditProvider` around
`ImmersiveProjectPage` (`:308`) and only there — the same `StoryRenderer` serving
`/p/[slug]` stays read-only. Room chapters render through `RoomTilePair`, which already
threads `chapterIndex` into six child components (`:98, :115, :174, :210, :281, :318`).

The precedent is `PullQuotePicker` — a per-chapter picker that takes `chapterIndex`
(`:29`), POSTs `{chapterIndex, selectedText}` (`:87`), and sits inside the room tile. A
`CaptionPicker` would be the same component in the same place with a different endpoint.
`HeadlinePicker` is the lead-level twin of it and shares the `edit.save` path.

What is missing is a field to write to:

- `SectionOverrideField` (`editingTypes.ts:6`) is
  `'title' | 'body' | 'pullQuote' | 'kicker' | 'deck' | 'introduction'`. **No `caption`.**
  Adding one means the member, plus a `getFieldValue`/`setFieldValue` branch
  (`override/route.ts:208, :238`) — both are already `switch`-shaped over the field.
- `BlocksSchema.galleryChapters[]` (`schemas.ts:140`) holds
  `{title, body, imageIds, pullQuote, roomId, generatedAt, kind}`. **No caption.** It is
  a `Json` column, so this is a Zod change, not a migration — but `BlocksSchema` is
  strict and an undeclared key is stripped on the next parse, so it must be declared.
- `RoomTileData` (`buildRoomTiles.ts:15`) would need the field carried through, alongside
  the existing `pullQuote` / `pullQuoteSelection` pair.
- `ProjectImage` has `name`, `alt`, `room` — **no caption column.** A per-*image* caption
  is a schema change; a per-*chapter* caption is not.

**There is also a caption surface that already exists, off the edit page.**
`InstagramExport` (`schema.prisma:5676`) has `headline`, `bioText`, `caption`, and
`generateInstagramCaption` (`src/lib/instagram-export/generate-caption.ts:22`) already
takes `roomName` and prompts `Room focus: ${input.roomName || 'Full project'}`. Route:
`POST /api/instagram-export/generate-caption`. Page:
`/designer/projects/[id]/instagram`.

So "room grain moves to social captions" has a real destination. It is a **separate
page**, not the article edit page, and that is arguably correct — but it means "moves to
captions" is two decisions, not one: what the article stops doing, and which of the two
caption surfaces picks it up.

### Can the existing room resolution work feed it unchanged?

**Mostly yes. Three parts, two clean.**

**Clean — image→room.** `buildRoomResolver` (`resolveImageRoom.ts`) is already the single
resolver shared by the gallery, `loadInterviewAnswers`, and chapter titles. The comment at
`loadInterviewAnswers.ts:19-21` makes the invariant explicit: answer rooms and chapter titles
*cannot* resolve differently. A caption generator reading through it inherits that.

**Clean — chapter→room.** `galleryChapters[].roomId` ties an editorial chapter to its
`Room` (`schemas.ts:153`), and `RoomTileData.roomId` carries it to the component. A
caption generator keyed on `chapterIndex` has the room id without any new lookup.

**Needs one change — material→room.** `resolveMaterialCandidates` returns materials
**aggregated across the project**, ranked by distinct room count (`headlineSlots.ts:370`).
That is the right shape for Continuity and the wrong shape for a caption, which needs
*the materials in this one room*. The per-tag data is all there — the loop reads
`tag.image.assignedRoom.name` per tag (`:354-355`) — but it is grouped by class and the room
becomes an attribute of the class rather than the other way round.

Inverting it is a regrouping of an existing query, not new capture: same `findMany`, key
the map on room instead of class. This is the same inversion §2 of the grain audit
described for the room-as-object frame variant (*"ranking inverts: pick the room, then
the class within it"*). **It is needed for both, so it should be done once.**

One caveat on the caption path specifically: `resolveTail` caps at two room names because
*"a headline listing four rooms is an inventory, which is the caption shape the criteria
ban"* (`headlineSlots.ts:400-413`). For an actual caption that cap is not just unnecessary,
it is backwards — the inventory shape `headline.ts:185` bans as `BALANCED_PAIR` is what a
caption is *for*. The mechanical checks in `headline.ts` are headline rules and must not
be applied to captions unmodified.

---

## Reproduction

Corpus measurements read `docs/audits/headline-discriminator-corpus.json` (`human`, 56
entries). Marker matching is coarse and reported as shares; buckets overlap, so columns
sum above 56.

Schema and call-site claims were checked against `prisma/schema.prisma` and `src/` at
`dd2122ea`. Dead-table claims (`ProjectDesignIntent`, `ProjectDesignJourney`) are
`grep -rln` over `src/` returning zero and one-orphaned-file respectively.

Not measured, and why: per-project angle eligibility fractions (§3) need `DATABASE_URL`;
extraction-gated angles additionally need `ANTHROPIC_API_KEY`. Both are unset in this
environment.
