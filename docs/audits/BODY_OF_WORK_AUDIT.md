# BODY-OF-WORK ANGLE — AUDIT

Read-only. No code changed. Taken on `claude/body-of-work-audit-fyd7se`.

Scope: a fifth article angle whose subject is the pattern across a designer's
published projects, sourced from the corpus rather than from this project's interview.

Everything below is what exists today, not what should be built.

---

## Summary

Nine findings, in the order they change the plan.

**B1. The corpus reader already exists and is already published-only.**
`fetchRawCorpusLayer` (`src/lib/editorial-queue/fetchRawCorpusLayer.ts:36`) queries
`project.findMany({ where: { designerId, post: { status: 'PUBLISHED' } } })` and carries
`city`, `regionState`, `category`, `budgetBand`, `roomTypes`, `tagCount`, `publishedAt`
per project. This angle does not need a new corpus layer. It needs a new signal and a
new frame.

**B2. There is no geography signal. None.** `grep -n "city\|region\|location\|geo"` over
`src/lib/editorial-queue/signals.ts` returns **zero hits**. `regional_identity` is a
declared angle type (`types.ts:156`) with no computation behind it, and
`buildAngleUserPrompt` (`extractAngles.ts:70`) hands the model **project titles only** —
not `city`, not `regionState`. The task's own worked example ("another Coral Gables
renovation") is the one pattern the signal layer cannot currently compute.

**B3. The repeated-*material* pattern is computable today, exactly, at a floor of 2.**
`computeRepetitionSignals` (`signals.ts:61`) already emits per-product, per-brand and
per-finish-family signals gated on `projectIds.size >= 2`, with row-level `projectIds`
evidence. This is the only body-of-work pattern that is a finished computation.

**B4. Location is a single free-text field and it is the wrong shape for a place
pattern.** The primary create form has one optional input labelled "Location",
placeholder `City, country` (`src/app/projects/new/page.tsx:1020-1025`), whose entire
trimmed value goes to `Project.city` while `regionState` is hardcoded `null`
(`:163-164`). There is no neighborhood column anywhere in `schema.prisma`, no
normalization, no geocoding. "Coral Gables" is only matchable if the designer typed
exactly that string on every project.

**B5. The project's own date is captured and discarded.** The same form renders a "Year"
field (`page.tsx:1027-1032`) that is registered in the form state and never included in
the submit payload (`:153-166`). The only dates on a project are `createdAt` and
`publishedAt` — platform activity, not when the work was done. Any "third project in
five years" claim would be counting Folio publish events.

**B6. The two publish flags can diverge, and one write path proves it.**
`publishProjectAction` (`src/app/actions/projects.ts:350-432`) sets `Project.isPublic`
and `Project.status` and **never touches `ProjectPost.status`**. The corpus filter reads
`post.status`, so this direction under-counts — safe for privacy, wrong for coverage.
The dangerous direction (post PUBLISHED while the project is not public) has no write
path today: publish (`:196-215`) and unpublish (`status/route.ts:533-543`) both move
both flags in one `$transaction`.

**B7. `ProjectPost.publishedAt` is not a publish test.** Unpublish deliberately preserves
it (`status/route.ts:520-521`: *"ProjectPost.publishedAt is PRESERVED (distinguishes
UNPUBLISHED from GENERATED)"*). `computeMaturity` (`maturity.ts:16`) counts
`p.publishedAt !== null`, and the unlock gate (`unlock.ts:36`) counts
`status: 'PUBLISHED'`. Two denominators for "how many stories has this designer
published". Harmless today because maturity's input is already status-filtered; it is a
trap for any new code that reads `publishedAt` alone.

**B8. Persisted angle evidence is never re-validated against current publish state.**
`toExtractedAngle` (`src/lib/editorial-queue/index.ts:87-103`) casts the stored
`evidence` JSON straight through. A `DesignerAngle` citing project X survives X being
unpublished. For queue prompts that is a stale recommendation; for a **published
headline** it would be a public claim about a project that is no longer public.

