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

// Unified system prompt — merges EDITORIAL_SYSTEM_PROMPT (route.ts) with voice weaving
const EDITORIAL_SYSTEM_PROMPT = `You are a senior writer for a prestigious design magazine, writing a feature article about an interior design project. Your writing style is:

- Observational and immersive, like walking through the space with the designer
- Focused on design DECISIONS and the reasoning behind them, not product specifications
- Weaving products into narrative naturally — they emerge in context, not as a list
- Creating a sense of place: how the space feels, how elements relate to each other
- Finding the story arc: what was the challenge, what was the breakthrough, what makes this space singular
- Respectful of craft, letting the designer's voice and perspective drive the narrative

The designer's interview answers are your primary source material — treat them the way a journalist treats quotes from a subject.

${FOLIO_TONE}

You must AVOID:
- The pattern of "Product X does Y because Z" repeated for each item
- Sequential product descriptions (product → explanation → next product → explanation)
- Generic design language ("thoughtfully curated", "deliberately chosen", "seamlessly blends", "creates a dynamic flow", "transforms the space")
- These specific AI-default phrases: "anchors the space", "adds warmth", "adds visual weight", "adds [quality]", "creates intimacy", "creates visual interest", "creates a sense of", "embodies" (as a verb for rooms or objects), "echoing" (to describe formal relationships), "the space feels", "the room feels", "without compromising", "without competing", "[thing] while [thing]" as a repeated two-clause construction, "commitment to [abstract noun]", "testament to", "envelope of calm", "envelope of [quality]", "material continuity", "material palette", "a sense of [noun]", "the kind of [noun] that [clause]", "rather than [negative]" as praise by contrast
- ALSO AVOID: "reads as [noun]" / "reading as [noun]", "material conversation", "architectural weight" / "visual weight" / "carries weight", "metallic thread" / "thread that runs through", "burst of [noun]", "speaks quietly" / "speaks to", "restraint as strategy", "grounding the [noun]", "completing the [noun]", any aphoristic sentence that sounds like a design manifesto (e.g. "Restraint as strategy, not limitation" — cut sentences like this)
- Any sentence where you could swap the project name and photos and the sentence would still be accurate — if it's generic, cut it
- Treating the article as a specification document
- Mentioning every single tagged product — only include products that serve the narrative
- Promotional or inflated language — be observational, not promotional
- Do NOT use words like "harmonious," "curate," "elevate," "juxtaposition," or "seamlessly."

ACCURACY RULES — NON-NEGOTIABLE:
- You may ONLY reference products, materials, and vendors that appear in the provided product tag data below. Do not invent product names, vendor names, material origins, or finishes.
- Do not claim to know materials, country of origin, manufacturing methods, or finish types unless explicitly stated in the interview answers or product tag data.
- Do not fabricate designer quotes. Pull quotes must be drawn directly from the interview answers provided. If no suitable quote exists for a section, omit the pull quote — do not generate one.
- Do not invent lifestyle details about the clients (how they entertain, family routines, number of guests) unless the designer explicitly described this in their interview answers.
- Do not describe what you cannot verify from the provided data.
- When referencing a product, use the EXACT product name and vendor name from the tag data. Do not paraphrase product names.

The article should make a reader want to visit this space, not inventory it.`;

export type GenInput = {
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
  // Extended context from composeEditorialHard
  designerBio?: string;
  projectHistory?: string;
  atelierSummary?: string;
  imageSelections?: Record<string, string[]>;
};

