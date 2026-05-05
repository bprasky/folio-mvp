import Anthropic from "@anthropic-ai/sdk";
import { BlocksSchema, syncPullQuotesFromChapters } from "./schemas";
import type { PullQuoteSelection, PullQuoteAlternative } from "./schemas";
import { z } from "zod";
import { callLLM } from "./llmClient";
import { formatRoomName } from "@/lib/utils/formatRoomName";
import { HOOK_OPENER_ID_PREFIX, HOOK_FOLLOWUP_ID_PREFIX } from "@/lib/interview/generateQuestions";

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
- Do not fabricate designer quotes. Direct quotes in the body text must come from the interview answers provided.
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
    questionText?: string;
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

// Score a pull quote candidate using heuristics.
// Exported so adjacent modules (the interview respond route's hook-opener
// gate) can reuse the same signals without duplicating the scoring table.
export function scorePullQuote(text: string): number {
  let score = 0;
  const words = text.split(/\s+/).length;

  // Length scoring — 10-40 words is ideal
  if (words >= 10 && words <= 40) score += 2;
  else if ((words >= 5 && words < 10) || (words > 40 && words <= 60)) score += 1;

  // First-person declarative (identity-revealing) — strongest signal
  if (/\b(I wanted|I always|my thing|we never|I'm obsessed|I love|I knew|I didn't want|we wanted|I felt|I|we|my|our)\b/i.test(text)) score += 3;

  // Metaphor/analogy — magazine-ready imagery
  if (/\b(like a|feels like|as if|reminds me of|felt like|feels?|felt|warmth|light|rhythm|flow|breath|touch|soul|tension|energy|mood|quiet|soft)\b/i.test(text)) score += 2;

  // Specific material detail
  if (/\b(brass|oak|marble|linen|walnut|concrete|steel|ceramic|tile|stone|leather|velvet|copper|plaster|terrazzo|travertine|limestone|porcelain)\b/i.test(text)) score += 1;
  if (/\b(white|black|gray|grey|blue|green|mauve|warm|cool)\b/i.test(text)) score += 1;

  // Penalize purely process/factual
  if (/\b(process|step|phase|stage|method|procedure|we ordered|it arrived|the contractor|we went with|was delivered|we installed)\b/i.test(text)) score -= 1;

  return score;
}

// Minimum score a quote must clear to qualify as a narrative "hook" for the lead chapter.
// Matches at least one strong signal from scorePullQuote (first-person voice: +3, or metaphor: +2 with length bonus).
const LEAD_CHAPTER_HOOK_MIN_SCORE = 3;