**B9. The article surface's own gate excludes this angle by construction.** The headline
route passes `SURFACE_SOURCE = 'interview'` (`regenerate/route.ts:195`) and
`eligibleFrames` hard-filters on it (`headlineFrames.ts:785`). `HeadlineFrame.source` is
typed `'interview' | 'tags'` (`:91`) — there is no third value. A corpus-sourced frame
needs that union widened and the surface's source gate turned into a set, which is
exactly the guard that currently keeps CONTINUITY off the article.

---

## 1. What publish history exists per designer

### How "published" is determined

Two flags, both on the write path, only one read by the corpus.

| flag | where | set by |
|---|---|---|
| `ProjectPost.status = PUBLISHED` | `schema.prisma:1644` | `publishEditorial` (`actions/projects.ts:205`), unpublish reverses (`status/route.ts:536`) |
| `Project.isPublic = true` + `publishedAt` | `schema.prisma:416-417` | the same transaction (`actions/projects.ts:211-214`), **and separately** by `publishProjectAction` (`:426-432`) |

**The corpus definition in force is `post: { status: 'PUBLISHED' }`**, set at
`fetchRawCorpusLayer.ts:39` under the comment *"The corpus is published stories only:
projects whose ProjectPost is PUBLISHED. Drafts and unpublished work are invisible to
the queue."* Every other cross-project reader agrees — `getRelatedProjects.ts:13`,
`unlock.ts:36`, `report-headline-coverage.ts:35`, the magazine feed
(`getFilteredPosts.ts:33`), the profile grid (`profile/[userId]/page.tsx:91`).

A project with no `ProjectPost` row at all is invisible to every one of them.

### Who the corpus belongs to

`Project.designerId` (`schema.prisma:424`), nullable. On the main create path it is set
to the creator alongside `ownerId` (`api/projects/route.ts:178-179`). On the vendor
handoff path (`api/projects/handoff/route.ts:47-58`) only `ownerId` is set, so a
handed-off project carries **no designer attribution** until claimed and is absent from
any corpus query keyed on `designerId`.

`designerOrgId` (`:427`) is a separate column and **nothing in the corpus path reads
it**. This matters for the brief's own example: *"BP Design's third Coral Gables
renovation"* names a **studio**; `fetchRawCorpusLayer` takes a `designerId` and returns
one individual's work. A studio-grain body of work is a different query than the one
that exists, and CLAUDE.md's individual-first architecture is the reason it is the one
that exists.

The article headline surface has no studio name available at all: `agent` is a slot on
`agent-verb-object`, which is `grain: 'material'` (`headlineFrames.ts:296-298`) and
therefore filtered out of the article surface. `resolveProjectHeadlineSlots`
(`headlineSlots.ts:509`) resolves `project`, `tail`, `constraint`, `decision`, `change`
— no agent.

### Structured fields per published project

What `DigestProject` (`types.ts:86`) actually carries, and how good each is.

| field | column | specificity | populated by |
|---|---|---|---|
| location | `Project.city` | **free text, whole "City, country" blob** | one optional form input (`projects/new/page.tsx:1022`) |
| location | `Project.regionState` | **always null from the primary create path** (`:164`) | only the PATCH path (`api/projects/route.ts:297`) and `ProjectCreationModal.tsx:595` |
| project type | `Project.projectType` | enum, 10 values, default `UNSPECIFIED` | create form picker (`page.tsx:158-160`) |
| client type | `Project.clientType` | enum, 2 values, default `RESIDENTIAL` | derived from projectType (`page.tsx:161-162`) |
| budget | `Project.budgetBand` | enum, 5 values, default `UNSPECIFIED`; the legacy normalizer **always** writes the default (`normalizeCreatePayload.ts:82`) | rarely |
| timeline | `Project.timeline` | enum `PAST/PRESENT/FUTURE`, nullable — an orientation, not a date | create form status |
| date | `ProjectPost.publishedAt` | timestamp — **platform publish, not project completion** | publish transaction |
| project date | — | **does not exist.** Year is collected and dropped (see B5) | — |
| rooms | `Room.type` | **nullable free-text String** with a 24-value convention in a comment (`schema.prisma`, `model Room`) — not an enum | room creation |
| materials | derived `finishFamily` | 38-term `MATERIAL_CLASSES` (`signals.ts:26-34`) via substring match | `materialClassOf` |
| category | `Project.category` | free-text `String?` | legacy label mapping |

