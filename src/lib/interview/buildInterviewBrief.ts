/**
 * Pre-Interview Intelligence Brief
 *
 * Aggregates project data, designer context, and AI classification results
 * into a structured brief. Makes one Claude Sonnet call with vision to
 * synthesize a narrative brief + editorial layout hints + interview questions.
 *
 * Cached in ProjectPost.provenance.interviewBrief, invalidated by briefHash.
 */

import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { assessProjectContext, classifyProjectSize, type ProjectContext } from './contextLevel';
import { computeRoomBudget } from '@/lib/editorial/roomPacing';
import { MODELS } from '@/lib/ai/models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VendorMapEntry {
  name: string;
  productCount: number;
  rooms: string[];
  heroProducts: string[];
  isRepeatVendor: boolean;
}

export interface HeroMoment {
  description: string;
  roomName: string;
  relatedProducts: string[];
  whyNotable: string;
}

export interface EditorialLayoutHints {
  suggestedHeroImageIndex: number;
  spreadPairings: Array<[number, number]>;
  visualFlowNotes: string;
}

export interface PriorWorkConnection {
  observation: string;
  currentDetail: string;
  priorDetail: string;
}

export interface NarrativeBrief {
  visualImpression: string;
  researchNotes: string[];
  suggestedAngles: string[];
  heroMoments: HeroMoment[];
  editorialLayoutHints: EditorialLayoutHints;
  priorWorkConnections: PriorWorkConnection[] | null;
}

export interface AIGeneratedQuestion {
  text: string;
  type: 'opening' | 'deep_dive' | 'vendor_loyalty' | 'material_thread' | 'spatial_narrative' | 'philosophy';
  rooms: string[];
  vendors: string[];
  products: string[];
  boostable: boolean;
  topic: string;
}

export interface InterviewBrief {
  projectId: string;
  generatedAt: string;
  briefHash: string;

  project: {
    title: string;
    rooms: string[];
    contextLevel: number;
    isProspective: boolean;
    imageCount: number;
    projectType: string;
    budgetBand: string;
  };

  vendorMap: VendorMapEntry[];
  materialPalette: string[];
  colorStory: string[];
  styleConsensus: string[];
  moodConsensus: string[];
  heroElements: string[];

  designerContext: {
    name: string;
    bio: string | null;
    statedApproach: string | null;
    materialTendencies: string | null;
    vendorAffinities: string | null;
    priorProjectCount: number;
    priorInterviewThemes: string[];
    knownPhilosophy: string[];
  } | null;