// Extract and score pull quotes from a single chapter's body paragraphs
// Uses attribution-verb patterns for higher-quality extraction.
//
// Selection rule:
//   - isLeadChapter=true: walk paragraphs in order and return the first paragraph's
//     top-scored quote that clears LEAD_CHAPTER_HOOK_MIN_SCORE. This keeps the
//     article's lead pull quote tied to the narrative opening instead of a higher-
//     scored product detail buried mid-chapter. Falls back to overall highest-
//     scored quote if nothing qualifies.
//   - otherwise: overall highest-scored quote across the whole chapter (original behavior).
export function extractPullQuotesForChapter(
  body: string[],
  designerName?: string,
  opts?: { isLeadChapter?: boolean }
): PullQuoteSelection | null {
  type ParagraphQuote = PullQuoteAlternative & { paragraphIndex: number };
  const quotesByParagraph: ParagraphQuote[][] = [];
  const seen = new Set<string>();

  // Attribution verbs to look for near quotes
  const attrVerbs = 'says|explains|recalls|notes|adds|describes|continues|laughs|remembers|admits';
  // Patterns: "quote," designer says  OR  designer says, "quote"
  const quoteAfterAttr = new RegExp(
    `(?:${attrVerbs})\\s*[,:]?\\s*["\u201C]([^"\u201D]{20,300})["\u201D]`,
    'gi'
  );
  const quoteBeforeAttr = new RegExp(
    `["\u201C]([^"\u201D]{20,300})["\u201D]\\s*,?\\s*(?:${designerName ? designerName.split(/\\s+/).pop() + '\\s+' : ''})?(?:${attrVerbs})`,
    'gi'
  );
  // Fallback: any direct quote in quotation marks
  const anyQuote = /["\u201C]([^"\u201D]{20,250})["\u201D]/g;

  for (let pIdx = 0; pIdx < body.length; pIdx++) {
    const paragraph = body[pIdx];
    const perParagraph: ParagraphQuote[] = [];

    // First try: attributed quotes (higher quality)
    for (const pattern of [quoteBeforeAttr, quoteAfterAttr]) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(paragraph)) !== null) {
        const cleaned = match[1].trim();
        if (cleaned.length < 20 || cleaned.length > 300) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const score = scorePullQuote(cleaned) + 1; // +1 bonus for attribution
        if (score >= 1) {
          perParagraph.push({
            text: cleaned,
            context: designerName || undefined,
            score,
            paragraphIndex: pIdx,
          });
        }
      }
    }

    // Fallback: any quoted text
    anyQuote.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = anyQuote.exec(paragraph)) !== null) {
      const cleaned = match[1].trim();
      if (cleaned.length < 20 || cleaned.length > 300) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const score = scorePullQuote(cleaned);
      if (score >= 1) {
        perParagraph.push({
          text: cleaned,
          context: designerName || undefined,
          score,
          paragraphIndex: pIdx,
        });
      }
    }

    quotesByParagraph.push(perParagraph);
  }

  const allQuotes: ParagraphQuote[] = quotesByParagraph.flat();
  if (allQuotes.length === 0) return null;

  // Alternatives: all quotes, sorted by score desc (unchanged contract).
  const alternatives: PullQuoteAlternative[] = [...allQuotes]
    .sort((a, b) => b.score - a.score)
    .map(({ text, context, score }) => ({ text, context, score }));

  // Selection
  let selected: ParagraphQuote | undefined;

  if (opts?.isLeadChapter) {
    // Walk paragraphs in narrative order; take the first paragraph whose best quote
    // clears the hook threshold. This keeps the article's opening pull quote
    // anchored to the article's opening, not a mid-chapter product detail.
    for (const pq of quotesByParagraph) {
      if (pq.length === 0) continue;
      const top = pq.reduce((a, b) => (b.score > a.score ? b : a));
      if (top.score >= LEAD_CHAPTER_HOOK_MIN_SCORE) {
        selected = top;
        break;
      }
    }
  }

  // Default / fallback: overall highest-scored quote
  if (!selected) {
    selected = allQuotes.reduce((a, b) => (b.score > a.score ? b : a));
  }

  return {
    selected: { text: selected.text, context: selected.context },
    alternatives,
  };
}

// ============================================================================
// HOOK QUOTE SPLICE
// ============================================================================

/**
 * Reject lead-quote candidates that read as piece/material description rather
 * than a project-level conviction. The lead pull quote sits above the article
 * and must capture the project as a whole — never a single sofa, faucet, or
 * fabric. Deterministic regex check, no LLM call.
 */
const PIECE_NOUNS = /\b(sofa|chair|table|pendant|lamp|sconce|cushion|ottoman|daybed|console|dresser|desk|bed|vanity|armchair|bench|stool|mirror|rug|tile|countertop|cabinetry|millwork|hardware|faucet|fixture)\b/i;
const PIECE_DESCRIPTORS = /\b(profile|upholstery|finish|fabric|wrapped|tufted|grain|veneer|patina|hardware)\b/i;
const PROJECT_CONVICTION = /\b(wanted|needed|hoped|believed|kept coming back|the brief|the project|the house|the home|the clients?|the idea|we started|what we were chasing|feel like|felt like|live with|lives with|against it)\b/i;

export function isArticleHookQuote(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const hasConviction = PROJECT_CONVICTION.test(text);
  if (PIECE_NOUNS.test(text) && !hasConviction) return false;
  if (PIECE_DESCRIPTORS.test(text) && !hasConviction) return false;
  return true;
}

/**
 * Extract a lead-quote candidate from the article's introduction paragraphs
 * (the dedicated opening narrative, distinct from galleryChapters[0] which
 * is the first room). Walks scored candidates from highest to lowest and
 * returns the first that passes `isArticleHookQuote` — we never accept a
 * piece-specific line as the lead, even if it scored highest.
 *
 * Deterministic, no LLM call. Used as:
 *   - A fallback for new drafts when spliceHookQuote returns null/rejected.
 *   - A retrofit for existing posts via the admin re-extract route.
 */
