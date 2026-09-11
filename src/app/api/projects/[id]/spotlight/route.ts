import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { z } from 'zod';
import { spotlightEnabled, spotlightEnrolled, SpotlightConflict } from '@/lib/spotlight/gate';
import { runSpotlight } from '@/lib/spotlight/service';

export const dynamic = 'force-dynamic';
const id = z.string().min(1).max(160);
const command = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resume') }), z.object({ action: z.literal('schedule') }), z.object({ action: z.literal('rebuild') }),
  z.object({ action: z.literal('select'), tagId: id, selected: z.boolean(), expectedSelectionVersion: z.number().int().positive().optional() }),
  z.object({ action: z.literal('followup'), questionId: id }),
  z.object({ action: z.literal('accept'), questionId: id, text: z.string().min(1).max(100000), requestKey: z.string().min(1).max(128), stateVersion: z.number().int().nonnegative(), selectionVersion: z.number().int().positive(), inputModality: z.enum(['TEXT', 'VOICE', 'MIXED']), reuseRevisionId: id.optional(), confirmReuse: z.boolean().optional() }),
  z.object({ action: z.literal('ordinary'), questionId: id, text: z.string().min(1).max(100000), expectedVersion: z.number().int().nonnegative(), requestKey: z.string().min(1).max(128) }),
]);
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ actorId: session.user.id, enrolled: spotlightEnrolled(params.id), enabled: spotlightEnabled(params.id, session.user.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = command.parse(await req.json());
    return NextResponse.json(await runSpotlight(params.id, session.user.id, input), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof SpotlightConflict) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ code: 'INVALID_REQUEST', error: 'Invalid spotlight request.' }, { status: 400 });
    console.error('[spotlight] transaction failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ code: 'SAVE_FAILED', error: 'Save failed. Your draft is retained; retry with the same request.' }, { status: 500 });
  }
}
