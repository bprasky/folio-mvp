# TITLE PICKER — PRESENTATION AUDIT

Read-only. No code changed.

Target: one labeled option per eligible angle (constraint, governing-decision, change),
each showing its angle name, so the designer picks the story rather than the wording.
Then the deck generates to match the chosen title. Then the article assembles as a
preview.

Everything below is what exists at `e20af549`, not what should be built.

---

## Summary

**S1. The batch is already several angles — the UI is the only thing hiding it.**
Post-C3 a batch spans one to three angles, and the angle is known per candidate at
generation time. It is logged and then dropped: `kickerAlternatives` is
`z.array(z.string())`. The label the target needs is computed and discarded, one line
before storage.

**S2. There is an exact precedent for the labeled shape, in this codebase, rendered.**
Pull quotes already store `{selected, alternatives: [{text, context, score}]}` and
`PullQuotePicker` already renders `context` as a caption under the quote. A labeled
title picker is that shape with `angle` where `context` is.

**S3. The deck is generated in the SAME LLM call as the kicker** — both are keys of
one `lead` object in `generateEditorialDraft`'s JSON. Nothing sequences them today.

**S4. But the deferral mechanism already exists and is already wired to the picker.**
`frozenLead` reads designer overrides at `chapterIndex: -1` and passes the edited
field as FIXED context, so the model reproduces it verbatim and writes the other
field to fit. Choosing a headline writes exactly that override. What is missing is a
cheap trigger — today the only thing that consumes `frozenLead` is a full article
regeneration.

