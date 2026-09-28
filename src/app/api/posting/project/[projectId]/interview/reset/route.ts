import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { GuidedConflict } from '@/lib/interview/guided/controller';
import { SpotlightConflict } from '@/lib/spotlight/gate';
import { getInterviewResetSnapshot, resetProjectInterview } from '@/lib/interview/reset';

export const dynamic = 'force-dynamic';

const resetSchema = z.object({
  requestId: z.string().uuid(), revision: z.string().regex(/^[a-f0-9]{64}$/), sessionId: z.string().min(1).max(200).nullable(),
}).strict();

async function actorId() {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) throw new GuidedConflict('UNAUTHORIZED', 'Sign in to continue.', 401);
  return auth.user.id;
}

function failure(error: unknown) {
  if (error instanceof GuidedConflict || error instanceof SpotlightConflict)
    return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return NextResponse.json({ ok: false, code: 'INVALID_RESET', message: 'Open Start over again to check the saved interview before clearing it.' }, { status: 422 });
  if (error instanceof Error && /^(Forbidden|NotFound)/.test(error.message))
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: 'You do not have permission to edit this project.' }, { status: 403 });
  console.error('[interview/reset] Reset failed', { kind: error instanceof Error ? error.name : 'unknown' });
  return NextResponse.json({ ok: false, code: 'RESET_FAILED', message: 'The interview could not be reset. Retry to check its status.' }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const snapshot = await getInterviewResetSnapshot(params.projectId, await actorId());
    return NextResponse.json({ ok: true, snapshot }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const actor = await actorId();
    const command = resetSchema.parse(await request.json());
    const result = await resetProjectInterview(params.projectId, actor, { ...command, sessionId: command.sessionId ?? null });
    revalidatePath(`/project/${params.projectId}`);
    revalidatePath('/designer/projects');
    revalidatePath(`/designer/projects/${params.projectId}/preview`);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