  narrativeBrief: NarrativeBrief;
  aiQuestions: AIGeneratedQuestion[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aggregateByFrequency(
  classifications: Array<Record<string, unknown>>,
  key: string
): string[] {
  const counts = new Map<string, number>();
  for (const c of classifications) {
    const values = c[key];
    if (!Array.isArray(values)) continue;
    for (const v of values) {
      if (typeof v === 'string') {
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value]) => value);
}

// Bump this version when the LLM prompt changes to invalidate cached briefs.
const BRIEF_PROMPT_VERSION = 2;

function computeBriefHash(
  imageCount: number,
  roomNames: string[],
  selectionIds: string[]
): string {
  const input = `v${BRIEF_PROMPT_VERSION}:${imageCount}:${roomNames.sort().join(',')}:${selectionIds.sort().join(',')}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function classifyBudgetBand(selections: Array<{ unitPrice?: number | null }>): string {
  const prices = selections
    .map((s) => Number(s.unitPrice) || 0)
    .filter((p) => p > 0);
  if (prices.length === 0) return 'unknown';
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (avg > 5000) return 'luxury';
  if (avg > 1500) return 'premium';
  if (avg > 500) return 'mid-range';
  return 'accessible';
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildInterviewBrief(
  projectId: string,
  options?: {
    forceRegenerate?: boolean;
    generateQuestions?: boolean;
    questionCount?: number;
  }
): Promise<InterviewBrief> {
  const generateQuestions = options?.generateQuestions ?? (process.env.INTERVIEW_AI_QUESTIONS === 'true');

  // Cache removed (Phase 6): brief generation is fast and the founding designer
  // cohort is tiny. The old cache was actively preventing LLM calls from running
  // because computeBriefHash didn't account for all relevant inputs.
  // See: per-room question generation spec, Phase 6.

  // -------------------------------------------------------------------------
  // Load project data
  // -------------------------------------------------------------------------
  const context = await assessProjectContext(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      description: true,
      projectType: true,
      designerId: true,
      ownerId: true,
      images: {
        select: {
          id: true,
          url: true,
          name: true,
          room: true,
          aiClassification: true,
          aiMaterials: true,
          displayOrder: true,
        },
        orderBy: { displayOrder: 'asc' },
      },
      rooms: { select: { id: true, name: true, type: true } },
      selections: {
        select: {
          id: true,
          productName: true,
          vendorName: true,
          unitPrice: true,
          roomId: true,
          room: { select: { name: true } },
        },
      },
    },
  });

  if (!project) throw new Error(`Project not found: ${projectId}`);

  const designerId = project.designerId || project.ownerId;

  // -------------------------------------------------------------------------
  // 3. Aggregate aesthetics across all images
  // -------------------------------------------------------------------------
  const allClassifications = project.images
    .map((img) => img.aiClassification as Record<string, unknown> | null)
    .filter((c): c is Record<string, unknown> => c !== null);

  const materialPalette = aggregateByFrequency(allClassifications, 'materials');
  const colorStory = aggregateByFrequency(allClassifications, 'colors');
  const styleConsensus = aggregateByFrequency(allClassifications, 'styles');
  const moodConsensus = aggregateByFrequency(allClassifications, 'mood');
  const heroElements = aggregateByFrequency(allClassifications, 'elements');

  // -------------------------------------------------------------------------
  // 4. Build vendor map
  // -------------------------------------------------------------------------
  const vendorGroups = new Map<string, {
    productCount: number;
    rooms: Set<string>;
    heroProducts: string[];
  }>();

  for (const s of project.selections) {
    const vendor = s.vendorName;
    if (!vendor) continue;
    const group = vendorGroups.get(vendor) || {
      productCount: 0,
      rooms: new Set(),
      heroProducts: [],
    };
    group.productCount++;
    if (s.room?.name) group.rooms.add(s.room.name);
    if (s.unitPrice && Number(s.unitPrice) > 1000 && s.productName) {
      group.heroProducts.push(s.productName);
    }
    vendorGroups.set(vendor, group);
  }

  // Check for repeat vendors from designer reasoning profile
  let reasoningProfile: { vendorAffinities?: unknown } | null = null;
  if (designerId) {
    reasoningProfile = await prisma.designerReasoningProfile.findFirst({
      where: { userId: designerId },
      select: { statedApproach: true, materialTendencies: true, vendorAffinities: true },
    }) as any;
  }

  const repeatVendorNames = new Set<string>();
  if (reasoningProfile?.vendorAffinities && Array.isArray(reasoningProfile.vendorAffinities)) {
    for (const aff of reasoningProfile.vendorAffinities as Array<{ vendorName?: string }>) {
      if (aff.vendorName) repeatVendorNames.add(aff.vendorName);
    }
  }

  const vendorMap: VendorMapEntry[] = Array.from(vendorGroups.entries())
    .map(([name, data]) => ({
      name,
      productCount: data.productCount,
      rooms: Array.from(data.rooms),
      heroProducts: data.heroProducts,
      isRepeatVendor: repeatVendorNames.has(name),
    }))
    .sort((a, b) => b.productCount - a.productCount);

  // -------------------------------------------------------------------------
  // 5. Designer context
  // -------------------------------------------------------------------------
  let designerContext: InterviewBrief['designerContext'] = null;

  if (designerId) {
    const designer = await prisma.user.findUnique({
      where: { id: designerId },
      select: { name: true, bio: true },
    });

    const profile = await prisma.designerReasoningProfile.findFirst({
      where: { userId: designerId },
    });

    const priorProjectCount = await prisma.project.count({
      where: { designerId, id: { not: projectId } },
    });

    // Prior interview philosophy signals
    const priorPhilosophy = await prisma.atelierSignal.findMany({
      where: {
        designerId,
        key: 'interview.answer.philosophy',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { metadata: true },
    });

    const knownPhilosophy = priorPhilosophy
      .map((s) => {
        const meta = s.metadata as Record<string, unknown> | null;
        return meta?.statement as string || meta?.value as string || '';
      })
      .filter((s) => s.length > 0);

    // Prior interview themes
    const priorThemes = await prisma.atelierSignal.findMany({
      where: {
        designerId,
        key: { startsWith: 'interview.answer.' },
        NOT: { sourceId: undefined },
      },
      distinct: ['key'],
      select: { key: true },
      take: 20,
    });

    designerContext = {
      name: designer?.name || 'Designer',
      bio: designer?.bio || null,
      statedApproach: profile?.statedApproach || null,
      materialTendencies: profile?.materialTendencies
        ? JSON.stringify(profile.materialTendencies)
        : null,
      vendorAffinities: profile?.vendorAffinities
        ? JSON.stringify(profile.vendorAffinities)
        : null,
      priorProjectCount,
      priorInterviewThemes: priorThemes.map((t) => t.key),
      knownPhilosophy,
    };
  }

  // -------------------------------------------------------------------------
  // 6. Compute hash
  // -------------------------------------------------------------------------
  const briefHash = computeBriefHash(
    project.images.length,
    project.rooms.map((r) => r.name),
    project.selections.map((s) => s.id)
  );

  // -------------------------------------------------------------------------
  // 7. AI synthesis (one Claude Sonnet call with vision)
  // -------------------------------------------------------------------------
  const projectSize = classifyProjectSize(
    context.rooms.length,
    context.selections.length
  );
  const questionCount = options?.questionCount ?? projectSize.targetQuestionCount;
  const budgetBand = classifyBudgetBand(project.selections);

  // Compute per-room question budgets for the LLM prompt
  const roomBudgets = project.rooms.map((room) => {
    const imgCount = project.images.filter((img) => img.room === room.id || img.room === room.name).length;
    const selCount = project.selections.filter((s) => s.roomId === room.id).length;
    const budget = computeRoomBudget(imgCount, selCount);
    return { name: room.name, questionCount: budget.baseQuestions, selectionCount: selCount };
  });

  const narrativeBrief = await generateNarrativeBrief({
    project: {
      title: project.title || 'Untitled',
      description: project.description || undefined,
      projectType: project.projectType || 'residential',
      rooms: project.rooms.map((r) => r.name),
    },
    images: project.images.map((img) => ({
      url: img.url,
      room: img.room,
    })),
    materialPalette,
    colorStory,
    styleConsensus,
    moodConsensus,
    heroElements,
    vendorMap,
    designerContext,
    budgetBand,
    roomBudgets,
    generateQuestions,
    questionCount,
  });

  // -------------------------------------------------------------------------
  // 8. Assemble brief
  // -------------------------------------------------------------------------
  const brief: InterviewBrief = {
    projectId,
    generatedAt: new Date().toISOString(),
    briefHash,
    project: {
      title: project.title || 'Untitled',
      rooms: project.rooms.map((r) => r.name),
      contextLevel: context.level,
      isProspective: context.isProspective,
      imageCount: project.images.length,
      projectType: project.projectType || 'residential',
      budgetBand,
    },
    vendorMap,
    materialPalette,
    colorStory,
    styleConsensus,
    moodConsensus,
    heroElements,
    designerContext,
    narrativeBrief: narrativeBrief.brief,
    aiQuestions: narrativeBrief.questions,
  };

  // -------------------------------------------------------------------------
  // 9. Cache in ProjectPost.provenance
  // -------------------------------------------------------------------------
  // IMPORTANT: Re-read provenance immediately before writing to avoid overwriting
  // concurrent interview answer saves. The Claude API call above can take 5-30s,
  // during which the user may be saving answers.
  try {
    const freshPost = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });

    if (freshPost) {
      const freshProvenance = (freshPost.provenance as Record<string, unknown>) || {};
      freshProvenance.interviewBrief = brief;

      await prisma.projectPost.update({
        where: { projectId },
        data: { provenance: freshProvenance },
      });
    }
  } catch (error) {
    console.warn('[buildInterviewBrief] Failed to cache brief (non-blocking):', error);
  }

  return brief;
}

// ---------------------------------------------------------------------------
// AI synthesis call
// ---------------------------------------------------------------------------

interface SynthesisInput {
  project: {
    title: string;
    description?: string;
    projectType: string;
    rooms: string[];
  };
  images: Array<{ url: string; room: string | null }>;
  materialPalette: string[];
  colorStory: string[];
  styleConsensus: string[];
  moodConsensus: string[];
  heroElements: string[];
  vendorMap: VendorMapEntry[];
  designerContext: InterviewBrief['designerContext'];
  budgetBand: string;
  generateQuestions: boolean;
  questionCount: number;
  roomBudgets?: Array<{ name: string; questionCount: number; selectionCount: number }>;
}

async function generateNarrativeBrief(
  input: SynthesisInput
): Promise<{ brief: NarrativeBrief; questions: AIGeneratedQuestion[] | null }> {
  const anthropic = new Anthropic();

  // Build image content blocks (up to 20 images to manage cost)
  const imageBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  const imagesToSend = input.images.slice(0, 20);

  for (const img of imagesToSend) {
    if (img.url) {
      imageBlocks.push({
        type: 'image',
        source: { type: 'url', url: img.url },
      });
    }
  }

  // Build vendor map string
  const vendorMapStr = input.vendorMap
    .map((v) => {
      const parts = [`- ${v.name}: ${v.productCount} piece${v.productCount > 1 ? 's' : ''}`];
      if (v.rooms.length) parts.push(`(${v.rooms.join(', ')})`);
      if (v.heroProducts.length) parts.push(`— hero: ${v.heroProducts.join(', ')}`);
      if (v.isRepeatVendor) parts.push('— REPEAT VENDOR from prior projects');
      return parts.join(' ');
    })
    .join('\n') || 'No vendor data available';

  // Build designer context string
  let designerStr = '';
  if (input.designerContext) {
    const dc = input.designerContext;
    designerStr = `
DESIGNER:
Name: ${dc.name}
Approach: ${dc.statedApproach || 'Not yet established'}
Material tendencies: ${dc.materialTendencies || 'Unknown'}
Vendor affinities: ${dc.vendorAffinities || 'Unknown'}
Known philosophy: ${dc.knownPhilosophy.length > 0 ? dc.knownPhilosophy.join('; ') : 'No prior interviews'}
Prior projects on Folio: ${dc.priorProjectCount}`;
  }

  // Build question generation section
  let questionSection = '';
  if (input.generateQuestions) {
    questionSection = `

Additionally, generate the interview questions based on your research brief.

QUESTION COUNT: ${input.questionCount}

ROOM DISTRIBUTION — generate this many questions per room:
${input.roomBudgets
  ? input.roomBudgets.map(r =>
      `- ${r.name} (${r.selectionCount} tagged products): ${r.questionCount} questions`
    ).join('\n')
  : input.project.rooms.map(r => `- ${r}: 3 questions`).join('\n')}
Each question's "rooms" array MUST contain exactly one room name matching the list above.
Every room MUST receive its full question count. Do not leave any room short.

QUESTION RULES:
1. Every question must reference a specific product, vendor, room, or material BY NAME
2. Every question sets up an answer the designer would be proud to publish
3. Ask about arrivals, not departures. Wins, not compromises. Never ask about regrets, cuts, or things that didn't make it.
4. No generic questions that could be asked about any project. "Tell us about your color choices" is NEVER acceptable. "The brass hardware against the navy millwork in the kitchen — walk us through that pairing" is editorial.
5. If a vendor name is unknown, ask about the product or material itself — never say "Unknown Brand" or reference a vendor you don't know.
6. Include a mix of question types across the conversational arc:
   - OPENING (1-2): Broad, warm, about the project's spirit. Reference a specific visual detail.
   - DEEP_DIVE (bulk): Specific product, material, room, vendor, or spatial decisions
   - VENDOR_LOYALTY (if applicable): When 2+ products from same vendor. Mark as boostable.
   - MATERIAL_THREAD: When a material appears across multiple rooms
   - SPATIAL_NARRATIVE: How rooms relate to each other
   - PHILOSOPHY (1-2 closing): Connect specific choices to broader practice
7. If this designer has prior work on Folio, you may reference it — but ONLY if you can connect it to a specific decision in THIS project.
8. Sequence questions as a conversational arc: warm opening → room/product deep dives → material threads → philosophy close

Return the questions in the "questions" field of your JSON response as an array of objects:
[
  {
    "text": "The full question text",
    "type": "opening | deep_dive | vendor_loyalty | material_thread | spatial_narrative | philosophy",
    "rooms": ["Kitchen"],
    "vendors": ["Waterworks"],
    "products": ["Custom island"],
    "boostable": false,
    "topic": "kitchen_island_material"
  }
]`;
  }

  const prompt = `You are a senior editorial journalist at an interior design publication preparing to interview a designer about this project. You have 20 years of experience and notice details others miss.

STUDY these project images carefully as a COLLECTION — not just individual rooms, but how they relate to each other. Notice material throughlines, palette shifts between spaces, spatial relationships, and what makes this project distinctive.

PROJECT DATA:
Title: ${input.project.title}
${input.project.description ? `Description: ${input.project.description}` : ''}
Rooms: ${input.project.rooms.join(', ') || 'Not specified'}
Budget: ${input.budgetBand}
Type: ${input.project.projectType}

AESTHETIC SUMMARY (from AI classification):
Materials: ${input.materialPalette.join(', ') || 'None detected'}
Colors: ${input.colorStory.join(', ') || 'None detected'}
Styles: ${input.styleConsensus.join(', ') || 'None detected'}
Mood: ${input.moodConsensus.join(', ') || 'None detected'}
Key elements: ${input.heroElements.join(', ') || 'None detected'}

VENDOR MAP:
${vendorMapStr}
${designerStr}

RULES:
1. Every observation must reference specific products, vendors, rooms, or materials BY NAME
2. Focus on arrivals and wins — what they chose and why it works, never what was cut
3. Research notes should be things a designer would be impressed you noticed
4. Suggested angles should each be different enough to produce distinct interview questions
5. Hero moments are the 2-3 decisions that define this project's character
6. Editorial layout hints: which image should lead, which images pair well for spreads
7. Prior work connections: ONLY include if you can complete the sentence "...and in this project, that shows up as [specific thing]." If you cannot make a concrete connection, return null for priorWorkConnections.

Return a JSON object with this structure:
{
  "visualImpression": "2-3 sentences on overall aesthetic",
  "researchNotes": ["3-5 specific observations an editor would note"],
  "suggestedAngles": ["4-6 story angles to pursue"],
  "heroMoments": [
    {
      "description": "string",
      "roomName": "string",
      "relatedProducts": ["string"],
      "whyNotable": "string"
    }
  ],
  "editorialLayoutHints": {
    "suggestedHeroImageIndex": 0,
    "spreadPairings": [[0, 4], [2, 7]],
    "visualFlowNotes": "string"
  },
  "priorWorkConnections": null${input.generateQuestions ? ',\n  "questions": []' : ''}
}${questionSection}`;

  try {
    const content: Anthropic.Messages.ContentBlockParam[] = [
      ...imageBlocks,
      { type: 'text', text: prompt },
    ];

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    });

    const responseText = response.content.find((c) => c.type === 'text');
    const text = responseText && 'text' in responseText ? responseText.text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const brief: NarrativeBrief = {
        visualImpression: parsed.visualImpression || '',
        researchNotes: Array.isArray(parsed.researchNotes) ? parsed.researchNotes : [],
        suggestedAngles: Array.isArray(parsed.suggestedAngles) ? parsed.suggestedAngles : [],
        heroMoments: Array.isArray(parsed.heroMoments) ? parsed.heroMoments : [],
        editorialLayoutHints: parsed.editorialLayoutHints || {
          suggestedHeroImageIndex: 0,
          spreadPairings: [],
          visualFlowNotes: '',
        },
        priorWorkConnections: parsed.priorWorkConnections || null,
      };

      const questions: AIGeneratedQuestion[] | null = input.generateQuestions && Array.isArray(parsed.questions)
        ? parsed.questions.map((q: any) => ({
            text: q.text || '',
            type: q.type || 'deep_dive',
            rooms: Array.isArray(q.rooms) ? q.rooms : [],
            vendors: Array.isArray(q.vendors) ? q.vendors : [],
            products: Array.isArray(q.products) ? q.products : [],
            boostable: !!q.boostable,
            topic: q.topic || 'general',
          }))
        : null;

      return { brief, questions };
    }
  } catch (error) {
    console.error('[buildInterviewBrief] AI synthesis failed:', error);
  }

  // Fallback — return empty narrative brief
  return {
    brief: {
      visualImpression: '',
      researchNotes: [],
      suggestedAngles: [],
      heroMoments: [],
      editorialLayoutHints: {
        suggestedHeroImageIndex: 0,
        spreadPairings: [],
        visualFlowNotes: '',
      },
      priorWorkConnections: null,
    },
    questions: null,
  };
}
