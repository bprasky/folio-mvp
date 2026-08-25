# Handoff — article title (headline) generation & regeneration

Written 2026-08-25. Everything described as merged is on `main` at `e65d3a7`.

## What this feature is

A designer previewing their generated article can press **Suggest headlines / New
options** under the headline. That asks a model for a batch, filters it, and
stores the survivors. The live headline does **not** change — the designer cycles
through options with arrows and landing on one commits it.

Deliberately not "regenerate the headline". A button that swaps in one fresh
headline per press is a slot machine: press three can be worse than press one and
there is no way back, so the feature trains designers not to touch it.

## The pipeline, in order

```
1. WRITER      12 candidates, one per angle × 2      regenerate/route.ts
2. MECHANICAL  headlineIssues() — drops rule breaks  src/lib/posting/headline.ts
3. EDITOR      a second model call that CUTS + RANKS src/lib/posting/headlineEditor.ts
4. STORE       survivors → blocks.lead.kickerAlternatives
5. READ        re-graded again on the way out        src/lib/story/buildRoomTiles.ts
6. PICK        cycle-and-choose, no slot machine     src/components/story/HeadlinePicker.tsx
```

### Files

| file | lines | role |
|---|---|---|
| `src/lib/interview/prompts/editorialTone.ts` | 205 | `HEADLINE_CRITERIA` — the SINGLE source both initial generation and regeneration read |
| `src/lib/posting/headline.ts` | 181 | `normalizeHeadline`, `headlineIssues`, `BANNED_SHAPES` |
| `src/lib/posting/headlineEditor.ts` | 188 | `judgeHeadlines()` — the editorial pass |
| `src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts` | 390 | the endpoint; `ANGLES`, filtering, ordering, storage |
| `src/components/story/HeadlinePicker.tsx` | 138 | the arrows and the counter |
| `src/lib/posting/loadInterviewAnswers.ts` | 78 | reads both answer stores, resolves room names |
| `src/lib/story/buildRoomTiles.ts` | 406 | `buildStoryData` — re-grades the stored pool on read |
| `src/lib/posting/generateEditorialDraft.ts` | 1923 | initial generation; also reads `HEADLINE_CRITERIA` |

### The six angles

