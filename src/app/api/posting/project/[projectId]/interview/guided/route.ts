import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { SpotlightConflict } from '@/lib/spotlight/gate';
import { GuidedConflict } from '@/lib/interview/guided/controller';
import { getGuidedSession, runGuidedCommand } from '@/lib/interview/guided/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const commandSchema = z.object({
  action: z.enum(['start', 'answer', 'confirm', 'skip', 'skip_room', 'section', 'pause', 'resume', 'retry', 'finish', 'correct']),
  requestId: z.string().min(8).max(100), version: z.number().int().nonnegative(),
  sessionId: z.string().uuid().optional(),
  questionId: z.string().min(1).max(200).optional(), text: z.string().max(2000).optional(),
  inputModality: z.enum(['text', 'voice', 'mixed']).optional(),
  recordingId: z.string().uuid().optional(),
  roomId: z.string().min(1).max(200).nullable().optional(),
  selectedImageId: z.string().max(200).nullable().optional(), confirmPartial: z.boolean().optional(),
}).strict();

async function assertGuidedAccess(projectId: string) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) throw new GuidedConflict('UNAUTHORIZED', 'Sign in to continue.', 401);
  // Enrollment survives the spotlight kill switch and account gate. A pilot
  // project can never use this route to bypass its protected interview.
  assertLegacyInterviewAllowed(projectId);
  await assertProjectWrite(auth.user.id, projectId);
  return auth.user.id;
}

function failure(error: unknown) {
  if (error instanceof GuidedConflict || error instanceof SpotlightConflict)
    return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return NextResponse.json({ ok: false, code: 'INVALID_REQUEST', message: 'Check the request and keep each answer within 2,000 characters. Your full text has not been saved or shortened.' }, { status: 422 });
  if (error instanceof Error && /^(Forbidden|NotFound)/.test(error.message))
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: 'You do not have permission to edit this project.' }, { status: 403 });
  // Never expose provider or database error details (which may contain context).
  console.error('[guided-interview] Request failed', { kind: error instanceof Error ? error.name : 'unknown' });
  return NextResponse.json({ ok: false, code: 'SAVE_FAILED', message: 'The interview could not be saved. Keep your text and retry.' }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const actorId = await assertGuidedAccess(params.projectId);
    const session = await getGuidedSession(params.projectId, actorId);
    if (!session && process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW !== '1')
      throw new GuidedConflict('PILOT_DISABLED', 'New guided interviews are not enabled.', 404);
    return NextResponse.json({ ok: true, session }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const actorId = await assertGuidedAccess(params.projectId);
    const command = commandSchema.parse(await request.json());
    // Rollback stops new sessions. Saved sessions retain their safe writer.
    if (process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW !== '1' && !await getGuidedSession(params.projectId, actorId))
      throw new GuidedConflict('PILOT_DISABLED', 'New guided interviews are not enabled.', 404);
    const session = await runGuidedCommand(params.projectId, actorId, command);
    revalidatePath(`/project/${params.projectId}`);
    revalidatePath('/designer/projects');
    revalidatePath(`/designer/projects/${params.projectId}/preview`);
    return NextResponse.json({ ok: true, session }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
