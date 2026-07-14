# Interview Flow Audit — Posting Interview (NEXT_PUBLIC_POSTING_V1)

Read-only audit. Facts only. No recommendations. Where something does not
exist, it is stated as not existing.

Scope: the posting interview flow gated behind `NEXT_PUBLIC_POSTING_V1`.

Flag gating reference points:
- Client render gate: `src/app/project/[id]/StoryPanel.tsx:49` and
  `src/app/designer/projects/[id]/preview/page.tsx:15` —
  `const POSTING_V1_ENABLED = process.env.NEXT_PUBLIC_POSTING_V1 === "true"`.
- Server route gate (repeated in every interview API route):
  `const POSTING_V1_ENABLED = (process.env.POSTING_V1 ?? "").toLowerCase() === "true" || (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" || process.env.NODE_ENV !== "production"` — e.g.
  `src/app/api/posting/project/[projectId]/interview/route.ts:125-128`.
- The `InterviewModal` component file itself contains no flag check; it is
  gated by its callers (`src/app/project/[id]/MediaSection.tsx:547`,
  `src/app/project/[id]/StagingPublishPanel.tsx`).

---

## 1. INTERVIEW MODAL

### Component and children

`src/components/posting/interview/InterviewModal.tsx` (2334 lines). The
`InterviewModal` function begins at line 105.

Children it renders (imports at lines 12–29):
- `InterviewModeSelector` (`./InterviewModeSelector`) — rendered at
  `InterviewModal.tsx:1805` when `interviewMode === "select"`, `phase === "question"`,
  `currentQuestionIndex === 0`, and no base answers.
- `RealtimeInterviewView` (`./RealtimeInterviewView`) — rendered at line 1817
  when `interviewMode === "realtime"` (voice mode).
- `QuestionCard` (`./QuestionCard`) — rendered at line 2062 for the active
  question in text mode.
- `FooterBar` (`./FooterBar`) — rendered at line 2160.
- `FollowUpsForm` (`./FollowUpsForm`) — rendered at line 2124 (followup phase).
- `RoomProgressBar` (`./RoomProgressBar`) — rendered at line 1888 (room pacing).
- `GenerationProgress` (`@/components/ui/GenerationProgress`) — rendered at
  line 2111 (the `phase === "complete"` generation screen).
- `LinkedImagePreview` (`@/components/editorial/LinkedImagePreview`) —
  imported at line 27 but **not rendered directly by the modal**; it is
  rendered inside `QuestionCard` (`QuestionCard.tsx:113`). See "Images" below.
- UI primitives: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  (`@/components/ui/dialog`), and the `X` icon (`lucide-react`).

Two parallel question-source hooks feed the modal:
- `useInterviewQuestions` (`src/hooks/useInterviewQuestions.ts`) — the flat
  question list (`InterviewModal.tsx:483`).
- `useRoomInterviewQuestions` (`src/hooks/useRoomInterviewQuestions.ts`) — the
  room-grouped list (`InterviewModal.tsx:489`).
- `useRoomInterviewFlow` (`src/hooks/useRoomInterviewFlow.ts`) — per-room
  navigation state machine (`InterviewModal.tsx:509`).
- `useBackgroundEvaluation` (`InterviewModal.tsx:156`) — speculative morph
  pre-compute while the user types.

### How questions are held in state / advance / back

State is split between two modes, selected by `hasRoomPacing`
(`InterviewModal.tsx:490-493`, true when `roomData.rooms.length > 0` and either
more than one room or `projectSize.roomCount >= 1`).

Flat mode (no room pacing):
- `selectedQuestionIds: string[]` (`:129`) and `currentQuestionIndex: number`
  (`:123`) drive position. `selectedQuestions` is derived at `:603-607`.
- `currentQuestion = selectedQuestions[currentQuestionIndex]` (`:621`).
- Advance: `setCurrentQuestionIndex((prev) => prev + 1)` in
  `handleQuestionAnswerSubmit` (`:1069-1070`).
- Back: `setCurrentQuestionIndex((prev) => prev - 1)` in the `FooterBar`
  `onBack` handler (`:2175`).

Room-paced mode:
- Navigation lives in `useRoomInterviewFlow` (`src/hooks/useRoomInterviewFlow.ts`).
  It holds `currentRoomIndex`, `currentQuestionIndex` (per room),
  `roomProgress` (RoomProgressMap), `roomQuestionOverrides` (base + inserted
  follow-ups), `roomRound` (round counter per room), `pendingRoundTransition`.
- `currentQuestion` derives from `roomFlow.currentQuestion`
  (`InterviewModal.tsx:611-621`).
- Advance: `roomFlow.recordAnswer(...)` then `roomFlow.advanceQuestion()`
  (`:1060-1061`; hook logic at `useRoomInterviewFlow.ts:317-351`).
- Back: `roomFlow.goToPreviousQuestion()` (`InterviewModal.tsx:2173`; hook at
  `useRoomInterviewFlow.ts:538-548`). `canGoBack` is `currentQuestionIndex > 0`
  within the current room/phase (`useRoomInterviewFlow.ts:534-536`) — back does
  not cross room boundaries.

Phase model (`InterviewModal.tsx:122`):
`phase: "question" | "followup" | "complete"`. A legacy `step: "answer" |
"followups"` (`:128`) is kept in parallel for the batch follow-up path.

### Progress pills

- Component: `RoomProgressBar` (`src/components/posting/interview/RoomProgressBar.tsx`),
  rendered only in room-paced mode (`InterviewModal.tsx:1886-1902`). In flat
  mode there are no pills — just the text `Question {n} of {total}`
  (`InterviewModal.tsx:1904-1906`).
- Styling: pill = rounded-full bordered button per room
  (`RoomProgressBar.tsx:78-93`). Status icon per room via `StatusIcon`
  (`:22-42`): complete = check (`&#10003;`), in_progress = `&#9684;`, skipped =
  strikethrough `&#8709;`, not_started = `&#9675;`. Border/background color
  from `statusBorderClass` (`:44-57`) keyed on status + whether it is the
  current room. The "About This Project" pseudo-room renders italic with a
  vertical separator after it (`:78-96`). Below the pills, a line reads
  `{roomName} — {n} of {total} questions` or `Follow-up n of m` when
  `currentRound > 1` (`:103-110`).
- State source: `roomFlow.roomProgress` and `roomFlow.currentRoomIndex /
  currentQuestionIndex / currentRound` (passed in at `InterviewModal.tsx:1889-1900`).
  `roomProgress` is a `RoomProgressMap` maintained inside `useRoomInterviewFlow`
  (initialized `:116-127`, updated in `recordAnswer` `:238-264` and
  `finalizeRoomAndAdvance` `:288-314`).

### Where answers are stored while in progress / when they persist

In-progress client state:
- `answers: InterviewAnswer[]` (`InterviewModal.tsx:130`) holds every answer
  (base + follow-up). `baseAnswers` / `followUpAnswersState` are derived by the
  `isFollowUp` flag (`:173-174`). The current textarea writes into `answers` via
  `handleCurrentAnswerChange` (`:1110-1129`).
- Autosave to `localStorage` under key `interviewDraft:${projectId}`, debounced
  400ms (`:204-230`), storing `{ answers (non-empty), followups,
  currentQuestionIndex, phase }`.

Server persistence:
- On each question submit, `handleQuestionAnswerSubmit` calls
  `persistAnswers([answerData], { includeFollowUps: false })`
  (`:987`), which POSTs to `/api/posting/project/${projectId}/interview`
  (`persistAnswers`, `:1140-1289`; POST at `:1221`).
- On generate, all answers + follow-ups are re-persisted
  (`handleGenerate`, `:1348`), then the generate call also sends them inline via
  `answersOverride` / `followupsOverride` (`:1408-1425`) to bypass a provenance
  race.
