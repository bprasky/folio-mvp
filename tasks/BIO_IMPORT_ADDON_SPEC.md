# Bio Import — Link or Paste Existing Content

**Add-on to:** INTERVIEW_FIRST_PROFILE_SPEC.md
**Status:** Spec
**Touches:** `OrgBioInterview`, `ProfileInterview`, interview gate, extraction pipeline

---

## Purpose

Designers who already have a professional bio — on their website, LinkedIn, a PDF portfolio, or a prior platform — should not be asked to repeat what they've already written. Instead, they can bring that content in, let the system analyze it against the interview question set, and only answer what isn't already covered.

**The interview becomes a gap-fill, not a fresh start.**

---

## Entry Point

When a designer is redirected to the About interview (via the interview gate in `lib/profile/interview-gate.ts`), the first screen offers two paths before any questions are shown:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Let's build your studio profile.                             │
│                                                                 │
│   We'll ask you a few questions about your work —              │
│   or if you already have a bio written somewhere,              │
│   we can start there instead.                                  │
│                                                                 │
│   ┌─────────────────────────────┐                              │
│   │   Link or paste a bio  →   │  ← primary CTA               │
│   └─────────────────────────────┘                              │
│                                                                 │
│   Start from scratch →                                         │  ← secondary text link
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

"Link or paste a bio" is the primary path — it signals to designers with existing content that Folio respects their work rather than ignoring it.

---

## Bio Import UI

```
┌─────────────────────────────────────────────────────────────────┐
│   Bring in your existing bio                                    │
│                                                                 │
│   Paste a URL  ────────────────────────────────────────────    │
│   [ Your website, Houzz profile, LinkedIn, etc.           ]    │
│                                                                 │
│   Or paste text directly ──────────────────────────────────    │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   [Analyze my bio →]                                           │
└─────────────────────────────────────────────────────────────────┘
```

Both inputs are valid. If a URL is provided, the system fetches and extracts the text content. If both are provided, text takes precedence.

---

## Analysis Pipeline

### Step 1 — Fetch (if URL)

```typescript
// lib/profile/bio-import.ts

async function fetchBioFromUrl(url: string): Promise<string> {
  const response = await fetch(`/api/profile/fetch-bio-url`, {
    method: 'POST',
    body: JSON.stringify({ url })
  });

  const { text } = await response.json();
  return text;
}
```

Server-side fetch strips nav, footer, and boilerplate — returns only the body text most likely to contain bio content. Uses a Claude call to extract the relevant passage if the page contains mixed content:

```typescript
// app/api/profile/fetch-bio-url/route.ts

const extractionPrompt = `
  This is the text content of an interior designer's website or profile page.
  Extract only the bio, about, or studio description text.
  Exclude: navigation, contact forms, project titles, testimonials, footer content.
  Return only the bio text, nothing else. If no bio is found, return null.
`;
```

### Step 2 — Score Against Interview Questions

Each interview question from `ORG_ABOUT_QUESTIONS` or `PERSONAL_ABOUT_QUESTIONS` (defined in `src/lib/org-onboarding/conversational-interview-questions.ts`) is evaluated against the imported bio text. The result is a coverage map — not binary, but scored by depth.

```typescript
interface QuestionCoverageResult {
  questionId: string;   // matches ConversationalQuestion.id (e.g. 'founding', 'approach')
  question: string;
  covered: boolean;
  depth: 'full' | 'partial' | 'none';
  extractedAnswer: string | null;  // what the bio already says about this
  gapNote: string | null;          // what's still missing
}

async function analyzeBioAgainstQuestions(
  bioText: string,
  questions: ConversationalQuestion[]
): Promise<QuestionCoverageResult[]> {

  const response = await anthropic.messages.create({
    model: MODELS.sonnet, // never hardcode — see src/lib/ai/models.ts
    thinking: { type: 'disabled' }, // required on Sonnet 5; omitting it runs adaptive thinking
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `
You are analyzing an interior designer's existing bio to determine which
profile interview questions it already answers — and how well.

BIO TEXT:
${bioText}

INTERVIEW QUESTIONS:
${questions.map((q, i) => `${i + 1}. [${q.id}] ${q.question}`).join('\n')}

For each question, return a JSON array with this structure:
{
  "questionId": string,
  "depth": "full" | "partial" | "none",
  "extractedAnswer": string | null,
  "gapNote": string | null
}

DEPTH DEFINITIONS:
- "full": The bio answers this clearly and with specificity. No follow-up needed.
- "partial": The bio touches on this but lacks specificity or depth.
              A short follow-up would meaningfully enrich it.
- "none": The bio does not address this at all.

IMPORTANT:
- Generic statements ("passionate about design", "client-focused") do not
   count as answering a question — mark as "none" even if topically related.
