export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  shouldGenerateQuestions,
  generateBioReflectiveQuestions,
} from '@/lib/prompted-content/generateQuestions';

/**
 * GET /api/prompted-content/questions
 *
 * Returns pending prompted questions for the authenticated user.
 * Triggers lazy generation if the user has a completed bio but no pending questions.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    // Fetch pending questions
    let questions = await prisma.promptedQuestion.findMany({
      where: {
        targetUserId: userId,
        status: { in: ['GENERATED', 'DELIVERED'] },
      },
      orderBy: { priority: 'desc' },
      take: 3,
      select: {
        id: true,
        questionText: true,
        questionType: true,
        deliveryContext: true,
        priority: true,
        status: true,
        createdAt: true,
        provenance: true,
      },
    });

    // If no pending questions, try to generate some
    if (questions.length === 0) {
      const canGenerate = await shouldGenerateQuestions(userId);
      if (canGenerate) {
        // Check if user has a completed bio
        const bio = await prisma.designerBio.findUnique({
          where: { userId },
          select: { status: true, folioBio: true },
        });

        if (bio?.folioBio && bio.status !== 'empty') {
          await generateBioReflectiveQuestions(userId);

          // Re-fetch after generation
          questions = await prisma.promptedQuestion.findMany({
            where: {
              targetUserId: userId,
              status: { in: ['GENERATED', 'DELIVERED'] },
            },
            orderBy: { priority: 'desc' },
            take: 3,
            select: {
              id: true,
              questionText: true,
              questionType: true,
              deliveryContext: true,
              priority: true,
              status: true,
              createdAt: true,
              provenance: true,
            },
          });
        }
      }
    }

    // Mark fetched questions as DELIVERED
    const questionIds = questions
      .filter((q) => q.status === 'GENERATED')
      .map((q) => q.id);

    if (questionIds.length > 0) {
      await prisma.promptedQuestion.updateMany({
        where: { id: { in: questionIds } },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
    }

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('[GET /api/prompted-content/questions] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}
