/**
 * GET /api/admin/article-topics/[id]/contributions
 * All contributions for topic with user info
 *
 * PATCH /api/admin/article-topics/[id]/contributions
 * Update contribution status (APPROVED, SELECTED, REJECTED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateContributionStatus } from '@/lib/contributions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const contributions = await prisma.contribution.findMany({
      where: {
        articleTopicId: id,
        ...(status && { status: status as any }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            role: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      contributions,
      count: contributions.length,
    });
  } catch (error) {
    console.error('[GET /api/admin/article-topics/[id]/contributions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { contributionId, status, editedContent, pullQuote } = body;

    if (!contributionId || typeof contributionId !== 'string') {
      return NextResponse.json(
        { error: 'Contribution ID is required' },
        { status: 400 }
      );
    }

    if (!status || !isValidStatus(status)) {
      return NextResponse.json(
        { error: 'Valid status is required' },
        { status: 400 }
      );
    }

    // Verify contribution belongs to this topic
    const existing = await prisma.contribution.findUnique({
      where: { id: contributionId },
      select: { articleTopicId: true },
    });

    if (!existing || existing.articleTopicId !== id) {
      return NextResponse.json(
        { error: 'Contribution not found for this topic' },
        { status: 404 }
      );
    }

    // Update contribution status
    const contribution = await updateContributionStatus(contributionId, status, {
      editedContent,
      pullQuote,
    });

    return NextResponse.json({
      success: true,
      contribution,
    });
  } catch (error) {
    console.error('[PATCH /api/admin/article-topics/[id]/contributions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update contribution' },
      { status: 500 }
    );
  }
}

function isValidStatus(status: string): status is 'PENDING' | 'APPROVED' | 'SELECTED' | 'PUBLISHED' | 'REJECTED' {
  return ['PENDING', 'APPROVED', 'SELECTED', 'PUBLISHED', 'REJECTED'].includes(status);
}
