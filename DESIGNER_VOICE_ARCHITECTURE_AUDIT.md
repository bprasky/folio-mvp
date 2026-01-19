# Audit: Designer-Specific Atelier Voice Architecture

## Executive Summary

**Core Finding:** The infrastructure for designer voice differentiation EXISTS but is DISCONNECTED. Two designers consulting with the same buyer would currently produce **identical AI behavior** because:

1. `DesignerVoiceProfile` schema exists but is **never populated**
2. Voice data is **never injected** into AI prompts
3. `AtelierFingerprint` only captures "what they like" not "how they think/communicate"
4. Editorial generation uses a **generic publication voice**, not designer-specific

**Verdict:** Atelier is currently a generic AI with designer names attached. Differentiation requires connecting existing infrastructure.

---

## Part 1: Designer Data Inventory

### 1.1 AtelierFingerprint System

**Location:** `prisma/schema.prisma` lines 1509-1586

| Model | Purpose | Voice/Reasoning Content |
|-------|---------|------------------------|
| `AtelierFingerprint` | Core fingerprint container | **NONE** - only stores completeness, version, snapshot |
| `AtelierNode` | Design preference nodes | **NONE** - only label, weight, nodeType |
| `AtelierEdge` | Relationships between nodes | **NONE** - only source, target, weight |
| `AtelierSignal` | Raw signals feeding fingerprint | **PARTIAL** - can store reasoning in metadata |

**Node Types (Aesthetic Only):**
- STYLE (e.g., "Modern", "Minimal")
- ROOM_TYPE (e.g., "Kitchen", "Bathroom")
- MATERIAL (e.g., "Marble", "Brass")
- VENDOR (e.g., vendor-123)
- PRODUCT_CATEGORY (e.g., "Lighting")
- COLOR_CLUSTER (e.g., "sage green")
- BEHAVIOR

**Signals That Capture Reasoning:**
```typescript
// From tag-product-to-image/route.ts
await recordAtelierSignal({ key: 'decision_reasoning', value: text, weight: 1.5 });
await recordAtelierSignal({ key: 'alternatives_considered', value: JSON, weight: 1.2 });
await recordAtelierSignal({ key: 'tradeoffs', value: text, weight: 1.3 });
await recordAtelierSignal({ key: 'conviction_level', value: '0.8', weight: 1.0 });
```

**Critical Issue:** These reasoning signals are stored but **never aggregated** into the fingerprint. The aggregation logic (`src/lib/atelier/aggregate.ts`) only processes aesthetic signals (style:, room:, vendor:, etc.).

---

### 1.2 DesignerVoiceProfile

**Location:** `prisma/schema.prisma` lines 1429-1452

```prisma
model DesignerVoiceProfile {
  id                      String   @id @default(cuid())
  designerId              String   @unique

  // Linguistic patterns
  vocabularyFrequency     Json?    @default("{}")     // Word frequency map
  signaturePhrases        String[]                     // Distinctive expressions
  terminologyPreferences  Json?    @default("{}")
  avgSentenceLength       Float?
  sentenceStructures      Json?    @default("[]")

  // Communication style metrics
  formalityLevel          Float?   // 0-1 scale
  enthusiasmLevel         Float?
  technicalDepth          Float?
  reasoningStyle          String?  // "methodical" | "intuitive" | "narrative"
  commonJustifications    String[]

  // Embeddings
  voiceEmbedding          Bytes?
  interviewAnswerCount    Int      @default(0)
  decisionReasoningCount  Int      @default(0)
  lastAnalyzedAt          DateTime?
}
```

**Population Status:**
- Schema: **COMPLETE**
- Data: **EMPTY**
- The only code that touches this model increments counters:

```typescript
// processInterviewAnswers.ts
await prisma.designerVoiceProfile.upsert({
  update: {
    interviewAnswerCount: { increment: interview.answers.length },
    decisionReasoningCount: { increment: decisionsCreated },
  }
});
// ^ Only increments counts, NEVER populates actual voice fields
```

---

### 1.3 DesignerBrandAssets

**Location:** `prisma/schema.prisma` lines 1332-1368

| Field | Type | Voice Relevance |
|-------|------|-----------------|
| `tagline` | String | One-liner positioning ("We design for living") |
| `brandAdjectives` | String[] | Up to 5 from 22 options (Minimal, Warm, Bold, etc.) |
| `inspirationNotes` | String | Free-text aesthetic philosophy |
| `inspiredByDesigners` | String[] | Influence references |
| `inspiredByPublications` | String[] | Cultural references |

