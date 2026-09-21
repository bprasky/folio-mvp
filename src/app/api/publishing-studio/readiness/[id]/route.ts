import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { changeCandidate, ReadinessError } from '@/lib/publishing-studio/readiness/service';
import { readinessActor, readinessFailure } from '@/lib/publishing-studio/readiness/http';
const schema = z.object({ version: z.number().int().positive(), sourceVersion: z.string().length(64),
  action: z.enum(['answer', 'edit', 'draft', 'dismiss', 'restore', 'published']), blockerId: z.string().max(100).optional(),
  answer: z.string().max(2200).optional(), headline: z.string().max(180).optional(), caption: z.string().max(2200).optional(),
  imageIds: z.array(z.string().max(100)).max(4).optional(), reason: z.string().max(100).optional(),
  pendingAnswer: z.object({ blockerId: z.string().min(1).max(100), text: z.string().min(1).max(2200) }).strict().nullable().optional() }).strict();
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await readinessActor(); const body = schema.safeParse(await request.json());
    if (!body.success) throw new ReadinessError('Check the story action and try again.');
    return NextResponse.json({ candidate: await changeCandidate(userId, params.id, body.data) });
  } catch (error) { return readinessFailure(error); }
}
