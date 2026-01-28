/**
 * GET /api/article-topics/[id]
 *
 * Get single topic detail with contributions (published ones only for non-admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const isAdmin = session?.user?.role === 'ADMIN';

    const topic = await prisma.articleTopic.findUnique({
      where: { id },
      include: {
        contributions: {
          where: isAdmin
            ? {} // Admin sees all
            : { status: 'PUBLISHED' }, // Non-admin sees only published
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { contributions: true },
        },
      },
    });

    if (!topic) {
      return NextResponse.json(
        { error: 'Article topic not found' },
        { status: 404 }
      );
    }

    // Get contribution breakdown by role
    const roleBreakdown = await prisma.contribution.groupBy({
      by: ['userRole'],
      where: { articleTopicId: id },
      _count: true,
    });

    const roleCountMap = roleBreakdown.reduce((acc, r) => {
      acc[r.userRole] = r._count;
      return acc;
    }, {} as Record<string, number>);

    // Get user's contribution if logged in
    let userContribution = null;
    if (userId) {
      userContribution = await prisma.contribution.findUnique({
        where: {
          userId_articleTopicId: { userId, articleTopicId: id },
        },
        select: {
          id: true,
          userId: true,
          userRole: true,
          type: true,
          content: true,
          status: true,
          createdAt: true,
        },
      });
    }

    return NextResponse.json({
      topic: {
        ...topic,
        contributionCount: topic._count.contributions,
        designerCount: roleCountMap['DESIGNER'] || 0,
        vendorCount: roleCountMap['VENDOR'] || 0,
        individualCount: roleCountMap['INDIVIDUAL'] || 0,
        userContribution,
      },
    });
  } catch (error) {
    console.error('[GET /api/article-topics/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article topic' },
      { status: 500 }
    );
  }
}