**S5. The edit signal is half-built and anchored to the wrong thing.** Every pick and
every hand-edit writes `SectionOverride{originalBody, editedBody, editedAt}`. But
`originalBody` is preserved as the *first* original across re-edits, so after
pick-then-edit the stored pair is *(pre-batch headline → current text)*, not
*(generated candidate → designer's correction)*. That is the pair the accuracy signal
needs, and it is not what is stored.

**S6. Picking and typing are indistinguishable.** Both arrive as the same PATCH with
`field: 'kicker'`. Nothing records which.

---

## 1. Current picker

### What renders it

```
StagingPublishPanel.tsx:308   StoryEditProvider   (mounted ONLY here — /p/[slug] stays read-only)
  └─ ImmersiveProjectPage
       └─ StoryRenderer
            └─ StoryLead.tsx:68     <HeadlinePicker current={story.title} alternatives={story.titleAlternatives} />
                 └─ HeadlinePicker.tsx
```

`story.titleAlternatives` is built in `buildRoomTiles.ts:276`, which re-grades the
stored pool on the way out — `blockingIssues(t).length === 0 && !hasWeakPredicate(t)`.

### Where "6 of 6" comes from

`HeadlinePicker.tsx:111` — `{index + 1} of {pool.length}`.

`pool` is the stored `kickerAlternatives`, with the live headline spliced in at the
front if the stored list does not contain it (`:50`). `index` is
`Math.max(0, pool.indexOf(current))`.

`pool.length` is 6 because `CANDIDATES_KEPT = 6` in the regenerate route. Six is a
cap on kept candidates, not a count of angles.

### Where "New options" comes from

`HeadlinePicker.tsx:130` — one button, label switching on whether a pool exists:

```
{busy ? 'Writing options…' : alternatives.length > 0 ? 'New options' : 'Suggest headlines'}
```

It POSTs `/api/posting/project/{id}/sections/headline/regenerate` with an empty body,
then calls `edit.refresh()`. It replaces the whole pool; there is no per-angle
regeneration.

### Is the batch one angle or several?

**Several — one to three, depending on which opening questions were answered.**

The route builds its angle list per project from `PROJECT_GRAIN_ANGLES` filtered by
frame eligibility, then asks for `perAngle = min(MAX_PER_ANGLE, ceil(TARGET_CANDIDATES / angles.length))`
per angle:

| eligible angles | candidates asked | kept |
|---|---|---|
| 3 | 4 each = 12 | 6 |
| 2 | 4 each = 8 | 6 |
| 1 | 4 | up to 4 |

And the kept set is *deliberately* spread across angles — `bestPerAngle` seats the
editor's top survivor from each angle before filling the remaining slots by rank
(regenerate route, the editor block). So a 3-angle batch of 6 is roughly two takes on
each of three different stories.

**That is the finding.** The designer is already being offered three stories; the UI
presents them as six interchangeable strings and gives them arrows. The work to reach
the target is presentational plus one storage-shape change — not a generator change.

---

## 2. Angle label availability

**Computed, then discarded. It does not reach the frontend.**

The angle is known per candidate by construction — position *is* the angle:

```
regenerate route:  entries [i*perAngle, (i+1)*perAngle) are angles[i]
                   const angleOf = (i: number) => Math.floor(i / perAngle);
```

It is used at least three times inside the route — to spread the kept set across
angles, to log `angle` per keep, and to log `anglesCovered`. Then storage flattens it:

```
const pool = carriedKicker ? [carriedKicker, ...kept] : kept;   // kept.map(s => s.text)
blocks.lead = { ...blocks.lead, kickerAlternatives: pool };
```

`kept` is mapped to `s.text` before the pool is built, and the schema is
`kickerAlternatives: z.array(z.string().max(120)).max(8)` (`schemas.ts:137`). The
survivor's `index` — the only thing that carries the angle — is dropped there.

### The precedent for fixing it

Pull quotes solved the same problem in this codebase and their shape is rendered
today:

```ts
// schemas.ts:23
export const PullQuoteAlternativeSchema = z.object({
  text: z.string().max(300),
  context: z.string().max(80).optional(),
  score: z.number(),
});
export const PullQuoteSelectionSchema = z.object({
  selected: z.object({ text, context }).nullable(),
  alternatives: z.array(PullQuoteAlternativeSchema),
});
```

`PullQuotePicker.tsx:114` renders `context` as a caption under the quote:
`— {selectedContext}`. That is structurally the labeled title picker.

### What a label would say

The angle keys are `constraint`, `governing-decision`, `change`. Human labels do not
exist for them yet — but each frame already carries a `name` written for exactly this
kind of display:

| angle key | `HeadlineFrame.name` |
|---|---|
| `constraint` | Constraint the project answered |
| `governing-decision` | Governing decision |
| `change` | What the project became |

And the route already puts `a.frame.name` into the prompt, so nothing new needs
authoring.

### Cost

Three edits, no migration (`expandedBlocks` is a `Json` column):

1. Widen `kickerAlternatives` in `BlocksSchema` to objects. **`BlocksSchema` is strict
   — an undeclared key is stripped on the next parse**, and its own comment says so,
   so this is required rather than optional.
2. Keep `s.index` alive to storage and map it through `angleOf`.
3. Carry the field through `RoomTileData.titleAlternatives` (`buildRoomTiles.ts:276`)
   and render it in `HeadlinePicker`.

Backward compatibility is the one real wrinkle: every pool in production today is
`string[]`. The reader has to accept both shapes, the way `normalizePullQuote`
(`schemas.ts:224`) already does for the legacy pull-quote format.

---

## 3. Deck sequencing

### Where the deck is generated today

**In the same LLM call as the kicker, as two keys of one object.**
`generateEditorialDraft.ts:1294-1295`:

```
"kicker": "The headline. See HEADLINE below — 4-16 words, sentence case.",
"deck":   "1-2 sentences that set up the story. See HEADLINE — do not restate the headline."
```

Composed at `:916–926` into `blocks.lead = { kicker, deck }`. There is **no
deck-only endpoint** — the full route list under `sections/` is `headline/regenerate`,
`pull-quote`, `pull-quotes/backfill`, `[chapterIndex]/regenerate`,
`[chapterIndex]/undo`, and `override`. The headline regenerate route touches
`kickerAlternatives` and nothing else; it explicitly leaves `kicker` alone until the
designer picks.

So: **yes, something generates them together — the main draft generator, in one
call.** A designer who picks a new headline today keeps whatever deck was written to
sit under a *different* one.

### Can the deck be deferred and conditioned on the chosen title?

**Yes, and most of the mechanism is already built and already wired to the picker.**

`frozenLead` (`interview/generate/route.ts:1161`) reads the designer's overrides:

```ts
for (const o of existingOverrides) {
  if (o?.chapterIndex === -1 && (o.field === 'kicker' || o.field === 'deck') && typeof o.editedBody === 'string') {
    frozenLead[o.field] = o.editedBody;
  }
}
```

and `generateEditorialDraft.ts:1186` turns it into:

> `## FIXED FIELDS (the designer edited these — reproduce verbatim and write everything else to fit them)`
> `FIXED HEADLINE (kicker) — reproduce exactly: …`

The generator's own comment states the intent precisely: *"The model already saw it as
FIXED context (so the unfrozen field was written to fit)."* And after generation the
frozen field is re-applied verbatim over the model's output (`:975`), so the
designer's text is never touched.

**Choosing a headline in the picker already writes that override.** `HeadlinePicker`
calls `edit.save(LEAD, 0, 'kicker', next)` → `PATCH /sections/override` → an override
at `chapterIndex: -1, field: 'kicker'`. The chain is complete.

### What is actually missing

Two things, and neither is the hard part:

1. **A cheap trigger.** The only consumer of `frozenLead` is a full article
   regeneration (`interview/generate`), which rewrites every chapter. Deck-to-match
   wants a small call: fixed kicker in, one deck out. That is a new endpoint —
   `sections/deck/regenerate` — but it is the smallest route in the family, and
   `[chapterIndex]/regenerate` is the shape to copy.

2. **The angle is not passed.** `frozenLead` conditions the deck on the chosen
   headline's *text*, not on its *angle*. The two mostly agree — a Constraint headline
   reads as one — but "conditioned on the chosen angle" is stronger than what exists,
   and it depends on §2's storage change: without the angle stored beside the
   candidate, nothing knows which angle was chosen once the pick is made.

**Ordering note.** §2 is a prerequisite for the angle-conditioned half of §3, and both
are independent of §1's rendering. §3's title-conditioned half needs neither.

---

## 4. Edit as a correction signal

### What is stored

`SectionOverride` (`editingTypes.ts:8`), on `ProjectPost.sectionOverrides` (Json):

```ts
{ chapterIndex: -1, paragraphIndex: 0, field: 'kicker', originalBody, editedBody, editedAt }
```

Written by `sections/override/route.ts:80–97`. Three behaviours matter:

- `originalBody` is read live from `expandedBlocks` at write time (`:80`).
- On re-edit, **the first `originalBody` is preserved** (`:95`) rather than chained.
- A no-op edit is skipped entirely (`:83`) — `originalBody === editedBody` returns early.

There is no history fallback: `sectionHistory` covers chapters only.
`[chapterIndex]/regenerate/route.ts:50` rejects `chapterIndex < 0`, so the lead has no
version trail. **`SectionOverride` is the entire record of headline edits.**

### Can it be read as "the resolver picked a vague element, the designer named a concrete one"?

**Not as-is, and the reason is anchoring rather than richness.**

That signal needs the pair *(what the generator produced → what the designer replaced
it with)*. What is stored is *(what was live when the field was first overridden →
what it is now)*. Those coincide in exactly one case: the designer edits a
generator-written headline directly, once, and never picks from the pool first.

The common path breaks it. Picking goes through the same PATCH as typing, so:

| step | override after |
|---|---|
| generator writes headline **A** | *(no override)* |
| designer picks **B** from the pool | `original: A, edited: B` |
| designer edits **B** into **B′** | `original: A, edited: B′` — **first original preserved** |

The stored pair is now *A → B′*. The interesting comparison is *B → B′*, and **B is
not recoverable** — `kickerAlternatives` is replaced wholesale on the next batch, and
even while it survives it is a bare `string[]` with no record of which member was
taken.

Three further gaps, each independent:

- **Picking and typing are indistinguishable.** Both are `PATCH … field: 'kicker'`.
  Nothing marks which, so a pick counts as an "edit" in any tally.
- **No angle.** Even with the right pair, nothing says which angle's candidate was
  corrected — the accuracy question is per-angle.
- **No slot values.** The resolver's inputs (`resolvedSlots`, `tail`, which answer fed
  the frame) exist only in a `console.info` line. Reading "the resolver picked a vague
  element" requires knowing what element the resolver picked, and that is not
  persisted anywhere.

