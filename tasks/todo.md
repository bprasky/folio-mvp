# Regenerate surfaces: section, headline, pull quote

## What the section-regenerate button connects to

`SectionFeedback` → `POST /sections/[chapterIndex]/regenerate`. The context work
is genuinely right: it buckets answers into thisRoom/otherRoom, labels them
"PRIMARY source for quotes" vs "context only — do not repeat", tags follow-ups
as the richest material, fetches that chapter's product tags, preserves title /
imageIds / pullQuote, and writes the previous body to sectionHistory for undo.

Four things were wrong.

1. **It bypassed the Product Naming Gate.** `resolveProductNaming` appeared in
   exactly one file in the app — generateEditorialDraft. Section regenerate
   wrote `chapters[i].body = newBody` straight to the DB. One button press put
   an unsubscribed vendor's product name back into a published article, with
   nothing downstream to catch it. A commercial gate one writer can walk around
   is not a gate. Now extracted to `src/lib/naming/applyProseNamingGate.ts`,
   called by both paths.
2. **The prompt could instruct fabrication.** With no matched answers,
   `answersText` became the literal string "No interview data available." while
   the instructions still said "MANDATORY: Include at least 1 direct attributed
   quote using their actual words from the interview." Now refuses (422
   NO_ANSWERS / NO_ROOM_ANSWERS).
3. **Room matching was a naive substring.** `chapterTitle.includes(roomName)` —
   "Entry" matches "Entryway", in both directions, so one room's answers became
   another's PRIMARY quote source. The hazard `check-editorial-room-matching.ts`
   already guards in the main generator. Now whole-word.
4. `provenance: true` selected and never read. (Left as-is; the
   EditorialInterviewAnswer projection is maintained by syncInterviewAnswers, so
   the route does get answers — the guard in 2 is what makes a stale projection
   fail loudly instead of silently.)

Not fixed: `fixSentenceOpeners` still doesn't run on a regenerated section, so
it can drift into the "The [noun]…" pattern the main pipeline repairs.

## Headline regeneration

