# Pull Quote Verbatim Audit

**Date:** 2026-09-03
**Scope:** read-only. No code changed.
**Claim under test:** every pull quote rendered on a published or preview article surface is
the contributor's actual words, traceable to a stored interview answer, never generated.

**Verdict: the claim is true of one path and false of the codebase.**

The canonical project-article path (`selectPullQuotes`) enforces verbatim mechanically and
does it well — candidates are cut from stored answers by code, the model returns only IDs,
and every selection is re-checked with `isVerbatimSpan` before it ships. That guarantee is
real and it fails closed.

It is also the only path that has it. Five other live paths emit a string that renders
inside quote marks on a published or preview surface, and none of them verifies anything.
One of them — the collaboration narrative — has a model write the quote text outright,
attributes it to a named person, and publishes it. One of them — the admin re-extract
route — mines quotes back out of generated prose and overwrites the verified selections on
every post in the database.

---

## Findings, ranked by whether they permit a fabricated quote on a published surface

| # | Finding | Can a fabricated quote reach a published surface? |
|---|---|---|
| 1 | Collaboration narrative emits model-authored `pullQuote` blocks, attributed by name, rendered at `/magazine/collaborations/[slug]` | **Yes — by design. Nothing verifies.** |
| 2 | `POST /api/admin/re-extract-lead-pull-quotes` re-mines every post's quotes from generated prose and overwrites verified selections | **Yes — and retroactively, across the whole table.** |
| 3 | Section regenerate persists naming-gate-scrubbed pull quote text, silently editing a verified quote | **Yes — a stored verbatim quote becomes non-verbatim.** |
| 4 | In-body attributed quotes (`"…," Rivera recalls`) are model-written; prompt-only grounding; `fixSentenceOpeners` rewrites paragraphs containing them | **Yes — quoted strings in body prose are unverified.** |
| 5 | Instagram export: `generatePullQuotes` is a pure headline generator; `extractQuotes` mines sentences out of generated body prose | **Yes, on the export surface** (not the article). |
| 6 | `QuoteHighlight` extraction prompt carries a live *"light cleanup ok"* polish allowance | Store is populated; **both render surfaces are currently unmounted.** |
| 7 | Boost: vendor types free text, stored as a designer-attributed `pullQuote` with `showInArticle` | Latent — `getBoostsForProject` has **zero callers**. |
| 8 | No provenance pointer is stored with any pull quote | Enables nothing directly; **makes render-time or after-the-fact verification impossible.** |
| 9 | Pull quote is never de-duplicated against the body of its own room section | Not fabrication; a same-page repetition and a normalization mismatch. |
| 10 | `scripts/check-pull-quotes.ts` — the guard that pins the whole canonical design — is not wired into CI | Meta: the one real enforcement is unenforced. |

---

## 1. Every path that can emit a pull quote or a quoted display string

### Live — article surfaces

