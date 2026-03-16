export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite } from "@/lib/authz/access";
// Removed toFallbackBlocks import - hard-fail mode doesn't use fallbacks
import { BlocksSchema } from "@/lib/posting/schemas";
import { rateLimit } from "@/lib/rateLimit";
import { logPassiveEvent } from "@/lib/analytics";
import { cid } from "@/lib/utils/correlation";
import { summarizeBudget, ensureUnder } from "@/lib/posting/contextBudget";
import { compactImages, compactProducts, frameNarrativePrompt, softModerate } from "@/lib/posting/promptBuilders";
import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from "@/lib/posting/llmClient";
import { z } from "zod";
import { LlmComposedLooseSchema, ComposedDraftSchema } from "@/lib/posting/schemas";

const USER_DAILY_LIMIT = 5;
const PROJECT_MINUTE_LIMIT = 1;
const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

// Safe body reader that doesn't consume the stream
async function readJsonBody(req: Request) {
  try {
    // allow using both body and query string
    const url = new URL(req.url);
    const qpForce = url.searchParams.get('forceOverwriteDraft') === 'true';
    const clone = req.clone();
    const json = await clone.json().catch(() => ({}));
    return { ...json, forceOverwriteDraft: json?.forceOverwriteDraft ?? qpForce };
  } catch {
    return {};
  }
}

// Minimal sections shape for runtime validation (kept local to route)
const SectionSchema = z.object({
  type: z.enum(["narrative", "pullquote", "qa"]),
  heading: z.string().optional(),
  body: z.string().optional(),
  quote: z.string().optional(),
  qa: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
});

const SectionsSchema = z.array(SectionSchema).min(3).max(8);

// --- helpers ---
function normLead(lead: any) {
  if (!lead || typeof lead !== 'object') lead = {};
  const title = (lead.title ?? lead.kicker ?? '').toString().trim();
  const dek = (lead.dek ?? lead.deck ?? '').toString().trim();
  return { title, dek };
}

function toMaterialsArray(materialsLedger: any): string[] {
  const items = materialsLedger?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((it: any) => (typeof it?.name === 'string' ? it.name.trim() : null))
    .filter(Boolean);
}

function pullNarrativeParas(sections: any[], n = 3): string[] {
  if (!Array.isArray(sections)) return [];
  return sections
    .filter(s => s?.type === 'narrative' && typeof s?.body === 'string' && s.body.trim())
    .map(s => s.body.trim())
    .slice(0, n);
}

// gentle cleanup that *does not* change meaning; does not touch quotes
function sentenceCase(s: string) {
  const t = s.trim();
  if (!t) return t;
  const first = t[0].toUpperCase();
  return first + t.slice(1);
}

function ensureEndPunct(s: string) {
  const t = s.trim();
  if (!t) return t;
  return /[.!?]"?$/.test(t) ? t : t + '.';
}

// Helpers for repair phase
const sentenceCap = (s?: string) => {
  if (!s) return s;
  const t = s.trim();
  if (!t) return t;
  // capitalize first letter, keep quotes verbatim elsewhere
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const cleanParagraph = (s?: string) => {
  if (!s) return s;
  // normalize whitespace, fix stray double spaces, keep actual quotes intact
  return sentenceCap(s.replace(/\s+/g, ' ').replace(/\s+([,.!?:;])/g, '$1'));
};

// Helper functions for recomposition mode
function parseJSON(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function synthesizeFromAnswers(
  answers: { q: string; a: string }[],
  followups: { q: string; a: string }[],
  selections: string[]
): string {
  const key = [...answers, ...followups].map(x => x.a).join(' ');
  // Very simple synthesis; the LLM already tried — this is a resilience fallback
  return `This project balances utility and personality. ${key.slice(0, 1500)} ... ` +
    (selections?.length ? `Key materials include ${selections.join(', ')}.` : '');
}

function chunkToParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\.(\s|$)/)
    .map(s => s?.trim())
    .filter(Boolean)
    .map(s => s.endsWith('.') ? s : s + '.')
    .filter(p => p.length > 20); // Filter out very short fragments
}

// Helper function to split a very long paragraph into smaller chunks at sentence boundaries
function splitLongParagraph(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  
  // Split on sentence boundaries (period, exclamation, question mark followed by space and capital)
  const sentences = text.split(/([.!?]+\s+(?=[A-Z]))/);
  const chunks: string[] = [];
  let current = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const candidate = current + sentences[i];
    
    // If adding this sentence would exceed maxLength, save current chunk and start new one
    if (candidate.length > maxLength && current.length > 0) {
      chunks.push(current.trim());
      current = sentences[i];
    } else {
      current = candidate;
    }
  }
  
  // Add remaining text
  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }
  
  // Safety check: if any chunk is still too long, truncate it (shouldn't happen, but be safe)
  return chunks.map(chunk => chunk.length > 5000 ? chunk.substring(0, 5000) : chunk);
}

// Conservative fixes outside quotes; never alter quoted text
function proofOutsideQuotes(paragraph: string): string {
  if (!paragraph || !paragraph.trim()) return paragraph;
  
  let result = paragraph.trim();
  
  // Common product name fixes (case-insensitive, outside quotes only)
  result = result.replace(/\bmodern abstract painting #abav261\b/gi, 'Modern Abstract Painting #ABAV261');
  result = result.replace(/\bgrey onyx\b/gi, 'Grey Onyx');
  result = result.replace(/\bbas stone\b/gi, 'BAS Stone');
  
  // Fix sentence starts (outside quotes only)
  // Split by quotes to preserve quoted text verbatim
  const parts = result.split(/"([^"]*)"/g);
  for (let i = 0; i < parts.length; i += 2) {
    // Only process parts outside quotes (even indices)
    if (parts[i]) {
      // Capitalize first letter after sentence-ending punctuation
      parts[i] = parts[i].replace(/(^|\.\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
    }
  }
  return parts.join('"');
}

// ============================================================================
// ROOM GROUPING HELPER FUNCTIONS
// ============================================================================

function groupImagesByRoom(images: Array<{ id: string; room?: string | null }>): Record<string, Array<{ id: string }>> {
  const byRoom: Record<string, Array<{ id: string }>> = {};
  
  for (const img of images) {
    const room = img.room || 'General';
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push({ id: img.id });
  }
  
  return byRoom;
}

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
    
    // Avoid duplicates by product ID
    if (!byRoom[room].find(p => p.id === product.id)) {
      byRoom[room].push(product);
    }
  }
  
  return byRoom;
}

function groupAnswersByCategory(
  answers: Array<{ q: string; a: string }>,
  followups?: Array<{ q: string; a: string }>
): Record<string, Array<{ q: string; a: string }>> {
  const all = [...answers, ...(followups || [])];
  
  const categories = {
    philosophy: [] as Array<{ q: string; a: string }>,
    client: [] as Array<{ q: string; a: string }>,
    materials: [] as Array<{ q: string; a: string }>,
    spatial: [] as Array<{ q: string; a: string }>,
    other: [] as Array<{ q: string; a: string }>,
  };
  
  for (const qa of all) {
    const qLower = qa.q.toLowerCase();
    
    if (qLower.includes('philosophy') || qLower.includes('vision') || qLower.includes('approach') || qLower.includes('why')) {
      categories.philosophy.push(qa);
    } else if (qLower.includes('client') || qLower.includes('budget') || qLower.includes('timeline') || qLower.includes('who')) {
      categories.client.push(qa);
    } else if (qLower.includes('material') || qLower.includes('color') || qLower.includes('finish') || qLower.includes('what')) {
      categories.materials.push(qa);
    } else if (qLower.includes('space') || qLower.includes('room') || qLower.includes('layout') || qLower.includes('where')) {
      categories.spatial.push(qa);
    } else {
      categories.other.push(qa);
    }
  }
  
  return categories;
}

function formatAnswers(qaList: Array<{ q: string; a: string }>): string {
  if (qaList.length === 0) return 'N/A';
  return qaList.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n');
}

// ============================================================================
// IMPROVED PROMPTS
// ============================================================================

const EDITORIAL_SYSTEM_PROMPT = `You are a senior writer for a prestigious design magazine, writing a feature article about an interior design project. Your writing style is:

- Observational and immersive, like walking through the space with the designer
- Focused on design DECISIONS and the reasoning behind them, not product specifications
- Weaving products into narrative naturally — they emerge in context, not as a list
- Creating a sense of place: how the space feels, how elements relate to each other
- Finding the story arc: what was the challenge, what was the breakthrough, what makes this space singular
- Respectful of craft, focused on work not personality

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

NARRATIVE STRUCTURE:
- Open with the space's defining tension or idea (not a product list)
- Build through the design logic: how decisions cascaded from one to the next
- Let products appear naturally as supporting evidence for design decisions
- Close with the emotional or experiential quality of the finished space

STRUCTURE — EDITORIAL HIERARCHY:
- NOT every room deserves equal coverage. Spend words where the story is.
- Identify the 1-2 rooms with the strongest design decisions, material stories, or interview content. These get 60-70% of the word budget.
- Remaining rooms get 1-2 sentences each — enough to establish continuity, not enough to bore.
- Every room the designer discussed in the interview MUST receive editorial coverage. Rooms with more interview content deserve proportionally more space.
- The piece should NOT read as a room-by-room tour. Organize by design idea, material story, or decision arc — but every discussed room must appear somewhere in the narrative.
- Vary paragraph length deliberately. A 2-sentence paragraph followed by a 6-sentence paragraph creates rhythm. Five 4-sentence paragraphs creates sleep.

FOLLOW-UP ANSWERS:
- Answers tagged [FOLLOW-UP] contain the richest editorial material — process stories, client anecdotes, tradeoff explanations, and behind-the-scenes details.
- Surface these as embedded anecdotes, attributed perspective, or specific process details that give the piece texture beyond physical description.
- Do NOT flatten follow-up content into generic descriptive prose. Follow-ups are what make this editorial sound like a person wrote it, not an AI.

DIRECT QUOTES — MANDATORY:
- Include at least 2 direct quotes from the designer in the article body.
- Direct quotes are EXACT WORDS from the interview answers below, wrapped in quotation marks and attributed: "Quote here," says the designer. Or: "Quote here," the designer explains.
- Choose quotes that reveal personality, decision-making, or surprise. NOT quotes that summarize the room's aesthetic.
- You may lightly trim for length (remove filler words) but do NOT rewrite the designer's words into your own voice.
- If the designer said "I didn't want a bathroom that felt like a hotel you're afraid to touch" — use THAT. Do not turn it into "the designer sought to avoid a hotel-like aesthetic."
- Pull quotes (the large-format callout quotes) must ALSO be verbatim from the interview, not paraphrased summaries.
- Include 2-3 pull quotes per article. If the interview contains designer statements about specific materials, tradeoffs, or process decisions, those are your pull quotes.
- Each pull quote MUST be self-contained — a reader should understand the point without seeing the interview question.
- Pull quotes from [FOLLOW-UP] answers are often the strongest — they contain the specific stories and reasoning that make great callout quotes.
- Add a brief contextual lead-in prefix like "On choosing materials:" or "On the kitchen's design philosophy:" when needed.

ACCURACY RULES — NON-NEGOTIABLE:
- You may ONLY reference products, materials, and vendors that appear in the provided product tag data below. Do not invent product names, vendor names, material origins, or finishes.
- Do not claim to know materials, country of origin, manufacturing methods, or finish types unless explicitly stated in the interview answers or product tag data.
- Do not fabricate designer quotes. Pull quotes must be drawn directly from the interview answers provided. If no suitable quote exists for a section, omit the pull quote — do not generate one.
- Do not invent lifestyle details about the clients (how they entertain, family routines, number of guests) unless the designer explicitly described this in their interview answers.
- Do not describe what you cannot verify from the provided data. If you don't know what material the floor is, don't name one. Describe what the interview and tags tell you; stay silent on what they don't.
- When referencing a product, use the EXACT product name and vendor name from the tag data. Do not paraphrase product names.

The article should make a reader want to visit this space, not inventory it.`;

