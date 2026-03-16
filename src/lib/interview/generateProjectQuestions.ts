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

  const prompt = `You are generating the opening interview questions for an interior design editorial feature. These questions establish the narrative frame before we discuss individual rooms.

You have 5 categories you MUST cover. But you must ask them in a way that feels like a journalist who already read the brief and looked at the photos — not like a form with required fields.

AVAILABLE CONTEXT:
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

REQUIRED CATEGORIES (generate exactly one question per category):
1. CLIENT_BRIEF — Who was this for and what did they want?
2. SCOPE_PARAMETERS — What were you working with?
3. DESIGN_DIRECTION — What was the big idea?
4. SIGNATURE_IDENTITY — What in this project is most YOU?
5. SURPRISE_PIVOT — What changed along the way?

RULES FOR CONTEXTUAL ADAPTATION:
- If the project description mentions specific people or a story (e.g., "a young family relocating from Chicago"), reference it: "The description mentions a family moving down from Chicago — what did they tell you they wanted this house to feel like?"
- If the photos show a strong visual direction (sculptural forms, warm metallics, minimal palette), name it: "The photos read as sculptural and warm but not at all beachy, even in South Florida — was that the brief from day one?"
- If the location suggests a regional design context (coastal Florida, Manhattan apartment, mountain retreat), use it: "Boca Raton has a pretty specific design vernacular — how much of that did the client want vs. want to avoid?"
- If project type or budget band suggests scale, reference it: "This looks like a full gut renovation — what were you starting with?"
- For SIGNATURE_IDENTITY: Use the designer's name if available. "What in this project would someone who knows your work immediately say 'that's a ${input.designerName || '[Designer]'} project'?"

WHAT MAKES A GOOD CONTEXTUAL QUESTION:
- References something specific from the metadata or photos (proves you did your homework)
- Asks ONE thing clearly (not compound questions)
- Opens space for storytelling, not yes/no answers
- Focuses on wins and arrivals, not compromises or failures
- Sounds like a colleague asking over coffee, not a form field

WHAT MAKES A BAD QUESTION:
- "Can you tell me about your design philosophy?" (too vague, not project-specific)
- "What inspired you?" (lazy, generic)
- "Tell me about the challenges you faced." (focuses on negatives)
- "Can you walk me through the project?" (too broad)
- Anything that ignores the available context and could be asked about any project

Return ONLY a JSON object:
{
  "questions": [
    {
      "category": "CLIENT_BRIEF",
      "question": "The description mentions a young family from Chicago — what did they tell you they wanted this house to feel like?",
      "intent": "Get the human story and original brief"
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
