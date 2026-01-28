/**
 * GET /api/admin/article-topics
 * List all topics with filters (status, category)
 *
 * POST /api/admin/article-topics
 * Create new topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    const topics = await prisma.articleTopic.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(category && { category }),
      },
      orderBy: [
        { status: 'asc' },
        { queuedAt: 'desc' },
      ],
      include: {
        contributions: {
          select: {
            id: true,
            userRole: true,
            status: true,
          },
        },
        _count: {
          select: { contributions: true },
        },
      },
    });

    // Calculate breakdown by role for each topic
    const topicsWithStats = topics.map((topic) => {
      const roleCountMap = topic.contributions.reduce((acc, c) => {
        acc[c.userRole] = (acc[c.userRole] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        id: topic.id,
        title: topic.title,
        slug: topic.slug,
        promptQuestion: topic.promptQuestion,
        description: topic.description,
        category: topic.category,
        tags: topic.tags,
        targetRoles: topic.targetRoles,
        minContributions: topic.minContributions,
        targetContributions: topic.targetContributions,
        minDesigners: topic.minDesigners,
        minReps: topic.minReps,
        minIndividuals: topic.minIndividuals,
        status: topic.status,
        autoTriggered: topic.autoTriggered,
        trendSignalId: topic.trendSignalId,
        queuedAt: topic.queuedAt,
        gatheringStartedAt: topic.gatheringStartedAt,
        targetPublishDate: topic.targetPublishDate,
        publishedAt: topic.publishedAt,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
        contributionCount: topic._count.contributions,
        designerCount: roleCountMap['DESIGNER'] || 0,
        vendorCount: roleCountMap['VENDOR'] || 0,
        individualCount: roleCountMap['INDIVIDUAL'] || 0,
      };
    });

    return NextResponse.json({
      topics: topicsWithStats,
      count: topicsWithStats.length,
    });
  } catch (error) {
    console.error('[GET /api/admin/article-topics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article topics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
      tags = [],
      targetRoles = [],
      targetMaterials = [],
      targetStyles = [],
      minSaveCount,
      minContributions = 5,
      targetContributions = 15,
      minDesigners = 3,
      minReps,
      minIndividuals,
      targetPublishDate,
    } = body;

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!promptQuestion || typeof promptQuestion !== 'string' || promptQuestion.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt question is required' },
        { status: 400 }
      );
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for slug collision
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.articleTopic.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const topic = await prisma.articleTopic.create({
      data: {
        title: title.trim(),
        slug,
        promptQuestion: promptQuestion.trim(),
        description: description?.trim() || null,
        category,
        tags,
        targetRoles,
        targetMaterials,
        targetStyles,
        minSaveCount: minSaveCount || null,
        minContributions,
        targetContributions,
        minDesigners,
        minReps: minReps || null,
        minIndividuals: minIndividuals || null,
        targetPublishDate: targetPublishDate ? new Date(targetPublishDate) : null,
        status: 'QUEUED',
      },
    });

    return NextResponse.json({
      success: true,
      topic,
    });
  } catch (error) {
    console.error('[POST /api/admin/article-topics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create article topic' },
      { status: 500 }
    );
  }
}
