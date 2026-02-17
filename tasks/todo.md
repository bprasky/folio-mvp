# Interview Flow Implementation

## Completed
- [x] Created interview component directory structure (`src/components/interview/`)
- [x] Implemented types (`types.ts`)
- [x] Implemented shared components:
  - InterviewQuestion.tsx (italic styling user likes)
  - ProgressIndicator.tsx (dots, not counters)
  - ModeSwitcher.tsx
  - EditorialPreview.tsx
- [x] Implemented ModeSelection.tsx (voice vs text cards)
- [x] Implemented TextInterview flow:
  - TextInterview.tsx (container)
  - QuestionCard.tsx (single question per screen)
  - FollowUpTransition.tsx (AI thinking state)
- [x] Implemented useInterviewSession hook
- [x] Created API routes:
  - POST /api/interview/start
  - POST /api/interview/respond
  - POST /api/interview/generate-draft
- [x] Implemented InterviewFlow.tsx (main orchestrator)
- [x] Created VoiceInterview placeholder components (Phase 2)

## Phase 2 (Voice Interview)
- [ ] Implement actual voice recording
- [ ] Integrate with LiveKit or similar
- [ ] Implement TTS for AI questions
- [ ] Real-time transcription

## Interview Intelligence System (Feb 2026)

### Completed
- [x] **Phase 0A**: Fix `recordAtelierSignal()` — `value` → `metadata: { value }` (schema mismatch)
- [x] **Phase 0B**: Fix all 8 signal callers — `PRODUCT_TAG` → `TAG`, `PROJECT` → `INTERVIEW`
- [x] **Phase 0D**: Remove "Unknown Brand" fallbacks from interview context, add warning logs
- [x] **Phase 1A**: Create `digestInterviewAnswer.ts` — heuristic richness scoring, philosophy/pairing/vendor/client detection
- [x] **Phase 1B**: Integrate digestion into `processInterviewAnswers.ts` — process ALL answers, emit Atelier signals
- [x] **Phase 1C**: Plug digestion into `followups/single` — inject thin/thread/philosophy/vendor context into LLM prompt
- [x] **Phase 2**: Create `buildInterviewBrief.ts` — project-level aesthetic aggregation, designer context, Claude vision narrative synthesis, caching
- [x] **Phase 3**: AI question generation — quality gate, template fallback, feature-gated via `INTERVIEW_AI_QUESTIONS=true`
- [x] **Phase 5**: Voice mode enrichment — ContextManager narrative brief, angle tracking, ConversationManager brief loading
- [x] **Phase 6**: Cross-interview learning signals — per-answer + completion summary signals (query/aggregation deferred)

### Pending
- [ ] **Phase 0D (remaining)**: Vendor data backfill script (diagnose null vendor pipeline, re-extract from sourceUrl)
- [ ] Cross-interview learning loop (deferred until 10+ interviews accumulated)
- [ ] Verification: end-to-end test with real project data

### New Files
- `src/lib/interview/digestInterviewAnswer.ts`
- `src/lib/interview/buildInterviewBrief.ts`

### Modified Files
- `src/lib/atelier/signals.ts`
- `src/app/api/tag-product-to-image/route.ts`
- `src/lib/editorial/processInterviewAnswers.ts`
- `src/app/api/posting/project/[projectId]/interview/followups/single/route.ts`
- `src/lib/interview/generateQuestions.ts`
- `src/lib/interview/index.ts`
- `src/lib/interview/contextLevel.ts`
- `services/interview-orchestration/src/conversation/context.ts`
- `services/interview-orchestration/src/conversation/manager.ts`

## Integration Notes
- Feature flag: Check for `INTERVIEW_V2` to enable new flow
- The new components are in `src/components/interview/`
- Existing interview code is in `src/components/posting/interview/` (not modified)
- API routes use in-memory session storage (demo) - production should use Redis/DB

## Usage

```tsx
import { InterviewFlow } from "@/components/interview";

<InterviewFlow
  projectId={projectId}
  projectName="My Project"
  images={images}
  onComplete={(draftId) => console.log("Draft created:", draftId)}
  onCancel={() => setOpen(false)}
  initialMode="text" // optional, skips mode selection
/>
```