function buildEditorialPrompt({
  project,
  answers,
  followups,
  imagesByRoom,
  productsByRoom,
  imageOrder,
  materialsLedger,
  designerName,
  location,
  designerBio,
  projectHistory,
  atelierSummary,
  roomsWithAnswers,
}: {
  project: { title: string; description?: string | null; projectType?: string | null; clientType?: string | null };
  answers: Array<{ q: string; a: string }>;
  followups?: Array<{ q: string; a: string }>;
  imagesByRoom: Record<string, Array<{ id: string }>>;
  productsByRoom: Record<string, Array<{ id: string; name: string; vendor?: string; imageId: string }>>;
  imageOrder: string[];
  materialsLedger?: { items: Array<{ name: string; productId?: string }> };
  designerName?: string;
  designerStudio?: string;
  location?: string;
  designerBio?: string;
  projectHistory?: string;
  atelierSummary?: string;
  roomsWithAnswers?: Map<string, number>;
}): string {
  // Separate Layer 1 (base) and Layer 2 (follow-up/deeper) answers
  const hasFollowups = followups && followups.length > 0;

  // Build room-based context
  const roomContexts = Object.entries(imagesByRoom).map(([room, images]) => {
    const products = productsByRoom[room] || [];
    return {
      room,
      images: images.length,
      products: products.map(p => `${p.name}${p.vendor ? ` (${p.vendor})` : ''}`),
      imageIds: images.map(img => img.id),
    };
  });

  const materialsList = (materialsLedger?.items ?? []).map(i => i.name).join(', ');

  // Format interview responses with [BASE] / [FOLLOW-UP] tags
  const baseText = answers.map(qa => `[BASE] Q: ${qa.q}\nA: ${qa.a}`).join('\n\n');
  const followupText = (followups || []).map(qa => `[FOLLOW-UP] Q: ${qa.q}\nA: ${qa.a}`).join('\n\n');
  const interviewText = [baseText, followupText].filter(Boolean).join('\n\n');

  // Determine narrative depth instruction based on interview depth
  const depthInstruction = hasFollowups
    ? `The designer provided both initial responses and deeper follow-up answers. Use the follow-up answers for richer material — they contain the specific stories, reasoning, and evolution behind decisions. Write a full-depth feature.`
    : `Only initial interview responses are available. Write a tighter, more observational piece — focus on what the space achieves and let the design decisions speak through specific details rather than extended backstory.`;

  return `Write a feature article about this project.

## Designer's Interview Responses
${interviewText}

## Project Details
- Project: ${project.title}
- Designer: ${designerName || 'Not specified'}${designerStudio ? ` / ${designerStudio}` : ''}
- Location: ${location || 'Not specified'}${project.description ? `\n- Project description: ${project.description}` : ''}${project.projectType && project.projectType !== 'UNSPECIFIED' ? `\n- Project type: ${project.projectType.toLowerCase().replace(/_/g, ' ')}` : ''}${project.clientType ? `\n- Client type: ${project.clientType.toLowerCase()}` : ''}
- Rooms: ${roomContexts.map(r => r.room).join(', ')}
- Products tagged: ${materialsList || 'None'}

PROJECT CONTEXT: The project description is the narrative frame — it captures who the client is, what prompted the project, and what they asked for. Use it to open and thread through the piece. Location should inform design vocabulary (reference local light, climate, landscape). Do NOT open with "Nestled in..." or use the description verbatim — synthesize into narrative.${designerBio ? `

## Designer Bio (use to inform tone and context — do not quote directly or paraphrase into the article. This helps you understand who is speaking in the interview)
${designerBio}` : ''}${projectHistory ? `

## Designer's Other Published Projects on Folio (use for context about their body of work — reference only if it genuinely enriches the narrative, e.g., "a departure from their typical palette" or "continuing a thread from previous work." Do not force references)
${projectHistory}` : ''}${atelierSummary ? `

## Designer Voice & Philosophy (from their Folio profile — use to inform tone, do not quote directly)
${atelierSummary}` : ''}

### Room Organization
${roomContexts.map(r => `**${r.room}** — ${r.images} images, products: ${r.products.length > 0 ? r.products.join(', ') : 'none'}\n  Image IDs: ${r.imageIds.join(', ')}`).join('\n')}
${roomsWithAnswers && roomsWithAnswers.size > 0 ? `
### Rooms with Interview Content (DO NOT OMIT ANY):
${Array.from(roomsWithAnswers.entries()).map(([room, count]) => `- ${room}: ${count} answer${count > 1 ? 's' : ''}`).join('\n')}
` : ''}
### Available Images (in order):
${imageOrder.join(', ')}

## Narrative Depth
${depthInstruction}

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
    {"text": "Self-contained designer insight that reads clearly without the interview question", "context": "On the design philosophy:"}
  ],
  "credits": [{ "role": "Designer", "name": "Designer Name" }, { "role": "Photographer", "name": null }],
  "materialsLedger": {
    "items": [{ "name": "Product Name", "finish": "finish/color", "note": "Vendor: Name | Used in: Room", "productId": "uuid", "vendorId": "uuid" }]
  },
  "mode": "recomposition"
}

## Writing Instructions

FOR THE SECTIONS ARRAY (3-5 narrative sections + 1-2 pullquotes):
- Open with the space's defining tension, challenge, or idea — NOT with a product
- Build through design logic: how one decision led to the next
- Let products emerge as evidence within the story, not as items in a catalog
- Close with the experiential quality of the finished space
- Every paragraph should have a POINT — a design insight, a tension resolved, a relationship revealed
- Do NOT follow the pattern: name product → explain product → next product

FOR GALLERY CHAPTERS:
- Create 2-4 gallery chapters organized by VISUAL STORY, not by room.
- A chapter might span two rooms if they share a material or idea.
- A chapter might cover one corner of one room if that's where the interesting detail is.
- Chapter titles should be observational, not room labels. Not "The Kitchen" — instead "Where the Brass Meets the Stone." Not "Living Room" — instead "A Conversation Between Light and Linen."
- Not every image needs a chapter. Select the images that advance the story.
- 2-4 paragraphs per chapter.
- Products appear in context of decisions, not as standalone descriptions.
- Use EXACT image IDs from the room lists above.

FOR PULL QUOTES:
- Pull quotes must be the designer's ACTUAL WORDS from the interview above
- You may lightly edit for grammar/clarity but do not compose new quotes
- If no quotable moments exist in the interview, return zero pull quotes
- Include a short "context" prefix (e.g. "On the kitchen's palette:") if the quote needs framing
- Return each pull quote as {"text": "...", "context": "..."}
- Maximum 2-3 pull quotes

FOR THE MATERIALS LEDGER:
- Comprehensive product list separate from the narrative
- Include vendor and room context in notes (format: "Vendor: [name] | Used in: [room]")

CRITICAL RULES:
- 600-900 words total across sections and chapters
- Products serve the narrative — the narrative does not serve the products
- No generic design language: ban "thoughtfully curated", "seamlessly blends", "creates a dynamic flow"
- The article should read like a magazine feature, not a product specification sheet

Begin.`;
}

