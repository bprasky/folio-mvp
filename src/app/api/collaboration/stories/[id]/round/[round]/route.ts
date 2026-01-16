export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { assertCollaborationStoryEdit } from '@/lib/collaboration/auth';
import {
  getRound1Questions,
  isRound1Complete,
  Round1Response,
} from '@/lib/collaboration/questions/round1';
import {
  generateRound2Questions,
  isRound2Complete,
} from '@/lib/collaboration/questions/generateRound2';
import {
  generateRound3Questions,
  isRound3Complete,
} from '@/lib/collaboration/questions/generateRound3';
import { CollaborationStoryStatus } from '@prisma/client';

const RoundResponseSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string().min(1).max(5000),
    })
  ),
});

// Map round and role to status transitions
const STATUS_TRANSITIONS: Record<
  string,
  {
    requiredStatus: CollaborationStoryStatus[];
    inProgressStatus: CollaborationStoryStatus;
    completedStatus: CollaborationStoryStatus;
    roundDataField: 'vendorRound1' | 'vendorRound2' | 'vendorRound3' | 'designerRound1' | 'designerRound2' | 'designerRound3';
  }
> = {
  'vendor-1': {
    requiredStatus: ['ACCEPTED', 'ROUND1_DESIGNER'],
    inProgressStatus: 'ROUND1_VENDOR',
    completedStatus: 'ROUND1_COMPLETE',
    roundDataField: 'vendorRound1',
  },
  'vendor-2': {
    requiredStatus: ['ROUND1_COMPLETE', 'ROUND2_DESIGNER'],
    inProgressStatus: 'ROUND2_VENDOR',
    completedStatus: 'ROUND2_COMPLETE',
    roundDataField: 'vendorRound2',
  },
  'vendor-3': {
    requiredStatus: ['ROUND2_COMPLETE', 'ROUND3_DESIGNER'],
    inProgressStatus: 'ROUND3_VENDOR',
    completedStatus: 'ROUND3_COMPLETE',
    roundDataField: 'vendorRound3',
  },
  'designer-1': {
    requiredStatus: ['ACCEPTED', 'ROUND1_VENDOR'],
    inProgressStatus: 'ROUND1_DESIGNER',
    completedStatus: 'ROUND1_COMPLETE',
    roundDataField: 'designerRound1',
  },
  'designer-2': {
    requiredStatus: ['ROUND1_COMPLETE', 'ROUND2_VENDOR'],
    inProgressStatus: 'ROUND2_DESIGNER',
    completedStatus: 'ROUND2_COMPLETE',
    roundDataField: 'designerRound2',
  },
  'designer-3': {
    requiredStatus: ['ROUND2_COMPLETE', 'ROUND3_VENDOR'],
    inProgressStatus: 'ROUND3_DESIGNER',
    completedStatus: 'ROUND3_COMPLETE',
    roundDataField: 'designerRound3',
  },
};

