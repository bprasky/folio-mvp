import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordCandidateView, ReadinessError } from '@/lib/publishing-studio/readiness/service';
import { readinessActor, readinessFailure } from '@/lib/publishing-studio/readiness/http';
const schema = z.object({ version: z.number().int().positive(), sourceVersion: z.string().length(64), kind: z.enum(['shown', 'opened']), eventId: z.string().uuid() }).strict();
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await readinessActor(); const body = schema.safeParse(await request.json());
    if (!body.success) throw new ReadinessError('Invalid story event.');
    await recordCandidateView(userId, params.id, body.data.version, body.data.sourceVersion, body.data.kind, body.data.eventId);
    return NextResponse.json({ ok: true });
  } catch (error) { return readinessFailure(error); }
}
