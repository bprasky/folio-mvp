import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { FeatureStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for publish options
const publishOptionsSchema = z.object({
  aboveFold: z.boolean().default(false),
  aboveFoldDurationDays: z.number().min(1).max(30).default(7),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/features/[id]/publish
 * Publish a feature (requires admin approval first, or admin can directly publish)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const feature = await prisma.feature.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        primaryAuthorId: true,
        status: true,
        content: true,
        heroImageUrl: true,
        type: true,
      },
    });

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    const isAuthor = session.user.id === feature.primaryAuthorId;
    const isAdmin = session.user.role === 'ADMIN';

    // Admin can publish directly from any state
    // Author can only submit for review
    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to publish this feature' },
        { status: 403 }
      );
    }

    // If author (non-admin), they can only submit for review
    if (isAuthor && !isAdmin) {
      if (!['DRAFT', 'PENDING_CONTRIBUTIONS'].includes(feature.status)) {
        return NextResponse.json(
          { error: `Feature with status "${feature.status}" cannot be submitted for review` },
          { status: 400 }
        );
      }

      // Validate feature has required content
      if (!feature.title || !feature.content) {
        return NextResponse.json(
          { error: 'Feature must have a title and content before submitting for review' },
          { status: 400 }
        );
      }

      // Submit for review
      const updated = await prisma.feature.update({
        where: { id },
        data: { status: FeatureStatus.REVIEW },
      });

      return NextResponse.json({
        success: true,
        status: 'REVIEW',
        message: 'Feature submitted for review',
        feature: updated,
      });
    }

    // Admin publishing flow
    const body = await request.json().catch(() => ({}));
    const options = publishOptionsSchema.parse(body);

    // Validate feature is ready for publishing
    if (!feature.title) {
      return NextResponse.json(
        { error: 'Feature must have a title before publishing' },
        { status: 400 }
      );
    }

    // Determine new status
    let newStatus: FeatureStatus;
    let aboveFoldAt: Date | null = null;
    let aboveFoldExpiresAt: Date | null = null;

    if (options.aboveFold) {
      newStatus = FeatureStatus.ABOVE_FOLD;
      aboveFoldAt = new Date();
      aboveFoldExpiresAt = new Date(
        Date.now() + options.aboveFoldDurationDays * 24 * 60 * 60 * 1000
      );
    } else {
      newStatus = FeatureStatus.PUBLISHED;
    }

    const now = new Date();

    const updated = await prisma.feature.update({
      where: { id },
      data: {
        status: newStatus,
        publishedAt: feature.status !== 'PUBLISHED' && feature.status !== 'ABOVE_FOLD'
          ? now
          : undefined,
        aboveFoldAt,
        aboveFoldExpiresAt,
      },
      include: {
        primaryAuthor: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: options.aboveFold
        ? `Feature published above the fold for ${options.aboveFoldDurationDays} days`
        : 'Feature published successfully',
      feature: updated,
    });
  } catch (error) {
    console.error('POST /api/features/[id]/publish error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/features/[id]/publish
 * Unpublish/archive a feature (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can unpublish features' },
        { status: 403 }
      );
    }

    const feature = await prisma.feature.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    if (!['PUBLISHED', 'ABOVE_FOLD'].includes(feature.status)) {
      return NextResponse.json(
        { error: 'Feature is not currently published' },
        { status: 400 }
      );
    }

    const updated = await prisma.feature.update({
      where: { id },
      data: {
        status: FeatureStatus.ARCHIVED,
        aboveFoldAt: null,
        aboveFoldExpiresAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      status: 'ARCHIVED',
      message: 'Feature archived successfully',
      feature: updated,
    });
  } catch (error) {
    console.error('DELETE /api/features/[id]/publish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
