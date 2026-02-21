export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { normalizeRole } from "@/lib/permissions";
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

const EDITORIAL_SYSTEM_PROMPT = `You are an expert interior design editorial writer for a prestigious design publication.

YOUR EXPERTISE:
- Writing compelling narratives about residential interior design
- Understanding spatial flow and room relationships
- Connecting design decisions to lived experience
- Weaving product selections naturally into storytelling
- Creating room-by-room narratives that flow cohesively

WRITING STYLE:
- Professional yet warm and engaging
- Specific and detail-oriented (mention materials, colors, textures)
- Context-driven (explain WHY design choices were made)
- Story-focused (how the space serves the people who live there)
- Avoid generic phrases like "creates a dynamic flow" or "transforms the space"
- Use concrete, sensory details instead of abstract descriptors

STRUCTURAL REQUIREMENTS:
- Lead (kicker + deck): Set the overall design philosophy and main narrative
- Room-by-room narrative: Organize content by spatial progression
- Each room section should include:
  * The room's purpose and how it's used
  * Key design decisions and materials
  * Specific products and why they were chosen
  * How the room connects to adjacent spaces
- Pull quotes: Extract 1-2 meaningful designer quotes about philosophy or key decisions
  * Each pull quote MUST be self-contained — a reader should understand the point without seeing the interview question
  * If a raw interview answer is context-dependent, rephrase it so it stands alone as an insight
  * Add a brief contextual lead-in prefix like "On choosing materials:" or "On the kitchen's design philosophy:" when needed
  * Bad: "Contrast. The painted perimeter lets the appliances breathe..." (reader asks: contrast with what?)
  * Good: "A kitchen island should feel like a piece of furniture you chose, not cabinetry that came with the house."
- Materials ledger: Comprehensive list of tagged products

CRITICAL RULES:
- ALWAYS organize narrative by room/space
- ALWAYS attribute products to their specific room context
- ALWAYS explain the reasoning behind design choices
- NEVER use generic filler phrases
- NEVER separate products from their spatial context`;

