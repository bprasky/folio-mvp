import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { ContributionStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for reviewing a contribution
const reviewContributionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string; vendorId: string }>;
}

/**
 * PATCH /api/features/[id]/contributions/[vendorId]/review
 * Designer approves or rejects a vendor contribution
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, vendorId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the feature to verify ownership
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

    // Only the feature author (designer) can review contributions
    const isAuthor = session.user.id === feature.primaryAuthorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the feature author can review contributions' },
        { status: 403 }
      );
    }

    const contribution = await prisma.featureVendorContribution.findUnique({
      where: {
        featureId_vendorOrgId: {
          featureId: id,
          vendorOrgId: vendorId,
        },
      },
    });

    if (!contribution) {
      return NextResponse.json(
        { error: 'Contribution not found' },
        { status: 404 }
      );
    }

    // Can only review submitted contributions
    if (contribution.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `Can only review submitted contributions. Current status: ${contribution.status}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = reviewContributionSchema.parse(body);

    const now = new Date();

    let newStatus: ContributionStatus;
    let updateData: {
      status: ContributionStatus;
      approvedAt?: Date;
      rejectedAt?: Date;
      rejectionReason?: string;
    };

    if (data.action === 'approve') {
      newStatus = 'APPROVED';
      updateData = {
        status: newStatus,
        approvedAt: now,
      };
    } else {
      newStatus = 'REJECTED';
      updateData = {
        status: newStatus,
        rejectedAt: now,
        rejectionReason: data.rejectionReason,
      };
    }

    const updated = await prisma.featureVendorContribution.update({
      where: {
        featureId_vendorOrgId: {
          featureId: id,
          vendorOrgId: vendorId,
        },
      },
      data: updateData,
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

    // TODO: Send notification to vendor about approval/rejection

    return NextResponse.json({
      success: true,
      action: data.action,
      contribution: updated,
    });
  } catch (error) {
    console.error(
      'PATCH /api/features/[id]/contributions/[vendorId]/review error:',
      error
    );

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
