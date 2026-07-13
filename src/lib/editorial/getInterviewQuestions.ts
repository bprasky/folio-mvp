import {
  toInterviewQuestion,
  type ContextLevel,
  type ProjectSizeClassification,
} from '@/lib/interview';
import {
  computeRoomBudget,
  computeGlobalGates,
  type RoomQuestionsGroup,
  type RoomGroupedQuestions,
} from './roomPacing';
import { generateAllRoomQuestions } from '@/lib/interview/generateAllRoomQuestions';
import { generateProjectQuestions, buildFallbackProjectQuestions } from '@/lib/interview/generateProjectQuestions';
import type { GeneratedQuestion } from '@/lib/interview/generateQuestions';
import { assessProjectContext, type ProjectContext } from '@/lib/interview/contextLevel';
import { distillInterviewFacts, type KnownFacts } from '@/lib/interview/distillInterviewFacts';
import { prisma } from '@/lib/prisma';

export interface InterviewQuestion {
  id: string;
  questionText: string;
  questionType: 'base' | 'contextual' | 'follow_up';
  source: 'base_question' | 'ai_classification' | 'follow_up';
  category?: string;
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: string;
  attributeValue?: string;
  roomContext?: string;
  // New fields for contextual interview system
  boostable?: boolean;
  pullQuotePotential?: 'high' | 'medium' | 'low';
  contextLevel?: ContextLevel;
  questionCategory?: string;
  vendors?: string[];
  rooms?: string[];
  products?: string[];
}

export interface InterviewQuestionsResult {
  questions: InterviewQuestion[];
  contextLevel: ContextLevel;
  contextDescription: string;
  upgradeSuggestion: string | null;
  projectSize: ProjectSizeClassification;
}

/**
 * Get interview questions for a project using the per-room generation system.
 * Questions scale with available project context.
 */
export async function getInterviewQuestions(projectId: string): Promise<InterviewQuestion[]> {
  const result = await getInterviewQuestionsWithContext(projectId);
  return result.questions;
}

/**
 * Get interview questions with full context information.
 * Returns a flat array of questions (all rooms combined) for backward compatibility.
 */
export async function getInterviewQuestionsWithContext(
  projectId: string,
  options?: {
    maxQuestions?: number;
    prioritizeBoostable?: boolean;
    includeGeneric?: boolean;
  }
): Promise<InterviewQuestionsResult> {
  // Generate per-room questions
  const { roomResults, context } = await generateAllRoomQuestions(projectId);

  // Flatten all room results into a single array
  const allQuestions: InterviewQuestion[] = [];
  for (const room of roomResults) {
    for (const q of room.questions) {
      const converted = toInterviewQuestion(q);
      allQuestions.push({
        id: converted.id,
        questionText: converted.questionText,
        questionType: converted.questionType,
        source: converted.source,
        linkedImageId: converted.linkedImageId,
        linkedProductId: converted.linkedProductId,
        attributeType: converted.attributeType,
        attributeValue: converted.attributeValue,
        roomContext: converted.roomContext,
        boostable: converted.boostable,
        pullQuotePotential: converted.pullQuotePotential,
        contextLevel: converted.contextLevel,
        questionCategory: converted.questionCategory,
        vendors: q.vendors,
        rooms: q.rooms,
        products: q.products,
      });
    }
  }

  // Apply optional cap
  const maxTotal = options?.maxQuestions || allQuestions.length;
  const capped = allQuestions.slice(0, maxTotal);

  const { getContextLevelDescription, getContextUpgradeSuggestion } = await import('@/lib/interview');

  return {
    questions: capped,
    contextLevel: context.level,
    contextDescription: getContextLevelDescription(context.level),
    upgradeSuggestion: getContextUpgradeSuggestion(context.level),
    projectSize: context.projectSize,
  };
}

/** Which slice of the grouped interview to generate. */
export type InterviewGenerationPhase = 'project' | 'rooms' | 'full';