**Current Usage:** Displayed on profile pages only. **Never injected into AI prompts.**

---

### 1.4 Interview Content

**Location:** `prisma/schema.prisma` + `src/app/api/interviews/`

**Data Available:**
| Table | Content | Volume |
|-------|---------|--------|
| `InterviewSession` | Session metadata | Per project/product |
| `TranscriptSegment` | **Verbatim transcript** with ms timing | Full interviews |
| `QuoteHighlight` | Extracted quotes with quality scores | 2-5 per interview |
| `EditorialInterviewAnswer` | Designer responses to editorial questions | 5-15 per project |

**Question Bank Categories (6 Ws):**
- WHY (Intent & Philosophy): "Why did this project matter to you?"
- WHO (Collaboration): "Who pushed the design further?"
- WHAT (Form & Material): "What decision defines the project?"
- WHERE (Context): "Where does this project draw its sense of place?"
- WHEN (Timing): "When did you know the design was resolved?"
- HOW (Craft): "How did you balance concept and practicality?"

**AI Processing:**
- Transcription: OpenAI Whisper (verbatim, ms precision)
- Quote Extraction: GPT-4o-mini (categorizes by use case)
- **Voice Analysis: NOT IMPLEMENTED**

---

### 1.5 DesignerDecision Model

**Location:** `prisma/schema.prisma` lines 1391-1427

```prisma
model DesignerDecision {
  id                   String   @id @default(cuid())
  designerId           String

  // Context
  productId            String?
  projectId            String?
  roomContext          String?

  // Reasoning capture
  reasoning            String?    // "I chose this because..."
  alternatives         Json?      // [{ productId, reason }]
  tradeoffs            String?    // "The tradeoff was..."
  convictionLevel      Float?     // 0-1 confidence
  influences           String[]   // ["client preference", "light quality"]

  // Client context
  clientContext        String?
  clientBriefExcerpt   String?
  clientReaction       String?
  outcomeNotes         String?
}
```

**Population:** Created when designers tag products with reasoning. **Never analyzed for patterns.**

---

## Part 2: Voice Differentiation Analysis

### 2.1 Current AI Prompt Patterns

**Editorial Generation (`/api/posting/project/[projectId]/interview/generate`):**
```typescript
const EDITORIAL_SYSTEM_PROMPT = `
You are an expert interior design editorial writer for a prestigious design publication.
// ... generic magazine voice ...
`

// Designer context NOT injected:
const response = await anthropic.messages.create({
  system: EDITORIAL_SYSTEM_PROMPT,  // Generic voice
  messages: [{ role: 'user', content: userPrompt }],
});
```

**Collaboration Stories (`/lib/collaboration/narrative/assembleStory.ts`):**
```typescript
const NARRATIVE_SYSTEM_PROMPT = `
You are an editorial writer for a prestigious design publication.
Write in third person narrative voice...
`
// Both designer and vendor treated generically
```

**Atelier Deployment (infrastructure exists but unused):**
```typescript
// buildDeploymentContext() returns:
{
  voiceProfile: {
    formalityLevel: 0.7,
    enthusiasmLevel: 0.8,
    reasoningStyle: "methodical",
    signaturePhrases: ["we believe in...", "clients appreciate..."],
  }
}
// ^ This is NEVER injected into prompts
```

---

### 2.2 Differentiation Test Results

**Test:** Would two designers with similar aesthetics produce different AI responses?

| Dimension | Differentiated? | Why |
|-----------|-----------------|-----|
| Product recommendations | Partial | Fingerprint nodes affect product filtering |
| Question style | **NO** | No questioning patterns captured |
| Explanation tone | **NO** | Voice profile never injected |
| Tradeoff framing | **NO** | Reasoning patterns not analyzed |
| Cultural references | **NO** | Brand influences not injected |
| Communication warmth | **NO** | Formality/enthusiasm not used |

**Conclusion:** Two designers with identical aesthetic preferences would produce **byte-for-byte identical** AI responses.

---

### 2.3 What Would Make Designers Different

