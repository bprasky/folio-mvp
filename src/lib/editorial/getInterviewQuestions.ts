import { randomUUID } from 'crypto';
import { generateContextualQuestions, ContextualQuestion } from './generateContextualQuestions';
import {
  assessProjectContext,
  generateInterviewQuestions,
  toInterviewQuestion,
  type ContextLevel,
  type GeneratedQuestion,
  type ProjectSizeClassification,
} from '@/lib/interview';
import { prisma } from '@/lib/prisma';
import {
  computeRoomBudget,
  computeGlobalGates,
  type RoomQuestionsGroup,
  type RoomGroupedQuestions,
} from './roomPacing';
import { formatRoomName } from '@/lib/utils/formatRoomName';

// Base questions from existing question bank (Level 0 fallback)
const BASE_QUESTIONS = [
  {
    id: 'base_1',
    questionText: "What was the initial brief or vision for this project?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'brief',
  },
  {
    id: 'base_2',
    questionText: "What was the biggest challenge you faced?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'process',
  },
  {
    id: 'base_3',
    questionText: "Is there a particular detail or moment you're most proud of?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'highlight',
  },
  {
    id: 'base_4',
    questionText: "How would you describe the overall aesthetic?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'aesthetic',
  },
  {
    id: 'base_5',
    questionText: "What do you hope people feel when they experience this space?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'emotion',
  },
];

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
 * Get interview questions for a project using the contextual interview system.
 * Questions scale with available project context.
 */
export async function getInterviewQuestions(projectId: string): Promise<InterviewQuestion[]> {
  const result = await getInterviewQuestionsWithContext(projectId);
  return result.questions;
}

/**
 * Get interview questions with full context information.
 * Returns questions along with context level and upgrade suggestions.
 */
export async function getInterviewQuestionsWithContext(
  projectId: string,
  options?: {
    maxQuestions?: number;
    prioritizeBoostable?: boolean;
    includeGeneric?: boolean;
  }
): Promise<InterviewQuestionsResult> {
  try {
    // Assess project context to determine what data is available
    const context = await assessProjectContext(projectId);

    // Generate contextual questions scaled to project size
    const targetCount = context.projectSize.targetQuestionCount;
    const contextualQuestions = await generateInterviewQuestions(context, {
      maxQuestions: targetCount,
      prioritizeBoostable: options?.prioritizeBoostable ?? true,
      includeGeneric: true, // Include generic as fallback for low-context projects
      projectId,
    });

    // Convert generated questions to interview format
    const contextualInterviewQuestions: InterviewQuestion[] = contextualQuestions.map((q) => {
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
      };
    });

    // Build final list — contextual questions only, no legacy template system
    const merged: InterviewQuestion[] = [...contextualInterviewQuestions];

    // Only add base questions as fallback if contextual system produced very few
    if (merged.length < 4) {
      const coveredCategories = new Set<string>();
      for (const q of merged) {
        const t = q.questionText.toLowerCase();
        if (t.includes('vision') || t.includes('brief') || t.includes('direction') || t.includes('initial')) coveredCategories.add('brief');
        if (t.includes('challenge') || t.includes('obstacle') || t.includes('constraint')) coveredCategories.add('process');
        if (t.includes('proud') || t.includes('favorite') || t.includes('detail') || t.includes('moment')) coveredCategories.add('highlight');
        if (t.includes('aesthetic') || t.includes('style') || t.includes('look')) coveredCategories.add('aesthetic');
        if (t.includes('feel') || t.includes('experience') || t.includes('emotion') || t.includes('hope')) coveredCategories.add('emotion');
      }

      for (const bq of BASE_QUESTIONS) {
        if (!coveredCategories.has(bq.category) && merged.length < targetCount) {
          merged.push({
            id: bq.id,
            questionText: bq.questionText,
            questionType: bq.questionType,
            source: bq.source,
            category: bq.category,
            contextLevel: 0,
          });
        }
      }
    }

    // Hard cap — scaled to project size
    const maxTotal = options?.maxQuestions || targetCount;
    const capped = merged.slice(0, maxTotal);

    // Get context description and upgrade suggestion
    const { getContextLevelDescription, getContextUpgradeSuggestion } = await import('@/lib/interview');

    return {
      questions: capped,
      contextLevel: context.level,
      contextDescription: getContextLevelDescription(context.level),
      upgradeSuggestion: getContextUpgradeSuggestion(context.level),
      projectSize: context.projectSize,
    };
  } catch (error) {
    console.error('[getInterviewQuestions] Error generating contextual questions:', error);

    // Fall back to legacy behavior if the new system fails
    return fallbackToLegacyQuestions(projectId);
  }
}

