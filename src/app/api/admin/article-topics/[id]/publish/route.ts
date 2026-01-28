/**
 * POST /api/admin/article-topics/[id]/publish
 * Publish topic as article
 * - Bulk updates all SELECTED contributions to PUBLISHED
 * - Generates share cards for all published contributions
 * - Sends notifications to all contributors
 * - Sets topic status to PUBLISHED
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAllVariants } from '@/lib/share-cards';
import { notifyContributionPublished } from '@/lib/notifications';
import { checkAndAwardBadges } from '@/lib/contributions';

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

    // Get topic with contributions
    const topic = await prisma.articleTopic.findUnique({
      where: { id },
      include: {
        contributions: {
          where: {
            status: { in: ['SELECTED', 'APPROVED'] },
          },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!topic) {
      return NextResponse.json(
        { error: 'Article topic not found' },
        { status: 404 }
      );
    }

    if (topic.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Topic is already published' },
        { status: 400 }
      );
    }

    // Get selected contributions (prioritize SELECTED, then APPROVED)
    const selectedContributions = topic.contributions.filter(
      (c) => c.status === 'SELECTED'
    );
    const approvedContributions = topic.contributions.filter(
      (c) => c.status === 'APPROVED'
    );

    const contributionsToPublish =
      selectedContributions.length > 0
        ? selectedContributions
        : approvedContributions;

    if (contributionsToPublish.length === 0) {
      return NextResponse.json(
        { error: 'No approved or selected contributions to publish' },
        { status: 400 }
      );
    }

    // Update topic status
    await prisma.articleTopic.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Bulk update contributions to PUBLISHED
    const contributionIds = contributionsToPublish.map((c) => c.id);
    await prisma.contribution.updateMany({
      where: { id: { in: contributionIds } },
      data: { status: 'PUBLISHED' },
    });

    // Update user published counts
    const userIds = [...new Set(contributionsToPublish.map((c) => c.userId))];
    for (const userId of userIds) {
      const userContributionCount = contributionsToPublish.filter(
        (c) => c.userId === userId
      ).length;
      await prisma.user.update({
        where: { id: userId },
        data: {
          publishedContributionCount: { increment: userContributionCount },
        },
      });
    }

    // Generate share cards and send notifications (async, don't block response)
    const publishPromises = contributionsToPublish.map(async (contribution) => {
      try {
        // Generate share cards
        await generateAllVariants(contribution.id);

        // Send notification
        await notifyContributionPublished(contribution.id);

        // Check for badges
        await checkAndAwardBadges(contribution.userId);
      } catch (error) {
        console.error(
          `[publish] Error processing contribution ${contribution.id}:`,
          error
        );
      }
    });

    // Start processing but don't wait
    Promise.all(publishPromises).catch(console.error);

    return NextResponse.json({
      success: true,
      publishedCount: contributionsToPublish.length,
      contributorCount: userIds.length,
      message: `Published ${contributionsToPublish.length} contribution(s) from ${userIds.length} contributor(s). Share cards and notifications are being generated.`,
    });
  } catch (error) {
    console.error('[POST /api/admin/article-topics/[id]/publish] Error:', error);
    return NextResponse.json(
      { error: 'Failed to publish topic' },
      { status: 500 }
    );
  }
}