export interface GroupedQuestionsResult {
  grouped: true;
  rooms: RoomQuestionsGroup[];
  crossRoomQuestions: InterviewQuestion[];
  globalGates: RoomGroupedQuestions['globalGates'];
  contextLevel: ContextLevel;
  contextDescription: string;
  upgradeSuggestion: string | null;
  projectSize: ProjectSizeClassification;
}

/**
 * Build the "About This Project" group. The project section is ALWAYS built:
 * the LLM enriches it, but on failure or an empty result we fall back to a
 * deterministic base set. This guarantees a stable "About This Project" group
 * at index 0 on every request — the fix for the "dining room flashes first,
 * then corrects" flicker, which happened when a failed LLM call produced a
 * room-only (dining-first) response.
 */
async function buildProjectGroup(
  projectId: string,
  context: ProjectContext,
): Promise<RoomQuestionsGroup> {
  const projectMeta = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      description: true,
      city: true,
      regionState: true,
      projectType: true,
      clientType: true,
      designer: { select: { name: true, studio: true } },
      images: {
        select: { url: true },
        orderBy: { displayOrder: 'asc' as const },
        take: 3,
      },
    },
  });

  let projectGenQuestions: GeneratedQuestion[] = [];
  try {
    const locationParts = [projectMeta?.city, projectMeta?.regionState].filter(Boolean);
    const result = await generateProjectQuestions({
      projectTitle: context.projectTitle,
      projectDescription: context.projectDescription,
      designerName: projectMeta?.designer?.name || undefined,
      studioName: projectMeta?.designer?.studio || undefined,
      location: locationParts.join(', ') || undefined,
      projectType: projectMeta?.projectType || undefined,
      clientType: projectMeta?.clientType || undefined,
      representativeImages: (projectMeta?.images || []).map(img => ({ url: img.url })),
      roomNames: context.rooms.map(r => r.name),
      roomTypes: context.rooms.map(r => r.type || r.name),
      materialPalette: context.materialThemes,
      contextLevel: context.level,
      respondentRole: 'DESIGNER',
    });
    projectGenQuestions = result.questions;
  } catch (err) {
    console.warn('[getInterviewQuestionsGroupedByRoom] Project question generation failed, using deterministic fallback:', err);
  }

  if (projectGenQuestions.length === 0) {
    projectGenQuestions = buildFallbackProjectQuestions(context.level);
  }

  const projectInterviewQuestions: InterviewQuestion[] = projectGenQuestions.map((q) => {
    const converted = toInterviewQuestion(q);
    return {
      id: converted.id,
      questionText: converted.questionText,
      questionType: converted.questionType,
      source: 'ai_classification' as const,
      boostable: converted.boostable,
      pullQuotePotential: converted.pullQuotePotential,
      contextLevel: converted.contextLevel,
      questionCategory: converted.questionCategory,
      vendors: q.vendors,
      rooms: q.rooms,
      products: q.products,
    };
  });

  return {
    roomId: 'project',
    roomName: 'About This Project',
    roomType: null,
    budget: {
      roomId: 'project',
      roomName: 'About This Project',
      roomType: null,
      imageCount: 0,
      tagCount: 0,
      baseQuestions: projectInterviewQuestions.length,
      maxFollowUps: 3,
    },
    questions: projectInterviewQuestions,
  };
}