- Server side (`src/app/api/posting/project/[projectId]/interview/route.ts`
  POST, `:256-652`): answers are written into
  `ProjectPost.provenance.interview.payload.answers` /
  `.followups` (merged non-destructively by `questionId`,
  `mergeAnswers` `:654-677`). A legacy mirror is written to
  `provenance.interview.answers` (`:530-531`). When metadata fields are present
  (`linkedImageId`, `roomId`, etc.), the route ALSO syncs into the relational
  `EditorialInterview` / `EditorialInterviewAnswer` tables and recomputes
  `roomProgress` (`:559-627`). The canonical store for the posting interview is
  the `ProjectPost.provenance` JSON blob; the relational tables are a secondary
  sync gated on `hasNewFields` (`:562`).

### Skip control

There are two distinct skip affordances, both in `FooterBar`
(`src/components/posting/interview/FooterBar.tsx`):

1. Room skip (`onSkipRoom`) — room-paced mode only. Wired at
   `InterviewModal.tsx:2194-2204`, shown only when `roomFlow.canSkipRoom`.
   Rendered as a text button in the question phase (`FooterBar.tsx:75-82`) with
   label from `skipRoomLabel` (`InterviewModal.tsx:2205-2211`, e.g.
   `Skip (N remaining) →`). It calls `roomFlow.skipRoom()`
   (`useRoomInterviewFlow.ts:354-371`), marking the room `status: "skipped"` and
   advancing to the next incomplete room. Eligibility (`canSkipRoom`,
   `useRoomInterviewFlow.ts:181-186`): never the first room (index 0), and only
   after answering `ceil(baseQuestions * 0.6)` questions in the current room.

2. Follow-up skip (`onSkip`) — the "Skip" text button in the followup phase
   (`FooterBar.tsx:114-124`), wired at `InterviewModal.tsx:2185-2193`. In the
   `followup`/`followups` phase it calls `handleGenerate` (skips remaining
   follow-ups and generates). It is also surfaced in the answer step only when a
   banner is showing and follow-ups were already tried
   (`banner && followupsTried && step === "answer"`).

There is no per-question "skip this question" control in the base question
phase — the primary button is Continue / "Finish & Generate Story"
(`FooterBar.tsx:83-111`), disabled until `canProceed` (an answer exists).

### Rooms as a grouping vs flat list

The modal knows about rooms as a first-class grouping **when room pacing is
active**. `hasRoomPacing` (`InterviewModal.tsx:490-493`) switches the whole
navigation model to `useRoomInterviewFlow` over `roomData.rooms`
(`RoomQuestionsGroup[]`), renders `RoomProgressBar`, supports per-room skip,
tracks per-room `roomProgress`, and emits `roomId` on saved answers
(`:1204-1208`). When room pacing is not active (e.g. a project with 0 rooms), it
falls back to a flat `selectedQuestions` list with a "Question n of m" counter.

### Images and vertical space

- Whether the modal renders any image: The only image surface is
  `LinkedImagePreview`, rendered inside `QuestionCard` at `QuestionCard.tsx:112-117`,
  **conditional on `questionMetadata.linkedImageId` being set** and
  `images.length > 0`. `questionMetadata` comes from `questionMetadataMap.get(currentQuestion.id)`
  (`InterviewModal.tsx:2070`), which is built from the flat
  `fetchedQuestions` (`:560-566`). In the room-paced flow the questions are
  produced by `generateRoomQuestions` / `generateProjectQuestions`, and those
  generators never set `linkedImageId` (see §2). Additionally, room-paced
  `currentQuestion.id` comes from the grouped endpoint while
  `questionMetadataMap` is keyed by the flat endpoint's IDs, so the lookup
  generally misses entirely. Net effect: in the posting room-paced interview,
  no image is rendered for a question and the contextual metadata badge block
  (`QuestionCard.tsx:92-119`) is not shown. `LinkedImagePreview` itself renders
  a `w-full h-32` (128px tall) cover image when it does fire
  (`LinkedImagePreview.tsx:17-27`).
- Vertical space of the question: `QuestionCard.tsx:120-122` — the prompt is an
  `<h2>` at `text-3xl md:text-4xl lg:text-5xl italic ... mb-8`. It occupies a
  top block (`px-8 md:px-16 pt-4 pb-6`, `:90`) that grows with the question
  text; no max-height on the heading.
- Vertical space of the answer field: `QuestionCard.tsx:131-150`. The
  `<textarea>` starts at `rows={2}` / `min-h-[56px]` collapsed and expands to
  `rows={8}` / `min-h-[200px] resize-y` once focused or non-empty
  (`:142-144`). The input section is `flex-1 ... justify-end` (`:129`), so it
  fills remaining height and anchors to the bottom.
- Modal max dimensions: `DialogContent` className at
  `InterviewModal.tsx:1797-1802`. In question/followup phases:
  `w-full max-w-5xl h-[90vh] max-h-[90vh] ... flex flex-col ... overflow-hidden`.
  In the complete phase: `max-w-6xl max-h-[90vh] overflow-y-auto`.
- Scrolling: In question phase the modal body is a fixed 90vh flex column with
  `overflow-hidden` on the dialog; the question/answer content area is the
  scroll container — `<div ref={scrollContainerRef} className="flex-1 flex
  flex-col min-h-0 overflow-y-auto">` (`:2061`). It scrolls to top on question
  change (`:649-651`). The header (`:1875`) and `FooterBar` (`:2160`) are
  outside that scroll region. In the complete phase the whole `DialogContent`
  scrolls (`overflow-y-auto`).

---

## 2. QUESTION GENERATION

### Route / service

- HTTP route: `src/app/api/posting/project/[projectId]/interview/questions/route.ts`
  (GET). It branches on `?grouped=true` and `?phase=project|rooms`
  (`:33-54`) to the grouped generator, otherwise the flat generator (`:56-67`).
- Service layer: `src/lib/editorial/getInterviewQuestions.ts`
  - `getInterviewQuestionsWithContext` (`:61`) — flat.
  - `getInterviewQuestionsGroupedByRoom` (`:367`) — grouped, two-phase.
- Orchestrators / LLM callers:
  - `src/lib/interview/generateAllRoomQuestions.ts` — fans out one LLM call per
    room.
  - `src/lib/interview/generateRoomQuestions.ts` — the per-room LLM call.
  - `src/lib/interview/generateProjectQuestions.ts` — the "About This Project"
    LLM call.
- A separate flat contextual generator exists in
  `src/lib/interview/generateQuestions.ts` (it DOES set `linkedImageId`, e.g.
  `:374`), but the posting flow's `getInterviewQuestions*` path does not call it —
  it calls `generateAllRoomQuestions`. So the image-linked question path is not
  the one used by the modal.

### Generation timing (up-front vs lazy per room)

Two-phase, not one-shot (`getInterviewQuestionsGroupedByRoom`, `:352-458`):
- Phase `project` (on modal open, `useRoomInterviewQuestions.ts:163-197`): builds
  ONLY the "About This Project" group via `buildProjectGroup`
  (`getInterviewQuestions.ts:135-225`). One LLM call.
- Phase `rooms` (triggered by `loadRooms()` after the About base answers are
  saved — `InterviewModal.tsx:913-929`, `useRoomInterviewQuestions.ts:205-256`):
  reads the saved About answers, distills them into a `KnownFacts` digest
  (`distillInterviewFacts`), and generates every room in parallel with that
  digest as wording context (`getInterviewQuestions.ts:406-436`).
- Phase `full` (default / older clients): both at once, no digest
  (`:439-457`).

Within a phase, all rooms are generated together (parallel
`Promise.allSettled`, `generateAllRoomQuestions.ts:149-192`) — not lazily one
room at a time as the designer reaches each room.

### Exact prompt sent to the model (verbatim)

