/**
 * GET /api/admin/article-topics/[id]
 * Full topic detail with all contributions
 *
 * PATCH /api/admin/article-topics/[id]
 * Update topic (title, prompt, thresholds, status)
 *
 * DELETE /api/admin/article-topics/[id]
 * Archive topic (set status to ARCHIVED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deactivateTopicPrompts } from '@/lib/contributions';

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

    const topic = await prisma.articleTopic.findUnique({
      where: { id },
      include: {
        contributions: {
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
        },
        prompts: true,
        triggerSignal: true,
        publishedPost: {
          select: {
            id: true,
            slug: true,
            publishedAt: true,
          },
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

    // Calculate breakdown by role
    const roleCountMap = topic.contributions.reduce((acc, c) => {
      acc[c.userRole] = (acc[c.userRole] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group contributions by status
    const contributionsByStatus = {
      PENDING: topic.contributions.filter((c) => c.status === 'PENDING'),
      APPROVED: topic.contributions.filter((c) => c.status === 'APPROVED'),
      SELECTED: topic.contributions.filter((c) => c.status === 'SELECTED'),
      PUBLISHED: topic.contributions.filter((c) => c.status === 'PUBLISHED'),
      REJECTED: topic.contributions.filter((c) => c.status === 'REJECTED'),
    };

    return NextResponse.json({
      topic: {
        ...topic,
        contributionCount: topic._count.contributions,
        designerCount: roleCountMap['DESIGNER'] || 0,
        vendorCount: roleCountMap['VENDOR'] || 0,
        individualCount: roleCountMap['INDIVIDUAL'] || 0,
        contributionsByStatus,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/article-topics/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article topic' },
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
    const {
      title,
      promptQuestion,
      description,
      category,
      tags,
      targetRoles,
      targetMaterials,
      targetStyles,
      minSaveCount,
      minContributions,
      targetContributions,
      minDesigners,
      minReps,
      minIndividuals,
      targetPublishDate,
      status,
    } = body;

    // Validate topic exists
    const existingTopic = await prisma.articleTopic.findUnique({
      where: { id },
    });

    if (!existingTopic) {
      return NextResponse.json(
        { error: 'Article topic not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (title !== undefined) updateData.title = title.trim();
    if (promptQuestion !== undefined) updateData.promptQuestion = promptQuestion.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (targetRoles !== undefined) updateData.targetRoles = targetRoles;
    if (targetMaterials !== undefined) updateData.targetMaterials = targetMaterials;
    if (targetStyles !== undefined) updateData.targetStyles = targetStyles;
    if (minSaveCount !== undefined) updateData.minSaveCount = minSaveCount || null;
    if (minContributions !== undefined) updateData.minContributions = minContributions;
    if (targetContributions !== undefined) updateData.targetContributions = targetContributions;
    if (minDesigners !== undefined) updateData.minDesigners = minDesigners;
    if (minReps !== undefined) updateData.minReps = minReps || null;
    if (minIndividuals !== undefined) updateData.minIndividuals = minIndividuals || null;
    if (targetPublishDate !== undefined) {
      updateData.targetPublishDate = targetPublishDate ? new Date(targetPublishDate) : null;
    }

    // Handle status transitions
    if (status !== undefined && status !== existingTopic.status) {
      updateData.status = status;

      // Set timestamps based on status
      if (status === 'GATHERING' && !existingTopic.gatheringStartedAt) {
        updateData.gatheringStartedAt = new Date();
      }
      if (status === 'WRITING' && !existingTopic.writingStartedAt) {
        updateData.writingStartedAt = new Date();
      }
      if (status === 'PUBLISHED' && !existingTopic.publishedAt) {
        updateData.publishedAt = new Date();
      }
      if (status === 'ARCHIVED') {
        // Deactivate prompts when archiving
        await deactivateTopicPrompts(id);
      }
    }

    const topic = await prisma.articleTopic.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      topic,
    });
  } catch (error) {
    console.error('[PATCH /api/admin/article-topics/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update article topic' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Archive instead of delete
    const topic = await prisma.articleTopic.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    // Deactivate prompts
    await deactivateTopicPrompts(id);

    return NextResponse.json({
      success: true,
      topic,
    });
  } catch (error) {
    console.error('[DELETE /api/admin/article-topics/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to archive article topic' },
      { status: 500 }
    );
  }
}
