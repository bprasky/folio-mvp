# 17_EDITORIAL_QUEUE

## Purpose

This document defines the Editorial Queue: Folio's proactive content generation system. After a designer publishes three stories, Folio begins generating recommended content pieces derived from that designer's body of work, queues them for completion, and schedules completed pieces into a publishing calendar mixed across the main feed.

The subscription reframe: designers are not paying for publishing software. They are paying for an automated design magazine that never stops covering their practice.

## The Groundbreaking Part

Every AI feature on the platform today is reactive. The designer initiates, the AI responds. The Editorial Queue inverts this. Folio initiates. The system reads the designer's corpus on its own schedule, decides what story is worth telling next, generates the prompts, and presents finished content options. The designer's only job is to log in and answer.

This is unprompted generation as a product primitive. The interview remains the single input surface. The queue becomes the single prompt surface. Folio asks first.

## Core Principle: Editor-First, Not Template-First

A template-first system asks "which format should this designer fill out next." That flattens the feed. Every designer completing the same five templates produces a content mill.

An editor-first system asks "what is the story in this designer's corpus right now" and picks the format afterward as the container. This is what a magazine editor does, and it is the same move the project-level interview already makes: the intelligence lives in the question, not the format.

Differentiation lives in the question because the question encodes the body of work. Two designers can complete a Q&A in the same week and share nothing, because each set of questions could only have been asked of that corpus.

**Examples of angle-derived questions:**

| Corpus signal | Angle | Generated question |
|---|---|---|
| Same unlacquered brass specced in three kitchens | Material loyalty | "What do you tell clients when they ask about patina?" |
| Last two projects flipped from warm to cool palettes | Evolution | "What changed between the Hobbs house and the loft?" |
| One room earned 3x the saves of everything else in the project | Anatomy of a room | "Walk us through the decision that made this corner work." |

Generic questions produce generic answers from anyone. Specific questions produce answers only that designer can give.

## System Components

The system has four components, executed in order.

### Component 1: Corpus Digest Builder

Angle extraction requires a defined input, not "the body of work" as a vibe. The division of labor is fixed: **code computes the facts, the model picks the story.** The AI never decides what is true about the corpus, only which truth makes the best piece.

The digest builder has two layers.

**Raw layer** compiles the structured snapshot:

- Designer bio and stated positioning
- Tagged products with tag counts across projects
- Finishes and finish categories per project
- Room types and room-level composition per project
- Project timeline (createdAt, publishedAt sequence, ProjectStage where present)
- Save activity derived per image and per project (where engagement data
  exists). No image-level save table exists: Save is product-level and
  PostSave is post-level. Image-level interest is derived by joining
  product-level saves through the ProductTags placed on each image.
- All prior interview answers from `EditorialInterviewAnswer` (never discarded per 15_SUPER_ARTICLES; source of truth for regeneration)
- Prior completed queue pieces (feedback loop; see Maturity Ladder)

**Signal layer** runs deterministic computations over the raw layer before any API call. Each computed signal carries a stable ID, its type, and the row-level evidence that produced it. All are computable in plain TypeScript with the minimum corpus (bio, three projects, finishes).

| Signal type | Computation rule | Why it carries a story |
|---|---|---|
| Repetition | Same product, vendor, material, or finish family appearing in 2+ of the designer's projects | One repeated spec across independent projects is a deliberate choice; deliberate choices are stories |
| Distribution | Room type spread, project type and budget band spread, finish category concentration (share of tags per category) | Concentration reveals what the designer cares about versus what the project required |
| Claim-versus-evidence | Bio positioning terms checked against actual finish and product data; output is a match or a tension with the supporting rows | The gap or the match writes the question; either could only be asked of this designer |
| Outlier | The project, room, or spec that breaks the pattern of the others | At three projects an outlier is loud |
| Save-delta | Image or room whose derived save activity materially exceeds corpus baseline, computed by joining product-level Save records through the image's ProductTags | Observed audience interest points at anatomy-of-a-room pieces (requires engagement data; see Maturity Ladder) |
| Evolution | Directional change in palette, material family, or finish category across the project timeline | Requires timeline depth; unlocks at higher corpus maturity |

Output is a single structured digest (raw layer + computed signals with IDs) passed to angle extraction. V1 is deterministic assembly, no embeddings, no graph work. The save-delta derivation is philosophically consistent with the saves-as-edges principle: the signal is "people saved products that live in this image," a directional interest measure grounded in the lineage graph rather than a vanity metric.

### Component 2: Angle Extraction

One Anthropic API call over the corpus digest. Model constant lives in the centralized `MODELS` object like every other Claude call in the codebase. No direct OpenAI usage in this system.

