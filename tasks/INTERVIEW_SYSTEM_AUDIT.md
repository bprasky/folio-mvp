# Designer Interview System Audit

**Date**: 2026-02-04
**Purpose**: Inform upgrade to real-time conversational interviews

---

## 1. DATA MODELS

### Interview-Related Prisma Models

#### EditorialInterview
**Table**: `editorial_interviews`
```prisma
model EditorialInterview {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  status EditorialInterviewStatus @default(IN_PROGRESS)

  selectedQuestionIds String[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  answers EditorialInterviewAnswer[]
}
```

#### EditorialInterviewAnswer
**Table**: `editorial_interview_answers`
```prisma
model EditorialInterviewAnswer {
  id          String             @id @default(cuid())
  interviewId String
  interview   EditorialInterview @relation(fields: [interviewId], references: [id], onDelete: Cascade)

  questionId     String
  isFollowUp     Boolean @default(false)
  parentAnswerId String? // For follow-ups, links to Layer 1 answer

  answerText    String
  audioUrl      String? // Optional: retained audio
  inputModality String  @default("text") // "text" | "voice" | "mixed"

  // AI-extracted metadata
  confidenceScore    Float?
  inferredPriorities String[]
  softConstraints    String[]

  // Contextual question linking
  linkedImageId              String?
  linkedProductId            String?
  questionSource             String? // 'base_question' | 'ai_classification' | 'follow_up'
  aiClassificationAttribute  String? // e.g., "color:sage green"

  createdAt DateTime @default(now())
}
```

#### ProfileInterview (User-level)
**Table**: `profile_interview`
```prisma
model ProfileInterview {
  id                  String    @id @default(cuid())
  userId              String    @unique
  user                User      @relation(...)

  answers             Json      // Interview Q&A
  generatedBio        String?   @db.Text
  shortBio            String?   // 80 words for cards/search
  pullQuotes          Json?     // Array of extracted quotes
  philosophyStatement String?   // One-liner for tagline
  processDescription  String?   @db.Text

  status              ProfileInterviewStatus @default(DRAFT)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

enum ProfileInterviewStatus {
  DRAFT
  PUBLISHED
}
```

#### OrgBioInterview (Organization-level)
**Table**: `org_bio_interview`
```prisma
model OrgBioInterview {
  id              String       @id @default(cuid())
  organizationId  String       @unique
  organization    Organization @relation(...)

  // Layer 1 responses
  originStory       String?   @db.Text
  philosophyStatement String?
  projectTypes      String[]
  location          String?
  serviceRegions    String[]
  idealClient       String?   @db.Text

  // Layer 2 responses (contextual follow-ups)
  layer2Responses   Json?     // { questionId: answer }

  // Layer 3 responses (proof points)
  representativeProjectId String?
  recognitionMentions     String?   @db.Text
  collaboratorMentions    String?   @db.Text

  // AI-generated outputs
  fullBio           String?   @db.Text
  shortBio          String?   // 80 words
  pullQuotes        Json?     // string[]
  philosophyTagline String?   // one-liner
  processDescription String?  @db.Text

  generatedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

#### ProjectPost (Stores interview output)
**Table**: `project_posts`
```prisma
model ProjectPost {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(...)

  status      PostStatus  @default(DRAFT)
  variant     PostVariant @default(PROJECT_FEATURE)
  slug        String      @unique
  heroAssetId String?
  excerpt     String?
  keywords    String[]    @default([])

  expandedBlocks Json?    // <-- Main editorial content
  provenance     Json?    // <-- Interview answers stored here
  credits        Json?

  publishedAt          DateTime?
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
}

