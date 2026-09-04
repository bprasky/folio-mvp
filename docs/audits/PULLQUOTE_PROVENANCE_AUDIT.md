# Pull Quote Provenance Audit

**Date:** 2026-09-03
**Scope:** read-only. No code, no schema changed.
**Predecessor:** `docs/audits/PULLQUOTE_VERBATIM_AUDIT.md`

**Question:** the verbatim architecture is proven — 59 of 59 code-selected pull quotes verified
on project `dda4b29e-dbdf-4f54-ad21-32dafd4d1dd4`, four fabricating paths deleted or rewired,
the wiring asserted with red/green proof. What it does not do is record WHICH answer a quote
came from, so a selection verified at generation cannot be re-verified at render, after a
regenerate, or after the naming gate scrubs it. This audit asks what a durable pointer would
have to be made of.

**Headline:** the expected pointer does not exist. `questionId` + answer record id is the wrong
shape, because **the answer record id is regenerated on every interview save** —
`rebuildAnswerProjection` deletes every row and recreates it with a fresh `randomUUID()`
(`src/lib/editorial/syncInterviewAnswers.ts:114-119`). The only identifier that survives a save
is the composite `(interviewId, questionId, isFollowUp)`, it has no uniqueness constraint behind
it, and on the canonical store `questionId` can itself be positional (`auto-<idx>`). The
collaboration path is worse: it has no per-answer identifier at all, and C3 discards the one
field that could stand in for it.

Stage two does not wait on a schema decision. It waits on two defects underneath it.

---

## Findings, ranked

| # | Finding | Effect on stage two |
|---|---|---|
| 1 | `EditorialInterviewAnswer.id` is **not durable** — wiped and re-minted on every sync | The expected pointer shape is wrong. Any stored `answerId` becomes a dangling reference at the next interview save. |
| 2 | `loadInterviewAnswers` **overwrites `section`** with the resolved room; the original question category is unrecoverable for all but `project-`-prefixed ids | Provenance would encode a derived scope as if it were a stored one. **Must land first.** |
| 3 | Collaboration answers carry **no id of any kind** in the shape C3 builds; `contributorAnswers` drops `questionId` | That path cannot carry provenance at all today. |
| 4 | `(questionId, isFollowUp)` — the one stable key — has **no unique constraint**, and `questionId` may be `auto-<idx>` | The composite is stable in practice, not enforced. |
| 5 | `PATCH /api/posting/project/[projectId]/blocks` writes both quote stores verbatim with no reconciliation and **no callers** | A third back door around the picker, and the mechanism by which the two stores diverge. |
| 6 | Room rename edits `chapter.title` but not `pullQuotes[].sourceSection` | Live divergence between the two stores today. |
| 7 | 39 script files referenced by 46 npm scripts **were never committed**, `check:vendors` among them | Same absence. Three migration entry points are dead. |

---

## 1. Durable identifier

### What exists at candidate construction time

`extractQuoteCandidates` (`src/lib/posting/quoteCandidates.ts:90`) receives `AnswerLike`:

```ts
// src/lib/posting/quoteCandidates.ts:46
export interface AnswerLike {
  section?: string;
  answer: string;
  isFollowUp?: boolean;
}
```

**There is no identifier in the shape at all.** The candidate it emits carries `answerIndex`
(`:37`), documented "for verification", and `toSelection` (`src/lib/posting/selectPullQuotes.ts:96-99`)
projects to `{ text }` and drops it. As the brief states, it would not survive anyway — it indexes
the array `loadInterviewAnswers` rebuilds each run, after merging two stores, resolving rooms and
de-duplicating (`src/lib/posting/loadInterviewAnswers.ts:130-166`).

The caller's own type is no richer:

```ts
// src/lib/posting/loadInterviewAnswers.ts:68
export interface LoadedAnswer extends AnswerLike {
  section: string;                              // the ROOM, not the category
  category: ProjectQuestionCategory | null;     // derived from the questionId prefix
  answer: string;
  isFollowUp: boolean;
}
```

`questionId` is read inside `loadInterviewAnswers` — only to derive `category` — and then
discarded. Nothing downstream of the loader can name an answer.

### Does every source answer carry a durable id today? No.

Two stores feed the loader, and they differ.