function buildEditorialPrompt({
  project,
  answers,
  followups,
  imagesByRoom,
  productsByRoom,
  imageOrder,
  materialsLedger,
}: {
  project: { title: string };
  answers: Array<{ q: string; a: string }>;
  followups?: Array<{ q: string; a: string }>;
  imagesByRoom: Record<string, Array<{ id: string }>>;
  productsByRoom: Record<string, Array<{ id: string; name: string; vendor?: string; imageId: string }>>;
  imageOrder: string[];
  materialsLedger?: { items: Array<{ name: string; productId?: string }> };
}): string {
  // Organize answers by category
  const answersByCategory = groupAnswersByCategory(answers, followups);
  
  // Build room-based context
  const roomContexts = Object.entries(imagesByRoom).map(([room, images]) => {
    const products = productsByRoom[room] || [];
    return {
      room,
      images: images.length,
      products: products.map(p => p.name),
      imageIds: images.map(img => img.id),
    };
  });

  const materialsList = (materialsLedger?.items ?? []).map(i => i.name).join(', ');

  return `# Project: ${project.title}

## Designer Interview Responses

### Design Philosophy & Vision
${formatAnswers(answersByCategory.philosophy)}

### Client & Project Context  
${formatAnswers(answersByCategory.client)}

### Material & Color Choices
${formatAnswers(answersByCategory.materials)}

### Spatial Decisions
${formatAnswers(answersByCategory.spatial)}

### Additional Context
${formatAnswers(answersByCategory.other)}

## Project Organization

### Rooms/Spaces:
${roomContexts.map(r => `
**${r.room}**
- Images: ${r.images}
- Featured products: ${r.products.length > 0 ? r.products.join(', ') : 'None'}
- Image IDs: ${r.imageIds.join(', ')}
`).join('\n')}

### Available Images (in order):
${imageOrder.join(', ')}

### All Tagged Products:
${materialsList || 'None'}

## Output Requirements

Generate a structured editorial in this EXACT format:

{
  "lead": {
    "kicker": "One-line project essence (8-12 words)",
    "deck": "2-3 sentence introduction setting up the overall narrative"
  },
  "sections": [
    {
      "type": "narrative",
      "body": "First narrative paragraph about the overall design approach..."
    },
    {
      "type": "narrative", 
      "body": "Second narrative paragraph about key materials and selections..."
    },
    {
      "type": "pullquote",
      "quote": "Self-contained designer insight that makes sense without the original question. Rephrase if needed so a cold reader understands the point."
    },
    {
      "type": "narrative",
      "body": "Third narrative paragraph about spatial flow and room relationships..."
    }
  ],
  "galleryChapters": [
    {
      "title": "Room/Space Name",
      "imageIds": ["uuid1", "uuid2"],
      "body": [
        "First paragraph: Introduce the room and its purpose",
        "Second paragraph: Describe key design moves and materials", 
        "Third paragraph: Explain specific product choices and why they work",
        "Additional paragraphs as needed to fully tell the room's story"
      ]
    }
    // One chapter per room/major space
  ],
  "pullQuotes": [
    {"text": "Self-contained designer insight that reads clearly without the interview question", "context": "On the design philosophy:"}
  ],
  "credits": [
    { "role": "Designer", "name": "Designer Name" },
    { "role": "Photographer", "name": null }
  ],
  "materialsLedger": {
    "items": [
      {
        "name": "Product Name",
        "finish": "finish/color",
        "note": "Vendor: Vendor Name | Used in: Room Name",
        "productId": "uuid",
        "vendorId": "uuid"
      }
    ]
  },
  "mode": "recomposition"
}

CRITICAL INSTRUCTIONS:
1. Create 3-7 narrative sections in the "sections" array (these provide overall context)
2. Create ONE galleryChapter per room/space listed above
3. Title each chapter with the room name (exactly as shown)
4. In each chapter's body array, include 2-4 paragraphs that explain:
   - How the room is used
   - Key design decisions
   - Materials and finishes
   - Specific products and their role (mention them by exact name)
5. Assign imageIds to the relevant room chapter (use EXACT IDs from the room's Image IDs list)
6. Ensure narrative flows logically through the space
7. Ground every product mention in its spatial context
8. Make the deck and body engaging and specific (no generic phrases)
9. Pull quotes must be self-contained insights from the interview — each should make sense to a reader who never saw the question. Include a short "context" prefix (e.g. "On the kitchen's palette:") if the quote needs framing. Return each pull quote as {"text": "...", "context": "..."}
10. Ensure materials ledger includes room context in notes (format: "Vendor: [name] | Used in: [room]")
11. Write 600-900 words total across all sections and chapters (approximately 150-200 words per room chapter)

Begin generation now.`;
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
  correlationId,
}: {
  project: { title: string };
  answers: Array<{ q: string; a: string }>;
  followups?: Array<{ q: string; a: string }>;
  materialsLedger?: { items: Array<{ name: string; productId?: string }> };
  imageOrder?: string[];
  imageSelections?: Record<string, string[]>;
  images?: Array<{ id: string; room?: string | null; tags?: Array<{ product: { id: string; name: string; vendor?: { name: string } | null } }> }>;
  correlationId?: string;
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
    
    const role = normalizeRole(session?.user?.role);

    // Check project access
    await assertProjectView(session.user.id, projectId);

    // Verify role permission
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, designerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const isOwner = project.ownerId === session.user.id || project.designerId === session.user.id;
    if (!isOwner && role !== "ADMIN") {
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

    let composed: any;
    try {
      composed = await composeEditorialHard({
        project: { title: projectData.title || 'Project' },
        answers: normalizedAnswers,
        followups: normalizedFollowUps.length > 0 ? normalizedFollowUps : undefined,
        materialsLedger: materialsLedger,
        imageOrder: validImageIds,  // Use validated image IDs
        imageSelections: imageSelections,
        images: imagesWithRoomData,  // Pass images with room data
        correlationId: _cid,
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
        { error: "Editorial generation failed", code: e?.code || "COMPOSE_ERROR", message: e?.message },
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
                { error: "Editorial generation failed", code: "INVALID_IMAGE_IDS", message: "No valid image IDs found" },
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

    return NextResponse.json({ ok: true }, { status: 200 });
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