There are two prompts. Both use `MODELS.sonnet` and send images as
Anthropic image blocks with `source: { type: 'url', url }`.

#### 2a. Project-level prompt — `generateProjectQuestions.ts:132-317`

Model call: `generateProjectQuestions.ts:324-328`, `model: MODELS.sonnet`,
`max_tokens: 2048`, content = `[...imageBlocks, { type: 'text', text: prompt }]`.

```
You are generating the opening interview questions for an interior design editorial feature. These questions establish the narrative frame before we discuss individual rooms.

You have 5 categories you MUST cover. But you must ask them in a way that feels like a journalist who already read the brief and looked at the photos — not like a form with required fields.

YOU ARE INTERVIEWING A: ${role}

Calibrate every question to this person's RELATIONSHIP to the project:

DESIGNER:
- They designed it for a client. They don't live there.
- Ask about their design decisions, client relationship, material selections, aesthetic vision, and professional philosophy.
- "Tell me about the clients" NOT "Tell me about your family"
- "What was the brief?" NOT "What did you want your home to feel like?"
- "How did the client's needs shape the design?" NOT "How did living with kids shape the layout?"

ARCHITECT:
- They designed the spatial and structural framework.
- Ask about spatial concepts, site conditions, structural solutions, light strategy, envelope decisions.
- "What were the structural constraints?" NOT "Why did you pick these finishes?"
- "How did the existing footprint shape your approach?"
- "What was the collaboration with the designer like?"

BUILDER:
- They built it. They solved construction problems.
- Ask about timeline, phasing, technical challenges, coordination, craftsmanship details.
- "What was the most technically difficult element?" NOT "What was your design vision?"
- "How did you phase the work — was the family living here during construction?"
- "What's something in the finished product that people wouldn't know was hard to pull off?"

HOMEOWNER:
- They live in the result. They hired the team.
- Ask about daily experience, what surprised them, what they love.
- "What were you looking for when you started?" NOT "What was the design concept?"
- "How does the space feel now that you've lived in it?"

VENDOR:
- They supplied product, not design intent.
- Ask about application context, performance, designer collaboration.
- "How do designers typically spec this?" NOT "Why did you choose this material?"

PHOTOGRAPHER:
- They captured the finished space.
- Ask about what drew their eye, light conditions, how they chose to frame the space.

Each role has a different relationship to the client, the budget, the timeline, and the creative decisions. Don't ask a contractor about design philosophy. Don't ask a designer about construction phasing (unless it shaped a design decision). Don't ask an architect about finish selections (unless they specified them).

CATEGORY ADAPTATION BY ROLE:
Each category shifts meaning depending on who you're talking to. These are EXAMPLES, not templates — contextually adapt them using photos and metadata, but match the ANGLE to the role.

If DESIGNER:
  1. CLIENT_BRIEF → "Tell me about the clients and what they came to you with."
  2. SCOPE_PARAMETERS → "What were you working with — how much of this was new vs. existing?"
  3. DESIGN_DIRECTION → "What was the big idea for this project?"
  4. SIGNATURE_IDENTITY → "What in this project is most recognizably yours?"
  5. SURPRISE_PIVOT → "What changed from the original concept?"

If ARCHITECT:
  1. CLIENT_BRIEF → "What was the program — what did the client need this house to do?"
  2. SCOPE_PARAMETERS → "What were the site constraints and existing conditions?"
  3. DESIGN_DIRECTION → "What was the spatial concept — how did you think about the flow and volume?"
  4. SIGNATURE_IDENTITY → "What's the structural or spatial move here that you're most proud of?"
  5. SURPRISE_PIVOT → "Did anything you discovered on site change the design?"

If BUILDER:
  1. CLIENT_BRIEF → "What was the scope of work when you came on board?"
  2. SCOPE_PARAMETERS → "How long did the build take and what was the phasing?"
  3. DESIGN_DIRECTION → "Was there a particular craft or technique that defined this project?"
  4. SIGNATURE_IDENTITY → "What's something in the finished product that most people wouldn't notice but you know was hard to get right?"
  5. SURPRISE_PIVOT → "What was the biggest problem you had to solve during construction?"

If HOMEOWNER:
  1. CLIENT_BRIEF → "What were you looking for when you started this project?"
  2. SCOPE_PARAMETERS → "What was the situation with the house before work began?"
  3. DESIGN_DIRECTION → "How would you describe what your designer was going for?"
  4. SIGNATURE_IDENTITY → "What's your favorite part of the finished space?"
  5. SURPRISE_PIVOT → "Was there anything that surprised you during the process?"

If VENDOR:
  1. CLIENT_BRIEF → "How did this project come to you — what was the designer looking for?"
  2. SCOPE_PARAMETERS → "What was the scale of the spec — custom, modified standard, or off the shelf?"
  3. DESIGN_DIRECTION → "How does your product fit into the overall design story here?"
  4. SIGNATURE_IDENTITY → "What makes this particular application of your product special?"
  5. SURPRISE_PIVOT → "Were there any spec changes or surprises during the project?"

AVAILABLE CONTEXT (use to decide what to ask — you may weave details in as your own impression, but never by citing the notes/description; see the rules below):
- Project description: ${input.projectDescription || 'Not provided'}
- Location: ${locationStr}
- Project type: ${input.projectType || 'Not specified'}
- Client type: ${input.clientType || 'Not specified'}
- Budget band: ${input.budgetBand || 'Not specified'}
- Designer name: ${input.designerName || 'Not specified'}
- Firm name: ${input.studioName || 'Not specified'}
- Number of rooms: ${input.roomNames.length}
- Room types: ${roomTypesStr}
${input.materialPalette?.length ? `- Material palette: ${input.materialPalette.join(', ')}` : ''}
${imageBlocks.length > 0 ? `- ${imageBlocks.length} representative project photos shown above` : ''}

REQUIRED CATEGORIES (generate exactly one question per category, adapted to ${role} perspective):
1. CLIENT_BRIEF — Who was this for and what did they want?
2. SCOPE_PARAMETERS — What were you working with?
3. DESIGN_DIRECTION — What was the big idea?
4. SIGNATURE_IDENTITY — What in this project is most YOU?
5. SURPRISE_PIVOT — What changed along the way?

RULES FOR USING WHAT YOU KNOW (HOLD IT LIGHTLY, NEVER NARRATE IT):
The project description is the ${role.toLowerCase()}'s own shorthand — approximate, incomplete, notes-to-self. Treat every detail as a lead to open up in their own words, never a fact to recite and never a source to cite.

There are two ways to bring a detail into a question. Only one sounds human:

1. NATURAL — voice it as your own impression or a hunch, softened so they can push back: "sounds like…", "it reads like…", "I get the sense…", "seems like…". A person who did their homework talks this way. The tentative opener is what leaves room for them to confirm, correct, or expand — it does the same job the old citation did, without the robot voice.
2. ROBOTIC — announce where the detail came from ("the project notes mention…", "your description says…", "the file lists…") or read details back verbatim. This exposes the machinery and reads like an AI narrating a dossier. NEVER phrase a question this way.

ONE exception, because it's genuinely how people talk: observing the PHOTOS out loud is natural and encouraged — "Looking at the photos, the stair feels resolved from the bones up — what were you actually working with?" Citing NOTES, a DESCRIPTION, or a FILE is not. If a detail came from the text and not the photos, turn it into your own read of the project instead of pointing at the document.

NEVER recite proper names (clients, kids, pets) back, and NEVER state a private inference about the household as fact ("so there are kids in this house"). If the notes hint at a family, ask about "the family you were designing for" or "who this home was really for" — don't perform the deduction.

Turn details into natural questions:
- Notes hint at a relocation → "Sounds like a move was part of the story — tell me about these clients and what brought them to you."
- Notes suggest a long timeline → "I get the sense this one ran long — walk me through how it actually played out."
- Notes say "full renovation" → "It reads like a full gut — what were you starting with?"
- Notes list a family / kids' names → "Tell me about the family you were designing for — who was this home really for?"
- Photos show warm, sculptural forms → "Looking at the photos, there's a real warmth here — was that the direction from day one?"

Do NOT:
- BAD: "The project notes mention names like Sofie and Connor — so there are kids in this house." (narrates the data source AND recites private names AND performs a deduction — the worst version)
- BAD: "Your project description mentions about 14 months — walk me through the timeline." (announces the source; say "I get the sense this ran long" instead)
- BAD: "This 14-month full gut renovation must have been an undertaking." (asserts unverified notes as settled fact)
- BAD: "With a $500K budget for a 3,200 square foot home…" (recites numbers as truth)
- GOOD: "Sounds like this one ran long — walk me through the timeline."
- GOOD: "It reads like a relocation was in the mix — tell me about these clients."
- GOOD: "What was the budget reality on this one?"
- GOOD: "Looking at the photos, there's a warmth here that doesn't feel accidental — where did that come from?"

The distinction: a soft impression ("sounds like this ran long") lets them say "actually it was 16 months." Asserting it as fact locks in unverified data; citing where you read it sounds like a robot. Avoid both.

- For SIGNATURE_IDENTITY: Use the designer's name if available. "What in this project would someone who knows your work immediately say 'that's a ${input.designerName || '[Designer]'} project'?"

WHAT MAKES A GOOD QUESTION:
- Surfaces what you know as a soft impression or a photo observation ("sounds like…", "it reads like…", "looking at the photos…") — NEVER by citing notes or a description — so the respondent can confirm, correct, or expand
- Asks ONE thing clearly (not compound questions)
- Opens space for storytelling, not yes/no answers
- Focuses on wins and arrivals, not compromises or failures
- Sounds like a colleague asking over coffee, not a form field
- Is calibrated to the ${role} role — asks about things this person actually controlled or experienced

WHAT MAKES A BAD QUESTION:
- "Can you tell me about your design philosophy?" (too vague, not project-specific)
- "What inspired you?" (lazy, generic)
- "Tell me about the challenges you faced." (focuses on negatives)
- "Can you walk me through the project?" (too broad)
- "This 14-month renovation must have been complex" (asserts unverified notes as fact)
- "The project notes mention names like Sofie and Connor…" (narrates the data source and recites private names — sounds like an AI reading a file)
- "Your clients, a young family with two kids under five from Chicago" (recites their file back as if you know these people)
- Anything that ignores the available context and could be asked about any project
- Anything that addresses the ${role.toLowerCase()} as if they're a different role

Return ONLY a JSON object:
{
  "questions": [
    {
      "category": "CLIENT_BRIEF",
      "question": "Sounds like a move was part of the story here — tell me about these clients and what they came to you with.",
      "intent": "Get the human story and original brief, framed as a soft impression the designer can confirm, correct, or expand"
    },
    {
      "category": "SCOPE_PARAMETERS",
      "question": "...",
      "intent": "..."
    },
    {
      "category": "DESIGN_DIRECTION",
      "question": "...",
      "intent": "..."
    },
    {
      "category": "SIGNATURE_IDENTITY",
      "question": "...",
      "intent": "..."
    },
    {
      "category": "SURPRISE_PIVOT",
      "question": "...",
      "intent": "..."
    }
  ]
}
```

