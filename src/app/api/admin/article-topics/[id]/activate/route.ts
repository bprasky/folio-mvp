/**
 * POST /api/admin/article-topics/[id]/activate
 *
 * Move topic from QUEUED to GATHERING
 * - Sets gatheringStartedAt
 * - Creates default ContributionPrompt for MAGAZINE_PAGE
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDefaultPrompt } from '@/lib/contributions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate topic exists and is in QUEUED status
    const topic = await prisma.articleTopic.findUnique({
      where: { id },
    });

    if (!topic) {
      return NextResponse.json(
        { error: 'Article topic not found' },
        { status: 404 }
      );
    }

    if (topic.status !== 'QUEUED') {
      return NextResponse.json(
        { error: 'Topic must be in QUEUED status to activate' },
        { status: 400 }
      );
    }

    // Update topic status
    const updatedTopic = await prisma.articleTopic.update({
      where: { id },
      data: {
        status: 'GATHERING',
        gatheringStartedAt: new Date(),
      },
    });

    // Create default prompts for main locations
    await createDefaultPrompt(id, 'MAGAZINE_PAGE');
    await createDefaultPrompt(id, 'FOR_YOU_FEED');

    return NextResponse.json({
      success: true,
      topic: updatedTopic,
      message: 'Topic is now gathering voices',
    });
  } catch (error) {
    console.error('[POST /api/admin/article-topics/[id]/activate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to activate article topic' },
      { status: 500 }
    );
  }
}