/**
 * GET /api/collaboration/stories/[id]/round/[round]
 * Get questions for a specific round (1, 2, or 3)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; round: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: storyId, round } = params;
    const roundNum = parseInt(round, 10);

    if (![1, 2, 3].includes(roundNum)) {
      return NextResponse.json({ error: 'Invalid round number' }, { status: 400 });
    }

    // Get story and determine user's role
    const { role } = await assertCollaborationStoryEdit(session.user.id, storyId);

    if (role !== 'vendor' && role !== 'designer') {
      return NextResponse.json(
        { error: 'Only participants can access round questions' },
        { status: 403 }
      );
    }

    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      include: {
        vendorOrg: { select: { name: true } },
        designer: { select: { name: true } },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const userRole = role === 'vendor' ? 'VENDOR' : 'DESIGNER';

    // Get questions based on round
    if (roundNum === 1) {
      const questions = getRound1Questions(userRole);
      const existingData = userRole === 'VENDOR'
        ? (story.vendorRound1 as { responses?: Round1Response[] } | null)
        : (story.designerRound1 as { responses?: Round1Response[] } | null);

      return NextResponse.json({
        round: 1,
        role: userRole,
        questions,
        existingResponses: existingData?.responses || [],
      });
    }

    if (roundNum === 2) {
      // Generate personalized follow-up questions based on Round 1
      const round1Data = userRole === 'VENDOR'
        ? (story.vendorRound1 as { responses?: Round1Response[] } | null)
        : (story.designerRound1 as { responses?: Round1Response[] } | null);

      if (!round1Data?.responses || round1Data.responses.length === 0) {
        return NextResponse.json(
          { error: 'Round 1 must be completed first' },
          { status: 400 }
        );
      }

      const questions = await generateRound2Questions(userRole, round1Data.responses);
      const existingData = userRole === 'VENDOR'
        ? (story.vendorRound2 as { responses?: Round1Response[] } | null)
        : (story.designerRound2 as { responses?: Round1Response[] } | null);

      return NextResponse.json({
        round: 2,
        role: userRole,
        questions,
        existingResponses: existingData?.responses || [],
      });
    }

    if (roundNum === 3) {
      // Generate cross-pollinated questions referencing the other party
      const otherRound1 = userRole === 'VENDOR'
        ? (story.designerRound1 as { responses?: Round1Response[] } | null)
        : (story.vendorRound1 as { responses?: Round1Response[] } | null);
      const otherRound2 = userRole === 'VENDOR'
        ? (story.designerRound2 as { responses?: Round1Response[] } | null)
        : (story.vendorRound2 as { responses?: Round1Response[] } | null);

      if (!otherRound1?.responses || otherRound1.responses.length === 0) {
        return NextResponse.json(
          { error: 'Waiting for the other party to complete their rounds' },
          { status: 400 }
        );
      }

      const otherRole = userRole === 'VENDOR' ? 'DESIGNER' : 'VENDOR';
      const otherQuestions = getRound1Questions(otherRole);
      const questions = await generateRound3Questions(
        userRole,
        otherRound1.responses || [],
        otherRound2?.responses || [],
        otherQuestions
      );

      const existingData = userRole === 'VENDOR'
        ? (story.vendorRound3 as { responses?: Round1Response[] } | null)
        : (story.designerRound3 as { responses?: Round1Response[] } | null);

      return NextResponse.json({
        round: 3,
        role: userRole,
        questions,
        existingResponses: existingData?.responses || [],
        otherPartyName: userRole === 'VENDOR' ? story.designer.name : story.vendorOrg.name,
      });
    }

    return NextResponse.json({ error: 'Invalid round' }, { status: 400 });
  } catch (error: any) {
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('[collaboration/stories/round] GET failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch round questions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/collaboration/stories/[id]/round/[round]
 * Submit answers for a round
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; round: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: storyId, round } = params;
    const roundNum = parseInt(round, 10);

    if (![1, 2, 3].includes(roundNum)) {
      return NextResponse.json({ error: 'Invalid round number' }, { status: 400 });
    }

    // Get story and determine user's role
    const { role } = await assertCollaborationStoryEdit(session.user.id, storyId);

    if (role !== 'vendor' && role !== 'designer') {
      return NextResponse.json(
        { error: 'Only participants can submit answers' },
        { status: 403 }
      );
    }

    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const userRole = role === 'vendor' ? 'VENDOR' : 'DESIGNER';
    const transitionKey = `${role}-${roundNum}`;
    const transition = STATUS_TRANSITIONS[transitionKey];

    if (!transition) {
      return NextResponse.json({ error: 'Invalid round configuration' }, { status: 400 });
    }

    // Parse body
    const body = await request.json();
    const input = RoundResponseSchema.parse(body);

    // Add timestamps to responses
    const responses: Round1Response[] = input.responses.map((r) => ({
      ...r,
      answeredAt: new Date().toISOString(),
    }));

    // Determine if this round is complete
    let isComplete = false;
    if (roundNum === 1) {
      isComplete = isRound1Complete(responses, userRole);
    } else if (roundNum === 2) {
      isComplete = isRound2Complete(responses);
    } else if (roundNum === 3) {
      isComplete = isRound3Complete(responses);
    }

    // Prepare update data
    const roundData = {
      responses,
      completedAt: isComplete ? new Date().toISOString() : undefined,
    };

    // Determine new status
    // Check if the other party has also completed this round
    let newStatus: CollaborationStoryStatus = transition.inProgressStatus;

    if (isComplete) {
      // Check if other party has completed their part
      const otherRoleField =
        userRole === 'VENDOR'
          ? (`designerRound${roundNum}` as keyof typeof story)
          : (`vendorRound${roundNum}` as keyof typeof story);
      const otherData = story[otherRoleField] as { completedAt?: string } | null;

      if (otherData?.completedAt) {
        // Both parties completed - move to complete status
        newStatus = transition.completedStatus;
      }
    }

    // Update story
    const updatedStory = await prisma.collaborationStory.update({
      where: { id: storyId },
      data: {
        [transition.roundDataField]: roundData,
        status: newStatus,
        ...(userRole === 'VENDOR' && isComplete && roundNum === 3
          ? { vendorCompletedAt: new Date() }
          : {}),
        ...(userRole === 'DESIGNER' && isComplete && roundNum === 3
          ? { designerCompletedAt: new Date() }
          : {}),
      },
    });

    // TODO: Notify other party if round is complete
    // if (isComplete) {
    //   await sendRoundCompleteNotification(storyId, userRole, roundNum);
    // }

    console.log('[collaboration/stories/round] Submitted:', {
      storyId,
      round: roundNum,
      role: userRole,
      responseCount: responses.length,
      isComplete,
      newStatus,
    });

    return NextResponse.json({
      success: true,
      round: roundNum,
      isComplete,
      status: newStatus,
      responseCount: responses.length,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('[collaboration/stories/round] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to submit round answers' },
      { status: 500 }
    );
  }
}
