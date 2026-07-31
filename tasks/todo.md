# Editorial generation failures for a 10-room project (branch: claude/interview-generation-audit-xhlosb)

Two sequential blockers on the same project (`dda4b29e`, 10 write rooms). The
first was fixed, which revealed the second. Part 2 is at the bottom.

---

# Part 1 — LLM_JSON_PARSE

## Problem (reported)
Correlation `generate_09e1580e3de6`, project `dda4b29e…`: a 2-minute generation
completed cleanly (`stop_reason: end_turn`, 5,259 output tokens against a 10,000
cap — **not** truncation) and was then thrown away:

```
[generate] JSON parse failed — hard-failing (no repair)
  error: "Expected ',' or ']' after array element in JSON at position 15799"
  snippet: …but this quickly became "⟪HERE⟫it."' The Archipielago Honed…
  rawLength: 20256
```

## Root cause
The model emitted an **unescaped straight double quote inside a prose string**.
Read the snippet's nesting: the outer designer quote is delimited with `'`, and
the quotation nested inside it uses a raw `"`. In JSON that `"` terminates the
string 15,799 bytes in; the following characters (`it."'`) are then garbage where
a `,` or `]` was expected, so all 20KB is unparseable.

The prompt caused this in two reinforcing ways:

1. **It mandates quotation marks in almost every paragraph.** "Include at least
   1 direct attributed quote per gallery chapter" (×10 chapters here) plus "EACH
   PARAGRAPH in a gallery chapter MUST include at least one direct quote."
2. **Its own examples taught the failing shape.** Every example was written as a
   TypeScript-ish string literal — `'"[Quote]," ${designer} says.'` — so the
   model imitated the delimiters it saw: single quotes at the outer level, `"`
   for the nested level. Nothing in the prompt said how to escape a `"` for JSON,
   and `- Return ONLY valid JSON.` was the only formatting instruction.

So this was not bad luck. The prompt asked for prose dense with quote marks,
modeled mixed quote characters, and left escaping to chance. The diagnostic added
in PR #710 did its job perfectly: the snippet identified the exact offending span
without replaying the run.

## Fix
- [x] `JSON_PROSE_QUOTING_RULE` in `src/lib/interview/prompts/editorialTone.ts`
      (the canonical prompt-fragment module, alongside `FOLIO_TONE`): prose uses
      typographic curly quotes — `“ ”` for direct speech, `‘ ’` for nesting.
      **This removes the escaping requirement rather than restating it**: curly
      quotes have no meaning in JSON, need no escape, and cannot terminate a
      string early. They are also correct magazine typography, so this is an
      improvement, not a workaround.
- [x] Injected the rule into the generator's output-format section and restated
      it in CRITICAL RULES.
- [x] Rewrote every prose example in the prompt to use curly quotes, and dropped
      the single-quote example wrappers that taught the mixed-delimiter habit.
- [x] Same rule + same example rewrite in the per-chapter regenerate route,
      which shares the root cause verbatim.
- [x] **One automatic resample** on parse failure (`MAX_PARSE_ATTEMPTS = 2`,
      temperature 0.7 → 0.3, rule restated). This is regeneration, not repair —
      exactly the action the error message already asks the designer to take by
      hand. The resample is never shown its broken output, because handing that
      back invites "fix the JSON around whatever prose is salvageable", which is
      the corrupting repair path in a different costume. `LLM_TRUNCATED` and
      `LLM_EMPTY_RESPONSE` still fail immediately (resampling hits the same
      deterministic ceiling).
- [x] `proofOutsideQuotes` is now curly-aware. It split on `"([^"]*)"` only, so
      once the model emits curly quotes it would have treated the designer's
      quoted words as unquoted prose and rewritten inside them — breaking its
      own "never alter quoted text" contract.
- [x] Regenerate route: distinguish "model returned no JSON array" (plain prose →
      blank-line split is safe) from "model returned an array that won't parse"
      (→ 502). The old code splice-split the broken array, publishing `],` and
      key names into paragraphs — the corruption `lessons.md` already forbids.

## Verify
- [x] `npm run check:json-quoting` — 19 checks, all passing:
      - the production payload still fails to parse, and
        `describeJsonParseFailure` still localizes it (the diagnostic must not
        regress — it is how this bug was diagnosable at all)
      - the curly-quote form of that same paragraph parses, verbatim, unescaped
      - pull-quote extraction returns **identical** text for curly and straight
        input (the regexes already matched `“`/`”`, so nothing downstream changed)
      - `proofOutsideQuotes` is byte-identical to the implementation it replaced
        across 7 straight-quote fixtures, and now leaves curly speech alone
