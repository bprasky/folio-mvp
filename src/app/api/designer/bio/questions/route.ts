export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  getBlankSlateQuestions,
  generateWebsiteContextQuestions,
  generateFollowUpQuestions,
} from '@/lib/designer-bio/questions';
import type { InterviewAnswer } from '@/lib/designer-bio/constants';

/**
 * GET /api/designer/bio/questions
 * Get current interview questions. Generates if needed.
 *
 * Query params:
 * - round: 'base' | 'followup' (default: 'base')
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const round = request.nextUrl.searchParams.get('round') || 'base';

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // Get bio record
    const bio = await prisma.designerBio.findUnique({
      where: { userId },
    });

    if (round === 'followup') {
      // Generate follow-up questions from base answers
      const answers = (bio?.interviewAnswers as InterviewAnswer[] | null) || [];
      const baseAnswers = answers.filter((a) => a.round === 'base');

      if (baseAnswers.length < 3) {
        return NextResponse.json({
          questions: [],
          message: 'Need at least 3 base answers before follow-up questions are available',
        });
      }

      const followUps = await generateFollowUpQuestions(
        baseAnswers,
        user?.role || 'DESIGNER',
        bio?.scrapedData as Record<string, unknown> | null
      );

      // Update bio status to interviewing
      if (bio && bio.status === 'scraped') {
        await prisma.designerBio.update({
          where: { userId },
          data: { status: 'interviewing' },
        });
      }

      return NextResponse.json({ questions: followUps, round: 'followup' });
    }

    // Base questions
    const hasScrapedData = bio?.scrapedData && bio.status !== 'empty';

    let questions;
    if (hasScrapedData) {
      // Website exists path
      questions = await generateWebsiteContextQuestions(
        bio!.scrapedData as Record<string, unknown>,
        user?.role || 'DESIGNER'
      );
    } else {
      // Blank slate path
      questions = getBlankSlateQuestions(user?.role || 'DESIGNER');
    }

    // Update bio status to interviewing
    if (bio && (bio.status === 'empty' || bio.status === 'scraped')) {
      await prisma.designerBio.update({
        where: { userId },
        data: { status: 'interviewing' },
      });
    } else if (!bio) {
      await prisma.designerBio.create({
        data: { userId, status: 'interviewing' },
      });
    }

    return NextResponse.json({
      questions,
      round: 'base',
      path: hasScrapedData ? 'website_exists' : 'blank_slate',
    });
  } catch (error: any) {
    console.error('[GET /api/designer/bio/questions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