| Dimension | Example Variation | Current Data Source | Status |
|-----------|------------------|---------------------|--------|
| **Questioning style** | "Tell me about your morning routine" vs "What's your entertaining style?" | None | **GAP** |
| **Priority framing** | Leads with durability vs visual impact | DesignerDecision.influences | Captured, not used |
| **Tradeoff reasoning** | "Worth the investment because..." vs "Save here to spend there..." | DesignerDecision.tradeoffs | Captured, not used |
| **Communication tone** | Warm/conversational vs precise/technical | DesignerVoiceProfile.formalityLevel | Schema exists, empty |
| **Cultural references** | Regional materials vs global trends | DesignerBrandAssets.inspirationNotes | Captured, not used |
| **Decision philosophy** | "Trust your instincts" vs "Let's think through scenarios" | DesignerVoiceProfile.reasoningStyle | Schema exists, empty |

---

## Part 3: Gap Analysis

### 3.1 Missing Data Capture

| Gap | Description | Severity |
|-----|-------------|----------|
| **Voice Profile Population** | Schema exists, no code fills it | CRITICAL |
| **Signature Phrase Extraction** | Interview transcripts exist, phrases not extracted | CRITICAL |
| **Reasoning Pattern Analysis** | Decisions captured, patterns not identified | HIGH |
| **Questioning Style Capture** | No data model for question preferences | HIGH |
| **Formality/Enthusiasm Scoring** | No NLP analysis pipeline | MEDIUM |
| **Voice Embedding Generation** | Field exists, never computed | MEDIUM |

### 3.2 Missing Computation

| Gap | Input Available | Output Needed | Complexity |
|-----|-----------------|---------------|------------|
| Vocabulary analysis | TranscriptSegment, EditorialInterviewAnswer | vocabularyFrequency | LOW |
| Signature phrase extraction | QuoteHighlight, interview answers | signaturePhrases | MEDIUM |
| Formality scoring | All text content | formalityLevel (0-1) | MEDIUM |
| Reasoning style classification | DesignerDecision.reasoning | reasoningStyle enum | MEDIUM |
| Voice embedding | All designer text | voiceEmbedding vector | HIGH |

### 3.3 Missing Integration

| Gap | Source | Destination | Status |
|-----|--------|-------------|--------|
| Voice profile → Editorial prompts | DesignerVoiceProfile | EDITORIAL_SYSTEM_PROMPT | NOT CONNECTED |
| Brand assets → AI context | DesignerBrandAssets | Any prompt | NOT CONNECTED |
| Fingerprint → Consultation | buildDeploymentContext() | Consultation chat | INFRASTRUCTURE ONLY |
| Decision patterns → Recommendations | DesignerDecision | Product explanation | NOT CONNECTED |

---

## Part 4: Proposed Architecture

### 4.1 Data Model Extensions

The `DesignerVoiceProfile` model already has the right fields. Add:

```prisma
model DesignerVoiceProfile {
  // ... existing fields ...

  // NEW: Questioning patterns
  preferredOpeningQuestions  String[]  // How they start conversations
  roomFocusQuestions         Json?     // { "kitchen": ["How do you use..."], ... }

  // NEW: Explanation patterns
  explanationExamples        Json?     // Actual examples of how they explain
  tradeoffFramingStyle       String?   // "investment" | "practical" | "emotional"

  // NEW: Cultural context
  regionalInfluences         String[]  // Geographic/cultural references
  designMovementReferences   String[]  // Modernism, Arts & Crafts, etc.

  // NEW: Consultation behavior
  consultationPacing         String?   // "thorough" | "efficient" | "exploratory"
  uncertaintyHandling        String?   // "offer alternatives" | "make confident pick"

  // Computed from analysis
  lastFullAnalysisAt         DateTime?
  analysisVersion            Int       @default(1)
}
```

### 4.2 Voice Profile Population Pipeline

```typescript
// NEW FILE: src/lib/voice/populateVoiceProfile.ts

export async function populateVoiceProfile(designerId: string) {
  // 1. Gather all text content
  const [interviews, decisions, editorialAnswers, brandAssets] = await Promise.all([
    getDesignerInterviews(designerId),
    getDesignerDecisions(designerId),
    getEditorialAnswers(designerId),
    getBrandAssets(designerId),
  ]);

  // 2. Extract linguistic patterns
  const allText = combineTextSources(interviews, decisions, editorialAnswers);

  const vocabularyFrequency = analyzeVocabulary(allText);
  const signaturePhrases = extractSignaturePhrases(allText, { minOccurrences: 2 });
  const avgSentenceLength = calculateSentenceLength(allText);

  // 3. Score communication style
  const formalityLevel = scoreFormalityWithLLM(allText);
  const enthusiasmLevel = scoreEnthusiasmWithLLM(allText);
  const technicalDepth = scoreTechnicalDepthWithLLM(allText);

  // 4. Classify reasoning patterns
  const reasoningStyle = classifyReasoningStyle(decisions);
  const commonJustifications = extractJustificationPatterns(decisions);
  const tradeoffFramingStyle = classifyTradeoffStyle(decisions);

  // 5. Generate voice embedding
  const voiceEmbedding = await generateEmbedding(
    buildVoiceSummary(signaturePhrases, reasoningStyle, brandAssets)
  );

  // 6. Persist
  await prisma.designerVoiceProfile.upsert({
    where: { designerId },
    create: { designerId, ...computedFields },
    update: { ...computedFields, lastFullAnalysisAt: new Date() },
  });
}
```

