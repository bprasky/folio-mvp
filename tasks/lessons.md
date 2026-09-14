# Lessons Learned

Rules for Claude (and future contributors) to avoid repeating past mistakes.
Review at session start. Append — do not overwrite — new lessons.

---

## 2026-04-13 — Verify Path A vs Path B before adding feature flag gates

**Mistake:** When auditing the designer golden path, I identified two parallel publish paths:
- **Path A (Posting V1):** `/api/posting/project/[id]/status` + `/init` → used by the designer preview page
- **Path B (legacy editorial):** `/api/projects/[id]/approvals/publish-editorial` → calls `publishEditorial()` in `src/app/actions/projects.ts`

I correctly gated Path A on `NEXT_PUBLIC_POSTING_V1`, keeping Path B as the flag-off
canonical publisher per user direction. But I then **also** added a POSTING_V1 gate
to `createEditorialDraft()` in the same `actions/projects.ts` file, without checking
that it too is part of Path B. It is — called via
`/api/projects/[id]/approvals/draft-editorial` from `OverviewTab.tsx:143` and
`PublishWorkflow.tsx:77`. The errant gate would have broken the non-V1 draft flow
in production. I caught it one commit later and reverted.

**Rule:** Before adding a feature flag guard to any function in a shared module,
grep for ALL callers of that function and classify each call site as Path A or
Path B (or uncategorized). If any caller is on the path you're preserving, do
NOT add the gate.

**Specific check:**

```
# For any function you're about to gate:
grep -rn "functionName(" src/
# Then for each caller, trace up to the UI/route and ask:
# "Is this reachable with NEXT_PUBLIC_POSTING_V1=false?"
# If yes — do not gate.
```

**Related:** `src/app/actions/projects.ts` now has an explicit doc comment on
`createEditorialDraft()` explaining it's Path B and intentionally ungated. Don't
remove that comment.

**Second related mistake (same audit):** I also gated the entire
`PATCH /api/posting/project/[id]/status` endpoint, without noticing that
`usePublishFlow.unpublish()` at `src/hooks/usePublishFlow.ts:278` uses the
same endpoint with `{action: "unpublish"}` as the Path B unpublisher. Gating
the whole endpoint broke legacy unpublish when the flag was off.

**Fix pattern:** Gate the transition, not the endpoint. The status route
now parses the body first, computes `targetStatus`, and only enforces the
`POSTING_V1_ENABLED` check when `targetStatus === "PUBLISHED"`. Unpublish
and archive transitions remain reachable regardless of flag state.

**Lesson:** When an endpoint supports multiple actions (publish, unpublish,
archive), a flag check on the whole endpoint is almost always too coarse.
Determine the intended action first, then apply the flag gate only to the
specific action(s) that belong to the flagged feature.

---

## 2026-04-13 — Public vs draft query asymmetry

**Mistake avoided (from the tagging audit):** `getPostBySlug` (public post
fetch) and `getPostForStaging` (designer draft fetch) started out with
identical tag queries and no filter on `Product.isPending`. Pending products
are designer- or import-created stubs awaiting vendor claim; they often lack
a vendor, price, or canonical name. Filtering them out unconditionally in
staging would have broken the designer's ability to see and resolve their
own pending tags. Filtering them out on the public post is correct — a
public viewer should never see a half-finished tag.

**Rule:** Public-facing data fetchers and draft/preview fetchers often share
a base query shape but should NOT always share filters. When adding a
visibility filter, classify the call site:

- **Public / unauthenticated / shared links** → apply the filter.
- **Author / draft / editor context** → typically skip the filter so the
  author can still see and resolve incomplete data.

If you find yourself copy-pasting a query between `getPost*` functions,
ask which audience each one serves before propagating the filter.

**Files that demonstrate the pattern:**
- Public: `src/lib/post/getPostBySlug.ts` — filters `product.isPending: false`
- Draft:  `src/lib/post/getPostForStaging.ts` — intentionally unfiltered

---

## 2026-04-13 — Use the folio-* sub-agents before doing domain work

**Context:** Added seven project-level Claude Code sub-agents under `.claude/agents/`. Each one encodes Folio-specific rules and cites real files so Claude doesn't re-derive context every session.

**Rule:** Before doing domain work, invoke the matching specialist. Claude Code should auto-delegate, but when in doubt, name the agent explicitly.

| Task | Agent |
|------|-------|
| Prisma schema / migration / query | `folio-prisma-guardian` |
| Prompt for Sofia, editorial, classification, bios | `folio-prompt-smith` |
| Adding or modifying a feature flag gate | `folio-flag-auditor` |
| Reviewing a diff before commit | `folio-code-reviewer` |
| Diagnosing a bug or failing script | `folio-debugger` |
| Bootstrapping or adding tests | `folio-test-scaffolder` |
| Route handlers, server actions, RSC/client boundary, auth | `folio-next-supabase-specialist` |

**Why this is a lesson, not just a note:** Cold-starting domain work without invoking the specialist has already produced both captured lessons above (Path A/B gating, public/draft asymmetry). The agents exist specifically to prevent those classes of mistake from recurring. If you find yourself writing a flag gate or a Prisma query without the agent on, stop and invoke it.

**See:** `.claude/agents/README.md` for the full set and the rule for adding new agents.

---

## 2026-04-23 — Don't use font weights the brand fonts aren't loaded at

**Mistake:** Instagram campaign wizard rendered its "4 posts" badge and several
other titles with `font-bold` (CSS weight 700). `src/app/layout.tsx` only
loads `Instrument_Sans` and `Cormorant_Garamond` at weights `['400', '500',
'600']`, so browsers synthesized a fallback from the next typeface in each
stack (system sans). The user caught the off-brand rendering visually.

**Rule:** Before using a Tailwind font-weight utility, check `layout.tsx` for
the weights actually loaded by `next/font`. Don't use `font-bold` (700),
`font-extrabold` (800), or `font-black` (900) unless you also add those
weights to the `weight: [...]` array in `layout.tsx`. When in doubt, reach
for `font-semibold` (600) — it's loaded for both brand faces today.

**Specific check:**

```
grep -n "weight:" src/app/layout.tsx
# Current state (2026-04-23): 400, 500, 600 only.
# Any class in {font-bold, font-extrabold, font-black} renders as fallback.
```

**Related:** The brand CSS layer in `src/app/globals.css:647` auto-applies
`var(--font-headline)` (Cormorant) to bare `<h1>–<h4>` and
`var(--font-body)` (Instrument Sans) to `p, li, small, button, input,
textarea, label`. Lean on those rather than setting font-family inline; when
you must, use the `.folio-h*`, `.folio-body`, `.folio-ui`, `.folio-meta`,
`.folio-stat` helper classes in the same file.

**Full-codebase scope at time of lesson:** `grep -r font-bold src` returned
~205 hits — sweep them in a dedicated pass, not piecemeal.


---

## 2026-05-01 — accent consolidation: rename, do not redefine

When introducing a token that supersedes another with the same name, give it a
new name. `--folio-gold` was previously `#C9A96E` (ornamental); reusing the
same variable name for the new functional value (`#B8845C`) would silently
shift the rendered color of every existing `var(--folio-gold)` reference.
Resolved by renaming the ornamental value to `--folio-gold-ornament` so the
rename is explicit and grep-able.

