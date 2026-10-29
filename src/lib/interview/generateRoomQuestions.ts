import { projectPhotoProcessingUrl } from '@/lib/server/protected-project-photo';
/**
 * Per-Room Interview Question Generation
 *
 * Generates interview questions for ONE room in ONE LLM call.
 * Each question is born into its room — no post-hoc distribution needed.
 */

import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { ContextLevel } from './contextLevel';
import type { GeneratedQuestion, QuestionType } from './generateQuestions';
import { formatKnownFacts, type KnownFacts } from './distillInterviewFacts';
import { MODELS } from '@/lib/ai/models';
import { isArrivalSafe } from './prompts/validateQuestion';
import { FOLIO_INTERVIEWER_PERSONA } from './prompts/persona';
import { SHARED_RULE_BLOCK, ARRIVALS_CONTRAST_POLICY } from './prompts/rules';
import { laneContract, MATERIAL_CONTEXT_POLICY } from './prompts/sourceHandling';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomQuestionInput {
  projectId?: string;
  roomName: string;
  roomImages: Array<{
    url: string;
    classification?: Record<string, unknown> | null;
  }>;
  budget: number;
  contextLevel: ContextLevel;
  projectContext: {
    projectTitle?: string;
    designerName?: string;
    overallStyle?: string;
    materialPalette?: string[];
    otherRoomNames: string[];
    /**
     * Neutral fact digest from the designer's "About This Project" answers.
     * Informs question WORDING only — topics stay pinned to this room's
     * photos and tags (see the lane contract in the prompt).
     */
    knownFacts?: KnownFacts | null;
  };
}

export interface RoomQuestionOutput {
  roomName: string;
  questions: GeneratedQuestion[];
}

// ---------------------------------------------------------------------------
// Per-room LLM call
// ---------------------------------------------------------------------------

