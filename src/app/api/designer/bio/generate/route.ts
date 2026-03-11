export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generateFolioBio } from '@/lib/designer-bio/generate-bio';
import { BIO_MIN_ANSWERS } from '@/lib/designer-bio/constants';
import type { InterviewAnswer } from '@/lib/designer-bio/constants';

/**
 * POST /api/designer/bio/generate
 * Generate Folio Bio from all collected data.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get bio record
    const bio = await prisma.designerBio.findUnique({
      where: { userId },
    });

    if (!bio) {
      return NextResponse.json({ error: 'No bio record found. Start the interview first.' }, { status: 404 });
    }

    const answers = (bio.interviewAnswers as InterviewAnswer[] | null) || [];
    if (answers.length < BIO_MIN_ANSWERS) {
      return NextResponse.json(
        { error: `Need at least ${BIO_MIN_ANSWERS} answers to generate a bio. You have ${answers.length}.` },
        { status: 400 }
      );
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, role: true },
    });

    // Generate the bio
    const folioBio = await generateFolioBio({
      role: user?.role || 'DESIGNER',
      designerName: user?.name || 'the designer',
      interviewAnswers: answers,
      scrapedData: bio.scrapedData as Record<string, unknown> | null,
    });

    // Save the generated bio
    await prisma.designerBio.update({
      where: { userId },
      data: {
        folioBio,
        bioGeneratedAt: new Date(),
        bioEditedByUser: false,
        status: 'generated',
        interviewCompletedAt: bio.interviewCompletedAt || new Date(),
      },
    });

    return NextResponse.json({ success: true, folioBio });
  } catch (error: any) {
    console.error('[POST /api/designer/bio/generate] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate bio' },
      { status: 500 }
    );
  }
}