**Codemod gotcha:** A bulk `s/#C9A96E/var(--folio-gold-ornament)/g` will
rewrite the *definition itself* (`--folio-gold-ornament: #C9A96E;` →
`--folio-gold-ornament: var(--folio-gold-ornament);`), creating an infinite
self-reference. Always grep for the new var name after a hex codemod and
restore the literal in the canonical definition.

**Why CI guards matter:** the burgundy `#7C1E3D` had been "removed" multiple
times during pre-launch design iterations and kept reappearing through
copy-paste. The `design-system-discipline.yml` workflow now scans `src/` and
`tailwind.config.js` on every PR. Email templates and the pdfkit spec-sheet
renderer are explicit exemptions because CSS variables don't resolve in
mail clients or PDF generators.


---

## 2026-05-01 — canvas consolidation: deprecated aliases die with their introducer

`--bg-base` was kept as an alias for `--surface-canvas` "for migration safety,"
but six months later 50 callsites still leaned on the alias instead of the
canonical token. The alias gives no signal that migration is incomplete —
new code copy-pastes the alias because it works.

**Better pattern:** when introducing a successor token, scan the codebase and
migrate every callsite in the same PR, then delete the alias. The alias buys
nothing if it survives the PR that introduced it.

**Codemod nuance:** when migrating hex literals to CSS vars, audit the
non-DOM rendering paths — pdfkit (PDF generation), `qrcode` (QR codes), and
HTML email templates can't resolve `var()`. Add them to the CI guard's
exemption list explicitly with a comment explaining why; otherwise a future
contributor will "fix" them and break PDF / QR / email rendering.


---

## 2026-05-01 — typography: phantom aliases hide behind fallback chains

`var(--font-cormorant, 'Cormorant Garamond', serif)` rendered correctly in
the browser and read fine in code review, but `--font-cormorant` was never
defined anywhere — the literal fallback was doing all the work. CSS variable
typos fail silently when fallbacks exist.

**Rule:** every `var(--token-*)` reference's token name must match a
declaration in `globals.css`. The CI guard for Task 03 forbids
`var(--font-cormorant)`, `var(--font-instrument)`, and `var(--font-logo)` by
name. When introducing a new CSS variable, remember to grep the codebase for
any existing typo of the name; rename your declaration to match callers, not
the other way round, if the typo is widespread.

**Inline declarations that restate inherited defaults are pure noise.**
`<body>` already sets `font-[var(--font-body)]`. The 80+ inline
`style={{ fontFamily: 'var(--font-body)' }}` declarations existed because
authors defensively re-asserted the body font — they didn't change anything,
they just obscured which elements actually wanted a font *switch* (the
`var(--font-headline)` ones). 87 callsites collapsed to 4 (FolioBadgeModal
QR-export carve-out) by deleting redundant declarations.

**Codemod nuance:** a regex that matches `style={{ ... }}` on a single line
won't catch the multiline JSX form
```jsx
<p
  className="..."
  style={{ fontFamily: "var(--font-body)" }}
>
```
because the prop is its own line. Audit the post-codemod grep count and
clean up the long-tail manually. (For Task 03 this was 4 callsites in
MagazineFeedClient and project/interaction.)


---

## 2026-05-01 — type scale: off-scale near-duplicates accumulate silently

The audit before Task 04 found 224 inline `fontSize` literals, 109
`fontWeight`, 43 `lineHeight`, 61 `letterSpacing`, plus 394 `text-[Npx]`,
21 `leading-[N]`, 57 `tracking-[N]`, and 109 `font-[N]` Tailwind arbitrary
class hits. Many were near-duplicates of canonical sizes — `30px`, `34px`,
`38px`, `42px`, `44px`, `17px`, `12px` — that designers eyeballed in dev
tools without checking the token list.

**A snap-to-nearest map with explicit FLAG buckets is the right migration
shape.** The codemod converts confident matches (15→body, 28→h3 etc.) and
leaves outliers in place for human triage. For Task 04 about 90% of inline
literals (~397/441) snapped cleanly; 49 outliers (9px badges, 8px IG-export
labels, 72px OG image, 1.7-line-height taglines) got
`/* folio-design-system: off-scale */` markers and the CI guard skips
those lines.

**`FLAG` is a feature, not a hedge.** A migration script that "tries its
best" and silently maps everything is worse than one that explicitly
refuses on uncertainty. The flag count (49) was small enough to triage
individually; the alternative — a bigger snap radius — would have
silently shifted real design intent (a deliberate 9px vendor badge becoming
an 11px eyebrow ruins layout density).

**CSS utility classes ARE the API for type.** The existing `.folio-h1`
through `.folio-stat` classes already existed in `globals.css` but were
hard-coded with literal hex values. Refactoring them to use the new
`--type-*` / `--lh-*` / `--w-*` tokens means every `<element class="folio-h2">`
in the codebase now traces back to one canonical declaration. Designers
can rename what `h2` means in one place and the whole product follows.

**POSIX-extended regex is what `git grep -E` accepts.** `(?!...)` negative
lookahead and `\d`/`\w` shortcuts don't work in `git grep -E`. Use
character classes (`[^a-z0-9]`) and explicit alternations. Tested locally
before pushing CI rules so the workflow doesn't fail on the first PR.


---

## 2026-05-01 — homepage editorial elevation feed (Task 05)

**Don't put commerce inside the photograph.** Spec's first prototype put the
boost reel as an opaque strip across the bottom of the editorial XL — made the
photo unreadable, and on a portfolio platform the photo *is* the product.
Pulling the reel out into a tethered row 16px below the hero solved the
optical problem and made the boost mechanic *more* visible, not less.
Proximity tethers; chrome doesn't.

**The seam matters more than the sections.** The boost reel is the seam where
editorial-curation meets algorithmic-feed AND it's Folio's monetization. Three
jobs, one component. Don't introduce a "Sponsored products" section header —
the per-product Boosted badge is enough disclosure. A header announces the
seam and breaks reading flow.

**Don't extend a uniqueness-constrained model for a different business
object.** `InContextBoost.productTagId @unique` encodes "one boost per tag" —
a contract worth preserving. Adding a homepage-reel placement to that model
would have forced dropping the constraint and entangling two billing flows.
Sibling model (`HomepageReelBoost`) keyed on `(projectPostId, productId,
vendorId)` keeps lifecycles orthogonal — auction semantics on one side,
tag-negotiation on the other.

**Editorial-window data beats algorithmic-feature data for hero slots.** "Top
engagement post" is mathematically right and editorially wrong — it surfaces
what was already popular last week, not what should be popular this week. The
scheduled `homepage_xl_starts_at` / `homepage_xl_ends_at` window gives
editorial leverage; algorithmic fallback (highest-engagement in last 14 days)
is real but should rarely fire.

**Auth-state branching belongs server-side.** `useSession()` ternaries flicker
visibly above the editorial hero on slow connections. Read session in the
server component (`HomepagePage` calls `await auth()`), pass `isOut` as a
prop, branch in the markup. One render, no flicker. The InviteRibbon's
localStorage 24h-dismissal can't be checked server-side, so it renders with
`visibility: hidden` and reveals on mount — same effect, different mechanism.

