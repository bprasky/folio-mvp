import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { VendorContributionMode } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for updating contribution settings
const contributionSettingsSchema = z.object({
  allowVendorContributions: z.boolean(),
  vendorContributionMode: z.nativeEnum(VendorContributionMode).optional().nullable(),
  allowedVendorIds: z.array(z.string()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/features/[id]/contribution-settings
 * Get contribution settings for a feature
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
        allowVendorContributions: true,
        vendorContributionMode: true,
        allowedVendorIds: true,
        vendorContributions: {
          include: {
            vendorOrg: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    // Only author or admin can view contribution settings
    const isAuthor = session.user.id === feature.primaryAuthorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to view contribution settings' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      allowVendorContributions: feature.allowVendorContributions,
      vendorContributionMode: feature.vendorContributionMode,
      allowedVendorIds: feature.allowedVendorIds,
      contributions: feature.vendorContributions,
    });
  } catch (error) {
    console.error('GET /api/features/[id]/contribution-settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/features/[id]/contribution-settings
 * Update contribution settings for a feature (designer controls)
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

    // Only the primary author (designer) can update contribution settings
    const isAuthor = session.user.id === feature.primaryAuthorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the feature author can update contribution settings' },
        { status: 403 }
      );
    }

    // Prevent changes after feature is published
    if (['PUBLISHED', 'ABOVE_FOLD', 'ARCHIVED'].includes(feature.status)) {
      return NextResponse.json(
        { error: 'Cannot modify contribution settings after publishing' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = contributionSettingsSchema.parse(body);

    // Validate allowed vendor IDs if mode is SELECTED
    if (
      data.vendorContributionMode === 'SELECTED' &&
      (!data.allowedVendorIds || data.allowedVendorIds.length === 0)
    ) {
      return NextResponse.json(
        { error: 'Must specify allowed vendors when mode is SELECTED' },
        { status: 400 }
      );
    }

    const updatedFeature = await prisma.feature.update({
      where: { id },
      data: {
        allowVendorContributions: data.allowVendorContributions,
        vendorContributionMode: data.allowVendorContributions
          ? data.vendorContributionMode
          : null,
        allowedVendorIds: data.allowedVendorIds || [],
      },
      select: {
        id: true,
        allowVendorContributions: true,
        vendorContributionMode: true,
        allowedVendorIds: true,
      },
    });

    return NextResponse.json(updatedFeature);
  } catch (error) {
    console.error('PATCH /api/features/[id]/contribution-settings error:', error);

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
