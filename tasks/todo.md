# Progress Tracker — Story step: resume/restart + editable Q&A (branch: claude/progress-tracker-interview-flow-x8ykfp)

## Problem (reported)
Designer has saved interview answers, but the Progress Tracker never surfaces the
Story step (it's gated behind the incomplete Tags step). Re-entering the interview
via "Continue to interview" is ugly: the first question flashes, then it takes ~a
minute to register that progress exists. Two asks:
1. With saved answers, surface a Story area in the tracker with Resume/Restart.
2. Show the Q&A there, editable — editing opens an existing modal, not inline.

## Root causes
- Tracker `currentIndex` = first incomplete step (Tags), so the Story step's
  `STORY_IN_PROGRESS_COPY` override never shows while Tags is incomplete.
- InterviewModal renders `phase="question"` immediately on open, before the preload
  GET resolves → Q1 flashes, then the "Welcome back" resume screen appears late.
- Interview question IDs regenerate each session (`project-<CAT>-<uuid>`,
  `randomUUID()` for rooms), so the full modal CANNOT reopen pinned to one past
  answer, pre-filled. Editing one answer needs the dedicated reflection editor.

## Implementation
- [x] Extract `EditReflectionModal` (+ `parseCategoryLabel`) from StoryPanel into
      `src/components/posting/interview/EditReflectionModal.tsx`; StoryPanel imports it
      (removed local dup + now-unused `cn` import).
- [x] `InterviewModal`: add `initialIntent?: 'resume'|'restart'|null`.
      - resume → skip "Welcome back", arm `resumeRequested` (no Q1 flash).
      - restart → extracted `handleStartOver({skipConfirm})`, driven by a once-per-open
        effect; the inline "Start over" button now calls the same callback.
      - `preloadComplete` gate: hold the question phase on a spinner until the preload
        GET settles (finally-set), so Q1 never precedes the resume decision.
- [x] `ProjectStorySection` (NEW): "Your story so far" in the tracker card — Resume /
      Restart + editable Q&A list. Opens InterviewModal (intent) / EditReflectionModal
      (pre-filled). Mounts InterviewModal ONLY while open so its question-gen hooks
      don't fire LLM calls on page load. Refetches + router.refresh() on close.
- [x] `ProjectProgressTracker`: add `storyFooter?: ReactNode`, rendered inside the card
      in BOTH the collapsed (Tags-step) and normal branches.
- [x] `page.tsx`: pass `<ProjectStorySection>` as `storyFooter` when
      `isOwner && interviewAnswerCount > 0`.

## Verify
- [x] `npx tsc --noEmit`: 1050 errors WITH changes == 1050 on clean baseline (stash
      compare). Zero new type errors. The 8 InterviewModal errors are pre-existing.
- [ ] folio-code-reviewer pass (running) — address findings before commit.
- [ ] Manual: INTERVIEWED project shows the section on Tags step; Resume goes straight
      to where left off (no Q1 flash); Restart clears; editing a Q&A opens pre-filled
      modal and saves.

## Notes / decisions
- User confirmed: placement = in the tracker card (top); edit = jump to that answer,
  pre-filled. Pre-filled single-answer edit is only reliable via the reflection modal
  (ID regeneration), so Resume/Restart use the full InterviewModal and per-answer edit
  uses EditReflectionModal.