| Path | file:line | Extract or generate? |
|---|---|---|
| **Canonical room pull quote** | `src/lib/posting/selectPullQuotes.ts:110` | **Extract.** `extractQuoteCandidates` cuts contiguous slices of stored answers; the model returns IDs only. |
| Candidate cutter | `src/lib/posting/quoteCandidates.ts:90` | **Extract.** Index-into-string, single unbroken slice, never edited. |
| Assignment into blocks | `src/lib/posting/generateEditorialDraft.ts:1494` (`assignVerifiedPullQuotes`), called at `:1902` | **Extract.** Runs last; clears any chapter it cannot verify. |
| **Lead / hook quote — splice** | `src/lib/posting/generateEditorialDraft.ts:473` (`spliceHookQuote`) | **Generate, then verify.** Prompt explicitly permits trim/elide/splice; output is checked at `:541`, dropped if it fails. |
| **Lead / hook quote — intro fallback** | `src/lib/posting/generateEditorialDraft.ts:438` (`extractHookQuoteFromIntroduction`) | **Mines generated intro prose**, then verified at `:1000`. Passes only when the model happened to quote verbatim. |
| Chapter regex extractor | `src/lib/posting/generateEditorialDraft.ts:297` (`extractPullQuotesForChapter`) | **Mines generated prose.** No check of its own. Two callers — see below. |
| **Backfill** | `src/app/api/posting/project/[projectId]/sections/pull-quotes/backfill/route.ts:78` | **Extract.** Routes through `selectPullQuotes`. Only fills nulls. |
| Picker PATCH | `src/app/api/posting/project/[projectId]/sections/pull-quote/route.ts:78` | **Select from stored alternatives.** Rejects anything not in `alternatives`. |
| Override PUT | `src/app/api/posting/project/[projectId]/sections/override/route.ts:51` | **Blocked.** `field === 'pullQuote'` returns 400. The dead write path below it (`:267`) is unreachable. |
| **Section regenerate** | `src/app/api/posting/project/[projectId]/sections/[chapterIndex]/regenerate/route.ts:356` | Does not re-select quotes, but **persists gate-rewritten quote text**. See §4. |
| **Admin re-extract** | `src/app/api/admin/re-extract-lead-pull-quotes/route.ts:56` | **Mines generated prose, unverified, for every post in the table.** |
| In-body attributed quotes | `src/lib/posting/generateEditorialDraft.ts:1260-1268`; regenerate route `:221-225` | **Generate.** Prompt-only grounding. |

### Live — non-article surfaces

| Path | file:line | Extract or generate? |
|---|---|---|
| **Collaboration narrative** | `src/lib/collaboration/narrative/assembleStory.ts:82` → `narrativeToBlocks:226-234` | **Generate.** Model returns `sections[].quotes[].text`; emitted as `{ type: 'pullQuote', text, speaker, role }`. |
| Collaboration render | `src/components/collaboration/CollaborationStoryView.tsx:240-247`, page `src/app/magazine/collaborations/[slug]/page.tsx:84` | Renders `"{block.text}"` with named attribution. Gated on `status === 'PUBLISHED'` only. |
| **Instagram — generate** | `src/lib/instagram-export/generate-quotes.ts:41` (`generatePullQuotes`), route `src/app/api/instagram-export/generate-quotes/route.ts:45` | **Generate.** Prompt: *"Generate exactly 5 headline options… provocative… tease a story."* Not a quote at all. |
| **Instagram — extract** | `src/lib/instagram/extractQuotes.ts:8` | **Mixed.** Reads real pull quotes, then falls through to `lead.deck` (`:33`) and **arbitrary 50–150 char sentences split out of generated chapter bodies** (`:37-51`). |
| Instagram — metadata variant | `src/lib/instagram/matchQuoteToImage.ts:25` | Same mining, same lack of check. |
| Instagram — render | `src/lib/instagram/generateCarouselSlides.ts:292` | Sets the string in serif italic over the photo. |
| **Transcript quote extraction** | `src/app/api/interviews/[id]/process/route.ts:210-303` → `QuoteHighlight` | **Generate-from-transcript, with an explicit polish allowance.** See §6. |
| Boost pull quote | `src/app/api/vendor/boosts/[opportunityId]/boost/route.ts:92`; suggested by `src/lib/interview/answerAnalysis.ts:219-241` | Suggestion is extracted; **the vendor may type anything over it** (`BoostReviewPanel.tsx:57,78`). |
| Supplemental quote breather | `src/lib/story/buildRoomTiles.ts:175-186` → `BreatherQuote.tsx` | **Extract.** `SupplementalQuote.answer` is human-typed at both write sites (`src/lib/intelligence/quotes.ts:39`, `src/lib/boost/inContextBoost.ts:435`). |

### Render surfaces that add quote marks

- `src/components/story/QuoteTile.tsx:173` — `&ldquo;{pullQuote}&rdquo;` (published `/p/[slug]`)
- `src/components/story/StoryIntro.tsx:95` — project-level quote
- `src/components/story/BreatherQuote.tsx` — supplemental quote interstitial
- `src/components/posting/preview/RichArticle.tsx:249` — preview
- `src/components/article/MotionPullQuote.tsx:21` — via `PostExpanded.tsx:257,306`
- `src/components/project/editorial/EditorialPullQuote.tsx:23` — no marks added
- `src/components/collaboration/CollaborationStoryView.tsx:246` — straight `"`
- `src/components/project/editorial/PullQuoteBlock.tsx:130` — straight `"` (dead, see below)

