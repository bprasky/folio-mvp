/**
 * Pre-Interview Intelligence Brief
 *
 * Produces a structured "research brief" that a human editor would prepare
 * before interviewing a designer. This brief feeds into:
 * - Question generation (Phase 3)
 * - Follow-up intelligence (Phase 4)
 * - Voice mode Sofia context (Phase 5)
 *
 * Data flow:
 * 1. Gather structured data from DB (rooms, selections, vendors, designer profile)
 * 2. Synthesize via one Claude Sonnet call into narrative + angles
 * 3. Cache in ProjectPost.provenance.interviewBrief
 */

import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import {
  assessProjectContext,
  type ProjectContext,
  type ContextLevel,
} from './contextLevel';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InterviewBrief {
  projectId: string;
  generatedAt: string;

  // Section 1: Project summary (structured data, no LLM)
  projectSummary: {
    title: string;
    rooms: string[];
    contextLevel: ContextLevel;
    isProspective: boolean;
    imageCount: number;
    selectionCount: number;
  };

  // Section 2: Vendor intelligence
  vendorMap: VendorBriefEntry[];
  heroSelections: HeroSelectionEntry[];

  // Section 3: Visual palette (from AI classifications)
  dominantPalette: string[];
  dominantMaterials: string[];
  moodDescriptors: string[];

  // Section 4: Designer context
  designerContext: DesignerBriefContext | null;

  // Section 5: AI-generated narrative (from Claude call, cached)
  visualNotes: string;
  researchNotes: string[];
  suggestedAngles: string[];

  // Cache key
  briefHash: string;
}

export interface VendorBriefEntry {
  name: string;
  count: number;
  rooms: string[];
  heroProducts: string[];
}

export interface HeroSelectionEntry {
  productName: string;
  vendor: string;
  room: string;
}

export interface DesignerBriefContext {
  name: string;
  bio: string | null;
  statedApproach: string | null;
  statedValues: string[];
  priorProjectCount: number;
  priorInterviewCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

/**
 * Compute a stable hash of the input data for cache invalidation.
 * Changes when rooms, selections, or image count change.
 */
function computeBriefHash(context: ProjectContext, designerCtx: DesignerBriefContext | null): string {
  const data = {
    rooms: context.rooms.map((r) => r.name).sort(),
    selections: context.selections.map((s) => `${s.productName}:${s.brand}:${s.room}`).sort(),
    imageCount: context.hasPhotos ? context.rooms.length : 0,
    level: context.level,
    designerApproach: designerCtx?.statedApproach || '',
  };
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

/**
 * Build structured vendor map from project context.
 */
function buildVendorMap(context: ProjectContext): VendorBriefEntry[] {
  return context.dominantVendors
    .filter((v) => v.selectionCount >= 1)
    .map((v) => {
      const heroProducts = context.selections
        .filter((s) => s.brand === v.name && s.isHeroPiece)
        .map((s) => s.productName)
        .slice(0, 3);
      return {
        name: v.name,
        count: v.selectionCount,
        rooms: v.rooms,
        heroProducts,
      };
    });
}

/**
 * Build hero selections list from project context.
 */
function buildHeroSelections(context: ProjectContext): HeroSelectionEntry[] {
  return context.selections
    .filter((s) => s.isHeroPiece)
    .slice(0, 5)
    .map((s) => ({
      productName: s.productName,
      vendor: s.brand,
      room: s.room,
    }));
}

/**
 * Fetch designer context from DesignerReasoningProfile and related data.
 */
async function fetchDesignerContext(
  designerId: string | null | undefined,
): Promise<DesignerBriefContext | null> {
  if (!designerId) return null;

  try {
    const [user, profile, projectCount, interviewCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: designerId },
        select: { name: true, bio: true },
      }),
      prisma.designerReasoningProfile.findUnique({
        where: { userId: designerId },
        select: { statedApproach: true, statedValues: true },
      }),
      prisma.project.count({ where: { ownerId: designerId } }),
      prisma.editorialInterview.count({
        where: { project: { ownerId: designerId }, status: 'COMPLETED' },
      }),
    ]);

    if (!user) return null;

    return {
      name: user.name || 'Designer',
      bio: user.bio || null,
      statedApproach: profile?.statedApproach || null,
      statedValues: profile?.statedValues || [],
      priorProjectCount: projectCount,
      priorInterviewCount: interviewCount,
    };
  } catch (error) {
    console.error('[buildInterviewBrief] Failed to fetch designer context:', error);
    return null;
  }
}

/**
 * Try to load a cached brief from ProjectPost.provenance.
 */
