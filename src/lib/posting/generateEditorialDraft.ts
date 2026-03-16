import Anthropic from "@anthropic-ai/sdk";
import { BlocksSchema } from "./schemas";
import { z } from "zod";
import { callLLM } from "./llmClient";
import { formatRoomName } from "@/lib/utils/formatRoomName";

const client = new Anthropic();

export const FOLIO_TONE = `
Warm, confident, minimalist, design-literate. 
Describe process, intent, and materials poetically but concretely.
Avoid marketing speak; prefer quiet authority and authenticity.
`;

type GenInput = {
  project: any;
  designer?: any;
  vendors?: any[];
  images: { id: string; caption?: string; room?: string }[];
  tags: any[];
  answers: {
    questionId: string;
    section: string;
    role: "DESIGNER" | "VENDOR" | "ANY";
    answer: string;
    isFollowUp?: boolean;
    parentAnswerId?: string;
    roomId?: string;
  }[];
  followups?: {
    question: string;
    answer: string;
  }[];
  rooms?: Array<{ id: string; name: string; type?: string }>;
  imageOrder?: string[];
  correlationId?: string;
};

const ANTHROPIC_ENABLED = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";

// De-duplicate answers by content
function deduplicateAnswers(answers: GenInput['answers']) {
  const seen = new Set<string>();
  return answers.filter((a) => {
    if (!a.answer) return false;
    const normalized = a.answer.trim().toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// Build material context from tags
function buildMaterialContext(tags: any[]) {
  const map = new Map<string, { name: string; vendor?: string; finish?: string; count: number }>();
  for (const t of tags || []) {
    const p = t?.product;
    if (!p?.id) continue;
    const key = p.id;
    const prev = map.get(key) || {
      name: p.name ?? "Product",
      vendor: p.vendor?.name,
      finish: p.finish || p.category,
      count: 0,
    };
    prev.count += 1;
    map.set(key, prev);
  }
  return Array.from(map.values());
}

// Group images into chapters by room (or evenly if no room data)
function groupImagesIntoChapters(
  images: { id: string; caption?: string; room?: string }[],
  imageOrder?: string[]
): Array<{ title: string; imageIds: string[] }> {
  const ordered = imageOrder
    ? imageOrder.map(id => images.find(i => i.id === id)).filter(Boolean) as typeof images
    : images;

  // Try grouping by room first
  const byRoom = new Map<string, string[]>();
  for (const img of ordered) {
    const room = img.room || 'General';
    const list = byRoom.get(room) || [];
    list.push(img.id);
    byRoom.set(room, list);
  }

  // If we have named rooms (not just "General"), use room-based chapters
  if (byRoom.size > 1 || (byRoom.size === 1 && !byRoom.has('General'))) {
    return Array.from(byRoom.entries()).map(([room, ids]) => ({
      title: formatRoomName(room),
      imageIds: ids.slice(0, 8),
    }));
  }

  // No room data: split images evenly into 2-3 chapters
  const allIds = ordered.map(i => i.id);
  if (allIds.length <= 3) {
    return [{ title: 'The Space', imageIds: allIds }];
  }
  const chunkSize = Math.ceil(allIds.length / Math.min(3, Math.ceil(allIds.length / 3)));
  const chapters: Array<{ title: string; imageIds: string[] }> = [];
  const chapterTitles = ['The Vision', 'The Details', 'The Finish'];
  for (let i = 0; i < allIds.length; i += chunkSize) {
    chapters.push({
      title: chapterTitles[chapters.length] || `Chapter ${chapters.length + 1}`,
      imageIds: allIds.slice(i, i + chunkSize),
    });
  }
  return chapters;
}

// Build credits array from input designer/vendor data
function buildCredits(input: GenInput): Array<{ role: string; name: string }> {
  const credits: Array<{ role: string; name: string }> = [];
  if (input.designer?.name) {
    credits.push({ role: 'Designer', name: input.designer.name });
  }
  if (input.designer?.studio && input.designer.studio !== input.designer?.name) {
    credits.push({ role: 'Studio', name: input.designer.studio });
  }
  return credits;
}

// Distribute top-level pull quotes into per-chapter pullQuote fields
// so both the draft editor and preview can render them inline.
function distributePullQuotesToChapters(
  chapters: Array<{ title: string; body: string[]; imageIds: string[]; pullQuote?: string }>,
  pullQuotes: Array<string | { text: string; context?: string }>
) {
  if (!pullQuotes.length || !chapters.length) return;
  for (let i = 0; i < chapters.length && i < pullQuotes.length; i++) {
    const q = pullQuotes[i];
    chapters[i].pullQuote = typeof q === 'string' ? q : q.text;
  }
}

// Fallback blocks generator — produces canonical format matching composeEditorialHard output
export function toFallbackBlocks(input: GenInput) {
  const uniqueAnswers = deduplicateAnswers(input.answers);
  const ledger = buildMaterialContext(input.tags);

  const kicker = input.project?.title || 'A Considered Composition';
  const deck = (uniqueAnswers[0]?.answer || input.project?.description || "A thoughtfully designed space.").slice(0, 400);

  // Build room-organized chapters (matching canonical galleryChapters structure)
  const chapters = groupImagesIntoChapters(input.images, input.imageOrder);

  // Distribute answer text across chapters as body paragraphs
  const answerTexts = uniqueAnswers.map(a => a.answer).filter(Boolean);
  const galleryChapters = chapters.map((ch, idx) => ({
    title: ch.title,
    body: answerTexts.length > 0
      ? answerTexts.slice(idx * 2, idx * 2 + 2).map(t => t.slice(0, 5000))
      : ['A thoughtfully designed space that balances intention and function.'],
    imageIds: ch.imageIds,
  }));

  // Extract genuine pull quotes from answers of appropriate length
  const designerName = input.designer?.name;
  const pullQuotes: Array<string | { text: string; context?: string }> = uniqueAnswers
    .filter(a => a.answer.length > 60 && a.answer.length < 250 && /\b(I|we|my|our)\b/i.test(a.answer))
    .slice(0, 3)
    .map(a => ({
      text: a.answer.slice(0, 300),
      context: designerName || undefined,
    }));

  // Distribute pull quotes into per-chapter fields for editor/preview rendering
  distributePullQuotesToChapters(galleryChapters, pullQuotes);

  const blocks = {
    lead: { kicker, deck },
    galleryChapters: galleryChapters.length > 0 ? galleryChapters : undefined,
    pullQuotes: pullQuotes.length > 0 ? pullQuotes : undefined,
    materialsLedger: ledger.length ? {
      items: ledger.map(l => ({
        name: l.name,
        finish: (l.finish && typeof l.finish === 'string' && l.finish.trim()) ? l.finish : undefined,
        note: l.vendor ? `Vendor: ${l.vendor}` : undefined,
      }))
    } : undefined,
    credits: buildCredits(input),
    mode: 'recomposition' as const,
  };

  return BlocksSchema.parse(blocks);
}

// Extract structured blocks from narrative article — produces canonical format
function parseNarrativeToBlocks(article: string, input: GenInput): z.infer<typeof BlocksSchema> {
  const lines = article.split('\n').map(l => l.trim()).filter(Boolean);

  // Extract kicker (headline) — use first short line, or strip markdown heading markers
  let kicker = input.project?.title || '';
  const headlineCandidate = lines[0] || '';
  if (headlineCandidate.length < 80) {
    kicker = headlineCandidate.replace(/^#+\s*/, '').trim() || kicker;
  }

  // Extract deck from second line or first substantial paragraph
  const deckCandidate = lines.find((l, i) => i > 0 && l.length > 30 && l.length < 400) || lines[1] || '';
  const deck = deckCandidate.slice(0, 400);

  // Extract narrative paragraphs (skip headline/deck)
  const startIdx = lines.indexOf(deckCandidate) + 1 || 2;
  const narrativeParagraphs = lines.slice(startIdx).filter(l => l.length > 50);

  // Extract pull quotes — look for quoted text within paragraphs
  const designerName = input.designer?.name;
  const pullQuotes: Array<string | { text: string; context?: string }> = [];

  // Strategy 1: Extract text within quotation marks from the narrative
  for (const p of narrativeParagraphs) {
    const quoteMatches = p.match(/["\u201C]([^"\u201D]{20,250})["\u201D]/g);
    if (quoteMatches) {
      for (const match of quoteMatches) {
        const cleaned = match.replace(/["\u201C\u201D]/g, '').trim();
        if (cleaned.length >= 20 && cleaned.length <= 300) {
          pullQuotes.push({ text: cleaned, context: designerName || undefined });
        }
      }
    }
    if (pullQuotes.length >= 4) break;
  }

  // Strategy 2: If LLM didn't produce enough quoted text, extract from interview answers
  const uniqueAnswers = deduplicateAnswers(input.answers);
  if (pullQuotes.length < 2 && uniqueAnswers.length > 0) {
    const quoteWorthy = uniqueAnswers
      .filter(a => a.answer.length > 60 && a.answer.length < 250)
      .filter(a => /\b(I|we|my|our)\b/i.test(a.answer))
      .slice(0, 3 - pullQuotes.length);
    for (const a of quoteWorthy) {
      pullQuotes.push({ text: a.answer.slice(0, 300), context: designerName || undefined });
    }
  }

  // Build room-organized gallery chapters with images distributed across them
  const chapters = groupImagesIntoChapters(input.images, input.imageOrder);

  // Distribute narrative paragraphs across chapters
  const parasPerChapter = Math.max(2, Math.ceil(narrativeParagraphs.length / Math.max(1, chapters.length)));
  const galleryChapters = chapters.map((ch, idx) => ({
    title: ch.title,
    body: narrativeParagraphs
      .slice(idx * parasPerChapter, (idx + 1) * parasPerChapter)
      .map(p => p.slice(0, 5000)),
    imageIds: ch.imageIds,
  })).filter(ch => ch.body.length > 0 || ch.imageIds.length > 0);

  // Ensure at least one chapter has body content
  if (galleryChapters.length > 0 && galleryChapters.every(ch => ch.body.length === 0)) {
    galleryChapters[0].body = narrativeParagraphs.slice(0, 3).map(p => p.slice(0, 5000));
  }

  // Build materials ledger
  const ledger = buildMaterialContext(input.tags);

  // Distribute pull quotes into per-chapter fields for editor/preview rendering
  distributePullQuotesToChapters(galleryChapters, pullQuotes);

  const blocks = {
    lead: { kicker, deck },
    galleryChapters: galleryChapters.length > 0 ? galleryChapters : undefined,
    pullQuotes: pullQuotes.length > 0 ? pullQuotes : undefined,
    materialsLedger: ledger.length ? {
      items: ledger.map(l => ({
        name: l.name,
        finish: (l.finish && typeof l.finish === 'string' && l.finish.trim()) ? l.finish : undefined,
        note: l.vendor ? `Vendor: ${l.vendor}` : undefined,
      }))
    } : undefined,
    credits: buildCredits(input),
    mode: 'recomposition' as const,
  };

  return BlocksSchema.parse(blocks);
}

export async function generateEditorialDraft(input: GenInput): Promise<{
  blocks: z.infer<typeof BlocksSchema>;
  usedFallback: boolean;
}> {
  const _cid = input.correlationId || 'generate';
  
  // De-duplicate answers before processing
  const uniqueAnswers = deduplicateAnswers(input.answers);

  // Build context
  const { project, designer, images, tags } = input;
  const products = buildMaterialContext(tags);

  // Build room-answer summary for room coverage enforcement
  const roomAnswerCounts = new Map<string, number>();
  for (const a of uniqueAnswers) {
    const roomName = a.section || 'General';
    roomAnswerCounts.set(roomName, (roomAnswerCounts.get(roomName) || 0) + 1);
  }

  // Format answers with [BASE] / [FOLLOW-UP] tags and room context
  const formattedAnswers = uniqueAnswers.map(a => {
    const tag = a.isFollowUp ? `[FOLLOW-UP — ${a.section || 'General'}]` : `[BASE — ${a.section || 'General'}]`;
    return `${tag} Q: ${a.questionId || 'Question'}\nA: ${a.answer}`;
  }).join("\n\n");

  const roomCoverageList = roomAnswerCounts.size > 0
    ? `\nROOMS WITH INTERVIEW CONTENT (DO NOT OMIT ANY):\n${Array.from(roomAnswerCounts.entries()).map(([room, count]) => `- ${room}: ${count} answer${count > 1 ? 's' : ''}`).join('\n')}\n`
    : '';

  const locationParts = [project?.city, project?.regionState].filter(Boolean);
  const locationStr = locationParts.join(', ') || '';
  const designerLine = designer?.name
    ? `${designer.name}${designer.studio ? ` / ${designer.studio}` : ''}`
    : '';

  const contextText = `
PROJECT: ${project?.title ?? ""}
DESIGNER: ${designerLine}
LOCATION: ${locationStr}
${project?.description ? `PROJECT DESCRIPTION: ${project.description}\n` : ''}${project?.projectType && project.projectType !== 'UNSPECIFIED' ? `PROJECT TYPE: ${project.projectType.toLowerCase().replace(/_/g, ' ')}\n` : ''}${project?.clientType ? `CLIENT TYPE: ${project.clientType.toLowerCase()}\n` : ''}TAGGED PRODUCTS: ${products.map(p => p.name).join(", ")}
IMAGES: ${images.length}
${roomCoverageList}
PROJECT CONTEXT INSTRUCTIONS:
- The project description is the narrative frame — it captures who the client is, what prompted the project, and what they asked for. A family relocating, a couple's first home, a hospitality concept — this is the STORY. Use it to open and thread through the piece.
- If a studio/firm name is available, credit it naturally ("designed by [Name] of [Studio]") — not in every paragraph, but enough for attribution.
- Location should inform design vocabulary — reference local light, climate, landscape, or geography when relevant. Do NOT open with "Nestled in [location]..." or "Located in the heart of..." — these are cliché leads.
- Project type and client type shape the editorial angle (residential warmth differs from hospitality precision).
- Do NOT list these metadata fields literally or use the project description verbatim — synthesize into editorial narrative woven throughout the piece.

INTERVIEW ANSWERS:
${formattedAnswers || '(No interview answers available)'}
`;

  const prompt = `
You are Folio — an editorial design platform.
Write a refined, emotionally intelligent, Architectural Digest–style article
based on the following context.
The tone should be sophisticated, human, and flowing —
blending storytelling, material focus, and designer insight.
Avoid repeating raw Q&A. Instead, narrate the project's journey.

${FOLIO_TONE}

Include:
• A short headline and a 1–2 sentence intro ("dek")
• 3–5 narrative paragraphs organized by room, covering ALL rooms listed below
• A "Method" section describing process and design philosophy
• 2-4 pull quotes from the designer's own words, wrapped in quotation marks
• End with a "Materials" section summarizing key tagged materials.

ROOM COVERAGE: You MUST include editorial content for EVERY room that has interview answers. Rooms with more answers deserve proportionally more editorial space. If a room has no dedicated photos, weave its design story into the broader narrative. Do not skip any room.

PULL QUOTES: Include 2-4 direct quotes from the designer wrapped in quotation marks ("\u201C...\u201D"). Choose statements that:
- Are specific and opinionated ("We almost went with polished nickel but brass felt right for this house")
- Reveal process or philosophy ("I always tell clients the lighting plan is really a furniture plan")
- Mention a real material, product, or decision
- Sound like a human talking, not a press release
- Are 15-50 words
Do NOT use generic statements ("We wanted to create a warm and inviting space") or words like "harmonious," "curate," "elevate," "juxtaposition," or "seamlessly."

USING FOLLOW-UP CONTENT: Answers tagged [FOLLOW-UP] contain the richest material — process stories, client anecdotes, tradeoff explanations, and behind-the-scenes details. Surface these as:
- Embedded anecdotes ("The designer recalls visiting three showrooms before...")
- Attributed perspective ("For ${designer?.name || 'the designer'}, the turning point came when...")
- Specific process details that give the piece texture beyond physical description
Do NOT flatten follow-up answers into generic descriptive prose. The follow-ups are what make this editorial sound like a person wrote it, not an AI.

CONTEXT:
${contextText}
`;

  let blocks: z.infer<typeof BlocksSchema>;
  let usedFallback = false;

  if (!ANTHROPIC_ENABLED) {
    console.warn('[posting/generate] LLM disabled, using fallback blocks', {
      projectId: input.project?.id,
      _cid,
    });
    blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
    usedFallback = true;
  } else {
    const modelName = 'claude-sonnet-4-20250514';

    const llmResult = await callLLM(
      async () => {
        return await client.messages.create({
          model: modelName,
          temperature: 0.8,
          max_tokens: 3500,
          system: `You are Folio, the voice of modern design storytelling. ${FOLIO_TONE}`,
          messages: [
            { role: "user", content: prompt },
          ],
        });
      },
      { modelName, contextHint: `generate:${input.project?.id}`, baseDelayMs: 500 }
    );

    if (!llmResult.ok) {
      if (llmResult.code === 'moderation_block') {
        console.warn('[generate] moderation_block; using fallback', { _cid });
        usedFallback = true;
        blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
      } else {
        usedFallback = true;
        console.warn('[generate] llm_fail_using_fallback', {
          _cid,
          code: llmResult.code,
          status: llmResult.status,
          projectId: input.project?.id,
        });
        blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
      }
    } else {
      console.info('[generate] llm_ok', { _cid, model: llmResult.usedModel });
      const article = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : "";
      
      if (!article || article.trim().length === 0) {
        console.warn('[generate] empty_article; using fallback', { _cid });
        usedFallback = true;
        blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
      } else {
        // Parse narrative article into structured blocks
        try {
          blocks = parseNarrativeToBlocks(article, { ...input, answers: uniqueAnswers });
        } catch (parseError) {
          console.warn('[generate] parse_error; using fallback', { _cid, error: parseError });
          usedFallback = true;
          blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
        }
      }
    }
  }

  return { blocks, usedFallback };
}