- [x] `npx tsc --noEmit`: 4 errors in the touched files, all pre-existing and
      unchanged (verified against a `git stash` baseline) — 2× `LLMResult`
      narrowing in `callLLM` callers, 1× ES5 `z.infer` async return.
- [ ] Not verified: a live generation. Needs `ANTHROPIC_API_KEY` and a real
      project, so the model's actual compliance with the curly-quote rule is
      unproven in production. Watch for `[generate] json_parse_recovered_on_resample`
      (rule ignored but recovered) vs. a persisting `LLM_JSON_PARSE` (rule not
      working — escalate to tool-use/`input_schema`, which makes the API
      serialize the JSON instead of the model).

## Notes
- **What did NOT need to change:** `extractPullQuotesForChapter`,
  `isArticleHookQuote`, `syncPullQuotesFromChapters`, and `scrubProse` are all
  already quote-character agnostic or curly-aware. Existing published posts keep
  their straight quotes and render/extract exactly as before — no backfill.
- **`composeEditorial` / `composeEditorialHard`** (`interview/generate/route.ts`
  :1319) share the flaw but are dead code — the POST handler calls
  `generateEditorialDraft` (see that file's comment at line 209). Left alone.
- **`spliceHookQuote`** hand-parses JSON too, but it is one short field, the
  prompt already says not to include quotation marks, and a parse failure is
  caught and falls back to regex extraction. Not worth the prompt noise.
- **Pre-existing bug, not fixed (out of scope):** `quoteBeforeAttr` at
  `generateEditorialDraft.ts:349` calls `designerName.split(/\\s+/)` — that regex
  matches a literal backslash followed by `s`, not whitespace, so `.pop()`
  returns the whole name instead of the surname. The attribution group is
  optional, so the regex still matches, which is why it went unnoticed. Worth a
  follow-up.
- **Cost:** the resample fires only after a parse failure, which should now be
  rare. Worst case is one extra Sonnet generation on an already-failed request —
  strictly cheaper than the designer clicking regenerate themselves.


---

# Part 2 — LLM_REPAIR_FAILED: a derived index capped at 5

## Problem (reported)
Correlation `generate_019bb0c31bfc`, same project. Part 1's fix worked — the
model produced valid JSON on `attempt: 1`, no resample needed:

```
[generate] llm_ok { attempt: 1, stopReason: 'end_turn', outputTokens: 5270 }
[GENERATE] LLM call complete, proceeding to repair
```

Then validation threw and the draft was discarded anyway:

```
[GENERATE] repairAndBuildBlocks THREW: [{ "code": "too_big", "maximum": 5,
  "path": ["pullQuotes"], "message": "Too big: expected array to have <=5 items" }]
[generate] generation failed: { code: 'LLM_REPAIR_FAILED' }
```

## Root cause
`BlocksSchema.pullQuotes` carried `.max(5)`. But `pullQuotes` is **not** an
editorial selection — the prompt explicitly forbids the model from emitting it
("Do NOT generate a pullQuotes array"). It is a **derived index**, built by
`syncPullQuotesFromChapters` as the hook quote at index 0 followed by one entry
per gallery chapter, keyed by chapter title.

Its length is therefore a function of `galleryChapters`, which is **uncapped** —
a house has as many rooms as it has. So a cap of 5 on the derived index imposed a
hard ceiling of **4 rooms** on the entire product. The repro confirms it: 4 rooms
pass, 5 rooms fail. This project has 10.

Two further signals that the cap was stale rather than intentional: the same file
declares `pullQuotes` twice more (lines 55, 109) with **no cap at all**, and the
per-chapter `pullQuote` field it derives from is itself uncapped.

## Fix
- [x] Removed `.max(5)` from `BlocksSchema.pullQuotes`, with a comment explaining
      that the field is a derived index whose cardinality follows an uncapped
      source. Per-entry limits (300-char text, 80-char context/sourceSection) and
      `.strict()` on unknown keys all still bind — only the array length changed.

**Why not truncate to 5 instead:** the index has a second job. `layoutEngine.ts`
looks entries up by `sourceSection` (chapter title) as its per-chapter fallback
for older drafts. Dropping entries would silently break that lookup for chapters
6+, and there is no editorial basis for choosing which 5 survive — it would be
first-5-by-room-order, not by score. That is "repairing unknown data by dropping
it", which `lessons.md` already warns against.

## Verify
- [x] `npm run check:blocks-bounds` — 15 checks. Written as a **reproduction
      first**: it failed 6/15 against the old schema (naming the exact ceiling —
      4 rooms pass, 5+ fail), and passes 15/15 after the change.
      - the derived index is hook + one per chapter, hook at index 0 with no
        `sourceSection` (the property `buildRoomTiles` relies on for the lead)
      - every chapter is represented, so the `sourceSection` lookup resolves
      - 1/4/5/6/10/20/37 rooms all validate
      - per-entry limits and `.strict()` still reject bad data
- [x] `npm run check:json-quoting` still 19/19 (Part 1 intact).
- [x] `npx tsc --noEmit`: same 4 pre-existing errors, unchanged.
- [ ] Not verified: a live generation past this point. The next stage
      (`applyProseNamingGate`, then persistence) is unexercised for a 10-room
      draft.

## Notes
- **Audited the other bounds for the same shape** — a capped schema field fed by
  an uncapped producer. `introduction` is `.max(4)` (prompt asks 2-3);
  `method`/`qa` aren't generated; `materialsLedger.items` and `credits` are
  uncapped. `galleryChapters[].imageIds` is `.max(8)` and **every live path
  slices to 8** before assembly (lines 752, 788, 830), so it is safe.
- **`groupImagesIntoChapters`** (line 160) builds uncapped `imageIds` and would
  violate `.max(8)`, but it has **zero callers** — dead code. Left in place;
  flagged rather than deleted since removal is unrelated to this bug.
- **Duplicate pull-quote rendering in the article preview — FIXED.**
  `RichArticle.tsx` (the designer's article preview at
  `/designer/projects/[id]/preview`, and the published `PostView` via
  `ProjectMediaHub`) renders each chapter's own pull quote inside that chapter's
  section — room title, prose, quote, images together. That is correct and is
  what a designer wants: one quote per room, shown with its room.

  But it ALSO rendered the top-level `pullQuotes` index as a stacked list near
  the top. Since that index is derived from those same per-chapter quotes, every
  room quote appeared **twice** — once detached in the stack, once in its room.
  The `.max(5)` cap had been masking the scale (a draft could never carry more
  than 5); with the cap lifted, a 10-room project would have shown 11 stacked
  duplicates.

  Fix: the top stack now excludes any quote a chapter already renders. What
  survives is exactly what has no chapter of its own — the spliced lead/hook
  quote — plus, for legacy drafts whose chapters carry no `pullQuote`, their
  entries (so old posts do not lose quotes). No room quote was removed; the
  duplicate was.

  Covered by section 5 of `check:blocks-bounds`: 10 rooms → 1 entry in the stack
  (the hook), all 10 room quotes still rendering in their own sections, and the
  legacy-draft case still showing its quotes.


---

# Part 3 — Room prose matched to the wrong room

## Problem (reported)
Parts 1 and 2 unblocked generation, and the draft rendered. Every chapter then
showed one room's title and photographs beside a **different room's prose**,
through all 10 rooms. Reported with three screenshots:

| Heading + image | Prose actually about | writeRooms index |
|---|---|---|
| Dining Room (0) | Exterior — facade, "before you open the front door" | 6 |
| Living Room (1) | Entry — "the entry sets the register", stairway | 8 |
| Primary Bathroom (2) | Formal Living Room — fireplace, green marble | 9 |

## Root cause
`repairAndBuildBlocks` built each chapter from three sources — two keyed by room
name, one by array position:

```js
const roomName     = writeRooms[i];                       // title  — by name
const roomImageIds = imagesByRoom[roomName];              // images — by name
const bodyParas    = proofBody(composedChapters[i]?.body) // body   — BY INDEX
```

The index read assumed the model returns chapters in prompt order. It reordered
into a narrative walkthrough (exterior → entry → formal living room → …). Title
and images stayed name-keyed and so corroborated each other, which is why the
result reads as plausible until you look at the photograph.

## Fix
- [x] Join on the chapter title, which the prompt already required to name its
      room. Two passes — exact, then whole-word containment — with longer room
      names first so "Formal Living Room" claims its chapter before "Living
      Room". Each chapter claimed at most once.
- [x] Unmatched rooms demote to photo-only (the existing path for skipped
      rooms). **No positional fallback** — a room with photos and no prose beats
      a room captioned with another room's story.
- [x] Log unmatched rooms and unplaceable chapters; a rising count means the
      title contract is drifting.
- [x] Prompt states the title is the join key and chapters may be written in any
      narrative order.

## Verify
- [x] `npm run check:room-matching` — 19 checks: replays the real walkthrough
      ordering and asserts each reported case by name; asserts the old index
      pairing mismatches all 10 (the fixture reproduces the bug); covers the
      Living Room / Formal Living Room ambiguity both ways; asserts no shared or
      leftover-assigned chapters; covers name shapes. Check 0 greps the shipped
      source so the positional read cannot return.
- [ ] **Not verified: a live generation.** The matcher is proven; model title
      compliance is not. Watch for `chapter/room title match incomplete` — a
      non-empty `unmatchedRooms` means a room went photo-only, which is now the
      failure mode instead of wrong prose.


---

# Part 4 — Confirming Regenerate shares the prompt, and hardening to one path

## Question (reported)
"Confirm the regenerate button in the story tab is wired to the same prompting as
the initial generation prompt... harden the route so there are not multiple
generation routes ever."

## Answer: yes, already shared
`StagingPublishPanel` Regenerate → `handleRegenerate()` → `generateDraft()` in
`usePublishFlow.ts` → `POST /api/posting/project/[projectId]/interview/generate`
— the same route as initial generation, hence the same prompt. Confirmed by
trace, and now by `check:single-generator`.

## But the audit found two alternate paths sitting in the tree
Both dead, both looking live to a reader:

1. `composeEditorial` + `composeEditorialHard` + `buildEditorialPrompt` +
   `EDITORIAL_SYSTEM_PROMPT` inside the generate route — **a full second copy of
   the editorial system prompt**, 1,169 lines, zero callers.
2. `src/lib/editorial/getOrCreateEditorialDraft.ts` — a second GenInput builder
   calling the canonical generator, 315 lines, zero callers.

They had already rotted: `tsc` reported 8 errors inside the route's dead block,
including `Cannot find name 'proofOutsideQuotes'` / `splitLongParagraph`, because
those helpers moved to `generateEditorialDraft.ts` and the copies were never
updated. That code could not have run.

## Fix
- [x] Deleted both (1,484 lines). Repo-wide `tsc` errors 1032 → 1023.
- [x] Fixed the two comments that described `getOrCreateEditorialDraft` as "the
      other caller" / "both generation paths".
- [x] Added `npm run check:single-generator`, a structural guard asserting:
      one caller of `generateEditorialDraft`; the full-article prompt defined in
      exactly one file; no `composeEditorial*` / `buildEditorialPrompt` /
      `getOrCreateEditorialDraft` path exists; `generateDraft()` still targets
      `/interview/generate` and has no second generation endpoint; both
      prose-in-JSON prompts import `JSON_PROSE_QUOTING_RULE`; and the room join
      is still title-keyed.

## Verify
- [x] All 15 guard checks pass.
- [x] **Guard proven to fail**: re-adding a `composeEditorial` with the prompt
      signature trips 2 checks and exits non-zero. Restored after.
- [x] `check:room-matching`, `check:blocks-bounds`, `check:json-quoting` all pass.
- [x] Kept helpers verified still referenced; POST handler intact.
- [ ] Not verified: a live Regenerate click. The route is unchanged, so risk is
      low, but the deletion was large.

## Notes
- `cleanParagraph`, `SectionsSchema`, `ARRAY_FIELDS` are also unreferenced, but
  were **already** dead before this change and are unrelated to generation. Left
  alone to keep the diff scoped.
- The per-chapter `sections/[chapterIndex]/regenerate` route keeps its own
  narrower prompt by design (it rewrites one chapter, not an article). The guard
  allows it but asserts it shares `JSON_PROSE_QUOTING_RULE`.


---

# Part 5 — The Regenerate dialog's "direction" box was a no-op

## Question (reported)
"Confirm when I press regenerate where this feedback is submitted. Is it just
injected into the prompt?"

## Answer: it was submitted nowhere
`regenFeedback` had 4 references — declared, `value`, `onChange`, and cleared on
submit. Never read. And the concept was absent at every layer below:

| Layer | State |
|---|---|
| `handleRegenerate()` | calls `generateDraft()` with no arguments |
| `generateDraft` | signature `() => Promise<void>` |
| POST payload | no feedback field |
| generate route | zero references to feedback/direction |
| `GenInput` | no field to carry it |

Never wired (not a regression): `usePublishFlow.ts` has never contained
"feedback" in its git history.

The harm was not neutral. Generation runs at temperature 0.7, so every
regeneration returns different prose — the box validated itself.

## Decision: deleted (user agreed)
Wiring was ~30 lines across four layers, but whole-article regeneration is the
wrong instrument for steering tone: ~2 minutes, rewrites all rooms, drops
unpreserved edits. Per-section feedback already does this correctly and cheaply
(`SectionFeedback` → `sections/[chapterIndex]/regenerate` → note injected into
that chapter's prompt, and persisted). The dialog now points there.

- [x] Removed the input, its state, and its reset.
- [x] Added a line directing designers to per-section feedback.
- [x] Left a comment at the call site explaining why no such input belongs here.
- [x] `keepEdits` / override preservation, Cancel, and Regenerate untouched.
- [x] No `regenFeedback` references remain; no new tsc errors.

## If global direction is wanted later
Build it as a **persisted project-level editorial direction** beside
`includeBio` / `includeProjectHistory` — typed once, applied to every generation,
visible as project state — rather than a one-shot note that implies each
2-minute regeneration is a cheap iteration.