### 4.3 Voice-Aware System Prompt Construction

```typescript
// NEW FILE: src/lib/atelier/buildConsultationPrompt.ts

interface ConsultationPromptParams {
  designer: {
    name: string;
    studio: string | null;
  };
  voiceProfile: DesignerVoiceProfile;
  fingerprint: AtelierFingerprint;
  brandAssets: DesignerBrandAssets | null;
  development: Development;
  consultation: Consultation;
  availableProducts: DevelopmentProduct[];
  currentSelections: ConsultationSelection[];
}

export function buildConsultationPrompt(params: ConsultationPromptParams): string {
  const { designer, voiceProfile, fingerprint, brandAssets, development, consultation, availableProducts, currentSelections } = params;

  // Build voice instruction section
  const voiceInstruction = buildVoiceInstruction(voiceProfile, brandAssets);

  // Build fingerprint context
  const fingerprintContext = buildFingerprintContext(fingerprint);

  // Build consultation context
  const consultationContext = buildConsultationContext(development, consultation, availableProducts, currentSelections);

  return `
## Your Identity

You are ${designer.name}'s design assistant${designer.studio ? ` from ${designer.studio}` : ''}, helping a buyer select finishes for their new home. You embody ${designer.name}'s design perspective, voice, and decision-making approach.

## Voice & Communication Style

${voiceInstruction}

## Design Philosophy & Preferences

${fingerprintContext}

## How You Make Recommendations

When suggesting products, you:
${voiceProfile.tradeoffFramingStyle === 'investment'
  ? '- Frame quality as a long-term investment worth making'
  : voiceProfile.tradeoffFramingStyle === 'practical'
  ? '- Focus on practical benefits and daily use considerations'
  : '- Connect choices to how the space will feel and function'}

${voiceProfile.reasoningStyle === 'methodical'
  ? '- Walk through options systematically, explaining trade-offs clearly'
  : voiceProfile.reasoningStyle === 'intuitive'
  ? '- Trust your instincts and help the buyer find what resonates'
  : '- Tell the story of why certain choices work together'}

Common justifications you use:
${voiceProfile.commonJustifications?.map(j => `- "${j}"`).join('\n') || '- Focus on how the choice serves the space'}

## Current Consultation Context

${consultationContext}

## Your Task

Guide the buyer through their finish selections. Ask questions to understand their needs, make recommendations with ${designer.name}'s perspective, and explain your reasoning in their voice.

Remember:
- You ARE ${designer.name}'s perspective, not a generic assistant
- Use the signature phrases and vocabulary that define their communication style
- Frame trade-offs the way they would
- Reference their design philosophy when relevant
`;
}

function buildVoiceInstruction(voiceProfile: DesignerVoiceProfile, brandAssets: DesignerBrandAssets | null): string {
  const lines: string[] = [];

  // Tone guidance
  if (voiceProfile.formalityLevel !== null) {
    const formalityDesc = voiceProfile.formalityLevel > 0.7
      ? 'professional and polished'
      : voiceProfile.formalityLevel > 0.4
      ? 'warm but knowledgeable'
      : 'casual and approachable';
    lines.push(`Tone: ${formalityDesc}`);
  }

  if (voiceProfile.enthusiasmLevel !== null) {
    const enthusiasmDesc = voiceProfile.enthusiasmLevel > 0.7
      ? 'Express genuine excitement about design possibilities'
      : 'Maintain calm confidence in your recommendations';
    lines.push(enthusiasmDesc);
  }

  if (voiceProfile.technicalDepth !== null) {
    const technicalDesc = voiceProfile.technicalDepth > 0.6
      ? 'Use precise design terminology freely'
      : 'Explain concepts in accessible, everyday language';
    lines.push(technicalDesc);
  }

  // Signature phrases
  if (voiceProfile.signaturePhrases?.length) {
    lines.push('\nPhrases that capture your voice:');
    voiceProfile.signaturePhrases.slice(0, 5).forEach(phrase => {
      lines.push(`- "${phrase}"`);
    });
  }

  // Brand positioning
  if (brandAssets?.tagline) {
    lines.push(`\nYour positioning: "${brandAssets.tagline}"`);
  }

  if (brandAssets?.brandAdjectives?.length) {
    lines.push(`Design ethos: ${brandAssets.brandAdjectives.join(', ')}`);
  }

  return lines.join('\n');
}
```

