# Two-Phase Interview Generation (Option B) — About answers inform room questions

Branch: claude/question-generation-tuning-xrisl9

## Goal
Generate the "About This Project" section first (fast initial load). When its base
answers are in, distill them into a schema-constrained fact digest (facts, not
narrative — the anti-drift mechanism) and generate room questions WITH that digest.
Room topics stay pinned to each room's photos/tags; the digest only informs wording
and prevents re-asking. The story's angle never re-steers.

## Plan

### Backend
- [x] 1. New `src/lib/interview/distillInterviewFacts.ts` — `KnownFacts` type
      (fixed fields: client, scope, timeline, direction, corrections) +
      `distillInterviewFacts()` (Haiku, neutral-facts-only prompt, null on failure).
- [x] 2. `generateRoomQuestions.ts` — optional `knownFacts` in projectContext;
      prompt gains "WHAT WE ALREADY KNOW" block + lane contract
      (informs wording, never topics; photos/tags choose topics).
- [x] 3. `generateAllRoomQuestions.ts` — accept optional `knownFacts`, pass through.
- [x] 4. `getInterviewQuestions.ts` — phase-aware `getInterviewQuestionsGroupedByRoom`:
      `phase: 'project'` → project group only (no room LLM calls; real gates from context);
      `phase: 'rooms'` → read saved About answers from provenance → distill →
      generate rooms with digest; persist digest to `provenance.interview.knownFacts`;
      no phase → current full behavior (back-compat for flat callers/cache).
- [x] 5. Questions route — parse `?phase=` and pass through.
- [x] 6. `followups/batch/route.ts` — include stored digest in room-level prompts
      (stops room follow-ups re-asking established project facts).

### Frontend
- [x] 7. `useRoomInterviewQuestions.ts` — two-phase: initial fetch `phase=project`;
      expose `roomsPending`/`roomsError` + idempotent `loadRooms()` that fetches
      `phase=rooms` and appends groups; full-set localStorage cache still
      short-circuits both (project-only caches are NOT trusted as full).
- [x] 8. `InterviewModal.tsx` —
      (a) pacing gate: active with a lone project group when roomCount >= 1,
      (b) `loadRooms()` effect fires when About BASE answers are all saved, so
          rooms generate while the designer answers project follow-ups,
      (c) `roomsBlocked` gates canFinish auto-complete/isInterviewComplete/
          isNearFinish; "Preparing questions for each room" interstitial when
          About is done but rooms haven't arrived,
      (d) arrival effect advances into room index 1 when groups land.

### Verify
- [x] 9. `tsc --noEmit`: identical error sets before/after (1055 pre-existing,
      0 new). `phase5e-check-plan --ci` passes. `next lint` not configured in
      repo (interactive setup prompt); `guard:client-imports` script missing on
      this branch (pre-existing).
- [x] 10. Traced: fresh phased flow (About → round-1 trigger → follow-ups answer
      time hides room generation → arrival advance), cached full-set path,
      0-room flat fallback, rooms-failure degrade (roomsError unblocks Finish,
      bounded answer-driven retries — no hot loop).

## Review

Two-phase generation is live end-to-end. Design decisions that matter:

- **Anti-drift digest.** Room prompts never see raw About answers — only a
  Haiku-distilled, schema-constrained fact digest (client/scope/timeline/
  direction/corrections, no names, no narrative). The room prompt's lane
  contract makes it explicit: the digest informs WORDING, the room's own
  photos/tags choose TOPICS. Same digest feeds room-level batch follow-ups
  ("settled ground — don't re-ask").
- **Digest is enhancement, never dependency.** Any failure (no answers, LLM
  error, parse fail) degrades to digest-free room generation; the deterministic
  About fallback and the full-path behavior are unchanged.
- **Latency hiding.** Room generation kicks off the moment the 5 About base
  answers are saved and runs during the project follow-up round. The
  interstitial only shows if the designer outruns it.
- **Known accepted races** (documented in code): provenance read-modify-write
  between knownFacts persist and concurrent answer/follow-up saves — same
  fresh-read pattern and blast radius as the existing followups routes.
- **Post-review fixes (folio-code-reviewer):** (1) BLOCKER: `persistKnownFacts`
  was a DB write reachable through the view-gated questions GET — now the route
  checks `assertProjectWrite` and passes `persistFacts`; viewers can never
  trigger the mutation. (2) `loadRooms()` gained a fetch-epoch guard so an
  in-flight rooms fetch from a stale cacheSignature can't merge/cache under the
  new signature. (3) The full-set cache write now requires actual room
  questions — an all-rooms-failed generation is no longer cached as success.
  Deliberately skipped: reviewer's nit about lost `Promise.all` parallelism on
  the legacy no-phase path (one ~10ms serialized findUnique vs a multi-second
  LLM pipeline, on a path the frontend no longer calls).
- **Follow-up (not done, deliberate):** the flat `useInterviewQuestions` hook
  still triggers a full digest-free room generation server-side on modal open
  (pre-existing double-spend; its results only feed legacy/metadata paths).
  Worth removing in a separate cost-cut pass.
