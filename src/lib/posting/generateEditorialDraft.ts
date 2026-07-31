import Anthropic from "@anthropic-ai/sdk";
import { BlocksSchema, syncPullQuotesFromChapters } from "./schemas";
import type { PullQuoteSelection, PullQuoteAlternative } from "./schemas";
import { z } from "zod";
import { callLLM } from "./llmClient";
import { formatRoomName } from "@/lib/utils/formatRoomName";
import { HOOK_OPENER_ID_PREFIX, HOOK_FOLLOWUP_ID_PREFIX } from "@/lib/interview/generateQuestions";
import { MODELS } from '@/lib/ai/models';
import { resolveProductNaming } from '@/lib/naming/resolveProductNaming';
import { scrubProseNaming, type DescriptorHint } from '@/lib/naming/scrubProse';
import { FOLIO_TONE, JSON_PROSE_QUOTING_RULE } from '@/lib/interview/prompts/editorialTone';

const client = new Anthropic();

// FOLIO_TONE is now the canonical constant from the prompt module (docs/17 §5).
// Re-exported here (byte-identical value) so existing importers keep working.
export { FOLIO_TONE };

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
  /**
   * Owning organization, when the project is org-owned (designerOrgId set).
   * Attribution model (product decision): the article is CREDITED to the org
   * and the org is the byline, but the interviewee remains the quoted voice —
   * direct quotes stay "{surname} says", introduced once as "{full name} of
   * {org name}". Absent/null → individual designer attribution (legacy).
   */
  org?: { id: string; name: string } | null;
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

  // --- Append-only room chapters (ADR append-only-room-chapters, C2/C3/C4) ---
  // Omitting all of these keeps the legacy single-pass behavior: every room gets
  // a fresh editorial chapter.
  /** 'initial' = write every room; 'append' = only write `writeRoomNames`. */
  mode?: 'initial' | 'append';
  /** Editorial chapters kept verbatim from prior passes, in order, at the front. */
  frozenChapters?: Array<{
    title?: string;
    roomId: string | null;
    imageIds: string[];
    body: string[];
    pullQuote?: PullQuoteSelection | string | null;
    generatedAt?: number;
    kind: 'editorial';
  }>;
  /** Room NAMES to write NEW editorial prose for this pass (default: all rooms). */
  writeRoomNames?: string[];
  /** Room NAMES to emit as photo-only gallery chapters (tail). */
  galleryRoomNames?: string[];
  /** Room NAME → Room.id, so assembled chapters can carry roomId. */
  roomNameToId?: Record<string, string>;
  /** Lead fields frozen by a designer override — passed as fixed, not generated. */
  frozenLead?: { kicker?: string; deck?: string };
  /** Introduction frozen by a designer override — passed as fixed, not generated. */
  frozenIntroduction?: string[];
  /** Timestamp stamped on chapters written this pass (route supplies it). */
  generatedAt?: number;
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

// Build credits array from input designer/vendor data.
// Org-owned projects are credited to the ORG (the byline is the firm, e.g.
// "BP Design"); the individual is not repeated as a separate Designer credit
// because they appear as the quoted voice in the prose. Individual-owned
// projects keep the legacy Designer (+ Studio) credit.
function buildCredits(input: GenInput): Array<{ role: string; name: string }> {
  const credits: Array<{ role: string; name: string }> = [];
  const orgName = input.org?.name?.trim();
  if (orgName) {
    credits.push({ role: 'Designer', name: orgName });
    return credits;
  }
  if (input.designer?.name) {
    credits.push({ role: 'Designer', name: input.designer.name });
  }
  if (input.designer?.studio && input.designer.studio !== input.designer?.name) {
    credits.push({ role: 'Studio', name: input.designer.studio });
  }
  return credits;
}