### Dead or unmounted (verified by import trace)

- `EditorialProjectLayout.tsx` — **no importers**. Everything it mounts is dark: `PullQuoteBlock`, and `layoutEngine.ts` (whose `usedPullQuoteTexts` de-dup at `:793` is therefore dead code).
- `DesignerInsights.tsx` — **no importers**. The other `QuoteHighlight` renderer.
- `getBoostsForProject` (`src/lib/editorial/getBoostsForProject.ts:22`) — **no callers**.
- `services/interview-orchestration/` — separate service, not imported by the Next app (only referenced in a comment at `src/lib/ai/thinking.ts:23`). Its `persona.ts:68` asks the model to return a `pullQuote` string with no code check.
- **Asset matrix paths (`docs/21`) — project kit, case study PDF, teaser film — are not implemented.** No source found. Only the Instagram export exists as a real asset path that reuses quotes.

---

## 2. Grounding enforcement vs. grounding instruction

**(a)** = the prompt tells the model to use verbatim words.
**(b)** = code verifies the emitted string appears in the contributor's stored answers.

| Path | (a) instructed | (b) verified | Notes |
|---|---|---|---|
| `selectPullQuotes` room quotes | ✅ `selectPullQuotes.ts:38` | ✅ **`isVerbatimSpan` at `:188` and `:194`** | The model cannot emit text at all — it returns IDs. Verification is belt-and-braces on top of a structural guarantee. Fails closed to the top code-ranked candidate, then to `null`. Emits `LLM_QUOTE_UNVERIFIED` incident. |
| `spliceHookQuote` | ✅ *"do NOT invent words"* `:508` | ✅ `:541` | Prompt permits eliding and splicing across two answers, which cannot pass a contiguous substring check — so the verify is what makes this safe, and it discards more than it keeps. |
| Intro-hook fallback | ✅ inherited | ✅ `:1000` | Mines generated prose; the check is the only thing standing between a paraphrase and the lead quote. Warns and drops on failure. |
| Backfill | ✅ (via `selectPullQuotes`) | ✅ (via `selectPullQuotes`) | |
| Picker PATCH | n/a | ⚠️ **membership only** | Checks `selectedText` ∈ `alternatives`. Verbatim only if `alternatives` was verbatim when written — not true after finding 2 or 3. |
| Override PUT | n/a | ✅ **refuses the field** | The strongest single line of enforcement in the codebase. |
| **Body direct quotes** | ✅ `generateEditorialDraft.ts:1268`, regenerate `:225` | ❌ **none** | Prompt says *"Direct quotes must be REAL phrases… Do not invent quotes."* Nothing checks. |
| **Admin re-extract** | ❌ | ❌ | Neither. |
| **Collaboration narrative** | ❌ — prompt says *"Weave quotes naturally… Find the emotional core"* (`assembleStory.ts:59,65`) | ❌ | **Neither.** The one path where the model literally authors the quote string is the one path with no instruction to be verbatim. |
| **Instagram `generatePullQuotes`** | ❌ | ❌ | Neither. It is a headline generator wearing the name `generatePullQuotes`. |
| **Instagram `extractQuotes`** | n/a | ❌ | Slices generated prose on `[.!?]` and length. |
| **`QuoteHighlight` extraction** | ⚠️ *"verbatim from transcript (**light cleanup ok for readability**)"* | ❌ | Instruction that concedes the point. |
| Boost | ❌ | ❌ | Free-text field, designer-attributed. |
| Headline verbatim spans | ✅ | ✅ `src/lib/posting/headlineSlots.ts:253` | Adjacent system; same `isVerbatimSpan`. Included because headlines carry quoted fragments. |

