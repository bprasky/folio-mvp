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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomQuestionInput {
  roomName: string;
  roomImages: Array<{
    url: string;
    classification?: Record<string, unknown> | null;
  }>;
  roomTags: Array<{
    productName: string;
    vendorName?: string;
    category?: string;
    // Product Naming Gate (spec 20): a subscribed vendor's product may be named
    // and spotlighted as a question subject; a non-subscribed product must be
    // referred to by descriptor only. Defaults to descriptor-only when unset.
    named?: boolean;
    /** Brand-free swap text used when the product may not be named. */
    descriptor?: string;
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
        source: { type: 'url', url: img.url },
      });
    }
  }

  // Build tag summary, split by naming eligibility (Product Naming Gate, spec 20).
  // Subscribed vendors' products may be named and spotlighted; everything else is
  // referred to by descriptor only, and only when the designer's story surfaces it.
  const namedTags = input.roomTags.filter((t) => t.named);
  const descriptorTags = input.roomTags.filter((t) => !t.named);

  const nameableSummary = namedTags.length > 0
    ? namedTags.map((t) => {
        const parts = [t.productName];
        if (t.vendorName) parts.push(`by ${t.vendorName}`);
        if (t.category) parts.push(`(${t.category})`);
        return `- ${parts.join(' ')}`;
      }).join('\n')
    : 'None.';

  const descriptorSummary = descriptorTags.length > 0
    ? descriptorTags.map((t) => {
        // Never fall back to the product name here — this block is labeled
        // "descriptor only", so a missing descriptor must degrade to the generic
        // category or a bare floor, never leak the name it is meant to withhold.
        const desc = t.descriptor?.trim() || t.category?.trim() || 'the piece';
        return `- ${desc}`;
      }).join('\n')
    : 'None.';

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
  const knownFactsBlock = knownFactsLines
    ? `
WHAT WE ALREADY KNOW (the designer told us this in the opening conversation about the project):
${knownFactsLines}

HOW TO USE THIS BACKGROUND — THE LANE CONTRACT:
- It informs your WORDING, never your TOPICS. This room's photos and tagged products decide what you ask about; the background only makes those questions land like they come from someone who was in the room for the opening conversation.
- Do NOT re-ask anything covered above (who the clients are, the scope, the timeline, the overall direction). That ground is covered.
- Do NOT import themes from the background that aren't visible in this room's photos or products. If the background says "relocation" and nothing in this room relates to it, the relocation does not appear in your questions.
- Referencing it conversationally is fine and encouraged ("Given the pace this project ran at, ..."). Citing it as a record is not ("You mentioned in the earlier section...", "According to your answers...").
`
    : '';

  // Cross-room reference instruction
  const crossRoomInstruction = input.projectContext.otherRoomNames.length > 0
    ? `Include exactly 1 question that references how this room relates to an adjacent space (${input.projectContext.otherRoomNames.slice(0, 3).join(', ')}). This cross-room question still belongs to ${input.roomName}.`
    : '';

  const prompt = `You are a senior editorial journalist at an interior design publication interviewing a designer about the ${input.roomName} in their project${input.projectContext.projectTitle ? ` "${input.projectContext.projectTitle}"` : ''}.

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
}`;

  const content: Anthropic.Messages.ContentBlockParam[] = [
    ...imageBlocks,
    { type: 'text', text: prompt },
  ];

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
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
    deep_dive: 'hero_piece',
    vendor_loyalty: 'vendor_loyalty',
    material_thread: 'material_theme',
    spatial_narrative: 'spatial_narrative',
    philosophy: 'generic',
  };

  const questions: GeneratedQuestion[] = parsed.questions.map((q: any) => ({
    id: randomUUID(),
    text: q.text || '',
    contextLevel: input.contextLevel,
    type: typeMap[q.type] || 'hero_piece',
    rooms: [input.roomName],
    products: Array.isArray(q.products) ? q.products : [],
    vendors: Array.isArray(q.vendors) ? q.vendors : [],
    boostable: !!q.boostable,
    pullQuotePotential: q.type === 'philosophy' || q.type === 'vendor_loyalty' ? 'high' as const : 'medium' as const,
    topic: q.topic || 'general',
  }));

  return {
    roomName: input.roomName,
    questions,
  };
}