**Audit-driven plans correct silent assumptions.** The spec assumed a
`MagazinePost` model existed and that `product_boosts` was the table. Neither
was true — posts are `ProjectPost` (variant `PROJECT_FEATURE`), and the boost
landscape is two unrelated models (`Boost` for vendor testimonials, `InContextBoost`
for designer tag negotiations). The exploration phase caught both before any
schema migration was authored. Always grep for the model name before trusting
a spec's "this already exists" framing.

**Routing consolidation has a cost.** User chose `/magazine → /` redirect.
That deletes the surface where `GatheringVoicesSection` and
`PromptedQuestionsSection` lived. Mitigation: preserved the legacy MagazinePage
shell at `/magazine/community` so the sections stay reachable for direct
linking. The redirect handles email/newsletter deeplinks. Existing `/magazine`
intra-site links flow through the redirect — accept the one extra hop in
exchange for a cleaner mental model.

**Static review can't catch flex height collapse from absolute children.**
Phase 2a's WelcomeModal had `max-h-[92vh] flex flex-col` on the panel and
`relative flex-1 overflow-hidden` wrapping `absolute inset-0` content for
the cross-fade. The flex-1 child collapsed to 0 because absolute children
have no intrinsic height and the parent only had max-h, not h. The modal
opened in production with an empty body — header + footer only. Type-check
and SSR passed. I called PASS* on "Modal opens on page load" based on
reading the component code; a real browser would have shown it immediately.
Rule: when reviewing a flex container with `max-h-*` (not `h-*`) and a
`flex-1` child whose content is `absolute inset-0`, flag it as a height
collapse risk and require a browser run before reporting PASS. AnimatePresence
`mode="wait"` + in-flow children avoids the trap entirely.

**Heuristic JSON "repair" silently ships corrupted prose — prefer a recoverable hard-fail.**
Editorial generation was 502'ing when the LLM emitted invalid JSON (unescaped
`"` inside body strings, e.g. `It"s`, `doesn"T`). PR #709 added a `jsonrepair`
fallback so the draft would "survive" instead of failing. That was strictly
worse: jsonrepair guesses string boundaries and, on unescaped quotes, re-brackets
the wrong spans — merging adjacent chapters and splicing raw JSON structure
(`], }, { "title": ... "body": [`) into a body paragraph as literal text. The
mangled draft then shipped to the designer, desynced the positional room→body
mapping, and poisoned the regex pull-quote extractor (stray quotes → fabricated
"quotes"). User: "I would much rather hard fail than output this to users."
Rule: never auto-repair model JSON destined for user-facing content. Hard-fail
with a *diagnostic* error (parse position + a window of the raw text around it)
so the malformed span is actionable from logs, and let the user regenerate. A
recoverable 502 beats a silently corrupted publish.

**`ProjectImage.room` is a denormalized free-text trap — resolve room FK-first, never guess by position.**
The editorial generator grouped gallery chapters by `ProjectImage.room` (a
free-text string), which is separate from the real `roomId` FK and is written in
three shapes by different pipelines (type "bathroom", label "Bathroom", or a Room
UUID) and goes stale after renames. Worse, the reconciliation in
`interview/generate/route.ts` had a fallback that paired leftover image-rooms to
leftover Room names *by array index* — no semantic basis — which could file a
bathroom photo under a "Stairway" heading. Fix: `src/lib/posting/resolveImageRoom.ts`
resolves FK-first (roomId → Room.name), then string match by name/UUID, then keeps
the raw value; the by-elimination guess is gone. Both generation paths
(interview/generate + getOrCreateEditorialDraft) share the one resolver so they
can't drift. Rule: when a denormalized label exists alongside its FK, trust the
FK; and never "repair" unknown data by positional pairing — an ungrouped item is
a lesser evil than a confidently-wrong one.

