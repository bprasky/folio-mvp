import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getInterviewQuestionsWithContext, getInterviewQuestionsGroupedByRoom } from '@/lib/editorial/getInterviewQuestions';
import { assertProjectView, assertProjectWrite } from '@/lib/authz/access';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

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
    const phaseParam = url.searchParams.get('phase');

    // Room-grouped response for Phase B interview pacing.
    // Two-phase generation: `phase=project` returns just the About This Project
    // group (fast); `phase=rooms` generates room questions informed by the
    // designer's saved About answers. No phase = original single-shot behavior.
    if (grouped === 'true') {
      const phase = phaseParam === 'project' || phaseParam === 'rooms' ? phaseParam : undefined;

      // Persisting the fact digest AND the generated question set are DB writes —
      // only allow them when the requester has WRITE access, since this GET is
      // view-gated and viewers (e.g. vendor participants) must never trigger a
      // mutation. Persisting the question set is what gives stable IDs and skips
      // repeat LLM spend on unchanged projects.
      let canWrite = false;
      try {
        await assertProjectWrite(session.user.id, projectId);
        canWrite = true;
      } catch {
        canWrite = false;
      }

      const result = await getInterviewQuestionsGroupedByRoom(
        projectId,
        phase
          ? { phase, persistFacts: phase === 'rooms' && canWrite, persistQuestions: canWrite }
          : { persistQuestions: canWrite },
      );
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

