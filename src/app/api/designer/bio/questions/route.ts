export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { prepareBioQuestions } from '@/lib/designer-bio/interview-service';

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

    // Get bio record
    const bio = await prisma.designerBio.findUnique({
      where: { userId },
    });

    const questions = await prepareBioQuestions(userId, round === 'followup' ? 'followup' : 'base');
    const hasScrapedData = bio?.scrapedData && bio.status !== 'empty';

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
      round: round === 'followup' ? 'followup' : 'base',
      path: hasScrapedData ? 'website_exists' : 'blank_slate',
    });
  } catch (error: any) {
    console.error('[GET /api/designer/bio/questions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