/** Convert per-room generation results to RoomQuestionsGroup format. */
function buildRoomGroupsFromResults(
  roomResults: Array<{ roomName: string; questions: GeneratedQuestion[] }>,
  context: ProjectContext,
): {
  roomGroups: RoomQuestionsGroup[];
  gateRooms: Array<{ roomId: string; roomName: string; imageCount: number; tagCount: number }>;
} {
  const roomGroups: RoomQuestionsGroup[] = [];
  const gateRooms: Array<{ roomId: string; roomName: string; imageCount: number; tagCount: number }> = [];

  for (const roomResult of roomResults) {
    // Find matching room in context
    const roomCtx = context.rooms.find((r) => r.name === roomResult.roomName);
    if (!roomCtx) continue;

    // Convert GeneratedQuestion[] to InterviewQuestion[]
    const questions: InterviewQuestion[] = roomResult.questions.map((q) => {
      const converted = toInterviewQuestion(q);
      return {
        id: converted.id,
        questionText: converted.questionText,
        questionType: converted.questionType,
        source: converted.source,
        linkedImageId: converted.linkedImageId,
        linkedProductId: converted.linkedProductId,
        attributeType: converted.attributeType,
        attributeValue: converted.attributeValue,
        roomContext: converted.roomContext,
        boostable: converted.boostable,
        pullQuotePotential: converted.pullQuotePotential,
        contextLevel: converted.contextLevel,
        questionCategory: converted.questionCategory,
        vendors: q.vendors,
        rooms: q.rooms,
        products: q.products,
        roomId: roomCtx.id,
        isCrossRoom: false,
      };
    });

    const imgCount = roomCtx.selectionCount; // approximate — images aren't on RoomContext
    const tgCount = roomCtx.selectionCount;
    const budget = computeRoomBudget(imgCount, tgCount);

    roomGroups.push({
      roomId: roomCtx.id,
      roomName: roomCtx.name,
      roomType: roomCtx.type,
      budget: {
        roomId: roomCtx.id,
        roomName: roomCtx.name,
        roomType: roomCtx.type,
        imageCount: imgCount,
        tagCount: tgCount,
        baseQuestions: budget.baseQuestions,
        maxFollowUps: budget.maxFollowUps,
      },
      questions,
    });

    gateRooms.push({
      roomId: roomCtx.id,
      roomName: roomCtx.name,
      imageCount: imgCount,
      tagCount: tgCount,
    });
  }

  return { roomGroups, gateRooms };
}

/**
 * Read the designer's saved "About This Project" answers from provenance.
 * Project-level question IDs are always `project-<CATEGORY>-<uuid>`.
 */
async function readAboutProjectAnswers(
  projectId: string,
): Promise<Array<{ prompt: string; answer: string }>> {
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { provenance: true },
  });
  const interview = (post?.provenance as any)?.interview || {};
  const answers = interview.payload?.answers ?? interview.answers ?? [];
  if (!Array.isArray(answers)) return [];
  return answers
    .filter(
      (a: any) =>
        typeof a?.questionId === 'string' &&
        a.questionId.startsWith('project-') &&
        typeof a?.answer === 'string' &&
        a.answer.trim().length > 0,
    )
    .map((a: any) => ({ prompt: a.prompt || '', answer: a.answer }));
}

/**
 * Persist the fact digest to provenance so follow-up generation can reuse it
 * without re-distilling. Fresh-read before write to shrink the window for
 * clobbering concurrent answer saves (same pattern as the followups routes).
 */
async function persistKnownFacts(projectId: string, knownFacts: KnownFacts): Promise<void> {
  try {
    const freshPost = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });
    if (!freshPost) return;
    const freshProvenance = (freshPost.provenance as any) || {};
    const freshInterview = { ...(freshProvenance.interview || {}), knownFacts };
    await prisma.projectPost.update({
      where: { projectId },
      data: {
        provenance: {
          ...freshProvenance,
          interview: freshInterview,
        },
      },
    });
  } catch (err) {
    console.warn('[getInterviewQuestionsGroupedByRoom] Failed to persist knownFacts (non-blocking):', err);
  }
}

