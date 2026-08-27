# HEADLINE GENERATION AUDIT — Phase A

Read-only survey of every title-producing surface, taken at `a7e3ae91` on branch
`claude/title-regen-editor-layer-bv6ezt`. No code was changed.

Purpose: establish what exists before building a typed frame library. The working
hypothesis under audit — that titles fail because every constraint is prohibitive and
none is directional — is **confirmed and narrower than stated**. The prohibitive load is
real, but the more actionable finding is that the structured facts a frame library would
slot are largely *already computed and stored*, and no title generator reads any of them.

---

## 0. Summary of findings

| # | Finding | Evidence |
|---|---|---|
| F1 | **Five live model-driven title generators; only two share the canon.** `HEADLINE_CRITERIA` is imported by 2 of 5. The other three carry private, mutually contradicting rules. | §1 |
| F2 | **The frame-library pattern already exists and works here — three times — but only for internal or structural titles.** `signals.ts` is a deterministic slot-template bank producing 11 typed headline shapes. | §1.C, §5 |
| F3 | **Positive direction exists on exactly one surface** (`ANGLES`, headline regenerate). It is an *angle* (what to write about), not a *frame* (what shape the sentence takes). | §2 |
| F4 | **The interview reaches every title generator as undifferentiated prose.** `LoadedAnswer` is `{section, answer, isFollowUp}` — no discrete arrival, constraint, or reversal values. | §3.E |
| F5 | **`DesignerDecision` and `AttributeVerification` are populated by a live path and hold exactly the discrete decision + designer-verified values a frame library needs. No title generator reads either.** | §3.E |
| F6 | **No numeric facts are available for a design project.** No square footage, no room count, no duration, no era on `Project`. | §3.D |
| F7 | **Location resolves to city + region only.** No street, no neighborhood, anywhere in the schema. | §3.B |
| F8 | **Materials are structured but never reach the headline.** `buildMaterialContext` yields `{name, vendor, finish, count}`; the headline route receives none of it, and the article generator flattens it to a names-only string. | §3.C |
| F9 | **On three of five surfaces the title carries the full informational load alone** — no deck field exists. | §4 |
| F10 | **`EDITORIAL_BANNED_PHRASES` is centralized and imported by zero generators.** The article generator carries a verbatim inline copy. This is a live `docs/17` §5 violation and the exact fragmentation the frame library must avoid. | §2.D |
| F11 | **`The Rise of ${trend.topic}` is not shipped code.** It appears only in `docs/12_INTELLIGENCE_SYSTEM.md:934,953` as an illustrative spec. No implementation exists. | §1.G |

---

## 1. Inventory — every site that generates a title

### Legend
- **M** = model-generated free composition
- **T** = string template / deterministic slot fill
- **U** = user-supplied
- **canon?** = imports `HEADLINE_CRITERIA` from `src/lib/interview/prompts/editorialTone.ts`
- **checked?** = runs `headlineIssues()` from `src/lib/posting/headline.ts`

| # | Surface | Site | Kind | canon? | checked? |
|---|---|---|---|---|---|
| A | Article headline (`lead.kicker`) — initial | `src/lib/posting/generateEditorialDraft.ts:1307`, criteria at `:1339` | M | ✅ | ⚠️ reported only (`:972`) |
| B | Article headline — regenerate batch | `src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts:76,80` | M | ✅ | ✅ `:262` + editor pass |
| C | Article deck (`lead.deck`) | `generateEditorialDraft.ts:1308` | M | ❌ (one sentence of spec) | ❌ |
| D | Gallery chapter titles | `generateEditorialDraft.ts` JSON spec; `src/lib/editorial/buildEditorialChapters.ts:102` | **T** (room name) | n/a | n/a |
| E | Instagram export headline | `src/lib/instagram-export/generate-quotes.ts:48–68` | M | ❌ | ❌ |
| F | Collaboration story title + subtitle | `src/lib/collaboration/narrative/assembleStory.ts:76–77`; second generator `:267,279`; fallbacks `:160,175` | M + T fallback | ❌ | ❌ |
| G | Editorial queue angle summary | `src/lib/editorial-queue/extractAngles.ts:31–46` | M | ❌ (internal) | ❌ |
| H | Editorial signal headlines | `src/lib/editorial-queue/signals.ts:84,101,118,162,187,218,330,393,425,465,528` | **T** | n/a | n/a |
| I | `ArticleTopic.title` | `src/app/admin/article-topics/new/page.tsx:32,124` | **U** (admin types it) | n/a | n/a |
| J | SEO / OpenGraph title | `src/app/p/[slug]/page.tsx:40` | **T** | n/a | n/a |
| K | Instagram campaign post titles | `src/app/api/instagram/campaign/generate/route.ts:140,177,299`; `src/components/instagram/CampaignWizard.tsx:62,70` | **T** | n/a | n/a |

