# Room caption sizing — relational and length-aware, 2026-09-15

The room caption beside each photo was a flat `--type-h3` (28px / 1.25). Beside a
near-square photo the caption column is ~490px tall and the text cluster is ~170px
of it, so the caption read as undersized and marooned — the complaint that started
this. A bigger constant would fix that one room and break the next.

- [ ] Size the caption relative to the column it sits in rather than a constant.
- [ ] Make the size length-aware, so a short caption and a long one fill a
      comparable share of the column.
- [ ] Route it through CSS custom properties so `design-system-discipline` stays
      green (raw `text-[Npx]` / `leading-[N]` / `fontSize: "Npx"` all fail CI).
- [ ] Apply it to all three caption branches — owner picker, Folio-authored line,
      direct blockquote — from one source of truth.
- [ ] Leave the `wide` (Pattern 3 bar) variant on `--type-h4`; it isn't beside a
      photo, so the relational argument doesn't apply.
- [ ] Typecheck, commit, push.

## The one thing that did NOT survive contact with the code

The study proposed anchoring the caption to the **photo's height** (`cqh`). Two
findings killed that:

1. `ProjectImage` has no `width`/`height` columns (`prisma/schema.prisma:568`), so
   the aspect ratio is not known at render. `useImageAspect` discovers it by
   loading the image client-side, which means any JS-computed size would snap
   after the image loads.
2. The pure-CSS version needs `container-type: size` on the tile, which applies
   size containment — the tile stops growing to fit its own content. Today a long
   caption in a short (16:9) row makes the row taller than the photo; under `size`
   containment it would overflow into the next row instead. Worst realistic case
   measured ~418px of content in a 294px row.

So the caption is anchored to the column's **inline size** (`cqi`) under
`container-type: inline-size`, which contains nothing in the block axis and keeps
row growth intact. On desktop the column is ~523px, so the medium bucket resolves
to ~39px — the same value the approved study showed for a square photo — and it
stays fluid across breakpoints instead of being a constant.

Anchoring to the photo's height properly needs `width`/`height` persisted on
`ProjectImage` at upload. That is a schema change and deliberately not in here.

## Review

(filled in below after implementation)

Implemented in `src/components/story/captionScale.ts` (new) and
`src/components/story/QuoteTile.tsx`. The tile becomes a
`container-type: inline-size` query container and publishes `--caption-size` and
`--caption-leading`; all three caption branches — the owner's `PullQuotePicker`,
the Folio-authored line, and the direct blockquote — read those two variables, so
they can no longer drift apart. Three length buckets (<=60, <=160, longer)
resolve to roughly 51px / 39px / 31px at the ~523px desktop column, each with its
own floor and ceiling so a two-word caption doesn't become a headline and a
300-character one doesn't crowd the photo.

Two incidental fixes came for free: the picker's un-annotated `leading-[1.25]`
(which trips `design-system-discipline`'s raw-type-literal check) is gone, and the
Folio-authored line and the direct blockquote no longer disagree about
line-height — they were on `--lh-h4` and a literal `1.25` respectively.

### Verification

- `npm run typecheck:prepare` then `npm run typecheck`: **delta −1**, no new
  fingerprints from these files. The run still reports FAIL on one entry,
  `.next/types/app/api/rep-contacts/route.ts` — pre-existing and not from this
  change. Reproduced with these two files stashed. It is already grandfathered in
  `tools/typescript-baseline.json`; the mismatch is in the diagnostic's message
  text, which embeds a Prisma-generated type signature that drifts with a local
  `prisma generate`.
- `npm run guard:client-imports`: passes, no client-boundary violations.
- `design-system-discipline` raw-type-literal greps run locally: this change adds
  no new violations and removes one. The workflow is **already red on main** from
  pre-existing literals (`QuestionCard.tsx:123`, `ProjectHeader.tsx:65,70`,
  `ProjectProgressTracker.tsx:133,251`, `ProjectsPageClient.tsx:325`,
  `QuoteTile.tsx:179`). Not fixed here — out of scope.

### Boundaries

Not visually verified in a browser: no screenshot or running app was used, so the
resolved sizes are arithmetic against the real tokens and column widths, not
observed rendering. The `wide` Pattern 3 bar is unchanged. The caption is still
duplicated as the teaser beneath it (`articleFolioLines` lifts the first eligible
sentence out of the article body) — a separate, known issue, untouched.