**Answer to the question docs/17 §5 raises:** yes, `selectPullQuotes` enforces verbatim
mechanically, and the enforcement is genuinely structural rather than prompted — the model
is *unable* to return a quote, not merely told not to. But §5 says the standard governs
"every generator that produces published prose (full article, section regeneration,
transitional/room-intro copy, collaboration narrative)." **Of those four, only the full
article has (b). The collaboration narrative — named explicitly in §5 — has neither (a)
nor (b).**

The guard that pins the canonical design in place, `scripts/check-pull-quotes.ts`, passes
(59 assertions, run 2026-09-03) but **appears in no workflow under `.github/workflows/`**.
It is a `package.json` script only. Nothing stops a future edit from reordering
`assignVerifiedPullQuotes` before the naming gate, or reintroducing a body-derived seed.

---

## 3. Storage and provenance

Pull quotes live in **more than one place**, in more than one shape.

| Store | Shape | Provenance recorded? |
|---|---|---|
| `ProjectPost.expandedBlocks.galleryChapters[].pullQuote` | `string \| PullQuoteSelection \| null` | **No** |
| `ProjectPost.expandedBlocks.pullQuotes[]` | derived index, `{ text, context?, sourceSection? }` | `sourceSection` = chapter title. That is a room label, not a pointer. |
| `ProjectPost.expandedBlocks.hookQuote` | `{ text, context? }` | **No** |
| `SupplementalQuote` (`schema.prisma:4464`) | `question` + `answer` + `userId` + `contributorRole` | **Partial** — the question text and speaker are stored; no FK to an answer row. |
| `QuoteHighlight` (`schema.prisma`) | `quoteText`, `startMs`, `endMs`, `interviewSessionId` | **Best in the codebase** — a transcript offset. But the offsets are *model-supplied* in the same JSON as the text, and nothing checks that `quoteText` matches the transcript in `[startMs, endMs]`. |
| `Boost.pullQuote` (`schema.prisma:3754`) | `String` | **No** |
| `Contribution.pullQuote`, `PromptedAnswer.pullQuoteExcerpt`, `StoryThread.contributingAnswers[].pullQuoteCandidate`, `EditorialDraft.pullQuotes`, `ProfileInterview.pullQuotes`, `OrgBioInterview.pullQuotes`, `TeamMemberQuiz.pullQuote` | assorted | **No** |

The canonical shape is:

```ts
// src/lib/posting/schemas.ts:23-35
PullQuoteAlternativeSchema = { text, context?, score }
PullQuoteSelectionSchema   = { selected: { text, context? } | null, alternatives: [...] }
```

There is no `questionId`, no `answerId`, no character offset, no interview id.

The information exists at selection time and is deliberately discarded.
`QuoteCandidate` (`quoteCandidates.ts:32-45`) carries `answerIndex` — "*Index into the
answers array this was cut from, for verification*" — but `toSelection`
(`selectPullQuotes.ts:95`) projects to `{ text }` and drops it. And `answerIndex` would not
survive anyway: it indexes an in-memory array built fresh each run by
`loadInterviewAnswers`, which merges two stores, resolves rooms, and de-dupes
(`loadInterviewAnswers.ts:130-166`). `LoadedAnswer` itself does not carry `questionId` —
the field is read to derive `category` and then dropped.

**This is the headline structural finding.** Given a published article, there is no way to
ask "which answer did this quote come from" without re-running the whole match. A
render-time verbatim check is impossible. An after-the-fact audit is only possible by
substring search over the whole answer set — which is exactly what
`scripts/audit-article-quotes.ts` has to do, and why it cannot distinguish "quote from
room A shown under room B" from "quote invented" without heuristics.

---

## 4. Normalization drift

### The reported symptom

Body prose renders em dashes and curly quotes; the pull quote on the same page renders
hyphens and straight quotes. This is not a bug in one transform — it is the two strings
having **different authors**:

- **Body prose** is written by the model under `JSON_PROSE_QUOTING_RULE`
  (`editorialTone.ts:109`), which mandates curly quotes, and models default to em dashes.
