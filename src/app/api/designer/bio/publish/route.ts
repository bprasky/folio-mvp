export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generateInitialSeedQuestions } from '@/lib/designer-bio/qa-generation';
import type { InterviewAnswer } from '@/lib/designer-bio/constants';
import { canAccessDesignerTools } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/designer/bio/publish
 * Publish the bio to the About tab.
 * Also triggers initial Q&A seed generation.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const result = await prisma.$transaction(async tx => {
      const actor = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!actor || !canAccessDesignerTools(actor.role)) return { error: 'Forbidden', status: 403 } as const;
      const bio = await tx.designerBio.findUnique({ where: { userId } });
      if (!bio?.folioBio?.trim()) return { error: 'No bio to publish. Generate one first.', status: 400 } as const;
      // The explicit publish action updates both public bio surfaces atomically.
      await tx.designerBio.update({ where: { userId }, data: { status: 'published' } });
      await tx.user.update({ where: { id: userId }, data: { bio: bio.folioBio } });
      return { bio };
    }, { isolationLevel: 'Serializable' });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { bio } = result;
    revalidatePath(`/designer/${userId}`);
    revalidatePath(`/api/profiles/${userId}/about`);
    revalidatePath('/designer/profile');

    // Trigger initial Q&A seed generation (fire-and-forget)
    const answers = (bio.interviewAnswers as InterviewAnswer[] | null) || [];
    generateInitialSeedQuestions(
      userId,
      bio.folioBio!,
      answers.map((a) => ({ question: a.question, answer: a.answer })),
      bio.scrapedData as Record<string, unknown> | null
    ).catch((err) => {
      console.error('[bio/publish] Failed to generate initial Q&A questions:', err);
    });

    return NextResponse.json({ success: true, status: 'published' });
  } catch (error: any) {
    console.error('[POST /api/designer/bio/publish] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