Built as a BATCH, not a swap. One press = ~8 candidates, filtered by
`headlineIssues` (the same machine check the generator's headlines face), keep 6,
store as `lead.kickerAlternatives`. The live headline is untouched until the
designer cycles onto one. An all-bad batch offers nothing (422) rather than the
least-bad.

The reason: a button that swaps one fresh headline per press is a slot machine —
press three can be worse than press one with no way back, which trains people not
to touch it. That was the stated worry ("if it's more random... we will want to
eliminate the feature") and it is a design problem, not a prompt problem.

Criteria now live once, in `editorialTone.ts` as `HEADLINE_CRITERIA`, referenced
by both the generator and the endpoint. Two copies would mean a regenerated
headline graded by different rules than the one it replaces.

## Pull quotes: selected, never written

The picker built in the previous session put an `EditableParagraph` on the quote
text, saving through `PATCH /sections/override` — which wrote arbitrary text into
`pullQuote.selected.text` with no validation, unlike `PATCH /sections/pull-quote`
which rejects any selectedText not in `alternatives`. Two endpoints over one
field under two contracts; the weaker one wins by definition. Quote is now static
text with cycle/remove only, and the override endpoint refuses `pullQuote`.

**On AI ranking at cycle time: no.** The ranking already happened —
`selectPullQuotes` calls the model once at generation, it returns candidate IDs,
and `alternatives` is stored in rank order with scores. Cycling already walks an
AI-ranked list. A second call per arrow press would cost money per click, add
latency to a button, and make the same click produce different orders on
different days — the exact unpredictability we are trying to remove.

## The asymmetry worth keeping

A headline is the model's sentence, so the designer may type their own.
A pull quote is a claim about what they said out loud, so it can only be
selected. The two controls look alike; only one has a text field.

---

# Headline criteria and capitalization

## What was there

The entire specification for the article headline was one line, inside a JSON
shape comment:

    "kicker": "A headline capturing the project's singular idea — not generic (8-15 words)"

No capitalization rule anywhere — not in the prompt, not in FOLIO_TONE, and no
normalization after. `sentenceCap` and `cleanParagraph` in the generate route
are dead code (zero call sites), as is `SectionsSchema`. So headline case was
whatever the model produced that run, with nothing to be consistent with.

The shipped result: "A Miami Beach house that refuses to pick one mood and wear
it all the way through" — 17 words against a stated 8-15 (unenforced; the only
hard limit is 120 CHARACTERS, and it is 81), in the "X that refuses to Y" shape,
which is the same family as "the kind of [noun] that [clause]" already banned for
body prose. The banned-phrase list is framed for body copy and the headline is
generated in the same call with no reference to it.

The headline also duplicated the deck: both stated the thesis, so the deck had
nothing left to add.

## Decisions (founder)

- Sentence case. Capitalize first word and proper nouns only.
- 4-10 words.

## What changed

- A real HEADLINE block in the prompt: length, capitalization with an explicit
  counter-example, the swap test for specificity, division of labor with the
  deck, seven banned shapes, four concrete good examples.
- `src/lib/posting/headline.ts` — `normalizeHeadline` (safe transforms only) and
  `headlineIssues` (detection). Applied at assembly; drift is logged.
- Override route keeps a legacy `lead.title` in step with `kicker` edits.

## The call worth remembering

Sentence case is NOT auto-enforced, deliberately. Lowercasing a Title Case
headline requires knowing "House" is a common noun while "Miami Beach" is a
place, and every heuristic for that (lowercase if the body uses it lowercase;
preserve capitalized bigrams) breaks on exactly the ambiguous words. "Miami
beach" on a published page is worse than the Title Case it replaced. Since the
designer now edits the headline in place in the preview, a flagged headline
costs seconds; a mangled proper noun costs a correction on a live page.

Same posture as LLM_QUOTE_UNVERIFIED: surface it, don't paper over it.

`looksTitleCased` is a heuristic, not a gate — a genuinely proper-noun-heavy
headline ("Inside Diano Matto's Miami Beach house") trips it. That is asserted
in check-headline.ts so it stays known, and costs one log line.

## Not done

Regeneration is required to see a new headline; the existing draft keeps its
current one until then. The banned-shape list is regex over known tics — it
catches the shapes we have seen, not novelty.

---

# Consolidate the Edit/Preview toggle into the preview

## Why

The staging panel runs two renderers over the same draft and asks the designer
to pick one: `EditableArticle` (a labelled form) and `StoryRenderer` (the real
Story Format). The toggle is not a view option, it is a tax — the designer edits
in a layout that is not the article, then switches to see what they actually
made. The headline is even rendered twice on screen today, once by the panel and
once by the form.

Target: one surface. The preview IS the editor.

## Constraint that shapes everything

`StoryRenderer` also renders the LIVE published article at `/p/[slug]`. Every
change here must be inert when no editing context is present. That is why edit
state travels by React context rather than props: the public page mounts no
provider, `useStoryEdit()` returns null, and the components render exactly as
they do today.

## Steps

- [x] 1. `StoryEditContext` — provider + `useStoryEdit()`. Owns overrides,
      save/revert against `/sections/override`, the editing-field cursor, and
      `router.refresh()`. Logic lifted from `EditableArticle`, not duplicated.
- [x] 2. `buildEditorialChapters` — keep `bodyParagraphs: string[]` alongside the
      joined `body` string. The override API is keyed by `paragraphIndex`; the
      join destroyed that identity.
- [x] 3. `buildRoomTiles` — carry `chapterIndex` (the true galleryChapters index,
      NOT the tile index — tiles are filtered) and `editorialParagraphs` onto
      `RoomTileData`.
- [x] 4. `RoomTilePair` — pass both through to every `QuoteTile` call site.
- [x] 5. `QuoteTile` — when editing: narrative always visible, one editable node
      per paragraph, pull-quote picker in place. Click-to-edit must not trigger
      the tile's click-to-expand.
- [x] 6. `StoryIntro` — editable title, project quote and intro paragraphs.
- [x] 7. `StagingPublishPanel` — delete the toggle, `viewMode`, and the duplicated
      title block; wrap the story in the provider.
- [x] 8. Retire `EditableArticle`; keep `EditableParagraph` + `SectionFeedback`.
- [x] 9. Move the pull-quote picker assertions in `check-pull-quotes.ts` to the
      picker's new home, or section 7 silently stops guarding anything.

## Review

Done. `npm run check:pull-quotes` (45 checks) and `check:quote-audit` green;
both files parse; `EditableArticle` deleted with no remaining importers.

What changed shape from the original plan:

- The pull-quote picker moved to `src/components/story/PullQuotePicker.tsx` as a
  shared component rather than being reimplemented in `QuoteTile`. It is the one
  surface where the verbatim guarantee is visible to the designer, so it stays
  one implementation. `check-pull-quotes.ts` section 7 now reads that path.
- `QuoteTile` gained an `isEditing` short-circuit around its `onClick`/`onKeyDown`
  rather than relying on `stopPropagation` at every leaf. Editing regions are
  wrapped in one `data-story-edit` container that swallows the bubble, so a
  future editable field cannot forget to opt out.
- Owners always see the narrative expanded. The collapsed teaser state is a
  reader affordance; an editor who has to expand each room to reach their prose
  is the same tax the toggle was.

---

# Any answer earns a write-up (branch: claude/story-tab-room-indexed-rtu92a)

## The rule that was there

`generate/route.ts` decided each room's fate with
`status === 'complete' && answered`, where `status` came from
`EditorialInterview.roomProgress` — a separate record, loaded behind a
try/catch, and (per the notes in this very repo) frequently null or stale. That
cost designers their own words twice:

1. **By design.** A room answered 2-of-3 was demoted to photos-only. What the
   designer actually said about it never reached the article.
2. **By accident.** `roomProgress` only reaches `'complete'` when the client
   explicitly posts that status from `finalizeRoomAndAdvance`; the answer-derived
   overlay never sets more than `in_progress`. So a room the designer genuinely
   finished was dropped whenever that record hadn't kept up — and if the
   `roomProgress` read failed outright, *every* room fell to gallery and the
   article had no chapters at all.

The `completedRoomIds` the client sent was never consulted for the decision —
only logged as a disagreement — so the Story tab could promise a write-up the
server had no intention of producing.

## The rule now

`answered > 0` → write-up. Read from `provenance.interview.payload.answers`,
which is written in the same atomic update as the answers themselves, so it
cannot disagree with what the designer typed. Rooms with nothing said stay
photos-only. `roomProgress` no longer decides anything.

`'skipped'` is deliberately not an exception — skip means "stop asking me about
this room", not "throw away what I already said", and a room skipped in silence
has no answers and lands in the gallery anyway. The skip confirm sheet promised
otherwise ("No write-up will be generated for it"), so its copy was corrected.

This also makes the Story tab honest: its Written up / No write-up yet split
**is** the generation rule now, so what the tab lists is what comes back.

## The prompt before generating

Partly answered rooms are written up, so the prompt is a heads-up, not a gate.
It fires once per session, names only the rooms under target with their counts,
says they will be shorter than the finished ones, and offers `Answer more first`
(jumps into the first one) or `Generate anyway`. Both surfaces got it: a new
`PartialRoomsConfirm` on the Story tab, and the interview modal's existing
quality-gate screen re-pointed from "we'll leave them out" to "they'll be
shorter".

`completedRoomIds` → `writeUpRoomIds` on the wire (server still accepts the old
name for one deploy), because a list containing partly-answered rooms could not
keep being called "completed". The modal's four separate notions of per-room
progress collapsed to one `answerCountByRoom` map that resume, write-up
eligibility and the partial notice all read.

## Verify

- [x] `npx tsc --noEmit` — 17 errors across `InterviewModal.tsx` and the
      generate routes, identical to the count before the change.
- [x] `npx next build` — succeeds.
- [x] Rule test (jsdom, 21 assertions) — Generate is enabled with only a
      partly-answered room; clicking it prompts instead of generating; the
      prompt names the partial room and its `2/3`, and names neither the
      complete room nor the silent one; it says the room is still written up
      and will be shorter; `Answer more first` opens the interview on that room
      without generating; `Generate anyway` sends `writeUpRoomIds` containing
      both the partial and the complete room, excluding the silent room and the
      project pseudo-room, with no legacy `completedRoomIds` field; a second
      Generate does not re-prompt.
- [x] Index regression (jsdom, 33 assertions) — unchanged and still passing.
- [ ] **Not verified: a live generation.** No database in this container, so the
      server split itself was reviewed, not executed.

---

# Story tab: from a flat answer log to a room index (branch: claude/story-tab-room-indexed-rtu92a)

## Problem

`?view=story` rendered every captured answer expanded, grouped by room, in one
column. A real project produces ~30 answers, so the tab was several screens of
uniform cards — nothing to scan, nothing collapsed, and no way to see at a
glance which rooms had been spoken about. `Generate draft` sat below all of it.
Project Credits sat below that, which asked the designer to name their
collaborators *after* the writing was done rather than before it.

## What shipped

A four-part index, top to bottom. Height is now roughly constant no matter how
much has been said.

1. **Progress header** — eyebrow / serif headline / one line of body, with the
   action row (`Restart`, `Resume interview`, `Generate draft`) and a
   rooms-answered coverage bar on the right. Generate is above the fold; there
   is no bottom-of-page band.
2. **The project** — the five fixed framing questions (`CLIENT_BRIEF`,
   `SCOPE_PARAMETERS`, `DESIGN_DIRECTION`, `SIGNATURE_IDENTITY`,
   `SURPRISE_PIVOT`, read off the `project-<CATEGORY>-<uuid>` id) as cards with
   a clamped excerpt and an Answered / Needs a line status.
3. **Written up** — one 4:3 photo tile per room with answers. All collapsed by
   default; clicking one opens a *single* detail panel below the whole grid
   (accordion, click again to close) listing that room's answers as
   question / answer / Edit rows.
4. **No write-up yet** — rooms with photos and nothing said, as low-weight
   dashed rows, not photo tiles. Clicking one opens the interview scoped to
   that room.

Editing is now always `AnswerModal` — a 620px focus-trapped dialog, never an
inline textarea. That is what lets a room panel stay one row per answer.

**Nothing is unreachable.** Rooms whose answers refer to a room that has since
been deleted still appear (named from coverage). Project-level answers outside
the five categories get their own cards. Every question the interview asks is
still reachable — nested under its room, not removed.

## Supporting changes

- `InterviewModal` gained `initialRoomId` (open scoped to a room the designer
  picked; implies `resume`, and wins over the answer-driven resume plan) and
  `initialMode` (skip the picker — "Re-record this answer" wants voice, not a
  choice). Both are additive and guarded; a room that no longer exists falls
  through to the existing plan.
- The `excludedRooms` sessionStorage stash was deleted. Its only reader was the
  old Story notice, and the "No write-up yet" section now says the same thing
  permanently instead of once.
- **Project Credits moved to the Rooms step** (`ProjectCreditsCard`, rendered by
  `MediaSection` when `currentStepKey === 'rooms'`). Moved, not duplicated —
  `StoryPanel` no longer imports `CreditsEditor`.
- The Story tab now receives photos with `roomId` / `displayOrder` (documents
  filtered out server-side) so each tile can draw its room's hero.

## Constraints held

Existing tokens only — no new colors, radii or shadows. Sizes map to `--type-*`
tokens where one matches exactly (`folio-body`, `folio-ui`, `folio-meta`,
`folio-h4`, `folio-quote`, `folio-eyebrow`); the spec's 30/26/20/17/12/11px are
written as literals, matching how the rest of the app writes off-scale sizes.
`lucide-react`, no emoji. Motion 150/220ms on `cubic-bezier(.2,.8,.2,1)` via
`ease-folio`; hover lifts 1–2px, never opacity-only. Tiles and answer rows are
real `<button>`s with gold 2px focus rings; the modal traps Tab and closes on
Esc.

## Verify

- [x] `npx tsc --noEmit` — 8 errors in `InterviewModal.tsx`, identical to the
      count on the branch point. No new type errors from any file touched.
- [x] `npx next build` — succeeds. Only pre-existing warnings (`FaNotes`,
      `getServerSession`, dynamic-route notices).
- [x] Markup smoke render (SSR, 19 assertions) — header copy, the three
      actions, the 220px coverage track, no "credits" and no "continue to
      publish" left on the tab; modal is a labelled `role="dialog"` with the
      question, `2 / 3` position, glass-inset textarea and both footer actions.
- [x] Behaviour test (jsdom + React `act`, 34 assertions) — coverage reads
      `2/3 rooms` off written-up rooms; the project section counts
      `2/5 answered` and renders all five cards with the right statuses;
      written-up counts `2 rooms · 3 answers`; each tile takes its hero from
      `displayOrder 0`; the under-target room shows `1 more to go` and the
      complete one shows no pill; rooms are collapsed on load; a tile click
      opens the panel with only that room's answers and marks the tile
      selected; opening a second room closes the first; clicking the open tile
      closes it; a row opens the answer modal prefilled with the right
      question, room and position.
- [x] Wiring test (jsdom, 18 assertions) — `Resume interview` targets the first
      room under its question target; a no-write-up row scopes to its own room;
      `Answer another question` scopes to the open room; `Re-record` opens in
      `realtime` on the answer's room and closes the modal; saving POSTs the
      full answer list once (merge by questionId), keeps `roomId`, closes the
      modal, updates the row in place, and leaves the panel open.
- [ ] **Not verified: the running app.** This container has no database, so the
      page was never driven end to end against real data — including the
      `initialRoomId` navigation *inside* `InterviewModal`, which needs the live
      room-pacing question set to exercise.

---

# Landing, draft hosting, and gate discipline (branch: claude/la-gorce-draft-publish-dp9ght)

## Problem (observed on La Gorce Dr Home)

A draft article exists (`GENERATED`), but the project opens with the tracker
saying **"Next · Tag products — Tag the products in your photos"**, the Publish
marker rendered as locked, and the draft sitting below on a surface the header
claims you haven't reached. Four distinct defects:

1. **A generated draft is not recorded as progress.** `deriveTrackerState`
   derives `reachedIndex` from step completion only, and the publish step's
   completion flag is `isPublished`. So a draft that exists but isn't published
   moves the tracker nowhere: the Publish marker is `locked` (no href, inert),
   and `currentIndex` falls back to `frontierIndex` (Tags) even while
   `?view=publish` renders the draft. The header contradicts the surface.
2. **Landing is hand-rolled, not derived from progress.** `defaultView` in
   `page.tsx` is its own branch ladder sitting next to the tracker's, so "land
   on the furthest progress achieved" is a coincidence rather than a rule.
3. **The Publish tab hosts Tags and Story.** It carries a product-tag review
   block + `ProjectImageTagger` modal, a "Redo Interview" button +
   `InterviewModal`, a readiness row that opens the tagger, and a no-draft state
   whose CTA generates the draft in place. Four surfaces that belong to the Tags
   and Story steps.
4. **The publish gate is absent on the live path.** `publishEditorial` — what
   the Publish button actually calls — has NO readiness check. The
   `computePublishReadiness` backstop lives in `publishProjectAction`, which
   only the designer dashboard's `PublishButton` uses. A designer can publish an
   article with uncategorized photos and zero tags. The UI button is ungated too.

## Plan

- [x] `computeTrackerState.ts`: a generated draft reaches the publish step
      (mirrors how `interviewInProgress` reaches the interview step). Add
      `PUBLISH_BLOCKED_COPY` so a reached-but-gated Publish step says what is
      blocking and routes there, instead of "Everything is in place."
- [x] `page.tsx`: derive `defaultView` from the tracker's `reachedIndex` step
      via one pure helper (`viewForStepKey`), so landing and the tracker cannot
      disagree.
- [x] `StagingPublishPanel.tsx`: remove the tagger and the interview modal;
      readiness rows and the no-draft state link to the owning step instead.
- [x] `publishEditorial`: enforce `computePublishReadiness().canPublish` on the
      server, and gate the Publish button + surface the reason on the client.

## Review

**1 — A generated draft now reaches the publish step.** `deriveTrackerState`
takes `draftExists`; the publish step (keyed off `copy[key].action === 'publish'`,
so it resolves to `share` in the concept sequence too) counts as reached when a
draft exists, exactly as the interview step already counted as reached from
`interviewInProgress`. Proven against the real modules with the La Gorce shape
(draft written, 4 of 10 photos untagged):

```
old  → reached: story   | lands: story   | publish locked: true  | active step: tags
new  → reached: publish | lands: publish | publish locked: false | active step: publish
```

The Tags marker still reads `done` and still reports `4 left`, so nothing is
hidden by moving the frontier forward.

**2 — Landing derives from the tracker.** `viewForStepKey` joins `stepHref` and
`activeStepKeyForView` as the third member of one mapping. `page.tsx` builds the
tracker twice from one `trackerArgs` object: once with no active step, purely to
read `reachedIndex` and open there; once after the view resolves, to highlight
the surface on screen. The old `defaultView` ladder is gone. Working projects
(inProgress / concept) keep the Boards rule — Boards is not a tracker step.

**3 — Publish tab hosts only publishing.** Removed the `ProjectImageTagger`
modal, the `InterviewModal`, the tagger-opening readiness row, and the no-draft
Generate button. Each is now a link to the step that owns the work. That left
`ProjectImageTagger` (806 lines, a second full tagging UI) with zero callers, so
it is deleted — the Tags step's inline surface is the only tagger now.

**4 — Gates enforced on the path that is actually used.** `publishEditorial` now
runs `computePublishReadiness().canPublish` before the transaction, guarding only
the first transition to public so unpublish/re-publish stays idempotent. The route
returns the action's own message with a 400 instead of flattening it to a generic
500. The panel's Publish button reads the server-derived `canPublish` rather than
its own `allRequired`, and when the gate is closed it becomes a link to the
outstanding work. The two REQUIRED checklist rows now mirror the server gate
exactly (rooms sorted, tags confirmed); "Cover image selected" moved to
recommended, since nothing gates on it.

**Also fixed:** the tracker's next-action zone collapses when its CTA would route
to the surface already on screen. Before, viewing Story showed a "Start interview"
CTA linking to `?view=story`, and the newly-reachable publish step would have
shown "Publish project" linking to `?view=publish` — both reloads of the current
page. The blocked-publish copy keeps its zone, because why a finished draft can't
ship is the one thing the Publish surface can't say for itself.

**Verification:** `next build` passes (only pre-existing warnings). `tsc` adds no
new errors — the three in `actions/projects.ts` are pre-existing and outside the
changed hunk. 26 assertions run against the real `computeTrackerState` /
`computePublishReadiness` modules covering the La Gorce case, rooms-blocked,
gate-open, fresh project, interview-underway, and concept-project paths: all pass.

**Not verified:** no database access in this session, so the assertions run on
constructed inputs rather than La Gorce's actual rows. The behavior should be
confirmed against the real project once deployed.

---

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
---

# Part 6 — LLM_JSON_PARSE, second occurrence (branch: claude/llm-json-parse-error-pvl9ra)

## Problem (reported)
Correlation `generate_71e2451a999f`, same project `dda4b29e…`, append-mode
recomposition (`frozen: 10`, `galleryRooms: 4`):

```
attempt 1 (temp 0.7): position 584 — …of BP Design — knew his eye… "⟪HERE⟫This family is one we…
attempt 2 (temp 0.3): position 482 — …was the natural call. "⟪HERE⟫This family is one we…
→ LLM_JSON_PARSE
```

Both attempts `end_turn`, 1,403 and 1,173 output tokens against a 4,096 cap — not
truncation. The Part 1 fix (`JSON_PROSE_QUOTING_RULE`) was in the prompt and being
ignored.

## Root cause
Not the rule — the context. **Two attempts at different temperatures failed on the
same sentence of the same paragraph**, which rules out sampling noise, so the
prompt itself had to be the cause.

The rule is four lines. The rest of the prompt, on this generation, was:

1. **10 published chapters** injected verbatim under "match their register" —
   every one straight-quoted, because they predate the rule.
2. **31 interview answers**, each wrapped by *our own template* as `A: "${answer}"`
   — 31 more demonstrations of the banned character, written by us.

The model matched the register it was shown. The failure landed in the
regenerated introduction, the first prose it wrote after reading all of it.

This is Part 1's lesson ("prompt examples are training data") applied to the half
of the prompt nobody hand-wrote: retrieved and previously-generated content is
example content too, and there is far more of it.

## Fix
- [x] `toTypographicQuotes()` in `editorialTone.ts`, next to the rule it enforces.
      Straight `"` only; apostrophes stay straight per the rule. A quote opens
      when it starts the text or follows whitespace/an opening bracket, and closes
      otherwise — which also turns a trailing inch mark (`96"`) into `96”`.
- [x] Applied to every prose-shaped value entering the generator prompt: interview
      answers, published chapters, frozen lead/introduction, project description,
      designer bio, project history, atelier summary.
- [x] `A: "${answer}"` → `A: “${…}”` in both prompts.
- [x] Same treatment in the section-regenerate route: current body, other
      chapters, answers, and the designer's free-text feedback.
- [x] Frozen fields are safe to normalize — the published lead, introduction and
      chapters are re-applied verbatim from `input` after generation, so the
      designer's stored text is never the normalized copy.
- [x] Same normalization in `spliceHookQuote`, which also returns prose inside
      JSON and reuses the designer's phrasing. Its failure is non-fatal (falls back
      to regex extraction), which is why it would have gone unnoticed.