**`EditorialInterviewAnswer` (the projection).** Has `id String @id @default(cuid())` and
`questionId` (`prisma/schema.prisma:` model `EditorialInterviewAnswer`). The `id` looks like the
obvious pointer. **It is not stable.** Every sync wipes and rebuilds:

```ts
// src/lib/editorial/syncInterviewAnswers.ts:108-119
const idByQuestion = new Map<string, string>();
for (const a of rows) {
  idByQuestion.set(rowKey(a.questionId, !!a.isFollowUp), randomUUID());   // fresh id, every pass
}
await prisma.$transaction([
  prisma.editorialInterviewAnswer.deleteMany({ where: { interviewId } }),  // every row deleted
  ...rows.map((a) => prisma.editorialInterviewAnswer.create({
    data: { id: idByQuestion.get(key)!, … }
```

`syncAnswersToEditorialInterview` runs from `interview/process` and `interview/status`
(`src/app/api/posting/project/[projectId]/interview/process/route.ts:7`,
`…/interview/status/route.ts:7`), so any further interview activity re-mints every id. **A stored
`answerId` would dangle after the designer answers one more question.** This is the correction to
the expected shape.

What survives a rebuild is `rowKey`:

```ts
// src/lib/editorial/syncInterviewAnswers.ts:65-66
const rowKey = (questionId: string, isFollowUp: boolean) =>
  `${questionId}|${isFollowUp ? 'F' : 'P'}`;
```

So the durable identity is **`(interviewId, questionId, isFollowUp)`** — carried deliberately
enough that `parentAnswerId` is re-resolved through it on every pass (`:127-129`). It is a
convention, not a constraint: the model declares `@@index([interviewId])` and
`@@index([questionId])` and **no `@@unique`** on the pair.

**`provenance.interview.payload` (the canonical store).** No record id exists — it is a JSON array
on `ProjectPost`. Each entry gets a `questionId` from a four-step fallback:

```ts
// src/app/api/posting/project/[projectId]/interview/route.ts:362-366
const qid = (a?.id ?? a?.questionId ?? (slugify(prompt) || `auto-${idx}`));
…
questionId: String(qid || `auto-${idx}`),
```

An answer that reached the route without an id and without a prompt is named **by its position**.
`auto-3` is not durable: reorder the array and it names a different answer. `slugify(prompt)`
(`:248`) is content-derived — stable while the question text is, and silently colliding for two
questions that slug the same within the 64-character truncation.

`rebuildAnswerProjection` also drops any answer whose `questionId` is empty (`:96-98`), so a
payload entry the fallback could not name never reaches the projection at all.

**Summary of what is available where:**

| Store | record id | `questionId` | durable? |
|---|---|---|---|
| `EditorialInterviewAnswer` | `id` (cuid) | yes | **id: no** — re-minted every sync. `(interviewId, questionId, isFollowUp)`: yes, unenforced |
| `provenance.interview.payload` | none | yes, may be `auto-<idx>` or a prompt slug | partially — positional in the fallback case |
| Collaboration rounds | none | yes (see below) | see below |

### The collaboration path

C3 keys candidate pools on contributor role, and builds the `AnswerLike` array itself:

```ts
// src/lib/collaboration/narrative/assembleStory.ts:250-269
for (const r of responses ?? []) {
  if (typeof r?.answer === 'string' && r.answer.trim()) {
    out.push({ section: role, answer: r.answer, isFollowUp });   // questionId dropped
  }
}
```

The source shape has one:

```ts
// src/lib/collaboration/questions/round1.ts:156-160
export type Round1Response = { questionId: string; answer: string; answeredAt: string };
```

Those ids are usable but weaker than the article's. Round 1 ids are static constants
(`'v1-relationship-1'`). Rounds 2 and 3 are model-generated and fall back to **positional** ids
minted from the array index — `` id: q.id || `r2-${role.toLowerCase()}-${index + 1}` ``
(`generateRound2.ts:118`, `generateRound3.ts:146`). They are stable once persisted, because the
questions are stored alongside the responses in the same JSON column, but they are not unique
across stories and there is no row to point at: `CollaborationStory` holds
`vendorRound1 … designerRound3` as six `Json?` columns with no per-answer records.

A pointer here would have to be `(collaborationStoryId, roundColumn, questionId)` — three parts,
none of them a foreign key.

