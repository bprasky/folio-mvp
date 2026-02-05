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
