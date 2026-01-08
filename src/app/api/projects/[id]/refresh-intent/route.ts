export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { updateProjectUnderstandingFromNotes } from '@/lib/ai/projectUnderstanding';

/**
 * GET /api/projects/[id]/refresh-intent
 * Returns current project understanding without processing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch existing project intent
    const projectIntent = await prisma.projectIntent.findUnique({
      where: { projectId },
    });

    // Fetch room intents
    const roomIntents = await prisma.roomIntent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!projectIntent) {
      return NextResponse.json({
        projectIntent: null,
        roomIntents: [],
      });
    }

    return NextResponse.json({
      projectIntent: {
        id: projectIntent.id,
        summary: projectIntent.summary,
        moodKeywords: projectIntent.moodKeywords,
        styleTags: projectIntent.styleTags,
        budgetLevel: projectIntent.budgetLevel,
        keyObjectives: projectIntent.keyObjectives,
        constraints: projectIntent.constraints,
      },
      roomIntents: roomIntents.map((ri) => ({
        id: ri.id,
        roomName: ri.roomName,
        moodKeywords: ri.moodKeywords,
        functionalGoals: ri.functionalGoals,
        mustHaves: ri.mustHaves,
        niceToHaves: ri.niceToHaves,
      })),
    });
  } catch (error) {
    console.error('Error fetching project intent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project intent' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/refresh-intent
 * Processes meeting notes and updates project understanding
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Process meeting notes and update understanding
    const result = await updateProjectUnderstandingFromNotes(projectId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error refreshing project intent:', error);
    return NextResponse.json(
      { error: 'Failed to refresh project intent' },
      { status: 500 }
    );
  }
}