export function extractHookQuoteFromIntroduction(
  introduction: string[] | undefined,
  designerName?: string
): { text: string; context?: string } | null {
  if (!Array.isArray(introduction) || introduction.length === 0) return null;
  const selection = extractPullQuotesForChapter(introduction, designerName);
  const ranked = [
    selection?.selected,
    ...(selection?.alternatives ?? []),
  ].filter((q): q is { text: string; context?: string } => !!q?.text);
  for (const cand of ranked) {
    if (isArticleHookQuote(cand.text)) {
      return { text: cand.text, context: designerName || undefined };
    }
  }
  return null;
}

/**
 * Produce the article's lead pull quote by splicing the designer's hook-opener
 * answer (and its adaptive follow-up, if any) into a single magazine-ready line.
 *
 * Why splice: the hook opener invites a conviction, the follow-up deepens it
 * into emotion. Neither answer is usually publication-ready on its own — the
 * splice compresses the two while preserving the designer's actual phrasing.
 *
 * Contract:
 *  - Returns null when Anthropic is unavailable, no hook answer is present,
 *    or the model refuses to produce a confident hook. Callers must fall
 *    back to chapter-level lead-quote extraction.
 *  - The returned quote is ≤ 220 chars (well under the 300 schema cap).
 *  - The prompt forbids invented phrasing, adding metaphor the designer did
 *    not use, and referencing rooms/products/vendors/process — everything
 *    that makes a lead quote drift away from the narrative hook.
 */
