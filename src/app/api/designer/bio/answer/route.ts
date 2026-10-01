export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { saveBioAnswer } from '@/lib/designer-bio/interview-service';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const RequestSchema = z.object({
  questionId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  round: z.enum(['base', 'followup']).default('base'),
});

/**
 * POST /api/designer/bio/answer
 * Save an answer to a bio interview question.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 });
    }

    const userId = session.user.id;
    const { questionId, question, answer, round } = parsed.data;

    const result = await saveBioAnswer(userId, { id: questionId, question, answer, round });
    revalidatePath('/designer/studio/about-me');
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[POST /api/designer/bio/answer] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
