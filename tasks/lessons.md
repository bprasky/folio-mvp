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