- **Pull quote text** is `source.slice(from, to).trim()` from
  `quoteCandidates.ts:104` — the designer's raw typed answer. Answers are stored untouched
  (`respond/route.ts:255`, `realtime/convert/route.ts:79`; no typographic transform at any
  write site).

So the same sentence, said once, ships twice in two typographic registers. Nothing is
wrong with either string; there is simply no normalization applied at either write or
render.

### Every transform that touches quote strings

| Transform | file:line | What it changes | Applied to pull quotes? |
|---|---|---|---|
| `toTypographicQuotes` | `editorialTone.ts:148` | `"` → `“`/`”` | **Prompt inputs only** (answers, frozen chapters, feedback), plus the deck output at `deck/regenerate/route.ts:171`. Never applied to a stored pull quote. |
| `JSON_PROSE_QUOTING_RULE` | `editorialTone.ts:109` | instructs curly in model output | Body prose only. |
| `normalizeForVerbatimCheck` | `quoteCandidates.ts:146` | `‘’`→`'`, `“”`→`"`, `–—`→`-`, whitespace collapse, lowercase | **Comparison only.** Never persisted, never rendered. |
| `scrubPullQuote` / `scrubProseNaming` | `naming/scrubProse.ts:176, 203-215` | replaces product/vendor names with descriptors, **inside `selected.text` and every `alternatives[].text`** | **Yes — and persisted. See below.** |
| `fixSentenceOpeners` | `generateEditorialDraft.ts:1397` | Haiku rewrites whole flagged paragraphs | Body only — but the paragraph handed to Haiku **contains in-body direct quotes**, and nothing re-checks the quoted spans afterward. |
| `proofOutsideQuotes` | `generateEditorialDraft.ts:592` | capitalizes sentence starts, **explicitly skipping quoted spans** | Body only. Correctly quote-preserving. |
| `spliceHookQuote` post-processing | `generateEditorialDraft.ts:532` | strips a leading/trailing `"`/`“`/`”`, trims | Hook quote. |
| Render wrappers | `QuoteTile.tsx:173`, `StoryIntro.tsx:95`, `RichArticle.tsx:249`, `MotionPullQuote.tsx:21` | adds `&ldquo;…&rdquo;` around the stored text | Yes — additive only. |
| Instagram `formatQuoteText` + `escapeSvgText` | `generateCarouselSlides.ts:244,294` | line-wrapping, XML escaping | Export only. |

### The transform that actually breaks verbatim

`applyProseNamingGate` scrubs pull quote text (`scrubProse.ts:176`). In the **generator** it
runs *before* `assignVerifiedPullQuotes` (`generateEditorialDraft.ts:1888` then `:1902`), so
freshly assigned quotes never see it — and `check-pull-quotes.ts:91` pins that ordering.

But **section regenerate calls the gate on the whole blocks object and persists the
result**:

```
regenerate/route.ts:356  const gatedBlocks = await applyProseNamingGate(blocks as any, {...})
regenerate/route.ts:374  data: { expandedBlocks: gatedBlocks as any, ... }
```

The comment at `:342` says "*re-running it on untouched chapters is a no-op*". That is true
of eligible names and false of ineligible ones. If a verified pull quote contains a product
or vendor name whose vendor is not subscribed, regenerating **any** section rewrites that
quote — in `selected.text` and in every alternative — and writes it back. The designer sees
their quote change on a page they did not touch, and the string is no longer verbatim to
anything they said.

The two specs collide here: `docs/17 §5` says a quote is never altered; `docs/20` says an
ineligible product name never reaches published prose. The generator resolves the collision
by ordering (quotes are exempt); the regenerate route resolves it the other way (quotes are
scrubbed), silently.

### What a mechanical check would need

`normalizeForVerbatimCheck` is already the right comparison form and is already the one the
pipeline and the audit script share. It forgives exactly what typesetting legitimately
changes — whitespace runs, quote and dash glyphs, letter case (a trimmed quote is
re-capitalized at its new start) — and forgives nothing else. A swapped word still fails,
which is the property that matters: the `"elements on tension"` → `"elements in tension"`
regression that motivated the whole design is caught by it
(`scripts/check-pull-quotes.ts:44,46`).