- "partial" should be your most common output. Most bios gesture at things
   without going deep.
- extractedAnswer: quote or closely paraphrase what the bio actually says
   about this topic. null if depth is "none".
- gapNote: one sentence describing what's still missing. null if depth is "full".

Return only valid JSON. No preamble.
      `
    }]
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}
```

### Step 3 — Coverage Summary Screen

After analysis, show the designer what was found before jumping to questions:

```
┌─────────────────────────────────────────────────────────────────┐
│   Here's what we found in your bio                             │
│                                                                 │
│   ✓  How the studio started          Covered                   │
│   ◑  How you approach projects       Partially covered         │
│   ✓  Client relationships            Covered                   │
│   ✗  Where you're based & work       Not found                 │
│   ◑  Types of work you take on       Partially covered         │
│   ✗  Materials & details you use     Not found                 │
│   ✓  Studio size & structure         Covered                   │
│                                                                 │
│   We'll ask you 4 quick follow-up questions to fill the gaps.  │
│                                                                 │
│   [Continue →]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Rules:
- `full` → shown as ✓, skipped in follow-up round
- `partial` → shown as ◑, included in follow-up with context
- `none` → shown as ✗, included in follow-up as full question

The count ("4 quick follow-up questions") is dynamic and sets accurate expectations before the designer commits to continuing.

### Step 4 — Follow-Up Interview Round

Only questions with `depth: 'partial' | 'none'` are asked.

For partial questions, the question is prefaced with what was already found:

```typescript
function buildFollowUpQuestion(
  question: ConversationalQuestion,
  coverage: QuestionCoverageResult
): string {
  if (coverage.depth === 'partial' && coverage.extractedAnswer) {
    return `You mentioned: "${coverage.extractedAnswer}" — can you go a bit deeper on that?`;
  }
  // depth === 'none' — ask the original question as-is
  return question.question;
}
```

This keeps the follow-up feeling conversational rather than mechanical. The designer hears their own words reflected back before being asked to expand.

### Step 5 — Merge and Extract

After the follow-up round completes, the extraction pipeline runs on a merged context — the original bio text + the follow-up answers — not just the interview answers alone.

Uses `buildTranscriptFromAnswers()` from `conversational-interview-questions.ts` for the follow-up portion:

```typescript
async function extractFromMergedContext(
  bioText: string,
  followUpAnswers: Record<string, string>,
  followUpQuestions: ConversationalQuestion[],
  context: 'org' | 'personal'
): Promise<ExtractedProfileFields> {

  const followUpTranscript = buildTranscriptFromAnswers(followUpAnswers, followUpQuestions);

  const mergedContent = `
EXISTING BIO:
${bioText}

FOLLOW-UP INTERVIEW:
${followUpTranscript}

Prefer the follow-up interview for any field where both sources provide
an answer — the interview reflects more recent and deliberate intent.
Use the bio to fill gaps the interview didn't address.
  `;

  return extractProfileFields(mergedContent, context);
}
```

The merge instruction matters: the interview answers take precedence over the bio for the same field. If a designer said one thing in their old website bio and something slightly different in the interview, the interview wins — it's the more recent, considered version.

---

## Data Model Additions

### Fields on OrgBioInterview

```prisma
// ADD to existing OrgBioInterview model (prisma/schema.prisma:3502)
importedBioText       String?   @db.Text  // Raw text of the imported bio
importedBioUrl        String?             // Source URL if fetched
importedBioAnalyzedAt DateTime?           // When analysis ran
bioImportType         String    @default("FRESH") // FRESH | IMPORTED_URL | IMPORTED_TEXT
```

### Fields on ProfileInterview

```prisma
// ADD to existing ProfileInterview model (prisma/schema.prisma:2646)
importedBioText       String?   @db.Text
importedBioUrl        String?
importedBioAnalyzedAt DateTime?
bioImportType         String    @default("FRESH") // FRESH | IMPORTED_URL | IMPORTED_TEXT
```

### New model: InterviewQuestionCoverage

```prisma
model InterviewQuestionCoverage {
  id                   String        @id @default(cuid())

  // Polymorphic — one or the other
  orgBioInterviewId    String?
  profileInterviewId   String?

  questionId           String        // matches ConversationalQuestion.id
  depth                CoverageDepth
  extractedAnswer      String?       @db.Text
  gapNote              String?
  askedInFollowUp      Boolean       @default(false)

  orgBioInterview      OrgBioInterview?  @relation(fields: [orgBioInterviewId], references: [id])
  profileInterview     ProfileInterview? @relation(fields: [profileInterviewId], references: [id])

  @@unique([orgBioInterviewId, questionId])
  @@unique([profileInterviewId, questionId])
  @@map("interview_question_coverage")
}