**Finding: no path has the expected identifier.** The article path has a durable composite that
is not enforced and is not carried past the loader. The collaboration path has a weaker composite
that C3 discards before candidates are built. On the brief's own terms — *"if any path lacks a
durable id, that is the finding and the schema work waits"* — the schema work waits.

---

## 2. The two-store question

### What each store is for

**`galleryChapters[].pullQuote`** — the per-room selection, and the only writable one. Shape
`string | PullQuoteSelection | null`, where `PullQuoteSelection = { selected, alternatives[] }`
(`src/lib/posting/schemas.ts:23-35`). `alternatives` is the designer's shuffle pool and the
allowlist the picker's PATCH validates against. This is the authoritative record of a decision.

**`pullQuotes[]`** — a derived flat index, `{ text, context?, sourceSection? }`, rebuilt by
`syncPullQuotesFromChapters` (`src/lib/posting/schemas.ts:331-352`) from the chapter selections
plus `hookQuote`. It carries no alternatives and cannot be edited. Its one piece of information
the chapters lack is the **hook quote**, prepended without a `sourceSection` precisely so
`buildRoomTiles` can recognise it as project-level (`schemas.ts:325-338`).

So the duplication the baseline saw — the same Dining Room string in both — is by construction, not
drift: `syncPullQuotesFromChapters` copies each chapter's selected text into the index and tags it
with the chapter title.

### Which surfaces read which

| Surface | file:line | reads |
|---|---|---|
| Published article `/p/[slug]` — room quotes | `src/lib/story/buildRoomTiles.ts:374` | **chapter** |
| Published article — project lead quote | `src/lib/story/buildRoomTiles.ts:299-305` | **index** (first entry without `sourceSection`) |
| Published article — breather interstitials | `src/lib/story/buildRoomTiles.ts:190-213` | **index** |
| Preview `RichArticle` | `src/components/posting/preview/RichArticle.tsx:249` | **index** |
| `PostExpanded` / `MotionPullQuote` | `src/components/posting/PostExpanded.tsx:60,257,306` | **index** |
| `SmartEditorialLayout` | `src/components/project/SmartEditorialLayout.tsx:130,240` | **chapter** |
| Instagram export | `src/lib/instagram/extractQuotes.ts:35-53`, `matchQuoteToImage.ts:44-70` | **both** |
| Picker PATCH (write) | `src/app/api/posting/project/[projectId]/sections/pull-quote/route.ts:78` | **chapter**, then syncs |
| `layoutEngine` | `src/components/project/editorial/layoutEngine.ts:893-901` | both — **dead**, `EditorialProjectLayout` has no importers |

Neither store is the reader's single source. The published page reads the chapter for a room quote
and the index for the lead and the breathers, in the same render.

### Can they diverge today? Yes, two ways.

**A. Room rename does not touch the index.**
`src/app/api/projects/[id]/rooms/[roomId]/route.ts:133-142` rewrites every matching
`chapter.title`, persists, and never calls `syncPullQuotesFromChapters`. `pullQuotes[].sourceSection`
keeps the old room name. The consequence is visible: `placeBreathers` labels a breather with
`formatRoomName(tq.sourceSection)` (`buildRoomTiles.ts:208-211`), so after a rename a quote can be
attributed on the published page to a room that no longer exists.

**B. `PATCH /api/posting/project/[projectId]/blocks` writes both stores unreconciled.**

```ts
// src/app/api/posting/project/[projectId]/blocks/route.ts:34-40
const validated = BlocksSchema.parse(body);
await prisma.projectPost.update({ where: { projectId }, data: { expandedBlocks: validated as any } });
```

`BlocksSchema` accepts `galleryChapters[].pullQuote` and `pullQuotes[]` as independent fields and
requires no agreement between them, and the route does not sync. Anyone with project write access
can set the two stores to different strings.

This is also a **third back door around the picker**, alongside the two the earlier audit found.
`/sections/override` refuses `field === 'pullQuote'` outright
(`…/sections/override/route.ts:51-58`); `/sections/pull-quote` accepts only text already present in
`alternatives`. This route accepts arbitrary pull quote text with neither check. It has **zero
callers** in the codebase — an unreferenced but live endpoint.

Divergence has one more structural source worth naming: the naming gate scrubs both stores
(`src/lib/naming/scrubProse.ts:176` for chapters, `:180-184` for the index) with the same function,
so they stay consistent with each other — and both drift away from the interview answers together.
Consistency between the stores is not the same property as fidelity to the source.

