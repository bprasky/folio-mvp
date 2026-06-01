# Phase 0 Findings — 20_PUBLISH_FLOW_AND_UPLOAD_WIZARD

Read-only audit. No code changed. Confirms the real names behind the spec's placeholders.
**Sign off before Phase 3b.**

## Placeholder → Real name map

| Spec placeholder | Reality | File |
|---|---|---|
| Route `/project/[id]/view-media` | **Does not exist as its own route.** Media is `view=media` query param on the main project page | `src/app/project/[id]/page.tsx` (`ProjectPage`, default export) |
| Workspace page component | `ProjectPage` renders `MediaSection` when `view=media` (page.tsx:268-275) | `src/app/project/[id]/MediaSection.tsx` (`MediaSection`) |
| Project header | `ProjectHeader` | `src/app/project/[id]/ProjectHeader.tsx` |
| Top "Start Interview" button | Lives in **MediaSection, not the header** — promo banner shown at 3+ images | `MediaSection.tsx:277` |
| Bottom "Proceed to publish" button | `GuidedPublishFlow` | `GuidedPublishFlow.tsx:245` (also "Generate Story" :230) |
| Off-brand "Before Your Interview" modal | `FinishScheduleOptionsModal` — blue gradient header at line 113, title at 114 | `src/components/posting/FinishScheduleOptionsModal.tsx` |
| Modal trigger | `handleOpenInterview()` → `setShowFinishScheduleModal(true)` | `GuidedPublishFlow.tsx:74-77` (buttons :233, :242; instantiated :271) |
| AI tag verification queue | `VerificationQueue` + `PendingTagCard` (Confirm :142 / Correct :156 / Dismiss :165) | `src/components/import/VerificationQueue.tsx`, `PendingTagCard.tsx` |
| `publishProjectAction()` | `(raw: unknown)`; sets `isPublic:true`, `status:'published'`, `publishedAt`. **Called from designer dashboard, NOT this page** | `src/app/actions/projects.ts:275-360`; caller `src/app/designer/PublishButton.tsx:18` |
| `ProjectTimeline` enum | `PAST` / `PRESENT` / `FUTURE`. **PAST = completed.** `timeline` column nullable, **no default** | `prisma/schema.prisma:1369-1373`, col :429 |
| `PUBLISHED_PROJECT_FILTER` | `OR: [isPublic:true, publishedAt:{not:null}, status:'published']` | `src/server/queries/filters.ts:9-15` |
| Glass classes | All six exist: `glass-surface`, `-sm`, `-overlay`, `-backdrop`, `-badge`, `-sticky` | `src/styles/glass-tokens.css` |
| `ProjectParticipant` | `side: ParticipantSide` (DESIGNER/VENDOR/ARCHITECT/BUILDER), `role: ParticipantRole` (OWNER/EDITOR/VIEWER, default VIEWER) | `prisma/schema.prisma:1445-1473` |

## ⚠️ Discrepancies that change the plan

1. **No `/view-media` route exists.** The spec is written against a route that isn't there. Real surface is `src/app/project/[id]/page.tsx` (`?view=media`) → `MediaSection`. Every "ProjectWorkspacePage" reference in the spec maps here. The new `PublishSpine` belongs in `ProjectPage`/`MediaSection`, and the spec's component tree must be re-pinned to these files.

2. **`ProjectImage.room` is a free-text `String?`, NOT a relation.** There is a `Room` model (`@@map("rooms")`, schema:789) and `Project.rooms[]`, but `ProjectImage` has only a loose `room String?` string field (schema:518) — no `roomId` FK. **Phase 3c's migration must ADD `roomId String?` nullable + relation** (ADD-only, idempotent — matches the spec's "if absent, ADD nullable roomId" branch). The current "7 rooms" count comes from `project.rooms?.length` (`GuidedPublishFlow.tsx:53`), unrelated to image assignment.

3. **Design tokens are named differently.** Spec wants `--folio-canvas` / `--folio-warm-ground` / `--folio-gold #C9A96E`. Reality: `--surface-canvas: #FFFFFF` and `--surface-ground: #FAF8F5` exist; `--folio-gold` exists but is **`#B8845C`**, not `#C9A96E`. The two `--folio-*` surface tokens do **not** exist. Per "do not introduce new color primitives," we should reuse `--surface-canvas`/`--surface-ground`/`--folio-gold` as-is and NOT add the spec's literal hexes.

4. **`publishProjectAction` is not wired to this page today.** It's invoked from the designer dashboard (`PublishButton.tsx`). Phase 3e will need to call it from the spine CTA and add the `rooms`+`tags` backstop gate inside the action.

5. **The blue modal flow is load-bearing.** `FinishScheduleOptionsModal` currently gates the interview (skip → tag-decision modal; uploaded/later → `InterviewModal`). Phase 3d's "delete the blue modal" must re-route those branches, not just remove the component.

## Decisions (signed off)

- **Surface:** New components land in `ProjectPage` / `MediaSection` (no new `/view-media` route). The spec's `ProjectWorkspacePage` == this surface.
- **Phase 3c migration:** ADD `roomId String?` + `room Room?` relation to `ProjectImage`, **then backfill** `roomId` from the legacy `room String?` text values (match against `Room.name` per project). ADD-only, idempotent, nullable. Legacy `room String?` retained.
- **Tokens:** Reuse existing `--surface-canvas` (#FFFFFF), `--surface-ground` (#FAF8F5), `--folio-gold` (#B8845C). Do NOT introduce the spec's literal `--folio-canvas` / `--folio-warm-ground` / `#C9A96E`. Honors "no new color primitives."