enum PostStatus {
  DRAFT
  REVIEW
  PUBLISHED
  ARCHIVED
}
```

#### DesignerVoiceProfile
**Table**: `designer_voice_profile`
```prisma
model DesignerVoiceProfile {
  id                      String   @id @default(cuid())
  designerId              String   @unique
  vocabularyFrequency     Json?
  signaturePhrases        String[]
  terminologyPreferences  Json?
  avgSentenceLength       Float?
  sentenceStructures      Json?
  formalityLevel          Float?
  enthusiasmLevel         Float?
  technicalDepth          Float?
  reasoningStyle          String?
  commonJustifications    String[]
  voiceEmbedding          Bytes?
  interviewAnswerCount    Int      @default(0)
  decisionReasoningCount  Int      @default(0)
  lastAnalyzedAt          DateTime?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  designer                User     @relation(...)
}
```

#### SupplementalQuote (Designer micro-answers)
**Table**: `supplemental_quotes`
```prisma
model SupplementalQuote {
  id              String   @id @default(cuid())
  projectPostId   String
  productTagId    String?  // If quote is about a specific product

  question        String
  answer          String   @db.Text
  source          String   // 'welcome_back', 'trend_interview', 'user_question'

  pinned          Boolean  @default(false)
  displayLocation String?  // 'near_product', 'sidebar', 'end_of_post'

  createdAt       DateTime @default(now())
}
```

#### TrendInterviewRequest
**Table**: `trend_interview_requests`
```prisma
model TrendInterviewRequest {
  id              String    @id @default(cuid())
  trendSignalId   String
  designerId      String
  projectId       String
  productTagId    String?

  question        String
  answer          String?   @db.Text
  answeredAt      DateTime?
  status          String    @default("pending") // 'pending', 'answered', 'skipped', 'expired'
  engagementScore Float?

  createdAt       DateTime  @default(now())
  expiresAt       DateTime
}
```

### IMPORTANT: Missing Models
**NEEDS CLARIFICATION**: The following models were mentioned in the task but **DO NOT EXIST** in schema.prisma:
- `InterviewSession` - Not found
- `TranscriptSegment` - Not found
- `QuoteHighlight` - Not found
- `EditorialDraft` - Not found (functionality merged into `ProjectPost.expandedBlocks`)

---

## 2. INTERVIEW STATUS FLOW

### EditorialInterviewStatus Enum
```prisma
enum EditorialInterviewStatus {
  IN_PROGRESS
  COMPLETED
  PUBLISHED
}
```

### Status Transitions

| From | To | Trigger | Location |
|------|-----|---------|----------|
| (none) | IN_PROGRESS | Interview created | `POST /api/posting/project/[projectId]/interview` |
| IN_PROGRESS | IN_PROGRESS | Answers saved | `POST /api/posting/project/[projectId]/interview` |
| IN_PROGRESS | COMPLETED | All answers submitted | Manual or when all questions answered |
| COMPLETED | PUBLISHED | Post published | When `ProjectPost.status` → PUBLISHED |

### Generation Lock Status (in ProjectPost.provenance.interview.status)
```typescript
{
  phase: 'generating' | 'idle',
  startedAt?: number,
  endedAt?: number,
  lastDurationMs?: number
}
```

This lock prevents concurrent editorial generation - stale locks (>2 min) are auto-released.

---

## 3. API ROUTES

### Interview Routes Under `/api/posting/project/[projectId]/interview/`

| Route | Method | Purpose | Request Shape | Response Shape |
|-------|--------|---------|---------------|----------------|
| `/interview` | GET | Fetch existing answers | - | `{ answers, followUps, selectedQuestionIds, contextualQuestions }` |
| `/interview` | POST | Save interview answers | `{ selectedQuestionIds, answers[], followups[] }` | `{ ok, savedCount, totalCount }` |
| `/interview/questions` | GET | Get available questions | - | `{ questions[] }` |
| `/interview/transcribe` | POST | Transcribe voice to text | FormData: `{ audio: File, questionId? }` | `{ ok, transcript, questionId }` |
| `/interview/followups` | POST | Generate AI follow-ups | `{ answers[] }` | `{ ok, followups[] }` |
| `/interview/followups/single` | POST | Single question follow-up | `{ questionId, answer }` | `{ ok, followups[], acknowledgment? }` |
| `/interview/generate` | POST | Generate editorial draft | `{ forceOverwriteDraft?, mode? }` | `{ ok }` or `{ status: 'in-progress' }` |
| `/interview/status` | GET | Check generation status | - | `{ status, phase }` |
| `/interview/process` | POST | Process answers → decisions | - | `{ success, ...result }` |
| `/interview/verify` | POST | Verify/confirm attributes | - | Attribute verification |

### Legacy Interview Routes (`/api/interviews/[id]/`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/create` | POST | Create interview |
| `/upload-url` | GET | Get presigned URL for audio |
| `/upload` | POST | Upload audio file |
| `/confirm-upload` | POST | Confirm upload complete |
| `/process` | POST | Process recording |
| `/status` | GET | Get processing status |
| `/approve-highlights` | POST | Approve quote highlights |
| `/publish` | POST | Publish interview |

