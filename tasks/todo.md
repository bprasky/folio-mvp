# Story answers: question text, room grouping, tracker consistency, edit-jump
(branch: claude/question-id-rooms-progress-th0ggx)

## Reported (screenshot of `/project/<id>?view=story`)
1. Every saved answer reads "Untitled question" — pull the question through so
   the designer sees what they answered.
2. The answers are one flat list of 46 rows; group them by room.
3. The tracker is inconsistent: Tags is a hollow bubble while the later Story
   step is active. "If story is unlocked it means tag should be checked" —
   without reducing functionality.
4. Clicking an answer opens the interview modal and starts generating questions
   again instead of jumping to that question for editing.

## Root causes

- **(1) Question text was never persisted for room-paced answers.**
  `persistAnswers` resolves the prompt with
  `allQuestions.find(q => q.id === item.questionId)`, and `allQuestions` is the
  FLAT contextual list. Room-paced questions come from `roomFlow` (the grouped
  endpoint) and are absent from that list, so every room answer saved with
  `prompt: ''`. `sanitizeAnswerForSend` also strips the `prompt` the submit
  handler had already resolved, so the one place that had the text lost it.
  The GET's read-time backfill from `provenance.interview.questionSet` can't
  recover it either: the question signature folds in per-room tag CONTENT, so
  tagging a product mints fresh question UUIDs and orphans every saved id.
  Answers have to own their question text.

- **(4) Edit-jump re-enters the whole interview machine.** `jumpToQuestionId`
  mounts InterviewModal, which triggers the rooms generation phase
  (`loadRooms`) → the "Preparing questions for each room…" screen; and when the
  saved id isn't in the regenerated set, the jump falls back to
  `setResumeRequested(true)` → `resumePlan.allDone` → `autoGenerate` +
  `phase: 'complete'` — the generation screen the report describes.
  `EditReflectionModal`'s own docstring already says it is the only reliable
  single-answer editor, for exactly this reason.

- **(3) Two notions of progress, one variable.** `frontierIndex` (first
  incomplete step) drives marker state, track fill AND navigation — but the
  Story step is deliberately exempt from the navigation gate, so a later step
  can be active while an earlier one still renders as unreached.

## Plan
- [x] `computeTrackerState`: add `reachedIndex` (furthest step with real
      progress: the frontier, any completed step beyond it, and the interview
      step once answers exist) plus per-step `remaining`. Markers, track fill
      and navigation read `reachedIndex`; the next-action zone still opens on
      `frontierIndex` so "what to do next" is unchanged.
- [x] `ProjectProgressTracker`: check every step behind `reachedIndex`, and show
      `N left` under a checked step that still has open work — no hollow bubble
      behind real progress, no information lost.
- [x] `page.tsx`: pass gate `remaining` into the tracker and the project's
      rooms down to the Story panel.
- [x] `InterviewModal`: resolve question text from the room-paced set too, keep
      `prompt` through sanitize/normalize, and delete the `jumpToQuestionId`
      path entirely (it was the only caller).
- [x] `StoryInterviewPanel`: group answers by room (About This Project first),
      render the question text with a questionId-derived category fallback, and
      always edit through `EditReflectionModal`.
- [x] `interview` route: merge answers by question (not by answer content), write
      `questionText` on the EditorialInterviewAnswer projection, and stop wiping
      saved follow-ups on a partial answer save.

## Review
- `npx tsc --noEmit` — zero new errors; two pre-existing ones in the interview
  route are gone (the old content-keyed merge). `next build` compiles.
  `phase5e-check-plan.mjs --ci` clean.
- No database in this environment, so no browser run against the reported
  project. Verified by reading the changed paths end to end plus a replay of
  `deriveTrackerState` over the reported shape (31 photos, 19 rooms, 4 untagged,
  31 answers, no draft): Photos ✓ · Rooms ✓ · Tags ✓ "4 left" · Story
  current/active · Publish locked. Tags stays clickable and publish stays gated,
  exactly as before — only the marker states changed.
- Editing an answer now opens the pre-filled editor: no question generation, no
  LLM call, no resume/finish side effects. Saving merges by questionId.

---

# Part 2 — make the answers analysable across designers and projects

Stated goal: a cause-and-effect graph per designer, plus trends across many
designers, to draft Folio articles and feed vendor insight. That needs the
interview's OUTPUT to be a queryable record, not just something the draft
generator can read back for one project.

Audit of what actually reached `editorial_interview_answers` before this:

| Column | State | Why |
| --- | --- | --- |
| `question_text` | always NULL | never written (fixed in Part 1) |
| `linked_image_id` | always NULL | rode in an undeclared `metadata` bag that `normalizeAnswers` strips — proven by replay against main |
| `linked_product_id` | always NULL | same |
| `ai_classification_attribute` | always NULL | same |
| `parent_answer_id` | always NULL | never written by anything; the draft generator READS it |
| `room_id` / `question_source` | partial | client resolved them from the FLAT question list only, so room-paced answers (the normal case) got nulls |
| whole rows | sometimes absent | the sync was gated on `hasNewFields` |
| `created_at` | wrong | wipe-and-rebuild reset every row to the last save |

So the interview knew "this question is about the Rove travertine table, it's a
vendor-loyalty question, it came out of that earlier answer" — and dropped all of
it at the save boundary. Same failure family as the empty prompts, one map over.

- [x] Declare `linkedImageId`, `linkedProductId`, `aiClassificationAttribute`,
      `parentQuestionId` first-class in the answer schema (like roomId in D5), so
      they survive into provenance AND the projection.
- [x] Build the client's question-metadata map from the room-paced set too, so
      room answers carry their real linkage instead of nulls.
- [x] Persist the follow-up → parent edge and resolve it to `parentAnswerId`.
- [x] Rebuild the projection on every answer write, not on a field heuristic.
- [x] Preserve each answer's original `createdAt` across rebuilds.
- [x] One projection writer (`rebuildAnswerProjection`), used by both the
      interview save and `syncAnswersToEditorialInterview` — they were writing
      different subsets of the same row, so whichever ran last decided how much
      of the record survived.
- [x] Refuse to infer a destructive clear: an empty answer payload only wipes
      when the caller sends `clearAll: true`.
- [x] `scripts/reproject-interview-answers.ts` to replay provenance into the
      projection for everything already collected (`--dry-run` first).

Verified: replayed `normalizeAnswers` against main — the four linkage fields come
back `undefined` on main and intact here. Build + phase5e check clean.

## Notes / follow-ups
- Answers saved before this change still can't recover their exact wording (the
  question set that minted their ids is gone). They now show the category parsed
  from the questionId ("Client Brief", "Materials Method"…) and the editor lets
  the designer type the question in. Every new answer keeps its text.
- Found and fixed in passing: `mergeAnswers` keyed answers with `makeAnswerKey`,
  which folds the ANSWER TEXT into the key — so rewriting an answer didn't
  replace it, it appended a second entry for the same question and left the old
  wording in provenance. Now keyed by questionId + isFollowUp.
- Found and fixed in passing: any partial POST to
  `/api/posting/project/[id]/interview` (single-answer save, or the Story tab's
  edit) rebuilt `payload.followups` from the incoming request only, wiping every
  saved follow-up answer. Existing follow-ups are now merged back in.
- Not touched: the rooms-phase question signature still invalidates on retag,
  which is what orphans question ids. Persisting the text on the answer makes
  that harmless for display; making ids stable across regeneration is a bigger
  change and belongs in its own pass.

## Still open for the cross-project graph (needs a decision, some need migrations)

1. **Room questions have no cross-project identity.** Project questions are
   `project-<CATEGORY>-<uuid>` over a fixed five-category taxonomy
   (CLIENT_BRIEF, SCOPE_PARAMETERS, DESIGN_DIRECTION, SIGNATURE_IDENTITY,
   SURPRISE_PIVOT) — so "how do 40 designers answer the identity question" is
   already answerable. Room questions are minted as a bare `randomUUID()`
   (`generateRoomQuestions.ts:218`), so there is nothing to group them by across
   projects. The generator DOES classify each one (`type`: hero_piece /
   vendor_loyalty / material_theme / spatial_narrative / generic, plus `topic`,
   `products[]`, `vendors[]`, `boostable`, `contextLevel`) and then throws it
   away. Capturing `questionType` / `topic` / `contextLevel` on the answer is the
   single highest-value addition for trend analysis — needs 3 columns.
2. **No vendor/product edge for descriptor-only mentions.** `linkedProductId`
   covers a tagged selection; a designer naming a vendor in prose isn't linked to
   anything. Vendor-facing insight probably wants extraction into a join table.
3. **Answers can't be sliced by designer/org/project type without a 3-hop join**
   (answer → interview → project → designer). Fine for now; denormalise only if
   the queries get slow.
4. **Third projection writer**: `api/interview/realtime/convert` wipes and
   recreates rows for voice interviews with its own (thinner) shape. It should go
   through `rebuildAnswerProjection` too — untouched here because it's a separate
   flow I haven't traced end to end.
</content>
