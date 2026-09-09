# Quote Standalone Distribution

**Status: MEASURED — 6 projects, 16 rooms, 0.0% of rooms have zero standalone
candidates.**

Measured by the founding cohort's owner against real data; this document
describes the method and records the result. Re-run to refresh the numbers:

```
npm run report:quote-standalone
```

It needs `DATABASE_URL` (that is the datasource url; `DIRECT_URL` is migrations
only and is not a fallback). The script loads `.env.local` then `.env` itself
before importing the Prisma client, so an ordinary local checkout needs no extra
setup.

**What the result licensed.** Because no room came up empty, quote mode can
offer standalone candidates only, and context lines were not needed. Both
followed from this number and neither was built.

**What it does not license.** 0.0% is a floor on six projects the interview was
tuned on, and every approximation in the scorer leans toward calling a span
standalone. A colder designer can still produce a room with nothing that reads
alone. That case is reported, not blocked:

```
npm run report:quote-ranking
```

The measurement is read-only: it calls `extractQuoteCandidates` exactly as the
generator does and scores what comes out. No article field is written.

**Since this was first measured, the scorer became a ranking input.**
`extractQuoteCandidates` now offers standalone candidates first, using the same
predicate described below — it lives in `src/lib/posting/quoteStandalone.ts` and
has exactly one implementation, so the measurement and the product cannot drift
apart. It ranks; it never filters. `selectPullQuotes` is unchanged.

---

## The question this settles

In published mode the reader sees the room photo and the quote; the body is behind
a click. A quote whose referent lives in the hidden body does not read on its own.
From project `dda4b29e`, Dining Room:

> "It remains agreeable, but still on theme for the rest of the house for sure"

"it" has no antecedent once the body is collapsed.

**The headline number is the share of rooms with ZERO standalone candidates** —
the rate at which quote mode comes up empty under a standalone-only rule.

---

## The rule, in full

A percentage is only as honest as the predicate under it. Three verdicts, and the
middle one exists so a genuinely uncertain call is counted rather than forced.

### NOT STANDALONE — positional, no judgement

| | Test |
|---|---|
| **F1** | Opens with a bare referential pronoun or demonstrative: `it, this, that, they, them, those, these, he, she, him, her`. |
| **F2** | Opens with a continuation conjunction: `but, and, so, because, which, though, although, plus, also, then, yet`. Grammatically dependent on a sentence that is not there. |
| **F3** | Opens with a comparative or additive implying a prior term: `same, another, other, more, less, better, worse, too, either, neither, likewise`. |

Two carve-outs inside F1, both deliberate:

- **First person is never a failure.** `I, we, my, our, us` — the speaker is resolved
  by the attribution line. Generic `you` likewise: "you walk in and…" is idiomatic
  design speech, resolved by the photograph.
- **A demonstrative followed by a noun carries its own referent.** `this room`,
  `that decision` pass; `that was`, `this means` fail, because there the
  demonstrative is a pronoun and its referent is elsewhere. Told apart with a list
  of auxiliaries and high-frequency verbs.

### AMBIGUOUS

**A1** — a bare third-person pronoun or demonstrative appears *after* position 0
and no plausible antecedent precedes it inside the span.

"Plausible antecedent" is approximated without a POS tagger, which is exactly why
this is ambiguous rather than a failure. A token counts as a possible noun when it
is a member of a small interior-design noun lexicon, or is any content word — not
a function word, not an auxiliary. So `Matto chose glass so it would not eat the
floor` resolves ("glass"), while `Nothing about it was accidental` does not.

### STANDALONE

Everything else.

### Deliberately not tested

Whether the sentence is interesting. Whether it is a fragment. Whether a mid-span
comparative ("more timeless") lacks its second term. Each needs a parser to call
correctly, and a wrong call in either direction would move the headline number.

---

## Verification performed

**The rule — 13 fabricated spans, `--self-test`, all passing.** Including the live
`dda4b29e` example, both F1 carve-outs, all three failure classes, and the A1
boundary in both directions. Two genuine bugs were found by writing these and
fixed before anything else: `That was the decision…` was reading as
determiner-plus-noun rather than a pronoun, and the antecedent proxy was too narrow
to see `glass` in `Matto chose glass so it…`.

```
npx tsx scripts/measure-quote-standalone.ts --self-test
```

**The pipeline — `--fixture`, three fabricated projects through the real
`collect()` and `writeReport()`.** Same code path as the database run; only the
source of the projects differs, because a fixture that goes through a different
path proves nothing about the real one. Writes to the OS temp directory, never
into `docs/`.

```
npx tsx scripts/measure-quote-standalone.ts --fixture
```

---

## Known bias, stated before the numbers exist

Both approximations lean the same way, and it is worth knowing which way before
reading a percentage off this.

- **A1 under-fires.** The content-word antecedent proxy is generous: `The reason it
  worked was the light` passes because "reason" precedes "it", though "it" has no
  real referent. A POS tagger would fire A1 more often.
- **The verb list behind the F1 carve-out is incomplete.** A verb missing from it
  makes `that <verb>` look like determiner-plus-noun, so the span reads as
  standalone.

**Both push the standalone count up.** The measured empty rate is therefore a
*floor* — the true rate at which quote mode comes up empty is at least this high,
possibly higher. The verdict table gives both bounds: treating every ambiguous
candidate as a failure is the pessimistic reading.

---

## Limits the run will report

Carried in the generated document, listed here so they are visible before it runs:

- **Projects with no interview answers at all** are excluded. They have no pool in
  either mode, so counting them would deflate the empty rate.
- **Projects whose answers are all unroomed (`General`)** are reported separately.
  Their answers never reach a room chapter.
- **Chapters with no room-labelled answers behind them** are counted. These can
  never offer a quote in either mode — a floor on quote-mode coverage that is
  independent of the standalone rule, and the number most likely to be confused
  with the headline.
- **Rooms with an empty candidate pool are excluded from the room count.** The
  headline is "of rooms that could offer a quote at all, how many can offer a
  standalone one".
- **Articles generated before the current extractor** are scored on candidates
  re-derived from their answers today, not on whatever shipped at the time. This
  measures what the toggle would offer now, which is the decision at hand.

---

## What the generated document contains

1. The headline number — share of rooms with zero standalone candidates.
2. Distribution per room: 0 / exactly 1 / 2 / 3+ standalone candidates.
3. Verdict totals across all candidates, giving both bounds.
4. Article-level variance — per project, rooms clearing vs not, and whether each
   project reads uniform or mixed.
5. Per-room detail for every scored room.
6. The 20 clearest non-standalone candidates (positional failures only, so the
   selection involves no judgement), each with the sentence preceding it in the
   source answer — so you can see whether the referent is recoverable there or
   lives further back.
