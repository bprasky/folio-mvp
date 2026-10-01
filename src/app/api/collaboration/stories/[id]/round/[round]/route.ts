export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { z } from 'zod';
import { saveCollaborationResponses, readCollaborationInterview, prepareCollaborationQuestions } from '@/lib/collaboration/interview-service';
import { revalidatePath } from 'next/cache';

const RoundResponseSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string().min(1).max(5000),
    })
  ),
});

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

    const prepared = await prepareCollaborationQuestions(session.user.id, storyId, roundNum as 1 | 2 | 3);
    const current = await readCollaborationInterview(session.user.id, storyId, roundNum as 1 | 2 | 3);
    return NextResponse.json({ round: roundNum, role: current.role === 'vendor' ? 'VENDOR' : 'DESIGNER', questions: prepared, existingResponses: current.data.responses || [] });
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

    const input = RoundResponseSchema.parse(await request.json());
    const result = await saveCollaborationResponses(session.user.id, storyId, roundNum as 1 | 2 | 3, input.responses);
    revalidatePath('/collaboration/stories/' + storyId);
    return NextResponse.json(result);
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