**Org-owned projects must attribute to the org, but generation only read `project.designer`.**
`Project.designerOrgId` is populated when a poster operates as an org, but the
editorial generator fetched only the individual `designer`, so every byline,
credit, and voice was the person (e.g. "Diano Matto"), never the firm ("BP
Design"). Fix (product decision: org credit, person's voice): pass `org` into
GenInput; `buildCredits` and the prompt's credit example use the org name; the
prompt keeps the person as the quoted voice and introduces them once as
"{person} of {org}". Note: `ProjectPost.credits` is user-editable and sticky
(auto-filled only when empty) and the preview byline renders from it — so
existing posts keep their old credit until re-derived; the generation fix governs
new drafts and the article's own credits/voice.

**Two independent readings of the same nullable column = a step that links to a surface the page refuses to render.**
The Story step and `?view=media&step=tags` both rendered the tagging screen.
`Project.timeline` is nullable (`ProjectTimeline?`, legacy projects predate the
wizard) and the page read it twice with *different* defaults: the tracker type
(`timeline === 'PRESENT' ? … : 'completed'`) treated null as **completed**, so the
stepper showed Tags/Story/Publish and the Story step linked to `?view=story`; but
the flow gate (`inPublishingFlow = timeline === 'PAST' || hasDraftOrPublished`)
treated null as **not** the publishing flow, so `storyTabVisible` was false and the
page silently coerced `story → media`, where the tracker frontier (still Tags) then
tripped `startInTagging`. Both URLs resolved to the same screen — no error, no
redirect visible, just a dead step. Fix: one exported classifier
(`trackerTypeForTimeline`) that every consumer goes through, with
`inPublishingFlow = trackerType === 'completed' || hasDraftOrPublished` derived
*from the type* rather than re-testing the column.
Rules: (1) a nullable enum gets exactly ONE default, in one exported function —
never re-test the raw column at a second site; (2) if a tracker/stepper can render
a step, the surface that step links to must be reachable by construction, not by a
parallel boolean that happens to agree; (3) a silent `currentView = 'media'`
fallback hides this class of bug — when a coercion fires on a link the app itself
renders, that's the bug, not the recovery.

**A field that can only be recovered by lookup will eventually be unrecoverable — store it with the record.**
Saved interview answers all listed as "Untitled question" on the Story tab. Two
independent reasons, same root shape: (1) `persistAnswers` resolved the prompt via
`allQuestions.find(q => q.id === item.questionId)`, and `allQuestions` is the FLAT
contextual list — in a room-paced interview the questions asked come from the
grouped endpoint via `roomFlow`, so every room answer saved with `prompt: ''`
(and `sanitizeAnswerForSend` stripped the prompt the submit handler HAD already
resolved); (2) the read-time backfill from `provenance.interview.questionSet`
couldn't recover it, because the rooms-phase question signature folds in per-room
tag CONTENT — tagging one product mints fresh question UUIDs and orphans every
saved id. Rules: (a) when a UI needs a value, persist it on the row at write time;
never rely on re-deriving it from a set that regenerates; (b) if a save path
resolves a field from a lookup table, prove the table covers every source the
value can come from — two question sources meant one code path silently covered
half the answers; (c) a sanitizer that drops a field the caller just computed is a
silent data loss, not hygiene.

**"Edit one saved answer" is not a mode of a modal that owns a whole flow.**
`EditReflectionModal`'s own docstring said it was the only reliable single-answer
editor, because the interview modal regenerates its question set on open. A later
`jumpToQuestionId` prop reopened the full InterviewModal pinned to a question
anyway: it tripped the rooms-generation phase ("Preparing questions for each
room…"), and when the saved id wasn't in the regenerated set it fell back to
`setResumeRequested(true)` → `resumePlan.allDone` → `autoGenerate` + `phase:
'complete'`. Clicking an answer to fix a typo restarted the interview and showed
the generation screen. Rule: when a component's mount owns side effects (fetching,
LLM calls, flow advancement), don't add a prop that borrows it for a narrower job
— and when an existing comment explains why a shortcut doesn't work, treat it as a
constraint, not a stale note.

**Merging records by a key that includes mutable content appends instead of replacing.**
The interview POST merged answers with `makeAnswerKey`, which folds the answer
text into the key. Right for deduplicating one payload; wrong across saves —
rewriting an answer changed its key, so the edit landed as a NEW entry and the old
wording stayed. Same file also rebuilt `payload.followups` from the request alone,
so any partial save (one answer, or an edit) wiped every saved follow-up. Rule: a
merge key is the record's IDENTITY (questionId + isFollowUp), never its value; and
a partial write must read back every array it rewrites.

**One progress variable can't answer two different questions.**
`frontierIndex` (first incomplete step) drove the tracker's marker states, track
fill AND navigation gate — but the Story step is deliberately exempt from the
gate, so the stepper showed an active Story step with an unreached hollow Tags
bubble behind it. Split into `frontierIndex` (what to do next → the next-action
zone) and `reachedIndex` (how far the project got → markers, fill, navigation),
with the open count surfaced as "4 left" under a checked step so nothing is
hidden. Rule: when a derived index feeds both "what's next" and "what's done",
and any step can be reached out of order, those are two values.

**An undeclared field is a deleted field — check what the schema strips before trusting a column.**
`editorial_interview_answers` has had columns for `linked_image_id`,
`linked_product_id`, `ai_classification_attribute` and `parent_answer_id` since it
was created, and every row ever written has them NULL. The interview collected all
of it, but it rode into the API in an undeclared `metadata` bag, and
`normalizeAnswers` (a Zod object with no `.passthrough()` — deliberately) drops
unknown keys. The route's own comment even said "metadata is still stripped" —
nobody connected that to the projection two hundred lines below, which read
`answer.metadata.linkedImageId` and therefore always wrote null. Proven by
replaying `normalizeAnswers` against main: four fields in, four `undefined` out.
Rules: (a) a strict schema in the middle of a pipeline is a delete statement for
anything not declared — when adding a field to a write path, follow it through
every parse/normalize boundary and assert it at the end, not at the start;
(b) a nullable column that is null in 100% of rows is a bug report, not a data
shape — check it before designing anything on top of it; (c) "preserved for the
fallback path" in a comment means the primary path drops it.

**Two writers for one table means the thinner one decides.**
`EditorialInterviewAnswer` was rebuilt by the interview POST (rich: question text,
room, cross-room flag) and by `syncAnswersToEditorialInterview` (thin: neither) —
both wipe-and-recreate, both live, called from different routes. Whichever ran
last set how much of the record survived, so the data degraded depending on which
surface the designer touched. Fixed by extracting one `rebuildAnswerProjection`
both call. Rule: when a table is a projection, exactly one function may write its
row shape; every other caller supplies the source rows and delegates. If you find
a second writer, the question isn't "should I update it too" — it's "why are there
two".

**Destructive intent must be sent, never inferred.**
"Clear this interview" was expressed as an empty `answers: []` array — which is
also exactly what a room-status-only save looks like when the designer skips a
room before answering anything. One of those reaching a project with saved
answers would have wiped every one of them, and interview answers are the one
thing in this product that cannot be regenerated. Now the caller must send
`clearAll: true`; an empty payload without it preserves what's stored. Rule: when
the same request shape can mean "save nothing" or "delete everything", the
ambiguity resolves toward keeping data, and the destructive reading requires an
explicit flag from the caller.

**A wipe-and-rebuild resets every timestamp it touches.**
The projection recreated all rows on every save, so `created_at` became "the last
time anything was saved" — identical across a whole interview, destroying the
order the designer actually worked in, which is exactly the axis a
cause-and-effect analysis needs. Rule: if you replace rows rather than update
them, carry the original creation time forward explicitly; the default is
silently wrong and nothing will fail to alert you.

**A prompt that mandates quoted prose must also remove the escaping burden — curly quotes, not "remember to escape".**
Editorial generation 502'd on `LLM_JSON_PARSE` after a clean 2-minute run
(`end_turn`, well under the token cap — not truncation). The model wrote a nested
quotation with a raw `"` inside a body string (`…became "it."'`), which
terminated the JSON string 15,799 bytes into a 20KB response. The prompt made
this near-inevitable: it demanded a direct attributed quote in every paragraph of
every chapter, and its own examples were written as string literals
(`'"[Quote]," ${designer} says.'`), so the model copied the mixed delimiters it
saw — `'` outside, `"` inside — while the only formatting instruction was
"Return ONLY valid JSON". No instruction anywhere on escaping.
Fix: `JSON_PROSE_QUOTING_RULE` (in `editorialTone.ts`, next to `FOLIO_TONE`)
mandates typographic curly quotes in prose, and every prompt example was rewritten
to model them. Curly quotes carry no meaning in JSON, so there is nothing to
escape and no way to terminate a string early — the failure class is designed out
rather than warned against. Bonus: correct magazine typography.
Rules: (1) when a prompt asks a model to hand-serialize prose into JSON, state the
character-level rule that makes the prose *unable* to break the format — do not
just say "valid JSON" and hope; (2) prompt examples are training data — a `'…'`
wrapper borrowed from the host language teaches the model to write `'…'` in the
output, so write examples in the exact form you want back; (3) before switching a
generator's quote characters, audit every regex that reads the prose
(`extractPullQuotesForChapter`, `proofOutsideQuotes`) — the extractors here
already matched `“`/`”`, but `proofOutsideQuotes` split on `"` only and would have
started rewriting inside the designer's quoted words.

**The prompt is mostly not written by us — normalize the context, or it out-votes the rule.**
Same failure class as above, second occurrence (`generate_71e2451a999f`), with the
rule already in place and being ignored. Append-mode recomposition: attempt 1 at
temperature 0.7 died at position 482 and the resample at 0.3 died at position 584,
both on a straight-quoted attribution in the *first introduction paragraph* —
identical failure twice, so this was deterministic, not a sampling accident.
The cause was the other half of the prompt. That generation injected 10 published
chapters of straight-quoted magazine prose (with "match their register" attached)
and 31 interview answers, each wrapped by our own template as `A: "${answer}"`.
Thousands of words demonstrating `"` against four lines of instruction saying
`“`. The model copied what it saw, which is what models do.
Fix: `toTypographicQuotes()` in `editorialTone.ts`, applied to every prose-shaped
value that enters a prompt whose answer is prose-inside-JSON — answers, published
chapters, frozen lead/introduction, project description, designer bio, project
history, atelier summary, and the same set in the section-regenerate route. The
`A: "…"` wrapper became `A: “…”`. Safe to normalize the frozen fields because they
are re-applied verbatim from `input` after generation, so the designer's stored
text is never what we normalized.
Rules: (1) the previous lesson's "prompt examples are training data" covers
*retrieved* content too — every user-supplied or previously-generated string you
interpolate is an example, and there are usually far more of those than
hand-written ones; (2) when a prompt states a character-level rule, the context has
to obey it — a prompt that violates its own rule at scale will lose; (3) a failure
that reproduces at two different temperatures is not randomness, so stop
re-rolling and go read what the prompt actually contains; (4) normalize on the way
*in*, where the string boundaries are known, never on the way out, where they are
the thing that broke.

**A model upgrade is a request-surface migration, and the dangerous half is the parameter that silently changed meaning.**
Sonnet 4.6 → Sonnet 5 across 63 call sites. Two breaking changes, and the loud one
was the easy one. `temperature`/`top_p`/`top_k` now 400 — 29 call sites had one,
and every single one would have failed on its first request after the swap, which
means it gets caught immediately. The dangerous change was `thinking`: omitting it
used to mean "no thinking" and now means "adaptive thinking", and thinking shares
the `max_tokens` budget with the response. This repo has caps of 200, 256, 300,
400 — a call could have spent its entire budget thinking and returned a truncated
answer, with no error anywhere. Fixed by passing `thinking: { type: 'disabled' }`
explicitly at all 63 sites, holding 4.6 behavior so the migration stayed an
availability fix rather than a silent product change.
The third change has no error at all: the new tokenizer produces ~30% more tokens
for the same text at an unchanged per-token rate, so every `max_tokens` in the
repo buys less prose than when it was picked, and cost per call rises with no
config change. Resized only the editorial generator (800 → 1100/room), which has a
real truncation path and a history of hitting it; the other ~60 caps were left
alone and `callLLM` now logs `[llm] output truncated at max_tokens` instead.
Rules: (1) when migrating a model, grep for the parameters the new one *rejects*
and, separately, for the ones whose **default changed** — the second list is the
one that ships bugs, because nothing fails; (2) a 400 across every endpoint is a
better failure than a silent truncation on one, so prefer the explicit parameter
over relying on a default, even when the default is currently what you want;
(3) don't inflate 60 output caps on a guess to cover a tokenizer change — that
raises worst-case spend everywhere to fix a handful of real cases; instrument the
truncation and resize what actually reports; (4) write the new model's constraints
as a comment on the registry constant, not in a migration doc nobody reads — the
next call site is written by copying the last one; (5) keep the retired model id
in the pricing table, since instances mid-deploy still emit calls under it.

**Turning a model feature on changes the response SHAPE, and `content[0]` is where that bites.**
Wiring adaptive thinking behind a flag, every call site read the response as
`content[0]?.type === 'text' ? content[0].text : ''`. That is correct with
thinking off, because the text block IS block 0. With thinking on the response is
`[thinking, text]`, so the check is false and every one of those call sites falls
to its fallback — `''` in the editorial generator (surfacing as
LLM_EMPTY_RESPONSE) and `'{}'` in the three follow-up routes (parsing cleanly to
zero follow-ups). No exception, no error log, nothing to grep. The feature would
have looked like it worked and quietly produced nothing, and only when the flag
was flipped — which is precisely when you are least able to tell a real quality
regression from a plumbing bug.
Fix: `firstTextBlock()` in `lib/ai/thinking.ts`, finding the block by type instead
of by position, applied to every Anthropic read in the repo — including the
surfaces that cannot enable thinking today, because the trap is for whoever adds
the next surface, not for the current author.
Rules: (1) when a flag changes what the API RETURNS and not just what it costs,
audit the parsing before shipping the flag — the failure is silent by
construction, since a fallback value is indistinguishable from a real empty
result; (2) never index a polymorphic content array by position, find by type —
`content[0]` encodes an assumption that was only ever incidentally true; (3) fix
the pattern everywhere at once rather than only at the flagged call sites, or you
have moved the landmine instead of removing it; (4) assert it in a check —
"reviewer will notice" does not survive a flag flip six months later.

**Error copy is a spend decision — "Try regenerating" on a deterministic failure bills the founder for the user's hope.**
Every AI failure message in the editorial generator ended in some form of "Try
regenerating." Including `LLM_JSON_PARSE`, the failure that had just reproduced
at temperature 0.7 and again at 0.3, on the same sentence. The product was
telling a designer to spend another two-minute call on a wall it had already hit
twice, and nothing recorded that it had happened. Multiply by a few impatient
clicks and the copy costs more than the bug.
Fix: `lib/ai/errors.ts` — every code answers one question, *would an identical
retry work?*, and message + status + `retryable` all derive from that one entry,
so the copy cannot drift from the classification. Non-retryable codes carry copy
that closes the loop ("logged — no need to run it again"), the API returns
`retryable` so the UI can remove the control rather than disable it, and a check
asserts no non-retryable code carries retry-inviting language.
Rules: (1) classify failures by whether a retry can succeed, not by which
subsystem raised them — the user-facing consequence follows from that one bit;
(2) never let a call site hand-write user-facing error copy, or the message and
the retry logic drift and only the message is visible; (3) remove the retry
affordance rather than disabling it — "handled" reads as service, "denied" reads
as a wall, and both cost the same to build; (4) report a failure only after the
automatic recovery is spent — a resample that succeeded is a metric, not an
incident, and paging on it trains the feed to be ignored; (5) a bad API key is
not a transient error, it is an infinite wasted-call loop with a human fix.

**Resampling is not repairing — one automatic retry is the honest version of "Try regenerating".**
Corollary to the jsonrepair lesson above. Hard-failing on malformed JSON is
right, but making the designer click regenerate for a failure they cannot
influence is a UX tax, not a safety property. A fresh full sample carries none of
the corruption risk of a repair, because the draft is authored whole by the model
instead of stitched together by us. Implemented as `MAX_PARSE_ATTEMPTS = 2` with
temperature dropped 0.7 → 0.3 on the retry.
Rules: (1) resample on *parse* failures only — `LLM_TRUNCATED` and
`LLM_EMPTY_RESPONSE` are deterministic ceilings and a retry just burns tokens to
fail identically; (2) never feed the broken output back to the model asking it to
fix the JSON — it will re-bracket around whatever prose it can salvage, which is
the corrupting repair path wearing a different hat; resend the original prompt
plus the rule that was violated; (3) log the recovery
(`json_parse_recovered_on_resample`) so a silently-retrying path can still be
measured — an invisible retry hides a worsening prompt.
**A query that only fails at runtime hides forever inside a type-error backlog.**
`extractDesignerReasoning.ts` — the source of Atelier's per-designer reasoning
profile — referenced five things that don't exist: `User.designerBrandAssets`,
`Project.productTags`, `Product.material`, `InterviewSession.transcriptSegments`,
`EditorialInterviewAnswer.editorialDraft`, `DesignerDecision.product`. Every one
was reported by tsc, and every one was invisible because the repo carries ~1000
pre-existing errors. The phase5e CI check didn't catch it either: it looks for
phantom `prisma.<model>` DELEGATES, not phantom RELATIONS on real models. So a
whole feature had never executed once. Rules: (a) when touching a file, run tsc
filtered to that file — the signal is there, it's just drowned; (b) "no phantom
models" is a weaker guarantee than it sounds, since a valid delegate with an
invalid include fails exactly as hard; (c) a fixed-count error baseline hides
new errors in old files — worth pinning per-file counts if the backlog isn't
being paid down.

**Check whether the container can run the real dependency before settling for static review.**
I was about to ship a Prisma query rewrite on the strength of tsc alone, having
already told the user twice that there was "no database in this environment".
There wasn't a configured one — but `/usr/lib/postgresql/16` was installed, and
`apt-get install postgresql-16-pgvector` (the schema needs the `vector` type)
made `prisma db push` of the entire schema work in about four seconds. Seeding
one designer and running the real function end to end caught things static
review could not have: that a Selection built from a ProductTag must be deduped
against that tag, and that the follow-up→parent edge from the previous commit
actually resolves. Rule: before claiming a verification limit, check what's
actually installed (`which`, `ls /usr/lib`, `apt-get install`). An ephemeral
cluster + `db push` + a seed script is minutes of work and converts "the types
line up" into "it ran".

**Prefer the field where humans actually wrote the thing.**
The extractor wanted a `material` per selection and read `Product.material`,
which has never existed. The real material language lives in
`Selection.colorFinish` — "Honed travertine", "unlacquered brass" — because
that's the field a designer fills in while speccing. The tempting fix (keyword-
match material out of the product name or description) would have manufactured
tendencies nobody stated, which is the same failure as the by-index room pairing
in the editorial generator. Tag-sourced rows now get `material: null`. Rule: when
a field is missing, look for where the information is genuinely recorded before
inferring it; an absent value beats a fabricated one, and "unknown" is a
legitimate result for an analysis pipeline.


