# Task: Stop AI board "descriptors", gate Boards on real tags

## Context
Boards currently auto-fills with AI "descriptor" Selections (`source: 'ai_analysis'`)
created by `POST /api/projects/[id]/analyze-images`. Because the tagging gate counts
ALL ProductTags regardless of source, those AI tags auto-satisfy the gate, so fake
selections land on Boards. The founder wants real (manually tagged) selections only.

## Decisions (confirmed with user)
- Keep room detection + auto-sort, but only sort photos above a confidence
  threshold (recommend: skip `low`; sort `high`/`medium`). Don't sort bad misses.
- Drop the descriptor selections that land on Boards entirely (stop creating them).
- Boards tab shows ONLY if real tags/selections exist. No timeline gating.

## Plan
- [x] 1. `analyze-images/route.ts`: delete Phases 3 & 4 (Selection + ProductTag
      descriptor creation). Keep Phases 1-2 (room detect + sort).
- [x] 2. Room-sort confidence threshold: add `roomConfidence` to RoomAnalysis +
      batch/single prompts + validation; route Phase 2 only assigns confident photos.
- [x] 3. `ProjectTabs.tsx`: Boards `visible: totalSelections > 0`; remove the
      lock UI + `boardsLocked` prop.
- [x] 4. `page.tsx`: drop `boardsLocked`; default-view + redirect respect
      `boardsVisible` (totalSelections > 0).
- [x] 5. Wipe script `scripts/wipe-ai-descriptors.ts` (dry-run default, --apply)
      + console command for La Gorce.
- [x] 6. Typecheck, verify, commit, push.

## Review
- **Descriptors stopped at the root.** Removed the Selection/ProductTag creation
  from the analyze-images route, so NO caller (board view, presentation import,
  upload modal) produces `ai_analysis` descriptors anymore. The route now stops
  at room sorting.
- **Room sorting kept + made honest.** Added a `roomConfidence` signal from the
  vision model. Threshold = `medium` (constant `ROOM_SORT_MIN_CONFIDENCE`): photos
  the model is `high`/`medium` sure of get auto-sorted; `low`/omitted are held back
  for manual sorting. "Misses badly" no longer auto-files. Tunable in one place.
- **Boards gated on real tags.** Boards tab is `visible` only when the project has
  selections (`totalSelections > 0`), regardless of timeline. Default-view and the
  boards→media redirect respect the same rule. Removed the old timeline-based
  `boardsLocked` lock UI entirely.
- **Room auto-sort still fires** at upload time (ProjectCreationModal:700,
  MediaSection:171/578) with the new threshold. The old board-view auto-trigger is
  now an unreachable no-op (Boards only shows once selections exist → rooms exist).
- Verified: `tsc` adds zero new errors (only the pre-existing es5/Map-iteration
  artifact remains); phase5e CI check passes (phantomCalls=0).

## Wipe command (run against the DB)
    npx tsx scripts/wipe-ai-descriptors.ts            # dry-run, shows counts
    npx tsx scripts/wipe-ai-descriptors.ts --apply    # deletes ai_analysis sels + tags