#### 2b. Per-room prompt — `generateRoomQuestions.ts:140-182`

Model call: `generateRoomQuestions.ts:189-193`, `model: MODELS.sonnet`,
`max_tokens: 2048`, content = `[...imageBlocks, { type: 'text', text: prompt }]`.

```
You are a senior editorial journalist at an interior design publication interviewing a designer about the ${input.roomName} in their project${input.projectContext.projectTitle ? ` "${input.projectContext.projectTitle}"` : ''}.

ROOM: ${input.roomName}
IMAGES: ${input.roomImages.length} photos of this room (shown above)
CONTEXT LEVEL: ${input.contextLevel}/5

AI-DETECTED DETAILS:
${classificationSummary}

PRODUCTS YOU MAY NAME AND SPOTLIGHT (vendor is subscribed — name the brand/product freely and a dedicated question about one is welcome):
${nameableSummary}

PRODUCTS TO REFERENCE BY DESCRIPTOR ONLY (never name the brand or product; use the descriptor, and only raise one if the designer's own story makes it the point — never as a product spotlight):
${descriptorSummary}

${input.projectContext.overallStyle ? `PROJECT STYLE: ${input.projectContext.overallStyle}` : ''}
${input.projectContext.materialPalette?.length ? `MATERIAL PALETTE: ${input.projectContext.materialPalette.join(', ')}` : ''}
${input.projectContext.designerName ? `DESIGNER: ${input.projectContext.designerName}` : ''}
${knownFactsBlock}
Generate exactly ${input.budget} interview questions for the ${input.roomName}.

RULES:
1. Every question must reference a specific product, material, or visual detail from the data above or visible in the images.
2. NAMING: You may name — and build a dedicated question around — any product in the "MAY NAME AND SPOTLIGHT" list. For a product in the "BY DESCRIPTOR ONLY" list, refer to it by its descriptor (form / material / finish) and NEVER by its brand or product name; raise one only if the designer's own story (a standout room, a repeated material) makes it the point — never introduce it as a named product spotlight.
3. Every question sets up an answer the designer would be proud to publish. Ask about arrivals, not departures. Wins, not compromises.
4. No generic questions. "Tell us about your color choices" is NEVER acceptable. "The brass hardware against the navy millwork — walk us through that pairing" is editorial.
5. If a vendor name is unknown, ask about the product or material itself — never say "Unknown Brand."
6. Mix question types: 1 warm opening, then deep dives into specific products/materials/decisions, and 1 closing philosophy question if budget >= 4.
${crossRoomInstruction ? `7. ${crossRoomInstruction}` : ''}

Return ONLY a JSON object:
{
  "questions": [
    {
      "text": "The full question text",
      "type": "opening | deep_dive | vendor_loyalty | material_thread | spatial_narrative | philosophy",
      "vendors": ["VendorName"],
      "products": ["ProductName"],
      "boostable": false,
      "topic": "semantic_topic_slug"
    }
  ]
}
```

The `knownFactsBlock` (from the About answers digest) is defined at
`generateRoomQuestions.ts:121-133` and is injected only in the `rooms` phase;
`crossRoomInstruction` at `:136-138`.

### Shape of a generated question object (every field)

Raw LLM JSON per question:
- Project prompt output: `{ category, question, intent }`
  (`generateProjectQuestions.ts:288-316`).
- Room prompt output: `{ text, type, vendors, products, boostable, topic }`
  (`generateRoomQuestions.ts:170-182`).

Normalized internal object `GeneratedQuestion`
(`src/lib/interview/generateQuestions.ts:57-86`) — every field:
```
id: string
text: string
contextLevel: ContextLevel
type: QuestionType
rooms?: string[]
products?: string[]
vendors?: string[]
boostable: boolean
pullQuotePotential: 'high' | 'medium' | 'low'
helper?: string
topic?: string
linkedImageId?: string
linkedProductId?: string
attributeType?: 'color' | 'material' | 'style' | 'mood' | 'element'
attributeValue?: string
roomContext?: string
```
Project questions get `id: `project-${CATEGORY}-${randomUUID()}``, `type:
'generic'`, empty `rooms/products/vendors`
(`generateProjectQuestions.ts:344-361`). Room questions get `id: randomUUID()`,
`rooms: [roomName]`, `type` mapped from the LLM `type`
(`generateRoomQuestions.ts:209-229`). **Neither generator sets `linkedImageId`,
`linkedProductId`, `attributeType`, `attributeValue`, or `roomContext`** — they
are left undefined.

