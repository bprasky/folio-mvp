# 18 — Prompted Content System

> **Status**: Spec draft
> **Replaces**: 17_TWENTY_QUESTIONS_SPEC (concept)

## Purpose

This document defines Folio's Prompted Content system — a bio-seeded, conversational question engine that generates tailored questions for designers, architects, and contractors based on what the platform already knows about them, then crystallizes their collective answers into substantive editorial articles.

This replaces the fixed "20 Questions" concept with something more powerful: questions that feel like they were written by someone who read your bio, because they were. The system bridges the trust gap between "platform asks me things" and "someone is genuinely curious about my experience."

## Strategic Problem

### The Trust Gap

Designers are skeptical of platforms asking them questions. The history of the internet has trained professionals to see prompts as extraction — the platform wants content it can monetize, and the professional gets nothing but the vague promise of "exposure."

A fixed question set — however beautifully designed — still reads as a survey. "What material do you always come back to?" is a good question, but it's a good question for everyone, and designers can feel that. It lacks the signal that says: we know who you are, and we're asking because of something specific about your work.

### The Bridge

The Prompted Content system solves this by inverting the question generation flow:

1. Designer creates their bio through the existing interview process
2. The system analyzes their bio alongside the collective corpus of all bios on the platform
3. Questions are generated that connect directly to the designer's stated experience
4. The designer receives questions that feel relevant because they are relevant
5. Answers enrich the designer's own bio while simultaneously feeding article formation
6. Once enough answers accumulate around a theme, articles crystallize — often from unexpected angles

The designer's motivation is never "contribute to our article." It's "this is an interesting question about something I actually did." The article is a welcome byproduct.

## How It Feels

### To the Designer

After completing their bio interview, a designer begins seeing question cards in the magazine feed and on their profile dashboard. The first one might read:

> "You mentioned restoring original millwork in a 1920s brownstone. What's the conversation like when a client wants to paint over 100-year-old wood?"

This doesn't feel like a survey. It feels like someone read what they wrote and got curious. The designer taps it, records a 45-second video or types a few sentences, and moves on. Their bio gets richer. They got to talk about something they care about.

A week later, another card:

> "Three designers on Folio have mentioned the tension between preservation boards and modern living. You navigated that in Brooklyn — did you win every battle, or did you learn to pick them?"

Now there's social proof. Other professionals are thinking about the same things. The designer is part of a conversation, not filling out a form.

### To the Reader

An article appears in the magazine feed:

> "The Walls We Don't Touch: How Preservation Shapes Modern Design"

It features pull quotes from four designers across three cities, each of whom answered questions about their specific experiences with historic materials, preservation boards, and client expectations. The article wasn't assigned by an editor. It emerged from the collision of real experiences that the system recognized as a story.

## What It Is Not

- Not a fixed questionnaire (questions are generated per-user from bio analysis)
- Not a survey (no completion tracker, no "7 of 20 answered" pressure)
- Not cold AI prompts (every question traces back to something the designer said or something their peers said)
- Not content extraction disguised as engagement (the primary value to the designer is bio enrichment)
- Not fluff roundups ("We Asked 40 Designers Their Favorite Color") — articles must have narrative tension, unexpected angles, and editorial substance

## System Architecture

### Three Engines

The system has three distinct engines that operate independently but feed each other:

**Engine 1: Question Generation**
- Inputs from Designer Knowledge Base: Individual bio content, Project interview answers, Collective knowledge corpus, Existing prompted answers, Atelier fingerprint signals, Active story threads, Project/product tagging data
- Outputs: Targeted questions per user, Follow-up questions, Story-completing questions

