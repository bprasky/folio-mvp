import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { VendorContributionQualification } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for inviting vendors
const inviteVendorsSchema = z.object({
  vendorOrgIds: z.array(z.string()).min(1, 'At least one vendor is required'),
  qualificationType: z.nativeEnum(VendorContributionQualification).default('TAGGED'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/features/[id]/contributions/invite
 * Invite vendors to contribute to a feature
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
        primaryAuthorId: true,
        status: true,
        allowVendorContributions: true,
        vendorContributionMode: true,
        allowedVendorIds: true,
      },
    });

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    // Only the primary author can invite vendors
    const isAuthor = session.user.id === feature.primaryAuthorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the feature author can invite vendors' },
        { status: 403 }
      );
    }

    // Check if contributions are allowed
    if (!feature.allowVendorContributions) {
      return NextResponse.json(
        { error: 'Vendor contributions are not enabled for this feature' },
        { status: 400 }
      );
    }

    // Prevent invitations after feature is published
    if (['PUBLISHED', 'ABOVE_FOLD', 'ARCHIVED'].includes(feature.status)) {
      return NextResponse.json(
        { error: 'Cannot invite vendors after feature is published' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = inviteVendorsSchema.parse(body);

    // Validate that vendor organizations exist
    const vendors = await prisma.organization.findMany({
      where: {
        id: { in: data.vendorOrgIds },
        type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
      },
      select: { id: true, name: true },
    });

    if (vendors.length === 0) {
      return NextResponse.json(
        { error: 'No valid vendor organizations found' },
        { status: 400 }
      );
    }

    const validVendorIds = vendors.map((v) => v.id);

    // If mode is SELECTED, verify vendors are in allowed list
    if (feature.vendorContributionMode === 'SELECTED') {
      const notAllowed = validVendorIds.filter(
        (id) => !feature.allowedVendorIds.includes(id)
      );
      if (notAllowed.length > 0) {
        return NextResponse.json(
          { error: 'Some vendors are not in the allowed list', notAllowed },
          { status: 400 }
        );
      }
    }

    // Create invitations (skip duplicates)
    const contributions = await prisma.featureVendorContribution.createMany({
      data: validVendorIds.map((vendorOrgId) => ({
        featureId: id,
        vendorOrgId,
        qualificationType: data.qualificationType,
        status: 'INVITED',
      })),
      skipDuplicates: true,
    });

    // Update feature status if moving from DRAFT
    if (feature.status === 'DRAFT') {
      await prisma.feature.update({
        where: { id },
        data: { status: 'PENDING_CONTRIBUTIONS' },
      });
    }

    // Fetch the created/existing contributions
    const allContributions = await prisma.featureVendorContribution.findMany({
      where: {
        featureId: id,
        vendorOrgId: { in: validVendorIds },
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
    });

    return NextResponse.json({
      invited: contributions.count,
      contributions: allContributions,
    });
  } catch (error) {
    console.error('POST /api/features/[id]/contributions/invite error:', error);

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