**A cap on a DERIVED field is a cap on whatever it's derived from — here, a 5-item array capped the product at 4 rooms.**
Editorial generation cleared the JSON-parse fix and then died at validation:
`pullQuotes` "too_big, expected <=5 items" on a 10-room project. `pullQuotes`
isn't authored by anyone — the prompt forbids the model from emitting it — it's a
derived index that `syncPullQuotesFromChapters` builds as the hook quote plus one
entry per gallery chapter. `galleryChapters` is uncapped, because a house has as
many rooms as it has. So `.max(5)` on the index silently imposed a hard ceiling of
FOUR ROOMS on the core product, and did it at the last step, after a full
two-minute generation had already been paid for. Two tells that it was stale
rather than deliberate: the same file declares the same field twice more with no
cap, and the per-chapter field it derives from is uncapped too.
Rules: (1) when a field is computed from another field, its bound must be
expressed in terms of that source — if the source is unbounded, a fixed cap on
the derivative is a bug waiting for a big enough input; (2) don't "fix" it by
truncating a derived index — entries here are keyed by `sourceSection` and used
for per-chapter lookup, so dropping some breaks the lookup for later chapters and
there's no principled way to pick which survive; (3) when a validation cap fires,
check whether the field is authored or derived before adjusting anything — the
answer decides between "the producer is wrong" and "the cap is wrong"; (4) a
schema that rejects at the END of an expensive pipeline should be audited for
this shape proactively — the cost of being wrong is the whole generation.