async function getCachedBrief(
  projectId: string,
  expectedHash: string,
): Promise<InterviewBrief | null> {
  try {
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });

    if (!post?.provenance) return null;

    const provenance = post.provenance as Record<string, unknown>;
    const cached = provenance.interviewBrief as InterviewBrief | undefined;

    if (cached && cached.briefHash === expectedHash) {
      return cached;
    }
  } catch {
    // Cache miss — will regenerate
  }
  return null;
}

/**
 * Save brief to ProjectPost.provenance cache.
 */
async function cacheBrief(projectId: string, brief: InterviewBrief): Promise<void> {
  try {
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });

    if (!post) return;

    const provenance = (post.provenance as Record<string, unknown>) || {};
    await prisma.projectPost.update({
      where: { projectId },
      data: {
        provenance: { ...provenance, interviewBrief: brief },
      },
    });
  } catch (error) {
    console.warn('[buildInterviewBrief] Failed to cache brief (non-blocking):', error);
  }
}

// ── AI Synthesis ─────────────────────────────────────────────────────────────

/**
 * Build the prompt for Claude to generate the narrative parts of the brief.
 */
function buildSynthesisPrompt(
  context: ProjectContext,
  vendorMap: VendorBriefEntry[],
  heroSelections: HeroSelectionEntry[],
  designerCtx: DesignerBriefContext | null,
): string {
  const lines: string[] = [];

  lines.push('You are a senior design editor preparing to interview an interior designer.');
  lines.push('Study the following project data and write a research brief.');
  lines.push('');

  // Project overview
  lines.push(`PROJECT: ${context.projectTitle || 'Untitled Project'}`);
  if (context.isProspective) lines.push('STATUS: In-progress (prospective project)');
  lines.push('');

  // Rooms
  if (context.rooms.length > 0) {
    lines.push('ROOMS:');
    for (const room of context.rooms) {
      const pieces = room.keyPieces.map((p) => `${p.productName} (${p.brand})`).join(', ');
      lines.push(`- ${room.name}${pieces ? `: ${pieces}` : ''}`);
    }
    lines.push('');
  }

  // Vendors
  if (vendorMap.length > 0) {
    lines.push('VENDORS:');
    for (const v of vendorMap) {
      const heroes = v.heroProducts.length > 0 ? ` — hero: ${v.heroProducts.join(', ')}` : '';
      lines.push(`- ${v.name}: ${v.count} piece${v.count > 1 ? 's' : ''} (${v.rooms.join(', ')})${heroes}`);
    }
    lines.push('');
  }

  // Hero selections
  if (heroSelections.length > 0) {
    lines.push('HERO PIECES:');
    for (const h of heroSelections) {
      lines.push(`- ${h.productName} by ${h.vendor} in ${h.room}`);
    }
    lines.push('');
  }

  // Visual palette
  if (context.colorPalette.length > 0) {
    lines.push(`COLOR PALETTE: ${context.colorPalette.join(', ')}`);
  }
  if (context.materialThemes.length > 0) {
    lines.push(`MATERIAL THEMES: ${context.materialThemes.join(', ')}`);
  }
  if (context.ambiencePatterns.length > 0) {
    lines.push(`MOOD: ${context.ambiencePatterns.map((a) => a.description).join(', ')}`);
  }
  lines.push('');

  // Designer context
  if (designerCtx) {
    lines.push(`DESIGNER: ${designerCtx.name}`);
    if (designerCtx.bio) lines.push(`BIO: ${designerCtx.bio.slice(0, 300)}`);
    if (designerCtx.statedApproach) lines.push(`APPROACH: ${designerCtx.statedApproach}`);
    if (designerCtx.statedValues.length > 0) lines.push(`VALUES: ${designerCtx.statedValues.join(', ')}`);
    if (designerCtx.priorProjectCount > 1) lines.push(`NOTE: This is project #${designerCtx.priorProjectCount} for this designer. They have completed ${designerCtx.priorInterviewCount} prior interview(s).`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('Return a JSON object with exactly these fields:');
  lines.push('{');
  lines.push('  "visualNotes": "2-3 sentences describing the visual impression and design story of this project. Reference specific products, materials, and rooms by name.",');
  lines.push('  "researchNotes": ["3-5 bullet observations a prepared editor would note before the interview. Each must reference a specific product, vendor, room, material, or design decision."],');
  lines.push('  "suggestedAngles": ["4-6 specific interview angles to pursue. Each should identify a story opportunity: vendor loyalty, material choice, spatial decision, hero product, style tension, etc. Format: brief description of the angle."]');
  lines.push('}');
  lines.push('');
  lines.push('RULES:');
  lines.push('- Every observation must reference specific products, vendors, rooms, or materials BY NAME');
  lines.push('- No generic observations like "the space feels warm" — say "the unlacquered brass hardware from Waterworks creates warmth"');
  lines.push('- Focus on angles that would produce rich answers and quotable moments');
  lines.push('- If a vendor appears 2+ times, note that as a loyalty angle');
  lines.push('- If hero pieces are present, suggest angles about their selection journey');
  lines.push('- Return ONLY valid JSON, no other text');

  return lines.join('\n');
}

/**
 * Call Claude to generate narrative brief elements.
 */
async function synthesizeBrief(
  context: ProjectContext,
  vendorMap: VendorBriefEntry[],
  heroSelections: HeroSelectionEntry[],
  designerCtx: DesignerBriefContext | null,
): Promise<{ visualNotes: string; researchNotes: string[]; suggestedAngles: string[] }> {
  // Default fallback if AI is unavailable
  const fallback = {
    visualNotes: buildFallbackVisualNotes(context, vendorMap),
    researchNotes: buildFallbackResearchNotes(context, vendorMap, heroSelections),
    suggestedAngles: buildFallbackAngles(context, vendorMap, heroSelections),
  };

  if (!isAnthropicEnabled()) {
    return fallback;
  }

  try {
    const anthropic = new Anthropic();
    const prompt = buildSynthesisPrompt(context, vendorMap, heroSelections, designerCtx);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return fallback;

    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as {
      visualNotes?: string;
      researchNotes?: string[];
      suggestedAngles?: string[];
    };

    return {
      visualNotes: typeof parsed.visualNotes === 'string' ? parsed.visualNotes : fallback.visualNotes,
      researchNotes: Array.isArray(parsed.researchNotes) ? parsed.researchNotes : fallback.researchNotes,
      suggestedAngles: Array.isArray(parsed.suggestedAngles) ? parsed.suggestedAngles : fallback.suggestedAngles,
    };
  } catch (error) {
    console.error('[buildInterviewBrief] AI synthesis failed, using fallback:', error);
    return fallback;
  }
}

// ── Fallback Generators (no LLM) ────────────────────────────────────────────

function buildFallbackVisualNotes(context: ProjectContext, vendorMap: VendorBriefEntry[]): string {
  const parts: string[] = [];

  if (context.rooms.length > 0) {
    const roomNames = context.rooms.slice(0, 3).map((r) => r.name).join(', ');
    parts.push(`This project spans ${context.rooms.length} spaces including ${roomNames}.`);
  }

  if (context.materialThemes.length > 0) {
    parts.push(`Material themes include ${context.materialThemes.join(' and ')}.`);
  }

  if (vendorMap.length > 0) {
    const topVendor = vendorMap[0];
    parts.push(
      `${topVendor.name} is the dominant vendor with ${topVendor.count} pieces across ${topVendor.rooms.join(' and ')}.`,
    );
  }

  return parts.join(' ') || 'A design project with available imagery.';
}

function buildFallbackResearchNotes(
  context: ProjectContext,
  vendorMap: VendorBriefEntry[],
  heroSelections: HeroSelectionEntry[],
): string[] {
  const notes: string[] = [];

  // Vendor loyalty
  const loyalVendors = vendorMap.filter((v) => v.count >= 2);
  for (const v of loyalVendors.slice(0, 2)) {
    notes.push(
      `${v.name} appears ${v.count} times (${v.rooms.join(', ')}) — ask about the relationship.`,
    );
  }

  // Hero pieces
  for (const h of heroSelections.slice(0, 2)) {
    notes.push(`${h.productName} by ${h.vendor} in the ${h.room} is a hero piece worth exploring.`);
  }

  // Material themes
  if (context.materialThemes.length >= 2) {
    notes.push(`Material continuity: ${context.materialThemes.join(', ')} run through the project.`);
  }

  // Room count
  if (context.rooms.length >= 3) {
    notes.push(`${context.rooms.length} rooms — explore how they relate to each other.`);
  }

  return notes.length > 0 ? notes : ['Explore the design decisions behind this project.'];
}

function buildFallbackAngles(
  context: ProjectContext,
  vendorMap: VendorBriefEntry[],
  heroSelections: HeroSelectionEntry[],
): string[] {
  const angles: string[] = [];

  for (const v of vendorMap.filter((v) => v.count >= 2).slice(0, 2)) {
    angles.push(`Vendor loyalty: ${v.name} used ${v.count} times — what draws the designer to this vendor?`);
  }

  for (const h of heroSelections.slice(0, 2)) {
    angles.push(`Hero product: The ${h.productName} in the ${h.room} — selection journey and impact.`);
  }

  if (context.rooms.length >= 2) {
    angles.push('Spatial narrative: How the rooms relate and transition into each other.');
  }

  if (context.materialThemes.length > 0) {
    angles.push(`Material story: How ${context.materialThemes[0]} became a unifying thread.`);
  }

  angles.push('Design philosophy: The beliefs and approach driving decisions in this project.');

  return angles.slice(0, 6);
}

// ── Main Function ────────────────────────────────────────────────────────────

/**
 * Build a pre-interview intelligence brief for a project.
 * Combines structured data from the DB with AI-generated narrative.
 * Results are cached in ProjectPost.provenance.interviewBrief.
 */
export async function buildInterviewBrief(
  projectId: string,
  options?: { forceRefresh?: boolean },
): Promise<InterviewBrief> {
  // 1. Assess project context (reuse existing infrastructure)
  const context = await assessProjectContext(projectId);

  // 2. Get designer info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { designerId: true, ownerId: true },
  });
  const designerId = project?.designerId || project?.ownerId;
  const designerCtx = await fetchDesignerContext(designerId);

  // 3. Check cache
  const briefHash = computeBriefHash(context, designerCtx);
  if (!options?.forceRefresh) {
    const cached = await getCachedBrief(projectId, briefHash);
    if (cached) {
      return cached;
    }
  }

  // 4. Build structured sections
  const vendorMap = buildVendorMap(context);
  const heroSelections = buildHeroSelections(context);

  // 5. AI synthesis (or fallback)
  const { visualNotes, researchNotes, suggestedAngles } = await synthesizeBrief(
    context,
    vendorMap,
    heroSelections,
    designerCtx,
  );

  // 6. Assemble brief
  const brief: InterviewBrief = {
    projectId,
    generatedAt: new Date().toISOString(),
    projectSummary: {
      title: context.projectTitle || 'Untitled Project',
      rooms: context.rooms.map((r) => r.name),
      contextLevel: context.level,
      isProspective: context.isProspective,
      imageCount: context.rooms.length, // proxy for image density
      selectionCount: context.selections.length,
    },
    vendorMap,
    heroSelections,
    dominantPalette: context.colorPalette,
    dominantMaterials: context.materialThemes,
    moodDescriptors: context.ambiencePatterns.map((a) => a.description),
    designerContext: designerCtx,
    visualNotes,
    researchNotes,
    suggestedAngles,
    briefHash,
  };

  // 7. Cache (non-blocking)
  cacheBrief(projectId, brief).catch(() => {});

  return brief;
}