async function spliceHookQuote(
  answers: GenInput['answers'],
  designerName?: string
): Promise<{ text: string; context?: string } | null> {
  if (!ANTHROPIC_ENABLED) return null;

  const hookAnswer = answers.find(
    (a) => typeof a.questionId === 'string' && a.questionId.startsWith(HOOK_OPENER_ID_PREFIX) && a.answer?.trim()
  );
  if (!hookAnswer) return null;

  const hookFollowUp = answers.find(
    (a) => typeof a.questionId === 'string' && a.questionId.startsWith(HOOK_FOLLOWUP_ID_PREFIX) && a.answer?.trim()
  );

  const sourceLines = [
    `HOOK ANSWER: ${hookAnswer.answer.trim()}`,
    hookFollowUp ? `FOLLOW-UP ANSWER: ${hookFollowUp.answer.trim()}` : null,
  ].filter(Boolean).join('\n\n');

  const system = `You are editing a direct quote for the opening pull quote of a magazine feature on an interior design project.

You are given one or two raw interview answers from the designer. Produce a single short, magazine-ready quote that will headline the article.

Strict rules:
- Maximum 30 words. Shorter is better.
- Use the designer's actual phrasing. You may trim, elide ("…"), or splice across the two answers, but do NOT invent words, add metaphor, or introduce imagery the designer did not use.
- Do NOT mention specific rooms, products, brands, vendors, colors, materials, or process steps. The lead quote is about the project's core idea or feeling, not its details.
- If the answers describe a single piece of furniture, fixture, or material (e.g. a sofa's profile, a faucet's finish, a fabric's texture) rather than the project's overall idea or feeling, return quote: null. The hook MUST be about the project as a whole, not about a specific piece.
- Prefer first-person voice and emotion over description.
- If neither answer contains a usable hook-quality thread, return quote: null rather than force one.

Return JSON only: {"quote": "..."} or {"quote": null}. Do not wrap the quote in quotation marks.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      system,
      messages: [
        { role: 'user', content: sourceLines },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { quote?: string | null };

    if (!parsed.quote || typeof parsed.quote !== 'string') return null;
    const text = parsed.quote.trim().replace(/^["\u201C]|["\u201D]$/g, '').trim();
    if (!text || text.length < 10 || text.length > 220) return null;

    return { text, context: designerName || undefined };
  } catch (error) {
    console.warn('[spliceHookQuote] non-fatal error, falling back to extraction:', error);
    return null;
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

async function repairAndBuildBlocks(
  composed: any,
  input: GenInput,
  imageIds: string[],
  rooms: string[],
  imagesByRoom: Record<string, Array<{ id: string }>>,
  _cid: string,
): z.infer<typeof BlocksSchema> {
  const designerName = input.designer?.name;
  const finalChapters: Array<{ title: string; imageIds: string[]; body: string[] }> = [];

  // Pull quotes are now extracted mechanically from body text AFTER chapters are built (see below)

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

  // Extract pull quotes PER CHAPTER from each chapter's own body text
  // A dining room pull quote stays in the dining room.
  // Chapter 0 is the article's lead — use hook-aware selection so the top-of-post
  // pull quote reflects the narrative opening instead of a mid-chapter detail.
  const finalChaptersWithQuotes = finalChapters.map((ch, idx) => ({
    ...ch,
    pullQuote: extractPullQuotesForChapter(ch.body, designerName, { isLeadChapter: idx === 0 }),
  }));

  const ledger = buildMaterialContext(input.tags);

  const blocks = {
    lead: composed.lead && typeof composed.lead === 'object'
      ? {
          kicker: (composed.lead.kicker || composed.lead.title || input.project?.title || '').slice(0, 120),
          deck: (composed.lead.deck || composed.lead.dek || '').slice(0, 400),
        }
      : { kicker: input.project?.title || 'A Considered Composition', deck: '' },
    introduction: Array.isArray(composed.introduction) && composed.introduction.length > 0
      ? composed.introduction
          .filter((p: any) => typeof p === 'string' && p.trim())
          .map((p: string) => proofOutsideQuotes(p.trim()).slice(0, 2000))
          .slice(0, 4)
      : undefined,
    galleryChapters: finalChaptersWithQuotes.length > 0 ? finalChaptersWithQuotes : undefined,
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

  // Lead pull quote preference (must always be project-level, never piece-specific):
  //  1. Spliced hook-opener + follow-up (richest; requires hook flow answers)
  //     — rejected if it reads as piece/material description.
  //  2. Highest-scored article-level quote from the introduction paragraphs.
  //  No chapter-quote fallback: an empty hookQuote is preferable to a piece-specific lead.
  const splicedQuote = await spliceHookQuote(input.answers, designerName);
  const validatedSplice = splicedQuote && isArticleHookQuote(splicedQuote.text) ? splicedQuote : null;
  const hookQuote =
    validatedSplice ??
    extractHookQuoteFromIntroduction(blocks.introduction, designerName);
  if (hookQuote) {
    (blocks as Record<string, any>).hookQuote = hookQuote;
  }

  // Sync top-level pullQuotes from per-chapter selections (for layout engine)
  syncPullQuotesFromChapters(blocks as Record<string, any>);

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
  const rawDesignerName = designer?.name;
  const designerNameForPrompt = rawDesignerName
    ? rawDesignerName.replace(/\b[a-z]/g, c => c.toUpperCase())
    : 'the designer';

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
      return `Q: ${a.questionText || a.questionId || 'Question'}\nA: "${a.answer}" ${sourceTag}`;
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
      return `Q: ${a.questionText || a.questionId || 'Question'}\nA: "${a.answer}" ${sourceTag}`;
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

  // Structural variation: assign varied paragraph counts per room
  const paraDistributions = [
    [3, 2, 4, 2, 3],
    [2, 3, 3, 4, 2],
    [4, 2, 3, 2, 3],
    [2, 4, 2, 3, 3],
    [3, 3, 2, 4, 2],
  ];
  const chosenDist = paraDistributions[Math.floor(Math.random() * paraDistributions.length)];
  const roomNames = rooms.length > 0 ? rooms : ['General'];
  const paragraphCountsPerRoom = roomNames.map((room, i) => ({
    room: formatRoomName(room),
    count: chosenDist[i % chosenDist.length],
  }));
  const paragraphCountInstruction = paragraphCountsPerRoom
    .map(r => `- ${r.room}: ${r.count} paragraphs`)
    .join('\n');

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

PROJECT-LEVEL ANSWERS — USE IN TWO WAYS:
The interview may begin with project-level questions (tagged [SOURCE: PROJECT]) about the client, the brief, the design direction, and the designer's signature.
1. OPENING SECTION (the "introduction" array): Use these answers as the PRIMARY source for the 2-3 paragraph introduction that establishes the project before room sections begin. This is where the client story, scope, and design thesis live.
2. NARRATIVE THREADING: Also reference this context within room sections where relevant — but the primary home for this material is the introduction. The client story should recur in at least 2 room sections, not just the intro.
- The design direction should inform how you describe material and spatial choices in room sections
- The signature/identity answers are primary source for PULL QUOTES — these reveal who the designer IS
- The surprise/pivot answer is often the most narratively compelling moment — place it for impact

NARRATIVE THREADING: The headline and subtitle establish a narrative promise. The body must deliver on it. If the headline mentions a family, the family should appear in the body — not just as "the clients" but as people with context (where they came from, what they wanted, how they live in the space now). If the headline mentions breaking rules or defying expectations, at least 2 sections should explicitly connect a design choice to that tension.
Specifically:
- The client's story should appear in at least 2 body sections, not just the headline/subtitle
- Reference the project-level interview answers (client brief, design direction) within room descriptions where relevant
- Put the family IN the house — show how they use the space, their reactions, their life in it
- Avoid generic references to "the clients" when you have specific context (young family, relocated from Chicago, wanted warmth over beach aesthetic)

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
    "kicker": "A headline capturing the project's singular idea — not generic (8-15 words)",
    "deck": "1-2 sentences that set up the story. What makes this project worth reading about?"
  },
  "introduction": [
    "Opening paragraph — who the clients are, what brought them to this project, and the setting/location.",
    "Second paragraph — the design thesis: the one big idea that shaped every decision. Name the designer naturally.",
    "Optional third paragraph — a teaser of the surprise, the signature move, or a tension the rooms will resolve."
  ],
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
  "credits": [{ "role": "Designer", "name": "${designerNameForPrompt}" }],
  "materialsLedger": {
    "items": [{ "name": "Product Name", "finish": "finish/color", "note": "Vendor: Name | Used in: Room" }]
  },
  "mode": "recomposition"
}

## Writing Instructions

FOR THE INTRODUCTION ARRAY (2-3 paragraphs, written BEFORE gallery chapters):
Using the project-level interview answers, write 2-3 paragraphs that establish:
1. The clients and what brought them to this project (from CLIENT_BRIEF or similar answers)
2. The scope — what kind of project this is, the location, the timeframe (from SCOPE_PARAMETERS)
3. The design direction — the one-line thesis for the whole house (from DESIGN_DIRECTION)
This opening should:
- Name the designer naturally (first and last name on first mention)
- Reference the location if known
- Set up a tension or promise that the room sections will deliver on
- NOT describe any specific room — save that for the gallery chapters
- NOT repeat the headline or subtitle — build on them
Tone: magazine feature opening. A reader should want to keep scrolling after these paragraphs.

FOR THE SECTIONS ARRAY (${requiredChapterCount}-${requiredChapterCount + 2} narrative sections + 1-2 pullquotes):
- Open with the space's defining tension, challenge, or idea — NOT with a product
- Build through design logic: how one decision led to the next
- Let products emerge as evidence within the story, not as items in a catalog
- Close with the experiential quality of the finished space
- Every paragraph should have a POINT — a design insight, a tension resolved, a relationship revealed
- Do NOT follow the pattern: name product → explain product → next product

SENTENCE OPENINGS — CRITICAL FOR NATURAL PROSE:
Never start more than 2 paragraphs in the entire article with "The [noun]..." Vary your openings:
- Lead with a direct quote: '"We had to have both crews on site the same day," ${designerNameForPrompt} explains.'
- Lead with action: '${designerNameForPrompt} sourced the marble from a local yard.'
- Lead with a prepositional phrase: 'Above the island, three black pendants hover...'
- Lead with a dependent clause: 'When the original slab cracked, the replacement turned out better.'
- Lead with a spatial or temporal marker: 'At the far end of the open plan, the bar operates on different rules.'
Each section should use at least 2 different opening structures across its paragraphs. If you notice yourself starting consecutive paragraphs with "The," rewrite one of them.

FOR GALLERY CHAPTERS:
- You MUST create exactly ${requiredChapterCount} gallery chapters — one for each room that has interview content or images.
- REQUIRED rooms (do NOT omit or merge any): ${rooms.length > 0 ? rooms.join(', ') : 'General'}
- Each chapter title MUST include the room name.
- Use the designer's exact room name as the section heading — do not rename or reinterpret rooms.
- Do NOT create thematic chapters that span multiple rooms. Each chapter = one room.
- EACH PARAGRAPH in a gallery chapter MUST include at least one direct quote or attributed paraphrase from the designer's interview answers for that room.

PARAGRAPH COUNTS PER ROOM (follow these exactly — this creates structural variation):
${paragraphCountInstruction}
- Products appear in context of decisions, not as standalone descriptions.
- CRITICAL: Use ONLY the exact image IDs listed in the "Image IDs" lines above. Copy-paste them exactly. Do NOT invent or modify image IDs. Each room's chapter MUST use that room's image IDs.

FOR THE MATERIALS LEDGER:
- Comprehensive product list separate from the narrative
- Include vendor and room context in notes (format: "Vendor: [name] | Used in: [room]")

CRITICAL RULES:
- 850-1300 words total across introduction, sections, and chapters
- Products serve the narrative — the narrative does not serve the products
- MANDATORY: Include at least 1 direct attributed quote per gallery chapter, drawn from the interview answers. Format: '${designerNameForPrompt} says/recalls/explains, "[actual words]"'. Do NOT paraphrase every answer — preserve the designer's voice.
- The article should read like a magazine feature, not a product specification sheet
- EVERY room with interview content MUST get its own gallery chapter — do not drop, merge, or skip any room
- Return ONLY valid JSON.
- Do NOT generate a pullQuotes array — pull quotes are extracted automatically from your body text after generation.

Begin.`;

  return { systemPrompt: EDITORIAL_SYSTEM_PROMPT, userPrompt, imageIds, rooms, imagesByRoom };
}

