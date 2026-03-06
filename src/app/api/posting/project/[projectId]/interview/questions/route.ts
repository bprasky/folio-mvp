export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getInterviewQuestionsWithContext, getInterviewQuestionsGroupedByRoom } from '@/lib/editorial/getInterviewQuestions';
import { assertProjectView } from '@/lib/authz/access';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.projectId;
    await assertProjectView(session.user.id, projectId);

    // Get URL params for customization
    const url = new URL(request.url);
    const grouped = url.searchParams.get('grouped');
    const maxQuestions = url.searchParams.get('maxQuestions');
    const prioritizeBoostable = url.searchParams.get('prioritizeBoostable');

    // Room-grouped response for Phase B interview pacing
    if (grouped === 'true') {
      const result = await getInterviewQuestionsGroupedByRoom(projectId);
      return NextResponse.json(result);
    }

    const result = await getInterviewQuestionsWithContext(projectId, {
      maxQuestions: maxQuestions ? parseInt(maxQuestions, 10) : undefined,
      prioritizeBoostable: prioritizeBoostable === 'true',
    });

    return NextResponse.json({
      questions: result.questions,
      contextLevel: result.contextLevel,
      contextDescription: result.contextDescription,
      upgradeSuggestion: result.upgradeSuggestion,
      projectSize: result.projectSize,
    });
  } catch (error) {
    console.error('Error fetching interview questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