### Recommendation — one store carries provenance: `galleryChapters[].pullQuote`

Not because it is read more, but because it is the only one that records a **decision** rather than
a **projection**.

- It is the sole write target. Every legitimate writer — `assignVerifiedPullQuotes`, the backfill,
  the picker PATCH — writes the chapter and then rebuilds the index from it. Provenance attached to
  the index would be authored by `syncPullQuotesFromChapters`, which knows only what the chapter
  already told it; it would be a copy of a pointer, and copies of pointers go stale silently.
- It already carries per-quote structure. `PullQuoteSelection.selected` and each `alternatives[]`
  entry are objects with room for a `source` field. `pullQuotes[]` entries are flat and partly bare
  strings on legacy rows.
- Every alternative needs its own pointer, not just the selected one. The picker lets a designer
  cycle to any alternative, which becomes the published quote; a pointer stored only alongside
  `selected` would be wrong the moment they cycle. Only the chapter store holds the alternatives.
- The index is regenerated wholesale on every sync, so anything written there is provisional by
  design.

The hook quote is the one thing the index holds that no chapter does. It is verified by the same
`isVerbatimSpan` at `src/lib/posting/generateEditorialDraft.ts:541` and `:1000`, and it would need
its pointer on `blocks.hookQuote` itself — the object it already lives in — not on the index entry
derived from it.

Not implemented. Not proposed beyond this paragraph.

---

## 3. The section-overwrite interaction

### Yes. `loadInterviewAnswers` still overwrites `section`.

```ts
// src/lib/posting/loadInterviewAnswers.ts:121-129
const push = (text, section, isFollowUp, category) => { … out.push({ answer: text, section, isFollowUp, category }); };
…
// :132-135  every store, same overwrite
push(a?.answer ?? a?.a, roomOf(a), !!a?.isFollowUp, categoryFromPayload(a));
```

`roomOf` resolves `roomId` to a room name and falls back to the literal `'General'` (`:98-103`).
The file states the overwrite outright and defends it:

> *"So `section` on a LOADED answer means the room, and that is load-bearing …
> The field is not being renamed."* (`loadInterviewAnswers.ts:21-26`)

It is load-bearing for exactly the reason given — `quoteCandidates.ts:97` and
`selectPullQuotes.ts:173` both match `section` against a chapter title. The problem is not that the
room is there. It is what the room replaced.

### What `section` held before the overwrite

The canonical store writes `section` as the **question category**, from a closed set:

```ts
// src/app/api/posting/project/[projectId]/interview/route.ts:243-246
const ALLOWED_SECTIONS = new Set([
  'designIntent','materialsMethod','collaboration','emotionalCore','insightsReflection','lightningRound',
  'why','who','what','where','when','how'
]);
```

`what` is a member. The baseline's `"We use paneling strategically in our projects and throughout
the house"` was tagged `section: 'what'` in provenance — a project-scoped category — and the loader
replaced that with a room name before any quote code saw it.

### The category is not recoverable

`LoadedAnswer.category` looks like the escape hatch. It is not, for most answers:

```ts
// src/lib/posting/loadInterviewAnswers.ts:117-119
const categoryFromPayload = (a: any): ProjectQuestionCategory | null =>
  projectAnswerCategory(a?.questionId ?? a?.id) ??
  projectAnswerCategory(a?.parentQuestionId ?? a?.parent_question_id);
```

`projectAnswerCategory` returns a value **only** when the id starts with `project-<CATEGORY>-`
(`:59-67`), and the categories it recognises are the five `PROJECT_QUESTION_CATEGORIES` — not the
twelve `ALLOWED_SECTIONS`. An answer whose provenance `section` was `'what'` and whose questionId is
anything else gets `category: null` and a `section` naming a room. **`'what'` is gone, with no
recovery path**, and the loader is the last place it existed.

`EditorialInterviewAnswer` cannot restore it either: the projection has no category or section
column — `questionId`, `questionText`, `roomId`, `isCrossRoom`, and nothing that records scope.

### Cross-room misattribution is not ruled out where the room is unknown

The baseline's "3 of 14 chapters had no room-labelled answers" describes the audit script's own
scoping, which is honest about the gap:

```ts
// scripts/audit-article-quotes.ts:358-370
const roomAnswers = q.room ? answers.filter(a => sameRoom(a.section, q.room!)) : [];
const roomIsKnown = roomAnswers.length > 0;
if (isVerbatimSpan(q.text, roomIsKnown ? roomAnswers.map(a => a.answer) : all)) return { verdict: 'VERBATIM' };
// Real words, wrong heading. Only reachable when we know the room…
if (roomIsKnown) { … return { verdict: 'WRONG_ROOM', … }; }
```

When no answer carries that room, the check widens to the whole interview and `WRONG_ROOM` becomes
**unreachable**. Those three chapters are unverified for scope, not verified. That is a limit of
the audit, not a defect in the selector: `selectPullQuotes` only builds a pool for rooms that
appear in the answers, so a chapter with no room-labelled answers gets `null` and no quote at all.
The exposure is the reverse case — an answer carrying a `roomId` whose question was project-scoped
becomes a candidate for that room, and nothing downstream knows it was a `'what'` answer.

### Must this land before stage two? Yes.

A provenance pointer records *which answer, at what scope*. Today the scope field a pointer would
naturally carry is `section`, and `section` is **derived at load time from `roomId`, overwriting a
stored value that is then unrecoverable**. Encoding it would freeze a derivation into the record and
misdescribe every project-scoped answer that happens to carry a room — the paneling quote's exact
shape. Two answers that differ only in question category would produce identical pointers.

The fix is additive and needs no schema change: carry the payload's original `section` alongside the
resolved room on `LoadedAnswer`, rather than replacing it. `roomId` is already projected onto
`EditorialInterviewAnswer` and already carried first-class through provenance
(`interview/route.ts:373-375`), so both halves exist upstream — the loader is the only place they
are collapsed into one field.

**Provenance work sits on top of a destroyed category field. Restore the field first.**

---

## 4. Missing scripts

### The same absence, and larger than either count

`check:vendors` and the migration safety scripts are **one absence, not two**. Neither is a
deletion: `git log --all --diff-filter=A` finds **no commit that ever added any of them**, and
nothing in `.gitignore` covers `scripts/`. They were never committed. The npm entries reference
files that have never existed in this repository.

The scale: **46 of 83 npm scripts that reference a repo file point at a missing one; 39 distinct
files are absent.**

### The migration scripts, and what they gate

| npm script | missing file | gates |
|---|---|---|
| `db:guard` | `scripts/guard-migrations.ts` | **`migrate:safe`, `migrate:create-only`, `migrate:deploy`** — all three chain `npm run db:guard &&` first |
| `db:backup` | `scripts/backup-db.ts` | `migrate:safe` |
| `migrate:direct` | `scripts/migrate-with-direct.ts` | — |
| `migrate:apply-sql` | `scripts/apply-migration-sql.ts` | — |
| `db:check` | `scripts/db-check.ts` | — |
| `verify:prisma` | `scripts/verify-prisma-sync.ts` | — |

The four the brief names are `db:guard`, `db:backup`, `migrate:direct`, `migrate:apply-sql`;
`db:check` and `verify:prisma` are the same class and worth counting with them.

**Every migration entry point is dead.** `db:guard` is the first link in all three chains, so
`migrate:safe`, `migrate:create-only` and `migrate:deploy` fail before touching Prisma:

```
$ npm run db:guard
  url: 'file:///home/user/folio-mvp/scripts/guard-migrations.ts'
  → MODULE_NOT_FOUND, exit 1
```

Only `migrate:create` (`prisma migrate dev --create-only`, no guard) and
`check:migration-connection` still run. This is worth stating against CLAUDE.md's migration
discipline, which describes an approval-gated apply loop: the *scripted* half of that loop does not
exist, and the CI half (`migration-discipline.yml` → `scripts/phase5e-check-plan.mjs`) does — that
file is present and the workflow passes. The discipline is enforced after the fact in CI and not at
all before an apply.

### What each was supposed to do, from its references

- **`scripts/guard-migrations.ts`** (`db:guard`) — a pre-apply safety gate. Its position as the
  first link in all three migration chains is the whole specification: refuse to proceed on an
  unsafe state. CLAUDE.md's runbook names the checks such a gate would make — `_prisma_migrations`
  bookkeeping state, `prisma migrate status` cleanliness, connection target.