// ============================================================================
// POST-PROCESSING: fix "The [noun]..." sentence openers via batched Haiku call
// ============================================================================

const THE_OPENER_PATTERN = /^The\s+/;
const MAX_THE_OPENERS = 2;

async function fixSentenceOpeners(
  blocks: z.infer<typeof BlocksSchema>,
  _cid: string,
): Promise<z.infer<typeof BlocksSchema>> {
  if (!blocks.galleryChapters) return blocks;

  // Collect all paragraphs that start with "The [A-Z]..."
  const flagged: Array<{ chapterIdx: number; paraIdx: number; text: string }> = [];
  for (let ci = 0; ci < blocks.galleryChapters.length; ci++) {
    const body = blocks.galleryChapters[ci].body;
    if (!body) continue;
    for (let pi = 0; pi < body.length; pi++) {
      if (THE_OPENER_PATTERN.test(body[pi])) {
        flagged.push({ chapterIdx: ci, paraIdx: pi, text: body[pi] });
      }
    }
  }

  console.log('[fixSentenceOpeners] entry', {
    _cid,
    totalParagraphs: blocks.galleryChapters.reduce((n, ch) => n + (ch.body?.length ?? 0), 0),
    matchingThePattern: flagged.length,
    flaggedForRewrite: Math.max(0, flagged.length - MAX_THE_OPENERS),
  });

  // If within limit, nothing to fix
  if (flagged.length <= MAX_THE_OPENERS) return blocks;

  // Keep the first MAX_THE_OPENERS, fix the rest
  const toFix = flagged.slice(MAX_THE_OPENERS);
  console.info('[generate] fixing sentence openers', { _cid, total: flagged.length, toFix: toFix.length });

  // Batch all paragraphs into a single Haiku call
  const numberedInput = toFix.map((f, i) => `${i + 1}. ${f.text}`).join('\n\n');

  const rewriteResult = await callLLM(
    async () => {
      return await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        temperature: 0.6,
        max_tokens: Math.max(1024, toFix.length * 500),
        system: `You are a copy editor. For each numbered paragraph below, rewrite ONLY its opening sentence so it does NOT start with "The". Keep the same meaning, tone, and all content after the first sentence. Use one of: a prepositional phrase, an action verb, the designer's name, a dependent clause, or a spatial/temporal marker. Return all rewritten paragraphs in the same numbered format (e.g., "1. [rewritten paragraph]").`,
        messages: [{ role: 'user', content: numberedInput }],
      });
    },
    { modelName: 'claude-haiku-4-5-20251001', contextHint: `fix-openers:${_cid}`, maxRetries: 1, baseDelayMs: 300 },
  );

  if (!rewriteResult.ok) {
    console.warn('[generate] opener fix failed, keeping originals', { _cid, code: rewriteResult.code });
    return blocks;
  }

  const rawResponse = rewriteResult.data.content[0]?.type === 'text' ? rewriteResult.data.content[0].text : '';
  if (!rawResponse.trim()) return blocks;

  // Parse numbered responses back
  const rewrittenParagraphs = rawResponse.split(/\n\n(?=\d+\.\s)/).map(chunk => {
    return chunk.replace(/^\d+\.\s*/, '').trim();
  }).filter(p => p.length > 0);

  // Apply rewrites
  for (let i = 0; i < Math.min(toFix.length, rewrittenParagraphs.length); i++) {
    const { chapterIdx, paraIdx } = toFix[i];
    const rewritten = rewrittenParagraphs[i];
    // Sanity check: rewritten should not start with "The [A-Z]" and should be reasonable length
    if (rewritten && !THE_OPENER_PATTERN.test(rewritten) && rewritten.length > 20) {
      blocks.galleryChapters![chapterIdx].body![paraIdx] = rewritten;
    }
  }

  const applied = Math.min(toFix.length, rewrittenParagraphs.length);
  let actuallyApplied = 0;
  for (let i = 0; i < applied; i++) {
    const r = rewrittenParagraphs[i];
    if (r && !THE_OPENER_PATTERN.test(r) && r.length > 20) actuallyApplied++;
  }
  console.log('[fixSentenceOpeners] result', {
    _cid,
    haikuCallSucceeded: rewriteResult.ok,
    rewritesApplied: actuallyApplied,
    rewritesAttempted: toFix.length,
  });

  // Re-validate
  try {
    return BlocksSchema.parse(blocks);
  } catch {
    console.warn('[generate] blocks failed validation after opener fix, returning unfixed', { _cid });
    return blocks;
  }
}