- [x] **No repair path added.** The no-repair decision stands; this fixes the
      cause rather than reconstructing the damage.

## Verify
- [x] `npm run check:json-quoting` — 44 checks. Section 6 replays the actual
      failing paragraph: asserts it still breaks `JSON.parse` un-normalized (the
      diagnostic stays honest) and round-trips after normalization; asserts words
      are byte-identical modulo the quote glyph; covers apostrophes, inch marks,
      brackets, idempotency, empty input. Two checks grep the shipped prompt
      sources so the `A: "…"` wrapper cannot come back.
- [x] Section 7 re-runs `extractPullQuotesForChapter` and `proofOutsideQuotes`
      against normalized prose — unchanged.
- [ ] **Not verified: a live generation.** The context is now consistent with the
      rule, which is what failed; model compliance is not provable offline. Watch
      for `LLM_JSON_PARSE` on this project.

## Known limitation
The system prompt's banned-phrase list still uses straight quotes, deliberately —
it quotes *phrases to avoid*, not prose to imitate, and rewriting it would change
what those entries mean. If a third occurrence traces to it, that is the next
thing to normalize. The permanent guarantee is Anthropic structured outputs
(`output_config.format`), which makes malformed JSON impossible rather than
unlikely — it needs a model move off `claude-sonnet-4-6`, which does not support
it, so it is a deliberate follow-up rather than part of this fix.

---

# Part 7 — Sonnet 4.6 → Sonnet 5 migration (branch: claude/llm-json-parse-error-pvl9ra)

## Why now
`claude-sonnet-4-6` sunsets eventually and every AI surface in the product runs on
it. Migrating ahead of the cliff, rather than under it.

## What Sonnet 5 changes (and what breaks)
1. **`temperature` / `top_p` / `top_k` return 400** on non-default values. 29 call
   sites passed one. This is a hard failure, not a degradation — every one of
   those endpoints would 400 on the first request after the model swap.
2. **Omitting `thinking` now runs adaptive thinking.** Sonnet 4.6 ran
   thinking-off. Thinking shares the `max_tokens` budget with the response, so
   calls sized on 4.6 — and this repo has caps of 200, 256, 300, 400 — could
   spend the whole budget thinking and return nothing usable.
3. **New tokenizer: ~30% more tokens for the same text.** Per-token price is
   unchanged ($3/$15), so cost per call still rises. Output caps buy ~30% less
   prose than when they were chosen.
4. `budget_tokens` is gone (depth is `output_config.effort` now). Not used here —
   the repo had no `thinking` config at all.

## Decisions
- **Scope: `src/` + `services/interview-orchestration`.** The service keeps its own
  service-local `MODELS` by design; leaving it on 4.6 would just defer the same
  migration. 63 call sites total.
- **`thinking: { type: 'disabled' }` everywhere.** Holds Sonnet 4.6's behavior,
  latency and token profile exactly, so this stays an availability migration
  rather than a product change. Adaptive thinking is a per-surface experiment to
  run later, and it has to come with a `max_tokens` raise wherever it's turned on.

## Fix
- [x] `MODELS.sonnet` → `claude-sonnet-5` in both registries, with the Sonnet 5
      request rules written at the definition so the next call site inherits them.
- [x] Removed `temperature` from all 29 Sonnet call sites. The one Haiku call
      (sentence-opener fixer) keeps its `temperature: 0.6` — Haiku 4.5 still
      accepts it.
- [x] Added `thinking: { type: 'disabled' }` to all 63 Sonnet call sites.
- [x] `LEGACY_MODEL_IDS.sonnet46` + a matching `ANTHROPIC_RATES` entry, so a
      CostEvent written by an instance that hasn't picked up the deploy prices at
      $3/$15 instead of recording 0.