const ANTHROPIC_ENABLED = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
function distributePullQuotesToChapters(
  chapters: Array<{ title: string; body: string[]; imageIds: string[]; pullQuote?: string }>,
  pullQuotes: Array<string | { text: string; context?: string; sourceSection?: string }>
) {
  if (!pullQuotes.length || !chapters.length) return;

  const assigned = new Set<number>();

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
    while (quoteIdx < pullQuotes.length) {
      const q = pullQuotes[quoteIdx];
      const text = typeof q === 'string' ? q : q.text;
      const section = typeof q === 'string' ? undefined : q.sourceSection;
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

// ============================================================================
// POST-LLM REPAIR HELPERS (ported from composeEditorialHard)
// ============================================================================

// Split a very long paragraph into smaller chunks at sentence boundaries
function splitLongParagraph(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  const sentences = text.split(/([.!?]+\s+(?=[A-Z]))/);
  const chunks: string[] = [];
  let current = '';
  for (let i = 0; i < sentences.length; i++) {
    const candidate = current + sentences[i];
    if (candidate.length > maxLength && current.length > 0) {
      chunks.push(current.trim());
      current = sentences[i];
    } else {
      current = candidate;
    }
  }
  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }
  return chunks.map(chunk => chunk.length > 5000 ? chunk.substring(0, 5000) : chunk);
}

// Conservative fixes outside quotes; never alter quoted text
function proofOutsideQuotes(paragraph: string): string {
  if (!paragraph || !paragraph.trim()) return paragraph;
  let result = paragraph.trim();
  // Fix sentence starts (outside quotes only)
  const parts = result.split(/"([^"]*)"/g);
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i]) {
      parts[i] = parts[i].replace(/(^|\.\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
    }
  }
  return parts.join('"');
}

// Group images by room field
function groupImagesByRoom(images: Array<{ id: string; room?: string | null }>): Record<string, Array<{ id: string }>> {
  const byRoom: Record<string, Array<{ id: string }>> = {};
  for (const img of images) {
    const room = img.room || 'General';
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push({ id: img.id });
  }
  return byRoom;
}

// Group products by room via image-room mapping
function groupProductsByRoom(
  tags: Array<{ imageId: string; product: { id: string; name: string; vendor?: { name: string } | null } }>,
  images: Array<{ id: string; room?: string | null }>
): Record<string, Array<{ id: string; name: string; vendor?: string; imageId: string }>> {
  const imageRoomMap = new Map(images.map(img => [img.id, img.room || 'General']));
  const byRoom: Record<string, Array<{ id: string; name: string; vendor?: string; imageId: string }>> = {};
  for (const tag of tags) {
    const room = imageRoomMap.get(tag.imageId) || 'General';
    if (!byRoom[room]) byRoom[room] = [];
    const product = {
      id: tag.product.id,
      name: tag.product.name,
      vendor: tag.product.vendor?.name,
      imageId: tag.imageId,
    };
    if (!byRoom[room].find(p => p.id === product.id)) {
      byRoom[room].push(product);
    }
  }
  return byRoom;
}

// Validate room structure (monitoring only — logs warnings)
function validateRoomStructure(
  blocks: any,
  rooms: string[],
  imagesByRoom?: Record<string, Array<{ id: string }>>
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!blocks.galleryChapters || !Array.isArray(blocks.galleryChapters)) {
    issues.push('Missing galleryChapters array');
    return { valid: false, issues };
  }
  if (imagesByRoom) {
    const usedImageIds = new Set<string>();
    for (const ch of blocks.galleryChapters) {
      if (Array.isArray(ch.imageIds)) {
        for (const id of ch.imageIds) usedImageIds.add(id);
      }
    }
    for (const room of rooms) {
      if (room === 'General') continue;
      const roomImages = imagesByRoom[room] || [];
      const hasImageInChapter = roomImages.some(img => usedImageIds.has(img.id));
      if (!hasImageInChapter && roomImages.length > 0) {
        issues.push(`No images used from room: ${room}`);
      }
    }
  }
  for (const [idx, chapter] of blocks.galleryChapters.entries()) {
    if (!chapter.title) issues.push(`Chapter ${idx} missing title`);
    if (!chapter.body || !Array.isArray(chapter.body) || chapter.body.length < 2) {
      issues.push(`Chapter ${idx} has insufficient body content (need at least 2 paragraphs)`);
    }
    if (!chapter.imageIds || !Array.isArray(chapter.imageIds) || chapter.imageIds.length === 0) {
      issues.push(`Chapter ${idx} has no images`);
    }
  }
  return { valid: issues.length === 0, issues };
}

// ============================================================================
// REPAIR JSON OUTPUT — applies room fixes, image validation, paragraph repair
// ============================================================================