### A — Article headline, initial generation
`generateEditorialDraft.ts`. System prompt at `:32`. The JSON contract asks for
`"kicker": "The headline. See HEADLINE below — 4-10 words, sentence case."` and the full
`HEADLINE_CRITERIA` is interpolated at `:1339`.

Model-generated free composition. `headlineIssues()` runs at `:972` but **only logs
drift** — it does not reject or regenerate. A headline breaking house style ships from
this path; it is caught later only if the designer presses regenerate.

### B — Article headline, regenerate batch
The most developed surface, and the subject of prior work. 12 candidates across 6 angles,
mechanically filtered, then judged by a second model call (`judgeHeadlines`,
`src/lib/posting/headlineEditor.ts`). The only surface with an editor pass and the only
one with positive structural direction (§2).

### C — Article deck
The entire specification is one clause: `"1-2 sentences that set up the story. See
HEADLINE — do not restate the headline."` (`:1308`). The only other mention is the
`DIVIDE THE WORK WITH THE DECK` heading inside `HEADLINE_CRITERIA`, which tells the
headline what not to duplicate rather than telling the deck what to do. There is **no
deck regeneration surface** — a designer can hand-edit it via
`sections/override/route.ts` (`SectionOverrideField` includes `'deck'`,
`src/lib/posting/editingTypes.ts:6`) but cannot ask for another one.

### D — Gallery chapter titles *(precedent)*
Chapter titles are the room name, resolved through `buildRoomResolver`. This is already
frame-library-shaped: a fixed shape, one structured slot, no composition. It has never
been reported as a quality problem.

### E — Instagram export headline
`generatePullQuotes()` in `src/lib/instagram-export/generate-quotes.ts` — the function
name is legacy; it produces headlines, not quotes. Renders through
`createHeadlineSVG` (`src/lib/instagram-export/svg-templates.ts:59`). The UI at
`src/components/instagram-export/HeadlineTab.tsx` offers the 5 options plus a free-text
override (so the final value may be **U**).