- [x] Editorial generator resized for the new tokenizer: 800 → 1100 tokens/room,
      floor 4096 → 5500. This one has a real `LLM_TRUNCATED` path and a history of
      hitting it. The 32K ceiling stays — it's a wall-clock guard, and wall-clock
      follows prose written, not how it's tokenized.
- [x] `callLLM` now logs `[llm] output truncated at max_tokens`. The other ~60
      caps were left alone deliberately: raising them all on a guess would inflate
      worst-case spend across the product, so the real cases get surfaced instead
      of predicted. Direct `messages.create` callers aren't covered by this.

## Verify
- [x] `npm run check:sonnet5` — 9 checks: both registries on Sonnet 5; no
      executable code naming the retired id; the retired id still priceable and
      priced identically; **all 63 call sites** free of sampling params and
      passing `thinking` explicitly (both scanned by bracket depth, so the check
      follows the object literal rather than line offsets); Haiku untouched.
- [x] `npm run check:json-quoting` — 44 checks still pass (Part 3 unaffected).
- [x] `tsc` — no new errors. `ThinkingConfigDisabled` exists in SDK 0.71.2 and
      `Model` carries a `(string & {})` fallback, so the new id typechecks.
- [ ] **Not verified: live calls.** No request has been made against
      `claude-sonnet-5` from this codebase.

## Watch after deploy
- `[llm] output truncated at max_tokens` — the tokenizer shift landing on a cap
  that was fine on 4.6. Raise that specific cap.
- `LLM_TRUNCATED` on editorial generation — same, for the resized generator.
- CostEvent totals: expect a rise from the ~30% tokenizer change at an unchanged
  rate. That is the migration, not a regression.
- Prose variety across regenerations. `temperature` is gone product-wide; the
  editorial generator still varies structure via its random paragraph
  distributions, but repeated regenerations of the same input will read more
  alike than before. If that becomes a complaint, the replacement is prompt-level
  variation, not a parameter.

---

# Part 8 — SDK upgrade + adaptive thinking behind a flag (branch: claude/llm-json-parse-error-pvl9ra)

## Why the SDK had to move first
`@anthropic-ai/sdk@0.71.2` predates adaptive thinking entirely:
`ThinkingConfigParam = ThinkingConfigEnabled | ThinkingConfigDisabled` — no
adaptive variant, and no `output_config`/`effort` at all. `thinking:
{type:'adaptive'}` was a type error, and the only other typed option
(`enabled` + `budget_tokens`) is the one Sonnet 5 rejects with a 400. Upgraded to
**0.115.0**, which adds `ThinkingConfigAdaptive`, `OutputConfig.effort`, and
`JSONOutputFormat` (structured outputs — see the follow-up note below).

Installed with `--legacy-peer-deps`, matching `vercel.json`'s own
`installCommand`. The peer conflict is pre-existing and unrelated (`openai` wants
zod 3, the repo is on zod 4; the Anthropic SDK accepts either).

## Fix
- [x] SDK 0.71.2 → 0.115.0 (root), and the services package pinned to match.
- [x] `src/lib/ai/thinking.ts` — per-surface opt-in, **off by default**:
      `ADAPTIVE_THINKING_SURFACES=editorial[,followups]`, effort via
      `ADAPTIVE_THINKING_EFFORT` (default `low`, not Sonnet 5's `high` — Sonnet 5
      at `medium` is already ~Sonnet 4.6 at `high`). Returns a
      `maxTokensMultiplier` because thinking shares the `max_tokens` budget.
- [x] Wired `generateEditorialDraft` (surface `editorial`) and all three posting
      interview follow-up routes — `followups`, `followups/single`,
      `followups/batch` (surface `followups`).
- [x] `[generate] llm_ok` now logs `adaptiveThinking` and `effort` beside
      `outputTokens`, which includes thinking tokens. Same figure lands in
      CostEvent per operation, so the A/B is readable without new plumbing.
- [x] **`firstTextBlock()` — the bug this nearly shipped.** Every call site read
      `content[0]?.type === 'text' ? … : ''`. With thinking on the response is
      `[thinking, text]`, so all four wired sites would have silently returned
      their fallback: an empty article (LLM_EMPTY_RESPONSE) and zero follow-ups,
      no error raised. Applied to all six Anthropic reads in these files, not just
      the flagged ones, so the next surface added doesn't hit it.
- [x] `.env.example` documents both vars and which surface to enable first.

## Caller audit (per the Path A/B lesson)
Follow-up generators enumerated before wiring. In scope: the three
`/api/posting/project/[id]/interview/followups*` routes, all called by
`InterviewModal.tsx` — the Sofia interview that feeds editorial generation.
**Out of scope and left disabled:** `/api/interview/respond` (a separate older
interview flow with a single caller, `useInterviewSession.ts`), `spliceHookQuote`
and `fixSentenceOpeners` (short utility calls inside editorial where thinking
buys nothing), the realtime voice service, and the interactive chat surfaces.

## Verify
- [x] `npm run check:sonnet5` — now 27 checks. Adds: flag defaults to off for
      both surfaces; enabling one does not enable the other; effort defaults to
      `low` and an invalid value falls back rather than reaching the API; a
      near-miss surface name (`editorials`) enables nothing; adaptive raises the
      budget. Plus the `content[0]` guard — asserts `firstTextBlock` reads past a
      leading thinking block, and greps the wired files so no `content[0]` read
      returns.
- [x] `npm run check:json-quoting` — 44 checks still pass.
- [x] `tsc` — **1032 errors before and after the SDK upgrade, byte-identical
      error-code distribution.** No new errors from the upgrade or the wiring.
- [ ] **Not verified: a live adaptive generation.** No request has been made with
      `thinking: {type:'adaptive'}`. The flag is off, so the deploy ships current
      behavior; the first real test is flipping it on one project.

## How to run the A/B
1. Deploy with the flag unset — confirms the SDK upgrade alone changes nothing.
2. Set `ADAPTIVE_THINKING_SURFACES=editorial`, regenerate one project, compare
   `[generate] llm_ok` `outputTokens` and read the draft. Watch for
   `LLM_TRUNCATED` — if it appears, raise `MAX_TOKENS_MULTIPLIER_WHEN_ADAPTIVE`
   (currently 2, a starting guess, not a measurement).
3. Only if editorial pays, add `,followups`. Note follow-ups are generated while
   the designer waits, so latency there is user-visible in a way it is not on a
   two-minute article.

## Follow-up now unblocked
SDK 0.115.0 brings `output_config.format` (structured outputs), which Sonnet 5
supports. That is the permanent fix for the `LLM_JSON_PARSE` class this branch
started on — it makes malformed JSON impossible rather than unlikely, replacing
the prompt-level curly-quote defence. Separate change; not bundled here.

---

# Part 9 — Model tiering: structured extraction to Haiku (branch: claude/llm-json-parse-error-pvl9ra)

## Principle this follows
Stated by the founder, and it governs every cost decision from here:
> "the most important thing is that user experience does not degrade in favor of
> rate limiting or cost saving. I would rather a full project cost me $5 to post
> and user experience is perfect… than burn api calls where rate limiting messes
> up output anyway."

So a call moves down a tier only when a wrong answer is invisible to the designer
or is corrected at the point of entry — never when it reaches a published page.

## Fix
- [x] `MODEL_FOR` in `src/lib/ai/models.ts` — call sites declare a TASK CLASS,
      the table maps class → model. Reversibility is the point: if a class
      regresses, one line moves it back instead of hunting scattered swaps.
- [x] Moved to `extraction` (Haiku 4.5, $1/$5 vs Sonnet 5's $3/$15 — a third of
      the rate), 9 call sites, all text/vision-in → fixed-JSON-out with no tools:
      `aesthetic/imageClassification`, `profile/extract-profile-fields` (×2),
      `onboarding/bio/extract`, `profile/fetch-bio-url`,
      `designer-bio/scrape-website`, `pdf/aiEnhancement` (×3).
- [x] Moved sites keep an explicit `thinking: { type: 'disabled' }`. The Sonnet 5
      lesson — never let an omitted field decide behavior — applies to Haiku too.

## Deliberately NOT moved
Two of the four originally floated, on the UX rule:
- **`aiExtractProduct` / `ai/complete-product`** — these call the `web_search`
  tool. Haiku's tool-calling is weaker and the failure mode is a product that
  silently never gets enriched. Kept on Sonnet as `toolExtraction`.
- **`estimateProductCoordinates`** — drives auto-tag dot placement on published
  images. Spatial precision is exactly where a small model slips, and the
  designer sees every misplaced dot. Kept on Sonnet as `visionCoordinates`.

Also unmoved by design: all published prose (`prose`) and interview question and
follow-up generation (`interview`). A weaker interviewer degrades the source
material for every article downstream, not just one answer.

## Verify
- [x] `npm run check:sonnet5` — now 34 checks. The Sonnet-rules scanner resolves
      `MODEL_FOR.<task>` against the registry, so a class flipped back to Sonnet
      automatically re-enters the checked set (54 sites currently). Adds: prose
      and interview are on Sonnet; extraction is on Haiku; tool and coordinate
      classes stayed; the extraction tier is >2x cheaper; every tier the registry
      can hand out resolves a pricing rate (or CostEvent silently records 0 and
      the saving becomes unmeasurable).
- [x] `tsc` — no new errors.
- [ ] **Not verified: extraction quality on Haiku.** Nothing has run against
      Haiku on these paths. The classes are individually revertible, so watch
      bio/profile field extraction and image tags on the next few imports.

---

# Part 10 — Prompt caching on the article prompt (branch: claude/llm-json-parse-error-pvl9ra)

## What was measured first
Caching is a prefix match with a per-model minimum, and a write bills at 1.25x
while a read bills at 0.1x — so it only pays from the SECOND use of a prefix
within the TTL. Measuring the candidates changed the plan:

| Prefix | Size | Verdict |
|---|---|---|
| Editorial system prompt | ~1,035 tok | barely over Sonnet 5's 1024 min — too marginal alone |
| followups SYSTEM_PROMPT | 956 tok | below minimum |
| followups/single SYSTEM_PROMPT | 697 tok | below minimum |
| followups/batch SYSTEM_PROMPT | 458 tok | below minimum |
| Haiku extraction prompts | all < 4k | Haiku 4.5's minimum is 4096 — ineligible |

So the audit's "biggest single cost-reduction opportunity" does not hold in the
shape it assumed. The system prompts are individually too small, and the whole
Haiku tier cannot cache. The only real cacheable mass is the article prompt
itself — frozen chapters plus interview answers.

## Fix
- [x] One breakpoint at the end of the shared article prompt, with
      `JSON_RESAMPLE_NOTE` moved into a SECOND content block after it. Caching
      covers the rendered prefix (system, then messages), so this single
      breakpoint covers the system prompt and the whole article prompt.
- [x] `[generate] llm_ok` logs `cacheRead` / `cacheWrite`, so a dead cache shows
      up instead of being assumed to work.
- [x] Cost accounting needed no change — `recordCostEvent` already forwards both
      cache token counts and `anthropicCostUsd` already applies the 0.1x / 1.25x
      multipliers. That instrumentation was built and never exercised.

## Honest accounting
- **Guaranteed win:** the resample. `buildPrompt` runs once outside the retry
  loop, so attempt 2 re-sends a byte-identical prefix seconds later — a hit every
  time a parse failure happens.
- **Unreliable:** regeneration. `paraDistributions[Math.floor(Math.random()*5)]`
  (line ~1118) lands INSIDE the cached block at line ~1350, so two generations of
  the same project only share a prefix when the random pick repeats — about 1 in
  5. This is the textbook silent invalidator, in our own prompt.
- **Cost when it misses:** +25% input on a first-time generation that is never
  regenerated. Cents on this call, and it buys a much cheaper failure path.
- Output is unaffected in every case. Caching changes what gets re-processed,
  never what the model produces.

## Not done, deliberately
Moving the random paragraph instruction after the breakpoint would make
regeneration cache reliably. It means relocating an instruction from the middle
to the end of the prompt, which can change output — a prompt change to validate
on its own, not to smuggle into a caching commit.

## Verify
- [x] `npm run check:sonnet5` — 38 checks. Adds: the breakpoint exists; the
      resample note is a separate block (concatenating it would make attempt 2
      write a second entry instead of reading the first — a cache that never hits
      while paying 1.25x twice); cache tokens are logged; the cost math applies
      both multipliers.
- [x] `tsc` — no new errors.
- [ ] **Not verified: a live cache hit.** Watch `cacheRead` on a resample; zero
      reads across repeated generations means something per-request got in front
      of the breakpoint.

---

# Part 11 — AI failure taxonomy (branch: claude/llm-json-parse-error-pvl9ra)

## The bug this fixes
Every AI failure message in the generator ended with some form of "Try
regenerating." Including `LLM_JSON_PARSE` — the failure that reproduced at
temperature 0.7 and again at 0.3, on the same sentence, in the La Gorce run. The
copy invited a retry that could only burn another two-minute call and fail
identically, and nothing recorded that it had happened.

## Fix
- [x] `src/lib/ai/errors.ts` — 11 codes, each answering one question: **would an
      identical retry work?** Plus status, designer-facing copy, a review flag,
      and a per-project cooldown.
- [x] Deterministic codes (`LLM_JSON_PARSE`, `LLM_TRUNCATED`,
      `LLM_EMPTY_RESPONSE`, `LLM_REPAIR_FAILED`, `LLM_CONTENT_REFUSED`) are
      non-retryable, carry copy that CLOSES the loop, and are flagged for review.
- [x] `LLM_AUTH_FAILED` split out from generic call failure. A bad key is not
      the designer's problem and every retry is a wasted call against a
      credential that will keep being rejected.
- [x] `codeFromTransport()` maps callLLM's lowercase transport codes onto the
      taxonomy; anything unrecognised degrades to a retryable call failure.
- [x] `EditorialGenerationError` now takes a code and derives message + status +
      `retryable` from the registry, so copy and classification cannot drift.
      All 6 throw sites converted.
- [x] The route returns `retryable` so the UI can **remove** the retry control
      rather than disable it — the designer reads "handled", not "denied".
- [x] `reportAiIncident()` — sink is a `[ai-incident]` structured log for now
      (no table, no email relay). Documented as a one-line swap to
      `prisma.aiIncident.upsert` keyed on (projectId, operation, code) so one
      broken project is one row, not forty. Never throws, like recordCostEvent.
- [x] Reporting is gated on `needsReview`, so transient blips don't train the
      incident feed to be ignored.
- [x] `LLM_JSON_PARSE` reports only after the resample is spent — a parse failure
      we recover from cost one extra call and produced a good article. That is a
      metric, not an incident.

## Deferred to the migration (founder is doing it before ship)
Cooldown values are carried as data in the registry but **not enforced**.
Enforcement needs durable storage: `src/lib/rateLimit.ts` is an in-memory Map,
so on Vercel a user just lands on another instance. Two options when the table
lands — the new `AiIncident` row, or the existing
`provenance.interview.lastGenerationError` field, which already carries
`{ code, message, failedAt }` per project and is already read by the preview
page. The second needs no migration at all and is the right granularity, since
the cooldown is per-project by design.

Also open for the table: `diagnostic` holds one capped 240-char prose snippet
(the only thing that makes a parse failure debuggable without replaying a
two-minute generation). That is the field that forces the retention/PII
question.

## Six Sonnet 5 call sites the original migration missed
Tightening the guard for a false positive surfaced a real one. Six live calls
reach the model through `IMPORT_AGENT_CONFIG.model` — an indirection the original
codemod's `MODELS.sonnet` pattern never matched — and **none passed `thinking`**,
so on Sonnet 5 they were silently running adaptive thinking. One
(`analyze.ts:155`) against a 256-token cap, where thinking would consume the
whole budget. `IMPORT_AGENT_CONFIG` did carry a `thinking` field, untyped and
read by nobody, which is precisely how it stayed invisible.

- [x] All six now state `thinking: { type: 'disabled' }` inline, next to the
      `max_tokens` it competes with, consistent with the other 53.
- [x] The unread `thinking` field removed from the config — a shared object that
      half-declares a request is worse than no config.
- [x] Four `content[0]` reads in `analyze.ts` converted to `firstTextBlock`.
      Safe today with thinking off, but leaving them is relocating the landmine
      rather than removing it.
- [x] **The guard is now fail-safe.** It matches ANY `model:` line in an object
      that also has `messages:` and `max_tokens:`, and excludes only what it can
      positively identify as Haiku. Enumerating Sonnet spellings was a
      false-negative machine; an unrecognised expression is now checked, because
      a spurious failure is cheap and a missed call site is a production bug.
      Site count went 53 → 59.

## Verify
- [x] `npm run check:ai-errors` — 47 checks. The load-bearing one: no
      non-retryable code carries copy matching /try again|regenerate|retry/,
      with the negated form ("no need to run it again") allowed. Also asserts
      retryable codes carry no cooldown and demand no review (suppressing a
      failure that resolves itself would block work that would have succeeded),
      every non-retryable code reaches a human, transport mapping is total, and
      the generator has no hardcoded "Try regenerating" left.
- [x] `tsc` — no new errors.
- [ ] **Not verified:** no failure has been produced against the new taxonomy.
      The UI does not yet read `retryable` — the API returns it, the front end
      still needs to drop the control when it is false.

---

# Part 12 — Pull quotes become selection, not authorship (branch: claude/llm-json-parse-error-pvl9ra)

## Reported
Live preview of La Gorce showed three defects at once: a raw `LIVING_ROOM`
title, entry prose under a LIVING ROOM heading and facade prose under DINING
ROOM, and a pull quote reading "elements **in** tension" where the designer had
said "elements **on** tension".

## Root cause 1 — Regenerate could not fix anything
```ts
// Existing published chapters → frozen set (editorial + roomId), in order.
const frozenChapters = existingChapters.filter(
  (ch) => ch?.kind === 'editorial' && typeof ch?.roomId === 'string' && ch.roomId,
);
```
The comment said **published**. The code never checked publication, and
`post.status` sits selected and unread a few lines above. So every chapter from
any previous generation was frozen — on an unpublished draft. That run froze 10
chapters with `writeRooms: []`, which means the Part 3 title-matching fix ran on
an empty list. It was never wrong; it never executed. The mismatched pairings
and the pre-`formatRoomName` title were weeks-old artifacts carried forward
verbatim through every regeneration, unrepairable from the UI.

- [x] Regenerate now preserves nothing. Per-chapter preservation is a real
      feature and an explicit designer choice — a separate one — so the append
      machinery is left intact rather than deleted.

## Root cause 2 — quotes were mined from the article, not the interview
`extractPullQuotesForChapter` regex-scraped quoted spans out of the GENERATED
BODY. If the model paraphrased while composing, the extractor faithfully lifted
the paraphrase. Verbatim-to-the-article is not verbatim-to-the-person.
Compounding it, the body is rewritten twice AFTER quotes were captured
(`fixSentenceOpeners`, `applyProseNamingGate`), so a quote could no longer match
the text it came from — the same line shipped two ways in one article.

## Fix — the model can no longer write a quote, only choose one
- [x] `quoteCandidates.ts` — code cuts candidates from the designer's own
      answers by index into the source string. Verbatim by construction.
      **Contiguous only**: splicing across answers cannot be substring-verified,
      so it is not offered. Follow-ups are ranked first, since those questions
      are specifically prompted to produce quotable material.