Converted to the API-surface `InterviewQuestion` via `toInterviewQuestion`
(`generateQuestions.ts:1290-1320`): `{ id, questionText, questionType:
'contextual', source: 'ai_classification', linkedImageId (undefined),
linkedProductId (undefined), attributeType, attributeValue, roomContext (=
question.rooms?.[0]), boostable, pullQuotePotential, contextLevel,
questionCategory }`.

The client-consumed type is `InterviewQuestion` in
`src/types/interview.ts:1-16`: `{ id, questionText, questionType, source,
category?, linkedImageId?, linkedProductId?, attributeType?, attributeValue?,
roomContext?, roomId?, isCrossRoom? }`.

### Which ProjectImages are sent to the model per question — and whether recorded (MOST IMPORTANT)

This is the central finding. Question generation is **per-room (and per
project group), not per-question**. One LLM call produces all questions for a
room; the images sent are that room's images, not one image per question.

Project-level group (`buildProjectGroup`, `getInterviewQuestions.ts:135-225`):
- Image set queried: `project.images` selected with `select: { url: true },
  orderBy: { displayOrder: 'asc' }, take: 3` (`getInterviewQuestions.ts:154-158`).
  So the **first 3 project images by displayOrder**, project-wide (not
  room-scoped), mapped to `{ url }` at `:177` and passed as
  `representativeImages`.
- In `generateProjectQuestions`, these are re-capped:
  `input.representativeImages.slice(0, 3)` → up to 3 image blocks by URL
  (`generateProjectQuestions.ts:116-124`).

Per-room group (`generateAllRoomQuestions.ts` → `generateRoomQuestions.ts`):
- Room's images are selected by matching `ProjectImage.room` to the room name
  (`generateAllRoomQuestions.ts:97-101`), full set for that room passed as
  `roomImages` (`:151-154`, `{ url, classification }`).
- In `generateRoomQuestions`, images are capped at 8:
  `input.roomImages.slice(0, 8)` → up to 8 image blocks by URL
  (`generateRoomQuestions.ts:67-76`). All of the room's images (not capped) also
  feed a text `classificationSummary` from `aiClassification`
  (`generateRoomQuestions.ts:104-116`).

Exact set per generation call: **Project group → up to the first 3
project-wide images (by displayOrder). Each room group → up to 8 of that
room's images (by displayOrder), scoped by `ProjectImage.room == room.name`.**
A question is not generated from a single image; it is generated from the
room's/project's batch.

Is that image set recorded after generation or discarded? **Discarded.** The
LLM returns only question text/metadata; the returned `GeneratedQuestion` /
`InterviewQuestion` objects carry no image IDs (`linkedImageId` is never set on
this path — `generateRoomQuestions.ts:218-229`,
`generateProjectQuestions.ts:344-361`). The image URLs sent to the model are
used transiently to condition the prompt and are not persisted with the
question, not returned to the client, and not stored on any answer. Nothing
downstream can recover which specific photos a given question was generated
from. (Note: the image URLs are never even IDs here — the project group query
selects `url` only, not `id`.)

### Is a question linked to a specific room at generation time — persisted or discarded?

- Room linkage exists at the room-group level, not the image level. In
  `buildRoomGroupsFromResults` (`getInterviewQuestions.ts:228-297`), each room's
  questions get `roomId: roomCtx.id` and `isCrossRoom: false` (`:263-264`), and
  the group carries `roomId` / `roomName`.
- Persistence: the room link travels to the client as `roomId` on the grouped
  questions, and when the designer answers, the modal writes `roomId` into the
  saved answer metadata (`InterviewModal.tsx:1204-1208`), which the interview
  POST route stores on `EditorialInterviewAnswer.roomId`
  (`interview/route.ts:601`) and into `roomProgress`. So a room→answer link is
  persisted. There is no image→question link to persist.
- Project-level questions are stored with `roomId: null` (the modal maps the
  synthetic `'project'` room id to `null`, `InterviewModal.tsx:1205-1208`) and a
  `questionSource` of `project_question` / `project_follow_up`
  (`:1185-1192`).

---

## 3. PRISMA MODELS

Models touched by the interview. Verbatim blocks below.

### ProjectPost — canonical interview + article store (`prisma/schema.prisma:1590-1644`)

```prisma
model ProjectPost {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  status      PostStatus  @default(DRAFT)
  variant     PostVariant @default(PROJECT_FEATURE)
  slug        String      @unique
  heroAssetId String?
  excerpt     String?
  keywords    String[]    @default([])

  expandedBlocks Json?
  provenance     Json?
  credits        Json?

  publishedAt          DateTime?
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
  editorialAssignments EditorialAssignment[]

  // Homepage XL editorial slot (Task 05)
  // When `now()` is in [homepage_xl_starts_at, homepage_xl_ends_at] and status=PUBLISHED,
  // this post is the curated XL hero on `/`. App-level uniqueness — at most one row
  // is in-window at any time. Editorial team enforces in admin form.
  homepageXlStartsAt DateTime? @map("homepage_xl_starts_at")
  homepageXlEndsAt   DateTime? @map("homepage_xl_ends_at")

  // Intelligence System relations
  supplementalQuotes SupplementalQuote[] @relation("PostSupplementalQuotes")

  // In Context Boost System
  inContextBoosts InContextBoost[] @relation("PostInContextBoosts")

  // Homepage Reel Boost System (Task 05)
  homepageReelBoosts HomepageReelBoost[] @relation("PostHomepageReelBoosts")

  // Contributor/Voice System relations
  publishedContributions Contribution[] @relation("PostContributions")
  sourceArticleTopic     ArticleTopic?  @relation("TopicPublishedPost")

  // Prompted Content: Story Threads
  storyThreads StoryThread[]

  // Section editing (Phase C)
  sectionOverrides   Json?   @map("section_overrides")
  sectionHistory     Json?   @map("section_history")
  lastGenerationNote String? @map("last_generation_note") @db.Text

  postSaves PostSave[]

  // Partial index for fast XL window scans on the homepage feed (Task 05).
  @@index([homepageXlStartsAt, homepageXlEndsAt], name: "project_posts_homepage_xl_window_idx")
  @@map("project_posts")
}
```

Notes: interview answers/follow-ups live in `provenance` (JSON) under
`provenance.interview.payload.answers` / `.followups` (with a legacy mirror at
`provenance.interview.answers`). The generated article lives in
`expandedBlocks` (JSON). `credits` is a separate JSON column.

### EditorialInterview — relational interview record (`prisma/schema.prisma:1794-1815`)

```prisma
model EditorialInterview {
  id        String  @id @default(cuid())
  projectId String  @unique @map("project_id")
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  status EditorialInterviewStatus @default(IN_PROGRESS)

  selectedQuestionIds String[] @map("selected_question_ids")

  // Room pacing: tracks per-room interview progress
  roomProgress Json? @map("room_progress")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  answers EditorialInterviewAnswer[]

  // Real-time interview sessions that contributed to this editorial
  realtimeSessions RealtimeInterviewSession[]

  @@map("editorial_interviews")
}
```

Enum `EditorialInterviewStatus` (`:1788-1792`): `IN_PROGRESS | COMPLETED |
PUBLISHED`.

### EditorialInterviewAnswer — answer storage (`prisma/schema.prisma:1817-1856`)