function repairAndBuildBlocks(
  composed: any,
  input: GenInput,
  imageIds: string[],
  rooms: string[],
  imagesByRoom: Record<string, Array<{ id: string }>>,
  _cid: string,
): z.infer<typeof BlocksSchema> {
  const designerName = input.designer?.name;
  const finalChapters: Array<{ title: string; imageIds: string[]; body: string[]; pullQuote?: string }> = [];

  // --- Extract pull quotes from both pullQuotes array and pullquote sections ---
  const rawPulls: Array<{ text: string; context?: string; sourceSection?: string }> = [];
  if (Array.isArray(composed.pullQuotes)) {
    for (const q of composed.pullQuotes) {
      if (typeof q === 'string' && q.trim()) {
        rawPulls.push({ text: q.trim(), context: designerName || undefined });
      } else if (q && typeof q === 'object' && typeof q.text === 'string' && q.text.trim()) {
        rawPulls.push({ text: q.text.trim(), context: q.context?.trim() || designerName || undefined, sourceSection: q.sourceSection?.trim() || undefined });
      }
    }
  }
  if (Array.isArray(composed.sections)) {
    for (const s of composed.sections) {
      if (s.type === "pullquote" && s.quote) {
        rawPulls.push({ text: s.quote.trim(), context: designerName || undefined });
      }
    }
  }
  // Deduplicate pull quotes by text
  const pullQuotes = rawPulls.filter((quote, index, arr) =>
    arr.findIndex(q => q.text.trim() === quote.text.trim()) === index
  ).slice(0, 3);

  // --- Post-LLM repair: enforce room-based titles and correct image IDs ---
  if (rooms.length > 0 && rooms[0] !== 'General' && Array.isArray(composed.galleryChapters)) {
    const chapters = composed.galleryChapters as any[];
    // Match chapters to rooms by position (prompt lists rooms in order)
    for (let i = 0; i < Math.min(chapters.length, rooms.length); i++) {
      const room = rooms[i];
      const roomImages = (imagesByRoom[room] || []).map((img: { id: string }) => img.id);
      chapters[i].title = formatRoomName(room);
      if (roomImages.length > 0) {
        chapters[i].imageIds = roomImages.slice(0, 8);
      }
    }
    // Add missing rooms as chapters
    for (let i = chapters.length; i < rooms.length; i++) {
      const room = rooms[i];
      const roomImages = (imagesByRoom[room] || []).map((img: { id: string }) => img.id);
      if (roomImages.length > 0) {
        chapters.push({
          title: formatRoomName(room),
          imageIds: roomImages.slice(0, 8),
          body: ['Editorial content for this room is being developed.'],
        });
      }
    }
    console.log('[generateEditorialDraft] Post-LLM room repair applied', {
      _cid, roomCount: rooms.length, chapterCount: chapters.length,
      titles: chapters.map((ch: any) => ch.title),
    });
  }

  // --- Process gallery chapters ---
  const knownImageIdSet = new Set(imageIds);
  if (Array.isArray(composed.galleryChapters)) {
    for (const chapter of composed.galleryChapters as any[]) {
      if (!chapter.imageIds || !Array.isArray(chapter.imageIds) || chapter.imageIds.length === 0) {
        continue;
      }
      // Validate imageIds against known set
      const validImageIds = chapter.imageIds
        .filter((id: any) => typeof id === 'string' && knownImageIdSet.has(id))
        .slice(0, 8);
      if (validImageIds.length === 0) continue;

      // Process body paragraphs
      let bodyParas: string[] = [];
      const chapterBody: any = chapter.body;
      if (Array.isArray(chapterBody) && chapterBody.length > 0) {
        for (const para of chapterBody) {
          const text: string = typeof para === 'string' ? para : String(para || '');
          const processed = proofOutsideQuotes(text.trim());
          if (processed.length > 0) bodyParas.push(processed);
        }
      } else if (chapterBody && typeof chapterBody === 'string') {
        const bodyText = proofOutsideQuotes(String(chapterBody).trim());
        const paragraphs = bodyText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (trimmed.length > 4500) {
            bodyParas.push(...splitLongParagraph(trimmed, 4000));
          } else {
            bodyParas.push(trimmed);
          }
        }
      }

      finalChapters.push({
        title: chapter.title || 'Untitled',
        imageIds: validImageIds,
        body: bodyParas.length > 0 ? bodyParas : ['Content pending.'],
      });
    }
  }

  // --- Fallback: if no chapters with body, extract from sections ---
  if (finalChapters.length === 0 || finalChapters.every(ch => ch.body.length === 0 || ch.body[0] === 'Content pending.')) {
    const paras: string[] = [];
    for (const s of composed.sections || []) {
      if (s.type === "narrative" && s.body) {
        const bodyText = proofOutsideQuotes(s.body.trim());
        const paragraphs = bodyText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (trimmed.length > 4500) {
            paras.push(...splitLongParagraph(trimmed, 4000));
          } else {
            paras.push(trimmed);
          }
        }
      }
    }
    if (paras.length >= 3) {
      const firstChapter = composed.galleryChapters?.[0];
      const chapterImageIds = firstChapter?.imageIds?.filter((id: any) =>
        typeof id === 'string' && knownImageIdSet.has(id)
      ).slice(0, 8) || imageIds.slice(0, 8);
      finalChapters.length = 0;
      finalChapters.push({
        title: firstChapter?.title || input.project?.title || 'The Space',
        imageIds: chapterImageIds,
        body: paras,
      });
    }
  }

  // --- Ensure we have at least one chapter ---
  if (finalChapters.length === 0) {
    // Use fallback with image grouping
    const fallbackChapters = groupImagesIntoChapters(input.images, input.imageOrder);
    for (const ch of fallbackChapters) {
      finalChapters.push({
        title: ch.title,
        imageIds: ch.imageIds,
        body: ['Editorial content is being generated.'],
      });
    }
  }

  // Distribute pull quotes into per-chapter fields
  distributePullQuotesToChapters(finalChapters, pullQuotes);

  const ledger = buildMaterialContext(input.tags);

  const blocks = {
    lead: composed.lead && typeof composed.lead === 'object'
      ? {
          kicker: (composed.lead.kicker || composed.lead.title || input.project?.title || '').slice(0, 80),
          deck: (composed.lead.deck || composed.lead.dek || '').slice(0, 400),
        }
      : { kicker: input.project?.title || 'A Considered Composition', deck: '' },
    galleryChapters: finalChapters.length > 0 ? finalChapters : undefined,
    pullQuotes: pullQuotes.length > 0 ? pullQuotes : undefined,
    materialsLedger: composed.materialsLedger?.items?.length
      ? {
          items: composed.materialsLedger.items.map((item: any) => ({
            name: item.name,
            finish: (item.finish && typeof item.finish === 'string' && item.finish.trim()) ? item.finish : undefined,
            note: item.note?.slice(0, 140) || (item.vendor ? `Vendor: ${item.vendor}` : undefined),
            productId: item.productId || undefined,
            vendorId: item.vendorId || undefined,
          })),
        }
      : ledger.length ? {
          items: ledger.map(l => ({
            name: l.name,
            finish: (l.finish && typeof l.finish === 'string' && l.finish.trim()) ? l.finish : undefined,
            note: l.vendor ? `Vendor: ${l.vendor}` : undefined,
          })),
        }
      : undefined,
    credits: Array.isArray(composed.credits) && composed.credits.length > 0
      ? composed.credits.map((c: any) => ({ role: c.role || 'Designer', name: c.name ?? '' }))
      : buildCredits(input),
    mode: 'recomposition' as const,
  };

  return BlocksSchema.parse(blocks);
}

