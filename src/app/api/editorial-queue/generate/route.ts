import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { maybeUnlockEditorialQueue } from '@/lib/editorial-queue/unlock';
import { resolvePublishingStudioContext, StudioAccessError } from '@/lib/publishing-studio/data';
import { canAccessDesignerTools } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';

// POST /api/editorial-queue/generate
//
// Manual/self trigger for the Editorial Queue three-story gate. The publish
// paths fire the same unlock automatically on the third publish; this route
// exists for designers who were already eligible before the feature shipped
// (the gate never ran for them at publish time). Idempotent: once unlocked, it
// returns already_unlocked and does not regenerate.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canAccessDesignerTools(session.user.role)) return NextResponse.json({ error: 'Designer access required' }, { status: 403 });
  if (process.env.STUDIO_EDITORIAL_READINESS === 'true') return NextResponse.json({ error: 'Review stories through the Publishing Studio readiness workflow.' }, { status: 409 });
  try {
    const workspace = await resolvePublishingStudioContext(session.user.id);
    if (workspace.id && !workspace.canWriteCampaigns) return NextResponse.json({ error: 'Editing is not available in this workspace.' }, { status: 403 });
    const budget = await checkRateLimit(`publishing-studio:ideas:${session.user.id}:${workspace.id ?? 'personal'}`, { max: 1, windowMs: 60 * 60 * 1000 });
    if (!budget.success) return NextResponse.json({ error: 'Your work was recently reviewed. Try again later.' }, { status: 429 });
    const result = await maybeUnlockEditorialQueue(session.user.id, workspace.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