This surface shares nothing with the article path: it does not import `HEADLINE_CRITERIA`,
does not run `headlineIssues`, has no editor pass, and states rules that **contradict the
canon** — it never mentions sentence case, never bans naming the designer, and asks for
"provocative" scroll-stopping copy that `docs/09` forbids ("Observational, not
promotional… does not inflate importance").

`svg-templates.ts:83–85` carries a deliberate decision worth preserving: this text is
typeset **without quotation marks**, because it is invented editorial copy and not the
designer's speech. Attributing it as a quotation over their own photograph was the bug.

### F — Collaboration story title + subtitle
Two independent generators in one file. `NARRATIVE_SYSTEM_PROMPT` asks for
`title: Compelling headline (max 100 chars)` and an optional subtitle (`:76–77`) — that
is the entire specification. A second function `generateTitleAndExcerpt` (`:267`) carries
a one-line system prompt: *"Generate a compelling title and excerpt for a design
collaboration story."* Both fall back to string templates:
`${vendorOrgName} × ${designerName}` (`:160`, `:306`) and
`${vendorOrgName} × ${designerName}: A Partnership in Design` (`:175`).

Reachable via `src/app/api/collaboration/stories/[id]/generate/route.ts`.

### G — Editorial queue angle summary
`extractAngles.ts` asks for *"a one-line editorial summary: the story this angle tells, in
an editor's voice. Specific to THIS designer — a line that could only be written about
this corpus."* Not reader-facing today, but it is the seed for queue items and it is the
**only prompt in the codebase that states the specificity requirement positively** rather
than as a swap test.

### H — Editorial signal headlines *(the strongest precedent — see §5)*
Eleven deterministic templates with typed slots, e.g.:

```
signals.ts:84   `"${product.name}" is specced in ${g.projectIds.size} of ${projectCount} projects`
signals.ts:118  `${family} appears in ${g.projectIds.size} of ${projectCount} projects (${g.tagIds.length} tagged specs)`
signals.ts:465  `One ${roomType} image in "${project.title}" is earning ${multiple}x the corpus baseline in product saves`
signals.ts:528  `${family} is ${direction} across the timeline: ${pct(early)} of early specs to ${pct(late)} of recent ones`
```

These are specific, non-interchangeable, and carry numeric facts — the properties the
reader-facing headlines are failing to reach. They are model-free.

### I / J / K — user-supplied and templated
`ArticleTopic.title` is typed by an admin (the schema comment `"The Quiet Return of
Travertine"` at `prisma/schema.prisma:4672` is an example, not a generator). The OG title
and the Instagram campaign post titles are pure templates over `project.title`,
`room.name`, `product.name`.

### Dead / spec-only, confirmed
- **`The Rise of ${trend.topic}`** — `docs/12_INTELLIGENCE_SYSTEM.md:934,953` only. Zero
  code matches. Cited in the Phase A brief as if live; it is not.
- **`EditorialDraft.title` / `.subtitle`** (`prisma/schema.prisma:7512–7513`) —
  `prisma.editorialDraft` has **zero callers** in `src/` or `scripts/`. Legacy table.
- **`ProjectDesignIntent`** (`styleGoals`, `materialPreferences`, `moodKeywords`,
  `colorPalette`) — **zero callers**. Structured style data that nothing reads.

---

## 2. Constraint inventory — direction vs prohibition

### A. `HEADLINE_CRITERIA` (surfaces A and B), 4,746 chars

| | count |
|---|---|
| Headings that are explicit prohibitions (`NEVER…` / `DO NOT…`) | **6 of 10** |
| Headings giving positive direction | **1** (`SOMETHING HAS TO BE AT STAKE`) |
| Headings that are formatting or structural | 3 (length, capitalization, `DIVIDE THE WORK WITH THE DECK`) |
| Negative exemplar headlines ("here is a bad one") | **10** |
| Positive exemplar headlines (the `GOOD` block) | **5** |
| Distinct banned shapes under `NEVER WRITE THESE` | 7 |

The single positive heading is a *test*, not a shape: "A decision that could have gone the
other way. A constraint someone had to beat." It names qualities a good headline has after
it exists. It does not tell the model how to build one.

The five `GOOD` examples are the only place in the system where a headline *shape* is
demonstrated — and they are demonstrated, never described. A model must infer the pattern
from five instances while being handed ten counter-instances and seven banned shapes.

**This is the mechanism behind the reported failure.** With no shape to fill and a dense
prohibition set, the safest available move is to climb to a level of abstraction where no
specific rule applies. Category titles ("The Rise of Fluted Wood") and verdict titles
("Formal outside, unruly within") are both retreats to that altitude.

### B. Surface E (Instagram) — the fully unconstrained case

```
generate-quotes.ts:57-63
- Be 4-10 words maximum
- Stop the scroll — provocative, intriguing, or emotionally resonant
- Tease a story without telling it
- Sound like something a creative director would place on a magazine cover
- NOT be generic ("Beautiful Kitchen Design") — be specific and editorial
- Reference the actual design decisions, challenges, or philosophy
```

**Flagged vague style references** (per the brief's request):
- `generate-quotes.ts:61` — *"Sound like something a creative director would place on a
  magazine cover."* Pure vibe reference. Names no property the output can be checked
  against.
- `generate-quotes.ts:60` — *"Tease a story without telling it."*
- `generate-quotes.ts:48` — *"an editorial headline writer for a high-end interior design
  magazine."*
- `generate-quotes.ts:62` — *"be specific and editorial"* — "editorial" used as a quality
  adjective with no referent.
- `src/lib/designer-bio/generate-bio.ts:56` — *"Write like a design magazine profile
  (think Architectural Digest, Elle Decor, Dwell)."* Not a title generator, but this is the
  canonical instance of the pattern the brief names, and it is the precedent to remove.

Adjacent, milder, on the canon surfaces: *"a senior writer for a prestigious design
magazine"* (`generateEditorialDraft.ts:32`, headline regenerate `:76`,
`sections/[chapterIndex]/regenerate/route.ts:18`) and *"the editor of a prestigious design
magazine"* (`headlineEditor.ts:89`). These are role framing rather than style targets, but
they carry the same defect: "prestigious" is not checkable.

### C. Surface F (collaboration) — no constraints at all
*"Compelling headline (max 100 chars)"* is the whole specification. `compelling` is the
only quality word, and 100 chars is roughly double the article headline's ceiling.

### D. The banned-phrase list is centralized and unused

`EDITORIAL_BANNED_PHRASES` (49 quoted phrases, `editorialTone.ts:22`) is exported and
re-exported through `prompts/index.ts:22`. **No generator imports it.**
`generateEditorialDraft.ts:44–52` carries a verbatim inline copy instead.

`docs/17` §5 states: *"One banned-phrase list. …centralized as a single constant and
imported. No generator keeps its own copy."* That requirement is currently unmet.

Note also: the headline regenerate route's system prompt is `FOLIO_TONE +
HEADLINE_CRITERIA + JSON_PROSE_QUOTING_RULE` — it never receives the banned-phrase list at
all. So the three surfaces have three different prohibition sets, and none is the
centralized one.

### E. Aggregate prohibition load reaching a headline

| Surface | Prohibitions in force | Positive shapes offered |
|---|---|---|
| A — article initial | `HEADLINE_CRITERIA` (7 banned shapes, 10 counter-examples) + inline 49-phrase list + `FOLIO_TONE` | 5 examples |
| B — regenerate | `HEADLINE_CRITERIA` + `FOLIO_TONE` | 5 examples + **6 angles** |
| C — deck | none specific | none |
| E — Instagram | 1 (`NOT be generic`) | none |
| F — collaboration | none | none |

---

## 3. Field inventory — what is available at title-generation time

### A. Designer / org name — **available, not verified**
`project.designer.name`, `project.designerOrg.name` (both plain `String`; `User.studio` at
`prisma/schema.prisma` User block also exists). Passed to surface B as `names` and used to
*forbid* the name appearing (`NAMES_PEOPLE`).

There is **no verification concept for a person or studio name** anywhere in the schema.
`AttributeVerification.verified` governs image attributes; `VendorTradeAccount.verificationStatus`
governs trade accounts. Neither covers the byline.

### B. Location — **city + region only** (F7)
`Project.city`, `Project.regionState`. Joined as `[city, regionState].join(', ')` and
passed to surfaces A, B and the editor.

Searched the full schema for `neighborhood`, `street`, `address`, `zip`, `postal`: the only
hits are vendor/shipping/proxy addresses (`:1029`, `:3270`, `:6496`) — none reachable from
a project. **A frame with a neighborhood or street slot cannot be filled today.**

### C. Material nouns — **structured, but not delivered to the headline** (F8)
`buildMaterialContext(tags)` (`generateEditorialDraft.ts:151–161`) produces
`Map<string, {name, vendor, finish, count}>` — genuinely structured, with `finish` falling
back to `category`.

Two losses downstream:
1. The article generator flattens it: `const materialsList = products.map(p => p.name).join(', ')`
   (`:1178`), injected as `Products tagged: ${materialsList}` (`:1224`). Vendor, finish and
   count are dropped before the model sees them.
2. **The headline regenerate route passes no product or material data at all.** Its user
   prompt carries interview answers, project title, location, credited name and chapter
   titles. Verified by grep: no `tags`/`materials`/`product` reference in the prompt
   assembly.

So a `first-move` angle asking for "the material the rest of the house answered to" is
asked of a model that has not been told which materials exist.

### D. Numeric facts — **none available** (F6)
| fact | status |
|---|---|
| square footage | **absent.** `squareFootage` exists only on `UnitType` (`:3316`, developments); `builderSquareFootageRange` (`:115`) is a vendor-profile string. Neither is reachable from `Project`. |
| room count | derivable (`project.rooms.length`) — not currently passed to any title generator |
| duration | `Project.timeline` is a `ProjectTimeline` **enum**, not a span; `targetInstallDate` exists but no start date |
| era / year built | **absent** |
| budget | `Project.budgetBand` — a coarse enum, and `docs/16`-adjacent sensitivity likely bars it from a headline |
| product/spec counts | available in the corpus digest (`signals.ts`) but not on the project path |

**A numeric slot is the highest-value frame type and the one least supported by the current
schema.** Room count is the only one obtainable without a migration.

### E. Arrival / constraint content — **prose only at the point of use** (F4, F5)

This is the central finding.

**What every title generator actually receives.** `loadInterviewAnswers()`
(`src/lib/posting/loadInterviewAnswers.ts`) returns:

```ts
interface LoadedAnswer { section: string; answer: string; isFollowUp: boolean }
```

`section` is the resolved **room name**, not a semantic category. `isFollowUp` is the only
signal of richness. The answer is an undifferentiated prose blob. Surface B sorts
follow-ups first and truncates to 24 answers. **There is no discrete arrival, constraint,
reversal, or accident value anywhere on this path** — the six `ANGLES` ask a model to find
those in prose, every time, with no memory between presses.

**What is already extracted and stored, and never read.**

`DesignerDecision` (`prisma/schema.prisma`, model block) holds:

```
decisionType   choice        choiceId      choiceType      roomType
reasoning      alternatives  tradeoffs     convictionLevel
isClientDriven clientContext clientBriefExcerpt
clientReaction outcomeNotes  influences    pairedWith
```

That field list is close to a one-to-one match with the six angles
(`alternatives` → reversal, `tradeoffs` → constraint, `isClientDriven`/`clientContext` →
client, `choice`/`convictionLevel` → first-move).

Reachability, verified:
- **Written by a live path.** `processInterviewAnswers.ts:147` and `:365`, invoked from
  `api/posting/project/[projectId]/interview/process/route.ts:45` and
  `…/interview/status/route.ts:63`.
- **Read by one job only** — `src/lib/atelier/extractDesignerReasoning.ts:211`, reached
  from `api/jobs/populate-designer-reasoning/route.ts`. **No title generator reads it.**

Important caveat for Phase B: the live write path populates only
`decisionType, choice, choiceType, imageId, reasoning, convictionLevel, captureSource`.
The richest columns — `alternatives`, `tradeoffs`, `clientContext`, `clientReaction`,
`outcomeNotes` — are **declared but never written** by either call site. And `reasoning` is
assigned the raw `answerText`, so it is prose again. `decisionType` comes from
`getDecisionType()` (`:83–91`), a fixed map over `attributeType` with fallback
`'style_direction'`.

**So the discrete-value substrate is half-built:** the table, the taxonomy, and the live
write path exist; the columns that would fill a frame's slots are empty.

`AttributeVerification` (same write path, `:129`) is the other half and is more promising
per-row: `attributeType`, `aiValue`, `verified`, `correctedValue`, `questionAsked`,
`designerResponse`. That is a **designer-confirmed structured value** — the strongest
grounding token in the system for a slot that must not be fabricated. Also read by no title
generator.

### F. Per-surface field availability

| Field | A article | B regenerate | C deck | E Instagram | F collaboration |
|---|---|---|---|---|---|
| interview answers (prose) | ✅ | ✅ (24, follow-ups first) | ✅ | ✅ truncated to 2,000 chars | ✅ transcripts |
| designer / org name | ✅ | ✅ (to forbid) | ✅ | ✅ `designerTitle` | ✅ |
| location (city, region) | ✅ | ✅ | ✅ | ❌ | ❌ |
| room names | ✅ | ✅ chapter titles | ✅ | ✅ single `roomName` | ❌ |
| materials (structured) | ⚠️ names only | ❌ **none** | ⚠️ | ❌ | ❌ |
| numeric facts | ❌ | ❌ | ❌ | ❌ | ❌ |
| discrete decisions | ❌ | ❌ | ❌ | ❌ | ❌ |
| verified attributes | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Title / deck split

| Surface | Title field | Deck / standfirst field | Title carries full load? |
|---|---|---|---|
| A, B, C — article | `blocks.lead.kicker` (`schemas.ts:42`, max 120) | **`blocks.lead.deck`** (`schemas.ts:43`, min 10 / max 400; alias `dek` at `:81`) | **No** |
| E — Instagram export | `InstagramExport.headline` (`prisma:5687`) | **none** — `bioText` and `caption` are separate artifacts, not a standfirst | **Yes** |
| F — collaboration | `title` (max 100) | `subtitle` — *optional*, and `assembleStory.ts:211` only emits it if present | **Yes, whenever the model omits it** |
| G — queue angle | `summary` is itself the one line | n/a | **Yes** |
| I — `ArticleTopic` | `title` | `description` is *"Internal admin notes"* (`prisma:4672` block) | **Yes** |
| K — campaign post | `title` | `caption` (a social caption, not a deck) | **Yes** |
| — `EditorialDraft` | `title` / `subtitle` (`prisma:7512–13`) | present but **dead table** | n/a |

**Only the article surface has a real title/deck split**, and even there the deck is
specified in one clause and cannot be regenerated (§1.C). On every other surface the title
is the entire informational payload — which is precisely the condition under which a model
abstracts upward, because one line must now cover subject, claim and interest at once.

`DIVIDE THE WORK WITH THE DECK` inside `HEADLINE_CRITERIA` is therefore **advice the
Instagram and collaboration surfaces cannot follow**, since they have no deck to divide
with. If a frame library is applied uniformly, this asymmetry has to be an explicit input
to frame selection — frames that presuppose a deck are unavailable on deckless surfaces.

---

## 5. Module placement recommendation

### Recommendation

Split along the line `src/lib/interview/prompts/` already draws:

```
src/lib/interview/prompts/headlineFrames.ts     ← frame definitions + prompt fragments
src/lib/posting/headlineSlots.ts                ← slot resolution (DB → typed values)
```

**1. `src/lib/interview/prompts/headlineFrames.ts` — the frame library proper.**

Frame definitions, their typed slot signatures, and the prompt fragments that describe
them. Sits beside `editorialTone.ts`, which already owns `HEADLINE_CRITERIA`, and inside
the directory `docs/17` §6 designates: *"So this cannot re-fragment, all prompts compose
from one location."*

Why this directory and not `src/lib/posting/`:

- **It is the location the canon binds.** §6's tree is `src/lib/interview/prompts/`, and
  `editorialTone.ts` is named in it as the home of the shared editorial constants. A frame
  library is the same class of artifact.
- **The fragmentation §6 exists to prevent is already realized here.** Five title
  generators, three private rule sets (§1, F1). A frame library placed anywhere else
  becomes the fourth private rule set the first time the Instagram surface needs one.
- **`prompts/` is verifiably pure.** Across all 13 `.ts` files in `prompts/` and
  `prompts/roles/`, the only non-relative import in the tree is `node:assert/strict` in
  `validateQuestion.test.ts`. Zero Prisma, zero AI SDKs, zero `next/*`. That purity is what lets every route and generator —
  including client-adjacent ones — import from it without dragging in the DB. It is worth
  preserving deliberately.
- **`check-headline.ts` already asserts single-copy for this class of constant**
  (*"there is exactly one copy of the criteria in the app"*, via a `grep -rl` over `src/`).
  The same assertion extends to frames at zero cost.

**2. `src/lib/posting/headlineSlots.ts` — slot resolution.**

Reading `DesignerDecision`, `AttributeVerification`, product tags and `Project` into typed
slot values requires Prisma. Putting that in `prompts/` breaks the purity invariant above
for every consumer of every interview prompt.

`src/lib/posting/` is the established home for the headline machinery that touches data and
models — `headline.ts` (validators), `headlineEditor.ts` (the judging call),
`loadInterviewAnswers.ts` (the DB read). A slot resolver belongs with them, and
`loadInterviewAnswers.ts` is the natural sibling: it is the module a slot resolver would
supersede for structured fields.

### Why not a single module

A frame library is data + prompt text + a DB-backed resolver. Keeping all three together
reads cleaner but forces one of two bad outcomes: either `prompts/` gains a Prisma import
(breaking the invariant for six unrelated files), or the library lands in `posting/` and
sits outside the directory `docs/17` §6 names — where the Instagram and collaboration
surfaces have historically not looked, which is how they ended up with private rules.

The split keeps the *declaration* single-sourced where the canon says declarations live,
and the *plumbing* where the other headline plumbing already is.

### Consumers to route through it

All five model-driven surfaces, in this order of value:

1. **B** — headline regenerate. Already has `ANGLES`; frames would replace or refine them.
2. **A** — article initial generation. Same canon, currently drift-reported only.
3. **E** — Instagram. The largest quality gap and the smallest change (one prompt).
4. **C** — deck. Needs a frame vocabulary of its own before it can be regenerated at all.
5. **F** — collaboration. Currently unconstrained; two generators to collapse into one.

### Two prerequisites Phase B should treat as in-scope

- **Fix `EDITORIAL_BANNED_PHRASES` first** (F10). Adding a second shared constant to a
  directory whose existing shared constant is imported by nobody will reproduce the same
  outcome. The inline copy at `generateEditorialDraft.ts:44–52` should be replaced with the
  import before frames are added.
- **Decide the `DesignerDecision` question** (F5). The frame library's value is bounded by
  whether slots can be filled from discrete values. Today `alternatives`, `tradeoffs` and
  `clientContext` are declared and never written. Either the write path is extended, or
  frames must be designed to slot prose spans and structured fields interchangeably. This
  is the single largest open question for Phase B and it is a schema/pipeline decision, not
  a prompt decision.

### Precedent to copy

`src/lib/editorial-queue/signals.ts` (F2) is the working proof that this codebase produces
good, specific, non-interchangeable headlines when the shape is fixed and the slots are
typed — eleven templates, numeric slots, model-free, and never the subject of a quality
complaint. `buildEditorialChapters.ts` and the campaign post titles are two more.

**The frame library is not a new pattern for Folio. It is the pattern Folio already uses
everywhere the title is not reader-facing.**

---

## Appendix — verification commands

```
npm run check:headline              # criteria, rules, cycling, the editor's contract
npm run check:regenerate-surfaces   # the three regenerate surfaces and their asymmetries
npm run check:story-editing
```

Claims in this document were established by reading source at `a7e3ae91`. Reachability
claims ("zero callers", "live path") were established by grep over `src/` and `scripts/`
and are stated only where the grep returned empty or returned an explicit call site.