**Safe comparison form: `normalizeForVerbatimCheck(quote)` as a substring of
`normalizeForVerbatimCheck(answer)`, per answer, never joined.** Joining answers before
comparing would let a quote straddle two answers and pass.

Two limits worth stating. It cannot catch a *correct-but-misattributed* quote — a verbatim
line from the Kitchen answer shown under Primary Bath passes, which is why
`selectPullQuotes` scopes `sources` to one room (`selectPullQuotes.ts:173`) rather than
relying on the normalizer. And it is a substring test, so a quote that is a verbatim slice
of a *generated* body paragraph passes against that paragraph — which is why the comparison
target must always be the stored answers and never the article.

---

## 5. Duplication against body

**There is no de-duplication between a chapter's pull quote and the body of that same
chapter.** Nothing prevents it, and the structure makes collision likely rather than rare.

The prompt requires every gallery chapter to contain "*at least 1 direct attributed quote
drawn from that room's interview answers*" (`generateEditorialDraft.ts:1260`). The pull
quote is then chosen from the *same room's answers*, ranked for being a standalone display
line — the same property that makes the model pick a sentence for its in-body quote. Both
selections draw from the same small pool with the same taste, and neither knows about the
other.

`QuoteTile.tsx` makes it visible: expanding a tile replaces the pull quote in place with the
room's full narrative. Its header comment says "*the quote came from the narrative anyway,
so nothing is lost*" — which was true of the old body-mining extractor and is **no longer
true**. The quote now comes from the answers and the narrative is written separately, so on
expand a reader can see the same sentence twice, once in the designer's typography and once
in the model's.

De-duplication that does exist, and what it covers:

| Mechanism | file:line | Scope | Status |
|---|---|---|---|
| `buildShufflePool` near-duplicate filter | `selectPullQuotes.ts:78-94` | within one room's alternatives | live |
| `seen` set in `extractQuoteCandidates` | `quoteCandidates.ts:106` | identical candidate text | live |
| hook-quote skip in `syncPullQuotesFromChapters` | `schemas.ts:345` | hook vs. chapter quote | live |
| `usedQuotes` in `placeBreathers` | `buildRoomTiles.ts:164-213` | breather vs. room tile quote | live |
| `usedPullQuoteTexts` in `layoutEngine` | `layoutEngine.ts:793,914` | quote vs. quote across blocks | **dead** (`EditorialProjectLayout` unmounted) |
| quote vs. **body prose** | — | — | **does not exist anywhere** |

**Where it would belong:** `assignVerifiedPullQuotes`
(`generateEditorialDraft.ts:1494`), which is the one place that holds both the chapter's
final body and the ranked candidate list at the same moment. Rejecting a candidate whose
normalized form already appears in `ch.body` and falling to the next candidate is the same
fail-closed shape the function already uses. Applying it at render instead would be wrong:
the renderer has no candidate list to fall back to, so it could only blank the quote.

---

## 6. The "slightly polished" allowance

`docs/17 §5` records that the `generate-draft` path carrying the allowance was deleted as
dead code. **That specific path is gone — confirmed, no `generate-draft` route or
"slightly polished" string exists. But the concept is alive in three live places.**

**1. Live and explicit —** `src/app/api/interviews/[id]/process/route.ts:227`:

> `- Quotes should be verbatim from transcript (light cleanup ok for readability)`

This is the same allowance in different words. The output is stored as
`QuoteHighlight.quoteText` with no verification against `fullTranscript` or against the
segment at `[startMs, endMs]` — even though both are in scope in the same function. The
producer is reachable from live UI (`InterviewStatusView.tsx:17`), and the designer approval
flow is live (`/designer/interviews/[id]/approve`). Only the render surfaces are dark:
`PullQuoteBlock` and `DesignerInsights` are each one import away from being live, and both
render the string in quote marks — `PullQuoteBlock` alongside a "Listen" button and audio
scrub, which makes a polished quote look *more* authoritative than an unpolished one.