### What it *can* support as-is

Honestly, not much — but not nothing:

1. **Headline edit rate.** How many published projects carry a `-1/kicker` override.
   One scan of `sectionOverrides`.
2. **Edit magnitude.** Token overlap between `originalBody` and `editedBody`, which
   separates a reworded headline from a replaced one.
3. **Time-to-edit.** `editedAt` against `ProjectPost.updatedAt` or the generation
   timestamp.
4. **Which field gets edited more** — `kicker` vs `deck` vs `body`, since they share
   the array.

Every one of these is a *volume* measure. None is an *accuracy* measure, because none
of them can name what the generator got wrong.

### Could the stored edits support a cross-project preference model, and at what cost?

Reporting so the decision is informed; not designing one.

**Today: no.** The corpus is *(first-live-text → current-text)* pairs with no angle,
no slot values, no pick/type distinction, and one row per project per field. Both
required labels — which angle, and which resolved element the designer replaced — are
absent, and neither is reconstructable from what is stored.

**Volume is unknown and is the first thing to check.** It needs a query against
`sectionOverrides` for `chapterIndex: -1, field: 'kicker'`, and `DATABASE_URL` is
unset here so I could not run it. A model trained on a few dozen edits would be
fitting noise, and this is a pre-launch product.

**What it would cost to make the data usable** — in order, cheapest first:

| step | change | cost |
|---|---|---|
| Distinguish a pick from a type | flag on the PATCH, or membership test against the pool | trivial |
| Anchor on the generated candidate | store the candidate as `generatedBody` alongside `originalBody` | small; `SectionOverride` is Json |
| Record the angle | needs §2's storage change | small, shared with §2 |
| Record the resolved governing element | persist the slot values beside each candidate (they are computed and logged today) | small; the data already exists |
| Accumulate enough rows | time | **the real cost** |

The first four are hours of work on a Json column and no migration. The fifth is the
one that decides whether this is worth doing, and it cannot be shortened.

**One caveat that is a product decision, not a storage one.** An edit that changes the
governing element only counts as a resolver correction **if the designer saw what the
resolver claimed**. If the headline says "one stone set the palette" and they rewrite
it to name oak, they may be correcting the resolver or writing a better sentence about
a different thing. Recording it as a correction requires the UI to have shown the
claim, not just the sentence. Settle that before trusting the signal.

---

## 5. Wizard surfaces

The step flow already exists. `StagingPublishPanel` links steps by URL:
`?view=media&step=tags`, `?view=media&step=rooms`, `?view=story`.

### Answers → angle choice

| piece | status |
|---|---|
| Project answers captured | **exists** — five fixed categories, `project-<CATEGORY>-<uuid>` |
| Answers reach the generator labelled | **exists** — C1 |
| Angles computed from them | **exists** — C3, `eligibleFrames({grain:'project', source:'interview'})` |
| Candidates generated per angle | **exists** — regenerate route |
| Angle survives to storage | **MISSING** — §2 |
| Angle rendered as a label | **MISSING** — §1, `HeadlinePicker` |
| "No eligible angle" state | **exists** — 422 `NO_ELIGIBLE_ANGLE`, naming the unanswered question. **Not rendered** — `HeadlinePicker` shows `data.error` as one line of grey text, which is thin for a message that is a to-do list |

### Angle choice → deck

| piece | status |
|---|---|
| Choosing writes a `-1/kicker` override | **exists** — `HeadlinePicker` → `edit.save` → PATCH |
| Overrides freeze the field for generation | **exists** — `frozenLead` |
| Unfrozen field is written to fit the frozen one | **exists** — `generateEditorialDraft` |
| A cheap deck-only regeneration | **MISSING** — new endpoint, copy `[chapterIndex]/regenerate` |
| Deck conditioned on the *angle* | **MISSING** — depends on §2 |

### Assembled preview

| piece | status |
|---|---|
| Article renders from `expandedBlocks` | **exists** — `StoryRenderer`, one component |
| The same renderer in edit mode | **exists** — `StoryEditProvider` mounted only in `StagingPublishPanel`; `/p/[slug]` stays read-only |
| Editing in place, no Edit/Preview toggle | **exists**, and is a deliberate decision recorded in the panel: *"editing in a layout that is not the article means never seeing what you actually made until you switch"* |
| A publish preview modal | **exists** — `PublishPreviewModal` |
| Generation trigger | **exists** — `StoryInterviewPanel:426`, `POST interview/generate` |

**The assembled preview is not new work.** It exists, it is the same renderer as the
published page, and the in-place editing decision is already made and documented.

### What is genuinely new

Two things:

1. **A labeled option list in `HeadlinePicker`** — replacing arrows and a counter with
   one row per angle. Depends on §2's storage change. The rendering pattern exists in
   `PullQuotePicker`.
2. **`sections/deck/regenerate`** — fixed kicker in, one deck out. The smallest route
   in the family.

Everything else on the path is already built.

---

## Reproduction

Claims verified against `src/` and `prisma/schema.prisma` at `e20af549`. Route
inventory is `find src/app/api/posting/project/[projectId] -name route.ts`. The
"no deck endpoint" claim is that inventory returning no deck path plus
`grep -rn "deck" src/lib/posting/generateEditorialDraft.ts`.

Not measured, and why: how many `-1/kicker` overrides exist in production (§4 volume)
needs `DATABASE_URL`, which is unset in this environment. That number decides whether
the cross-project question is worth asking at all, and nothing in this report should be
read as an estimate of it.