The model receives the computed signals, not raw project dumps. Its job narrows to two things: rank which signals carry the best editorial angle right now, and write the framing plus prompts. The model does not discover facts about the corpus; the signal layer already did.

The call returns candidate angles, each with:

- Angle type (material loyalty, evolution, anatomy of a room, process, philosophy-in-practice, client dynamic, regional identity)
- **Signal citations: the signal IDs from the digest that support the angle**
- Evidence references resolved from the cited signals (specific product tags, images, projects, prior answers)
- Confidence and freshness (has this angle been used before, is the underlying evidence new)

**Validation-reject rule:** every returned angle must cite at least one signal ID present in the digest it was given. Any angle citing evidence not in the computed signal set is rejected before persistence. This is the hallucination guard. It guarantees `DesignerAngle.evidence` always resolves to verifiable rows.

Angles persist as `DesignerAngle` records. Extraction runs on a schedule (weekly per eligible designer) and on trigger events (new project published, spec sheet exported).

### Component 3: Format Assignment and Prompt Generation

Format is assigned after the angle, as the container. Formats extend the existing `PostVariant` enum rather than a new enum, so completed queue pieces flow directly into the existing `ProjectPost` publishing path with no bridge code.

**New PostVariant values (ADD-only):** `QA`, `THIS_OR_THAT`, `GET_TO_KNOW`

Existing values (`PROJECT_FEATURE`, `MATERIAL_STUDY`, `METHOD`, `DESIGNER_PROFILE`, `EVENT_ESSAY`) are also assignable by the queue.

Prompt generation is a second Anthropic call: given the angle, evidence, and assigned format, generate the specific questions or prompt structure the designer will complete. Prompts are stored on the `EditorialQueueItem`, not generated at render time.

### Component 4: Publishing Calendar

A constraint solver over feed slots. This is a new job, not an extension of the daily editorial scheduler, which is edition-scoped threshold publishing and remains untouched.

Designers complete pieces on their own schedule. Folio decides when each piece runs. The gap between completion and publication is where the magazine framing becomes literal: pieces are scheduled into an editorial mix the way a magazine plans an issue.

**V1 constraints:**

1. No same designer more than once per day on the main feed
2. No same format within N consecutive feed slots (N = 4 initial value, tunable)
3. Region mixing where regional data exists

**Deferred (yellow-flagged):** Merit-weighted slot allocation. No engagement distribution data exists until the founding cohort is live. Same class of assumption as collaborator conversion. Revisit with real data.

## Unlock Gate and Maturity Ladder

### The Three-Story Gate

The queue unlocks when a designer has three PUBLISHED `ProjectPost` records. This is a simple count, no schema needed. The gate is structurally necessary, not arbitrary: angle extraction needs a corpus to read, and three self-published stories are the minimum corpus. The gate also trains the designer on quality and gives the system real signal about voice before automation begins.

### Maturity Ladder

The ladder is mechanical, not a soft judgment about corpus richness: it defines which signal computations are eligible at each corpus depth. Angle types follow from eligible signals.

| Corpus depth | Eligible signal computations | Resulting angle types |
|---|---|---|
| 3 stories (minimum) | Repetition, distribution, claim-versus-evidence, outlier | Corpus-building first: GET_TO_KNOW, philosophy prompts, material loyalty where repetition fires |
| 5+ stories, 100+ tags, engagement data present | Adds save-delta | Anatomy of a room, deeper material loyalty |
| 8+ stories, multi-project timeline | Adds evolution | Evolution, regional identity |

Every completed piece feeds back into the digest, and new projects widen the eligible signal set. Angles compound. The longer a designer stays subscribed, the better their magazine gets. This is the retention loop stated as a system property.

## Schema (ADD-only)

Per migration discipline: idempotent, additive, per-migration approval gates, no destructive DDL.

```prisma
model DesignerAngle {
  id            String   @id @default(cuid())
  designerId    String
  organizationId String?

  angleType     String   // 'material_loyalty', 'evolution', 'anatomy_of_room', 'process', 'philosophy', 'client_dynamic', 'regional_identity'
  summary       String   // One-line editorial framing of the angle
  signalIds     String[] // Computed signal IDs cited by the model; validated against the digest before persistence
  evidence      Json     // References resolved from cited signals: productTagIds, imageIds, projectIds, interviewAnswerIds
  confidence    Float
  isFresh       Boolean  @default(true)  // False once consumed by a queue item

  extractedAt   DateTime @default(now())
  expiresAt     DateTime?

  queueItems    EditorialQueueItem[]

  @@index([designerId, isFresh])
}

model EditorialQueueItem {
  id            String   @id @default(cuid())
  designerId    String
  angleId       String

  format        String   // PostVariant value assigned to this piece
  prompts       Json     // Generated questions/prompt structure, stored not rendered
  status        String   // 'recommended', 'in_progress', 'completed', 'scheduled', 'published', 'dismissed', 'expired'

  // Consent (references 16_ATTRIBUTION_CONSENT)
  distributionConsent   Boolean  @default(false)
  consentScope          String?  // 'feed_only', 'feed_and_social'
  consentAt             DateTime?

  // Output linkage
  projectPostId String?  // Set when completed piece becomes a ProjectPost

  // Calendar
  scheduledSlot DateTime?

  createdAt     DateTime @default(now())
  completedAt   DateTime?

  angle         DesignerAngle @relation(fields: [angleId], references: [id])

  @@index([designerId, status])
  @@index([status, scheduledSlot])
}
```