export async function generateRoomQuestions(
  input: RoomQuestionInput
): Promise<RoomQuestionOutput> {
  const anthropic = new Anthropic();

  // Build image content blocks (cap at 8 per room to manage cost)
  const imageBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const img of input.roomImages.slice(0, 8)) {
    if (img.url) {
      imageBlocks.push({
        type: 'image',
        source: { type: 'url', url: input.projectId ? await projectPhotoProcessingUrl(img.url, input.projectId) : img.url },
      });
    }
  }

  // Build classification summary from images
  const classificationNotes: string[] = [];
  for (const img of input.roomImages) {
    if (!img.classification) continue;
    const c = img.classification;
    const parts: string[] = [];
    if (Array.isArray(c.materials) && c.materials.length) parts.push(`Materials: ${(c.materials as string[]).join(', ')}`);
    if (Array.isArray(c.colors) && c.colors.length) parts.push(`Colors: ${(c.colors as string[]).join(', ')}`);
    if (Array.isArray(c.styles) && c.styles.length) parts.push(`Style: ${(c.styles as string[]).join(', ')}`);
    if (parts.length) classificationNotes.push(parts.join(' | '));
  }
  const classificationSummary = classificationNotes.length > 0
    ? classificationNotes.join('\n')
    : 'No AI classification data.';

  // Known-facts digest from the project-level interview (if the designer has
  // answered "About This Project" already). Wording aid only — the lane
  // contract below keeps topic selection pinned to this room's photos/tags.
  const knownFactsLines = formatKnownFacts(input.projectContext.knownFacts);
  const knownFactsBlock = laneContract(knownFactsLines);

  // Cross-room reference instruction
  const crossRoomInstruction = input.projectContext.otherRoomNames.length > 0
    ? `Include exactly 1 question that references how this room relates to an adjacent space (${input.projectContext.otherRoomNames.slice(0, 3).join(', ')}). This cross-room question still belongs to ${input.roomName}.`
    : '';

  const prompt = `${FOLIO_INTERVIEWER_PERSONA}

${SHARED_RULE_BLOCK}

${ARRIVALS_CONTRAST_POLICY}

${MATERIAL_CONTEXT_POLICY}

YOUR TASK: interview the designer about the ${input.roomName} in their project${input.projectContext.projectTitle ? ` "${input.projectContext.projectTitle}"` : ''}. Generate room-level questions grounded in this room's photos, using material themes only to corroborate visual observations.

ROOM: ${input.roomName}
IMAGES: ${input.roomImages.length} photos of this room (shown above)
CONTEXT LEVEL: ${input.contextLevel}/5

AI-DETECTED DETAILS:
${classificationSummary}

${input.projectContext.overallStyle ? `PROJECT STYLE: ${input.projectContext.overallStyle}` : ''}
${input.projectContext.materialPalette?.length ? `MATERIAL PALETTE: ${input.projectContext.materialPalette.join(', ')}` : ''}
${input.projectContext.designerName ? `DESIGNER: ${input.projectContext.designerName}` : ''}
${knownFactsBlock}
Generate exactly ${input.budget} interview questions for the ${input.roomName}.

RULES:
1. Ground each question in a visual detail, material relationship or spatial decision visible in this room. Material themes are clues, not proof of what appears here.
2. Keep the conversation at the design level. No product-specific questions, brand names, vendor endorsements or testimonials.
3. Every question sets up an answer the designer would be proud to publish (arrivals/contrast policy above applies).
4. No generic questions. "Tell us about your color choices" is NEVER acceptable. "The brass hardware against the navy millwork — walk us through that pairing" is editorial.
5. Do not ask for product identification or purchasing advice.
6. Mix question types: 1 warm opening, then exploration of materials, atmosphere and spatial decisions, and 1 closing philosophy question if budget >= 4.
${crossRoomInstruction ? `7. ${crossRoomInstruction}` : ''}

Return ONLY a JSON object:
{
  "questions": [
    {
      "text": "The full question text",
      "type": "opening | deep_dive | material_thread | spatial_narrative | philosophy",
      "vendors": [],
      "products": [],
      "boostable": false,
      "topic": "semantic_topic_slug"
    }
  ]
}`;

  const content: Anthropic.Messages.ContentBlockParam[] = [
    ...imageBlocks,
    { type: 'text', text: prompt },
  ];

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    thinking: { type: 'disabled' },
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  });

  const responseText = response.content.find((c) => c.type === 'text');
  const text = responseText && 'text' in responseText ? responseText.text : '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error(`No JSON in LLM response for room ${input.roomName}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.questions)) {
    throw new Error(`LLM returned no questions array for room ${input.roomName}`);
  }

  const typeMap: Record<string, QuestionType> = {
    opening: 'generic',
    deep_dive: 'generic',
    material_thread: 'material_theme',
    spatial_narrative: 'spatial_narrative',
    philosophy: 'generic',
  };

  // A commercial response is outside this lane, even if the model ignores the
  // prompt. Callers retain their existing fallback for incomplete room plans.
  const candidates: unknown[] = parsed.questions;
  const questions: GeneratedQuestion[] = candidates.filter((value): value is Record<string, unknown> & { text: string } => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const q = value as Record<string, unknown>;
    return typeof q.text === 'string' && !!q.text.trim() && q.type !== 'vendor_loyalty' && !q.boostable &&
      !(Array.isArray(q.products) && q.products.length) && !(Array.isArray(q.vendors) && q.vendors.length);
  }).map(q => ({
    id: randomUUID(),
    text: q.text,
    contextLevel: input.contextLevel,
    type: typeMap[String(q.type)] || 'generic',
    rooms: [input.roomName],
    products: [],
    vendors: [],
    boostable: false,
    pullQuotePotential: q.type === 'philosophy' ? 'high' as const : 'medium' as const,
    topic: typeof q.topic === 'string' && q.topic ? q.topic : 'general',
  }));

  // Arrivals/contrast gate (docs/17 §3, docs/17_INTERVIEW_PROMPT_CANON.md). The live
  // per-room path had no validation gate before this; grievance/regret framing is dropped.
  const gated = questions.filter((q) => isArrivalSafe(q.text));
  if (gated.length < questions.length) {
    console.info(
      `[generateRoomQuestions] arrivals gate dropped ${questions.length - gated.length} question(s) for ${input.roomName}`,
    );
  }

  return {
    roomName: input.roomName,
    questions: gated,
  };
}
