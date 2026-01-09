import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { FeatureStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for updating a Feature
const updateFeatureSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
  heroImageUrl: z.string().url().optional().nullable(),
  content: z.any().optional(),
  status: z.nativeEnum(FeatureStatus).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/features/[id]
 * Get a specific feature
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    const feature = await prisma.feature.findUnique({
      where: { id },
      include: {
        primaryAuthor: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            bio: true,
            studio: true,
          },
        },
        sourceEvent: {
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            startDate: true,
            endDate: true,
            location: true,
            eventTypes: true,
          },
        },
        sourceProject: {
          select: {
            id: true,
            title: true,
            description: true,
            images: {
              take: 5,
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
        vendorContributions: {
          where: {
            status: 'APPROVED',
          },
          include: {
            vendorOrg: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    // Check if user can view unpublished features
    const isPublished = ['PUBLISHED', 'ABOVE_FOLD'].includes(feature.status);
    const isAuthor = session?.user?.id === feature.primaryAuthorId;
    const isAdmin = session?.user?.role === 'ADMIN';

    if (!isPublished && !isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    // Track view if published and above the fold
    if (feature.status === 'ABOVE_FOLD') {
      await prisma.feature.update({
        where: { id },
        data: { aboveFoldViews: { increment: 1 } },
      });
    }

    return NextResponse.json(feature);
  } catch (error) {
    console.error('GET /api/features/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/features/[id]
 * Update a feature
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
        primaryAuthorId: true,
        status: true,
      },
    });

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    // Check authorization
    const isAuthor = session.user.id === feature.primaryAuthorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to update this feature' },
        { status: 403 }
      );
    }

    // Prevent editing published features (except by admin)
    if (['PUBLISHED', 'ABOVE_FOLD'].includes(feature.status) && !isAdmin) {
      return NextResponse.json(
        { error: 'Cannot edit a published feature' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateFeatureSchema.parse(body);

    // Restrict status transitions for non-admins
    if (data.status && !isAdmin) {
      const allowedTransitions: Record<FeatureStatus, FeatureStatus[]> = {
        DRAFT: ['PENDING_CONTRIBUTIONS', 'REVIEW'],
        PENDING_CONTRIBUTIONS: ['REVIEW', 'DRAFT'],
        REVIEW: ['DRAFT'],
        APPROVED: [],
        PUBLISHED: [],
        ABOVE_FOLD: [],
        ARCHIVED: [],
      };

      const currentStatus = feature.status as FeatureStatus;
      if (!allowedTransitions[currentStatus]?.includes(data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${data.status}` },
          { status: 403 }
        );
      }
    }

    const updatedFeature = await prisma.feature.update({
      where: { id },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        excerpt: data.excerpt,
        heroImageUrl: data.heroImageUrl,
        content: data.content,
        status: data.status,
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

    return NextResponse.json(updatedFeature);
  } catch (error) {
    console.error('PATCH /api/features/[id] error:', error);

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
 * DELETE /api/features/[id]
 * Delete a feature (only draft features, or by admin)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
        primaryAuthorId: true,
        status: true,
      },
    });

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    const isAuthor = session.user.id === feature.primaryAuthorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to delete this feature' },
        { status: 403 }
      );
    }

    // Only allow deleting draft features (unless admin)
    if (feature.status !== 'DRAFT' && !isAdmin) {
      return NextResponse.json(
        { error: 'Can only delete draft features' },
        { status: 403 }
      );
    }

    await prisma.feature.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/features/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