- [x] `selectPullQuotes.ts` — one batched call across all rooms that returns
      **candidate IDs, never text**. We look the ID up in our own array. A model
      that can only pick from a list cannot invent a quote — not discouraged
      from inventing, unable to.
- [x] Selection re-verified as a verbatim span of its source answer, then falls
      closed to the top code-ranked candidate. Ranking is advisory: a failed or
      unparseable call costs editorial judgement, not the quote.
- [x] Assigned as the LAST pipeline step, after both body rewrites, so no later
      mutation can put quote and prose out of step.
- [x] `spliceHookQuote` output is now verified the same way — it is allowed to
      trim and elide, which means it is able to reword, so it is checked rather
      than trusted. Fails → no hook quote.
- [x] `LLM_QUOTE_UNVERIFIED` incident when a selection fails verification.

## No fallback pool, by decision
A room whose own answers yield nothing quotable gets **no pull quote**.
Borrowing a project-level line would put words under a heading they were not
said about. Because follow-ups are written to be quotable, an empty pool is a
real signal that the follow-up for that room did not land — logged as
`[pullquotes] rooms with no quotable candidate`, to fix upstream in the
interview rather than paper over in the article.

## Shuffle-before-posting: the UI already existed, it was just starved
`EditableArticle` already had `handleCycle` / `handleRemove` / `handleAdd`
persisting through `PATCH /sections/pull-quote`, and that endpoint already
rejects any `selectedText` not present in `alternatives`. The feature was inert
because `alternatives` came from regex hits on the generated body — thin, and
not guaranteed to be the designer's words.

Feeding it verbatim candidates exposed a blocker in it:
- [x] `alternatives` now **includes the chosen quote**, in rank order. The editor
      locates its position with `alternatives.findIndex(a => a.text === selected)`,
      so omitting the pick made that -1 and the arrows toggled between two fixed
      entries instead of walking the list. The endpoint would also have rejected
      a designer trying to cycle back to the original.
- [x] Pool widened to 6, and **de-overlapped**: candidates include both a
      sentence and that sentence plus its neighbour, so one is often a prefix of
      another. Without the filter a designer clicks through what reads as the
      same quote twice. A realistic 3-answer room yields 6 distinct options.
- [x] Every option is verbatim, so shuffling can never introduce something the
      designer did not say. The model picks the default; the designer picks the
      quote.

## Verify
- [x] `npm run check:pull-quotes` — 26 checks. The load-bearing pair replays the
      shipped defect: "elements on tension" verifies, "elements in tension" is
      rejected. Also: every candidate is a verbatim contiguous span; a thin
      answer yields zero candidates; no candidate leaks between rooms; case and
      curly glyphs are forgiven (typesetting) while a swapped word is not; and
      the pipeline greps assert quotes are assigned after both body rewrites.
- [x] `npm run check:ai-errors` — 12 codes.
- [ ] **Not verified: a live generation.** The ranking call has never run. The
      guarantee that no fabricated quote can ship is structural and tested; the
      quality of which quote gets picked is not.

---

# Tooling: neither guardrail is operating

Found while running checks for the asset matrix work. Not asset-matrix scope,
tracked here so it is not rediscovered.

**`npm run lint` is non-functional.** `next lint` drops into the interactive
"How would you like to configure ESLint?" setup prompt. There is no
`.eslintrc*`, no `eslint.config*`, and no `eslintConfig` key in `package.json`.
No commit has been linted.

**`tsc --noEmit` reports 1023 errors.** The count is stable, so nothing is
regressing — but it means a new type error is invisible in the noise, and CI
cannot gate on a clean run.

Together: every commit lands with neither static guardrail operating. The
`check:*` scripts do work and do catch real things, but they are targeted
structural greps, not general coverage.

Not urgent. Sizing it is the first step — whether the 1023 collapse into a few
systemic causes (the one sampled was a `readonly` array assigned to a mutable
Prisma input type) or are genuinely 1023 distinct problems determines whether
this is a day or a quarter.

- [ ] Add an ESLint config so `npm run lint` runs
- [ ] Bucket the 1023 type errors by cause, then decide baseline-and-ratchet vs fix
- [ ] Declare a schema for the canonical interview answer shape

**Why the third one is here.** `SaveBodySchema.answers` in
`src/app/api/posting/project/[projectId]/interview/route.ts` is
`z.array(z.any())`, so the canonical interview record has no declared shape. What
actually constrains it is two hand-written allowlist normalizers, `normalizeQA`
and `toInterviewAnswer`, that rebuild the object field by field. A key not named
in both is **silently discarded, not rejected**.

So every future field addition to the interview record is a two-site edit where
missing one loses data with no error and no failing test. The `"carried
first-class, not stripped"` comments on `roomId` mark where someone already paid
for this. The same shape is then projected by `rebuildAnswerProjection`, which is
a third allowlist with the same property.

D5a's audio retention sidesteps all three by writing to a sibling provenance key
instead of threading a field through them. That was the right call for that work
and does nothing for the next person.

---

# 22_PRODUCT_RECORD — Phase A + data model

**Spec:** `docs/22_PRODUCT_RECORD.md` (added in this session).