/**
 * Fallback to legacy question generation if the new system fails
 */
async function fallbackToLegacyQuestions(projectId: string): Promise<InterviewQuestionsResult> {
  // Get contextual questions from AI classification (legacy)
  const contextualQuestions = await generateContextualQuestions(projectId);

  // Convert contextual questions to interview format
  const contextualInterviewQuestions: InterviewQuestion[] = contextualQuestions.map(cq => ({
    id: cq.id,
    questionText: cq.questionText,
    questionType: 'contextual' as const,
    source: 'ai_classification' as const,
    linkedImageId: cq.linkedImageId,
    linkedProductId: cq.linkedProductId,
    attributeType: cq.attributeType,
    attributeValue: cq.attributeValue,
    roomContext: cq.roomContext,
  }));

  // Interleave: base question, contextual, base, contextual, etc.
  const merged: InterviewQuestion[] = [];
  const baseQ = [...BASE_QUESTIONS];
  const contextQ = [...contextualInterviewQuestions];

  // Start with brief question
  if (baseQ.length > 0) {
    merged.push({
      id: baseQ[0].id,
      questionText: baseQ[0].questionText,
      questionType: baseQ[0].questionType,
      source: baseQ[0].source,
      category: baseQ[0].category,
    });
    baseQ.shift();
  }

  // Interleave remaining
  while (baseQ.length > 0 || contextQ.length > 0) {
    if (contextQ.length > 0) {
      merged.push(contextQ.shift()!);
    }
    if (baseQ.length > 0) {
      const bq = baseQ.shift()!;
      merged.push({
        id: bq.id,
        questionText: bq.questionText,
        questionType: bq.questionType,
        source: bq.source,
        category: bq.category,
      });
    }
  }

  return {
    questions: merged,
    contextLevel: contextualInterviewQuestions.length > 0 ? 1 : 0,
    contextDescription: contextualInterviewQuestions.length > 0
      ? 'Questions based on project photos'
      : 'No project context available',
    upgradeSuggestion: 'Upload more project files to unlock personalized questions',
    projectSize: { size: 'focused' as const, targetQuestionCount: 6, roomCount: 0, selectionCount: 0 },
  };
}

/**
 * Get interview questions grouped by room with per-room budgets.
 * Used when `?grouped=true` is passed to the questions API.
 *
 * Spec: 17_EDITORIAL_FLOW_SPEC.md §3
 */
