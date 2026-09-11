import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
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
import { createHash } from 'crypto';

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
  assertLegacyInterviewAllowed(projectId);

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
  assertLegacyInterviewAllowed(projectId);

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
      // Org-posted projects carry designerOrg (set from the operating org at
      // creation). The interview byline belongs to the brand being published,
      // so the org name — not the individual member filling out the form —
      // is the identity the SIGNATURE_IDENTITY question should name.
      designerOrg: { select: { name: true } },
      images: {
        select: { url: true },
        orderBy: { displayOrder: 'asc' as const },
        take: 3,
      },
    },
  });

  // Brand identity for the interview: the org when this project is org-posted,
  // otherwise the individual designer.
  const brandIdentity = projectMeta?.designerOrg?.name || projectMeta?.designer?.name || undefined;

  let projectGenQuestions: GeneratedQuestion[] = [];
  try {
    const locationParts = [projectMeta?.city, projectMeta?.regionState].filter(Boolean);
    const result = await generateProjectQuestions({
      projectTitle: context.projectTitle,
      projectDescription: context.projectDescription,
      designerName: brandIdentity,
      studioName: projectMeta?.designerOrg?.name || projectMeta?.designer?.studio || undefined,
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
 * One persisted, phase-scoped snapshot of a generated question set. Stored under
 * `provenance.interview.questionSet.<phase>` so a generation survives across
 * sessions and devices: the same `signature` (a hash of the project state the
 * questions were built from) returns the SAME question objects — same IDs — with
 * no repeat LLM spend. Stable IDs are also what let a saved answer stay bound to
 * its question (editing, resume, recall).
 */
interface PersistedQuestionSet {
  signature: string;
  generatedAt: string;
  result: GroupedQuestionsResult;
}

/**
 * Hash the project state that a phase's questions are derived from. Pure DB reads
 * (no LLM), so it's cheap enough to gate every request. Regeneration happens only
 * when this changes — i.e. when the project MATERIALLY changes:
 *  - both phases: project meta + brand identity + the image→room assignments
 *    (and their order, which picks the representative images) + rooms + per-room
 *    tag CONTENT (product/vendor/finish + named-vs-descriptor). The content — not
 *    just the count — matters: room questions name specific products and vendors,
 *    so retagging a product must invalidate the persisted set even though the
 *    count is unchanged.
 *  - rooms phase additionally folds in the saved "About This Project" answers,
 *    since the room questions are generated from a digest of them.
 */
async function computeQuestionSignature(
  projectId: string,
  phase: InterviewGenerationPhase,
): Promise<string> {
  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      description: true,
      city: true,
      regionState: true,
      projectType: true,
      clientType: true,
      designer: { select: { name: true, studio: true } },
      designerOrg: { select: { name: true } },
      images: { select: { id: true, room: true, roomId: true, displayOrder: true } },
      rooms: {
        select: {
          id: true,
          name: true,
          type: true,
          selections: {
            select: {
              productName: true,
              vendorName: true,
              colorFinish: true,
              productTagId: true,
            },
          },
        },
      },
    },
  });

  const structural = {
    meta: {
      title: proj?.title ?? '',
      description: proj?.description ?? '',
      city: proj?.city ?? '',
      regionState: proj?.regionState ?? '',
      projectType: proj?.projectType ?? '',
      clientType: proj?.clientType ?? '',
      // Brand identity feeds the SIGNATURE_IDENTITY project question.
      brand: proj?.designerOrg?.name ?? proj?.designer?.name ?? '',
      studio: proj?.designerOrg?.name ?? proj?.designer?.studio ?? '',
    },
    // Sort so ordering churn never invalidates an otherwise-identical project.
    // displayOrder is kept because the project questions use the top-N images.
    images: (proj?.images ?? [])
      .map((i) => `${i.id}:${i.room ?? ''}:${i.roomId ?? ''}:${i.displayOrder ?? ''}`)
      .sort(),
    // Per-room tag content, not just counts — a retag changes wording, not count.
    rooms: (proj?.rooms ?? [])
      .map((r) => {
        const sels = (r.selections ?? [])
          .map(
            (s) =>
              `${s.productName ?? ''}|${s.vendorName ?? ''}|${s.colorFinish ?? ''}|${s.productTagId ? 'named' : 'descriptor'}`,
          )
          .sort();
        return `${r.id}:${r.name}:${r.type ?? ''}:[${sels.join(',')}]`;
      })
      .sort(),
  };

  let payload = JSON.stringify(structural);
  if (phase === 'rooms') {
    // Room questions are built from a digest of the About answers, so a change
    // to those answers must invalidate the persisted room set.
    const about = await readAboutProjectAnswers(projectId);
    const aboutPart = about.map((a) => `${a.prompt}=>${a.answer}`).sort();
    payload += '|about:' + JSON.stringify(aboutPart);
  }

  return createHash('sha1').update(`${phase}|${payload}`).digest('hex');
}