---

## 4. INTERVIEW UI COMPONENTS

### Main Components

| Component | Path | Purpose |
|-----------|------|---------|
| `InterviewModal` | `src/components/posting/interview/InterviewModal.tsx` | Main interview flow modal |
| `PromptPicker` | `src/components/posting/interview/PromptPicker.tsx` | Question selection UI |
| `AnswerForm` | `src/components/posting/interview/AnswerForm.tsx` | Answer input form |
| `FollowUpsForm` | `src/components/posting/interview/FollowUpsForm.tsx` | Follow-up questions UI |
| `QuestionCard` | `src/components/posting/interview/QuestionCard.tsx` | Individual question display |
| `FooterBar` | `src/components/posting/interview/FooterBar.tsx` | Navigation/submit buttons |
| `ProgressIndicator` | `src/components/posting/interview/ProgressIndicator.tsx` | Progress visualization |
| `TagPreview` | `src/components/posting/interview/TagPreview.tsx` | Tagged products preview |
| `LinkedImagePreview` | `src/components/editorial/LinkedImagePreview.tsx` | Contextual image display |
| `InterviewStatusView` | `src/components/interviews/InterviewStatusView.tsx` | Processing status display |
| `BioInterviewModal` | `src/components/org-onboarding/BioInterviewModal.tsx` | Org bio interview modal |
| `InterviewRound` | `src/components/collaboration/InterviewRound.tsx` | Collaboration interview UI |

### Interview Modal Flow
```
Phase: "pick" → "question" → "followup" → "complete"
         ↓          ↓            ↓            ↓
   PromptPicker  QuestionCard  FollowUpsForm  Generate button
```

### Audio Recording
- Audio is captured via browser MediaRecorder API
- Supports: webm, ogg, wav, mp3, m4a formats
- Max file size: 25MB (Whisper limit)
- Audio sent to `/api/posting/project/[projectId]/interview/transcribe`
- Uses OpenAI Whisper for transcription

---

## 5. AI/LLM INTEGRATION

### Services Used

| Service | Purpose | Env Variable |
|---------|---------|--------------|
| OpenAI (Whisper) | Audio transcription | `OPENAI_API_KEY` |
| OpenAI (GPT-4o-mini) | Follow-up generation, Editorial composition (legacy) | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Anthropic (Claude) | Editorial composition (primary), Bio generation, Answer analysis | `ANTHROPIC_API_KEY`, `ANTHROPIC_ENABLED` |

### LLM Call Locations

1. **Transcription** - `src/app/api/posting/project/[projectId]/interview/transcribe/route.ts:107`
   ```typescript
   const transcription = await openai.audio.transcriptions.create({
     file: file,
     model: "whisper-1",
     language: "en",
   });
   ```

2. **Follow-up Generation** - `src/app/api/posting/project/[projectId]/interview/followups/route.ts:257`
   ```typescript
   await openai.chat.completions.create({
     model: modelName,
     messages: [...],
     temperature: 0.7,
     max_tokens: 500,
     response_format: { type: "json_object" },
   });
   ```

