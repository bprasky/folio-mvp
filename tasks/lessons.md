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
