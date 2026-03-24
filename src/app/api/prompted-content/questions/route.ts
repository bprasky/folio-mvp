export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  shouldGenerateQuestions,
  generateBioReflectiveQuestions,
  generateProjectReflectiveQuestions,
} from '@/lib/prompted-content/generateQuestions';

const QUESTION_SELECT = {
  id: true,
  questionText: true,
  questionType: true,
  deliveryContext: true,
  priority: true,
  status: true,
  createdAt: true,
  provenance: true,
} as const;

/**
 * GET /api/prompted-content/questions
 *
 * Returns pending prompted questions for the authenticated user.
 * Triggers lazy generation if no pending questions exist:
 *   1. Try bio-reflective (requires completed bio)
 *   2. Try project-reflective (requires published projects)
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
      select: QUESTION_SELECT,
    });

    // If no pending questions, try to generate some
    if (questions.length === 0) {
      const canGenerate = await shouldGenerateQuestions(userId);
      if (canGenerate) {
        let generated = false;

        // Strategy 1: Bio-reflective questions (if bio exists)
        const bio = await prisma.designerBio.findUnique({
          where: { userId },
          select: { status: true, folioBio: true },
        });

        if (bio?.folioBio && bio.status !== 'empty') {
          const created = await generateBioReflectiveQuestions(userId);
          if (created.length > 0) generated = true;
        }

        // Strategy 2: Project-reflective questions (if published projects exist)
        if (!generated) {
          const created = await generateProjectReflectiveQuestions(userId);
          if (created.length > 0) generated = true;
        }

        // Re-fetch after generation
        if (generated) {
          questions = await prisma.promptedQuestion.findMany({
            where: {
              targetUserId: userId,
              status: { in: ['GENERATED', 'DELIVERED'] },
            },
            orderBy: { priority: 'desc' },
            take: 3,
            select: QUESTION_SELECT,
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