**2. Live and permissive —** `src/lib/posting/generateEditorialDraft.ts:1268`:

> `Do not clean up the language so much that it loses the person's voice.`

Read literally, this licenses cleanup up to that threshold. It governs in-body direct
quotes, which render in quote marks with named attribution and have no (b) check.
The identical line appears at `regenerate/route.ts:225`.

**3. Live but verified —** `spliceHookQuote` (`generateEditorialDraft.ts:508`) permits
trim, elide, and splice-across-answers. The verify at `:541` is what makes it safe; a
spliced-across-two-answers result cannot be a contiguous substring and is discarded.

**Clean —** `src/app/api/interview/respond/route.ts:177` states the rule correctly ("*use
their exact words… do not polish or paraphrase into a quote*"), as does
`headline/regenerate/route.ts:468` ("*Do not shorten, extend, tidy or re-punctuate*") and
`selectPullQuotes.ts:38` ("*You do not write, rewrite, trim, tidy, punctuate, or combine
anything*").

The grep covered: `polish`, `tighten`, `condense`, `paraphras*`, `light cleanup`,
`clean up`, `smooth out`, `tidy`, `rephras*`, `reword`, `lightly edit`, `trim.*quote`
across `src/` and `services/`.

---

## 7. Empirical check — NOT RUN

**This is the finding that would have mattered most, and it could not be produced.**

No database credentials are reachable from this environment. `DATABASE_URL` is unset
(`'DATABASE_URL' in process.env === false`), there is no `.env` or `.env.local` — only
`.env.example` — and no Supabase variables are present. Three published or preview articles
cannot be read, so no hit rate and no miss list.

The check is not blocked on tooling. **`scripts/audit-article-quotes.ts` already implements
exactly what §7 asks for**, per-surface, using the same `normalizeForVerbatimCheck` this
report recommends, with a word-level diff against the closest stored answer for every miss.
It distinguishes the two guarantees correctly in its own header — pull quotes should be
verbatim by construction so a miss is a pipeline bug, while in-body quotes are model-written
so a miss is expected to be possible.

Run it against three projects in an environment with `DATABASE_URL`:

```
npx tsx scripts/audit-article-quotes.ts <projectId> [--json]
# or: npm run audit:quotes -- <projectId>
```

Surfaces it covers: `hookQuote`, `chapter.pullQuote`, `chapter.pullQuote.alternative`,
`pullQuotes[]`, `sections[].quote`, `body`.

Two gaps to be aware of when reading its output. It reads `ProjectPost.expandedBlocks` only,
so it does not see `QuoteHighlight`, `SupplementalQuote`, `Boost.pullQuote`, or the
collaboration `finalContent` blocks — findings 1, 6 and 7 above are outside its reach.
And a miss it reports on a `chapter.pullQuote` is, given §4, at least as likely to be
naming-gate scrub damage from a section regenerate as it is a selection bug; the diff will
show a product name replaced by a descriptor when that is what happened.

Until it runs, the honest statement of the claim is: **the canonical path's guarantee is
sound by construction and by test, but no published article has been checked against it.**

---

## Appendix — verification performed

- Import-trace confirmed for every "dead"/"unmounted" call above (`EditorialProjectLayout`,
  `PullQuoteBlock`, `DesignerInsights`, `layoutEngine`, `getBoostsForProject`,
  `services/interview-orchestration`).
- `npx tsx scripts/check-pull-quotes.ts` — all 59 assertions pass on this tree.
- `.github/workflows/` enumerated: `design-system-discipline`, `lint`,
  `migration-discipline`, `product-record-invariants`. **None invokes a quote check.**
- `npx tsx scripts/audit-article-quotes.ts` — reachable and runnable; exits on usage with no
  `projectId`. Not run against data (no credentials).
- `docs/21` asset paths (project kit, case study PDF, teaser film) searched for and not
  found in `src/`.