```prisma
model EditorialInterviewAnswer {
  id          String             @id @default(cuid())
  interviewId String             @map("interview_id")
  interview   EditorialInterview @relation(fields: [interviewId], references: [id], onDelete: Cascade)

  questionId     String  @map("question_id")
  questionText   String? @map("question_text") // The actual question text for editorial generation
  isFollowUp     Boolean @default(false) @map("is_follow_up")
  parentAnswerId String? @map("parent_answer_id") // For follow-ups, links to Layer 1 answer

  answerText    String  @map("answer_text")
  audioUrl      String? @map("audio_url") // Optional: retained audio
  inputModality String  @default("text") @map("input_modality") // "text" | "voice" | "mixed"

  // AI-extracted metadata (optional)
  confidenceScore    Float?   @map("confidence_score")
  inferredPriorities String[] @map("inferred_priorities")
  softConstraints    String[] @map("soft_constraints")

  // NEW: Contextual question linking
  linkedImageId             String? @map("linked_image_id")
  linkedProductId           String? @map("linked_product_id")
  questionSource            String? @map("question_source") // 'base_question' | 'ai_classification' | 'follow_up'
  aiClassificationAttribute String? @map("ai_classification_attribute") // e.g., "color:sage green"

  // Room pacing: associates answer with a specific room
  roomId      String? @map("room_id")
  isCrossRoom Boolean @default(false) @map("is_cross_room")

  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  // Removed - AttributeVerification doesn't have interviewAnswerId field

  @@index([interviewId])
  @@index([questionId])
  @@index([linkedImageId])
  @@index([roomId])
  @@map("editorial_interview_answers")
}
```

Note: `linkedImageId` exists as a column here, but on the room-paced posting
path it is populated only if the answer metadata carries one, and (per §2) the
room/project question generators never emit `linkedImageId`. `audioUrl` exists
for retained audio but the posting per-answer transcription flow (see §5) does
not populate it.

### Room (`prisma/schema.prisma:877-897`)

```prisma
model Room {
  id            String         @id @default(uuid())
  name          String
  type          String? // Optional room type: KITCHEN, BATH, LIVING, BEDROOM, DINING, OFFICE, ENTRY, BAR, PANTRY, LAUNDRY, MUDROOM, NURSERY, PLAYROOM, HOME_THEATER, GYM, POOL, SUNROOM, POWDER_ROOM, LIBRARY, STUDY, LOUNGE, WINE_CELLAR, WALK_IN_CLOSET, BUTLER_PANTRY
  projectId     String
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  quotes        Quote[]
  project       Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  selections    Selection[]
  skeletonItems SkeletonItem[]

  // --- Phase 5H1 Bucket A inverse relations ---
  actionItems     ActionItem[]
  noteAttachments NoteAttachment[]

  // --- Publish flow (spec 20 §4) — structured photo→room assignment ---
  projectImages ProjectImage[] @relation("RoomProjectImages")

  @@map("rooms")
}
```

### ProjectImage (`prisma/schema.prisma:558-613`)

```prisma
model ProjectImage {
  id           String       @id @default(uuid())
  url          String
  name         String?
  room         String?
  displayOrder Int?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  projectId    String
  tags         ProductTag[]
  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // --- Publish flow (spec 20 §4) — ADD-only, idempotent ---
  // inclusion / roomId drive the photo/room gates. Review state is DERIVED as
  // `tags.length > 0 || noProducts` (see computePublishReadiness) — a confirmed
  // tag auto-satisfies it, dismissing the last tag auto-reverts it.
  inclusion    ImageInclusion @default(INCLUDED)
  // Retained for migration/DB consistency; superseded by the derived review
  // gate above and no longer read. Safe to drop in a future deliberate migration.
  tagState     ImageTagState  @default(UNREVIEWED)
  // "This photo has no products to tag" — the only persisted review signal.
  noProducts   Boolean        @default(false)
  roomId       String?
  assignedRoom Room?          @relation("RoomProjectImages", fields: [roomId], references: [id], onDelete: SetNull)

  // Search indexing fields
  searchVector String? // Full-text search vector
  aiTags       String[]  @default([]) // AI-detected objects, materials, colors
  aiColors     Json? // Dominant color palette extracted
  aiMaterials  String[]  @default([]) // AI-detected materials (marble, brass, wood, etc.)
  aiSpaces     String[]  @default([]) // AI-detected space types (kitchen, bathroom, pool, etc.)
  indexedAt    DateTime? // Last indexing timestamp

  // AI classification for interview questions
  aiClassification   Json?     @map("ai_classification") // Stores full ImageClassification result
  aiClassifiedAt     DateTime? @map("ai_classified_at") // When classification ran
  verifiedAttributes Json?     @map("verified_attributes") // Designer-confirmed attributes
  verifiedAt         DateTime? @map("verified_at") // When attributes were verified

  // Engagement (for ranking)
  momentViews  Int @default(0)
  momentSaves  Int @default(0)
  momentShares Int @default(0)

  // Relation to search index
  momentIndex MomentIndex?

  // Relation to attribute verifications
  attributeVerifications AttributeVerification[] @relation("ImageAttributeVerifications")
  designerDecisions      DesignerDecision[]

  // --- Phase 5H2 Bucket B inverse relations ---
  projectProductTags ProjectProductTag[]

  @@map("project_images")
}
```

Note: images carry two room references — a free-text `room String?` (matched by
name in question generation, `generateAllRoomQuestions.ts:97-101`) and a
structured `roomId` FK to `Room` (`assignedRoom`). Question generation matches
on the `room` string; the article-generation route reconciles both
(`generate/route.ts:1990-2008`).

### Per-room interview status field — does it exist?

Yes, in two forms:
- `EditorialInterview.roomProgress Json?` (`schema.prisma:1804`) — a JSON map of
  per-room status, written by the interview POST route
  (`interview/route.ts:607-626`). It stores `{ status, answeredCount,
  totalQuestions, baseQuestions }` per roomId. `status` is a free string
  (`'in_progress'` set server-side; the client enum is `not_started |
  in_progress | complete | skipped`, `roomPacing.ts:13`). There is no dedicated
  scalar column or enum type for per-room status — it is embedded JSON.
- `EditorialInterviewAnswer.roomId` + `isCrossRoom` (`schema.prisma:1843-1844`)
  associate individual answers with a room, from which progress is also
  computed client-side in `useRoomInterviewFlow`.

There is no per-room status column on the `Room` model itself.

---

## 4. ARTICLE GENERATION

### Route