// Product Naming Gate (spec 20) — the compose-time prose chokepoint.
//
// Resolves naming eligibility for every tagged product from the three paid
// signals (vendor subscription, approved boost on this post, ENTERPRISE poster)
// and scrubs non-eligible names out of the final prose, replacing them with
// descriptors. Self-contained: reads everything it needs from `input` (tags,
// project id, designer id), so BOTH callers of generateEditorialDraft pass
// through this one chokepoint. Credits and the materials ledger are never
// scrubbed (handled inside scrubProseNaming).
//
// Errors are intentionally NOT swallowed: a gate failure must fail generation
// (the caller surfaces a retryable error) rather than silently persist
// un-scrubbed prose. Over-suppression is the correct error, per spec 17/20.
async function applyProseNamingGate(
  blocks: z.infer<typeof BlocksSchema>,
  input: GenInput,
  cid: string
): Promise<z.infer<typeof BlocksSchema>> {
  const productIds: string[] = (input.tags ?? [])
    .map((t: any) => t?.product?.id ?? t?.productId)
    .filter((id: any): id is string => typeof id === 'string');
  if (productIds.length === 0) return blocks;

  const naming = await resolveProductNaming(productIds, {
    mode: 'prose',
    projectId: input.project?.id ?? null,
    postingUserId: input.designer?.id ?? null,
  });

  // Descriptor hints (source 1): the model emits a brand-free descriptor per
  // materials-ledger item in its `finish` field. Match each ledger item back to
  // a product — by productId if the model echoed one, otherwise by exact name
  // (the prompt requires exact product names) — and feed it as the emitted
  // descriptor. The deterministic category+finish assembly (source 2) still
  // applies for anything unmatched.
  const nameToProductId = new Map<string, string>();
  for (const n of Array.from(naming.values())) {
    if (n.name) nameToProductId.set(n.name.trim().toLowerCase(), n.productId);
  }
  const hints = new Map<string, DescriptorHint>();
  for (const item of blocks.materialsLedger?.items ?? []) {
    const emitted = typeof item.finish === 'string' ? item.finish.trim() : '';
    if (!emitted) continue;
    const pid = item.productId ?? (item.name ? nameToProductId.get(item.name.trim().toLowerCase()) : undefined);
    if (pid) hints.set(pid, { emitted });
  }

  const { blocks: scrubbed, replacements } = scrubProseNaming(blocks, naming, hints);
  const gated = Array.from(naming.values()).filter((n) => !n.named).length;
  console.info('[generate] product_naming_gate', {
    cid, products: naming.size, gated, replacements,
  });

  // Re-validate as a guard. The scrub is a structure-preserving string transform,
  // but swapping a short name for a longer descriptor can push a field past a
  // soft length cap (e.g. lead.kicker max 120). That is not a reason to fail
  // generation or — worse — to fall back to un-scrubbed prose, so on a validation
  // miss we keep the scrubbed (leak-free) blocks and log rather than throw.
  const revalidated = BlocksSchema.safeParse(scrubbed);
  if (!revalidated.success) {
    console.warn('[generate] product_naming_gate_revalidation', {
      cid, issues: revalidated.error.issues.slice(0, 3),
    });
    return scrubbed;
  }
  return revalidated.data;
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
  if (!hookAnswer) {
    console.log('[VERIFY] spliceHookQuote: REGEX FALLBACK path');
    return null;
  }

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
    console.log('[VERIFY] spliceHookQuote: AI SPLICE path');
    const message = await client.messages.create({
      model: MODELS.sonnet,
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

// A quoted span, straight or curly. The generator now emits curly quotes
// (JSON_PROSE_QUOTING_RULE), so a straight-quote-only pattern would treat the
// designer's quoted words as unquoted prose and rewrite them.
const QUOTED_SPAN = /"[^"]*"|“[^”]*”/g;

function capitalizeSentenceStarts(text: string): string {
  return text.replace(/(^|\.\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

// Conservative fixes outside quotes; never alter quoted text
export function proofOutsideQuotes(paragraph: string): string {
  if (!paragraph || !paragraph.trim()) return paragraph;
  const result = paragraph.trim();
  // Walk the paragraph and capitalize sentence starts only in the spans sitting
  // OUTSIDE quotation marks, preserving each span's original quote characters.
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  QUOTED_SPAN.lastIndex = 0;
  while ((match = QUOTED_SPAN.exec(result)) !== null) {
    out += capitalizeSentenceStarts(result.slice(cursor, match.index));
    out += match[0];
    cursor = match.index + match[0].length;
  }
  return out + capitalizeSentenceStarts(result.slice(cursor));
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
  const knownImageIdSet = new Set(imageIds);
  const gen = input.generatedAt ?? 0;
  const roomNameToId = input.roomNameToId ?? {};
  const frozenChapters = input.frozenChapters ?? [];
  // Rooms to write NEW editorial prose for (default: every image-room — legacy).
  const writeRooms = input.writeRoomNames
    ? input.writeRoomNames.filter((r) => r && r !== 'General')
    : rooms;

  const composedChapters: any[] = Array.isArray(composed.galleryChapters) ? composed.galleryChapters : [];

  const proofBody = (rawBody: any): string[] => {
    const out: string[] = [];
    if (Array.isArray(rawBody)) {
      for (const para of rawBody) {
        const processed = proofOutsideQuotes((typeof para === 'string' ? para : String(para || '')).trim());
        if (!processed) continue;
        if (processed.length > 4500) out.push(...splitLongParagraph(processed, 4000));
        else out.push(processed);
      }
    } else if (typeof rawBody === 'string' && rawBody.trim()) {
      for (const para of proofOutsideQuotes(rawBody.trim()).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
        if (para.length > 4500) out.push(...splitLongParagraph(para, 4000));
        else out.push(para);
      }
    }
    return out;
  };

  // --- Match each writeRoom to the chapter the model actually wrote for it ---
  //
  // This USED to pair `writeRooms[i]` with `composedChapters[i]` by array index,
  // on the assumption that the model returns chapters in the order the prompt
  // lists the rooms. It does not have to, and in practice it doesn't: the model
  // reorders into a narrative walkthrough (exterior → entry → living room …).
  // When that happened, every chapter got the title and images of one room and
  // the prose of another — a bathroom photo under "Primary Bathroom" describing
  // the formal living room's fireplace. Silent, confident, and wrong in a way
  // that reads as plausible until you look at the photo.
  //
  // Titles are the join key instead. The prompt already requires every chapter
  // title to carry its room name ("Use the designer's exact room name as the
  // section heading"), so the model tells us the mapping — we just have to read
  // it rather than assume the ordering.
  //
  // Two passes, and within each, longer room names first: "Formal Living Room"
  // must claim its chapter before "Living Room" can match the same title. A
  // chapter is claimed at most once, so two rooms can never share prose.
  const normalizeRoomKey = (s: unknown): string =>
    String(s ?? '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  // Whole-word-run containment, so "entry" doesn't match inside "entryway".
  const containsRoomName = (title: string, room: string): boolean =>
    ` ${title} `.includes(` ${room} `);

  const normChapters = composedChapters.map((ch, i) => ({
    i,
    ch,
    norm: normalizeRoomKey(ch?.title),
  }));
  const roomToChapter = new Map<string, any>();
  const claimedChapterIdx = new Set<number>();
  const roomsBySpecificity = [...writeRooms].sort(
    (a, b) => normalizeRoomKey(b).length - normalizeRoomKey(a).length,
  );

  for (const pass of ['exact', 'contains'] as const) {
    for (const roomName of roomsBySpecificity) {
      if (roomToChapter.has(roomName)) continue;
      const target = normalizeRoomKey(roomName);
      if (!target) continue;
      const hit = normChapters.find(
        (c) =>
          !claimedChapterIdx.has(c.i) &&
          c.norm &&
          (pass === 'exact' ? c.norm === target : containsRoomName(c.norm, target)),
      );
      if (hit) {
        roomToChapter.set(roomName, hit.ch);
        claimedChapterIdx.add(hit.i);
      }
    }
  }

  // Diagnostics: a room with no chapter is demoted below (photo-only, honest).
  // A chapter we couldn't place is prose the model wrote for a room we didn't
  // ask about — dropping it is correct, but it must never be silent, because a
  // rising count here means the title contract is drifting.
  const unmatchedRooms = writeRooms.filter((r) => !roomToChapter.has(r));
  const unclaimedChapters = normChapters
    .filter((c) => !claimedChapterIdx.has(c.i) && (c.ch?.body?.length ?? 0) > 0)
    .map((c) => c.ch?.title ?? `(untitled #${c.i})`);
  if (unmatchedRooms.length > 0 || unclaimedChapters.length > 0) {
    console.warn('[generateEditorialDraft] chapter/room title match incomplete', {
      _cid,
      unmatchedRooms,
      unclaimedChapters,
      writeRooms,
      modelChapterTitles: normChapters.map((c) => c.ch?.title ?? null),
    });
  }

  // --- Build NEW editorial chapters, one per writeRoom (C2/C3) ---
  // No placeholder filler: a room the model returns no prose for is demoted to a
  // photo-only gallery chapter and logged — never "Content pending." An
  // unmatched room is demoted the same way. We deliberately do NOT fall back to
  // positional pairing for leftovers: a room with photos and no prose is a
  // lesser evil than a room confidently captioned with another room's story.
  const newEditorialAssembled: Array<Record<string, any>> = [];
  const demotedRooms: string[] = [];
  for (const roomName of writeRooms) {
    const roomImageIds = (imagesByRoom[roomName] || [])
      .map((img) => img.id)
      .filter((id) => knownImageIdSet.has(id))
      .slice(0, 8);
    const bodyParas = proofBody(roomToChapter.get(roomName)?.body);
    if (roomImageIds.length === 0 || bodyParas.length === 0) {
      demotedRooms.push(roomName);
      continue;
    }
    newEditorialAssembled.push({
      title: formatRoomName(roomName),
      imageIds: roomImageIds,
      body: bodyParas,
      // Only the first chapter OVERALL is the article lead. In append mode that's
      // a frozen chapter, so no new chapter is treated as the lead.
      pullQuote: extractPullQuotesForChapter(bodyParas, designerName, {
        isLeadChapter: frozenChapters.length === 0 && newEditorialAssembled.length === 0,
      }),
      roomId: roomNameToId[roomName] ?? null,
      generatedAt: gen,
      kind: 'editorial' as const,
    });
  }
  if (demotedRooms.length > 0) {
    console.warn('[generateEditorialDraft] editorial rooms demoted to gallery (no prose)', { _cid, demotedRooms });
  }

  // Legacy resilience: if nothing frozen and nothing new landed but the model put
  // real narrative in `sections`, salvage one editorial chapter from it (real
  // prose, not a placeholder). Prepended before any gallery so editorial-first holds.
  if (frozenChapters.length === 0 && newEditorialAssembled.length === 0) {
    const paras: string[] = [];
    for (const s of composed.sections || []) {
      if (s.type === 'narrative' && s.body) paras.push(...proofBody(s.body));
    }
    if (paras.length >= 3) {
      const firstName = writeRooms[0];
      const imgIds = (firstName ? (imagesByRoom[firstName] || []).map((i) => i.id) : imageIds)
        .filter((id) => knownImageIdSet.has(id))
        .slice(0, 8);
      if (imgIds.length > 0) {
        newEditorialAssembled.push({
          title: firstName ? formatRoomName(firstName) : (input.project?.title || 'The Space'),
          imageIds: imgIds,
          body: paras,
          pullQuote: extractPullQuotesForChapter(paras, designerName, { isLeadChapter: true }),
          roomId: firstName ? (roomNameToId[firstName] ?? null) : null,
          generatedAt: gen,
          kind: 'editorial' as const,
        });
      }
    }
  }

  // Frozen editorial chapters kept verbatim, at the front, in order.
  const frozenAssembled = frozenChapters.map((ch) => ({
    title: ch.title,
    imageIds: ch.imageIds,
    body: ch.body,
    pullQuote: ch.pullQuote ?? null,
    roomId: ch.roomId,
    generatedAt: ch.generatedAt,
    kind: 'editorial' as const,
  }));

  // Gallery tail (C2 + Addition 2): rooms with NO editorial chapter (frozen OR
  // new). Rebuilt from scratch every pass so a room that earns an editorial
  // chapter loses its stale photo block. Rooms already editorial are subtracted
  // (never print twice); rooms with no images render nothing. Project room order.
  const editorialRoomIds = new Set(
    [...frozenAssembled, ...newEditorialAssembled]
      .map((c) => c.roomId)
      .filter((x): x is string => !!x),
  );
  const roomOrderIndex = new Map((input.rooms ?? []).map((r, i) => [r.name, i] as const));
  const galleryTail = Array.from(new Set([...(input.galleryRoomNames ?? []), ...demotedRooms]))
    .filter((name) => name && name !== 'General')
    .map((name) => ({ name, roomId: roomNameToId[name] ?? null }))
    .filter((g) => !(g.roomId && editorialRoomIds.has(g.roomId)))
    .map((g) => ({
      ...g,
      imageIds: (imagesByRoom[g.name] || []).map((img) => img.id).filter((id) => knownImageIdSet.has(id)).slice(0, 8),
    }))
    .filter((g) => g.imageIds.length > 0)
    .sort((a, b) => (roomOrderIndex.get(a.name) ?? 9999) - (roomOrderIndex.get(b.name) ?? 9999))
    .map((g) => ({
      title: formatRoomName(g.name),
      imageIds: g.imageIds,
      pullQuote: null,
      roomId: g.roomId,
      generatedAt: gen,
      kind: 'gallery' as const,
    }));

  // Final order: frozen editorial → new editorial → gallery tail.
  const finalChaptersWithQuotes = [...frozenAssembled, ...newEditorialAssembled, ...galleryTail];

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

  // Frozen lead/intro (C3, Q1): a designer-edited lead field or introduction is
  // reproduced from the override, not from the model output. The model already
  // saw it as FIXED context (so the unfrozen field was written to fit), and this
  // is the belt-and-suspenders assertion that the edit wins.
  if (input.frozenLead?.kicker || input.frozenLead?.deck) {
    blocks.lead = {
      kicker: input.frozenLead?.kicker ?? blocks.lead?.kicker,
      deck: input.frozenLead?.deck ?? blocks.lead?.deck,
    };
  }
  if (input.frozenIntroduction && input.frozenIntroduction.length > 0) {
    (blocks as Record<string, any>).introduction = input.frozenIntroduction.slice(0, 4);
  }

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
  writeRooms: string[];
  imagesByRoom: Record<string, Array<{ id: string }>>;
} {
  const { project, designer, images, tags } = input;
  const products = buildMaterialContext(tags);
  const rawDesignerName = designer?.name;
  const designerNameForPrompt = rawDesignerName
    ? rawDesignerName.replace(/\b[a-z]/g, c => c.toUpperCase())
    : 'the designer';
  // Org attribution (product decision: org credit, person's voice). When the
  // project is org-owned, `creditName` — the byline and the credits example — is
  // the org; the person (`designerNameForPrompt`) stays the quoted voice.
  const orgName = input.org?.name?.trim() || '';
  const creditName = orgName || designerNameForPrompt;
  const attributionNote = orgName
    ? `\n## ATTRIBUTION — CREDIT THIS PROJECT TO ${orgName}
The design of this project is credited to the firm ${orgName}, not to an individual. ${designerNameForPrompt} is the person interviewed and remains the speaking voice for every direct quote and attributed paraphrase. On the FIRST mention in the introduction, introduce them as "${designerNameForPrompt} of ${orgName}"; use the surname alone thereafter. NEVER attribute a spoken quote to the firm (do not write "${orgName} says"). The byline and credits belong to ${orgName}.\n`
    : '';

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

  // Append-only (C4): the model writes prose ONLY for `writeRooms`. When
  // writeRoomNames is omitted (legacy caller), that's every image-room — today's
  // behavior. Frozen chapters and the gallery tail are assembled after the call,
  // never generated.
  const isAppend = input.mode === 'append';
  const writeRooms = input.writeRoomNames
    ? input.writeRoomNames.filter((r) => r && r !== 'General')
    : rooms;

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

  // Required chapters this pass = the rooms we're writing (writeRooms), not every
  // image-room. In initial mode writeRooms === rooms, so this is unchanged.
  const requiredChapterCount = Math.max(writeRooms.length, isAppend ? 0 : 1);

  // Structural variation: assign varied paragraph counts per room
  const paraDistributions = [
    [3, 2, 4, 2, 3],
    [2, 3, 3, 4, 2],
    [4, 2, 3, 2, 3],
    [2, 4, 2, 3, 3],
    [3, 3, 2, 4, 2],
  ];
  const chosenDist = paraDistributions[Math.floor(Math.random() * paraDistributions.length)];
  const roomNames = writeRooms.length > 0 ? writeRooms : ['General'];
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
    ? `${designer.name}${orgName ? ` (${orgName})` : designer.studio ? ` / ${designer.studio}` : ''}`
    : orgName || '';

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
  // Append-mode context (C4): published chapters (verbatim, do-not-touch),
  // fixed lead/intro fields, and the append rules.
  const frozenChaptersBlock = isAppend && (input.frozenChapters?.length ?? 0) > 0
    ? `\n## PUBLISHED CHAPTERS — DO NOT REWRITE, SUMMARIZE, OR REFERENCE AS PRIOR TEXT
These rooms are already published. Treat them as fixed. Do NOT write about them again, do NOT reintroduce a product or material they already covered unless a NEW room's story genuinely turns on it, and match their register.
${input.frozenChapters!.map((ch, i) => `--- Published chapter ${i + 1}${ch.title ? `: ${ch.title}` : ''} ---\n${(ch.body || []).join('\n\n')}`).join('\n\n')}
`
    : '';
  const frozenLeadIntroBlock = (() => {
    const parts: string[] = [];
    if (input.frozenLead?.kicker) parts.push(`FIXED HEADLINE (kicker) — reproduce exactly: ${input.frozenLead.kicker}`);
    if (input.frozenLead?.deck) parts.push(`FIXED SUBTITLE (deck) — reproduce exactly: ${input.frozenLead.deck}`);
    if (input.frozenIntroduction?.length) parts.push(`FIXED INTRODUCTION — reproduce exactly:\n${input.frozenIntroduction.join('\n\n')}`);
    return parts.length
      ? `\n## FIXED FIELDS (the designer edited these — reproduce verbatim and write everything else to fit them)\n${parts.join('\n\n')}\n`
      : '';
  })();
  const appendInstructions = isAppend
    ? `\n## APPEND MODE — CRITICAL
- The editorial-hierarchy rule (spend 60-70% of the word budget on 1-2 rooms) does NOT apply. Give each REQUIRED room the space its own interview content earns.
- Write only the REQUIRED rooms. The lead and introduction regenerate against the published chapters plus the new ones together — but any FIXED field above must be reproduced verbatim.
- Every accuracy rule still applies.
`
    : '';

  const userPrompt = `Write a feature article about this project.
${frozenChaptersBlock}${frozenLeadIntroBlock}${appendInstructions}${attributionNote}

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
   - ${designerNameForPrompt} recalls... followed by a direct quote
   - As ${designerNameForPrompt} explains, “[quote]”
   - “[Quote],” ${designerNameForPrompt} says.
   - “[Quote],” says ${designerNameForPrompt}, “[continuation].”

   Note the quotation marks in those examples: always curly (“ ”), never the straight " character. See JSON STRING SAFETY below.

   Direct quotes must be REAL phrases from the interview answers above. Do not invent quotes. Do not clean up the language so much that it loses the person's voice. A designer saying “We almost went polished nickel but brass felt right for this house” is better than “We carefully considered polished nickel before ultimately selecting brass for its warmth.”

2. ATTRIBUTED PARAPHRASE (at least 1 per gallery chapter):
   Convey the designer's perspective without direct quotation:
   - ${designerNameForPrompt} chose brass hardware over polished nickel, drawn to its warmth against the mauve cabinetry.
   - The decision to remove the entry closet came early — ${designerNameForPrompt} wanted the full volume of the space to announce itself.

3. UNATTRIBUTED NARRATIVE:
   The remaining prose can describe materials, spatial relationships, and visual effects without attribution. But even this should feel informed by the designer's perspective, not written by someone who only saw photos.

BALANCE: Each gallery chapter should have:
- At least 1 direct attributed quote (MANDATORY — do not skip this)
- At least 1 attributed paraphrase
- The rest as narrative prose
- The reader should finish the piece feeling like they heard from the designer, not just read about the house.

USING FOLLOW-UP CONTENT: Answers tagged [SOURCE: FOLLOW-UP] contain the richest material — process stories, client anecdotes, tradeoff explanations, and behind-the-scenes details. Prioritize these for direct quotes and anecdotes. Do NOT flatten follow-up answers into generic descriptive prose.

## What to Generate

${JSON_PROSE_QUOTING_RULE}

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
  "credits": [{ "role": "Designer", "name": "${creditName}" }],
  "materialsLedger": {
    "items": [{ "name": "Product Name", "finish": "brand-free descriptor: form + material + finish", "note": "Vendor: Name | Used in: Room" }]
  },
  "mode": "recomposition"
}

MATERIALS LEDGER — DESCRIPTOR FIELD:
For every item, the "finish" field must be a short brand-free descriptor of the piece — its form, material, and finish only (e.g. "clear glass globe pendant", "unlacquered brass bridge faucet"), never the brand or collection name. Naming eligibility is enforced downstream; this descriptor is the swap text used when a product may not be named in the published prose.

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
- Lead with a direct quote: “We had to have both crews on site the same day,” ${designerNameForPrompt} explains.
- Lead with action: ${designerNameForPrompt} sourced the marble from a local yard.
- Lead with a prepositional phrase: Above the island, three black pendants hover...
- Lead with a dependent clause: When the original slab cracked, the replacement turned out better.
- Lead with a spatial or temporal marker: At the far end of the open plan, the bar operates on different rules.
Each section should use at least 2 different opening structures across its paragraphs. If you notice yourself starting consecutive paragraphs with "The," rewrite one of them.

FOR GALLERY CHAPTERS:
- You MUST create exactly ${requiredChapterCount} gallery chapters — one for each REQUIRED room listed below.
- REQUIRED rooms (do NOT omit or merge any): ${writeRooms.length > 0 ? writeRooms.join(', ') : 'None — write no gallery chapters this pass'}${isAppend ? `\n- Do NOT write chapters for any room not in that list. Other rooms are either already published (shown above as PUBLISHED CHAPTERS) or will appear as photo-only galleries — leave them out entirely.` : ''}
- Each chapter title MUST include the room name, spelled exactly as listed above. The title is how each chapter's prose is matched to that room's photographs — a chapter whose title does not name one of the required rooms cannot be placed, and its prose is discarded. You may write the chapters in whatever narrative order reads best; the titles carry the mapping, not the ordering.
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
- MANDATORY: Include at least 1 direct attributed quote per gallery chapter, drawn from the interview answers. Format: ${designerNameForPrompt} says/recalls/explains, “[actual words]”. Do NOT paraphrase every answer — preserve the designer's voice.
- The article should read like a magazine feature, not a product specification sheet
- EVERY room with interview content MUST get its own gallery chapter — do not drop, merge, or skip any room
- Return ONLY valid JSON — no preamble, no commentary, no code fence.
- Quotation marks inside prose are ALWAYS curly (“ ” and ‘ ’). A straight " inside a string value invalidates the whole response. Re-read JSON STRING SAFETY above before you begin.
- Do NOT generate a pullQuotes array — pull quotes are extracted automatically from your body text after generation.

Begin.`;

  return { systemPrompt: EDITORIAL_SYSTEM_PROMPT, userPrompt, imageIds, rooms, writeRooms, imagesByRoom };
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
        model: MODELS.haiku,
        temperature: 0.6,
        max_tokens: Math.max(1024, toFix.length * 500),
        system: `You are a copy editor. For each numbered paragraph below, rewrite ONLY its opening sentence so it does NOT start with "The". Keep the same meaning, tone, and all content after the first sentence. Use one of: a prepositional phrase, an action verb, the designer's name, a dependent clause, or a spatial/temporal marker. Return all rewritten paragraphs in the same numbered format (e.g., "1. [rewritten paragraph]").`,
        messages: [{ role: 'user', content: numberedInput }],
      });
    },
    { modelName: MODELS.haiku, contextHint: `fix-openers:${_cid}`, maxRetries: 1, baseDelayMs: 300 },
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

// Turn a JSON.parse failure into an actionable diagnostic. V8 reports the byte
// offset in the error message ("... in JSON at position 1234"); we pull it out
// and return a whitespace-collapsed window of the raw text around that offset,
// with a ⟪HERE⟫ marker at the exact failure point. That window is almost always
// the malformed span itself — an unescaped quote, a stray control char — so the
// log line alone tells us what the model did wrong without replaying the run.
export function describeJsonParseFailure(
  raw: string,
  error: any,
): { position: number | null; snippet: string } {
  const msg = typeof error?.message === 'string' ? error.message : '';
  const match = msg.match(/position (\d+)/i);
  const position = match ? Number(match[1]) : null;
  if (position === null || !Number.isFinite(position)) {
    return { position: null, snippet: raw.slice(0, 240).replace(/\s+/g, ' ') };
  }
  const start = Math.max(0, position - 120);
  const end = Math.min(raw.length, position + 120);
  const snippet = `${raw.slice(start, position)}⟪HERE⟫${raw.slice(position, end)}`.replace(/\s+/g, ' ');
  return { position, snippet };
}

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

// Appended to the user prompt on the one resample after an unparseable response.
// Deliberately does NOT show the model its broken output: handing back the
// mangled text invites it to "fix" the JSON around whatever prose it can salvage,
// which is the corrupting repair path in a different costume. We ask for a clean
// draft and restate the rule that is almost always the cause.
const JSON_RESAMPLE_NOTE = `RETRY — YOUR PREVIOUS RESPONSE WAS NOT VALID JSON AND WAS DISCARDED.
Write the complete article again from scratch. The overwhelmingly common cause is a straight double quote (") inside a prose string, so obey this without exception:

${JSON_PROSE_QUOTING_RULE}

Output the JSON object and nothing else.`;

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
  const { systemPrompt, userPrompt, imageIds, rooms, writeRooms, imagesByRoom } = buildPrompt(input, uniqueAnswers);

  // Size the output budget off the rooms we actually write prose for this pass
  // (writeRooms), NOT the count of rooms that happen to have interview answers.
  // Project-level answers all land in "About This Project"/"General", so an
  // answer-based count collapses to 0 and starves an image-driven multi-room
  // draft — the model then truncates mid-JSON and the parse fails as
  // LLM_JSON_PARSE. Each written chapter needs ~800 tokens of prose+structure.
  // Cap note: the Sonnet model ceiling is 128K output tokens, so this cap is
  // NOT a model limit — it's a wall-clock guard. This call is non-streaming, and
  // a generation that runs for many minutes risks an HTTP timeout / serverless
  // maxDuration 502 before the JSON returns. 32K (~37 rooms at 800/room) covers
  // any realistic project while staying inside a completable window. To size for
  // genuinely unbounded projects, switch this call to `.stream()` +
  // getFinalMessage() and the cap can safely rise toward 128K.
  const outputRoomCount = Math.max(writeRooms.length, 1);
  const maxTokens = Math.min(32000, Math.max(4096, outputRoomCount * 800 + 2000));
  const modelName = MODELS.sonnet;

  const runGeneration = (attempt: number) => callLLM(
    async () => {
      return await client.messages.create({
        model: modelName,
        // Attempt 2 is a resample after unparseable JSON. Drop the temperature so
        // the retry hugs the format instructions instead of re-rolling the same
        // creative liberties that broke the string in the first place.
        temperature: attempt === 1 ? 0.7 : 0.3,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: "user", content: attempt === 1 ? userPrompt : `${userPrompt}\n\n${JSON_RESAMPLE_NOTE}` },
        ],
      });
    },
    { modelName, contextHint: `generate:${input.project?.id}`, baseDelayMs: 500 }
  );

  // Parse JSON output. Strict JSON.parse is the ONLY accepted path — we NEVER
  // "repair" malformed output.
  //
  // We tried a jsonrepair fallback (keep the draft instead of 502'ing) and it was
  // strictly worse: jsonrepair is a heuristic that guesses where each string
  // begins and ends, and it has no idea where a prose paragraph was *meant* to
  // start or stop. When the model emits an unescaped quote inside a body string
  // (e.g. It"s, doesn"T — the model using " where an apostrophe belongs), the
  // repair re-brackets the wrong spans: it merges adjacent chapters and splices
  // the raw JSON structure ("], }, { "title": ... "body": [ ...) into a body
  // paragraph as literal text. That corrupted draft then shipped to the designer,
  // desynced the positional room→body mapping downstream, and poisoned the
  // regex pull-quote extractor (stray quotes → fabricated "quotes"). A
  // recoverable 502 the designer can regenerate is far better than publishing
  // that. So: no repair.
  //
  // What we do instead of repairing is RESAMPLE once. A fresh sample is the same
  // action the error message asks the designer to take by hand ("Try
  // regenerating") — it just costs them one click and two minutes less. Unlike a
  // repair it cannot corrupt prose, because the second draft is authored whole by
  // the model rather than stitched together by us. Only the parse failure
  // retries; LLM_TRUNCATED and LLM_EMPTY_RESPONSE still fail immediately, since
  // resampling those hits the same deterministic ceiling.
  //
  // On the final failure we emit a rich diagnostic (parse position + the offending
  // window of raw text) so the malformed span is actionable server-side without
  // replaying the whole generation, then throw.
  const MAX_PARSE_ATTEMPTS = 2;
  let composed: any;
  let parsed = false;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    const llmResult = await runGeneration(attempt);

    if (!llmResult.ok) {
      const failure = llmResult as { ok: false; code: string; status?: number; message?: string };
      console.warn('[generate] llm_call_failed', {
        _cid, attempt, code: failure.code, status: failure.status, message: failure.message, projectId: input.project?.id,
      });
      throw new EditorialGenerationError(
        'LLM_CALL_FAILED',
        `AI model call failed (${failure.code}${failure.status ? `, HTTP ${failure.status}` : ''}). Try regenerating in a moment.`,
        failure.status || 502,
      );
    }

    console.info('[generate] llm_ok', {
      _cid,
      attempt,
      model: llmResult.usedModel,
      stopReason: llmResult.data.stop_reason,
      outputTokens: llmResult.data.usage?.output_tokens,
      maxTokens,
    });

    // Truncation guard: if the model hit the token ceiling, the JSON is cut off
    // mid-structure. Detect it here so it surfaces as an actionable LLM_TRUNCATED
    // (raise the budget) instead of a misleading LLM_JSON_PARSE ("regenerate",
    // which deterministically hits the same cap). See maxTokens sizing above.
    if (llmResult.data.stop_reason === 'max_tokens') {
      console.warn('[generate] output truncated at max_tokens', {
        _cid, attempt, maxTokens, outputRoomCount, outputTokens: llmResult.data.usage?.output_tokens,
      });
      throw new EditorialGenerationError(
        'LLM_TRUNCATED',
        'The AI model ran out of room before finishing this draft. Try regenerating, or split the project into fewer rooms.',
      );
    }

    const rawText = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : "";

    if (!rawText || rawText.trim().length === 0) {
      throw new EditorialGenerationError(
        'LLM_EMPTY_RESPONSE',
        'The AI model returned an empty response. Try regenerating.',
      );
    }

    const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
    try {
      composed = JSON.parse(cleaned);
      parsed = true;
      if (attempt > 1) {
        console.info('[generate] json_parse_recovered_on_resample', { _cid, attempt });
      }
      break;
    } catch (parseError: any) {
      const willResample = attempt < MAX_PARSE_ATTEMPTS;
      const diag = describeJsonParseFailure(cleaned, parseError);
      console.error(
        willResample
          ? '[generate] JSON parse failed — resampling once'
          : '[generate] JSON parse failed — hard-failing (no repair)',
        {
          _cid,
          attempt,
          projectId: input.project?.id,
          error: parseError?.message,
          position: diag.position,
          snippet: diag.snippet,
          rawLength: cleaned.length,
          stopReason: llmResult.data.stop_reason,
          outputTokens: llmResult.data.usage?.output_tokens,
        },
      );
    }
  }

  if (!parsed) {
    throw new EditorialGenerationError(
      'LLM_JSON_PARSE',
      'The AI model returned malformed output (invalid JSON). Try regenerating.',
    );
  }

  console.log('[GENERATE] LLM call complete, proceeding to repair', { _cid });

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

    // Product Naming Gate (spec 20): the single deterministic chokepoint over
    // final prose. A product name survives into published prose only if its
    // vendor is subscribed, an approved boost exists for it on this post, or the
    // posting account is ENTERPRISE — otherwise the name is replaced with a
    // descriptor. Credits and the materials ledger are never scrubbed. This
    // catches names from the designer's own answer, not just the model's.
    blocks = await applyProseNamingGate(blocks, input, _cid);

    return { blocks };
  } catch (repairError: any) {
    console.log('[GENERATE] repairAndBuildBlocks THREW:', repairError?.message ?? repairError, { _cid });
    throw new EditorialGenerationError(
      'LLM_REPAIR_FAILED',
      'The generated draft did not pass validation. Try regenerating.',
    );
  }
}
