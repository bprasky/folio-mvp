/**
 * Project Understanding Service
 * 
 * Processes meeting notes into structured project understanding.
 * Currently stubbed - AI integration pending.
 */

import { prisma } from '@/lib/prisma';

export interface ProjectUnderstandingResult {
  projectIntent: {
    id: string;
    summary: string | null;
    moodKeywords: string[];
    styleTags: string[];
    budgetLevel: string | null;
    keyObjectives: any;
    constraints: any;
  };
  roomIntents: Array<{
    id: string;
    roomName: string;
    moodKeywords: string[];
    functionalGoals: any;
    mustHaves: any;
    niceToHaves: any;
  }>;
}

/**
 * Updates project understanding from meeting notes.
 * 
 * TODO: Replace with real LLM processing when AI integration is ready.
 */
export async function updateProjectUnderstandingFromNotes(
  projectId: string
): Promise<ProjectUnderstandingResult> {
  // Fetch all meeting notes for the project
  const notes = await prisma.meetingNote.findMany({
    where: {
      projectId,
      status: 'ready',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Aggregate all raw text
  const aggregatedText = notes
    .map((note) => note.rawText)
    .filter((text): text is string => !!text)
    .join('\n\n');

  const noteCount = notes.length;

  // Create or update ProjectIntent with placeholder summary
  const projectIntent = await prisma.projectIntent.upsert({
    where: { projectId },
    create: {
      projectId,
      summary: `This is a placeholder summary based on ${noteCount} note${noteCount !== 1 ? 's' : ''}. (AI integration pending.)`,
      moodKeywords: [],
      styleTags: [],
      keyObjectives: null,
      constraints: null,
      rawState: {
        aggregatedTextLength: aggregatedText.length,
        noteCount,
        processedAt: new Date().toISOString(),
      },
    },
    update: {
      summary: `This is a placeholder summary based on ${noteCount} note${noteCount !== 1 ? 's' : ''}. (AI integration pending.)`,
      rawState: {
        aggregatedTextLength: aggregatedText.length,
        noteCount,
        processedAt: new Date().toISOString(),
      },
    },
  });

  // Create or update a placeholder RoomIntent for "Living Room"
  let roomIntent = await prisma.roomIntent.findFirst({
    where: {
      projectId,
      roomName: 'Living Room',
    },
  });

  if (!roomIntent) {
    roomIntent = await prisma.roomIntent.create({
      data: {
        projectId,
        roomName: 'Living Room',
        moodKeywords: [],
        functionalGoals: null,
        mustHaves: null,
        niceToHaves: null,
        constraints: null,
      },
    });
  }

  // Fetch all room intents for the project
  const allRoomIntents = await prisma.roomIntent.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    projectIntent: {
      id: projectIntent.id,
      summary: projectIntent.summary,
      moodKeywords: projectIntent.moodKeywords,
      styleTags: projectIntent.styleTags,
      budgetLevel: projectIntent.budgetLevel,
      keyObjectives: projectIntent.keyObjectives,
      constraints: projectIntent.constraints,
    },
    roomIntents: allRoomIntents.map((ri) => ({
      id: ri.id,
      roomName: ri.roomName,
      moodKeywords: ri.moodKeywords,
      functionalGoals: ri.functionalGoals,
      mustHaves: ri.mustHaves,
      niceToHaves: ri.niceToHaves,
    })),
  };
}