/**
 * Format an InterviewBrief as a human-readable narrative.
 * Used by voice mode Sofia and as a debugging aid.
 */
export function formatBriefAsNarrative(brief: InterviewBrief): string {
  const lines: string[] = [];

  lines.push('PROJECT BRIEF:');
  lines.push(brief.visualNotes);
  lines.push('');

  if (brief.researchNotes.length > 0) {
    lines.push('KEY OBSERVATIONS:');
    for (const note of brief.researchNotes) {
      lines.push(`• ${note}`);
    }
    lines.push('');
  }

  if (brief.vendorMap.length > 0) {
    lines.push('VENDOR MAP:');
    for (const v of brief.vendorMap) {
      const heroes = v.heroProducts.length > 0 ? ` — hero: ${v.heroProducts.join(', ')}` : '';
      lines.push(`• ${v.name}: ${v.count} piece${v.count > 1 ? 's' : ''} (${v.rooms.join(', ')})${heroes}`);
    }
    lines.push('');
  }

  if (brief.suggestedAngles.length > 0) {
    lines.push('SUGGESTED ANGLES:');
    for (const angle of brief.suggestedAngles) {
      lines.push(`• ${angle}`);
    }
    lines.push('');
  }

  if (brief.designerContext) {
    lines.push(`DESIGNER: ${brief.designerContext.name}`);
    if (brief.designerContext.statedApproach) {
      lines.push(`APPROACH: ${brief.designerContext.statedApproach}`);
    }
    if (brief.designerContext.priorProjectCount > 1) {
      lines.push(`NOTE: This is project #${brief.designerContext.priorProjectCount}. ${brief.designerContext.priorInterviewCount} prior interview(s) completed.`);
    }
  }

  return lines.join('\n');
}
