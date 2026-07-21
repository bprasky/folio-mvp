# Fix: interview skip-last-room + resume override (branch: claude/interview-room-skip-q1-override-179v3b)

## Symptoms (reported)
1. Reached end, skipped the LAST room — didn't register / never proceeded to article generation.
2. Re-entered interview, recognized 31 answers, clicked "pick up where I left off" — but an
   override keeps the user on Question 1 of "About This Project".

## Root causes
- Bug 1: `handleSkipRoom` (and `handleQuestionAnswerSubmit`) read `roomFlow.canFinish`
  synchronously right after mutating flow state. `skipRoom()`/`advanceQuestion()` only schedule
  React state updates, so `canFinish` in the closure is STALE and misses the just-finished room.
  Skipping the last room therefore never sets phase=complete / triggers generation.
- Bug 2: `useRoomInterviewFlow` always starts at room 0 ('project' = "About This Project"), Q0, and
  has no resume navigation. `hydrateStatuses` restores statuses but deliberately never moves the
  cursor, and never restores `answeredCount` (so `canFinish` is false on resume even when done).
  Result: resume dumps the user on About Q1.

## Plan (all changes in InterviewModal.tsx; no hook API change needed)
- [ ] Add `allRoomsTerminal` (status-only: every room complete/skipped, >=1 complete, rooms loaded).
      Needed because hydration doesn't restore answeredCount, so canFinish can't be trusted on resume.
- [ ] Add a finish effect: when in question phase and (canFinish || allRoomsTerminal) and not
      generating / not roomsBlocked / not on draft-resume screen -> autoGenerate + phase=complete.
      Single source of truth for "interview finished" — fixes the stale-read (Bug 1) across skip-room,
      skip-question, and answer-last-question (async round transitions) paths.
- [ ] Remove the stale synchronous `canFinish` finish-checks from handleSkipRoom and
      handleQuestionAnswerSubmit (effect owns it now).
- [ ] Replace the narrow two-phase `goToRoom(1)` effect with a one-time-per-open resume-nav effect:
      once rooms are loaded, if any room is terminal, navigate to the FIRST non-terminal room
      (covers both the live two-phase "enter first room" transition and resume). If all terminal,
      leave it to the finish effect. Reset the one-time guard when the modal closes.

## Verify
- [ ] `npm run typecheck` / build clean.
- [ ] Reason through: skip last room -> generates; resume mid-interview -> first incomplete room;
      resume fully-done -> Continue -> generate (with skipped-room confirm).

## Review (results)
Implemented all four items in InterviewModal.tsx. tsc: no NEW errors introduced
(8 errors in this file are pre-existing on baseline bc8ccf8b — verified via stash).

### Behavior walkthrough
- Skip last room: handleSkipRoom -> skipRoom() commits -> allRoomsTerminal true ->
  finish effect -> phase=complete + autoGenerate -> handleGenerate (skipped rooms make
  excludedRoomNames non-empty -> confirm dialog -> generate). FIXED.
- Answer last question of last room: recordAnswer + advanceQuestion -> async round
  transitions -> finalizeRoomAndAdvance -> canFinish true -> finish effect. FIXED
  (previously the synchronous canFinish read missed this async path too).
- Resume, some rooms incomplete: hydrateStatuses restores terminal statuses ->
  resume-nav effect navigates to first non-terminal room (not About Q1). FIXED.
- Resume, all rooms done: Continue dismisses draft-resume -> allRoomsTerminal true ->
  finish effect -> generate (matches "retrigger it" intent). FIXED.
- Fresh interview: no terminal rooms until the true end -> neither effect fires early.
- Live two-phase: resume-nav subsumes the old goToRoom(1); finalizeRoomAndAdvance still
  handles the normal in-session transition; resume-nav no-ops when already on target.

## Review round 2 (folio-code-reviewer findings addressed)
Reviewer verdict: iterate — no blockers, two should-fix items. Both fixed:
- Start Over now resets the flow hook (new useRoomInterviewFlow.reset()) + clears
  roomStatuses + serverRoomProgressRef + re-arms didResumeNavRef, so cleared progress
  can't leak into resume-nav/finish detection (previously would jump mid-list / mis-fire).
- Closed the hydration race: serverRoomProgressRef is populated by a separate async GET;
  added serverProgressVersion state (bumped when the snapshot lands) to the hydration
  effect deps so persisted statuses always hydrate even if the GET resolves late.
Nits (redundant !roomsBlocked guard; question-level within-room resume) left as-is /
noted to user. tsc: still only the 8 pre-existing baseline errors; hook compiles clean.