`src/app/api/posting/project/[projectId]/interview/generate/route.ts` (POST,
2709 lines). The canonical generation path delegates to
`generateEditorialDraft` (`src/lib/posting/generateEditorialDraft.ts`, exported
at `:1277`), imported at `generate/route.ts:9`. (The route file still contains
older, now-unused `composeEditorialHard` / `composeEditorial` /
`buildEditorialPrompt` functions — a header comment at `:200-203` states they
are "no longer called by the POST handler … retained temporarily for
reference.")

### Exact prompt (verbatim)

The prompt actually used by the POST handler is built inside
`generateEditorialDraft` in `src/lib/posting/generateEditorialDraft.ts`. Its
system prompt and user prompt (which contains the JSON contract at `:1078`
`"galleryChapters": [ ... ]`) are the live prompt. The full editorial system
prompt below is the one embedded in the codebase (identical copy also present in
the retained route function at `generate/route.ts:205-264`):

```
You are a senior writer for a prestigious design magazine, writing a feature article about an interior design project. Your writing style is:

- Observational and immersive, like walking through the space with the designer
- Focused on design DECISIONS and the reasoning behind them, not product specifications
- Weaving products into narrative naturally — they emerge in context, not as a list
- Creating a sense of place: how the space feels, how elements relate to each other
- Finding the story arc: what was the challenge, what was the breakthrough, what makes this space singular
- Respectful of craft, focused on work not personality

You must AVOID:
- The pattern of "Product X does Y because Z" repeated for each item
- Sequential product descriptions (product → explanation → next product → explanation)
- Generic design language ("thoughtfully curated", "deliberately chosen", "seamlessly blends", "creates a dynamic flow", "transforms the space")
- These specific AI-default phrases: "anchors the space", "adds warmth", "adds visual weight", "adds [quality]", "creates intimacy", "creates visual interest", "creates a sense of", "embodies" (as a verb for rooms or objects), "echoing" (to describe formal relationships), "the space feels", "the room feels", "without compromising", "without competing", "[thing] while [thing]" as a repeated two-clause construction, "commitment to [abstract noun]", "testament to", "envelope of calm", "envelope of [quality]", "material continuity", "material palette", "a sense of [noun]", "the kind of [noun] that [clause]", "rather than [negative]" as praise by contrast
- ALSO AVOID: "reads as [noun]" / "reading as [noun]", "material conversation", "architectural weight" / "visual weight" / "carries weight", "metallic thread" / "thread that runs through", "burst of [noun]", "speaks quietly" / "speaks to", "restraint as strategy", "grounding the [noun]", "completing the [noun]", any aphoristic sentence that sounds like a design manifesto (e.g. "Restraint as strategy, not limitation" — cut sentences like this)
- Any sentence where you could swap the project name and photos and the sentence would still be accurate — if it's generic, cut it
- Treating the article as a specification document
- Mentioning every single tagged product — only include products that serve the narrative
- Promotional or inflated language — be observational, not promotional

NARRATIVE STRUCTURE:
- Open with the space's defining tension or idea (not a product list)
- Build through the design logic: how decisions cascaded from one to the next
- Let products appear naturally as supporting evidence for design decisions
- Close with the emotional or experiential quality of the finished space

STRUCTURE — EDITORIAL HIERARCHY:
- NOT every room deserves equal coverage. Spend words where the story is.
- Identify the 1-2 rooms with the strongest design decisions, material stories, or interview content. These get 60-70% of the word budget.
- Remaining rooms get 1-2 sentences each — enough to establish continuity, not enough to bore.
- Every room the designer discussed in the interview MUST receive editorial coverage. Rooms with more interview content deserve proportionally more space.
- The piece should NOT read as a room-by-room tour. Organize by design idea, material story, or decision arc — but every discussed room must appear somewhere in the narrative.
- Vary paragraph length deliberately. A 2-sentence paragraph followed by a 6-sentence paragraph creates rhythm. Five 4-sentence paragraphs creates sleep.

FOLLOW-UP ANSWERS:
- Answers tagged [FOLLOW-UP] contain the richest editorial material — process stories, client anecdotes, tradeoff explanations, and behind-the-scenes details.
- Surface these as embedded anecdotes, attributed perspective, or specific process details that give the piece texture beyond physical description.
- Do NOT flatten follow-up content into generic descriptive prose. Follow-ups are what make this editorial sound like a person wrote it, not an AI.

DIRECT QUOTES — MANDATORY:
- Include at least 2 direct quotes from the designer in the article body.
- Direct quotes are EXACT WORDS from the interview answers below, wrapped in quotation marks and attributed: "Quote here," says the designer. Or: "Quote here," the designer explains.
- Choose quotes that reveal personality, decision-making, or surprise. NOT quotes that summarize the room's aesthetic.
- You may lightly trim for length (remove filler words) but do NOT rewrite the designer's words into your own voice.
- If the designer said "I didn't want a bathroom that felt like a hotel you're afraid to touch" — use THAT. Do not turn it into "the designer sought to avoid a hotel-like aesthetic."
- Pull quotes (the large-format callout quotes) must ALSO be verbatim from the interview, not paraphrased summaries.
- Include 2-3 pull quotes per article. If the interview contains designer statements about specific materials, tradeoffs, or process decisions, those are your pull quotes.
- Each pull quote MUST be self-contained — a reader should understand the point without seeing the interview question.
- Pull quotes from [FOLLOW-UP] answers are often the strongest — they contain the specific stories and reasoning that make great callout quotes.
- Add a brief contextual lead-in prefix like "On choosing materials:" or "On the kitchen's design philosophy:" when needed.

ACCURACY RULES — NON-NEGOTIABLE:
- You may ONLY reference products, materials, and vendors that appear in the provided product tag data below. Do not invent product names, vendor names, material origins, or finishes.
- Do not claim to know materials, country of origin, manufacturing methods, or finish types unless explicitly stated in the interview answers or product tag data.
- Do not fabricate designer quotes. Pull quotes must be drawn directly from the interview answers provided. If no suitable quote exists for a section, omit the pull quote — do not generate one.
- Do not invent lifestyle details about the clients (how they entertain, family routines, number of guests) unless the designer explicitly described this in their interview answers.
- Do not describe what you cannot verify from the provided data. If you don't know what material the floor is, don't name one. Describe what the interview and tags tell you; stay silent on what they don't.
- When referencing a product, use the EXACT product name and vendor name from the tag data. Do not paraphrase product names.

The article should make a reader want to visit this space, not inventory it.
```

The user prompt (built by `buildEditorialPrompt`, verbatim copy in the retained
route version at `generate/route.ts:266-461`; the live `generateEditorialDraft`
version carries the same JSON contract, `generateEditorialDraft.ts:1078`)
instructs the model to return JSON with `lead`, `sections`, `galleryChapters`,
`pullQuotes`, `credits`, `materialsLedger`, `mode`, and requires one gallery
chapter per room with interview content, image IDs copied exactly from the
provided per-room lists. Model: `MODELS.sonnet`, `temperature: 0.7`,
`max_tokens: 4096` (route reference at `generate/route.ts:639-647`).

### Block shape inside expandedBlocks

The persisted structure is validated by `BlocksSchema`
(`src/lib/posting/schemas.ts:125-184`, `.strict()`). Fields:
```
lead?:      { title?, kicker?, deck? }
introduction?: string[]  (max 4)
galleryChapters?: Array<{
  title?: string (max 120)
  body?:  string[] (each max 5000)
  imageIds: string[] uuid, min 1, max 8   // REQUIRED per chapter
  pullQuote?: string | PullQuoteSelection | null
}>
pullQuotes?: Array<string | { text, context?, sourceSection? }>  (max 5)
hookQuote?: { text, context? }
materialsLedger?: { items?: Array<{ productId?, name, finish?, vendorId?, note? }> }
method?: string[]
qa?: Array<{ q, a, role }>
data?: Record<string, any>
credits?: Array<{ role, name?, url? }>
mode?: 'recomposition' | 'verbatim'
```

- Does a block carry a roomId? **No.** A `galleryChapter` carries `title`,
  `body`, `imageIds`, `pullQuote` — there is no `roomId` field. The room→chapter
  association is implicit: chapters are built one-per-image-room and the title is
  set to the formatted room name during post-LLM repair
  (`generate/route.ts:744-780`; `generateEditorialDraft.ts:659-729`), but no
  `roomId` is stored on the block.
- Does a block carry a generatedAt? **No.** `generatedAt` exists only at the
  provenance level (`provenance.interview.generatedAt = Date.now()`,
  `generate/route.ts:2499` and `:2531`), not per block or per chapter.
- Is ordering stable/explicit or array position? **Array position only.**
  `galleryChapters` is an ordered array with no sequence/index field. Chapters
  are appended in room order during build; the article renderer relies on array
  position. Pull quotes are synced to chapters by array index
  (`generate/route.ts:2403-2407`; `schemas.ts:228-249`).

### Regeneration: wholesale replace or merge?

**Wholesale replace.** On generation the route does
`prisma.projectPost.upsert({ update: { expandedBlocks: expandedBlocks,
sectionOverrides: [], sectionHistory: [], ... } })`
(`generate/route.ts:2480-2518`). The entire `expandedBlocks` is overwritten with
the freshly composed structure, and `sectionOverrides` / `sectionHistory` are
cleared because "fresh expandedBlocks invalidate old indices & originalBody"
(`:2485-2487`). There is no per-chapter merge with prior blocks. (Per-section
edits are a separate surface: `src/app/api/posting/project/[projectId]/sections/*`
routes mutate individual chapters via `sectionOverrides` — outside the interview
generate path.)

### Photo gallery block type / rooms without write-ups

- There is no distinct "photo gallery" block type. The only gallery construct is
  `galleryChapters`, and every chapter is text+images: the schema makes
  `imageIds` required (min 1) and pairs them with `body` prose. A photo-only
  block type does not exist in `BlocksSchema`.
- Rooms without write-ups are handled two ways, both of which avoid a
  photos-only block:
  1. Incomplete rooms are withheld before generation. The client passes
     `completedRoomIds`; the route drops images belonging to real rooms not in
     that set so no chapter is created for them (the "ROOM QUALITY GATE",
     `generate/route.ts:2160-2196`), and returns them as `excludedRooms`
     (`:2169-2195`, `:2644`) which the client stashes to notify the designer
     (`InterviewModal.tsx:2248-2266`).
  2. For a room that survives the gate but the LLM produced no prose,
     `generateEditorialDraft` force-fills placeholder body text rather than
     emitting a photo-only block: chapters with empty body get `['Content
     pending.']` (`generateEditorialDraft.ts:723-727`), and a no-chapter
     fallback groups images into chapters with body `['Editorial content is
     being generated.']` (`:762-773`). The route-level comment states the
     generator "force-fills any room lacking editorial content with placeholder
     prose" (`generate/route.ts:2160-2163`).

---

## 5. AUDIO

### Every existing use of Deepgram (with paths)

Deepgram appears only in the separate `services/interview-orchestration`
microservice and in cost/flags bookkeeping — it is NOT used by any Next.js API
route in the posting interview:
- `services/interview-orchestration/src/services/deepgram.ts` — `DeepgramService`
  class wrapping `@deepgram/sdk` streaming STT (`listen.live`, model `nova-2`,
  `linear16` @ 16kHz, interim results, `utterance_end_ms: 1000`, VAD events).
  Streams a LiveKit `RemoteTrack`.
- `services/interview-orchestration/src/conversation/manager.ts:14,40,193-200,215,
  483-498,563,592,600` — instantiates and drives `DeepgramService` inside the
  live conversation manager; emits a per-minute cost event (`DEEPGRAM_PER_MINUTE
  = 0.0077`).
- `services/interview-orchestration/src/config.ts:16-17,53-54` and
  `.../routes/health.ts:40` — `DEEPGRAM_API_KEY` config/health.
- `services/interview-orchestration/package.json` — `@deepgram/sdk` dependency.
- `src/lib/ai/cost.ts:12,29,59-61` — cost model constants for `deepgram`
  (per-minute).
- `src/lib/flags.ts:10` — comment on the realtime interview flag ("LiveKit +
  Deepgram + Cartesia").

Deepgram is bound to the realtime, long-form conversational interview
(LiveKit-driven streaming), reached from the modal's `RealtimeInterviewView`
(`interviewMode === "realtime"`) via `/api/interview/realtime/*` and the
external orchestration service. It is gated by `realtimeInterviewConfig.enabled`
(`src/lib/flags.ts`).

### The InterviewSession model and routes that upload/transcribe audio

`InterviewSession` (`prisma/schema.prisma:6937-6975`):
```prisma
model InterviewSession {
  id                   String                 @id
  createdByUserId      String
  projectId            String?
  productId            String?
  vendorBoostRequestId String?                @unique
  vendorId             String?
  status               InterviewSessionStatus @default(DRAFT)
  mode                 InterviewMode          @default(AUDIO)
  promptLens           String?
  recordingAssetId     String?                @unique
  transcriptionJobId   String?
  extractionJobId      String?
  errorMessage         String?
  recordedAt           DateTime?
  uploadedAt           DateTime?
  transcribedAt        DateTime?
  extractedAt          DateTime?
  publishedAt          DateTime?
  createdAt            DateTime               @default(now())
  updatedAt            DateTime
  users                User                   @relation(fields: [createdByUserId], references: [id])
  products             Product?               @relation(fields: [productId], references: [id], onDelete: Cascade)
  projects             Project?               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  MediaAsset           MediaAsset?            @relation(fields: [recordingAssetId], references: [id])
  vendorBoostRequest   VendorBoostRequest?    @relation("interview_sessions_vendorBoostRequestIdTovendor_boost_requests", fields: [vendorBoostRequestId], references: [id])
  QuoteHighlight       QuoteHighlight[]
  TranscriptSegment    TranscriptSegment[]
  derivedBoostRequest  VendorBoostRequest?    @relation("vendor_boost_requests_interviewSessionIdTointerview_sessions")
  vendor               Vendor?                @relation(fields: [vendorId], references: [id])

  @@index([createdByUserId])
  @@index([productId])
  @@index([projectId])
  @@index([status])
  @@index([vendorBoostRequestId])
  @@index([vendorId])
  @@map("interview_sessions")
}
```
Enums: `InterviewMode { AUDIO, VIDEO }` (`:6622-6625`);
`InterviewSessionStatus { DRAFT, UPLOADED, TRANSCRIBING, TRANSCRIBED,
EXTRACTING, EXTRACTED, CLIPPING, READY, PUBLISHED, ARCHIVED }` (`:6627-6638`).

This model belongs to the **vendor-boost "recorded reflection" feature**, not
the posting interview. Its routes are under `src/app/api/interviews/[id]/*`:
- `.../upload-url/route.ts`, `.../upload/route.ts`, `.../confirm-upload/route.ts`
  — upload a full recording (creates/links a `MediaAsset` with `durationMs`,
  `confirm-upload/route.ts:15,73,90`).
- `.../process/route.ts` — transcribes the uploaded recording. It downloads the
  whole file and calls **OpenAI Whisper** (`openai.audio.transcriptions.create({
  model: "whisper-1" })`, `process/route.ts:82,96,111-113`), then runs LLM
  extraction, writing `TranscriptSegment` / `QuoteHighlight` and stepping the
  status enum. It is a batch, whole-session pipeline
  (`DRAFT→UPLOADED→TRANSCRIBING→…→PUBLISHED`).
- `.../status`, `.../approve-highlights`, `.../publish`, `create` — the rest of
  the long-form pipeline.

Reusability for a short per-answer clip: **The `InterviewSession` pipeline
assumes a long-form session** — it models a single uploaded recording asset
(`recordingAssetId` unique, `MediaAsset` with `durationMs`), a multi-stage async
job lifecycle (transcription/extraction job IDs, 10-state status enum),
segment/highlight extraction, and vendor-boost coupling. It is not shaped for a
short per-answer clip.

The posting interview's actual per-answer clip transcription does NOT use
`InterviewSession` or Deepgram. It is:
- Client: `useVoiceRecording`
  (`src/components/posting/interview/useVoiceRecording.ts`) — `MediaRecorder`
  captures an `audio/webm` (or ogg) blob in-memory, no persistence; on stop it
  POSTs the blob as multipart form data (`recording.webm`) to the transcribe
  route (`:88-135`). Wired into `QuestionCard` mic button
  (`QuestionCard.tsx:40-64,152-201`).
- Server: `src/app/api/posting/project/[projectId]/interview/transcribe/route.ts`
  — accepts an audio file (≤25MB, `:17`), calls **OpenAI Whisper**
  (`openai.audio.transcriptions.create({ model: "whisper-1", language: "en" })`,
  `:86-98`), returns `{ transcript }`. It does **not** persist the audio, create
  an `InterviewSession`, or write `audioUrl` — the transcript is merged into the
  answer textarea client-side (`QuestionCard.tsx:54-60`) and saved as text like
  any typed answer.

So there are three separate audio surfaces: (a) posting per-answer Whisper clip
transcription (stateless, short-clip; the transcribe route), (b) the realtime
LiveKit+Deepgram conversational interview (`RealtimeInterviewSession`, external
service), and (c) the vendor-boost long-form recorded `InterviewSession`
(Whisper batch pipeline). Only (a) is the posting text-interview per-answer clip
path.