3. **Editorial Generation** - `src/app/api/posting/project/[projectId]/interview/generate/route.ts:606`
   ```typescript
   await anthropic.messages.create({
     model: 'claude-sonnet-4-20250514',
     max_tokens: 4096,
     system: EDITORIAL_SYSTEM_PROMPT,
     messages: [{ role: 'user', content: userPrompt }],
     temperature: 0.7,
   });
   ```

4. **Answer Analysis** - `src/lib/interview/answerAnalysis.ts`
   - Analyzes answers for boost eligibility
   - Extracts vendor sentiment

5. **Contextual Question Generation** - `src/lib/editorial/generateContextualQuestions.ts`
   - Generates questions based on image AI classification

### Prompt Templates

**Editorial System Prompt** (from generate/route.ts):
```
You are an expert interior design editorial writer for a prestigious design publication.

YOUR EXPERTISE:
- Writing compelling narratives about residential interior design
- Understanding spatial flow and room relationships
- Connecting design decisions to lived experience
- Weaving product selections naturally into storytelling
- Creating room-by-room narratives that flow cohesively
...
```

**Follow-up System Prompt** (from followups/route.ts):
```
You are an editorial interviewer for Folio. For each designer answer below,
suggest up to two open-ended follow-up questions that could draw out a richer
narrative. Only ask when something is interesting or vague. Keep each under
120 characters.
```

---

## 6. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DESIGNER INTERVIEW FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

1. INITIATE INTERVIEW
   ┌─────────────────┐
   │ Designer opens  │
   │ InterviewModal  │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────────────────────────────┐
   │ GET /interview/questions                │
   │ → assessProjectContext(projectId)       │
   │ → generateInterviewQuestions(context)   │
   │ → Returns base + contextual questions   │
   └────────┬────────────────────────────────┘
            │
2. ANSWER COLLECTION
            ▼
   ┌─────────────────────────────────────────┐
   │ Designer selects questions (PromptPicker)│
   │ Designer provides answers:              │
   │   - Text input (AnswerForm)             │
   │   - Voice recording (MediaRecorder API) │
   └────────┬────────────────────────────────┘
            │
            ├──── Voice Path ────────────────┐
            │                                │
            ▼                                ▼
   ┌─────────────────┐              ┌─────────────────┐
   │ Text answer     │              │ POST /interview/│
   │ saved to state  │              │ transcribe      │
   └────────┬────────┘              │ (OpenAI Whisper)│
            │                       └────────┬────────┘
            │                                │
            ▼                                ▼
   ┌─────────────────────────────────────────┐
   │ POST /interview                         │
   │ → normalizeAnswers()                    │
   │ → Save to ProjectPost.provenance        │
   │ → Sync to EditorialInterviewAnswer      │
   │ → logAttributeVerifications()           │
   └────────┬────────────────────────────────┘
            │
3. FOLLOW-UP GENERATION
            ▼
   ┌─────────────────────────────────────────┐
   │ POST /interview/followups               │
   │ → OpenAI GPT-4o-mini                    │
   │ → Generate contextual follow-ups        │
   │ → Cache in memory + save to provenance  │
   └────────┬────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────────────┐
   │ Designer answers follow-ups             │
   │ (FollowUpsForm)                         │
   └────────┬────────────────────────────────┘
            │
4. EDITORIAL GENERATION
            ▼
   ┌─────────────────────────────────────────┐
   │ POST /interview/generate                │
   │ → Acquire generation lock               │
   │ → composeEditorialHard()                │
   │   → Anthropic Claude Sonnet             │
   │   → Room-organized prompt               │
   │   → Validate with ComposedDraftSchema   │
   │ → Save to ProjectPost.expandedBlocks    │
   │ → Release lock                          │
   └────────┬────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────────────┐
   │ ProjectPost created/updated:            │
   │ ├── expandedBlocks (editorial content)  │
   │ │   ├── lead: { kicker, deck }          │
   │ │   ├── galleryChapters[]               │
   │ │   │   ├── title                       │
   │ │   │   ├── imageIds[]                  │
   │ │   │   └── body[]                      │
   │ │   ├── pullQuotes[]                    │
   │ │   ├── credits[]                       │
   │ │   └── materialsLedger                 │
   │ │                                       │
   │ └── provenance (interview data)         │
   │     ├── interview.payload.answers[]     │
   │     ├── interview.payload.followups[]   │
   │     ├── interview.generatedAt           │
   │     └── interview.status                │
   └────────┬────────────────────────────────┘
            │