Two of these deserve their own note.

**`materialClassOf` is a substring scan, not a field.** `signals.ts:36-42` lowercases
`colorFinish + productName` and returns the first `MATERIAL_CLASSES` member found as a
substring, in array order. It is deterministic and auditable, and it is still a
heuristic: `ash` is a substring of "cashmere", `cane` of "candlestick". Array order
saves some collisions by luck (`oak` precedes `ash`, so "Washed Oak" lands on oak) and
that is not a rule anyone wrote down.

**`Room.type` is a convention in a comment.** Nothing validates it. Room-type repetition
is therefore a string match over free text, which is a different reliability class from
an enum match.

---

## 2. What patterns are computable cleanly, versus inferred

The test used here: a pattern is a **direct match** if it compares values that came from
a constrained column (enum, FK, boolean, timestamp) with no model call and no string
normalization beyond exact equality. Everything else is inference.

| pattern | mechanism | direct match? |
|---|---|---|
| **Repeated exact product across projects** | FK equality on `ProductTag.productId`, grouped by `projectId` (`signals.ts:86,:96`) | **Yes** |
| **Repeated brand across projects** | `slug(Product.brand)` equality — free-text vendor string, lowercased and hyphenated (`signals.ts:44-46,:92`) | **Near** — exact-string on an uncontrolled field |
| **Repeated material class** | `materialClassOf` substring scan, then equality (`signals.ts:93`) | **No** — normalization is a heuristic |
| **Repeated project type** | `Project.projectType` enum equality | **Yes** — but `UNSPECIFIED` is the column default and must be excluded, exactly as `computeDistributionSignals` excludes `UNSPECIFIED` budget bands (`signals.ts:185`) |
| **Repeated budget band** | enum equality; already computed at `signals.ts:182-201` | **Yes**, and near-useless — the legacy create path writes `UNSPECIFIED` unconditionally |
| **Repeated city** | `Project.city` string equality on a free-text blob | **No** — see B4 |
| **Repeated neighborhood** | no column exists | **Not computable** |
| **Repeated room type** | `Room.type` string equality on free text (`signals.ts:155`) | **No** |
| **Count over a publish window** | `count()` over `post.publishedAt` | **Yes** for platform publishes; **No** for anything phrased as project chronology (B5) |
| **Material trend over time** | `computeEvolutionSignals` halves the timeline and diffs finish shares (`signals.ts:494`) | **No** — vocabulary-sensitive; see `EVOLUTION_DENOMINATOR_AUDIT.md` F5 |
| **Project outlier** | Jaccard distance over trait sets (`signals.ts:364`) | **No** — vocabulary-sensitive; F6 |

### Which qualify

Applying the brief's own rule — *build only on direct matches* — three qualify:

1. **Repeated exact product across ≥N published projects.** FK equality. Already
   computed, already carries `projectIds` evidence, already ID'd `rep:product:<id>`.
2. **Repeated project type across ≥N published projects,** `UNSPECIFIED` excluded.
   Enum equality. **Not computed today** — no signal groups projects by `projectType`.
3. **A count of published projects in a window.** `count()` on the corpus query.
   **Not computed today** as a signal, though `maturity.publishedStoryCount` is the
   same number.

Repeated brand sits on the line and is the most editorially useful of the near-misses:
it is exact-string equality, but on a free-text vendor field with no canonical list, so
"RH" and "Restoration Hardware" are two brands. `computeRepetitionSignals` already
publishes it and additionally requires `productIds.size >= 2` (`signals.ts:105`) so that
brand loyalty means more than the same SKU twice — a good precedent for any threshold
this angle adopts.