export async function getInterviewQuestionsGroupedByRoom(
  projectId: string,
): Promise<{
  grouped: true;
  rooms: RoomQuestionsGroup[];
  crossRoomQuestions: InterviewQuestion[];
  globalGates: RoomGroupedQuestions['globalGates'];
  contextLevel: ContextLevel;
  contextDescription: string;
  upgradeSuggestion: string | null;
  projectSize: ProjectSizeClassification;
}> {
  // 1. Assess project context (reuses existing room infrastructure)
  const context = await assessProjectContext(projectId);

  // 2. Count images per room
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      images: { select: { room: true, tags: { select: { id: true } } } },
      rooms: { select: { id: true, name: true, type: true } },
    },
  });

  const roomIdToName = new Map<string, string>();
  for (const room of project?.rooms ?? []) {
    roomIdToName.set(room.id, room.name);
  }

  // Build image+tag counts per room (normalize names to Title Case)
  const imageCountByRoom = new Map<string, number>();
  const tagCountByRoom = new Map<string, number>();
  for (const img of project?.images ?? []) {
    if (!img.room) continue;
    const resolved = formatRoomName(roomIdToName.get(img.room) || img.room);
    imageCountByRoom.set(resolved, (imageCountByRoom.get(resolved) || 0) + 1);
    tagCountByRoom.set(resolved, (tagCountByRoom.get(resolved) || 0) + img.tags.length);
  }

  // 3. Generate flat question list (existing pipeline)
  const contextualQuestions = await generateInterviewQuestions(context, {
    maxQuestions: context.projectSize.targetQuestionCount + 5, // over-generate, then trim per room
    prioritizeBoostable: true,
    includeGeneric: true,
    projectId,
  });

  // Convert to InterviewQuestion format
  const allQuestions: InterviewQuestion[] = contextualQuestions.map((q) => {
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
      // Assign roomId from the room context
      roomId: q.rooms?.[0] ? (context.rooms.find(r => r.name === q.rooms![0])?.id) : undefined,
      isCrossRoom: (q.rooms?.length ?? 0) > 1,
    };
  });

  // 4. Partition into room buckets
  const roomBuckets = new Map<string, InterviewQuestion[]>();
  const crossRoomQuestions: InterviewQuestion[] = [];
  const globalOpeners: InterviewQuestion[] = [];

  // Initialize buckets for known rooms
  for (const room of context.rooms) {
    roomBuckets.set(room.name, []);
  }

  for (const q of allQuestions) {
    const qRooms = q.rooms || [];
    if (qRooms.length === 0) {
      // No room association — global opener or cross-room
      if (q.contextLevel === 0 || q.questionCategory === 'generic' || q.questionCategory === 'prospective_vision') {
        globalOpeners.push(q);
      } else {
        crossRoomQuestions.push(q);
      }
    } else if (qRooms.length === 1 && roomBuckets.has(qRooms[0])) {
      roomBuckets.get(qRooms[0])!.push(q);
    } else {
      // Multi-room question → cross-room
      crossRoomQuestions.push(q);
    }
  }

  // 5. Build room groups with budgets, trim to budget
  const roomGroups: RoomQuestionsGroup[] = [];
  const gateRooms: Array<{ roomId: string; roomName: string; imageCount: number; tagCount: number }> = [];

  for (const room of context.rooms) {
    const displayName = formatRoomName(room.name);
    const imgCount = imageCountByRoom.get(displayName) || imageCountByRoom.get(room.name) || 0;
    const tgCount = tagCountByRoom.get(displayName) || tagCountByRoom.get(room.name) || room.selectionCount;
    const budget = computeRoomBudget(imgCount, tgCount);
    const questions = (roomBuckets.get(room.name) || []).slice(0, budget.baseQuestions);

    // If the room has fewer questions than budget, add base fallbacks
    if (questions.length < budget.baseQuestions) {
      const needed = budget.baseQuestions - questions.length;
      // Pull from global openers to fill
      for (let i = 0; i < needed && globalOpeners.length > 0; i++) {
        const opener = globalOpeners.shift()!;
        opener.roomId = room.id;
        questions.push(opener);
      }
    }

    // Tag all questions with roomId
    for (const q of questions) {
      q.roomId = room.id;
    }

    roomGroups.push({
      roomId: room.id,
      roomName: displayName,
      roomType: room.type,
      budget: {
        roomId: room.id,
        roomName: displayName,
        roomType: room.type,
        imageCount: imgCount,
        tagCount: tgCount,
        baseQuestions: budget.baseQuestions,
        maxFollowUps: budget.maxFollowUps,
      },
      questions,
    });

    gateRooms.push({
      roomId: room.id,
      roomName: displayName,
      imageCount: imgCount,
      tagCount: tgCount,
    });
  }

  // 6. Build General phase (opening project-level questions)
  const generalQuestions = generateGeneralQuestions(context, project);
  const generalGroup: RoomQuestionsGroup = {
    roomId: '__general__',
    roomName: 'General',
    roomType: null,
    budget: {
      roomId: '__general__',
      roomName: 'General',
      roomType: null,
      imageCount: 0,
      tagCount: 0,
      baseQuestions: generalQuestions.length,
      maxFollowUps: 0,
    },
    questions: generalQuestions,
  };

  // 7. Build Reflections phase (closing synthesis questions)
  const reflectionQuestions = generateReflectionQuestions(context, project);
  const reflectionsGroup: RoomQuestionsGroup = {
    roomId: '__reflections__',
    roomName: 'Reflections',
    roomType: null,
    budget: {
      roomId: '__reflections__',
      roomName: 'Reflections',
      roomType: null,
      imageCount: 0,
      tagCount: 0,
      baseQuestions: reflectionQuestions.length,
      maxFollowUps: 0,
    },
    questions: reflectionQuestions,
  };

  // 8. Assemble final rooms: General → Room groups → Reflections
  const allRoomGroups = [generalGroup, ...roomGroups, reflectionsGroup];

  // 9. Compute global gates (only for actual rooms, not phases)
  const globalGates = computeGlobalGates(gateRooms);

  // 10. Context metadata
  const { getContextLevelDescription, getContextUpgradeSuggestion } = await import('@/lib/interview');

  return {
    grouped: true,
    rooms: allRoomGroups,
    crossRoomQuestions: crossRoomQuestions.slice(0, 2), // max 2 cross-room
    globalGates,
    contextLevel: context.level,
    contextDescription: getContextLevelDescription(context.level),
    upgradeSuggestion: getContextUpgradeSuggestion(context.level),
    projectSize: context.projectSize,
  };
}