/** Read the persisted question set for a phase, if any. */
async function readPersistedQuestionSet(
  projectId: string,
  phase: InterviewGenerationPhase,
): Promise<PersistedQuestionSet | null> {
  try {
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });
    const qs = (post?.provenance as any)?.interview?.questionSet?.[phase];
    if (qs && typeof qs.signature === 'string' && qs.result) {
      return qs as PersistedQuestionSet;
    }
  } catch (err) {
    console.warn('[getInterviewQuestionsGroupedByRoom] Failed to read persisted questionSet (non-blocking):', err);
  }
  return null;
}

/**
 * Persist a freshly generated question set for a phase. Fresh-read-before-write
 * (mirrors persistKnownFacts) and only touches `interview.questionSet.<phase>`,
 * so it preserves the other phase's snapshot and every other provenance sibling
 * (answers, knownFacts). No-ops when no ProjectPost exists yet.
 */
async function persistQuestionSet(
  projectId: string,
  phase: InterviewGenerationPhase,
  signature: string,
  result: GroupedQuestionsResult,
): Promise<void> {
  try {
    const freshPost = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });
    if (!freshPost) return;
    const freshProvenance = (freshPost.provenance as any) || {};
    const freshInterview = freshProvenance.interview || {};
    const freshQuestionSet = freshInterview.questionSet || {};
    await prisma.projectPost.update({
      where: { projectId },
      data: {
        provenance: {
          ...freshProvenance,
          interview: {
            ...freshInterview,
            questionSet: {
              ...freshQuestionSet,
              [phase]: {
                signature,
                generatedAt: new Date().toISOString(),
                result,
              },
            },
          },
        },
      },
    });
  } catch (err) {
    console.warn('[getInterviewQuestionsGroupedByRoom] Failed to persist questionSet (non-blocking):', err);
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
  options?: {
    phase?: InterviewGenerationPhase;
    /**
     * Allow persisting the fact digest to provenance. The caller (route
     * layer) must only set this when the requester has WRITE access to the
     * project — this function is reachable from a view-gated GET, and a
     * viewer must never trigger a DB mutation.
     */
    persistFacts?: boolean;
    /**
     * Allow persisting the generated question set to provenance so it survives
     * across sessions/devices with stable IDs and no repeat LLM spend. Like
     * persistFacts, WRITE-access only — this is reachable from a view-gated GET.
     */
    persistQuestions?: boolean;
  },
): Promise<GroupedQuestionsResult> {
  assertLegacyInterviewAllowed(projectId);

  const phase = options?.phase ?? 'full';
  const { getContextLevelDescription, getContextUpgradeSuggestion } = await import('@/lib/interview');

  if (phase === 'project') {
    // Serve the persisted set when the project hasn't materially changed —
    // same IDs, no LLM call.
    const signature = await computeQuestionSignature(projectId, 'project');
    const persisted = await readPersistedQuestionSet(projectId, 'project');
    if (persisted && persisted.signature === signature) {
      return persisted.result;
    }

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
    const result: GroupedQuestionsResult = {
      grouped: true,
      rooms: [projectGroup],
      crossRoomQuestions: [],
      globalGates: computeGlobalGates(gateRooms),
      contextLevel: context.level,
      contextDescription: getContextLevelDescription(context.level),
      upgradeSuggestion: getContextUpgradeSuggestion(context.level),
      projectSize: context.projectSize,
    };
    if (options?.persistQuestions) {
      await persistQuestionSet(projectId, 'project', signature, result);
    }
    return result;
  }

  if (phase === 'rooms') {
    // Serve the persisted room set when nothing that feeds it (project state or
    // the About answers) has changed — same IDs, and we skip both the fact
    // digest and the per-room generation LLM calls entirely.
    const signature = await computeQuestionSignature(projectId, 'rooms');
    const persisted = await readPersistedQuestionSet(projectId, 'rooms');
    if (persisted && persisted.signature === signature) {
      return persisted.result;
    }

    // Distill the About answers into the fact digest. Enhancement, never a
    // dependency: any failure here degrades to digest-free room generation.
    let knownFacts: KnownFacts | null = null;
    try {
      const aboutAnswers = await readAboutProjectAnswers(projectId);
      knownFacts = await distillInterviewFacts(aboutAnswers);
      if (knownFacts && options?.persistFacts) {
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
    const result: GroupedQuestionsResult = {
      grouped: true,
      rooms: roomGroups,
      crossRoomQuestions: [],
      globalGates: computeGlobalGates(gateRooms),
      contextLevel: context.level,
      contextDescription: getContextLevelDescription(context.level),
      upgradeSuggestion: getContextUpgradeSuggestion(context.level),
      projectSize: context.projectSize,
    };
    if (options?.persistQuestions) {
      await persistQuestionSet(projectId, 'rooms', signature, result);
    }
    return result;
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