// ============================================================================
// MAIN GENERATION FUNCTION — unified canonical path
// ============================================================================

// Hard-fail error class for editorial generation failures.
// The route's outer try/catch reads `code`, `status`, and `message` and
// surfaces them to the UI. Throwing keeps the designer from shipping a
// fallback dump (raw interview answers as deck + chapter bodies) without
// realizing it.
class EditorialGenerationError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function generateEditorialDraft(input: GenInput): Promise<{
  blocks: z.infer<typeof BlocksSchema>;
}> {
  const _cid = input.correlationId || 'generate';

  // De-duplicate answers before processing
  const uniqueAnswers = deduplicateAnswers(input.answers);

  if (!ANTHROPIC_ENABLED) {
    throw new EditorialGenerationError(
      'LLM_DISABLED',
      'Editorial generation is unavailable — the AI service is not configured. Contact support.',
      503,
    );
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
    const failure = llmResult as { ok: false; code: string; status?: number; message?: string };
    console.warn('[generate] llm_call_failed', {
      _cid, code: failure.code, status: failure.status, message: failure.message, projectId: input.project?.id,
    });
    throw new EditorialGenerationError(
      'LLM_CALL_FAILED',
      `AI model call failed (${failure.code}${failure.status ? `, HTTP ${failure.status}` : ''}). Try regenerating in a moment.`,
      failure.status || 502,
    );
  }

  console.log('[GENERATE] LLM call complete, proceeding to repair', { _cid });
  console.info('[generate] llm_ok', { _cid, model: llmResult.usedModel });
  const rawText = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : "";

  if (!rawText || rawText.trim().length === 0) {
    throw new EditorialGenerationError(
      'LLM_EMPTY_RESPONSE',
      'The AI model returned an empty response. Try regenerating.',
    );
  }

  // Parse JSON output
  let composed: any;
  try {
    const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
    composed = JSON.parse(cleaned);
  } catch (parseError: any) {
    console.warn('[generate] JSON parse error', { _cid, error: parseError?.message });
    throw new EditorialGenerationError(
      'LLM_JSON_PARSE',
      'The AI model returned malformed output. Try regenerating.',
    );
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
    console.log('[GENERATE] calling repairAndBuildBlocks', { _cid });
    let blocks = await repairAndBuildBlocks(composed, { ...input, answers: uniqueAnswers }, imageIds, rooms, imagesByRoom, _cid);
    // Post-processing: fix "The [noun]..." sentence openers
    blocks = await fixSentenceOpeners(blocks, _cid);
    return { blocks };
  } catch (repairError: any) {
    console.log('[GENERATE] repairAndBuildBlocks THREW:', repairError?.message ?? repairError, { _cid });
    throw new EditorialGenerationError(
      'LLM_REPAIR_FAILED',
      'The generated draft did not pass validation. Try regenerating.',
    );
  }
}