// ---------------------------------------------------------------------------
// General phase question generation
// ---------------------------------------------------------------------------

function generateGeneralQuestions(
  context: Awaited<ReturnType<typeof assessProjectContext>>,
  project: { rooms?: Array<{ name: string }> } | null,
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];

  const roomCount = context.rooms.length;
  const roomList = context.rooms.slice(0, 3).map(r => formatRoomName(r.name)).join(', ');
  const hasSelections = context.selections.length > 0;

  // Question 1: Project brief/vision
  if (context.isProspective) {
    questions.push({
      id: `general-${randomUUID()}`,
      questionText: roomCount > 1
        ? `You're designing across ${roomList}${roomCount > 3 ? ' and more' : ''} — what's the overarching vision tying these spaces together?`
        : `What's the design direction you're working toward for this project?`,
      questionType: 'base',
      source: 'base_question',
      category: 'brief',
      contextLevel: 0,
    });
  } else {
    questions.push({
      id: `general-${randomUUID()}`,
      questionText: roomCount > 1
        ? `This project spans ${roomList}${roomCount > 3 ? ' and more' : ''} — what was the original brief?`
        : `What was the brief or starting point for this project?`,
      questionType: 'base',
      source: 'base_question',
      category: 'brief',
      contextLevel: 0,
    });
  }

  // Question 2: Process/constraint
  if (hasSelections) {
    const vendorNames = [...new Set(context.selections.map(s => s.brand).filter(Boolean))].slice(0, 2);
    if (vendorNames.length > 0) {
      questions.push({
        id: `general-${randomUUID()}`,
        questionText: `What was the biggest constraint you were working with, and how did it shape the final design?`,
        questionType: 'base',
        source: 'base_question',
        category: 'process',
        contextLevel: 0,
      });
    } else {
      questions.push({
        id: `general-${randomUUID()}`,
        questionText: `What was the first major design decision you made on this project?`,
        questionType: 'base',
        source: 'base_question',
        category: 'process',
        contextLevel: 0,
      });
    }
  } else {
    questions.push({
      id: `general-${randomUUID()}`,
      questionText: `What was the first design decision that set the tone for everything else?`,
      questionType: 'base',
      source: 'base_question',
      category: 'process',
      contextLevel: 0,
    });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Reflections phase question generation
// ---------------------------------------------------------------------------

function generateReflectionQuestions(
  context: Awaited<ReturnType<typeof assessProjectContext>>,
  project: { rooms?: Array<{ name: string }> } | null,
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];

  const roomCount = context.rooms.length;

  // Question 1: Hidden detail / discovery
  if (roomCount > 1) {
    questions.push({
      id: `reflection-${randomUUID()}`,
      questionText: `Looking at the whole project, what's the one detail or decision that most people would miss?`,
      questionType: 'base',
      source: 'base_question',
      category: 'reflection',
      contextLevel: 0,
    });
  } else {
    questions.push({
      id: `reflection-${randomUUID()}`,
      questionText: `What would you want someone to notice first when they walk into this space?`,
      questionType: 'base',
      source: 'base_question',
      category: 'reflection',
      contextLevel: 0,
    });
  }

  // Question 2: Direction change / pride moment
  if (context.isProspective) {
    questions.push({
      id: `reflection-${randomUUID()}`,
      questionText: `Has the design direction shifted at any point during this project? What prompted that change?`,
      questionType: 'base',
      source: 'base_question',
      category: 'reflection',
      contextLevel: 0,
    });
  } else {
    questions.push({
      id: `reflection-${randomUUID()}`,
      questionText: `Was there a moment where the design direction changed significantly? What made you rethink?`,
      questionType: 'base',
      source: 'base_question',
      category: 'reflection',
      contextLevel: 0,
    });
  }

  return questions;
}