- **`scripts/backup-db.ts`** (`db:backup`) — runs between the guard and `prisma migrate dev` in
  `migrate:safe`. A pre-migration snapshot; the "safe" in the script name is this file.
- **`scripts/migrate-with-direct.ts`** (`migrate:direct`) — apply against the direct (non-pooled)
  connection. `check:migration-connection` exists and asserts the same distinction, and
  `docker-compose.prisma-shadow.yml` is present, so this is the pooler-bypass path Prisma needs for
  DDL.
- **`scripts/apply-migration-sql.ts`** (`migrate:apply-sql`) — apply a hand-authored `.sql` file
  outside `prisma migrate`. Matches CLAUDE.md's Bucket-B pattern ("author record-existing-state
  migration first … apply + resolve") and the 33 grandfathered loose SQL files at
  `prisma/migrations/` root that `phase5e-check-plan.mjs` baselines.
- **`scripts/db-check.ts`** (`db:check`) — connectivity/state probe.
- **`scripts/verify-prisma-sync.ts`** (`verify:prisma`) — schema-vs-client drift check. Sits beside
  `clean:cache` / `prisma:reset` / `dev:fresh`, all three of which point at the equally absent
  `scripts/clean-prisma-cache.js`.
- **`scripts/check-vendors.mjs`** (`check:vendors`) — a vendor-data check, paired with the equally
  absent `create-vendor.mjs` and `audit-product.mjs`. No surviving reference says more; it is not
  migration tooling and shares nothing with the group above except never having been committed.

### The other 32 missing files

Not migration tooling, same cause. Grouped by what their npm entry claims:

**Audit/diagnostic** — `audit-dashboard.ts` (`audit:dash`, `audit:dash:json`, `check:audit`),
`readonly-smoke.js` (`audit:smoke`), `audit-product.mjs` (`audit:product`, `audit:product:rove`),
`audit-events.mjs`, `diag.mjs`, `debug-prisma-types.ts`, `test-search.ts`, `lighthouse-test.mjs`,
`test-auth-endpoints.js`, `test-supabase-service-key.mjs`, `auth-detect.ts`,
`auth-detect-simple.js`, `check-env.ts`.

**Guards** — `guard-client-imports.js` (`guard:client-imports`), named in CLAUDE.md's agent
definitions as a standing discipline for the RSC/client boundary. That guard does not exist either.

**Backfills/fixes** — `backfill-image-classification.ts`, `backfill-moment-index.ts`,
`backfill-moment-index-fields.ts`, `check-and-fix-moment-index-schema.ts`,
`export-verification-training-data.ts`, `fix-image-urls.mjs`, `fix-tola-image.mjs`,
`fix-null-combined-tags.ts`, `fix-null-array-fields.ts`, `fix-null-array-elements.ts`,
`clean-prisma-cache.js`.

**Seed/create** — `seed-minimal.ts`, `create-demo-user.ts`, `create-vendor.mjs`,
`create-test-product.mjs`, `list-buckets.mjs`, `create-storage-bucket.mjs`.

`scripts/` holds 100+ files that do exist, including every `check:*` wired into CI. The absence is
concentrated in entries added to `package.json` without the file landing alongside — which is why
it reads as scattered rather than as one removal.

---

## Appendix — verification performed

- `git log --all --diff-filter=A -- <path>` run per missing file: **no add commit for any of them**.
  `git check-ignore` clean, so they are not ignored-but-present.
- `npm run db:guard` executed: `MODULE_NOT_FOUND`, exit 1. `npm run check:vendors` likewise.
- `syncAnswersToEditorialInterview` call sites traced to `interview/process/route.ts:7` and
  `interview/status/route.ts:7`, confirming id re-minting is on a live path.
- `syncPullQuotesFromChapters` call sites enumerated (5) and cross-referenced against every
  `expandedBlocks:` write site — `blocks/route.ts:40`, `rooms/[roomId]/route.ts:142`,
  `undo/route.ts:69` and `headline/regenerate/route.ts:822` write without syncing; of those, the
  first two can change quote-relevant state.
- `PATCH /blocks` caller trace: zero callers in `src/`.
- Empirical re-verification of the paneling quote was **not** attempted — no `DATABASE_URL` in this
  environment. Section 3 reports the mechanism from the code, not a fresh run of the baseline.