**Fix one blocker, expect the next — a pipeline that always failed at step 3 has untested steps 4 and 5.**
The curly-quote fix worked exactly as intended (`attempt: 1`, clean parse, no
resample) and immediately exposed a second failure one stage later, in a code path
that had never successfully executed for a project this size. The pull-quote cap
wasn't a regression; it had been unreachable behind the parse failure.
Rules: (1) after unblocking a stage, walk the REMAINING stages for input-size
assumptions before declaring victory — the newly-reachable code has never run on
this input; (2) write the reproduction before the fix and let it name the exact
threshold (here: 4 rooms pass, 5 fail) — "it's broken" doesn't tell you whether
the bound or the producer is wrong, but "breaks above 4" does; (3) report the
newly-revealed failure as progress, not as the fix having failed — the first fix
is confirmed working by the logs that show the second failure.

**A "derived index" rendered next to its own source renders everything twice — check the consumer before widening a cap.**
`RichArticle` renders each chapter's pull quote inside that chapter's section AND
rendered the top-level `pullQuotes` index as a stacked list. That index is derived
from those very quotes, so every room quote appeared twice. Nobody noticed because
`.max(5)` capped the array — the duplication was small enough to read as styling.
Lifting the cap (correctly, to unblock 10-room projects) would have made it 11
stacked duplicates. I initially framed this to the user as a design question
("slice the list or drop it?"), which was wrong and confusing: they read it as
"do you want fewer quotes per room" and answered "I want one per room" — which
they already had. The real answer was that the second render was redundant.
Rules: (1) when raising or removing a bound, read every CONSUMER of that field
before shipping — a cap can be silently doing a display job somewhere; (2) if a
field is derived from another, look for surfaces that render both, because that is
duplication by construction; (3) don't ask the user a design question until you
have read the rendering code — the "choice" here was an artifact of my not having
read the chapter loop, and the honest question ("should the same quote appear
twice?") answers itself; (4) filter the derived list by what the primary surface
already showed, rather than slicing to a fixed count — that keeps the lead quote
and legacy entries that have no other place to render.

**Three sources, two keyed by name and one by index, is a mismatch that renders as plausible.**
Every editorial chapter showed one room's title and photographs beside another
room's prose — "PRIMARY BATHROOM" over a bathroom photo and a paragraph about the
formal living room's fireplace, through all 10 rooms. `repairAndBuildBlocks` built
each chapter from `writeRooms[i]` (title, by name), `imagesByRoom[roomName]`
(images, by name), and `composedChapters[i]` (body, BY INDEX). The index read
assumed the model returns chapters in the order the prompt lists rooms; it
reordered into a narrative walkthrough instead. Because title and images were both
keyed by name they kept agreeing with each other, so nothing looked broken — the
only witness was the photograph. The model had been emitting the mapping all
along in its chapter titles (the prompt already required them to name the room)
and the code discarded it.
Rules: (1) when assembling one record from several sources, check that they all
share ONE join key — a single positional read among name-keyed reads is a bug
that hides, because the name-keyed fields corroborate each other; (2) if a model
is asked to label its output, JOIN ON THE LABEL, never on emission order — LLM
ordering is not a contract even when the prompt implies one, and if you depend on
the label, say so in the prompt; (3) when matching names where one contains
another ("Living Room" ⊂ "Formal Living Room"), run exact matches first and
process longer names first, and consume each match once so two keys can't share a
value; (4) no positional fallback for leftovers — an unmatched item demoted to
photo-only is a lesser evil than one confidently captioned with another's story.
This is the third positional-pairing bug in this pipeline (see the
`ProjectImage.room` entry above); a regression check that greps the source for
the old indexed read is cheap insurance against a fourth.

**A visibly "improved" output can still be wrong in a way the improvement hides.**
The prose quality jumped once the JSON and schema blockers were cleared, and the
articles read well — which is exactly why the room mismatch was easy to miss in
logs. It produced no error, no warning, and valid data. It was only visible by
looking at a rendered page next to its photograph.
Rule: when a fix unblocks a pipeline that had never run end-to-end, the first
successful output needs a human looking at the RENDERED artifact, not just green
checks — "it generated" and "it generated correctly" are different claims, and
the checks in between can only prove the first.

**Dead code that carries a second copy of a prompt is a live risk, because the risk is that someone edits the wrong one.**
Asked to confirm the Story/Publish "Regenerate" button ran the same prompt as
initial generation, the answer was yes — it posts to the same route. But the
audit that proved it turned up two alternate generation paths sitting in the
tree: `composeEditorial` / `composeEditorialHard` inside the generate route,
carrying a full second copy of the editorial system prompt, and a
`getOrCreateEditorialDraft` module building its own GenInput. Both had zero
callers. Neither could affect behavior — and both read as live to anyone opening
the file, which is exactly how a fix lands in the copy nobody runs. The proof
they had already rotted: `tsc` reported 8 errors inside them, including
`Cannot find name 'proofOutsideQuotes'`, because the real helpers had been moved
to `generateEditorialDraft.ts` and the dead copies were never updated. Code that
cannot compile had been sitting next to code that ships, indistinguishable at a
glance. Deleting both removed 1,484 lines and 9 repo-wide type errors.
Rules: (1) "is X wired to the same prompt as Y" is answered by tracing the call
path, but the real answer is whether a SECOND prompt exists at all — grep the
tree for the prompt's signature line before saying yes; (2) an unreachable copy
of a prompt is worse than no copy, because it survives review as "existing code"
and silently competes for the next edit; (3) when an invariant is "there is only
one of these in the repo", types can't express it and runtime tests can't observe
it — write a grep-based guard (`check:single-generator`) and prove it FAILS by
reintroducing the fork, or it's decoration; (4) dead code with type errors inside
it is a strong signal it's dead — check `tsc` output per file before assuming a
big unreferenced block is merely dormant.

**"How far have you got" and "where do you land" were two ladders, and only one of them knew about the draft.**
Opening La Gorce showed the tracker pointing at Tags — "Next · Tag the products in
your photos" — with the Publish marker rendered locked and inert, while a finished
editorial draft rendered on the surface directly below it. Both halves were
individually defensible. `deriveTrackerState` computed `reachedIndex` purely from
step COMPLETION, and the publish step's completion flag is `isPublished`; a draft
that exists but hasn't shipped therefore moved the tracker nowhere, so `currentIndex`
fell back to the frontier (Tags). Meanwhile `page.tsx` had its own `defaultView`
branch ladder that DID check `hasDraftOrPublished` and sent you to the Publish tab.
The two ladders were answering the same question — how far has this project got —
and disagreeing, which is why the header contradicted the page it sat on.
Fix: a step whose WORK has started counts as reached even though it completes later.
That rule already existed for the interview step (`interviewInProgress`); the publish
step needed the same treatment (`draftExists`), and then landing could be derived from
`reachedIndex` instead of re-branched.
Rules: (1) when two pieces of code answer the same question about state, one must
call the other — a second ladder that "happens to agree" is a coincidence with an
expiry date, and the failure mode is a header that contradicts its own page;
(2) distinguish REACHED from COMPLETE explicitly for every step, because any step
whose artifact is produced before the step finishes (a draft before publish, answers
before generation) is invisible to a completion-only model; (3) when adding a
second instance of a rule that already exists once, key it off the same abstraction
the first one used (here: `copy[key].action`, not a hardcoded step key) so it stays
correct across tracker types; (4) a locked step marker is a strong signal — if the
surface behind it renders real content, the gate model is wrong, not the surface.

**A gate that exists on one publish path and not the other is not a gate.**
`computePublishReadiness` has a `canPublish` field, an explicit backstop comment
citing spec 20 §3e, and a real enforcement site — in `publishProjectAction`, which
only the designer-dashboard `PublishButton` calls. The Publish tab's button goes
through `publishEditorial`, which had no readiness check at all, so an editorial
could go public with photos unsorted into rooms and nothing tagged. The client was
no better: the panel computed its own `allRequired` from a DIFFERENT definition of
ready (`hasImages && hasTags && hasCover` — "at least one photo has at least one
tag", not "every photo reviewed"), used it only to color a badge and auto-expand a
checklist, and left the Publish button enabled regardless. Three definitions of
"ready to publish", one of them enforced, none of them agreeing.
Rules: (1) when a shared readiness/authorization helper exists, grep for every
mutation that should consult it and check EACH one — the existence of a well-commented
enforcement site is evidence the rule was written down, not that it is applied;
(2) a client-side readiness display must consume the same server-derived value the
server enforces, never recompute its own — a second definition drifts silently
because both look plausible on screen; (3) if a button fires a request the server
will refuse, that is not a gate, it is an error message with extra steps — disable
it or replace it with a route to the outstanding work; (4) an action returning
`{ok: false, message}` whose caller flattens every failure into a generic 500 turns
"sort your rooms" into "try again", which is advice that cannot work.

**A control that collects input it never sends is worse than no control, because non-determinism makes the placebo convincing.**
The Regenerate Article dialog offered "Any direction for the rewrite? (optional)".
`regenFeedback` had four references: declared, bound to the input's value and
onChange, and cleared on submit. Nothing read it. `generateDraft()` takes no
arguments, the POST payload has no such field, the generate route contains zero
references to feedback or direction, and `GenInput` has no place to put one — so
this was never a loose wire, it was a control with no receiver at any layer.
Never wired, either: `usePublishFlow.ts` has never contained the word "feedback"
in its history. The reason it survived is the sharp part: generation runs at
temperature 0.7, so every regeneration returns visibly different prose. A designer
types "more conversational", waits two minutes, sees changed writing, and
concludes it worked. The feature validates itself, and real dissatisfaction that
should have become a bug report gets absorbed instead.
Fix: deleted the input rather than wiring it. Wiring was only ~30 lines across
four layers, but the interaction was wrong — whole-article regeneration is a
2-minute call that rewrites every room and drops unpreserved edits, so it is a
slow, destructive loop for something as iterative as tone. The capability already
existed at the right granularity: per-section feedback (`SectionFeedback` →
`sections/[chapterIndex]/regenerate`) genuinely injects the note into that
chapter's prompt and persists it. The dialog now points there.
Rules: (1) for any input, trace the value to a network call before assuming it
works — `grep` the state variable and count the reads, since bound-but-unread is
invisible in the UI; (2) suspect placebo controls anywhere output is
non-deterministic, because "the result changed" is not evidence the input was
used; (3) when a control is dead, the choice is delete or wire — and pick by
whether the ACTION it triggers is the right instrument, not by how few lines the
wiring takes; (4) if a working version of the capability exists at a better
granularity, delete the broken one and signpost the good one.

---

## 2026-08-25 — A prose rule with three examples must be checked against all three

**A checker that implements one example of a stated rule reads as enforcement and is not.**
`HEADLINE_CRITERIA` has a section headed NEVER THE BALANCED PAIR, and it prints three
headlines under it: "Bold in the kitchen, soft in the primary bedroom", "Dark in one
wing, bright in the other", "Moody here, sunlit there". `BANNED_SHAPES` implemented
the first one literally — `\w+ in the \w+..., \w+ in the \w+` — so the other two
passed clean. `check-headline.ts` asserted the rule was refused using the one example
the regex was written from, and passed. Every layer agreed the balanced pair was
banned; two thirds of it shipped, and "Formal outside, unruly within, and both are
true on purpose" reached a designer.
The tell was available for free the whole time: the criteria's own counter-examples
are a ready-made fixture, and running them through the checker takes one script.
Fix: matched the structure instead of the phrasing. Every balanced pair is a quality
pinned to a PLACE, twice, with a comma between — so the check keys on a closed set of
LOCATORS (`here`, `outside`, `in the <room>`, `in one <wing>`) rather than on an open
lexicon of mood adjectives. That distinction is what keeps the GOOD example "Two
crews, one site, the same afternoon" alive: also a comma list of verbless fragments,
but no fragment says where anything sits.
Rules: (1) when prose states a rule and lists examples, put EVERY example in the
check script as a fixture — the examples are a spec someone already wrote for you;
(2) an assertion that reuses the one example the implementation was built from proves
only that the implementation matches itself; (3) prefer a structural discriminator
over a lexicon when the bad set is open-ended (adjectives, verbs) but the shape is
closed (position, punctuation) — a lexicon has to be extended by each new production
report, which is the race the list always loses; (4) when widening a filter, assert
the GOOD examples survive in the same pass, or the widening quietly kills them.

**Where a defect gets fixed is decided by whether a pattern could ever see it.**
Four headlines came back bad from the first live batch. Exactly one — the balanced
pair — was a structural shape; the other three ("Glass won the dining table argument
by disappearing", "A reserved facade for clients who never wanted flash",
"Renovating finishes only, and still changing everything") are only decidable against
the interview, so they belong to the editor pass and NOT to the regex. Banning
material-as-agent to catch the glass one would have killed "The stone chose the rest
of the house", which the criteria list as GOOD.
What the three shared was a defect none of the editor's three kill criteria named:
they deliver a VERDICT on what the finished house is like rather than reporting a
moment in it. Three of the four reached for a contrast to do it, and that is why
"nothing at stake" did not fire — a contrast has the cadence of a claim, so it
counterfeits the stake.
Rules: (1) before adding a pattern, check it against the GOOD examples — if a good
one dies, the defect is editorial and the pattern is the wrong layer; (2) when
several bad outputs pass every stated criterion, look for the criterion that is
MISSING rather than tightening the ones that exist; (3) name the counterfeit
explicitly in a judging prompt ("a contrast counterfeits a stake"), because a
criterion that has to be inferred from an adjacent one does not fire; (4) record in
the check script which failures are deliberately left to judgement, so the next
session does not chase them into the regex.

## A guard written where it cannot run is a guess with a PASS line

`db:guard` was written, reviewed and reported as working in an environment with no
database, no `.env`, and no Windows. It then failed three times in a row on the
machine that actually runs migrations, and the three failures were not related bugs
— they were the same absence three times, each surfacing only after the previous one
was cleared:

1. **No env loading.** A bare `tsx` script reads no `.env`. Every sibling script
   works around this by being documented as `node --env-file=.env.local …`, which a
   gate invoked as `npm run db:guard && …` cannot do. Worse than an inconvenience:
   `prisma migrate deploy`, two links later in the same chain, reads `.env` itself —
   so the gate refused for want of a connection the command it gates would have found.
2. **`spawnSync('npx', …)`.** Bare-name PATH lookup; on Windows the executable is
   `npx.cmd` and `spawnSync` without a shell does not try PATHEXT. Fine on the
   machine that wrote it, ENOENT on the only machine that matters.
3. **Pending treated as drift.** The check refused when `prisma migrate status`
   reported pending migrations. But the gate runs immediately before an apply, so
   the migration being applied is always pending — the guard could never pass at
   the only moment it runs. The file's own comment said "pending migrations (often
   fine before a deploy)" one line above the code that failed on them.

The third is the one worth remembering, because it was not a portability gap and no
amount of local testing would have caught it: the fixture I proved the guard against
was "a database that needs nothing done to it", which is the one state it will never
be invoked in.

Rules: (1) a script whose whole contract is an exit code has not been tested until it
has produced that exit code in the environment it ships to — "the logic is right"
is not a test result; (2) when a gate runs at a specific moment, write the fixture
for THAT moment, not for the steady state — ask "what is true immediately before the
thing I am gating?" and assert against that; (3) cross-platform process spawning:
never a bare command name, resolve the entry out of the dependency's own
`package.json` and run it through `process.execPath`; (4) if a script is invoked
with no arguments by a chain, it owns its own environment loading — the caller has
nowhere to put a flag; (5) when a comment and the code beneath it disagree, the
comment is usually the intent and the code is usually the bug.

## 2026-09-08 — Browser SSRF is a network-boundary requirement
When a managed browser provider overrides required controls, stop layering interception workarounds. Decide on an independently controlled network boundary first. Navigation success and launch flags alone do not prove isolation. A completion report must include adversarial network evidence and real product parity, or explicitly remain incomplete.

When the user authorizes a portable Linux implementation despite a Windows workstation, complete the implementation and acceptance harness locally. Keep the inability to execute kernel tests as an explicit release gate; do not use it to stop authoring the requested code.

## 2026-09-08 — Respect parked workstreams
When the user parks infrastructure-blocked work and starts an independent task, preserve the controls and recorded blocker. Do not reopen architecture or provision infrastructure as a prerequisite for the new task.

## 2026-09-08 — Separate implementation completion from parked operational proof
When the user explicitly approves a scoped schema repair and parks the disposable-database journey, apply that exact repair without seeking approval again. Prove mappings with regenerated metadata, read-only queries and build logs. Report the unrun journey as parked; do not treat it as an implementation failure or imply that it passed.
## 2026-09-09 — Follow an explicit specification's delivery sequence
When a supplied specification already says where to start, execute that first step rather than asking the founder to choose between audit and implementation. Complete the authorized discovery and reviewable artifacts before raising a concrete schema approval gate.

## 2026-09-10 — Complete authorized acceptance gates with portable evidence
When local infrastructure blocks a database suite and the user authorizes another development/CI environment, provide and run a reproducible isolated path there. Equal TypeScript error totals or file/code counts do not prove fingerprint equivalence: compare source locations and full diagnostic types, preserve multiplicities and prove new errors still fail. A missing deployment status is not evidence that deployment was prevented; document the actual deployment control and its restoration separately.

## 2026-09-10 — Verify persistence field names in concrete proposals
The durable interview packet incorrectly named ProjectPost.provenanceJson; the actual Prisma field and existing writers use ProjectPost.provenance. Before proposing a persistence contract, copy exact field names from the schema and verify a real writer/reader. Correct documentation without inventing an adapter or renaming an existing schema field. Test approval of deletion restrictions is not approval of a permanent product retention policy.

## 2026-09-14 — Folio-authored pull quotes retain the direct quote's purpose
When enabling Written by Folio, implement optimized versions of the ranked direct pull quotes using their interview context. Do not broaden the feature into an independent room-caption generator or assume third-person voice. Keep direct selections intact, preserve meaning, and label Folio authorship explicitly.

## 2026-09-14 — Verify review options at the regeneration save boundary
Article regeneration must retain canonical room selection objects through persistence; never rebuild them from a flattened quote export index, which includes hooks and omits empty rooms. Verify title-choice generation separately from the article's single headline, and report partial option-generation failures without discarding a successfully saved article. When investigating a screenshot, verify the tested deployment independently of PR merge status.
