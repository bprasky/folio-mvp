# Editorial generation dies on LLM_JSON_PARSE (branch: claude/interview-generation-audit-xhlosb)

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