5. PUBLISH
            ▼
   ┌─────────────────────────────────────────┐
   │ Designer reviews preview                │
   │ → /designer/projects/[id]/preview       │
   │ → Publish to public editorial           │
   │ → ProjectPost.status = PUBLISHED        │
   └─────────────────────────────────────────┘
```

---

## 7. CURRENT LIMITATIONS

### One-Way Interview
- **Current**: Designer speaks/types → AI processes asynchronously → No real-time response
- **No back-and-forth**: AI generates follow-ups only after all base answers submitted
- **No conversational context**: Each follow-up is generated without knowledge of previous follow-up answers

### Batch Processing vs Streaming
- Transcription: Batch (file upload → Whisper → return text)
- Follow-up generation: Batch (all answers → GPT → return follow-ups)
- Editorial generation: Batch (all content → Claude → return draft)
- **No streaming**: User sees "generating..." with no progressive feedback

### Context Handling
- Project images ARE used for contextual questions (via `aiClassification`)
- Previous answers ARE passed to follow-up generation
- **BUT**: No real-time context awareness during conversation

### Latency Points
1. **Audio transcription**: ~2-5 seconds per recording
2. **Follow-up generation**: ~3-10 seconds for batch
3. **Editorial generation**: ~15-30 seconds (largest bottleneck)

### TODO Comments and Unfinished Features
- `audioUrl` field on `EditorialInterviewAnswer` exists but rarely populated
- Voice profile analysis (`DesignerVoiceProfile`) updated but not used in real-time
- `TrendInterviewRequest` system exists but separate from main interview flow

---

## 8. INTEGRATION POINTS FOR UPGRADE

### Where to Establish LiveKit/WebRTC Connection
**Recommended**: Create new components and routes:
```
src/components/posting/interview/RealtimeInterviewModal.tsx  (new)
src/app/api/interview/realtime/                              (new)
  ├── session/route.ts       - Create/manage sessions
  ├── token/route.ts         - Generate LiveKit tokens
  └── webhook/route.ts       - Handle LiveKit events
