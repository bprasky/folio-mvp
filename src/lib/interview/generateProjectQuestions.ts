/**
 * Project-Level Interview Question Generation
 *
 * Generates 5 contextually-adapted questions covering fixed categories
 * that establish the narrative frame BEFORE room-level questions.
 *
 * Categories (always all 5, contextually worded):
 * 1. CLIENT_BRIEF — Who was this for, what did they want?
 * 2. SCOPE_PARAMETERS — What were you working with?
 * 3. DESIGN_DIRECTION — What was the big idea?
 * 4. SIGNATURE_IDENTITY — What is most YOU?
 * 5. SURPRISE_PIVOT — What changed along the way?
 */

import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { ContextLevel } from './contextLevel';
import type { GeneratedQuestion } from './generateQuestions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const PROJECT_QUESTION_CATEGORIES = [
  'CLIENT_BRIEF',
  'SCOPE_PARAMETERS',
  'DESIGN_DIRECTION',
  'SIGNATURE_IDENTITY',
  'SURPRISE_PIVOT',
] as const;

export type ProjectQuestionCategory = typeof PROJECT_QUESTION_CATEGORIES[number];

export interface ProjectQuestionInput {
  projectTitle?: string;
  projectDescription?: string;
  designerName?: string;
  studioName?: string;
  location?: string;
  projectType?: string;
  clientType?: string;
  budgetBand?: string;
  representativeImages: Array<{ url: string }>;
  roomNames: string[];
  roomTypes: string[];
  materialPalette?: string[];
  contextLevel: ContextLevel;
  respondentRole?: 'DESIGNER' | 'ARCHITECT' | 'BUILDER' | 'HOMEOWNER' | 'VENDOR' | 'PHOTOGRAPHER';
}

export interface ProjectQuestionOutput {
  questions: GeneratedQuestion[];
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

export async function generateProjectQuestions(
  input: ProjectQuestionInput
): Promise<ProjectQuestionOutput> {
  const anthropic = new Anthropic();

  // Build image content blocks (2-3 representative images)
  const imageBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const img of input.representativeImages.slice(0, 3)) {
    if (img.url) {
      imageBlocks.push({
        type: 'image',
        source: { type: 'url', url: img.url },
      });
    }
  }

  const locationStr = input.location || 'Not specified';
  const roomTypesStr = input.roomTypes.length > 0
    ? input.roomTypes.join(', ')
    : input.roomNames.join(', ');
  const role = input.respondentRole || 'DESIGNER';

  const prompt = `You are generating the opening interview questions for an interior design editorial feature. These questions establish the narrative frame before we discuss individual rooms.

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

AVAILABLE CONTEXT (use to decide WHAT to ask, NOT what to put IN questions):
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

RULES FOR CONTEXTUAL ADAPTATION (ASK, DON'T ASSERT):
NEVER assert specific facts in questions — timelines, square footage, budget numbers, family details, number of children, ages, previous city. Even if this information is in the project description, your job is to get the ${role.toLowerCase()} to say it in their own words. The metadata tells you WHICH questions are worth asking. It does NOT go INTO the question.

Use metadata to decide what to ask:
- Description says "14 months" → Ask about timeline: "How long did this one take start to finish?"
- Description says "family from Chicago" → Ask about the client: "Tell me about the clients — who are they and what brought them to you?"
- Description says "full renovation" → Ask about scope: "What were you starting with — were you working with existing bones or starting fresh?"

Do NOT put metadata details into the question:
- BAD: "This 14-month full gut renovation must have been an undertaking"
- BAD: "Your clients, a young family with two kids under five from Chicago"
- BAD: "With a $500K budget for a 3,200 square foot home"
- BAD: "Over 14 months with a family with small children, what evolved?"
- GOOD: "How long did this project take?"
- GOOD: "Tell me about the clients."
- GOOD: "What was the budget reality on this one?"

Exception: You CAN gently reference that a description EXISTS without restating its contents. "The project notes mention a relocation — tell me about that" is fine. "The project notes say a young family of four relocated from Chicago to Boca Raton" is not — you just read their file out loud.

- For SIGNATURE_IDENTITY: Use the designer's name if available. "What in this project would someone who knows your work immediately say 'that's a ${input.designerName || '[Designer]'} project'?"

WHAT MAKES A GOOD QUESTION:
- Uses metadata to choose the right topic, but lets the respondent supply the details
- Does NOT repeat or quote metadata back to the respondent
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
- "The description mentions a young family from Chicago — what did they want?" (parrots metadata)
- "This 14-month renovation must have been complex" (asserts facts from the description)
- Anything that ignores the available context and could be asked about any project
- Anything that addresses the ${role.toLowerCase()} as if they're a different role

Return ONLY a JSON object:
{
  "questions": [
    {
      "category": "CLIENT_BRIEF",
      "question": "Tell me about these clients — who are they and what did they come to you with?",
      "intent": "Get the human story and original brief in the designer's own words"
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
}`;

  const content: Anthropic.Messages.ContentBlockParam[] = [
    ...imageBlocks,
    { type: 'text', text: prompt },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  });

  const responseText = response.content.find((c) => c.type === 'text');
  const text = responseText && 'text' in responseText ? responseText.text : '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No JSON in LLM response for project questions');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.questions)) {
    throw new Error('LLM returned no questions array for project questions');
  }

  const questions: GeneratedQuestion[] = parsed.questions
    .filter((q: any) => q.question && q.category)
    .map((q: any) => {
      const category = q.category as string;
      const isHighPQ = category === 'SIGNATURE_IDENTITY' || category === 'SURPRISE_PIVOT';
      return {
        id: `project-${category}-${randomUUID()}`,
        text: q.question,
        contextLevel: input.contextLevel,
        type: 'generic' as const,
        rooms: [],
        products: [],
        vendors: [],
        boostable: false,
        pullQuotePotential: isHighPQ ? 'high' as const : 'medium' as const,
        topic: `project_${category.toLowerCase()}`,
      };
    });

  return { questions };
}