function validateRoomStructure(
  blocks: any,
  rooms: string[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!blocks.galleryChapters || !Array.isArray(blocks.galleryChapters)) {
    issues.push('Missing galleryChapters array');
    return { valid: false, issues };
  }
  
  // Check that each room has a corresponding chapter
  const chapterTitles = blocks.galleryChapters.map((ch: any) => ch.title?.toLowerCase() || '');
  for (const room of rooms) {
    if (room === 'General') continue; // Skip General room
    const roomLower = room.toLowerCase();
    if (!chapterTitles.some((title: string) => title.includes(roomLower))) {
      issues.push(`No chapter found for room: ${room}`);
    }
  }
  
  // Check that each chapter has substantive content
  for (const [idx, chapter] of blocks.galleryChapters.entries()) {
    if (!chapter.title) {
      issues.push(`Chapter ${idx} missing title`);
    }
    if (!chapter.body || !Array.isArray(chapter.body) || chapter.body.length < 2) {
      issues.push(`Chapter ${idx} has insufficient body content (need at least 2 paragraphs)`);
    }
    if (!chapter.imageIds || !Array.isArray(chapter.imageIds) || chapter.imageIds.length === 0) {
      issues.push(`Chapter ${idx} has no images`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

// Hard-fail editorial composition function
async function composeEditorialHard({
  project,
  answers,
  followups,
  materialsLedger,
  imageOrder,
  imageSelections,
  images,
  designerName,
  designer,
  location,
  designerBio,
  projectHistory,
  atelierSummary,
  correlationId,
  roomsWithAnswers,
}: {
  project: { title: string; description?: string | null; projectType?: string | null; clientType?: string | null };
  answers: Array<{ q: string; a: string }>;
  followups?: Array<{ q: string; a: string }>;
  materialsLedger?: { items: Array<{ name: string; productId?: string }> };
  imageOrder?: string[];
  imageSelections?: Record<string, string[]>;
  images?: Array<{ id: string; room?: string | null; tags?: Array<{ product: { id: string; name: string; vendor?: { name: string } | null } }> }>;
  designerName?: string;
  designer?: { studio?: string | null } | null;
  location?: string;
  designerBio?: string;
  projectHistory?: string;
  atelierSummary?: string;
  correlationId?: string;
  roomsWithAnswers?: Map<string, number>;
}): Promise<{
  lead: { kicker: string; deck: string };
  galleryChapters: Array<{ title?: string; imageIds: string[]; body: string[] }>;
  pullQuotes: string[];
  credits: Array<{ role: string; name: string }>;
  materialsLedger?: { items: Array<{ name: string; productId?: string }> };
  mode: 'recomposition';
}> {
  const _cid = correlationId || 'compose-hard';
  const ANTHROPIC_ENABLED = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";
  
  if (!ANTHROPIC_ENABLED) {
    throw Object.assign(new Error("Editorial composition failed: Anthropic API not configured"), { 
      status: 502, 
      code: "COMPOSE_LLM_DISABLED" 
    });
  }

  // Validate that we have image IDs (required for galleryChapters)
  const imageIds = (imageOrder ?? []).filter(id => id && typeof id === 'string' && id.trim().length > 0);
  if (imageIds.length === 0) {
    throw Object.assign(new Error("Editorial composition failed: No image IDs provided"), { 
      status: 502, 
      code: "COMPOSE_NO_IMAGES" 
    });
  }

  // Group data by room if images are provided
  let imagesByRoom: Record<string, Array<{ id: string }>> = {};
  let productsByRoom: Record<string, Array<{ id: string; name: string; vendor?: string; imageId: string }>> = {};
  let rooms: string[] = [];

  if (images && images.length > 0) {
    // Filter images to only those in imageOrder
    const orderedImages = images.filter(img => imageIds.includes(img.id));
    imagesByRoom = groupImagesByRoom(orderedImages);
    rooms = Object.keys(imagesByRoom);

    // Extract tags from images and group products by room
    const allTags = orderedImages.flatMap(img => 
      (img.tags || []).map(tag => ({
        imageId: img.id,
        product: tag.product,
      }))
    );
    productsByRoom = groupProductsByRoom(allTags, orderedImages);

    console.log('[composeEditorialHard] Room-organized data', {
      rooms,
      imagesByRoom: Object.fromEntries(Object.entries(imagesByRoom).map(([k, v]) => [k, v.length])),
      productsByRoom: Object.fromEntries(Object.entries(productsByRoom).map(([k, v]) => [k, v.length])),
      correlationId: _cid,
    });
  } else {
    // Fallback: create a single "General" room with all images
    imagesByRoom = { General: imageIds.map(id => ({ id })) };
    rooms = ['General'];
    console.warn('[composeEditorialHard] No images provided, using fallback room structure', { _cid });
  }

  // Build structured prompt with room organization
  const systemPrompt = EDITORIAL_SYSTEM_PROMPT;
  const userPrompt = buildEditorialPrompt({
    project,
    answers,
    followups,
    imagesByRoom,
    productsByRoom,
    imageOrder: imageIds,
    materialsLedger,
    designerName,
    designerStudio: designer?.studio || undefined,
    location,
    designerBio,
    projectHistory,
    atelierSummary,
    roomsWithAnswers,
  });

  console.log('[composeEditorialHard] Calling Claude API with room-organized prompt', {
    rooms,
    totalImages: imageIds.length,
    totalProducts: Object.values(productsByRoom).flat().length,
    correlationId: _cid,
  });

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  let rawStr = "{}";
  try {
    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    });

    rawStr = response.content[0]?.type === 'text' ? response.content[0].text : "{}";
  } catch (e: any) {
    console.error('[composeEditorialHard] Claude API call failed', { 
      _cid, 
      error: e?.message,
      status: e?.status,
      type: e?.type 
    });
    throw Object.assign(
      new Error(`Editorial composition failed: ${e?.message || 'Claude API call failed'}`),
      { status: 502, code: 'COMPOSE_LLM_ERROR' }
    );
  }
  // Remove markdown code fences if present
  const cleaned = rawStr.replace(/```json\n?|\n?```/g, '').trim();
  const raw = parseJSON(cleaned);
  
  // Validate room structure if we have room data
  if (rooms.length > 0 && rooms[0] !== 'General') {
    const validation = validateRoomStructure(raw, rooms);
    if (!validation.valid) {
      console.warn('[composeEditorialHard] Room structure validation issues', {
        _cid,
        issues: validation.issues,
        rooms,
        chapters: raw.galleryChapters?.map((ch: any) => ch.title),
      });
      // Don't fail hard on validation - log and continue
    }
  }

  // Parse with schema
  const parsed = ComposedDraftSchema.safeParse(raw);
  
  if (!parsed.success) {
    // Log detailed validation errors for debugging
    const errorDetails = parsed.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.code === 'invalid_type' ? typeof (raw as any)[issue.path[0]] : undefined,
    }));
    
    console.error("[composeEditorialHard] invalid LLM JSON", { 
      _cid, 
      errors: errorDetails,
      errorCount: parsed.error.issues.length,
      rawPreview: cleaned.slice(0, 1000),
      rawKeys: Object.keys(raw || {}),
      hasLead: !!(raw as any)?.lead,
      hasGalleryChapters: Array.isArray((raw as any)?.galleryChapters),
      galleryChaptersCount: Array.isArray((raw as any)?.galleryChapters) ? (raw as any).galleryChapters.length : 0,
    });
    
    // Return more detailed error information
    throw Object.assign(new Error(`Editorial composition failed: ${errorDetails.map(e => `${e.path}: ${e.message}`).join('; ')}`), { 
      status: 502, 
      code: "COMPOSE_INVALID",
      issues: errorDetails,
    });
  }

  const composed = parsed.data;

  // Process gallery chapters - prioritize body arrays if present, otherwise use sections
  const finalChapters: Array<{ title?: string; imageIds: string[]; body: string[] }> = [];
  const rawPulls: Array<{ text: string; context?: string }> = [];

  // Extract pull quotes from both pullQuotes array and pullquote sections
  // Handle both string format and {text, context} object format from LLM
  if (Array.isArray(composed.pullQuotes)) {
    for (const q of composed.pullQuotes) {
      if (typeof q === 'string' && q.trim()) {
        rawPulls.push({ text: q.trim() });
      } else if (q && typeof q === 'object' && typeof (q as any).text === 'string' && (q as any).text.trim()) {
        rawPulls.push({ text: (q as any).text.trim(), context: (q as any).context?.trim() || undefined });
      }
    }
  }
  if (Array.isArray(composed.sections)) {
    for (const s of composed.sections) {
      if (s.type === "pullquote" && s.quote) {
        rawPulls.push({ text: s.quote.trim() });
      }
    }
  }

  // Deduplicate pull quotes by text (LLM often puts the same quote in both pullQuotes[] and sections[])
  const pulls = rawPulls.filter((quote, index, arr) =>
    arr.findIndex(q => q.text.trim() === quote.text.trim()) === index
  );

  // Process each gallery chapter
  if (Array.isArray(composed.galleryChapters)) {
    for (const chapter of composed.galleryChapters as any[]) {
      if (!chapter.imageIds || !Array.isArray(chapter.imageIds) || chapter.imageIds.length === 0) {
        console.warn('[composeEditorialHard] Skipping chapter with no imageIds', { _cid, title: chapter.title });
        continue;
      }

      // Validate imageIds are valid UUIDs
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validImageIds = chapter.imageIds
        .filter((id: any) => typeof id === 'string' && uuidPattern.test(id))
        .slice(0, 8);

      if (validImageIds.length === 0) {
        console.warn('[composeEditorialHard] Skipping chapter with no valid imageIds', { _cid, title: chapter.title });
        continue;
      }

      // Process body paragraphs - prioritize chapter.body array if present
      let bodyParas: string[] = [];
      const chapterBody: any = chapter.body;
      if (Array.isArray(chapterBody) && chapterBody.length > 0) {
        // Body is already an array of paragraphs
        for (const para of chapterBody) {
          const text: string = typeof para === 'string' ? para : String(para || '');
          const processed = proofOutsideQuotes(text.trim());
          if (processed.length > 0) {
            bodyParas.push(processed);
          }
        }
      } else if (chapterBody && typeof chapterBody === 'string') {
        // Body is a single string - split into paragraphs
        const bodyText = proofOutsideQuotes(String(chapterBody).trim());
        const paragraphs = bodyText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (trimmed.length > 4500) {
            const subParagraphs = splitLongParagraph(trimmed, 4000);
            bodyParas.push(...subParagraphs);
          } else {
            bodyParas.push(trimmed);
          }
        }
      }

      if (bodyParas.length < 2) {
        console.warn('[composeEditorialHard] Chapter has insufficient body content', {
          _cid,
          title: chapter.title,
          bodyCount: bodyParas.length,
        });
        // Still include it but log warning
      }

      finalChapters.push({
        title: chapter.title || 'Untitled',
        imageIds: validImageIds,
        body: bodyParas.length > 0 ? bodyParas : ['Content pending.'],
      });
    }
  }

  // If no chapters with body arrays, fall back to processing sections into a single chapter
  if (finalChapters.length === 0 || finalChapters.every(ch => ch.body.length === 0 || ch.body[0] === 'Content pending.')) {
    console.log('[composeEditorialHard] No chapters with body, processing sections', { _cid });
    
    // Map sections → narrative paragraphs
    const paras: string[] = [];
    for (const s of composed.sections || []) {
      if (s.type === "narrative" && s.body) {
        const bodyText = proofOutsideQuotes(s.body.trim());
        const paragraphs = bodyText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (trimmed.length > 4500) {
            const subParagraphs = splitLongParagraph(trimmed, 4000);
            paras.push(...subParagraphs);
          } else {
            paras.push(trimmed);
          }
        }
      }
    }
    
    if (paras.length < 3) {
      console.error("[composeEditorialHard] insufficient narrative paragraphs", { 
        _cid, 
        count: paras.length,
        sectionsCount: composed.sections?.length || 0 
      });
      throw Object.assign(new Error("Editorial composition insufficient"), { 
        status: 502, 
        code: "COMPOSE_TOO_SHORT" 
      });
    }

    // Create a single chapter from sections
    const firstChapter = composed.galleryChapters?.[0];
    const chapterImageIds = firstChapter?.imageIds?.filter((id: any) => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return typeof id === 'string' && uuidPattern.test(id);
    }).slice(0, 8) || imageIds.slice(0, 8);

    finalChapters.length = 0; // Clear any empty chapters
    finalChapters.push({
      title: firstChapter?.title || project.title,
      imageIds: chapterImageIds,
      body: paras,
    });
  }

  // Ensure we have at least one chapter
  if (finalChapters.length === 0) {
    throw Object.assign(new Error("Editorial composition failed: No valid gallery chapters"), { 
      status: 502, 
      code: "COMPOSE_NO_CHAPTERS" 
    });
  }

  console.log('[composeEditorialHard] Generated chapters', {
    _cid,
    chapterCount: finalChapters.length,
    chapters: finalChapters.map(ch => ({ title: ch.title, imageCount: ch.imageIds.length, bodyCount: ch.body.length })),
    pullQuotes: pulls.length,
  });

  return {
    lead: composed.lead || { kicker: project.title, deck: '' },
    galleryChapters: finalChapters,
    pullQuotes: pulls.slice(0, 2),
    credits: (composed.credits ?? []).map((c: { role: string; name?: string | null }) => ({
      role: c.role,
      name: c.name ?? '',
    })),
    materialsLedger: composed.materialsLedger ? {
      items: composed.materialsLedger.items.map((item: { name: string; productId?: string | null }) => ({
        name: item.name,
        productId: item.productId ?? undefined,
      })),
    } : undefined,
    mode: "recomposition" as const,
  };
}


// Post-generation accuracy verification (monitoring mode — logs warnings, does not hard-fail)
function verifyProductAccuracy(
  generatedText: string,
  taggedProducts: Array<{ name: string; vendor?: string }>,
  interviewText: string,
): { warnings: string[] } {
  const warnings: string[] = [];
  if (!generatedText || taggedProducts.length === 0) return { warnings };

  const textLower = generatedText.toLowerCase();
  const interviewLower = interviewText.toLowerCase();

  // Build sets of known product and vendor names
  const knownProducts = new Set(taggedProducts.map(p => p.name.toLowerCase()));
  const knownVendors = new Set(
    taggedProducts
      .map(p => p.vendor?.toLowerCase())
      .filter((v): v is string => !!v && v.length > 1)
  );

  // Check for vendor names in text that don't match tagged vendors
  // Extract capitalized multi-word proper nouns that could be vendor names
  const properNounPattern = /(?:by |from |(?:designed|crafted|made) by )((?:[A-Z][a-z]+(?:\s+(?:&\s+)?[A-Z][a-z]+)*))/g;
  let match;
  while ((match = properNounPattern.exec(generatedText)) !== null) {
    const candidate = match[1].trim();
    const candidateLower = candidate.toLowerCase();
    // Skip if it matches a known vendor or product
    if (knownVendors.has(candidateLower)) continue;
    if (knownProducts.has(candidateLower)) continue;
    // Skip if it appears in interview answers (designer mentioned it)
    if (interviewLower.includes(candidateLower)) continue;
    warnings.push(`Possible unverified vendor reference: "${candidate}" — not found in tag data or interview`);
  }

  // Check for material origin claims not backed by data
  const originPattern = /\b(Italian|French|Japanese|Scandinavian|Belgian|Danish|Swedish|German|English|British|Portuguese|Brazilian|Mexican|Moroccan|Indian|Chinese|Korean|Turkish|Greek|Spanish|Dutch|Swiss|Austrian|Norwegian|Finnish|Czech|Polish|Hungarian|Thai|Vietnamese|Indonesian|Filipino|Australian|Canadian|American)\b\s+\b(marble|leather|linen|silk|wool|oak|walnut|teak|ceramic|porcelain|tile|stone|granite|limestone|travertine|slate|brass|bronze|copper|steel|iron|glass|crystal|velvet|cotton|hemp|jute|rattan|bamboo|lacquer|plaster|concrete|terrazzo)\b/gi;
  while ((match = originPattern.exec(generatedText)) !== null) {
    const claim = match[0];
    const claimLower = claim.toLowerCase();
    // Check if this claim appears in interview answers or product data
    const inInterview = interviewLower.includes(claimLower);
    const inProducts = taggedProducts.some(p =>
      p.name.toLowerCase().includes(claimLower) ||
      (p.vendor?.toLowerCase().includes(match![1].toLowerCase()) ?? false)
    );
    if (!inInterview && !inProducts) {
      warnings.push(`Unverified material origin claim: "${claim}" — not found in interview answers or tag data`);
    }
  }

  return { warnings };
}

