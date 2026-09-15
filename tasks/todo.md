# Project page — layout & hierarchy fixes

Design review of `/project/[id]` (publishing flow). Canvas:
https://claude.ai/artifact/K1TXBGnzgB7kF4K57FB1rr

## Plan

- [x] 1. Delete the shadcn `--accent` / `--accent-foreground` mapping that
      overrode `--folio-gold` app-wide (light **and** dark blocks)
- [x] 2. Darken functional gold to a value that actually meets AA
- [x] 3. Remove the two header buttons that had no `onClick`
- [x] 4. Leave no filled button in the header, so the tracker CTA is the
      page's only primary action
- [x] 5. H1 back on `--type-h1`; badge row folded into the meta row
- [x] 6. Next-action zone laid out as one band instead of a stacked block
- [x] 7. Dotted underline on reachable stepper labels

## Review

### 1–2. The accent token (`src/app/globals.css`)

`globals.css:112` set `--accent: var(--folio-gold)`. A second `:root` at
:651 re-declared it as `--folio-accent-200` (#D6CBBC) and, being later at
equal specificity, won — for all ~1,400 `var(--accent)` uses across 289
files. The `[data-theme="dark"]` block at :715 did the same with higher
specificity. Both removed.

Two things showed it was accidental rather than intended: `--accent-hover`
was never re-declared, so accent buttons sat taupe at rest and snapped to
gold on hover; and `PrimaryCta` hard-codes its glow as
`rgba(184,132,92,.30)` — a gold shadow under a taupe fill.

The override was also dead: nothing reads `--accent-foreground`, and no
`bg-accent` utility resolves against this Tailwind config (`colors.accent`
is the `engage/perf/opp/risk/slate` set, with no `DEFAULT`).

Measured, white-on-fill:

| | ratio | AA (4.5:1) |
|---|---|---|
| #D6CBBC — what shipped | 1.60:1 | fail |
| #B8845C — intended | 3.23:1 | fail |
| #8C5F3C — now | 5.50:1 | pass |
| #724A31 — hover | 7.67:1 | pass |

So `--folio-gold` moved to #8C5F3C and `--folio-gold-hover` to #724A31
(hover must stay darker than rest). The old `/* Functional — WCAG AA on
#FCFBF7 */` comment was false in both directions and is corrected.

**Blast radius:** every functional gold surface in the app gets slightly
darker. That is the point — the token is used for buttons, focus rings,
active states and links, all of which were below AA.

### 3–5. `ProjectHeader.tsx`

Dropped the `Share` fallback (:239) and `Add tile` (:254); neither had an
`onClick`, and `Add tile` was `bg-folio-text-primary text-white` — the
heaviest element on the page. The cluster is now ghost-only, so the
tracker's CTA is the sole primary. `Plus` import dropped with it.

H1 `text-[72px]` → `text-folio-h1` (48px/1.10). The old size was 1.5× the
scale with no off-scale comment, against the rule stated in `globals.css`.
Status and category badges moved from their own 36px row into the meta row.

### 6–7. `ProjectProgressTracker.tsx`

`NextActionZone` is now one flex band — eyebrow/headline/body left, CTA
right — at 123px instead of 213px. Headline 27px → 22px in both it and
`MaterialsZone` so the two stay consistent. Stepper padding `pt-8 pb-7` →
`pt-6 pb-5`; zone `pb-8 pt-2` → `pb-6 pt-1`.

Reachable step labels get a dotted underline: in the publishing flow
`ProjectTabs` renders `null` (every tab is gated off), so the stepper is
the page's only navigation, and `hover:opacity-80` was its whole
affordance.

Net: ~723px of chrome before the first photo → ~508px on a 1440×900
laptop, so a full row of photos clears the fold instead of a third of one.

## Verification

- `npm run typecheck:prepare` — full production build compiles
- `npm run typecheck` — no new fingerprints from these changes
- `npm run guard:client-imports` — pass
- `next lint` on the three changed files — no errors; warnings all pre-existing

## Running `npm run typecheck` locally on Node 22

The ratchet passes in CI but reports a false `+1` when run locally on
Node 22, naming `.next/types/app/api/rep-contacts/route.ts` (TS2344).

That diagnostic is **already in `tools/typescript-baseline.json`** and is
not new. The guard matches fingerprints as exact strings, and TypeScript's
type printer elides a union at a different point depending on version:

- baseline / CI (Node 20): `"generateStaticParams" | ... 6 more ... | "OPTIONS"`
- local (Node 22):         `"generateStaticParams" | "revalidate" | ... 5 more ...`

Same error, different rendering, so the strings don't match and the guard
counts it as a new fingerprint. Use Node 20 (`.github/workflows/lint.yml`
pins `node-version: 20`) when interpreting a ratchet run, and do not
"fix" a diagnostic on this basis — and never regenerate the baseline on
Node 22, which would rewrite fingerprints CI then rejects.

### Separately: `listAllContacts` is dead code

`src/app/api/rep-contacts/route.ts:141` exports `listAllContacts`, which
has zero callers anywhere in `src/`. App Router route modules may only
export the HTTP verbs plus a few config keys, which is why it produces a
(baselined) diagnostic at all. Its doc comment says it serves
`GET /api/rep-contacts` with no `vendorName`, but the real GET handler
400s in that case — an unfinished feature that was never wired up.
Deleting it would retire one baselined diagnostic. Out of scope here.