**The place pattern — the brief's leading example — does not qualify**, and the gap is
not subtle. There is no neighborhood field, `regionState` is null on the primary path,
and `city` is an unnormalized blob. Building "another Coral Gables project" on
`Project.city` equality means a pattern that fires on `"Coral Gables"` twice and misses
`"Coral Gables, FL"` — silently, and in the most-read sentence Folio publishes.

**What place would need to become direct:** a controlled locality on `Project` (a
normalized city/locality pair, or a geocoded id), plus backfill. Until then the honest
version of the place pattern is the coarsest one the data supports — same `city` string,
exact, case-folded, trimmed — and it should be reported as what it is rather than
described as a neighborhood.

---

## 3. Eligibility thresholds

### What the codebase already treats as "enough"

Every existing cross-project threshold, for calibration:

| gate | value | file |
|---|---|---|
| Editorial Queue unlock | **3 published stories** | `maturity.ts:9` |
| Repetition signal (product / finish) | **2 projects** | `signals.ts:88, :123` |
| Repetition signal (brand) | 2 projects **and** 2 distinct products | `signals.ts:105` |
| Claim-evidence match | 3 tag rows **and** 2 projects | `signals.ts:304-305` |
| Save-delta signals | 5 stories + 100 tags + engagement | `maturity.ts:11-12` |
| Evolution signals | **8 stories**, and ≥4 with a `publishedAt` | `maturity.ts:13`, `signals.ts:501` |
| Related-projects rail prefers same designer | 2 posts | `getRelatedProjects.ts:37` |

The ladder's shape is the useful precedent: **2 is the floor for "this recurs", 3 is the
floor for "this designer has a body of work at all", and 8 is the floor for a claim
about direction over time.**

### What the floor should be for a published claim

The brief is right that two is thin, and the reason is sharper than taste: at N=2 the
denominator is invisible. "Another water-facing house" is a fair sentence when the
designer has published eight and three are water-facing. It is a misleading one when
they have published two. Every existing repetition signal at threshold 2 is consumed by
a **private prompt to the designer**, where an overstated pattern costs nothing; this
angle would be consumed by a **public headline**, where it costs the claim.

Two properties the eligibility rule needs that no current signal has:

- **A floor on the corpus, not only on the match.** `rep:*` fires at 2 matches out of a
  corpus of 2. A body-of-work headline needs both — the match count *and* a corpus large
  enough for the match to mean something. `computeDistributionSignals` already does this
  for budget (`signals.ts:190`: `bandCounts.size === 1 && raw.projects.length >= 3`).
- **The current project must be in the match set.** Every signal here describes the
  corpus in the abstract; this angle describes *this article's project as an instance of
  the pattern*. Nothing computes that today.

The strictest defensible reading of the existing ladder: **corpus ≥ 3 published projects
(the unlock gate), match ≥ 3 including the current one, and the pattern from the direct-
match list in §2.** Three rather than two because the sentence says "another" or "third",
and a third instance is the smallest number that makes either word true.

### How many designers clear it

**Not measurable here.** `DATABASE_URL` is unset in this environment (same blocker as
`PROJECT_ANGLE_AUDIT.md` §3 and `report-headline-coverage.ts:29-32`, which exits 2
rather than estimating). `ANTHROPIC_API_KEY` is also unset, though this angle needs no
model call to determine eligibility.

The queries, exactly, for whoever runs them against prod:

```sql
-- corpus depth per designer (the unlock-gate denominator)
SELECT p."designerId", COUNT(*) AS published
FROM projects p JOIN project_posts pp ON pp."projectId" = p.id
WHERE pp.status = 'PUBLISHED' AND p."designerId" IS NOT NULL
GROUP BY p."designerId" ORDER BY published DESC;

-- repeated projectType within a designer's published corpus (direct match)
SELECT p."designerId", p."projectType", COUNT(*) AS n
FROM projects p JOIN project_posts pp ON pp."projectId" = p.id
WHERE pp.status = 'PUBLISHED' AND p."projectType" <> 'UNSPECIFIED'
GROUP BY 1, 2 HAVING COUNT(*) >= 3;

-- repeated city string, and how dirty the column is
SELECT p."designerId", lower(btrim(p.city)) AS city_key, COUNT(*) AS n
FROM projects p JOIN project_posts pp ON pp."projectId" = p.id
WHERE pp.status = 'PUBLISHED' AND btrim(coalesce(p.city,'')) <> ''
GROUP BY 1, 2 HAVING COUNT(*) >= 3;

-- how many distinct raw strings collapse per designer (the B4 damage estimate)
SELECT COUNT(DISTINCT p.city) AS raw, COUNT(DISTINCT lower(btrim(p.city))) AS folded
FROM projects p JOIN project_posts pp ON pp."projectId" = p.id
WHERE pp.status = 'PUBLISHED';

-- flag divergence (B6): public projects whose post never went PUBLISHED
SELECT COUNT(*) FROM projects p JOIN project_posts pp ON pp."projectId" = p.id
WHERE p."isPublic" = true AND pp.status <> 'PUBLISHED';
```

The last one is the one to run first. It sizes B6, and it is the only query here whose
answer changes whether the corpus definition is currently sound.

What can be said without the database: **the ceiling is the unlock gate.** Any designer
below 3 published stories clears no plausible bar, and that population is known to be
non-trivial — the entire Editorial Queue exists behind that gate, and `unlock.ts` returns
`{ status: 'below_gate' }` as an ordinary outcome on every publish until it is crossed.

---

## 4. The privacy line

### Can the data model enforce published-only cleanly?

**At read time, yes — the filter is one join and every existing reader already uses it.**
`post: { status: 'PUBLISHED' }` is a relation filter on a non-null enum column. There is
no null case, no default that means "maybe", no soft-delete flag to also check. `DRAFT`,
`REVIEW` and `ARCHIVED` all fall outside it, which is the correct behaviour for all
three — an archived post was public once and is not now.

**Three things stop that from being the whole answer.**

**(a) The flag divergence (B6).** `publishProjectAction` moves `Project.isPublic` without
`ProjectPost.status`. Today that direction only hides work from the corpus. But it means
"published" is two facts that a write path has already been observed to move
independently, so the invariant is a convention, not a constraint. Nothing in
`schema.prisma` ties them: no check constraint, no trigger, no generated column. A future
path that sets `post.status = 'PUBLISHED'` without `isPublic` would publish a claim about
a project the reader cannot open — and would pass every existing test, because every
existing reader checks only one of the two.

**(b) Persisted evidence outlives the publish state (B8).** `toExtractedAngle`
(`index.ts:87-103`) rehydrates `DesignerAngle.evidence` with a cast. If the angle is
computed at generation time and the headline is published, the claim is frozen against a
corpus snapshot. Unpublishing project X afterwards does not retract "their third Coral
Gables renovation" from the article about project Y. `EVOLUTION_DENOMINATOR_AUDIT.md` F8
found the same hole for vocabulary changes; it is worse here because the stale input is
another project's *privacy state* rather than a material term.

The clean form is that a body-of-work claim must be **recomputed at render time, not
stored**, or stored with the `projectIds` it rests on and re-filtered on read. The
existing `SignalEvidence.projectIds` shape (`types.ts:19`) already carries exactly what a
re-filter would need.

**(c) Draft and private are the same flag, and there is no third state.** There is no
`isConfidential`, no NDA flag, no per-project privacy level in `schema.prisma` —
`grep -in "isConfidential\|nda\|private"` returns nothing on `Project`. So "never from a
draft or a private one" reduces to the published test, which is the good case: one
condition, not two.

### The cross-project client exposure

The brief's harder requirement — *never expose a client relationship across projects that
wasn't each independently public* — is **not** enforced by the published-only filter, and
the data model cannot help.

There is no client identity on `Project` at all: no `clientName`, no `clientId`, no FK to
a person. The only client-shaped fields are `DesignerDecision.clientBriefExcerpt`
(`schema.prisma:2098`) and the `CLIENT_BRIEF` interview answer, both project-scoped.