function polishQA(qa: any[]) {
  if (!Array.isArray(qa)) return [];
  return qa
    .filter(x => x?.q && x?.a)
    .map(x => {
      const q = ensureEndPunct(sentenceCase(String(x.q)));
      // Don't "twist" quotes inside answers: we only adjust casing of the first char and final punctuation if absent.
      let a = String(x.a).trim();
      if (!a.startsWith('"')) a = sentenceCase(a); // if user started with a quote, leave it exactly
      a = ensureEndPunct(a);
      return { q, a, role: x.role ?? 'DESIGNER' };
    });
}

// Fallback: build magazine-style narrative from answers + selections
function synthesizeSectionsFromQA(opts: {
  title: string;
  answers: { q: string; a: string }[];
  selections: string[];
  imageSelections?: Record<string, string[]>;
}) {
  const { title, answers, selections, imageSelections } = opts;
  const text = (s?: string) => (s ?? "").trim();
  const A = answers.map(a => text(a.a)).filter(Boolean);

  const opener = [
    `"${title}" comes together as a confident, lived-in composition—light on spectacle, heavy on intention.`,
    (A[0] ?? ""),
  ].filter(Boolean).join(" ");

  const selectionsLine = selections?.length
    ? `Key selections—${selections.slice(0, 5).join(", ")}—anchor proportion, tone, and texture without shouting.`
    : "";

  const constraints = (A.find(a => /six[- ]?month|timeline|time frame/i.test(a)) ?? "");
  const constraintsLine = constraints ? constraints : "";

  const details = (() => {
    const entries: string[] = [];
    if (imageSelections) {
      Object.entries(imageSelections).slice(0, 4).forEach(([_, labels]) => {
        if (labels?.length) entries.push(`In the details: ${labels.join(", ")} shape rhythm and balance.`);
      });
    }
    return entries.slice(0, 2).join(" ");
  })();

  const closer = `The result is calm, modern, and unmistakably personal—rooms that feel composed, not performed.`;

  return [
    { type: "narrative" as const, body: opener },
    { type: "narrative" as const, heading: "Selections That Carry the Room", body: [selectionsLine, A[1] ?? ""].filter(Boolean).join(" ") },
    { type: "narrative" as const, heading: "On Pace and Process", body: constraintsLine || (A[2] ?? "") },
    { type: "narrative" as const, heading: "In the Details", body: details || (A[3] ?? "") },
    { type: "narrative" as const, body: closer },
  ];
}

const ARRAY_FIELDS: string[] = [
  'galleryChapters',
  'pullQuotes',
  'method',
  'qa',
  'credits',
  // nested arrays:
  'galleryChapters.body',
  'galleryChapters.imageIds',
  // materials ledger
  'materialsLedger.items',
];

// Utility: deep strip keys that contain a dot anywhere in the tree.
function stripDottedKeysDeep(input: any): any {
  if (Array.isArray(input)) return input.map(stripDottedKeysDeep);
  if (input && typeof input === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(input)) {
      if (k.includes(".")) continue; // drop dotted keys at any level
      out[k] = stripDottedKeysDeep(v);
    }
    return out;
  }
  return input;
}

type QAItem = { q: string; a: string; role?: string };
type GalleryChapter = { title?: string; imageIds: string[] };
type Credit = { role: string; name: string };

// Helper functions for composition (duplicates removed - using helpers defined above)

function dedupeLines(text: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\n+/).map(l => l.trim()).filter(Boolean)) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(line);
    }
  }
  return out.join('\n');
}

// Get tagged selections for a project (product tags with vendor info)
async function getTaggedSelections(projectId: string): Promise<{
  allSelections: string[];
  imageSelections: Record<string, string[]>;
}> {
  const tags = await prisma.productTag.findMany({
    where: {
      image: {
        projectId: projectId,
      },
    },
    include: {
      product: {
        include: {
          vendor: {
            select: {
              name: true,
              studio: true,
            },
          },
        },
      },
      image: {
        select: {
          id: true,
        },
      },
    },
  });

  const byImage = new Map<string, string[]>();
  const allSet = new Set<string>();

  for (const tag of tags) {
    const product = tag.product;
    const vendorName = product.vendor?.name || product.vendor?.studio;
    const label = vendorName ? `${product.name} | ${vendorName}` : product.name;
    
    const imageId = tag.image.id;
    const list = byImage.get(imageId) ?? [];
    list.push(label);
    byImage.set(imageId, list);
    
    allSet.add(label);
  }

  return {
    allSelections: Array.from(allSet),
    imageSelections: Object.fromEntries(byImage),
  };
}

// Build materials ledger from tags (matches BlocksSchema structure)
function buildMaterialsLedger(tags: any[]): { items: Array<{ name: string; finish?: string; note?: string; productId?: string; vendorId?: string }> } | undefined {
  const map = new Map<string, { name: string; vendor?: string; finish?: string; productId?: string; vendorId?: string; count: number }>();
  for (const t of tags || []) {
    const p = t?.product;
    if (!p?.id) continue;
    const key = p.id;
    const prev = map.get(key) || {
      name: p.name ?? "Product",
      vendor: p.vendor?.name,
      finish: p.finish || p.category,
      productId: p.id,
      vendorId: p.vendorId,
      count: 0,
    };
    prev.count += 1;
    map.set(key, prev);
  }
  const items = Array.from(map.values()).map(l => ({
    name: l.name,
    ...(l.finish && typeof l.finish === 'string' && l.finish.trim() ? { finish: l.finish.trim() } : {}),
    ...(l.vendor ? { note: `Vendor: ${l.vendor}`.slice(0, 140) } : {}),
    ...(l.productId ? { productId: l.productId } : {}),
    ...(l.vendorId ? { vendorId: l.vendorId } : {}),
  }));
  return items.length > 0 ? { items } : undefined;
}