### 4.4 Voice Capture Workflow

**Option A: Passive Extraction (Recommended First)**
```
┌──────────────────────────────────────────────────────────┐
│  EXISTING CONTENT → VOICE PROFILE                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Batch job runs nightly for all designers             │
│                                                          │
│  2. Gather sources:                                      │
│     • TranscriptSegment (interview transcripts)          │
│     • QuoteHighlight (approved quotes)                   │
│     • EditorialInterviewAnswer (editorial responses)     │
│     • DesignerDecision (product reasoning)               │
│     • DesignerBrandAssets (tagline, adjectives)          │
│                                                          │
│  3. NLP Analysis:                                        │
│     • Word frequency → vocabularyFrequency               │
│     • Repeated phrases → signaturePhrases                │
│     • Sentence complexity → avgSentenceLength            │
│                                                          │
│  4. LLM Classification:                                  │
│     • Formality scoring (0-1)                            │
│     • Enthusiasm scoring (0-1)                           │
│     • Technical depth scoring (0-1)                      │
│     • Reasoning style classification                     │
│                                                          │
│  5. Embedding Generation:                                │
│     • Combine voice summary text                         │
│     • Generate 1536-dim embedding                        │
│     • Store for similarity matching                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Option B: Explicit Voice Interview (Enhancement)**
```
New interview question set specifically for voice capture:

COMMUNICATION STYLE:
- "How would you describe your communication style with clients?"
- "When explaining a design decision, what do you typically emphasize first?"

DECISION PHILOSOPHY:
- "When a client is torn between two options, how do you help them decide?"
- "How do you think about splurging vs. saving in a project?"

TRADEOFF FRAMING:
- "Walk me through how you'd explain choosing a more expensive material"
- "How do you handle it when a client wants something you wouldn't recommend?"