**Scope of this session.** Phase A in full, plus the ADD-only data model for
Phases A through E. Phase C is blocked in the spec itself ("Blocked on canonical
interviewer module"), and D/E hang off C, so they get their tables and nothing
that reads them.

**Why the whole data model and not just Phase A's slice.** The five new models are
one ADD-only migration with no destructive DDL. Splitting them across five
sessions produces five migrations against the same tables and five chances to get
the bookkeeping wrong, which is exactly the debt Phases 1-5E spent weeks
unwinding. The tables land once; the readers land per phase.

## Tasks

- [ ] `docs/22_PRODUCT_RECORD.md` — spec, verbatim
- [ ] `prisma/schema.prisma` — 4 enums, 5 models, Product cache columns, SupplementalQuote testimony class
- [ ] Migration, authored idempotent (no DATABASE_URL in this container — NOT APPLIED)
- [ ] `src/lib/products/productRecord.ts` — maturity ladder, independence gate, three-audience testimony gate, evidentiary ordering (pure, no Prisma)
- [ ] `src/server/queries/getProductRecord.ts` — coverage computation, gated assembly, `resolveProductImage` on every image
- [ ] `src/components/product/ProductRecordSection.tsx` — server component, coverage disclosure + gated testimony
- [ ] Mount on the canonical product page
- [ ] `scripts/check-product-record-invariants.ts` — targeting firewall, enforced structurally per spec
- [ ] Review section below

## Not in this session

- Phase B (Prospective Page, claim email, free grant issuance)
- Phase C (blocked upstream)
- Phase D (Stripe Connect, valence-blind grader, grader CI fixtures)
- Phase E (licensing)
- Open Decisions 1-6, including counsel review, which the spec gates Phase C on

## Review — 22_PRODUCT_RECORD Phase A

All Phase A tasks done, plus the ADD-only data model for A through E. Every
checkbox above is complete.

### What landed

| File | What |
|---|---|
| `docs/22_PRODUCT_RECORD.md` | The spec, plus an Implementation Status table mapping each section to its code |
| `prisma/schema.prisma` | 4 enums, 5 models, 5 Product columns, 2 SupplementalQuote columns |
| `prisma/migrations/20260817120000_add_product_record_system/` | Idempotent, ADD-only, **authored and NOT APPLIED** |
| `src/lib/products/productRecord.ts` | Ladder, independence gate, testimony gate, coverage sentence, evidentiary ordering. Pure |
| `src/server/queries/getProductRecord.ts` | Coverage computation, gated assembly, cache refresh |
| `src/components/product/ProductRecordSection.tsx` | The surface. Renders, decides nothing |
| `src/app/products/[slug]/page.tsx` | Mount, both layout branches |
| `scripts/check-product-record-invariants.ts` | 3 checks, wired to CI |
| `scripts/refresh-product-record-cache.ts` | Batch cache refresh |
| `.github/workflows/product-record-invariants.yml` | Runs the checks on every PR touching `src/**` |

### Verification

- `prisma validate` + `generate` clean.
- Migration verified against `prisma migrate diff --from-empty --to-schema-datamodel`:
  every column type, index name, and FK action matches what Prisma would have
  generated. The hand-authored version differs only in being idempotent.
- `tsc --noEmit` clean on all new and changed files (repo has ~1023 pre-existing
  errors elsewhere; none are mine).
- `phase5e-check-plan.mjs --ci` at baseline: `looseSql=32/32 phantomCalls=0/0
  missingSql=0/0 nonIdempotent=0/0`.
- `check-product-record-invariants.ts --ci` clean, and **negative-tested**: a
  planted `privateProductSignal` reference in `src/lib/boost/` and a flipped
  weight in `evidentiaryWeight` both failed the build as intended. A check that
  cannot fail is not a check.

### Decisions taken, flagged because they are interpretations not quotations

1. **Commissioned testimonies must come from distinct designers.** The spec says
   "3 distinct designers across 3 distinct projects, including 2+ commissioned
   testimonies" and does not say the commissioned two must be different people.
   Enforced as distinct anyway: a vendor buying two requests from one friendly
   designer is the cheapest possible way to manufacture an article, which is the
   exact failure the independence gate exists to prevent. Reverse it by relaxing
   `evaluateRecordTier` if the first cohort proves it too strict.
2. **Commissioned testimony is not re-gated on current vendor state.** Once
   published it stays public even if the vendor lapses to CLAIMED. This follows
   from the spec superseding the subscription-unlock model: "the gate is
   upstream."
3. **Testimony is read only from PUBLISHED posts.** A project can be public while
   its Super-Article is still drafting. Publishing a designer's words ahead of
   the post they were written for is a leak the vendor gate does not cover.
4. **`recordPublishedAt` is stamped on first reaching ARTICLE and never cleared.**
   The spec declares the column and does not define it. Follows from (2).
5. **Evidentiary ordering carried over from `21_ASSET_MATRIX` §8**, which governs
   the Record because the Record is the Product entity at Corpus scope. The
   relative order (commissioned > volunteer, install shot > none, elapsed >
   fresh) is spec; the numeric weights are a starting point.

### Deliberate deferrals

- **The coverage cache has no hot-path writer.** `refreshProductRecordCache` is
  called by the batch script only. Wiring the four ProductTag creation sites puts
  a write on the designer's tagging path and buys nothing, because
  `getProductRecord` computes coverage live and never reads the columns — a stale
  cache can under-report a list surface but cannot produce a wrong Record. Wire it
  when a list surface reads the columns.
- **Migration is authored, not applied.** No `DATABASE_URL` in the session
  container and no Docker daemon for the shadow DB, so no
  `migrate deploy` / `migrate resolve` / `migrate status`. Same convention as
  commit 0878988 ("AUTHORED, NEITHER APPLIED"). **Someone with prod access must
  apply and resolve it before any of this code runs against a real database** —
  `getProductRecord` reads `vendor_product_claims` and
  `supplemental_quotes.testimonyClass`, both of which are new.
- **`ProductTestimonial` and `ShopProduct.quote` are untouched.** Spec 22 subsumes
  ProductTestimonial for *new* volunteer quotes by routing them to
  `SupplementalQuote.testimonyClass`. Existing rows still serve the Shop surface.
  Migrating them is destructive-adjacent and belongs in its own session with its
  own gate.

### Found in passing, not fixed

`npm run guard:client-imports` points at `scripts/guard-client-imports.js`, which
does not exist. Pre-existing; unrelated to this work.

### Next

Phase B is unblocked and is the conversion moment: the Prospective Page reuses
`ProductRecordSection` with the testimony section already rendering its empty
state, so the remaining work is `VendorProductClaim` issuance, the free grant,
and the claim email. Phase C stays blocked on the canonical interviewer module,
and Open Decision 6 (counsel review of the whole solicitation-to-publication
chain) gates it independently.


# Folio hardening — 2026-09-08
Ordered scope authorized: execute prompts 1–6 sequentially. Preserve unrelated work.
- [x] Read request, conventions and current code; fetch and rebase preserved work onto main.
- [ ] P1: Verify raw inbound signatures; authenticated, rate-limited SSRF-safe scraping; distributed auth limits; media Permissions Policy. Focused tests, guard, lint, baseline-relative types, build, IDOR.
- [ ] P2: Audit legacy editorial callers and canonical state, consolidate/delete, verify surviving workflow.
- [ ] P3: Measure actual main TypeScript baseline, implement deterministic ratchet and negative tests, wire CI.
- [ ] P4: Add five deterministic regression journeys using existing application boundaries and isolated persistence.
- [ ] P5: Inventory auth dialects, canonicalize bounded route slice, strengthen scanner and test authorization matrix.
- [ ] P6: Read-only deletion audit with caller evidence, ranked batches and quantified impact; no repository edits in this phase.

Review: Pending. No security property is complete until verified. Schema changes, if necessary, require backup and scoped review under migration discipline; restore and stop on validation failure.

## P0 review — incomplete / browser environment blocker
- Implemented raw-body Svix verification, distributed production rate limits, credentials IP+email enforcement, URL/IP validation with socket pinning, and self-only media permissions.
- Nine focused test groups pass. Client guard passes. Changed-file lint: zero errors, 174 warnings. Production build exits 0 but logs an existing editorial schema mismatch.
- Typecheck remains non-clean; historical errors plus a regenerated Next route-export diagnostic. No errors in the added security helpers or scraper.
- Live Browserless probe rejects the provider-added 0.0.0.0 proxy bypass. User explicitly chose establishing a protected browser path; disabling it is not accepted as completion.
- P0 remains open. Need a Browserless environment honoring required egress controls, then live adversarial and rendered-product verification. Distributed live Redis and route integration tests also remain.
- Prompts 2–6 have not started, preserving order. Full status: docs/audits/HARDENING_P0_STATUS.md.

## P0 completion phase — 2026-09-08
Scope: only Critical/High security dispositions, browser architecture and remaining P0 checks.
- [x] Fetch current branch/main; reproduce 3 Critical/14 High; inspect handlers and caller chains.
- [x] Fix public feed publication/provenance leaks and contact-form abuse; scope internal prompts and their answer mutation.
- [x] Repair claimed-product scrape authorization, bound resource spend and remove unprotected escalation; make product dedup updates race-safe.
- [x] Remove unreachable middleware limits; distinguish limiter rejection/configuration/outage/timeout in safe logs.
- [x] Route-level regression tests including signed webhook -> real thread matcher.
- [x] Decide smallest independently controlled browser architecture before browser implementation; verify engine availability, then implement/test only if enforceable here.
- [ ] Browser release gate: provision an independently controlled Linux worker, enforce namespace/host egress, pass adversarial and legitimate-rendering parity tests. Blocked: no working local Linux Docker engine or configured worker host.
- [x] Build, type diagnostic comparison, changed-file lint, client guard, fresh IDOR report, no-secret review; commit/push checkpoint with honest completion status.

Completion review: **P0 INCOMPLETE**. Twenty security tests pass; build and client
guard pass; lint has zero errors/10 warnings. Types: 1,009 before, 1,007 after,
zero added diagnostics. IDOR: zero Critical, one documented High scanner
limitation, 16 Medium, 20 Low. The managed browser remains fail-closed; isolated
worker implementation, adversarial browser tests and product parity are blocked
on the Linux execution environment. Live Upstash smoke awaits credentials.
Full dispositions, threat model and resumption procedure:
`docs/audits/P0_COMPLETION_REVIEW.md`. No subsequent phase started.

## P0 isolated renderer implementation
- [x] Implement bounded authenticated controller, disposable jobs and verified namespace/host packet policy before browser startup.
- [x] Implement sandboxed Chromium runner and replace managed protected-render callers without broad application changes.
- [x] Add controller/worker tests, Linux canary acceptance rig with deliberate-breach control, and extraction parity fixtures.
- [x] Execute available tests and Linux/Upstash probes; record unexecuted network acceptance explicitly.
- [x] Run P0 tests, scanner, guard, lint, baseline-relative types, build and secret review; document deployment and commit/push.

Plan: target Linux Docker with the iptables backend. Host controller installs
namespace OUTPUT and host DOCKER-USER/INPUT rules before starting Chromium.
No Linux availability is required to author the implementation, but Linux
packet/canary evidence remains mandatory for P0 completion.

Implementation review: 13 worker/controller/harness tests and 23 application
security/integration tests pass; Linux-output parity is explicitly skipped.
Build passes; types 1,009 before/after with no added diagnostics; guard passes;
lint zero errors (13 historical integration warnings); IDOR 0 Critical/1 High/
16 Medium/20 Low. No-secret/artifact check passes. Managed runtime rendering is
removed; legacy renderer entrypoints now enforce identity and a shared budget.
Linux image/sandbox/network tests, live rendering and Upstash verification remain
pending infrastructure/credentials. Full report: docs/audits/P0_RENDER_WORKER_REPORT.md.
P0 INCOMPLETE — implementation ready, authoritative network verification pending.

## P0 final verification attempt
- [x] Read final verification request; fetch and inspect branch; inspect available provisioning/SSH and staging configuration without exposing secrets.
- [ ] Obtain dedicated Linux test-host and public fixture access; build the unchanged image and record runtime isolation evidence.
- [ ] Prove positive-control HTTP/subresource/WebSocket/worker canary contact before the protected matrix.
- [ ] Execute complete protected matrix, live rendering parity and staging Folio integration; fix only observed failures.
- [ ] Execute live shared Upstash smoke when staging credentials are available.
- [x] Run unchanged local regressions, build, guard, scanner and diagnostic comparison; record exact blockers without claiming Linux proof.

No implementation edits planned before deployment/acceptance identifies a concrete defect.

Verification attempt result: no cloud CLI/credential configuration, SSH target,
test fixture configuration or staging Upstash credentials available. Linux
acceptance stops before setup; zero completed cases. No implementation changes.
36 local tests pass, one Linux-output test skipped. Build, guard and lint pass;
IDOR unchanged at 0 Critical/1 High/16 Medium/20 Low. Types 1,009 before/1,007 after,
zero added. Access question remains pending. Evidence and all NOT RUN matrix
entries: docs/audits/P0_FINAL_VERIFICATION_BLOCKER.md.

## Editorial architecture consolidation — 2026-09-08
P0 PARKED. Scope, current-state map, transition table, checkable plan and results: tasks/editorial-consolidation.md.
- [x] Complete consolidation implementation and available verification; preserve P0 controls. Disposable database journey remains parked.

## Approved editorial mapping repair
- [x] Verify approved source, sync baseline, and back up schema.
- [x] Apply only three approved model mappings; inspect exact diff.
- [x] Format/validate/generate/migrate-status; if any fails, restore from backup and stop.
- [x] Verify generated mappings, read-only queries, build and focused regressions.
- [x] Record parked disposable database gate, review, commit and push.

Review: approved mappings only; generated metadata and six read-only queries pass. Build exits 0 with no editorial mapping errors. Types: 1,006 before/after, zero added. Guards/regressions pass. Real database transition journey parked pending disposable DB. Full evidence: tasks/editorial-schema-repair.md.

## TypeScript error ratchet — 2026-09-08
- [x] Read configuration/CI conventions, fetch origin, and start a fresh canonical measurement.
- [x] Implement deterministic structured-diagnostic fingerprints and a reviewable baseline; enforce count and fingerprint multiplicity without line positions.
- [x] Add safe baseline lowering and existing lint-workflow integration; reject baseline expansion against the merge base.
- [x] Prove baseline, +1 regression, movement, reduction and lowering with controlled mutations; restore all fixtures.
- [x] Run guards, focused lint, production build and final ratchet; classify measured debt and document commands/limitations.
- [x] Review focused diff, commit baseline/implementation/docs and push.

Plan: preserve current tsconfig, build flags, product behavior and parked workstreams. Use the installed compiler API with the existing project configuration and no emit/incremental cache. Global fingerprint enforcement is stronger than changed-file-only enforcement and catches indirect errors in unchanged consumers. No increase override is planned.

Review: measured 1,006 diagnostics / 638 fingerprints / 260 files at b094b5e0. Structured compiler guard rejects total increases and new fingerprints globally; merge-base integrity prevents baseline inflation. Five tests pass, including actual CLI/Git fixtures. Real repository proofs: baseline 1,006 pass; artificial 1,007 fails; line movement passes; temporary 1,005 reduction and update pass. All mutations restored. Final ratchet 1,006/zero new, production build, guard typecheck/lint and client guard pass; IDOR unchanged. No src/schema/config changes. Evidence and cleanup order: docs/TYPESCRIPT_RATCHET.md. TYPESCRIPT RATCHET COMPLETE.

## Core regression journeys — 2026-09-08
- [x] Audit existing Node/tsx tests, real signup/onboarding, project/tag/authz, interview generation and mounted collaboration routes.
- [x] Add small reusable fixtures and a fail-closed disposable database gate; keep local orchestration doubles explicitly distinct from persistence proof.
- [x] Implement all five journeys through real handlers/auth/lifecycle, mocking external boundaries only (plus deterministic DB doubles for local orchestration).
- [x] Add explicit live-DB execution mode for the same journeys and CI integration without provisioning infrastructure.
- [x] Run suite, ratchet/guard tests, client guard, lint, Prisma validation, build and relevant IDOR scan; repair only directly exposed regressions.
- [x] Document exact assertions, gaps and parked live execution; review, commit and push.

Plan: reuse Node test + installed tsx, no browser framework. Exercise real Credentials authorization/JWT/session callbacks and middleware with an encoded session cookie. Use the mounted collaboration story invitation/acceptance path from CreateButton/MobileMenu for vendor interaction. Local database doubles prove orchestration only; the same journeys can run against an explicitly disposable database. No schema changes or infrastructure provisioning.

Review: all five real-handler journeys pass locally (8 passing tests including parent/safety, one explicit live-DB skip). Required DB mode correctly exits 1 without a disposable target. Fixed project PUT view-vs-write authorization and private read/edit 500-vs-403 responses. Production build, ratchet guard tests, client guard, lint (zero errors), Prisma validate and migration discipline pass; IDOR unchanged at 0 critical/1 existing high/16 medium/19 low. TypeScript 1,006 before/after, zero new fingerprints. Full architecture, exact assertions, commands, CI and limits: docs/CORE_REGRESSION_JOURNEYS.md. IMPLEMENTATION COMPLETE — LIVE DATABASE EXECUTION PARKED.

## Great Folio Delete — Batch 1 — 2026-09-08
- [x] Fetch and reverify the seven approved files against static/dynamic imports, re-exports, JSX/string references, scripts, CI, tests, documentation and audit baseline.
- [x] Delete only the seven approved callerless files; preserve shared role/session/navigation/workspace code.
- [x] Run type preparation, ratchet and lowering if needed; core journeys, guard tests, client guard, lint applicability, production build and IDOR scan.
- [x] Review exact diff, document results, commit and push one focused deletion commit.

Plan: seven file deletions, 932 actual physical lines; no routes, dependencies or Prisma changes. Historical RoleSelector documentation remains historical. Lower the baseline only if diagnostics decrease. No new helpers or product logic.

Review: deleted exactly page-backup.tsx, GlobalHeader.tsx, ProjectDashboard.tsx, RolePanel.tsx, RoleSelector.tsx, getRole.ts and getServerRole.ts. Reverification found zero resolved import/re-export/dynamic-import callers for each and no runtime symbol/path references; only historical RoleSelector documentation remained. No commits had landed since audit HEAD c4317f30. Shared role/session/permissions/onboarding/navigation/root/workspace files remain unchanged. Type preparation, production build, five ratchet guard tests and client guard pass. All five core journeys pass (8 tests total, 1 unchanged live-DB group skip). IDOR remains 558 routes: 0 critical / 1 existing high / 16 medium / 19 low. Changed-file lint has no applicable surviving source files. Ratchet passed with zero new fingerprints; approved update lowers 1,006 to 1,003 diagnostics, 638 to 635 fingerprints, 260 to 257 files. Removed diagnostics belonged to GlobalHeader, RolePanel and RoleSelector. Full diff contains seven deletions, baseline lowering and these notes only; source LOC removal is 932 rather than the approximate 933. Logs: tasks/delete-batch1-*. GREAT FOLIO DELETE BATCH 1 COMPLETE.

## Great Folio Delete — Batch 2 — 2026-09-08
- [x] Rebuild the 22-file import graph, check references/history and verify canonical public/preview/feed/social/admin paths.
- [x] Delete the closed legacy renderer tree only; retain all external helpers, APIs, packages and canonical editorial code.
- [x] Run core/editorial/quote/story checks, type preparation/ratchet and lowering, guard tests, client guard, production build and IDOR.
- [x] Inspect stranded references/assets and full diff; document exact results; commit and push one focused batch.

Plan: 22 files / 3,248 actual lines under src/components/project/editorial only. Root EditorialProjectLayout has no external caller; spacing.ts is also callerless. All other inbound module edges remain within the candidate tree. No CSS/assets/barrels are present inside it. Preserve shared TaggedImage, ActionIconBar, folder helpers, editorial types, schemas, formatRoomName, quote APIs and packages. No canonical source changes.

Review: all 22 audit candidates deleted, none retained, no additional assets/barrels removed. Zero routes, API routes, dependencies, Prisma or migration changes. Resolved static imports/re-exports/literal dynamic imports and runtime reference searches found no external inbound edge. EditorialProjectLayout was the unmounted root, with spacing.ts independently callerless. The current public chain remains /p/[slug] -> getPostBySlug -> published ProjectPost on public Project -> StoryRenderer -> buildStoryData/buildEditorialChapters -> Mosaic/RoomTilePair/PhotoTile/QuoteTile and shared product/media components. Feed, magazine, preview, social export and admin surfaces have no dependency on the deleted tree. Shared outbound dependencies and both interview quote/status APIs remain untouched. No stranded internal barrels, CSS, assets or obsolete-only tests found; contextual-search audit now labels its old renderer claim historical. Remaining source comments and historical audit references do not import removed code.

Verification: production build, typecheck:prepare, typecheck, baseline update, all five ratchet guard tests and client-import guard pass. All five core journeys pass (8 passing tests including parent/safety, one live-DB group skipped); lifecycle checks pass (3 tests, one live-DB group skipped). Single-generator, block bounds, pull-quotes/provenance, quote audit, generation context, room matching, regeneration surfaces and story-editing checks pass. Real StoryRenderer SSR smoke passes with fixture title/data, room/product mapping, room image markup and its initial hero placeholder; browser hydration was not exercised. Windows grep-based checks required installed Git Bash as the child shell; no scripts changed. IDOR is unchanged: 558 routes, 0 critical / 1 existing high / 16 medium / 19 low. Changed-file lint is not applicable: no surviving JS/TS source was modified. TypeScript decreases 1,003 -> 994 diagnostics, 635 -> 627 fingerprints, 257 -> 255 files; zero new fingerprints. All removed diagnostics belong to EditorialProjectLayout and layoutEngine. Actual Git source reduction is 3,248 lines; the approximate audit count included one extra trailing line per file. Logs: tasks/delete-batch2-* (local artifacts). Live database checks and P0 infrastructure verification remain parked.

## Great Folio Delete — Batch 3 — 2026-09-08
- [x] Reconstruct old/current interview graphs, preserve live shared components, and record old API callers.
- [x] Delete only the proven exclusive old UI files; inspect remaining references and internal artifacts.
- [x] Verify current interview, biography, recorded/realtime, core journeys, quotes/provenance, TypeScript, build and security.
- [x] Review exact diff, record results, commit and push the focused batch.

Plan: resolve imports across tracked source before choosing the deletion set. Preserve biography's FollowUpTransition, InterviewQuestion and ProgressIndicator, all current posting/recording/realtime flows, every API and all data/provenance helpers. Use deterministic existing checks and focused component checks without live LLM calls. Lower TypeScript baseline only for proven reductions. No API, Prisma, migration or feature changes.

Review: deleted exactly 18 closed old UI files / 1,890 source lines, including five internal barrels; no additional artifacts. The three known biography components remain unchanged and directly imported. Zero external inbound callers for the deletion set; no current source, route, API, dependency, Prisma or migration changes. All five core journeys pass (8 tests, 1 live-DB group skipped); question validation/lifecycle pass (6 tests, 1 live-DB group skipped). Current question/init/save/resume and biography base-question/three-answer checks pass through real handlers with deterministic fixtures. Current modal, question card, biography flow/shared components, recording and realtime initial server renders pass; no browser, microphone, realtime transport or live DB proof claimed. Quotes/verbatim, forward/reverse projection, provenance pointers, generation/context, room matching, naming, regeneration and story-editing checks pass. Type preparation, production build, five ratchet tests and client guard pass. No surviving source files to lint. IDOR unchanged: 558 routes, 0 critical / 1 existing high / 16 medium / 19 low. TypeScript 994 -> 988 diagnostics, 627 -> 625 fingerprints, 255 -> 253 files; zero new fingerprints. Old start/respond/complete endpoints are now repository-callerless but preserved, with external usage unknown. Exact graph, deletion list, API status, limits and results: docs/SESSION_DELETE_BATCH3_2026-09-08.md. GREAT FOLIO DELETE BATCH 3 COMPLETE.
