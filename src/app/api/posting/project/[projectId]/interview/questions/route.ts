import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getInterviewQuestions } from '@/lib/editorial/getInterviewQuestions';
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

    const questions = await getInterviewQuestions(projectId);
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error fetching interview questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