SIGNATURE VOCABULARY:
- "What words or phrases do you find yourself using repeatedly?"
- "How would your clients describe your design approach in one sentence?"
```

---

## Part 5: Verification Test Cases

### Test 1: Same Query, Different Designers

**Query:** "I'm not sure about the kitchen countertops"

**Designer A Profile:**
- formalityLevel: 0.8 (professional)
- reasoningStyle: "methodical"
- signaturePhrases: ["let's think through the options", "what matters most is"]
- tradeoffFramingStyle: "investment"

**Expected Response A:**
> "Let's think through the options together. For kitchen countertops, what matters most is how you'll actually use the space. The Caesarstone quartz is our standard selection - excellent durability and a consistent appearance. The Neolith sintered stone is an upgrade worth considering if you do a lot of cooking; it's virtually indestructible and will look pristine in fifteen years. What's your relationship with your kitchen - is it the heart of the home or more of a functional space?"

**Designer B Profile:**
- formalityLevel: 0.4 (warm/casual)
- reasoningStyle: "intuitive"
- signaturePhrases: ["trust your gut", "you'll know when you see it"]
- tradeoffFramingStyle: "emotional"

**Expected Response B:**
> "Oh, countertops are such a personal choice! Trust your gut on this one - you'll know when you see the right one. The marble has this incredible warmth, there's nothing quite like it. Yes, it needs more love, but honestly? The patina tells the story of your life in that kitchen. The quartz is perfect if you want something you don't have to think about. What draws you - the character piece or the worry-free option?"

### Test 2: Product Recommendation

**Scenario:** Buyer asks about bathroom fixtures

**Designer A (technical, methodical):**
> "For the master bath fixtures, we have three options in your tier. The Grohe standard selection offers solid German engineering at an accessible price point. The Hansgrohe upgrade introduces their PowderRain technology - worth experiencing if you haven't, as the shower experience is noticeably different. The Dornbracht at the luxury tier represents the pinnacle of precision engineering. My recommendation depends on how much time you spend in the shower each morning."

**Designer B (warm, intuitive):**
> "Let's talk about how you start your day! The bathroom is really where the morning sets its tone. I'm drawn to the Dornbracht - there's something almost meditative about fixtures that respond exactly as you expect. But honestly, the Hansgrohe rain shower is pretty magical too. Close your eyes and imagine stepping into your new bathroom. What feeling do you want?"

### Verification Criteria

| Aspect | Test Method | Pass Criteria |
|--------|-------------|---------------|
| Vocabulary | Word frequency analysis | <50% overlap in content words |
| Question style | Extract questions asked | Different question topics/framing |
| Recommendation framing | Sentiment analysis | Different emotional register |
| Signature phrases | String matching | Designer's phrases appear |
| Formality | Linguistic analysis | Matches formalityLevel setting |

---

## Part 6: Implementation Roadmap

### Phase 1: Connect Existing Infrastructure (1-2 days)

```
[ ] Inject voiceProfile into consultation prompt template
[ ] Inject brandAssets into consultation prompt template
[ ] Add fingerprint preferences to consultation context
[ ] Create buildConsultationPrompt() function
[ ] Wire up to consultation chat endpoint
```

### Phase 2: Populate Voice Profiles (3-5 days)

```
[ ] Create voice analysis batch job
[ ] Implement vocabulary frequency extraction
[ ] Implement signature phrase extraction
[ ] Implement LLM-based style scoring (formality, enthusiasm, technical)
[ ] Implement reasoning style classification
[ ] Run initial population for all active designers
```

### Phase 3: Enhanced Voice Capture (5-7 days)

```
[ ] Add voice interview questions to onboarding
[ ] Create voice embedding generation pipeline
[ ] Implement voice similarity matching
[ ] Add questioning style capture
[ ] Create voice profile preview UI for designers
```

### Phase 4: Verification & Iteration (2-3 days)

```
[ ] Implement differentiation test suite
[ ] A/B test with sample consultations
[ ] Gather designer feedback on voice accuracy
[ ] Tune prompt templates based on results
```

---

## Deliverables Summary

1. **Data Inventory Table:** Section 1 - All designer data mapped by model
2. **Gap List:** Section 3 - Missing capture, computation, and integration
3. **Recommended Data Model:** Section 4.1 - Voice profile extensions
4. **Voice Capture Workflow:** Section 4.4 - Passive extraction pipeline
5. **System Prompt Template:** Section 4.3 - buildConsultationPrompt()
6. **Differentiation Test Cases:** Section 5 - Verification scenarios

---

## Appendix: Current vs Target State

```
CURRENT STATE:
┌─────────────────────────────────────────────────────────┐
│  Buyer selects Designer A or Designer B                 │
│                    ↓                                    │
│  Same generic AI prompt for both                        │
│                    ↓                                    │
│  Identical responses (different product filter only)    │
└─────────────────────────────────────────────────────────┘

TARGET STATE:
┌─────────────────────────────────────────────────────────┐
│  Buyer selects Designer A                               │
│                    ↓                                    │
│  Load: voiceProfile + fingerprint + brandAssets         │
│                    ↓                                    │
│  Build designer-specific system prompt:                 │
│  - Formality: professional (0.8)                        │
│  - Reasoning: methodical                                │
│  - Phrases: "let's think through...", "what matters..." │
│  - Philosophy: investment-focused tradeoffs             │
│                    ↓                                    │
│  Response sounds like Designer A                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Buyer selects Designer B                               │
│                    ↓                                    │
│  Load: voiceProfile + fingerprint + brandAssets         │
│                    ↓                                    │
│  Build designer-specific system prompt:                 │
│  - Formality: warm/casual (0.4)                         │
│  - Reasoning: intuitive                                 │
│  - Phrases: "trust your gut", "you'll know when..."     │
│  - Philosophy: emotional connection                     │
│                    ↓                                    │
│  Response sounds like Designer B                        │
└─────────────────────────────────────────────────────────┘
```

---

## Conclusion

The Atelier system has **strong architectural bones** but is missing the **connective tissue** to deliver differentiated designer experiences. The voice profile schema exists, interview content exists, brand assets exist - they just aren't wired together.

**Minimum viable differentiation** requires:
1. Populating `DesignerVoiceProfile` from existing content
2. Injecting voice profile into consultation prompts
3. Testing that responses actually differ

This can be achieved in **1-2 weeks** without new data collection, using only existing interview transcripts, decisions, and brand assets.