One headline per angle, two takes each. A single instruction repeated twelve
times returns twelve versions of one thought — this makes the spread structural.
Every angle asks for something that **happened**, because arrangement ("bold in
the kitchen, soft in the bedroom") is a caption and events live in the interview.

`reversal` · `constraint` · `accident` · `client` · `first-move` · `argument`

### Layer 2 — mechanical (free, deterministic, no opinion)

`headlineIssues(text, names)` returns codes: `TOO_LONG` (>10 words) ·
`TOO_SHORT` (<4) · `TITLE_CASE` · `BANNED_SHAPE` · `TERMINAL_PUNCT` ·
`NAMES_PEOPLE`.

`NAMES_PEOPLE` is enforced from the credited designer/org, not asked for — "A
house Matto never had to redraw" shipped with the byline directly beneath it.

Banned shapes: `refuses to…` · `Where X meets Y` · `A study in X` ·
`Redefining X` · `The art of X-ing` · brochure vocabulary · balanced pair ·
`gives way to` · `does the talking` · about the article's own structure ·
personified architecture.

### Layer 3 — the editor (`judgeHeadlines`)

Kills for the three things a pattern cannot see:

- **INTERCHANGEABLE** — could run on someone else's project with the nouns swapped
- **UNSUPPORTED** — the interview does not say this happened
- **NOTHING AT STAKE** — true, specific, and no reason to read the next line

Design decisions that are load-bearing:

- A **separate call**, not an instruction bolted onto the writer's prompt. A
  model grading its own twelve suggestions defends them.
- Given the interview and **not** the writer's reasoning, so it judges the line
  the way a reader meets it.
- Asked which it **would not run**, never to score. "Rate these 1–10" returns a
  spread of sevens.
- Can only **remove and reorder**, never rewrite.
- Ordering: the editor's rank wins, but the best survivor from each angle is
  seated before the tail is filled by rank.
- Failure degrades: unreachable editor → the writer's angle-ordered batch;
  verdicts not covering every candidate → discarded whole (an unjudged headline
  is not a rejected one).

## Rules for the prose in `HEADLINE_CRITERIA`

**The user has claimed ownership of this text** ("just give me the title
generation and regeneration prompt here and I will adjust elsewhere"). Do not
rewrite it unprompted.

Current headings: sentence case (4–10 words) · NEVER NAME THE DESIGNER, THE
STUDIO, OR THE CLIENT · A HEADLINE IS NOT A CAPTION · SOMETHING HAS TO BE AT
STAKE · NEVER THE BALANCED PAIR · DO NOT WRITE ABOUT THE ARTICLE · DO NOT DEFINE
THE PROJECT BY WHAT DID NOT HAPPEN · IT MUST BE ABOUT THIS PROJECT AND NO OTHER ·
DIVIDE THE WORK WITH THE DECK · NEVER WRITE THESE.

## Decisions already made — do not relitigate

- **Sentence case, 4–10 words.** Chosen by the user.
- **Casing drift is reported, never auto-corrected.** Lowercasing "A Miami Beach
  House That Changes Mood" correctly requires knowing "Miami Beach" is a place.
  Getting it wrong publishes "Miami beach", which is worse than the Title Case it
  was fixing. See the comment block at the top of `headline.ts`.
- **`dictated` and `asked for` are deliberately NOT in the banned-verb list.**
  There is a check asserting they stay out. `dictated` is causation, not mood,
  and sits on the right side of the boundary that keeps "The stone chose the rest
  of the house" alive. Both bad examples were *interchangeable*, which is the
  editor's job. Chasing verbs one production report at a time is the losing game
  the editor exists to end.
- **Pull quotes are selected, never written.** A headline is the model's
  sentence, so the designer may type their own; a pull quote is a claim about
  what they said out loud, so it can only be cycled. Both controls look alike;
  only one has a text field.

## Bugs already fixed here (don't re-fix)

- Headline cycling always read "1 of 6" and only ever reached two options. The
  pool was rebuilt as `[current, ...others]` on every render, hoisting the live
  headline to index 0. The stored batch now ships with the pre-batch headline as
  its first entry, so the stored list IS the pool.
- The writer had never been shown the interview — only the article's own intro,
  hook quote and current headline, all of which have already abstracted the
  project. It recombined their vocabulary: a deck reading "every room argues its
  own case" produced "the exterior stays quiet so the rooms can argue".
- A rule shipped after a batch was stored did not clean that batch. Stored
  alternatives are now re-graded on read.
- The criteria used to say "WRITE ABOUT SOMETHING A READER CAN SEE", which is an
  instruction to inventory and caused the caption headlines. One of the GOOD
  examples was itself the balanced-pair shape.

## Verification

```
npm run check:headline              # criteria, rules, cycling, the editor's contract
npm run check:regenerate-surfaces   # the three regenerate surfaces and their asymmetries
npm run check:story-editing
```

There is no test runner. The project's idiom is static//fixture check scripts in
`scripts/check-*.ts`. Follow it.

## THE OPEN QUESTION — start here

**The editor has never made a live call.** There is no `ANTHROPIC_API_KEY` and no
database in the authoring environment, so layer 3 is unproven end to end. The
user was blocked from testing it by an unrelated production outage (connection
pool exhaustion, then a malformed `DATABASE_URL`) which is now resolved.

The next step is to press **New options** on a real project and read the logs:

```
[headline/regenerate] candidates   { requested, returned, survivedRules, editorCut, edited, kept, rejected, anglesCovered }
[headline/regenerate] editor cuts  { cuts: [{ text, why }] }
```

Three specific things to learn from that:

1. Does the editor actually kill "The kitchen stone dictated every finish around
   it"? That is the case it was built for. If it does not, the INTERCHANGEABLE
   criterion needs sharpening — not a new banned verb.
2. Is `editorCut` sane? If it is cutting 11 of 12 every time, the batch will keep
   emptying and the feature dies via `NO_USABLE_CANDIDATES`. If it is cutting 0,
   it is not doing anything.
3. Does the La Gorce interview contain enough *events* to fill six angles? If
   most angles come back weak, the fix is upstream in the interview, not here.

Test project: `dda4b29e-dbdf-4f54-ad21-32dafd4d1dd4` (La Gorce).

Known cost: the editor is a **second model call per regenerate**, roughly
doubling the button's latency.

## Unrelated loose ends, still open

- `#754` is open (a better diagnostic for a malformed `DATABASE_URL`).
- `fixSentenceOpeners` does not run on section regenerate.
- `/product/[productId]` and `/events/[id]` share the Full Route Cache staleness
  that was fixed for `/p/[slug]`.
- `/api/admin/re-extract-lead-pull-quotes` still mines body prose rather than the
  interview.