```

### Where Streaming Transcription Would Replace Batch
**File**: `src/app/api/posting/project/[projectId]/interview/transcribe/route.ts`
- Current: Accepts file upload → Whisper API
- New: WebSocket/LiveKit audio stream → Real-time transcription service

### Where Claude Responses Would Be Injected
**Current flow to modify**:
1. `InterviewModal.tsx` - Add real-time response display
2. Create new service: `src/lib/interview/realtimeConversation.ts`
3. API route: `src/app/api/interview/realtime/respond/route.ts`

### Where Real-Time Extractions Would Be Stored

**Option A**: Extend `EditorialInterviewAnswer`
```prisma
model EditorialInterviewAnswer {
  // ... existing fields

  // New real-time fields
  transcriptChunks    Json?     // [{ text, timestamp, confidence }]
  aiResponseChunks    Json?     // [{ text, timestamp }]
  extractedEntities   Json?     // [{ type, value, timestamp }]
  sentiment           Json?     // { score, keywords }
  realtimeSessionId   String?   // Reference to conversation session
}
```

**Option B**: Create new `RealtimeConversationSegment` model
```prisma
model RealtimeConversationSegment {
  id              String   @id @default(cuid())
  interviewId     String
  interview       EditorialInterview @relation(...)

  role            String   // 'designer' | 'ai'
  content         String
  timestamp       DateTime

  // Transcription metadata
  transcriptChunks Json?
  confidence       Float?

  // AI extraction
  extractedQuotes   String[]
  extractedProducts String[]
  extractedMood     String?

  createdAt        DateTime @default(now())
}
```

---

## 9. ENV VARIABLES & EXTERNAL SERVICES

### Current Services

| Variable | Service | Purpose | Required |
|----------|---------|---------|----------|
| `OPENAI_API_KEY` | OpenAI | Whisper transcription, GPT follow-ups | Yes |
| `OPENAI_ENABLED` | - | Feature flag | No (default: true) |
| `OPENAI_MODEL` | OpenAI | Model selection | No (default: gpt-4o-mini) |
| `OPENAI_MAX_TOKENS` | - | Token limit | No (default: 2000) |
| `OPENAI_TIMEOUT_MS` | - | Request timeout | No (default: 7000) |
| `ANTHROPIC_API_KEY` | Anthropic | Claude editorial generation | Yes (for editorial) |
| `ANTHROPIC_ENABLED` | - | Feature flag | No (default: false) |
| `POSTING_V1` | - | Feature flag for posting system | No (auto-enabled in dev) |
| `POSTING_FORCE_FALLBACK` | - | Force fallback mode | No |

### Services NOT Currently Used
- Deepgram - Not found
- AssemblyAI - Not found
- LiveKit/WebRTC - Not found
- TTS (Text-to-Speech) - Not found

---

## 10. SUMMARY

### File Reference Table

| Category | File | Purpose |
|----------|------|---------|
| **Data Model** | `prisma/schema.prisma` | All models defined here |
| **Main Modal** | `src/components/posting/interview/InterviewModal.tsx` | Primary interview UI |
| **Question Bank** | `src/lib/posting/questionBank.ts` | Static question definitions |
| **Question Generation** | `src/lib/editorial/getInterviewQuestions.ts` | Dynamic question generation |
| **Contextual Questions** | `src/lib/editorial/generateContextualQuestions.ts` | AI-based contextual questions |
| **Answer Schemas** | `src/lib/posting/interviewSchemas.ts` | Zod schemas for answers |
| **Editorial Generation** | `src/lib/posting/generateEditorialDraft.ts` | Legacy editorial composer |
| **Hard-Fail Editorial** | `src/app/api/posting/project/[projectId]/interview/generate/route.ts` | Current editorial composer |
| **Transcription** | `src/app/api/posting/project/[projectId]/interview/transcribe/route.ts` | Whisper integration |
| **Follow-ups** | `src/app/api/posting/project/[projectId]/interview/followups/route.ts` | AI follow-up generation |
| **LLM Client** | `src/lib/posting/llmClient.ts` | Retry/error handling wrapper |
| **Interview Lib** | `src/lib/interview/index.ts` | Contextual interview system |
| **Answer Analysis** | `src/lib/interview/answerAnalysis.ts` | Boost eligibility analysis |

### Architectural Patterns to Preserve

1. **Interview data persists in `ProjectPost.provenance`** - Don't lose answers even if generation fails
2. **Generation locking** - Prevents concurrent editorial generation
3. **Context-aware questions** - Questions scale with available project data
4. **Graceful degradation** - Fallback to base questions if AI unavailable
5. **Room-organized editorial** - Content structured by room/space

### Architectural Patterns to Change

1. **Batch → Streaming** - Move from file upload to real-time audio
2. **Async → Real-time** - Enable back-and-forth conversation
3. **Single LLM call → Continuous** - Stream AI responses during conversation
4. **Post-hoc extraction → Real-time** - Extract quotes/insights as they happen
5. **Text-first → Voice-first** - Optimize for spoken interaction

### Files Requiring Modification for Upgrade

1. `src/components/posting/interview/InterviewModal.tsx` - Major rewrite
2. `src/app/api/posting/project/[projectId]/interview/transcribe/route.ts` - Replace with streaming
3. NEW: `src/app/api/interview/realtime/` - New route directory
4. NEW: `src/lib/interview/realtimeConversation.ts` - Conversation state management
5. `prisma/schema.prisma` - Add real-time segment models
6. NEW: LiveKit/WebRTC client integration