// Compose editorial blocks using LLM
async function composeEditorial(input: {
  project: { title: string };
  answers: Array<{ q: string; a: string }>;
  followups?: Array<{ q: string; a: string }>;
  materialsLedger?: { items: Array<{ name: string; finish?: string; note?: string }> };
  imageOrder?: string[];
  selections?: string[];
  imageSelections?: Record<string, string[]>;
  correlationId?: string;
  mode?: 'recomposition' | 'verbatim';
}): Promise<any> {
  const _cid = input.correlationId || 'compose';
  const ANTHROPIC_ENABLED = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";

  if (!ANTHROPIC_ENABLED) {
    console.warn('[composeEditorial] LLM disabled, returning minimal structure', { _cid });
    return {
      lead: { deck: input.answers[0]?.a?.slice(0, 240) || `${input.project.title} represents a thoughtful approach to design.` },
      sections: [],
      galleryChapters: [],
      credits: [],
      materialsLedger: input.materialsLedger,
      qa: [],
    };
  }

  // Pick best 3-4 QAs by variety/length
  const qaPool = [...(input.followups ?? []), ...input.answers].filter(x => x?.a?.trim());
  const ranked = qaPool
    .map(x => ({ ...x, score: (x.a?.length ?? 0) + (x.q?.length ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => ({ q: x.q.trim(), a: x.a.trim() }));

  const materialsList = input.materialsLedger?.items?.map(item => 
    item.finish ? `${item.name} (${item.finish})` : item.name
  ) || [];
  const selections = (input.selections ?? []).slice(0, 12);
  const imageIds = (input.imageOrder ?? []).slice(0, 12);
  const mode = input.mode ?? 'recomposition';

  // Magazine tone system prompt
  const sys = [
    "You are Folio's editorial engine.",
    "Write like a top shelter magazine: confident, exacting, sensory, never purple.",
    "American English. Vary sentence length. Avoid generic marketing phrases.",
    "Respect quotes verbatim; do not correct inside quotation marks.",
    "Return ONLY valid JSON—no markdown fences."
  ].join(" ");

  const magazineTone = {
    publicationBlend: "Architectural Digest x Dwell x Dezeen",
    traits: "assured, economical, materials-forward, human, urbane",
  };

  // Build user prompt with explicit JSON contract
  const userPrompt = {
    schema: {
      lead: { kicker: "string", deck: "string" },
      sections: "Array<Section> where Section = { type: 'narrative'|'pullquote'|'qa', heading?: string, body?: string, quote?: string, qa?: Array<{q:string,a:string}> }",
      galleryChapters: [{ title: "string?", imageIds: ["string"] }],
      pullQuotes: ["string"],
      qa: [{ q: "string", a: "string" }],
      credits: [{ role: "string", name: "string" }],
      mode: mode
    },
    guidance: {
      tone: magazineTone,
      lengthWords: "600-900",
      noBullets: true,
      integratedQuotes: true,
      avoidMarketingSpeak: true,
      storyShape: [
        "Scene-setter: 1 tight paragraph framing brief and emotional aim.",
        "Materials-forward middle: explain why key selections work (tone, texture, proportion).",
        "Timeline/constraint stakes if meaningful; keep elegant and brief.",
        "Closing beat: how the home now lives/feels."
      ],
      imageHints: { order: imageIds, selectionsByImage: input.imageSelections ?? {} },
      selections,
      materials: materialsList,
    },
    inputs: { 
      project: input.project,
      answers: input.answers.slice(0, 12), 
      followups: input.followups ?? [], 
      materialsLedger: input.materialsLedger,
      imageOrder: imageIds,
      imageSelections: input.imageSelections 
    }
  };

  const prompt = [
    `Return ONLY valid JSON exactly matching the schema above.`,
    `Requirements:`,
    `- Include { lead: {kicker, deck} } (kicker is the title, deck is the subtitle).`,
    `- Produce 4–6 "narrative" sections with non-empty "body" fields.`,
    `- May include up to 2 "pullquote" sections with "quote" fields.`,
    `- Integrate specific tagged selections naturally in prose by their exact names.`,
    `- If imageSelections exist, include a near-final narrative section titled "In the Details" (3–5 sentences, not bullets), stitching micro-captions into fluid copy.`,
    `- Do not include raw Q&A in sections when mode is 'recomposition'; if useful, compress into prose. You may add a single 'qa' section for admin context, but the final narrative must stand alone.`,
    `- No duplicate lines. Correct capitalization and spelling OUTSIDE of quotation marks only.`,
    `- Pull 1–2 designer quotes verbatim when they're strong; otherwise paraphrase naturally.`
  ].join("\n");

  const anthropicClient = new Anthropic();
  const modelName = 'claude-sonnet-4-20250514';

  const llmResult = await callLLM(
    async () => {
      return await anthropicClient.messages.create({
        model: modelName,
        temperature: 0.55,
        max_tokens: 4000,
        system: sys,
        messages: [
          { role: 'user', content: JSON.stringify(userPrompt, null, 2) + "\n\n" + prompt },
        ],
      });
    },
    { modelName, contextHint: `compose:${input.project.title}`, baseDelayMs: 500 }
  );

  const rawPreview = llmResult.ok
    ? (llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : '{}').slice(0, 800)
    : 'LLM call failed';
  console.log("[composeEditorial] raw.preview", rawPreview);

  let rawJsonString = '{}';
  let composed: any = {};

  if (llmResult.ok) {
    const rawText = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : '{}';
    rawJsonString = rawText.replace(/```json\n?|\n?```/g, '').trim();
    try {
      composed = JSON.parse(rawJsonString);
    } catch (parseError) {
      console.error('[composeEditorial] JSON parse error', { _cid, error: parseError, raw: rawJsonString.substring(0, 500) });
      composed = {};
    }
  } else {
    console.warn('[composeEditorial] LLM call failed', { _cid, code: llmResult.code });
  }
  
  // Return both raw JSON string and parsed object for two-pass validation
  // The handler will do the repair/transform phase using LlmComposedLooseSchema
  return { raw: rawJsonString, composed };
}

// --- TEMP: narrow sanitizer to make Zod happy without touching schemas ---
function sanitizeBlocks(raw: any) {
  // 1) remove dotted keys anywhere
  const base = stripDottedKeysDeep(raw ?? {});
  
  const clone: any = { ...base };

  // 2) lead: ensure object, keep deck, drop unknowns not in schema
  if (clone.lead === undefined || clone.lead === null) {
    // optional, leave as undefined
  } else if (Array.isArray(clone.lead)) {
    clone.lead = {}; // coerce nonsense to empty object (optional field)
  } else if (typeof clone.lead === "object") {
    // Schema allows: kicker, deck (both optional strings)
    const cleaned: any = {};
    if (typeof clone.lead.kicker === 'string') cleaned.kicker = clone.lead.kicker;
    if (typeof clone.lead.deck === 'string') cleaned.deck = clone.lead.deck;
    if (Object.keys(cleaned).length > 0) {
      clone.lead = cleaned;
    } else {
      delete clone.lead;
    }
  } else {
    delete clone.lead;
  }

  // 3) qa: array of {q,a,role}
  if (clone.qa !== undefined && clone.qa !== null) {
    const arr = Array.isArray(clone.qa) ? clone.qa : [clone.qa];
    clone.qa = arr
      .map((item: any): QAItem | null => {
        if (!item || typeof item !== "object") return null;
        const q = String(item.q ?? item.question ?? "").trim();
        const a = String(item.a ?? item.answer ?? "").trim();
        if (!q || !a) return null;
        return { q, a, role: String(item.role ?? "DESIGNER") };
      })
      .filter(Boolean) as QAItem[];
    if (clone.qa.length === 0) delete clone.qa;
  }

  // 4) galleryChapters: [{ title?, imageIds: string[] }]
  if (clone.galleryChapters !== undefined && clone.galleryChapters !== null) {
    const arr = Array.isArray(clone.galleryChapters)
      ? clone.galleryChapters
      : [clone.galleryChapters];
    const cleaned = arr
      .map((ch: any): GalleryChapter | null => {
        if (!ch || typeof ch !== "object") return null;
        const imageIds = Array.isArray(ch.imageIds)
          ? ch.imageIds.filter((s: any) => typeof s === "string" && s.trim())
          : [];
        if (imageIds.length === 0) return null; // schema requires min(1)
        const title =
          typeof ch.title === "string" && ch.title.trim() ? ch.title.trim() : undefined;
        const result: any = { imageIds };
        if (title) result.title = title;
        // Preserve body and pullQuote if present
        if (Array.isArray(ch.body) && ch.body.length > 0) {
          result.body = ch.body.filter((b: any) => typeof b === 'string' && b.trim());
        } else if (typeof ch.body === 'string' && ch.body.trim()) {
          result.body = [ch.body.trim()];
        }
        if (typeof ch.pullQuote === 'string' && ch.pullQuote.trim()) {
          result.pullQuote = ch.pullQuote.trim();
        }
        return result;
      })
      .filter(Boolean) as GalleryChapter[];
    if (cleaned.length > 0) clone.galleryChapters = cleaned;
    else delete clone.galleryChapters; // optional field
  }

  // 5) credits: array of {role,name}
  if (clone.credits !== undefined && clone.credits !== null) {
    const arr = Array.isArray(clone.credits) ? clone.credits : [clone.credits];
    const cleaned = arr
      .map((c: any): Credit | null => {
        if (!c || typeof c !== "object") return null;
        const role = String(c.role ?? "").trim();
        const name = String(c.name ?? "").trim();
        if (!role || !name) return null;
        const result: any = { role, name };
        if (typeof c.url === 'string' && c.url.trim()) {
          result.url = c.url.trim();
        }
        return result;
      })
      .filter(Boolean) as Credit[];
    if (cleaned.length > 0) clone.credits = cleaned;
    else delete clone.credits; // optional field
  }

  return clone;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const _cid = cid('generate');
  const projectId = params.projectId; // Extract early for catch block access
  let duration = 0;
  
  /* [AUDIT] START: log incoming projectId, lock status, and critical branches. */
  console.log("[AUDIT] generate:start", { projectId, _cid });
  const _dbg = (label: string, obj: any) => {
    try { 
      const str = JSON.stringify(obj, null, 2);
      console.log(`[AUDIT] ${label}:`, str.slice(0, 5000));
      if (str.length > 5000) {
        console.log(`[AUDIT] ${label} (truncated, total length: ${str.length})`);
      }
    } catch (e) { 
      console.log(`[AUDIT] ${label} (circular or non-serializable)`, String(e));
    }
  };
  
  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json(
        { error: "posting_disabled" },
        { status: 404 }
      );
    }

    // Read body first (safe reader that doesn't consume stream)
    const body = await readJsonBody(request);
    const forceOverwriteDraft = Boolean(body.forceOverwriteDraft);
    const debugEcho = Boolean(body.debugEcho);
    const callSource = body?.source || request.headers.get("x-debug-client") || "unknown";
    const force = Boolean(body.force);
    const answersOverride = Array.isArray(body.answersOverride) ? body.answersOverride : undefined;
    const followupsOverride = Array.isArray(body.followupsOverride) ? body.followupsOverride : undefined;

    // Editorial context toggles (default: include everything available)
    const includeBio = body.includeBio !== false;
    const includeProjectHistory = body.includeProjectHistory !== false;

    // Always use recomposition mode (hard-fail editorial)
    const mode = 'recomposition' as const;

    console.log("[AUDIT] generate:entry", {
      projectId,
      forceOverwriteDraft,
      source: callSource,
      debugEcho,
      mode,
      overrides: {
        answers: Array.isArray(answersOverride) ? answersOverride.length : 0,
        followups: Array.isArray(followupsOverride) ? followupsOverride.length : 0,
      },
      _cid,
    });

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting
    // Always apply user-level daily limit
    const rl1 = rateLimit({
      userId: session.user.id,
      scope: "draft:user:day",
      limit: USER_DAILY_LIMIT,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl1.ok) {
      return NextResponse.json(
        { error: "rate_limited_user", resetAt: rl1.resetAt },
        { status: 429 }
      );
    }

    // Skip project-level rate limit when force=true (explicit overwrite)
    // This allows immediate retry after 409 conflict
    if (!force) {
      const rl2 = rateLimit({
        userId: projectId,
        scope: "draft:project:minute",
        limit: PROJECT_MINUTE_LIMIT,
        windowMs: 60 * 1000,
      });
      if (!rl2.ok) {
        return NextResponse.json(
          { error: "rate_limited_project", resetAt: rl2.resetAt },
          { status: 429 }
        );
      }
    }

    // Fetch project with all needed data
    const projectData = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            studio: true,
            bio: true,
          },
        },
        images: {
          include: {
            tags: {
              include: {
                product: {
                  include: {
                    vendor: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!projectData) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Fetch rooms for room-answer mapping (used by bridge and room coverage)
    const projectRooms = await prisma.room.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });
    const roomIdToName = new Map(projectRooms.map(r => [r.id, r.name]));

    // Fetch or create post
    let post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        status: true,
        expandedBlocks: true,
        provenance: true,
        slug: true,
        heroAssetId: true,
        excerpt: true,
        credits: true,
      },
    });

    // Check for existing draft and respect forceOverwriteDraft flag
    const draftExists = post && post.status === "DRAFT" && post.expandedBlocks;
    if (draftExists && !forceOverwriteDraft && !debugEcho) {
      console.log('[AUDIT] lock:return-202 (draft exists & no force)');
      return NextResponse.json({ status: 'already_has_draft' }, { status: 202 });
    }

    // if you have a lock, bypass when force=true
    const acquireLock = !forceOverwriteDraft && !debugEcho;
    if (!acquireLock) {
      console.log('[AUDIT] generate:force — skipping lock');
    }

    // Check for generation lock and auto-release stale locks (skip when force=true or debug mode)
    if (acquireLock) {
      const existingLock = (post?.provenance as any)?.interview?.status;
      if (existingLock?.phase === 'generating') {
        const age = Date.now() - (existingLock.startedAt ?? 0);
        if (age < 120000) {
          // Lock is fresh (< 2 minutes), return 202 (in progress)
          console.log("[AUDIT] generate:lock:return-202", { projectId, ageMs: age, reason: "fresh-lock", _cid });
          return NextResponse.json(
            { 
              status: "in-progress",
              message: "Generation is already in progress. Please wait." 
            },
            { status: 202 }
          );
        } else {
          // Lock is stale (> 2 minutes), auto-release it and CONTINUE
          console.log("[AUDIT] generate:stale-lock", { projectId, ageMs: age, _cid });
          console.warn("[posting/interview/generate] Releasing stale generation lock", { _cid, age });
          await prisma.projectPost.update({
            where: { projectId },
            data: {
              provenance: {
                ...(post?.provenance as any || {}),
                interview: {
                  ...((post?.provenance as any)?.interview || {}),
                  status: { phase: 'idle', endedAt: Date.now() },
                },
              } as any,
            },
          });
          // IMPORTANT: do NOT return here — proceed to set a fresh lock
        }
      }
    } else if (debugEcho) {
      console.log("[AUDIT] generate:debug:skip-lock", { projectId, _cid });
    }

    // Always allow overwriting existing drafts - no need to check for existing draft
    // The lock check above handles concurrent generation attempts

    if (!post) {
      const { makeSlug } = await import("@/lib/posting/slug");
      const slug = makeSlug(projectData.title || undefined, projectId);
      post = await prisma.projectPost.create({
        data: {
          projectId,
          slug,
          status: "DRAFT",
        },
        select: {
          id: true,
          projectId: true,
          status: true,
          expandedBlocks: true,
          provenance: true,
          slug: true,
          heroAssetId: true,
          excerpt: true,
          credits: true,
        },
      });
    }

    // Get interview data from provenance
    // If force=true, retry fetching the post in case of recent saves
    let provenance = (post.provenance as any) || {};
    let interview = provenance.interview || {};

    // If force=true and no answers found (and no overrides), wait a bit and refetch (handles race condition)
    const hasOverrideAnswers = Array.isArray(answersOverride) && answersOverride.length > 0;
    if (force && !hasOverrideAnswers && (!interview || !interview.payload?.answers || interview.payload.answers.length === 0)) {
      console.warn("[posting/interview/generate] No answers found on force retry, waiting and refetching...", { _cid });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const refreshedPost = await prisma.projectPost.findUnique({
        where: { projectId },
        select: { provenance: true },
      });

      if (refreshedPost) {
        provenance = (refreshedPost.provenance as any) || {};
        interview = provenance.interview || {};
      }
    }

    // Bridge: If no answers in provenance, check EditorialInterviewAnswer table
    // (The new InterviewFlow writes to EditorialInterviewAnswer, not provenance)
    const provenanceAnswerCount = interview?.payload?.answers?.length || 0;
    if (!hasOverrideAnswers && provenanceAnswerCount === 0) {
      console.log("[posting/interview/generate] No provenance answers, checking EditorialInterviewAnswer table...", { _cid });

      try {
        const editorialInterview = await prisma.editorialInterview.findUnique({
          where: { projectId },
          include: {
            answers: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (editorialInterview && editorialInterview.answers.length > 0) {
          const dbAnswers = editorialInterview.answers.map((a) => ({
            questionId: a.questionId,
            prompt: a.questionText || a.questionId,
            answer: a.answerText,
            role: "DESIGNER",
            isFollowUp: a.isFollowUp,
            section: a.questionSource || "base_question",
            roomName: a.roomId ? roomIdToName.get(a.roomId) || undefined : undefined,
          }));

          const baseDbAnswers = dbAnswers.filter((a) => !a.isFollowUp);
          const followUpDbAnswers = dbAnswers.filter((a) => a.isFollowUp);

          console.log("[posting/interview/generate] Found answers in EditorialInterviewAnswer table", {
            _cid,
            total: dbAnswers.length,
            base: baseDbAnswers.length,
            followUps: followUpDbAnswers.length,
          });

          // Populate interview structure so the rest of the handler works
          if (!interview) interview = {};
          if (!interview.payload) interview.payload = {};
          interview.payload.answers = baseDbAnswers;
          interview.payload.followups = followUpDbAnswers;
          // Use project images as imageOrder if not set
          if (!interview.payload.imageOrder) {
            interview.payload.imageOrder = projectData.images.map((img) => img.id);
          }
        }
      } catch (bridgeErr: any) {
        console.warn("[posting/interview/generate] EditorialInterviewAnswer bridge failed:", bridgeErr?.message, { _cid });
      }
    }

    console.log("[posting/interview/generate] Interview data:", {
      _cid,
      hasInterview: !!interview,
      hasPayload: !!interview?.payload,
      hasAnswers: !!interview?.payload?.answers,
      answerCount: interview?.payload?.answers?.length || 0,
      interviewKeys: interview ? Object.keys(interview) : [],
      payloadKeys: interview?.payload ? Object.keys(interview.payload) : [],
      force,
    });

    // Try to recover answers from alternative provenance paths before giving up
    if (!hasOverrideAnswers && (!interview || !interview.payload?.answers || interview.payload.answers.length === 0)) {
      // Check legacy mirror path: interview.answers (set by POST /interview endpoint)
      const legacyAnswers = interview?.answers;
      if (Array.isArray(legacyAnswers) && legacyAnswers.length > 0) {
        console.warn("[posting/interview/generate] Recovered answers from legacy mirror (interview.answers)", {
          _cid, count: legacyAnswers.length,
        });
        // Inject into interview.payload so downstream code finds them
        if (!interview.payload) interview.payload = {};
        interview.payload.answers = legacyAnswers;
      } else {
        // Last-resort: re-read provenance one more time (handles write-lag from eventual consistency)
        const lastResortPost = await prisma.projectPost.findUnique({
          where: { projectId },
          select: { provenance: true },
        });
        const lastResortProv = (lastResortPost?.provenance as any) || {};
        const lastResortInterview = lastResortProv.interview || {};
        const lastResortAnswers = lastResortInterview.payload?.answers || lastResortInterview.answers || [];

        if (Array.isArray(lastResortAnswers) && lastResortAnswers.length > 0) {
          console.warn("[posting/interview/generate] Recovered answers from last-resort DB re-read", {
            _cid, count: lastResortAnswers.length,
          });
          provenance = lastResortProv;
          interview = lastResortInterview;
          if (!interview.payload) interview.payload = {};
          interview.payload.answers = lastResortAnswers;
        } else {
          console.error("[posting/interview/generate] Missing interview data after all recovery attempts:", {
            _cid,
            interview: !!interview,
            payload: !!interview?.payload,
            payloadAnswers: interview?.payload?.answers?.length ?? 0,
            legacyAnswers: interview?.answers?.length ?? 0,
            provenanceKeys: Object.keys(provenance),
            interviewKeys: interview ? Object.keys(interview) : [],
            hasOverrideAnswers,
          });
          return NextResponse.json(
            { error: "No interview answers found. Please complete the interview first.", code: "NO_ANSWERS" },
            { status: 400 }
          );
        }
      }
    }

    // Extract vendors from product tags
    const vendors = Array.from(
      new Set(
        projectData.images
          .flatMap((img) => img.tags.map((tag) => tag.product.vendorId))
          .filter(Boolean)
      )
    ).map((vendorId) => ({ id: vendorId, name: "Vendor" })); // Simplified; enhance if vendor data available

    const started = Date.now();
    const aiAvailable = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";
    const provider = aiAvailable ? "anthropic" : "fallback";

    // Get follow-ups count from interview data
    // Structure: interview.followUps is Array<{ questionId: string, followUps: Array<{ id, prompt }> }>
    let followupsCount = 0;
    const followups = interview.followUps;
    if (Array.isArray(followups)) {
      followupsCount = followups.reduce((acc, group: any) => {
        return acc + (Array.isArray(group.followUps) ? group.followUps.length : 0);
      }, 0);
    } else if (typeof followups === 'number') {
      followupsCount = followups;
    }

    // Set generation lock before starting (skip when force=true or debug mode)
    if (acquireLock) {
      await prisma.projectPost.update({
        where: { projectId },
        data: {
          provenance: {
            ...((post?.provenance as any) || {}),
            interview: {
              ...(((post?.provenance as any)?.interview) || {}),
              status: { phase: 'generating', startedAt: Date.now() },
            },
          } as any,
        },
      });
    }

    // Use overrides if provided, otherwise use interview data
    const baseAnswers = answersOverride ?? interview.payload.answers ?? [];
    const baseFollowups = followupsOverride ?? interview.followUps ?? interview.followups ?? [];
    
    console.log("[AUDIT] generate:inputs", {
      answersLen: Array.isArray(baseAnswers) ? baseAnswers.length : 0,
      followupsLen: Array.isArray(baseFollowups) ? baseFollowups.length : 0,
      usingOverrides: {
        answers: !!answersOverride,
        followups: !!followupsOverride,
      },
      _cid,
    });

    // Ensure answers is an array and imageOrder is an array or undefined
    const rawAnswers = baseAnswers;
    const answers = Array.isArray(rawAnswers) 
      ? rawAnswers 
      : (rawAnswers && typeof rawAnswers === 'object' ? Object.values(rawAnswers) : []);
    const imageOrder = Array.isArray(interview.payload.imageOrder)
      ? interview.payload.imageOrder
      : undefined;

    // Log the structure for debugging
    if (!Array.isArray(rawAnswers)) {
      console.warn("[posting/interview/generate] Answers is not an array, attempting to convert", {
        _cid,
        rawAnswersType: typeof rawAnswers,
        isArray: Array.isArray(rawAnswers),
        rawAnswersKeys: rawAnswers && typeof rawAnswers === 'object' ? Object.keys(rawAnswers) : null,
        convertedLength: answers.length,
      });
    }

    if (answers.length === 0) {
      console.error("[posting/interview/generate] Answers array is empty after validation", {
        _cid,
        payloadAnswers: interview.payload.answers,
        payloadAnswersType: typeof interview.payload.answers,
        isArray: Array.isArray(interview.payload.answers),
        convertedAnswers: answers,
      });
      return NextResponse.json(
        { error: "No interview answers found. Please complete the interview first." },
        { status: 400 }
      );
    }

    // Extract follow-ups answers from interview payload (use override if provided)
    const followupsAnswers = baseFollowups.length > 0
      ? baseFollowups
      : (Array.isArray(interview.payload.followups) ? interview.payload.followups : []);
    
    // Build follow-ups array for narrative composer
    const followupsArray = followupsAnswers.map((a: any) => ({
      question: a.question || a.prompt || a.q || '',
      answer: a.answer || a.a || '',
    })).filter((f: { question: string; answer: string }) => f.question && f.answer);

    // Extract tagged products from images
    const images = projectData.images || [];
    const allTags = images.flatMap((img) => img.tags || []);

    // Build materials ledger from tags
    const materialsLedger = buildMaterialsLedger(allTags);

    // Get tagged selections for the project
    const { allSelections, imageSelections } = await getTaggedSelections(projectId);

    // Ensure we have imageOrder - fallback to project images if not in interview payload
    let finalImageOrder = imageOrder;
    if (!finalImageOrder || finalImageOrder.length === 0) {
      // Fallback: use project images if no imageOrder in interview payload
      finalImageOrder = images.map(img => img.id).filter(Boolean);
      console.log('[AUDIT] generate: using project images as imageOrder fallback', { 
        count: finalImageOrder.length, 
        _cid 
      });
    }

    // Validate imageOrder has at least one valid UUID (reuse pattern from composeEditorialHard scope)
    const uuidPatternValidate = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validImageIds = (finalImageOrder || []).filter((id: string) => 
      id && typeof id === 'string' && uuidPatternValidate.test(id)
    );

    if (validImageIds.length === 0) {
      console.error('[AUDIT] generate: no valid image IDs found', { 
        imageOrder: finalImageOrder?.length || 0,
        images: images.length,
        _cid 
      });
      return NextResponse.json(
        { error: "No valid image IDs found. Please add images to the project first." },
        { status: 400 }
      );
    }

    // Normalize answers and followups for composition
    // Use prompt/questionText for the question text (not questionId which is an opaque ID)
    const normalizedAnswers = answers.map((a: any) => ({
      q: a.prompt || a.questionText || a.questionId || 'Question',
      a: a.answer || '',
    })).filter((x: { q: string; a: string }) => x.a.trim());

    const normalizedFollowUps = followupsArray.map((f: any) => ({
      q: f.question || f.prompt || 'Follow-up',
      a: f.answer || '',
    })).filter((x: { q: string; a: string }) => x.a.trim());

    // Compose editorial blocks using AI (HARD-FAIL: no fallbacks)
    // Prepare images with room data for room-based organization
    const validImages = images.filter(img => validImageIds.includes(img.id));
    const imagesWithRoomData = validImages.map(img => ({
      id: img.id,
      room: img.room || null,
      tags: img.tags || [],
    }));

    // Log room organization for debugging
    const flatTags = validImages.flatMap(img => 
      (img.tags || []).map(tag => ({
        imageId: img.id,
        product: tag.product,
      }))
    );
    const imagesByRoom = groupImagesByRoom(validImages);
    const productsByRoom = groupProductsByRoom(flatTags, validImages);

    console.log('[ROOM ORGANIZATION]', {
      projectId,
      rooms: Object.keys(imagesByRoom),
      roomDetails: Object.entries(imagesByRoom).map(([room, imgs]) => ({
        room,
        imageCount: imgs.length,
        products: productsByRoom[room]?.length || 0,
        productNames: productsByRoom[room]?.slice(0, 3).map((p: any) => p.name) || [],
      })),
      totalImages: validImages.length,
      totalProducts: flatTags.length,
      _cid,
    });

    // Fetch designer context for editorial generation — all optional, never block generation
    let designerName: string | undefined;
    let designerBio: string | undefined;
    let projectLocation: string | undefined;
    try {
      designerName = projectData.designer?.name || undefined;
      designerBio = includeBio ? (projectData.designer?.bio || undefined) : undefined;
      projectLocation = [projectData.city, projectData.regionState].filter(Boolean).join(', ') || undefined;
    } catch (ctxErr: any) {
      console.warn('[generate] Designer context fetch failed (non-fatal):', ctxErr?.message, { _cid });
    }

    // Fetch designer's other published projects for context
    let projectHistory: string | undefined;
    if (includeProjectHistory && projectData.designerId) {
      try {
        const otherProjects = await prisma.project.findMany({
          where: {
            designerId: projectData.designerId,
            id: { not: projectId },
            isPublic: true,
          },
          select: {
            title: true,
            city: true,
            regionState: true,
            images: {
              select: {
                room: true,
                tags: {
                  select: { product: { select: { name: true } } },
                  take: 3,
                },
              },
              take: 10,
            },
          },
          orderBy: { publishedAt: 'desc' },
          take: 5,
        });
        if (otherProjects.length > 0) {
          projectHistory = otherProjects.map(p => {
            const rooms = [...new Set(p.images.map(img => img.room).filter(Boolean))];
            const topProducts = [...new Set(p.images.flatMap(img => img.tags.map(t => t.product.name)))].slice(0, 3);
            const location = [p.city, p.regionState].filter(Boolean).join(', ');
            return `- ${p.title}${location ? ` (${location})` : ''} — rooms: ${rooms.length > 0 ? rooms.join(', ') : 'N/A'}, materials: ${topProducts.length > 0 ? topProducts.join(', ') : 'N/A'}`;
          }).join('\n');
        }
      } catch (historyErr: any) {
        console.warn('[generate] Project history fetch failed (non-fatal):', historyErr?.message, { _cid });
      }
    }

    // Fetch Atelier fingerprint summary if available
    let atelierSummary: string | undefined;
    if (projectData.designerId) {
      try {
        const fingerprint = await prisma.atelierFingerprint.findFirst({
          where: { designerId: projectData.designerId, ownerType: 'DESIGNER' },
          include: {
            nodes: {
              orderBy: { weight: 'desc' },
              take: 10,
            },
          },
        });
        if (fingerprint && fingerprint.nodes.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const node of fingerprint.nodes) {
            const type = node.nodeType.toLowerCase().replace('_', ' ');
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(node.label);
          }
          atelierSummary = Object.entries(grouped)
            .map(([type, labels]) => `${type}: ${labels.join(', ')}`)
            .join('\n');
        }
      } catch (fingerprintErr: any) {
        console.warn('[generate] Atelier fingerprint fetch failed (non-fatal):', fingerprintErr?.message, { _cid });
      }
    }

    // Build room-answer counts from interview answers (for room coverage enforcement)
    const roomsWithAnswers = new Map<string, number>();
    for (const a of answers) {
      const roomName = (a as any).roomName;
      if (roomName) {
        roomsWithAnswers.set(roomName, (roomsWithAnswers.get(roomName) || 0) + 1);
      }
    }
    if (roomsWithAnswers.size > 0) {
      console.log('[ROOM COVERAGE] Rooms with interview answers:', {
        rooms: Object.fromEntries(roomsWithAnswers),
        _cid,
      });
    }

    let composed: any;
    try {
      composed = await composeEditorialHard({
        project: {
          title: projectData.title || 'Project',
          description: projectData.description,
          projectType: projectData.projectType,
          clientType: projectData.clientType,
        },
        answers: normalizedAnswers,
        followups: normalizedFollowUps.length > 0 ? normalizedFollowUps : undefined,
        materialsLedger: materialsLedger,
        imageOrder: validImageIds,  // Use validated image IDs
        imageSelections: imageSelections,
        images: imagesWithRoomData,  // Pass images with room data
        designerName,
        designer: projectData.designer,
        location: projectLocation,
        designerBio,
        projectHistory,
        atelierSummary,
        correlationId: _cid,
        roomsWithAnswers: roomsWithAnswers.size > 0 ? roomsWithAnswers : undefined,
      });
    } catch (e: any) {
      console.error("[generate] hard-fail:", { code: e?.code, message: e?.message, _cid });
      
      // Unlock if we acquired a lock
      if (acquireLock) {
        try {
          const fresh = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
          const prov = { ...((fresh?.provenance as any) ?? {}) };
          if (prov.interview?.status?.phase === 'generating') {
            prov.interview.status = { phase: 'idle', endedAt: Date.now(), lastDurationMs: Date.now() - started };
            await prisma.projectPost.update({ where: { projectId }, data: { provenance: prov as any } });
          }
        } catch (unlockErr) {
          console.error("[posting/interview/generate] Unlock failed", { _cid, unlockErr });
        }
      }
      
      return NextResponse.json(
        { error: "Story generation failed", code: e?.code || "COMPOSE_ERROR", message: e?.message },
        { status: e?.status || 502 }
      );
    }

    const duration = Date.now() - started;
    
    // Log generated structure for debugging
    console.log('[GENERATED STRUCTURE]', {
      projectId,
      hasLead: !!composed.lead,
      leadKicker: composed.lead?.kicker?.substring(0, 50),
      leadDeck: composed.lead?.deck?.substring(0, 100),
      chapterCount: composed.galleryChapters?.length || 0,
      chapters: composed.galleryChapters?.map((ch: any) => ({
        title: ch.title,
        bodyParagraphs: ch.body?.length || 0,
        imageCount: ch.imageIds?.length || 0,
        firstParagraphPreview: ch.body?.[0]?.substring(0, 80),
      })),
      pullQuotesCount: composed.pullQuotes?.length || 0,
      materialsCount: composed.materialsLedger?.items?.length || 0,
      durationMs: duration,
      _cid,
    });
    
    // composed already has the correct structure from composeEditorialHard:
    // - lead: { kicker, deck }
    // - galleryChapters: [{ title?, imageIds: string[], body: string[] }]
    // - pullQuotes: string[]
    // - credits: Array<{ role, name }>
    // - materialsLedger?: { items: Array<{ name, productId? }> }
    // - mode: 'recomposition'
    
    // Validate and filter imageIds to valid UUIDs (required by BlocksSchema)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (composed.galleryChapters && Array.isArray(composed.galleryChapters)) {
      for (const chapter of composed.galleryChapters) {
        if (Array.isArray(chapter.imageIds)) {
          chapter.imageIds = chapter.imageIds
            .map((id: any) => String(id))
            .filter((id: string) => uuidPattern.test(id))
            .slice(0, 8);
          
          // If no valid UUIDs, fail hard (schema requires at least 1)
          if (chapter.imageIds.length === 0) {
            // Use imageOrder as fallback if available
            const validImageIds = (imageOrder || [])
              .filter((id: string) => uuidPattern.test(String(id)))
              .slice(0, 8);
            
            if (validImageIds.length > 0) {
              chapter.imageIds = validImageIds;
            } else {
              // No valid UUIDs - this should not happen but fail gracefully
              console.error('[AUDIT] generate: no valid imageIds', { _cid });
              if (acquireLock) {
                try {
                  const fresh = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
                  const prov = { ...((fresh?.provenance as any) ?? {}) };
                  if (prov.interview?.status?.phase === 'generating') {
                    prov.interview.status = { phase: 'idle', endedAt: Date.now(), lastDurationMs: duration };
                    await prisma.projectPost.update({ where: { projectId }, data: { provenance: prov as any } });
                  }
                } catch (unlockErr) {
                  console.error("[posting/interview/generate] Unlock failed", { _cid, unlockErr });
                }
              }
              return NextResponse.json(
                { error: "Story generation failed", code: "INVALID_IMAGE_IDS", message: "No valid image IDs found" },
                { status: 502 }
              );
            }
          }
        }
      }
    }
    
    console.log("[AUDIT] generate:compose:summary", {
      lead: !!composed.lead,
      mode: composed.mode,
      narrativeCount: composed.galleryChapters?.[0]?.body?.length || 0,
      pullquotes: composed.pullQuotes?.length || 0,
      galleryChapters: composed.galleryChapters?.length || 0,
      chapterBodyLen: composed.galleryChapters?.[0]?.body?.length || 0,
      durationMs: duration,
      _cid,
    });
    
    // DEBUG DRY-RUN: compose only, do not persist, respond with diagnostic JSON
    if (debugEcho) {
      return NextResponse.json({
        debug: {
          note: "Dry-run only. Nothing saved.",
          projectId,
          callSource,
        },
        composedPreview: {
          lead: composed.lead,
          narrativeCount: composed.galleryChapters?.[0]?.body?.length || 0,
          firstNarrative: composed.galleryChapters?.[0]?.body?.[0] ?? null,
          pullquotes: composed.pullQuotes?.length || 0,
          galleryChaptersCount: composed.galleryChapters?.length || 0,
          galleryFirstChapter: composed.galleryChapters?.[0] ?? null,
        },
        raw: composed,
      });
    }
    
    // Prepare for BlocksSchema validation
    const composedLoose = composed;

    // ---- FINAL STRICT PARSE ----
    // Remove dotted keys before strict parse
    const clean = stripDottedKeysDeep(composedLoose);
    let validatedBlocks: any;
    
    try {
      validatedBlocks = BlocksSchema.parse(clean);
      console.log('[AUDIT] schema: strict parse OK', {
        chapterBodyLen: validatedBlocks?.galleryChapters?.[0]?.body?.length ?? 0,
        pullQuotes: validatedBlocks?.pullQuotes?.length ?? 0,
        mode: validatedBlocks?.mode,
        _cid,
      });
    } catch (e: any) {
      console.error('[AUDIT] schema: strict parse failed', {
        errors: e?.issues ?? e?.errors,
        keys: Object.keys(clean || {}),
        _cid,
      });
      
      // HARD-FAIL: No fallbacks - unlock and return error
      if (acquireLock) {
        try {
          const fresh = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
          const prov = { ...((fresh?.provenance as any) ?? {}) };
          if (prov.interview?.status?.phase === 'generating') {
            prov.interview.status = { phase: 'idle', endedAt: Date.now(), lastDurationMs: duration };
            await prisma.projectPost.update({ where: { projectId }, data: { provenance: prov as any } });
          }
        } catch (unlockErr) {
          console.error("[posting/interview/generate] Unlock failed", { _cid, unlockErr });
        }
      }
      
      return NextResponse.json(
        { error: 'Validation error', code: 'VALIDATION_ERROR', issues: (e?.issues ?? e?.errors ?? []), message: 'Invalid blocks' },
        { status: 502 }
      );
    }
    
    // Ensure mode is set to recomposition (should already be set by composeEditorialHard)
    validatedBlocks.mode = 'recomposition';

    // Post-generation accuracy verification (monitoring mode)
    const allGeneratedText = [
      validatedBlocks.lead?.kicker || '',
      validatedBlocks.lead?.deck || '',
      ...(validatedBlocks.galleryChapters || []).flatMap((ch: any) => ch.body || []),
      ...(validatedBlocks.pullQuotes || []).map((q: any) => typeof q === 'string' ? q : q?.text || ''),
    ].join(' ');
    const allTaggedProducts = validImages.flatMap(img =>
      (img.tags || []).map(tag => ({
        name: tag.product.name,
        vendor: tag.product.vendor?.name,
      }))
    );
    const allInterviewText = normalizedAnswers.map((a: { q: string; a: string }) => `${a.q} ${a.a}`).join(' ') +
      ' ' + normalizedFollowUps.map((f: { q: string; a: string }) => `${f.q} ${f.a}`).join(' ');
    const accuracyCheck = verifyProductAccuracy(allGeneratedText, allTaggedProducts, allInterviewText);
    if (accuracyCheck.warnings.length > 0) {
      console.warn('[EDITORIAL_ACCURACY]', {
        projectId,
        warningCount: accuracyCheck.warnings.length,
        warnings: accuracyCheck.warnings,
        taggedProductCount: allTaggedProducts.length,
        taggedProducts: allTaggedProducts.map(p => `${p.name}${p.vendor ? ` (${p.vendor})` : ''}`),
        _cid,
      });
    }

    // Generation metadata for monitoring
    const allBodyText = (validatedBlocks.galleryChapters || [])
      .flatMap((ch: any) => ch.body || [])
      .join(' ');
    const wordCount = allBodyText.split(/\s+/).filter(Boolean).length +
      (validatedBlocks.lead?.kicker?.split(/\s+/).length || 0) +
      (validatedBlocks.lead?.deck?.split(/\s+/).length || 0);
    const roomsCovered = (validatedBlocks.galleryChapters || []).map((ch: any) => ch.title || 'Untitled');
    const productsInText = allTaggedProducts
      .filter(p => allGeneratedText.toLowerCase().includes(p.name.toLowerCase()))
      .map(p => p.name);
    const productsNotInText = allTaggedProducts
      .filter(p => !allGeneratedText.toLowerCase().includes(p.name.toLowerCase()))
      .map(p => p.name);

    console.log('[EDITORIAL_GENERATION_META]', JSON.stringify({
      projectId,
      wordCount,
      sectionCount: (validatedBlocks.galleryChapters || []).length,
      pullQuoteCount: (validatedBlocks.pullQuotes || []).length,
      roomsCovered,
      productsInText,
      productsInTags: allTaggedProducts.map(p => p.name),
      unmatchedProducts: productsNotInText,
      accuracyWarnings: accuracyCheck.warnings,
      interviewAnswerCount: normalizedAnswers.length,
      hasFollowUps: normalizedFollowUps.length > 0,
      hasBrandProfile: false,
      hasBio: !!designerBio,
      hasProjectHistory: !!projectHistory,
      hasFingerprint: !!atelierSummary,
      durationMs: duration,
      _cid,
    }));

    // Distribute top-level pullQuotes into per-chapter pullQuote fields
    // so both the draft editor and preview can render them inline.
    if (validatedBlocks.pullQuotes?.length && validatedBlocks.galleryChapters?.length) {
      for (let i = 0; i < validatedBlocks.galleryChapters.length && i < validatedBlocks.pullQuotes.length; i++) {
        const q = validatedBlocks.pullQuotes[i];
        validatedBlocks.galleryChapters[i].pullQuote = typeof q === 'string' ? q : q.text;
      }
    }

    // expandedBlocks is the validated structure ready to save
    const expandedBlocks = validatedBlocks;

    // SAVE (replace existing draft using upsert)
    // IMPORTANT: Do NOT clear interview answers - they persist for future AI training
    
    // Get or create slug
    let slug = post?.slug;
    if (!slug) {
      const { makeSlug } = await import("@/lib/posting/slug");
      slug = makeSlug(projectData.title || undefined, projectId);
    }
    
    // Re-read provenance fresh to avoid overwriting concurrent writes (e.g., answer saves
    // that happened during the LLM composition call, which can take 30-60 seconds)
    const freshPostForSave = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });
    const existingProvenance = (freshPostForSave?.provenance as any) || (post?.provenance as any) || {};
    const existingInterview = existingProvenance.interview || {};
    const existingPayload = existingInterview.payload || {};

    // Use the freshest answers: prefer what's in the DB (may have been updated during composition),
    // fall back to what the generate endpoint read at request start, then to overrides
    const freshAnswers = existingPayload.answers?.length > 0
      ? existingPayload.answers
      : (interview?.payload?.answers?.length > 0 ? interview.payload.answers : (answersOverride ?? []));
    const freshFollowups = existingPayload.followups?.length > 0
      ? existingPayload.followups
      : (interview?.payload?.followups ?? []);

    // Auto-populate heroAssetId, excerpt, and credits if missing
    // 1. heroAssetId: use first image from galleryChapters[0].imageIds or projectData.images[0]
    let heroAssetId = post ? post.heroAssetId : null;
    if (!heroAssetId) {
      const firstChapterImageId = expandedBlocks?.galleryChapters?.[0]?.imageIds?.[0];
      if (firstChapterImageId && typeof firstChapterImageId === 'string') {
        // Verify the image exists in the project
        const imageExists = projectData.images.some(img => img.id === firstChapterImageId);
        if (imageExists) {
          heroAssetId = firstChapterImageId;
        }
      }
      // Fallback to first project image if no chapter image
      if (!heroAssetId && projectData.images.length > 0) {
        heroAssetId = projectData.images[0].id;
      }
    }
    
    // 2. excerpt: use lead.deck or first paragraph of body
    let excerpt = post ? post.excerpt : null;
    if (!excerpt || excerpt.trim().length === 0) {
      if (expandedBlocks?.lead?.deck) {
        excerpt = expandedBlocks.lead.deck;
      } else if (expandedBlocks?.galleryChapters?.[0]?.body?.[0]) {
        // Use first paragraph, truncated to 300 chars
        const firstPara = String(expandedBlocks.galleryChapters[0].body[0]);
        excerpt = firstPara.length > 300 ? firstPara.slice(0, 297) + '...' : firstPara;
      } else if (projectData.description) {
        excerpt = projectData.description;
      }
    }
    
    // 3. credits: extract from expandedBlocks.credits
    let credits = post ? post.credits : null;
    if (!credits && expandedBlocks?.credits && Array.isArray(expandedBlocks.credits) && expandedBlocks.credits.length > 0) {
      credits = expandedBlocks.credits;
    }
    
    const saved = await prisma.projectPost.upsert({
      where: { projectId },
      update: {
        status: 'DRAFT',
        expandedBlocks: expandedBlocks,
        ...(heroAssetId ? { heroAssetId } : {}),
        ...(excerpt ? { excerpt } : {}),
        ...(credits ? { credits: credits as any } : {}),
        updatedAt: new Date(),
        // Ensure interview data persists - add metadata about generation
        provenance: {
          ...existingProvenance,
          interview: {
            ...existingInterview,
            generatedAt: Date.now(),
            generatedWith: {
              answerCount: normalizedAnswers.length,
              followupCount: normalizedFollowUps.length,
              selectionCount: allSelections.length,
              imageCount: imageOrder?.length || 0,
            },
            // Keep all original answers and followups intact
            payload: {
              ...existingPayload,
              answers: freshAnswers, // Preserve original answers (re-read fresh)
              followups: freshFollowups, // Preserve original followups (re-read fresh)
              selectedQuestionIds: existingPayload.selectedQuestionIds || interview?.payload?.selectedQuestionIds || [],
              imageOrder: existingPayload.imageOrder || interview?.payload?.imageOrder,
            },
            // Clear generating status if it exists (only if we acquired lock)
            status: acquireLock ? { phase: 'idle', endedAt: Date.now() } : existingInterview.status,
          },
        } as any,
      },
      create: {
        projectId,
        slug,
        status: 'DRAFT',
        expandedBlocks: expandedBlocks,
        ...(heroAssetId ? { heroAssetId } : {}),
        ...(excerpt ? { excerpt } : {}),
        ...(credits ? { credits: credits as any } : {}),
        provenance: {
          interview: {
            generatedAt: Date.now(),
            generatedWith: {
              answerCount: normalizedAnswers.length,
              followupCount: normalizedFollowUps.length,
              selectionCount: allSelections.length,
              imageCount: imageOrder?.length || 0,
            },
            payload: {
              answers: interview.payload.answers,
              followups: interview.payload.followups,
              selectedQuestionIds: interview.payload.selectedQuestionIds,
              imageOrder: interview.payload.imageOrder,
            },
            status: { phase: 'idle' },
          },
        } as any,
      },
    });

    console.log('[AUDIT] generate:saved', {
      projectId,
      mode: expandedBlocks.mode,
      narrativeCount: expandedBlocks?.galleryChapters?.[0]?.body?.length ?? 0,
      chapterBodyLen: expandedBlocks?.galleryChapters?.[0]?.body?.length ?? 0,
      lead: !!expandedBlocks?.lead,
      pullQuotes: expandedBlocks?.pullQuotes?.length ?? 0,
      _cid,
    });

    // Analytics
    await logPassiveEvent({
      type: "draft_generated" as any,
      projectId,
      actorId: session.user.id,
      payload: {
        postId: saved.id,
        provider: 'anthropic',
        duration_ms: duration,
        mode: 'recomposition',
      },
    });

    // Unlock on success (only if we acquired lock)
    if (acquireLock) {
      try {
        console.log("[AUDIT] finally: unlock", { projectId, ok: true, _cid });
        const fresh = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
        const prov = { ...((fresh?.provenance as any) ?? {}) };
        if (prov.interview?.status?.phase === 'generating') {
          prov.interview.status = { phase: 'idle', endedAt: Date.now(), lastDurationMs: duration };
          await prisma.projectPost.update({ where: { projectId }, data: { provenance: prov as any } });
        }
      } catch (unlockErr) {
        console.error("[posting/interview/generate] Unlock failed", { _cid, unlockErr });
      }
    }

    // Fire-and-forget: generate contextual crops for product tags without crops
    try {
      const { generateProductCrop } = await import("@/lib/crops/generateProductCrop");
      const { uploadCrop } = await import("@/lib/crops/uploadCrop");
      const { getCategoryDefaultScale } = await import("@/lib/crops/categoryDefaults");

      const uncropped = await prisma.productTag.findMany({
        where: { image: { projectId }, cropUrl: null },
        include: {
          image: { select: { id: true, url: true, projectId: true } },
          product: { select: { id: true, category: true } },
        },
      });

      if (uncropped.length > 0) {
        console.log(`[generate] Queueing crop generation for ${uncropped.length} tags`, { projectId, _cid });
        // Run in background — don't await, don't block the response
        (async () => {
          let generated = 0;
          // Process 3 at a time
          for (let i = 0; i < uncropped.length; i += 3) {
            const batch = uncropped.slice(i, i + 3);
            const results = await Promise.allSettled(
              batch.map(async (tag) => {
                const crop = await generateProductCrop({
                  tag: { x: tag.x, y: tag.y, category: tag.product.category },
                  sourceImageUrl: tag.image.url,
                });
                await uploadCrop({ buffer: crop.buffer, tagId: tag.id, projectId: tag.image.projectId });
                await prisma.productTag.update({
                  where: { id: tag.id },
                  data: {
                    cropX: tag.x,
                    cropY: tag.y,
                    cropScale: getCategoryDefaultScale(tag.product.category),
                    cropAspect: "1:1",
                  },
                });
              })
            );
            generated += results.filter((r) => r.status === "fulfilled").length;
          }
          console.log(`[generate] Crop generation complete: ${generated}/${uncropped.length}`, { projectId });
        })().catch((err) => {
          console.error("[generate] Background crop generation failed:", err);
        });
      }
    } catch (cropSetupErr) {
      // Don't fail editorial generation if crop setup fails
      console.error("[generate] Failed to set up crop generation:", cropSetupErr);
    }

    return NextResponse.json({
      ok: true,
      meta: {
        designerBioMissing: !designerBio,
        hasProjectHistory: !!projectHistory,
        hasAtelierFingerprint: !!atelierSummary,
      },
    }, { status: 200 });
  } catch (error: any) {
    // Ensure unlock on all error paths — but only write if we actually need to clear a lock
    try {
      console.log("[AUDIT] finally: unlock", { projectId, ok: false, _cid });
      const fresh = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
      const prov = { ...((fresh?.provenance as any) ?? {}) };
      if (prov.interview?.status?.phase === 'generating') {
        // Calculate duration from lock timestamp
        const lockStarted = prov.interview.status.startedAt;
        const lockDuration = lockStarted ? Date.now() - lockStarted : undefined;
        prov.interview.status = { phase: 'idle', endedAt: Date.now(), lastDurationMs: lockDuration };
        // Only write back if we actually changed the lock status
        await prisma.projectPost.update({ where: { projectId }, data: { provenance: prov as any } });
      }
    } catch (unlockErr) {
      console.error("[posting/interview/generate] Unlock failed in catch", { _cid, unlockErr });
    }
    if (error.name === "ZodError") {
      console.error("[posting/interview/generate] ZodError:", {
        errors: error.errors,
        issues: error.issues,
        message: error.message,
      });
      return NextResponse.json(
        { 
          error: "Validation error", 
          issues: error.errors || error.issues,
          message: error.message,
        },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[posting/interview/generate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