**Engine 2: Conversational Answer**
- Question card display (feed, profile dashboard, notifications)
- Video recording (LiveKit/Deepgram transcription → text polish)
- Text entry (direct typing)
- Follow-up generation (1-2 follow-ups per initial answer)
- Bio enrichment (answers fold back into designer's profile)
- Atelier signal capture (per answer)

**Engine 3: Article Crystallization**
- Story thread monitoring (thematic clustering of answers)
- Narrative tension detection (disagreement, surprise, depth)
- Critical mass evaluation (quality, not just quantity)
- Article proposal generation (angle, structure, pull quotes)
- Editorial compilation with verbatim pull quotes
- Social card generation for quoted contributors

## Engine 1: Question Generation

### The Designer Knowledge Base

The question engine draws from everything Folio knows about a designer:

1. **Bio interview content** — Their narrative about who they are, their philosophy, their origin story.
2. **Project interview answers** — Per-room, per-project responses from the editorial interview flow.
3. **ProfileQA entries** — Existing Q&A pairs on their profile.
4. **Product tagging and specification data** — What they've specified, which vendors they return to.
5. **Atelier fingerprint signals** — Accumulated behavioral and aesthetic signals.
6. **Previous prompted answers** — What they've already said through this system.

The collective knowledge base includes all designer bios and project interviews, all prompted answers, active story threads, and trend signals.

### Question Types

**Type 1: Bio-Reflective** — Generated directly from something the designer said in their bio. Trust-builders.

**Type 2: Cross-Domain** — Generated by connecting patterns across bio and multiple project interviews. Highest-value.

**Type 3: Project-Reflective** — Generated from a specific project interview, asking to go deeper.

**Type 4: Peer-Resonant** — Generated from patterns across multiple designers. Creates professional conversation feeling.

**Type 5: Story-Completing** — Generated when an emerging article needs a specific perspective.

**Type 6: Follow-Up** — Generated after a designer answers an initial question. Limited to 1-2 per thread.

### Question Quality Principles

1. **Traceable origin.** Every question traceable to something specific.
2. **Wins and arrivals, not compromises.** Lean toward what worked, what surprised.
3. **Answerable from experience.** Not theoretical knowledge.
4. **Conversational register.** Like a thoughtful colleague at dinner.
5. **No AI-tell phrases.** No "Can you share...", "Tell us about a time when..."
6. **Specific over general.** "What surprised you about reclaimed oak?" beats "What's your favorite material?"

### Generation Prompt

```
You are generating questions for professionals in the interior design industry.
These questions will appear as beautifully typeset cards in a design magazine.

CRITICAL RULES:
- Every question must trace back to something specific about this person's background.
- Questions should feel like they came from a thoughtful colleague who studied their work.
- Focus on wins, arrivals, and genuine curiosity about craft decisions.
- Never use: "Can you share...", "Tell us about a time...", "What insights..."
- Be specific. Reference materials, spaces, decisions, places.
- Maximum 2 sentences per question. The best questions are one sentence.
- Questions should be answerable in 30-90 seconds of speaking or 2-4 sentences of typing.
```

### Delivery Cadence

- **Post-bio completion**: 1-2 questions within 24 hours
- **Ongoing feed presence**: 1-2 new questions per week, mixed into magazine feed
- **Profile dashboard**: 2-3 pending questions, low-pressure
- **Notification (selective)**: Only for story-completing questions

## Engine 2: Conversational Answer Flow

### Question Card UX

Glassmorphism card with:
- Cormorant Garamond Italic, warm stone color
- Single "Answer" CTA button
- Provenance line: "Folio · Asked based on your interview"
- 20px border-radius, consistent with card system

### Answer Modal

Two input modes:
- **Video/Audio Recording** — LiveKit session, Deepgram transcription, 90-second soft limit
- **Text Entry** — Generous text area, Instrument Sans body font, no character limit

### Follow-Up Flow

After submitting, 0-2 follow-up questions generated from answer content.
"That's enough" always visible and respected immediately.

### Bio Enrichment

Every answer automatically:
1. Creates ProfileQA entry (visible on designer's profile)
2. Captures Atelier signals
3. Designer can reorder, edit, toggle visibility, or delete

## Engine 3: Article Crystallization

### Story Thread Formation

Monitors prompted answers for emerging stories. Evaluates:
- **Narrative tension** (40% weight) — Are answers in dialogue?
- **Perspective diversity** (25% weight) — Different contexts?
- **Emotional weight** (20% weight) — Personal investment?
- **Specificity** (15% weight) — Concrete details?

### Article Compilation Rules

- Pull quotes are **verbatim**
- No invented framing
- Attribution is precise (name, firm, context)
- The unexpected angle (cross-cutting themes)
- Not a roundup — narrative article with beginning, middle, end

## Data Model

### PromptedQuestion
- id, targetUserId, questionText, questionType
- provenance (Json), atelierSignals (Json)
- priority, deliveryContext, deliveredAt, expiresAt
- status: GENERATED | DELIVERED | ANSWERED | SKIPPED | EXPIRED

### PromptedAnswer
- id, questionId, userId, answerText
- videoUrl, transcriptRaw
- profileQAId, bioEnriched
- consentToQuote

### StoryThread
- id, status: FORMING | MATURING | READY | PROPOSED | PUBLISHED | STALE
- themeDescription, proposedAngle, proposedTitle
- contributingAnswers (Json), supportingContext (Json)
- Quality scores: narrativeTension, perspectiveDiversity, emotionalWeight, specificityScore

## Implementation Phases

### Phase 1: Bio-Reflective Questions
- Question generation from completed bios (Type 1 only)
- Question card component in profile dashboard
- Answer modal with text entry (video deferred)
- Bio enrichment (answers create ProfileQA entries)
- Atelier signal capture per answer

### Phase 2: Project Interview Integration + Cross-Domain Questions
### Phase 3: Collective Intelligence + Peer-Resonant Questions
### Phase 4: Story Threads + Article Crystallization
### Phase 5: Scale + Optimization

## Success Metrics

### Phase 1
- Answer rate: >30% of delivered questions answered
- Average answer length: >50 words
- Bio enrichment: >60% keep ProfileQA entry visible
- Qualitative: Designers describe questions as "relevant" or "interesting"
