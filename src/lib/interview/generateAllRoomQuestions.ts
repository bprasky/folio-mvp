/**
 * Orchestrator for Per-Room Interview Question Generation
 *
 * Replaces the old flat generateInterviewQuestions() pipeline.
 * Fires parallel LLM calls — one per room — using Promise.allSettled.
 */

import { prisma } from '@/lib/prisma';
import { assessProjectContext, type ProjectContext } from './contextLevel';
import { computeRoomBudget } from '@/lib/editorial/roomPacing';
import { generateRoomQuestions, type RoomQuestionOutput } from './generateRoomQuestions';
import type { GeneratedQuestion } from './generateQuestions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard cap to prevent runaway costs on projects with many rooms */
const MAX_TOTAL_QUESTIONS = 20;

/** Even the smallest room gets at least this many questions */
const MIN_QUESTIONS_PER_ROOM = 2;

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function generateAllRoomQuestions(
  projectId: string,
): Promise<{
  roomResults: RoomQuestionOutput[];
  context: ProjectContext;
  totalGenerated: number;
}> {
  console.info(`[QUESTION_GEN] Starting per-room generation for project ${projectId}`);

  // 1. Assess project context
  const context = await assessProjectContext(projectId);

  // 2. Load room-level data (images, tags)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
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
            },
          },
        },
      },
      images: {
        select: {
          id: true,
          url: true,
          room: true,
          aiClassification: true,
        },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!project) throw new Error(`Project not found: ${projectId}`);

  // Build room ID → name lookup
  const roomIdToName = new Map<string, string>();
  for (const room of project.rooms) {
    roomIdToName.set(room.id, room.name);
  }

  // 3. Compute per-room budgets and enforce total cap
  const allRoomNames = project.rooms.map((r) => r.name);
  console.info(`[QUESTION_GEN] Rooms: ${allRoomNames.join(', ')} | Computing budgets...`);

  const roomBudgets: Array<{ room: typeof project.rooms[0]; images: typeof project.images; budget: number }> = [];
  let totalBudget = 0;

  for (const room of project.rooms) {
    const roomImages = project.images.filter((img) => {
      if (!img.room) return false;
      const resolved = roomIdToName.get(img.room) || img.room;
      return resolved === room.name;
    });
    const imgCount = roomImages.length;
    const tagCount = room.selections.length;
    const { baseQuestions } = computeRoomBudget(imgCount, tagCount);

    roomBudgets.push({
      room,
      images: roomImages,
      budget: Math.max(MIN_QUESTIONS_PER_ROOM, baseQuestions),
    });
    totalBudget += Math.max(MIN_QUESTIONS_PER_ROOM, baseQuestions);
  }

  // If total exceeds cap, proportionally reduce (minimum MIN_QUESTIONS_PER_ROOM per room)
  if (totalBudget > MAX_TOTAL_QUESTIONS) {
    const scale = MAX_TOTAL_QUESTIONS / totalBudget;
    let adjusted = 0;
    for (const rb of roomBudgets) {
      rb.budget = Math.max(MIN_QUESTIONS_PER_ROOM, Math.round(rb.budget * scale));
      adjusted += rb.budget;
    }
    totalBudget = adjusted;
  }

  console.info(`[QUESTION_GEN] Total budget: ${totalBudget}`, {
    perRoom: roomBudgets.map((rb) => `${rb.room.name}=${rb.budget}`).join(', '),
  });

  // 4. Aggregate project-level style info for cross-room context
  const materialPalette = context.materialThemes;
  const overallStyle = context.colorPalette.length > 0
    ? context.colorPalette.join(', ')
    : undefined;
  const designerName = context.dominantVendors.length > 0
    ? undefined // We don't have designer name in context, brief does
    : undefined;

  // 5. Fire parallel LLM calls
  const promises = roomBudgets.map((rb) => {
    const otherRoomNames = allRoomNames.filter((n) => n !== rb.room.name);
    const roomImages = rb.images.map((img) => ({
      url: img.url,
      classification: img.aiClassification as Record<string, unknown> | null,
    }));
    const roomTags = rb.room.selections.map((s) => ({
      productName: s.productName || s.colorFinish || 'Product',
      vendorName: s.vendorName || undefined,
    }));

    console.info(`[QUESTION_GEN] ${rb.room.name}: budget=${rb.budget}, images=${rb.images.length}, tags=${roomTags.length}`);

    return generateRoomQuestions({
      roomName: rb.room.name,
      roomImages,
      roomTags,
      budget: rb.budget,
      contextLevel: context.level,
      projectContext: {
        projectTitle: project.title || undefined,
        designerName,
        overallStyle,
        materialPalette,
        otherRoomNames,
      },
    });
  });

  const results = await Promise.allSettled(promises);

  // 6. Collect results, log per-room outcomes
  const roomResults: RoomQuestionOutput[] = [];
  let totalGenerated = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const rb = roomBudgets[i];

    if (result.status === 'fulfilled') {
      const output = result.value;
      totalGenerated += output.questions.length;
      console.info(`[QUESTION_GEN] ${rb.room.name}: LLM returned ${output.questions.length} questions (requested ${rb.budget})`);
      roomResults.push(output);
    } else {
      console.error(`[QUESTION_GEN] ${rb.room.name}: FAILED - ${result.reason?.message || result.reason}`);
      // Return empty result for failed room — don't block others
      roomResults.push({ roomName: rb.room.name, questions: [] });
    }
  }

  console.info(`[QUESTION_GEN] Complete: ${totalGenerated} questions across ${roomResults.length} rooms`);

  return { roomResults, context, totalGenerated };
}