/**
 * Get interview questions grouped by room with per-room budgets.
 * Used when `?grouped=true` is passed to the questions API.
 *
 * Phases (two-phase interview generation):
 * - 'project': ONLY the "About This Project" group — one fast LLM call, no
 *   room generation. Served first so the designer can start answering while
 *   nothing else is spent.
 * - 'rooms': ONLY the room groups. Reads the designer's saved About answers,
 *   distills them into a neutral fact digest (facts, not narrative — so the
 *   foundation informs room question wording without re-steering topics),
 *   and generates every room with that digest.
 * - 'full' (default): both at once, no digest — the original single-shot
 *   behavior, kept for backward compatibility (flat endpoint, older clients).
 */
export async function getInterviewQuestionsGroupedByRoom(
  projectId: string,
  options?: { phase?: InterviewGenerationPhase },
): Promise<GroupedQuestionsResult> {
  const phase = options?.phase ?? 'full';
  const { getContextLevelDescription, getContextUpgradeSuggestion } = await import('@/lib/interview');

  if (phase === 'project') {
    const context = await assessProjectContext(projectId);
    const projectGroup = await buildProjectGroup(projectId, context);
    // Real gates from context so the client sees correct minimums before rooms arrive
    // (same selectionCount approximation the full path uses).
    const gateRooms = context.rooms.map((r) => ({
      roomId: r.id,
      roomName: r.name,
      imageCount: r.selectionCount,
      tagCount: r.selectionCount,
    }));
    return {
      grouped: true,
      rooms: [projectGroup],
      crossRoomQuestions: [],
      globalGates: computeGlobalGates(gateRooms),
      contextLevel: context.level,
      contextDescription: getContextLevelDescription(context.level),
      upgradeSuggestion: getContextUpgradeSuggestion(context.level),
      projectSize: context.projectSize,
    };
  }

  if (phase === 'rooms') {
    // Distill the About answers into the fact digest. Enhancement, never a
    // dependency: any failure here degrades to digest-free room generation.
    let knownFacts: KnownFacts | null = null;
    try {
      const aboutAnswers = await readAboutProjectAnswers(projectId);
      knownFacts = await distillInterviewFacts(aboutAnswers);
      if (knownFacts) {
        await persistKnownFacts(projectId, knownFacts);
      }
      console.info('[getInterviewQuestionsGroupedByRoom] rooms phase', {
        projectId,
        aboutAnswerCount: aboutAnswers.length,
        digestFields: knownFacts ? Object.keys(knownFacts) : [],
      });
    } catch (err) {
      console.warn('[getInterviewQuestionsGroupedByRoom] Fact digest failed, generating rooms without it:', err);
    }

    const { roomResults, context } = await generateAllRoomQuestions(projectId, { knownFacts });
    const { roomGroups, gateRooms } = buildRoomGroupsFromResults(roomResults, context);
    return {
      grouped: true,
      rooms: roomGroups,
      crossRoomQuestions: [],
      globalGates: computeGlobalGates(gateRooms),
      contextLevel: context.level,
      contextDescription: getContextLevelDescription(context.level),
      upgradeSuggestion: getContextUpgradeSuggestion(context.level),
      projectSize: context.projectSize,
    };
  }

  // phase === 'full' — original single-shot behavior (no digest)
  const { roomResults, context } = await generateAllRoomQuestions(projectId);
  const projectGroup = await buildProjectGroup(projectId, context);
  const { roomGroups, gateRooms } = buildRoomGroupsFromResults(roomResults, context);

  // Prepend project-level questions as synthetic room at index 0. Always present
  // (deterministic fallback in buildProjectGroup), so ordering is stable across requests.
  roomGroups.unshift(projectGroup);

  return {
    grouped: true,
    rooms: roomGroups,
    crossRoomQuestions: [], // Cross-room questions are embedded in rooms now (1 per room)
    globalGates: computeGlobalGates(gateRooms),
    contextLevel: context.level,
    contextDescription: getContextLevelDescription(context.level),
    upgradeSuggestion: getContextUpgradeSuggestion(context.level),
    projectSize: context.projectSize,
  };
}
