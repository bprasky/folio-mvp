# 20_PUBLISH_FLOW_AND_UPLOAD_WIZARD — Implementation

Branch: `claude/beautiful-euler-Naoo1`. One commit per phase. Phase 0 signed off (see `phase0-findings-20-publish-flow.md`).

## Phase 3b — Spine + single CTA  (no migration)  ✅ committed
- [x] `src/lib/publish/computePublishReadiness.ts` — types + pure derivation (server-side, hydrated to client)
- [x] `src/app/project/[id]/PublishSpine.tsx` — sticky spine: StepRail + StatusLine + PrimaryCTA
- [x] `page.tsx` — compute readiness, pass to MediaSection
- [x] `MediaSection.tsx` — mount spine, remove top "Start Interview" banner, own InterviewModal/Tagger, drop GuidedPublishFlow render
- [x] Acceptance: true counts, one primary CTA = next gate, top button gone, no scroll-to-second-button
- note: GuidedPublishFlow.tsx now orphaned; delete in 3d alongside FinishScheduleOptionsModal

## Phase 3c — Rooms (migration + grouping + exclude)  ✅ committed
- [x] Migration: ADD `inclusion`, `tagState` enums + cols, `roomId` FK on ProjectImage; backfill roomId from legacy `room` string (idempotent, passes phase5e CI)
- [x] RoomGroupedMedia: RoomGroup/RoomHeader/UncategorizedGroup/UncategorizedResolver/AddRoomAffordance/ExcludedGroup (one file)
- [x] Server actions: assignImageToRoom, excludeImage, includeImage, createRoom (assertProjectWrite-gated)
- [x] readiness: roomId authoritative once column exists; page passes inclusion/roomId/tagState
- [x] Wire `rooms` gate to roomId

## Phase 3d — Materials step + tag review
- [ ] `MaterialsStep` (3 cards) replaces blue FinishScheduleOptionsModal
- [ ] `TagReviewPanel` wraps VerificationQueue; markReviewed / markNoProducts
- [ ] Wire `tags` gate to tagState

## Phase 3e — Publish gate + CTA finalize + Boards fork
- [ ] `publishProjectAction` backstop: refuse unless rooms+tags complete
- [ ] Spine secondary "Skip story for now" → Publish
- [ ] Boards tab fork on `timeline` (PAST locked until tags complete)

## Notes / decisions
- Reuse `--surface-canvas`/`--surface-ground`/`--folio-gold (#B8845C)`; no new hexes.
- story gate complete = editorialState !== 'EMPTY' (interview has happened).
- Spine "Publish" = `publishProjectAction` (Posted Project public), distinct from editorial draft publish (Publish tab).