That absence is protective and incomplete. Because there is no client key, the system
**cannot** join two projects on a shared client — so it cannot deliberately assert one.
What it can do is assert something that discloses one by implication. "Their third
project for the same family," "another house on the same street," "the third phase of
this estate" are all sentences a model can write from two published projects with the
same `city` and similar titles, and none of them is checkable against a field. The
published-only filter passes them, because both projects genuinely are public; what was
never public is the *link between them*.

**This is a prompt-and-frame constraint, not a data constraint,** and it should be
written down as one. The mechanism that fits already exists: the frame's `requiredFields`
plus `renderFrameInstruction` (`headlineFrames.ts:798`) inline the verified values and
tell the writer to use them as given. A body-of-work frame should carry the *count* and
the *matched attribute* as its only slots, so the only claim available to the sentence is
the one the computation made.

Two more exposures worth naming:

- **Corpus membership is itself a disclosure of grain.** "Their third Coral Gables
  renovation" tells a reader the designer has two others and roughly where. Each is
  public, and the aggregate is new. This is inherent to the angle and is the reason the
  eligibility floor matters — at N=3 out of a public body of work it is journalism; at
  N=2 out of 2 it is a directory listing.
- **Deleted accounts stay in the corpus.** `api/user/delete/route.ts:78-97` deletes only
  unpublished projects and leaves published ones for referential integrity. The
  anonymization `updateMany` immediately after has an empty `data: {}` — it is a
  documented stub (*"simplified example"*), so **nothing is actually anonymized**. A
  deleted designer's published projects remain fully attributed and remain corpus
  members. (That block also has a duplicate `OR` key in its `where`, where the second
  literal overwrites the first; harmless only because `data` is empty.)

---

## 5. Where it fits the picker

### What the picker is today

`HeadlinePicker.tsx` groups options by angle and makes the **angle** the primary choice,
with wordings secondary behind "N more wordings". Each group gets its own "More like
this" that re-rolls one angle (`propose(group.angle)`), and there is a batch-level "New
options, every angle". `TitleAlternative` carries `{ text, angle, angleLabel }`.

The three angles are `constraint`, `governing-decision`, `change`
(`regenerate/route.ts:126-134`), each gated on its frame surviving `eligibleFrames`. When
none survives, the route returns HTTP 422 `NO_ELIGIBLE_ANGLE` with a `missing` list
(`:418-437`) and the picker renders it as a to-do: *"Answer a few more opening questions
to get title options."*

### The two ways it could land

**As a fourth entry in `PROJECT_GRAIN_ANGLES`.** Mechanically the smallest change: the
picker groups by whatever angles the route returns and needs no edit at all. `MAX_ANGLES`
is 6 (`:142`) with a comment naming itself the tripwire *"if a fourth lands"* — so the
tripwire fires, by design, and this is the moment it was written for.

What it costs is the invariant that makes the current surface honest. Every existing
angle is gated on `eligibleFrames(slots, { grain: 'project', source: 'interview' })`
(`:362`), and `SURFACE_SOURCE = 'interview'` is doing real work — the comment at `:190`
records that it is what keeps CONTINUITY off the article, because CONTINUITY ranks by tag
count and is *"confidently specific about whatever was photographed most rather than
about anything the designer emphasised."*

A corpus angle is **exactly the thing that gate excludes**: not sourced from the
designer's own words about this project. Admitting it means widening
`HeadlineFrame['source']` from `'interview' | 'tags'` (`headlineFrames.ts:91`) to include
a third value and turning the surface's single `source` into a set. That is a small diff
and a large decision, and it should be made explicitly rather than as a side effect —
because the same widening is what would let CONTINUITY back in.

**As a different kind of option.** The brief's own observation is the strongest argument
for this: it needs no interview and is eligible on a thin-interview project with a rich
history. That inverts the availability of every other angle. The current failure mode is
"you have not answered enough questions"; this angle's is "you have not published enough
projects" — a different sentence, addressed by different work, on a different timescale,
and one the designer cannot fix today.