enum CoverageDepth {
  FULL
  PARTIAL
  NONE
}
```

### Relation additions

```prisma
// ADD to OrgBioInterview model
questionCoverage InterviewQuestionCoverage[]

// ADD to ProfileInterview model
questionCoverage InterviewQuestionCoverage[]
```

---

## New API Routes

### `POST /api/profile/fetch-bio-url`

Input: `{ url: string }`
- Fetches the URL server-side
- Strips HTML boilerplate
- Runs Claude extraction to isolate bio content
- Returns `{ text: string | null, error?: string }`

Error handling:
- Auth walls, 404s → `{ text: null, error: "couldn't_access" }`
- No bio found on page → `{ text: null, error: "no_bio_found" }`

### `POST /api/profile/analyze-bio`

Input: `{ bioText: string, context: 'org' | 'personal' }`
- Runs `analyzeBioAgainstQuestions()` against the appropriate question set
- Returns `QuestionCoverageResult[]`

### `PATCH /api/orgs/[orgId]/bio-interview` (existing — extend)

Add support for:
- `importedBioText`, `importedBioUrl`, `bioImportType` fields
- `conversationalAnswers` now may be partial (only gap questions)

### `POST /api/profile/extract-from-interview` (existing — extend)

Add support for merged context extraction when `importedBioText` is present on the interview record.

---

## Routing Map

| Scenario | What Happens |
|----------|-------------|
| Designer selects "Link or paste a bio" | Bio import UI shown before any questions |
| URL provided — fetch succeeds | Text extracted, analysis runs |
| URL provided — fetch fails (auth wall, 404) | Error inline: "We couldn't access that page — paste your bio text instead" |
| Analysis complete | Coverage summary screen shown |
| All questions `full` | Skip interview entirely → go straight to extraction + receipt |
| Mix of full / partial / none | Follow-up round with only gap questions |
| Designer selects "Start from scratch" | Full 7-question interview (org) or 5-question (personal), no import |

---

## Edge Case — All Questions Covered

If the bio is rich enough that every question scores `full`, the system skips the interview entirely:

```
┌─────────────────────────────────────────────────────────────────┐
│   Your bio is already pretty complete.                         │
│                                                                 │
│   ✓  How the studio started          Covered                   │
│   ✓  How you approach projects       Covered                   │
│   ✓  Client relationships            Covered                   │
│   ✓  Where you're based & work       Covered                   │
│   ✓  Types of work you take on       Covered                   │
│   ✓  Materials & details you use     Covered                   │
│   ✓  Studio size & structure         Covered                   │
│                                                                 │
│   We'll use this to build your profile.                        │
│   You can always refine it after.                              │
│                                                                 │
│   [Build my profile →]                                         │
└─────────────────────────────────────────────────────────────────┘
```

This is a reward moment. Designers with well-written bios should feel recognized for that, not made to repeat themselves.

---

## Interview Gate Update

The interview gate (`lib/profile/interview-gate.ts`) needs no structural change. The gate checks whether the interview is completed — the import flow is a *path within* the interview, not a bypass around it.

The `OrgBioInterview` record is still created at the start, with `bioImportType` set to `IMPORTED_URL` or `IMPORTED_TEXT`. The `conversationalAnswers` field stores only the gap follow-up answers. Completion criteria remain the same: `conversationalAnswers` is truthy (even if partial) or all questions scored `full` (no follow-up needed).

For the all-questions-covered case, `conversationalAnswers` is set to `{}` (empty object, truthy) and `generatedAt` is set after extraction runs on the bio text alone.

---

## Implementation Phase

**Phase 1B — Bio Import** (add to Phase 1 of the main spec)

1. Add `importedBioText`, `importedBioUrl`, `importedBioAnalyzedAt`, `bioImportType` fields to `OrgBioInterview` and `ProfileInterview` models (migration)
2. Add `InterviewQuestionCoverage` model + `CoverageDepth` enum (migration)
3. Bio import entry point screen on interview gate (two-path UI)
4. Bio import input screen (URL + paste textarea)
5. `POST /api/profile/fetch-bio-url` — server-side URL fetch + Claude bio extraction
6. `POST /api/profile/analyze-bio` — Claude analysis scoring bio against question set
7. Coverage summary screen UI (✓ / ◑ / ✗ display)
8. Follow-up round with dynamic question set (gap questions only, using `buildFollowUpQuestion`)
9. Extend extraction pipeline to handle merged context (bio + follow-up transcript)
10. Handle all-questions-covered edge case (skip to extraction)

---

## What This Unlocks

- **Faster onboarding for established studios** — designers with polished website bios get a 30-second profile instead of a 5-minute interview
- **Higher completion rates** — lower perceived effort when most questions are pre-answered
- **Better extraction quality** — a written bio + targeted follow-ups produces richer data than either source alone
- **Respect for existing content** — signals that Folio is additive, not duplicative
