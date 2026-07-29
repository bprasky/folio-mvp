# Story step is unreachable on legacy projects (branch: claude/tags-story-view-duplicate-6rnnjj)

## Problem (reported)
`/project/<id>?view=story` renders the exact same screen as
`/project/<id>?view=media&step=tags` — clicking the tracker's Story step shows
the tagging surface again, so the interview has no entry point.

## Root cause
`Project.timeline` is nullable (`ProjectTimeline?`) and `page.tsx` read it twice
with conflicting defaults:

- tracker type: `timeline === 'PRESENT' ? 'inProgress' : timeline === 'FUTURE' ? 'concept' : 'completed'`
  → **null = completed**, so the stepper renders Photos/Rooms/Tags/Story/Publish
  and `stepHref('story')` links to `?view=story`.
- flow gate: `inPublishingFlow = timeline === 'PAST' || hasDraftOrPublished`
  → **null = not publishing**, so `storyTabVisible` is false and the page runs
  `if (currentView === 'story' && !storyTabVisible) currentView = 'media'`.

Coerced to `media` with no `step` param, the tracker falls back to the frontier
(Tags), which satisfies `startInTagging` → the tagging surface renders. Both URLs
land on the same screen, with no error and no visible redirect.

## Implementation
- [x] `computeTrackerState.ts`: export `trackerTypeForTimeline(timeline)` — the
      single place a null/unknown timeline gets its default (`completed`).
- [x] `page.tsx`: `buildTrackerState` uses it; `inPublishingFlow` is derived from
      `trackerType === 'completed' || hasDraftOrPublished` instead of re-testing
      the column; `isProspective` becomes `trackerType !== 'completed'` (same
      result, one less independent read).

## Verify
- [x] Replayed the page's view resolution against the reported project shape
      (owner, `timeline: null`, photos+rooms done, no draft, INTERVIEWED):
      - BEFORE — `?view=media&step=tags` → TAGGING, `?view=story` → TAGGING (bug reproduced)
      - FIXED  — `?view=media&step=tags` → TAGGING, `?view=story` → STORY
- [x] Regression shapes unchanged: PAST owner → Story reachable; PRESENT/FUTURE
      owner → still no Story surface (working projects have no Story step);
      non-owner on an unpublished project → still coerced to media.
- [x] `npx tsc --noEmit`: zero errors in either touched file (1049 total, all
      pre-existing elsewhere in the repo).

## Notes
- Behaviour change for legacy (null-timeline) projects: they now enter the
  publishing flow, matching the tracker they were already being shown — the
  stepper owns navigation, so the Boards / Action items / Media tabs no longer
  appear alongside it.
- Left alone: the empty-project branch still gates the New Project Wizard on
  `timeline === 'PAST'`, and `MediaSection`'s "Continue to story" can still push
  `?view=story` on a PRESENT/FUTURE project (where it correctly coerces back to
  media, since those projects have no Story step). Neither is the reported bug.