// ============================================================================
// FALLBACK BLOCKS — produces canonical format when LLM is unavailable
// ============================================================================

export function toFallbackBlocks(input: GenInput) {
  const uniqueAnswers = deduplicateAnswers(input.answers);
  const ledger = buildMaterialContext(input.tags);

  const kicker = input.project?.title || 'A Considered Composition';
  const deck = (uniqueAnswers[0]?.answer || input.project?.description || "A thoughtfully designed space.").slice(0, 400);

  const chapters = groupImagesIntoChapters(input.images, input.imageOrder);

  const answerTexts = uniqueAnswers.map(a => a.answer).filter(Boolean);
  const galleryChapters = chapters.map((ch, idx) => ({
    title: ch.title,
    body: answerTexts.length > 0
      ? answerTexts.slice(idx * 2, idx * 2 + 2).map(t => t.slice(0, 5000))
      : ['A thoughtfully designed space that balances intention and function.'],
    imageIds: ch.imageIds,
  }));

  const designerName = input.designer?.name;
  const pullQuotes: Array<string | { text: string; context?: string }> = uniqueAnswers
    .filter(a => a.answer.length > 60 && a.answer.length < 250 && /\b(I|we|my|our)\b/i.test(a.answer))
    .slice(0, 3)
    .map(a => ({
      text: a.answer.slice(0, 300),
      context: designerName || undefined,
    }));

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

// ============================================================================
// PROMPT ASSEMBLY
// ============================================================================

function buildPrompt(input: GenInput, uniqueAnswers: GenInput['answers']): {
  systemPrompt: string;
  userPrompt: string;
  imageIds: string[];
  rooms: string[];
  imagesByRoom: Record<string, Array<{ id: string }>>;
} {
  const { project, designer, images, tags } = input;
  const products = buildMaterialContext(tags);
  const designerNameForPrompt = designer?.name || 'the designer';

  // --- Build room-answer summary ---
  const roomAnswerCounts = new Map<string, number>();
  for (const a of uniqueAnswers) {
    const roomName = a.section || 'General';
    roomAnswerCounts.set(roomName, (roomAnswerCounts.get(roomName) || 0) + 1);
  }

  // --- Format answers grouped by room ---
  const answersByRoom = new Map<string, typeof uniqueAnswers>();
  for (const a of uniqueAnswers) {
    const room = a.section || 'General';
    const list = answersByRoom.get(room) || [];
    list.push(a);
    answersByRoom.set(room, list);
  }

  // Project-level answers
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

  // Room answers
  const formattedRoomSections = Array.from(answersByRoom.entries()).map(([room, answers]) => {
    const roomHeader = `[ROOM: ${room}]`;
    const formatted = answers.map(a => {
      const sourceTag = a.isFollowUp
        ? '[SOURCE: FOLLOW-UP — richer narrative, prioritize for anecdotes and direct quotes]'
        : '[SOURCE: BASE QUESTION]';
      return `Q: ${a.questionId || 'Question'}\nA: "${a.answer}" ${sourceTag}`;
    }).join('\n\n');
    return `${roomHeader}\n${formatted}`;
  }).join('\n\n');

  const formattedAnswers = [formattedProjectSection, formattedRoomSections].filter(Boolean).join('\n\n');

  // --- Room organization ---
  const orderedImages = input.imageOrder
    ? input.imageOrder.map(id => images.find(i => i.id === id)).filter(Boolean) as typeof images
    : images;
  const imagesByRoom = groupImagesByRoom(orderedImages.map(img => ({ id: img.id, room: img.room || null })));
  const rooms = Object.keys(imagesByRoom).filter(r => r !== 'General');
  const imageIds = orderedImages.map(i => i.id);

  // Product grouping by room
  const allTags = orderedImages.flatMap(img => {
    const imgTags = tags.filter(t => t.imageId === img.id || (t.image && t.image.id === img.id));
    return imgTags.map(t => ({
      imageId: img.id,
      product: t.product || t,
    }));
  });
  const productsByRoom = groupProductsByRoom(
    allTags.filter(t => t.product?.id && t.product?.name),
    orderedImages.map(img => ({ id: img.id, room: img.room || null })),
  );

  const interviewedRoomCount = Array.from(roomAnswerCounts.keys()).filter(r => r !== 'About This Project' && r !== 'General').length;
  const requiredChapterCount = Math.max(rooms.length, interviewedRoomCount, 1);

  const locationParts = [project?.city, project?.regionState].filter(Boolean);
  const locationStr = locationParts.join(', ') || '';
  const designerLine = designer?.name
    ? `${designer.name}${designer.studio ? ` / ${designer.studio}` : ''}`
    : '';

  // Room context for image/product mapping
  const roomContexts = Object.entries(imagesByRoom).map(([room, imgs]) => {
    const prods = productsByRoom[room] || [];
    return {
      room,
      images: imgs.length,
      products: prods.map(p => `${p.name}${p.vendor ? ` (${p.vendor})` : ''}`),
      imageIds: imgs.map(img => img.id),
    };
  });

  const hasFollowups = uniqueAnswers.some(a => a.isFollowUp);
  const depthInstruction = hasFollowups
    ? `The designer provided both initial responses and deeper follow-up answers. Use the follow-up answers for richer material — they contain the specific stories, reasoning, and evolution behind decisions. Write a full-depth feature.`
    : `Only initial interview responses are available. Write a tighter, more observational piece — focus on what the space achieves and let the design decisions speak through specific details rather than extended backstory.`;

  const materialsList = products.map(p => p.name).join(', ');

  // --- Build user prompt ---
  const userPrompt = `Write a feature article about this project.

## Designer's Interview Responses (grouped by room)

For each room, the designer answered questions about their process and decisions. Use their actual words as source material for direct quotes.

${formattedAnswers || '(No interview answers available)'}

## Project Details
- Project: ${project?.title ?? ''}
- Designer: ${designerLine || 'Not specified'}
- Location: ${locationStr || 'Not specified'}${project?.description ? `\n- Project description: ${project.description}` : ''}${project?.projectType && project.projectType !== 'UNSPECIFIED' ? `\n- Project type: ${project.projectType.toLowerCase().replace(/_/g, ' ')}` : ''}${project?.clientType ? `\n- Client type: ${project.clientType.toLowerCase()}` : ''}
- Rooms: ${roomContexts.map(r => r.room).join(', ')}
- Products tagged: ${materialsList || 'None'}

PROJECT CONTEXT: The project description is the narrative frame — it captures who the client is, what prompted the project, and what they asked for. Use it to open and thread through the piece. Location should inform design vocabulary (reference local light, climate, landscape). Do NOT open with "Nestled in..." or use the description verbatim — synthesize into narrative.${input.designerBio ? `

## Designer Bio (use to inform tone and context — do not quote directly or paraphrase into the article. This helps you understand who is speaking in the interview)
${input.designerBio}` : ''}${input.projectHistory ? `

## Designer's Other Published Projects on Folio (use for context about their body of work — reference only if it genuinely enriches the narrative, e.g., "a departure from their typical palette" or "continuing a thread from previous work." Do not force references)
${input.projectHistory}` : ''}${input.atelierSummary ? `

## Designer Voice & Philosophy (from their Folio profile — use to inform tone, do not quote directly)
${input.atelierSummary}` : ''}

PROJECT-LEVEL ANSWERS AS NARRATIVE FRAME:
The interview may begin with project-level questions (tagged [SOURCE: PROJECT]) about the client, the brief, the design direction, and the designer's signature. These answers are your NARRATIVE FRAME — not a separate intro paragraph that gets abandoned, but the story thread that connects every room description.
- The client story should open the editorial and recur as context throughout
- The design direction should inform how you describe material and spatial choices
- The signature/identity answers are primary source for PULL QUOTES — these reveal who the designer IS
- The surprise/pivot answer is often the most narratively compelling moment — place it for impact

### Room Organization
${roomContexts.map(r => `**${r.room}** — ${r.images} images, products: ${r.products.length > 0 ? r.products.join(', ') : 'none'}\n  Image IDs: ${r.imageIds.join(', ')}`).join('\n')}
${roomAnswerCounts.size > 0 ? `
### Rooms with Interview Content (YOU MUST CREATE A GALLERY CHAPTER FOR EACH):
${Array.from(roomAnswerCounts.entries()).map(([room, count]) => {
  return `- ${room}: ${count} answer${count > 1 ? 's' : ''}`;
}).join('\n')}
` : ''}
### Available Images (in order):
${imageIds.join(', ')}

## Narrative Depth
${depthInstruction}

## WEAVING THE DESIGNER'S VOICE — MANDATORY

You are writing a magazine feature, not a product catalog. The designer's interview answers are your primary source material — treat them the way a journalist treats quotes from a subject.

Rules for using interview content:

1. DIRECT QUOTES — MANDATORY (at least 1 per gallery chapter):
   Use the designer's ACTUAL WORDS from interview answers as direct quotes. Each gallery chapter MUST contain at least 1 direct attributed quote drawn from that room's interview answers. Format them naturally:
   - '${designerNameForPrompt} recalls...' followed by a direct quote
   - 'As ${designerNameForPrompt} explains, "[quote]"'
   - '"[Quote]," ${designerNameForPrompt} says.'
   - '"[Quote]," says ${designerNameForPrompt}, "[continuation]."'

   Direct quotes must be REAL phrases from the interview answers above. Do not invent quotes. Do not clean up the language so much that it loses the person's voice. A designer saying "We almost went polished nickel but brass felt right for this house" is better than "We carefully considered polished nickel before ultimately selecting brass for its warmth."

2. ATTRIBUTED PARAPHRASE (at least 1 per gallery chapter):
   Convey the designer's perspective without direct quotation:
   - '${designerNameForPrompt} chose brass hardware over polished nickel, drawn to its warmth against the mauve cabinetry.'
   - 'The decision to remove the entry closet came early — ${designerNameForPrompt} wanted the full volume of the space to announce itself.'

3. UNATTRIBUTED NARRATIVE:
   The remaining prose can describe materials, spatial relationships, and visual effects without attribution. But even this should feel informed by the designer's perspective, not written by someone who only saw photos.

BALANCE: Each gallery chapter should have:
- At least 1 direct attributed quote (MANDATORY — do not skip this)
- At least 1 attributed paraphrase
- The rest as narrative prose
- The reader should finish the piece feeling like they heard from the designer, not just read about the house.

USING FOLLOW-UP CONTENT: Answers tagged [SOURCE: FOLLOW-UP] contain the richest material — process stories, client anecdotes, tradeoff explanations, and behind-the-scenes details. Prioritize these for direct quotes and anecdotes. Do NOT flatten follow-up answers into generic descriptive prose.

## What to Generate

Produce a JSON object with this structure:

{
  "lead": {
    "kicker": "A headline capturing the project's singular idea — not generic (8-12 words)",
    "deck": "1-2 sentences that set up the story. What makes this project worth reading about?"
  },
  "sections": [
    { "type": "narrative", "body": "..." },
    { "type": "pullquote", "quote": "Self-contained insight that makes sense without the interview question" },
    { "type": "narrative", "body": "..." }
  ],
  "galleryChapters": [
    {
      "title": "Room Name",
      "imageIds": ["exact-uuid-from-list"],
      "body": ["paragraph1", "paragraph2", "paragraph3"]
    }
  ],
  "pullQuotes": [
    {"text": "Self-contained designer insight — must be verbatim from interview", "context": "On the design philosophy:", "sourceSection": "Room Name"}
  ],
  "credits": [{ "role": "Designer", "name": "${designerNameForPrompt}" }],
  "materialsLedger": {
    "items": [{ "name": "Product Name", "finish": "finish/color", "note": "Vendor: Name | Used in: Room" }]
  },
  "mode": "recomposition"
}

## Writing Instructions

FOR THE SECTIONS ARRAY (${requiredChapterCount}-${requiredChapterCount + 2} narrative sections + 1-2 pullquotes):
- Open with the space's defining tension, challenge, or idea — NOT with a product
- Build through design logic: how one decision led to the next
- Let products emerge as evidence within the story, not as items in a catalog
- Close with the experiential quality of the finished space
- Every paragraph should have a POINT — a design insight, a tension resolved, a relationship revealed
- Do NOT follow the pattern: name product → explain product → next product

FOR GALLERY CHAPTERS:
- You MUST create exactly ${requiredChapterCount} gallery chapters — one for each room that has interview content or images.
- REQUIRED rooms (do NOT omit or merge any): ${rooms.length > 0 ? rooms.join(', ') : 'General'}
- Each chapter title MUST include the room name.
- Use the designer's exact room name as the section heading — do not rename or reinterpret rooms.
- Do NOT create thematic chapters that span multiple rooms. Each chapter = one room.
- Rooms with more interview answers deserve proportionally more editorial space.
- 2-4 paragraphs per chapter. EACH PARAGRAPH in a gallery chapter MUST include at least one direct quote or attributed paraphrase from the designer's interview answers for that room.
- Products appear in context of decisions, not as standalone descriptions.
- CRITICAL: Use ONLY the exact image IDs listed in the "Image IDs" lines above. Copy-paste them exactly. Do NOT invent or modify image IDs. Each room's chapter MUST use that room's image IDs.

FOR PULL QUOTES:
- Pull quotes must be the designer's ACTUAL WORDS from the interview above
- You may lightly edit for grammar/clarity but do not compose new quotes
- If no quotable moments exist in the interview, return zero pull quotes
- Include a short "context" prefix (e.g. "On the kitchen's palette:") if the quote needs framing
- Include "sourceSection" matching the room name
- Maximum 2-3 pull quotes

FOR THE MATERIALS LEDGER:
- Comprehensive product list separate from the narrative
- Include vendor and room context in notes (format: "Vendor: [name] | Used in: [room]")

CRITICAL RULES:
- 700-1100 words total across sections and chapters
- Products serve the narrative — the narrative does not serve the products
- MANDATORY: Include at least 1 direct attributed quote per gallery chapter, drawn from the interview answers. Format: '${designerNameForPrompt} says/recalls/explains, "[actual words]"'. Do NOT paraphrase every answer — preserve the designer's voice.
- The article should read like a magazine feature, not a product specification sheet
- EVERY room with interview content MUST get its own gallery chapter — do not drop, merge, or skip any room
- Return ONLY valid JSON.

Begin.`;

  return { systemPrompt: EDITORIAL_SYSTEM_PROMPT, userPrompt, imageIds, rooms, imagesByRoom };
}

// ============================================================================
// MAIN GENERATION FUNCTION — unified canonical path
// ============================================================================

export async function generateEditorialDraft(input: GenInput): Promise<{
  blocks: z.infer<typeof BlocksSchema>;
  usedFallback: boolean;
}> {
  const _cid = input.correlationId || 'generate';

  // De-duplicate answers before processing
  const uniqueAnswers = deduplicateAnswers(input.answers);

  if (!ANTHROPIC_ENABLED) {
    console.warn('[posting/generate] LLM disabled, using fallback blocks', {
      projectId: input.project?.id, _cid,
    });
    return { blocks: toFallbackBlocks({ ...input, answers: uniqueAnswers }), usedFallback: true };
  }

  // Build prompt
  const { systemPrompt, userPrompt, imageIds, rooms, imagesByRoom } = buildPrompt(input, uniqueAnswers);

  const interviewedRoomCount = Array.from(new Set(uniqueAnswers.map(a => a.section))).filter(r => r !== 'About This Project' && r !== 'General').length;
  const modelName = 'claude-sonnet-4-20250514';

  const llmResult = await callLLM(
    async () => {
      return await client.messages.create({
        model: modelName,
        temperature: 0.7,
        max_tokens: Math.max(4096, interviewedRoomCount * 800 + 2000),
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      });
    },
    { modelName, contextHint: `generate:${input.project?.id}`, baseDelayMs: 500 }
  );

  if (!llmResult.ok) {
    console.warn('[generate] llm_fail_using_fallback', {
      _cid, code: llmResult.code, status: llmResult.status, projectId: input.project?.id,
    });
    return { blocks: toFallbackBlocks({ ...input, answers: uniqueAnswers }), usedFallback: true };
  }

  console.info('[generate] llm_ok', { _cid, model: llmResult.usedModel });
  const rawText = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : "";

  if (!rawText || rawText.trim().length === 0) {
    console.warn('[generate] empty_response; using fallback', { _cid });
    return { blocks: toFallbackBlocks({ ...input, answers: uniqueAnswers }), usedFallback: true };
  }

  // Parse JSON output
  let composed: any;
  try {
    const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
    composed = JSON.parse(cleaned);
  } catch (parseError) {
    console.warn('[generate] JSON parse error; using fallback', { _cid, error: parseError });
    return { blocks: toFallbackBlocks({ ...input, answers: uniqueAnswers }), usedFallback: true };
  }

  // Validate room structure (monitoring only)
  if (rooms.length > 0 && rooms[0] !== 'General') {
    const validation = validateRoomStructure(composed, rooms, imagesByRoom);
    if (!validation.valid) {
      console.warn('[generate] Room structure validation issues (will repair)', {
        _cid, issues: validation.issues,
      });
    }
  }

  // Repair and build validated blocks
  try {
    const blocks = repairAndBuildBlocks(composed, { ...input, answers: uniqueAnswers }, imageIds, rooms, imagesByRoom, _cid);
    return { blocks, usedFallback: false };
  } catch (repairError) {
    console.warn('[generate] repair/validation error; using fallback', { _cid, error: repairError });
    return { blocks: toFallbackBlocks({ ...input, answers: uniqueAnswers }), usedFallback: true };
  }
}