**Enum migration:** ADD three values to `PostVariant`: `QA`, `THIS_OR_THAT`, `GET_TO_KNOW`. Postgres enum value addition is ADD-only safe.

**Not modified:** `TrendInterviewRequest`, `EditorialDraft`, the daily editorial scheduler, `InterviewSession`. The trend pipeline stays untouched.

## Hard Constraints

### Image Provenance Gate

Any queue piece pulling imagery for feed or social distribution filters on `ImageSource`. Only `DESIGNER_ORIGINAL` and `FOLIO_COMMISSIONED` are eligible for Folio-channel distribution. `VENDOR_REFERENCE` and `VENDOR_LICENSED` images never appear in queue-generated content. This is a spec-level constraint, not an implementation detail.

### Consent

Distribution consent is captured at queue item completion, per item, with scope. The checkbox covers feed mixing and social channel distribution so no rework is needed when social automation lands. References 16_ATTRIBUTION_CONSENT.

## V1 Distribution Scope

Feed mixing only. "Folio publishes to our socials" implies social API integration that does not exist in the stack. V1 social distribution is a manual admin export of completed, consented pieces. Social automation is a later phase and maps onto the already-specced SHORT_VIDEO and LONG_VIDEO ProjectModule types when Remotion enters the stack.

## Model Calls

All generation in this system uses the Anthropic API through the centralized `MODELS` constants. Two call types:

1. **Angle extraction:** corpus digest in, candidate angles out (structured JSON)
2. **Prompt generation:** angle + evidence + format in, designer-facing prompts out

Editorial generation was already on Anthropic via MODELS at spec time,
confirmed by the step-1 audit. One provider for all editorial intelligence is
the standing state, not a migration task.

## Rejected and Deferred

- **Rejected: shared template library as the generation source.** Templates flatten. Angles differentiate. Formats are containers only.
- **Rejected: widening TrendInterviewRequest.** Trend-scoped and designer-scoped systems stay separate. No risk to the trend pipeline.
- **Rejected: new QueueFormat enum.** PostVariant extension keeps completed pieces on the existing ProjectPost publishing path.
- **Deferred: merit-weighted calendar slots.** Yellow-flagged until cohort engagement data exists.
- **Deferred: automated social distribution.** Manual admin export in V1.
- **Deferred: embeddings or graph-based angle extraction.** V1 is one Claude call over a deterministic digest.

## Implementation Sequence

Audit before implement. No step combines audit and implementation.

1. **Read-only audit:** editorial scheduler (`src/lib/editorial/scheduler.ts`), EditorialDraft pipeline (`getOrCreateEditorialDraft`), InterviewModal flow, `EditorialInterviewAnswer` storage, `MODELS` constants, current OpenAI call sites. Confirm reuse points named in this spec. Output: audit report, no code changes.
2. **Migration 1:** `PostVariant` enum additions. Approval gate.
3. **Migration 2:** `DesignerAngle`. Approval gate.
4. **Migration 3:** `EditorialQueueItem`. Approval gate.
5. **Corpus digest builder** (pure function, testable against a real cohort project once one exists as fixture).
6. **Angle extraction call + persistence.**
7. **Prompt generation call.**
8. **Queue surface UI** (designer-facing: recommended pieces, completion flow, consent capture).
9. **Publishing calendar job** (constraint solver, feed mixing).
10. **OpenAI to Anthropic switch: COMPLETE BEFORE START.** The step-1 audit
    (tasks/EDITORIAL_QUEUE_STEP1_AUDIT.md) confirmed all editorial generation
    (generateEditorialDraft, the daily scheduler) already runs on Anthropic via
    the centralized MODELS constants. Remaining OpenAI usage is Whisper
    transcription, moderation, embeddings, and image generation. None of it is
    editorial generation and all of it is out of scope for this system.

Steps 1 through 4 are the immediate Claude Code session. Steps 5 onward are surface-scoped commits per the standard workflow.
