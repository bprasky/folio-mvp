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
// Uses sourceSection matching when available, falls back to index-based distribution.
function distributePullQuotesToChapters(
  chapters: Array<{ title: string; body: string[]; imageIds: string[]; pullQuote?: string }>,
  pullQuotes: Array<string | { text: string; context?: string; sourceSection?: string }>
) {
  if (!pullQuotes.length || !chapters.length) return;

  const assigned = new Set<number>(); // chapter indices that got a pull quote

  // First pass: match by sourceSection
  for (const q of pullQuotes) {
    if (typeof q === 'string' || !q.sourceSection) continue;
    const matchIdx = chapters.findIndex(ch =>
      ch.title.toLowerCase() === q.sourceSection!.toLowerCase()
    );
    if (matchIdx >= 0 && !assigned.has(matchIdx)) {
      chapters[matchIdx].pullQuote = q.text;
      assigned.add(matchIdx);
    }
  }

  // Second pass: distribute remaining pull quotes to chapters without one
  let quoteIdx = 0;
  for (let i = 0; i < chapters.length && quoteIdx < pullQuotes.length; i++) {
    if (assigned.has(i)) continue;
    // Find next unassigned pull quote
    while (quoteIdx < pullQuotes.length) {
      const q = pullQuotes[quoteIdx];
      const text = typeof q === 'string' ? q : q.text;
      const section = typeof q === 'string' ? undefined : q.sourceSection;
      // Skip quotes already assigned by sourceSection match
      if (section && chapters.some(ch => ch.title.toLowerCase() === section.toLowerCase() && ch.pullQuote === text)) {
        quoteIdx++;
        continue;
      }
      chapters[i].pullQuote = text;
      assigned.add(i);
      quoteIdx++;
      break;
    }
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

  // Extract narrative paragraphs (skip headline/deck and PULL QUOTE markers)
  const startIdx = lines.indexOf(deckCandidate) + 1 || 2;
  const narrativeParagraphs = lines.slice(startIdx).filter(l => l.length > 50 && !/^PULL\s*QUOTE\s*:/i.test(l));

  // Extract pull quotes — three strategies in priority order
  const designerName = input.designer?.name;
  const pullQuotes: Array<string | { text: string; context?: string; sourceSection?: string }> = [];

  // Strategy 1: Parse explicit PULL QUOTE markers from the LLM output
  // Format: PULL QUOTE: "text" — designer [from: section name]
  const pullQuoteMarkerLines = lines.filter(l => /^PULL\s*QUOTE\s*:/i.test(l));
  for (const line of pullQuoteMarkerLines) {
    const textMatch = line.match(/["\u201C]([^"\u201D]{15,300})["\u201D]/);
    const sectionMatch = line.match(/\[from:\s*([^\]]+)\]/i);
    if (textMatch) {
      pullQuotes.push({
        text: textMatch[1].trim(),
        context: designerName || undefined,
        sourceSection: sectionMatch?.[1]?.trim() || undefined,
      });
    }
  }

  // Strategy 2: Extract quoted text from narrative paragraphs (direct quotes in the body)
  if (pullQuotes.length < 3) {
    for (const p of narrativeParagraphs) {
      if (pullQuoteMarkerLines.includes(p)) continue; // Skip marker lines
      const quoteMatches = p.match(/["\u201C]([^"\u201D]{20,250})["\u201D]/g);
      if (quoteMatches) {
        for (const match of quoteMatches) {
          const cleaned = match.replace(/["\u201C\u201D]/g, '').trim();
          if (cleaned.length >= 20 && cleaned.length <= 300) {
            // Don't add duplicates (already found via PULL QUOTE markers)
            if (!pullQuotes.some(q => typeof q !== 'string' && q.text === cleaned)) {
              pullQuotes.push({ text: cleaned, context: designerName || undefined });
            }
          }
        }
      }
      if (pullQuotes.length >= 4) break;
    }
  }

  // Strategy 3: Fallback — extract from interview answers if still not enough
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

  // Infer sourceSection for pull quotes that don't have one by matching body text
  for (const pq of pullQuotes) {
    if (typeof pq === 'string' || pq.sourceSection) continue;
    const quoteText = pq.text.toLowerCase();
    for (const ch of galleryChapters) {
      const bodyText = (ch.body || []).join(' ').toLowerCase();
      if (bodyText.includes(quoteText.slice(0, 40))) {
        pq.sourceSection = ch.title;
        break;
      }
    }
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

  // Format answers grouped by room, wrapped in quotation marks to reinforce spoken words
  const designerNameForPrompt = designer?.name || 'the designer';
  const answersByRoom = new Map<string, typeof uniqueAnswers>();
  for (const a of uniqueAnswers) {
    const room = a.section || 'General';
    const list = answersByRoom.get(room) || [];
    list.push(a);
    answersByRoom.set(room, list);
  }
  // Format project-level answers first (if any), then room answers
  const projectAnswers = answersByRoom.get('About This Project');
  let formattedProjectSection = '';
  if (projectAnswers && projectAnswers.length > 0) {
    answersByRoom.delete('About This Project');
    const formatted = projectAnswers.map(a => {
      const sourceTag = a.isFollowUp
        ? '[SOURCE: PROJECT FOLLOW-UP — highest-value content for pull quotes and editorial framing]'
        : '[SOURCE: PROJECT — narrative frame material]';
      return `Q: ${a.questionId || 'Question'}\nA: "${a.answer}" ${sourceTag}`;
    }).join('\n\n');
    formattedProjectSection = `=== ABOUT THIS PROJECT ===\n${formatted}`;
  }

  // Build room name → type lookup for prompt context
  const roomNameToType = new Map<string, string>();
  for (const r of input.rooms || []) {
    if (r.type) roomNameToType.set(r.name, r.type);
  }

  const formattedRoomSections = Array.from(answersByRoom.entries()).map(([room, answers]) => {
    const roomType = roomNameToType.get(room);
    const roomHeader = roomType ? `[ROOM: ${room} (type: ${roomType})]` : `[ROOM: ${room}]`;
    const formatted = answers.map(a => {
      const sourceTag = a.isFollowUp
        ? '[SOURCE: FOLLOW-UP — richer narrative, prioritize for anecdotes and direct quotes]'
        : '[SOURCE: BASE QUESTION]';
      return `Q: ${a.questionId || 'Question'}\nA: "${a.answer}" ${sourceTag}`;
    }).join('\n\n');
    return `${roomHeader}\n${formatted}`;
  }).join('\n\n');

  const formattedAnswers = [formattedProjectSection, formattedRoomSections].filter(Boolean).join('\n\n');

  // Count rooms with interview content (excluding project-level)
  const interviewedRoomCount = Array.from(roomAnswerCounts.keys()).filter(r => r !== 'About This Project' && r !== 'General').length;

  const roomCoverageList = roomAnswerCounts.size > 0
    ? `\nROOMS WITH INTERVIEW CONTENT (YOU MUST CREATE A SECTION FOR EACH — DO NOT OMIT OR MERGE ANY):\n${Array.from(roomAnswerCounts.entries()).map(([room, count]) => {
        const roomType = roomNameToType.get(room);
        return `- ${room}${roomType ? ` (type: ${roomType})` : ''}: ${count} answer${count > 1 ? 's' : ''}`;
      }).join('\n')}\n`
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

DESIGNER INTERVIEW — ${designerNameForPrompt}

For each room, the designer answered questions about their process and decisions. Use their actual words as source material for direct quotes.

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
• Exactly ${interviewedRoomCount || 3} narrative sections — one per room with interview content. Do NOT merge rooms into a single section or drop any room.
• A "Method" section describing process and design philosophy
• End with a "Materials" section summarizing key tagged materials.

ROOM COVERAGE: You MUST include editorial content for EVERY room that has interview answers. Each room gets its own section. Rooms with more answers deserve proportionally more editorial space. If a room has no dedicated photos, weave its design story into the broader narrative. Do not skip any room. Do not merge rooms. Use the room type labels (e.g., KITCHEN, BAR, BATH) to correctly identify each space — do NOT guess room types from photos.

WEAVING THE DESIGNER'S VOICE:

You are writing a magazine feature, not a product catalog. The designer's interview answers are your primary source material — treat them the way a journalist treats quotes from a subject.

Rules for using interview content:

1. DIRECT QUOTES: Use the designer's actual words from interview answers as direct quotes 2-4 times in the full piece. These should be the most vivid, specific, or opinionated moments. Format them naturally:
   - '${designerNameForPrompt} recalls...' followed by a direct quote
   - 'As ${designerNameForPrompt} explains, "[quote]"'
   - '"[Quote]," ${designerNameForPrompt} says.'
   - '"[Quote]," says ${designerNameForPrompt}, "[continuation]."'

   Direct quotes must be REAL phrases from the interview answers. Do not invent quotes. Do not clean up the language so much that it loses the person's voice. A designer saying "We almost went polished nickel but brass felt right for this house" is better than "We carefully considered polished nickel before ultimately selecting brass for its warmth."

2. ATTRIBUTED PARAPHRASE: Use 3-5 times. Convey the designer's perspective without direct quotation:
   - '${designerNameForPrompt} chose brass hardware over polished nickel, drawn to its warmth against the mauve cabinetry.'
   - 'The decision to remove the entry closet came early — ${designerNameForPrompt} wanted the full volume of the space to announce itself.'

3. UNATTRIBUTED NARRATIVE: The remaining prose can describe materials, spatial relationships, and visual effects without attribution. But even this should feel informed by the designer's perspective, not written by someone who only saw photos.

BALANCE: A typical 4-section editorial should have:
- 2-4 direct quotes (not all in one section — distribute them)
- 3-5 attributed paraphrases
- The rest as narrative prose

The reader should finish the piece feeling like they heard from the designer, not just read about the house.

USING FOLLOW-UP CONTENT: Answers tagged [SOURCE: FOLLOW-UP] contain the richest material — process stories, client anecdotes, tradeoff explanations, and behind-the-scenes details. Prioritize these for direct quotes and anecdotes. Do NOT flatten follow-up answers into generic descriptive prose.

PULL QUOTES:

After writing the full editorial, select 2-3 pull quotes. These MUST be extracted from direct quotes you already used in the body text — not generated separately. A pull quote is a highlight of something already in the piece, pulled out for visual emphasis.

Good pull quotes are:
- ALREADY IN THE BODY TEXT as a direct quote from the designer
- Specific to this project (mention a material, a room, a decision, a moment)
- 15-40 words — long enough to have substance, short enough to read at a glance
- Something that makes a reader want to read the full piece

Bad pull quotes (DO NOT generate):
- Generic wisdom that could apply to any project ("Every detail matters")
- Pithy one-liners the designer never actually said
- Descriptions of the space rather than the designer's perspective on it
- Anything the designer didn't say in the interview

Format each pull quote on its own line, clearly marked:
PULL QUOTE: "[exact text from the body]" — ${designerNameForPrompt} [from: section name]

CRITICAL: If you cannot find 2 genuinely good pull quotes from the interview material, output 1 or even 0. Do not fabricate quotes to fill a quota.

Do NOT use words like "harmonious," "curate," "elevate," "juxtaposition," or "seamlessly."

PROJECT NARRATIVE: ${project?.description ? `The project description captures the client's story — who they are, what prompted this project, and what they asked for. Weave this narrative throughout the piece, not just in the opener. The reader should understand the people behind the project.` : 'If context clues suggest a client story (relocation, renovation motivation, lifestyle needs), weave it naturally through the narrative.'}

PROJECT-LEVEL ANSWERS AS NARRATIVE FRAME:
The interview may begin with project-level questions (tagged [SOURCE: PROJECT]) about the client, the brief, the design direction, and the designer's signature. These answers are your NARRATIVE FRAME — not a separate intro paragraph that gets abandoned, but the story thread that connects every room description.

- The client story should open the editorial and recur as context throughout
- The design direction should inform how you describe material and spatial choices
- The signature/identity answers are primary source for PULL QUOTES — these reveal who the designer IS
- The surprise/pivot answer is often the most narratively compelling moment — place it for impact

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
          max_tokens: Math.max(3500, interviewedRoomCount * 800 + 1500), // Scale with room count: ~800 tokens per room + overhead
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
