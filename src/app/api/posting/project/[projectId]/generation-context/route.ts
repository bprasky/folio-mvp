export const dynamic = 'force-dynamic';

/**
 * GET — what this project's article could draw on besides the interview.
 *
 * Asked BEFORE a generation, so the surfaces can offer an option only when it
 * would change the output. The generate route reports the same facts in its
 * response, but that is after the run — too late to decide what to show.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { getGenerationContextAvailability } from '@/lib/posting/generationContext';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectWrite(session.user.id, params.projectId);

    return NextResponse.json(await getGenerationContextAvailability(params.projectId));
  } catch (error: any) {
    if (error?.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error?.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[generation-context] Error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