Folding it into the same list means the `NO_ELIGIBLE_ANGLE` `missing` list has to carry
both kinds of gap, and *"the project has no city or region set"* (`:422`) already sits
oddly there as the one entry that is not a question. Adding *"you have published two
projects; this needs three"* makes the to-do list partly actionable and partly not.

### The recommendation

**A fourth angle in the same picker, gated separately and labelled by its evidence.**

The picker's structure already carries the distinction without a redesign: `angleLabel`
is free text rendered above each group, so "Across your work" reads differently from
"Constraint the project answered" without any new component. The grouping, the per-angle
re-roll and the radio semantics all apply unchanged.

Three things to hold to if it ships there:

1. **Its eligibility must not run through `eligibleFrames`'s interview source gate.**
   Compute it separately, off the corpus, and append. Widening `SURFACE_SOURCE` to a set
   quietly re-admits CONTINUITY; that should be its own decision with its own audit.
2. **Its absence must not appear in `missing`,** or it must be visibly a different kind
   of line. A designer with two published projects has not failed to answer anything.
3. **The claim must be recomputed at render, or re-filtered on read.** See §4(b) — this
   is the one requirement that is a correctness constraint rather than a product choice.

### One thing this angle does that no other does

It is the only angle whose subject is verifiable **without trusting a model with prose**.
`constraint`, `governing-decision` and `change` each hand the writer a verbatim answer
and ask it to find the story inside — the `verified: true` on those slots
(`headlineSlots.ts:559, :568, :576`) attests that the designer *said something*, not that
the headline's claim is true. A body-of-work claim is a count with row IDs behind it, in
the shape `SignalEvidence` already defines. It is the one angle where "third" can be
checked against the database after publication.

That is also precisely why an overstated one is worse here than anywhere else. The other
three overstate a designer's own words back to them. This one would overstate a fact.

### The reader path

The brief notes this angle can pull a reader toward the designer's other articles. That
rail already exists and is already rendered: `getRelatedProjects` (`lib/article/`) is
called at `api/posting/[slug]/route.ts:206` and rendered by `PostExpanded.tsx:384-385`.
It prefers the same designer's published posts and falls back to recent posts by anyone
when fewer than two exist.

So a body-of-work headline would have somewhere to land the reader without new
navigation. Two mismatches to note before assuming it lines up: the rail's fallback fills
with **other designers'** posts, so the article next to a "third Coral Gables project"
headline may be nothing of the sort; and the rail selects by recency, not by the matched
pattern. Pointing the rail at the angle's own `evidence.projectIds` would make the
headline and the rail agree — a query change in an existing function, not new capture.

(In passing: `getRelatedProjects` reads `post.project?.id` in both mapping branches
(`:48`, `:106`) but never selects `id` in either `select` block, so every returned
`project.id` is `""`. Unused by `RelatedProjects`, which keys on the post's own `id` and
`slug` — but any consumer reaching for the project id gets an empty string.)

---

## Reproduction

Schema and call-site claims checked against `prisma/schema.prisma` and `src/` at the
tip of `claude/body-of-work-audit-fyd7se`.

The "no geography signal" claim (B2) is
`grep -n "city\|regionState\|region\|location\|geo" src/lib/editorial-queue/signals.ts`
returning zero lines. The "no neighborhood column" claim (B4) is
`grep -in "neighborhood\|neighbourhood\|postalCode\|zipCode\|addressLine\|latitude\|longitude" prisma/schema.prisma`
returning zero lines. The "year is dropped" claim (B5) is `grep -n "year"` over
`src/app/projects/new/page.tsx` returning exactly three hits — the type member, the
default, and the `register` call — with no submit-payload reference.

Not measured, and why: every count in §3 needs `DATABASE_URL`, which is unset in this
environment. `ANTHROPIC_API_KEY` is also unset; this angle's eligibility needs no model
call, so that blocks nothing here. Queries are given above rather than estimated, for the
same reason `report-headline-coverage.ts:29-32` exits rather than guessing.
